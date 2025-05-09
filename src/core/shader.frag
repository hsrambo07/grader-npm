#version 300 es
precision highp float;
precision highp sampler3D;

uniform sampler2D uImage;
uniform sampler3D uLut;
uniform float uStrength;

in vec2 vTexCoord;
out vec4 fragColor;

void main() {
  // Sample the original image
  vec4 originalColor = texture(uImage, vTexCoord);
  
  // Skip transparent pixels
  if (originalColor.a < 0.01) {
    fragColor = originalColor;
    return;
  }
  
  // Convert color to LUT coordinates
  // LUTs are typically in the range [0,1] for all dimensions
  vec3 lutCoord = clamp(originalColor.rgb, 0.0, 1.0);
  
  // Sample the LUT
  vec3 gradedColor = texture(uLut, lutCoord).rgb;
  
  // Blend between original and graded based on strength
  vec3 finalColor = mix(originalColor.rgb, gradedColor, uStrength);
  
  // Output final color with original alpha
  fragColor = vec4(finalColor, originalColor.a);
} 