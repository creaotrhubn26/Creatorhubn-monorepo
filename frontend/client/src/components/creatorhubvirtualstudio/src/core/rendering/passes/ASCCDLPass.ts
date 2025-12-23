/**
 * ASC CDL Post-Processing Pass
 * 
 * Applies ASC CDL color grading as a post-processing effect.
 * Integrates with Three.js EffectComposer for real-time color grading.
 * 
 * Reference: ASC CDL Specification v1.2
 */

import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import type { ASCCDLParams } from'../../services/ascCDLService';

export interface ASCCDLPassOptions {
  params: ASCCDLParams;
}

export class ASCCDLPass extends Pass {
  private fsQuad: FullScreenQuad;
  private uniforms: Record<string, THREE.IUniform>;

  constructor(options: ASCCDLPassOptions) {
    super();

    // Create uniforms
    this.uniforms = {
      tDiffuse: { value: null },
      cdlSlope: { value: options.params.slope.clone() },
      cdlOffset: { value: options.params.offset.clone() },
      cdlPower: { value: options.params.power.clone() },
      cdlSaturation: { value: options.params.saturation },
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
   * Update ASC CDL parameters
   */
  updateParams(params: ASCCDLParams): void {
    this.uniforms.cdlSlope.value.copy(params.slope);
    this.uniforms.cdlOffset.value.copy(params.offset);
    this.uniforms.cdlPower.value.copy(params.power);
    this.uniforms.cdlSaturation.value = params.saturation;
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
   * Fragment shader with ASC CDL implementation
   * 
   * Formula: out = (in × slope + offset)^power
   * Then apply saturation
   * 
   * Reference: ASC CDL Specification v1.2, Section 3.1
   */
  private getFragmentShader(): string {
    return `
      uniform sampler2D tDiffuse;
      uniform vec3 cdlSlope;
      uniform vec3 cdlOffset;
      uniform vec3 cdlPower;
      uniform float cdlSaturation;
      
      varying vec2 vUv;
      
      void main() {
        // Sample input color
        vec4 color = texture2D(tDiffuse, vUv);
        
        // Step 1: Apply slope, offset, power per channel
        // out = (in × slope + offset)^power
        vec3 result = color.rgb * cdlSlope + cdlOffset;
        
        // Clamp negative values before power operation
        result = max(vec3(0.0), result);
        
        // Apply power (gamma)
        result = pow(result, cdlPower);
        
        // Step 2: Apply saturation
        // Convert to luminance using Rec. 709 coefficients
        float luminance = dot(result, vec3(0.2126, 0.7152, 0.0722));
        
        // Lerp between grayscale and color based on saturation
        result = mix(vec3(luminance), result, cdlSaturation);
        
        // Clamp to valid range
        result = clamp(result, 0.0, 1.0);
        
        // Output with original alpha
        gl_FragColor = vec4(result, color.a);
      }
    `;
  }
}

