// Smart Search evaluation harness — scores the retrieval pipeline against a labelled query set.
// Runs each query through two arms (keyword baseline and the full Smart Search pipeline), scores
// both with the same metrics, and reports the delta with a paired bootstrap interval so the
// difference can be quoted as a measurement rather than an impression.
//
// Usage:
//   node eval/run-eval.mjs --inspect            # what the catalogue actually contains
//   node eval/run-eval.mjs --validate           # label health, no API calls to the search arms
//   node eval/run-eval.mjs                      # full run, both arms
//   node eval/run-eval.mjs --arms=bm25,keyword,vector,hybrid,smart  # first arm is the baseline for every delta
//   node eval/run-eval.mjs --scope=spec          # only the facet queries the parser owns
//   node eval/run-eval.mjs --scope=semantic --arms=keyword,concierge   # only open-ended briefs
//   node eval/run-eval.mjs --from=eval/results/eval-<stamp>.json   # re-print a saved run, no API calls
//   BASE_URL=http://localhost:5248 node eval/run-eval.mjs
//
// Requires: backend running, WatchFinderSettings:DisableLimitInDev=true (otherwise the daily
// quota rejects the run after 5 queries).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadCatalogue, summariseFacets } from './catalogue.mjs';
import { HANDWRITTEN, buildGenerated, validateQueries, scopeOf } from './queries.mjs';
import { buildCatalogueIndex, scoreActions, summariseActions } from './actions.mjs';
import { scoreSlots, summariseSlots } from './slots.mjs';
import { parseServerTiming, summariseStages } from './timing.mjs';
import {
  recallAtK, precisionAtK, reciprocalRank, ndcgAtK, hitAtK,
  mean, percentile, bootstrapCI, pairedBootstrap, recallCeiling, significance,
} from './metrics.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

const RESET = '\x1b[0m', BOLD = '\x1b[1m', DIM = '\x1b[2m';
const CYAN = '\x1b[36m', GREEN = '\x1b[32m', YELLOW = '\x1b[33m', RED = '\x1b[31m';

const args = parseArgs(process.argv.slice(2));
const BASE_URL = args['base-url'] ?? process.env.BASE_URL ?? 'http://localhost:5248';
const K = Number(args.k ?? 10);
const PRECISION_K = Number(args.pk ?? 5);
const ARMS = String(args.arms ?? 'keyword,smart').split(',').map(s => s.trim()).filter(Boolean);
// Which half of the golden set to score: spec (facet queries the deterministic parser owns),
// semantic (open-ended briefs the concierge owns), or all. Scoring an arm on the queries the
// other subsystem now serves measures a scope decision, not retrieval quality.
const SCOPE = String(args.scope ?? 'all').trim();
const LIMIT = args.limit ? Number(args.limit) : null;
const PASSES = Number(args.passes ?? 1);
const DELAY_MS = Number(args.delay ?? 0);
// Largest share of the catalogue a label may match before it stops discriminating between
// arms. Exposed as a flag because the right ceiling depends on how the catalogue is skewed.
const MAX_SHARE = Number(args['max-share'] ?? 0.25);

// -- Arms ---------------------------------------------------------------------
// Each arm turns a query string into a ranked list of watch ids plus whatever diagnostics
// that endpoint exposes. Nothing else in the harness knows which arm it is scoring.

const ARM_IMPLS = {
  // The site's own search bar: substring matching with a hand-built score. Kept as the
  // "what the site shipped" number; bm25 is the standard lexical baseline to compare against.
  keyword: async query => {
    const res = await fetch(`${BASE_URL}/api/search?q=${encodeURIComponent(query)}`,
      { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    return { ids: (body.watches ?? []).map(w => w.id), meta: {} };
  },

  // The concierge keeps the model stages Smart Search dropped (classifier, LLM parse, rerank),
  // so scoring its cards on the same labels shows what those stages buy over the model-free path.
  // One fresh session per query, because the golden set is single-turn and shared session
  // state would let one query's context leak into the next.
  concierge: async query => {
    const sessionId = `eval-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    try {
      const res = await fetch(`${BASE_URL}/api/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: query }),
        signal: AbortSignal.timeout(180_000),
      });
      if (res.status === 429) throw new Error('429 quota — set ChatSettings:DisableLimitInDev=true');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      return {
        ids: (body.watchCards ?? []).map(c => c.id),
        meta: {
          stages: parseServerTiming(res.headers.get('server-timing')),
          searchPath: body.finderPath ?? body.routingPath ?? 'concierge',
          routingPath: body.routingPath ?? null,
          actions: (body.actions ?? []).map(a => ({
            type: a.type, label: a.label, slugs: a.slugs ?? null, query: a.query ?? null, href: a.href ?? null,
          })),
        },
      };
    } finally {
      await fetch(`${BASE_URL}/api/chat/session/${sessionId}`, {
        method: 'DELETE', signal: AbortSignal.timeout(10_000),
      }).catch(() => {});
    }
  },

  // Smart Search as shipped: deterministic parse and SQL, then BM25F inside the parsed filters,
  // with no model call anywhere. searchPath says which of the two answered.
  smart: async query => {
    const res = await fetch(`${BASE_URL}/api/watch/find`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(180_000),
    });
    if (res.status === 429) throw new Error('429 quota — set WatchFinderSettings:DisableLimitInDev=true');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    return {
      ids: rankedIds(body),
      meta: {
        searchPath: body.searchPath ?? 'unknown',
        rerankSource: body.rerankSource ?? 'unknown',
        queryIntent: body.queryIntent ?? null,
      },
    };
  },

  // The three retrieval designs below run with no parser, no rerank and no cache, so each is
  // measured on its own terms rather than through whatever the full pipeline routed it to.

  // BM25F over brand, collection, reference, description and spec values: the standard lexical
  // baseline, as opposed to the site's substring search in the keyword arm.
  bm25: query => findWithMode(query, 'bm25'),

  // Cosine similarity over watch embeddings: what the vector index is worth alone.
  vector: query => findWithMode(query, 'vector'),

  // BM25F and vector rankings fused by reciprocal rank in the backend. Only positions are
  // combined, because a BM25 score and a cosine distance share no scale.
  hybrid: query => findWithMode(query, 'hybrid'),
};

/// Calls the finder with a retrieval mode. The backend refuses an unknown mode, so a typo here
/// fails loudly instead of quietly scoring the full pipeline under the wrong name.
async function findWithMode(query, mode) {
  const res = await fetch(`${BASE_URL}/api/watch/find`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, mode }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  return { ids: rankedIds(body), meta: { searchPath: body.searchPath ?? mode } };
}

/// Shown results first, then the rest of the ranked pool. Metrics read the first k, so this only
/// matters when --k asks for more than the fifteen a results page shows.
function rankedIds(body) {
  return [...(body.watches ?? []), ...(body.otherCandidates ?? [])].map(w => w.id);
}

// -- Main ---------------------------------------------------------------------

async function main() {
  if (args.from) return reprint(String(args.from));
  console.log(`${BOLD}Smart Search evaluation${RESET} ${DIM}${BASE_URL}${RESET}`);
  console.log(`${DIM}scope ${SCOPE}   arms ${ARMS.join(', ')}${RESET}\n`);

  const catalogue = await loadCatalogue(BASE_URL).catch(err => {
    console.error(`${RED}Could not load catalogue: ${err.message}${RESET}`);
    console.error(`${DIM}Is the backend up? Try: make up${RESET}`);
    process.exit(1);
  });

  if (args.inspect) return printFacets(catalogue);

  const all = [...HANDWRITTEN, ...buildGenerated(catalogue)];
  const validated = validateQueries(catalogue, all, { maxShare: MAX_SHARE });
  const usable = validated.filter(q => q.status === 'ok');
  const inScope = SCOPE === 'all' ? usable : usable.filter(q => scopeOf(q) === SCOPE);
  const scored = LIMIT ? inScope.slice(0, LIMIT) : inScope;

  printLabelReport(validated, catalogue);
  if (args.validate) return;

  if (scored.length === 0) {
    console.error(`${RED}No usable queries in scope "${SCOPE}". Valid scopes: all, spec, semantic.${RESET}`);
    console.error(`${DIM}If the scope is right, fix the labels flagged above before running the arms.${RESET}`);
    process.exit(1);
  }

  const results = {};
  const index = buildCatalogueIndex(catalogue);
  for (const arm of ARMS) {
    if (!ARM_IMPLS[arm]) { console.error(`${RED}Unknown arm: ${arm}${RESET}`); process.exit(1); }
    results[arm] = await runArm(arm, scored, catalogue, index);
  }

  printScores(results, scored);
  printPaths(results);
  printStages(results);
  printComparison(results, scored);
  printSlots(results);
  printActions(results);
  writeReport(results, scored, catalogue);
}

/// Re-prints the report from a saved run, so a fix to the reporting never means paying for the
/// model-backed arms again. Only the stored rows are needed; the catalogue is not reloaded.
function reprint(file) {
  const saved = JSON.parse(readFileSync(file, 'utf8'));
  const results = saved.rows;
  const first = Object.values(results)[0] ?? [];
  const queries = [...new Map(first.map(r => [r.queryId, { id: r.queryId, category: r.category, query: r.query }])).values()];
  console.log(`${BOLD}Smart Search evaluation${RESET} ${DIM}replaying ${file}${RESET}`);
  console.log(`${DIM}run at ${saved.runAt}   scope ${saved.scope ?? 'all'}   arms ${Object.keys(results).join(', ')}${RESET}`);
  printScores(results, queries);
  printPaths(results);
  printStages(results);
  printComparison(results, queries);
  printSlots(results);
  printActions(results);
}

/// Runs one arm over the whole set sequentially. Sequential on purpose: the point of the
/// latency column is what a single user waits, not what the service does under load.
async function runArm(arm, queries, catalogue, index) {
  console.log(`\n${BOLD}${CYAN}arm: ${arm}${RESET} ${DIM}${queries.length} queries x ${PASSES} pass(es)${RESET}`);
  const rows = [];

  for (let pass = 1; pass <= PASSES; pass++) {
    for (const [i, q] of queries.entries()) {
      const started = performance.now();
      let ids = [], meta = {}, error = null;
      try {
        ({ ids, meta } = await ARM_IMPLS[arm](q.query));
      } catch (err) {
        error = err.message;
      }
      const latencyMs = performance.now() - started;

      const row = {
        pass, queryId: q.id, category: q.category, query: q.query,
        relevantCount: q.relevantCount, returned: ids.length, latencyMs, error, ...meta,
        ceiling: recallCeiling(q.relevantCount, K),
        recall: error ? null : recallAtK(ids, q.relevant, K),
        precision: error ? null : precisionAtK(ids, q.relevant, PRECISION_K),
        mrr: error ? null : reciprocalRank(ids, q.relevant, K),
        ndcg: error ? null : ndcgAtK(ids, q.relevant, K),
        hit: error ? null : hitAtK(ids, q.relevant, K),
      };
      // Structured filter accuracy applies where a label reduces to facets, which is the spec half.
      if (!error && meta.queryIntent !== undefined && scopeOf(q) === 'spec') {
        row.slots = scoreSlots(q.truth, meta.queryIntent, catalogue);
      }
      // Actions are scored against the same labels as the cards; a hand-off search is run through
      // Smart Search, which is where the concierge sends it.
      if (!error && meta.actions) {
        row.actionScores = await scoreActions(meta.actions, {
          index, relevant: q.relevant, search: async text => (await ARM_IMPLS.smart(text)).ids,
        });
      }
      rows.push(row);
      process.stdout.write(`\r${DIM}  pass ${pass}  ${i + 1}/${queries.length}  ${q.id.padEnd(24).slice(0, 24)}${RESET}`);
      if (DELAY_MS) await sleep(DELAY_MS);
    }
  }
  process.stdout.write('\r' + ' '.repeat(70) + '\r');

  const failures = rows.filter(r => r.error);
  if (failures.length) {
    console.log(`  ${YELLOW}${failures.length} request(s) failed${RESET} ${DIM}${failures[0].error}${RESET}`);
  }
  return rows;
}

// -- Reporting ----------------------------------------------------------------

function printFacets(catalogue) {
  const f = summariseFacets(catalogue);
  console.log(`${BOLD}Catalogue${RESET}`);
  console.log(`  watches ${f.watches}   price-on-request ${f.priceOnRequest}`);
  console.log(`  price   ${money(f.priceMin)} .. ${money(f.priceMedian)} (median) .. ${money(f.priceMax)}`);
  console.log(`  case    ${f.diameterMin}mm .. ${f.diameterMax}mm`);
  for (const [label, entries] of [
    ['brands', f.brands], ['styles', f.styles], ['materials', f.materials],
    ['movements', f.movements], ['dials', f.dials], ['functions', f.functions],
  ]) {
    console.log(`\n${BOLD}${label}${RESET} ${DIM}(${entries.length} distinct)${RESET}`);
    for (const [name, count] of entries.slice(0, 14)) {
      console.log(`  ${String(count).padStart(4)}  ${name}`);
    }
  }
}

function printLabelReport(validated, catalogue) {
  const byStatus = groupBy(validated, q => q.status);
  const ok = byStatus.ok ?? [];
  console.log(`${BOLD}Golden set${RESET} ${DIM}${catalogue.records.length} watches in catalogue${RESET}`);
  console.log(`  usable      ${GREEN}${ok.length}${RESET} / ${validated.length}`);
  console.log(`  median relevant per query  ${median(ok.map(q => q.relevantCount)) ?? '-'}`);

  for (const status of ['invalid_key', 'empty', 'too_broad', 'thin']) {
    const rows = byStatus[status] ?? [];
    if (!rows.length) continue;
    const why = { invalid_key: 'truth uses a key the matcher ignores — label wider than written',
                  empty: 'no catalogue match — label wrong or data missing',
                  too_broad: `matches >${(MAX_SHARE * 100).toFixed(0)}% of catalogue — not discriminative`,
                  thin: 'fewer than 2 matches — recall is unstable' }[status];
    console.log(`  ${YELLOW}${status.padEnd(11)}${RESET}${rows.length}  ${DIM}${why}${RESET}`);
    for (const q of rows.slice(0, 6)) {
      console.log(`      ${DIM}${q.id.padEnd(22)} ${String(q.relevantCount).padStart(4)}  "${q.query.slice(0, 46)}"${RESET}`);
    }
  }
  console.log(`\n  ${DIM}by category: ${Object.entries(groupBy(ok, q => q.category))
    .map(([c, r]) => `${c} ${r.length}`).join('  ')}${RESET}`);
}

function printScores(results, queries) {
  console.log(`\n${BOLD}Retrieval quality${RESET} ${DIM}n=${queries.length}, k=${K}, precision@${PRECISION_K}${RESET}`);
  console.log(`  ${'arm'.padEnd(10)}${'recall'.padStart(16)}${'prec'.padStart(8)}${'MRR'.padStart(8)}${'nDCG'.padStart(8)}${'hit'.padStart(8)}${'p50 ms'.padStart(9)}${'p95 ms'.padStart(9)}`);
  for (const [arm, rows] of Object.entries(results)) {
    const recall = mean(rows.map(r => r.recall));
    const ci = bootstrapCI(rows.map(r => r.recall));
    const lat = rows.map(r => r.latencyMs);
    const recallCell = ci
      ? `${fmt(recall)} ${DIM}±${((ci.hi - ci.lo) / 2).toFixed(2)}${RESET}`
      : fmt(recall);
    console.log(`  ${arm.padEnd(10)}${recallCell.padStart(16 + (ci ? DIM.length + RESET.length : 0))}` +
      `${fmt(mean(rows.map(r => r.precision))).padStart(8)}` +
      `${fmt(mean(rows.map(r => r.mrr))).padStart(8)}` +
      `${fmt(mean(rows.map(r => r.ndcg))).padStart(8)}` +
      `${fmt(mean(rows.map(r => r.hit))).padStart(8)}` +
      `${Math.round(percentile(lat, 50)).toString().padStart(9)}` +
      `${Math.round(percentile(lat, 95)).toString().padStart(9)}`);
  }

  // Recall is shown against its own ceiling. A label matching more watches than k caps the
  // score however good the ranking is, so the raw number conflates label breadth with system
  // quality: 0.13 against a 76-watch label is a perfect result, 0.13 against a 20-watch label
  // is a poor one. The share of ceiling is what says whether a category actually works.
  const categories = [...new Set(queries.map(q => q.category))].sort();
  const arms = Object.keys(results);
  console.log(`
${BOLD}Recall@${K} by category${RESET} ${DIM}(share of ceiling in brackets)${RESET}`);
  console.log(`  ${'category'.padEnd(14)}${'n'.padStart(4)}${'ceiling'.padStart(9)}` +
    arms.map(a => a.padStart(17)).join(''));
  for (const cat of categories) {
    const inCat = rows => rows.filter(r => r.category === cat);
    const ceiling = mean(inCat(results[arms[0]]).map(r => r.ceiling));
    const cells = arms.map(arm => {
      const recall = mean(inCat(results[arm]).map(r => r.recall));
      const share = recall != null && ceiling ? `${((recall / ceiling) * 100).toFixed(0)}%` : '-';
      return `${fmt(recall)} (${share})`.padStart(17);
    }).join('');
    console.log(`  ${cat.padEnd(14)}${String(inCat(results[arms[0]]).length).padStart(4)}${fmt(ceiling).padStart(9)}${cells}`);
  }

  const overallCeiling = mean(results[arms[0]].map(r => r.ceiling));
  console.log(`
  ${DIM}A perfect ranker scores ${fmt(overallCeiling)} on this set, not 1.000.${RESET}`);
  for (const arm of arms) {
    const recall = mean(results[arm].map(r => r.recall));
    console.log(`  ${DIM}${arm.padEnd(11)}${fmt(recall)} = ${((recall / overallCeiling) * 100).toFixed(0)}% of achievable${RESET}`);
  }
}

/// Which internal path served each query. This is the number behind any claim about
/// keeping queries off the LLM: it is measured per request, not assumed from the code.
function printPaths(results) {
  // Smart Search and the concierge are the arms with stages worth attributing; without either,
  // hybrid still reports when one retriever contributed nothing.
  const arms = ['smart', 'concierge'].filter(arm => results[arm]);
  if (!arms.length && (results.hybrid ?? results.vector)) arms.push(results.hybrid ? 'hybrid' : 'vector');
  for (const arm of arms) printPathsFor(arm, results[arm]);
}

/// Where the concierge's time goes, per stage, from the Server-Timing header on each reply.
function printStages(results) {
  const rows = results.concierge;
  if (!rows) return;
  const { requests, stages } = summariseStages(rows);
  if (!requests) return;
  console.log(`
${BOLD}Stage timing${RESET} ${DIM}concierge, ${requests} replies; chat and planner run in parallel${RESET}`);
  console.log(`  ${'stage'.padEnd(12)}${'ran on'.padStart(9)}${'calls'.padStart(7)}${'p50 ms'.padStart(9)}${'p95 ms'.padStart(9)}`);
  for (const s of stages) {
    console.log(`  ${s.name.padEnd(12)}${`${s.ran}/${requests}`.padStart(9)}${s.callsPerRequest.toFixed(1).padStart(7)}` +
      `${Math.round(s.p50).toString().padStart(9)}${Math.round(s.p95).toString().padStart(9)}`);
  }
}

function printPathsFor(arm, rows) {
  const paths = groupBy(rows.filter(r => r.searchPath), r => r.searchPath);
  const total = Object.values(paths).reduce((a, r) => a + r.length, 0);
  if (!total) return;

  // Recall is scored per path, not just per arm, because the architectural question is not
  // "is Smart Search better" but "which of its stages earns its cost". A path that is slow and
  // no more accurate than the cheap SQL path is a candidate for deletion, and this is the
  // table that says so. Paths are chosen by the router, so these are observational groups
  // over different queries, not a controlled comparison - read them as a signal to dig into.
  console.log(`\n${BOLD}Path distribution${RESET} ${DIM}${arm}${RESET}`);
  console.log(`  ${'path'.padEnd(34)}${'n'.padStart(4)}${'share'.padStart(7)}${'recall'.padStart(9)}${'p50 ms'.padStart(9)}${'p95 ms'.padStart(9)}`);
  for (const [path, group] of Object.entries(paths).sort((a, b) => b[1].length - a[1].length)) {
    const lat = group.map(r => r.latencyMs);
    console.log(`  ${path.padEnd(34)}${String(group.length).padStart(4)}` +
      `${((group.length / total) * 100).toFixed(0) + '%'}`.padStart(7) +
      `${fmt(mean(group.map(r => r.recall))).padStart(9)}` +
      `${Math.round(percentile(lat, 50)).toString().padStart(9)}` +
      `${Math.round(percentile(lat, 95)).toString().padStart(9)}`);
  }
  const llm = rows.filter(r => (r.searchPath ?? '').includes('rerank')).length;
  console.log(`  ${DIM}LLM rerank invoked on ${llm}/${total} queries (${((llm / total) * 100).toFixed(0)}%)${RESET}`);

  // A query served from the persistent semantic cache replays an answer computed by an earlier
  // run, possibly under different code. Those rows score the cache, not the pipeline, so the
  // run is only reproducible once they are gone. Loud rather than silent: a stale cache quietly
  // flattering (or damning) a category is the easiest way to draw a wrong conclusion here.
  const cached = rows.filter(r => (r.searchPath ?? '').startsWith('cache_hit'));
  if (cached.length) {
    console.log(`\n  ${YELLOW}${cached.length}/${total} queries were served from the semantic cache${RESET}`);
    console.log(`  ${DIM}Those measure a previous run, not the current pipeline. Clear it for a clean`);
    console.log(`  comparison: DELETE /api/admin/query-cache (admin auth required).${RESET}`);
    for (const r of cached.slice(0, 8)) {
      console.log(`    ${DIM}${fmt(r.recall)}  "${r.query.slice(0, 46)}"${RESET}`);
    }
  }
}

/// Paired bootstrap on the per-query deltas. Two arms scored on the same queries are paired
/// data, so pairing removes the query-difficulty variance that would otherwise swamp the effect.
function printComparison(results, queries) {
  const arms = Object.keys(results);
  if (arms.length < 2) return;
  // The first arm listed is the baseline and every other arm is compared against it, so a
  // four-arm run reports three paired deltas instead of silently testing only the first two.
  const [baseline, ...challengers] = arms;
  for (const challenger of challengers) printPair(results, queries, baseline, challenger);
}

function printPair(results, queries, a, b) {
  const byId = rows => {
    const m = new Map();
    for (const r of rows) if (!m.has(r.queryId)) m.set(r.queryId, r);
    return m;
  };
  const [ma, mb] = [byId(results[a]), byId(results[b])];
  const ids = queries.map(q => q.id).filter(id => ma.has(id) && mb.has(id));

  console.log(`\n${BOLD}${b} vs ${a}${RESET} ${DIM}paired bootstrap, 2000 resamples${RESET}`);
  for (const metric of ['recall', 'precision', 'mrr', 'ndcg']) {
    const stat = pairedBootstrap(ids.map(id => ma.get(id)[metric]), ids.map(id => mb.get(id)[metric]));
    if (!stat) continue;
    const verdict = significance(stat.ci);
    const sig = verdict === 'better' ? `${GREEN}significantly better${RESET}`
      : verdict === 'worse' ? `${RED}significantly worse${RESET}`
      : `${YELLOW}not significant${RESET}`;
    console.log(`  ${metric.padEnd(10)}${(stat.delta >= 0 ? '+' : '')}${stat.delta.toFixed(3)}` +
      `  ${DIM}95% CI [${stat.ci.lo.toFixed(3)}, ${stat.ci.hi.toFixed(3)}]${RESET}  ${sig}`);
  }

  const regressions = ids
    .map(id => ({ id, delta: (mb.get(id).recall ?? 0) - (ma.get(id).recall ?? 0), q: mb.get(id).query }))
    .filter(r => r.delta < -0.05).sort((x, y) => x.delta - y.delta);
  if (regressions.length) {
    console.log(`\n  ${YELLOW}${regressions.length} queries where ${b} is worse${RESET}`);
    for (const r of regressions.slice(0, 8)) {
      console.log(`    ${DIM}${r.delta.toFixed(2)}  ${r.id.padEnd(20)} "${r.q.slice(0, 44)}"${RESET}`);
    }
  }
}

/// How well each arm's parser read the constraints in the spec half, slot by slot.
function printSlots(results) {
  for (const [arm, rows] of Object.entries(results)) {
    const scored = rows.map(r => r.slots).filter(Boolean);
    if (!scored.length) continue;
    const s = summariseSlots(scored);
    console.log(`\n${BOLD}Structured filter accuracy${RESET} ${DIM}${arm}, ${s.queries} queries whose label implies a filter${RESET}`);
    console.log(`  slot recall ${fmt(s.slotRecall)}   slot precision ${fmt(s.slotPrecision)}   F1 ${fmt(s.slotF1)}   read exactly ${pct(s.exactMatch)}`);
    console.log(`  ${'slot'.padEnd(22)}${'matched'.padStart(9)}${'wrong'.padStart(7)}${'missed'.padStart(8)}`);
    for (const [slot, c] of Object.entries(s.perSlot).sort(([a], [b]) => a.localeCompare(b))) {
      console.log(`  ${slot.padEnd(22)}${String(c.matched).padStart(9)}${String(c.wrong).padStart(7)}${String(c.missed).padStart(8)}`);
    }
  }
}

/// Validity and relevance of the actions an arm attached to its replies.
function printActions(results) {
  for (const [arm, rows] of Object.entries(results)) {
    const withScores = rows.filter(r => r.actionScores);
    if (!withScores.length) continue;
    const s = summariseActions(withScores);
    console.log(`\n${BOLD}Action relevance${RESET} ${DIM}${arm}, ${s.replies} replies${RESET}`);
    console.log(`  replies with an action ${s.repliesWithActions}/${s.replies}   ` +
      `with a relevant action ${s.repliesWithRelevantAction}/${s.repliesWithActions}`);
    console.log(`  ${'type'.padEnd(10)}${'n'.padStart(4)}${'valid'.padStart(8)}${'relevant'.padStart(10)}${'mean score'.padStart(12)}`);
    for (const [type, t] of Object.entries(s.perType)) {
      console.log(`  ${type.padEnd(10)}${String(t.count).padStart(4)}${pct(t.validRate).padStart(8)}${pct(t.relevantRate).padStart(10)}${fmt(t.meanScore).padStart(12)}`);
    }
  }
}

function writeReport(results, queries, catalogue) {
  const dir = join(HERE, 'results');
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = join(dir, `eval-${stamp}.json`);
  writeFileSync(file, JSON.stringify({
    runAt: new Date().toISOString(),
    baseUrl: BASE_URL, k: K, precisionK: PRECISION_K, passes: PASSES, scope: SCOPE,
    catalogueSize: catalogue.records.length,
    queryCount: queries.length,
    summary: Object.fromEntries(Object.entries(results).map(([arm, rows]) => [arm, {
      recall: mean(rows.map(r => r.recall)),
      precision: mean(rows.map(r => r.precision)),
      mrr: mean(rows.map(r => r.mrr)),
      ndcg: mean(rows.map(r => r.ndcg)),
      hitRate: mean(rows.map(r => r.hit)),
      latencyP50: percentile(rows.map(r => r.latencyMs), 50),
      latencyP95: percentile(rows.map(r => r.latencyMs), 95),
      errors: rows.filter(r => r.error).length,
      ...(rows.some(r => r.slots) ? { slots: summariseSlots(rows.map(r => r.slots).filter(Boolean)) } : {}),
      ...(rows.some(r => r.actionScores) ? { actions: summariseActions(rows.filter(r => r.actionScores)) } : {}),
    }])),
    rows: results,
  }, null, 2));
  console.log(`\n${DIM}wrote ${file}${RESET}`);
}

// -- Helpers ------------------------------------------------------------------

function parseArgs(argv) {
  const out = {};
  for (const arg of argv) {
    const m = arg.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) out[m[1]] = m[2] ?? true;
  }
  return out;
}

/// Progress is carriage-return redraw, which only makes sense on a terminal. When the run is
/// piped to a file or CI log the per-query lines are dropped rather than smeared into one line.
function progress(text) {
  if (process.stdout.isTTY) process.stdout.write(`\r${DIM}${text}${RESET}`);
}

function clearProgress() {
  if (process.stdout.isTTY) process.stdout.write('\r' + ' '.repeat(70) + '\r');
}

const fmt = v => (v == null ? '-' : v.toFixed(3));
const pct = v => (v == null ? '-' : `${Math.round(v * 100)}%`);
const money = v => (v == null ? '-' : `$${Math.round(v).toLocaleString('en-AU')}`);
const sleep = ms => new Promise(r => setTimeout(r, ms));

function groupBy(rows, pick) {
  const out = {};
  for (const r of rows) (out[pick(r)] ??= []).push(r);
  return out;
}

function median(values) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

main().catch(err => {
  console.error(`${RED}${err.stack ?? err.message}${RESET}`);
  process.exit(1);
});
