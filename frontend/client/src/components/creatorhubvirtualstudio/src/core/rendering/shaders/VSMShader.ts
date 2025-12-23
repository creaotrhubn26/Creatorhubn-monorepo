/**
 * Variance Shadow Maps (VSM) Shader
 * 
 * Provides softer, more realistic shadows than standard shadow maps
 * Based on "Variance Shadow Maps" by Donnelly & Lauritzen
 */

export const VSMVertexShader = `
varying vec4 vShadowCoord;

void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vShadowCoord = shadowMatrix * modelMatrix * vec4(position, 1.0);
}
`;

export const VSMFragmentShader = `
uniform sampler2D shadowMap;
uniform float shadowBias;
uniform float shadowDarkness;
uniform float shadowSoftness;

varying vec4 vShadowCoord;

float calculateVSMShadow(sampler2D shadowMap, vec4 shadowCoord, float bias) {
  vec3 projCoords = shadowCoord.xyz / shadowCoord.w;
  projCoords = projCoords * 0.5 + 0.5; // Transform to [0,1] range
  
  if (projCoords.x < 0.0 || projCoords.x > 1.0 ||
      projCoords.y < 0.0 || projCoords.y > 1.0) {
    return 1.0; // Outside shadow map
  }
  
  float currentDepth = projCoords.z - bias;
  
  // Sample VSM (stores depth and depth^2)
  vec2 moments = texture2D(shadowMap, projCoords.xy).rg;
  
  // Chebyshev's inequality
  float p = step(currentDepth, moments.x);
  float variance = moments.y - (moments.x * moments.x);
  variance = max(variance, 0.00002); // Prevent numerical issues
  
  float d = currentDepth - moments.x;
  float pMax = variance / (variance + d * d);
  
  // Soft shadow
  pMax = smoothstep(0.0, shadowSoftness, pMax);
  
  return max(p, pMax);
}

void main() {
  float shadow = calculateVSMShadow(shadowMap, vShadowCoord, shadowBias);
  shadow = mix(1.0 - shadowDarkness, 1.0, shadow);
  
  gl_FragColor = vec4(vec3(shadow), 1.0);
}
`;


