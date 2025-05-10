import type { ParsedLut } from './lutLoader';
import { applyLutToImageDataJS } from './jsLutProcessor'; // Import new JS processor

const originalImages = new WeakMap<HTMLImageElement, string>();
const processingState = new WeakMap<HTMLImageElement, boolean>(); // To prevent re-entrant processing loops

/**
 * Apply options for color grading images
 */
export interface ApplyOptions {
  target: HTMLImageElement | NodeListOf<HTMLImageElement> | null;
  mode?: string; // Mode will be resolved to LUT by ColorGrader class
  lut?: ParsedLut; // Direct LUT data
  strength?: number;
}

/**
 * Apply a LUT to images
 * @param options - Apply options
 * @returns Processed images or null if no valid targets
 */
export function apply(options: ApplyOptions): HTMLImageElement | NodeListOf<HTMLImageElement> | null {
  const { target, lut, strength = 1.0 } = options;
  
  if (!target || !lut) {
    console.warn('Apply function called without target or LUT data.');
    return null;
  }
  
  // No engine or LUT loading needed here anymore

  // Handle NodeList
  if ('length' in target) {
    for (let i = 0; i < target.length; i++) {
      const image = target[i] as HTMLImageElement;
      applyToImage(image, lut, strength); // Pass lut
    }
    return target;
  }
  
  // Handle single image
  return applyToImage(target, lut, strength); // Pass lut
}

/**
 * Apply a LUT to a single image
 * @param image - Target image
 * @param lut - The LUT data to apply
 * @param strength - Blend strength
 * @returns Processed image
 */
function applyToImage(
  image: HTMLImageElement,
  lut: ParsedLut, // Added lut parameter
  strength: number = 1.0
): HTMLImageElement {
  if (processingState.get(image)) {
    console.warn("Image is already being processed, skipping duplicate call for:", image.src);
    return image;
  }

  const trulyOriginalSrc = originalImages.get(image);
  if (trulyOriginalSrc && image.src !== trulyOriginalSrc && !image.src.startsWith('data:')) {
    // Image has been processed before by external means, or src changed unrelated to our processing
    // Re-capture this new src as the base for this operation, but don't treat as "truly original" for future resets.
    // This case is tricky; for now, we proceed assuming current image.src is the base if it changed from original.
    // OR, if it's not a data: URL (ours), it might have been changed by something else.
    // The most robust is to ensure originalImages ALWAYS stores the very first src.
  } 
  // If image.src is a data: URL, it means it was processed by us. We need to revert to trulyOriginalSrc.
  if (trulyOriginalSrc && image.src.startsWith('data:')) {
    processingState.set(image, true);
    image.src = trulyOriginalSrc;
    image.addEventListener('load', () => {
        processingState.delete(image);
        processImageWithJS(image, lut, strength, true);
    }, { once: true });
    image.addEventListener('error', () => {
        processingState.delete(image);
        console.error("Error reloading original image for reprocessing:", image.src);
    }, { once: true });
    return image;
  }
  
  return processImageWithJS(image, lut, strength, false);
}

// New helper function to contain the core JS processing logic
function processImageWithJS(
    image: HTMLImageElement, 
    lut: ParsedLut, 
    strength: number, 
    isReprocess: boolean
) {
  if (processingState.get(image) && !isReprocess) { // Allow reprocess calls to proceed
    console.warn("Image is already being processed (processImageWithJS entry guard):", image.src);
    return image;
  }
  processingState.set(image, true);

  // Ensure image has crossorigin attribute for external images
  if (image.src && image.src.startsWith('http') && !image.src.includes(window.location.host)) {
    if (!image.hasAttribute('crossorigin')) {
      image.setAttribute('crossorigin', 'anonymous');
      // If image was already complete, changing crossorigin requires a reload.
      if (image.complete && !isReprocess) { // Avoid forced reload if it's a reprocess after load
        const originalSrcToReload = image.src;
        // Clear src to force reload, then set it back. Add load/error handlers.
        image.src = ''; 
        const loadHandler = () => {
            processingState.delete(image);
            processImageWithJS(image, lut, strength, isReprocess); 
        };
        const errorHandler = () => {
            processingState.delete(image);
            console.error('Error reloading image after setting crossorigin:', originalSrcToReload);
        };
        image.addEventListener('load', loadHandler, { once: true });
        image.addEventListener('error', errorHandler, { once: true });
        image.src = originalSrcToReload;
        return image;
      }
    }
  }

  if (!image.complete) {
    image.addEventListener('load', () => {
      processingState.delete(image);
      processImageWithJS(image, lut, strength, isReprocess);
    }, { once: true });
    image.addEventListener('error', () => {
        processingState.delete(image);
        console.error("Error loading image for processing:", image.src);
    }, { once: true });
    // If we added crossorigin and the image wasn't complete, it will load with the attribute.
    // If it was already loading, this new load listener will catch it.
    return image;
  }
  
  // Store original source if not already saved and if it's not a data URL from previous processing by us.
  if (!originalImages.has(image) && !image.src.startsWith('data:')) {
    originalImages.set(image, image.src);
  }
  
  try {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = image.naturalWidth;
    tempCanvas.height = image.naturalHeight;
    const ctx = tempCanvas.getContext('2d');

    if (!ctx) {
      throw new Error("Could not get 2D context from canvas");
    }

    ctx.drawImage(image, 0, 0);
    const imageData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const modifiedImageData = applyLutToImageDataJS(imageData, lut, strength);
    ctx.putImageData(modifiedImageData, 0, 0);
    
    image.src = tempCanvas.toDataURL();

  } catch (error) {
    console.error('Failed to apply color grading with JS processor:', error);
    if (error instanceof DOMException && error.name === 'SecurityError') {
      console.error('Canvas SecurityError (tainted by cross-origin data). Ensure images have `crossorigin="anonymous"` if from a different domain.');
    }
  } finally {
    processingState.delete(image); // Clear processing flag
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
    if (image.src !== originalSrc) { // Only change src if it's different
        image.src = originalSrc;
    }
  } else {
    // If no original is stored, we can't reset it meaningfully. 
    // Could consider removing any data: URL if that's a sign of our processing.
  }
  processingState.delete(image); // Clear any pending processing state on reset
}

// Removed: disposeEngines function, as it's handled by ColorGrader.disposeSharedEngine()
// export function disposeEngines(): void {
//   // Logic is now in ColorGrader
// } 