import type { Plugin } from 'vite';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, statSync } from 'fs';
import { Buffer } from 'buffer';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const muiSystemAlias =
  [
    path.resolve(__dirname, 'node_modules/@mui/system'),
    path.resolve(__dirname, '../node_modules/@mui/material/node_modules/@mui/system'),
    path.resolve(__dirname, '../node_modules/@mui/system'),
  ].find((candidate) => existsSync(candidate)) || path.resolve(__dirname, 'node_modules/@mui/system');
const backendProxyTarget = process.env.VITE_API_PROXY_TARGET || process.env.API_PROXY_TARGET || 'http://localhost:3003';
const isStoryboardE2EHarness = process.env.STORYBOARD_E2E === '1';

const readGitValue = (command: string): string | null => {
  try {
    return (
      execSync(command, {
        cwd: __dirname,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim() || null
    );
  } catch {
    return null;
  }
};

const buildInfoPlugin = (): Plugin => ({
  name: 'creatorhub-build-info',
  generateBundle() {
    const gitSha =
      process.env.VITE_BUILD_GIT_SHA ||
      process.env.COMMIT_REF ||
      process.env.RENDER_GIT_COMMIT ||
      readGitValue('git rev-parse HEAD');
    const branch =
      process.env.VITE_BUILD_BRANCH ||
      process.env.HEAD ||
      process.env.BRANCH ||
      process.env.RENDER_GIT_BRANCH ||
      readGitValue('git rev-parse --abbrev-ref HEAD');
    const buildInfo = {
      app: 'creatorhub-frontend',
      surface: 'the-role-room',
      gitSha,
      shortSha: gitSha ? gitSha.slice(0, 7) : null,
      branch,
      builtAt: new Date().toISOString(),
      source: process.env.VITE_BUILD_SOURCE || (process.env.NETLIFY ? 'netlify' : 'local'),
      netlify: {
        context: process.env.CONTEXT || null,
        deployId: process.env.DEPLOY_ID || null,
        deployUrl: process.env.DEPLOY_PRIME_URL || process.env.DEPLOY_URL || process.env.URL || null,
        siteName: process.env.SITE_NAME || null,
      },
    };

    this.emitFile({
      type: 'asset',
      fileName: 'build-info.json',
      source: `${JSON.stringify(buildInfo, null, 2)}\n`,
    });
  },
});

// Custom plugin to resolve @/* paths with fallback (matches tsconfig.json behavior)
const customPathResolver = (): Plugin => {
  return {
    name: 'custom-path-resolver',
    resolveId(source, importer) {
      // Only handle @/* imports
      if (!source.startsWith('@/')) return null;

      const importPath = source.replace('@/', '');

      // Try creatorhubvirtualstudio/src first
      const virtualStudioBase = path.resolve(__dirname, 'client/src/components/creatorhubvirtualstudio/src');
      const virtualStudioPath = path.resolve(virtualStudioBase, importPath);

      // Check if file exists with common extensions or as directory with index
      const extensions = ['.tsx', '.ts', '.jsx', '.js'];
      for (const ext of extensions) {
        const fullPath = virtualStudioPath + ext;
        if (existsSync(fullPath)) {
          return fullPath;
        }
      }

      // Check for directory with index file
      if (existsSync(virtualStudioPath)) {
        try {
          if (statSync(virtualStudioPath).isDirectory()) {
            for (const ext of extensions) {
              const indexPath = path.join(virtualStudioPath, `index${ext}`);
              if (existsSync(indexPath)) {
                return indexPath;
              }
            }
          }
        } catch {
          // Ignore stat errors
        }
      }

      // Fallback to client/src
      const fallbackBase = path.resolve(__dirname, 'client/src');
      const fallbackPath = path.resolve(fallbackBase, importPath);

      for (const ext of extensions) {
        const fullPath = fallbackPath + ext;
        if (existsSync(fullPath)) {
          return fullPath;
        }
      }

      // Check for directory with index file in fallback
      if (existsSync(fallbackPath)) {
        try {
          if (statSync(fallbackPath).isDirectory()) {
            for (const ext of extensions) {
              const indexPath = path.join(fallbackPath, `index${ext}`);
              if (existsSync(indexPath)) {
                return indexPath;
              }
            }
          }
        } catch {
          // Ignore stat errors
        }
      }

      // Return null to let Vite's default resolver handle it
      return null;
    },
  };
};

export default defineConfig({
  // Keep the dedicated Storyboard E2E optimizer isolated from ordinary dev
  // servers. Concurrent Vite processes must never invalidate each other's
  // dependency metadata and force a full-page reload mid-scenario.
  cacheDir: isStoryboardE2EHarness
    ? path.resolve(__dirname, 'node_modules/.vite-storyboard-e2e')
    : undefined,
  define: {
    // Fix for third-party modules that use process.env
    'process.env': {},
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    __CREATORHUB_BUILD_VERSION__: JSON.stringify(
      process.env.VITE_BUILD_GIT_SHA ||
        process.env.COMMIT_REF ||
        process.env.RENDER_GIT_COMMIT ||
        readGitValue('git rev-parse HEAD') ||
        'unknown',
    ),
    // Polyfill global for browser
    global: 'globalThis',
  },
  plugins: [
    buildInfoPlugin(),
    customPathResolver(), // Custom path resolver for @/* with fallback
    tailwindcss(), // Tailwind v4 — utilities + theme only (preflight skippet i src/styles/tailwind.css)
    react({
      babel: {
        plugins: [
          ...(process.env.NODE_ENV === 'production'
            ? [['transform-remove-console', { exclude: ['error', 'warn'] }]]
            : []),
        ],
      },
    }),
  ],
  root: './client',
  resolve: {
    dedupe: ['react', 'react-dom', 'three', '@emotion/react', '@emotion/styled'],
    alias: {
      // @/* is handled by customPathResolver plugin
      '@shared': path.resolve(__dirname, 'shared'),
      '@assets': path.resolve(__dirname, 'client/src/assets'),
      '@server': path.resolve(__dirname, 'shared'),
      // Keep @mui/system aligned with @mui/material's major version (v6 here).
      '@mui/system': muiSystemAlias,
      'react-quill$': path.resolve(__dirname, 'client/src/components/QuillWrapper.tsx'),
      'react-quill': path.resolve(__dirname, 'client/src/components/QuillWrapper.tsx'),
      // Buffer polyfill for browser
      buffer: 'buffer',
    },
  },
  build: {
    // Optimize build for better performance
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: false,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'client/index.html'),
        casting: path.resolve(__dirname, 'client/casting.html'),
        theroleroom: path.resolve(__dirname, 'client/theroleroom.html'),
      },
      external: (id) => {
        // Exclude external drive paths
        if (id.includes('/Volumes/Samsung_T9_4TB1/')) return true;
        // Exclude rgthree dependencies
        if (id.startsWith('rgthree/')) return true;
        // @tauri-apps/api er KUN tilgjengelig i Post Agent-klienten (Tauri), ikke
        // i web-frontenden. mockup-video/tauriBridge importerer den dynamisk bak
        // en isTauri()-guard, så den kjøres aldri i nettleser. Eksternaliser så
        // Rollup ikke prøver å resolve den under web-bygget.
        if (id === '@tauri-apps/api/core' || id === '@tauri-apps/api/event' || id.startsWith('@tauri-apps/api'))
          return true;
        return false;
      },
      output: {
        // Code splitting for better caching
        manualChunks: {
          // Vendor chunks
          'react-vendor': ['react', 'react-dom'],
          'mui-vendor': ['@mui/material', '@mui/icons-material', '@mui/lab'],
          'utils-vendor': ['date-fns', 'lodash', 'uuid'],
          // App chunks
        },
        // Optimize chunk file names
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId ? chunkInfo.facadeModuleId.split('/').pop() : 'chunk';
          return `js/[name]-[hash].js`;
        },
        entryFileNames: 'js/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
  },
  css: {
    // Optimize CSS
    devSourcemap: false,
  },
  optimizeDeps: {
    include: [
      'buffer',
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      '@mui/material',
      '@mui/icons-material',
      '@mui/system',
      '@emotion/react',
      '@emotion/styled',
      '@tanstack/react-query',
      'wouter',
      'zustand',
      'recharts',
      'framer-motion',
      'lodash',
      'date-fns',
      'notistack',
      'zod',
      'axios',
      ...(isStoryboardE2EHarness ? ['@mui/material/styles', 'react-is'] : []),
    ],
    exclude: ['rgthree/common/rgthree_api.js', 'rgthree/common/components/base_custom_element', 'three-stdlib'],
    // The main application has a broad dependency graph. Storyboard E2E uses a
    // dedicated entry so unrelated dynamic routes cannot discover new chunks
    // mid-scenario and force a destructive full-page reload.
    entries: isStoryboardE2EHarness
      ? ['e2e-drawing-editor.html']
      : ['./client/**/*.{js,jsx,ts,tsx}'],
    // The harness dependencies above are intentionally explicit. Disabling
    // runtime discovery in E2E mode prevents a late lazy import from starting
    // a second optimization pass and reloading the editor under Playwright.
    // Normal development keeps Vite's automatic discovery enabled.
    noDiscovery: isStoryboardE2EHarness,
    holdUntilCrawlEnd: true,
    esbuildOptions: {
      // Ignore external paths completely
      plugins: [
        {
          name: 'ignore-external-paths',
          setup(build) {
            // Ignore any imports from external drives
            build.onResolve({ filter: /.*/ }, (args) => {
              // Mark anything from external drives as external
              if (args.importer?.includes('/Volumes/Samsung_T9_4TB1/')) {
                return { external: true, path: args.path };
              }
              if (args.path.includes('/Volumes/Samsung_T9_4TB1/')) {
                return { external: true, path: args.path };
              }
              // Mark rgthree imports as external
              if (args.path.startsWith('rgthree/')) {
                return { external: true, path: args.path };
              }
            });
          },
        },
      ],
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5001,
    allowedHosts: true,
    hmr: {
      overlay: false,
    },
    proxy: {
      '/api': {
        target: backendProxyTarget,
        changeOrigin: true,
        secure: false,
      },
      '/ws': {
        target: backendProxyTarget,
        ws: true,
        changeOrigin: true,
      },
      '/auth': { target: backendProxyTarget, changeOrigin: true },
      '/socket': {
        target: backendProxyTarget,
        ws: true,
        changeOrigin: true,
      },
    },
    watch: {
      ignored: [
        '**/backups/**',
        '**/backups_temp/**',
        '**/.git/**',
        '**/node_modules/**',
        // Build verification may run beside Playwright in the same worktree.
        // Generated HTML must not reload an active editor scenario.
        '**/dist/**',
        '**/dist-geo/**',
        '**/Volumes/Samsung_T9_4TB1/**', // Ignore external drive paths
        '**/pretrained_models/**', // Ignore pretrained models directories
        '**/ComfyUI/**', // Ignore ComfyUI directories
      ],
    },
    fs: {
      // Allow serving files from external drives, but don't scan them
      allow: ['..'],
      strict: false,
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 5001,
  },
});
