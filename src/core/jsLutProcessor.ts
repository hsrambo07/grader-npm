import type { ParsedLut } from './lutLoader';

// Helper for linear interpolation of single values
function lerp(a: number, b: number, t: number): number {
  return a * (1 - t) + b * t;
}

// Helper for linear interpolation of color triplets [R, G, B]
function lerpColor(colorA: [number, number, number], colorB: [number, number, number], t: number): [number, number, number] {
  return [
    lerp(colorA[0], colorB[0], t),
    lerp(colorA[1], colorB[1], t),
    lerp(colorA[2], colorB[2], t),
  ];
}

// Helper to get a color value from the LUT data
// LUT data is a flat Float32Array: [R,G,B, R,G,B, ...]
// Indices are (b * size * size + g * size + r) * 3
function getLutValueAt(rIdx: number, gIdx: number, bIdx: number, lut: ParsedLut): [number, number, number] {
  const { size, data: lutDataArray, domainMin, domainMax } = lut; // Added domainMin/Max for future use
  // Clamp indices to be within LUT bounds
  const R_idx = Math.max(0, Math.min(Math.round(rIdx), size - 1));
  const G_idx = Math.max(0, Math.min(Math.round(gIdx), size - 1));
  const B_idx = Math.max(0, Math.min(Math.round(bIdx), size - 1));
  
  const baseIndex = (B_idx * size * size + G_idx * size + R_idx) * 3;
  return [lutDataArray[baseIndex], lutDataArray[baseIndex + 1], lutDataArray[baseIndex + 2]];
}

export function applyLutToImageDataJS(
  imageData: ImageData,
  lut: ParsedLut,
  strength: number
): ImageData {
  const { data, width, height } = imageData;
  const { size: lutSize, domainMin, domainMax } = lut;

  // Create a new ImageData to modify, copying the original data first
  const outputPixelArray = new Uint8ClampedArray(data);
  const outputImageData = new ImageData(outputPixelArray, width, height);

  const lutScale = lutSize - 1;

  // Pre-calculate domain scales and offsets if domains are not [0,1]
  const domainScaleR = 1.0 / (domainMax[0] - domainMin[0]);
  const domainScaleG = 1.0 / (domainMax[1] - domainMin[1]);
  const domainScaleB = 1.0 / (domainMax[2] - domainMin[2]);

  for (let i = 0; i < data.length; i += 4) {
    const originalR = data[i];
    const originalG = data[i + 1];
    const originalB = data[i + 2];
    const originalA = data[i + 3];

    // Normalize original color components to 0-1 range
    let rNorm = originalR / 255;
    let gNorm = originalG / 255;
    let bNorm = originalB / 255;

    // Apply domain mapping: transform normalized color to LUT's domain space (0-1)
    rNorm = (rNorm - domainMin[0]) * domainScaleR;
    gNorm = (gNorm - domainMin[1]) * domainScaleG;
    bNorm = (bNorm - domainMin[2]) * domainScaleB;

    // Clamp to 0-1 after domain mapping, before LUT lookup
    rNorm = Math.max(0, Math.min(1, rNorm));
    gNorm = Math.max(0, Math.min(1, gNorm));
    bNorm = Math.max(0, Math.min(1, bNorm));

    // Calculate floating point coordinates in the LUT grid
    const rf = rNorm * lutScale;
    const gf = gNorm * lutScale;
    const bf = bNorm * lutScale;

    // Get integer grid coordinates for the 8 surrounding points
    const r0 = Math.floor(rf);
    const g0 = Math.floor(gf);
    const b0 = Math.floor(bf);
    
    const r1 = Math.ceil(rf); // Or Math.min(r0 + 1, lutScale)
    const g1 = Math.ceil(gf); // Or Math.min(g0 + 1, lutScale)
    const b1 = Math.ceil(bf); // Or Math.min(b0 + 1, lutScale)

    // Calculate interpolation fractions
    const fr = rf - r0;
    const fg = gf - g0;
    const fb = bf - b0;

    // Fetch values from the 8 corners of the cubelet
    const c000 = getLutValueAt(r0, g0, b0, lut);
    const c100 = getLutValueAt(r1, g0, b0, lut);
    const c010 = getLutValueAt(r0, g1, b0, lut);
    const c110 = getLutValueAt(r1, g1, b0, lut);
    const c001 = getLutValueAt(r0, g0, b1, lut);
    const c101 = getLutValueAt(r1, g0, b1, lut);
    const c011 = getLutValueAt(r0, g1, b1, lut);
    const c111 = getLutValueAt(r1, g1, b1, lut);

    // Trilinear interpolation
    const c00 = lerpColor(c000, c100, fr);
    const c01 = lerpColor(c001, c101, fr);
    const c10 = lerpColor(c010, c110, fr);
    const c11 = lerpColor(c011, c111, fr);

    const c0_interp = lerpColor(c00, c10, fg); // Renamed to avoid conflict
    const c1_interp = lerpColor(c01, c11, fg); // Renamed to avoid conflict
    
    const finalLutColor = lerpColor(c0_interp, c1_interp, fb); // [R, G, B] in LUT's output range (0-1)

    // Convert LUT color back to 0-255 range
    // The LUT output is also in a domain (typically 0-1), so remap if necessary.
    // Assuming LUT output domain is also [domainMin, domainMax] from input for now, then scaled to 0-1.
    // Or more likely, LUT output is always 0-1. The .cube spec implies output is 0-1.
    let lutR255 = finalLutColor[0] * 255;
    let lutG255 = finalLutColor[1] * 255;
    let lutB255 = finalLutColor[2] * 255;

    // Strength blending
    outputImageData.data[i]     = Math.max(0, Math.min(255, lerp(originalR, lutR255, strength)));
    outputImageData.data[i + 1] = Math.max(0, Math.min(255, lerp(originalG, lutG255, strength)));
    outputImageData.data[i + 2] = Math.max(0, Math.min(255, lerp(originalB, lutB255, strength)));
    outputImageData.data[i + 3] = originalA; // Preserve alpha
  }

  return outputImageData;
} 