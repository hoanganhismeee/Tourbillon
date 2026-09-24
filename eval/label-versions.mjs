// Which label version reads a brief the way an outside opinion does?
//
// A metric cannot be validated by its own score: v2 scores higher than v1 because the ruler changed,
// not because anything got better. What can be checked is agreement with a judgement made without
// either ruler in view. So: pool candidates, ask a model to grade them 0-3 from the brief alone —
// no rubric, no predicate, nothing from the labels — and then score each label version against the
// same verdicts. The version that tracks the outside opinion more closely is the better ruler.
//
// Usage: extract the old labels from git, then compare:
//   git show <commit>:eval/queries.mjs > /tmp/queries.old.mjs
//   node eval/label-versions.mjs /tmp/queries.old.mjs
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { loadCatalogue, gradeFor, relevantIds } from './catalogue.mjs';
import { HANDWRITTEN as V2, scopeOf, validateQueries } from './queries.mjs';
import { mulberry32 } from './metrics.mjs';

const BASE_URL = 'http://localhost:5248';
const SAMPLE = Number(process.env.SAMPLE ?? 12);
const PER_BRIEF = Number(process.env.PER_BRIEF ?? 10);
const SEED = 20260924;

const v1Module = await import(pathToFileURL(process.argv[2]).href);
const V1 = new Map(v1Module.HANDWRITTEN.map(q => [q.id, q]));

function apiKey() {
  const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
  return /^#?\s*LLM_API_KEY=(.+)$/m.exec(env)[1].trim();
}

function describe(w) {
  return [`${w.brandName} ${w.collectionName} ${w.name}`.replace(/\s+/g, ' ').trim(),
    w.price > 0 ? `$${w.price.toLocaleString('en-AU')}` : 'price on request',
    w.caseMaterial, w.diameterMm ? `${w.diameterMm} mm` : null,
    w.waterResistanceM ? `${w.waterResistanceM} m WR` : null, w.movementFamily,
    w.dialColour ? `${w.dialColour} dial` : null, w.strapMaterial ? `on ${w.strapMaterial}` : null,
    w.functions.slice(0, 4).join(', ') || null].filter(Boolean).join(' | ');
}

async function armIds(path, query) {
  const res = await fetch(`${BASE_URL}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }), signal: AbortSignal.timeout(120_000) });
  return res.ok ? ((await res.json()).watches ?? []).map(w => w.id) : [];
}

async function judge(query, candidates, key) {
  // Deliberately rubric-free: the judge sees the customer's words and the watches, nothing else.
  const prompt = `A customer asks a luxury watch concierge: "${query}"

Grade each watch 0-3 for how well it answers that request:
  3: exactly what a knowledgeable salesperson would bring out first
  2: fits, with a trade-off
  1: defensible but not what they asked for
  0: does not answer the request

Watches:
${candidates.map((c, i) => `${i + 1}. ${c.text}`).join('\n')}

Reply with one JSON array in the order given: [{"n": 1, "grade": 2}]
No prose outside the JSON.`;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: 700, messages: [{ role: 'user', content: prompt }] }),
    signal: AbortSignal.timeout(120_000),
  });
  const body = await res.json();
  const text = (body.content ?? []).map(p => p.text ?? '').join('');
  return { rows: JSON.parse(/\[[\s\S]*\]/.exec(text)[0]), usage: body.usage ?? {} };
}

const key = apiKey();
const catalogue = await loadCatalogue(BASE_URL);
const validated = validateQueries(catalogue, V2);
const rand = mulberry32(SEED);
const briefs = validated.filter(q => scopeOf(q) === 'semantic' && q.status === 'ok')
  .sort(() => rand() - 0.5).slice(0, SAMPLE);

let inTok = 0, outTok = 0;
const rows = [];
for (const brief of briefs) {
  const v1 = V1.get(brief.id);
  if (!v1?.truth) continue;
  const v1Relevant = relevantIds(catalogue, v1.truth);

  const [bm25, hybrid] = await Promise.all([
    armIds('/api/watch/find?mode=bm25', brief.query),
    armIds('/api/watch/find?mode=hybrid', brief.query),
  ]);
  const random = [...catalogue.records].sort(() => rand() - 0.5).slice(0, 3).map(w => w.id);
  const ids = [...new Set([...bm25.slice(0, 8), ...hybrid.slice(0, 8), ...random])]
    .sort(() => rand() - 0.5).slice(0, PER_BRIEF);
  const candidates = ids.map(id => catalogue.byId.get(id)).filter(Boolean).map(w => ({
    id: w.id, text: describe(w),
    // v1 was binary: in the relevant set or not. Mapped onto the same 0-3 scale as 3 or 0, which is
    // exactly what binary relevance asserts — an answer is either ideal or worthless.
    v1: v1Relevant.has(w.id) ? 3 : 0,
    v2: gradeFor(w, brief),
  }));
  if (!candidates.length) continue;

  const { rows: verdicts, usage } = await judge(brief.query, candidates, key);
  inTok += usage.input_tokens ?? 0; outTok += usage.output_tokens ?? 0;
  for (const [i, c] of candidates.entries()) {
    const v = verdicts.find(x => Number(x.n) === i + 1);
    if (v) rows.push({ id: brief.id, ...c, judge: Number(v.grade) });
  }
  process.stdout.write(`\r  ${rows.length} judged`);
}

const stats = which => {
  const exact = rows.filter(r => r[which] === r.judge).length;
  const within = rows.filter(r => Math.abs(r[which] - r.judge) <= 1).length;
  const err = rows.reduce((sum, r) => sum + Math.abs(r[which] - r.judge), 0) / rows.length;
  const harsh = rows.filter(r => r[which] === 0 && r.judge >= 2).length;
  return { exact: exact / rows.length, within: within / rows.length, err, harsh };
};

const a = stats('v1'), b = stats('v2');
console.log(`\r${' '.repeat(24)}\r`);
console.log(`judged ${rows.length} watch/brief pairs against a rubric-free judge\n`);
console.log(`                         v1 (binary)   v2 (graded)`);
console.log(`  exact agreement        ${(a.exact * 100).toFixed(0).padStart(9)}%   ${(b.exact * 100).toFixed(0).padStart(9)}%`);
console.log(`  within one grade       ${(a.within * 100).toFixed(0).padStart(9)}%   ${(b.within * 100).toFixed(0).padStart(9)}%`);
console.log(`  mean absolute error    ${a.err.toFixed(2).padStart(10)}   ${b.err.toFixed(2).padStart(10)}`);
console.log(`  scored 0 where the judge said 2 or 3   ${String(a.harsh).padStart(3)}   ${String(b.harsh).padStart(10)}`);
console.log(`\ncost $${((inTok * 1 + outTok * 5) / 1_000_000).toFixed(3)}`);
