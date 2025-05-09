import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createIdentityLut } from '../src/core/lutLoader';
import { GlEngine } from '../src/core/glEngine';

// Mock Canvas and WebGL for testing in Node
beforeAll(() => {
  // This is needed for happy-dom to simulate WebGL
  global.HTMLCanvasElement.prototype.getContext = function() {
    return {
      createShader: () => ({}),
      shaderSource: () => {},
      compileShader: () => {},
      getShaderParameter: () => true,
      createProgram: () => ({}),
      attachShader: () => {},
      linkProgram: () => {},
      getProgramParameter: () => true,
      getAttribLocation: () => 0,
      getUniformLocation: () => ({}),
      createBuffer: () => ({}),
      bindBuffer: () => {},
      bufferData: () => {},
      createFramebuffer: () => ({}),
      createTexture: () => ({}),
      bindTexture: () => {},
      texParameteri: () => {},
      texImage2D: () => {},
      texImage3D: () => {},
      useProgram: () => {},
      enableVertexAttribArray: () => {},
      vertexAttribPointer: () => {},
      uniform1i: () => {},
      uniform1f: () => {},
      activeTexture: () => {},
      bindFramebuffer: () => {},
      drawArrays: () => {},
      deleteTexture: () => {},
      deleteBuffer: () => {},
      deleteFramebuffer: () => {},
      deleteProgram: () => {},
      viewport: () => {},
    };
  };
});

describe('GL Engine', () => {
  it('should initialize without errors', () => {
    let engine;
    expect(() => {
      engine = new GlEngine({
        canvas: document.createElement('canvas'),
      });
    }).not.toThrow();
    
    // Clean up
    engine?.dispose();
  });
  
  it('should load LUTs without errors', () => {
    const engine = new GlEngine({
      canvas: document.createElement('canvas'),
    });
    
    const lut = createIdentityLut(17);
    expect(() => {
      engine.loadLut(lut, 'test-lut');
    }).not.toThrow();
    
    // Clean up
    engine.dispose();
  });
  
  it('should process images without errors', () => {
    const engine = new GlEngine({
      canvas: document.createElement('canvas'),
    });
    
    const lut = createIdentityLut(17);
    engine.loadLut(lut, 'test-lut');
    
    const image = document.createElement('img');
    image.width = 100;
    image.height = 100;
    
    let result;
    expect(() => {
      result = engine.apply(image, 0.5);
    }).not.toThrow();
    
    expect(result).toBeDefined();
    expect(result).toBeInstanceOf(HTMLCanvasElement);
    
    // Clean up
    engine.dispose();
  });
}); 