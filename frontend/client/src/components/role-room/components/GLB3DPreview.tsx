import { useEffect, useRef, memo, type FC } from 'react';
import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders/glTF';

export type LightingStyle = 'default' | 'lovecraft' | 'campfire' | 'studio';

export interface PersonalityTrait {
  id: string;
  name: string;
  breathingSpeed: number;
  swayAmount: number;
  color: string;
}

export const PERSONALITY_TRAITS: Record<string, PersonalityTrait> = {
  calm: { id: 'calm', name: 'Rolig', breathingSpeed: 0.3, swayAmount: 0.02, color: '#4a90d9' },
  energetic: { id: 'energetic', name: 'Energisk', breathingSpeed: 0.8, swayAmount: 0.05, color: '#ff6b35' },
  mysterious: { id: 'mysterious', name: 'Mystisk', breathingSpeed: 0.4, swayAmount: 0.03, color: '#8b5cf6' },
  wise: { id: 'wise', name: 'Vis', breathingSpeed: 0.25, swayAmount: 0.015, color: '#10b981' },
};

interface GLB3DPreviewProps {
  modelUrl: string;
  width?: number | string;
  height?: number | string;
  autoRotate?: boolean;
  backgroundColor?: string;
  lightingStyle?: LightingStyle;
  personality?: string;
  showAnimation?: boolean;
  onError?: () => void;
}

const GLB3DPreviewComponent: FC<GLB3DPreviewProps> = ({
  modelUrl,
  width = 200,
  height = 200,
  autoRotate = true,
  backgroundColor = 'transparent',
  lightingStyle = 'default',
  personality,
  showAnimation = true,
  onError,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<BABYLON.Engine | null>(null);
  const sceneRef = useRef<BABYLON.Scene | null>(null);
  const containerRef = useRef<BABYLON.TransformNode | null>(null);
  const timeRef = useRef<number>(0);

  useEffect(() => {
    if (!canvasRef.current || !modelUrl) return;

    const canvas = canvasRef.current;
    
    const isLovecraft = lightingStyle === 'lovecraft';
    const isCampfire = lightingStyle === 'campfire';
    
    const engine = new BABYLON.Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      alpha: !isLovecraft && backgroundColor === 'transparent',
    });
    engineRef.current = engine;

    const scene = new BABYLON.Scene(engine);
    sceneRef.current = scene;

    if (isLovecraft) {
      scene.clearColor = new BABYLON.Color4(0.02, 0.02, 0.05, 1);
      scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
      scene.fogColor = new BABYLON.Color3(0.05, 0.03, 0.08);
      scene.fogDensity = 0.15;
    } else if (isCampfire) {
      scene.clearColor = new BABYLON.Color4(0.05, 0.03, 0.02, 1);
      scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
      scene.fogColor = new BABYLON.Color3(0.1, 0.05, 0.02);
      scene.fogDensity = 0.1;
    } else if (backgroundColor === 'transparent') {
      scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);
    } else {
      const color = BABYLON.Color3.FromHexString(backgroundColor);
      scene.clearColor = new BABYLON.Color4(color.r, color.g, color.b, 1);
    }

    const camera = new BABYLON.ArcRotateCamera(
      'previewCamera',
      -Math.PI / 2,
      Math.PI / 3,
      5,
      BABYLON.Vector3.Zero(),
      scene
    );
    camera.lowerRadiusLimit = 1;
    camera.upperRadiusLimit = 20;
    camera.wheelPrecision = 50;
    camera.minZ = 0.01;

    if (isLovecraft) {
      const ambientLight = new BABYLON.HemisphericLight(
        'ambientLight',
        new BABYLON.Vector3(0, 1, 0),
        scene
      );
      ambientLight.intensity = 0.1;
      ambientLight.diffuse = new BABYLON.Color3(0.2, 0.15, 0.3);
      ambientLight.groundColor = new BABYLON.Color3(0.05, 0.02, 0.08);

      const rimLight = new BABYLON.PointLight(
        'rimLight',
        new BABYLON.Vector3(-3, 2, -2),
        scene
      );
      rimLight.intensity = 1.5;
      rimLight.diffuse = new BABYLON.Color3(0.6, 0.3, 0.1);

      const backLight = new BABYLON.PointLight(
        'backLight',
        new BABYLON.Vector3(2, 3, -3),
        scene
      );
      backLight.intensity = 0.8;
      backLight.diffuse = new BABYLON.Color3(0.3, 0.1, 0.4);

      const frontLight = new BABYLON.SpotLight(
        'frontLight',
        new BABYLON.Vector3(0, 2, 4),
        new BABYLON.Vector3(0, -0.3, -1),
        Math.PI / 4,
        2,
        scene
      );
      frontLight.intensity = 0.6;
      frontLight.diffuse = new BABYLON.Color3(0.8, 0.4, 0.2);

    } else if (isCampfire) {
      const ambientLight = new BABYLON.HemisphericLight(
        'ambientLight',
        new BABYLON.Vector3(0, 1, 0),
        scene
      );
      ambientLight.intensity = 0.15;
      ambientLight.diffuse = new BABYLON.Color3(0.3, 0.2, 0.1);

      const fireLight = new BABYLON.PointLight(
        'fireLight',
        new BABYLON.Vector3(0, 0.5, 2),
        scene
      );
      fireLight.intensity = 2.0;
      fireLight.diffuse = new BABYLON.Color3(1.0, 0.5, 0.1);

      const fillLight = new BABYLON.PointLight(
        'fillLight',
        new BABYLON.Vector3(2, 1, 0),
        scene
      );
      fillLight.intensity = 0.3;
      fillLight.diffuse = new BABYLON.Color3(0.8, 0.4, 0.2);

    } else {
      const light1 = new BABYLON.HemisphericLight(
        'hemiLight',
        new BABYLON.Vector3(0, 1, 0),
        scene
      );
      light1.intensity = 1.0;

      const light2 = new BABYLON.DirectionalLight(
        'dirLight',
        new BABYLON.Vector3(-1, -2, -1),
        scene
      );
      light2.intensity = 0.5;
    }

    BABYLON.SceneLoader.ImportMeshAsync('', '', modelUrl, scene)
      .then((result) => {
        if (result.meshes.length > 0) {
          const rootMesh = result.meshes[0];
          
          const containerNode = new BABYLON.TransformNode('glb-container', scene);
          containerRef.current = containerNode;
          rootMesh.parent = containerNode;
          
          result.meshes.forEach(mesh => mesh.computeWorldMatrix(true));
          
          let minBounds = new BABYLON.Vector3(Infinity, Infinity, Infinity);
          let maxBounds = new BABYLON.Vector3(-Infinity, -Infinity, -Infinity);

          result.meshes.forEach((mesh) => {
            if (mesh.getBoundingInfo) {
              const bounds = mesh.getBoundingInfo().boundingBox;
              minBounds = BABYLON.Vector3.Minimize(minBounds, bounds.minimumWorld);
              maxBounds = BABYLON.Vector3.Maximize(maxBounds, bounds.maximumWorld);
            }
          });

          const center = minBounds.add(maxBounds).scale(0.5);
          const size = maxBounds.subtract(minBounds);
          const maxDim = Math.max(size.x, size.y, size.z);
          
          const isUpsideDown = maxBounds.y < 0 || (center.y < 0 && Math.abs(minBounds.y) > Math.abs(maxBounds.y));
          
          if (isUpsideDown) {
            containerNode.rotation.x = Math.PI;
            containerNode.position.y = size.y;
            result.meshes.forEach(mesh => mesh.computeWorldMatrix(true));
            
            minBounds = new BABYLON.Vector3(Infinity, Infinity, Infinity);
            maxBounds = new BABYLON.Vector3(-Infinity, -Infinity, -Infinity);
            result.meshes.forEach((mesh) => {
              if (mesh.getBoundingInfo) {
                const bounds = mesh.getBoundingInfo().boundingBox;
                minBounds = BABYLON.Vector3.Minimize(minBounds, bounds.minimumWorld);
                maxBounds = BABYLON.Vector3.Maximize(maxBounds, bounds.maximumWorld);
              }
            });
          }
          
          const finalCenter = minBounds.add(maxBounds).scale(0.5);

          camera.target = finalCenter;
          camera.radius = maxDim * 2;
          camera.alpha = -Math.PI / 4;
          camera.beta = Math.PI / 3;
        }
      })
      .catch((error) => {
        console.error('Error loading GLB model:', error);
        onError?.();
      });

    const trait = personality ? PERSONALITY_TRAITS[personality] : null;

    scene.registerBeforeRender(() => {
      timeRef.current += engine.getDeltaTime() / 1000;
      
      if (autoRotate) {
        camera.alpha += 0.005;
      }
      
      if (showAnimation && containerRef.current && trait) {
        const breathe = Math.sin(timeRef.current * trait.breathingSpeed * Math.PI * 2) * 0.01;
        const sway = Math.sin(timeRef.current * 0.5) * trait.swayAmount;
        
        containerRef.current.scaling.y = 1 + breathe;
        containerRef.current.rotation.z = sway;
      }
      
      if ((isLovecraft || isCampfire) && scene.lights) {
        const flicker = 0.9 + Math.random() * 0.2;
        scene.lights.forEach(light => {
          if (light.name === 'fireLight' || light.name === 'rimLight') {
            light.intensity = (light.name === 'fireLight' ? 2.0 : 1.5) * flicker;
          }
        });
      }
    });

    engine.runRenderLoop(() => {
      scene.render();
    });

    const handleResize = () => {
      engine.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      scene.dispose();
      engine.dispose();
    };
  }, [modelUrl, autoRotate, backgroundColor, lightingStyle, personality, showAnimation, onError]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        display: 'block',
        touchAction: 'none',
        borderRadius: '8px',
      }}
    />
  );
};

export const GLB3DPreview = memo(GLB3DPreviewComponent);
export default GLB3DPreview;
