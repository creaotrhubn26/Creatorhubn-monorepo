import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import * as THREE from'three';

/**
 * Luminance Heatmap Pass
 * 
 * Visualizes light intensity distribution using a thermal color map:
 * - Black/Purple: Very low intensity (0-10%)
 * - Blue: Low intensity (10-25%)
 * - Cyan: Medium-low intensity (25-40%)
 * - Green: Medium intensity (40-60%)
 * - Yellow: Medium-high intensity (60-75%)
 * - Orange: High intensity (75-90%)
 * - Red: Very high intensity (90-100%)
 * - White: Extreme intensity (>100%)
 */

const LuminanceHeatmapShader = {
  uniforms: {
    tDiffuse: { value: null },
    minLuminance: { value: 0.0 },
    maxLuminance: { value: 1.0 },
    enabled: { value: true },
    opacity: { value: 0.7 },
  },

  vertexShader: `
    varying vec2 vUv;
    
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float minLuminance;
    uniform float maxLuminance;
    uniform bool enabled;
    uniform float opacity;
    
    varying vec2 vUv;
    
    // Convert RGB to luminance
    float getLuminance(vec3 color) {
      return dot(color, vec3(0.2126, 0.7152, 0.0722));
    }
    
    // Thermal color map (black -> purple -> blue -> cyan -> green -> yellow -> orange -> red -> white)
    vec3 getThermalColor(float t) {
      // Clamp to [0, 1]
      t = clamp(t, 0.0, 1.0);
      
      // Define color stops
      vec3 black = vec3(0.0, 0.0, 0.0);
      vec3 purple = vec3(0.5, 0.0, 0.5);
      vec3 blue = vec3(0.0, 0.0, 1.0);
      vec3 cyan = vec3(0.0, 1.0, 1.0);
      vec3 green = vec3(0.0, 1.0, 0.0);
      vec3 yellow = vec3(1.0, 1.0, 0.0);
      vec3 orange = vec3(1.0, 0.5, 0.0);
      vec3 red = vec3(1.0, 0.0, 0.0);
      vec3 white = vec3(1.0, 1.0, 1.0);
      
      // Smooth interpolation
      if (t < 0.1) {
        // Black to purple (0-10%)
        float s = t / 0.1;
        return mix(black, purple, s);
      } else if (t < 0.25) {
        // Purple to blue (10-25%)
        float s = (t - 0.1) / 0.15;
        return mix(purple, blue, s);
      } else if (t < 0.4) {
        // Blue to cyan (25-40%)
        float s = (t - 0.25) / 0.15;
        return mix(blue, cyan, s);
      } else if (t < 0.6) {
        // Cyan to green (40-60%)
        float s = (t - 0.4) / 0.2;
        return mix(cyan, green, s);
      } else if (t < 0.75) {
        // Green to yellow (60-75%)
        float s = (t - 0.6) / 0.15;
        return mix(green, yellow, s);
      } else if (t < 0.9) {
        // Yellow to orange (75-90%)
        float s = (t - 0.75) / 0.15;
        return mix(yellow, orange, s);
      } else if (t < 1.0) {
        // Orange to red (90-100%)
        float s = (t - 0.9) / 0.1;
        return mix(orange, red, s);
      } else {
        // Red to white (>100%)
        return white;
      }
    }
    
    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      
      if (!enabled) {
        gl_FragColor = texel;
        return;
      }
      
      // Calculate luminance
      float luminance = getLuminance(texel.rgb);
      
      // Normalize to [0, 1] range
      float normalizedLuminance = (luminance - minLuminance) / (maxLuminance - minLuminance);
      
      // Get thermal color
      vec3 heatmapColor = getThermalColor(normalizedLuminance);
      
      // Blend with original image
      vec3 finalColor = mix(texel.rgb, heatmapColor, opacity);
      
      gl_FragColor = vec4(finalColor, texel.a);
    }
  `,
};

export class LuminanceHeatmapPass extends ShaderPass {
  constructor() {
    super(LuminanceHeatmapShader);
  }

  /**
   * Enable/disable heatmap overlay
   */
  setEnabled(enabled: boolean): void {
    this.uniforms.enabled.value = enabled;
  }

  /**
   * Set luminance range for heatmap
   */
  setLuminanceRange(min: number, max: number): void {
    this.uniforms.minLuminance.value = min;
    this.uniforms.maxLuminance.value = max;
  }

  /**
   * Set opacity of heatmap overlay (0-1)
   */
  setOpacity(value: number): void {
    this.uniforms.opacity.value = THREE.MathUtils.clamp(value, 0, 1);
  }
}

