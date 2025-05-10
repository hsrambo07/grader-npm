/**
 * Represents a parsed LUT (Look-Up Table)
 */
export interface ParsedLut {
  size: number;
  title?: string;
  data: Float32Array | number[][];
}

/**
 * Parses a .cube file into a usable LUT format
 * @param cubeText - Content of a .cube file
 * @returns Parsed LUT with size and data
 */
export function parseCubeFile(cubeText: string): ParsedLut {
  console.log("Parsing cube file...");
  const rawLines = cubeText.split('\n');
  let size = 0;
  let title = '';
  const dataPoints: number[][] = [];
  let foundLutSizeLine = false;
  // let linesProcessedForData = 0; // For debugging, can be removed

  for (const rawLine of rawLines) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) { // Skip empty lines and comments
      continue;
    }

    // Process TITLE and LUT_3D_SIZE whenever they appear
    // This allows them to be potentially out of order or after some junk
    if (line.startsWith('TITLE')) {
      title = line.substring(line.indexOf('"') + 1, line.lastIndexOf('"'));
      console.log("Found title:", title);
      // continue; // Don't continue, a line might be both TITLE and something else if malformed, though unlikely
    }

    if (line.startsWith('LUT_3D_SIZE')) {
      const parts = line.split(/\s+/);
      if (parts.length >= 2) {
        const parsedSize = parseInt(parts[1], 10);
        if (!isNaN(parsedSize) && parsedSize > 0) {
            size = parsedSize;
            console.log("Found LUT size:", size);
            foundLutSizeLine = true;
        } else {
            console.warn("Invalid value for LUT_3D_SIZE:", parts[1]);
        }
      }
      // continue; // Data must start after this line, but other metadata could exist
    }
    
    if (line.startsWith('LUT_1D_SIZE')) {
      console.warn("1D LUTs are not supported");
      throw new Error('1D LUTs are not supported'); // Or return fallback
    }

    // Start collecting data points if LUT_3D_SIZE has been found and we need more points
    if (foundLutSizeLine && size > 0 && dataPoints.length < size * size * size) {
      // Check if the line looks like a data line (starts with a number)
      // and is not one of the known keywords we already processed or want to ignore.
      const firstChar = line.charAt(0);
      if ((firstChar >= '0' && firstChar <= '9') || firstChar === '.' || firstChar === '-') {
        // Potentially a data line, try to parse
        const values = line.split(/\s+/).map(s => parseFloat(s.trim()));
        if (values.length >= 3 && !values.slice(0, 3).some(isNaN)) {
          dataPoints.push([values[0], values[1], values[2]]);
        } else if (!line.startsWith('TITLE') && !line.startsWith('LUT_3D_SIZE') && !line.startsWith('DOMAIN_MIN') && !line.startsWith('DOMAIN_MAX')) {
          // Only log as unexpected if it wasn't a keyword we might encounter
          console.log("Skipping non-data line in potential data section:", line);
        }
      }
    }
  }
  
  // console.log(`Lines processed after header scan attempt: ${linesProcessedForData}`);
  console.log(`Parsed ${dataPoints.length} data points. Expected ${size * size * size} for size ${size}`);

  if (size === 0) {
    console.error("LUT size not specified or invalid .cube file structure after parsing all lines.");
    // Attempt to create a default identity if title was found, otherwise error broadly
    const fallbackTitle = title || 'Error Case Identity';
    return createIdentityLut(17, fallbackTitle); // Default to 17 for safety
    // throw new Error('Invalid .cube file: LUT size not specified or file corrupt after parsing attempts');
  }

  if (dataPoints.length !== size * size * size) {
    console.warn(`Invalid .cube file '${title}': Expected ${size * size * size} values, got ${dataPoints.length}. Using programmatically generated LUT.`);
    return createIdentityLut(size, title || 'Fallback Identity');
  }

  console.log("Successfully parsed LUT:", title, "with size", size, "and", dataPoints.length, "data points");
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
    throw error; // Re-throw to allow caller to handle, or return a fallback LUT
  }
}

/**
 * Creates an identity LUT that doesn't modify colors
 * @param size - Size of the LUT cube (default: 17)
 * @param title - Optional title for the LUT
 * @returns Identity LUT
 */
export function createIdentityLut(size = 17, title = "Identity"): ParsedLut {
  console.log("Creating identity LUT with size", size, "for title", title);
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

  console.log(`Created identity LUT '${title}' with ${data.length} entries`);
  return { size, data, title };
} 