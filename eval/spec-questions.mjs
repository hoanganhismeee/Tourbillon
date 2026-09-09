// Spec-answer accuracy check for the concierge.
//
// The retrieval arms score which watch cards come back. This scores something they cannot see:
// whether the prose answers a factual question correctly. It exists to guard changes to what
// the model is shown - trimming the catalogue context can only be judged safe if answers about
// the trimmed fields hold up.
//
// Each answer lands in one of three buckets, and the distinction is the point:
//   correct - the right value appears
//   absent  - no value given ("I don't have that"), which is a safe failure
//   wrong   - a different value is asserted, which is a hallucination and the one to fear
// A change that turns correct into absent costs the user an answer. A change that turns
// correct into wrong costs them trust.
//
// Usage:
//   node eval/spec-questions.mjs                 # run and score
//   node eval/spec-questions.mjs --out=before    # label the saved run for a before/after diff
//   node eval/spec-questions.mjs --compare=before,after

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadCatalogue } from './catalogue.mjs';
import { mulberry32 } from './metrics.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const RESET = '\x1b[0m', BOLD = '\x1b[1m', DIM = '\x1b[2m';
const GREEN = '\x1b[32m', YELLOW = '\x1b[33m', RED = '\x1b[31m';

const args = Object.fromEntries(process.argv.slice(2)
  .map(a => a.match(/^--([^=]+)(?:=(.*))?$/)).filter(Boolean).map(m => [m[1], m[2] ?? true]));
const BASE_URL = args['base-url'] ?? process.env.BASE_URL ?? 'http://localhost:5248';
const PER_FIELD = Number(args['per-field'] ?? 4);
// Below this, no model call happened and the answer came from the response cache.
const CACHE_LATENCY_MS = Number(args['cache-latency-ms'] ?? 400);

// -- What to ask ---------------------------------------------------------------
// Questions name the watch by reference number: reference lookup scores 1.000 in the retrieval
// eval, so a miss here is the answer being wrong, not the watch being unfindable.

const FIELDS = [
  {
    key: 'powerReserveH', label: 'power reserve', unit: /hours?|hrs?|\bh\b/i,
    ask: ref => `What is the power reserve of the ${ref}?`,
    kind: 'number',
  },
  {
    key: 'waterResistanceM', label: 'water resistance', unit: /\bm\b|metre|meter|bar|atm/i,
    ask: ref => `How water resistant is the ${ref}?`,
    kind: 'number',
  },
  {
    key: 'diameterMm', label: 'case diameter', unit: /mm|millimet/i,
    ask: ref => `What is the case diameter of the ${ref}?`,
    kind: 'number',
  },
  {
    key: 'caseMaterial', label: 'case material',
    ask: ref => `What is the case of the ${ref} made of?`,
    kind: 'text',
  },
  {
    key: 'dialColour', label: 'dial colour',
    ask: ref => `What colour is the dial on the ${ref}?`,
    kind: 'text',
  },
  {
    key: 'movementFamily', label: 'movement type',
    ask: ref => `Is the ${ref} automatic or manual?`,
    kind: 'text',
  },
];

/// Picks watches that actually carry the field, so a miss is never the catalogue's fault.
function buildQuestions(catalogue, { seed = 20260909 } = {}) {
  const rand = mulberry32(seed);
  const questions = [];

  for (const field of FIELDS) {
    const usable = catalogue.records.filter(w => {
      const v = w[field.key];
      if (v == null || v === '' || v === '(unknown)') return false;
      // A reference has to be distinctive enough to name in a sentence.
      return /\d/.test(w.name) && w.name.length >= 4;
    });

    const shuffled = [...usable];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    for (const w of shuffled.slice(0, PER_FIELD)) {
      questions.push({
        id: `${field.key}-${w.id}`,
        field: field.label,
        kind: field.kind,
        unit: field.unit,
        watchId: w.id,
        reference: w.name,
        expected: w[field.key],
        query: field.ask(w.name),
      });
    }
  }
  return questions;
}

// -- Grading -------------------------------------------------------------------

const REFUSAL = /\b(don't have|do not have|not sure|no information|unable to|isn't listed|is not listed|not specified|couldn't find|could not find|no model with that reference)\b/i;

/// Only a figure carrying the unit counts as an assertion about the field. An earlier version
/// tested the unit against the whole answer, and "hours?|hr|h\b" matched the h in "watch",
/// which turned every refusal into a hallucination.
function gradeNumber(answer, expected, unit) {
  const text = answer.toLowerCase();
  const stated = [];

  // Ranges are one assertion, not two: the catalogue stores "min. 38 - max. 48 hours" and an
  // answer of "38-48 hours" is correct on both ends. Capturing only the figure adjacent to the
  // unit would score the true answer as a hallucination.
  for (const m of text.matchAll(/((?:\d+(?:[.,]\d+)?)(?:\s*[-–—/]\s*\d+(?:[.,]\d+)?)*)\s*([a-z]+)/g)) {
    if (!unit.test(m[2])) continue;
    for (const n of m[1].split(/[-–—/]/)) {
      const v = Number(n.trim().replace(',', '.'));
      if (!Number.isNaN(v)) stated.push(v);
    }
  }

  if (stated.some(n => Math.abs(n - Number(expected)) < 0.51)) return 'correct';
  if (stated.length > 0) return 'wrong';
  return 'absent';
}

// Competing values per field. Naming a different one of these is an assertion, and only then
// is an answer wrong; saying nothing about the field is a non-answer, which is a different
// failure and must not be counted as a hallucination.
const VOCABULARY = {
  'case material': ['steel', 'titanium', 'platinum', 'ceramic', 'carbon', 'tantalum',
                    'rose gold', 'pink gold', 'white gold', 'yellow gold', 'gold'],
  'dial colour': ['black', 'blue', 'silver', 'white', 'green', 'grey', 'gray', 'brown',
                  'salmon', 'champagne', 'slate', 'anthracite', 'openworked', 'skeleton',
                  'transparent', 'sapphire', 'mother-of-pearl'],
  'movement type': ['automatic', 'self-winding', 'selfwinding', 'manual', 'hand-wound',
                    'hand wound', 'quartz', 'spring drive'],
};

// Words that mean the same thing to a buyer. The catalogue and the model rarely spell a
// material or a winding type the same way.
const SYNONYMS = {
  'rose gold': ['rose gold', 'pink gold', '5n'],
  'pink gold': ['rose gold', 'pink gold', '5n'],
  automatic: ['automatic', 'self-winding', 'selfwinding', 'automatique', 'spring drive'],
  manual: ['manual', 'hand-wound', 'hand wound', 'manually wound', 'hand-winding'],
  transparent: ['transparent', 'sapphire', 'openworked', 'skeleton'],
};

/// Text fields are graded on the distinctive word, not the whole string: the catalogue says
/// "18K rose gold" where an answer reasonably says "rose gold".
function gradeText(answer, expected, field) {
  const text = answer.toLowerCase();
  const value = String(expected).toLowerCase();

  const accepted = new Set();
  for (const [canonical, words] of Object.entries(SYNONYMS)) {
    if (value.includes(canonical)) words.forEach(w => accepted.add(w));
  }
  // Fall back to the distinctive words of the stored value itself.
  for (const t of value.replace(/[^a-z\s-]/g, ' ').split(/\s+/)) {
    if (t.length >= 4 && !['with', 'case', 'dial'].includes(t)) accepted.add(t);
  }
  if (accepted.size === 0) accepted.add(value);

  if ([...accepted].some(t => text.includes(t))) return 'correct';
  if (REFUSAL.test(text)) return 'absent';

  // Only a competing value from the same field makes this an assertion. Anything else — a
  // generic product blurb, a change of subject — is a non-answer.
  const competing = (VOCABULARY[field] ?? []).filter(v => !accepted.has(v));
  return competing.some(v => text.includes(v)) ? 'wrong' : 'absent';
}

/// An answer that never mentions the reference is describing some other watch. That is a
/// retrieval miss, not a false claim about this watch's specs, and scoring the two the same
/// way would blame the prose for something the search did.
function isOffTarget(answer, reference) {
  const text = answer.toLowerCase();
  if (text.includes(reference.toLowerCase())) return false;
  // Also accept a distinctive fragment, so "5711/1A-010" still counts when the answer
  // writes "5711/1A" or just "5711".
  const parts = reference.toLowerCase().match(/[a-z0-9]{4,}/g) ?? [];
  return !parts.some(part => text.includes(part));
}

// -- Run -----------------------------------------------------------------------

async function ask(query) {
  const sessionId = `spec-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  try {
    const res = await fetch(`${BASE_URL}/api/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, message: query }),
      signal: AbortSignal.timeout(180_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    return { text: body.message ?? body.reply ?? body.text ?? '', cards: (body.watchCards ?? []).length };
  } finally {
    await fetch(`${BASE_URL}/api/chat/session/${sessionId}`, {
      method: 'DELETE', signal: AbortSignal.timeout(10_000),
    }).catch(() => {});
  }
}

async function main() {
  const catalogue = await loadCatalogue(BASE_URL);
  const questions = buildQuestions(catalogue);
  console.log(`${BOLD}Concierge spec-answer accuracy${RESET} ${DIM}${questions.length} questions, ${BASE_URL}${RESET}\n`);

  const rows = [];
  for (const [i, q] of questions.entries()) {
    const t0 = Date.now();
    let answer = '', verdict = 'error', cards = 0;
    try {
      const res = await ask(q.query);
      answer = res.text;
      cards = res.cards;
      if (REFUSAL.test(answer)) verdict = 'absent';
      else if (isOffTarget(answer, q.reference)) verdict = 'off-target';
      else verdict = q.kind === 'number'
        ? gradeNumber(answer, q.expected, q.unit)
        : gradeText(answer, q.expected, q.field);
    } catch (err) {
      answer = err.message;
    }
    const ms = Date.now() - t0;
    // The concierge caches whole first-turn answers in Redis under chat:resp:*, and every
    // question here is a first turn. A reply that arrives faster than any model call could
    // is a replay of an earlier run, which makes a before/after comparison meaningless.
    const cached = ms < CACHE_LATENCY_MS;
    rows.push({ ...q, unit: undefined, answer, verdict, cards, ms, cached });

    const mark = { correct: `${GREEN}correct${RESET}`, absent: `${YELLOW} absent${RESET}`,
                   'off-target': `${YELLOW}off-tgt${RESET}`,
                   wrong: `${RED}  WRONG${RESET}`, error: `${RED}  error${RESET}` }[verdict];
    console.log(`${String(i + 1).padStart(3)}/${questions.length} ${mark}  ${q.field.padEnd(16)} ` +
      `${DIM}expected ${String(q.expected).slice(0, 18).padEnd(18)} ${String(ms).padStart(6)}ms${RESET}`);
  }

  summarise(rows);
  const label = typeof args.out === 'string' ? args.out : new Date().toISOString().replace(/[:.]/g, '-');
  const dir = join(HERE, 'results');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `spec-${label}.json`);
  writeFileSync(file, JSON.stringify({ runAt: new Date().toISOString(), baseUrl: BASE_URL, rows }, null, 2));
  console.log(`\n${DIM}wrote ${file}${RESET}`);
}

function summarise(rows) {
  const tally = v => rows.filter(r => r.verdict === v).length;
  const n = rows.length;
  console.log(`\n${BOLD}Overall${RESET}  ${GREEN}correct ${tally('correct')}${RESET}` +
    `   ${YELLOW}absent ${tally('absent')}${RESET}   ${RED}wrong ${tally('wrong')}${RESET}` +
    `   accuracy ${(tally('correct') / n).toFixed(3)}   hallucination rate ${(tally('wrong') / n).toFixed(3)}`);

  console.log(`\n${BOLD}By field${RESET}`);
  const fields = [...new Set(rows.map(r => r.field))];
  console.log(`  ${'field'.padEnd(18)}${'n'.padStart(3)}${'correct'.padStart(9)}${'absent'.padStart(8)}${'off-tgt'.padStart(9)}${'wrong'.padStart(7)}`);
  for (const f of fields) {
    const g = rows.filter(r => r.field === f);
    console.log(`  ${f.padEnd(18)}${String(g.length).padStart(3)}` +
      String(g.filter(r => r.verdict === 'correct').length).padStart(9) +
      String(g.filter(r => r.verdict === 'absent').length).padStart(8) +
      String(g.filter(r => r.verdict === 'off-target').length).padStart(9) +
      String(g.filter(r => r.verdict === 'wrong').length).padStart(7));
  }

  const cached = rows.filter(r => r.cached);
  if (cached.length) {
    console.log(`
  ${YELLOW}${cached.length}/${rows.length} answers came from the chat response cache${RESET}`);
    console.log(`  ${DIM}They replay an earlier run. Clear it before a before/after comparison:`);
    console.log(`  docker compose exec -T redis redis-cli --scan --pattern 'chat:resp:*' | xargs -r docker compose exec -T redis redis-cli del${RESET}`);
  }

  const wrong = rows.filter(r => r.verdict === 'wrong');
  if (wrong.length) {
    console.log(`\n${RED}Hallucinations${RESET}`);
    for (const r of wrong.slice(0, 8)) {
      console.log(`  ${DIM}${r.field} of ${r.reference} — expected ${r.expected}`);
      console.log(`    "${r.answer.replace(/\s+/g, ' ').slice(0, 110)}"${RESET}`);
    }
  }
}

// -- Before/after comparison ---------------------------------------------------

function compare(labels) {
  const [a, b] = labels.split(',').map(s => s.trim());
  const load = l => {
    const p = join(HERE, 'results', `spec-${l}.json`);
    if (!existsSync(p)) { console.error(`${RED}missing ${p}${RESET}`); process.exit(1); }
    return JSON.parse(readFileSync(p, 'utf8')).rows;
  };
  const [ra, rb] = [load(a), load(b)];
  const byId = rows => new Map(rows.map(r => [r.id, r]));
  const [ma, mb] = [byId(ra), byId(rb)];

  const rate = (rows, v) => rows.filter(r => r.verdict === v).length / rows.length;
  console.log(`${BOLD}${a} -> ${b}${RESET}  ${ra.length} questions\n`);
  for (const v of ['correct', 'absent', 'off-target', 'wrong']) {
    const [x, y] = [rate(ra, v), rate(rb, v)];
    console.log(`  ${v.padEnd(9)}${x.toFixed(3)} -> ${y.toFixed(3)}   ${(y - x >= 0 ? '+' : '') + (y - x).toFixed(3)}`);
  }

  // Per-question movement is what a summary rate hides: equal totals can still mean answers
  // swapped between correct and wrong.
  const moved = [...ma.keys()].filter(id => mb.has(id) && ma.get(id).verdict !== mb.get(id).verdict);
  if (moved.length) {
    console.log(`\n${BOLD}Changed verdicts${RESET} ${DIM}${moved.length}${RESET}`);
    for (const id of moved.slice(0, 14)) {
      const [x, y] = [ma.get(id).verdict, mb.get(id).verdict];
      const bad = y === 'wrong' || (x === 'correct' && y === 'absent');
      console.log(`  ${bad ? RED : GREEN}${x} -> ${y}${RESET}  ${DIM}${ma.get(id).field} of ${ma.get(id).reference}${RESET}`);
    }
  }
}

if (typeof args.compare === 'string') compare(args.compare);
else main().catch(err => { console.error(`${RED}${err.stack ?? err.message}${RESET}`); process.exit(1); });
