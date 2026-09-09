import { defineConfig } from 'vite';

// Relative base so the built site works from a repo subpath (GitHub Pages)
// as well as from a domain root.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    assetsInlineLimit: 2048,
    rollupOptions: {
      output: {
        manualChunks: { three: ['three'] },
      },
    },
  },
});
