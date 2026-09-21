/**
 * Lazy component boundary for every dedicated Role Room lens.
 *
 * Navigation metadata lives in workspaceLensRegistry; this file owns only the
 * corresponding chunk loaders. Keeping both beside each other makes a new
 * role workspace an explicit two-file registration instead of another loader
 * buried in CastingPlannerPanel.
 */
import { lazy } from 'react';
import { lazyWithRetry } from '@/utils/lazyWithRetry';

export const ProducerWorkspace = lazyWithRetry(() => import('../producer-role/ProducerWorkspace').then((module) => ({ default: module.ProducerWorkspace })));
export const DirectorWorkspace = lazyWithRetry(() => import('../director/DirectorWorkspace').then((module) => ({ default: module.DirectorWorkspace })));
export const CastingWorkspace = lazyWithRetry(() => import('../casting/CastingWorkspace').then((module) => ({ default: module.CastingWorkspace })));
export const CinematographerWorkspace = lazyWithRetry(() => import('../cinematographer/CinematographerWorkspace').then((module) => ({ default: module.CinematographerWorkspace })));
export const FirstAssistantDirectorWorkspace = lazyWithRetry(() => import('../assistant-director/FirstAssistantDirectorWorkspace').then((module) => ({ default: module.FirstAssistantDirectorWorkspace })));
export const SecondAssistantDirectorWorkspace = lazyWithRetry(() => import('../assistant-director/SecondAssistantDirectorWorkspace').then((module) => ({ default: module.SecondAssistantDirectorWorkspace })));
export const ProductionManagementWorkspace = lazyWithRetry(() => import('../production-management/ProductionManagementWorkspace').then((module) => ({ default: module.ProductionManagementWorkspace })));
export const ProductionCoordinationWorkspace = lazyWithRetry(() => import('../production-coordination/ProductionCoordinationWorkspace').then((module) => ({ default: module.ProductionCoordinationWorkspace })));
export const LocationManagerWorkspace = lazyWithRetry(() => import('../locations/LocationManagerWorkspace').then((module) => ({ default: module.LocationManagerWorkspace })));
export const ContinuityWorkspace = lazyWithRetry(() => import('../continuity/ContinuityWorkspace').then((module) => ({ default: module.ContinuityWorkspace })));
export const ArtDepartmentWorkspace = lazyWithRetry(() => import('../art-department/ArtDepartmentWorkspace').then((module) => ({ default: module.ArtDepartmentWorkspace })));
export const ProductionSoundWorkspace = lazyWithRetry(() => import('../production-sound/ProductionSoundWorkspace').then((module) => ({ default: module.ProductionSoundWorkspace })));
export const PostProductionWorkspace = lazyWithRetry(() => import('../post-production/PostProductionWorkspace').then((module) => ({ default: module.PostProductionWorkspace })));

// Admin Room is a platform lens rather than a production role and keeps its
// existing plain lazy boundary because it exports a default page component.
export const AdminRoomWorkspace = lazy(() => import('../../../../pages/AdminRoom'));

export const WORKSPACE_LENS_COMPONENTS = {
  producer: ProducerWorkspace,
  director: DirectorWorkspace,
  casting: CastingWorkspace,
  cinematography: CinematographerWorkspace,
  firstAssistantDirection: FirstAssistantDirectorWorkspace,
  secondAssistantDirection: SecondAssistantDirectorWorkspace,
  productionManagement: ProductionManagementWorkspace,
  productionCoordination: ProductionCoordinationWorkspace,
  locationManagement: LocationManagerWorkspace,
  continuity: ContinuityWorkspace,
  artDepartment: ArtDepartmentWorkspace,
  productionSound: ProductionSoundWorkspace,
  postProduction: PostProductionWorkspace,
  admin: AdminRoomWorkspace,
} as const;

export type WorkspaceLensComponentKey = keyof typeof WORKSPACE_LENS_COMPONENTS;
