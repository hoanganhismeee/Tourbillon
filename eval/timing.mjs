// Per-stage latency read from the concierge's Server-Timing header. Total latency says a reply was
// slow; this says which model call, embedding or query made it slow, so the next cut is chosen from
// measurements rather than guessed from the code.
import { percentile } from './metrics.mjs';

// Pipeline order, so the table reads top to bottom the way a request flows. Unknown stages follow.
export const STAGE_ORDER = [
  'rules', 'sql', 'classify', 'route', 'embed', 'cache',
  'parse', 'parse_wait', 'vector', 'bm25', 'rerank', 'chat', 'planner', 'total',
];

/// "classify;dur=812.4;desc="2 calls", total;dur=5120.0" -> { classify: { ms: 812.4, calls: 2 }, total: {...} }
export function parseServerTiming(header) {
  const stages = {};
  if (!header) return stages;
  for (const entry of header.split(',')) {
    const [name, ...params] = entry.trim().split(';').map(p => p.trim());
    if (!name) continue;
    let ms = null;
    let calls = 1;
    for (const param of params) {
      const [key, raw = ''] = param.split('=');
      const value = raw.replace(/^"|"$/g, '');
      if (key === 'dur') ms = Number(value);
      if (key === 'desc') {
        const match = value.match(/^(\d+) calls$/);
        if (match) calls = Number(match[1]);
      }
    }
    if (ms !== null && Number.isFinite(ms)) stages[name] = { ms, calls };
  }
  return stages;
}

/// Per stage: how many requests ran it, calls per request that ran it, and p50/p95 of its time.
/// Stages that run in parallel (chat and planner) overlap, so the rows do not sum to the total.
export function summariseStages(rows) {
  const withStages = rows.filter(r => r.stages && Object.keys(r.stages).length);
  const names = new Set(withStages.flatMap(r => Object.keys(r.stages)));
  const ordered = [
    ...STAGE_ORDER.filter(name => names.has(name)),
    ...[...names].filter(name => !STAGE_ORDER.includes(name)).sort(),
  ];
  return {
    requests: withStages.length,
    stages: ordered.map(name => {
      const ran = withStages.filter(r => r.stages[name]);
      const ms = ran.map(r => r.stages[name].ms);
      return {
        name,
        ran: ran.length,
        callsPerRequest: ran.reduce((a, r) => a + r.stages[name].calls, 0) / ran.length,
        p50: percentile(ms, 50),
        p95: percentile(ms, 95),
      };
    }),
  };
}
