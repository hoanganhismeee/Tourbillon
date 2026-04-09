// Catalogue ordering service for the watches page.
// Keeps merchandising and personalization order logic out of the UI component.

import type { Brand, Collection, TasteProfile, Watch } from '@/lib/api';

export type SortOrder = 'default' | 'personalized' | 'price-asc' | 'price-desc';

interface WatchSpecsParsed {
  case?: { material?: string; diameter?: string };
  dial?: { color?: string };
}

type RankedWatch = {
  watch: Watch;
  baseIndex: number;
  score: number;
};

interface FeaturedBrandQueue {
  priority: number;
  weight: number;
  shown: number;
  queue: Watch[];
  tieBreaker: number;
}

export class WatchOrderingService {
  private static readonly featuredSeed = 'tourbillon-featured-v2';
  private static readonly personalizedWindowSize = 48;
  private static readonly personalizedMinScore = 1;

  static parseSortOrder(value: string | null): SortOrder {
    switch (value) {
      case 'personalized':
      case 'price-asc':
      case 'price-desc':
        return value;
      default:
        return 'default';
    }
  }

  static hasTastePreferences(profile?: TasteProfile): boolean {
    if (!profile) return false;

    return (
      profile.preferredBrandIds.length > 0 ||
      profile.preferredMaterials.length > 0 ||
      profile.preferredDialColors.length > 0 ||
      profile.preferredCaseSize != null ||
      profile.priceMin != null ||
      profile.priceMax != null
    );
  }

  static buildFeaturedOrder(
    watches: Watch[],
    brands: Brand[],
    collections: Collection[]
  ): Watch[] {
    const brandById = new Map(brands.map(brand => [brand.id, brand]));
    const collectionById = new Map(collections.map(collection => [collection.id, collection]));
    const brandBuckets = new Map<number, Watch[]>();

    for (const watch of watches) {
      if (!brandBuckets.has(watch.brandId)) brandBuckets.set(watch.brandId, []);
      brandBuckets.get(watch.brandId)!.push(watch);
    }

    const brandQueues: FeaturedBrandQueue[] = [...brandBuckets.entries()].map(([brandId, bucket]) => {
      const brand = brandById.get(brandId);
      return {
        priority: this.getFeaturedBrandPriority(brand?.slug ?? '', brand?.name ?? ''),
        weight: this.getFeaturedBrandWeight(brand?.slug ?? '', brand?.name ?? ''),
        shown: 0,
        queue: this.interleaveWithinBrand(bucket, collectionById, `${this.featuredSeed}:${brandId}`),
        tieBreaker: this.stableHash(`${this.featuredSeed}:brand:${brandId}`),
      };
    });

    const result: Watch[] = [];

    while (brandQueues.some(entry => entry.queue.length > 0)) {
      const available = brandQueues.filter(entry => entry.queue.length > 0);
      available.sort((a, b) => {
        const ratioA = a.shown / a.weight;
        const ratioB = b.shown / b.weight;
        if (ratioA !== ratioB) return ratioA - ratioB;
        if (a.priority !== b.priority) return b.priority - a.priority;
        return a.tieBreaker - b.tieBreaker;
      });

      const selected = available[0];
      const nextWatch = selected.queue.shift();
      if (!nextWatch) continue;

      result.push(nextWatch);
      selected.shown += 1;
    }

    return result;
  }

  static buildPersonalizedOrder(
    baseWatches: Watch[],
    tasteProfile: TasteProfile | undefined,
    isPersonalizationAvailable: boolean
  ): Watch[] {
    if (!isPersonalizationAvailable) return baseWatches;

    const ranked: RankedWatch[] = baseWatches.map((watch, baseIndex) => ({
      watch,
      baseIndex,
      score: tasteProfile ? this.scoreTasteMatch(watch, tasteProfile) : 0,
    }));

    const head = ranked.slice(0, this.personalizedWindowSize);
    const tail = ranked.slice(this.personalizedWindowSize);
    const promoted = head
      .filter(item => item.score >= this.personalizedMinScore)
      .sort((a, b) => b.score - a.score || a.baseIndex - b.baseIndex);

    if (promoted.length === 0) return baseWatches;

    const headByBaseOrder = [...head].sort((a, b) => a.baseIndex - b.baseIndex);
    const result: RankedWatch[] = [];
    const usedIds = new Set<number>();
    const deferred: RankedWatch[] = [];
    const brandCounts = new Map<number, number>();

    for (const candidate of promoted) {
      const count = brandCounts.get(candidate.watch.brandId) ?? 0;
      if (count >= this.brandCapForPosition(result.length)) {
        deferred.push(candidate);
        continue;
      }

      result.push(candidate);
      usedIds.add(candidate.watch.id);
      brandCounts.set(candidate.watch.brandId, count + 1);
    }

    for (const candidate of headByBaseOrder) {
      if (usedIds.has(candidate.watch.id)) continue;

      const count = brandCounts.get(candidate.watch.brandId) ?? 0;
      if (count >= this.brandCapForPosition(result.length)) {
        deferred.push(candidate);
        continue;
      }

      result.push(candidate);
      usedIds.add(candidate.watch.id);
      brandCounts.set(candidate.watch.brandId, count + 1);
    }

    for (const candidate of deferred.sort((a, b) => a.baseIndex - b.baseIndex)) {
      if (!usedIds.has(candidate.watch.id)) {
        result.push(candidate);
        usedIds.add(candidate.watch.id);
      }
    }

    return [...result, ...tail].map(item => item.watch);
  }

  private static scoreTasteMatch(watch: Watch, profile: TasteProfile): number {
    let score = 0;

    if (profile.preferredBrandIds.includes(watch.brandId)) score += 3;

    const specs: WatchSpecsParsed | null = (() => {
      try { return watch.specs ? JSON.parse(watch.specs) : null; } catch { return null; }
    })();

    if (specs?.case?.material && profile.preferredMaterials.length > 0) {
      const material = specs.case.material.toLowerCase();
      if (profile.preferredMaterials.some(value => material.includes(value.toLowerCase()))) score += 2;
    }

    if (specs?.dial?.color && profile.preferredDialColors.length > 0) {
      const color = specs.dial.color.toLowerCase();
      if (profile.preferredDialColors.some(value => color.includes(value.toLowerCase()))) score += 2;
    }

    if (specs?.case?.diameter && profile.preferredCaseSize) {
      const mmMatch = specs.case.diameter.match(/\d+\.?\d*/);
      if (mmMatch) {
        const mm = parseFloat(mmMatch[0]);
        const matches =
          profile.preferredCaseSize === 'small' ? mm < 37 :
          profile.preferredCaseSize === 'medium' ? mm >= 37 && mm <= 41 :
          mm > 41;
        if (matches) score += 1;
      }
    }

    if (profile.priceMin != null && profile.priceMax != null && watch.currentPrice > 0) {
      if (watch.currentPrice >= profile.priceMin && watch.currentPrice <= profile.priceMax) score += 1;
    }

    return score;
  }

  private static interleaveWithinBrand(
    watches: Watch[],
    collections: Map<number, Collection>,
    seed: string
  ): Watch[] {
    const byCollection = new Map<string, Watch[]>();

    for (const watch of watches) {
      const collection = watch.collectionId != null ? collections.get(watch.collectionId) : undefined;
      const key = collection?.slug ?? watch.collectionSlug ?? `watch:${watch.id}`;
      if (!byCollection.has(key)) byCollection.set(key, []);
      byCollection.get(key)!.push(watch);
    }

    const groups = [...byCollection.entries()]
      .sort((a, b) => this.stableHash(`${seed}:collection:${a[0]}`) - this.stableHash(`${seed}:collection:${b[0]}`))
      .map(([collectionKey, group]) =>
        [...group].sort((a, b) => {
          const collectionA = a.collectionId != null ? collections.get(a.collectionId) : undefined;
          const collectionB = b.collectionId != null ? collections.get(b.collectionId) : undefined;
          const scoreA = this.getFeaturedCollectionPriority(collectionA?.slug ?? a.collectionSlug ?? '', collectionA?.name ?? '');
          const scoreB = this.getFeaturedCollectionPriority(collectionB?.slug ?? b.collectionSlug ?? '', collectionB?.name ?? '');
          if (scoreA !== scoreB) return scoreB - scoreA;
          return this.stableHash(`${seed}:watch:${collectionKey}:${a.id}`) - this.stableHash(`${seed}:watch:${collectionKey}:${b.id}`);
        })
      );

    const result: Watch[] = [];
    const maxLength = Math.max(...groups.map(group => group.length));
    for (let i = 0; i < maxLength; i++) {
      for (const group of groups) {
        if (i < group.length) result.push(group[i]);
      }
    }

    return result;
  }

  private static getFeaturedBrandPriority(brandSlug: string, brandName: string): number {
    const slug = this.normalizeToken(brandSlug);
    const name = this.normalizeToken(brandName);

    if (slug === 'patek-philippe' || name === 'patek philippe') return 60;
    if (slug === 'vacheron-constantin' || name === 'vacheron constantin') return 54;
    if (slug === 'audemars-piguet' || name === 'audemars piguet') return 50;
    if (slug === 'rolex' || name === 'rolex') return 46;
    if (slug === 'jaeger-lecoultre' || name === 'jaeger-lecoultre' || name === 'jaeger lecoultre') return 40;
    if (slug === 'omega' || name === 'omega') return 34;
    return 0;
  }

  private static getFeaturedBrandWeight(brandSlug: string, brandName: string): number {
    const slug = this.normalizeToken(brandSlug);
    const name = this.normalizeToken(brandName);

    if (slug === 'patek-philippe' || name === 'patek philippe') return 5;
    if (slug === 'vacheron-constantin' || name === 'vacheron constantin') return 4;
    if (slug === 'audemars-piguet' || name === 'audemars piguet') return 4;
    if (slug === 'rolex' || name === 'rolex') return 4;
    if (slug === 'jaeger-lecoultre' || name === 'jaeger-lecoultre' || name === 'jaeger lecoultre') return 3;
    if (slug === 'omega' || name === 'omega') return 3;
    return 1;
  }

  private static getFeaturedCollectionPriority(collectionSlug: string, collectionName: string): number {
    const slug = this.normalizeToken(collectionSlug);
    const name = this.normalizeToken(collectionName);

    if (slug.includes('reverso') || name.includes('reverso')) return 8;
    if (slug.includes('speedmaster') || name.includes('speedmaster')) return 7;
    return 0;
  }

  private static brandCapForPosition(position: number): number {
    if (position < 12) return 3;
    if (position < 24) return 5;
    return Number.POSITIVE_INFINITY;
  }

  private static normalizeToken(value?: string | null): string {
    return value?.trim().toLowerCase() ?? '';
  }

  private static stableHash(input: string): number {
    let hash = 2166136261;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }
}
