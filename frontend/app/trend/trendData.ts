// Hardcoded editorial data for the Trend page.
// Replace placeholder slugs with real watch slugs from the database before deploying.
import { videoUrl } from '@/lib/cloudinary';

export interface StaffPick {
  slug: string;
  video?: string;
}

// Each entry renders as a full-width video + watch card pair.
export const STAFF_PICKS: StaffPick[] = [
  { slug: 'jaeger-lecoultre-reverso-q389257j-chronograph', video: videoUrl('JLC') },
  { slug: 'audemars-piguet-royal-oak-26735sg-oo-1320sg-01-selfwinding-flying-tourbillon-openworked', video: videoUrl('AP') },
  { slug: 'vacheron-constantin-metiers-d-art-6007a-000g-h049-tribute-to-the-celestial-scorpio' },
];

export const MOST_VIEWED_SLUGS: string[] = [
  'slug-viewed-1',
  'slug-viewed-2',
  'slug-viewed-3',
  'slug-viewed-4',
  'slug-viewed-5',
  'slug-viewed-6',
];
