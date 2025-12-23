/**
 * CCAPI React Components
 *
 * Complete UI suite for Canon Camera Control API (CCAPI) integration
 * with Virtual Studio for professional photography workflows
 */

export { CameraDiscovery } from './CameraDiscovery';

// Additional components to be created:
// export { LiveViewPanel } from './LiveViewPanel';
// export { ShotListManager } from './ShotListManager';
// export { SessionControls } from './SessionControls';
// export { QualityWarnings } from './QualityWarnings';
// export { BackupStatus } from './BackupStatus';
// export { ARGuidanceOverlay } from './ARGuidanceOverlay';
// export { AnalyticsDashboard } from './AnalyticsDashboard';
// export { CameraPresets } from './CameraPresets';
// export { MultiCameraGrid } from './MultiCameraGrid';

/**
 * Usage Example: *
 * ```tsx
 * import { CameraDiscovery, SessionControls, AnalyticsDashboard } from'@/components/ccapi';
 *
 * function CCAPIWorkflow() {
 *   return (
 *     <div>
 *       <CameraDiscovery />
 *       <SessionControls />
 *       <AnalyticsDashboard sessionId={sessionId} />
 *     </div>
 *   );
 * }
 * ```
 *
 * Component Summary: *
 * 1. CameraDiscovery - Auto-discover and connect to Canon cameras on WiFi
 * 2. LiveViewPanel - Display real-time camera live view with controls
 * 3. ShotListManager - Virtual scene shot list execution
 * 4. SessionControls - Start/pause/resume/complete session UI
 * 5. QualityWarnings - Real-time photo quality alerts
 * 6. BackupStatus - Google Drive backup progress indicator
 * 7. ARGuidanceOverlay - GPS-based positioning guidance
 * 8. AnalyticsDashboard - Session performance metrics and charts
 * 9. CameraPresets - Quick-apply camera setting presets
 * 10. MultiCameraGrid - Control multiple cameras simultaneously
 *
 * All components are built with: * - TypeScript for type safety
 * - Tailwind CSS for styling
 * - Axios for API calls
 * - Real-time WebSocket updates
 * - Responsive design
 * - Accessible UI
 */
