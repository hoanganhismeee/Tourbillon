// Compares one arm across two saved runs, paired by query: the same benchmark on a different
// model, or before and after a change. Nothing here calls the API.
//
//   node eval/compare-runs.mjs --a=eval/results/<haiku>.json --b=eval/results/<qwen>.json --arm=concierge
//   node eval/compare-runs.mjs --a=<run>.json --arm-a=bm25 --b=<other run>.json --arm-b=concierge
//
// Prints the paired deltas with their bootstrap interval, the latency of each run, and the same
// deltas split by query category so a change that helps one kind of query and hurts another
// does not average out to "no difference".
import { readFileSync } from 'node:fs';
import { mean, pairedBootstrap, percentile, significance } from './metrics.mjs';
import { summariseStages } from './timing.mjs';

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));
if (!args.a || !args.b) {
  console.error('usage: node eval/compare-runs.mjs --a=<run.json> --b=<run.json> [--arm=concierge]');
  process.exit(1);
}
// One arm name for both runs, or a different arm on each side: a deterministic baseline from one run
// against the concierge from another is still paired by query.
const armA = args['arm-a'] ?? args.arm ?? 'concierge';
const armB = args['arm-b'] ?? args.arm ?? 'concierge';
const METRICS = ['recall', 'precision', 'mrr', 'ndcg', 'hit'];

const load = (path, arm) => {
  const run = JSON.parse(readFileSync(path, 'utf8'));
  const rows = run.rows?.[arm];
  if (!rows) {
    console.error(`${path} has no "${arm}" arm; arms: ${Object.keys(run.rows ?? {}).join(', ')}`);
    process.exit(1);
  }
  // A run can hold several passes per query; the first pass is the one every report uses.
  const byId = new Map();
  for (const r of rows) if (!byId.has(r.queryId) && !r.error) byId.set(r.queryId, r);
  return { run, byId };
};

const A = load(args.a, armA);
const B = load(args.b, armB);
if (A.run.scope !== B.run.scope) console.warn(`scope differs: ${A.run.scope} vs ${B.run.scope}`);
const ids = [...A.byId.keys()].filter(id => B.byId.has(id));

const fmt = n => (n === null || n === undefined ? '   -  ' : n.toFixed(3).padStart(6));
const signed = n => (n >= 0 ? '+' : '') + n.toFixed(3);

function report(label, subset) {
  const rowsA = subset.map(id => A.byId.get(id));
  const rowsB = subset.map(id => B.byId.get(id));
  console.log(`\n${label}  (${subset.length} paired queries)`);
  console.log('metric      A       B      delta   95% CI              verdict');
  for (const metric of METRICS) {
    const stat = pairedBootstrap(rowsA.map(r => r[metric]), rowsB.map(r => r[metric]));
    const a = mean(rowsA.map(r => r[metric]));
    const b = mean(rowsB.map(r => r[metric]));
    if (!stat) {
      console.log(`${metric.padEnd(10)}${fmt(a)}  ${fmt(b)}`);
      continue;
    }
    const ci = `[${signed(stat.ci.lo)}, ${signed(stat.ci.hi)}]`;
    console.log(`${metric.padEnd(10)}${fmt(a)}  ${fmt(b)}  ${signed(stat.delta).padStart(7)}   ${ci.padEnd(20)}${significance(stat.ci)}`);
  }
  const lat = rows => ({ p50: percentile(rows.map(r => r.latencyMs), 50), p95: percentile(rows.map(r => r.latencyMs), 95) });
  const [la, lb] = [lat(rowsA), lat(rowsB)];
  console.log(`latency    p50 ${Math.round(la.p50)}ms -> ${Math.round(lb.p50)}ms   p95 ${Math.round(la.p95)}ms -> ${Math.round(lb.p95)}ms`);
}

console.log(`A = ${args.a} [${armA}]\nB = ${args.b} [${armB}]\nscope = ${A.run.scope}, k = ${A.run.k}`);
report('All queries', ids);

// Per-category split: the category comes from the labelled query set and is stored on each row.
const categories = [...new Set(ids.map(id => A.byId.get(id).category))].sort();
console.log('\nBy category  (nDCG@k, A -> B; fewer than 5 queries is anecdote, not evidence)');
for (const category of categories) {
  const subset = ids.filter(id => A.byId.get(id).category === category);
  const a = mean(subset.map(id => A.byId.get(id).ndcg));
  const b = mean(subset.map(id => B.byId.get(id).ndcg));
  const stat = pairedBootstrap(subset.map(id => A.byId.get(id).ndcg), subset.map(id => B.byId.get(id).ndcg));
  const verdict = stat && subset.length >= 5 ? significance(stat.ci) : '';
  console.log(`${category.padEnd(18)}${String(subset.length).padStart(3)}   ${fmt(a)} -> ${fmt(b)}   ${signed(b - a)}   ${verdict}`);
}

// Stage timing, when both runs carry the Server-Timing breakdown: where the time moved.
const stagesA = summariseStages(ids.map(id => A.byId.get(id)));
const stagesB = summariseStages(ids.map(id => B.byId.get(id)));
if (stagesA.requests && stagesB.requests) {
  console.log('\nStage timing, p50 ms  (on = replies that used the stage)');
  const names = [...new Set([...stagesA.stages, ...stagesB.stages].map(s => s.name))];
  for (const name of names) {
    const a = stagesA.stages.find(s => s.name === name);
    const b = stagesB.stages.find(s => s.name === name);
    const cell = s => (s ? `${String(Math.round(s.p50)).padStart(6)} on ${String(s.ran).padStart(2)}` : '     -      ');
    console.log(`${name.padEnd(12)}${cell(a)}  ->  ${cell(b)}`);
  }
}
