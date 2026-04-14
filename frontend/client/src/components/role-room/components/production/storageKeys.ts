export const PRODUCTION_STORAGE_KEYS = {
  auditionGuideLanguage: 'audition_guide_language',
  liveSetContinuityNotesNamespace: 'live-set-continuity-notes',
  liveSetNotesPrefix: 'liveset:notes',
  manuscriptFullscreen: 'pmv:isFullscreen',
  manuscriptZoom: 'pmv:manuscriptZoom',
  manuscriptWorkflowPrefix: 'pmv:workflow:',
  manuscriptExpandedSections: 'pmv:expandedSections',
  manuscriptExportAudit: 'pmv:exportAudit',
} as const;

export const buildProductionScopedPreferenceKey = (
  baseKey: string,
  projectId?: string,
): string => `${baseKey}:${projectId || 'global'}`;

export const buildProductionWorkflowPreferenceKey = (projectId: string): string =>
  `${PRODUCTION_STORAGE_KEYS.manuscriptWorkflowPrefix}${projectId}`;

export const buildLiveSetNotesKey = (projectId: string, shootingDayId: string): string =>
  `${PRODUCTION_STORAGE_KEYS.liveSetNotesPrefix}:${projectId}:${shootingDayId}`;

export const buildLiveSetNotesNamespace = (shootingDayId: string): string =>
  `${PRODUCTION_STORAGE_KEYS.liveSetContinuityNotesNamespace}:${shootingDayId}`;
