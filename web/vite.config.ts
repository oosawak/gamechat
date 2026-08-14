import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  // Dev server stays at /; production build is emitted into docs/ for GitHub Pages.
  base: command === 'build' ? './' : '/',
  build: {
    outDir: '../docs',
    emptyOutDir: false,
  },
}));
