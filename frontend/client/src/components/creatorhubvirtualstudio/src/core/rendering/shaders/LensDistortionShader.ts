/**
 * Lens Distortion Shader
 * 
 * Applies realistic lens distortion (barrel, pincushion, mustache)
 * Based on Brown-Conrady distortion model
 */

export const LensDistortionVertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const LensDistortionFragmentShader = `
uniform sampler2D tDiffuse;
uniform vec2 resolution;
uniform float k1; // Radial distortion coefficient 1
uniform float k2; // Radial distortion coefficient 2
uniform float k3; // Radial distortion coefficient 3
uniform vec2 p; // Tangential distortion (p1, p2)
uniform float anamorphicSqueeze; // For anamorphic lenses

varying vec2 vUv;

void main() {
  // Normalize coordinates to [-1, 1]
  vec2 uv = vUv * 2.0 - 1.0;
  
  // Apply anamorphic squeeze if present
  if (anamorphicSqueeze > 1.0) {
    uv.x *= anamorphicSqueeze;
  }
  
  // Calculate distance from center
  float r2 = dot(uv, uv);
  float r4 = r2 * r2;
  float r6 = r4 * r2;
  
  // Radial distortion
  float radialDistortion = 1.0 + k1 * r2 + k2 * r4 + k3 * r6;
  
  // Tangential distortion
  vec2 tangentialDistortion = vec2(
    2.0 * p.x * uv.x * uv.y + p.y * (r2 + 2.0 * uv.x * uv.x),
    p.x * (r2 + 2.0 * uv.y * uv.y) + 2.0 * p.y * uv.x * uv.y
  );
  
  // Apply distortion
  vec2 distortedUv = uv * radialDistortion + tangentialDistortion;
  
  // Undo anamorphic squeeze
  if (anamorphicSqueeze > 1.0) {
    distortedUv.x /= anamorphicSqueeze;
  }
  
  // Convert back to [0, 1] range
  distortedUv = (distortedUv + 1.0) * 0.5;
  
  // Sample texture with distortion
  gl_FragColor = texture2D(tDiffuse, distortedUv);
}
`;


