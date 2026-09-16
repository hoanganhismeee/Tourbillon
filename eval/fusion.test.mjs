// Tests for reciprocal rank fusion. The fusion decides the ranking the hybrid arm is scored on,
// so a fault here would show up as a retrieval result rather than as an error, which is exactly
// the class of bug that made the first spec grader report a 33% hallucination rate.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { reciprocalRankFusion, rrfScores } from './fusion.mjs';

test('a single list comes back in its own order', () => {
  assert.deepEqual(reciprocalRankFusion([['a', 'b', 'c']]), ['a', 'b', 'c']);
});

test('first in both lists beats second in both lists', () => {
  assert.deepEqual(reciprocalRankFusion([['a', 'b'], ['a', 'b']]), ['a', 'b']);
});

test('an id both lists agree on outranks an id only one list puts first', () => {
  // The point of fusing: b is second in both lists, a and c are first in one and absent in
  // the other. Agreement across retrievers is worth more than one retriever's top pick.
  assert.deepEqual(reciprocalRankFusion([['a', 'b'], ['c', 'b']])[0], 'b');
});

test('k controls whether one first place outweighs agreement', () => {
  const lists = [['a', 'x', 'b'], ['y', 'z', 'b']];
  // Small k makes rank 1 dominant, so the id that is first anywhere wins.
  assert.equal(reciprocalRankFusion(lists, { k: 0.5 })[0], 'a');
  // Large k flattens the positions, so the id both lists returned wins instead.
  assert.equal(reciprocalRankFusion(lists, { k: 60 })[0], 'b');
});

test('weights let one retriever count for more', () => {
  const lists = [['a', 'b'], ['b', 'a']];
  assert.equal(reciprocalRankFusion(lists, { weights: [2, 1] })[0], 'a');
  assert.equal(reciprocalRankFusion(lists, { weights: [1, 2] })[0], 'b');
});

test('a repeated id is scored once, at its best position', () => {
  const { scores } = rrfScores([['a', 'a', 'b']], { k: 1 });
  assert.equal(scores.get('a'), 1 / 2);
  // b is third in the raw list but second once the duplicate is collapsed.
  assert.equal(scores.get('b'), 1 / 3);
});

test('empty and missing lists are ignored rather than throwing', () => {
  assert.deepEqual(reciprocalRankFusion([[], ['a']]), ['a']);
  assert.deepEqual(reciprocalRankFusion([null, ['a']]), ['a']);
  assert.deepEqual(reciprocalRankFusion([[], []]), []);
});

test('numeric watch ids keep numeric ordering when scores tie', () => {
  assert.deepEqual(reciprocalRankFusion([[10, 2], [2, 10]]), [2, 10]);
});

test('the same input always produces the same ranking', () => {
  const lists = [[3, 1, 2], [2, 3, 4]];
  assert.deepEqual(reciprocalRankFusion(lists), reciprocalRankFusion(lists));
});

test('mismatched weights and a non-positive k are rejected', () => {
  assert.throws(() => reciprocalRankFusion([['a'], ['b']], { weights: [1] }), /weights length/);
  assert.throws(() => reciprocalRankFusion([['a']], { k: 0 }), /k must be greater than 0/);
});
