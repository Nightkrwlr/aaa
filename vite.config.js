import { defineConfig } from 'vite';

// DEV_TOOLS: debug menu, god mode, seed tools. Always false in production builds.
export default defineConfig(({ mode }) => ({
  base: './',
  define: {
    __DEV_TOOLS__: JSON.stringify(mode !== 'production'),
    __BUILD_ID__: JSON.stringify(process.env.BUILD_ID ?? 'local'),
  },
  server: { port: 5173, host: true },
  build: { target: 'es2022', sourcemap: mode !== 'production', chunkSizeWarningLimit: 1400 },
}));
