/**
 * Soft Shadow Shader (PCSS - Percentage Closer Soft Shadows)
 * 
 * Implements:
 * - Contact-hardening shadows
 * - Area light shadow approximation
 * - Penumbra size based on blocker distance
 * - Multi-sample PCF filtering
 */

export const SoftShadowFragmentChunk = `
#ifdef USE_SHADOWMAP

// PCSS parameters
#define LIGHT_SIZE_UV 0.05  // Size of area light in shadow map UV space
#define NEAR_PLANE 0.1
#define BLOCKER_SEARCH_SAMPLES 16
#define PCF_SAMPLES 32

// Poisson disk samples for PCF
const vec2 poissonDisk[32] = vec2[](
  vec2(-0.94201624, -0.39906216), vec2(0.94558609, -0.76890725),
  vec2(-0.094184101, -0.92938870), vec2(0.34495938, 0.29387760),
  vec2(-0.91588581, 0.45771432), vec2(-0.81544232, -0.87912464),
  vec2(-0.38277543, 0.27676845), vec2(0.97484398, 0.75648379),
  vec2(0.44323325, -0.97511554), vec2(0.53742981, -0.47373420),
  vec2(-0.26496911, -0.41893023), vec2(0.79197514, 0.19090188),
  vec2(-0.24188840, 0.99706507), vec2(-0.81409955, 0.91437590),
  vec2(0.19984126, 0.78641367), vec2(0.14383161, -0.14100790),
  vec2(-0.53018373, -0.69952148), vec2(0.61055260, 0.39591950),
  vec2(-0.68763936, 0.08427289), vec2(0.31820965, -0.32022893),
  vec2(-0.04733102, 0.38389957), vec2(0.86144084, -0.35774004),
  vec2(-0.39565983, 0.73437214), vec2(0.05141488, -0.65251945),
  vec2(-0.71746337, 0.46542096), vec2(0.43428612, 0.89404494),
  vec2(-0.17645586, -0.17391837), vec2(0.67724478, -0.10559348),
  vec2(-0.46023345, -0.09643573), vec2(0.22618428, 0.51

871890),
  vec2(-0.98417634, 0.17668289), vec2(0.98887694, -0.14876936)
);

// Random rotation for noise reduction
float random(vec3 seed, int i) {
  vec4 seed4 = vec4(seed, i);
  float dot_product = dot(seed4, vec4(12.9898, 78.233, 45.164, 94.673));
  return fract(sin(dot_product) * 43758.5453);
}

// Find average blocker depth for PCSS
float findBlockerDistance(sampler2D shadowMap, vec3 shadowCoord, float lightSize) {
  float searchWidth = lightSize * (shadowCoord.z - NEAR_PLANE) / shadowCoord.z;
  float blockerSum = 0.0;
  float numBlockers = 0.0;
  
  for(int i = 0; i < BLOCKER_SEARCH_SAMPLES; i++) {
    vec2 offset = poissonDisk[i] * searchWidth;
    float shadowMapDepth = texture2D(shadowMap, shadowCoord.xy + offset).r;
    
    if(shadowMapDepth < shadowCoord.z - 0.001) {
      blockerSum += shadowMapDepth;
      numBlockers += 1.0;
    }
  }
  
  if(numBlockers < 1.0) return -1.0;
  return blockerSum / numBlockers;
}

// PCSS penumbra size estimation
float penumbraSize(float zReceiver, float zBlocker) {
  return (zReceiver - zBlocker) / zBlocker;
}

// PCF filtering with variable kernel size
float PCF_Filter(sampler2D shadowMap, vec3 shadowCoord, float filterRadius) {
  float shadow = 0.0;
  float bias = 0.001;
  
  // Random rotation to reduce banding
  float angle = random(shadowCoord, 0) * 6.283185;
  float s = sin(angle);
  float c = cos(angle);
  mat2 rotation = mat2(c, -s, s, c);
  
  for(int i = 0; i < PCF_SAMPLES; i++) {
    vec2 offset = rotation * poissonDisk[i] * filterRadius;
    float shadowMapDepth = texture2D(shadowMap, shadowCoord.xy + offset).r;
    shadow += shadowMapDepth < (shadowCoord.z - bias) ? 0.0 : 1.0;
  }
  
  return shadow / float(PCF_SAMPLES);
}

// Main PCSS shadow calculation
float PCSS_Shadow(sampler2D shadowMap, vec3 shadowCoord, float lightSize) {
  // Step 1: Blocker search
  float avgBlockerDepth = findBlockerDistance(shadowMap, shadowCoord, lightSize);
  
  // No blockers = fully lit
  if(avgBlockerDepth < 0.0) return 1.0;
  
  // Step 2: Penumbra size
  float penumbra = penumbraSize(shadowCoord.z, avgBlockerDepth);
  float filterRadius = penumbra * lightSize * NEAR_PLANE / shadowCoord.z;
  
  // Step 3: PCF filtering
  return PCF_Filter(shadowMap, shadowCoord, filterRadius);
}

#endif
`;

// Vertex shader for shadow mapping
export const ShadowMapVertexShader = `
varying vec4 vShadowCoord[8]; // Support up to 8 shadow maps
uniform mat4 shadowMatrices[8];
uniform int numShadowMaps;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  
  // Calculate shadow coordinates for each light
  for(int i = 0; i < 8; i++) {
    if(i >= numShadowMaps) break;
    vShadowCoord[i] = shadowMatrices[i] * worldPosition;
  }
  
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// Integration with main shader
export const ShadowIntegrationChunk = `
// Add to main fragment shader
uniform sampler2D shadowMaps[8];
uniform float lightSizesUV[8]; // Area light sizes in UV space
uniform int numShadowMaps;

varying vec4 vShadowCoord[8];

float getShadowFactor(int lightIndex) {
  if(lightIndex >= numShadowMaps) return 1.0;
  
  vec4 shadowCoord = vShadowCoord[lightIndex];
  shadowCoord.xyz /= shadowCoord.w;
  shadowCoord.xyz = shadowCoord.xyz * 0.5 + 0.5;
  
  // Check if in shadow map bounds
  if(shadowCoord.x < 0.0 || shadowCoord.x > 1.0 || 
     shadowCoord.y < 0.0 || shadowCoord.y > 1.0 ||
     shadowCoord.z < 0.0 || shadowCoord.z > 1.0) {
    return 1.0;
  }
  
  return PCSS_Shadow(shadowMaps[lightIndex], shadowCoord.xyz, lightSizesUV[lightIndex]);
}
`;

export const SHADOW_CONFIG = {
  shadowMapSize: 2048,
  blockerSearchSamples: 16,
  pcfSamples: 32,
  lightSizeUV: 0.05,
  nearPlane: 0.1,
  bias: 0.001,
};

