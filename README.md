# web-luts

A lightweight TypeScript library for applying LUT (Look-Up Table) color grading to web images. 

![Demo](https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNW1veTgwMm81am9ia3YwOWprbnlhYjc1OXl0c3ZlMGZvNWdxaDNkYyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/J2awouDsf23R2ZtuP2/giphy.gif)

## Features

- Apply professional color grading to any `<img>` element
- Supports WebGL 2.0 for high-performance 3D LUTs
- Fallback to WebGL 1.0 with 2D tiled textures
- Built-in presets: normal, vintage, cinematic, serious-vintage, lights-out, sci-fi
- Load custom .cube LUT files
- Control grading strength/intensity
- SSR-safe (no-op on server)
- TypeScript types included
- Zero runtime dependencies, < 10KB gzipped

## Installation

```bash
# npm
npm install web-luts

# pnpm 
pnpm add web-luts

# yarn
yarn add web-luts
```

## Quick Start

```js
import { ColorGrader } from 'web-luts';

// Apply to all images at load time
ColorGrader.init({ 
  mode: 'cinematic',
  strength: 0.8
});

// OR: Apply to specific images
const heroImage = document.getElementById('hero');
ColorGrader.apply({ 
  target: heroImage, 
  mode: 'vintage' 
});

// Dynamically change strength
document.querySelector('#strength-slider').addEventListener('input', (e) => {
  ColorGrader.setStrength(parseFloat(e.target.value));
});

// Switch between looks
document.querySelectorAll('input[name="mode"]').forEach(radio => {
  radio.addEventListener('change', (e) => {
    ColorGrader.setMode(e.target.value);
  });
});

// Reset to original image
document.querySelector('#reset-btn').addEventListener('click', () => {
  ColorGrader.reset(heroImage);
});
```

## API Reference

### ColorGrader.init(options?)

Initialize the library, optionally processing all images at load time.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `mode` | string | `'normal'` | Preset name or custom LUT handle |
| `strength` | number | `1.0` | Blend strength (0-1) |
| `selector` | string | `'img'` | CSS selector for images to process |
| `autoload` | boolean | `true` | Preload all preset LUTs |

### ColorGrader.apply(options)

Apply a LUT to a specific target.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `target` | HTMLImageElement \| NodeListOf<HTMLImageElement> \| string | (required) | Target image(s) or selector |
| `mode` | string | (current default) | Preset name or custom LUT handle |
| `lut` | ParsedLut | - | Direct LUT data (overrides mode) |
| `strength` | number | (current default) | Blend strength (0-1) |

### ColorGrader.setStrength(strength, target?)

Update the blending strength.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `strength` | number | (required) | Blend strength (0-1) |
| `target` | HTMLImageElement \| NodeListOf<HTMLImageElement> \| string | (all images) | Target image(s) or selector |

### ColorGrader.setMode(mode, target?)

Change the active LUT.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `mode` | string | (required) | Preset name or custom LUT handle |
| `target` | HTMLImageElement \| NodeListOf<HTMLImageElement> \| string | (all images) | Target image(s) or selector |

### ColorGrader.loadCustomCube(urlOrText)

Load a custom .cube file.

| Parameter | Type | Description |
|-----------|------|-------------|
| `urlOrText` | string | URL to .cube file or raw .cube file content |

Returns a handle string to use with `mode` parameter in other functions.

### ColorGrader.reset(target?)

Reset image(s) to their original state.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `target` | HTMLImageElement \| NodeListOf<HTMLImageElement> \| string | (all images) | Target image(s) or selector |

## Built-in Presets

- `normal` - No color grading (identity LUT)
- `vintage` - Warm, faded film look
- `cinematic` - Hollywood-style teal and orange
- `serious-vintage` - Stronger vintage with more contrast
- `lights-out` - Dark, moody look with blue shadows
- `sci-fi` - Cool blue-green tint

## Development

```bash
# Install dependencies
pnpm install

# Run development server with example
pnpm run dev

# Run tests
pnpm test

# Build library
pnpm build
```

## License

MIT 