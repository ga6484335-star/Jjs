import { defineConfig } from 'vite';

// Relative base keeps the build portable: it works from a GitHub Pages
// project URL (e.g. /Jjs/), a subdirectory, or a custom domain.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
  },
});
