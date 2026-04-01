// Buffer polyfill for browser compatibility (must be first)
import { Buffer } from 'buffer';
window.Buffer = Buffer;

import React from 'react';
import ReactDOM from 'react-dom/client';
import { initSentry } from './utils/sentry';
import { bootstrapCreatorHubGoogleLoginRedirect } from './lib/creatorhubGoogleAuth';
import { normalizeRequestUrl } from './lib/normalizeRequestUrl';
import './styles/academy-responsive.css';

declare global {
  interface Performance {
    startTiming?: (operation: string) => () => void;
  }

  interface Window {
    Buffer: typeof Buffer;
    __creatorhubFetchNormalized?: boolean;
  }
}

const VISUAL_EDITOR_ROUTE_PATTERN = /^\/(?:visual-editor-enhanced(?:\/.*)?|evendi(?:\/.*)?)$/;
const ADMIN_ROUTE_PATTERN = /^\/(?:admin|visual-cms-admin|equipment-admin)(?:\/.*)?$/;

const shouldUseVisualEditorBootstrap = (pathname: string): boolean =>
  VISUAL_EDITOR_ROUTE_PATTERN.test(pathname);

const shouldUseAdminBootstrap = (pathname: string): boolean =>
  ADMIN_ROUTE_PATTERN.test(pathname);

const resolveRootComponent = async (): Promise<React.ComponentType> => {
  if (shouldUseVisualEditorBootstrap(window.location.pathname)) {
    const module = await import('./visual-editor-entry');
    return module.default;
  }

  if (shouldUseAdminBootstrap(window.location.pathname)) {
    const module = await import('./admin-entry');
    return module.default;
  }

  const module = await import('./App');
  return module.default;
};

function installFetchNormalization() {
  if (window.__creatorhubFetchNormalized) return;

  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string') {
      return nativeFetch(normalizeRequestUrl(input), init);
    }

    if (input instanceof URL) {
      return nativeFetch(normalizeRequestUrl(input.toString()), init);
    }

    if (input instanceof Request) {
      const normalizedUrl = normalizeRequestUrl(input.url);
      if (normalizedUrl !== input.url) {
        return nativeFetch(new Request(normalizedUrl, input), init);
      }
    }

    return nativeFetch(input, init);
  };

  window.__creatorhubFetchNormalized = true;
}

function installPerformanceTimingFallback() {
  const perf = window.performance as Performance;
  if (!perf || typeof perf.startTiming === 'function') return;

  const noopStartTiming = () => () => {};
  try {
    Object.defineProperty(perf, 'startTiming', {
      configurable: true,
      writable: true,
      value: noopStartTiming,
    });
  } catch {
    perf.startTiming = noopStartTiming;
  }
}

// #region agent log
console.log('[main.tsx] All imports loaded at', new Date().toISOString());
console.log('[main.tsx] React:', typeof React);
console.log('[main.tsx] ReactDOM:', typeof ReactDOM);
console.log(
  '[main.tsx] Bootstrap mode:',
  shouldUseVisualEditorBootstrap(window.location.pathname)
    ? 'visual-editor'
    : shouldUseAdminBootstrap(window.location.pathname)
      ? 'admin'
      : 'app',
);
// #endregion

// Initialize Sentry for error tracking
try {
  initSentry();
  console.log('[main.tsx] Sentry initialized');
} catch (error) {
  console.error('[main.tsx] Sentry init error:', error);
}

installFetchNormalization();
installPerformanceTimingFallback();

// #region agent log
console.log('[main.tsx] Getting root element');
// #endregion

const rootElement = document.getElementById('root');

// #region agent log
console.log('[main.tsx] Root element:', rootElement);
// #endregion

if (!rootElement) {
  console.error('[main.tsx] Root element not found!');
  document.body.innerHTML = '<div style="padding: 40px; background: red; color: white;">ERROR: Root element not found!</div>';
} else {
  const root = ReactDOM.createRoot(rootElement);

  // #region agent log
  console.log('[main.tsx] Creating root, about to render');
  // #endregion

  void bootstrapCreatorHubGoogleLoginRedirect()
    .catch((error) => {
      console.error('[main.tsx] Google login bootstrap failed:', error);
    })
    .then(() => resolveRootComponent())
    .then((RootComponent) => {
      console.log('[main.tsx] Root component loaded');
      root.render(
        <React.StrictMode>
          <RootComponent />
        </React.StrictMode>
      );
      console.log('[main.tsx] Render called successfully');
    })
    .catch((error) => {
      console.error('[main.tsx] Error during render:', error);
      rootElement.innerHTML = `<div style="padding: 40px; background: red; color: white;">
      <h1>Render Error</h1>
      <pre>${error instanceof Error ? error.stack : String(error)}</pre>
    </div>`;
    });
}
