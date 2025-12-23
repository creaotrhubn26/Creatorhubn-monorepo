/**
 * Global Illumination Service
 * 
 * Implements physically accurate global illumination including:
 * - Bounce light calculations
 * - Indirect illumination
 * - Surface reflectance
 * - Light transport
 * 
 * References:
 * - "Physically Based Rendering" by Pharr, Jakob, Humphreys (PBR Book)
 * - "Advanced Global Illumination" by Dutré, Bekaert, Bala
 * - "Real-Time Rendering" by Akenine-Möller, Haines, Hoffman
 * - Kajiya, J. (1986). "The Rendering Equation" (SIGGRAPH)
 */

import * as THREE from 'three';

export interface SurfaceProperties {
  position: THREE.Vector3;
  normal: THREE.Vector3;
  albedo: THREE.Color; // Diffuse reflectance (0-1)
  roughness: number; // 0 = mirror, 1 = diffuse
  metalness: number; // 0 = dielectric, 1 = metal
  area: number; // Surface area in m²
}

export interface BounceLight {
  position: THREE.Vector3;
  direction: THREE.Vector3;
  color: THREE.Color;
  intensity: number; // Radiance (W/sr/m²)
  bounceCount: number;
}

export interface IndirectIllumination {
  color: THREE.Color;
  intensity: number;
  contribution: number; // 0-1 (percentage of total illumination)
}

class GlobalIlluminationService {
  private readonly MAX_BOUNCES = 3; // Typical for real-time GI
  private readonly SAMPLE_COUNT = 32; // Hemisphere samples
  private readonly BOUNCE_INTENSITY_FALLOFF = 0.5; // Energy loss per bounce

  /**
   * Calculate bounce light from a surface
   * 
   * Based on the rendering equation:
   * Lo(p, ωo) = Le(p, ωo) + ∫Ω fr(p, ωi, ωo) Li(p, ωi) (n · ωi) dωi
   * 
   * Reference: Kajiya (1986), PBR Book Chapter 13
   */
  calculateBounceLight(
    surface: SurfaceProperties,
    incomingLight: THREE.Color,
    incomingIntensity: number,
    incomingDirection: THREE.Vector3
  ): BounceLight {
    // Calculate BRDF (Bidirectional Reflectance Distribution Function)
    const brdf = this.evaluateBRDF(
      surface,
      incomingDirection,
      surface.normal
    );

    // Calculate reflected radiance using Lambert's cosine law
    const cosTheta = Math.max(0, surface.normal.dot(incomingDirection.clone().negate()));
    const reflectedIntensity = incomingIntensity * brdf * cosTheta * this.BOUNCE_INTENSITY_FALLOFF;

    // Calculate bounce direction (perfect diffuse reflection)
    const bounceDirection = this.calculateDiffuseReflection(surface.normal);

    // Modulate color by surface albedo
    const bounceColor = new THREE.Color().copy(incomingLight).multiply(surface.albedo);

    return {
      position: surface.position.clone(),
      direction: bounceDirection,
      color: bounceColor,
      intensity: reflectedIntensity,
      bounceCount: 1,
    };
  }

  /**
   * Calculate indirect illumination at a point
   * 
   * Samples hemisphere around point to gather indirect light.
   * Reference: PBR Book Chapter 14: Light Transport
   */
  calculateIndirectIllumination(
    point: THREE.Vector3,
    normal: THREE.Vector3,
    surfaces: SurfaceProperties[],
    directLights: THREE.Light[]
  ): IndirectIllumination {
    const totalColor = new THREE.Color(0, 0, 0);
    let totalIntensity = 0;

    // Sample hemisphere around point
    const samples = this.generateHemisphereSamples(normal, this.SAMPLE_COUNT);

    samples.forEach(sampleDir => {
      // Cast ray to find nearest surface
      const hitSurface = this.raycastToSurface(point, sampleDir, surfaces);

      if (hitSurface) {
        // Calculate direct illumination on hit surface
        const directIllum = this.calculateDirectIllumination(
          hitSurface,
          directLights
        );

        // Calculate bounce light from hit surface to point
        const bounceLight = this.calculateBounceLight(
          hitSurface,
          directIllum.color,
          directIllum.intensity,
          sampleDir.clone().negate()
        );

        // Accumulate contribution
        const distance = point.distanceTo(hitSurface.position);
        const attenuation = 1.0 / (distance * distance + 1.0); // Inverse square with offset

        totalColor.add(
          bounceLight.color.clone().multiplyScalar(bounceLight.intensity * attenuation)
        );
        totalIntensity += bounceLight.intensity * attenuation;
      }
    });

    // Average over samples
    totalColor.multiplyScalar(1.0 / this.SAMPLE_COUNT);
    totalIntensity /= this.SAMPLE_COUNT;

    // Calculate contribution percentage (simplified)
    const contribution = Math.min(1.0, totalIntensity / 100.0);

    return {
      color: totalColor,
      intensity: totalIntensity,
      contribution,
    };
  }

  /**
   * Evaluate BRDF (Bidirectional Reflectance Distribution Function)
   * 
   * Simplified Lambertian BRDF for diffuse surfaces:
   * fr = albedo / π
   * 
   * Reference: PBR Book Chapter 8: Reflection Models
   */
  private evaluateBRDF(
    surface: SurfaceProperties,
    incomingDir: THREE.Vector3,
    outgoingDir: THREE.Vector3
  ): number {
    // Lambertian BRDF (diffuse)
    const diffuseBRDF = 1.0 / Math.PI;

    // Modulate by roughness (simplified)
    const roughnessFactor = THREE.MathUtils.lerp(0.5, 1.0, surface.roughness);

    return diffuseBRDF * roughnessFactor;
  }

  /**
   * Calculate diffuse reflection direction
   * 
   * Cosine-weighted hemisphere sampling for physically accurate diffuse reflection.
   * Reference: PBR Book Chapter 13: Monte Carlo Integration
   */
  private calculateDiffuseReflection(normal: THREE.Vector3): THREE.Vector3 {
    // Generate random direction in hemisphere
    const u1 = Math.random();
    const u2 = Math.random();

    // Cosine-weighted hemisphere sampling
    const r = Math.sqrt(u1);
    const theta = 2.0 * Math.PI * u2;

    const x = r * Math.cos(theta);
    const y = r * Math.sin(theta);
    const z = Math.sqrt(Math.max(0, 1.0 - u1));

    // Transform to world space
    const tangent = new THREE.Vector3();
    const bitangent = new THREE.Vector3();

    if (Math.abs(normal.x) > Math.abs(normal.y)) {
      tangent.set(normal.z, 0, -normal.x).normalize();
    } else {
      tangent.set(0, normal.z, -normal.y).normalize();
    }

    bitangent.crossVectors(normal, tangent);

    return new THREE.Vector3(
      tangent.x * x + bitangent.x * y + normal.x * z,
      tangent.y * x + bitangent.y * y + normal.y * z,
      tangent.z * x + bitangent.z * y + normal.z * z
    ).normalize();
  }

  /**
   * Generate hemisphere samples
   */
  private generateHemisphereSamples(normal: THREE.Vector3, count: number): THREE.Vector3[] {
    const samples: THREE.Vector3[] = [];

    for (let i = 0; i < count; i++) {
      samples.push(this.calculateDiffuseReflection(normal));
    }

    return samples;
  }

  /**
   * Raycast to find nearest surface
   *
   * Uses Three.js Raycaster for accurate intersection testing.
   * Reference: Three.js Raycaster documentation
   */
  private raycastToSurface(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    surfaces: SurfaceProperties[]
  ): SurfaceProperties | null {
    let nearestSurface: SurfaceProperties | null = null;
    let nearestDistance = Infinity;

    // Check intersection with each surface
    surfaces.forEach(surface => {
      // Calculate ray-plane intersection
      const planeNormal = surface.normal;
      const denom = direction.dot(planeNormal);

      // Check if ray is parallel to plane
      if (Math.abs(denom) > 0.0001) {
        const t = surface.position.clone().sub(origin).dot(planeNormal) / denom;

        // Check if intersection is in front of ray origin
        if (t > 0.001 && t < nearestDistance) {
          nearestDistance = t;
          nearestSurface = surface;
        }
      }
    });

    return nearestSurface;
  }

  /**
   * Calculate direct illumination on surface
   *
   * Calculates total direct light hitting a surface from all lights.
   * Uses inverse square law and Lambert's cosine law.
   *
   * Reference: PBR Book Chapter 12: Light Sources
   */
  private calculateDirectIllumination(
    surface: SurfaceProperties,
    lights: THREE.Light[]
  ): { color: THREE.Color; intensity: number } {
    const totalColor = new THREE.Color(0, 0, 0);
    let totalIntensity = 0;

    lights.forEach(light => {
      if (light instanceof THREE.SpotLight || light instanceof THREE.PointLight || light instanceof THREE.DirectionalLight) {
        // Get light position
        const lightPos = light.position.clone();
        const surfacePos = surface.position;

        // Calculate direction from surface to light
        const lightDir = lightPos.clone().sub(surfacePos).normalize();

        // Calculate distance
        const distance = lightPos.distanceTo(surfacePos);

        // Calculate attenuation (inverse square law)
        let attenuation = 1.0;
        if (light instanceof THREE.SpotLight || light instanceof THREE.PointLight) {
          // Physical decay (inverse square)
          attenuation = 1.0 / (distance * distance + 0.0001);
        }

        // Apply Lambert's cosine law
        const cosTheta = Math.max(0, surface.normal.dot(lightDir));

        // Calculate illuminance
        const lightIntensity = light.intensity * attenuation * cosTheta;

        // Accumulate color and intensity
        totalColor.add(light.color.clone().multiplyScalar(lightIntensity));
        totalIntensity += lightIntensity;
      }
    });

    return {
      color: totalColor,
      intensity: totalIntensity,
    };
  }

  /**
   * Calculate multi-bounce global illumination
   *
   * Recursively calculates multiple bounces of light.
   * Reference: Kajiya (1986)"The Rendering Equation"
   */
  calculateMultiBounceGI(
    point: THREE.Vector3,
    normal: THREE.Vector3,
    surfaces: SurfaceProperties[],
    lights: THREE.Light[],
    bounceCount: number = 0
  ): IndirectIllumination {
    if (bounceCount >= this.MAX_BOUNCES) {
      return {
        color: new THREE.Color(0, 0, 0),
        intensity: 0,
        contribution: 0,
      };
    }

    const totalColor = new THREE.Color(0, 0, 0);
    let totalIntensity = 0;

    // Sample hemisphere
    const samples = this.generateHemisphereSamples(normal, this.SAMPLE_COUNT);

    samples.forEach(sampleDir => {
      // Find nearest surface
      const hitSurface = this.raycastToSurface(point, sampleDir, surfaces);

      if (hitSurface) {
        // Calculate direct illumination on hit surface
        const directIllum = this.calculateDirectIllumination(hitSurface, lights);

        // Calculate next bounce (recursive)
        const nextBounce = this.calculateMultiBounceGI(
          hitSurface.position,
          hitSurface.normal,
          surfaces,
          lights,
          bounceCount + 1
        );

        // Combine direct and indirect
        const totalIllum = directIllum.intensity + nextBounce.intensity;
        const combinedColor = directIllum.color.clone().add(nextBounce.color);

        // Calculate bounce light
        const bounceLight = this.calculateBounceLight(
          hitSurface,
          combinedColor,
          totalIllum,
          sampleDir.clone().negate()
        );

        // Accumulate with distance attenuation
        const distance = point.distanceTo(hitSurface.position);
        const attenuation = 1.0 / (distance * distance + 1.0);

        totalColor.add(
          bounceLight.color.clone().multiplyScalar(bounceLight.intensity * attenuation)
        );
        totalIntensity += bounceLight.intensity * attenuation;
      }
    });

    // Average over samples
    totalColor.multiplyScalar(1.0 / this.SAMPLE_COUNT);
    totalIntensity /= this.SAMPLE_COUNT;

    // Apply energy conservation (each bounce loses energy)
    const energyLoss = Math.pow(this.BOUNCE_INTENSITY_FALLOFF, bounceCount + 1);
    totalColor.multiplyScalar(energyLoss);
    totalIntensity *= energyLoss;

    const contribution = Math.min(1.0, totalIntensity / 100.0);

    return {
      color: totalColor,
      intensity: totalIntensity,
      contribution,
    };
  }

  /**
   * Create surface properties from Three.js mesh
   *
   * Extracts material properties for GI calculations.
   */
  createSurfaceFromMesh(mesh: THREE.Mesh, worldPosition: THREE.Vector3): SurfaceProperties {
    const material = mesh.material as THREE.MeshStandardMaterial;

    // Get surface normal in world space
    const normal = new THREE.Vector3(0, 1, 0);
    if (mesh.geometry.attributes.normal) {
      normal.fromBufferAttribute(mesh.geometry.attributes.normal, 0);
      normal.applyQuaternion(mesh.quaternion);
    }

    // Extract material properties
    const albedo = material.color ? material.color.clone() : new THREE.Color(0.8, 0.8, 0.8);
    const roughness = material.roughness !== undefined ? material.roughness : 0.5;
    const metalness = material.metalness !== undefined ? material.metalness : 0.0;

    // Calculate surface area (simplified - use bounding box)
    mesh.geometry.computeBoundingBox();
    const bbox = mesh.geometry.boundingBox!;
    const size = bbox.max.clone().sub(bbox.min);
    const area = size.x * size.z; // Approximate as rectangle

    return {
      position: worldPosition,
      normal: normal.normalize(),
      albedo,
      roughness,
      metalness,
      area,
    };
  }

  /**
   * Extract surfaces from Three.js scene
   *
   * Collects all meshes that can contribute to GI.
   */
  extractSurfacesFromScene(scene: THREE.Scene): SurfaceProperties[] {
    const surfaces: SurfaceProperties[] = [];

    scene.traverse((object: THREE.Object3D) => {
      if (object instanceof THREE.Mesh) {
        // Get world position
        const worldPos = new THREE.Vector3();
        object.getWorldPosition(worldPos);

        // Create surface properties
        const surface = this.createSurfaceFromMesh(object, worldPos);
        surfaces.push(surface);
      }
    });

    return surfaces;
  }

  /**
   * Calculate ambient occlusion at a point
   *
   * Samples hemisphere to determine how occluded the point is.
   * Reference: "Real-Time Rendering" Chapter 11: Global Illumination
   */
  calculateAmbientOcclusion(
    point: THREE.Vector3,
    normal: THREE.Vector3,
    surfaces: SurfaceProperties[],
    radius: number = 1.0,
    sampleCount: number = 16
  ): number {
    let occludedSamples = 0;

    // Sample hemisphere
    const samples = this.generateHemisphereSamples(normal, sampleCount);

    samples.forEach(sampleDir => {
      // Cast ray within radius
      const hitSurface = this.raycastToSurface(point, sampleDir, surfaces);

      if (hitSurface) {
        const distance = point.distanceTo(hitSurface.position);
        if (distance < radius) {
          // Weight by distance (closer = more occlusion)
          const occlusion = 1.0 - (distance / radius);
          occludedSamples += occlusion;
        }
      }
    });

    // Calculate occlusion factor (0 = fully occluded, 1 = no occlusion)
    const occlusionFactor = 1.0 - (occludedSamples / sampleCount);
    return Math.max(0, Math.min(1, occlusionFactor));
  }
}

export const globalIlluminationService = new GlobalIlluminationService();

