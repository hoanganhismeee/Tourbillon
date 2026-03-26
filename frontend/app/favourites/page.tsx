// Thin server wrapper — all state and data fetching happens in FavouritesClient.
export const dynamic = 'force-dynamic';

import FavouritesClient from './FavouritesClient';

export default function FavouritesPage() {
  return <FavouritesClient />;
}
