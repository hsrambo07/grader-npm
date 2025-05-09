import { loadPreset, isValidPreset, parseCubeFile, preloadAllPresets, PRESETS } from './presets';
import { apply, resetImage } from './core/apply';
import type { ApplyOptions } from './core/apply';
import type { ParsedLut } from './core/lutLoader';
import { disposeEngines } from './core/apply';
import { createIdentityLut } from './core/lutLoader';

// Types
export interface InitOptions {
  mode?: string;
  strength?: number;
  selector?: string;
  autoload?: boolean;
}

// SSR guard
const isBrowser = typeof window !== 'undefined';

/**
 * ColorGrader - Main class for applying LUT color grading to images
 */
export class ColorGrader {
  private static customLuts: Map<string, ParsedLut> = new Map();
  private static defaultStrength: number = 1.0;
  private static defaultMode: string = PRESETS.NORMAL;
  private static initialized: boolean = false;
  private static selector: string = 'img';
  
  /**
   * Initialize the ColorGrader to apply to all images at load time
   * @param options - Configuration options
   */
  public static init(options: InitOptions = {}): void {
    if (!isBrowser) return;
    
    const {
      mode = PRESETS.NORMAL,
      strength = 1.0,
      selector = 'img',
      autoload = true,
    } = options;
    
    // Store defaults
    this.defaultMode = mode;
    this.defaultStrength = strength;
    this.selector = selector;
    this.initialized = true;
    
    // Preload LUTs in the background
    if (autoload) {
      preloadAllPresets();
    }
    
    // Process existing images
    this.applyToSelector(this.selector, mode, strength);
    
    // Set up mutation observer to process new images
    this.setupMutationObserver();
  }
  
  /**
   * Apply color grading to target image(s)
   * @param options - Apply options
   * @returns Processed image(s) or null
   */
  public static async apply(options: ApplyOptions): Promise<HTMLImageElement | NodeListOf<HTMLImageElement> | null> {
    if (!isBrowser) return null;
    
    const { target, mode, lut, strength = this.defaultStrength, scope } = options;
    
    // Handle selector string
    if (typeof target === 'string') {
      return this.applyToSelector(target, mode, strength);
    }
    
    // Handle direct LUT application
    if (lut) {
      return apply({
        target,
        lut,
        strength,
        scope,
      });
    }
    
    // Handle preset mode
    if (mode) {
      try {
        const lutData = await this.getLutForMode(mode);
        return apply({
          target,
          lut: lutData,
          strength,
          scope,
        });
      } catch (error) {
        console.error(`Failed to apply mode "${mode}":`, error);
        return null;
      }
    }
    
    // Default behavior - use current default mode
    try {
      const lutData = await this.getLutForMode(this.defaultMode);
      return apply({
        target,
        lut: lutData,
        strength,
        scope,
      });
    } catch (error) {
      console.error('Failed to apply default mode:', error);
      return null;
    }
  }
  
  /**
   * Set the strength of color grading
   * @param strength - Blend strength (0-1)
   * @param target - Optional target elements
   */
  public static async setStrength(strength: number, target?: HTMLImageElement | NodeListOf<HTMLImageElement> | string): Promise<void> {
    if (!isBrowser) return;
    
    // Update default if no target
    if (!target) {
      this.defaultStrength = strength;
      
      // Reapply to all images
      this.applyToSelector(this.selector, this.defaultMode, strength);
      return;
    }
    
    // Handle string selector
    if (typeof target === 'string') {
      this.applyToSelector(target, this.defaultMode, strength);
      return;
    }
    
    // Apply to specific target
    await this.apply({
      target,
      mode: this.defaultMode,
      strength,
    });
  }
  
  /**
   * Set the active LUT mode
   * @param mode - Preset name or custom LUT handle
   * @param target - Optional target elements
   */
  public static async setMode(mode: string, target?: HTMLImageElement | NodeListOf<HTMLImageElement> | string): Promise<void> {
    if (!isBrowser) return;
    
    // Update default if no target
    if (!target) {
      this.defaultMode = mode;
      
      // Reapply to all images
      this.applyToSelector(this.selector, mode, this.defaultStrength);
      return;
    }
    
    // Handle string selector
    if (typeof target === 'string') {
      this.applyToSelector(target, mode, this.defaultStrength);
      return;
    }
    
    // Apply to specific target
    await this.apply({
      target,
      mode,
      strength: this.defaultStrength,
    });
  }
  
  /**
   * Load a custom .cube file from URL or text content
   * @param urlOrText - URL to a .cube file or raw .cube file content
   * @returns Handle to reference the custom LUT
   */
  public static async loadCustomCube(urlOrText: string): Promise<string> {
    if (!isBrowser) return 'custom';
    
    try {
      let lut: ParsedLut;
      
      // Check if this is a URL or raw content
      if (urlOrText.trim().startsWith('TITLE') || urlOrText.trim().startsWith('LUT_3D_SIZE')) {
        // Parse as raw content
        lut = parseCubeFile(urlOrText);
      } else {
        // Load from URL
        const response = await fetch(urlOrText);
        const text = await response.text();
        lut = parseCubeFile(text);
      }
      
      // Generate a unique handle
      const handle = `custom_${Date.now()}`;
      
      // Store in custom LUTs
      this.customLuts.set(handle, lut);
      
      return handle;
    } catch (error) {
      console.error('Failed to load custom .cube:', error);
      return 'custom_error';
    }
  }
  
  /**
   * Reset image(s) to original state
   * @param target - Target elements to reset
   */
  public static reset(target?: HTMLImageElement | NodeListOf<HTMLImageElement> | string): void {
    if (!isBrowser) return;
    
    // No target - reset all images
    if (!target) {
      const images = document.querySelectorAll<HTMLImageElement>(this.selector);
      images.forEach(resetImage);
      return;
    }
    
    // String selector
    if (typeof target === 'string') {
      const images = document.querySelectorAll<HTMLImageElement>(target);
      images.forEach(resetImage);
      return;
    }
    
    // NodeList
    if ('length' in target) {
      for (let i = 0; i < target.length; i++) {
        resetImage(target[i] as HTMLImageElement);
      }
      return;
    }
    
    // Single image
    resetImage(target);
  }
  
  /**
   * Clean up resources
   */
  public static dispose(): void {
    if (!isBrowser) return;
    
    // Reset all images
    this.reset();
    
    // Clean up GL resources
    disposeEngines();
    
    // Clear custom LUTs
    this.customLuts.clear();
    
    // Reset state
    this.initialized = false;
  }
  
  /**
   * Apply to images matching a selector
   * @param selector - CSS selector
   * @param mode - LUT mode
   * @param strength - Blend strength
   */
  private static async applyToSelector(
    selector: string,
    mode?: string,
    strength: number = this.defaultStrength
  ): Promise<NodeListOf<HTMLImageElement> | null> {
    if (!isBrowser) return null;
    
    const images = document.querySelectorAll<HTMLImageElement>(selector);
    if (images.length === 0) return null;
    
    try {
      const lutData = await this.getLutForMode(mode || this.defaultMode);
      return apply({
        target: images,
        lut: lutData,
        strength,
      });
    } catch (error) {
      console.error('Failed to apply to selector:', error);
      return null;
    }
  }
  
  /**
   * Set up mutation observer to process new images
   */
  private static setupMutationObserver(): void {
    if (!isBrowser || !this.initialized) return;
    
    const observer = new MutationObserver(mutations => {
      let hasNewImages = false;
      
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          for (const node of mutation.addedNodes) {
            // Handle direct image additions
            if (node instanceof HTMLImageElement && 
                node.matches(this.selector)) {
              hasNewImages = true;
              break;
            }
            
            // Handle container additions that might contain images
            if (node instanceof Element) {
              const images = node.querySelectorAll<HTMLImageElement>(this.selector);
              if (images.length > 0) {
                hasNewImages = true;
                break;
              }
            }
          }
        }
      }
      
      // Process new images if found
      if (hasNewImages) {
        this.applyToSelector(this.selector, this.defaultMode, this.defaultStrength);
      }
    });
    
    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }
  
  /**
   * Get LUT data for a mode
   * @param mode - Mode name or handle
   * @returns Promise for LUT data
   */
  private static async getLutForMode(mode: string): Promise<ParsedLut> {
    // Check custom LUTs first
    if (this.customLuts.has(mode)) {
      return this.customLuts.get(mode)!;
    }
    
    // Check presets
    if (isValidPreset(mode)) {
      return await loadPreset(mode);
    }
    
    // Fall back to normal
    console.warn(`Unknown mode "${mode}", falling back to normal`);
    return await loadPreset(PRESETS.NORMAL);
  }
}

// Export types
export type { ParsedLut } from './core/lutLoader';
export type { ApplyOptions } from './core/apply';
export { PRESETS, createIdentityLut };

// Export default
export default ColorGrader; 