// Tests for action scoring. A wrong verdict here would report a useless comparison as relevant, so
// validity and relevance are pinned for each action type on a small synthetic catalogue.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCatalogueIndex, resolveHref, scoreCompare, scoreNavigate, scoreSearch, scoreActions, summariseActions,
} from './actions.mjs';

const catalogue = {
  records: [
    { id: 1, slug: 'w1', brandId: 10, collectionId: 100 },
    { id: 2, slug: 'w2', brandId: 10, collectionId: 100 },
    { id: 3, slug: 'w3', brandId: 10, collectionId: 101 },
    { id: 4, slug: 'w4', brandId: 11, collectionId: null },
  ],
  brands: [{ id: 10, slug: 'omega' }, { id: 11, slug: 'rolex' }],
  collections: [{ id: 100, slug: 'omega-speedmaster' }, { id: 101, slug: 'omega-seamaster' }],
};
const index = buildCatalogueIndex(catalogue);
const relevant = new Set([1, 2]);

test('hrefs resolve to the watches the page shows', () => {
  assert.deepEqual(resolveHref('/brands/omega', index), { kind: 'brands', ids: [1, 2, 3] });
  assert.deepEqual(resolveHref('/collections/omega-speedmaster', index), { kind: 'collections', ids: [1, 2] });
  assert.deepEqual(resolveHref('/watches/w4', index), { kind: 'watches', ids: [4] });
  assert.equal(resolveHref('/collections/unknown', index), null);
  assert.equal(resolveHref('/smart-search?q=x', index), null);
});

test('a comparison of two answer-set watches is relevant', () => {
  assert.deepEqual(scoreCompare({ slugs: ['w1', 'w2'] }, index, relevant),
    { type: 'compare', valid: true, score: 1, relevant: true });
});

test('a comparison with one watch outside the answer set is valid but not relevant', () => {
  const scored = scoreCompare({ slugs: ['w1', 'w3'] }, index, relevant);
  assert.equal(scored.valid, true);
  assert.equal(scored.score, 0.5);
  assert.equal(scored.relevant, false);
});

test('a comparison needs two distinct watches that exist', () => {
  assert.equal(scoreCompare({ slugs: ['w1'] }, index, relevant).valid, false);
  assert.equal(scoreCompare({ slugs: ['w1', 'w1'] }, index, relevant).valid, false);
  assert.equal(scoreCompare({ slugs: ['w1', 'missing'] }, index, relevant).valid, false);
});

test('a destination is relevant when at least half of it satisfies the brief', () => {
  assert.equal(scoreNavigate({ href: '/collections/omega-speedmaster' }, index, relevant).relevant, true);
  const brand = scoreNavigate({ href: '/brands/omega' }, index, relevant);
  assert.equal(brand.score, 2 / 3);
  assert.equal(brand.relevant, true);
  assert.equal(scoreNavigate({ href: '/collections/omega-seamaster' }, index, relevant).relevant, false);
  assert.equal(scoreNavigate({ href: '/nowhere' }, index, relevant).valid, false);
});

test('a hand-off search is scored on what it returns', async () => {
  const good = await scoreSearch({ query: 'speedmaster' }, async () => [1, 2, 3, 4], relevant);
  assert.equal(good.score, 2 / 5);
  assert.equal(good.relevant, true);
  const empty = await scoreSearch({ query: '  ' }, async () => [1], relevant);
  assert.equal(empty.valid, false);
});

test('cursor actions are not scored and replies are summarised per type', async () => {
  const scored = await scoreActions(
    [{ type: 'compare', slugs: ['w1', 'w2'] }, { type: 'set_cursor', cursor: 'x' }, { type: 'navigate', href: '/brands/rolex' }],
    { index, relevant, search: async () => [] });
  assert.deepEqual(scored.map(s => s.type), ['compare', 'navigate']);

  const summary = summariseActions([{ actionScores: scored }, { actionScores: [] }]);
  assert.equal(summary.replies, 2);
  assert.equal(summary.repliesWithActions, 1);
  assert.equal(summary.repliesWithRelevantAction, 1);
  assert.equal(summary.perType.compare.relevantRate, 1);
  assert.equal(summary.perType.navigate.relevantRate, 0);
  assert.equal(summary.perType.search.count, 0);
});
