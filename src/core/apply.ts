import { GlEngine } from './glEngine';
import type { ParsedLut } from './lutLoader';

// Cache GlEngine instances
const engineCache = new Map<string, GlEngine>();
const originalImages = new WeakMap<HTMLImageElement, string>();

/**
 * Apply options for color grading images
 */
export interface ApplyOptions {
  target: HTMLImageElement | NodeListOf<HTMLImageElement> | null;
  mode?: string;
  lut?: ParsedLut;
  strength?: number;
  scope?: string;
}

/**
 * Apply a LUT to images
 * @param options - Apply options
 * @returns Processed images or null if no valid targets
 */
export function apply(options: ApplyOptions): HTMLImageElement | NodeListOf<HTMLImageElement> | null {
  const { target, mode, lut, strength = 1.0, scope } = options;
  
  if (!target) return null;
  
  // Handle NodeList
  if ('length' in target) {
    for (let i = 0; i < target.length; i++) {
      const image = target[i] as HTMLImageElement;
      applyToImage(image, mode, lut, strength);
    }
    return target;
  }
  
  // Handle single image
  return applyToImage(target, mode, lut, strength);
}

/**
 * Apply a LUT to a single image
 * @param image - Target image
 * @param mode - LUT preset name
 * @param lut - Custom LUT data
 * @param strength - Blend strength
 * @returns Processed image
 */
export function applyToImage(
  image: HTMLImageElement,
  mode?: string,
  lut?: ParsedLut,
  strength: number = 1.0
): HTMLImageElement {
  // Ensure image has crossorigin attribute for external images
  if (image.src.startsWith('http') && !image.src.includes(window.location.host)) {
    if (!image.hasAttribute('crossorigin')) {
      console.warn('Adding crossorigin attribute to image for WebGL texture access');
      image.setAttribute('crossorigin', 'anonymous');
      // If the image is already loaded, we need to reload it with crossorigin attribute
      if (image.complete) {
        const originalSrc = image.src;
        image.src = '';
        setTimeout(() => {
          image.src = originalSrc;
        }, 0);
        return image;
      }
    }
  }

  if (!image.complete) {
    // For incomplete images, set up a load handler
    image.addEventListener('load', () => {
      applyToImage(image, mode, lut, strength);
    }, { once: true });
    return image;
  }
  
  if (!mode && !lut) {
    console.warn('No mode or LUT provided for color grading');
    return image;
  }
  
  // Store original source if not already saved
  if (!originalImages.has(image)) {
    originalImages.set(image, image.src);
  }
  
  // Create a unique key for this LUT
  const lutKey = mode || 'custom';
  
  // Get or create the GL engine
  let engine = engineCache.get(lutKey);
  if (!engine) {
    engine = new GlEngine();
    engineCache.set(lutKey, engine);
  }
  
  // Load the LUT if needed
  if (lut) {
    engine.loadLut(lut, 'custom');
  }
  
  // Apply the LUT
  try {
    const canvas = engine.apply(image, strength);
    
    // Update the image with the processed canvas
    if (canvas.toDataURL) {
      image.src = canvas.toDataURL();
    }
  } catch (error) {
    console.error('Failed to apply color grading:', error);
    
    // Check for security errors (might be CORS related)
    if (error instanceof DOMException && error.name === 'SecurityError') {
      console.error('WebGL security error: Image may be tainted due to CORS. Make sure your images have crossorigin="anonymous" attribute.');
    }
  }
  
  return image;
}

/**
 * Reset an image to its original state
 * @param image - Image to reset
 */
export function resetImage(image: HTMLImageElement): void {
  const originalSrc = originalImages.get(image);
  if (originalSrc) {
    image.src = originalSrc;
  }
}

/**
 * Dispose of all GL engines to free resources
 */
export function disposeEngines(): void {
  for (const engine of engineCache.values()) {
    engine.dispose();
  }
  engineCache.clear();
} 