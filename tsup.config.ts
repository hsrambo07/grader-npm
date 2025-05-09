import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: true,
  treeshake: true,
  injectStyle: false,
  esbuildOptions(options) {
    options.banner = {
      js: '// web-luts - WebGL-based LUT color grading for web images\n// https://github.com/yourusername/web-luts',
    };
  },
}); 