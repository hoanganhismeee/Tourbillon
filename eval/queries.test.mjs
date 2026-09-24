// Structural tests for the golden set. None of them need the live catalogue: they catch the label
// mistakes that would otherwise surface as a plausible score, such as a misspelt truth key that
// silently widens a label, or a new category that falls into the wrong scope.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { HANDWRITTEN, SCOPE_BY_CATEGORY, scopeOf, validateQueries } from './queries.mjs';
import { FROZEN } from './frozen-set.mjs';
import { TRUTH_KEYS, matchesTruth, unknownTruthKeys, unknownLabelKeys, gradeFor } from './catalogue.mjs';

/// A catalogue record with every field matchesTruth reads, so a test only states what it varies.
function record(overrides = {}) {
  return {
    id: 0, name: '', price: 10000, brandName: 'Brand', collectionName: '', collectionStyles: [],
    diameterMm: 40, waterResistanceM: 100, powerReserveH: 48, caseMaterial: 'steel', caseBack: '',
    movementFamily: 'automatic', functions: [], dialColour: 'black', strapMaterial: 'leather',
    ...overrides,
  };
}

test('handwritten ids are unique', () => {
  const ids = HANDWRITTEN.map(q => q.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('every handwritten category has an explicit scope', () => {
  // scopeOf falls back to spec, so an unregistered semantic category would be scored against
  // Smart Search without any error. Registration has to be deliberate.
  const missing = [...new Set(HANDWRITTEN.map(q => q.category))].filter(c => !(c in SCOPE_BY_CATEGORY));
  assert.deepEqual(missing, []);
});

test('scopes are only spec or semantic', () => {
  assert.deepEqual([...new Set(Object.values(SCOPE_BY_CATEGORY))].sort(), ['semantic', 'spec']);
  assert.equal(scopeOf({ category: 'not_registered' }), 'spec');
});

test('every handwritten label uses only keys the matcher understands', () => {
  const bad = HANDWRITTEN
    .map(q => ({ id: q.id, keys: q.rubric ? unknownLabelKeys(q) : unknownTruthKeys(q.truth) }))
    .filter(q => q.keys.length > 0);
  assert.deepEqual(bad, []);
});

test('every handwritten query states at least one constraint', () => {
  // A graded label may state no hard constraint — most briefs do not — but it must say what a
  // good answer looks like, or it scores everything zero.
  const unconstrained = HANDWRITTEN
    .filter(q => (q.rubric ? q.rubric.length === 0 : Object.keys(q.truth ?? {}).length === 0))
    .map(q => q.id);
  assert.deepEqual(unconstrained, []);
});

test('the semantic half is graded and the facet half is not', () => {
  const wrong = HANDWRITTEN.filter(q => (scopeOf(q) === 'semantic') !== Boolean(q.rubric)).map(q => q.id);
  assert.deepEqual(wrong, []);
});

test('every grade tier explains itself', () => {
  // The `why` is what a blind judge is shown, so a tier without one cannot be checked by anyone.
  const silent = HANDWRITTEN.flatMap(q => (q.rubric ?? [])
    .filter(tier => !tier.why || tier.why.length < 12)
    .map(tier => `${q.id} grade ${tier.grade}`));
  assert.deepEqual(silent, []);
});

test('grades run 1 to 3 and never repeat inside a label', () => {
  const bad = HANDWRITTEN.filter(q => {
    const grades = (q.rubric ?? []).map(t => t.grade);
    return grades.some(g => ![1, 2, 3].includes(g)) || new Set(grades).size !== grades.length;
  }).map(q => q.id);
  assert.deepEqual(bad, []);
});

test('a stated constraint outranks every tier', () => {
  // The point of the rewrite: an over-budget watch is a violation, however well it reads otherwise.
  const label = {
    must: { priceMax: 15000 },
    rubric: [{ grade: 3, when: { styleAny: ['dress'] }, why: 'elegant' }],
  };
  assert.equal(gradeFor(record({ price: 9000, collectionStyles: ['dress'] }), label), 3);
  assert.equal(gradeFor(record({ price: 40000, collectionStyles: ['dress'] }), label), 0);
});

test('a tier is taken at its highest grade, not its first match', () => {
  const label = {
    rubric: [
      { grade: 1, when: { diameterMax: 44 }, why: 'wearable' },
      { grade: 3, when: { diameterMax: 36 }, why: 'sized for the wrist stated' },
    ],
  };
  assert.equal(gradeFor(record({ diameterMm: 35 }), label), 3);
  assert.equal(gradeFor(record({ diameterMm: 42 }), label), 1);
  assert.equal(gradeFor(record({ diameterMm: 46 }), label), 0);
});

test('a tier can be reached two ways', () => {
  const label = {
    rubric: [{ grade: 2, whenAny: [{ functionsAny: ['gmt'] }, { styleAny: ['sport'] }], why: 'travels well' }],
  };
  assert.equal(gradeFor(record({ functions: ['gmt'] }), label), 2);
  assert.equal(gradeFor(record({ collectionStyles: ['sport'] }), label), 2);
  assert.equal(gradeFor(record({}), label), 0);
});

// -- Frozen test set ----------------------------------------------------------
// It is run to report rather than to tune, so nothing catches a mistake in it until the number is
// already published. These checks are what stands in for that.

test('the frozen set is graded, semantic, and does not collide with the dev set', () => {
  const devIds = new Set(HANDWRITTEN.map(q => q.id));
  assert.deepEqual(FROZEN.filter(q => devIds.has(q.id)).map(q => q.id), []);
  assert.deepEqual(FROZEN.filter(q => !q.rubric).map(q => q.id), []);
  assert.deepEqual(FROZEN.filter(q => scopeOf(q) !== 'semantic').map(q => q.id), []);
  assert.equal(new Set(FROZEN.map(q => q.id)).size, FROZEN.length);
});

test('the frozen set covers every intent group evenly', () => {
  const counts = {};
  for (const q of FROZEN) counts[q.category] = (counts[q.category] ?? 0) + 1;
  assert.deepEqual(counts, { occasion: 6, persona: 6, aesthetic: 6, lifestyle: 6, collector: 6, fit: 6 });
});

test('every frozen label uses only keys the matcher understands and explains each tier', () => {
  assert.deepEqual(FROZEN.filter(q => unknownLabelKeys(q).length > 0).map(q => q.id), []);
  assert.deepEqual(FROZEN.flatMap(q => q.rubric.filter(t => !t.why || t.why.length < 12).map(() => q.id)), []);
});

test('the key list matches what matchesTruth actually reads', () => {
  // Guards the guard: a new predicate added to matchesTruth but not to TRUTH_KEYS would make
  // every label using it fail validation, and a removed one would let dead keys through.
  const source = matchesTruth.toString();
  const read = new Set([...source.matchAll(/truth\.(\w+)/g)].map(m => m[1]));
  assert.deepEqual([...read].sort(), [...TRUTH_KEYS].sort());
});

test('an unknown key is reported by name', () => {
  assert.deepEqual(unknownTruthKeys({ diamterMax: 40, priceMax: 1 }), ['diamterMax']);
  assert.deepEqual(unknownTruthKeys({ diameterMax: 40 }), []);
});

test('validation rejects a misspelt key before judging breadth', () => {
  const catalogue = { records: [record({ id: 1 }), record({ id: 2 })] };
  const [q] = validateQueries(catalogue, [{ id: 'x', category: 'size', query: 'q', truth: { diamterMax: 40 } }]);
  assert.equal(q.status, 'invalid_key');
  assert.deepEqual(q.badKeys, ['diamterMax']);
});

test('validation flags empty, too broad and thin labels', () => {
  const catalogue = { records: Array.from({ length: 10 }, (_, i) => record({ id: i + 1 })) };
  const statuses = validateQueries(catalogue, [
    { id: 'empty', category: 'dial', query: 'q', truth: { dialAny: ['blue'] } },
    { id: 'broad', category: 'dial', query: 'q', truth: { dialAny: ['black'] } },
    { id: 'thin', category: 'size', query: 'q', truth: { ids: [1] } },
    // Reference lookups have exactly one right answer by design, so one match is not thin.
    { id: 'ref', category: 'reference', query: 'q', truth: { ids: [1] } },
    { id: 'ok', category: 'size', query: 'q', truth: { ids: [1, 2] } },
  ]).map(q => [q.id, q.status]);
  assert.deepEqual(statuses, [
    ['empty', 'empty'], ['broad', 'too_broad'], ['thin', 'thin'], ['ref', 'ok'], ['ok', 'ok'],
  ]);
});
