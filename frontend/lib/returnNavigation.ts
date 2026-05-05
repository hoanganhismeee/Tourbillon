export function getSafeReturnTo(returnTo: string | null | undefined): string | null {
  if (!returnTo) return null;
  if (!returnTo.startsWith('/') || returnTo.startsWith('//')) return null;
  return returnTo;
}

export function withReturnTo(href: string, returnTo: string | null | undefined): string {
  const safeReturnTo = getSafeReturnTo(returnTo);
  if (!safeReturnTo) return href;

  const [path, query = ''] = href.split('?');
  const params = new URLSearchParams(query);
  params.set('returnTo', safeReturnTo);
  const search = params.toString();

  return search ? `${path}?${search}` : path;
}
