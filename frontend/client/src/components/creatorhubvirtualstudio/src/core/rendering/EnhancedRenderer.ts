/**
 * Enhanced Renderer for Virtual Studio
 *
 * Implements physically-based rendering to match Set.a.light 3D V3 quality: * - ACES filmic tone mapping
 * - Realistic shadows (PCF soft shadows)
 * - Proper light falloff (inverse square law)
 * - Post-processing effects (bloom, depth of field)
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass';
import type { LUTIntegrationOptions } from '../../services/integrations';
import { integrationService } from '../../services/integrations';
import { logger } from '../services/logger';

const log = logger.module('Renderer');
import type { AreaLight } from './AreaLight';
import type { BounceSource } from './GlobalIllumination';
import { GlobalIlluminationSystem } from './GlobalIllumination';
import { PBRVertexShader, PBRFragmentShader } from './shaders/PBRShaders';
import { SkinVertexShader, SkinFragmentShader, DEFAULT_SKIN_PARAMS } from './shaders/SkinShader';
import { VSMShadowMapGenerator, VSMShadowConfig } from './VSMShadowSystem';
import { FalseColorPass } from './passes/FalseColorPass';
import { LuminanceHeatmapPass } from './passes/LuminanceHeatmapPass';

export interface RendererConfig {
  width: number;
  height: number;
  enableShadows: boolean;
  shadowMapSize: 1024 | 2048 | 4096;
  toneMapping: 'ACES' | 'Filmic' | 'Linear' | 'Reinhard';
  toneMappingExposure: number;
  enableBloom: boolean;
  enableDOF: boolean;
  antialiasing: boolean;
  pixelRatio: number;
  // New PBR features
  enablePBR: boolean;
  enableGI: boolean;
  enableVolumetrics: boolean;
  enableSoftShadows: boolean;
  enableVSMShadows: boolean; // Use Variance Shadow Maps instead of PCF
  giIntensity: number;
  giBounces: number;
  volumetricQuality: 'fast' | 'quality';
  enableFalseColor: boolean; // False color exposure visualization
  enableLuminanceHeatmap: boolean; // Luminance heatmap overlay
}

export interface CameraSettings {
  aperture: number; // f-stop (f/1.4 f/2.8 etc.),
  iso: number; // ISO value (100, 200, 400, etc.)
  shutter: number; // Shutter speed in seconds (1/125 = 0.008),
  focusDistance: number; // Focus distance in meters,
  focalLength: number; // Focal length in mm,
  sensor: [number, number]; // Sensor size in mm [width, height]
}

export class EnhancedRenderer {
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private renderPass: RenderPass;
  private bloomPass: UnrealBloomPass | null = null;
  private bokehPass: BokehPass | null = null;
  private falseColorPass: FalseColorPass | null = null;
  private luminanceHeatmapPass: LuminanceHeatmapPass | null = null;
  private outputPass: OutputPass;

  private config: RendererConfig;
  private cameraSettings: CameraSettings;

  // LUT integration
  private lutEnabled: boolean = false;
  private lutOptions: LUTIntegrationOptions = {
    preserveSkinTones: true,
    useGPU: true,
    intensity: 1.0,
  };

  // New PBR systems
  private giSystem: GlobalIlluminationSystem | null = null;
  private areaLights: AreaLight[] = [];
  private bounceSources: BounceSource[] = [];
  private vsmShadowSystem: VSMShadowMapGenerator | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    config: Partial<RendererConfig> = {},
    cameraSettings: Partial<CameraSettings> = {},
  ) {
    // Default configuration
    this.config = {
      width: 1920,
      height: 1080,
      enableShadows: true,
      shadowMapSize: 2048,
      toneMapping: 'ACES',
      toneMappingExposure: 1.0,
      enableBloom: true,
      enableDOF: true,
      antialiasing: true,
      pixelRatio: Math.min(window.devicePixelRatio, 2),
      // New PBR defaults
      enablePBR: true,
      enableGI: true,
      enableVolumetrics: false,
      enableSoftShadows: true,
      enableVSMShadows: false, // VSM is more expensive but provides softer shadows
      giIntensity: 0.5,
      giBounces: 2,
      volumetricQuality: 'fast',
      enableFalseColor: false,
      enableLuminanceHeatmap: false,
      ...config,
    };

    this.cameraSettings = {
      aperture: 2.8,
      iso: 100,
      shutter: 1 / 125,
      focusDistance: 3.0,
      focalLength: 50,
      sensor: [36, 24],
      ...cameraSettings,
    };

    // Initialize renderer with optimal settings
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: this.config.antialiasing,
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
      depth: true,
    });

    this.setupRenderer();
    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(new THREE.Scene(), new THREE.Camera());
    this.outputPass = new OutputPass();

    this.setupPostProcessing();
    this.setupPBRSystems();
  }

  /**
   * Setup renderer with physically-based settings
   */
  private setupRenderer(): void {
    const { renderer, config } = this;

    // Size and pixel ratio
    renderer.setSize(config.width, config.height);
    renderer.setPixelRatio(config.pixelRatio);

    // Tone mapping (CRITICAL for realistic lighting)
    switch (config.toneMapping) {
      case 'ACES':
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        break;
      case 'Filmic':
        renderer.toneMapping = THREE.CineonToneMapping;
        break;
      case 'Reinhard':
        renderer.toneMapping = THREE.ReinhardToneMapping;
        break;
      case 'Linear':
      default:
        renderer.toneMapping = THREE.LinearToneMapping;
    }

    renderer.toneMappingExposure = config.toneMappingExposure;

    // Shadow settings (CRITICAL for realism)
    if (config.enableShadows) {
      renderer.shadowMap.enabled = true;
      if (config.enableVSMShadows) {
        // VSM shadows - will be handled by VSMShadowSystem
        renderer.shadowMap.type = THREE.BasicShadowMap; // Basic for VSM
        this.vsmShadowSystem = new VSMShadowMapGenerator(renderer, {
          enabled: true,
          mapSize: config.shadowMapSize,
          blurRadius: 3.0,
          lightBleedingReduction: 0.1,
        });
        log.info('VSM shadow system initialized');
      } else {
        renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Soft shadows
      }
      renderer.shadowMap.autoUpdate = true;
    }

    // Color management
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Performance optimizations
    renderer.info.autoReset = true;

    log.info('Enhanced Renderer initialized:', {
      toneMapping: config.toneMapping,
      shadows: config.enableShadows,
      resolution: `${config.width}x${config.height}`,
      pixelRatio: config.pixelRatio,
    });
  }

  /**
   * Setup post-processing pipeline
   */
  private setupPostProcessing(): void {
    const { composer, renderPass, config } = this;

    // Base render pass
    composer.addPass(renderPass);

    // Bloom (for realistic light glow)
    if (config.enableBloom) {
      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(config.width, config.height),
        0.3, // strength
        0.4, // radius
        0.85, // threshold
      );
      composer.addPass(this.bloomPass);
    }

    // Depth of field (for camera realism)
    if (config.enableDOF) {
      this.bokehPass = new BokehPass(new THREE.Scene(), new THREE.Camera(), {
        focus: this.cameraSettings.focusDistance,
        aperture: this.calculateBokehAperture(),
        maxblur: 0.01,
      });
      composer.addPass(this.bokehPass);
    }

    // False color exposure visualization
    if (config.enableFalseColor) {
      this.falseColorPass = new FalseColorPass();
      composer.addPass(this.falseColorPass);
    }

    // Luminance heatmap overlay
    if (config.enableLuminanceHeatmap) {
      this.luminanceHeatmapPass = new LuminanceHeatmapPass();
      composer.addPass(this.luminanceHeatmapPass);
    }

    // Output pass (final color correction)
    composer.addPass(this.outputPass);
  }

  /**
   * Setup PBR systems (GI, area lights, etc.)
   */
  private setupPBRSystems(): void {
    const { config } = this;

    // Initialize Global Illumination system
    if (config.enableGI) {
      this.giSystem = new GlobalIlluminationSystem({
        enabled: true,
        bounces: config.giBounces,
        intensity: config.giIntensity,
        resolution: 32,
        updateFrequency: 5,
      });

      log.debug('Global Illumination system initialized');
    }
  }

  /**
   * Add area light to the scene
   */
  public addAreaLight(light: AreaLight): void {
    this.areaLights.push(light);
  }

  /**
   * Remove area light from the scene
   */
  public removeAreaLight(light: AreaLight): void {
    const index = this.areaLights.indexOf(light);
    if (index > -1) {
      this.areaLights.splice(index, 1);
    }
  }

  /**
   * Get all area lights
   */
  public getAreaLights(): AreaLight[] {
    return this.areaLights;
  }

  /**
   * Add bounce source for GI
   */
  public addBounceSource(source: BounceSource): void {
    this.bounceSources.push(source);
  }

  /**
   * Create studio environment with bounce sources
   */
  public createStudioEnvironment(scene: THREE.Scene): void {
    const sources = GlobalIlluminationSystem.createStudioEnvironment(scene);
    this.bounceSources = sources;
    log.debug(`Created ${sources.length} bounce sources for studio environment`);
  }

  /**
   * Create PBR material with custom shaders
   */
  public createAdvancedPBRMaterial(params: {
    baseColor?: THREE.ColorRepresentation;
    roughness?: number;
    metallic?: number;
    map?: THREE.Texture;
    normalMap?: THREE.Texture;
  }): THREE.ShaderMaterial {
    const material = new THREE.ShaderMaterial({
      vertexShader: PBRVertexShader,
      fragmentShader: PBRFragmentShader,
      uniforms: {
        baseColor: { value: new THREE.Color(params.baseColor || 0xffffff) },
        metallic: { value: params.metallic ?? 0.0 },
        roughness: { value: params.roughness ?? 0.5 },
        baseColorMap: { value: params.map || null },
        normalMap: { value: params.normalMap || null },
        // Area light uniforms (will be updated in render loop)
        areaLightCount: { value: 0 },
        areaLightPositions: { value: [] },
        areaLightColors: { value: [] },
        areaLightIntensities: { value: [] },
        areaLightSizes: { value: [] },
      },
      lights: false, // We handle lighting in the shader
    });

    return material;
  }

  /**
   * Create skin material for character models
   */
  public createSkinMaterial(params?: {
    skinColor?: [number, number, number];
    roughness?: number;
    sssStrength?: number;
    translucency?: number;
  }): THREE.ShaderMaterial {
    const skinParams = { ...DEFAULT_SKIN_PARAMS, ...params };

    const material = new THREE.ShaderMaterial({
      vertexShader: SkinVertexShader,
      fragmentShader: SkinFragmentShader,
      uniforms: {
        skinColor: { value: new THREE.Vector3(...skinParams.skinColor) },
        skinRoughness: { value: skinParams.skinRoughness },
        sssStrength: { value: skinParams.sssStrength },
        translucency: { value: skinParams.translucency },
        scatterEpidermis: { value: new THREE.Vector3(...skinParams.scatterEpidermis) },
        scatterDermis: { value: new THREE.Vector3(...skinParams.scatterDermis) },
        scatterSubdermal: { value: new THREE.Vector3(...skinParams.scatterSubdermal) },
        // Area light uniforms
        areaLightCount: { value: 0 },
        areaLightPositions: { value: [] },
        areaLightColors: { value: [] },
        areaLightIntensities: { value: [] },
        areaLightSizes: { value: [] },
      },
      lights: false,
    });

    return material;
  }

  /**
   * Update area light uniforms for all PBR materials in the scene
   */
  private updateAreaLightUniforms(scene: THREE.Scene): void {
    if (this.areaLights.length === 0) return;

    const positions: number[] = [];
    const colors: number[] = [];
    const intensities: number[] = [];
    const sizes: number[] = [];

    // Collect area light data
    this.areaLights.forEach((light) => {
      // Update uniform data position from Object3D world position
      (light as THREE.Object3D).getWorldPosition(light.uniformData.position);

      const pos = light.uniformData.position;
      const data = light.uniformData;

      positions.push(pos.x, pos.y, pos.z);
      colors.push(data.color.r, data.color.g, data.color.b);
      intensities.push(data.intensity);
      sizes.push(data.size.x, data.size.y);
    });

    // Update all shader materials in the scene
    scene.traverse((object: THREE.Object3D) => {
      if (object instanceof THREE.Mesh && object.material instanceof THREE.ShaderMaterial) {
        const uniforms = object.material.uniforms;
        if (uniforms.areaLightCount) {
          uniforms.areaLightCount.value = this.areaLights.length;
          uniforms.areaLightPositions.value = positions;
          uniforms.areaLightColors.value = colors;
          uniforms.areaLightIntensities.value = intensities;
          uniforms.areaLightSizes.value = sizes;
        }
      }
    });
  }

  /**
   * Calculate physically accurate exposure
   * Based on the exposure triangle: ISO, Aperture, Shutter
   */
  public calculateExposure(): number {
    const { iso, aperture, shutter } = this.cameraSettings;

    // EV = log2(N² / t) - log2(S / 100)
    // Where N = f-number, t = shutter time, S = ISO
    const ev = Math.log2((aperture * aperture) / shutter) - Math.log2(iso / 100);

    // Convert EV to exposure value for renderer
    const exposure = Math.pow(2, -ev);

    return Math.max(0.01, Math.min(10, exposure));
  }

  /**
   * Calculate bokeh aperture size from f-stop
   */
  private calculateBokehAperture(): number {
    const { aperture, focalLength } = this.cameraSettings;

    // Physical aperture diameter = focal length / f-number
    const apertureDiameter = focalLength / aperture;

    // Normalize to 0-1 range for shader
    // Smaller f-number (e.g. f/1.4) = larger aperture = more blur
    return Math.min(1, apertureDiameter / 50);
  }

  /**
   * Update camera settings and recalculate exposure
   */
  public updateCameraSettings(settings: Partial<CameraSettings>): void {
    this.cameraSettings = { ...this.cameraSettings, ...settings };

    // Update exposure
    const exposure = this.calculateExposure();
    this.renderer.toneMappingExposure = exposure;

    // Update depth of field
    if (this.bokehPass) {
      this.bokehPass.uniforms['focus'].value = this.cameraSettings.focusDistance;
      this.bokehPass.uniforms['aperture'].value = this.calculateBokehAperture();
    }

    log.debug('Camera updated: ', {
      aperture: `f/${settings.aperture}`,
      iso: settings.iso,
      shutter: `1/${Math.round(1 / (settings.shutter || 0.008))}`,
      exposure: exposure.toFixed(3),
    });
  }

  /**
   * Update tone mapping exposure directly
   */
  public updateToneMappingExposure(exposure: number): void {
    this.config.toneMappingExposure = exposure;
    this.renderer.toneMappingExposure = exposure;
  }

  /**
   * Create physically-based material
   */
  public createPBRMaterial(params: {
    color?: THREE.ColorRepresentation;
    roughness?: number;
    metalness?: number;
    map?: THREE.Texture;
    normalMap?: THREE.Texture;
  }): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      color: params.color || 0xffffff,
      roughness: params.roughness ?? 0.8,
      metalness: params.metalness ?? 0.0,
      map: params.map,
      normalMap: params.normalMap,
      envMapIntensity: 1.0,
    });
  }

  /**
   * Create physically accurate light
   */
  public createPhysicalLight(params: {
    type: 'point' | 'spot' | 'directional';
    power: number; // Watts or lumens
    colorTemp?: number; // Kelvin
    position: [number, number, number];
    target?: [number, number, number];
    angle?: number; // For spot lights (radians)
    penumbra?: number; // Soft edge
    decay?: number; // Light falloff (2 = physically accurate)
    castShadow?: boolean;
  }): THREE.Light {
    const { type, power, colorTemp, position, target, angle, penumbra, decay, castShadow } = params;

    // Convert color temperature to RGB
    const color = colorTemp ? this.kelvinToRGB(colorTemp) : 0xffffff;

    // Calculate intensity based on inverse square law
    // For physically accurate lights, use decay=2
    const intensity = power / (4 * Math.PI);

    let light: THREE.Light;

    switch (type) {
      case 'spot':
        const spotLight = new THREE.SpotLight(
          color,
          intensity,
          0, // distance (0 = infinite)
          angle || Math.PI / 6,
          penumbra || 0.1,
          decay || 2, // Physically accurate decay
        );
        spotLight.position.set(...position);
        if (target) {
          spotLight.target.position.set(...target);
        }
        light = spotLight;
        break;

      case 'directional':
        const dirLight = new THREE.DirectionalLight(color, intensity);
        dirLight.position.set(...position);
        if (target) {
          dirLight.target.position.set(...target);
        }
        light = dirLight;
        break;

      case 'point':
      default:
        light = new THREE.PointLight(
          color,
          intensity,
          0, // distance (0 = infinite)
          decay || 2, // Physically accurate decay
        );
        light.position.set(...position);
    }

    // Shadow configuration
    if (castShadow !== false && this.config.enableShadows) {
      light.castShadow = true;
      light.shadow.mapSize.width = this.config.shadowMapSize;
      light.shadow.mapSize.height = this.config.shadowMapSize;
      light.shadow.bias = -0.0001;
      light.shadow.radius = 2; // Soft shadow radius

      if (light instanceof THREE.DirectionalLight || light instanceof THREE.SpotLight) {
        light.shadow.camera.near = 0.1;
        light.shadow.camera.far = 100;

        if (light instanceof THREE.DirectionalLight) {
          light.shadow.camera.left = -10;
          light.shadow.camera.right = 10;
          light.shadow.camera.top = 10;
          light.shadow.camera.bottom = -10;
        }
      }
    }

    return light;
  }

  /**
   * Convert Kelvin color temperature to RGB
   */
  private kelvinToRGB(kelvin: number): THREE.Color {
    const temp = Math.max(1000, Math.min(40000, kelvin)) / 100;

    let r, g, b;

    // Red
    if (temp <= 66) {
      r = 255;
    } else {
      r = 329.698727446 * Math.pow(temp - 60, -0.1332047592);
      r = Math.max(0, Math.min(255, r));
    }

    // Green
    if (temp <= 66) {
      g = 99.4708025861 * Math.log(temp) - 161.1195681661;
    } else {
      g = 288.1221695283 * Math.pow(temp - 60, -0.0755148492);
    }
    g = Math.max(0, Math.min(255, g));

    // Blue
    if (temp >= 66) {
      b = 255;
    } else if (temp <= 19) {
      b = 0;
    } else {
      b = 138.5177312231 * Math.log(temp - 10) - 305.0447927307;
      b = Math.max(0, Math.min(255, b));
    }

    return new THREE.Color(r / 255, g / 255, b / 255);
  }

  /**
   * Render scene with post-processing
   */
  public render(scene: THREE.Scene, camera: THREE.Camera): void {
    // Render VSM shadow maps if enabled
    if (this.config.enableVSMShadows && this.vsmShadowSystem) {
      scene.traverse((object) => {
        if (object instanceof THREE.Light && object.castShadow) {
          const shadowCamera = (object as any).shadow?.camera;
          if (shadowCamera) {
            this.vsmShadowSystem!.renderShadowMap(object, scene, shadowCamera);
          }
        }
      });
    }

    // Update area light uniforms for PBR materials
    if (this.config.enablePBR && this.areaLights.length > 0) {
      this.updateAreaLightUniforms(scene);
    }

    // Update Global Illumination
    if (this.config.enableGI && this.giSystem) {
      this.giSystem.calculateBounces(this.areaLights, scene);
    }

    // Update passes
    this.renderPass.scene = scene;
    this.renderPass.camera = camera;

    if (this.bokehPass) {
      this.bokehPass.scene = scene;
      this.bokehPass.camera = camera;
    }

    // Render with composer
    this.composer.render();
  }

  /**
   * Update renderer size
   */
  public setSize(width: number, height: number): void {
    this.config.width = width;
    this.config.height = height;

    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);

    if (this.bloomPass) {
      this.bloomPass.resolution.set(width, height);
    }
  }

  /**
   * Get renderer statistics
   */
  public getStats() {
    return {
      memory: this.renderer.info.memory,
      render: this.renderer.info.render,
      programs: this.renderer.info.programs?.length || 0,
    };
  }

  /**
   * Toggle PBR rendering
   */
  public togglePBR(enabled: boolean): void {
    this.config.enablePBR = enabled;
    log.debug(`PBR rendering: ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Toggle Global Illumination
   */
  public toggleGI(enabled: boolean): void {
    this.config.enableGI = enabled;
    if (enabled && !this.giSystem) {
      this.giSystem = new GlobalIlluminationSystem({
        enabled: true,
        bounces: this.config.giBounces,
        intensity: this.config.giIntensity,
        resolution: 32,
        updateFrequency: 5,
      });
    }
    log.debug(`Global Illumination: ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Update GI settings
   */
  public updateGISettings(settings: { intensity?: number; bounces?: number }): void {
    if (settings.intensity !== undefined) {
      this.config.giIntensity = settings.intensity;
    }
    if (settings.bounces !== undefined) {
      this.config.giBounces = settings.bounces;
    }

    // Recreate GI system with new settings
    if (this.giSystem && this.config.enableGI) {
      this.giSystem = new GlobalIlluminationSystem({
        enabled: true,
        bounces: this.config.giBounces,
        intensity: this.config.giIntensity,
        resolution: 32,
        updateFrequency: 5,
      });
    }

    log.debug('GI settings updated:', settings);
  }

  /**
   * Toggle volumetric lighting
   */
  public toggleVolumetrics(enabled: boolean): void {
    this.config.enableVolumetrics = enabled;
    log.debug(`Volumetric lighting: ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Toggle soft shadows (PCSS)
   */
  public toggleSoftShadows(enabled: boolean): void {
    this.config.enableSoftShadows = enabled;
    log.debug(`Soft shadows: ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Toggle VSM shadows
   */
  public toggleVSMShadows(enabled: boolean): void {
    this.config.enableVSMShadows = enabled;
    if (enabled && !this.vsmShadowSystem) {
      this.vsmShadowSystem = new VSMShadowMapGenerator(this.renderer, {
        enabled: true,
        mapSize: this.config.shadowMapSize,
        blurRadius: 3.0,
        lightBleedingReduction: 0.1,
      });
      this.renderer.shadowMap.type = THREE.BasicShadowMap;
    } else if (!enabled && this.vsmShadowSystem) {
      this.vsmShadowSystem.dispose();
      this.vsmShadowSystem = null;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    log.debug(`VSM shadows: ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Toggle false color exposure visualization
   */
  public toggleFalseColor(enabled: boolean): void {
    this.config.enableFalseColor = enabled;
    if (enabled && !this.falseColorPass) {
      this.falseColorPass = new FalseColorPass();
      // Insert before output pass
      const outputIndex = this.composer.passes.length - 1;
      this.composer.passes.splice(outputIndex, 0, this.falseColorPass);
    } else if (!enabled && this.falseColorPass) {
      const index = this.composer.passes.indexOf(this.falseColorPass);
      if (index > -1) {
        this.composer.passes.splice(index, 1);
      }
      this.falseColorPass = null;
    }
    if (this.falseColorPass) {
      this.falseColorPass.setEnabled(enabled);
    }
    log.debug(`False color: ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Set false color opacity
   */
  public setFalseColorOpacity(opacity: number): void {
    if (this.falseColorPass) {
      this.falseColorPass.setOpacity(opacity);
    }
  }

  /**
   * Toggle luminance heatmap overlay
   */
  public toggleLuminanceHeatmap(enabled: boolean): void {
    this.config.enableLuminanceHeatmap = enabled;
    if (enabled && !this.luminanceHeatmapPass) {
      this.luminanceHeatmapPass = new LuminanceHeatmapPass();
      // Insert before output pass
      const outputIndex = this.composer.passes.length - 1;
      this.composer.passes.splice(outputIndex, 0, this.luminanceHeatmapPass);
    } else if (!enabled && this.luminanceHeatmapPass) {
      const index = this.composer.passes.indexOf(this.luminanceHeatmapPass);
      if (index > -1) {
        this.composer.passes.splice(index, 1);
      }
      this.luminanceHeatmapPass = null;
    }
    if (this.luminanceHeatmapPass) {
      this.luminanceHeatmapPass.setEnabled(enabled);
    }
    log.debug(`Luminance heatmap: ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Set luminance heatmap range
   */
  public setLuminanceHeatmapRange(min: number, max: number): void {
    if (this.luminanceHeatmapPass) {
      this.luminanceHeatmapPass.setLuminanceRange(min, max);
    }
  }

  /**
   * Set luminance heatmap opacity
   */
  public setLuminanceHeatmapOpacity(opacity: number): void {
    if (this.luminanceHeatmapPass) {
      this.luminanceHeatmapPass.setOpacity(opacity);
    }
  }

  /**
   * Get rendering statistics
   */
  public getRenderingStats() {
    return {
      ...this.getStats(),
      areaLights: this.areaLights.length,
      bounceSources: this.bounceSources.length,
      giEnabled: this.config.enableGI,
      pbrEnabled: this.config.enablePBR,
      volumetricsEnabled: this.config.enableVolumetrics,
      softShadowsEnabled: this.config.enableSoftShadows,
    };
  }

  /**
   * Dispose of all resources
   */
  public dispose(): void {
    // Clear GI system
    this.giSystem = null;

    // Clear area lights
    this.areaLights = [];

    // Dispose VSM shadow system
    if (this.vsmShadowSystem) {
      this.vsmShadowSystem.dispose();
      this.vsmShadowSystem = null;
    }

    this.composer.dispose();
    this.renderer.dispose();
    log.info('Enhanced Renderer disposed');
  }

  /**
   * Get native renderer (for advanced use)
   */
  public getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  // ============================================
  // LUT INTEGRATION
  // ============================================

  /**
   * Load and apply LUT
   */
  public async loadLUT(lutPath: string, options?: LUTIntegrationOptions): Promise<boolean> {
    try {
      log.debug(`Loading LUT ${lutPath}`);

      const lut = await integrationService.lut.loadLUT(lutPath);

      if (lut) {
        this.lutEnabled = true;
        this.lutOptions = { ...this.lutOptions, ...options };

        log.info(`LUT loaded: ${lut.title} (${lut.size}³)`, { gpu: this.lutOptions.useGPU });

        return true;
      }

      return false;
    } catch (error) {
      log.error('Failed to load LUT:', error);
      return false;
    }
  }

  /**
   * Clear current LUT
   */
  public clearLUT(): void {
    this.lutEnabled = false;
    integrationService.lut.clearLUT();
    log.debug('LUT cleared');
  }

  /**
   * Update LUT options
   */
  public updateLUTOptions(options: Partial<LUTIntegrationOptions>): void {
    this.lutOptions = { ...this.lutOptions, ...options };
    log.debug('LUT options updated:', this.lutOptions);
  }

  /**
   * Apply LUT to rendered frame
   */
  public applyLUTToCanvas(canvas: HTMLCanvasElement): boolean {
    if (!this.lutEnabled) return false;

    return integrationService.lut.applyLUTToCanvas(canvas, this.lutOptions);
  }

  /**
   * Capture frame with LUT applied
   */
  public captureFrame(options?: {
    width?: number;
    height?: number;
    applyLUT?: boolean;
  }): HTMLCanvasElement {
    const width = options?.width || this.config.width;
    const height = options?.height || this.config.height;

    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    // Copy renderer output
    ctx.drawImage(this.renderer.domElement, 0, 0, width, height);

    // Apply LUT if enabled
    if (options?.applyLUT !== false && this.lutEnabled) {
      this.applyLUTToCanvas(canvas);
    }

    return canvas;
  }

  /**
   * Capture frame as Blob
   */
  public async captureFrameAsBlob(options?: {
    width?: number;
    height?: number;
    applyLUT?: boolean;
    format?: 'image/png' | 'image/jpeg' | 'image/webp';
    quality?: number;
  }): Promise<Blob> {
    const canvas = this.captureFrame(options);

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to create blob'));
        },
        options?.format ||'image/png',
        options?.quality || 0.95,
      );
    });
  }

  /**
   * Get LUT status
   */
  public getLUTStatus() {
    const currentLUT = integrationService.lut.getCurrentLUT();

    return {
      enabled: this.lutEnabled,
      lut: currentLUT.lut
        ? {
            title: currentLUT.lut.title,
            size: currentLUT.lut.size,
            path: currentLUT.path,
          }
        : null,
      options: this.lutOptions,
      gpuAvailable: integrationService.lut.isGPUAvailable(),
      gpuInfo: integrationService.lut.getGPUInfo(),
    };
  }

  /**
   * Get composer (for adding custom passes)
   */
  public getComposer(): EffectComposer {
    return this.composer;
  }
}
