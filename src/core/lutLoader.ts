/**
 * Represents a parsed LUT (Look-Up Table)
 */
export interface ParsedLut {
  size: number;
  title?: string;
  data: Float32Array | number[][];
}

/**
 * Parses a .cube file into a usable LUT format, similar to the user's JS implementation
 * @param cubeText - Content of a .cube file
 * @returns Parsed LUT with size and data
 */
export function parseCubeFile(cubeText: string): ParsedLut {
  console.log("Parsing cube file...");
  console.log("Sample text:", cubeText.substring(0, 100) + "...");
  
  const lines = cubeText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));

  let size = 0;
  let title = '';
  const dataPoints: number[][] = [];

  console.log("Processing", lines.length, "non-comment lines");

  for (const line of lines) {
    if (line.startsWith('TITLE')) {
      title = line.substring(6).trim();
      console.log("Found title:", title);
      continue;
    }

    if (line.startsWith('LUT_3D_SIZE')) {
      size = parseInt(line.split(/\s+/)[1], 10);
      console.log("Found LUT size:", size);
      continue;
    }

    if (line.startsWith('LUT_1D_SIZE')) {
      console.warn("1D LUTs are not supported");
      throw new Error('1D LUTs are not supported');
    }

    // Skip other metadata lines
    if (line.includes(' ') && isNaN(parseFloat(line.split(' ')[0]))) {
      console.log("Skipping metadata line:", line);
      continue;
    }

    // Parse data point (R G B values)
    const values = line.split(/\s+/).map(parseFloat);
    if (values.length >= 3) {
      dataPoints.push([values[0], values[1], values[2]]);
    }
  }

  console.log(`Parsed ${dataPoints.length} data points out of expected ${size * size * size}`);

  if (size === 0) {
    console.error("LUT size not specified");
    throw new Error('Invalid .cube file: LUT size not specified');
  }

  if (dataPoints.length !== size * size * size) {
    console.warn(`Invalid .cube file: Expected ${size * size * size} values, got ${dataPoints.length}. Using programmatically generated LUT.`);
    return createIdentityLut(size, title);
  }

  console.log("Successfully parsed LUT with size", size, "and", dataPoints.length, "data points");
  return {
    size,
    title,
    data: dataPoints,
  };
}

/**
 * Loads a .cube file from a URL
 * @param url - URL to the .cube file
 * @returns Promise that resolves to a parsed LUT
 */
export async function loadCubeFromUrl(url: string): Promise<ParsedLut> {
  console.log("Loading cube from URL:", url);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to fetch LUT from ${url}: ${response.statusText}`);
      throw new Error(`Failed to fetch LUT from ${url}: ${response.statusText}`);
    }
    const text = await response.text();
    console.log(`Successfully loaded ${text.length} bytes from ${url}`);
    return parseCubeFile(text);
  } catch (error) {
    console.error("Error loading cube from URL:", error);
    throw error;
  }
}

/**
 * Creates an identity LUT that doesn't modify colors
 * @param size - Size of the LUT cube (default: 17)
 * @param title - Optional title for the LUT
 * @returns Identity LUT
 */
export function createIdentityLut(size = 17, title = "Identity"): ParsedLut {
  console.log("Creating identity LUT with size", size);
  const data: number[][] = [];

  for (let z = 0; z < size; z++) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        data.push([
          x / (size - 1),
          y / (size - 1),
          z / (size - 1)
        ]);
      }
    }
  }

  console.log(`Created identity LUT with ${data.length} entries`);
  return { size, data, title };
} 