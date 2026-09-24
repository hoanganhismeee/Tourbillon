// Tests for the retrieval metrics. Run: node --test eval/metrics.test.mjs
//
// recallCeiling exists because raw recall@k silently conflates two different things: how well
// the system ranks, and how many watches the label happens to match. Reporting 0.13 without
// saying the ceiling was 0.13 reads as a failure when it is a perfect score.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  recallAtK, precisionAtK, reciprocalRank, ndcgAtK, recallCeiling, percentile, significance,
  gain, gainAtK, ndcgAtKGraded, usefulHitAtK, violationRateAtK,
} from './metrics.mjs';

const relevant = new Set([1, 2, 3]);

test('recall counts hits inside the cutoff only', () => {
  assert.equal(recallAtK([1, 2, 9, 9, 9], relevant, 10), 2 / 3);
  assert.equal(recallAtK([9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 1], relevant, 10), 0);
});

test('precision divides by k, not by the result count', () => {
  // Three relevant results out of a possible five is not perfect precision.
  assert.equal(precisionAtK([1, 2, 3], relevant, 5), 3 / 5);
});

test('reciprocal rank rewards the first hit being early', () => {
  assert.equal(reciprocalRank([1, 9, 9], relevant, 10), 1);
  assert.equal(reciprocalRank([9, 1, 9], relevant, 10), 0.5);
  assert.equal(reciprocalRank([9, 9, 9], relevant, 10), 0);
});

test('ndcg is 1 when the relevant items lead', () => {
  assert.equal(ndcgAtK([1, 2, 3, 9, 9], relevant, 10), 1);
  assert.ok(ndcgAtK([9, 1, 2, 3], relevant, 10) < 1);
});

// -- The ceiling ---------------------------------------------------------------

test('a label smaller than k allows a perfect score', () => {
  assert.equal(recallCeiling(3, 10), 1);
  assert.equal(recallCeiling(10, 10), 1);
});

test('a label larger than k caps recall below one', () => {
  assert.equal(recallCeiling(20, 10), 0.5);
  // The case that made this necessary: 76 matching watches, so 0.13 is a perfect score.
  assert.ok(Math.abs(recallCeiling(76, 10) - 0.1316) < 0.001);
});

test('an empty label has no ceiling to report', () => {
  assert.equal(recallCeiling(0, 10), null);
  assert.equal(recallCeiling(null, 10), null);
});

test('a perfect ranking scores exactly its ceiling', () => {
  const big = new Set(Array.from({ length: 20 }, (_, i) => i + 1));
  const perfect = Array.from({ length: 10 }, (_, i) => i + 1);

  assert.equal(recallAtK(perfect, big, 10), recallCeiling(big.size, 10));
});

test('percentile uses nearest rank', () => {
  assert.equal(percentile([1, 2, 3, 4, 5], 50), 3);
  assert.equal(percentile([1, 2, 3, 4, 5], 100), 5);
  assert.equal(percentile([], 50), null);
});

test('an interval entirely above zero is a significant improvement', () => {
  assert.equal(significance({ lo: 0.01, hi: 0.2 }), 'better');
});

test('an interval entirely below zero is a significant regression, not noise', () => {
  // The first version checked only the lower bound and labelled this "not significant".
  assert.equal(significance({ lo: -0.253, hi: -0.074 }), 'worse');
});

test('an interval that crosses zero is inconclusive', () => {
  assert.equal(significance({ lo: -0.05, hi: 0.1 }), 'not significant');
  assert.equal(significance({ lo: 0, hi: 0.1 }), 'not significant');
  assert.equal(significance(null), 'not significant');
});

// -- Graded metrics -----------------------------------------------------------
// The open-ended half is judged 0-3. These hold the properties that make the grades worth having:
// a near miss scores something, an ideal answer first scores more than an ideal answer fourth,
// and a constraint the brief stated is counted rather than averaged into the mean.

const grades = new Map([[1, 3], [2, 2], [3, 1]]);

test('a near miss scores instead of counting as a failure', () => {
  // Binary relevance scored this list 0; the grade-2 result is now worth something.
  assert.ok(gainAtK([2, 9, 9], grades, 3) > 0);
  assert.equal(gainAtK([9, 9, 9], grades, 3), 0);
});

test('nDCG rewards the best answer first', () => {
  const best = ndcgAtKGraded([1, 2, 3], grades, 3);
  const worst = ndcgAtKGraded([3, 2, 1], grades, 3);
  assert.equal(best, 1);
  assert.ok(worst < best);
});

test('nDCG normalises against the grades available, not a perfect list', () => {
  // Only one grade-3 exists, so surfacing it first is full marks even though slots 2 and 3 are weaker.
  assert.equal(ndcgAtKGraded([1, 2, 3], new Map([[1, 3], [2, 2], [3, 1]]), 3), 1);
});

test('a hit needs grade 2 or better', () => {
  assert.equal(usefulHitAtK([3, 9, 9], grades, 3), 0);  // grade 1 is defensible, not useful
  assert.equal(usefulHitAtK([2, 9, 9], grades, 3), 1);
});

test('violations are counted over what was shown, not over the catalogue', () => {
  assert.equal(violationRateAtK([5, 6, 1], new Set([5, 6]), 3), 2 / 3);
  assert.equal(violationRateAtK([], new Set([5]), 3), null);
});

test('gain is exponential so one excellent result beats two adequate ones', () => {
  assert.ok(gain(3) > 2 * gain(2));
});
