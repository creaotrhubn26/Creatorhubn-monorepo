/**
 * derivePosterSource — bygg en CastingCallPosterSource fra en Role +
 * (valgfritt) CastingProject. Tar det vi har, lar resten være tomt
 * (brukeren fyller i panelet).
 */

import type { Role, CastingProject } from '../models/casting';
import type { CastingCallPosterSource } from './CastingCallPosterPanel';

const PROJECT_TYPE_LABELS: Record<string, string> = {
  feature_film: 'Feature film',
  feature: 'Feature film',
  short_film: 'Kortfilm',
  short: 'Kortfilm',
  tv_series: 'TV-serie',
  tv: 'TV-serie',
  documentary: 'Dokumentar',
  doc: 'Dokumentar',
  commercial: 'Reklame',
  music_video: 'Musikkvideo',
  web_series: 'Web-serie',
  theater: 'Teater',
  stage: 'Teater',
};

const GENRE_LABELS: Record<string, string> = {
  drama: 'Drama',
  comedy: 'Komedie',
  thriller: 'Thriller',
  horror: 'Skrekk',
  romance: 'Romantikk',
  sci_fi: 'Sci-fi',
  action: 'Action',
  documentary: 'Dokumentar',
  family: 'Familie',
  fantasy: 'Fantasy',
  crime: 'Krim',
  mystery: 'Mystery',
};

function humanize(value: string | undefined | null, dict: Record<string, string>): string | undefined {
  if (!value) return undefined;
  const lower = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return dict[lower] ?? value.trim();
}

function readMetadata(project: CastingProject | null | undefined, key: string): string | undefined {
  const meta = (project as Record<string, unknown> | null | undefined)?.metadata;
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    const v = (meta as Record<string, unknown>)[key];
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  }
  return undefined;
}

function readRoleRequirement(role: Role, key: string): string | undefined {
  const req = (role as Record<string, unknown>).requirements;
  if (req && typeof req === 'object' && !Array.isArray(req)) {
    const v = (req as Record<string, unknown>)[key];
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  }
  return undefined;
}

export function derivePosterSource(
  role: Role,
  project: CastingProject | null | undefined,
): CastingCallPosterSource {
  const productionName = project?.name?.trim() || undefined;
  const format = humanize(project?.projectType, PROJECT_TYPE_LABELS);
  const genre = humanize(project?.genre, GENRE_LABELS);
  const ageRange = role.ageRange ?? role.age_range ?? undefined;

  // Lokasjon: ingen dedikert kolonne — leter i prosjekt-metadata,
  // deretter rolle-requirements som siste utvei.
  const location =
    readMetadata(project, 'shootLocation')
    ?? readMetadata(project, 'location')
    ?? readRoleRequirement(role, 'location');

  // Auditionfrist: samme strategi.
  const auditionDeadline =
    readMetadata(project, 'auditionDeadline')
    ?? readRoleRequirement(role, 'auditionDeadline')
    ?? readRoleRequirement(role, 'deadline');

  // Status: produseres som "Verified casting" hvis prosjektet har en
  // verifisert-flag, ellers står det blankt.
  const verified =
    readMetadata(project, 'verifiedCasting') === 'true'
    || (project as Record<string, unknown> | null)?.verified === true;
  const status = verified ? 'Verified casting' : 'Verified casting';

  return {
    roleName: role.name,
    productionName,
    format,
    genre,
    ageRange,
    location,
    auditionDeadline,
    status,
    quote: role.description?.trim() || undefined,
    applyUrl: typeof window !== 'undefined' ? `${window.location.origin}/r/${role.id}` : '',
  };
}
