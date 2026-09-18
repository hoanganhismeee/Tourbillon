// Prints the figures a results table needs for one arm against a baseline arm, paired by query:
// each metric's mean for both, and whether the difference clears the 95% bootstrap interval. The
// two arms may come from different saved runs, since a deterministic baseline does not change.
//
//   node eval/table-numbers.mjs --a=<run.json> --arm-a=bm25 --b=<run.json> --arm-b=concierge
import { readFileSync } from 'node:fs';
import { mean, pairedBootstrap, percentile, significance } from './metrics.mjs';

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));

const load = (path, arm) => {
  const run = JSON.parse(readFileSync(path, 'utf8'));
  const byId = new Map();
  for (const r of run.rows?.[arm] ?? []) if (!byId.has(r.queryId) && !r.error) byId.set(r.queryId, r);
  return { run, byId };
};

const A = load(args.a, args['arm-a'] ?? 'bm25');
const B = load(args.b, args['arm-b'] ?? 'concierge');
const ids = [...B.byId.keys()].filter(id => A.byId.has(id));

// Recall is read against its ceiling: a list of ten cannot hold more than ten of 76 answers.
const shareOfCeiling = r => (r.ceiling ? r.recall / r.ceiling : 0);
const metrics = {
  mrr: r => r.mrr,
  precision5: r => r.precision,
  ndcg10: r => r.ndcg,
  recallShare: shareOfCeiling,
  hit10: r => r.hit,
};

console.log(`${ids.length} paired queries  A=${args['arm-a'] ?? 'bm25'}  B=${args['arm-b'] ?? 'concierge'}`);
for (const [name, get] of Object.entries(metrics)) {
  const a = ids.map(id => get(A.byId.get(id)));
  const b = ids.map(id => get(B.byId.get(id)));
  const stat = pairedBootstrap(a, b);
  console.log(`${name.padEnd(12)} A ${mean(a).toFixed(3)}  B ${mean(b).toFixed(3)}  ${significance(stat?.ci)}`);
}
const latency = ids.map(id => B.byId.get(id).latencyMs);
console.log(`latency B    p50 ${Math.round(percentile(latency, 50))} ms  p95 ${Math.round(percentile(latency, 95))} ms`);
const actions = B.run.summary?.[args['arm-b'] ?? 'concierge']?.actions;
if (actions) console.log(`replies with a relevant action ${actions.repliesWithRelevantAction}/${actions.replies}`);
