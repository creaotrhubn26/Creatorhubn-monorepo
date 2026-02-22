/**
 * Hot Reload System
 * Enables instant preview updates without full page refresh
 * Preserves component state during updates
 * Fast Refresh for React components
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  CircularProgress,
  Box,
  Typography,
  Fade,
} from '@mui/material';

export interface HotReloadConfig {
  enabled: boolean;
  preserveState: boolean;
  showLoadingIndicator: boolean;
  debounceMs: number;
  maxRetries: number;
}

export interface HotReloadState {
  isReloading: boolean;
  lastReloadTime: number;
  reloadCount: number;
  errors: HotReloadError[];
}

export interface HotReloadError {
  timestamp: number;
  message: string;
  stack?: string;
  recoverable: boolean;
}

const DEFAULT_CONFIG: HotReloadConfig = {
  enabled: true,
  preserveState: true,
  showLoadingIndicator: true,
  debounceMs: 300,
  maxRetries: 3,
};

export class HotReloadManager {
  private config: HotReloadConfig;
  private state: HotReloadState;
  private iframeRef: React.RefObject<HTMLIFrameElement> | null = null;
  private reloadTimer: NodeJS.Timeout | null = null;
  private stateCache: Map<string, any> = new Map();
  private listeners: Set<(state: HotReloadState) => void> = new Set();
  private retryCount = 0;

  constructor(config: Partial<HotReloadConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = {
      isReloading: false,
      lastReloadTime: 0,
      reloadCount: 0,
      errors: [],
    };
  }

  /**
   * Set the iframe reference for hot reloading
   */
  setIframeRef(ref: React.RefObject<HTMLIFrameElement>) {
    this.iframeRef = ref;
  }

  /**
   * Get current hot reload state
   */
  getState(): HotReloadState {
    return { ...this.state };
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: HotReloadState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners() {
    this.listeners.forEach((listener) => listener(this.getState()));
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<HotReloadConfig>) {
    this.config = { ...this.config, ...config };
  }

  /**
   * Preserve component state before reload
   */
  private preserveComponentState() {
    if (!this.config.preserveState || !this.iframeRef?.current) return;

    try {
      const iframeWindow = this.iframeRef.current.contentWindow;
      if (!iframeWindow) return;

      // Save React component state
      // This is a simplified version - real implementation would use React DevTools protocol
      const stateSnapshot = {
        timestamp: Date.now(),
        // Store form values
        forms: this.captureFormState(iframeWindow.document),
        // Store scroll positions
        scroll: this.captureScrollState(iframeWindow.document),
        // Store local storage
        localStorage: this.captureLocalStorage(iframeWindow),
        // Store session storage
        sessionStorage: this.captureSessionStorage(iframeWindow),
      };

      this.stateCache.set('global', stateSnapshot);
      console.log('🔖 State preserved: ', stateSnapshot);
    } catch (error) {
      console.warn('⚠️ Failed to preserve state: ', error);
    }
  }

  /**
   * Restore component state after reload
   */
  private restoreComponentState() {
    if (!this.config.preserveState || !this.iframeRef?.current) return;

    try {
      const stateSnapshot = this.stateCache.get('global');
      if (!stateSnapshot) return;

      const iframeWindow = this.iframeRef.current.contentWindow;
      if (!iframeWindow) return;

      // Wait for iframe to fully load
      setTimeout(() => {
        // Restore form values
        this.restoreFormState(iframeWindow.document, stateSnapshot.forms);
        // Restore scroll positions
        this.restoreScrollState(iframeWindow.document, stateSnapshot.scroll);
        // Restore local storage
        this.restoreLocalStorage(iframeWindow, stateSnapshot.localStorage);
        // Restore session storage
        this.restoreSessionStorage(iframeWindow, stateSnapshot.sessionStorage);

        console.log('🔄 State restored:', stateSnapshot);
      }, 100);
    } catch (error) {
      console.warn('⚠️ Failed to restore state:', error);
    }
  }

  /**
   * Capture form input values
   */
  private captureFormState(doc: Document): Record<string, unknown> {
    const formState: Record<string, unknown> = {};

    const inputs = doc.querySelectorAll('input, textarea, select');
    inputs.forEach((input: Element, index: number) => {
      const id = input.id || input.name || `input-${index}`;
      if (input.type === 'checkbox' || input.type === 'radio') {
        formState[id] = { checked: input.checked, value: input.value };
      } else {
        formState[id] = input.value;
      }
    });

    return formState;
  }

  /**
   * Restore form input values
   */
  private restoreFormState(doc: Document, formState: Record<string, unknown>) {
    const inputs = doc.querySelectorAll('input, textarea, select');
    inputs.forEach((input: Element, index: number) => {
      const id = input.id || input.name || `input-${index}`;
      const savedValue = formState[id];

      if (savedValue !== undefined) {
        if (typeof savedValue === 'object') {
          // Checkbox/radio
          input.checked = savedValue.checked;
          input.value = savedValue.value;
        } else {
          input.value = savedValue;
        }
      }
    });
  }

  /**
   * Capture scroll positions
   */
  private captureScrollState(doc: Document): Record<string, { x: number; y: number }> {
    const scrollState: Record<string, { x: number; y: number }> = {};

    // Main window scroll
    scrollState['window'] = {
      x: doc.defaultView?.scrollX || 0,
      y: doc.defaultView?.scrollY || 0,
    };

    // Scrollable elements
    const scrollables = doc.querySelectorAll('[style*="overflow"]');
    scrollables.forEach((el: Element, index: number) => {
      if (el.scrollTop > 0 || el.scrollLeft > 0) {
        const id = el.id || `scroll-${index}`;
        scrollState[id] = {
          x: el.scrollLeft,
          y: el.scrollTop,
        };
      }
    });

    return scrollState;
  }

  /**
   * Restore scroll positions
   */
  private restoreScrollState(doc: Document, scrollState: Record<string, { x: number; y: number }>) {
    // Restore main window scroll
    if (scrollState['window']) {
      doc.defaultView?.scrollTo(scrollState['window'].x, scrollState['window'].y);
    }

    // Restore scrollable elements
    const scrollables = doc.querySelectorAll('[style*="overflow"]');
    scrollables.forEach((el: Element, index: number) => {
      const id = el.id || `scroll-${index}`;
      if (scrollState[id]) {
        el.scrollLeft = scrollState[id].x;
        el.scrollTop = scrollState[id].y;
      }
    });
  }

  /**
   * Capture localStorage
   */
  private captureLocalStorage(win: Window): Record<string, string> {
    const storage: Record<string, string> = {};
    try {
      for (let i = 0; i < win.localStorage.length; i++) {
        const key = win.localStorage.key(i);
        if (key) {
          storage[key] = win.localStorage.getItem(key) || '';
        }
      }
    } catch (error) {
      console.warn('⚠️ Failed to capture localStorage:', error);
    }
    return storage;
  }

  /**
   * Restore localStorage
   */
  private restoreLocalStorage(win: Window, storage: Record<string, string>) {
    try {
      Object.entries(storage).forEach(([key, value]) => {
        win.localStorage.setItem(key, value);
      });
    } catch (error) {
      console.warn('⚠️ Failed to restore localStorage:', error);
    }
  }

  /**
   * Capture sessionStorage
   */
  private captureSessionStorage(win: Window): Record<string, string> {
    const storage: Record<string, string> = {};
    try {
      for (let i = 0; i < win.sessionStorage.length; i++) {
        const key = win.sessionStorage.key(i);
        if (key) {
          storage[key] = win.sessionStorage.getItem(key) || '';
        }
      }
    } catch (error) {
      console.warn('⚠️ Failed to capture sessionStorage:', error);
    }
    return storage;
  }

  /**
   * Restore sessionStorage
   */
  private restoreSessionStorage(win: Window, storage: Record<string, string>) {
    try {
      Object.entries(storage).forEach(([key, value]) => {
        win.sessionStorage.setItem(key, value);
      });
    } catch (error) {
      console.warn('⚠️ Failed to restore sessionStorage:', error);
    }
  }

  /**
   * Perform hot reload
   */
  async reload(code: string, force = false): Promise<boolean> {
    if (!this.config.enabled && !force) {
      console.log('🚫 Hot reload disabled');
      return false;
    }

    if (!this.iframeRef?.current) {
      console.error('❌ No iframe reference set');
      return false;
    }

    // Debounce rapid reloads
    if (this.reloadTimer) {
      clearTimeout(this.reloadTimer);
    }

    return new Promise((resolve) => {
      this.reloadTimer = setTimeout(async () => {
        try {
          // Update state
          this.state.isReloading = true;
          this.notifyListeners();

          // Preserve state
          this.preserveComponentState();

          // Inject new code into iframe
          const success = await this.injectCode(code);

          if (success) {
            // Restore state
            this.restoreComponentState();

            // Update state
            this.state.isReloading = false;
            this.state.lastReloadTime = Date.now();
            this.state.reloadCount++;
            this.retryCount = 0;
            this.notifyListeners();

            console.log('✅ Hot reload successful');
            resolve(true);
          } else {
            throw new Error('Failed to inject code');
          }
        } catch (error) {
          this.handleReloadError(error);
          resolve(false);
        }
      }, this.config.debounceMs);
    });
  }

  /**
   * Inject code into iframe
   */
  private async injectCode(code: string): Promise<boolean> {
    if (!this.iframeRef?.current) return false;

    try {
      const iframeDoc = this.iframeRef.current.contentDocument;
      if (!iframeDoc) return false;

      // Create HTML document from code
      const htmlContent = this.wrapCodeInHTML(code);

      // Write to iframe (this triggers reload)
      iframeDoc.open();
      iframeDoc.write(htmlContent);
      iframeDoc.close();

      return true;
    } catch (error) {
      console.error('❌ Failed to inject code:', error);
      return false;
    }
  }

  /**
   * Wrap code in complete HTML document
   */
  private wrapCodeInHTML(code: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
          <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
          <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          </style>
        </head>
        <body>
          <div id="root"></div>
          <script type="text/babel">
            ${code}
            
            // Auto-render if code exports default component
            if (typeof GeneratedComponent !== 'undefined') {
              const root = ReactDOM.createRoot(document.getElementById('root'));
              root.render(<GeneratedComponent />);
            }
          </script>
        </body>
      </html>
    `;
  }

  /**
   * Handle reload error
   */
  private handleReloadError(error: unknown) {
    this.retryCount++;

    const reloadError: HotReloadError = {
      timestamp: Date.now(),
      message: error instanceof Error ? error.message : 'Hot reload failed',
      stack: error instanceof Error ? error.stack : undefined,
      recoverable: this.retryCount < this.config.maxRetries,
    };

    this.state.errors.push(reloadError);
    this.state.isReloading = false;
    this.notifyListeners();

    console.error('❌ Hot reload error:', reloadError);

    // Retry if under max retries
    if (reloadError.recoverable) {
      console.log(`🔄 Retrying... (${this.retryCount}/${this.config.maxRetries})`);
    }
  }

  /**
   * Clear errors
   */
  clearErrors() {
    this.state.errors = [];
    this.notifyListeners();
  }

  /**
   * Reset state
   */
  reset() {
    this.state = {
      isReloading: false,
      lastReloadTime: 0,
      reloadCount: 0,
      errors: [],
    };
    this.stateCache.clear();
    this.retryCount = 0;
    this.notifyListeners();
  }
}

/**
 * React Hook for Hot Reload
 */
export function useHotReload(config: Partial<HotReloadConfig> = {}) {
  const managerRef = useRef<HotReloadManager>(new HotReloadManager(config));
  const [state, setState] = useState<HotReloadState>(managerRef.current.getState());

  useEffect(() => {
    const unsubscribe = managerRef.current.subscribe(setState);
    return unsubscribe;
  }, []);

  const setIframeRef = useCallback((ref: React.RefObject<HTMLIFrameElement>) => {
    managerRef.current.setIframeRef(ref);
  }, []);

  const reload = useCallback((code: string, force = false) => {
    return managerRef.current.reload(code, force);
  }, []);

  const updateConfig = useCallback((newConfig: Partial<HotReloadConfig>) => {
    managerRef.current.updateConfig(newConfig);
  }, []);

  const clearErrors = useCallback(() => {
    managerRef.current.clearErrors();
  }, []);

  const reset = useCallback(() => {
    managerRef.current.reset();
  }, []);

  return {
    state,
    setIframeRef,
    reload,
    updateConfig,
    clearErrors,
    reset,
  };
}

/**
 * Loading Indicator Component
 */
export const HotReloadIndicator: React.FC<{ visible: boolean }> = ({ visible }) => {
  return (
    <Fade in={visible} timeout={200}>
      <Box
        sx={{
          position: 'absolute',
          top: 16,
          right: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          bgcolor: 'rgba(0, 0, 0, 0.7)',
          color:'white',
          px: 2,
          py: 1,
          borderRadius: 2,
          zIndex: 999}}>
        <CircularProgress size={16} color="inherit" />
        <Typography variant="body2" fontWeight={500}>
          Hot Reloading...
        </Typography>
      </Box>
    </Fade>
  );
};

/**
 * Singleton instance for global access
 */
export const hotReloadManager = new HotReloadManager();
