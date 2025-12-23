import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import * as THREE from'three';

/**
 * False Color Exposure Pass
 * 
 * Maps luminance values to false colors for exposure analysis:
 * - Dark Blue: < -3 stops (severely underexposed)
 * - Blue: -3 to -2 stops (underexposed)
 * - Cyan: -2 to -1 stops (slightly underexposed)
 * - Green: -1 to +1 stops (correct exposure)
 * - Yellow: +1 to +2 stops (slightly overexposed)
 * - Orange: +2 to +3 stops (overexposed)
 * - Red: +3 to +4 stops (severely overexposed)
 * - Magenta: > +4 stops (clipping)
 */

const FalseColorShader = {
  uniforms: {
    tDiffuse: { value: null },
    middleGray: { value: 0.18 }, // 18% gray (middle exposure)
    enabled: { value: true },
    opacity: { value: 0.8 }, // Blend with original image
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
    uniform float middleGray;
    uniform bool enabled;
    uniform float opacity;
    
    varying vec2 vUv;
    
    // Convert RGB to luminance
    float getLuminance(vec3 color) {
      return dot(color, vec3(0.2126, 0.7152, 0.0722));
    }
    
    // Calculate exposure value (EV) relative to middle gray
    float getEV(float luminance) {
      return log2(luminance / middleGray);
    }
    
    // Map EV to false color
    vec3 getFalseColor(float ev) {
      // Define color stops
      vec3 darkBlue = vec3(0.0, 0.0, 0.3);    // < -3 EV
      vec3 blue = vec3(0.0, 0.0, 1.0);        // -3 to -2 EV
      vec3 cyan = vec3(0.0, 1.0, 1.0);        // -2 to -1 EV
      vec3 green = vec3(0.0, 1.0, 0.0);       // -1 to +1 EV (correct)
      vec3 yellow = vec3(1.0, 1.0, 0.0);      // +1 to +2 EV
      vec3 orange = vec3(1.0, 0.5, 0.0);      // +2 to +3 EV
      vec3 red = vec3(1.0, 0.0, 0.0);         // +3 to +4 EV
      vec3 magenta = vec3(1.0, 0.0, 1.0);     // > +4 EV (clipping)
      
      // Smooth interpolation between colors
      if (ev < -3.0) {
        return darkBlue;
      } else if (ev < -2.0) {
        float t = (ev + 3.0) / 1.0;
        return mix(darkBlue, blue, t);
      } else if (ev < -1.0) {
        float t = (ev + 2.0) / 1.0;
        return mix(blue, cyan, t);
      } else if (ev < 1.0) {
        float t = (ev + 1.0) / 2.0;
        return mix(cyan, green, t * 0.5) + mix(green, yellow, t * 0.5);
      } else if (ev < 2.0) {
        float t = (ev - 1.0) / 1.0;
        return mix(yellow, orange, t);
      } else if (ev < 3.0) {
        float t = (ev - 2.0) / 1.0;
        return mix(orange, red, t);
      } else if (ev < 4.0) {
        float t = (ev - 3.0) / 1.0;
        return mix(red, magenta, t);
      } else {
        return magenta;
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
      
      // Avoid log(0)
      luminance = max(luminance, 0.0001);
      
      // Calculate EV
      float ev = getEV(luminance);
      
      // Get false color
      vec3 falseColor = getFalseColor(ev);
      
      // Blend with original image
      vec3 finalColor = mix(texel.rgb, falseColor, opacity);
      
      gl_FragColor = vec4(finalColor, texel.a);
    }
  `,
};

export class FalseColorPass extends ShaderPass {
  constructor() {
    super(FalseColorShader);
  }

  /**
   * Enable/disable false color overlay
   */
  setEnabled(enabled: boolean): void {
    this.uniforms.enabled.value = enabled;
  }

  /**
   * Set middle gray reference (default: 0.18)
   */
  setMiddleGray(value: number): void {
    this.uniforms.middleGray.value = value;
  }

  /**
   * Set opacity of false color overlay (0-1)
   */
  setOpacity(value: number): void {
    this.uniforms.opacity.value = THREE.MathUtils.clamp(value, 0, 1);
  }
}

