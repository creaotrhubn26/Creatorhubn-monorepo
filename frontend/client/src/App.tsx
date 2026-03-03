import * as React from 'react';
import { Switch, Route, useLocation } from 'wouter';
import { queryClient } from './lib/queryClient';
import { useQuery, useMutation, useQueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from "@/hooks/useAuth";
import { SpeedInsights } from "@vercel/speed-insights/react";
// Type definition for the current user response from /api/auth/current-user
interface CurrentUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  isAdmin: boolean;
  authenticated: boolean;
  method: string;
}

// Valid profession types
type ValidProfession = 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise';

// Valid profession types for file manager (subset of ValidProfession)
type FileManagerProfession = 'photographer' | 'videographer' | 'music_producer' | 'designer';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline, Box, Typography } from '@mui/material';
import { creatorHubTheme } from './theme/creatorHubTheme';
import { LanguageProvider } from '@/components/language-provider';
import { DemoModeProvider } from './contexts/DemoModeContext';
import { UniversalSessionProvider } from './contexts/UniversalSessionContext';
import { ClientSessionProvider } from './contexts/ClientSessionContext';
import { AuthProvider } from './contexts/AuthContext';
import { ProjectProvider } from './contexts/ProjectContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { ThemeProvider as AppThemeProvider } from './contexts/ThemeContext';
import { RealTimeProvider } from './contexts/RealTimeContext';
import { VisualEditorProvider } from '@/components/admin/visual-editor/VisualEditorContext';
import UniversalSessionManager from './components/session/UniversalSessionManager';
import { Toaster } from '@/components/ui/toaster';
import { useDynamicProfessions } from '@/components/universal/hooks/useDynamicProfessions';
import NotFound from '@/pages/not-found';
import EmailDesignerPage from '@/pages/EmailDesignerPage';
// import GoogleOAuthSetupPage from '@/pages/GoogleOAuthSetupPage'; // File deleted
import AdminPage from '@/pages/AdminPage';
import EquipmentAdminPage from '@/pages/EquipmentAdminPage';
import AdminDashboard from '@/components/admin/AdminDashboard';
import PhotoShowcase from '@/pages/photo-showcase';
import MusicShowcase from '@/pages/music-showcase';
import ShowcaseAdmin from '@/pages/showcase-admin';
import ClientGallery from '@/pages/client-gallery';
import ContractView from '@/pages/contract-view';
import AdminNotificationDisplay from '@/components/notifications/AdminNotificationDisplay';
import PrototypeFeedbackTool from '@/components/feedback/PrototypeFeedbackTool';
import VerificationSystemDashboard from '@/components/admin/VerificationSystemDashboard';
// import UniversalDashboardEnhanced from '@/components/universal/UniversalDashboardEnhanced';
// import MinimalDashboard from '@/components/universal/MinimalDashboard';
import BackgroundUploadWidget from '@/components/upload/BackgroundUploadWidget';
import { BackgroundDownloadWidget } from '@/components/download/BackgroundDownloadWidget';
import { UnifiedFileManagerWidget } from '@/components/universal/UnifiedFileManagerWidget';
// import MemoryCardBackupTest from '@/components/test/MemoryCardBackupTest'; // File deleted locally
import CameraSelectionTest from '@/components/camera/CameraSelectionTest';
import PersonalizedNews from '@/pages/PersonalizedNews';
import LightroomSimulator from '@/pages/LightroomSimulator';
// import PhotographyTipsCenter from '@/pages/photography-tips-demo'; // File deleted
import ContextualPhotographyTipsPage from '@/pages/contextual-photography-tips';
// import Onboarding from '@/pages/onboarding-test';
// import PluginManagementTest from '@/pages/plugin-management-test';
import RequestAccess from '@/pages/RequestAccess';
import InviteRequestStatus from '@/pages/InviteRequestStatus';
import LandingMobile from '@/pages/landing-mobile';
import LandingDesktop from '@/pages/landing-desktop';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import LandingResponsive from '@/pages/LandingResponsive';
import About from '@/pages/about';
// import OAuthSetup from '@/pages/oauth-setup'; // File doesn't exist
import WeddingClient from '@/pages/wedding-client';
import ShowcaseClient from '@/pages/showcase-client';
import ShowcaseClientEnhanced from '@/pages/showcase-client-enhanced';
import WeddingTimelineClientPage from '@/pages/wedding-timeline-client';
import WeddingTimelineClientResponsive from '@/pages/WeddingTimelineClientResponsive';
import EvendiTimelineAdmin from '@/components/wedding/WeddingTimelineAdmin';
import PricingPage from '@/pages/PricingPage';
import ContractSigningPage from '@/pages/ContractSigningPage';
// import MillionDollarMeetingSystem from '@/pages/million-dollar-meeting-system'; // File deleted
// import MeetingWorkspaceSimple from '@/pages/meeting-workspace-simple'; // File deleted
import PriceAdministration from '@/pages/price-administration';
import BusinessBrandingPage from '@/pages/BusinessBrandingPage';
import AdminInviteSystem from '@/pages/admin-invite-system';
// import CompanyProfilesPage from '@/pages/company-profiles'; // File doesn't exist
// import LogoIntegrationDemo from '@/pages/logo-integration-demo'; // Removed
// import LogoTestSimple from '@/pages/logo-test-simple'; // Removed
// import PhotoEnhancerTest from '@/pages/PhotoEnhancerTest'; // File deleted
import UniversalShowcase from '@/components/universal/UniversalShowcase';
import UniversalDashboard from '@/components/universal/UniversalDashboard';
// import BackgroundUploadTest from '@/pages/background-upload-test'; // Has syntax errors
// import DownloadTest from '@/pages/download-test'; // File doesn't exist
// import UnifiedFileManagerTest from '@/pages/unified-file-manager-test'; // File doesn't exist
// import ConcurrentOperationsDemo from '@/pages/concurrent-operations-demo'; // Has syntax errors
// import UniversalVendorShowcasePage from '@/pages/UniversalVendorShowcasePage'; // Has syntax errors
// import VendorPricingTestPage from '@/pages/VendorPricingTestPage'; // Has syntax errors
import VendorTypeManagementPage from '@/pages/VendorTypeManagementPage';
// import VendorOnboardingTestPage from '@/pages/VendorOnboardingTestPage'; // File doesn't exist
// import VendorOnboardingWithInvitePage from '@/pages/VendorOnboardingWithInvitePage'; // Has syntax errors
// import UniversalVisualCMS from '@/components/cms/UniversalVisualCMS'; // Has syntax errors
// import CodeGenerator from '@/components/cms/CodeGenerator'; // Has syntax errors
// import OAuthSetupPage from '@/pages/OAuthSetupPage'; // File doesn't exist
// import OAuthPage from '@/pages/OAuthPage'; // File doesn't exist
import WireMockDashboard from '@/pages/WireMockDashboard';
import VisualCMSAdminDashboard from '@/components/admin/VisualCMSAdminDashboard';
import BringShippingDashboard from '@/components/shipping/BringShippingDashboard';
import UniversalVendorDashboard from '@/components/vendor/UniversalVendorDashboard';
import NorthtoneVendorShowcase from '@/components/vendor/NorthtoneVendorShowcase';
import CompleteDeploymentManager from '@/components/admin/CompleteDeploymentManager';
import VisualEditorWithPageSelection from '@/components/visual-editor/VisualEditorWithPageSelection';
import CreatorhubVisualEditorRefactored from '@/components/admin/visual-editor/CreatorhubVisualEditorRefactored';
import { EnhancedVisualEditorPage } from '@/components/admin/visual-editor/EnhancedVisualEditorPage';
import EventiOnePager from '@/pages/EventiOnePager';
// Import unified dashboard components
import TemplateDashboard from '@/components/admin/visual-editor/TemplateDashboard';
import ExportPresetsDashboard from '@/components/admin/visual-editor/ExportPresetsDashboard';
import CloudSyncDashboard from '@/components/admin/visual-editor/CloudSyncDashboard';
import TeamCollaborationDashboard from '@/components/admin/visual-editor/TeamCollaborationDashboard';
import PluginDashboard from '@/components/admin/visual-editor/PluginDashboard';
import AnimationDashboard from '@/components/admin/visual-editor/AnimationDashboard';
import ComponentLibraryDashboard from '@/components/admin/visual-editor/ComponentLibraryDashboard';
import DesignSystemDashboard from '@/components/admin/visual-editor/DesignSystemDashboard';
import AnalyticsDashboard from '@/components/admin/visual-editor/AnalyticsDashboard';
import AuditDashboard from '@/components/admin/visual-editor/AuditDashboard';
import MonitoringDashboard from '@/components/admin/visual-editor/MonitoringDashboard';
import SystemManagementDashboard from '@/components/admin/visual-editor/SystemManagementDashboard';
import MLOptimizationDashboard from '@/components/admin/visual-editor/MLOptimizationDashboard';
import AdvancedAnalyticsDashboard from '@/components/admin/visual-editor/AdvancedAnalyticsDashboard';
import AIAssistanceDashboard from '@/components/admin/visual-editor/AIAssistanceDashboard';
import TemplatePresetDashboard from '@/components/admin/visual-editor/TemplatePresetDashboard';
import ClientCommunicationDashboard from '@/components/admin/visual-editor/ClientCommunicationDashboard';
import RevenueOptimizationDashboard from '@/components/admin/visual-editor/RevenueOptimizationDashboard';
import StoryArcStudioPage from '@/pages/StoryArcStudioPage';
import GlobalChatProvider from '@/components/chat/GlobalChatProvider';
import AcademyLandingPage from '@/components/academy/AcademyLandingPage';
import AcademyDashboardCinematic from '@/components/academy/AcademyDashboardCinematic';
import CourseCreator from '@/components/academy/CourseCreator';
import ModuleManager from '@/components/academy/ModuleManager';
import VideoAnnotationEditor from '@/components/academy/VideoAnnotationEditor';
import QuizManager from '@/components/academy/QuizManager';
import AcademyVideoPlayerStudio from '@/components/academy/AcademyVideoPlayerStudio';
import AcademyMonetizationStudio from '@/components/academy/AcademyMonetizationStudio';
import AcademyCTAOverlayStudio from '@/components/academy/AcademyCTAOverlayStudio';
import AcademyLowerThirdsStudio from '@/components/academy/AcademyLowerThirdsStudio';
import AcademyLessonStudio from '@/components/academy/AcademyLessonStudio';
import AcademyCohortSettingsStudio from '@/components/academy/AcademyCohortSettingsStudio';
import AcademyAssignmentsStudio from '@/components/academy/AcademyAssignmentsStudio';
import AcademyEnrollmentStudio from '@/components/academy/AcademyEnrollmentStudio';
import AcademyCurriculumStudio from '@/components/academy/AcademyCurriculumStudio';
import AcademyStudentDashboardStudio from '@/components/academy/AcademyStudentDashboardStudio';
import AcademyAnalyticsStudio from '@/components/academy/AcademyAnalyticsStudio';
import AcademyMediaStudio from '@/components/academy/AcademyMediaStudio';
import CommunityLandingPage from '@/components/community/CommunityLandingPage';
import ReceiptsManager from '@/components/accounting/ReceiptsManager';
import ShowcaseAmazonDesign from '@/components/universal/misc/ShowcaseAmazonDesign';
import VirtualStudioPage from '@/pages/VirtualStudioPage';

import { BringPhotographerDashboard } from './components/bring/BringPhotographerDashboard';
import { EnhancedMasterIntegrationProvider } from './integration/EnhancedMasterIntegrationProvider';
import IntegrationTest from './integration/IntegrationTest';
import ResumeBuilder from '@/components/resume/ResumeBuilder';
import LinkedInCallback from '@/pages/LinkedInCallback';
import LoginPageSimple from '@/pages/LoginPageSimple';

const LandingMobileBackupSep19 = React.lazy(() => import('@/pages/landing-mobile-backup-sep19'));
// Wrapper components for route compatibility
const AdminDashboardWrapper = (props: any) => <AdminDashboard {...props} />;
const CompleteDeploymentManagerWrapper = (props: any) => <CompleteDeploymentManager {...props} />;
const StoryArcStudioRouteWrapper = () => (
  <SettingsProvider>
    <AppThemeProvider>
      <RealTimeProvider>
        <VisualEditorProvider>
          <StoryArcStudioPage />
        </VisualEditorProvider>
      </RealTimeProvider>
    </AppThemeProvider>
  </SettingsProvider>
);

// Community Landing Page Wrapper - gets userId and profession from hooks
const CommunityLandingPageWrapper = () => {
  try {
    const { user } = useAuth();
    const { getUserProfession } = useDynamicProfessions();
    const userId = user?.id || 'guest';
    const profession = getUserProfession() || 'photographer';
    return <CommunityLandingPage userId={userId} profession={profession} />;
  } catch (error) {
    console.error('Error in CommunityLandingPageWrapper:', error);
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="error">
          Feil ved lasting av community-siden
        </Typography>
        <Typography variant="body2" sx={{ mt: 2 }}>
          {error instanceof Error ? error.message : 'Ukjent feil'}
        </Typography>
      </Box>
    );
  }
};

// Smart Dynamic Dashboard Route Component
const SmartDashboardRoute = ({ profession }: { profession?: ValidProfession }) => {
  const { getUserProfession } = useDynamicProfessions();
  
  // Authentication disabled - use mock data
  const currentUser = {
    email: 'admin@local.dev',
    isAdmin: true,
    id: 'local-admin'
  };

  // Check if user is admin
  const isAdmin = currentUser?.email === 'user?.id || user?.email || "unknown-user"' || currentUser?.isAdmin;

  const userProfession = getUserProfession();

  // Use specified profession, user's profession, or default fallback
  const targetProfession = (profession || userProfession || 'photographer') as ValidProfession;

  return <UniversalDashboard profession={targetProfession} />;
};

// Smart Dynamic Showcase Route Component
const SmartShowcaseRoute = ({
  profession,
  ...props
}: {
  profession?: ValidProfession;
  [key: string]: any;
}) => {
  const { getUserProfession } = useDynamicProfessions();
  const userProfession = getUserProfession();

  // Use specified profession, user's profession, or default fallback
  const targetProfession = (profession || userProfession || 'photographer') as ValidProfession;

  return <UniversalShowcase profession={targetProfession} {...props} />;
};

// Smart Widget Route Component for file manager
const SmartFileManagerWidget = ({ profession }: { profession?: ValidProfession }) => {
  const { getUserProfession } = useDynamicProfessions();
  const userProfession = getUserProfession();

  // Use specified profession, user's profession, or default fallback
  const rawProfession = profession || userProfession || 'photographer';
  
  // Map ValidProfession to FileManagerProfession
  const mapToFileManagerProfession = (prof: string): FileManagerProfession => {
    switch (prof) {
      case 'vendor':
      case 'admin':
        return 'photographer'; // Default fallback for unsupported professions
      case 'designer':
        return 'designer';
      case 'videographer':
        return 'videographer';
      case 'music_producer':
        return 'music_producer';
      case 'photographer':
      default:
        return 'photographer';
  }
};

  const targetProfession = mapToFileManagerProfession(rawProfession);

  return <UnifiedFileManagerWidget profession={targetProfession} />;
};

function App() {
  // #region agent log
  console.log('[App] App component rendering at', new Date().toISOString());
  // #endregion
  const [location] = useLocation();

  React.useEffect(() => {
    const isAcademyRoute = /^\/academy(?:$|[/-])/.test(location);
    document.body.classList.toggle('academy-route', isAcademyRoute);

    return () => {
      document.body.classList.remove('academy-route');
    };
  }, [location]);

  return (
    <QueryClientProvider client={queryClient}>
      <DemoModeProvider>
        <UniversalSessionProvider>
          <ClientSessionProvider>
            <LanguageProvider>
              <ThemeProvider theme={creatorHubTheme}>
                <CssBaseline />
                <AuthProvider>
                  <EnhancedMasterIntegrationProvider
                    enableDebugMode={import.meta.env.MODE ==='development'}
                    enablePerformanceMonitoring={true}
                    enableAnalytics={true}
                  >
                    <ProjectProvider>
                      <GlobalChatProvider>
                <Switch>
                  {/* Login route */}
                  <Route path="/login" component={LoginPageSimple} />
                  {/* <Route path="/test" component={TestMinimal} /> */}
                  {/* TEMPORARY: Demo route for Evendi Timeline Admin - bypasses auth */}
                  <Route path="/wedding-timeline-admin-demo" component={() => (
                    <Box sx={{ p: 3, bgcolor: '#f5f5f5', minHeight: '100vh' }}>
                      <EvendiTimelineAdmin
                        projectId="demo-project-123"
                        weddingId="demo-wedding-456"
                      />
                    </Box>
                  )} />
                  <Route path="/showcase-amazon-demo" component={() => <ShowcaseAmazonDesign />} />
                  <Route path="/integration-test" component={IntegrationTest} />
                  <Route path="/email-designer" component={EmailDesignerPage} />
                  {/* <Route path="/google-oauth-setup" component={GoogleOAuthSetupPage} /> */}
                  {/* <Route path="/oauth-setup" component={OAuthSetup} /> */}
                  <Route path="/auth/linkedin/callback" component={LinkedInCallback} />
                  <Route path="/admin" component={AdminDashboardWrapper} />
                  <Route path="/verification-demo" component={VerificationSystemDashboard as React.ComponentType<any>} />
                  <Route path="/visual-cms-admin" component={VisualCMSAdminDashboard as React.ComponentType<any>} />
                  <Route path="/equipment-admin" component={EquipmentAdminPage} />
                  {/* <Route path="/worklog-test" component={WorklogTestPage} /> */}
                  {/* <Route path="/memory-card-test" component={MemoryCardBackupTest} /> */}
                  <Route path="/camera-selection-test" component={CameraSelectionTest} />
                  <Route path="/news" component={PersonalizedNews} />
                  <Route path="/lightroom-simulator" component={LightroomSimulator} />
                  {/* <Route path="/photography-tips-demo" component={PhotographyTipsCenter} /> */}
                  <Route
                    path="/contextual-photography-tips"
                    component={ContextualPhotographyTipsPage}
                  />
                  {/* <Route path="/communication-test" component={CommunicationTest as React.ComponentType<any>} /> */}
                  {/* <Route path="/onboarding" component={Onboarding} />
                  <Route path="/onboarding-test" component={Onboarding} /> */}
                  <Route
                    path="/photographer-dashboard-material"
                    component={() => <SmartDashboardRoute profession="photographer" />}
                  />
                  <Route
                    path="/videographer-dashboard-material"
                    component={() => <SmartDashboardRoute profession="videographer" />}
                  />
                  <Route
                    path="/videographer-dashboard"
                    component={() => <SmartDashboardRoute profession="videographer" />}
                  />
                  <Route
                    path="/music_producer-dashboard-material"
                    component={() => <SmartDashboardRoute profession="music_producer" />}
                  />
                  <Route
                    path="/music-producer-dashboard"
                    component={() => <SmartDashboardRoute profession="music_producer" />}
                  />
                  <Route
                    path="/vendor-dashboard-material"
                    component={() => <SmartDashboardRoute profession="vendor" />}
                  />
                  <Route path="/showcase/photographer" component={PhotoShowcase} />
                  <Route path="/photo-showcase" component={PhotoShowcase} />
                  <Route path="/video-showcase" component={PhotoShowcase} />
                  <Route path="/showcase/music_producer" component={MusicShowcase} />
                  <Route path="/showcase/:projectId" component={PhotoShowcase} />
                  <Route
                    path="/equipment-rental"
                    component={() => <SmartDashboardRoute profession="photographer" />}
                  />
                  <Route path="/academy" component={AcademyLandingPage as React.ComponentType<any>} />
                  <Route path="/academy-dashboard" component={AcademyDashboardCinematic as React.ComponentType<any>} />
                  <Route path="/academy/course-creator" component={CourseCreator as React.ComponentType<any>} />
                  <Route path="/academy/module-manager" component={ModuleManager as React.ComponentType<any>} />
                  <Route path="/academy/annotation-editor" component={VideoAnnotationEditor as React.ComponentType<any>} />
                  <Route path="/academy/quiz-manager" component={QuizManager as React.ComponentType<any>} />
                  <Route path="/academy/assignments" component={AcademyAssignmentsStudio as React.ComponentType<any>} />
                  <Route path="/academy/assignment-manager" component={AcademyAssignmentsStudio as React.ComponentType<any>} />
                  <Route path="/academy/enrollment" component={AcademyEnrollmentStudio as React.ComponentType<any>} />
                  <Route path="/academy/student-enrollment" component={AcademyEnrollmentStudio as React.ComponentType<any>} />
                  <Route path="/academy/student-dashboard" component={AcademyStudentDashboardStudio as React.ComponentType<any>} />
                  <Route path="/academy/dashboard/student" component={AcademyStudentDashboardStudio as React.ComponentType<any>} />
                  <Route path="/academy/analytics" component={AcademyAnalyticsStudio as React.ComponentType<any>} />
                  <Route path="/academy/canalytics" component={AcademyAnalyticsStudio as React.ComponentType<any>} />
                  <Route path="/academy/curriculum" component={AcademyCurriculumStudio as React.ComponentType<any>} />
                  <Route path="/academy/curriculum-manager" component={AcademyCurriculumStudio as React.ComponentType<any>} />
                  <Route path="/academy/lesson-editor" component={AcademyLessonStudio as React.ComponentType<any>} />
                  <Route path="/academy/lessons" component={AcademyLessonStudio as React.ComponentType<any>} />
                  <Route path="/academy/courses" component={CourseCreator as React.ComponentType<any>} />
                  <Route path="/academy/modules" component={ModuleManager as React.ComponentType<any>} />
                  <Route path="/academy/cohort-settings" component={AcademyCohortSettingsStudio as React.ComponentType<any>} />
                  <Route path="/academy/cohorts" component={AcademyCohortSettingsStudio as React.ComponentType<any>} />
                  <Route path="/academy/media" component={AcademyMediaStudio} />
                  <Route path="/academy/library" component={AcademyMediaStudio} />
                  <Route path="/academy/asset-browser" component={AcademyMediaStudio} />
                  <Route path="/academy/video-player" component={AcademyVideoPlayerStudio as React.ComponentType<any>} />
                  <Route path="/academy/assessments" component={QuizManager as React.ComponentType<any>} />
                  <Route path="/academy/monetization" component={AcademyMonetizationStudio as React.ComponentType<any>} />
                  <Route path="/academy/cta-overlay" component={AcademyCTAOverlayStudio as React.ComponentType<any>} />
                  <Route path="/academy/lower-thirds" component={AcademyLowerThirdsStudio as React.ComponentType<any>} />
                  <Route path="/academy/messages" component={AcademyStudentDashboardStudio as React.ComponentType<any>} />
                  <Route path="/academy/settings" component={CourseCreator as React.ComponentType<any>} />
                  <Route path="/community" component={CommunityLandingPageWrapper} />
                  <Route path="/help" component={() => <SmartDashboardRoute />} />
                  <Route
                    path="/vendor-dashboard"
                    component={() => <SmartDashboardRoute profession="vendor" />}
                  />
                  <Route
                    path="/northtone-showcase"
                    component={() => <NorthtoneVendorShowcase />}
                  />
                  <Route path="/settings" component={() => <SmartDashboardRoute />} />
                  <Route path="/resume-builder" component={ResumeBuilder} />
                  <Route path="/showcase-admin" component={ShowcaseAdmin as React.ComponentType<any>} />
                  {/* Plugin management routes removed - file doesn't exist */}
                  <Route path="/request-access" component={RequestAccess as React.ComponentType<any>} />
                  <Route path="/invite-status" component={InviteRequestStatus as React.ComponentType<any>} />
                  <Route path="/landing-mobile" component={LandingMobile as React.ComponentType<any>} />
                  <Route path="/landing-mobile-backup-sep19" component={() => {
                    return (
                      <React.Suspense fallback={<div>Loading...</div>}>
                        <LandingMobileBackupSep19 />
                      </React.Suspense>
                    );
                  }} />
                  <Route path="/landing-desktop" component={() => {
                    console.log('[App.tsx] Landing Desktop route matched!');
                    return (
                      <ErrorBoundary componentName="LandingDesktop" showDetails={true}>
                        <LandingDesktop />
                      </ErrorBoundary>
                    );
                  }} />
                  <Route path="/about" component={About as React.ComponentType<any>} />
                  <Route path="/pricing" component={PricingPage as React.ComponentType<any>} />
                  <Route path="/about-us" component={About as React.ComponentType<any>} />
                  <Route path="/client/gallery/:projectId/:accessToken" component={ClientGallery as React.ComponentType<any>} />
                  <Route path="/client/gallery/:accessToken" component={ClientGallery as React.ComponentType<any>} />
                  <Route path="/bryllup/:projectId" component={WeddingClient} />
                  <Route path="/showcase/:projectId" component={ShowcaseClient} />
                  <Route path="/showcase-enhanced/:projectId" component={ShowcaseClientEnhanced} />
                  <Route path="/showcase-enhanced-demo" component={() => <ShowcaseClientEnhanced />} />
                  <Route path="/virtual-studio-test" component={() => {
                    console.log('[App.tsx] Test route matched!');
                    return <div style={{ padding: '40px', backgroundColor: 'green', color: 'white', minHeight: '100vh', fontSize: '24px' }}>TEST ROUTE WORKS!</div>;
                  }} />
                  <Route path="/virtual-studio" component={() => {
                    console.log('[App.tsx] Virtual Studio route matched!');
                    try {
                      return <VirtualStudioPage />;
                    } catch (error) {
                      console.error('[App.tsx] Error rendering VirtualStudioPage:', error);
                      return <div style={{ padding: '20px', backgroundColor: 'red', color: 'white' }}>Error: {String(error)}</div>;
                    }
                  }} />
                  <Route path="/wedding-timeline" component={WeddingTimelineClientResponsive} />
                  <Route
                    path="/wedding-timeline/:timelineId/:accessCode"
                    component={WeddingTimelineClientResponsive}
                  />
                  <Route path="/dashboard" component={() => <SmartDashboardRoute />} />
                  <Route path="/story-arc-studio" component={StoryArcStudioRouteWrapper} />
                  <Route
                    path="/fotograf"
                    component={() => <SmartDashboardRoute profession="photographer" />}
                  />
                  <Route path="/" component={LandingResponsive} />
                  <Route path="/contracts/:id/sign" component={ContractSigningPage} />
                  <Route path="/price-administration" component={PriceAdministration} />
                  <Route path="/accounting/receipts" component={ReceiptsManager as React.ComponentType<any>} />
                  {/* <Route path="/meeting-workspace" component={MeetingWorkspaceSimple as React.ComponentType<any>} /> */}
                  <Route path="/business-branding" component={BusinessBrandingPage} />
                  <Route path="/contracts/:contractId" component={ContractView} />
                  <Route path="/admin-invite-system" component={AdminInviteSystem as React.ComponentType<any>} />
                  {/* <Route path="/company-profiles" component={CompanyProfilesPage} /> */}
                  {/* <Route path="/logo-integration-demo" component={LogoIntegrationDemo} /> */}
                  {/* <Route path="/logo-test-simple" component={LogoTestSimple} /> */}
                  {/* <Route path="/photo-enhancer-test" component={PhotoEnhancerTest} /> */}
                  {/* <Route path="/background-upload-test" component={BackgroundUploadTest} /> */}
                  {/* <Route path="/download-test" component={DownloadTest as React.ComponentType<any>} /> */}
                  {/* <Route path="/unified-file-manager-test" component={UnifiedFileManagerTest as React.ComponentType<any>} /> */}
                  {/* <Route path="/concurrent-operations-demo" component={ConcurrentOperationsDemo} /> */}
                  <Route
                    path="/showcase-gallery"
                    component={() => (
                      <SmartShowcaseRoute
                        profession="photographer"
                        userId="current-user"
                        isPublic={false}
                      />
                    )}
                  />
                  {/* <Route
                    path="/universal-vendor-showcase"
                    component={UniversalVendorShowcasePage as React.ComponentType<any>}
                  /> */}
                  {/* <Route path="/vendor-pricing-test" component={VendorPricingTestPage} /> */}
                  <Route path="/vendor-type-management" component={VendorTypeManagementPage} />
                  {/* <Route path="/vendor-onboarding-test" component={VendorOnboardingTestPage} /> */}
                  {/* <Route
                    path="/vendor-onboarding-with-invite"
                    component={VendorOnboardingWithInvitePage}
                  /> */}
                  {/* <Route path="/visual-cms" component={UniversalVisualCMS as React.ComponentType<any>} /> */}
                  {/* <Route path="/code-generator" component={CodeGenerator as React.ComponentType<any>} /> */}
                  <Route path="/wiremock" component={WireMockDashboard} />
                  <Route path="/deployment-manager" component={CompleteDeploymentManagerWrapper} />
                  <Route path="/bring-shipping" component={BringShippingDashboard} />
                  
                  {/* Vendor Dashboard Routes */}
                  <Route path="/vendor-dashboard" component={() => <UniversalVendorDashboard vendorType="general" vendorName="default" userId="current-user" />} />
                  <Route path="/vendor-dashboard/:vendorType" component={({ params }) => <UniversalVendorDashboard vendorType={params.vendorType} vendorName="default" userId="current-user" />} />
                  <Route path="/vendor-dashboard/:vendorType/:vendorName" component={({ params }) => <UniversalVendorDashboard vendorType={params.vendorType} vendorName={params.vendorName} userId="current-user" />} />
                  <Route path="/visual-editor-advanced" component={VisualEditorWithPageSelection as React.ComponentType<any>} />
                  <Route path="/visual-editor-unified" component={() => <CreatorhubVisualEditorRefactored />} />
                  <Route path="/visual-editor-enhanced" component={() => <EnhancedVisualEditorPage />} />
                  <Route path="/visual-editor-enhanced/:projectId" component={({ params }) => <EnhancedVisualEditorPage projectId={params.projectId} />} />
                  <Route path="/evendi" component={() => <EventiOnePager />} />
                  
                  {/* Unified Dashboard Routes */}
                  <Route path="/templates" component={() => <TemplateDashboard onTemplatesClick={() => {}} onCategoriesClick={() => {}} onSearchClick={() => {}} onPreviewClick={() => {}} />} />
                  <Route path="/export-presets" component={() => <ExportPresetsDashboard onPresetsClick={() => {}} onPlatformsClick={() => {}} onFormatsClick={() => {}} onPreviewClick={() => {}} />} />
                  <Route path="/cloud-sync" component={() => <CloudSyncDashboard onSyncClick={() => {}} onBackupsClick={() => {}} onSettingsClick={() => {}} onMonitoringClick={() => {}} />} />
                  <Route path="/team-collaboration" component={() => <TeamCollaborationDashboard onSettingsClick={() => {}} onMembersClick={() => {}} onWorkloadClick={() => {}} onSessionsClick={() => {}} onMobileClick={() => {}} onAnalyticsClick={() => {}} />} />
                  <Route path="/plugins" component={() => <PluginDashboard onHooksClick={() => {}} onComponentsClick={() => {}} onUtilitiesClick={() => {}} onThemesClick={() => {}} />} />
                  <Route path="/animations" component={() => <AnimationDashboard onAnimationsClick={() => {}} onTimelineClick={() => {}} onKeyframesClick={() => {}} onPreviewClick={() => {}} />} />
                  <Route path="/component-library" component={() => <ComponentLibraryDashboard onComponentsClick={() => {}} onCategoriesClick={() => {}} onTagsClick={() => {}} onDocumentationClick={() => {}} />} />
                  <Route path="/design-system" component={() => <DesignSystemDashboard onTokensClick={() => {}} onGuidelinesClick={() => {}} onThemesClick={() => {}} onDocumentationClick={() => {}} />} />
                  <Route path="/analytics" component={() => <AnalyticsDashboard onSettingsClick={() => {}} onExportClick={() => {}} />} />
                  <Route path="/audit" component={() => <AuditDashboard onSettingsClick={() => {}} onManagementClick={() => {}} onMonitoringClick={() => {}} onEventsClick={() => {}} onStatsClick={() => {}} onAlertsClick={() => {}} onExportClick={() => {}} />} />
                  <Route path="/monitoring" component={() => <MonitoringDashboard onSettingsClick={() => {}} onAlertsClick={() => {}} onMetricsClick={() => {}} onPerformanceClick={() => {}} onCachingClick={() => {}} onSystemClick={() => {}} />} />
                  <Route path="/system-management" component={() => <SystemManagementDashboard onSettingsClick={() => {}} onAlertsClick={() => {}} onMetricsClick={() => {}} onScalingClick={() => {}} onBackupClick={() => {}} onRecoveryClick={() => {}} />} />
        <Route path="/ml-optimization" component={() => <MLOptimizationDashboard onSettingsClick={() => {}} onModelsClick={() => {}} onPredictionsClick={() => {}} onOptimizationsClick={() => {}} onAnalyticsClick={() => {}} onTrainingClick={() => {}} />} />
        <Route path="/advanced-analytics" component={() => <AdvancedAnalyticsDashboard onSettingsClick={() => {}} onHeatmapsClick={() => {}} onBehaviorClick={() => {}} onFunnelsClick={() => {}} onTestsClick={() => {}} onInsightsClick={() => {}} />} />
        <Route path="/ai-assistance" component={() => <AIAssistanceDashboard onSettingsClick={() => {}} onSuggestionsClick={() => {}} onConversationsClick={() => {}} onCodeGenerationClick={() => {}} onDesignSuggestionsClick={() => {}} onWorkflowsClick={() => {}} />} />
        <Route path="/templates-presets" component={() => <TemplatePresetDashboard onSettingsClick={() => {}} onTemplatesClick={() => {}} onPresetsClick={() => {}} onCategoriesClick={() => {}} onImportClick={() => {}} onExportClick={() => {}} />} />
        <Route path="/client-communication" component={() => <ClientCommunicationDashboard onSettingsClick={() => {}} onTemplatesClick={() => {}} onSegmentsClick={() => {}} onAutomationClick={() => {}} onAnalyticsClick={() => {}} onDeadlinesClick={() => {}} />} />
        <Route path="/revenue-optimization" component={() => <RevenueOptimizationDashboard onSettingsClick={() => {}} onPricingClick={() => {}} onUpsellingClick={() => {}} onForecastingClick={() => {}} onAnalysisClick={() => {}} onMarketRatesClick={() => {}} />} />
        <Route path="/team-collaboration" component={() => <TeamCollaborationDashboard onSettingsClick={() => {}} onMembersClick={() => {}} onWorkloadClick={() => {}} onSessionsClick={() => {}} onMobileClick={() => {}} onAnalyticsClick={() => {}} />} />
                  
                  {/* <Route path="/oauth-robust" component={OAuthSetupPage} /> */}
                  {/* <Route path="/oauth" component={OAuthPage} /> */}

                                    <Route path="/photographer-dashboard/bring" component={() => <BringPhotographerDashboard profession={"photographer"} apiName={"bring"} />} />
                  <Route component={NotFound} />
                </Switch>
                <AdminNotificationDisplay />
                {/* Prototype Feedback Tool - only shows for prototype testers */}
                <PrototypeFeedbackTool component="Global" />
                {/* <BackgroundUploadWidget />
          <BackgroundDownloadWidget profession="photographer" /> */}
                <SmartFileManagerWidget />
                <UniversalSessionManager />
                <Toaster />
                <SpeedInsights />
                      </GlobalChatProvider>
                    </ProjectProvider>
                  </EnhancedMasterIntegrationProvider>
                </AuthProvider>
              </ThemeProvider>
            </LanguageProvider>
          </ClientSessionProvider>
        </UniversalSessionProvider>
      </DemoModeProvider>
    </QueryClientProvider>
  );
}

export default App;
