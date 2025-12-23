/**
 * Screen-Space Ambient Occlusion (SSAO) Pass
 * 
 * Implements physically accurate SSAO for real-time global illumination.
 * 
 * References:
 * - Mittring, M. (2007). "Finding Next Gen: CryEngine 2" (SIGGRAPH)
 * - Bavoil, L. et al. (2008). "Image-Space Horizon-Based Ambient Occlusion"
 * -"Real-Time Rendering" Chapter 11: Global Illumination
 * - Three.js SSAOPass implementation
 */

import { Pass } from 'three/examples/jsm/postprocessing/Pass';
import * as THREE from'three';

export interface SSAOPassOptions {
  kernelSize?: number; // Number of samples (default: 32)
  kernelRadius?: number; // Sample radius in world units (default: 0.5)
  minDistance?: number; // Minimum occlusion distance (default: 0.005)
  maxDistance?: number; // Maximum occlusion distance (default: 0.1)
  intensity?: number; // AO intensity multiplier (default: 1.0)
  bias?: number; // Depth bias to prevent self-occlusion (default: 0.01)
}

export class SSAOPass extends Pass {
  private ssaoMaterial: THREE.ShaderMaterial;
  private blurMaterial: THREE.ShaderMaterial;
  private ssaoRenderTarget: THREE.WebGLRenderTarget;
  private blurRenderTarget: THREE.WebGLRenderTarget;
  private normalRenderTarget: THREE.WebGLRenderTarget;
  private depthRenderTarget: THREE.WebGLRenderTarget;
  private kernelSize: number;
  private kernelRadius: number;
  private kernel: THREE.Vector3[];
  private noiseTexture: THREE.DataTexture;

  constructor(
    scene: THREE.Scene,
    camera: THREE.Camera,
    width: number,
    height: number,
    options: SSAOPassOptions = {}
  ) {
    super();

    this.kernelSize = options.kernelSize || 32;
    this.kernelRadius = options.kernelRadius || 0.5;

    // Generate sample kernel
    this.kernel = this.generateKernel(this.kernelSize);

    // Generate noise texture
    this.noiseTexture = this.generateNoiseTexture();

    // Create render targets
    this.ssaoRenderTarget = new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
    });

    this.blurRenderTarget = new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
    });

    this.normalRenderTarget = new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
    });

    this.depthRenderTarget = new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
    });

    // Create SSAO shader material
    this.ssaoMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        tNormal: { value: this.normalRenderTarget.texture },
        tDepth: { value: this.depthRenderTarget.texture },
        tNoise: { value: this.noiseTexture },
        kernel: { value: this.kernel },
        kernelRadius: { value: this.kernelRadius },
        minDistance: { value: options.minDistance || 0.005 },
        maxDistance: { value: options.maxDistance || 0.1 },
        intensity: { value: options.intensity || 1.0 },
        bias: { value: options.bias || 0.01 },
        cameraNear: { value: (camera as THREE.PerspectiveCamera).near },
        cameraFar: { value: (camera as THREE.PerspectiveCamera).far },
        resolution: { value: new THREE.Vector2(width, height) },
        cameraProjectionMatrix: { value: camera.projectionMatrix },
        cameraInverseProjectionMatrix: { value: camera.projectionMatrix.clone().invert() },
      },
      vertexShader: this.getVertexShader(),
      fragmentShader: this.getFragmentShader(),
    });

    // Create blur shader material
    this.blurMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        resolution: { value: new THREE.Vector2(width, height) },
      },
      vertexShader: this.getVertexShader(),
      fragmentShader: this.getBlurFragmentShader(),
    });
  }

  /**
   * Generate sample kernel for SSAO
   * 
   * Creates hemisphere-distributed samples with bias toward center.
   * Reference: Mittring (2007)
   */
  private generateKernel(size: number): THREE.Vector3[] {
    const kernel: THREE.Vector3[] = [];

    for (let i = 0; i < size; i++) {
      const sample = new THREE.Vector3(
        Math.random() * 2.0 - 1.0,
        Math.random() * 2.0 - 1.0,
        Math.random()
      );

      sample.normalize();

      // Scale samples (more samples closer to origin)
      let scale = i / size;
      scale = THREE.MathUtils.lerp(0.1, 1.0, scale * scale);
      sample.multiplyScalar(scale);

      kernel.push(sample);
    }

    return kernel;
  }

  /**
   * Generate noise texture for sample rotation
   * 
   * 4x4 noise texture to randomize sample kernel rotation.
   * Reference: Bavoil et al. (2008)
   */
  private generateNoiseTexture(): THREE.DataTexture {
    const size = 4;
    const data = new Float32Array(size * size * 4);

    for (let i = 0; i < size * size; i++) {
      const stride = i * 4;
      data[stride] = Math.random() * 2.0 - 1.0;
      data[stride + 1] = Math.random() * 2.0 - 1.0;
      data[stride + 2] = 0.0;
      data[stride + 3] = 1.0;
    }

    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.FloatType);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.needsUpdate = true;

    return texture;
  }

  private getVertexShader(): string {
    return `
      varying vec2 vUv;
      
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
  }

  private getFragmentShader(): string {
    return `
      uniform sampler2D tDiffuse;
      uniform sampler2D tNormal;
      uniform sampler2D tDepth;
      uniform sampler2D tNoise;
      uniform vec3 kernel[${this.kernelSize}];
      uniform float kernelRadius;
      uniform float minDistance;
      uniform float maxDistance;
      uniform float intensity;
      uniform float bias;
      uniform float cameraNear;
      uniform float cameraFar;
      uniform vec2 resolution;
      uniform mat4 cameraProjectionMatrix;
      uniform mat4 cameraInverseProjectionMatrix;

      varying vec2 vUv;

      // Linearize depth
      float getLinearDepth(float depth) {
        float z = depth * 2.0 - 1.0;
        return (2.0 * cameraNear * cameraFar) / (cameraFar + cameraNear - z * (cameraFar - cameraNear));
      }

      // Reconstruct view-space position from depth
      vec3 getViewPosition(vec2 uv, float depth) {
        float z = depth * 2.0 - 1.0;
        vec4 clipSpacePosition = vec4(uv * 2.0 - 1.0, z, 1.0);
        vec4 viewSpacePosition = cameraInverseProjectionMatrix * clipSpacePosition;
        return viewSpacePosition.xyz / viewSpacePosition.w;
      }

      void main() {
        // Sample depth and normal
        float depth = texture2D(tDepth, vUv).r;
        vec3 normal = normalize(texture2D(tNormal, vUv).xyz * 2.0 - 1.0);
        vec3 viewPos = getViewPosition(vUv, depth);

        // Sample noise for kernel rotation
        vec2 noiseScale = resolution / 4.0;
        vec3 randomVec = normalize(texture2D(tNoise, vUv * noiseScale).xyz * 2.0 - 1.0);

        // Create TBN matrix for kernel rotation
        vec3 tangent = normalize(randomVec - normal * dot(randomVec, normal));
        vec3 bitangent = cross(normal, tangent);
        mat3 TBN = mat3(tangent, bitangent, normal);

        // Sample kernel
        float occlusion = 0.0;
        for (int i = 0; i < ${this.kernelSize}; i++) {
          // Get sample position
          vec3 samplePos = TBN * kernel[i];
          samplePos = viewPos + samplePos * kernelRadius;

          // Project sample position to screen space
          vec4 offset = vec4(samplePos, 1.0);
          offset = cameraProjectionMatrix * offset;
          offset.xyz /= offset.w;
          offset.xyz = offset.xyz * 0.5 + 0.5;

          // Sample depth at offset position
          float sampleDepth = texture2D(tDepth, offset.xy).r;
          vec3 sampleViewPos = getViewPosition(offset.xy, sampleDepth);

          // Range check
          float rangeCheck = smoothstep(0.0, 1.0, kernelRadius / abs(viewPos.z - sampleViewPos.z));

          // Accumulate occlusion
          float occluded = (sampleViewPos.z >= samplePos.z + bias) ? 1.0 : 0.0;
          occlusion += occluded * rangeCheck;
        }

        // Normalize and invert
        occlusion = 1.0 - (occlusion / float(${this.kernelSize}));
        occlusion = pow(occlusion, intensity);

        gl_FragColor = vec4(vec3(occlusion), 1.0);
      }
    `;
  }

  private getBlurFragmentShader(): string {
    return `
      uniform sampler2D tDiffuse;
      uniform vec2 resolution;

      varying vec2 vUv;

      void main() {
        vec2 texelSize = 1.0 / resolution;
        float result = 0.0;

        // 4x4 bilateral blur
        for (int x = -2; x <= 2; x++) {
          for (int y = -2; y <= 2; y++) {
            vec2 offset = vec2(float(x), float(y)) * texelSize;
            result += texture2D(tDiffuse, vUv + offset).r;
          }
        }

        result /= 25.0; // 5x5 kernel

        gl_FragColor = vec4(vec3(result), 1.0);
      }
    `;
  }

  render(
    renderer: THREE.WebGLRenderer,
    writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget
  ): void {
    // Render SSAO
    this.ssaoMaterial.uniforms.tDiffuse.value = readBuffer.texture;
    renderer.setRenderTarget(this.ssaoRenderTarget);
    renderer.render(this.createQuadScene(this.ssaoMaterial), this.createQuadCamera());

    // Blur SSAO
    this.blurMaterial.uniforms.tDiffuse.value = this.ssaoRenderTarget.texture;
    renderer.setRenderTarget(this.blurRenderTarget);
    renderer.render(this.createQuadScene(this.blurMaterial), this.createQuadCamera());

    // Composite with original
    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
    } else {
      renderer.setRenderTarget(writeBuffer);
    }

    // Simple multiply blend
    const compositeMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: readBuffer.texture },
        tAO: { value: this.blurRenderTarget.texture },
      },
      vertexShader: this.getVertexShader(),
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform sampler2D tAO;
        varying vec2 vUv;

        void main() {
          vec4 color = texture2D(tDiffuse, vUv);
          float ao = texture2D(tAO, vUv).r;
          gl_FragColor = vec4(color.rgb * ao, color.a);
        }
      `,
    });

    renderer.render(this.createQuadScene(compositeMaterial), this.createQuadCamera());
    compositeMaterial.dispose();
  }

  private createQuadScene(material: THREE.ShaderMaterial): THREE.Scene {
    const scene = new THREE.Scene();
    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    return scene;
  }

  private createQuadCamera(): THREE.OrthographicCamera {
    return new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  setSize(width: number, height: number): void {
    this.ssaoRenderTarget.setSize(width, height);
    this.blurRenderTarget.setSize(width, height);
    this.normalRenderTarget.setSize(width, height);
    this.depthRenderTarget.setSize(width, height);

    this.ssaoMaterial.uniforms.resolution.value.set(width, height);
    this.blurMaterial.uniforms.resolution.value.set(width, height);
  }

  dispose(): void {
    this.ssaoRenderTarget.dispose();
    this.blurRenderTarget.dispose();
    this.normalRenderTarget.dispose();
    this.depthRenderTarget.dispose();
    this.ssaoMaterial.dispose();
    this.blurMaterial.dispose();
    this.noiseTexture.dispose();
  }
}

