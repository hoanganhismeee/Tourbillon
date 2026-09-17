// Scores the actions the concierge attaches to a reply, against the same labels as its cards.
// An action is valid when its target exists, and relevant when that target is what the labelled
// brief wants: compared watches from the answer set, a destination page whose watches mostly
// satisfy the brief, or a hand-off search whose own results do.

import { mean, precisionAtK } from './metrics.mjs';

// A destination page counts as relevant when at least half of its watches satisfy the brief.
export const NAVIGATE_RELEVANT_SHARE = 0.5;
// A hand-off search counts as relevant when two of its first five results satisfy the brief.
export const SEARCH_RELEVANT_PRECISION = 0.4;

/// Lookups from the slugs and ids an action can name to the watches behind them.
export function buildCatalogueIndex(catalogue) {
  const groupIds = key => {
    const groups = new Map();
    for (const record of catalogue.records) {
      const value = record[key];
      if (value == null) continue;
      if (!groups.has(value)) groups.set(value, []);
      groups.get(value).push(record.id);
    }
    return groups;
  };
  return {
    watchBySlug: new Map(catalogue.records.map(r => [r.slug, r.id])),
    brandBySlug: new Map(catalogue.brands.map(b => [b.slug, b.id])),
    collectionBySlug: new Map(catalogue.collections.map(c => [c.slug, c.id])),
    watchesByBrand: groupIds('brandId'),
    watchesByCollection: groupIds('collectionId'),
  };
}

/// The watches a navigate target shows, or null when the path is not a page the catalogue knows.
export function resolveHref(href, index) {
  const match = /^\/(watches|brands|collections)\/([^/?#]+)/.exec(href ?? '');
  if (!match) return null;
  const [, kind, slug] = match;
  if (kind === 'watches') {
    const id = index.watchBySlug.get(slug);
    return id == null ? null : { kind, ids: [id] };
  }
  const id = kind === 'brands' ? index.brandBySlug.get(slug) : index.collectionBySlug.get(slug);
  if (id == null) return null;
  const ids = (kind === 'brands' ? index.watchesByBrand : index.watchesByCollection).get(id) ?? [];
  return { kind, ids };
}

/// A comparison is valid with two or more distinct, existing watches; its score is the share of
/// them in the answer set, and it is relevant only when every compared watch is.
export function scoreCompare(action, index, relevant) {
  const slugs = action.slugs ?? [];
  const ids = slugs.map(slug => index.watchBySlug.get(slug));
  const distinct = new Set(ids.filter(id => id != null));
  const valid = slugs.length >= 2 && ids.every(id => id != null) && distinct.size === ids.length;
  const score = valid ? [...distinct].filter(id => relevant.has(id)).length / distinct.size : 0;
  return { type: 'compare', valid, score, relevant: valid && score === 1 };
}

/// A destination is scored by how much of what it shows satisfies the brief.
export function scoreNavigate(action, index, relevant) {
  const target = resolveHref(action.href, index);
  const valid = target != null && target.ids.length > 0;
  const score = valid ? target.ids.filter(id => relevant.has(id)).length / target.ids.length : 0;
  return {
    type: 'navigate', kind: target?.kind ?? 'unknown', valid, score,
    relevant: valid && score >= NAVIGATE_RELEVANT_SHARE,
  };
}

/// A hand-off search is scored by running it and reading precision@k of what comes back.
export async function scoreSearch(action, search, relevant, k = 5) {
  const query = (action.query ?? '').trim();
  if (!query) return { type: 'search', valid: false, score: 0, relevant: false };
  const score = precisionAtK(await search(query), relevant, k);
  return { type: 'search', valid: true, score, relevant: score >= SEARCH_RELEVANT_PRECISION };
}

export async function scoreActions(actions, { index, relevant, search }) {
  const scored = [];
  for (const action of actions ?? []) {
    const type = String(action.type ?? '').toLowerCase();
    if (type === 'compare') scored.push(scoreCompare(action, index, relevant));
    else if (type === 'navigate') scored.push(scoreNavigate(action, index, relevant));
    else if (type === 'search') scored.push(await scoreSearch(action, search, relevant));
    // set_cursor changes the pointer and recommends nothing, so it is not scored.
  }
  return scored;
}

/// Per-type validity and relevance, plus how many replies carried at least one relevant action.
export function summariseActions(rows) {
  const rate = (items, pick) => (items.length ? items.filter(pick).length / items.length : null);
  const perType = {};
  for (const type of ['compare', 'navigate', 'search']) {
    const items = rows.flatMap(r => (r.actionScores ?? []).filter(s => s.type === type));
    perType[type] = {
      count: items.length,
      validRate: rate(items, s => s.valid),
      relevantRate: rate(items, s => s.relevant),
      meanScore: mean(items.map(s => s.score)),
    };
  }
  const withActions = rows.filter(r => (r.actionScores ?? []).length > 0);
  return {
    perType,
    replies: rows.length,
    repliesWithActions: withActions.length,
    repliesWithRelevantAction: withActions.filter(r => r.actionScores.some(s => s.relevant)).length,
  };
}
