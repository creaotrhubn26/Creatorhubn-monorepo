/**
 * Volumetric Lighting Shader
 * 
 * Implements:
 * - Light scattering in fog/atmosphere
 * - Visible light beams (god rays)
 * - Density-based attenuation
 * - Multiple light sources
 */

export const VolumetricVertexShader = `
varying vec3 vWorldPosition;
varying vec3 vViewPosition;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewPosition = -mvPosition.xyz;
  
  gl_Position = projectionMatrix * mvPosition;
}
`;

export const VolumetricFragmentShader = `
precision highp float;

uniform vec3 cameraPosition;
uniform float fogDensity;
uniform vec3 fogColor;

// Lights
uniform vec3 lightPositions[8];
uniform vec3 lightColors[8];
uniform vec3 lightDirections[8]; // For spotlights
uniform float lightIntensities[8];
uniform float lightRanges[8];
uniform float lightAngles[8]; // Cone angle for spotlights
uniform int numLights;

// Volumetric parameters
uniform int volumetricSamples; // Ray marching samples (16-32)
uniform float scatteringCoefficient; // How much light scatters
uniform float absorptionCoefficient; // How much light is absorbed

varying vec3 vWorldPosition;
varying vec3 vViewPosition;

const float PI = 3.14159265359;

// Henyey-Greenstein phase function for anisotropic scattering
float phaseFunction(float cosTheta, float g) {
  float g2 = g * g;
  float denom = 1.0 + g2 - 2.0 * g * cosTheta;
  return (1.0 - g2) / (4.0 * PI * pow(denom, 1.5));
}

// Calculate light scattering along ray
vec3 calculateVolumetricScattering(vec3 rayStart, vec3 rayDir, float rayLength) {
  vec3 scattering = vec3(0.0);
  float stepSize = rayLength / float(volumetricSamples);
  
  // Ray march from camera to fragment
  for(int i = 0; i < 32; i++) {
    if(i >= volumetricSamples) break;
    
    float t = float(i) * stepSize;
    vec3 samplePos = rayStart + rayDir * t;
    
    // Sample fog density (can be non-uniform)
    float density = fogDensity * exp(-samplePos.y * 0.1); // Height-based fog
    
    // Accumulate scattering from each light
    for(int j = 0; j < 8; j++) {
      if(j >= numLights) break;
      
      vec3 toLight = lightPositions[j] - samplePos;
      float distToLight = length(toLight);
      vec3 lightDir = toLight / distToLight;
      
      // Check if sample is within light range
      if(distToLight > lightRanges[j]) continue;
      
      // Spotlight cone attenuation
      float spotEffect = 1.0;
      if(lightAngles[j] > 0.0) {
        float cosAngle = dot(lightDir, -lightDirections[j]);
        float coneAngle = cos(lightAngles[j] * 0.5);
        spotEffect = smoothstep(coneAngle - 0.1, coneAngle, cosAngle);
      }
      
      if(spotEffect < 0.01) continue;
      
      // Light attenuation
      float attenuation = lightIntensities[j] / (distToLight * distToLight + 1.0);
      attenuation *= spotEffect;
      
      // Phase function (forward scattering)
      float cosTheta = dot(rayDir, lightDir);
      float phase = phaseFunction(cosTheta, 0.3); // Slightly forward scattering
      
      // Beer's law for absorption
      float transmittance = exp(-absorptionCoefficient * distToLight);
      
      // Accumulate in-scattering
      vec3 lightContribution = lightColors[j] * attenuation * phase * transmittance;
      scattering += lightContribution * density * scatteringCoefficient * stepSize;
    }
  }
  
  return scattering;
}

void main() {
  vec3 rayStart = cameraPosition;
  vec3 rayEnd = vWorldPosition;
  vec3 rayDir = normalize(rayEnd - rayStart);
  float rayLength = length(rayEnd - rayStart);
  
  // Calculate volumetric scattering
  vec3 scattering = calculateVolumetricScattering(rayStart, rayDir, rayLength);
  
  // Add fog color
  vec3 finalColor = scattering + fogColor * fogDensity * 0.1;
  
  // Alpha based on total scattering
  float alpha = min(1.0, length(scattering) * 2.0 + fogDensity * 0.5);
  
  gl_FragColor = vec4(finalColor, alpha);
}
`;

// Simplified volumetric shader for better performance
export const FastVolumetricFragmentShader = `
precision highp float;

uniform vec3 cameraPosition;
uniform float fogDensity;

uniform vec3 lightPositions[8];
uniform vec3 lightColors[8];
uniform float lightIntensities[8];
uniform int numLights;

varying vec3 vWorldPosition;

void main() {
  vec3 viewDir = normalize(vWorldPosition - cameraPosition);
  float dist = length(vWorldPosition - cameraPosition);
  
  // Simple distance fog
  float fogFactor = 1.0 - exp(-fogDensity * dist);
  
  // Accumulate light glow
  vec3 glow = vec3(0.0);
  for(int i = 0; i < 8; i++) {
    if(i >= numLights) break;
    
    vec3 toLight = lightPositions[i] - vWorldPosition;
    float distToLight = length(toLight);
    vec3 lightDir = normalize(toLight);
    
    // Simple glow based on distance and view angle
    float viewAlignment = max(0.0, dot(viewDir, lightDir));
    float glow Intensity = lightIntensities[i] / (distToLight * distToLight + 1.0);
    glowIntensity *= pow(viewAlignment, 4.0); // Sharp falloff
    
    glow += lightColors[i] * glowIntensity * fogDensity;
  }
  
  float alpha = fogFactor * fogDensity;
  gl_FragColor = vec4(glow, alpha);
}
`;

export const VOLUMETRIC_CONFIG = {
  enabled: true,
  fogDensity: 0.02,
  fogColor: [0.1, 0.1, 0.12] as [number, number, number],
  volumetricSamples: 16,
  scatteringCoefficient: 0.5,
  absorptionCoefficient: 0.1,
  quality: 'medium' as 'low' | 'medium' |'high',
};

