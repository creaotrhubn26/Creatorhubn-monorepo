import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**'],
    // Pg-integrasjonstester deler databasen ledgerly_test; kjør filer sekvensielt
    // for å unngå kryssende transaksjoner, men tester i samme fil kan være parallelle.
    fileParallelism: false,
    testTimeout: 20000,
  },
});
