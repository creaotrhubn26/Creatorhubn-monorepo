import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['server/**/*.test.ts', 'scripts/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**'],
  },
});
