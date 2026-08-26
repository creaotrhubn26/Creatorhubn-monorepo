import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: [
      'server/project-team-access.test.ts',
      'server/projects-routes-access.test.ts',
      'server/workspace-contract-routes.test.ts',
      'server/wedding-production-map-routes.test.ts',
      'server/realtime-user-events.test.ts',
      'server/sound-room-events.test.ts',
    ],
    exclude: ['node_modules/**', 'dist/**'],
  },
});
