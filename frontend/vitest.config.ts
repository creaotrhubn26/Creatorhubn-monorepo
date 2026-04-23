import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  // Mirror the `@/*` → `client/src/*` resolution the main vite config
  // does via its customPathResolver plugin. Without this, tests that
  // transitively import a module using `@/lib/…` paths (e.g. via a
  // component being rendered) fail with "Failed to resolve import".
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'client/src'),
      '@shared': path.resolve(__dirname, 'shared'),
      '@assets': path.resolve(__dirname, 'client/src/assets'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./client/src/test/setupTests.ts'],
    include: ['./client/src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['./e2e/**', './node_modules/**'],
  },
});
