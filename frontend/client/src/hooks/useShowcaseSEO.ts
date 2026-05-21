/**
 * useShowcaseSEO — Slice 9X.81
 *
 * Setter meta-tags (document.title, description, og:*, twitter:*,
 * canonical, JSON-LD) for showcase-pages. Reverter ved unmount slik
 * at SPA-navigasjon ikke lekker stale meta til neste side.
 *
 * Bruk i stedet for react-helmet — ingen ekstra dependency.
 */

import { useEffect } from 'react';

export type ShowcaseProfession = 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise';

interface ShowcaseSEOInput {
  profession: ShowcaseProfession;
  displayName?: string | null;     // Stine Hansen / Bjarne Olsen
  city?: string | null;            // Oslo
  bio?: string | null;             // free-form text for description
  ogImageUrl?: string | null;
  canonicalUrl?: string | null;
}

const PROFESSION_LABELS: Record<ShowcaseProfession, { no: string; en: string; service: string }> = {
  photographer:    { no: 'Fotograf',         en: 'Photographer',    service: 'PhotographyService' },
  videographer:    { no: 'Videograf',        en: 'Videographer',    service: 'VideoService' },
  music_producer:  { no: 'Musikkprodusent',  en: 'Music Producer',  service: 'MusicGroup' },
  vendor:          { no: 'Leverandør',       en: 'Vendor',          service: 'LocalBusiness' },
  enterprise:      { no: 'Enterprise',       en: 'Enterprise',      service: 'Organization' },
};

function setMetaTag(name: string, content: string, attr: 'name' | 'property' = 'name') {
  if (!content) return;
  let tag = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, name);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function setLinkTag(rel: string, href: string) {
  if (!href) return;
  let tag = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!tag) {
    tag = document.createElement('link');
    tag.setAttribute('rel', rel);
    document.head.appendChild(tag);
  }
  tag.setAttribute('href', href);
}

function setJsonLd(id: string, json: Record<string, any>) {
  let tag = document.getElementById(id) as HTMLScriptElement | null;
  if (!tag) {
    tag = document.createElement('script');
    tag.id = id;
    tag.setAttribute('type', 'application/ld+json');
    document.head.appendChild(tag);
  }
  tag.textContent = JSON.stringify(json);
}

function removeJsonLd(id: string) {
  const tag = document.getElementById(id);
  if (tag) tag.remove();
}

export function useShowcaseSEO(input: ShowcaseSEOInput): void {
  const { profession, displayName, city, bio, ogImageUrl, canonicalUrl } = input;

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const labels = PROFESSION_LABELS[profession];
    const personName = (displayName || '').trim();
    const titleSegment = personName
      ? `${personName} — ${labels.no}${city ? ' i ' + city : ''}`
      : `${labels.no}${city ? ' i ' + city : ''} | CreatorHub`;

    const desc = (bio || '').trim().slice(0, 160)
      || `Portefølje og bookingside for ${labels.no.toLowerCase()}${personName ? ' ' + personName : ''}${city ? ' i ' + city : ''}. Levert av CreatorHub.`;

    const prevTitle = document.title;
    document.title = titleSegment;

    setMetaTag('description', desc);
    setMetaTag('og:title', titleSegment, 'property');
    setMetaTag('og:description', desc, 'property');
    setMetaTag('og:type', 'profile', 'property');
    setMetaTag('og:site_name', 'CreatorHub', 'property');
    setMetaTag('twitter:card', ogImageUrl ? 'summary_large_image' : 'summary');
    setMetaTag('twitter:title', titleSegment);
    setMetaTag('twitter:description', desc);

    if (ogImageUrl) {
      setMetaTag('og:image', ogImageUrl, 'property');
      setMetaTag('twitter:image', ogImageUrl);
    }

    const resolvedCanonical = canonicalUrl
      || (typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '');
    if (resolvedCanonical) {
      setLinkTag('canonical', resolvedCanonical);
      setMetaTag('og:url', resolvedCanonical, 'property');
    }

    // Slice 9X.81 — Structured data (schema.org). Person + ProfessionalService
    // gjør at Google viser knowledge-panel + service-snippet i søkeresultat.
    const jsonLd: Record<string, any> = {
      '@context': 'https://schema.org',
      '@type': labels.service,
      name: personName || `${labels.no} på CreatorHub`,
      description: desc,
      url: resolvedCanonical || undefined,
      areaServed: city || undefined,
      image: ogImageUrl || undefined,
      provider: personName
        ? {
            '@type': 'Person',
            name: personName,
            jobTitle: labels.no,
            address: city ? { '@type': 'PostalAddress', addressLocality: city, addressCountry: 'NO' } : undefined,
          }
        : undefined,
    };
    // Strip undefined keys for cleanest output
    Object.keys(jsonLd).forEach((k) => jsonLd[k] === undefined && delete jsonLd[k]);
    setJsonLd('showcase-jsonld', jsonLd);

    return () => {
      document.title = prevTitle;
      removeJsonLd('showcase-jsonld');
      // Meta-tags beholdes (SPA-navigasjon erstatter dem på neste useShowcaseSEO-kall)
    };
  }, [profession, displayName, city, bio, ogImageUrl, canonicalUrl]);
}
