precision highp float;

uniform sampler2D uImage;
uniform sampler2D uLut;
uniform float uStrength;
uniform float uSize;

varying vec2 vTexCoord;

// Function to convert 3D coordinates to 2D coordinates in the tiled texture
vec2 lutCoordTo2D(vec3 lutCoord) {
  float lutSize = uSize;
  
  // Clamp input coordinates to [0,1]
  lutCoord = clamp(lutCoord, 0.0, 1.0);
  
  // Scale the coordinates to the grid size-1
  float scale = lutSize - 1.0;
  vec3 scaled = lutCoord * scale;
  
  // Floor + 0.5 is equivalent to round, which better matches the JS implementation
  float r = min(floor(scaled.r + 0.5), scale);
  float g = min(floor(scaled.g + 0.5), scale);
  float b = min(floor(scaled.b + 0.5), scale);
  
  // Calculate index into the flattened LUT array
  // This matches exactly how the flattenLutTo2D function arranges the data
  float index = r + g * lutSize + b * lutSize * lutSize;
  
  // Calculate the 2D texture position
  // The texture is arranged as a single column where:
  // - Each row corresponds to a unique index
  // - Width is 1 pixel
  // - Height is lutSize³ pixels
  float texWidth = lutSize;
  float texHeight = lutSize * lutSize;
  
  // Convert the 1D index to a 2D position in the texture
  float x = mod(index, texWidth);
  float y = floor(index / texWidth);
  
  // Normalize coordinates to [0,1] range for texturing
  // Adding 0.5 to sample at the center of the texel
  vec2 uv = vec2(
    (x + 0.5) / texWidth,
    (y + 0.5) / texHeight
  );
  
  return uv;
}

void main() {
  // Sample the original image
  vec4 originalColor = texture2D(uImage, vTexCoord);
  
  // Skip transparent pixels
  if (originalColor.a < 0.01) {
    gl_FragColor = originalColor;
    return;
  }
  
  // Get LUT coordinates
  vec3 lutCoord = clamp(originalColor.rgb, 0.0, 1.0);
  
  // Convert to 2D texture coordinates
  vec2 lutUV = lutCoordTo2D(lutCoord);
  
  // Sample the LUT
  vec3 gradedColor = texture2D(uLut, lutUV).rgb;
  
  // Blend between original and graded based on strength
  vec3 finalColor = mix(originalColor.rgb, gradedColor, uStrength);
  
  // Output final color with original alpha
  gl_FragColor = vec4(finalColor, originalColor.a);
} 