// test-chat-context-resilience.mjs — Context retention, off-topic resilience, and unclear-intent handling.
//
// Four focused flows:
//   1. Long discovery session interrupted by off-topic questions at random turns — context must survive.
//   2. Ambiguous / unclear queries throughout — AI should ask clarifying questions or surface suggestions,
//      not hallucinate a watch list with no brief.
//   3. Unexpected topic switches mid-session (cuisine, code, travel) with immediate recovery messages —
//      AI must decline gracefully and pick up the watch thread on the very next on-topic turn.
//   4. Over-constrained luxury discovery should widen to nearby catalogue matches before refusing.
//
// Usage:
//   node test-chat-context-resilience.mjs
//   BASE_URL=http://localhost:5248 node test-chat-context-resilience.mjs
//
// Requires: backend running, ChatSettings:DisableLimitInDev=true in dev config.

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5248';

const RESET   = '\x1b[0m';
const BOLD    = '\x1b[1m';
const DIM     = '\x1b[2m';
const CYAN    = '\x1b[36m';
const YELLOW  = '\x1b[33m';
const GREEN   = '\x1b[32m';
const MAGENTA = '\x1b[35m';
const RED     = '\x1b[31m';
const BLUE    = '\x1b[34m';
const NO_CLOSE_MATCH_MESSAGE = "Nothing in the current Tourbillon catalogue lines up with that brief. Try one of the starters below, or rework the request with a specific brand, collection, reference, size, material, or budget and I'll find the closest matches.";

// ── HTTP helpers ─────────────────────────────────────────────────────────────

async function send(sessionId, message) {
  const res = await fetch(`${BASE_URL}/api/chat/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, message }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function clearSession(sessionId) {
  await fetch(`${BASE_URL}/api/chat/session/${sessionId}`, {
    method: 'DELETE',
    signal: AbortSignal.timeout(10_000),
  }).catch(() => {});
}

// ── Display helpers ──────────────────────────────────────────────────────────

function truncate(str, max = 180) {
  if (!str) return DIM + '(empty)' + RESET;
  const clean = str.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
  return clean.length > max ? clean.slice(0, max) + '…' : clean;
}

function fmtCards(cards) {
  if (!cards?.length) return DIM + 'none' + RESET;
  return cards.map(c => `${GREEN}${c.brandName ?? '?'}/${c.collectionName ?? '?'}${RESET}`).join(', ');
}

function fmtActions(actions) {
  if (!actions?.length) return DIM + 'none' + RESET;
  return actions.map(a => {
    const col = a.type === 'suggest' ? YELLOW
              : a.type === 'compare' ? MAGENTA
              : a.type === 'search'  ? CYAN
              : a.type === 'set_cursor' ? BLUE
              : RESET;
    const detail = (a.query || a.label || a.slugs?.join(',') || '').slice(0, 55);
    return `${col}[${a.type}]${RESET} ${detail}`;
  }).join('  ');
}

function pass(msg)  { return `  ${GREEN}✓${RESET} ${msg}`; }
function fail(msg)  { return `  ${RED}✗${RESET} ${msg}`; }
function warn(msg)  { return `  ${YELLOW}⚠${RESET} ${msg}`; }
function info(msg)  { return `  ${DIM}ℹ ${msg}${RESET}`; }

// ── Assertion helpers ────────────────────────────────────────────────────────

function assertNonEmpty(data) {
  const msg = data.message ?? '';
  return msg.trim().length >= 5
    ? pass('response is non-empty')
    : fail(`response is empty or too short (${msg.length} chars)`);
}

// Off-topic: AI should decline and stay on watch scope.
// Passes when the reply contains a watch-domain redirect and has no watch cards (no hallucinated shortlist).
function assertDeclined(data, query) {
  const msg = (data.message ?? '').toLowerCase();
  const cards = data.watchCards ?? [];

  const watchRedirect = /specialise|tourbillon|horology|watch|brand|collection|rephrase|help with/i.test(msg);
  const noCards = cards.length === 0;

  if (watchRedirect && noCards) return pass('correctly declined off-topic and redirected to watches');
  if (!watchRedirect)           return fail(`did not redirect to watch scope after off-topic: "${query.slice(0, 50)}"`);
  if (!noCards)                 return warn(`declined but still returned ${cards.length} card(s) — check routing`);
  return pass('declined');
}

// After an off-topic interruption, the next on-topic turn should produce watch cards or a useful response.
function assertContextSurvived(data, priorSlugs) {
  const cards = data.watchCards ?? [];
  const msg = (data.message ?? '').toLowerCase();
  const hasWatchContent = cards.length > 0 || /watch|brand|collection|nautilus|overseas|reverso|royal oak/i.test(msg);

  if (!hasWatchContent)
    return fail('context lost after off-topic interruption — no watch content in recovery turn');

  if (priorSlugs.length > 0) {
    const currentSlugs = new Set(cards.map(c => c.slug).filter(Boolean));
    const overlap = priorSlugs.filter(s => currentSlugs.has(s)).length;
    if (overlap > 0)
      return pass(`context retained — ${overlap}/${priorSlugs.length} prior card(s) still present`);
    if (cards.length > 0)
      return warn('session continues with new cards — prior slugs not repeated (may be a revision)');
  }

  return pass('watch context survived off-topic interruption');
}

// Unclear / ambiguous queries: AI should surface suggest chips or ask a clarifying question.
function assertClarificationOrSuggestions(data, query) {
  const actions = data.actions ?? [];
  const msg = (data.message ?? '').toLowerCase();
  const cards = data.watchCards ?? [];

  const hasSuggestChips = actions.some(a => a.type === 'suggest');
  const hasClarifyingQuestion = /\?/.test(data.message ?? '') && cards.length === 0;
  const hasNarrowingPrompt = /narrow|specify|tell me more|what kind|what style|what occasion|budget|brand|collection|price/i.test(msg);
  const hasGreeting = /tourbillon can help|try something like|compare|brand|brief/i.test(msg);

  if (hasSuggestChips)
    return pass(`surfaced ${actions.filter(a => a.type === 'suggest').length} suggest chip(s) for unclear query`);
  if (hasClarifyingQuestion || hasNarrowingPrompt)
    return pass('asked a clarifying question or invited the user to narrow the brief');
  if (hasGreeting)
    return pass('responded with a helpful onboarding prompt for ambiguous input');
  if (cards.length === 0)
    return warn(`no cards and no explicit clarification detected — check response: "${truncate(data.message, 80)}"`);

  return warn(`returned ${cards.length} card(s) without clarifying the vague brief — may be over-eager routing`);
}

// ── Flows ────────────────────────────────────────────────────────────────────

function assertWidenedDiscovery(data) {
  const cards = data.watchCards ?? [];
  const exactRefusal = (data.message ?? '').trim() === NO_CLOSE_MATCH_MESSAGE;

  if (exactRefusal)
    return fail('fell through to NoCloseMatchMessage instead of widening to nearby catalogue matches');
  if (cards.length === 0)
    return fail('returned no cards for the widened discovery path');

  return pass(`returned ${cards.length} closest-match card(s) before refusal`);
}

function assertNoCloseMatchFallback(data) {
  const exactRefusal = (data.message ?? '').trim() === NO_CLOSE_MATCH_MESSAGE;
  return exactRefusal
    ? pass('kept the hardcoded no-close-match fallback for a true catalogue miss')
    : fail(`expected NoCloseMatchMessage, got "${truncate(data.message, 100)}"`);
}

function assertWidenedShortlistFollowUp(data, priorSlugs) {
  const exactRefusal = (data.message ?? '').trim() === NO_CLOSE_MATCH_MESSAGE;
  if (exactRefusal)
    return fail('follow-up fell back to NoCloseMatchMessage instead of staying on the widened shortlist');

  return assertContextSurvived(data, priorSlugs);
}

const FLOWS = [
  {
    name: 'Context survival across off-topic interruptions (14 turns)',
    description: 'Starts a real watch session, fires 4 off-topic questions at different depths, then resumes watch context each time.',
    turns: [
      {
        msg: 'Show me some elegant dress watches under 30,000',
        note: 'initial discovery',
        assert: (d) => [assertNonEmpty(d), d.watchCards?.length > 0 ? pass(`${d.watchCards.length} card(s) returned`) : warn('no cards on initial discovery')],
      },
      {
        msg: 'Tell me more about the first one',
        note: 'follow-up 1 — context check',
        assert: (d) => [assertNonEmpty(d)],
      },
      {
        msg: 'What is the best pizza recipe?',
        note: 'OFF-TOPIC: food',
        isOffTopic: true,
        assert: (d) => [assertDeclined(d, 'pizza recipe')],
      },
      {
        msg: 'OK, back to the watches — what is the price of the one we were looking at?',
        note: 'recovery after off-topic 1',
        isRecovery: true,
        assert: (d, priorSlugs) => [assertNonEmpty(d), assertContextSurvived(d, priorSlugs)],
      },
      {
        msg: 'Compare the first two options',
        note: 'compare request',
        assert: (d) => [assertNonEmpty(d)],
      },
      {
        msg: 'Which one has better movement finishing?',
        note: 'follow-up 2 — deep compare',
        assert: (d) => [assertNonEmpty(d)],
      },
      {
        msg: 'Can you write me a Python script to reverse a string?',
        note: 'OFF-TOPIC: coding',
        isOffTopic: true,
        assert: (d) => [assertDeclined(d, 'Python script')],
      },
      {
        msg: 'Back to the watches — which of those two is better for travel?',
        note: 'recovery after off-topic 2',
        isRecovery: true,
        assert: (d, priorSlugs) => [assertNonEmpty(d), assertContextSurvived(d, priorSlugs)],
      },
      {
        msg: "I don't like Frederique Constant, show me other options",
        note: 'brand rejection mid-session',
        assert: (d) => {
          const fcPresent = (d.watchCards ?? []).some(c => (c.brandName ?? '').toLowerCase().includes('frederique'));
          return [
            assertNonEmpty(d),
            fcPresent ? fail('FC still present after rejection') : pass('FC correctly excluded after rejection'),
          ];
        },
      },
      {
        msg: 'What is the tallest building in the world?',
        note: 'OFF-TOPIC: trivia',
        isOffTopic: true,
        assert: (d) => [assertDeclined(d, 'tallest building')],
      },
      {
        msg: 'What are the best options you have for me now?',
        note: 'recovery after off-topic 3 — should respect FC rejection',
        isRecovery: true,
        assert: (d, priorSlugs) => {
          const fcPresent = (d.watchCards ?? []).some(c => (c.brandName ?? '').toLowerCase().includes('frederique'));
          return [
            assertNonEmpty(d),
            assertContextSurvived(d, priorSlugs),
            fcPresent ? fail('FC still present (rejection forgotten after off-topic)') : pass('FC rejection persists after off-topic interruption'),
          ];
        },
      },
      {
        msg: 'Tell me about the heritage of the top brand in this list',
        note: 'brand history pivot',
        assert: (d) => [assertNonEmpty(d)],
      },
      {
        msg: 'Book me a table at a restaurant in London',
        note: 'OFF-TOPIC: reservation',
        isOffTopic: true,
        assert: (d) => [assertDeclined(d, 'restaurant reservation')],
      },
      {
        msg: 'Sorry, last question — give me your top pick from everything we discussed',
        note: 'final recovery — full session summary',
        isRecovery: true,
        assert: (d, priorSlugs) => [assertNonEmpty(d), assertContextSurvived(d, priorSlugs)],
      },
    ],
  },

  {
    name: 'Unclear and ambiguous queries — clarification expected (10 turns)',
    description: 'Fires deliberately vague and context-free queries. The AI should ask for more information or surface suggestion chips rather than hallucinate a shortlist.',
    turns: [
      {
        msg: 'something nice',
        note: 'bare ambiguous request',
        assert: (d) => [assertClarificationOrSuggestions(d, 'something nice')],
      },
      {
        msg: 'the good one',
        note: 'vague pronoun with no prior context',
        assert: (d) => [assertClarificationOrSuggestions(d, 'the good one')],
      },
      {
        msg: 'I want a watch',
        note: 'minimal intent — no style, price, or brand',
        assert: (d) => [assertClarificationOrSuggestions(d, 'I want a watch')],
      },
      {
        msg: 'recommend one',
        note: 'one-word action with no brief',
        assert: (d) => [assertClarificationOrSuggestions(d, 'recommend one')],
      },
      {
        msg: 'yes',
        note: 'bare affirmative with no prior session context',
        assert: (d) => [assertClarificationOrSuggestions(d, 'yes')],
      },
      {
        msg: 'show me dress watches',
        note: 'valid brief — now the session has context',
        assert: (d) => [assertNonEmpty(d), d.watchCards?.length > 0 ? pass(`${d.watchCards.length} card(s) returned for specific brief`) : warn('no cards for specific brief')],
      },
      {
        msg: 'what about',
        note: 'incomplete sentence — trailing off',
        assert: (d) => [assertClarificationOrSuggestions(d, 'what about')],
      },
      {
        msg: 'hmm',
        note: 'filler — no intent',
        assert: (d) => [assertClarificationOrSuggestions(d, 'hmm')],
      },
      {
        msg: 'compare',
        note: 'bare compare verb — no targets',
        assert: (d) => [assertNonEmpty(d), assertClarificationOrSuggestions(d, 'compare')],
      },
      {
        msg: "it's nice but what else",
        note: 'vague follow-up — what else about what?',
        assert: (d) => [assertNonEmpty(d)],
      },
    ],
  },

  {
    name: 'Rapid topic switches — context thread must survive 12 turns',
    description: 'Alternates quickly between watch queries and unrelated topics. Verifies the AI never picks up off-topic threads and always returns to the watch context.',
    turns: [
      {
        msg: 'Tell me about Vacheron Constantin',
        note: 'brand intro',
        assert: (d) => [assertNonEmpty(d)],
      },
      {
        msg: 'What is the capital of France?',
        note: 'OFF-TOPIC: geography',
        isOffTopic: true,
        assert: (d) => [assertDeclined(d, 'capital of France')],
      },
      {
        msg: 'Their Overseas collection — what makes it special?',
        note: 'recovery — collection follow-up',
        isRecovery: true,
        assert: (d, priorSlugs) => [assertNonEmpty(d), assertContextSurvived(d, priorSlugs)],
      },
      {
        msg: 'Give me a recipe for chocolate cake',
        note: 'OFF-TOPIC: food',
        isOffTopic: true,
        assert: (d) => [assertDeclined(d, 'chocolate cake')],
      },
      {
        msg: 'Show me some Overseas models',
        note: 'recovery — collection discovery',
        isRecovery: true,
        assert: (d, priorSlugs) => [assertNonEmpty(d), assertContextSurvived(d, priorSlugs)],
      },
      {
        msg: 'Who won the Champions League in 2023?',
        note: 'OFF-TOPIC: sports',
        isOffTopic: true,
        assert: (d) => [assertDeclined(d, 'Champions League')],
      },
      {
        msg: 'Compare with the Patek Nautilus',
        note: 'recovery — compare with prior brand context',
        isRecovery: true,
        assert: (d, priorSlugs) => [assertNonEmpty(d), assertContextSurvived(d, priorSlugs)],
      },
      {
        msg: 'Translate "beautiful watch" into Japanese',
        note: 'OFF-TOPIC: translation',
        isOffTopic: true,
        assert: (d) => [assertDeclined(d, 'translate Japanese')],
      },
      {
        msg: 'Which of those two should I buy?',
        note: 'recovery — decision request from prior compare',
        isRecovery: true,
        assert: (d, priorSlugs) => [assertNonEmpty(d), assertContextSurvived(d, priorSlugs)],
      },
      {
        msg: 'Help me write a cover letter',
        note: 'OFF-TOPIC: career',
        isOffTopic: true,
        assert: (d) => [assertDeclined(d, 'cover letter')],
      },
      {
        msg: 'What is the price range of the watches we looked at?',
        note: 'recovery — session-level price question',
        isRecovery: true,
        assert: (d, priorSlugs) => [assertNonEmpty(d), assertContextSurvived(d, priorSlugs)],
      },
      {
        msg: 'Give me a final recommendation',
        note: 'wrap-up after all interruptions',
        assert: (d) => [assertNonEmpty(d), d.watchCards?.length > 0 || /(recommend|suggest|consider|nautilus|overseas)/i.test(d.message ?? '') ? pass('meaningful final recommendation') : warn('final recommendation seems thin')],
      },
    ],
  },
  {
    name: 'Graceful degrade before refusal (3 turns)',
    description: 'Verifies over-tight luxury discovery widens to nearby catalogue matches, while a genuine off-catalogue brief still hits the hardcoded refusal.',
    turns: [
      {
        msg: 'something affordable for a student',
        note: 'budget phrasing should widen instead of refusing',
        assert: (d) => [assertNonEmpty(d), assertWidenedDiscovery(d)],
      },
      {
        msg: 'which of these is the most accessible place to start?',
        note: 'follow-up stays grounded on the widened shortlist',
        assert: (d, priorSlugs) => [assertNonEmpty(d), assertWidenedShortlistFollowUp(d, priorSlugs)],
      },
      {
        msg: 'purple Casio digital from the 80s',
        note: 'true catalogue miss should still refuse',
        assert: (d) => [assertNonEmpty(d), assertNoCloseMatchFallback(d)],
      },
    ],
  },
];

// ── Runner ───────────────────────────────────────────────────────────────────

function printTurnHeader(t, turn) {
  const tag = turn.isOffTopic ? `${RED}[OFF-TOPIC]${RESET}` : turn.isRecovery ? `${CYAN}[RECOVERY]${RESET}` : `${DIM}[watch]${RESET}`;
  const preview = turn.msg.length > 65 ? turn.msg.slice(0, 65) + '…' : turn.msg;
  console.log(`\n  ${BOLD}T${t + 1}${RESET} ${tag} ${DIM}${turn.note}${RESET}`);
  console.log(`     ${BOLD}user:${RESET} "${preview}"`);
}

async function runFlow(flow, flowIdx) {
  const sessionId = `ctx-resilience-${flowIdx}-${Date.now()}`;
  const totals = { pass: 0, fail: 0, warn: 0 };

  console.log(`\n${BOLD}${'═'.repeat(72)}${RESET}`);
  console.log(`${BOLD}Flow ${flowIdx + 1}: ${flow.name}${RESET}`);
  console.log(`${DIM}${flow.description}${RESET}`);
  console.log(`${DIM}Session: ${sessionId}${RESET}`);

  let lastOnTopicSlugs = [];

  try {
    for (let t = 0; t < flow.turns.length; t++) {
      const turn = flow.turns[t];
      printTurnHeader(t, turn);

      let data;
      try {
        data = await send(sessionId, turn.msg);
      } catch (err) {
        console.log(`     ${RED}ERROR: ${err.message}${RESET}`);
        totals.fail++;
        continue;
      }

      if (data.rateLimited) {
        console.log(`     ${RED}RATE LIMITED — increase ChatSettings:DailyLimit for test runs${RESET}`);
        totals.fail++;
        continue;
      }

      const cards = data.watchCards ?? [];
      const actions = data.actions ?? [];

      // Print assistant output
      console.log(`     ${DIM}assistant:${RESET} ${truncate(data.message)}`);
      if (cards.length) console.log(`     ${DIM}cards:${RESET} ${fmtCards(cards)}`);
      if (actions.length) console.log(`     ${DIM}actions:${RESET} ${fmtActions(actions)}`);

      // Run assertions
      const priorSlugs = turn.isRecovery ? lastOnTopicSlugs : [];
      const results = turn.assert(data, priorSlugs);

      for (const r of results) {
        console.log(`  ${r}`);
        if (r.includes('✓')) totals.pass++;
        else if (r.includes('✗')) totals.fail++;
        else totals.warn++;
      }

      // Track slugs for context checks — only update on non-off-topic turns
      if (!turn.isOffTopic && cards.length > 0) {
        lastOnTopicSlugs = cards.map(c => c.slug).filter(Boolean);
      }
    }
  } finally {
    await clearSession(sessionId);
  }

  console.log(`\n  ${DIM}─── Flow ${flowIdx + 1} summary: ${GREEN}${totals.pass} pass${RESET}  ${YELLOW}${totals.warn} warn${RESET}  ${totals.fail > 0 ? RED : DIM}${totals.fail} fail${RESET} ───${RESET}`);
  return totals;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${BOLD}Chat Concierge — Context Resilience & Off-Topic Handling Test${RESET}`);
  console.log(`${DIM}Backend: ${BASE_URL}  |  ${FLOWS.length} flows  |  ${FLOWS.reduce((n, f) => n + f.turns.length, 0)} total turns${RESET}`);

  const grand = { pass: 0, fail: 0, warn: 0 };

  for (let i = 0; i < FLOWS.length; i++) {
    const totals = await runFlow(FLOWS[i], i);
    grand.pass += totals.pass;
    grand.fail += totals.fail;
    grand.warn += totals.warn;
  }

  console.log(`\n${BOLD}${'═'.repeat(72)}${RESET}`);
  console.log(`${BOLD}Overall:${RESET} ${GREEN}${grand.pass} pass${RESET}  ${YELLOW}${grand.warn} warn${RESET}  ${grand.fail > 0 ? RED : DIM}${grand.fail} fail${RESET}`);

  const exitCode = grand.fail > 0 ? 1 : 0;
  if (exitCode === 0) console.log(`${GREEN}All checks passed.${RESET}\n`);
  else console.log(`${RED}${grand.fail} check(s) failed.${RESET}\n`);

  process.exit(exitCode);
}

main().catch(err => {
  console.error(`\n${RED}Fatal: ${err.message}${RESET}`);
  process.exit(1);
});
