export function readAcademyRedirectTarget(): string {
  if (typeof window === 'undefined') {
    return '/academy';
  }

  const { pathname, search, hash } = window.location;
  const target = `${pathname}${search}${hash}`;

  return /^\/academy(?:$|[/-])/.test(pathname) || pathname === '/academy-dashboard'
    ? target
    : '/academy';
}
