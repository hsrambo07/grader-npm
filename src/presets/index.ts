import { createIdentityLut } from '../core/lutLoader';
import type { ParsedLut } from '../core/lutLoader';
import { PRESET_DATA } from './generatedPresetData'; // Import preprocessed data

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

// Relative URLs to preset LUTs - REMOVE
// const PRESET_URLS: Record<PresetName, string> = { ... };

// Cache for loaded presets - REMOVE
// const presetCache = new Map<PresetName, ParsedLut>();

/**
 * Loads a preset LUT by name
 * @param name - Preset name to load
 * @returns Promise resolving to the loaded LUT
 */
export async function loadPreset(name: PresetName): Promise<ParsedLut> {
  const lutData = PRESET_DATA[name];

  if (lutData) {
    // Ensure the data is a Float32Array, as it comes from generated code
    // This might be redundant if generatedPresetData.ts already constructs Float32Array instances
    // but good for safety if the generation process changes.
    // However, given our generation script, lutData.data should already be a Float32Array.
    return lutData;
  } else {
    // Fallback logic if preset is not found in preprocessed data
    console.warn(`Preset "${name}" not found in preprocessed data. Using programmatic fallback.`);
    
    // For normal preset, use identity LUT
    if (name === PRESETS.NORMAL) {
      return createIdentityLut(17); // Fallback size
    }
    
    // For other presets, create a colored LUT
    return createProgrammaticLut(name);
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
  // Preloading is no longer necessary as data is embedded
  // This function can be kept as a no-op or removed.
  // For now, let's make it a no-op.
  console.log("Presets are preprocessed and embedded. No runtime preloading needed.");
}

// Helper function to load a LUT from text directly
export { createIdentityLut }; 