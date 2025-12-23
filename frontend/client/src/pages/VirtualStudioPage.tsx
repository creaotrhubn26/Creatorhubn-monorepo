import React from 'react';
import AppShell from'../components/creatorhubvirtualstudio/src/app/AppShell';
import { FaceAnalysisProvider } from '../components/creatorhubvirtualstudio/src/contexts/FaceAnalysisContext';

/**
 * Virtual Studio Page - 3D Virtual Studio for CreatorHub
 *
 * This page renders the complete Virtual Studio application with: * - 2D/3D stage renderer
 * - Scene layers and measurements
 * - Template manager and pose editor
 * - Lighting controls (IES, gobos, modifiers)
 * - Camera controls and multi-cam views
 * - Render/export functionality
 * - Community hub integration
 */
export default function VirtualStudioPage() {
  // #region agent log
  console.log('[VirtualStudioPage] Component function called at', new Date().toISOString());
  console.log('[VirtualStudioPage] AppShell type:', typeof AppShell);
  console.log('[VirtualStudioPage] AppShell value:', AppShell);
  React.useEffect(() => {
    try {
      console.log('[VirtualStudioPage] useEffect running');
      fetch('http://127.0.0.1:7242/ingest/0bda4408-a4ac-499d-af8d-1291b9fac2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VirtualStudioPage.tsx:16',message:'VirtualStudioPage mounted',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      const appShellAvailable = typeof AppShell !== 'undefined';
      console.log('[VirtualStudioPage] AppShell available:', appShellAvailable);
      fetch('http://127.0.0.1:7242/ingest/0bda4408-a4ac-499d-af8d-1291b9fac2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VirtualStudioPage.tsx:19',message:'AppShell import check',data:{appShellAvailable},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    } catch (error) {
      console.error('[VirtualStudioPage] Error in useEffect:', error);
      fetch('http://127.0.0.1:7242/ingest/0bda4408-a4ac-499d-af8d-1291b9fac2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VirtualStudioPage.tsx:22',message:'Error in VirtualStudioPage useEffect',data:{error:String(error),stack:error instanceof Error?error.stack:''},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    }
  }, []);
  // #endregion

  // #region agent log
  console.log('[VirtualStudioPage] About to render, AppShell is:', AppShell);
  // #endregion

  // Simple test render first
  if (!AppShell) {
    console.error('[VirtualStudioPage] AppShell is undefined!');
    return (
      <FaceAnalysisProvider>
        <div style={{ padding: '40px', backgroundColor: 'red', color: 'white', minHeight: '100vh' }}>
          <h1>ERROR: AppShell is undefined</h1>
          <p>Check the browser console and network tab for import errors</p>
        </div>
      </FaceAnalysisProvider>
    );
  }

  try {
    return (
      <FaceAnalysisProvider>
        <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', position: 'relative' }}>
          <AppShell />
        </div>
      </FaceAnalysisProvider>
    );
  } catch (error) {
    console.error('[VirtualStudioPage] Error rendering AppShell:', error);
    return (
      <FaceAnalysisProvider>
        <div style={{ padding: '40px', backgroundColor: 'orange', minHeight: '100vh' }}>
          <h2>Error loading Virtual Studio</h2>
          <pre style={{ background: '#f0f0f0', padding: '10px', overflow: 'auto' }}>
            {error instanceof Error ? error.stack : String(error)}
          </pre>
        </div>
      </FaceAnalysisProvider>
    );
  }
}
