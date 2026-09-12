/**
 * user-drive-folder-templates.ts
 *
 * Profesjon-bevisste mappestrukturer som opprettes i brukerens Google Drive
 * når de kobler til Drive første gang. Velger man `photographer` får man
 * gallery-orientert struktur; videograf får master/render/B-roll; eventplanner
 * får events/suppliers; etc.
 *
 * Brukes av POST /api/user/drive-credentials/setup-folders i
 * user-drive-credentials-routes.ts.
 *
 * Lookup-strategi:
 *   1. Hvis caller eksplisitt sender `templateKey` → bruk den (gir
 *      mulighet for "Custom"-modus i UI)
 *   2. Ellers, hvis caller sender `profession` → finn første template
 *      som lister den profesjonen
 *   3. Ellers → fallback-template
 *
 * Hver template lager `rootFolderName` som hovedmappe + alle subfolders
 * gjennom Drive API Files.create med mimeType
 * `application/vnd.google-apps.folder` og parents=[parent_drive_folder_id].
 */

export interface FolderTemplate {
  /** Unik nøkkel — lagres i user_drive_folders.template_key */
  key: string;
  /**
   * Hvilke `users.profession`-verdier denne malen passer for. Bruk `'all'`
   * for fallback. Første match vinner ved lookup.
   */
  professionTypes: string[];
  /** Hva rotmappen heter i bruker's Drive */
  rootFolderName: string;
  /** Norske visningsnavn for UI (template-velger) */
  displayName: string;
  /** Kort beskrivelse for UI */
  description: string;
  /**
   * Mappe-paths relativ til rotmappen. Path-segmenter separeres med "/" og
   * lages rekursivt — `Galleries/Originals` lager først Galleries, så
   * Originals under den. Rekkefølge er signifikant pga. avhengighet.
   */
  folders: { path: string; description?: string }[];
}

export const FOLDER_TEMPLATES: FolderTemplate[] = [
  {
    key: 'photographer-default',
    professionTypes: ['photographer'],
    rootFolderName: 'CreatorHub Workspace',
    displayName: 'Fotograf (standard)',
    description:
      'Gallery-orientert struktur med originaler/redigeringer/selections + markedsføring + kontrakter.',
    folders: [
      { path: 'Galleries', description: 'Klient-galleries (delt via CreatorHub)' },
      { path: 'Galleries/Originals', description: 'Originale RAW/JPEG-filer' },
      { path: 'Galleries/Edits', description: 'Ferdig-redigerte leveringer' },
      { path: 'Galleries/Selections', description: 'Klient-utvalg' },
      { path: 'Marketing', description: 'Egne markedsføringsbilder' },
      { path: 'Marketing/Social', description: 'For Instagram/LinkedIn' },
      { path: 'Marketing/Website', description: 'For nettsiden' },
      { path: 'Contracts', description: 'Signerte kontrakter' },
      { path: 'Invoices', description: 'Fakturaer (kopier)' },
      { path: 'Archive', description: 'Avsluttede prosjekter' },
    ],
  },
  {
    key: 'videographer-default',
    professionTypes: ['videographer'],
    rootFolderName: 'CreatorHub Workspace',
    displayName: 'Videograf (standard)',
    description:
      'Master/render/review-syklus + B-roll og audio-bibliotek + Premiere/DaVinci-maler.',
    folders: [
      { path: 'Projects', description: 'Aktive prosjekter' },
      { path: 'Projects/Masters', description: 'Master-filer (originale opptak)' },
      { path: 'Projects/Renders', description: 'Eksport/leveringsfiler' },
      { path: 'Projects/Reviews', description: 'R1/R2/Final-versjoner' },
      { path: 'BRoll', description: 'Stock-klipp og B-roll-bibliotek' },
      { path: 'Audio', description: 'Musikk, lydeffekter, voiceovers' },
      { path: 'Templates', description: 'Premiere/DaVinci-prosjektmaler' },
      { path: 'Contracts', description: 'Signerte kontrakter' },
      { path: 'Invoices', description: 'Fakturaer' },
      { path: 'Archive', description: 'Avsluttede prosjekter' },
    ],
  },
  {
    key: 'eventplanner-default',
    professionTypes: ['eventplanner', 'event_planner', 'event-planner'],
    rootFolderName: 'CreatorHub Workspace',
    displayName: 'Eventplanlegger (standard)',
    description:
      'Per-arrangement: briefer/leverandører/program + media-arkiv + kontrakter.',
    folders: [
      { path: 'Events', description: 'Aktive arrangementer' },
      { path: 'Events/Briefs', description: 'Kunde-briefer' },
      { path: 'Events/Suppliers', description: 'Leverandør-kontrakter' },
      { path: 'Events/Run-of-show', description: 'Programmer' },
      { path: 'Media', description: 'Bilder/videoer fra arrangementer' },
      { path: 'Templates', description: 'Maler' },
      { path: 'Contracts', description: 'Kontrakter' },
      { path: 'Invoices', description: 'Fakturaer' },
      { path: 'Archive' },
    ],
  },
  {
    key: 'musician-default',
    professionTypes: ['musician', 'artist'],
    rootFolderName: 'CreatorHub Workspace',
    displayName: 'Musiker / artist (standard)',
    description:
      'Releases (masters/stems/lyrics) + EPK + spillinger + kontrakter.',
    folders: [
      { path: 'Releases', description: 'Aktive releases' },
      { path: 'Releases/Masters', description: 'Endelige master-filer' },
      { path: 'Releases/Stems', description: 'Stems for mixing/remixing' },
      { path: 'Releases/Lyrics', description: 'Tekster' },
      { path: 'EPK', description: 'Press kit (bio, foto, kontakt)' },
      { path: 'Gigs', description: 'Konsert/spillingsmateriell' },
      { path: 'Marketing', description: 'Singel-cover, sosiale grafikk' },
      { path: 'Contracts', description: 'Kontrakter' },
      { path: 'Invoices', description: 'Fakturaer' },
      { path: 'Archive' },
    ],
  },
  {
    key: 'fallback',
    professionTypes: ['all'],
    rootFolderName: 'CreatorHub Workspace',
    displayName: 'Generisk (alle profesjoner)',
    description:
      'Minimal mappestruktur som passer for alle. Kan utvides senere.',
    folders: [
      { path: 'Galleries' },
      { path: 'Marketing' },
      { path: 'Contracts' },
      { path: 'Invoices' },
      { path: 'Archive' },
    ],
  },
];

/**
 * Finn template basert på profession. Returnerer fallback hvis ingen match.
 *
 * Match er case-insensitive og normaliserer bindestrek/underscore.
 */
export function getTemplateForProfession(profession: string | null | undefined): FolderTemplate {
  const fallback = FOLDER_TEMPLATES.find((t) => t.key === 'fallback');
  if (!fallback) {
    // Skal ALDRI skje — fallback er hardkodet i listen over
    throw new Error('fallback_template_missing');
  }

  if (!profession || typeof profession !== 'string') return fallback;

  const normalized = profession.trim().toLowerCase().replace(/[_-]/g, '');

  for (const tpl of FOLDER_TEMPLATES) {
    if (tpl.key === 'fallback') continue;
    for (const candidate of tpl.professionTypes) {
      if (candidate === 'all') continue;
      if (candidate.toLowerCase().replace(/[_-]/g, '') === normalized) {
        return tpl;
      }
    }
  }
  return fallback;
}

/**
 * Finn template ved nøkkel — for når UI lar bruker velge eksplisitt.
 * Returnerer null hvis ingen match (caller bestemmer fallback-policy).
 */
export function getTemplateByKey(key: string | null | undefined): FolderTemplate | null {
  if (!key || typeof key !== 'string') return null;
  return FOLDER_TEMPLATES.find((t) => t.key === key) ?? null;
}

/**
 * Returner alle templates til UI-velger (uten å eksponere intern struktur
 * på en måte som kan brukes til å fingerprint andre brukere).
 */
export function listFolderTemplates(): Array<{
  key: string;
  displayName: string;
  description: string;
  professionTypes: string[];
  folderCount: number;
}> {
  return FOLDER_TEMPLATES.map((t) => ({
    key: t.key,
    displayName: t.displayName,
    description: t.description,
    professionTypes: t.professionTypes,
    folderCount: t.folders.length,
  }));
}
