/**
 * Showcase terminology — profession-aware labels for the gallery /
 * client-delivery surfaces.
 *
 * The platform serves three primary professions: photographers,
 * videographers, music producers. The underlying database is
 * "image-shaped" (client_gallery_images, image_metadata) for
 * historical reasons, but the user-facing copy needs to match the
 * profession context. A music producer delivers tracks, not "bilder";
 * a videographer delivers klipp, not "bilder".
 *
 * This helper is the single source of truth for all gallery copy
 * across ClientGalleriesManager, CommunicationHub gallery tab,
 * client-gallery viewer, and email templates. Keep one map here so
 * adding a new profession (vendor/enterprise/dance/etc) is a single-
 * file change.
 *
 * NB: deliberately Norwegian. Internationalization is a separate
 * concern (Slice 11 backlog).
 */

export type ShowcaseProfession =
  | 'photographer'
  | 'videographer'
  | 'music_producer'
  | 'vendor'
  | 'enterprise'
  | string; // open-ended so unknown professions degrade gracefully

export interface ShowcaseTerminology {
  /** "foto-galleri" / "video-galleri" / "lyd-galleri". Single noun. */
  collection: string;
  /** Plural form for headings ("dine foto-galleri"). */
  collectionPlural: string;
  /** Singular item — "bilde" / "klipp" / "spor". */
  item: string;
  /** Plural — "bilder" / "klipp" / "spor". */
  itemPlural: string;
  /** Verb when the client picks: "valgt" / "valgt" / "valgt". */
  selectedVerb: string;
  /** Klient-rolle "klient" universelt; kept for future extensibility. */
  client: string;
  /** Action label "Velg ekstra-bilder" → profession-specific. */
  extraSelectionsLabel: string;
  /** Empty-state when no items in collection: "Ingen bilder ennå". */
  emptyCollectionLabel: string;
  /** Auto-clean / object-removal — only meaningful for photographer +
   *  videographer professions. Music producers never see this. */
  supportsAutoClean: boolean;
  /** Watermark concept — applies to photo + video, less so for music
   *  (music has DRM-style preview-watermarking but conceptually different). */
  watermarkLabel: string;
}

/// Heuristic match — accepts the canonical profession ids the
/// platform uses internally plus a few common synonyms. Falls back to
/// the photographer-flavored copy when the profession is unknown,
/// since that's still the largest user segment and the safest default.
export function getShowcaseTerminology(
  profession: ShowcaseProfession | null | undefined,
): ShowcaseTerminology {
  const p = String(profession ?? '').toLowerCase().trim();

  if (p.includes('video') || p.includes('film') || p.includes('cinemato')) {
    return {
      collection: 'video-galleri',
      collectionPlural: 'video-galleri',
      item: 'klipp',
      itemPlural: 'klipp',
      selectedVerb: 'valgt',
      client: 'klient',
      extraSelectionsLabel: 'Velg ekstra klipp',
      emptyCollectionLabel: 'Ingen klipp ennå',
      supportsAutoClean: true,
      watermarkLabel: 'Vannmerk preview-klippene',
    };
  }

  if (p.includes('music') || p.includes('musik') || p.includes('audio') || p.includes('producer')) {
    return {
      collection: 'lyd-galleri',
      collectionPlural: 'lyd-galleri',
      item: 'spor',
      itemPlural: 'spor',
      selectedVerb: 'valgt',
      client: 'klient',
      extraSelectionsLabel: 'Velg ekstra spor',
      emptyCollectionLabel: 'Ingen spor ennå',
      supportsAutoClean: false,
      watermarkLabel: 'Preview-DRM på spor',
    };
  }

  // photographer + vendor + enterprise + unknown → photo-flavored copy.
  return {
    collection: 'foto-galleri',
    collectionPlural: 'foto-galleri',
    item: 'bilde',
    itemPlural: 'bilder',
    selectedVerb: 'valgt',
    client: 'klient',
    extraSelectionsLabel: 'Velg ekstra bilder',
    emptyCollectionLabel: 'Ingen bilder ennå',
    supportsAutoClean: true,
    watermarkLabel: 'Vannmerk preview-bildene',
  };
}

/** Convenience: capitalise the first letter for headings. */
export function capitalise(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
