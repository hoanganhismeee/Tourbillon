// Catalogue loading and ground-truth evaluation for the Smart Search harness.
// The catalogue is pulled from the live API and normalised once; every golden-set label is
// then derived by running a declarative predicate over it, so labels stay correct as the
// catalogue grows and can be audited without trusting a hand-picked list of ids.

const TIMEOUT_MS = 30_000;

async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`GET ${url} -> HTTP ${res.status}`);
  return res.json();
}

/// Pulls watches, brands and collections and joins them into flat records with parsed specs.
/// One fetch of the whole catalogue is cheap at this size and keeps scoring purely in-process.
export async function loadCatalogue(baseUrl) {
  const [watches, brands, collections] = await Promise.all([
    getJson(`${baseUrl}/api/watch`),
    getJson(`${baseUrl}/api/brand`),
    getJson(`${baseUrl}/api/collection`),
  ]);

  const brandById = new Map(brands.map(b => [b.id, b]));
  const collectionById = new Map(collections.map(c => [c.id, c]));

  const records = watches.map(w => {
    const specs = parseSpecs(w.specs);
    const brand = brandById.get(w.brandId);
    const collection = w.collectionId != null ? collectionById.get(w.collectionId) : null;
    return {
      id: w.id,
      name: w.name ?? '',
      slug: w.slug ?? '',
      price: Number(w.currentPrice ?? 0),
      brandId: w.brandId,
      brandName: brand?.name ?? '',
      collectionId: w.collectionId ?? null,
      collectionName: collection?.name ?? '',
      collectionStyles: (collection?.styles ?? []).map(s => String(s).toLowerCase()),
      diameterMm: parseFirstNumber(specs?.case?.diameter),
      waterResistanceM: parseFirstNumber(specs?.case?.waterResistance),
      caseMaterial: lower(specs?.case?.material),
      caseBack: lower(specs?.case?.caseBack),
      movementType: lower(specs?.movement?.type),
      movementFamily: normaliseMovement(lower(specs?.movement?.type)),
      powerReserveH: parseFirstNumber(specs?.movement?.powerReserve),
      functions: (specs?.movement?.functions ?? []).map(f => lower(f)),
      dialColour: lower(specs?.dial?.color),
      dialFinish: lower(specs?.dial?.finish),
      strapMaterial: lower(specs?.strap?.material),
    };
  });

  return { records, brands, collections, byId: new Map(records.map(r => [r.id, r])) };
}

function parseSpecs(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return null; }
}

const lower = v => (v == null ? '' : String(v).toLowerCase());

/// "42.5 mm" -> 42.5, "300 m / 30 bar" -> 300, "min. 35 - max. 45 hours" -> 35.
/// First number wins because the leading figure is the one the spec is named for.
function parseFirstNumber(value) {
  if (value == null) return null;
  const match = String(value).match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

// -- Ground truth -------------------------------------------------------------

/// Every key matchesTruth reads. A key outside this set is silently unconstrained, so a typo
/// such as `diamterMax` widens the label without failing anything; validation rejects it.
export const TRUTH_KEYS = new Set([
  'priceMin', 'priceMax', 'brand', 'brandIn', 'excludeBrand', 'collection',
  'diameterMin', 'diameterMax', 'waterResistanceMin', 'powerReserveMin',
  'materialAny', 'materialNone', 'caseBackAny', 'movementAny', 'dialAny', 'strapAny',
  'styleAny', 'styleNone',
  'functionsAny', 'functionsAll', 'functionsNone', 'ids',
]);

export function unknownTruthKeys(truth) {
  return Object.keys(truth ?? {}).filter(key => !TRUTH_KEYS.has(key));
}

/// Evaluates one declarative truth spec against one normalised watch record.
/// Every key present must hold; an absent key is simply not constrained.
export function matchesTruth(w, truth) {
  // Price 0 is "Price on Request", not free. It is never excluded from the catalogue,
  // but it cannot satisfy a budget constraint because its price is unknown.
  if ((truth.priceMin != null || truth.priceMax != null) && w.price === 0) return false;
  if (truth.priceMin != null && w.price < truth.priceMin) return false;
  if (truth.priceMax != null && w.price > truth.priceMax) return false;

  if (truth.brand != null && !sameName(w.brandName, truth.brand)) return false;
  if (truth.brandIn != null && !truth.brandIn.some(b => sameName(w.brandName, b))) return false;
  if (truth.excludeBrand != null && truth.excludeBrand.some(b => sameName(w.brandName, b))) return false;
  if (truth.collection != null && !sameName(w.collectionName, truth.collection)) return false;

  if (truth.diameterMin != null && !(w.diameterMm != null && w.diameterMm >= truth.diameterMin)) return false;
  if (truth.diameterMax != null && !(w.diameterMm != null && w.diameterMm <= truth.diameterMax)) return false;
  if (truth.waterResistanceMin != null && !(w.waterResistanceM != null && w.waterResistanceM >= truth.waterResistanceMin)) return false;
  if (truth.powerReserveMin != null && !(w.powerReserveH != null && w.powerReserveH >= truth.powerReserveMin)) return false;

  if (truth.materialAny != null && !truth.materialAny.some(m => w.caseMaterial.includes(m))) return false;
  if (truth.materialNone != null && truth.materialNone.some(m => w.caseMaterial.includes(m))) return false;
  if (truth.caseBackAny != null && !truth.caseBackAny.some(c => w.caseBack.includes(c))) return false;
  if (truth.movementAny != null && !truth.movementAny.includes(w.movementFamily)) return false;
  if (truth.dialAny != null && !truth.dialAny.some(c => w.dialColour.includes(c))) return false;
  if (truth.strapAny != null && !truth.strapAny.some(s => w.strapMaterial.includes(s))) return false;
  if (truth.styleAny != null && !truth.styleAny.some(s => w.collectionStyles.includes(s))) return false;
  // "not a sports watch" is a constraint the user states; without this it had to be rewritten as a
  // guess at what they do want, which is the inversion this label version exists to stop.
  if (truth.styleNone != null && truth.styleNone.some(s => w.collectionStyles.includes(s))) return false;

  if (truth.functionsAny != null && !truth.functionsAny.some(f => w.functions.some(fn => fn.includes(f)))) return false;
  if (truth.functionsAll != null && !truth.functionsAll.every(f => w.functions.some(fn => fn.includes(f)))) return false;
  if (truth.functionsNone != null && truth.functionsNone.some(f => w.functions.some(fn => fn.includes(f)))) return false;

  if (truth.ids != null && !truth.ids.includes(w.id)) return false;
  return true;
}

/// Brand and collection names are compared on a diacritic-stripped, punctuation-free form
/// so "A. Lange & Soehne" in the database matches "a lange sohne" in a label.
function sameName(actual, expected) {
  return compact(actual) === compact(expected);
}

export function compact(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

/// Materialises the relevant id set for a query by scanning the whole catalogue.
export function relevantIds(catalogue, truth) {
  return new Set(catalogue.records.filter(w => matchesTruth(w, truth)).map(w => w.id));
}

// -- Graded ground truth ------------------------------------------------------
//
// A brief that names no facet has no single right answer, and the first version of these labels
// pretended otherwise: "something for a black tie gala" demanded gold and 39 mm, neither of which
// the brief says, and scored a white-gold 40 mm dress watch exactly as low as a dive watch.
//
// A graded label separates the two things that were conflated. `must` holds what the brief
// actually states — a budget, a named brand, an explicit exclusion — and breaking it is a
// violation, reported on its own. `rubric` holds the taste reading, as tiers: grade 3 is what a
// knowledgeable salesperson would bring out first, 2 fits with a trade-off, 1 is defensible.

/// True when a stated constraint is broken. An empty `must` is never violated.
export function violatesMust(watch, must) {
  if (!must || Object.keys(must).length === 0) return false;
  return !matchesTruth(watch, must);
}

/// Grade for one watch: 0 when it breaks a stated constraint or matches no tier, otherwise the
/// grade of the highest tier it satisfies. Tiers are read highest first, so a wider tier-2 clause
/// never pulls down a watch that also satisfies tier 3.
export function gradeFor(watch, label) {
  if (violatesMust(watch, label.must)) return 0;
  for (const tier of [...(label.rubric ?? [])].sort((a, b) => b.grade - a.grade)) {
    if (tierMatches(watch, tier)) return tier.grade;
  }
  return 0;
}

/// A tier holds either one clause set (`when`) or several alternatives (`whenAny`), because a brief
/// can be answered two different ways at the same grade: a traveller is served by a GMT complication
/// or by a robust everyday automatic, and forcing those into one conjunction would exclude both.
function tierMatches(watch, tier) {
  if (tier.when && matchesTruth(watch, tier.when)) return true;
  return (tier.whenAny ?? []).some(clause => matchesTruth(watch, clause));
}

/// Grades for the whole catalogue, with the ids that break a stated constraint kept apart so a
/// violation can be counted rather than averaged away.
export function gradesFor(catalogue, label) {
  const grades = new Map();
  const violating = new Set();
  for (const watch of catalogue.records) {
    if (violatesMust(watch, label.must)) violating.add(watch.id);
    const grade = gradeFor(watch, label);
    if (grade > 0) grades.set(watch.id, grade);
  }
  return { grades, violating };
}

/// The ids one tier matches on its own, for the label-health check that grades widen as they fall.
export function relevantIdsForTier(catalogue, tier) {
  return new Set(catalogue.records.filter(w => tierMatches(w, tier)).map(w => w.id));
}

/// Every key a graded label reads, for the same typo check `unknownTruthKeys` runs on a flat truth.
export function unknownLabelKeys(label) {
  const keys = [
    ...unknownTruthKeys(label.must ?? {}),
    ...(label.rubric ?? []).flatMap(tier => [
      ...unknownTruthKeys(tier.when ?? {}),
      ...(tier.whenAny ?? []).flatMap(clause => unknownTruthKeys(clause)),
    ]),
  ];
  return [...new Set(keys)];
}

// -- Facet inspection ---------------------------------------------------------

/// Reports what the catalogue actually contains, so the golden set can be written against
/// real brands, materials and price bands instead of assumed ones.
export function summariseFacets(catalogue) {
  const { records } = catalogue;
  const priced = records.filter(r => r.price > 0).map(r => r.price).sort((a, b) => a - b);
  const diameters = records.map(r => r.diameterMm).filter(d => d != null).sort((a, b) => a - b);
  return {
    watches: records.length,
    priceOnRequest: records.filter(r => r.price === 0).length,
    priceMin: priced[0] ?? null,
    priceMedian: priced[Math.floor(priced.length / 2)] ?? null,
    priceMax: priced[priced.length - 1] ?? null,
    diameterMin: diameters[0] ?? null,
    diameterMax: diameters[diameters.length - 1] ?? null,
    brands: tally(records, r => r.brandName),
    styles: tally(records, r => r.collectionStyles, true),
    materials: tally(records, r => normaliseMaterial(r.caseMaterial)),
    movements: tally(records, r => r.movementFamily),
    dials: tally(records, r => r.dialColour || '(unknown)'),
    functions: tally(records, r => r.functions, true),
  };
}

/// The catalogue records movement type in 23 different spellings scraped from brand sites.
/// "Self-winding", "automatic manufacture" and "spring drive automatic" are all the same thing
/// to a buyer, so labels match on this family rather than on raw substrings, which would
/// silently under-count every automatic that a brand happens to describe differently.
export function normaliseMovement(type) {
  if (!type) return '(unknown)';
  if (type.includes('quartz')) return 'quartz';
  if (type.includes('electromechanical')) return 'quartz';
  if (type.includes('self-winding') || type.includes('self winding')) return 'automatic';
  if (type.includes('automatic') || type.includes('spring drive')) return 'automatic';
  if (type.includes('hand-wound') || type.includes('hand wound')) return 'manual';
  if (type.includes('manual')) return 'manual';
  return 'other';
}

/// Collapses free-text case material into the handful of buckets a query would ask for.
export function normaliseMaterial(material) {
  if (!material) return '(unknown)';
  if (material.includes('platin')) return 'platinum';
  if (material.includes('rose gold') || material.includes('pink gold')) return 'rose gold';
  if (material.includes('white gold')) return 'white gold';
  if (material.includes('yellow gold')) return 'yellow gold';
  if (material.includes('gold')) return 'gold (other)';
  if (material.includes('titan')) return 'titanium';
  if (material.includes('ceramic')) return 'ceramic';
  if (material.includes('steel')) return 'steel';
  return material.slice(0, 24);
}

function tally(records, pick, isArray = false) {
  const counts = new Map();
  for (const r of records) {
    const values = isArray ? pick(r) : [pick(r)];
    for (const v of values) {
      if (!v) continue;
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}
