/**
 * useCmsContent — single hook som leser CMS-styrt innhold med
 * profesjon- og locale-fallback. Brukes av alle CreatorHub-flater
 * (landing, dashboard, BI, klient-galleri) for å hente tekst, copy
 * og branding-tokens fra `/api/cms/content/:key`.
 *
 * Filosofi: hardcoded UI-tekster er en anti-pattern når du har
 * profesjon-aware UX. Bytt ut `<Typography>Galleri</Typography>` med
 * `<Typography>{cms('gallery.heading', 'Galleri')}</Typography>` —
 * default-verdi er bevart hvis CMS-rad ikke finnes.
 *
 * To bruksformer:
 *   - useCmsContent(key, defaultValue) — hent én tekst-streng
 *   - useCmsObject<T>(key, defaultObj) — hent et JSON-payload
 *
 * Cache: React Query med 5min staleTime så CMS-endringer propagerer
 * relativt raskt mens vi unngår fetch-storm. Profesjon + locale i
 * cache-key så ulike kontekster ikke kolliderer.
 */

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';

interface CmsContentResponse {
  key: string;
  contentType: string | null;
  profession: string | null;
  locale: string;
  payload: Record<string, unknown>;
  updatedAt: string;
}

/**
 * Hent én CMS-streng. Default-verdi vinner hvis CMS-rad mangler eller
 * payload ikke har en `value`-felt. Brukes for enkle tekst-overrides:
 *
 *   const heading = useCmsContent('dashboard.hero.heading', 'Velkommen');
 */
export function useCmsContent(key: string, defaultValue = ''): string {
  const { user } = useAuth();
  const profession = user?.profession;
  const locale = 'nb-NO'; // future: from useLanguage()
  const { data } = useQuery<CmsContentResponse | null>({
    queryKey: ['/api/cms/content', key, profession ?? null, locale],
    queryFn: async () => {
      try {
        const params = new URLSearchParams({ locale });
        if (profession) params.set('profession', profession);
        return (await apiRequest(`/api/cms/content/${encodeURIComponent(key)}?${params}`)) as CmsContentResponse;
      } catch {
        return null;
      }
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
  const raw = data?.payload?.value;
  return typeof raw === 'string' && raw.length > 0 ? raw : defaultValue;
}

/**
 * Hent et CMS-payload som typed objekt. Brukes for design-tokens,
 * lister, eller komplekse component-konfig:
 *
 *   const tokens = useCmsObject<LandingTokens>('design.tokens', defaults);
 */
export function useCmsObject<T extends Record<string, unknown>>(
  key: string,
  defaultValue: T,
): T {
  const { user } = useAuth();
  const profession = user?.profession;
  const locale = 'nb-NO';
  const { data } = useQuery<CmsContentResponse | null>({
    queryKey: ['/api/cms/content', key, profession ?? null, locale],
    queryFn: async () => {
      try {
        const params = new URLSearchParams({ locale });
        if (profession) params.set('profession', profession);
        return (await apiRequest(`/api/cms/content/${encodeURIComponent(key)}?${params}`)) as CmsContentResponse;
      } catch {
        return null;
      }
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
  if (!data?.payload || typeof data.payload !== 'object') return defaultValue;
  return { ...defaultValue, ...(data.payload as Partial<T>) } as T;
}
