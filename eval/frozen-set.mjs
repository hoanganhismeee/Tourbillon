// The frozen test set: 36 open-ended briefs that are never used to tune anything.
//
// The 100 queries in queries.mjs decided the reranker, the prompt, the chip rules and the BM25F
// weights. After that many rounds they measure fit to themselves as much as retrieval quality, which
// is what a development set is. This file is the other half of that split.
//
// The rules, and they are the whole point:
//   - run it to report a number, never to decide a change;
//   - do not read the per-query results while changing the system;
//   - do not edit a brief or a label to make a score move. A label is edited only when it is wrong
//     on its own terms, and then every arm is re-run and the change is noted in docs/eval-results.md.
//
// Wording is deliberately closer to how someone types into a chat box than the dev set is: shorter,
// with the constraint buried in a sentence about their life. Labels use the same graded schema —
// `must` for what the brief states, tiers for the reading of it.

export const FROZEN = [
  // -- Occasion ---------------------------------------------------------------
  { id: 'f01', category: 'occasion', query: "meeting my girlfriend's parents for the first time",
    must: {},
    rubric: [
      { grade: 3, when: { styleAny: ['dress'], diameterMax: 40, materialNone: ['gold', 'platin'] },
        why: 'polite and unshowy: a modest dress watch that does not announce money' },
      { grade: 2, when: { styleAny: ['dress'] }, why: 'right register, louder metal or larger case' },
      { grade: 1, when: { diameterMax: 42 }, why: 'inoffensive enough for the afternoon' },
    ] },

  { id: 'f02', category: 'occasion', query: "I'm best man at a beach wedding in Fiji",
    must: {},
    rubric: [
      { grade: 3, when: { styleAny: ['dress'], diameterMax: 41, waterResistanceMin: 50 },
        why: 'formal enough for the party, able to survive sand and humidity' },
      { grade: 2, when: { styleAny: ['dress'] }, why: 'dressed for the day, not for the beach' },
      { grade: 1, when: { waterResistanceMin: 100 }, why: 'survives the setting, misses the occasion' },
    ] },

  { id: 'f03', category: 'occasion', query: 'dinner at a Michelin place, I want something quietly impressive',
    must: {},
    rubric: [
      { grade: 3, when: { styleAny: ['dress'], materialAny: ['white gold', 'platin'], diameterMax: 40 },
        why: 'quiet and expensive at once, which is what precious metal in a plain case does' },
      { grade: 2, when: { styleAny: ['dress'], materialAny: ['gold', 'platin'] }, why: 'impressive, less quiet' },
      { grade: 1, when: { styleAny: ['dress'] }, why: 'correct for the table without the weight' },
    ] },

  { id: 'f04', category: 'occasion', query: 'client presentations all week, nothing that distracts',
    must: {},
    rubric: [
      { grade: 3, when: { styleAny: ['dress'], diameterMax: 40, materialNone: ['gold', 'platin'],
                          functionsNone: ['chronograph', 'tourbillon'] },
        why: 'nothing on the wrist for a client to look at instead of the slides' },
      { grade: 2, when: { styleAny: ['dress'], materialNone: ['gold', 'platin'] }, why: 'quiet metal, busier face' },
      { grade: 1, when: { styleAny: ['dress'] }, why: 'business register, more presence than asked for' },
    ] },

  { id: 'f05', category: 'occasion', query: 'my 40th birthday, I want to mark it with something',
    must: {},
    rubric: [
      { grade: 3, when: { materialAny: ['gold', 'platin'], functionsAny: ['perpetual calendar', 'moon phase', 'tourbillon'] },
        why: 'a milestone piece: precious, and with a movement worth explaining' },
      { grade: 2, when: { materialAny: ['gold', 'platin'] }, why: 'precious enough to mark the date' },
      { grade: 1, when: { functionsAny: ['moon phase', 'perpetual calendar', 'chronograph', 'tourbillon'] },
        why: 'memorable through the movement rather than the metal' },
    ] },

  { id: 'f06', category: 'occasion', query: 'weekend away in the mountains, cold and wet',
    must: {},
    rubric: [
      { grade: 3, when: { styleAny: ['sport', 'diver'], materialAny: ['steel', 'titan', 'ceramic'], waterResistanceMin: 100 },
        why: 'rain, rock and cold: a hard case with real water resistance' },
      { grade: 2, when: { styleAny: ['sport', 'diver'], waterResistanceMin: 50 }, why: 'built for outdoors, softer on one count' },
      { grade: 1, when: { waterResistanceMin: 100 }, why: 'would survive the weekend' },
    ] },

  // -- Persona ----------------------------------------------------------------
  { id: 'f07', category: 'persona', query: 'a present for my mother, who has never worn a watch',
    must: {},
    rubric: [
      { grade: 3, when: { diameterMax: 36, styleAny: ['dress', 'art'] },
        why: 'a first watch should wear small and look like an object, not equipment' },
      { grade: 2, when: { diameterMax: 38 }, why: 'wears small, plainer in design' },
      { grade: 1, when: { diameterMax: 40 }, why: 'wearable, larger than a first watch should be' },
    ] },

  { id: 'f08', category: 'persona', query: 'my brother just qualified as a doctor, budget about ten thousand',
    must: { priceMax: 15000 },
    rubric: [
      { grade: 3, when: { priceMin: 7000, priceMax: 12000 }, why: 'at the number he named' },
      { grade: 2, when: { priceMin: 4000, priceMax: 15000 }, why: 'inside the budget, off the number' },
      { grade: 1, when: {}, why: 'affordable within the outer bound' },
    ] },

  { id: 'f09', category: 'persona', query: 'something for my husband, who will only ever own one watch',
    must: {},
    rubric: [
      { grade: 3, when: { movementAny: ['automatic'], waterResistanceMin: 100, materialAny: ['steel', 'titan'] },
        why: 'the only watch has to take everything: mechanical, sealed, hard-wearing' },
      { grade: 2, when: { movementAny: ['automatic'], waterResistanceMin: 50 }, why: 'covers most of a life, less robust' },
      { grade: 1, when: { movementAny: ['automatic'] }, why: 'mechanical, narrower in use' },
    ] },

  { id: 'f10', category: 'persona', query: 'a gift for a friend who collects nothing but cares about design',
    must: {},
    rubric: [
      { grade: 3, when: { styleAny: ['art'], diameterMax: 41 }, why: 'bought as an object, not as a collection piece' },
      { grade: 2, when: { styleAny: ['art', 'dress'], diameterMax: 40 }, why: 'considered design in a familiar register' },
      { grade: 1, when: { diameterMax: 42 }, why: 'a handsome watch with nothing to say about design' },
    ] },

  { id: 'f11', category: 'persona', query: "I'm a student, this would be my first real watch, under five thousand",
    must: { priceMax: 5000 },
    rubric: [
      { grade: 3, when: { movementAny: ['automatic'] }, why: 'a first real watch should be mechanical' },
      { grade: 2, when: {}, why: 'inside the budget, not mechanical' },
    ] },

  { id: 'f12', category: 'persona', query: "retirement present from the team, we've pooled about twenty thousand",
    must: { priceMax: 25000 },
    rubric: [
      { grade: 3, when: { priceMin: 12000, priceMax: 22000, styleAny: ['dress'] },
        why: 'at the number, and dressy enough to read as a send-off' },
      { grade: 2, when: { priceMin: 8000 }, why: 'a serious gift, off the register or the number' },
      { grade: 1, when: {}, why: 'within what was pooled' },
    ] },

  // -- Aesthetic ---------------------------------------------------------------
  { id: 'f13', category: 'aesthetic', query: 'I like watches that look like instruments, not jewellery',
    must: {},
    rubric: [
      { grade: 3, when: { styleAny: ['sport', 'diver'], materialNone: ['gold', 'platin'],
                          functionsAny: ['chronograph', 'second time zone', 'power-reserve'] },
        why: 'a tool face: readable, functional, no precious metal' },
      { grade: 2, when: { styleAny: ['sport', 'diver'], materialNone: ['gold', 'platin'] }, why: 'tool register, plainer dial' },
      { grade: 1, when: { materialNone: ['gold', 'platin'] }, why: 'at least it is not jewellery' },
    ] },

  { id: 'f14', category: 'aesthetic', query: 'a green dial, nothing else matters',
    must: { dialAny: ['green'] },
    rubric: [
      { grade: 3, when: {}, why: 'the brief is the dial colour and nothing else' },
    ] },

  { id: 'f15', category: 'aesthetic', query: 'openworked, I want to see it working',
    must: {},
    rubric: [
      { grade: 3, when: { dialAny: ['openwork', 'skeleton'] }, why: 'the movement is the dial' },
      { grade: 2, when: { caseBackAny: ['sapphire', 'transparent', 'see-through'], functionsAny: ['tourbillon', 'perpetual calendar'] },
        why: 'the movement shows, from the back' },
      { grade: 1, when: { caseBackAny: ['sapphire', 'transparent', 'see-through'] }, why: 'visible, if you take it off' },
    ] },

  { id: 'f16', category: 'aesthetic', query: "something vintage looking, like my grandfather's",
    must: {},
    rubric: [
      { grade: 3, when: { styleAny: ['dress'], diameterMax: 38, materialAny: ['yellow gold', 'rose gold', 'pink gold'],
                          strapAny: ['leather', 'alligator', 'calf', 'crocodile'] },
        why: 'the watch of that generation: small, warm gold, on leather' },
      { grade: 2, when: { styleAny: ['dress'], diameterMax: 39 }, why: 'period proportions in a modern metal' },
      { grade: 1, when: { styleAny: ['dress'] }, why: 'classic register, contemporary size' },
    ] },

  { id: 'f17', category: 'aesthetic', query: 'black on black, as dark as you have',
    must: {},
    rubric: [
      { grade: 3, when: { dialAny: ['black'], materialAny: ['ceramic', 'carbon', 'titan'] },
        why: 'dark dial in a dark case, which is as far as the catalogue goes' },
      { grade: 2, when: { dialAny: ['black'], materialNone: ['gold', 'platin'] }, why: 'black face, steel case' },
      { grade: 1, when: { dialAny: ['black'] }, why: 'black dial, precious case working against the brief' },
    ] },

  { id: 'f18', category: 'aesthetic', query: 'I hate date windows',
    must: { functionsNone: ['date'] },
    rubric: [
      { grade: 3, when: { styleAny: ['dress'], diameterMax: 41 }, why: 'a clean face is what the complaint is really about' },
      { grade: 2, when: {}, why: 'no date, whatever else it is' },
    ] },

  // -- Lifestyle ---------------------------------------------------------------
  { id: 'f19', category: 'lifestyle', query: 'I ride motorbikes on weekends',
    must: {},
    rubric: [
      { grade: 3, when: { styleAny: ['sport', 'diver'], waterResistanceMin: 100, materialAny: ['steel', 'titan', 'ceramic'] },
        why: 'vibration, weather and gloves: a sealed sports case' },
      { grade: 2, when: { styleAny: ['sport', 'diver'] }, why: 'the right kind of watch, less sealed' },
      { grade: 1, when: { waterResistanceMin: 100 }, why: 'survives the ride' },
    ] },

  { id: 'f20', category: 'lifestyle', query: "I'm in and out of the ocean all summer",
    must: {},
    rubric: [
      { grade: 3, when: { styleAny: ['diver'], waterResistanceMin: 200 }, why: 'salt water daily is what a diver is built for' },
      { grade: 2, when: { waterResistanceMin: 100 }, why: 'swims safely without being a diver' },
      { grade: 1, when: { waterResistanceMin: 50 }, why: 'splashes only' },
    ] },

  { id: 'f21', category: 'lifestyle', query: 'long haul flights twice a month for work',
    must: {},
    rubric: [
      { grade: 3, when: { functionsAny: ['second time zone', 'world time', 'gmt', 'dual time', 'home time'] },
        why: 'two time zones is the whole problem' },
      { grade: 2, when: { movementAny: ['automatic'], waterResistanceMin: 50 }, why: 'a dependable travel companion without the complication' },
      { grade: 1, when: { movementAny: ['automatic'] }, why: 'travels fine, says nothing about the brief' },
    ] },

  { id: 'f22', category: 'lifestyle', query: "I teach, so I'm writing on a whiteboard all day",
    must: {},
    rubric: [
      { grade: 3, when: { diameterMax: 40, materialAny: ['steel', 'titan', 'ceramic'], waterResistanceMin: 50 },
        why: 'an arm raised all day wants a small hard case that shrugs off knocks' },
      { grade: 2, when: { diameterMax: 41 }, why: 'stays out of the way, softer case' },
      { grade: 1, when: { diameterMax: 42 }, why: 'wearable through a teaching day' },
    ] },

  { id: 'f23', category: 'lifestyle', query: 'I cycle to work in all weather',
    must: {},
    rubric: [
      { grade: 3, when: { waterResistanceMin: 100, styleAny: ['sport', 'diver'], strapAny: ['rubber', 'synthetic', 'bracelet'] },
        why: 'rain and sweat: a sealed case on a strap that does not mind either' },
      { grade: 2, when: { waterResistanceMin: 100 }, why: 'handles the weather, strap will not enjoy it' },
      { grade: 1, when: { waterResistanceMin: 50 }, why: 'fine on a dry day' },
    ] },

  { id: 'f24', category: 'lifestyle', query: 'weekend woodworking, the watch takes a beating',
    must: {},
    rubric: [
      { grade: 3, when: { materialAny: ['ceramic', 'titan'], styleAny: ['sport', 'diver'] },
        why: 'hard materials on a case built to be knocked' },
      { grade: 2, when: { styleAny: ['sport', 'diver'], waterResistanceMin: 100 }, why: 'built for use, in a softer metal' },
      { grade: 1, when: { styleAny: ['sport', 'diver'] }, why: 'a sports watch, hardness unproven' },
    ] },

  // -- Collector ---------------------------------------------------------------
  { id: 'f25', category: 'collector', query: "I already own a steel sports watch, what's the step up from here",
    must: {},
    rubric: [
      { grade: 3, when: { brandIn: ['Patek Philippe', 'Audemars Piguet', 'Vacheron Constantin', 'A. Lange & Söhne'],
                          styleAny: ['sport'] },
        why: 'the same kind of watch from the houses a collector moves up to' },
      { grade: 2, when: { brandIn: ['Patek Philippe', 'Audemars Piguet', 'Vacheron Constantin', 'A. Lange & Söhne',
                                    'F.P.Journe', 'Greubel Forsey'] },
        why: 'the step up in maison, not in category' },
      { grade: 1, when: { styleAny: ['sport'], priceMin: 20000 }, why: 'more expensive than what he owns, same tier of name' },
    ] },

  { id: 'f26', category: 'collector', query: 'hand-wound only, I like the ritual of winding it',
    must: { movementAny: ['manual'] },
    rubric: [
      { grade: 3, when: { styleAny: ['dress'], diameterMax: 40 }, why: 'the register hand-winding belongs to' },
      { grade: 2, when: {}, why: 'hand-wound, whatever else it is' },
    ] },

  { id: 'f27', category: 'collector', query: 'a tourbillon, I want to watch it turn',
    must: { functionsAny: ['tourbillon'] },
    rubric: [
      { grade: 3, when: { dialAny: ['openwork', 'skeleton'] }, why: 'the cage is visible from the front, which is the point' },
      { grade: 2, when: { caseBackAny: ['sapphire', 'transparent', 'see-through'] }, why: 'visible, from the back' },
      { grade: 1, when: {}, why: 'has one, hidden' },
    ] },

  { id: 'f28', category: 'collector', query: 'a chronograph I could actually use to time something',
    must: { functionsAny: ['chronograph'] },
    rubric: [
      { grade: 3, when: { waterResistanceMin: 100, materialNone: ['gold', 'platin'] },
        why: 'used rather than admired: legible, sealed, not precious' },
      { grade: 2, when: { waterResistanceMin: 50 }, why: 'usable, less robust' },
      { grade: 1, when: {}, why: 'a chronograph, built for the case rather than the stopwatch' },
    ] },

  { id: 'f29', category: 'collector', query: 'limited production, not something everyone has',
    must: {},
    rubric: [
      { grade: 3, when: { brandIn: ['F.P.Journe', 'Greubel Forsey'] }, why: 'the two houses here that make watches in tens' },
      { grade: 2, when: { styleAny: ['art'] }, why: 'made in small numbers because of how it is decorated' },
      { grade: 1, when: { materialAny: ['platin'] }, why: 'uncommon by metal rather than by production' },
    ] },

  { id: 'f30', category: 'collector', query: 'enamel or engraving, the old crafts',
    must: {},
    rubric: [
      { grade: 3, when: { dialAny: ['enamel', 'engrav', 'guilloch', 'lacquer'] }, why: 'the craft is on the dial, done by hand' },
      { grade: 2, when: { styleAny: ['art'] }, why: 'an artistic piece whose decoration is elsewhere' },
      { grade: 1, when: { materialAny: ['gold', 'platin'] }, why: 'finished to a high standard, no craft on show' },
    ] },

  // -- Fit ---------------------------------------------------------------------
  { id: 'f31', category: 'fit', query: "I'm tall with wrists to match, most watches disappear on me",
    must: {},
    rubric: [
      { grade: 3, when: { diameterMin: 43 }, why: 'enough case to read as a watch on that wrist' },
      { grade: 2, when: { diameterMin: 41 }, why: 'holds its own without presence' },
      { grade: 1, when: { diameterMin: 40 }, why: 'the smallest that would not vanish' },
    ] },

  { id: 'f32', category: 'fit', query: 'anything over 40mm looks silly on me',
    must: { diameterMax: 40 },
    rubric: [
      { grade: 3, when: { diameterMax: 38 }, why: 'comfortably inside the line drawn' },
      { grade: 2, when: {}, why: 'at the limit stated' },
    ] },

  { id: 'f33', category: 'fit', query: 'I wear my shirt cuffs tight',
    must: {},
    rubric: [
      { grade: 3, when: { styleAny: ['dress'], diameterMax: 38, functionsNone: ['chronograph'] },
        why: 'a slim case with nothing projecting from the side' },
      { grade: 2, when: { diameterMax: 40, functionsNone: ['chronograph'] }, why: 'small enough, not built for a cuff' },
      { grade: 1, when: { diameterMax: 41 }, why: 'fits if the cuff gives' },
    ] },

  { id: 'f34', category: 'fit', query: 'heavy watches give me a sore wrist by the evening',
    must: {},
    rubric: [
      { grade: 3, when: { materialAny: ['titan', 'ceramic', 'carbon'], diameterMax: 42 }, why: 'light metal in a case that is not oversized' },
      { grade: 2, when: { diameterMax: 39 }, why: 'light because it is small' },
      { grade: 1, when: { diameterMax: 41 }, why: 'bearable through a day' },
    ] },

  { id: 'f35', category: 'fit', query: 'a bracelet, not a strap, I sweat through leather',
    must: { strapAny: ['bracelet', 'oyster', 'steel', 'titan'] },
    rubric: [
      { grade: 3, when: { waterResistanceMin: 100 }, why: 'metal bracelet on a case that can be rinsed' },
      { grade: 2, when: {}, why: 'on a bracelet, as asked' },
    ] },

  { id: 'f36', category: 'fit', query: 'my last watch overhung my wrist, I need a smaller case',
    must: {},
    rubric: [
      { grade: 3, when: { diameterMax: 38 }, why: 'a case that sits inside the wrist' },
      { grade: 2, when: { diameterMax: 40 }, why: 'fits, filling the wrist' },
      { grade: 1, when: { diameterMax: 41 }, why: 'borderline again' },
    ] },
];
