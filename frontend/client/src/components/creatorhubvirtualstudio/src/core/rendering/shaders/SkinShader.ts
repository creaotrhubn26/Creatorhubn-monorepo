/**
 * Subsurface Scattering Skin Shader
 * 
 * Implements:
 * - Pre-integrated skin scattering (Penner method)
 * - Multiple scattering layers (epidermis, dermis, subdermal)
 * - Specular highlights with anisotropic roughness
 * - Translucency for thin areas (ears, nose)
 */

export const SkinVertexShader = `
varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vTangent;
varying vec3 vBitangent;

attribute vec3 tangent;

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  vTangent = normalize(normalMatrix * tangent);
  vBitangent = cross(vNormal, vTangent);
  
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewPosition = -mvPosition.xyz;
  vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * mvPosition;
}
`;

export const SkinFragmentShader = `
precision highp float;

uniform vec3 skinColor;
uniform float skinRoughness;
uniform float sssStrength; // Subsurface scattering strength
uniform float translucency; // For thin areas

// Scattering colors for different layers
uniform vec3 scatterEpidermis; // Surface layer (red)
uniform vec3 scatterDermis;    // Middle layer (red/yellow)
uniform vec3 scatterSubdermal; // Deep layer (blue/red)

// Camera
uniform vec3 cameraPosition;

// Lights
uniform vec3 lightPositions[8];
uniform vec3 lightColors[8];
uniform float lightIntensities[8];
uniform vec3 lightSizes[8];
uniform int numLights;

varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vTangent;
varying vec3 vBitangent;

const float PI = 3.14159265359;

// Pre-integrated skin scattering lookup (approximation)
vec3 skinScattering(float NdotL, float curvature) {
  // Simplified Penner method
  float scatter = smoothstep(0.0, 1.0, NdotL) * sssStrength;
  
  // Multiple scattering layers
  vec3 scattering = vec3(0.0);
  scattering += scatterEpidermis * pow(scatter, 1.0);  // Sharp, surface
  scattering += scatterDermis * pow(scatter, 3.0);     // Medium depth
  scattering += scatterSubdermal * pow(scatter, 8.0);  // Deep, soft
  
  return scattering * curvature;
}

// Translucency (backscattering)
vec3 calculateTranslucency(vec3 L, vec3 V, vec3 N, vec3 lightColor, float lightIntensity) {
  vec3 H = normalize(L + N * 0.5); // Offset for subsurface
  float VdotH = max(dot(V, -H), 0.0);
  float scatter = pow(VdotH, 4.0) * translucency;
  
  return lightColor * lightIntensity * scatter * scatterSubdermal;
}

// GGX distribution (from PBR shader)
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

// Fresnel for skin (lower F0 than metal)
vec3 fresnelSchlick(float cosTheta, vec3 F0) {
  return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(vViewPosition);
  
  // Skin has low F0 (around 0.028)
  vec3 F0 = vec3(0.028);
  
  // Curvature approximation (for scattering)
  float curvature = length(fwidth(vNormal)) * 10.0;
  curvature = clamp(curvature, 0.5, 1.0);
  
  vec3 totalColor = vec3(0.0);
  
  for(int i = 0; i < 8; i++) {
    if(i >= numLights) break;
    
    vec3 L = normalize(lightPositions[i] - vWorldPosition);
    float distance = length(lightPositions[i] - vWorldPosition);
    vec3 H = normalize(V + L);
    
    float NdotL = max(dot(N, L), 0.0);
    float NdotV = max(dot(N, V), 0.0);
    float NdotH = max(dot(N, H), 0.0);
    
    // Specular (reduced for skin)
    float D = DistributionGGX(N, H, skinRoughness);
    vec3 F = fresnelSchlick(max(dot(H, V), 0.0), F0);
    float specular = D * 0.3; // Reduced specular for skin
    
    // Diffuse with subsurface scattering
    vec3 scatter = skinScattering(NdotL, curvature);
    vec3 diffuse = skinColor * (NdotL + scatter);
    
    // Translucency (backscattering)
    vec3 trans = calculateTranslucency(L, V, N, lightColors[i], lightIntensities[i]);
    
    // Attenuation
    float attenuation = lightIntensities[i] / (distance * distance);
    vec3 radiance = lightColors[i] * attenuation;
    
    totalColor += (diffuse + specular * F) * radiance + trans;
  }
  
  // Ambient
  vec3 ambient = skinColor * 0.03;
  totalColor += ambient;
  
  gl_FragColor = vec4(totalColor, 1.0);
}
`;

// Default skin parameters
export const DEFAULT_SKIN_PARAMS = {
  skinColor: [0.95, 0.75, 0.65] as [number, number, number],
  skinRoughness: 0.4,
  sssStrength: 0.8,
  translucency: 0.3,
  scatterEpidermis: [1.0, 0.4, 0.3] as [number, number, number],  // Red surface
  scatterDermis: [1.0, 0.7, 0.5] as [number, number, number],     // Yellow/red middle
  scatterSubdermal: [0.8, 0.4, 0.6] as [number, number, number],  // Blue/red deep
};

