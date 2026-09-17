// Tests for structured filter accuracy. The metric is only as honest as its mapping from labels to
// slots, so each mapping rule that could inflate or deflate it is pinned here.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { expectedSlots, parsedSlots, scoreSlots, summariseSlots } from './slots.mjs';

const catalogue = {
  brands: [{ id: 1, name: 'Omega' }, { id: 2, name: 'Rolex' }],
  collections: [{ id: 5, name: 'Speedmaster', brandId: 1 }],
};

test('labels map to the slots a parser can hold, and the Price on Request floor is ignored', () => {
  const slots = expectedSlots(
    { dialAny: ['blue'], functionsAny: ['chronograph'], priceMin: 1, priceMax: 30000, strapAny: ['leather'] },
    catalogue);
  assert.deepEqual(Object.keys(slots).sort(), ['complication', 'dial', 'maxPrice']);
});

test('a correct parse matches every slot with nothing extra', () => {
  const result = scoreSlots(
    { dialAny: ['blue'], functionsAny: ['chronograph'], priceMin: 1, priceMax: 30000 },
    { dialColour: 'Blue', complications: ['Chronograph'], maxPrice: 30000 },
    catalogue);
  assert.deepEqual(result.matched.sort(), ['complication', 'dial', 'maxPrice']);
  assert.deepEqual([result.wrong, result.missed, result.extra], [[], [], []]);
});

test('a wrong value, a missed slot and an invented slot are told apart', () => {
  const result = scoreSlots(
    { brand: 'Omega', diameterMax: 38, styleAny: ['dress'] },
    { brandId: 2, style: 'dress', caseMaterial: 'Gold' },
    catalogue);
  assert.deepEqual(result.matched, ['style']);
  assert.deepEqual(result.wrong, ['brand']);
  assert.deepEqual(result.missed, ['maxDiameter']);
  assert.deepEqual(result.extra, ['material']);
});

test('numeric slots allow a tolerance so a parsed band can differ from a label band', () => {
  assert.deepEqual(scoreSlots({ priceMin: 35000, priceMax: 65000 }, { minPrice: 40000, maxPrice: 60000 }, catalogue).matched.sort(),
    ['maxPrice', 'minPrice']);
  assert.deepEqual(scoreSlots({ waterResistanceMin: 300 }, { waterResistance: '200' }, catalogue).matched, ['waterResistance']);
  assert.deepEqual(scoreSlots({ waterResistanceMin: 300 }, { waterResistance: '100' }, catalogue).wrong, ['waterResistance']);
});

test('a collection suggested from a style is not a parsed constraint', () => {
  assert.deepEqual(parsedSlots({ style: 'diver', collectionId: 5, collectionsDerivedFromStyle: true }), ['style']);
});

test('a brand inferred from the named collection is not counted as extra', () => {
  const result = scoreSlots({ collection: 'Speedmaster' }, { collectionId: 5, brandId: 1 }, catalogue);
  assert.deepEqual(result.matched, ['collection']);
  assert.deepEqual(result.extra, []);
});

test('negations match on the excluded lists', () => {
  const result = scoreSlots(
    { materialNone: ['gold'], functionsNone: ['chronograph'], excludeBrand: ['Rolex'] },
    { excludedMaterials: ['gold'], excludedComplications: ['Chronograph'], excludedBrandIds: [2] },
    catalogue);
  assert.deepEqual(result.matched.sort(), ['excludedBrand', 'excludedComplication', 'excludedMaterial']);
});

test('the summary reports recall, precision and exact matches, skipping slot-free labels', () => {
  const summary = summariseSlots([
    { expected: 2, matched: ['a', 'b'], wrong: [], missed: [], extra: [] },
    { expected: 2, matched: ['a'], wrong: [], missed: ['b'], extra: ['c'] },
    { expected: 0, matched: [], wrong: [], missed: [], extra: ['d'] },
  ]);
  assert.equal(summary.queries, 2);
  assert.equal(summary.slotRecall, 3 / 4);
  assert.equal(summary.slotPrecision, 3 / 4);
  assert.equal(summary.exactMatch, 1 / 2);
  assert.deepEqual(summary.perSlot.b, { matched: 1, wrong: 0, missed: 1 });
});
