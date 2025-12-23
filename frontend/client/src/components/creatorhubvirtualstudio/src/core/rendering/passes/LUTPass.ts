/**
 * 3D LUT Post-Processing Pass
 * 
 * Applies 3D LUT (Look-Up Table) color grading in real-time
 * using GPU-accelerated trilinear interpolation.
 * 
 * Reference:
 * - Adobe Cube LUT Specification
 * - GPU Gems 2: Chapter 24 "Using Lookup Tables to Accelerate Color Transformations"
 */

import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import type { LUT3D } from'../../services/lutService';

export interface LUTPassOptions {
  lut: LUT3D;
  intensity?: number; // Blend factor (0 = no LUT, 1 = full LUT)
}

export class LUTPass extends Pass {
  private fsQuad: FullScreenQuad;
  private uniforms: Record<string, THREE.IUniform>;
  private lutTexture: THREE.Data3DTexture;

  constructor(options: LUTPassOptions) {
    super();

    // Create 3D texture from LUT data
    this.lutTexture = this.createLUTTexture(options.lut);

    // Create uniforms
    this.uniforms = {
      tDiffuse: { value: null },
      tLUT: { value: this.lutTexture },
      lutSize: { value: options.lut.size },
      intensity: { value: options.intensity !== undefined ? options.intensity : 1.0 },
    };

    // Create shader material
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: this.getVertexShader(),
      fragmentShader: this.getFragmentShader(),
    });

    this.fsQuad = new FullScreenQuad(material);
  }

  /**
   * Create 3D texture from LUT data
   */
  private createLUTTexture(lut: LUT3D): THREE.Data3DTexture {
    const size = lut.size;
    const data = new Uint8Array(size * size * size * 4);

    // Convert Float32Array to Uint8Array (0-255 range)
    for (let i = 0; i < lut.data.length / 3; i++) {
      const r = Math.round(lut.data[i * 3] * 255);
      const g = Math.round(lut.data[i * 3 + 1] * 255);
      const b = Math.round(lut.data[i * 3 + 2] * 255);

      data[i * 4] = r;
      data[i * 4 + 1] = g;
      data[i * 4 + 2] = b;
      data[i * 4 + 3] = 255;
    }

    const texture = new THREE.Data3DTexture(data, size, size, size);
    texture.format = THREE.RGBAFormat;
    texture.type = THREE.UnsignedByteType;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.wrapR = THREE.ClampToEdgeWrapping;
    texture.unpackAlignment = 1;
    texture.needsUpdate = true;

    return texture;
  }

  /**
   * Update LUT
   */
  updateLUT(lut: LUT3D): void {
    // Dispose old texture
    this.lutTexture.dispose();

    // Create new texture
    this.lutTexture = this.createLUTTexture(lut);
    this.uniforms.tLUT.value = this.lutTexture;
    this.uniforms.lutSize.value = lut.size;
  }

  /**
   * Update intensity
   */
  updateIntensity(intensity: number): void {
    this.uniforms.intensity.value = Math.max(0, Math.min(1, intensity));
  }

  /**
   * Render the pass
   */
  render(
    renderer: THREE.WebGLRenderer,
    writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget
  ): void {
    this.uniforms.tDiffuse.value = readBuffer.texture;

    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
      this.fsQuad.render(renderer);
    } else {
      renderer.setRenderTarget(writeBuffer);
      if (this.clear) renderer.clear();
      this.fsQuad.render(renderer);
    }
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.fsQuad.dispose();
    this.lutTexture.dispose();
  }

  /**
   * Vertex shader (pass-through)
   */
  private getVertexShader(): string {
    return `
      varying vec2 vUv;
      
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
  }

  /**
   * Fragment shader with 3D LUT lookup
   * 
   * Uses hardware trilinear interpolation for smooth results.
   * 
   * Reference: GPU Gems 2, Chapter 24
   */
  private getFragmentShader(): string {
    return `
      uniform sampler2D tDiffuse;
      uniform sampler3D tLUT;
      uniform float lutSize;
      uniform float intensity;
      
      varying vec2 vUv;
      
      void main() {
        // Sample input color
        vec4 color = texture2D(tDiffuse, vUv);
        
        // Apply 3D LUT lookup
        // Scale coordinates to LUT space
        float scale = (lutSize - 1.0) / lutSize;
        float offset = 1.0 / (2.0 * lutSize);
        
        vec3 lutCoord = color.rgb * scale + offset;
        vec3 lutColor = texture3D(tLUT, lutCoord).rgb;
        
        // Blend between original and LUT color
        vec3 result = mix(color.rgb, lutColor, intensity);
        
        // Output with original alpha
        gl_FragColor = vec4(result, color.a);
      }
    `;
  }
}

