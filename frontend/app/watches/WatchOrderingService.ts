// Watches-page UI helpers. The featured/personalized ranking and taste scoring now live
// server-side (backend CatalogueOrderingService); this file only parses the sort URL param
// and decides whether the signed-in user has enough taste signal to offer personalized sort.

import type { TasteProfile } from '@/lib/api';

export type SortOrder = 'default' | 'personalized' | 'price-asc' | 'price-desc';

interface TastePreferences {
  preferredBrandIds: number[];
  preferredMaterials: string[];
  preferredDialColors: string[];
  preferredCaseSize: TasteProfile['preferredCaseSize'];
  priceMin: number | null;
  priceMax: number | null;
}

export class WatchOrderingService {
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

  // Manual taste wins; behavior analysis fills gaps. Mirrors the backend merge so the
  // client's "offer personalized sort?" decision matches what the server would rank.
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
}
