import { defineConfig } from 'vite';

export default defineConfig({
  root: 'examples',
  server: {
    open: true,
  },
  build: {
    outDir: '../dist-examples',
  },
}); 