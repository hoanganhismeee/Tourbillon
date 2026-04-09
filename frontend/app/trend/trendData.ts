// Hardcoded editorial data for the Trend page.
// Replace placeholder slugs with real watch slugs from the database before deploying.

export interface StaffPick {
  slug: string;
  video: string; // path relative to /public
}

// Each entry renders as a full-width video + watch card pair.
// Videos alternate sides (left on even index, right on odd) for editorial rhythm.
export const STAFF_PICKS: StaffPick[] = [
  { slug: 'jaeger-lecoultre-reverso-q389257j-chronograph', video: '/JLC.mp4' },
  { slug: 'audemars-piguet-26735sg-oo-1320sg-01-selfwinding-flying-tourbillon-openworked', video: '/AP.mp4' },
];

export const MOST_VIEWED_SLUGS: string[] = [
  'slug-viewed-1',
  'slug-viewed-2',
  'slug-viewed-3',
  'slug-viewed-4',
  'slug-viewed-5',
  'slug-viewed-6',
];
