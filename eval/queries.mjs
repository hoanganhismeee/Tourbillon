// The golden set: queries paired with a declarative description of what a correct answer is.
// Two sources feed it. HANDWRITTEN covers the semantic phrasings where relevance is a judgement
// call and has to be stated by hand. buildGenerated derives the mechanical facet queries straight
// from the live catalogue, so the set scales with the data instead of going stale against it.

import { mulberry32 } from './metrics.mjs';
import {
  normaliseMaterial, relevantIds, unknownTruthKeys,
  gradesFor, relevantIdsForTier, unknownLabelKeys,
} from './catalogue.mjs';

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
  //
  // Graded labels. `must` holds only what the brief states — a budget, a named brand, an explicit
  // exclusion — and breaking it is a violation, counted on its own line. `rubric` holds the reading
  // of the brief: grade 3 is what a knowledgeable salesperson brings out first, 2 fits with a
  // trade-off, 1 is defensible, anything else is 0. The `why` is the sentence the rubric is argued
  // from, and it is what a blind judge is shown.

  // Occasion.
  { id: 'h01', category: 'occasion', query: 'something understated I can wear to the office every day',
    must: {},
    rubric: [
      { grade: 3, when: { styleAny: ['dress'], diameterMax: 40, materialNone: ['gold', 'platin'] },
        why: 'a dress watch that stays quiet: modest case, no precious metal on show' },
      { grade: 2, when: { styleAny: ['dress'], diameterMax: 42 },
        why: 'reads dress at a desk, but larger or more precious than ideal' },
      { grade: 1, when: { diameterMax: 42 },
        why: 'discreet enough to wear to work even if it is not a dress watch' },
    ] },

  { id: 'h02', category: 'occasion', query: 'a dress watch with some complication, works with a suit',
    must: { styleAny: ['dress'] },
    rubric: [
      { grade: 3, when: { functionsAny: ['moon phase', 'perpetual calendar', 'annual calendar', 'chronograph'], diameterMax: 41 },
        why: 'a real complication in a case that still fits under a cuff' },
      { grade: 2, when: { functionsAny: ['moon', 'calendar', 'chronograph', 'power-reserve', 'second time zone', 'gmt'] },
        why: 'has a complication, size or type less suited to a suit' },
      { grade: 1, when: {}, why: 'a plain dress watch: right register, missing the complication asked for' },
    ] },

  { id: 'h47', category: 'occasion', query: 'what should I wear to my own wedding',
    must: {},
    rubric: [
      { grade: 3, when: { styleAny: ['dress'], materialAny: ['gold', 'platin'], diameterMax: 40,
                          strapAny: ['leather', 'alligator', 'calf', 'crocodile'] },
        why: 'formal dress code, photographed all day: precious case, classic size, leather' },
      { grade: 2, when: { styleAny: ['dress'], diameterMax: 41 },
        why: 'a dress watch that suits the day without the formal metal or strap' },
      { grade: 1, when: { styleAny: ['dress', 'art'] },
        why: 'dressy enough to defend, even if it is not what a groom would choose' },
    ] },

  { id: 'h48', category: 'occasion', query: "a watch for a job interview that won't look flashy",
    must: {},
    rubric: [
      { grade: 3, when: { styleAny: ['dress'], diameterMax: 40, materialNone: ['gold', 'platin'],
                          functionsNone: ['tourbillon', 'minute repeater'] },
        why: 'nothing an interviewer would notice: steel-toned, modest, no showpiece complication' },
      { grade: 2, when: { styleAny: ['dress'], materialNone: ['gold', 'platin'] },
        why: 'quiet metal and register, larger or busier than ideal' },
      { grade: 1, when: { styleAny: ['dress'] }, why: 'a dress watch, though it may read as expensive' },
    ] },

  { id: 'h49', category: 'occasion', query: 'something for a black tie gala',
    must: {},
    rubric: [
      { grade: 3, when: { styleAny: ['dress'], materialAny: ['gold', 'platin'], diameterMax: 39,
                          functionsNone: ['chronograph'] },
        why: 'the most formal dress code there is: precious, slim, no stopwatch pushers' },
      { grade: 2, when: { styleAny: ['dress'] },
        why: 'a dress watch, in a metal or size that is not the formal choice' },
      { grade: 1, whenAny: [{ functionsNone: ['chronograph'], diameterMax: 42 },
                            { materialAny: ['gold', 'platin'], functionsNone: ['chronograph'] }],
        why: 'quiet enough to pass under a dinner jacket, or precious enough to carry the room' },
    ] },

  { id: 'h50', category: 'occasion', query: 'something to wear on a beach holiday',
    must: {},
    rubric: [
      { grade: 3, when: { waterResistanceMin: 100, strapAny: ['rubber', 'synthetic', 'bracelet', 'oyster'],
                          materialAny: ['steel', 'titan', 'ceramic'] },
        why: 'salt water and sunscreen: a hard case on a strap that can be rinsed' },
      { grade: 2, when: { waterResistanceMin: 100 }, why: 'takes the water, strap or case less suited to it' },
      { grade: 1, when: { waterResistanceMin: 50 }, why: 'survives a splash but not a swim' },
    ] },

  { id: 'h51', category: 'occasion', query: 'I fly between Sydney and London every month',
    must: {},
    rubric: [
      { grade: 3, when: { functionsAny: ['second time zone', 'world time', 'dual time', 'gmt', 'home time'] },
        why: 'monthly long-haul is the textbook case for reading a second time zone' },
      { grade: 2, whenAny: [{ functionsAny: ['date', 'annual calendar'], movementAny: ['automatic'], waterResistanceMin: 50 },
                            { styleAny: ['sport'], movementAny: ['automatic'] }],
        why: 'a robust everyday automatic that travels well without the complication' },
      { grade: 1, when: { movementAny: ['automatic'] }, why: 'wearable on the road, nothing about travel in it' },
    ] },

  { id: 'h52', category: 'occasion', query: 'relaxed weekend brunch but still looking put together',
    must: {},
    rubric: [
      { grade: 3, when: { styleAny: ['sport'], materialAny: ['steel', 'titan'], diameterMax: 42 },
        why: 'a steel sports watch at a size that is not a statement' },
      { grade: 2, whenAny: [{ styleAny: ['sport'] }, { styleAny: ['dress'], diameterMax: 42 }],
        why: 'either register works for brunch; this one leans one way or the other' },
      { grade: 1, when: { diameterMax: 44 }, why: 'wearable off duty without looking wrong' },
    ] },

  { id: 'h53', category: 'occasion', query: 'something for board meetings that says I have made it',
    must: {},
    rubric: [
      { grade: 3, when: { styleAny: ['dress'], materialAny: ['gold', 'platin'],
                          functionsAny: ['perpetual', 'moon', 'power-reserve', 'chronograph'] },
        why: 'precious case with a complication that the room reads as achievement' },
      { grade: 2, whenAny: [{ styleAny: ['dress'], materialAny: ['gold', 'platin'] },
                            { styleAny: ['dress'], functionsAny: ['perpetual', 'moon', 'tourbillon'] }],
        why: 'says it through the metal or the movement, not both' },
      { grade: 1, when: { styleAny: ['dress', 'art'] }, why: 'boardroom register without the signal' },
    ] },

  // Persona and gifting.
  { id: 'h03', category: 'persona', query: 'first serious watch for someone starting a collection',
    must: {},
    rubric: [
      { grade: 3, when: { priceMax: 15000, movementAny: ['automatic'] },
        why: 'entry of the catalogue and mechanical, which is what makes it the first serious one' },
      { grade: 2, when: { priceMax: 25000, movementAny: ['automatic'] },
        why: 'mechanical, priced above where most people start' },
      { grade: 1, when: { priceMax: 35000 }, why: 'a defensible first purchase at a stretch' },
    ] },

  { id: 'h54', category: 'persona', query: 'a graduation gift for my son, around five thousand',
    must: { priceMax: 10000 },
    rubric: [
      { grade: 3, when: { priceMin: 3900, priceMax: 6500 }, why: 'around five thousand, read as the band the catalogue actually offers' },
      { grade: 2, when: { priceMin: 2500, priceMax: 8000 }, why: 'near the number without being it' },
      { grade: 1, when: {}, why: 'inside the outer bound a gift budget stretches to' },
    ] },

  { id: 'h55', category: 'persona', query: 'an anniversary present for my wife, she has a slim wrist',
    must: {},
    rubric: [
      { grade: 3, when: { diameterMax: 36, materialAny: ['gold', 'platin'] },
        why: 'sized for a slim wrist, in a metal an anniversary asks for' },
      { grade: 2, when: { diameterMax: 38 }, why: 'wears small enough, metal is not the occasion' },
      { grade: 1, when: { diameterMax: 40 }, why: 'borderline on the wrist' },
    ] },

  { id: 'h56', category: 'persona', query: 'a retirement gift for my dad, he likes classic things',
    must: {},
    rubric: [
      { grade: 3, when: { styleAny: ['dress'], materialAny: ['yellow gold', 'rose gold', 'pink gold'],
                          strapAny: ['leather', 'alligator', 'calf', 'crocodile'] },
        why: 'classic to that generation is warm gold on leather' },
      { grade: 2, when: { styleAny: ['dress'], materialAny: ['gold', 'platin'] },
        why: 'precious dress watch, strap or tone less traditional' },
      { grade: 1, when: { styleAny: ['dress'] }, why: 'classic register in a plainer metal' },
    ] },

  { id: 'h57', category: 'persona', query: 'something for a young professional who just got promoted',
    must: {},
    rubric: [
      { grade: 3, when: { priceMin: 5000, priceMax: 25000 }, why: 'a first promotion widens the budget without haute horlogerie' },
      { grade: 2, when: { priceMin: 3000, priceMax: 40000 }, why: 'plausible for the occasion, above or below the band' },
      { grade: 1, when: { priceMax: 60000 }, why: 'a stretch, but not absurd for the milestone' },
    ] },

  { id: 'h59', category: 'persona', query: 'my husband is a surgeon and washes his hands all day',
    must: {},
    rubric: [
      { grade: 3, when: { waterResistanceMin: 100, strapAny: ['rubber', 'synthetic', 'bracelet', 'oyster'], diameterMax: 41 },
        why: 'constant water rules out leather; a modest case stays out of the way' },
      { grade: 2, when: { waterResistanceMin: 100 }, why: 'handles the water, strap or size less suited' },
      { grade: 1, when: { waterResistanceMin: 50 }, why: 'survives hand washing, not a habit of it' },
    ] },

  { id: 'h60', category: 'persona', query: 'I just want a reliable everyday watch with no fuss',
    must: {},
    rubric: [
      { grade: 3, when: { movementAny: ['automatic'], waterResistanceMin: 100, materialAny: ['steel', 'titan'] },
        why: 'self-winding, water resistant enough to forget about, in a hard-wearing case' },
      { grade: 2, when: { movementAny: ['automatic'], waterResistanceMin: 50 }, why: 'low fuss, less robust' },
      { grade: 1, when: { movementAny: ['automatic'] }, why: 'no winding to remember, nothing else about it is everyday' },
    ] },

  // Aesthetic.
  { id: 'h07', category: 'aesthetic', query: 'a bold statement piece with real wrist presence',
    must: {},
    rubric: [
      { grade: 3, when: { diameterMin: 44 }, why: 'presence is size first' },
      { grade: 2, when: { diameterMin: 42 }, why: 'large, short of a statement' },
      { grade: 1, whenAny: [{ diameterMin: 40 }, { functionsAny: ['tourbillon', 'minute repeater'] }],
        why: 'makes itself noticed through the movement rather than the case' },
    ] },

  { id: 'h08', category: 'aesthetic', query: 'something warm looking on a leather strap, not cold steel',
    must: { materialNone: ['steel'], strapAny: ['leather', 'alligator', 'calf', 'crocodile'] },
    rubric: [
      { grade: 3, when: { materialAny: ['rose gold', 'pink gold', 'yellow gold'] }, why: 'warm metal, as asked' },
      { grade: 2, when: { materialAny: ['gold', 'platin', 'bronze'] }, why: 'precious but cooler in tone' },
      { grade: 1, when: {}, why: 'on leather and not steel, which is what was ruled out' },
    ] },

  { id: 'h15', category: 'aesthetic', query: 'a clean dress dial with nothing on it but the hands',
    must: { styleAny: ['dress'] },
    rubric: [
      { grade: 3, when: { functionsNone: ['chronograph', 'moon', 'perpetual', 'calendar', 'date', 'seconds', 'power-reserve'] },
        why: 'time only: even a seconds register breaks the brief' },
      { grade: 2, when: { functionsNone: ['chronograph', 'moon', 'perpetual', 'calendar', 'power-reserve'] },
        why: 'close to bare, keeps a small seconds or a date' },
      { grade: 1, when: {}, why: 'a dress dial, busier than asked' },
    ] },

  { id: 'h18', category: 'aesthetic', query: 'silver or white dial, very traditional',
    must: { dialAny: ['silver', 'white'] },
    rubric: [
      { grade: 3, when: { styleAny: ['dress'], diameterMax: 40 }, why: 'the traditional reading: a classic dress case' },
      { grade: 2, when: { styleAny: ['dress'] }, why: 'dress register, larger than traditional' },
      { grade: 1, when: {}, why: 'right dial, wrong register' },
    ] },

  { id: 'h61', category: 'aesthetic', query: 'minimalist and clean, nothing fussy on the dial',
    must: {},
    rubric: [
      { grade: 3, when: { diameterMax: 40, functionsNone: ['chronograph', 'moon', 'perpetual', 'calendar', 'tourbillon', 'power-reserve', 'date'] },
        why: 'few indications and a modest case' },
      { grade: 2, when: { diameterMax: 42, functionsNone: ['chronograph', 'moon', 'perpetual', 'tourbillon'] },
        why: 'uncluttered, keeps a date or a power reserve' },
      { grade: 1, when: { functionsNone: ['chronograph', 'tourbillon', 'minute repeater'] }, why: 'not busy, not minimal either' },
    ] },

  { id: 'h62', category: 'aesthetic', query: 'sporty but refined enough for a nice dinner',
    must: {},
    rubric: [
      { grade: 3, when: { styleAny: ['sport'], materialAny: ['gold', 'platin'] }, why: 'a sports watch turned precious is the whole brief' },
      { grade: 2, when: { styleAny: ['sport'], diameterMax: 42 }, why: 'sporty and restrained, in steel' },
      { grade: 1, when: { styleAny: ['sport'] }, why: 'sporty, refinement not obvious' },
    ] },

  { id: 'h63', category: 'aesthetic', query: 'stealth wealth, luxury only people in the know would spot',
    must: {},
    rubric: [
      { grade: 3, when: { styleAny: ['dress'], materialAny: ['white gold', 'platin'] },
        why: 'precious metal that reads as steel across the table' },
      { grade: 2, whenAny: [{ styleAny: ['dress'], materialAny: ['titan'] },
                            { styleAny: ['sport'], materialAny: ['platin', 'white gold'] }],
        why: 'quiet metal, register slightly off the brief' },
      { grade: 1, when: { materialNone: ['yellow gold', 'rose gold', 'pink gold'] }, why: 'at least it does not shout' },
    ] },

  { id: 'h64', category: 'aesthetic', query: 'something that looks like a piece of jewellery',
    must: {},
    rubric: [
      { grade: 3, when: { styleAny: ['art'], materialAny: ['gold', 'platin'], diameterMax: 38 },
        why: 'an artistic piece in a precious case at a delicate size' },
      { grade: 2, whenAny: [{ styleAny: ['art'] }, { materialAny: ['gold', 'platin'], diameterMax: 36 }],
        why: 'jewellery-like through the decoration or the size, not both' },
      { grade: 1, when: { materialAny: ['gold', 'platin'] }, why: 'precious, but reads as a watch' },
    ] },

  { id: 'h65', category: 'aesthetic', query: 'a watch with a really colourful dial',
    must: {},
    rubric: [
      { grade: 3, when: { dialAny: ['green', 'red', 'salmon', 'turquoise', 'purple', 'orange', 'burgundy', 'aventurine', 'meteorite', 'enamel'] },
        why: 'a colour the catalogue rarely uses, which is what "really colourful" means here' },
      { grade: 2, when: { dialAny: ['blue', 'brown', 'champagne', 'bronze', 'chocolate'] },
        why: 'coloured rather than neutral, but common' },
      { grade: 1, when: { dialAny: ['grey', 'gray', 'slate', 'anthracite', 'mother-of-pearl'] },
        why: 'a tone rather than a colour' },
    ] },

  // Lifestyle.
  { id: 'h66', category: 'lifestyle', query: 'something tough for hiking and camping',
    must: {},
    rubric: [
      { grade: 3, when: { styleAny: ['sport', 'diver'], materialAny: ['titan', 'steel', 'ceramic'], waterResistanceMin: 100 },
        why: 'a hard case, a sports build and enough water resistance for rain and rivers' },
      { grade: 2, when: { styleAny: ['sport', 'diver'], waterResistanceMin: 50 }, why: 'built for outdoors, softer on one count' },
      { grade: 1, when: { waterResistanceMin: 50 }, why: 'would survive the trip' },
    ] },

  { id: 'h67', category: 'lifestyle', query: 'I race sailboats on weekends',
    must: {},
    rubric: [
      { grade: 3, when: { functionsAny: ['chronograph'], waterResistanceMin: 100 },
        why: 'race starts run on a countdown, and it gets wet' },
      { grade: 2, whenAny: [{ functionsAny: ['chronograph'] }, { waterResistanceMin: 100, styleAny: ['sport', 'diver'] }],
        why: 'times the start or takes the water, not both' },
      { grade: 1, when: { waterResistanceMin: 50 }, why: 'survives spray, no use for the race' },
    ] },

  { id: 'h68', category: 'lifestyle', query: 'something light I can play golf in',
    must: {},
    rubric: [
      { grade: 3, when: { materialAny: ['titan', 'ceramic', 'carbon'], diameterMax: 42 },
        why: 'a golf swing punishes weight: a light case, not a large one' },
      { grade: 2, whenAny: [{ materialAny: ['titan', 'ceramic', 'carbon'] }, { diameterMax: 40, materialAny: ['steel'] }],
        why: 'light through the metal or through the size, not both' },
      { grade: 1, when: { diameterMax: 42 }, why: 'wearable on a course' },
    ] },

  { id: 'h69', category: 'lifestyle', query: 'I go to the gym every morning before work',
    must: {},
    rubric: [
      { grade: 3, when: { strapAny: ['rubber', 'synthetic'], waterResistanceMin: 50, styleAny: ['sport', 'diver'] },
        why: 'sweat every morning: a strap that wipes clean on a sports build' },
      { grade: 2, when: { waterResistanceMin: 50, styleAny: ['sport', 'diver'] }, why: 'sports build, strap less suited' },
      { grade: 1, when: { waterResistanceMin: 50 }, why: 'would survive being worn, not chosen for it' },
    ] },

  { id: 'h70', category: 'lifestyle', query: 'I work with my hands and knock my watch a lot',
    must: {},
    rubric: [
      { grade: 3, when: { materialAny: ['ceramic', 'titan'], styleAny: ['sport', 'diver'] },
        why: 'knocks are what ceramic and titanium sports cases are for' },
      { grade: 2, when: { styleAny: ['sport', 'diver'], waterResistanceMin: 100 }, why: 'built to be used, in a softer metal' },
      { grade: 1, when: { styleAny: ['sport', 'diver'] }, why: 'a sports watch, hardness unproven' },
    ] },

  { id: 'h71', category: 'lifestyle', query: 'a watch I can wear running and swimming',
    must: {},
    rubric: [
      { grade: 3, when: { waterResistanceMin: 100, strapAny: ['rubber', 'synthetic'] },
        why: 'swims and runs: a sports strap and real water resistance' },
      { grade: 2, when: { waterResistanceMin: 100 }, why: 'takes the water, strap is wrong for sweat' },
      { grade: 1, when: { waterResistanceMin: 50 }, why: 'running yes, swimming no' },
    ] },

  // Collector and horology.
  { id: 'h72', category: 'collector', query: 'an heirloom to pass down to my grandchildren',
    must: {},
    rubric: [
      { grade: 3, when: { materialAny: ['gold', 'platin'], functionsAny: ['perpetual calendar', 'moon', 'minute repeater', 'tourbillon'] },
        why: 'a precious case with a complication that keeps meaning something for decades' },
      { grade: 2, when: { materialAny: ['gold', 'platin'] }, why: 'precious and lasting, plainer movement' },
      { grade: 1, when: { functionsAny: ['perpetual', 'tourbillon', 'minute repeater', 'moon'] }, why: 'worth keeping for the movement alone' },
    ] },

  { id: 'h73', category: 'collector', query: 'a true haute horlogerie showpiece',
    must: {},
    rubric: [
      { grade: 3, when: { functionsAny: ['tourbillon', 'minute repeater', 'grande sonnerie', 'split-seconds', 'rattrapante'] },
        why: 'showpieces are defined by the complication' },
      { grade: 2, whenAny: [{ functionsAny: ['perpetual calendar', 'equation', 'constant force', 'remontoir'] }, { styleAny: ['art'] }],
        why: 'serious watchmaking, one step below the headline complications' },
      { grade: 1, when: { materialAny: ['gold', 'platin'] }, why: 'a fine watch, not a showpiece' },
    ] },

  { id: 'h74', category: 'collector', query: 'something from an independent watchmaker',
    must: {},
    rubric: [
      { grade: 3, when: { brandIn: ['F.P.Journe', 'Greubel Forsey'] }, why: 'the independents in this catalogue' },
    ] },

  { id: 'h75', category: 'collector', query: 'the best of German watchmaking',
    must: {},
    rubric: [
      { grade: 3, when: { brand: 'A. Lange & Söhne' }, why: 'the German house that defines the answer' },
      { grade: 2, when: { brand: 'Glashütte Original' }, why: 'German, from the same town, a tier below in reputation' },
    ] },

  { id: 'h76', category: 'collector', query: 'Japanese craftsmanship',
    must: {},
    rubric: [
      { grade: 3, when: { brand: 'Grand Seiko' }, why: 'the only Japanese maison in the catalogue' },
    ] },

  { id: 'h77', category: 'collector', query: 'a watch with hand-finished artistic decoration',
    must: {},
    rubric: [
      { grade: 3, when: { styleAny: ['art'], dialAny: ['enamel', 'engrav', 'guilloch', 'openwork', 'lacquer'] },
        why: 'decoration done by hand, on the dial where it shows' },
      { grade: 2, whenAny: [{ styleAny: ['art'] }, { dialAny: ['enamel', 'engrav', 'guilloch', 'openwork', 'lacquer', 'skeleton'] }],
        why: 'artistic through the collection or the dial, not both' },
      { grade: 1, when: { functionsAny: ['tourbillon', 'minute repeater'] }, why: 'finishing lives in the movement instead' },
    ] },

  { id: 'h78', category: 'collector', query: 'something likely to hold its value',
    must: {},
    rubric: [
      { grade: 3, when: { brandIn: ['Patek Philippe', 'Rolex', 'Audemars Piguet'], styleAny: ['sport'], materialAny: ['steel'] },
        why: 'value retention is concentrated in the steel sports icons of three houses' },
      { grade: 2, when: { brandIn: ['Patek Philippe', 'Rolex', 'Audemars Piguet'] }, why: 'the right houses, not the models that hold best' },
      { grade: 1, when: { brandIn: ['Vacheron Constantin', 'A. Lange & Söhne', 'F.P.Journe', 'Omega'] },
        why: 'a name that holds something, without the demand of the top three' },
    ] },

  { id: 'h79', category: 'collector', query: 'the most complicated watch you have',
    must: {},
    rubric: [
      { grade: 3, when: { functionsAll: ['perpetual calendar'], functionsAny: ['chronograph', 'tourbillon', 'minute repeater'] },
        why: 'two major complications in one movement is as far as this catalogue goes' },
      { grade: 2, when: { functionsAny: ['perpetual calendar', 'minute repeater', 'tourbillon', 'split-seconds'] },
        why: 'one major complication' },
      { grade: 1, when: { functionsAny: ['chronograph', 'moon', 'annual calendar', 'gmt', 'world time'] },
        why: 'complicated in the everyday sense' },
    ] },

  { id: 'h58', category: 'collector', query: 'an unusual way of showing the time',
    must: {},
    rubric: [
      { grade: 3, when: { functionsAny: ['jumping', 'retrograde', 'digital', 'regulator', 'wandering'] },
        why: 'the display itself is the answer: the hands are replaced or made to jump' },
      { grade: 2, whenAny: [{ styleAny: ['art'] }, { functionsAny: ['world time', 'equation', 'moon'] }],
        why: 'reads differently from a three-hander without changing how time is shown' },
      { grade: 1, when: { functionsAny: ['tourbillon', 'openwork'] }, why: 'unusual to look at, conventional to read' },
    ] },

  // Fit and suitability.
  { id: 'h80', category: 'fit', query: 'my wrist is only about 15cm around',
    must: {},
    rubric: [
      { grade: 3, when: { diameterMax: 37 }, why: 'a 15 cm wrist carries about 37 mm without overhang' },
      { grade: 2, when: { diameterMax: 39 }, why: 'wearable, filling the wrist' },
      { grade: 1, when: { diameterMax: 41 }, why: 'oversized on that wrist but not absurd' },
    ] },

  { id: 'h81', category: 'fit', query: 'I have big wrists and most watches look tiny on me',
    must: {},
    rubric: [
      { grade: 3, when: { diameterMin: 43 }, why: 'large wrists need 43 mm before a watch stops looking small' },
      { grade: 2, when: { diameterMin: 41 }, why: 'holds its own without presence' },
      { grade: 1, when: { diameterMin: 40 }, why: 'the smallest that would not disappear' },
    ] },

  { id: 'h82', category: 'fit', query: 'it has to slip under a shirt cuff',
    must: {},
    rubric: [
      { grade: 3, when: { styleAny: ['dress'], diameterMax: 39, functionsNone: ['chronograph'] },
        why: 'a slim dress case with nothing sticking out of the side' },
      { grade: 2, when: { diameterMax: 40, functionsNone: ['chronograph'] }, why: 'small enough, not built for a cuff' },
      { grade: 1, when: { diameterMax: 42 }, why: 'fits under a loose cuff' },
    ] },

  { id: 'h83', category: 'fit', query: 'something that will not scratch easily',
    must: {},
    rubric: [
      { grade: 3, when: { materialAny: ['ceramic'] }, why: 'ceramic is what scratch resistance is chosen for' },
      { grade: 2, when: { materialAny: ['titan', 'carbon', 'tantalum'] }, why: 'harder wearing than steel, softer than ceramic' },
      { grade: 1, when: { materialAny: ['steel'] }, why: 'marks, but takes it' },
    ] },

  { id: 'h84', category: 'fit', query: "a watch designed for a woman, not a shrunk-down men's watch",
    must: {},
    rubric: [
      { grade: 3, when: { diameterMax: 36, styleAny: ['art', 'dress'] },
        why: 'designed small rather than scaled down, with decoration of its own' },
      { grade: 2, when: { diameterMax: 38 }, why: 'sized for the brief, generic in design' },
      { grade: 1, when: { diameterMax: 40 }, why: 'wearable, still a unisex case' },
    ] },

  // Budget with a vibe: the number is stated, so it is a constraint; the vibe is graded.
  { id: 'h87', category: 'budget_vibe', query: 'something elegant under fifteen thousand',
    must: { priceMax: 15000 },
    rubric: [
      { grade: 3, when: { styleAny: ['dress'], diameterMax: 40 }, why: 'elegant reads as a classic dress case' },
      { grade: 2, when: { styleAny: ['dress'] }, why: 'dress register, larger than elegant' },
      { grade: 1, when: { styleAny: ['dress', 'art'] }, why: 'not sporty, which is the least the brief asks' },
    ] },

  { id: 'h88', category: 'budget_vibe', query: 'a luxurious sports watch around fifty grand',
    must: { priceMin: 25000, priceMax: 80000 },
    rubric: [
      { grade: 3, when: { styleAny: ['sport'], priceMin: 40000, priceMax: 60000 }, why: 'a sports watch at the number, in the luxury tier' },
      { grade: 2, when: { styleAny: ['sport'] }, why: 'the right kind of watch, off the number' },
      { grade: 1, when: {}, why: 'inside the band, wrong register' },
    ] },

  { id: 'h89', category: 'budget_vibe', query: 'my first step into haute horlogerie, under a hundred thousand',
    must: { priceMax: 100000 },
    rubric: [
      { grade: 3, when: { priceMin: 30000, functionsAny: ['perpetual', 'tourbillon', 'minute repeater', 'moon', 'split-seconds'] },
        why: 'a real complication at the entry of haute horlogerie' },
      { grade: 2, when: { priceMin: 20000 }, why: 'the tier, without the complication that defines it' },
      { grade: 1, when: {}, why: 'inside the budget, below the tier' },
    ] },

  { id: 'h90', category: 'budget_vibe', query: 'the cheapest proper dive watch you have',
    must: { waterResistanceMin: 100 },
    rubric: [
      { grade: 3, when: { styleAny: ['diver'], priceMax: 12000 }, why: 'a real diver at the bottom of the range' },
      { grade: 2, when: { styleAny: ['diver'] }, why: 'a proper diver, not the cheapest' },
      { grade: 1, when: { styleAny: ['sport'] }, why: 'takes the water without being built for diving' },
    ] },

  { id: 'h91', category: 'budget_vibe', query: 'something special for about thirty thousand, not a sports watch',
    must: { priceMin: 15000, priceMax: 50000, styleNone: ['sport', 'diver'] },
    rubric: [
      { grade: 3, when: { priceMin: 25000, priceMax: 35000, styleAny: ['dress', 'art'] }, why: 'at the number, and special rather than everyday' },
      { grade: 2, when: { priceMin: 20000, priceMax: 40000 }, why: 'near the number, inside what was not ruled out' },
      { grade: 1, when: {}, why: 'inside the band and not a sports watch' },
    ] },
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
  return queries.map(q => (q.rubric ? validateGraded(catalogue, q, total, maxShare)
                                    : validateBinary(catalogue, q, total, maxShare)));
}

/// Spec labels: one predicate, one relevant set, as before.
function validateBinary(catalogue, q, total, maxShare) {
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
}

/// Graded labels: the health of the label is the health of its top tier, plus two checks the
/// binary form never needed — a `must` nothing satisfies makes every answer a violation, and a
/// tier that matches fewer watches than the tier above it means the grades are the wrong way round.
function validateGraded(catalogue, q, total, maxShare) {
  const { grades, violating } = gradesFor(catalogue, q);
  const tierCounts = [...(q.rubric ?? [])]
    .sort((a, b) => b.grade - a.grade)
    .map(tier => ({ grade: tier.grade, count: relevantIdsForTier(catalogue, tier).size }));
  const ideal = new Set([...grades.entries()].filter(([, g]) => g === 3).map(([id]) => id));
  const useful = new Set([...grades.entries()].filter(([, g]) => g >= 2).map(([id]) => id));
  const share = total === 0 ? 0 : ideal.size / total;
  const badKeys = unknownLabelKeys(q);
  const mustCount = total - violating.size;

  let status = 'ok';
  if (badKeys.length > 0) status = 'invalid_key';
  else if (mustCount === 0) status = 'must_empty';
  else if (ideal.size === 0) status = 'empty';
  else if (share > maxShare) status = 'too_broad';
  else if (ideal.size < 2) status = 'thin';
  else if (tierCounts.some(tier => tier.count === 0)) status = 'tier_dead';

  // `relevant` stays populated so everything that still thinks in sets — action scoring, the
  // per-category recall table — keeps working; grade 2 is the "would actually consider it" line.
  return {
    ...q, relevant: useful, ideal, relevantCount: ideal.size, grades, violating, tierCounts,
    mustCount, share, status, badKeys,
  };
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
