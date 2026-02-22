/**
 * domain/index.ts — barrel export
 *
 * Import everything from one place:
 *
 *   import { Scene, detectConflicts, generateDOOD, filterScenes } from './domain';
 *
 * Or import the full namespace:
 *
 *   import * as Domain from './domain';
 */

export * from './types';
export * from './conflictEngine';
export * from './doodEngine';
export * from './productionStats';
export * from './quickFilter';
