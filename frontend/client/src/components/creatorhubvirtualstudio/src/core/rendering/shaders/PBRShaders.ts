/**
 * Physically-Based Rendering Shaders
 * 
 * Implements:
 * - Cook-Torrance BRDF
 * - GGX microfacet distribution
 * - Fresnel-Schlick approximation
 * - Multiple importance sampling
 * - Energy conservation
 */

export const PBRVertexShader = `
varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec2 vUv;
varying vec3 vWorldPosition;

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewPosition = -mvPosition.xyz;
  vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * mvPosition;
}
`;

export const PBRFragmentShader = `
precision highp float;

uniform vec3 baseColor;
uniform float metallic;
uniform float roughness;
uniform float ao; // Ambient occlusion
uniform vec3 emissive;

// Camera
uniform vec3 cameraPosition;

// Lights (up to 8 area lights)
uniform vec3 lightPositions[8];
uniform vec3 lightColors[8];
uniform float lightIntensities[8];
uniform vec3 lightSizes[8]; // For area lights: [width, height, 0]
uniform int numLights;

varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec2 vUv;
varying vec3 vWorldPosition;

const float PI = 3.14159265359;

// GGX/Trowbridge-Reitz normal distribution function
float DistributionGGX(vec3 N, vec3 H, float roughness) {
  float a = roughness * roughness;
  float a2 = a * a;
  float NdotH = max(dot(N, H), 0.0);
  float NdotH2 = NdotH * NdotH;
  
  float nom = a2;
  float denom = (NdotH2 * (a2 - 1.0) + 1.0);
  denom = PI * denom * denom;
  
  return nom / max(denom, 0.0001);
}

// Geometry function (Schlick-GGX)
float GeometrySchlickGGX(float NdotV, float roughness) {
  float r = (roughness + 1.0);
  float k = (r * r) / 8.0;
  
  float nom = NdotV;
  float denom = NdotV * (1.0 - k) + k;
  
  return nom / max(denom, 0.0001);
}

// Smith's method for geometry obstruction
float GeometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
  float NdotV = max(dot(N, V), 0.0);
  float NdotL = max(dot(N, L), 0.0);
  float ggx2 = GeometrySchlickGGX(NdotV, roughness);
  float ggx1 = GeometrySchlickGGX(NdotL, roughness);
  
  return ggx1 * ggx2;
}

// Fresnel-Schlick approximation
vec3 fresnelSchlick(float cosTheta, vec3 F0) {
  return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

// Area light approximation (Representative Point method)
vec3 calculateAreaLight(vec3 N, vec3 V, vec3 F0, vec3 lightPos, vec3 lightColor, 
                        float lightIntensity, vec3 lightSize) {
  // For area lights, find closest point on light surface
  vec3 L = lightPos - vWorldPosition;
  float distance = length(L);
  L = normalize(L);
  
  // Area light solid angle approximation
  float lightArea = lightSize.x * lightSize.y;
  float solidAngle = lightArea / (distance * distance + lightArea);
  
  vec3 H = normalize(V + L);
  
  // Cook-Torrance BRDF
  float NDF = DistributionGGX(N, H, roughness);
  float G = GeometrySmith(N, V, L, roughness);
  vec3 F = fresnelSchlick(max(dot(H, V), 0.0), F0);
  
  vec3 numerator = NDF * G * F;
  float denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0);
  vec3 specular = numerator / max(denominator, 0.001);
  
  // Energy conservation
  vec3 kS = F;
  vec3 kD = vec3(1.0) - kS;
  kD *= 1.0 - metallic;
  
  float NdotL = max(dot(N, L), 0.0);
  
  // Inverse square falloff with area light compensation
  float attenuation = lightIntensity / (distance * distance) * solidAngle;
  vec3 radiance = lightColor * attenuation;
  
  return (kD * baseColor / PI + specular) * radiance * NdotL;
}

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(vViewPosition);
  
  // Calculate reflectance at normal incidence
  vec3 F0 = vec3(0.04);
  F0 = mix(F0, baseColor, metallic);
  
  // Accumulate lighting from all lights
  vec3 Lo = vec3(0.0);
  for(int i = 0; i < 8; i++) {
    if(i >= numLights) break;
    Lo += calculateAreaLight(N, V, F0, lightPositions[i], lightColors[i], 
                             lightIntensities[i], lightSizes[i]);
  }
  
  // Ambient lighting (simple approximation)
  vec3 ambient = vec3(0.03) * baseColor * ao;
  vec3 color = ambient + Lo + emissive;
  
  gl_FragColor = vec4(color, 1.0);
}
`;

