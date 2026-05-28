import { useEffect } from 'react';
import CastingScamSignsPage from './CastingScamSignsPage';
import ChildConsentFilmPage from './ChildConsentFilmPage';
import CastingReport2026Page from './CastingReport2026Page';
import BehindTheCastPage from './BehindTheCastPage';
import FounderPovPage from './FounderPovPage';
import SelvtapeTipsPage from './SelvtapeTipsPage';
import OperativsystemPage from './OperativsystemPage';
import NorskCastingOrdlistePage from './NorskCastingOrdlistePage';
import ArbeidstilsynetGuidePage from './ArbeidstilsynetGuidePage';
import SentimentalValueEffektenPage from './SentimentalValueEffektenPage';
import CrewINorgePage from './CrewINorgePage';
import InnspillingsdagKoordineringPage from './InnspillingsdagKoordineringPage';
import IntimacyCoordinatorPage from './IntimacyCoordinatorPage';
import KameraFolkVerktoyPage from './KameraFolkVerktoyPage';
import EtterproduksjonNorgePage from './EtterproduksjonNorgePage';
import ProduksjonsOSPage from './ProduksjonsOSPage';
import InnholdsprodusentPage from './InnholdsprodusentPage';
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
    case 'bak-castingen':
      return <BehindTheCastPage />;
    case 'vart-syn':
      return <FounderPovPage />;
    case 'selvtape-tips':
      return <SelvtapeTipsPage />;
    case 'operativsystem':
      return <OperativsystemPage />;
    case 'norsk-casting-ordliste':
      return <NorskCastingOrdlistePage />;
    case 'arbeidstilsynet-guide-produksjon':
      return <ArbeidstilsynetGuidePage />;
    case 'sentimental-value-effekten':
      return <SentimentalValueEffektenPage />;
    case 'crew-i-norge-2026':
      return <CrewINorgePage />;
    case 'innspillingsdag-koordinering':
      return <InnspillingsdagKoordineringPage />;
    case 'intimacy-coordinator-norge':
      return <IntimacyCoordinatorPage />;
    case 'kamera-folk-verktoy-2026':
      return <KameraFolkVerktoyPage />;
    case 'etterproduksjon-norge-2026':
      return <EtterproduksjonNorgePage />;
    case 'produksjons-os':
      return <ProduksjonsOSPage />;
    case 'innholdsprodusent-norge':
      return <InnholdsprodusentPage />;
    default:
      return null;
  }
}

export default MarketingPageRouter;
