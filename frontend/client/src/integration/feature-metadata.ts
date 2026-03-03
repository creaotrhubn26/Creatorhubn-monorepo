import { PROFESSION_FEATURE_MATRIX, getFeaturesByCategory } from '../../../shared/profession-feature-matrix';

export type FeaturePlan = 'basic' | 'pro' | 'enterprise' | 'marketplace';
export type FeatureImpact = 'low' | 'medium' | 'high' | 'critical';

export interface FeatureMetadata {
  id: string;
  description?: string;
  plan?: FeaturePlan;
  impact?: FeatureImpact;
  category?: string;
  professions?: string[];
  /** If this featureId is an alias, points to the canonical featureId. */
  aliasOf?: string;
}

/**
 * Map of frontend/UX oriented feature IDs to canonical backend feature IDs.
 * This lets diagnostics align Academy featureIds used in components with the
 * canonical feature catalog from creatorhub-features.ts.
 */
const FEATURE_ALIASES: Record<string, string> = {
  // Academy video & content
  'video-player': 'video-player-academy',
  'annotation-editing': 'annotation-editor',
  'chapter-management': 'chapter-manager',

  // Analytics
  'course-analytics': 'analytics-academy',
  'analytics-dashboard': 'analytics-academy',
  'community-analytics': 'analytics-academy',
  'revenue-analytics': 'course-analytics-revenue',

  // Monetization & payouts
  'course-pricing': 'course-monetization',
  'course-payments': 'course-monetization',
  'payout-management': 'payout-system',
};

// Frontend-only feature IDs that don't exist in the backend catalog but are
// still useful to show in diagnostics with a human-readable description.
const LOCAL_FEATURE_METADATA: Record<string, Partial<FeatureMetadata>> = {
  'asset-browser': { category: 'Academy', description: 'Media asset browser for Academy course content.' },
  'floating-action-menu': { category: 'Academy', description: 'Contextual quick actions for creating and managing courses and modules.' },
  'settings-panel': { category: 'Academy', description: 'Instructor settings panel for Academy configuration.' },
  'lower-thirds': { category: 'Academy', description: 'Animated lower-third overlays for Academy videos.' },
  'cta-overlays': { category: 'Academy', description: 'Interactive call-to-action overlays in Academy videos.' },
  'module-management': { category: 'Academy', description: 'Management of course modules, structure, and metadata.' },
  'module-creation': { category: 'Academy', description: 'Creation of new modules and sections within a course.' },
  'module-editing': { category: 'Academy', description: 'Editing existing modules, lessons, and metadata.' },
  'module-organization': { category: 'Academy', description: 'Reordering and organizing modules into learning paths.' },
  'module-analytics': { category: 'Academy', description: 'Analytics focused on module-level performance and engagement.' },
  'version-control': { category: 'Academy', description: 'Version history and change tracking for course content.' },
  'auto-save': { category: 'Academy', description: 'Automatic saving of course and module edits.' },
  'community-posts': { category: 'Academy', description: 'Community posts related to courses and modules.' },
  'post-scheduling': { category: 'Academy', description: 'Scheduling of community and course-related posts.' },
	'post-management': { category: 'Academy', description: 'Management of published and scheduled course posts.' },
	'receipt-capture': { category: 'Accounting', description: 'Capture and upload receipts for bookkeeping.' },
	'receipt-registration': { category: 'Accounting', description: 'Review and register receipts into the accounting system.' },
	'vat-selection': { category: 'Accounting', description: 'Select and manage VAT rates when registering receipts.' },
};

let cachedCatalog: Record<string, FeatureMetadata> | null = null;

function buildCanonicalCatalog(): Record<string, FeatureMetadata> {
  const catalog: Record<string, FeatureMetadata> = {};

  Object.keys(PROFESSION_FEATURE_MATRIX).forEach((professionId) => {
    const byCategory = getFeaturesByCategory(professionId);

    Object.entries(byCategory).forEach(([category, features]) => {
      (features as any[]).forEach((feature) => {
        const featureId = feature.featureId as string;
        const existing = catalog[featureId];

        if (!existing) {
          catalog[featureId] = {
            id: featureId,
            description: feature.description,
            impact: feature.impact,
            plan: feature.plan,
            category,
            professions: [professionId],
          };
        } else {
          const professions = existing.professions ?? [];
          if (!professions.includes(professionId)) {
            existing.professions = [...professions, professionId];
          }

          // Prefer highest plan if it differs across professions
          if (feature.plan && existing.plan && feature.plan !== existing.plan) {
            const order: FeaturePlan[] = ['basic','pro','enterprise','marketplace'];
            if (order.indexOf(feature.plan) > order.indexOf(existing.plan)) {
              existing.plan = feature.plan;
            }
          }

          // Prefer highest impact if it differs across professions
          if (feature.impact && existing.impact && feature.impact !== existing.impact) {
            const impactOrder: FeatureImpact[] = ['low', 'medium', 'high', 'critical'];
            if (impactOrder.indexOf(feature.impact) > impactOrder.indexOf(existing.impact)) {
              existing.impact = feature.impact;
            }
          }
        }
      });
    });
  });

  return catalog;
}

export function getFeatureMetadata(featureId: string): FeatureMetadata | null {
  if (!cachedCatalog) {
    cachedCatalog = buildCanonicalCatalog();
  }

  const aliasTarget = FEATURE_ALIASES[featureId];
  const lookupId = aliasTarget || featureId;

  const base = cachedCatalog[lookupId];
  const local = LOCAL_FEATURE_METADATA[featureId];

  if (!base && !local) {
    return null;
  }

  const metadata: FeatureMetadata = {
    ...(base ?? { id: lookupId }),
    ...(local ?? {}),
  };

  if (aliasTarget) {
    metadata.aliasOf = lookupId;
    metadata.id = featureId;
  }

  return metadata;
}
