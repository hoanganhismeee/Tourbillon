// The golden set: queries paired with a declarative description of what a correct answer is.
// Two sources feed it. HANDWRITTEN covers the semantic phrasings where relevance is a judgement
// call and has to be stated by hand. buildGenerated derives the mechanical facet queries straight
// from the live catalogue, so the set scales with the data instead of going stale against it.

import { mulberry32 } from './metrics.mjs';
import { normaliseMaterial, relevantIds, unknownTruthKeys } from './catalogue.mjs';

// -- Handwritten set ----------------------------------------------------------
// Two halves, one per subsystem. The spec half reduces to facets even when the wording hides it,
// so the parser is expected to resolve it. The semantic half names no facet at all: its label is
// the judgement a knowledgeable salesperson would make, written down so it can be argued with.
// Labels are written from the brief, never from what a system returned for it.

export const HANDWRITTEN = [
  // ===========================================================================
  // SPEC SCOPE - Smart Search
  // ===========================================================================

  // Brand names as people type them: nicknames and misspellings.
  { id: 'h31', category: 'brand_alias', query: 'something from AP',
    truth: { brand: 'Audemars Piguet' } },
  { id: 'h32', category: 'brand_alias', query: 'JLC watches',
    truth: { brand: 'Jaeger-LeCoultre' } },
  { id: 'h33', category: 'brand_alias', query: 'patek philipe',
    truth: { brand: 'Patek Philippe' } },

  // Collection names on their own, including one that is mostly a number.
  { id: 'h34', category: 'collection', query: 'Nautilus',
    truth: { collection: 'Nautilus' } },
  { id: 'h35', category: 'collection', query: 'speedmaster',
    truth: { collection: 'Speedmaster' } },
  { id: 'h36', category: 'collection', query: 'lange 1',
    truth: { collection: 'Lange 1' } },

  // A style word has to land on the right collections, inside the named brand when there is one.
  { id: 'h37', category: 'style', query: 'sporty Patek Philippe',
    truth: { brand: 'Patek Philippe', styleAny: ['sport'] } },
  { id: 'h38', category: 'style', query: 'Rolex sports models',
    truth: { brand: 'Rolex', styleAny: ['sport'] } },
  { id: 'h39', category: 'style', query: 'a dive watch from Omega',
    truth: { brand: 'Omega', styleAny: ['diver'] } },
  { id: 'h05', category: 'style', query: 'a steel sports watch I can wear on the weekend',
    truth: { styleAny: ['sport', 'diver'], materialAny: ['steel', 'titan'] } },
  { id: 'h20', category: 'style', query: 'a dress watch on a metal bracelet, not a strap',
    truth: { styleAny: ['dress'], strapAny: ['bracelet'] } },

  // Water resistance stated as a use rather than in metres.
  { id: 'h04', category: 'water_resistance', query: 'something I can actually take diving, not just splash proof',
    truth: { waterResistanceMin: 200 } },
  { id: 'h40', category: 'water_resistance', query: 'a proper strong diver',
    truth: { waterResistanceMin: 300 } },
  // Swimming alone clears 100m on 28% of the catalogue, so the sports build is what separates it.
  { id: 'h41', category: 'water_resistance', query: 'a sports watch I can swim in',
    truth: { waterResistanceMin: 100, styleAny: ['sport', 'diver'] } },

  // Movement and power reserve.
  // A long weekend is about 70 hours off the wrist and the catalogue is dense there, so this label
  // is reported as too broad rather than narrowed until it passes.
  { id: 'h09', category: 'movement', query: 'an automatic I can leave off the wrist over a long weekend',
    truth: { movementAny: ['automatic'], powerReserveMin: 70 } },
  { id: 'h30', category: 'movement', query: 'a week of power reserve so it keeps running in the drawer',
    truth: { powerReserveMin: 120 } },
  { id: 'h42', category: 'movement', query: 'a hand-wound watch that runs for days',
    truth: { movementAny: ['manual'], powerReserveMin: 70 } },

  // Size in words, including a number spelled out.
  { id: 'h06', category: 'size', query: 'small enough for a thin wrist',
    truth: { diameterMax: 36 } },
  { id: 'h43', category: 'size', query: 'thirty-eight millimetres or smaller',
    truth: { diameterMax: 38 } },

  // Dial colour and dial type.
  { id: 'h16', category: 'dial', query: 'a deep blue face',
    truth: { dialAny: ['blue'] } },
  { id: 'h17', category: 'dial', query: 'classic black dial on a leather strap',
    truth: { dialAny: ['black'], strapAny: ['leather', 'alligator', 'calf'] } },
  { id: 'h19', category: 'dial', query: 'green dial sports watch on a bracelet',
    truth: { dialAny: ['green'] } },
  // Almost everything here has a sapphire caseback, so that label separates nothing.
  // The discriminating version of the same intent is a dial you can see through.
  { id: 'h10', category: 'dial', query: 'I want to see the mechanism from the front',
    truth: { dialAny: ['openworked', 'skeleton', 'sapphire'] } },

  // Complications in plain language. The generated set asks for "chronograph watches" by name,
  // so h12 and that query share a label and measure whether the wording changes the answer.
  { id: 'h12', category: 'complication', query: 'something that can time a lap',
    truth: { functionsAny: ['chronograph'] } },
  { id: 'h13', category: 'complication', query: 'a watch that shows the phases of the moon',
    truth: { functionsAny: ['moon'] } },
  { id: 'h14', category: 'complication', query: 'useful for tracking a second time zone when I travel',
    truth: { functionsAny: ['gmt', 'dual time', 'second time', 'world time', 'worldtime'] } },

  // Budget expressed conversationally.
  { id: 'h21', category: 'budget', query: 'the most affordable thing you have',
    truth: { priceMin: 1, priceMax: 12000 } },
  { id: 'h22', category: 'budget', query: 'my budget is around fifty thousand dollars',
    truth: { priceMin: 35000, priceMax: 65000 } },
  { id: 'h23', category: 'budget', query: 'money is no object, show me the top of the catalogue',
    truth: { priceMin: 150000 } },
  { id: 'h24', category: 'budget', query: 'nothing over twenty grand please',
    truth: { priceMin: 1, priceMax: 20000 } },

  // Negation and exclusion - the case that breaks naive vector search.
  { id: 'h25', category: 'exclusion', query: 'a dress watch under 40mm, but definitely not gold',
    truth: { styleAny: ['dress'], diameterMax: 40, materialNone: ['gold'] } },
  { id: 'h26', category: 'exclusion', query: 'a sports watch, anything except a chronograph',
    truth: { styleAny: ['sport', 'diver'], functionsNone: ['chronograph'] } },
  { id: 'h44', category: 'exclusion', query: 'anything but Rolex, under fifteen grand',
    truth: { excludeBrand: ['Rolex'], priceMin: 1, priceMax: 15000 } },
  // The matcher has no strap exclusion, so "not leather" is stated as the straps that remain.
  { id: 'h45', category: 'exclusion', query: 'a chronograph on a bracelet or rubber, not leather',
    truth: { functionsAny: ['chronograph'], strapAny: ['bracelet', 'rubber', 'oyster'] } },

  // Compound briefs - several constraints at once.
  { id: 'h11', category: 'compound', query: 'a steel watch with a date window',
    truth: { materialAny: ['steel'], functionsAny: ['date'] } },
  { id: 'h27', category: 'compound', query: 'steel automatic under 40mm with a date window',
    truth: { materialAny: ['steel'], movementAny: ['automatic'], diameterMax: 40, functionsAny: ['date'] } },
  { id: 'h28', category: 'compound', query: 'blue dial chronograph under thirty thousand',
    truth: { dialAny: ['blue'], functionsAny: ['chronograph'], priceMin: 1, priceMax: 30000 } },
  { id: 'h29', category: 'compound', query: 'rose gold dress watch on leather, 38mm or smaller',
    truth: { materialAny: ['rose gold', 'pink gold'], diameterMax: 38, strapAny: ['leather', 'alligator', 'calf'] } },
  { id: 'h46', category: 'compound', query: 'white gold perpetual calendar',
    truth: { materialAny: ['white gold'], functionsAny: ['perpetual calendar'] } },

  // ===========================================================================
  // SEMANTIC SCOPE - concierge
  // ===========================================================================

  // Occasion.
  // "Dress" alone covers 62% of this catalogue, so it never discriminates on its own.
  // Understated is the operative word: modest size, and not a precious metal that shouts.
  { id: 'h01', category: 'occasion', query: 'something understated I can wear to the office every day',
    truth: { styleAny: ['dress'], diameterMax: 39, materialNone: ['rose gold', 'yellow gold', 'pink gold'] } },
  { id: 'h02', category: 'occasion', query: 'a dress watch with some complication, works with a suit',
    truth: { styleAny: ['dress'], functionsAny: ['moon phase', 'perpetual calendar', 'chronograph'] } },
  // A groom is photographed all day with the watch under a cuff: classic size, precious case, and
  // leather because a wedding is formal dress. Without the strap the label matched 26% of the
  // catalogue; the formal reading is the one the brief supports, not a loosening of it.
  { id: 'h47', category: 'occasion', query: 'what should I wear to my own wedding',
    truth: { styleAny: ['dress'], materialAny: ['gold', 'platin'], diameterMax: 40,
             strapAny: ['leather', 'alligator', 'calf', 'crocodile'] } },
  // Not flashy rules out precious metal altogether, which is what an interviewer notices first,
  // and any showpiece complication. Excluding only warm gold matched 25.1% of the catalogue.
  { id: 'h48', category: 'occasion', query: "a watch for a job interview that won't look flashy",
    truth: { styleAny: ['dress'], diameterMax: 40, materialNone: ['gold', 'platin'],
             functionsNone: ['tourbillon'] } },
  // Black tie is the most conservative dress code there is: small, precious, no stopwatch pushers.
  { id: 'h49', category: 'occasion', query: 'something for a black tie gala',
    truth: { styleAny: ['dress'], materialAny: ['gold', 'platin'], diameterMax: 39, functionsNone: ['chronograph'] } },
  // A beach means salt water and sunscreen, so the strap matters as much as the depth rating.
  { id: 'h50', category: 'occasion', query: 'something to wear on a beach holiday',
    truth: { waterResistanceMin: 100, strapAny: ['rubber', 'bracelet', 'oyster', 'synthetic'] } },
  // Monthly long-haul travel is the textbook case for a second time zone.
  { id: 'h51', category: 'occasion', query: 'I fly between Sydney and London every month',
    truth: { functionsAny: ['second time zone', 'world time', 'dual time', 'gmt', 'home time'] } },
  // Put together but relaxed: a steel or titanium sports watch at a size that is not a statement.
  { id: 'h52', category: 'occasion', query: 'relaxed weekend brunch but still looking put together',
    truth: { styleAny: ['sport'], materialAny: ['steel', 'titan'], diameterMax: 42 } },
  // Signalling success in a boardroom: a precious dress case with a complication people notice.
  { id: 'h53', category: 'occasion', query: 'something for board meetings that says I have made it',
    truth: { styleAny: ['dress'], materialAny: ['gold', 'platin'],
             functionsAny: ['perpetual', 'moon', 'power-reserve', 'chronograph'] } },

  // Persona and gifting.
  // A first serious purchase sits at the entry of the catalogue and is mechanical, not quartz.
  { id: 'h03', category: 'persona', query: 'first serious watch for someone starting a collection',
    truth: { priceMax: 20000, movementAny: ['automatic'] } },
  // "Around" five thousand is read as a band either side, not as a ceiling.
  { id: 'h54', category: 'persona', query: 'a graduation gift for my son, around five thousand',
    truth: { priceMin: 2500, priceMax: 8000 } },
  // A slim wrist sets the size; an anniversary sets the metal.
  { id: 'h55', category: 'persona', query: 'an anniversary present for my wife, she has a slim wrist',
    truth: { diameterMax: 36, materialAny: ['gold', 'platin'] } },
  // Classic, for that generation, means a warm gold dress watch on leather.
  { id: 'h56', category: 'persona', query: 'a retirement gift for my dad, he likes classic things',
    truth: { styleAny: ['dress'], materialAny: ['yellow gold', 'rose gold', 'pink gold'],
             strapAny: ['leather', 'alligator', 'calf', 'crocodile'] } },
  // A first promotion widens the budget without jumping to haute horlogerie.
  { id: 'h57', category: 'persona', query: 'something for a young professional who just got promoted',
    truth: { priceMin: 5000, priceMax: 25000 } },
  // Constant hand washing rules out leather and needs real water resistance, at a size that stays
  // out of the way.
  { id: 'h59', category: 'persona', query: 'my husband is a surgeon and washes his hands all day',
    truth: { waterResistanceMin: 100, strapAny: ['rubber', 'bracelet', 'oyster', 'synthetic'], diameterMax: 41 } },
  // Low fuss: self-winding, water resistant enough to forget about, in a hard-wearing case.
  { id: 'h60', category: 'persona', query: 'I just want a reliable everyday watch with no fuss',
    truth: { movementAny: ['automatic'], waterResistanceMin: 100, materialAny: ['steel', 'titan'] } },

  // Aesthetic.
  { id: 'h07', category: 'aesthetic', query: 'a bold statement piece with real wrist presence',
    truth: { diameterMin: 44 } },
  // "Warm" excludes white gold and platinum, which read as cold despite being precious metals.
  { id: 'h08', category: 'aesthetic', query: 'something warm looking on a leather strap, not cold steel',
    truth: { materialAny: ['rose gold', 'pink gold', 'yellow gold'], strapAny: ['leather', 'alligator', 'calf'] } },
  // Time-only means time only: a subsidiary seconds register or a power-reserve hand
  // already breaks the brief, so they are excluded alongside the obvious complications.
  { id: 'h15', category: 'aesthetic', query: 'a clean dress dial with nothing on it but the hands',
    truth: { styleAny: ['dress'],
             functionsNone: ['chronograph', 'moon', 'perpetual', 'calendar', 'date', 'seconds', 'power-reserve'] } },
  { id: 'h18', category: 'aesthetic', query: 'silver or white dial, very traditional',
    truth: { dialAny: ['silver', 'white'], styleAny: ['dress'], diameterMax: 40 } },
  // Minimalist means few indications and a modest case.
  { id: 'h61', category: 'aesthetic', query: 'minimalist and clean, nothing fussy on the dial',
    truth: { diameterMax: 40,
             functionsNone: ['chronograph', 'moon', 'perpetual', 'calendar', 'tourbillon', 'power-reserve', 'date'] } },
  // Refined enough for dinner turns a sports watch precious.
  { id: 'h62', category: 'aesthetic', query: 'sporty but refined enough for a nice dinner',
    truth: { styleAny: ['sport'], materialAny: ['gold', 'platin'] } },
  // Stealth wealth is a precious metal that reads as steel from across the table.
  { id: 'h63', category: 'aesthetic', query: 'stealth wealth, luxury only people in the know would spot',
    truth: { styleAny: ['dress'], materialAny: ['white gold', 'platin'] } },
  // Jewellery-like: an artistic piece in a precious case at a delicate size.
  { id: 'h64', category: 'aesthetic', query: 'something that looks like a piece of jewellery',
    truth: { styleAny: ['art'], materialAny: ['gold', 'platin'], diameterMax: 38 } },
  // Colourful excludes the blue, black, silver and white that make up most of the catalogue.
  { id: 'h65', category: 'aesthetic', query: 'a watch with a really colourful dial',
    truth: { dialAny: ['green', 'red', 'salmon', 'enamel', 'turquoise', 'purple', 'aventurine', 'meteorite'] } },

  // Lifestyle.
  // Outdoors needs a hard case, a sports build and water resistance for rain and rivers.
  { id: 'h66', category: 'lifestyle', query: 'something tough for hiking and camping',
    truth: { styleAny: ['sport', 'diver'], materialAny: ['titan', 'steel', 'ceramic'], waterResistanceMin: 100 } },
  // Race starts run on a countdown, so a chronograph, and it gets wet.
  { id: 'h67', category: 'lifestyle', query: 'I race sailboats on weekends',
    truth: { functionsAny: ['chronograph'], waterResistanceMin: 100 } },
  // A golf swing punishes weight, so light case materials.
  { id: 'h68', category: 'lifestyle', query: 'something light I can play golf in',
    truth: { materialAny: ['titan', 'ceramic', 'carbon'] } },
  // Daily gym sessions mean sweat: a rubber or synthetic strap with some water resistance.
  { id: 'h69', category: 'lifestyle', query: 'I go to the gym every morning before work',
    truth: { strapAny: ['rubber', 'synthetic'], waterResistanceMin: 50 } },
  // Knocks are what ceramic and titanium sports cases are for.
  { id: 'h70', category: 'lifestyle', query: 'I work with my hands and knock my watch a lot',
    truth: { materialAny: ['ceramic', 'titan'], styleAny: ['sport', 'diver'] } },
  // Running and swimming need a sports strap and real water resistance.
  { id: 'h71', category: 'lifestyle', query: 'a watch I can wear running and swimming',
    truth: { waterResistanceMin: 100, strapAny: ['rubber', 'synthetic'] } },

  // Collector and horology.
  // An heirloom is a precious case with a complication that keeps meaning something for decades.
  { id: 'h72', category: 'collector', query: 'an heirloom to pass down to my grandchildren',
    truth: { materialAny: ['gold', 'platin'], functionsAny: ['perpetual calendar', 'moon'] } },
  // Showpieces are defined by their complications. Most are Price on Request here, so a price
  // floor would drop the very watches the brief means.
  { id: 'h73', category: 'collector', query: 'a true haute horlogerie showpiece',
    truth: { functionsAny: ['tourbillon', 'minute repeater', 'grande sonnerie', 'split-seconds', 'rattrapante'] } },
  // The two independents in this catalogue, as opposed to the large maisons.
  { id: 'h74', category: 'collector', query: 'something from an independent watchmaker',
    truth: { brandIn: ['F.P.Journe', 'Greubel Forsey'] } },
  { id: 'h75', category: 'collector', query: 'the best of German watchmaking',
    truth: { brandIn: ['A. Lange & Söhne', 'Glashütte Original'] } },
  { id: 'h76', category: 'collector', query: 'Japanese craftsmanship',
    truth: { brand: 'Grand Seiko' } },
  // Artistic decoration shows on the dial: enamel, engraving, guilloche, openwork.
  { id: 'h77', category: 'collector', query: 'a watch with hand-finished artistic decoration',
    truth: { styleAny: ['art'], dialAny: ['enamel', 'engrav', 'guilloch', 'openwork', 'lacquer'] } },
  // Value retention is concentrated in the steel sports icons of three houses.
  { id: 'h78', category: 'collector', query: 'something likely to hold its value',
    truth: { brandIn: ['Patek Philippe', 'Rolex', 'Audemars Piguet'], styleAny: ['sport'], materialAny: ['steel'] } },
  // The most complicated pieces pair a perpetual calendar with a second major complication.
  { id: 'h79', category: 'collector', query: 'the most complicated watch you have',
    truth: { functionsAll: ['perpetual calendar'], functionsAny: ['chronograph', 'tourbillon', 'minute repeater'] } },
  // An unusual display replaces the three hands: jumping, retrograde, digital or regulator.
  { id: 'h58', category: 'collector', query: 'an unusual way of showing the time',
    truth: { functionsAny: ['jumping', 'retrograde', 'digital', 'regulator'] } },

  // Fit and suitability.
  // A 15cm wrist wears a case up to about 37mm without overhang.
  { id: 'h80', category: 'fit', query: 'my wrist is only about 15cm around',
    truth: { diameterMax: 37 } },
  // Large wrists need 43mm and up before a watch stops looking small.
  { id: 'h81', category: 'fit', query: 'I have big wrists and most watches look tiny on me',
    truth: { diameterMin: 43 } },
  // Slipping under a cuff needs a dress case at modest size without chronograph pushers.
  { id: 'h82', category: 'fit', query: 'it has to slip under a shirt cuff',
    truth: { styleAny: ['dress'], diameterMax: 39, functionsNone: ['chronograph'] } },
  // Scratch resistance is what ceramic cases are chosen for.
  { id: 'h83', category: 'fit', query: 'something that will not scratch easily',
    truth: { materialAny: ['ceramic'] } },
  // Designed for a woman rather than scaled down: small, and dress or artistic.
  { id: 'h84', category: 'fit', query: "a watch designed for a woman, not a shrunk-down men's watch",
    truth: { diameterMax: 36, styleAny: ['art', 'dress'] } },

  // Budget with a vibe: the judgement is in the style, the number is stated.
  { id: 'h87', category: 'budget_vibe', query: 'something elegant under fifteen thousand',
    truth: { styleAny: ['dress'], priceMin: 1, priceMax: 15000 } },
  { id: 'h88', category: 'budget_vibe', query: 'a luxurious sports watch around fifty grand',
    truth: { styleAny: ['sport'], priceMin: 35000, priceMax: 70000 } },
  { id: 'h89', category: 'budget_vibe', query: 'my first step into haute horlogerie, under a hundred thousand',
    truth: { styleAny: ['dress', 'art'], priceMin: 30000, priceMax: 100000 } },
  // The cheapest proper diver is the bottom of the diver range, well below the catalogue median.
  { id: 'h90', category: 'budget_vibe', query: 'the cheapest proper dive watch you have',
    truth: { styleAny: ['diver'], priceMin: 1, priceMax: 15000 } },
  // "Not a sports watch" is stated as what remains: dress or artistic.
  { id: 'h91', category: 'budget_vibe', query: 'something special for about thirty thousand, not a sports watch',
    truth: { styleAny: ['dress', 'art'], priceMin: 20000, priceMax: 40000 } },
];

// -- Generated set ------------------------------------------------------------

/// How many of each generated facet query to draw. The generated half is exact by construction but
/// repetitive, so it is capped to leave room for handwritten wording. Caps take prefixes of the
/// same seeded shuffles, so a smaller cap yields a subset of a larger one and old runs stay
/// comparable by query id. Size bands are fixed rather than sampled, so they are not capped.
export const GENERATED_CAPS = Object.freeze({
  reference: 3, brand: 1, brand_budget: 2, material: 2, dial: 1, complication: 1,
});

/// Derives mechanical facet queries from the catalogue itself. Each generator states its own
/// truth spec, so labelling is exact by construction and no query can drift out of date.
/// The seeded PRNG makes the sample identical on every run, which is what lets two runs be compared.
export function buildGenerated(catalogue, { seed = 1234, caps = GENERATED_CAPS } = {}) {
  const rand = mulberry32(seed);
  const queries = [];
  const pick = (arr, n) => shuffle(arr, rand).slice(0, n);

  // Exact reference lookup. One correct answer, so this measures precision at rank 1
  // rather than recall - the search should never bury an exact match.
  const withRefs = catalogue.records.filter(r => /\d/.test(r.name) && r.name.length >= 4);
  for (const w of pick(withRefs, caps.reference)) {
    queries.push({
      id: `g-ref-${w.id}`, category: 'reference', query: w.name,
      truth: { ids: [w.id] },
    });
  }

  // Brand browsing. The semantic router is supposed to send these down the SQL path,
  // so this group doubles as the check that the cheap path is being taken.
  const brandCounts = countBy(catalogue.records, r => r.brandName);
  const brands = [...brandCounts.entries()].filter(([, n]) => n >= 5).map(([b]) => b);
  for (const brand of pick(brands, caps.brand)) {
    queries.push({
      id: `g-brand-${slugish(brand)}`, category: 'brand', query: `show me ${brand} watches`,
      truth: { brand },
    });
  }

  // Brand plus budget. Hard filters, so the semantic cache must be bypassed here.
  // Brands with too few priced watches are skipped, so the cap counts emitted queries rather than
  // candidates; walking the whole shuffle keeps the emitted ones a prefix of the old sample.
  let budgetEmitted = 0;
  for (const brand of pick(brands, brands.length)) {
    if (budgetEmitted >= caps.brand_budget) break;
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
    budgetEmitted += 1;
  }

  // Case material.
  const materials = [...countBy(catalogue.records, r => normaliseMaterial(r.caseMaterial)).entries()]
    .filter(([m, n]) => n >= 8 && m !== '(unknown)' && m !== 'gold (other)').map(([m]) => m);
  for (const material of pick(materials, caps.material)) {
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
  for (const dial of pick(dials, caps.dial)) {
    queries.push({
      id: `g-dial-${slugish(dial)}`, category: 'dial', query: `${dial} dial`,
      truth: { dialAny: [dial] },
    });
  }

  // Complications.
  let complicationsEmitted = 0;
  for (const fn of ['chronograph', 'moon phase', 'perpetual calendar', 'gmt', 'tourbillon']) {
    if (complicationsEmitted >= caps.complication) break;
    const truth = { functionsAny: [fn.split(' ')[0]] };
    if (relevantIds(catalogue, truth).size >= 3) {
      complicationsEmitted += 1;
      queries.push({ id: `g-fn-${slugish(fn)}`, category: 'complication', query: `${fn} watches`, truth });
    }
  }

  return queries.filter(q => q.truth != null);
}

// -- Scope --------------------------------------------------------------------
// Which subsystem owns a category now that Smart Search is deterministic-only and the concierge
// answers open-ended briefs. Scoring both on one mixed set charges each arm for queries it no
// longer claims to serve, which reads as a regression rather than as a scope change.

export const SCOPE_BY_CATEGORY = Object.freeze({
  // Reduces to facets, even when the wording hides it, so a parser can compile it to SQL.
  reference: 'spec', brand: 'spec', brand_alias: 'spec', collection: 'spec', brand_budget: 'spec',
  budget: 'spec', material: 'spec', size: 'spec', dial: 'spec', complication: 'spec',
  water_resistance: 'spec', movement: 'spec', style: 'spec', exclusion: 'spec', compound: 'spec',
  // Names no facet: occasion, person, taste, lifestyle, collecting, fit, or a vibe with a budget.
  occasion: 'semantic', persona: 'semantic', aesthetic: 'semantic', lifestyle: 'semantic',
  collector: 'semantic', fit: 'semantic', budget_vibe: 'semantic',
});

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
    const badKeys = unknownTruthKeys(q.truth);
    let status = 'ok';
    // Checked first: an unknown key is silently unconstrained, so the label is wider than
    // written and every other status computed from it would be measuring the typo.
    if (badKeys.length > 0) status = 'invalid_key';
    else if (relevant.size === 0) status = 'empty';
    else if (share > maxShare) status = 'too_broad';
    else if (relevant.size < 2 && q.category !== 'reference') status = 'thin';
    return { ...q, relevant, relevantCount: relevant.size, share, status, badKeys };
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
