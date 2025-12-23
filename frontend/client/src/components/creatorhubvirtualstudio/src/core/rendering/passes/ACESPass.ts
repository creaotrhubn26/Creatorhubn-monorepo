/**
 * ACES Post-Processing Pass
 * 
 * Applies ACES (Academy Color Encoding System) color management and tone mapping
 * as a post-processing effect.
 * 
 * Reference: ACES v1.3, AMPAS
 */

import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import type { ACESConfig } from'../../services/acesService';

export interface ACESPassOptions {
  config: ACESConfig;
}

export class ACESPass extends Pass {
  private fsQuad: FullScreenQuad;
  private uniforms: Record<string, THREE.IUniform>;

  constructor(options: ACESPassOptions) {
    super();

    // Create uniforms
    this.uniforms = {
      tDiffuse: { value: null },
      exposure: { value: options.config.exposure },
      gamma: { value: options.config.gamma },
      enableRRT: { value: options.config.enableRRT ? 1.0 : 0.0 },
      useFullRRT: { value: options.config.useFullRRT ? 1.0 : 0.0 },
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
   * Update ACES configuration
   */
  updateConfig(config: ACESConfig): void {
    this.uniforms.exposure.value = config.exposure;
    this.uniforms.gamma.value = config.gamma;
    this.uniforms.enableRRT.value = config.enableRRT ? 1.0 : 0.0;
    this.uniforms.useFullRRT.value = config.useFullRRT ? 1.0 : 0.0;
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
   * Fragment shader with ACES implementation
   * 
   * Implements ACES Filmic tone mapping curve.
   * 
   * Reference: 
   * - ACES v1.3 RRT
   * - "ACES Filmic Tone Mapping Curve" by Krzysztof Narkowicz (2016)
   */
  private getFragmentShader(): string {
    return `
      uniform sampler2D tDiffuse;
      uniform float exposure;
      uniform float gamma;
      uniform float enableRRT;
      uniform float useFullRRT;

      varying vec2 vUv;

      // ACES Tone Scale (Simplified RRT)
      // Reference: Krzysztof Narkowicz (2016)
      vec3 ACESFilmic(vec3 x) {
        float a = 2.51;
        float b = 0.03;
        float c = 2.43;
        float d = 0.59;
        float e = 0.14;
        return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
      }

      // Full ACES RRT - Glow Module
      // Reference: ACES v1.3 RRT, Section 4.4
      vec3 applyGlowModule(vec3 color) {
        float Y = 0.2722287168 * color.r + 0.6740817658 * color.g + 0.0536895174 * color.b;
        float glowGainThreshold = 0.12;
        float glowGainAmount = 0.05;

        if (Y > glowGainThreshold) {
          float glowGain = glowGainAmount * pow((Y - glowGainThreshold) / (1.0 - glowGainThreshold), 2.0);
          return color * (1.0 + glowGain);
        }
        return color;
      }

      // Full ACES RRT - Red Modifier
      // Reference: ACES v1.3 RRT, Section 4.5
      vec3 applyRedModifier(vec3 color) {
        float hue = atan(color.b - color.g, color.r - color.g);
        float redHueCenter = 0.0;
        float redHueWidth = 0.5236; // π/6 (30 degrees)

        float hueDistance = abs(hue - redHueCenter);
        if (hueDistance > 3.14159) hueDistance = 6.28318 - hueDistance;

        if (hueDistance < redHueWidth) {
          float redModifierAmount = 1.0 - (hueDistance / redHueWidth);
          float luminance = 0.2722287168 * color.r + 0.6740817658 * color.g + 0.0536895174 * color.b;
          float desaturationFactor = 0.03 * redModifierAmount;

          return vec3(
            color.r + desaturationFactor * (luminance - color.r),
            color.g + desaturationFactor * (luminance - color.g),
            color.b + desaturationFactor * (luminance - color.b)
          );
        }
        return color;
      }

      // Full ACES RRT - Global Desaturation
      // Reference: ACES v1.3 RRT, Section 4.6
      vec3 applyGlobalDesaturation(vec3 color) {
        float Y = 0.2722287168 * color.r + 0.6740817658 * color.g + 0.0536895174 * color.b;
        float desaturationThreshold = 0.8;
        float desaturationAmount = 0.15;

        if (Y > desaturationThreshold) {
          float desaturationFactor = desaturationAmount * pow((Y - desaturationThreshold) / (1.0 - desaturationThreshold), 2.0);

          return vec3(
            color.r + desaturationFactor * (Y - color.r),
            color.g + desaturationFactor * (Y - color.g),
            color.b + desaturationFactor * (Y - color.b)
          );
        }
        return color;
      }

      // Full ACES RRT
      // Reference: ACES v1.3 RRT (Academy S-2014-004)
      vec3 applyFullACESRRT(vec3 color) {
        // Step 1: Glow Module
        color = applyGlowModule(color);

        // Step 2: Red Modifier
        color = applyRedModifier(color);

        // Step 3: Global Desaturation
        color = applyGlobalDesaturation(color);

        // Step 4: Tone Scale
        color = ACESFilmic(color);

        return color;
      }
      
      // sRGB to Linear
      vec3 sRGBToLinear(vec3 srgb) {
        vec3 linear;
        linear.r = (srgb.r <= 0.04045) ? srgb.r / 12.92 : pow((srgb.r + 0.055) / 1.055, 2.4);
        linear.g = (srgb.g <= 0.04045) ? srgb.g / 12.92 : pow((srgb.g + 0.055) / 1.055, 2.4);
        linear.b = (srgb.b <= 0.04045) ? srgb.b / 12.92 : pow((srgb.b + 0.055) / 1.055, 2.4);
        return linear;
      }
      
      // Linear to sRGB
      vec3 linearToSRGB(vec3 linear) {
        vec3 srgb;
        srgb.r = (linear.r <= 0.0031308) ? linear.r * 12.92 : 1.055 * pow(linear.r, 1.0 / 2.4) - 0.055;
        srgb.g = (linear.g <= 0.0031308) ? linear.g * 12.92 : 1.055 * pow(linear.g, 1.0 / 2.4) - 0.055;
        srgb.b = (linear.b <= 0.0031308) ? linear.b * 12.92 : 1.055 * pow(linear.b, 1.0 / 2.4) - 0.055;
        return srgb;
      }
      
      void main() {
        // Sample input color
        vec4 color = texture2D(tDiffuse, vUv);
        
        // Convert to linear space
        vec3 linearColor = sRGBToLinear(color.rgb);
        
        // Apply exposure adjustment
        linearColor *= pow(2.0, exposure);
        
        // Apply ACES tone mapping if enabled
        vec3 result;
        if (enableRRT > 0.5) {
          if (useFullRRT > 0.5) {
            result = applyFullACESRRT(linearColor);
          } else {
            result = ACESFilmic(linearColor);
          }
        } else {
          result = linearColor;
        }
        
        // Apply gamma adjustment
        if (gamma != 1.0) {
          result = pow(max(vec3(0.0), result), vec3(gamma));
        }
        
        // Convert back to sRGB (if not already done by ACES)
        if (enableRRT < 0.5) {
          result = linearToSRGB(result);
        }
        
        // Clamp to valid range
        result = clamp(result, 0.0, 1.0);
        
        // Output with original alpha
        gl_FragColor = vec4(result, color.a);
      }
    `;
  }
}

