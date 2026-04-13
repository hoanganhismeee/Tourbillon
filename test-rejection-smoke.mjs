// Smoke test: brand rejection across 3 turns
const BASE = 'http://localhost:5248';
const SESSION = `smoke-${Date.now()}`;

async function send(msg) {
  const res = await fetch(`${BASE}/api/chat/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: SESSION, message: msg }),
    signal: AbortSignal.timeout(300_000),
  });
  return res.json();
}

function hasFC(data) {
  const text = (data.message || '').toLowerCase();
  const fcText = text.includes('frederique constant') || text.includes(' fc-');
  const fcCards = (data.watchCards || []).some(c =>
    (c.slug || '').startsWith('frederique') || (c.brandName || '').toLowerCase().includes('frederique'));
  return { fcText, fcCards, any: fcText || fcCards };
}

console.log('Session:', SESSION);

const t1 = await send('Something elegant for a formal dinner');
console.log('\nT1 [discovery]');
console.log('  cards:', (t1.watchCards || []).map(c => c.slug).join(', ') || 'none');
console.log('  msg:', t1.message?.slice(0, 100));

const t2 = await send("I don't like Frederique Constant, any other brand?");
const fc2 = hasFC(t2);
console.log('\nT2 [reject FC]', fc2.any ? '  FAIL — FC still present' : '  PASS — FC absent');
console.log('  cards:', (t2.watchCards || []).map(c => c.slug).join(', ') || 'none');
console.log('  msg:', t2.message?.slice(0, 120));

const t3 = await send('Tell me more about the first option');
const fc3 = hasFC(t3);
console.log('\nT3 [follow-up]', fc3.any ? '  FAIL — FC still present' : '  PASS — FC absent');
console.log('  cards:', (t3.watchCards || []).map(c => c.slug).join(', ') || 'none');
console.log('  msg:', t3.message?.slice(0, 120));

const t9 = await send('What about something under 10,000?');
const fc9 = hasFC(t9);
console.log('\nT4 [price follow-up]', fc9.any ? '  FAIL — FC still present' : '  PASS — FC absent');
console.log('  cards:', (t9.watchCards || []).map(c => c.slug).join(', ') || 'none');
console.log('  msg:', t9.message?.slice(0, 120));

console.log('\nDone.');
