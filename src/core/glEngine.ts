import type { ParsedLut } from './lutLoader';

// Import shaders
import fragmentShaderWebGL2 from './shader.frag';
import vertexShaderWebGL2 from './shader.vert';
import fragmentShaderWebGL1 from './shader-webgl1.frag';
import vertexShaderWebGL1 from './shader-webgl1.vert';

export interface GlEngineOptions {
  canvas?: HTMLCanvasElement;
}

export class GlEngine {
  private gl: WebGLRenderingContext | WebGL2RenderingContext;
  private program: WebGLProgram;
  private framebuffer: WebGLFramebuffer | null = null;
  private textureCache: Map<string, WebGLTexture> = new Map();
  private imageTexture: WebGLTexture | null = null;
  private outputTexture: WebGLTexture | null = null;
  private canvas: HTMLCanvasElement;
  private isWebGL2: boolean;
  private lutTexture: WebGLTexture | null = null;
  private currentLutId: string | null = null;
  
  // Shader attributes and uniforms
  private positionAttribLocation: number = -1;
  private texCoordAttribLocation: number = -1;
  private imageUniformLocation: WebGLUniformLocation | null = null;
  private lutUniformLocation: WebGLUniformLocation | null = null;
  private strengthUniformLocation: WebGLUniformLocation | null = null;
  private lutSizeUniformLocation: WebGLUniformLocation | null = null;

  // Vertex buffers
  private positionBuffer: WebGLBuffer | null = null;
  private texCoordBuffer: WebGLBuffer | null = null;

  /**
   * Creates a new WebGL engine instance
   * @param options - Configuration options
   */
  constructor(options: GlEngineOptions = {}) {
    console.log("Initializing GlEngine");
    
    // Create canvas if not provided
    this.canvas = options.canvas || document.createElement('canvas');
    if (!options.canvas) {
      this.canvas.style.display = 'none';
      document.body.appendChild(this.canvas);
    }

    // Try to get WebGL2 context, fall back to WebGL1
    this.gl = this.canvas.getContext('webgl2') || this.canvas.getContext('webgl')!;
    this.isWebGL2 = !!(this.gl as WebGL2RenderingContext).texImage3D;
    
    console.log("WebGL version:", this.isWebGL2 ? "WebGL 2.0" : "WebGL 1.0");

    if (!this.gl) {
      console.error("WebGL not supported");
      throw new Error('WebGL not supported');
    }

    // Initialize shader program
    this.program = this.createShaderProgram();
    
    // Set up buffers and attributes
    this.setupBuffers();
    
    // Initialize framebuffer for off-screen rendering
    this.setupFramebuffer();
    
    console.log("GlEngine initialized successfully");
  }

  /**
   * Creates and compiles a shader program from source
   */
  private createShaderProgram(): WebGLProgram {
    console.log("Creating shader program");
    const gl = this.gl;
    
    // Choose appropriate shaders based on WebGL version
    const vsSource = this.isWebGL2 ? vertexShaderWebGL2 : vertexShaderWebGL1;
    const fsSource = this.isWebGL2 ? fragmentShaderWebGL2 : fragmentShaderWebGL1;
    
    console.log("Using shader source:", this.isWebGL2 ? "WebGL 2.0" : "WebGL 1.0");
    console.log("Fragment shader sample:", fsSource.substring(0, 100) + "...");
    
    // Create vertex shader
    const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vertexShader, vsSource);
    gl.compileShader(vertexShader);
    
    // Check compilation status
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(vertexShader);
      console.error("Vertex shader compilation failed:", info);
      gl.deleteShader(vertexShader);
      throw new Error(`Failed to compile vertex shader: ${info}`);
    }
    
    // Create fragment shader
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fragmentShader, fsSource);
    gl.compileShader(fragmentShader);
    
    // Check compilation status
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(fragmentShader);
      console.error("Fragment shader compilation failed:", info);
      gl.deleteShader(fragmentShader);
      throw new Error(`Failed to compile fragment shader: ${info}`);
    }
    
    // Create and link program
    const program = gl.createProgram()!;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    // Check link status
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program);
      console.error("Shader program linking failed:", info);
      throw new Error(`Failed to link shader program: ${info}`);
    }
    
    // Clean up shaders
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    
    // Get attribute and uniform locations
    this.positionAttribLocation = gl.getAttribLocation(program, 'aPosition');
    this.texCoordAttribLocation = gl.getAttribLocation(program, 'aTexCoord');
    this.imageUniformLocation = gl.getUniformLocation(program, 'uImage');
    this.lutUniformLocation = gl.getUniformLocation(program, 'uLut');
    this.strengthUniformLocation = gl.getUniformLocation(program, 'uStrength');
    
    console.log("Attribute locations - position:", this.positionAttribLocation, 
                "texCoord:", this.texCoordAttribLocation);
    console.log("Uniform locations - image:", !!this.imageUniformLocation, 
                "lut:", !!this.lutUniformLocation, 
                "strength:", !!this.strengthUniformLocation);
    
    // Only needed for WebGL1
    if (!this.isWebGL2) {
      this.lutSizeUniformLocation = gl.getUniformLocation(program, 'uSize');
      console.log("WebGL1 specific - lutSize:", !!this.lutSizeUniformLocation);
    }
    
    console.log("Shader program created successfully");
    return program;
  }

  /**
   * Sets up vertex buffers for the full-screen quad
   */
  private setupBuffers(): void {
    console.log("Setting up vertex buffers");
    const gl = this.gl;
    
    // Position buffer (full-screen quad)
    const positions = [
      -1.0, -1.0,  // Bottom left
       1.0, -1.0,  // Bottom right
      -1.0,  1.0,  // Top left
       1.0,  1.0,  // Top right
    ];
    
    this.positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    
    // Texture coordinate buffer
    const texCoords = [
      0.0, 0.0,  // Bottom left
      1.0, 0.0,  // Bottom right
      0.0, 1.0,  // Top left
      1.0, 1.0,  // Top right
    ];
    
    this.texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);
    
    console.log("Vertex buffers created successfully");
  }

  /**
   * Sets up a framebuffer for off-screen rendering
   */
  private setupFramebuffer(): void {
    console.log("Setting up framebuffer");
    const gl = this.gl;
    this.framebuffer = gl.createFramebuffer();
    console.log("Framebuffer created:", !!this.framebuffer);
  }

  /**
   * Loads a LUT into WebGL
   * @param lut - Parsed LUT data
   * @param id - Unique identifier for this LUT
   */
  public loadLut(lut: ParsedLut, id: string): void {
    console.log(`Loading LUT '${id}' with size ${lut.size}`);
    const gl = this.gl;
    
    // Return early if this LUT is already loaded
    if (this.textureCache.has(id)) {
      console.log(`LUT '${id}' already loaded, using cached version`);
      this.lutTexture = this.textureCache.get(id) || null;
      this.currentLutId = id;
      return;
    }
    
    // Create a new texture
    const texture = gl.createTexture();
    if (!texture) {
      console.error("Failed to create WebGL texture");
      throw new Error("Failed to create WebGL texture");
    }
    
    gl.bindTexture(this.isWebGL2 ? gl.TEXTURE_3D : gl.TEXTURE_2D, texture);
    
    // Set texture parameters
    gl.texParameteri(
      this.isWebGL2 ? gl.TEXTURE_3D : gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
      gl.LINEAR
    );
    gl.texParameteri(
      this.isWebGL2 ? gl.TEXTURE_3D : gl.TEXTURE_2D,
      gl.TEXTURE_MAG_FILTER,
      gl.LINEAR
    );
    gl.texParameteri(
      this.isWebGL2 ? gl.TEXTURE_3D : gl.TEXTURE_2D,
      gl.TEXTURE_WRAP_S,
      gl.CLAMP_TO_EDGE
    );
    gl.texParameteri(
      this.isWebGL2 ? gl.TEXTURE_3D : gl.TEXTURE_2D,
      gl.TEXTURE_WRAP_T,
      gl.CLAMP_TO_EDGE
    );
    
    // Convert lut.data to a flat Float32Array if it's an array of arrays
    let lutData: Float32Array;
    if (Array.isArray(lut.data) && Array.isArray(lut.data[0])) {
      console.log("Converting LUT data from array of arrays to Float32Array");
      const data = lut.data as number[][];
      const flatData: number[] = [];
      
      for (let i = 0; i < data.length; i++) {
        flatData.push(data[i][0], data[i][1], data[i][2]);
      }
      
      lutData = new Float32Array(flatData);
      console.log(`Created Float32Array with ${lutData.length} elements from ${data.length} points`);
    } else if (lut.data instanceof Float32Array) {
      lutData = lut.data;
    } else {
      console.error("Invalid LUT data format", typeof lut.data);
      throw new Error("Invalid LUT data format");
    }
    
    if (this.isWebGL2) {
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
      
      console.log(`Uploading 3D texture with size ${lut.size}x${lut.size}x${lut.size}`);
      // Upload 3D texture data
      try {
        (gl as WebGL2RenderingContext).texImage3D(
          gl.TEXTURE_3D,
          0,
          gl.RGB,
          lut.size,
          lut.size,
          lut.size,
          0,
          gl.RGB,
          gl.FLOAT,
          lutData
        );
        console.log("3D texture uploaded successfully");
      } catch (error) {
        console.error("Error uploading 3D texture:", error);
        throw error;
      }
    } else {
      // For WebGL1, we need to flatten the 3D LUT to a 2D texture
      console.log("Using WebGL1, creating 2D tiled texture");
      const flattenedData = this.flattenLutTo2D(lut, lutData);
      
      // Calculate dimensions for the 2D texture
      const width = lut.size * lut.size;  // Width is size²
      const height = lut.size;            // Height is size
      
      // Upload 2D texture data
      try {
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGB,
          width,  // Use the calculated width
          height, // Use the calculated height
          0,
          gl.RGB,
          gl.FLOAT,
          flattenedData
        );
        console.log(`2D tiled texture (${width}x${height}) uploaded successfully`);
      } catch (error) {
        console.error("Error uploading 2D tiled texture:", error);
        throw error;
      }
    }
    
    // Store in cache
    this.textureCache.set(id, texture);
    this.lutTexture = texture;
    this.currentLutId = id;
    console.log(`LUT '${id}' loaded and cached successfully`);
  }

  /**
   * Flattens a 3D LUT to a 2D texture for WebGL1
   * @param lut - Parsed LUT data
   * @param lutData - Flattened Float32Array of LUT data
   * @returns Flattened data array for 2D texture
   */
  private flattenLutTo2D(lut: ParsedLut, lutData: Float32Array): Float32Array {
    console.log("Flattening 3D LUT to 2D tiled texture");
    const size = lut.size;
    const width = size * size;
    const height = size;
    const flattenedData = new Float32Array(width * height * 3);
    
    if (Array.isArray(lut.data) && Array.isArray(lut.data[0])) {
      // Handle array of arrays format directly - match the JS implementation pattern
      console.log("Using array of arrays format directly to create 2D texture");
      const data = lut.data as number[][];
      
      // For each voxel in the 3D LUT
      for (let b = 0; b < size; b++) {
        for (let g = 0; g < size; g++) {
          for (let r = 0; r < size; r++) {
            // Calculate 1D index exactly as in the shader
            const index = r + g * size + b * size * size;
            
            // Convert to 2D coordinates in the tiled texture
            const x = index % width;
            const y = Math.floor(index / width);
            
            // Index in the flattened output array
            const dstIdx = (y * width + x) * 3;
            
            // Index in the source LUT data (assuming b-g-r ordering)
            const srcIdx = b * size * size + g * size + r;
            
            // Copy RGB values
            if (srcIdx < data.length) {
              flattenedData[dstIdx] = data[srcIdx][0];     // R
              flattenedData[dstIdx + 1] = data[srcIdx][1]; // G
              flattenedData[dstIdx + 2] = data[srcIdx][2]; // B
            }
          }
        }
      }
    } else {
      // Handle Float32Array format - need to ensure we arrange it correctly
      console.log("Rearranging Float32Array to match JS implementation pattern");
      
      // For each voxel in the 3D LUT
      for (let b = 0; b < size; b++) {
        for (let g = 0; g < size; g++) {
          for (let r = 0; r < size; r++) {
            // Calculate 1D index exactly as in the shader
            const index = r + g * size + b * size * size;
            
            // Convert to 2D coordinates in the tiled texture
            const x = index % width;
            const y = Math.floor(index / width);
            
            // Index in the flattened output array
            const dstIdx = (y * width + x) * 3;
            
            // Index in the source LUT data (assuming b-g-r ordering)
            const srcIdx = (b * size * size + g * size + r) * 3;
            
            // Copy RGB values
            flattenedData[dstIdx] = lutData[srcIdx];       // R
            flattenedData[dstIdx + 1] = lutData[srcIdx + 1]; // G
            flattenedData[dstIdx + 2] = lutData[srcIdx + 2]; // B
          }
        }
      }
    }
    
    console.log(`Created flattened 2D texture data with ${flattenedData.length} elements`);
    return flattenedData;
  }

  /**
   * Applies a LUT to an image
   * @param image - Source image
   * @param strength - Blend strength (0-1)
   * @returns Canvas with the processed image
   */
  public apply(image: HTMLImageElement, strength: number = 1.0): HTMLCanvasElement {
    console.log(`Applying LUT to image (${image.width}x${image.height}) with strength ${strength}`);
    
    if (!this.lutTexture) {
      console.error("No LUT texture loaded. Call loadLut before apply.");
      throw new Error("No LUT texture loaded");
    }
    
    const gl = this.gl;
    
    // Set canvas dimensions to match the image
    this.canvas.width = image.width;
    this.canvas.height = image.height;
    gl.viewport(0, 0, image.width, image.height);
    
    // Create a texture for the image if needed
    if (!this.imageTexture) {
      console.log("Creating image texture");
      this.imageTexture = gl.createTexture();
      if (!this.imageTexture) {
        console.error("Failed to create image texture");
        throw new Error("Failed to create image texture");
      }
      
      gl.bindTexture(gl.TEXTURE_2D, this.imageTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      console.log("Image texture created successfully");
    }
    
    // Upload image data
    try {
      console.log("Uploading image data to texture");
      gl.bindTexture(gl.TEXTURE_2D, this.imageTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      console.log("Image data uploaded successfully");
    } catch (error) {
      console.error("Error uploading image data:", error);
      console.error("Image properties - crossOrigin:", image.crossOrigin, 
                    "complete:", image.complete, 
                    "naturalWidth:", image.naturalWidth, 
                    "src starts with:", image.src.substring(0, 30) + "...");
      throw error;
    }
    
    // Create a texture for the output if needed
    if (!this.outputTexture) {
      console.log("Creating output texture");
      this.outputTexture = gl.createTexture();
      if (!this.outputTexture) {
        console.error("Failed to create output texture");
        throw new Error("Failed to create output texture");
      }
      
      gl.bindTexture(gl.TEXTURE_2D, this.outputTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      console.log("Output texture created successfully");
    }
    
    // Allocate texture memory
    console.log("Allocating output texture memory");
    gl.bindTexture(gl.TEXTURE_2D, this.outputTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      image.width,
      image.height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null
    );
    
    // Use shader program
    console.log("Using shader program and setting up rendering");
    gl.useProgram(this.program);
    
    // Bind position buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.enableVertexAttribArray(this.positionAttribLocation);
    gl.vertexAttribPointer(this.positionAttribLocation, 2, gl.FLOAT, false, 0, 0);
    
    // Bind texture coordinate buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.enableVertexAttribArray(this.texCoordAttribLocation);
    gl.vertexAttribPointer(this.texCoordAttribLocation, 2, gl.FLOAT, false, 0, 0);
    
    // Set uniforms
    gl.uniform1i(this.imageUniformLocation, 0);
    gl.uniform1i(this.lutUniformLocation, 1);
    gl.uniform1f(this.strengthUniformLocation, strength);
    
    // Set LUT size for WebGL1
    if (!this.isWebGL2 && this.lutSizeUniformLocation) {
      // Get the LUT size from the cache if possible
      let lutSize = 17; // Default
      if (this.currentLutId) {
        for (const [id, texture] of this.textureCache.entries()) {
          if (texture === this.lutTexture) {
            // Found it, retrieve the size if we know it
            if (id === 'identity' || id === 'normal') {
              lutSize = 17; // Common default
            } else if (id.startsWith('custom_')) {
              lutSize = 17; // Common default for custom
            } else {
              // For other presets we'll use default
              lutSize = 17;
            }
            break;
          }
        }
      }
      
      console.log(`Setting WebGL1 specific uniform uSize to ${lutSize}`);
      gl.uniform1f(this.lutSizeUniformLocation, lutSize);
    }
    
    // Activate texture units
    console.log("Binding textures to texture units");
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.imageTexture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(
      this.isWebGL2 ? gl.TEXTURE_3D : gl.TEXTURE_2D,
      this.lutTexture
    );
    
    // Direct rendering to canvas
    console.log("Rendering to canvas");
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    
    console.log("Rendering complete, returning canvas");
    return this.canvas;
  }

  /**
   * Dispose WebGL resources to prevent memory leaks
   */
  public dispose(): void {
    console.log("Disposing GL resources");
    const gl = this.gl;
    
    // Delete textures
    for (const texture of this.textureCache.values()) {
      gl.deleteTexture(texture);
    }
    if (this.imageTexture) gl.deleteTexture(this.imageTexture);
    if (this.outputTexture) gl.deleteTexture(this.outputTexture);
    
    // Delete buffers
    if (this.positionBuffer) gl.deleteBuffer(this.positionBuffer);
    if (this.texCoordBuffer) gl.deleteBuffer(this.texCoordBuffer);
    
    // Delete framebuffer
    if (this.framebuffer) gl.deleteFramebuffer(this.framebuffer);
    
    // Delete program
    gl.deleteProgram(this.program);
    
    // Clear cache
    this.textureCache.clear();
    
    // Remove canvas if it was created internally
    if (this.canvas.parentNode && this.canvas.style.display === 'none') {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    
    console.log("All GL resources disposed");
  }
} 