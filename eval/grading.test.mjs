// Tests for the spec-answer grader. Run: node --test eval/
//
// Every case here is a real answer shape observed from the concierge. The first four
// regression tests are the bugs that made the grader report a 33% hallucination rate when
// the true rate was 0%.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { grade, gradeNumber, gradeText, isOffTarget, statedNumbers } from './grading.mjs';

const HOURS = /hours?|hrs?|\bh\b/i;
const METRES = /\bm\b|metre|meter|bar|atm/i;
const MM = /mm|millimet/i;

// -- Regressions ---------------------------------------------------------------

test('a stated range counts as correct on both ends', () => {
  // Catalogue: "min. 38 - max. 48 hours" — the parsed expectation is 38.
  const answer = 'The Grand Complications 5304/301R-001 has a power reserve of **38–48 hours**.';
  assert.equal(gradeNumber(answer, 38, HOURS), 'correct');
  assert.equal(gradeNumber(answer, 48, HOURS), 'correct');
});

test('a generic product blurb is a non-answer, not a hallucination', () => {
  const answer = 'Breguet Marine Chronographe 5527 is the closest exact match in Tourbillon\'s '
    + 'catalogue. It sits in Marine from Breguet and is listed at Price on Request.';
  assert.equal(gradeText(answer, 'titanium', 'case material'), 'absent');
});

test('the unit pattern does not match the h in "watch"', () => {
  const answer = 'That watch is a fine choice for everyday wear.';
  assert.deepEqual(statedNumbers(answer, HOURS), []);
  assert.equal(gradeNumber(answer, 48, HOURS), 'absent');
});

test('a refusal is absent even when it names the reference', () => {
  const answer = 'I don\'t have a model with that reference in the supplied Tourbillon catalogue.';
  assert.equal(grade({
    answer, expected: 48, kind: 'number', unit: HOURS,
    field: 'power reserve', reference: '7200R-001',
  }), 'absent');
});

// -- Correct ---------------------------------------------------------------

test('the right figure with the right unit is correct', () => {
  assert.equal(gradeNumber('It is water resistant to 300 m.', 300, METRES), 'correct');
  assert.equal(gradeNumber('The case measures 40mm across.', 40, MM), 'correct');
});

test('a synonym of the stored value counts', () => {
  assert.equal(gradeText('The case is 18K pink gold.', '18k 5n rose gold', 'case material'), 'correct');
  assert.equal(gradeText('It is a self-winding movement.', 'automatic', 'movement type'), 'correct');
  assert.equal(gradeText('A hand-wound calibre.', 'manual', 'movement type'), 'correct');
});

test('a decimal expectation matches its stated figure', () => {
  assert.equal(gradeNumber('The case is 42.5 mm wide.', 42.5, MM), 'correct');
});

// -- Wrong ---------------------------------------------------------------

test('a different figure with the right unit is a hallucination', () => {
  assert.equal(gradeNumber('It has a 70 hour power reserve.', 48, HOURS), 'wrong');
});

test('a competing value from the same field is a hallucination', () => {
  assert.equal(gradeText('The dial is black.', 'blue', 'dial colour'), 'wrong');
  assert.equal(gradeText('The case is stainless steel.', 'titanium', 'case material'), 'wrong');
});

test('a value from a different field is not a hallucination about this one', () => {
  // Mentioning a colour says nothing about the case material.
  assert.equal(gradeText('It has a blue dial.', 'titanium', 'case material'), 'absent');
});

// -- Off target ---------------------------------------------------------------

test('an answer about another watch is off-target, not wrong', () => {
  const answer = 'Audemars Piguet Royal Oak Offshore 15605SK is the closest exact match.';
  assert.equal(isOffTarget(answer, 'SLGH005'), true);
  assert.equal(grade({
    answer, expected: 'silver', kind: 'text',
    field: 'dial colour', reference: 'SLGH005',
  }), 'off-target');
});

test('a partial reference still counts as on-target', () => {
  assert.equal(isOffTarget('The 5711/1A has a blue dial.', '5711/1A-010'), false);
});

test('off-target is checked before the value, so a wrong watch is never graded wrong', () => {
  // The answer states a colour, but for a different watch — that must not read as a lie
  // about the watch that was asked about.
  const answer = 'The Nautilus 5811/1G-001 has a blue dial.';
  assert.equal(grade({
    answer, expected: 'black', kind: 'text',
    field: 'dial colour', reference: 'M126503-0002',
  }), 'off-target');
});
