/**
 * Core Services Index
 * 
 * Central export for all Virtual Studio services.
 */

// Logging
export { logger } from './logger';

// Error Handling
export { errorHandler } from './errorHandler';

// Director Mode & Monitor
export { directorModeService } from './directorModeService';
export type { DirectorModeState, MonitorInfo } from './directorModeService';

export { monitorFeedService, MonitorRenderer } from './monitorFeedService';
export type { MonitorLayout, MonitorFeed, MonitorConfig, CameraNode } from './monitorFeedService';

// Recording
export { multiCameraRecordingService, RECORDING_QUALITY } from './multiCameraRecordingService';
export type { CameraRecording, RecordingConfig, MultiCameraRecordingState } from './multiCameraRecordingService';

// Equipment
export { equipmentIntegrationService } from './equipmentIntegrationService';

// Selection
export { selectionService } from './selectionService';

// Undo/Redo
export { undoRedoService } from './undoRedoService';

// Equipment Grouping
export { equipmentGroupingService } from './equipmentGroupingService';

// Environment
export { environmentService, useEnvironment } from './environmentService';

// Class Photo
export { classPhotoService } from './classPhotoService';
export { classPhotoSceneService } from './classPhotoSceneService';

// HDRI
export { hdriCacheService } from './hdriCacheService';
export { blenderkitService } from './blenderkitService';

// User Data
export { userDataService } from './userDataService';

// Actor Model Cache
export { actorModelCache } from'./actorModelCache';

