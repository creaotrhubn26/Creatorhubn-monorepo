import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, statSync } from 'fs';
import { Buffer } from 'buffer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Custom plugin to resolve @/* paths with fallback (matches tsconfig.json behavior)
const customPathResolver = (): Plugin => {
  return {
    name: 'custom-path-resolver',
    resolveId(source, importer) {
      // Only handle @/* imports
      if (!source.startsWith('@/')) return null;
      
      const importPath = source.replace('@/', '');
      
      // Try creatorhubvirtualstudio/src first
      const virtualStudioBase = path.resolve(
        __dirname,
        'client/src/components/creatorhubvirtualstudio/src'
      );
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
  define: {
    // Fix for third-party modules that use process.env
    'process.env': {},
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    // Polyfill global for browser
    global: 'globalThis',
  },
  plugins: [
    customPathResolver(), // Custom path resolver for @/* with fallback
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
    alias: {
      // @/* is handled by customPathResolver plugin
      '@shared': path.resolve(__dirname, 'shared'),
      '@assets': path.resolve(__dirname, 'client/src/assets'),
      '@server': path.resolve(__dirname, 'shared'),
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
    sourcemap: process.env.NODE_ENV === 'development',
    rollupOptions: {
      external: (id) => {
        // Exclude unused directory from build
        if (id.includes('/unused/')) return true;
        // Exclude external drive paths
        if (id.includes('/Volumes/Samsung_T9_4TB1/')) return true;
        // Exclude rgthree dependencies
        if (id.startsWith('rgthree/')) return true;
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
          const facadeModuleId = chunkInfo.facadeModuleId
            ? chunkInfo.facadeModuleId.split('/').pop()
            : 'chunk';
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
    devSourcemap: process.env.NODE_ENV === 'development',
  },
  optimizeDeps: {
    include: ['buffer'],
    exclude: [
      'rgthree/common/rgthree_api.js',
      'rgthree/common/components/base_custom_element',
    ],
    // Only scan files within the project directory
    entries: [
      './client/**/*.{js,jsx,ts,tsx}',
    ],
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
    port: 5000,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      '/auth': { target: 'http://localhost:3001', changeOrigin: true },
      '/socket': {
        target: 'http://localhost:3001',
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
    port: 5000,
  },
});
