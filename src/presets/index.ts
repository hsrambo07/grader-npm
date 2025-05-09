import { loadCubeFromUrl, parseCubeFile, createIdentityLut } from '../core/lutLoader';
import type { ParsedLut } from '../core/lutLoader';

// Preset names
export const PRESETS = {
  NORMAL: 'normal',
  VINTAGE: 'vintage',
  CINEMATIC: 'cinematic',
  SERIOUS_VINTAGE: 'serious-vintage',
  LIGHTS_OUT: 'lights-out',
  SCI_FI: 'sci-fi',
} as const;

export type PresetName = typeof PRESETS[keyof typeof PRESETS];

// Relative URLs to preset LUTs
const PRESET_URLS: Record<PresetName, string> = {
  [PRESETS.NORMAL]: new URL('./normal.cube', import.meta.url).href,
  [PRESETS.VINTAGE]: new URL('./vintage.cube', import.meta.url).href,
  [PRESETS.CINEMATIC]: new URL('./cinematic.cube', import.meta.url).href,
  [PRESETS.SERIOUS_VINTAGE]: new URL('./serious-vintage.cube', import.meta.url).href,
  [PRESETS.LIGHTS_OUT]: new URL('./lights-out.cube', import.meta.url).href,
  [PRESETS.SCI_FI]: new URL('./sci-fi.cube', import.meta.url).href,
};

// Cache for loaded presets
const presetCache = new Map<PresetName, ParsedLut>();

/**
 * Loads a preset LUT by name
 * @param name - Preset name to load
 * @returns Promise resolving to the loaded LUT
 */
export async function loadPreset(name: PresetName): Promise<ParsedLut> {
  // Return from cache if available
  if (presetCache.has(name)) {
    return presetCache.get(name)!;
  }
  
  try {
    // First try to load the LUT from the URL
    const url = PRESET_URLS[name];
    
    try {
      // Try to load from URL
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch LUT: ${response.statusText}`);
      }
      
      const text = await response.text();
      const lut = parseCubeFile(text);
      
      // Validate the LUT - ensure it has the correct number of entries
      const expectedEntries = lut.size * lut.size * lut.size * 3;
      if (lut.data.length !== expectedEntries) {
        console.warn(`LUT '${name}' has incomplete data (${lut.data.length} vs expected ${expectedEntries}). Using programmatic fallback.`);
        throw new Error('Incomplete LUT data');
      }
      
      // Cache for future use
      presetCache.set(name, lut);
      return lut;
    } catch (error) {
      // If loading fails, generate a programmatic fallback
      console.warn(`Failed to load preset "${name}" from URL, using programmatic fallback:`, error);
      
      // For normal preset, use identity LUT
      if (name === PRESETS.NORMAL) {
        const fallback = createIdentityLut(17);
        presetCache.set(name, fallback);
        return fallback;
      }
      
      // For other presets, create a colored LUT
      const fallback = createProgrammaticLut(name);
      presetCache.set(name, fallback);
      return fallback;
    }
  } catch (error) {
    console.error(`Failed to load preset "${name}":`, error);
    
    // Ultimate fallback to identity LUT
    const fallback = createIdentityLut();
    presetCache.set(name, fallback);
    return fallback;
  }
}

/**
 * Creates a programmatic LUT based on the preset name
 * @param name - Preset name
 * @returns Generated LUT
 */
function createProgrammaticLut(name: PresetName): ParsedLut {
  const size = 17;
  const data = new Float32Array(size * size * size * 3);
  let i = 0;
  
  // Generate different tints based on preset name
  for (let b = 0; b < size; b++) {
    for (let g = 0; g < size; g++) {
      for (let r = 0; r < size; r++) {
        const normalR = r / (size - 1);
        const normalG = g / (size - 1);
        const normalB = b / (size - 1);
        
        let finalR = normalR;
        let finalG = normalG;
        let finalB = normalB;
        
        switch (name) {
          case PRESETS.VINTAGE:
            // Warm, faded look
            finalR = Math.min(1.0, normalR * 1.1 + 0.05);
            finalG = Math.min(1.0, normalG * 0.95 + 0.03);
            finalB = Math.min(1.0, normalB * 0.8);
            break;
            
          case PRESETS.CINEMATIC:
            // Teal shadows, orange highlights
            if (normalR + normalG + normalB < 1.5) {
              // Shadows to teal
              finalR = normalR * 0.9;
              finalG = normalG * 1.05;
              finalB = normalB * 1.1;
            } else {
              // Highlights to orange
              finalR = Math.min(1.0, normalR * 1.1);
              finalG = Math.min(1.0, normalG * 1.0);
              finalB = Math.min(1.0, normalB * 0.9);
            }
            break;
            
          case PRESETS.SERIOUS_VINTAGE:
            // Strong vintage
            finalR = Math.min(1.0, normalR * 1.15 + 0.07);
            finalG = Math.min(1.0, normalG * 0.85 + 0.04);
            finalB = Math.min(1.0, normalB * 0.7);
            break;
            
          case PRESETS.LIGHTS_OUT:
            // Dark with blue tint in shadows
            finalR = normalR * 0.85;
            finalG = normalG * 0.9;
            finalB = Math.min(1.0, normalB * 1.05 + 0.04);
            break;
            
          case PRESETS.SCI_FI:
            // Cool blue-green
            finalR = normalR * 0.8;
            finalG = Math.min(1.0, normalG * 1.05 + 0.03);
            finalB = Math.min(1.0, normalB * 1.1 + 0.05);
            break;
        }
        
        data[i++] = finalR;
        data[i++] = finalG;
        data[i++] = finalB;
      }
    }
  }
  
  return { size, data, title: name };
}

/**
 * Checks if a preset name is valid
 * @param name - Name to check
 * @returns Whether the preset exists
 */
export function isValidPreset(name: string): name is PresetName {
  return Object.values(PRESETS).includes(name as PresetName);
}

/**
 * Preloads all preset LUTs in the background
 */
export function preloadAllPresets(): void {
  Object.values(PRESETS).forEach(preset => {
    loadPreset(preset as PresetName).catch(() => {
      // Errors already logged in loadPreset
    });
  });
}

// Helper function to load a LUT from text directly
export { parseCubeFile, createIdentityLut }; 