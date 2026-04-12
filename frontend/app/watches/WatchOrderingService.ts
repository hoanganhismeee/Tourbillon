// Catalogue ordering service for the watches page.
// Keeps merchandising and personalization order logic out of the UI component.

import type { Brand, Collection, TasteProfile, Watch } from '@/lib/api';

export type SortOrder = 'default' | 'personalized' | 'price-asc' | 'price-desc';

interface WatchSpecsParsed {
  case?: { material?: string; diameter?: string };
  dial?: { color?: string };
}

interface TastePreferences {
  preferredBrandIds: number[];
  preferredMaterials: string[];
  preferredDialColors: string[];
  preferredCaseSize: TasteProfile['preferredCaseSize'];
  priceMin: number | null;
  priceMax: number | null;
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

interface FeaturedBrandRule {
  key: string;
  priority: number;
  weight: number;
}

interface FeaturedCollectionRule {
  key: string;
  priority: number;
}

interface BrandCapRule {
  untilPositionExclusive: number;
  cap: number;
}

export class WatchOrderingService {
  private static readonly featuredSeed = 'tourbillon-featured-v2';
  private static readonly personalizedWindowSize = 48;
  private static readonly personalizedMinScore = 1;

  private static readonly featuredBrandRules: FeaturedBrandRule[] = [
    { key: 'patek philippe', priority: 60, weight: 5 },
    { key: 'vacheron constantin', priority: 54, weight: 4 },
    { key: 'audemars piguet', priority: 50, weight: 4 },
    { key: 'rolex', priority: 46, weight: 4 },
    { key: 'jaeger lecoultre', priority: 40, weight: 3 },
    { key: 'omega', priority: 34, weight: 3 },
  ];

  private static readonly featuredCollectionRules: FeaturedCollectionRule[] = [
    { key: 'reverso', priority: 8 },
    { key: 'speedmaster', priority: 7 },
  ];

  private static readonly brandCapRules: BrandCapRule[] = [
    { untilPositionExclusive: 12, cap: 3 },
    { untilPositionExclusive: 24, cap: 5 },
  ];

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
    const preferences = this.getEffectivePreferences(profile);
    return (
      preferences.preferredBrandIds.length > 0 ||
      preferences.preferredMaterials.length > 0 ||
      preferences.preferredDialColors.length > 0 ||
      preferences.preferredCaseSize != null ||
      preferences.priceMin != null ||
      preferences.priceMax != null
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
    const preferences = this.getEffectivePreferences(profile);
    let score = 0;

    if (preferences.preferredBrandIds.includes(watch.brandId)) score += 3;

    const specs = this.parseSpecs(watch.specs);

    if (specs?.case?.material && preferences.preferredMaterials.length > 0) {
      const material = specs.case.material.toLowerCase();
      if (preferences.preferredMaterials.some(value => material.includes(value.toLowerCase()))) score += 2;
    }

    if (specs?.dial?.color && preferences.preferredDialColors.length > 0) {
      const color = specs.dial.color.toLowerCase();
      if (preferences.preferredDialColors.some(value => color.includes(value.toLowerCase()))) score += 2;
    }

    if (specs?.case?.diameter && preferences.preferredCaseSize) {
      const mmMatch = specs.case.diameter.match(/\d+\.?\d*/);
      if (mmMatch) {
        const mm = parseFloat(mmMatch[0]);
        const matches =
          preferences.preferredCaseSize === 'small' ? mm < 37 :
          preferences.preferredCaseSize === 'medium' ? mm >= 37 && mm <= 41 :
          mm > 41;
        if (matches) score += 1;
      }
    }

    if (watch.currentPrice > 0 && this.isWithinPreferredPriceRange(watch.currentPrice, preferences)) {
      score += 1;
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
    const identity = this.normalizeIdentity(`${brandSlug} ${brandName}`);
    return this.featuredBrandRules.find(rule => identity.includes(rule.key))?.priority ?? 0;
  }

  private static getFeaturedBrandWeight(brandSlug: string, brandName: string): number {
    const identity = this.normalizeIdentity(`${brandSlug} ${brandName}`);
    return this.featuredBrandRules.find(rule => identity.includes(rule.key))?.weight ?? 1;
  }

  private static getFeaturedCollectionPriority(collectionSlug: string, collectionName: string): number {
    const identity = this.normalizeIdentity(`${collectionSlug} ${collectionName}`);
    return this.featuredCollectionRules.find(rule => identity.includes(rule.key))?.priority ?? 0;
  }

  private static brandCapForPosition(position: number): number {
    return this.brandCapRules.find(rule => position < rule.untilPositionExclusive)?.cap ?? Number.POSITIVE_INFINITY;
  }

  private static getEffectivePreferences(profile?: TasteProfile): TastePreferences {
    return {
      preferredBrandIds: profile?.preferredBrandIds.length ? profile.preferredBrandIds : (profile?.behaviorPreferredBrandIds ?? []),
      preferredMaterials: profile?.preferredMaterials.length ? profile.preferredMaterials : (profile?.behaviorPreferredMaterials ?? []),
      preferredDialColors: profile?.preferredDialColors.length ? profile.preferredDialColors : (profile?.behaviorPreferredDialColors ?? []),
      preferredCaseSize: profile?.preferredCaseSize ?? profile?.behaviorPreferredCaseSize ?? null,
      priceMin: profile?.priceMin ?? profile?.behaviorPriceMin ?? null,
      priceMax: profile?.priceMax ?? profile?.behaviorPriceMax ?? null,
    };
  }

  private static isWithinPreferredPriceRange(price: number, preferences: TastePreferences): boolean {
    const { priceMin, priceMax } = preferences;
    if (priceMin == null && priceMax == null) return false;
    if (priceMin != null && priceMax != null) return price >= priceMin && price <= priceMax;
    if (priceMin != null) return price >= priceMin;
    return price <= (priceMax as number);
  }

  private static parseSpecs(specs: string | null): WatchSpecsParsed | null {
    try {
      return specs ? JSON.parse(specs) : null;
    } catch {
      return null;
    }
  }

  private static normalizeIdentity(value?: string | null): string {
    return (value ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
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
