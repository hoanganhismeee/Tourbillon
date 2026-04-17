// test-chat-mixed-brief-long.mjs - Long mixed-brief concierge QA harness
// Focus: mixed recommendation briefs like "dive watches and art watches"
// Usage: node test-chat-mixed-brief-long.mjs
// Run against the normal Makefile-managed stack when model behavior matters.

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5248';
const CHAT_URL = `${BASE_URL}/api/chat/message`;
const BRANDS_URL = `${BASE_URL}/api/brand`;
const COLLECTIONS_URL = `${BASE_URL}/api/collection`;
const SESSION_ID = `mixed-brief-long-${Date.now()}`;
const KNOWN_DISCOVERY_CARD_LIMIT = 10;
const TARGET_FINAL_SHORTLIST_MIN = 6;
const TARGET_FINAL_SHORTLIST_MAX = 10;
const REQUEST_TIMEOUT_MS = 300_000;

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const MAGENTA = '\x1b[35m';

const MIXED_FLOW = [
  { label: 'Initial mixed brief', message: 'i want one real diver and one genuinely art-led watch, recommend me a mixed shortlist' },
  { label: 'Ask for richer structure', message: 'separate the dive lane from the art lane first, then give me the strongest combined row' },
  { label: 'Reject weak art fit', message: 'these still feel too generic, the art side is not design-forward enough' },
  { label: 'Force a revised shortlist', message: 'revise it and keep one true diver direction plus one proper art-led direction, not just colourful sport watches' },
  { label: 'Ask for grouped guidance', message: 'introduce the brands or collections briefly, then narrow to the best actual models' },
  { label: 'Request shortlist only', message: 'now give me the strongest shortlist only, no extra waffle' },
  { label: 'Add budget pressure', message: 'keep most of it under 25,000 but allow one stretch option if it really earns the place' },
  { label: 'Split by intent', message: 'which two are the clearest dive picks and which two are the clearest art-led picks' },
  { label: 'Reject omega-only drift', message: 'and do not collapse back into omega-only options this time' },
  { label: 'Ask for a final mixed shortlist', message: 'final answer: give me the cleanest mixed shortlist again' },
  { label: 'Cross-compare the directions', message: 'compare the strongest art-led pick against the strongest diver pick' },
  { label: 'One last curated list', message: 'last pass: give me the one curated mixed shortlist you would actually buy from' },
];

async function fetchJson(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status} for ${url}: ${text.slice(0, 240)}`);
  }

  return response.json();
}

async function sendMessage(message) {
  return fetchJson(CHAT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: SESSION_ID, message }),
  });
}

async function clearSession() {
  try {
    await fetch(`${BASE_URL}/api/chat/session/${SESSION_ID}`, {
      method: 'DELETE',
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    // Ignore cleanup failures in the harness.
  }
}

function colorVerdict(kind, text) {
  const icon = kind === 'PASS'
    ? `${GREEN}PASS${RESET}`
    : kind === 'WARN'
      ? `${YELLOW}WARN${RESET}`
      : `${RED}FAIL${RESET}`;

  return `${icon} ${text}`;
}

function truncate(text, max = 220) {
  if (!text) return `${DIM}(empty)${RESET}`;
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max)}...` : clean;
}

function formatActions(actions) {
  if (!actions?.length) return `${DIM}none${RESET}`;

  return actions
    .map(action => {
      const detail = action.query || action.label || action.href || action.slugs?.join(', ') || '';
      return `${MAGENTA}[${action.type}]${RESET} ${truncate(detail, 70)}`;
    })
    .join('  ');
}

function parseInternalLinks(message) {
  const links = [];
  const pattern = /\[([^\]]+)\]\((\/[^)]+)\)/g;
  let match;

  while ((match = pattern.exec(message)) !== null) {
    links.push({ label: match[1], href: match[2] });
  }

  return links;
}

function overlapRatio(previousSlugs, nextSlugs) {
  if (!previousSlugs.length || !nextSlugs.length) return 0;

  const previous = new Set(previousSlugs);
  const shared = nextSlugs.filter(slug => previous.has(slug)).length;
  return shared / Math.max(previousSlugs.length, nextSlugs.length);
}

function buildCollectionSignals(collections) {
  const artCollections = new Set();
  const diveCollections = new Set();

  for (const collection of collections) {
    const styles = new Set((collection.styles || []).map(style => String(style).toLowerCase()));
    const normalizedName = normalizeText(collection.name);

    if (styles.has('art')) artCollections.add(collection.slug);
    if (
      styles.has('diver')
      || /\b(seamaster|submariner|seaq|fifty fathoms|bathyscaphe|pelagos|superocean|diver)\b/i.test(normalizedName)
    ) {
      diveCollections.add(collection.slug);
    }
  }

  return { artCollections, diveCollections };
}

function summarizeCatalogue(brandMap, collectionMap, signals) {
  const artNames = [...signals.artCollections]
    .map(slug => collectionMap.get(slug)?.name)
    .filter(Boolean)
    .slice(0, 6);
  const diveNames = [...signals.diveCollections]
    .map(slug => collectionMap.get(slug)?.name)
    .filter(Boolean)
    .slice(0, 6);

  console.log(`${DIM}Known brands:${RESET} ${brandMap.size}`);
  console.log(`${DIM}Art-oriented collections seen in DB:${RESET} ${artNames.length ? artNames.join(', ') : 'none'}`);
  console.log(`${DIM}Dive-oriented collections seen in DB:${RESET} ${diveNames.length ? diveNames.join(', ') : 'none'}`);
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^\w\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildEntityIndex(values, type) {
  const ignoredCollectionNames = new Set(['collection']);

  return values
    .map(value => ({
      slug: value.slug,
      name: value.name,
      type,
      normalizedName: normalizeText(value.name),
    }))
    .filter(entity => entity.normalizedName.length >= 4)
    .filter(entity => !(type === 'collection' && ignoredCollectionNames.has(entity.normalizedName)));
}

function findMentionedEntities(message, entityIndex) {
  const normalizedMessage = normalizeText(message);
  if (!normalizedMessage) return [];

  return entityIndex.filter(entity => {
    const pattern = new RegExp(`\\b${escapeRegex(entity.normalizedName)}\\b`, 'i');
    return pattern.test(normalizedMessage);
  });
}

function inferSupportedEntitiesFromWatchLinks(links, brandMap, collectionMap) {
  const supported = new Set();

  for (const link of links) {
    if (!link.href.startsWith('/watches/')) continue;

    const watchSlug = link.href.replace('/watches/', '');
    for (const brandSlug of brandMap.keys()) {
      if (watchSlug.startsWith(`${brandSlug}-`)) {
        supported.add(brandSlug);
      }
    }

    for (const collectionSlug of collectionMap.keys()) {
      const tail = collectionSlug.replace(/^[^-]+-[^-]+-/, '');
      if (tail && watchSlug.includes(tail)) {
        supported.add(collectionSlug);
      }
    }
  }

  return supported;
}

function analyzeTurn(turnIndex, turn, response, previousResponse, brandMap, collectionMap, signals, entityIndex) {
  const message = response.message ?? '';
  const cards = response.watchCards ?? [];
  const actions = response.actions ?? [];
  const links = parseInternalLinks(message);
  const cardSlugs = cards.map(card => card.slug).filter(Boolean);
  const uniqueBrands = new Set(cards.map(card => card.brandSlug).filter(Boolean));
  const uniqueCollections = new Set(cards.map(card => card.collectionSlug).filter(Boolean));
  const artCardCount = cards.filter(card => card.collectionSlug && signals.artCollections.has(card.collectionSlug)).length;
  const diveCardCount = cards.filter(card => card.collectionSlug && signals.diveCollections.has(card.collectionSlug)).length;
  const verdicts = [];

  if (!message || message.trim().length < 10) {
    verdicts.push({ kind: 'FAIL', text: 'Assistant message is empty or too short.' });
  } else {
    verdicts.push({ kind: 'PASS', text: 'Assistant returned a non-empty response.' });
  }

  if (response.rateLimited) {
    verdicts.push({ kind: 'FAIL', text: 'Chat rate limit triggered during the long session.' });
  }

  const unknownLinks = links.filter(link => {
    if (link.href.startsWith('/brands/')) return !brandMap.has(link.href.replace('/brands/', ''));
    if (link.href.startsWith('/collections/')) return !collectionMap.has(link.href.replace('/collections/', ''));
    return false;
  });
  if (unknownLinks.length) {
    verdicts.push({ kind: 'FAIL', text: `Response linked unknown catalogue entities: ${unknownLinks.map(link => link.href).join(', ')}` });
  } else {
    verdicts.push({ kind: 'PASS', text: 'All linked brand/collection entities exist in the catalogue.' });
  }

  const watchLinkSupport = inferSupportedEntitiesFromWatchLinks(links, brandMap, collectionMap);
  const supportedEntitySlugs = new Set([
    ...cards.map(card => card.brandSlug).filter(Boolean),
    ...cards.map(card => card.collectionSlug).filter(Boolean),
    ...watchLinkSupport,
    ...links
      .filter(link => link.href.startsWith('/brands/') || link.href.startsWith('/collections/'))
      .map(link => link.href.replace(/^\/(?:brands|collections)\//, '')),
  ]);
  const mentionedEntities = findMentionedEntities(message, entityIndex);
  const unsupportedMentions = mentionedEntities.filter(entity => !supportedEntitySlugs.has(entity.slug));
  if (unsupportedMentions.length) {
    const summary = unsupportedMentions
      .slice(0, 4)
      .map(entity => `${entity.type}:${entity.name}`)
      .join(', ');
    verdicts.push({
      kind: cards.length ? 'WARN' : 'FAIL',
      text: `Message mentions catalogue entities not backed by the current row or links: ${summary}`,
    });
  } else {
    verdicts.push({ kind: 'PASS', text: 'Entity mentions stay aligned with the current cards or linked catalogue context.' });
  }

  if (turnIndex === 0) {
    if (diveCardCount > 0 && artCardCount > 0) {
      verdicts.push({ kind: 'PASS', text: 'Initial shortlist spans both dive and art-oriented collections.' });
    } else if (diveCardCount > 0 || artCardCount > 0) {
      verdicts.push({ kind: 'FAIL', text: 'Initial shortlist under-covers the mixed brief; only one direction is visible in the cards.' });
    } else {
      verdicts.push({ kind: 'FAIL', text: 'Initial shortlist does not show clear dive or art-oriented collection coverage.' });
    }
  }

  if (turn.label === 'Ask for richer structure' || turn.label === 'Request shortlist only' || turn.label === 'Ask for a final mixed shortlist') {
    verdicts.push({
      kind: cards.length ? 'PASS' : 'FAIL',
      text: cards.length
        ? 'Shortlist remained visible on a recommendation-focused follow-up.'
        : 'Recommendation-focused follow-up dropped the watch cards instead of keeping or revising them.',
    });
  }

  if (turn.label === 'Reject weak art fit' || turn.label === 'Force a revised shortlist') {
    const previousSlugs = (previousResponse?.watchCards ?? []).map(card => card.slug).filter(Boolean);
    const ratio = overlapRatio(previousSlugs, cardSlugs);
    if (!cards.length) {
      verdicts.push({ kind: 'FAIL', text: 'Corrective follow-up returned no watch cards.' });
    } else if (ratio >= 0.6) {
      verdicts.push({ kind: 'FAIL', text: `Corrective follow-up stayed too close to the old row (overlap ${(ratio * 100).toFixed(0)}%).` });
    } else {
      verdicts.push({ kind: 'PASS', text: `Corrective follow-up materially revised the shortlist (overlap ${(ratio * 100).toFixed(0)}%).` });
    }
  }

  if (turn.label === 'Ask for grouped guidance') {
    const hasGroupedLanguage = /\b(?:dive|art)\b/i.test(message) && (links.length >= 2 || /\n|\d+\./.test(message));
    verdicts.push({
      kind: hasGroupedLanguage ? 'PASS' : 'WARN',
      text: hasGroupedLanguage
        ? 'Grouped explanation or multi-direction framing is present.'
        : 'Grouped explanation is weak; the assistant did not clearly separate dive and art directions.',
    });
  }

  if (turn.label === 'Reject omega-only drift') {
    const allOmega = cards.length > 0 && cards.every(card => (card.brandName || '').toLowerCase() === 'omega');
    verdicts.push({
      kind: allOmega ? 'FAIL' : 'PASS',
      text: allOmega
        ? 'Shortlist still collapsed into Omega after explicit pushback.'
        : 'Shortlist is not locked to Omega after pushback.',
    });
  }

  const isFinalTurn = turn.label === 'One last curated list';
  if (isFinalTurn) {
    if (cards.length >= TARGET_FINAL_SHORTLIST_MIN && cards.length <= TARGET_FINAL_SHORTLIST_MAX) {
      verdicts.push({ kind: 'PASS', text: `Final shortlist length is rich enough (${cards.length} models).` });
    } else if (cards.length === KNOWN_DISCOVERY_CARD_LIMIT) {
      verdicts.push({
        kind: 'WARN',
        text: `Final shortlist hit the current backend card cap of ${KNOWN_DISCOVERY_CARD_LIMIT}; this blocks the desired ${TARGET_FINAL_SHORTLIST_MIN}-${TARGET_FINAL_SHORTLIST_MAX} model target.`,
      });
    } else {
      verdicts.push({
        kind: 'FAIL',
        text: `Final shortlist is too thin (${cards.length} models); target is ${TARGET_FINAL_SHORTLIST_MIN}-${TARGET_FINAL_SHORTLIST_MAX}.`,
      });
    }

    const diverseEnough = uniqueBrands.size >= 2 || uniqueCollections.size >= 2;
    verdicts.push({
      kind: diverseEnough ? 'PASS' : 'FAIL',
      text: diverseEnough
        ? `Final shortlist has acceptable diversity (${uniqueBrands.size} brand(s), ${uniqueCollections.size} collection(s)).`
        : 'Final shortlist is too narrow in brand/collection diversity.',
    });
  }

  return {
    cards,
    actions,
    verdicts,
    links,
    unsupportedMentions,
    metrics: {
      artCardCount,
      diveCardCount,
      uniqueBrands: uniqueBrands.size,
      uniqueCollections: uniqueCollections.size,
      cardCount: cards.length,
    },
  };
}

function printTurn(turnIndex, turn, response, analysis) {
  console.log(`\n${CYAN}T${turnIndex + 1}${RESET} ${BOLD}${turn.label}${RESET}`);
  console.log(`  ${DIM}user:${RESET} ${turn.message}`);
  console.log(`  ${DIM}assistant:${RESET} ${truncate(response.message, 260)}`);
  console.log(`  ${DIM}cards:${RESET} ${analysis.cards.length ? analysis.cards.map(card => `${card.brandName} / ${card.collectionName} / ${card.name}`).join(' | ') : 'none'}`);
  console.log(`  ${DIM}actions:${RESET} ${formatActions(analysis.actions)}`);
  console.log(`  ${DIM}metrics:${RESET} ${analysis.metrics.cardCount} cards, ${analysis.metrics.uniqueBrands} brand(s), ${analysis.metrics.uniqueCollections} collection(s), ${analysis.metrics.diveCardCount} dive-signal, ${analysis.metrics.artCardCount} art-signal`);
  for (const verdict of analysis.verdicts) {
    console.log(`   ${colorVerdict(verdict.kind, verdict.text)}`);
  }
}

function aggregateResults(turnResults) {
  const allCards = turnResults.flatMap(result => result.analysis.cards);
  const uniqueBrands = new Set(allCards.map(card => card.brandSlug).filter(Boolean));
  const uniqueCollections = new Set(allCards.map(card => card.collectionSlug).filter(Boolean));
  const uniqueModels = new Set(allCards.map(card => card.slug).filter(Boolean));
  const counts = { PASS: 0, WARN: 0, FAIL: 0 };

  for (const result of turnResults) {
    for (const verdict of result.analysis.verdicts) {
      counts[verdict.kind]++;
    }
  }

  const initial = turnResults[0]?.analysis.metrics;
  const correction = turnResults.find(result => result.turn.label === 'Reject weak art fit')?.analysis;
  const final = turnResults.at(-1)?.analysis.metrics;
  const recommendationTurns = turnResults.filter(result =>
    result.turn.label === 'Ask for richer structure'
    || result.turn.label === 'Request shortlist only'
    || result.turn.label === 'Ask for a final mixed shortlist'
    || result.turn.label === 'One last curated list'
  );
  const correctionNoCards = correction ? correction.cards.length === 0 : false;
  const initialUnderCovered = initial ? !(initial.diveCardCount > 0 && initial.artCardCount > 0) : false;
  const finalTooThin = final ? final.cardCount < TARGET_FINAL_SHORTLIST_MIN : true;
  const recommendationTurnsWithoutCards = recommendationTurns.filter(result => result.analysis.cards.length === 0).length;
  const ungroundedTurns = turnResults.filter(result => result.analysis.unsupportedMentions.length > 0).length;

  return {
    counts,
    uniqueBrands: uniqueBrands.size,
    uniqueCollections: uniqueCollections.size,
    uniqueModels: uniqueModels.size,
    initialUnderCovered,
    correctionNoCards,
    finalTooThin,
    recommendationTurnsWithoutCards,
    ungroundedTurns,
  };
}

function printSummary(summary) {
  console.log(`\n${BOLD}${'='.repeat(78)}${RESET}`);
  console.log(`${BOLD}Mixed-Brief Long-Session Summary${RESET}`);
  console.log(`  ${GREEN}${summary.counts.PASS} pass${RESET}  ${YELLOW}${summary.counts.WARN} warn${RESET}  ${summary.counts.FAIL ? RED : DIM}${summary.counts.FAIL} fail${RESET}`);
  console.log(`  ${DIM}unique brands surfaced:${RESET} ${summary.uniqueBrands}`);
  console.log(`  ${DIM}unique collections surfaced:${RESET} ${summary.uniqueCollections}`);
  console.log(`  ${DIM}unique models surfaced:${RESET} ${summary.uniqueModels}`);

  console.log(`\n${BOLD}Current diagnosis${RESET}`);
  console.log(`  ${summary.initialUnderCovered ? colorVerdict('FAIL', 'Mixed brief is under-covered on the first recommendation turn.') : colorVerdict('PASS', 'Initial recommendation covered both directions.')}`);
  console.log(`  ${summary.correctionNoCards ? colorVerdict('FAIL', 'Corrective follow-up lost the shortlist instead of revising it.') : colorVerdict('PASS', 'Corrective follow-up kept a live shortlist.')}`);
  console.log(`  ${summary.recommendationTurnsWithoutCards ? colorVerdict('FAIL', `${summary.recommendationTurnsWithoutCards} recommendation-focused turn(s) dropped cards instead of returning a live shortlist.`) : colorVerdict('PASS', 'Recommendation-focused turns kept a live shortlist.')}`);
  console.log(`  ${summary.ungroundedTurns ? colorVerdict('FAIL', `${summary.ungroundedTurns} turn(s) mentioned brands or collections outside the current returned row/link context.`) : colorVerdict('PASS', 'Turn-by-turn entity mentions stayed grounded in the returned context.')}`);
  console.log(`  ${summary.finalTooThin ? colorVerdict('WARN', `Final shortlist did not reach the desired ${TARGET_FINAL_SHORTLIST_MIN}-${TARGET_FINAL_SHORTLIST_MAX} model range.`) : colorVerdict('PASS', 'Final shortlist met the desired richness target.')}`);
  console.log(`  ${colorVerdict('WARN', `Current backend card cap is assumed to be ${KNOWN_DISCOVERY_CARD_LIMIT}; this can block the richer final shortlist target even when retrieval has more candidates.`)}`);
}

async function main() {
  console.log(`\n${BOLD}Chat Concierge - Mixed-Brief Long QA${RESET}`);
  console.log(`${DIM}Base URL:${RESET} ${BASE_URL}`);
  console.log(`${DIM}Session:${RESET} ${SESSION_ID}`);

  const [brands, collections] = await Promise.all([
    fetchJson(BRANDS_URL),
    fetchJson(COLLECTIONS_URL),
  ]);

  const brandItems = Array.isArray(brands) ? brands : brands?.value ?? [];
  const collectionItems = Array.isArray(collections) ? collections : collections?.value ?? [];

  const brandMap = new Map(brandItems.map(brand => [brand.slug, brand]));
  const collectionMap = new Map(collectionItems.map(collection => [collection.slug, collection]));
  const signals = buildCollectionSignals(collectionItems);
  const entityIndex = [
    ...buildEntityIndex(brandItems, 'brand'),
    ...buildEntityIndex(collectionItems, 'collection'),
  ];

  console.log();
  summarizeCatalogue(brandMap, collectionMap, signals);

  const turnResults = [];
  let previousResponse = null;

  try {
    for (let i = 0; i < MIXED_FLOW.length; i++) {
      const turn = MIXED_FLOW[i];
      const response = await sendMessage(turn.message);
      const analysis = analyzeTurn(i, turn, response, previousResponse, brandMap, collectionMap, signals, entityIndex);
      turnResults.push({ turn, response, analysis });
      printTurn(i, turn, response, analysis);
      previousResponse = response;
    }
  } finally {
    await clearSession();
  }

  const summary = aggregateResults(turnResults);
  printSummary(summary);
}

main().catch(error => {
  console.error(`\n${RED}Fatal:${RESET} ${error.message}`);
  process.exit(1);
});
