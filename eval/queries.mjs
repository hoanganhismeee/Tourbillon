// The golden set: queries paired with a declarative description of what a correct answer is.
// Two sources feed it. HANDWRITTEN covers the semantic phrasings where relevance is a judgement
// call and has to be stated by hand. buildGenerated derives the mechanical facet queries straight
// from the live catalogue, so the set scales with the data instead of going stale against it.

import { mulberry32 } from './metrics.mjs';
import { normaliseMaterial, relevantIds } from './catalogue.mjs';

// -- Handwritten set ----------------------------------------------------------
// These are the queries a keyword index cannot serve: intent expressed as occasion, taste or
// constraint rather than as a field value. The truth spec is the reviewable part - it records
// the reasoning ("office-appropriate means dress style, under 40mm, not a diver") explicitly
// rather than burying it in a hand-picked id list.

export const HANDWRITTEN = [
  // Occasion and suitability
  // "Dress" alone covers 62% of this catalogue, so it never discriminates on its own.
  // Understated is the operative word: modest size, and not a precious metal that shouts.
  { id: 'h01', category: 'descriptor', query: 'something understated I can wear to the office every day',
    truth: { styleAny: ['dress'], diameterMax: 39, materialNone: ['rose gold', 'yellow gold', 'pink gold'] } },
  { id: 'h02', category: 'descriptor', query: 'a dress watch with some complication, works with a suit',
    truth: { styleAny: ['dress'], functionsAny: ['moon phase', 'perpetual calendar', 'chronograph'] } },
  { id: 'h03', category: 'descriptor', query: 'first serious watch for someone starting a collection',
    truth: { priceMax: 20000, movementAny: ['automatic'] } },
  { id: 'h04', category: 'descriptor', query: 'something I can actually take diving, not just splash proof',
    truth: { waterResistanceMin: 200 } },
  { id: 'h05', category: 'descriptor', query: 'a steel sports watch I can wear on the weekend',
    truth: { styleAny: ['sport', 'diver'], materialAny: ['steel', 'titan'] } },
  { id: 'h06', category: 'descriptor', query: 'small enough for a thin wrist',
    truth: { diameterMax: 36 } },
  { id: 'h07', category: 'descriptor', query: 'a bold statement piece with real wrist presence',
    truth: { diameterMin: 44 } },
  // "Warm" excludes white gold and platinum, which read as cold despite being precious metals.
  { id: 'h08', category: 'descriptor', query: 'something warm looking on a leather strap, not cold steel',
    truth: { materialAny: ['rose gold', 'pink gold', 'yellow gold'], strapAny: ['leather', 'alligator', 'calf'] } },
  { id: 'h09', category: 'descriptor', query: 'an automatic I can leave off the wrist over a long weekend',
    truth: { movementAny: ['automatic'], powerReserveMin: 70 } },
  // Almost everything here has a sapphire caseback, so that label separates nothing.
  // The discriminating version of the same intent is a dial you can see through.
  { id: 'h10', category: 'descriptor', query: 'I want to see the mechanism from the front',
    truth: { dialAny: ['openworked', 'skeleton', 'sapphire'] } },

  // Complications described in plain language
  { id: 'h11', category: 'descriptor', query: 'a steel watch with a date window',
    truth: { materialAny: ['steel'], functionsAny: ['date'] } },
  { id: 'h12', category: 'descriptor', query: 'something that can time a lap',
    truth: { functionsAny: ['chronograph'] } },
  { id: 'h13', category: 'descriptor', query: 'a watch that shows the phases of the moon',
    truth: { functionsAny: ['moon'] } },
  { id: 'h14', category: 'descriptor', query: 'useful for tracking a second time zone when I travel',
    truth: { functionsAny: ['gmt', 'dual time', 'second time', 'world time', 'worldtime'] } },
  // Time-only means time only: a subsidiary seconds register or a power-reserve hand
  // already breaks the brief, so they are excluded alongside the obvious complications.
  { id: 'h15', category: 'descriptor', query: 'a clean dress dial with nothing on it but the hands',
    truth: { styleAny: ['dress'],
             functionsNone: ['chronograph', 'moon', 'perpetual', 'calendar', 'date', 'seconds', 'power-reserve'] } },

  // Aesthetic language
  { id: 'h16', category: 'descriptor', query: 'a deep blue face',
    truth: { dialAny: ['blue'] } },
  { id: 'h17', category: 'descriptor', query: 'classic black dial on a leather strap',
    truth: { dialAny: ['black'], strapAny: ['leather', 'alligator', 'calf'] } },
  { id: 'h18', category: 'descriptor', query: 'silver or white dial, very traditional',
    truth: { dialAny: ['silver', 'white'], styleAny: ['dress'], diameterMax: 40 } },
  { id: 'h19', category: 'descriptor', query: 'green dial sports watch on a bracelet',
    truth: { dialAny: ['green'] } },
  { id: 'h20', category: 'descriptor', query: 'a dress watch on a metal bracelet, not a strap',
    truth: { styleAny: ['dress'], strapAny: ['bracelet'] } },

  // Budget expressed conversationally
  { id: 'h21', category: 'budget', query: 'the most affordable thing you have',
    truth: { priceMin: 1, priceMax: 12000 } },
  { id: 'h22', category: 'budget', query: 'my budget is around fifty thousand dollars',
    truth: { priceMin: 35000, priceMax: 65000 } },
  { id: 'h23', category: 'budget', query: 'money is no object, show me the top of the catalogue',
    truth: { priceMin: 150000 } },
  { id: 'h24', category: 'budget', query: 'nothing over twenty grand please',
    truth: { priceMin: 1, priceMax: 20000 } },

  // Negation and exclusion - the case that breaks naive vector search
  { id: 'h25', category: 'exclusion', query: 'a dress watch under 40mm, but definitely not gold',
    truth: { styleAny: ['dress'], diameterMax: 40, materialNone: ['gold'] } },
  { id: 'h26', category: 'exclusion', query: 'a sports watch, anything except a chronograph',
    truth: { styleAny: ['sport', 'diver'], functionsNone: ['chronograph'] } },

  // Compound briefs - several constraints at once
  { id: 'h27', category: 'compound', query: 'steel automatic under 40mm with a date window',
    truth: { materialAny: ['steel'], movementAny: ['automatic'], diameterMax: 40, functionsAny: ['date'] } },
  { id: 'h28', category: 'compound', query: 'blue dial chronograph under thirty thousand',
    truth: { dialAny: ['blue'], functionsAny: ['chronograph'], priceMin: 1, priceMax: 30000 } },
  { id: 'h29', category: 'compound', query: 'rose gold dress watch on leather, 38mm or smaller',
    truth: { materialAny: ['rose gold', 'pink gold'], diameterMax: 38, strapAny: ['leather', 'alligator', 'calf'] } },
  { id: 'h30', category: 'compound', query: 'a week of power reserve so it keeps running in the drawer',
    truth: { powerReserveMin: 120 } },
];

// -- Generated set ------------------------------------------------------------

/// Derives mechanical facet queries from the catalogue itself. Each generator states its own
/// truth spec, so labelling is exact by construction and no query can drift out of date.
/// The seeded PRNG makes the sample identical on every run, which is what lets two runs be compared.
export function buildGenerated(catalogue, { seed = 1234, perGroup = 6 } = {}) {
  const rand = mulberry32(seed);
  const queries = [];
  const pick = (arr, n) => shuffle(arr, rand).slice(0, n);

  // Exact reference lookup. One correct answer, so this measures precision at rank 1
  // rather than recall - the search should never bury an exact match.
  const withRefs = catalogue.records.filter(r => /\d/.test(r.name) && r.name.length >= 4);
  for (const w of pick(withRefs, perGroup)) {
    queries.push({
      id: `g-ref-${w.id}`, category: 'reference', query: w.name,
      truth: { ids: [w.id] },
    });
  }

  // Brand browsing. The semantic router is supposed to send these down the SQL path,
  // so this group doubles as the check that the cheap path is being taken.
  const brandCounts = countBy(catalogue.records, r => r.brandName);
  const brands = [...brandCounts.entries()].filter(([, n]) => n >= 5).map(([b]) => b);
  for (const brand of pick(brands, perGroup)) {
    queries.push({
      id: `g-brand-${slugish(brand)}`, category: 'brand', query: `show me ${brand} watches`,
      truth: { brand },
    });
  }

  // Brand plus budget. Hard filters, so the semantic cache must be bypassed here.
  for (const brand of pick(brands, perGroup)) {
    const prices = catalogue.records
      .filter(r => r.brandName === brand && r.price > 0)
      .map(r => r.price).sort((a, b) => a - b);
    if (prices.length < 4) continue;
    const cap = roundBudget(prices[Math.floor(prices.length * 0.6)]);
    queries.push({
      id: `g-brandbudget-${slugish(brand)}`, category: 'brand_budget',
      query: `${brand} under ${formatMoney(cap)}`,
      truth: { brand, priceMin: 1, priceMax: cap },
    });
  }

  // Case material.
  const materials = [...countBy(catalogue.records, r => normaliseMaterial(r.caseMaterial)).entries()]
    .filter(([m, n]) => n >= 8 && m !== '(unknown)' && m !== 'gold (other)').map(([m]) => m);
  for (const material of pick(materials, Math.min(perGroup, 5))) {
    queries.push({
      id: `g-material-${slugish(material)}`, category: 'material', query: `${material} case watches`,
      truth: { materialAny: materialTokens(material) },
    });
  }

  // Diameter bands. Sizing is the constraint users state most literally and the one a
  // keyword index has no way to satisfy, since diameter lives inside the specs JSON.
  for (const [lo, hi] of [[0, 36], [36, 39], [39, 42], [42, 99]]) {
    queries.push({
      id: `g-size-${lo}-${hi}`, category: 'size',
      query: hi === 99 ? `watches ${lo}mm and above` : `watches between ${lo}mm and ${hi}mm`,
      truth: { diameterMin: lo === 0 ? null : lo, diameterMax: hi === 99 ? null : hi },
    });
  }

  // Dial colour.
  const dials = [...countBy(catalogue.records, r => r.dialColour).entries()]
    .filter(([d, n]) => d && n >= 8).map(([d]) => d);
  for (const dial of pick(dials, Math.min(perGroup, 5))) {
    queries.push({
      id: `g-dial-${slugish(dial)}`, category: 'dial', query: `${dial} dial`,
      truth: { dialAny: [dial] },
    });
  }

  // Complications.
  for (const fn of ['chronograph', 'moon phase', 'perpetual calendar', 'gmt', 'tourbillon']) {
    const truth = { functionsAny: [fn.split(' ')[0]] };
    if (relevantIds(catalogue, truth).size >= 3) {
      queries.push({ id: `g-fn-${slugish(fn)}`, category: 'complication', query: `${fn} watches`, truth });
    }
  }

  return queries.filter(q => q.truth != null);
}

// -- Scope --------------------------------------------------------------------
// Which subsystem owns a category now that Smart Search is deterministic-only and the concierge
// answers open-ended briefs. Scoring both on one mixed set charges each arm for queries it no
// longer claims to serve, which reads as a regression rather than as a scope change.

const SCOPE_BY_CATEGORY = {
  // Stated as facets, so a parser can compile them to SQL with no model call.
  reference: 'spec', brand: 'spec', brand_budget: 'spec', budget: 'spec',
  material: 'spec', size: 'spec', dial: 'spec', complication: 'spec',
  exclusion: 'spec', compound: 'spec',
  // Stated as occasion, taste or suitability, with no field to filter on.
  descriptor: 'semantic',
};

/// Scope a query belongs to. Unknown categories default to spec: a new facet category is the
/// common case, and landing in the measured set is safer than being silently dropped.
export function scopeOf(query) {
  return SCOPE_BY_CATEGORY[query.category] ?? 'spec';
}

// -- Label validation ---------------------------------------------------------

/// A label is only useful if it is neither empty nor so broad that any result set scores well.
/// Anything the harness cannot score fairly is reported and excluded rather than silently kept.
export function validateQueries(catalogue, queries, { maxShare = 0.25 } = {}) {
  const total = catalogue.records.length;
  return queries.map(q => {
    const relevant = relevantIds(catalogue, q.truth);
    const share = total === 0 ? 0 : relevant.size / total;
    let status = 'ok';
    if (relevant.size === 0) status = 'empty';
    else if (share > maxShare) status = 'too_broad';
    else if (relevant.size < 2 && q.category !== 'reference') status = 'thin';
    return { ...q, relevant, relevantCount: relevant.size, share, status };
  });
}

// -- Helpers ------------------------------------------------------------------

function shuffle(arr, rand) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function countBy(records, pick) {
  const counts = new Map();
  for (const r of records) {
    const v = pick(r);
    if (!v) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return counts;
}

/// Expands a display bucket back into the substrings that appear in raw spec text.
function materialTokens(material) {
  if (material === 'rose gold') return ['rose gold', 'pink gold'];
  if (material === 'gold (other)') return ['gold'];
  if (material === 'platinum') return ['platin'];
  if (material === 'titanium') return ['titan'];
  return [material];
}

/// Rounds a budget to a figure a person would actually type, so the generated phrasing
/// reads like a real query rather than a percentile.
function roundBudget(value) {
  if (value >= 100000) return Math.round(value / 25000) * 25000;
  if (value >= 20000) return Math.round(value / 5000) * 5000;
  return Math.round(value / 1000) * 1000;
}

const formatMoney = v => `$${v.toLocaleString('en-AU')}`;
const slugish = v => String(v).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
