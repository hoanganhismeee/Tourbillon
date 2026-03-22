// Redirects legacy /search?q=... to the unified /smart-search page.
import { redirect } from 'next/navigation';

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  if (q) {
    redirect(`/smart-search?q=${encodeURIComponent(q)}`);
  }
  redirect('/');
}
