import { describe, it, expect } from 'vitest';
import { parseCubeFile, createIdentityLut } from '../src/core/lutLoader';

describe('LUT Parser', () => {
  it('should parse a valid .cube file', () => {
    const cubeContent = `
      TITLE "Test LUT"
      LUT_3D_SIZE 2
      
      # This is a comment
      0.0 0.0 0.0
      1.0 0.0 0.0
      0.0 1.0 0.0
      1.0 1.0 0.0
      0.0 0.0 1.0
      1.0 0.0 1.0
      0.0 1.0 1.0
      1.0 1.0 1.0
    `;
    
    const result = parseCubeFile(cubeContent);
    
    expect(result).toBeDefined();
    expect(result.size).toBe(2);
    expect(result.title).toBe('Test LUT');
    expect(result.data).toBeInstanceOf(Float32Array);
    expect(result.data.length).toBe(2 * 2 * 2 * 3); // 2³ × 3 components
    
    // Check first RGB value
    expect(result.data[0]).toBeCloseTo(0.0);
    expect(result.data[1]).toBeCloseTo(0.0);
    expect(result.data[2]).toBeCloseTo(0.0);
    
    // Check last RGB value
    const lastIdx = result.data.length - 3;
    expect(result.data[lastIdx]).toBeCloseTo(1.0);
    expect(result.data[lastIdx + 1]).toBeCloseTo(1.0);
    expect(result.data[lastIdx + 2]).toBeCloseTo(1.0);
  });
  
  it('should throw an error for invalid .cube files', () => {
    const missingSize = `
      TITLE "Missing Size"
      0.0 0.0 0.0
      1.0 1.0 1.0
    `;
    
    expect(() => parseCubeFile(missingSize)).toThrow(/size not specified/i);
    
    const wrongDataCount = `
      TITLE "Wrong Data Count"
      LUT_3D_SIZE 2
      0.0 0.0 0.0
      1.0 1.0 1.0
    `;
    
    expect(() => parseCubeFile(wrongDataCount)).toThrow(/Expected.*values/i);
  });
  
  it('should create an identity LUT correctly', () => {
    const size = 3;
    const result = createIdentityLut(size);
    
    expect(result).toBeDefined();
    expect(result.size).toBe(size);
    expect(result.data).toBeInstanceOf(Float32Array);
    expect(result.data.length).toBe(size * size * size * 3);
    
    // Check corner values in the identity LUT
    // Origin (0,0,0)
    expect(result.data[0]).toBeCloseTo(0.0);
    expect(result.data[1]).toBeCloseTo(0.0);
    expect(result.data[2]).toBeCloseTo(0.0);
    
    // Far corner (1,1,1)
    const lastCornerIdx = (size * size * size - 1) * 3;
    expect(result.data[lastCornerIdx]).toBeCloseTo(1.0);
    expect(result.data[lastCornerIdx + 1]).toBeCloseTo(1.0);
    expect(result.data[lastCornerIdx + 2]).toBeCloseTo(1.0);
  });
}); 