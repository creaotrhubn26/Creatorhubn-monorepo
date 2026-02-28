// Buffer polyfill for browser compatibility (must be first)
import { Buffer } from 'buffer';
(window as any).Buffer = Buffer;

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initSentry } from './utils/sentry';
import { normalizeRequestUrl } from './lib/normalizeRequestUrl';

declare global {
  interface Window {
    __creatorhubFetchNormalized?: boolean;
  }
}

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

// #region agent log
console.log('[main.tsx] All imports loaded at', new Date().toISOString());
console.log('[main.tsx] React:', typeof React);
console.log('[main.tsx] ReactDOM:', typeof ReactDOM);
console.log('[main.tsx] App:', typeof App);
// #endregion

// Initialize Sentry for error tracking
try {
  initSentry();
  console.log('[main.tsx] Sentry initialized');
} catch (error) {
  console.error('[main.tsx] Sentry init error:', error);
}

installFetchNormalization();

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

  try {
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log('[main.tsx] Render called successfully');
  } catch (error) {
    console.error('[main.tsx] Error during render:', error);
    rootElement.innerHTML = `<div style="padding: 40px; background: red; color: white;">
      <h1>Render Error</h1>
      <pre>${error instanceof Error ? error.stack : String(error)}</pre>
    </div>`;
  }
}

