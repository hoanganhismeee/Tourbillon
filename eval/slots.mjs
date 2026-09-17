// Structured filter accuracy: did the parser read the constraints the brief states?
// Compares the QueryIntent a search returns with the facets each spec label implies, slot by slot,
// so a parse error can be told apart from a ranking error. Labels also carry what no QueryIntent
// can hold (a strap, a date window, an exact reference); those parts are simply not scored.

const MATERIAL_LABELS = [
  ['platin', 'Platinum'], ['titan', 'Titanium'], ['ceramic', 'Ceramic'],
  ['carbon', 'Carbon'], ['gold', 'Gold'], ['steel', 'Steel'],
];
const MOVEMENT_LABELS = { automatic: 'Automatic', manual: 'Manual-winding', quartz: 'Quartz' };
const lower = value => String(value ?? '').toLowerCase();
const byName = (items, name) => items.find(i => lower(i.name) === lower(name));

/// The slots a label implies, each with the value a correct parse should hold.
export function expectedSlots(truth, catalogue) {
  const slots = {};
  if (truth.brand) slots.brand = [byName(catalogue.brands, truth.brand)?.id].filter(Boolean);
  if (truth.brandIn) slots.brand = truth.brandIn.map(b => byName(catalogue.brands, b)?.id).filter(Boolean);
  if (truth.excludeBrand) slots.excludedBrand = truth.excludeBrand.map(b => byName(catalogue.brands, b)?.id).filter(Boolean);
  if (truth.collection) slots.collection = byName(catalogue.collections, truth.collection)?.id ?? null;
  if (truth.priceMax != null) slots.maxPrice = truth.priceMax;
  // priceMin of 1 is how labels exclude Price on Request, not something a user said.
  if (truth.priceMin != null && truth.priceMin > 1) slots.minPrice = truth.priceMin;
  if (truth.diameterMax != null) slots.maxDiameter = truth.diameterMax;
  if (truth.diameterMin != null && truth.diameterMin > 0) slots.minDiameter = truth.diameterMin;
  if (truth.waterResistanceMin != null) slots.waterResistance = truth.waterResistanceMin;
  if (truth.powerReserveMin != null) slots.powerReserve = truth.powerReserveMin;
  if (truth.materialAny) {
    slots.material = [...new Set(truth.materialAny.map(m => MATERIAL_LABELS.find(([k]) => lower(m).includes(k))?.[1]).filter(Boolean))];
  }
  if (truth.materialNone) slots.excludedMaterial = truth.materialNone.map(lower);
  if (truth.movementAny) slots.movement = truth.movementAny.map(m => MOVEMENT_LABELS[m]).filter(Boolean);
  if (truth.dialAny) slots.dial = truth.dialAny.map(lower);
  if (truth.styleAny) slots.style = truth.styleAny.map(lower);
  if (truth.functionsAny) slots.complication = truth.functionsAny.map(lower);
  if (truth.functionsNone) slots.excludedComplication = truth.functionsNone.map(lower);
  return slots;
}

/// The slots a QueryIntent actually holds. A collection suggested from a style is a filter-bar
/// hint, not something the parser read, so it does not count.
export function parsedSlots(intent) {
  const i = intent ?? {};
  const has = [];
  if (i.brandId != null || (i.brandIds ?? []).length) has.push('brand');
  if ((i.excludedBrandIds ?? []).length) has.push('excludedBrand');
  if (!i.collectionsDerivedFromStyle && (i.collectionId != null || (i.collectionIds ?? []).length)) has.push('collection');
  if (i.maxPrice != null) has.push('maxPrice');
  if (i.minPrice != null && i.minPrice > 1) has.push('minPrice');
  if (i.maxDiameterMm > 0) has.push('maxDiameter');
  if (i.minDiameterMm > 0) has.push('minDiameter');
  if (i.waterResistance != null) has.push('waterResistance');
  if ((i.powerReserves ?? []).length) has.push('powerReserve');
  if (i.caseMaterial) has.push('material');
  if ((i.excludedMaterials ?? []).length) has.push('excludedMaterial');
  if (i.movementType) has.push('movement');
  if (i.dialColour) has.push('dial');
  if (i.style) has.push('style');
  if ((i.complications ?? []).length) has.push('complication');
  if ((i.excludedComplications ?? []).length) has.push('excludedComplication');
  return has;
}

const within = (actual, expected, tolerance) =>
  actual != null && Math.abs(Number(actual) - expected) <= tolerance;
const tokensOverlap = (labels, tokens) =>
  labels.map(lower).some(label => tokens.some(t => label.includes(t) || t.includes(label.split(/[\s/]+/)[0])));

/// Whether the parsed value of one slot agrees with the label. Numbers get a tolerance because a
/// label band ("around fifty thousand" as 35k to 65k) and a parsed band need not coincide exactly.
export function slotMatches(slot, expected, intent) {
  const i = intent ?? {};
  switch (slot) {
    case 'brand': return [i.brandId, ...(i.brandIds ?? [])].some(id => expected.includes(id));
    case 'excludedBrand': return expected.every(id => (i.excludedBrandIds ?? []).includes(id));
    case 'collection': return i.collectionId === expected || (i.collectionIds ?? []).includes(expected);
    case 'maxPrice': return within(i.maxPrice, expected, expected * 0.25);
    case 'minPrice': return within(i.minPrice, expected, expected * 0.25);
    case 'maxDiameter': return within(i.maxDiameterMm, expected, 1);
    case 'minDiameter': return within(i.minDiameterMm, expected, 1);
    case 'waterResistance': return within(i.waterResistance, expected, expected * 0.5);
    // Buckets are labelled ranges, so only the presence of a power-reserve constraint is checked.
    case 'powerReserve': return (i.powerReserves ?? []).length > 0;
    case 'material': return expected.includes(i.caseMaterial);
    case 'excludedMaterial': return tokensOverlap(i.excludedMaterials ?? [], expected);
    case 'movement': return expected.includes(i.movementType);
    case 'dial': return tokensOverlap([i.dialColour ?? ''].filter(Boolean), expected);
    case 'style': return expected.includes(lower(i.style));
    case 'complication': return tokensOverlap(i.complications ?? [], expected);
    case 'excludedComplication': return tokensOverlap(i.excludedComplications ?? [], expected);
    default: return false;
  }
}

/// Slot-level outcome for one query: matched, read wrongly, missed, or parsed but not asked for.
export function scoreSlots(truth, intent, catalogue) {
  const expected = expectedSlots(truth, catalogue);
  const parsed = parsedSlots(intent);
  const matched = [], wrong = [], missed = [];
  for (const [slot, value] of Object.entries(expected)) {
    if (!parsed.includes(slot)) missed.push(slot);
    else if (slotMatches(slot, value, intent)) matched.push(slot);
    else wrong.push(slot);
  }
  // A brand inferred from the named collection is the right brand, not an invented constraint.
  const inferredBrand = expected.collection != null
    && catalogue.collections.find(c => c.id === expected.collection)?.brandId === intent?.brandId;
  const extra = parsed.filter(slot => !(slot in expected) && !(slot === 'brand' && inferredBrand));
  return { expected: Object.keys(expected).length, matched, wrong, missed, extra };
}

/// Slot recall (constraints read), precision (parsed constraints that were right) and the share of
/// queries read exactly. Queries whose label implies no slot, such as reference lookups, are left out.
export function summariseSlots(results) {
  const scored = results.filter(r => r && r.expected > 0);
  const sum = pick => scored.reduce((total, r) => total + pick(r), 0);
  const matched = sum(r => r.matched.length);
  const expected = sum(r => r.expected);
  const parsed = sum(r => r.matched.length + r.wrong.length + r.extra.length);
  const recall = expected ? matched / expected : null;
  const precision = parsed ? matched / parsed : null;
  const perSlot = {};
  for (const r of scored) {
    for (const [slot, outcome] of [...r.matched.map(s => [s, 'matched']), ...r.wrong.map(s => [s, 'wrong']), ...r.missed.map(s => [s, 'missed'])]) {
      perSlot[slot] ??= { matched: 0, wrong: 0, missed: 0 };
      perSlot[slot][outcome] += 1;
    }
  }
  return {
    queries: scored.length,
    slotRecall: recall,
    slotPrecision: precision,
    slotF1: recall && precision ? (2 * recall * precision) / (recall + precision) : null,
    exactMatch: scored.length
      ? scored.filter(r => r.matched.length === r.expected && !r.wrong.length && !r.extra.length).length / scored.length
      : null,
    perSlot,
  };
}
