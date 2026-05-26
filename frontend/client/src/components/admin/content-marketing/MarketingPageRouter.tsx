import { useEffect } from 'react';
import CastingScamSignsPage from './CastingScamSignsPage';
import ChildConsentFilmPage from './ChildConsentFilmPage';
import CastingReport2026Page from './CastingReport2026Page';
import { getMarketingPageConfig, type MarketingPageKey } from './marketingPagesConfig';

/**
 * Renderer riktig marketing-side basert på key fra parseMarketingPagePath.
 * Setter også document.title + canonical fra config så SEO-stempelet
 * stemmer per rute (i tillegg til JSON-LD som ligger i theroleroom.html).
 */
export function MarketingPageRouter({ pageKey }: { pageKey: MarketingPageKey }) {
  const config = getMarketingPageConfig(pageKey);

  useEffect(() => {
    if (!config || typeof document === 'undefined') return;
    document.title = config.title;
    const setMeta = (selector: string, attr: string, value: string) => {
      const el = document.querySelector(selector);
      if (el) el.setAttribute(attr, value);
    };
    setMeta('meta[name="description"]', 'content', config.description);
    setMeta('link[rel="canonical"]', 'href', `https://theroleroom.com${config.path}`);
    setMeta('meta[property="og:title"]', 'content', config.title);
    setMeta('meta[property="og:description"]', 'content', config.description);
    setMeta('meta[property="og:url"]', 'content', `https://theroleroom.com${config.path}`);
    setMeta('meta[name="twitter:title"]', 'content', config.title);
    setMeta('meta[name="twitter:description"]', 'content', config.description);
  }, [config]);

  if (!config) return null;

  switch (pageKey) {
    case 'casting-svindel-tegn':
      return <CastingScamSignsPage />;
    case 'barn-samtykke-film':
      return <ChildConsentFilmPage />;
    case 'casting-rapport-2026':
      return <CastingReport2026Page />;
    default:
      return null;
  }
}

export default MarketingPageRouter;
