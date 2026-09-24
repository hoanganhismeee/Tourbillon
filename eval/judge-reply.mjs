// Grades the concierge's prose, which every other metric in this harness ignores.
//
// run-eval scores the cards. A reply can carry the right ten watches and still fail the customer:
// answer a different question, claim a spec the catalogue does not support, or end on a question
// that leads nowhere. This reads the stored replies from a finished run and grades each one.
//
// The judge is a stronger model than the one that wrote the reply — Haiku grading its own prose is
// not an independent opinion. It is still a model grading a model, so the number to report is the
// distribution with the low grades quoted, never a single headline figure.
//
// Usage:
//   node eval/judge-reply.mjs --from=eval/results/eval-<stamp>.json
//   node eval/judge-reply.mjs --from=<run>.json --arm=concierge --limit=10
//   node eval/judge-reply.mjs --from=<run>.json --out=eval/results/reply-grades.json
import { readFileSync, writeFileSync } from 'node:fs';
import { loadCatalogue } from './catalogue.mjs';

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v = 'true'] = a.replace(/^--/, '').split('=');
  return [k, v];
}));
const BASE_URL = args['base-url'] ?? process.env.BASE_URL ?? 'http://localhost:5248';
const FROM = args.from;
const ARM = args.arm ?? 'concierge';
const MODEL = args.model ?? 'claude-sonnet-5';
const LIMIT = args.limit ? Number(args.limit) : Infinity;
const CARDS_SHOWN = Number(args.cards ?? 10);

// Sonnet list price, US dollars per million tokens.
const PRICE_IN = 3, PRICE_OUT = 15;

const DIM = '\x1b[2m', BOLD = '\x1b[1m', RESET = '\x1b[0m', YELLOW = '\x1b[33m', GREEN = '\x1b[32m', RED = '\x1b[31m';

/// The key lives in .env and nowhere else. It is read even when commented out, because local .env
/// keeps it commented while the stack runs on the local model.
function apiKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
  const match = /^#?\s*LLM_API_KEY=(.+)$/m.exec(env);
  if (!match) throw new Error('No LLM_API_KEY in .env and no ANTHROPIC_API_KEY in the environment');
  return match[1].trim();
}

/// What the judge is shown about one card: the facts a customer can check the reply against.
function describe(watch) {
  return [
    `${watch.brandName} ${watch.collectionName} ${watch.name}`.replace(/\s+/g, ' ').trim(),
    watch.price > 0 ? `$${watch.price.toLocaleString('en-AU')}` : 'price on request',
    watch.caseMaterial || null,
    watch.diameterMm ? `${watch.diameterMm} mm` : null,
    watch.waterResistanceM ? `${watch.waterResistanceM} m WR` : null,
    watch.movementFamily || null,
    watch.dialColour ? `${watch.dialColour} dial` : null,
    watch.functions.length ? watch.functions.slice(0, 4).join(', ') : null,
  ].filter(Boolean).join(' | ');
}

function prompt(row, cards) {
  const shown = cards.length
    ? cards.map((c, i) => `${i + 1}. ${c}`).join('\n')
    : '(no watches were shown with this reply)';
  return `A customer wrote to a luxury watch concierge: "${row.query}"

The concierge replied:
"""
${row.reply}
"""

These are the watches shown beside that reply:
${shown}

Grade the reply 0-3:
  3: answers what was actually asked, every specific claim is supported by the watches shown, and it ends somewhere useful
  2: answers the request, nothing in it is wrong, but it is generic or the closing line adds little
  1: partly answers, or leans on the customer to restate what they already said
  0: answers a different question, or states something the watches shown do not support

Also report whether every factual claim in the reply (price, size, material, complication, brand)
is supported by the list above.

Reply with one JSON object and no prose:
{"grade": 2, "supported": true, "why": "at most fifteen words", "unsupported": "the claim, or empty"}`;
}

async function judge(text, key) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 1000, messages: [{ role: 'user', content: text }] }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = await res.json();
  const out = (body.content ?? []).map(part => part.text ?? '').join('');
  const match = /\{[\s\S]*\}/.exec(out);
  // A verdict cut off at the ceiling still carries its grade, and the grade is what is reported.
  if (!match) {
    const grade = /"grade"\s*:\s*([0-3])/.exec(out);
    if (!grade) throw new Error(`No JSON in the judge's reply: ${out.slice(0, 120)}`);
    return { verdict: { grade: Number(grade[1]), supported: !/"supported"\s*:\s*false/.test(out), why: 'verdict truncated' },
             usage: body.usage ?? {} };
  }
  return { verdict: JSON.parse(match[0]), usage: body.usage ?? {} };
}

async function main() {
  if (!FROM) throw new Error('--from=eval/results/<run>.json is required');
  const run = JSON.parse(readFileSync(FROM, 'utf8'));
  const rows = (run.rows?.[ARM] ?? []).filter(r => r.reply && !r.error).slice(0, LIMIT);
  if (rows.length === 0) throw new Error(`No stored replies on arm "${ARM}" in ${FROM}. Re-run the arm after the harness started storing them.`);

  const key = apiKey();
  const catalogue = await loadCatalogue(BASE_URL);

  console.log(`${BOLD}Reply grades${RESET} ${DIM}${rows.length} replies from ${FROM}, judged by ${MODEL}${RESET}\n`);

  const graded = [];
  let inputTokens = 0, outputTokens = 0;
  for (const row of rows) {
    const cards = (row.rankedIds ?? []).slice(0, CARDS_SHOWN)
      .map(id => catalogue.byId.get(id)).filter(Boolean).map(describe);
    const { verdict, usage } = await judge(prompt(row, cards), key);
    inputTokens += usage.input_tokens ?? 0;
    outputTokens += usage.output_tokens ?? 0;
    graded.push({
      id: row.queryId, query: row.query, reply: row.reply,
      grade: Number(verdict.grade), supported: verdict.supported !== false,
      why: verdict.why ?? '', unsupported: verdict.unsupported ?? '',
    });
    process.stdout.write(`\r${DIM}  ${graded.length}/${rows.length} judged${RESET}`);
  }
  console.log(`\r${' '.repeat(34)}\r`);

  const counts = [0, 1, 2, 3].map(g => graded.filter(r => r.grade === g).length);
  const mean = graded.reduce((sum, r) => sum + r.grade, 0) / graded.length;
  const unsupported = graded.filter(r => !r.supported);

  console.log(`  replies         ${graded.length}`);
  console.log(`  mean grade      ${GREEN}${mean.toFixed(2)}${RESET} ${DIM}of 3${RESET}`);
  for (const g of [3, 2, 1, 0])
    console.log(`  grade ${g}         ${String(counts[g]).padStart(3)}  ${DIM}${((counts[g] / graded.length) * 100).toFixed(0)}%${RESET}`);
  console.log(`  unsupported     ${unsupported.length ? RED : ''}${unsupported.length}${RESET} ${DIM}replies claiming something the cards do not show${RESET}`);
  console.log(`  cost            $${((inputTokens * PRICE_IN + outputTokens * PRICE_OUT) / 1_000_000).toFixed(3)} ${DIM}(${inputTokens} in, ${outputTokens} out)${RESET}`);

  const weak = graded.filter(r => r.grade <= 1).sort((a, b) => a.grade - b.grade);
  if (weak.length) {
    console.log(`\n${BOLD}Graded 0 or 1${RESET} ${DIM}the judge's reason, then the reply${RESET}`);
    for (const row of weak) {
      console.log(`  ${YELLOW}${row.id}${RESET} ${DIM}"${row.query.slice(0, 52)}"${RESET}`);
      console.log(`      ${DIM}grade ${row.grade}: ${row.why}${row.unsupported ? ` | unsupported: ${row.unsupported}` : ''}${RESET}`);
      console.log(`      ${row.reply.replace(/\s+/g, ' ').slice(0, 150)}`);
    }
  }

  if (args.out) {
    writeFileSync(args.out, JSON.stringify({ model: MODEL, from: FROM, arm: ARM, mean, counts, rows: graded }, null, 2));
    console.log(`\n${DIM}wrote ${args.out}${RESET}`);
  }
}

main().catch(err => { console.error(err.message); process.exit(1); });
