/**
 * Profession tab-konfigurasjon — definerer hvilke faner som vises pr.
 * profession-mode.
 *
 * Eksisterende moder (production, photographer, content_producer) er
 * KUN dokumentert her som referanse. CastingPlannerPanel.tsx bygger
 * fortsatt sine faner direkte fra hardkodet rekkefølge — vi bytter
 * det først ut når vi har validering for at dans-modene må vises.
 *
 * Denne filen er trygg å importere fra dans-komponenter (PR #3+) for
 * å hente fane-rekken i en konsistent struktur.
 */

import type { BrandingTextTokenKey } from './branding';
import type { ProfessionMode } from './professionMode';

/**
 * En fane består av:
 *  - `id`: stabil identifikator brukt i URL og state
 *  - `labelToken`: nøkkel inn i `branding.tokens.labels`
 *  - `descriptionToken`: nøkkel for tooltip/onboarding (valgfri)
 *  - `requiresProject`: skal fanen disables når intet aktivt prosjekt finnes?
 *  - `feature`: gruppering for sub-navigasjon (valgfri)
 */
export interface TabConfig {
  id: string;
  labelToken: BrandingTextTokenKey;
  descriptionToken?: BrandingTextTokenKey;
  requiresProject?: boolean;
  feature?: 'core' | 'production' | 'resources' | 'on_set' | 'finance' | 'union';
}

// ─── DANS — STUDIO ──────────────────────────────────────────────────────────
//
// Studio-eieren driver klasser, instruktører, elever. Forestillinger er
// årlige eller halvårlige. Hovedflyten er drift, ikke gigg-jakt.

export const DANCE_STUDIO_TABS: readonly TabConfig[] = [
  { id: 'dashboard',     labelToken: 'danceTabDashboard',       feature: 'core' },
  { id: 'pieces',        labelToken: 'danceTabPieces',          descriptionToken: 'danceTabPiecesDescription',          requiresProject: true, feature: 'core' },
  { id: 'formations',    labelToken: 'danceTabFormations',      descriptionToken: 'danceTabFormationsDescription',      feature: 'core' },
  { id: 'season',        labelToken: 'danceTabSeason',          descriptionToken: 'danceTabSeasonDescription',          feature: 'production' },
  { id: 'classes',       labelToken: 'danceTabClasses',         descriptionToken: 'danceTabClassesDescription',         feature: 'production' },
  { id: 'students',      labelToken: 'danceTabStudents',        descriptionToken: 'danceTabStudentsDescription',        feature: 'resources' },
  { id: 'instructors',   labelToken: 'danceTabInstructors',     descriptionToken: 'danceTabInstructorsDescription',     feature: 'resources' },
  { id: 'rooms',         labelToken: 'danceTabRooms',                                                                    feature: 'resources' },
  { id: 'rehearsal_log', labelToken: 'danceTabRehearsalLog',    descriptionToken: 'danceTabRehearsalLogDescription',    feature: 'on_set' },
  { id: 'video',         labelToken: 'danceTabVideo',           descriptionToken: 'danceTabVideoDescription',           feature: 'on_set' },
  { id: 'performances',  labelToken: 'danceTabPerformances',    descriptionToken: 'danceTabPerformancesDescription',    feature: 'on_set' },
  { id: 'music',         labelToken: 'danceTabMusic',           descriptionToken: 'danceTabMusicDescription',           feature: 'production' },
  { id: 'movement_vocab',labelToken: 'danceTabMovementVocab',                                                            feature: 'production' },
  { id: 'analysis',      labelToken: 'danceTabAnalysis',                                                                 feature: 'production' },
  { id: 'grants',        labelToken: 'danceTabGrants',          descriptionToken: 'danceTabGrantsDescription',          feature: 'finance' },
  { id: 'billing',       labelToken: 'danceTabBilling',                                                                  feature: 'finance' },
  { id: 'union',         labelToken: 'danceTabUnion',           descriptionToken: 'danceTabUnionDescription',           feature: 'union' },
  { id: 'team',          labelToken: 'danceTabTeam',            descriptionToken: 'danceTabTeamDescription',            feature: 'resources' },
  { id: 'pricing',       labelToken: 'danceTabPricing',                                                                  feature: 'finance' },
  { id: 'admin_plans',   labelToken: 'danceTabAdminPlans',                                                               feature: 'finance' },
  { id: 'admin_testers', labelToken: 'danceTabAdminTesters',                                                             feature: 'finance' },
  { id: 'admin_settings',labelToken: 'danceTabAdminSettings',                                                            feature: 'finance' },
] as const;

// ─── DANS — FRILANS ─────────────────────────────────────────────────────────
//
// Frilanseren jobber prosjekt-til-prosjekt: auditions inn, gigs ut.
// Reel-portefølje og NAV-dokumentasjon er kritisk. Klasse/elev-flyten er
// utelatt — frilansere underviser kun sporadisk og bruker da studioets
// system, ikke sitt eget.

export const DANCE_FREELANCE_TABS: readonly TabConfig[] = [
  { id: 'dashboard',     labelToken: 'danceTabDashboard',       feature: 'core' },
  { id: 'pieces',        labelToken: 'danceTabPieces',          descriptionToken: 'danceTabPiecesDescription',          requiresProject: true, feature: 'core' },
  { id: 'formations',    labelToken: 'danceTabFormations',      descriptionToken: 'danceTabFormationsDescription',      feature: 'core' },
  { id: 'season',        labelToken: 'danceTabSeason',          descriptionToken: 'danceTabSeasonDescription',          feature: 'production' },
  { id: 'reel',          labelToken: 'danceTabReel',            descriptionToken: 'danceTabReelDescription',            feature: 'production' },
  { id: 'analysis',      labelToken: 'danceTabAnalysis',                                                                 feature: 'production' },
  { id: 'rehearsal_log', labelToken: 'danceTabRehearsalLog',    descriptionToken: 'danceTabRehearsalLogDescription',    feature: 'on_set' },
  { id: 'video',         labelToken: 'danceTabVideo',           descriptionToken: 'danceTabVideoDescription',           feature: 'on_set' },
  { id: 'performances',  labelToken: 'danceTabPerformances',    descriptionToken: 'danceTabPerformancesDescription',    feature: 'on_set' },
  { id: 'music',         labelToken: 'danceTabMusic',           descriptionToken: 'danceTabMusicDescription',           feature: 'production' },
  { id: 'injuries',      labelToken: 'danceTabInjuries',        descriptionToken: 'danceTabInjuriesDescription',        feature: 'union' },
  { id: 'grants',        labelToken: 'danceTabGrants',          descriptionToken: 'danceTabGrantsDescription',          feature: 'finance' },
  { id: 'billing',       labelToken: 'danceTabBilling',                                                                  feature: 'finance' },
  { id: 'union',         labelToken: 'danceTabUnion',           descriptionToken: 'danceTabUnionDescription',           feature: 'union' },
  { id: 'addons',        labelToken: 'danceTabAddons',          descriptionToken: 'danceTabAddonsDescription',          feature: 'finance' },
  { id: 'pricing',       labelToken: 'danceTabPricing',                                                                  feature: 'finance' },
  { id: 'admin_plans',   labelToken: 'danceTabAdminPlans',                                                               feature: 'finance' },
  { id: 'admin_testers', labelToken: 'danceTabAdminTesters',                                                             feature: 'finance' },
  { id: 'admin_settings',labelToken: 'danceTabAdminSettings',                                                            feature: 'finance' },
] as const;

// ─── SPILLSTUDIO — STORY GRAPH ──────────────────────────────────────────────
//
// Narrativ design for spill: brett med elementer/koblinger (Fase 1),
// komponenter + variabler + spillmodus (Fase 2), eksport/deling (Fase 3).
// Fanene finnes fra dag én så URL-kontrakten (?tab=) er stabil; ubygde
// faner rendrer et ærlig «kommer»-kort i NarrativeWorkspace.

export const GAME_STUDIO_TABS: readonly TabConfig[] = [
  // Fase 7b — «home» først = standard landing i skallet (sidebar-seksjoner via feature).
  { id: 'home',       labelToken: 'gameTabHome',       descriptionToken: 'gameTabHomeDescription',       requiresProject: true, feature: 'core' },
  { id: 'story',      labelToken: 'gameTabStory',      descriptionToken: 'gameTabStoryDescription',      requiresProject: true, feature: 'core' },
  { id: 'scenes',     labelToken: 'gameTabScenes',     descriptionToken: 'gameTabScenesDescription',     requiresProject: true, feature: 'core' },
  { id: 'characters', labelToken: 'gameTabCharacters', descriptionToken: 'gameTabCharactersDescription', requiresProject: true, feature: 'core' },
  { id: 'locations',  labelToken: 'gameTabLocations',  descriptionToken: 'gameTabLocationsDescription',  requiresProject: true, feature: 'core' },
  { id: 'platform',   labelToken: 'gameTabPlatform',   descriptionToken: 'gameTabPlatformDescription',   requiresProject: true, feature: 'core' },
  // Fase 8c — Integrasjoner: CI-bevis-hooks og leveringslogg (core; gating kommer med 8g).
  { id: 'integrations', labelToken: 'gameTabIntegrations', descriptionToken: 'gameTabIntegrationsDescription', requiresProject: true, feature: 'production' },
  { id: 'boards',     labelToken: 'gameTabBoards',     descriptionToken: 'gameTabBoardsDescription',     requiresProject: true, feature: 'core' },
  { id: 'components', labelToken: 'gameTabComponents', descriptionToken: 'gameTabComponentsDescription', requiresProject: true, feature: 'core' },
  { id: 'variables',  labelToken: 'gameTabVariables',  descriptionToken: 'gameTabVariablesDescription',  requiresProject: true, feature: 'core' },
  { id: 'plan',       labelToken: 'gameTabPlan',       descriptionToken: 'gameTabPlanDescription',       requiresProject: true, feature: 'production' },
  { id: 'play',       labelToken: 'gameTabPlay',       descriptionToken: 'gameTabPlayDescription',       requiresProject: true, feature: 'production' },
  { id: 'translations', labelToken: 'gameTabTranslations', descriptionToken: 'gameTabTranslationsDescription', requiresProject: true, feature: 'production' },
  { id: 'exports',    labelToken: 'gameTabExports',    descriptionToken: 'gameTabExportsDescription',    requiresProject: true, feature: 'production' },
  { id: 'assets',     labelToken: 'gameTabAssets',     descriptionToken: 'gameTabAssetsDescription',     requiresProject: true, feature: 'resources' },
  { id: 'history',    labelToken: 'gameTabHistory',    descriptionToken: 'gameTabHistoryDescription',    requiresProject: true, feature: 'resources' },
  // Fase 4d/7e — team og billing (ikke prosjekt-avhengige; admin_plans skjules for ikke-admin i NarrativeWorkspace)
  { id: 'team',        labelToken: 'gameTabTeam',        descriptionToken: 'gameTabTeamDescription',        feature: 'finance' },
  { id: 'pricing',     labelToken: 'gameTabPricing',     descriptionToken: 'gameTabPricingDescription',     feature: 'finance' },
  { id: 'billing',     labelToken: 'gameTabBilling',     descriptionToken: 'gameTabBillingDescription',     feature: 'finance' },
  { id: 'admin_plans', labelToken: 'gameTabAdminPlans',  descriptionToken: 'gameTabAdminPlansDescription',  feature: 'finance' },
] as const;

/**
 * Hovedoppslag — gir den korrekte fane-listen for en gitt mode.
 * Returnerer en TOM liste for ikke-dans-moder. Kalleren er ansvarlig
 * for å falle tilbake til CastingPlannerPanel.tsx sin eksisterende
 * fane-bygging når listen er tom — dette holder eksisterende flyt
 * 100 % uendret.
 */
export function getTabsForProfession(mode: ProfessionMode): readonly TabConfig[] {
  switch (mode) {
    case 'dance_studio':
      return DANCE_STUDIO_TABS;
    case 'dance_freelance':
      return DANCE_FREELANCE_TABS;
    case 'game_studio':
      return GAME_STUDIO_TABS;
    case 'production':
    case 'photographer':
    case 'content_producer':
    case 'content_creator':
    default:
      // Tom liste = signaliserer "bruk dagens hardkodede fane-rekke i
      // CastingPlannerPanel.tsx". Endrer ikke nåværende oppførsel.
      return [];
  }
}

/**
 * Filtrer en faneliste etter feature-gruppering. Brukes hvis vi vil
 * dele fanene i seksjoner ("Drift", "Ressurser", "Økonomi") slik den
 * eksisterende CastingPlannerPanel allerede gjør.
 */
export function getTabsByFeature(
  mode: ProfessionMode,
  feature: TabConfig['feature'],
): readonly TabConfig[] {
  return getTabsForProfession(mode).filter((tab) => tab.feature === feature);
}
