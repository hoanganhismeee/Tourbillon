// Blind check of the graded labels.
//
// The rubrics in queries.mjs are one person's reading of each brief, written from the brief alone.
// That is better than labelling from the output, but it is still one opinion, and a rubric that
// quietly disagrees with every reasonable reader produces scores nobody can defend.
//
// This pools candidates from several arms, hides which arm found what, and asks a model to grade
// them 0-3 against the same sentences the rubric is argued from. What comes back is not the truth:
// it is a second opinion, and the number worth reporting is how often the two agree. Where they
// disagree, the rubric is read again and moved when the judge has the better argument.
//
// Usage:
//   node eval/judge-pool.mjs                 # 12 briefs, 10 candidates each
//   node eval/judge-pool.mjs --sample=6 --per-brief=8
//   node eval/judge-pool.mjs --out=eval/results/judge.json
import { readFileSync, writeFileSync } from 'node:fs';
import { loadCatalogue, gradeFor } from './catalogue.mjs';
import { HANDWRITTEN, scopeOf, validateQueries } from './queries.mjs';
import { mulberry32 } from './metrics.mjs';

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v = 'true'] = a.replace(/^--/, '').split('=');
  return [k, v];
}));
const BASE_URL = args['base-url'] ?? process.env.BASE_URL ?? 'http://localhost:5248';
const SAMPLE = Number(args.sample ?? 12);
const PER_BRIEF = Number(args['per-brief'] ?? 10);
const MODEL = args.model ?? 'claude-haiku-4-5';
const SEED = Number(args.seed ?? 20260924);

const DIM = '\x1b[2m', BOLD = '\x1b[1m', RESET = '\x1b[0m', YELLOW = '\x1b[33m', GREEN = '\x1b[32m';

/// The key lives in .env and nowhere else. It is read even when commented out, because local .env
/// keeps it commented while the stack runs on the local model.
function apiKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
  const match = /^#?\s*LLM_API_KEY=(.+)$/m.exec(env);
  if (!match) throw new Error('No LLM_API_KEY in .env and no ANTHROPIC_API_KEY in the environment');
  return match[1].trim();
}

/// What the judge is shown about one watch: the facts a salesperson would read off the card.
function describe(watch) {
  const bits = [
    `${watch.brandName} ${watch.collectionName} ${watch.name}`.replace(/\s+/g, ' ').trim(),
    watch.price > 0 ? `$${watch.price.toLocaleString('en-AU')}` : 'price on request',
    watch.caseMaterial || 'case material unknown',
    watch.diameterMm ? `${watch.diameterMm} mm` : null,
    watch.waterResistanceM ? `${watch.waterResistanceM} m water resistance` : null,
    watch.movementFamily,
    watch.dialColour ? `${watch.dialColour} dial` : null,
    watch.strapMaterial ? `on ${watch.strapMaterial}` : null,
    watch.functions.length ? watch.functions.slice(0, 4).join(', ') : null,
  ].filter(Boolean);
  return bits.join(' | ');
}

async function armIds(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) return [];
  const json = await res.json();
  return (json.watches ?? []).map(w => w.id);
}

/// Candidates from more than one retriever, so the pool is not the shape of a single arm, plus a
/// handful of random watches: without them a judge only ever sees things some system already liked.
async function poolFor(query, catalogue, rand) {
  const [bm25, hybrid] = await Promise.all([
    armIds('/api/watch/find?mode=bm25', { query }),
    armIds('/api/watch/find?mode=hybrid', { query }),
  ]);
  const random = [...catalogue.records].sort(() => rand() - 0.5).slice(0, 3).map(w => w.id);
  const pool = [...new Set([...bm25.slice(0, 8), ...hybrid.slice(0, 8), ...random])];
  return pool.sort(() => rand() - 0.5).slice(0, PER_BRIEF);
}

function judgePrompt(query, label, candidates) {
  const tiers = (label.rubric ?? [])
    .sort((a, b) => b.grade - a.grade)
    .map(tier => `  ${tier.grade}: ${tier.why}`)
    .join('\n');
  const must = Object.keys(label.must ?? {}).length
    ? `The customer stated this as a hard requirement: ${JSON.stringify(label.must)}. Breaking it is grade 0.`
    : 'The customer stated no hard requirement.';
  const lines = candidates.map((c, i) => `${i + 1}. ${c.text}`).join('\n');
  return `A customer asks a luxury watch concierge: "${query}"

Grade each watch 0-3 for how well it answers that request:
${tiers}
  0: does not answer the request
${must}

Watches:
${lines}

Reply with one JSON array, one object per watch, in the order given:
[{"n": 1, "grade": 2, "why": "eight words at most"}]
No prose outside the JSON.`;
}

async function judge(prompt, key) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 900, messages: [{ role: 'user', content: prompt }] }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = await res.json();
  const text = (body.content ?? []).map(part => part.text ?? '').join('');
  const match = /\[[\s\S]*\]/.exec(text);
  if (!match) throw new Error(`No JSON in the judge's reply: ${text.slice(0, 120)}`);
  return { rows: JSON.parse(match[0]), usage: body.usage ?? {} };
}

async function main() {
  const key = apiKey();
  const catalogue = await loadCatalogue(BASE_URL);
  const validated = validateQueries(catalogue, HANDWRITTEN);
  const rand = mulberry32(SEED);
  const briefs = validated
    .filter(q => scopeOf(q) === 'semantic' && q.status === 'ok')
    .sort(() => rand() - 0.5)
    .slice(0, SAMPLE);

  console.log(`${BOLD}Blind grade check${RESET} ${DIM}${briefs.length} briefs, up to ${PER_BRIEF} watches each, ${MODEL}${RESET}\n`);

  const rows = [];
  let inputTokens = 0, outputTokens = 0;
  for (const brief of briefs) {
    const ids = await poolFor(brief.query, catalogue, rand);
    const candidates = ids.map(id => catalogue.byId.get(id)).filter(Boolean)
      .map(watch => ({ id: watch.id, text: describe(watch), mine: gradeFor(watch, brief) }));
    if (candidates.length === 0) continue;

    const { rows: verdicts, usage } = await judge(judgePrompt(brief.query, brief, candidates), key);
    inputTokens += usage.input_tokens ?? 0;
    outputTokens += usage.output_tokens ?? 0;

    for (const [i, candidate] of candidates.entries()) {
      const verdict = verdicts.find(v => Number(v.n) === i + 1);
      if (!verdict) continue;
      rows.push({ id: brief.id, query: brief.query, watch: candidate.text,
                  mine: candidate.mine, theirs: Number(verdict.grade), why: verdict.why });
    }
    process.stdout.write(`\r${DIM}  ${rows.length} judged${RESET}`);
  }

  const exact = rows.filter(r => r.mine === r.theirs).length;
  const close = rows.filter(r => Math.abs(r.mine - r.theirs) <= 1).length;
  console.log(`\r${' '.repeat(30)}\r`);
  console.log(`  judged          ${rows.length}`);
  console.log(`  exact agreement ${GREEN}${((exact / rows.length) * 100).toFixed(0)}%${RESET}`);
  console.log(`  within one      ${((close / rows.length) * 100).toFixed(0)}%`);
  console.log(`  cost            $${((inputTokens * 1 + outputTokens * 5) / 1_000_000).toFixed(3)} ${DIM}(${inputTokens} in, ${outputTokens} out)${RESET}`);

  const apart = rows.filter(r => Math.abs(r.mine - r.theirs) >= 2)
    .sort((a, b) => Math.abs(b.mine - b.theirs) - Math.abs(a.mine - a.theirs));
  if (apart.length) {
    console.log(`\n${BOLD}Two grades apart${RESET} ${DIM}read the rubric again for these${RESET}`);
    for (const row of apart.slice(0, 20)) {
      console.log(`  ${YELLOW}${row.id}${RESET} ${DIM}"${row.query.slice(0, 44)}"${RESET}`);
      console.log(`      ${row.watch.slice(0, 96)}`);
      console.log(`      ${DIM}rubric ${row.mine}, judge ${row.theirs}: ${row.why}${RESET}`);
    }
  }

  if (args.out) {
    writeFileSync(args.out, JSON.stringify({ model: MODEL, seed: SEED, rows }, null, 2));
    console.log(`\n${DIM}wrote ${args.out}${RESET}`);
  }
}

main().catch(err => { console.error(err.message); process.exit(1); });
