/**
 * useCmsBlocks.ts
 *
 * Felles hook for å konsumere block-CMS-innhold på frontend-sider.
 * Henter `/api/cms/pages/:slug` ved mount, lytter på postMessage-
 * meldinger fra AdminRoom-editoren for live-preview, og returnerer
 * blokk-listen (eller null hvis siden ikke har CMS-overrides).
 *
 * Sider som bruker dette: StudentSEOPage, CompetitorComparisonPage,
 * CastingLandingPage, TalentPortalView, EducationPartnershipPage,
 * PressKitPage.
 */

import { useEffect, useState } from 'react';
import { isBlockArray, type Block } from './blockSchema';

export function useCmsBlocks(slug: string): Block[] | null {
  const [blocks, setBlocks] = useState<Block[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/cms/pages/${slug}`, { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.success || !data?.page?.content) return;
        const content = data.page.content as Record<string, unknown>;
        if (isBlockArray(content.blocks)) {
          setBlocks(content.blocks);
        }
      })
      .catch(() => {
        // Stillegående fallback — hardkodet innhold rendres.
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'object') return;
      const msg = event.data as { type?: string; pageKey?: string; content?: Record<string, unknown> };
      if (msg.type !== 'roleroom-cms-preview') return;
      if (msg.pageKey !== slug) return;
      if (!msg.content || typeof msg.content !== 'object') return;
      if (isBlockArray(msg.content.blocks)) {
        setBlocks(msg.content.blocks);
      } else {
        setBlocks(null);
      }
    };
    window.addEventListener('message', handler);
    window.parent?.postMessage({ type: 'roleroom-cms-preview-ready', pageKey: slug }, '*');
    return () => window.removeEventListener('message', handler);
  }, [slug]);

  return blocks;
}
