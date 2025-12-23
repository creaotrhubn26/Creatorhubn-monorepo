/**
 * Exponential Shadow Maps (ESM) Shader
 * 
 * Alternative soft shadow technique
 * Based on "Exponential Shadow Maps" by Annen et al.
 */

export const ESMVertexShader = `
varying vec4 vShadowCoord;

void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vShadowCoord = shadowMatrix * modelMatrix * vec4(position, 1.0);
}
`;

export const ESMFragmentShader = `
uniform sampler2D shadowMap;
uniform float shadowBias;
uniform float shadowDarkness;
uniform float esmExponent; // Typically 80.0

varying vec4 vShadowCoord;

float calculateESMShadow(sampler2D shadowMap, vec4 shadowCoord, float bias) {
  vec3 projCoords = shadowCoord.xyz / shadowCoord.w;
  projCoords = projCoords * 0.5 + 0.5; // Transform to [0,1] range
  
  if (projCoords.x < 0.0 || projCoords.x > 1.0 ||
      projCoords.y < 0.0 || projCoords.y > 1.0) {
    return 1.0; // Outside shadow map
  }
  
  float currentDepth = projCoords.z - bias;
  float occluderDepth = texture2D(shadowMap, projCoords.xy).r;
  
  // Exponential shadow map
  float shadow = exp(-esmExponent * (currentDepth - occluderDepth));
  shadow = clamp(shadow, 0.0, 1.0);
  
  return shadow;
}

void main() {
  float shadow = calculateESMShadow(shadowMap, vShadowCoord, shadowBias);
  shadow = mix(1.0 - shadowDarkness, 1.0, shadow);
  
  gl_FragColor = vec4(vec3(shadow), 1.0);
}
`;


