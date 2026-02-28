const TRAILING_COMMAS = /,+$/;

const SUPPORTED_SCHEMES = new Set(['http:', 'https:', 'ws:', 'wss:']);

function trimTrailingCommas(value: string): string {
  return value.trim().replace(TRAILING_COMMAS, '');
}

function normalizePath(pathname: string): string {
  const segments = pathname
    .split('/')
    .map((segment, index) => (index === 0 ? segment : trimTrailingCommas(segment)));
  let normalized = segments.join('/').replace(/\/{2,}/g, '/');
  if (normalized.startsWith('api/')) normalized = `/${normalized}`;
  if (normalized !== '/' && normalized.endsWith('/')) normalized = normalized.slice(0, -1);
  return normalized || '/';
}

function normalizeSearch(searchParams: URLSearchParams): string {
  const normalized = new URLSearchParams();
  for (const [key, value] of searchParams.entries()) {
    const sanitizedKey = trimTrailingCommas(key);
    if (!sanitizedKey) continue;
    normalized.append(sanitizedKey, trimTrailingCommas(value));
  }
  const serialized = normalized.toString();
  return serialized ? `?${serialized}` : '';
}

export function normalizeRequestUrl(inputUrl: string): string {
  const trimmed = inputUrl.trim();
  if (!trimmed) return trimmed;

  let candidate = trimmed;
  if (candidate.startsWith('api/')) {
    candidate = `/${candidate}`;
  } else if (candidate.startsWith('./api/')) {
    candidate = candidate.replace(/^\.\//, '/');
  }

  const isAbsolute = /^[a-zA-Z][\w+.-]*:\/\//.test(candidate);
  const baseOrigin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'http://localhost';

  let parsed: URL;
  try {
    parsed = isAbsolute ? new URL(candidate) : new URL(candidate, baseOrigin);
  } catch {
    return candidate;
  }

  if (isAbsolute && !SUPPORTED_SCHEMES.has(parsed.protocol)) {
    return candidate;
  }

  const pathname = normalizePath(parsed.pathname);
  const search = normalizeSearch(parsed.searchParams);
  const hash = parsed.hash || '';

  if (isAbsolute) {
    return `${parsed.origin}${pathname}${search}${hash}`;
  }

  return `${pathname}${search}${hash}`;
}
