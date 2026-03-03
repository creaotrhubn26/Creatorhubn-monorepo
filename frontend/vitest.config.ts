import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./client/src/test/setupTests.ts'],
    include: ['./client/src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['./e2e/**', './node_modules/**'],
  },
});
