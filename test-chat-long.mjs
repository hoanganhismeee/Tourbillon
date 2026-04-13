// test-chat-long.mjs — Multi-turn conversation stability test
// Tests long sessions: context retention, rejection memory, drift, and action quality.
// Usage: node test-chat-long.mjs
// Backend must be running: http://localhost:5248

const BASE_URL = 'http://localhost:5248';

const RESET   = '\x1b[0m';
const BOLD    = '\x1b[1m';
const DIM     = '\x1b[2m';
const CYAN    = '\x1b[36m';
const YELLOW  = '\x1b[33m';
const GREEN   = '\x1b[32m';
const MAGENTA = '\x1b[35m';
const RED     = '\x1b[31m';
const BLUE    = '\x1b[34m';

async function sendMessage(sessionId, message) {
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

function truncate(str, max = 160) {
  if (!str) return DIM + '(empty)' + RESET;
  const clean = str.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
  return clean.length > max ? clean.slice(0, max) + '…' : clean;
}

function formatActions(actions) {
  if (!actions?.length) return DIM + 'none' + RESET;
  return actions.map(a => {
    const color = a.type === 'suggest' ? YELLOW
                : a.type === 'compare' ? MAGENTA
                : a.type === 'search'  ? CYAN
                : a.type === 'set_cursor' ? BLUE
                : RESET;
    const detail = a.query || a.label || (a.slugs?.join(', ') || '');
    return `${color}[${a.type}]${RESET} ${truncate(detail, 60)}`;
  }).join('  ');
}

function pass(msg) { return `${GREEN}✓${RESET} ${msg}`; }
function fail(msg) { return `${RED}✗${RESET} ${msg}`; }
function warn(msg) { return `${YELLOW}⚠${RESET} ${msg}`; }

// ── Conversation flows ──────────────────────────────────────────────────────

const FLOWS = [
  {
    name: 'Brand rejection — FC rejected, stays rejected across 10 turns',
    turns: [
      { msg: 'Something elegant for a formal dinner', note: 'initial discovery' },
      { msg: "I don't like Frederique Constant, any other brand?", note: 'reject FC', checkNoFC: true },
      { msg: 'Tell me more about the first option', note: 'follow-up 1', checkNoFC: true },
      { msg: 'What is the price range?', note: 'price question', checkNoFC: true },
      { msg: 'Compare the first two options', note: 'compare request', checkNoFC: true },
      { msg: 'Which one would you recommend for a 40-year-old professional?', note: 'recommendation', checkNoFC: true },
      { msg: 'Does it come with a leather strap?', note: 'spec question', checkNoFC: true },
      { msg: 'Show me more alternatives', note: 'discover more', checkNoFC: true },
      { msg: 'What about something under 10,000?', note: 'budget filter', checkNoFC: true },
      { msg: 'OK give me your top pick', note: 'final pick', checkNoFC: true },
    ]
  },
  {
    name: 'Discovery chain — progressively narrow, context retained across 12 turns',
    turns: [
      { msg: 'show me sporty watches', note: 'broad discovery' },
      { msg: 'under 30,000', note: 'price filter' },
      { msg: 'I prefer steel case', note: 'material filter' },
      { msg: 'with a blue dial', note: 'dial filter' },
      { msg: 'Tell me about the first result', note: 'detail request' },
      { msg: 'Is it water resistant?', note: 'spec follow-up' },
      { msg: 'Compare it with the second one', note: 'compare follow-up' },
      { msg: 'Which is more versatile for travel?', note: 'buying question' },
      { msg: 'What about the third option we saw earlier?', note: 'ordinal callback' },
      { msg: 'Would any of these suit a business meeting as well?', note: 'occasion fit' },
      { msg: 'Tell me about the brand behind the top pick', note: 'brand pivot' },
      { msg: 'Do they have other collections worth exploring?', note: 'collection explore' },
    ]
  },
  {
    name: 'Compare chain — Nautilus vs Royal Oak deep dive over 10 turns',
    turns: [
      { msg: 'Compare Nautilus and Royal Oak', note: 'initial compare' },
      { msg: 'Which has better movement finishing?', note: 'movement detail' },
      { msg: 'What about resale value?', note: 'investment angle' },
      { msg: 'I already own a Royal Oak, what should I get next?', note: 'ownership context' },
      { msg: 'Would the Overseas complement it?', note: 'brand extension' },
      { msg: 'Compare Overseas with Aquanaut', note: 'new compare' },
      { msg: 'Tell me the specs of the Overseas', note: 'spec detail' },
      { msg: 'Is it suitable for diving?', note: 'activity fit' },
      { msg: 'Which would you put on for a long-haul flight?', note: 'lifestyle question' },
      { msg: 'OK compare all three: Nautilus, Royal Oak, Overseas', note: 'triple compare' },
    ]
  },
  {
    name: 'Off-topic resilience — AI stays on scope across 8 turns with distractions',
    turns: [
      { msg: "what's the weather today", note: 'off-topic 1', checkDecline: true },
      { msg: 'tell me about Patek Philippe', note: 'recovery — watch topic' },
      { msg: '2 + 2', note: 'off-topic 2', checkDecline: true },
      { msg: 'show me dress watches under 20k', note: 'recovery — discovery' },
      { msg: 'recommend a good restaurant in Paris', note: 'off-topic 3', checkDecline: true },
      { msg: 'compare the first two results', note: 'recovery — compare' },
      { msg: 'write me a poem about watches', note: 'off-topic 4', checkDecline: true },
      { msg: 'what makes a tourbillon complication special?', note: 'recovery — horology' },
    ]
  },
  {
    name: 'Language stability — French throughout 8 turns',
    turns: [
      { msg: 'je cherche une montre élégante', note: 'French greeting' },
      { msg: 'quelque chose pour une cérémonie formelle', note: 'French occasion' },
      { msg: 'pas de Frederique Constant', note: 'French rejection', checkNoFC: true },
      { msg: 'montrez-moi d\'autres options', note: 'French follow-up', checkNoFC: true },
      { msg: 'quel est le prix du premier?', note: 'French price question', checkNoFC: true },
      { msg: 'comparez les deux premiers', note: 'French compare', checkNoFC: true },
      { msg: 'dites-moi plus sur la marque', note: 'French brand info', checkNoFC: true },
      { msg: 'avez-vous quelque chose en or rose?', note: 'French material', checkNoFC: true },
    ]
  },
  {
    name: 'Cursor + actions flow — 6 turns testing action chips',
    turns: [
      { msg: 'change the cursor to tourbillon', note: 'cursor request', checkCursor: true },
      { msg: 'show me sporty watches', note: 'discovery after cursor' },
      { msg: 'open smart search for integrated bracelet sport watches', note: 'search action' },
      { msg: 'compare Nautilus and Royal Oak', note: 'compare action', checkCompare: true },
      { msg: 'set cursor to crosshair', note: 'cursor change', checkCursor: true },
      { msg: 'reset cursor to default', note: 'cursor reset', checkCursor: true },
    ]
  },
  {
    name: 'Session persistence — does context survive 15 rapid turns?',
    turns: [
      { msg: 'Patek Philippe Nautilus', note: 't1' },
      { msg: 'Tell me more', note: 't2 follow-up' },
      { msg: 'Is it sporty or dress?', note: 't3' },
      { msg: 'Compare with Royal Oak', note: 't4 compare' },
      { msg: 'Price difference?', note: 't5' },
      { msg: 'Which has more complications?', note: 't6' },
      { msg: 'Tell me about Audemars Piguet', note: 't7 brand pivot' },
      { msg: 'Their history', note: 't8' },
      { msg: 'Best AP under 50k', note: 't9' },
      { msg: 'Compare first two options', note: 't10' },
      { msg: 'What about Vacheron Constantin?', note: 't11 another brand' },
      { msg: 'Overseas collection specifically', note: 't12' },
      { msg: 'Vs the Royal Oak we compared earlier?', note: 't13 callback' },
      { msg: 'Give me a final recommendation', note: 't14' },
      { msg: 'I have a budget of 40k', note: 't15 late budget filter' },
    ]
  },
];

// ── Runner ──────────────────────────────────────────────────────────────────

async function runFlow(flow, flowIdx) {
  const sessionId = `long-test-${flowIdx}-${Date.now()}`;
  console.log(`\n${BOLD}${'═'.repeat(70)}${RESET}`);
  console.log(`${BOLD}Flow ${flowIdx + 1}: ${flow.name}${RESET}`);
  console.log(`${DIM}Session: ${sessionId}${RESET}`);
  console.log(`${'─'.repeat(70)}`);

  const checks = { pass: 0, fail: 0, warn: 0 };
  let prevCards = [];

  for (let t = 0; t < flow.turns.length; t++) {
    const { msg, note, checkNoFC, checkDecline, checkCursor, checkCompare } = flow.turns[t];

    process.stdout.write(`  ${DIM}T${t + 1} sending...${RESET}\r`);

    let data;
    try {
      data = await sendMessage(sessionId, msg);
    } catch (err) {
      console.log(`  ${RED}T${t + 1} [${note}] ERROR: ${err.message}${RESET}`);
      checks.fail++;
      continue;
    }

    const message = data.message ?? '';
    const cards = data.watchCards ?? [];
    const actions = data.actions ?? [];
    const msgLower = message.toLowerCase();

    // Print turn
    console.log(`  ${CYAN}T${t + 1}${RESET} ${DIM}[${note}]${RESET} ${BOLD}"${msg.slice(0, 60)}${msg.length > 60 ? '…' : ''}"${RESET}`);
    console.log(`     ${truncate(message, 170)}`);
    if (cards.length) console.log(`     ${GREEN}${cards.length} card(s):${RESET} ${cards.map(c => c.slug || c.id).join(', ')}`);
    if (actions.length) console.log(`     ${DIM}actions:${RESET} ${formatActions(actions)}`);

    // Assertions
    const asserts = [];

    if (!message || message.length < 5)
      asserts.push(fail('empty response'));
    else
      asserts.push(pass('has response'));

    if (checkNoFC) {
      const fcMention = msgLower.includes('frederique constant') || msgLower.includes(' fc-') || msgLower.includes('"fc"');
      const fcCards = cards.some(c => (c.brandName || '').toLowerCase().includes('frederique') || (c.slug || '').startsWith('fc-'));
      if (fcMention || fcCards) {
        asserts.push(fail('FC still mentioned after rejection'));
        checks.fail++;
      } else {
        asserts.push(pass('FC absent after rejection'));
        checks.pass++;
      }
    }

    if (checkDecline) {
      const declined = msgLower.match(/specialise|tourbillon.*watch|horology|i help|watch.*help|not able|outside/);
      if (declined) {
        asserts.push(pass('correctly declined off-topic'));
        checks.pass++;
      } else {
        asserts.push(warn('may not have declined off-topic'));
        checks.warn++;
      }
    }

    if (checkCursor) {
      const hasCursorAction = actions.some(a => a.type === 'set_cursor');
      const mentionsCursor = msgLower.includes('cursor');
      if (hasCursorAction || mentionsCursor) {
        asserts.push(pass('cursor action or mention present'));
        checks.pass++;
      } else {
        asserts.push(warn('no cursor action or mention'));
        checks.warn++;
      }
    }

    if (checkCompare) {
      const hasCompareAction = actions.some(a => a.type === 'compare');
      const mentionsCompare = msgLower.includes('compare') || msgLower.includes(' vs ') || msgLower.includes('versus');
      if (hasCompareAction || mentionsCompare) {
        asserts.push(pass('compare action or text present'));
        checks.pass++;
      } else {
        asserts.push(warn('no compare action or text'));
        checks.warn++;
      }
    }

    // Check rate limit
    if (data.rateLimited) {
      asserts.push(fail('rate limited — increase ChatSettings:DailyLimit for testing'));
      checks.fail++;
    }

    if (asserts.length > 1)
      console.log(`     ${asserts.slice(1).join('  ')}`);

    prevCards = cards;
  }

  console.log(`\n  ${DIM}Flow summary:${RESET} ${GREEN}${checks.pass} pass${RESET}  ${YELLOW}${checks.warn} warn${RESET}  ${checks.fail > 0 ? RED : DIM}${checks.fail} fail${RESET}`);
  return checks;
}

async function main() {
  console.log(`\n${BOLD}Chat Concierge — Long Conversation Stability Test${RESET}`);
  console.log(`${DIM}Backend: ${BASE_URL}  |  ${FLOWS.length} flows${RESET}`);

  const totals = { pass: 0, fail: 0, warn: 0 };

  for (let i = 0; i < FLOWS.length; i++) {
    const checks = await runFlow(FLOWS[i], i);
    totals.pass += checks.pass;
    totals.fail += checks.fail;
    totals.warn += checks.warn;
  }

  console.log(`\n${BOLD}${'═'.repeat(70)}${RESET}`);
  console.log(`${BOLD}Overall:${RESET} ${GREEN}${totals.pass} pass${RESET}  ${YELLOW}${totals.warn} warn${RESET}  ${totals.fail > 0 ? RED : DIM}${totals.fail} fail${RESET}`);
  console.log();
}

main().catch(err => {
  console.error(`\n${RED}Fatal: ${err.message}${RESET}`);
  process.exit(1);
});
