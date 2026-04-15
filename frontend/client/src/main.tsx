// Buffer polyfill for browser compatibility (must be first)
import { Buffer } from 'buffer';
window.Buffer = Buffer;

import React from 'react';
import ReactDOM from 'react-dom/client';
import { initSentry } from './utils/sentry';
import { bootstrapCreatorHubGoogleLoginRedirect } from './lib/creatorhubGoogleAuth';
import { normalizeRequestUrl } from './lib/normalizeRequestUrl';
import {
  isRoleRoomDedicatedHost,
  isRoleRoomStandalonePathname,
} from './components/role-room/utils/runtime';
import { registerRoleRoomPwaServiceWorker } from './components/role-room/services/roleRoomPwaService';
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
const ROLE_ROOM_SHARED_APP_ROUTE_PATTERN = /^\/(?:privacy-policy|terms-and-conditions)\/?$/;
const LOCALHOST_HOSTNAME_SET = new Set(['localhost', '127.0.0.1']);

const shouldUseVisualEditorBootstrap = (pathname: string): boolean =>
  VISUAL_EDITOR_ROUTE_PATTERN.test(pathname);

const shouldUseAdminBootstrap = (pathname: string): boolean =>
  ADMIN_ROUTE_PATTERN.test(pathname);

const shouldUseRoleRoomDedicatedHostBootstrap = (
  locationLike: Pick<Location, 'hostname' | 'pathname'>,
): boolean => {
  const hostname = locationLike.hostname?.trim().toLowerCase() || '';
  const pathname = locationLike.pathname || '';
  if (ROLE_ROOM_SHARED_APP_ROUTE_PATTERN.test(pathname.trim().toLowerCase())) {
    return false;
  }
  if (
    LOCALHOST_HOSTNAME_SET.has(hostname) &&
    (shouldUseAdminBootstrap(pathname) || shouldUseVisualEditorBootstrap(pathname))
  ) {
    return false;
  }
  if (LOCALHOST_HOSTNAME_SET.has(hostname)) {
    return isRoleRoomStandalonePathname(pathname, locationLike);
  }
  return isRoleRoomDedicatedHost(hostname);
};

const resolveRootComponent = async (): Promise<React.ComponentType> => {
  if (shouldUseRoleRoomDedicatedHostBootstrap(window.location)) {
    const module = await import('./components/role-room/casting-main');
    return module.default;
  }

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
  shouldUseRoleRoomDedicatedHostBootstrap(window.location)
    ? 'role-room-host'
    : shouldUseVisualEditorBootstrap(window.location.pathname)
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

if (shouldUseRoleRoomDedicatedHostBootstrap(window.location)) {
  void registerRoleRoomPwaServiceWorker().catch((error) => {
    console.warn('[main.tsx] Role Room service worker registration failed:', error);
  });
}

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
  const shouldBootstrapCreatorHubGoogleRedirect = !shouldUseRoleRoomDedicatedHostBootstrap(window.location);

  // #region agent log
  console.log('[main.tsx] Creating root, about to render');
  // #endregion

  void (shouldBootstrapCreatorHubGoogleRedirect
    ? bootstrapCreatorHubGoogleLoginRedirect()
    : Promise.resolve())
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
