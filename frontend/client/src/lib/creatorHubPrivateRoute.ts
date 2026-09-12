const DEFAULT_PRIVATE_ROUTE = '/workspace';

export function creatorHubLoginPath(currentPath: string): string {
  const safeReturnPath = currentPath.startsWith('/') && !currentPath.startsWith('//')
    ? currentPath
    : DEFAULT_PRIVATE_ROUTE;
  return `/login?redirect=${encodeURIComponent(safeReturnPath)}`;
}
