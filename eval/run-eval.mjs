// Smart Search evaluation harness — scores the retrieval pipeline against a labelled query set.
// Runs each query through two arms (keyword baseline and the full Smart Search pipeline), scores
// both with the same metrics, and reports the delta with a paired bootstrap interval so the
// difference can be quoted as a measurement rather than an impression.
//
// Usage:
//   node eval/run-eval.mjs --inspect            # what the catalogue actually contains
//   node eval/run-eval.mjs --validate           # label health, no API calls to the search arms
//   node eval/run-eval.mjs                      # full run, both arms
//   node eval/run-eval.mjs --arms=smart --k=10  # single arm
//   BASE_URL=http://localhost:5248 node eval/run-eval.mjs
//
// Requires: backend running, WatchFinderSettings:DisableLimitInDev=true (otherwise the daily
// quota rejects the run after 5 queries).

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadCatalogue, summariseFacets } from './catalogue.mjs';
import { HANDWRITTEN, buildGenerated, validateQueries } from './queries.mjs';
import {
  recallAtK, precisionAtK, reciprocalRank, ndcgAtK, hitAtK,
  mean, percentile, bootstrapCI, pairedBootstrap,
} from './metrics.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

const RESET = '\x1b[0m', BOLD = '\x1b[1m', DIM = '\x1b[2m';
const CYAN = '\x1b[36m', GREEN = '\x1b[32m', YELLOW = '\x1b[33m', RED = '\x1b[31m';

const args = parseArgs(process.argv.slice(2));
const BASE_URL = args['base-url'] ?? process.env.BASE_URL ?? 'http://localhost:5248';
const K = Number(args.k ?? 10);
const PRECISION_K = Number(args.pk ?? 5);
const ARMS = String(args.arms ?? 'keyword,smart').split(',').map(s => s.trim()).filter(Boolean);
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
  // Existing full-text/fuzzy search. This is the honest "before" number: what the site
  // returned before any embedding or LLM work, not a strawman built for the comparison.
  keyword: async query => {
    const res = await fetch(`${BASE_URL}/api/search?q=${encodeURIComponent(query)}`,
      { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    return { ids: (body.watches ?? []).map(w => w.id), meta: {} };
  },

  // Deterministic catalogue path, then pgvector, then LLM rerank. searchPath tells us which
  // of those actually ran, which is how the cost and latency story gets attributed.
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
      ids: (body.watches ?? []).map(w => w.id),
      meta: { searchPath: body.searchPath ?? 'unknown', rerankSource: body.rerankSource ?? 'unknown' },
    };
  },
};

// -- Main ---------------------------------------------------------------------

async function main() {
  console.log(`${BOLD}Smart Search evaluation${RESET} ${DIM}${BASE_URL}${RESET}\n`);

  const catalogue = await loadCatalogue(BASE_URL).catch(err => {
    console.error(`${RED}Could not load catalogue: ${err.message}${RESET}`);
    console.error(`${DIM}Is the backend up? Try: make up${RESET}`);
    process.exit(1);
  });

  if (args.inspect) return printFacets(catalogue);

  const all = [...HANDWRITTEN, ...buildGenerated(catalogue)];
  const validated = validateQueries(catalogue, all, { maxShare: MAX_SHARE });
  const usable = validated.filter(q => q.status === 'ok');
  const scored = LIMIT ? usable.slice(0, LIMIT) : usable;

  printLabelReport(validated, catalogue);
  if (args.validate) return;

  if (scored.length === 0) {
    console.error(`${RED}No usable queries. Fix the labels flagged above before running the arms.${RESET}`);
    process.exit(1);
  }

  const results = {};
  for (const arm of ARMS) {
    if (!ARM_IMPLS[arm]) { console.error(`${RED}Unknown arm: ${arm}${RESET}`); process.exit(1); }
    results[arm] = await runArm(arm, scored);
  }

  printScores(results, scored);
  printPaths(results);
  printComparison(results, scored);
  writeReport(results, scored, catalogue);
}

/// Runs one arm over the whole set sequentially. Sequential on purpose: the point of the
/// latency column is what a single user waits, not what the service does under load.
async function runArm(arm, queries) {
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
        recall: error ? null : recallAtK(ids, q.relevant, K),
        precision: error ? null : precisionAtK(ids, q.relevant, PRECISION_K),
        mrr: error ? null : reciprocalRank(ids, q.relevant, K),
        ndcg: error ? null : ndcgAtK(ids, q.relevant, K),
        hit: error ? null : hitAtK(ids, q.relevant, K),
      };
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

  for (const status of ['empty', 'too_broad', 'thin']) {
    const rows = byStatus[status] ?? [];
    if (!rows.length) continue;
    const why = { empty: 'no catalogue match — label wrong or data missing',
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

  // Per-category recall exposes where the pipeline earns its cost. Expect the two arms to be
  // close on reference and brand lookups, and far apart on descriptor and compound briefs.
  const categories = [...new Set(queries.map(q => q.category))].sort();
  console.log(`\n${BOLD}Recall@${K} by category${RESET}`);
  console.log(`  ${'category'.padEnd(14)}${'n'.padStart(4)}${Object.keys(results).map(a => a.padStart(10)).join('')}`);
  for (const cat of categories) {
    const n = queries.filter(q => q.category === cat).length;
    const cells = Object.values(results).map(rows =>
      fmt(mean(rows.filter(r => r.category === cat).map(r => r.recall))).padStart(10)).join('');
    console.log(`  ${cat.padEnd(14)}${String(n).padStart(4)}${cells}`);
  }
}

/// Which internal path served each query. This is the number behind any claim about
/// keeping queries off the LLM: it is measured per request, not assumed from the code.
function printPaths(results) {
  const rows = results.smart;
  if (!rows) return;
  const paths = groupBy(rows.filter(r => r.searchPath), r => r.searchPath);
  const total = Object.values(paths).reduce((a, r) => a + r.length, 0);
  if (!total) return;

  // Recall is scored per path, not just per arm, because the architectural question is not
  // "is Smart Search better" but "which of its stages earns its cost". A path that is slow and
  // no more accurate than the cheap SQL path is a candidate for deletion, and this is the
  // table that says so. Paths are chosen by the router, so these are observational groups
  // over different queries, not a controlled comparison - read them as a signal to dig into.
  console.log(`\n${BOLD}Smart Search path distribution${RESET}`);
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
  const [a, b] = arms;
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
    const sig = stat.ci.lo > 0 ? `${GREEN}significant${RESET}` : `${YELLOW}not significant${RESET}`;
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

function writeReport(results, queries, catalogue) {
  const dir = join(HERE, 'results');
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = join(dir, `eval-${stamp}.json`);
  writeFileSync(file, JSON.stringify({
    runAt: new Date().toISOString(),
    baseUrl: BASE_URL, k: K, precisionK: PRECISION_K, passes: PASSES,
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
