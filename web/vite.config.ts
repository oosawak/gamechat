import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  // GitHub Pages serves this project below /gamechat/; dev stays at /.
  base: command === 'build' ? '/gamechat/' : '/',
}));
