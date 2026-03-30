/**
 * Folder Feature Mapping Utility
 * Maps Google Drive folders to profession features for access control
 * ✅ Now uses centralized folder-configuration.ts as single source of truth
 */

import { getAllProfessionFeatures } from '../../../shared/profession-feature-matrix';
import { MASTER_FOLDER_CONFIG, type FolderConfig } from '../../../shared/folder-configuration';

type PlanTier = FolderConfig['plan'];
type FolderAccessEntry = {
  name: string;
  description: string;
  requiredFeatures: string[];
  professions: string[];
  plan: PlanTier;
};
type ProfessionFeatures = NonNullable<ReturnType<typeof getAllProfessionFeatures>>;

const planRank: Record<PlanTier, number> = {
  basic: 1,
  pro: 2,
  enterprise: 3,
  marketplace: 4,
};

/**
 * ✅ Auto-generated from MASTER_FOLDER_CONFIG
 * Comprehensive folder structure with feature requirements
 * Maps folder IDs to required features from profession-feature-matrix
 */
export const FOLDER_FEATURE_MAP: Record<string, FolderAccessEntry> = MASTER_FOLDER_CONFIG.reduce<
  Record<string, FolderAccessEntry>
>((acc, folder) => {
  acc[folder.id] = {
    name: folder.name,
    description: folder.description,
    requiredFeatures: folder.requiredFeatures,
    professions: folder.professions,
    plan: folder.plan,
  };
  return acc;
}, {});

// ✅ All folder definitions now come from MASTER_FOLDER_CONFIG
// To add/edit folders, modify /Users/usmanqazi/creatorhub-backend/shared/folder-configuration.ts

/**
 * Get accessible folders for a profession based on their feature access
 */
export function getAccessibleFolders(
  profession: string,
  userPlan: PlanTier = 'basic'
): string[] {
  const professionFeatures = getAllProfessionFeatures(profession);
  if (!professionFeatures) {
    return Object.entries(FOLDER_FEATURE_MAP)
      .filter(([, folderConfig]) => folderConfig.professions.includes('all'))
      .map(([folderId]) => folderId);
  }

  const accessibleFolders: string[] = [];

  Object.entries(FOLDER_FEATURE_MAP).forEach(([folderId, folderConfig]) => {
    // Check if profession matches
    const professionMatch = folderConfig.professions.includes('all') || 
                           folderConfig.professions.includes(profession);
    
    if (!professionMatch) return;

    // Check if user's plan meets folder requirements
    if (planRank[userPlan] < planRank[folderConfig.plan]) return;

    // Check if all required features are available
    const hasAllFeatures = folderConfig.requiredFeatures.every((featureId) => {
      const feature = (professionFeatures as ProfessionFeatures)[featureId];
      return feature && feature.enabled;
    });

    if (hasAllFeatures) {
      accessibleFolders.push(folderId);
    }
  });

  return accessibleFolders;
}

/**
 * Get missing folders (folders user doesn't have access to)
 */
export function getMissingFolders(
  profession: string,
  userPlan: PlanTier = 'basic'
): Array<{
  folderId: string;
  name: string;
  description: string;
  requiredPlan: PlanTier;
  requiredFeatures: string[];
}> {
  const accessibleFolders = getAccessibleFolders(profession, userPlan);
  const allFolders = Object.keys(FOLDER_FEATURE_MAP);
  
  const missingFolders = allFolders
    .filter(folderId => !accessibleFolders.includes(folderId))
    .filter(folderId => {
      const folderConfig = FOLDER_FEATURE_MAP[folderId];
      return folderConfig.professions.includes('all') || folderConfig.professions.includes(profession);
    })
    .map(folderId => ({
      folderId,
      name: FOLDER_FEATURE_MAP[folderId].name,
      description: FOLDER_FEATURE_MAP[folderId].description,
      requiredPlan: FOLDER_FEATURE_MAP[folderId].plan,
      requiredFeatures: FOLDER_FEATURE_MAP[folderId].requiredFeatures
    }));

  return missingFolders;
}
