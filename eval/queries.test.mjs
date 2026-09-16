// Structural tests for the golden set. None of them need the live catalogue: they catch the label
// mistakes that would otherwise surface as a plausible score, such as a misspelt truth key that
// silently widens a label, or a new category that falls into the wrong scope.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { HANDWRITTEN, SCOPE_BY_CATEGORY, scopeOf, validateQueries } from './queries.mjs';
import { TRUTH_KEYS, matchesTruth, unknownTruthKeys } from './catalogue.mjs';

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

test('every handwritten truth uses only keys the matcher understands', () => {
  const bad = HANDWRITTEN
    .map(q => ({ id: q.id, keys: unknownTruthKeys(q.truth) }))
    .filter(q => q.keys.length > 0);
  assert.deepEqual(bad, []);
});

test('every handwritten query states at least one constraint', () => {
  const unconstrained = HANDWRITTEN.filter(q => Object.keys(q.truth ?? {}).length === 0).map(q => q.id);
  assert.deepEqual(unconstrained, []);
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
