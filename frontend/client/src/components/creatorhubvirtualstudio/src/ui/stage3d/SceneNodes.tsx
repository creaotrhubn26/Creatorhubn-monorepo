import React, { useMemo, useRef, Suspense, useEffect, useState } from 'react';
import * as THREE from 'three';
import { useLoader, useThree } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { useAppStore } from '../../state/store';
import { SceneNode } from '../../core/models/scene';

// Lazy load mesh components
const ClothingMesh = React.lazy(() => import('../../ui/components/ClothingMesh').then(m => ({ default: m.ClothingMesh })));
const HairMesh = React.lazy(() => import('../../ui/components/HairMesh').then(m => ({ default: m.HairMesh })));
const BackdropMeshFull = React.lazy(() => import('../../ui/components/BackdropMesh').then(m => ({ default: m.BackdropMesh })));

/**
 * SceneNodes Component - Renders model, backdrop, prop, clothing, and hair nodes
 * 
 * Renders:
 * - Model nodes (actors, people)
 * - Backdrop nodes (seamless, cyclorama)
 * - Prop nodes (furniture, accessories)
 * - Clothing nodes (attached to actors)
 * - Hair nodes (attached to actors)
 */

interface NodeMeshProps {
  node: SceneNode;
  selected: boolean;
  onSelect?: (id: string) => void;
}

// Model node (actor/person placeholder)
function ModelMesh({ node, selected, onSelect }: NodeMeshProps) {
  const transform = node.transform;
  const position = transform.position as [number, number, number];
  const rotation = transform.rotation as [number, number, number];
  const scale = transform.scale as [number, number, number];

  const handleClick = (e: THREE.Event) => {
    e.stopPropagation();
    onSelect?.(node.id);
  };

  // Check if there's a custom model URL (check both locations for compatibility)
  const modelUrl = node.userData?.modelUrl || node.model?.url;

  // #region agent log
  React.useEffect(() => {
    fetch('http://127.0.0.1:7242/ingest/0bda4408-a4ac-499d-af8d-1291b9fac2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SceneNodes.tsx:38',message:'ModelMesh render check',data:{nodeId:node.id,nodeType:node.type,hasUserDataModelUrl:!!node.userData?.modelUrl,hasModelUrl:!!node.model?.url,modelUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  }, [node.id, modelUrl]);
  // #endregion

  if (modelUrl) {
    return (
      <group position={position} rotation={rotation} scale={scale}>
        <Suspense fallback={<ModelPlaceholder selected={selected} onClick={handleClick} />}>
          <LoadedGLTFModel url={modelUrl} selected={selected} onClick={handleClick} />
        </Suspense>
      </group>
    );
  }

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <ModelPlaceholder selected={selected} onClick={handleClick} />
    </group>
  );
}

// GLTF Model Loader Component
function LoadedGLTFModel({ url, selected, onClick }: { url: string; selected: boolean; onClick: (e: THREE.Event) => void }) {
  const [model, setModel] = useState<THREE.Group | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0bda4408-a4ac-499d-af8d-1291b9fac2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SceneNodes.tsx:60',message:'Loading GLTF model',data:{url,selected},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    const loader = new GLTFLoader();
    loader.load(
      url,
      (gltf) => {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0bda4408-a4ac-499d-af8d-1291b9fac2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SceneNodes.tsx:67',message:'GLTF model loaded successfully',data:{url,sceneChildren:gltf.scene.children.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        const scene = gltf.scene.clone();
        scene.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        setModel(scene);
      },
      (progress) => {
        // #region agent log
        if (progress.total > 0) {
          fetch('http://127.0.0.1:7242/ingest/0bda4408-a4ac-499d-af8d-1291b9fac2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SceneNodes.tsx:78',message:'GLTF loading progress',data:{url,loaded:progress.loaded,total:progress.total,percent:Math.round((progress.loaded/progress.total)*100)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        }
        // #endregion
      },
      (err) => {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0bda4408-a4ac-499d-af8d-1291b9fac2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SceneNodes.tsx:85',message:'GLTF load error',data:{url,error:err?.message||String(err)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        setError(true);
      }
    );
  }, [url]);

  if (error) {
    return <ModelPlaceholder selected={selected} onClick={onClick} />;
  }

  if (!model) {
    return <ModelPlaceholder selected={selected} onClick={onClick} />;
  }

  return (
    <group onClick={onClick}>
      <primitive object={model} />
      {selected && (
        <mesh>
          <boxGeometry args={[0.5, 1.9, 0.3]} />
          <meshBasicMaterial color="#4fc3f7" wireframe />
        </mesh>
      )}
    </group>
  );
}

// Realistic human-shaped placeholder with anatomical proportions
function ModelPlaceholder({ selected, onClick }: { selected: boolean; onClick: (e: THREE.Event) => void }) {
  const skinColor = selected ? '#4fc3f7' : '#f4c2a0';
  const clothingColor = selected ? '#4fc3f7' : '#5a5a5a';
  const hairColor = selected ? '#4fc3f7' : '#3d2314';
  
  // Proportions based on average adult (8 heads tall = 1.7m)
  const height = 1.7;
  const headHeight = height / 8; // ~0.21

  return (
    <group onClick={onClick}>
      {/* Head - sphere for natural shape */}
      <mesh position={[0, 1.6, 0]} castShadow>
        <sphereGeometry args={[headHeight * 0.5, 24, 18]} />
        <meshStandardMaterial color={skinColor} roughness={0.6} />
      </mesh>

      {/* Hair (simple cap) */}
      <mesh position={[0, 1.68, -0.02]} castShadow>
        <sphereGeometry args={[headHeight * 0.52, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
        <meshStandardMaterial color={hairColor} roughness={0.9} />
      </mesh>

      {/* Neck - tapered cylinder */}
      <mesh position={[0, 1.45, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.05, 0.08, 12]} />
        <meshStandardMaterial color={skinColor} roughness={0.6} />
      </mesh>

      {/* Torso - shoulders wider than waist */}
      <mesh position={[0, 1.22, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.12, 0.38, 16]} />
        <meshStandardMaterial color={clothingColor} roughness={0.7} />
      </mesh>

      {/* Shoulder caps */}
      <mesh position={[-0.18, 1.35, 0]} castShadow>
        <sphereGeometry args={[0.06, 12, 8]} />
        <meshStandardMaterial color={clothingColor} roughness={0.7} />
      </mesh>
      <mesh position={[0.18, 1.35, 0]} castShadow>
        <sphereGeometry args={[0.06, 12, 8]} />
        <meshStandardMaterial color={clothingColor} roughness={0.7} />
      </mesh>

      {/* Hips/Pelvis - slightly wider */}
      <mesh position={[0, 0.92, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.14, 0.2, 16]} />
        <meshStandardMaterial color={clothingColor} roughness={0.7} />
      </mesh>

      {/* Left upper leg */}
      <mesh position={[-0.08, 0.7, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.05, 0.35, 12]} />
        <meshStandardMaterial color={clothingColor} roughness={0.7} />
      </mesh>

      {/* Left lower leg */}
      <mesh position={[-0.08, 0.38, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.04, 0.3, 12]} />
        <meshStandardMaterial color={clothingColor} roughness={0.7} />
      </mesh>

      {/* Left knee */}
      <mesh position={[-0.08, 0.52, 0]} castShadow>
        <sphereGeometry args={[0.055, 8, 8]} />
        <meshStandardMaterial color={clothingColor} roughness={0.7} />
      </mesh>

      {/* Left foot */}
      <mesh position={[-0.08, 0.13, 0.03]} castShadow>
        <boxGeometry args={[0.07, 0.08, 0.15]} />
        <meshStandardMaterial color={clothingColor} roughness={0.8} />
      </mesh>

      {/* Right upper leg */}
      <mesh position={[0.08, 0.7, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.05, 0.35, 12]} />
        <meshStandardMaterial color={clothingColor} roughness={0.7} />
      </mesh>

      {/* Right lower leg */}
      <mesh position={[0.08, 0.38, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.04, 0.3, 12]} />
        <meshStandardMaterial color={clothingColor} roughness={0.7} />
      </mesh>

      {/* Right knee */}
      <mesh position={[0.08, 0.52, 0]} castShadow>
        <sphereGeometry args={[0.055, 8, 8]} />
        <meshStandardMaterial color={clothingColor} roughness={0.7} />
      </mesh>

      {/* Right foot */}
      <mesh position={[0.08, 0.13, 0.03]} castShadow>
        <boxGeometry args={[0.07, 0.08, 0.15]} />
        <meshStandardMaterial color={clothingColor} roughness={0.8} />
      </mesh>

      {/* Left upper arm */}
      <mesh position={[-0.24, 1.22, 0]} rotation={[0, 0, 0.15]} castShadow>
        <cylinderGeometry args={[0.04, 0.035, 0.22, 10]} />
        <meshStandardMaterial color={skinColor} roughness={0.6} />
      </mesh>

      {/* Left elbow */}
      <mesh position={[-0.27, 1.08, 0]} castShadow>
        <sphereGeometry args={[0.038, 8, 8]} />
        <meshStandardMaterial color={skinColor} roughness={0.6} />
      </mesh>

      {/* Left forearm */}
      <mesh position={[-0.28, 0.93, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.03, 0.2, 10]} />
        <meshStandardMaterial color={skinColor} roughness={0.6} />
      </mesh>

      {/* Left hand */}
      <mesh position={[-0.28, 0.78, 0]} castShadow>
        <boxGeometry args={[0.05, 0.08, 0.025]} />
        <meshStandardMaterial color={skinColor} roughness={0.6} />
      </mesh>

      {/* Right upper arm */}
      <mesh position={[0.24, 1.22, 0]} rotation={[0, 0, -0.15]} castShadow>
        <cylinderGeometry args={[0.04, 0.035, 0.22, 10]} />
        <meshStandardMaterial color={skinColor} roughness={0.6} />
      </mesh>

      {/* Right elbow */}
      <mesh position={[0.27, 1.08, 0]} castShadow>
        <sphereGeometry args={[0.038, 8, 8]} />
        <meshStandardMaterial color={skinColor} roughness={0.6} />
      </mesh>

      {/* Right forearm */}
      <mesh position={[0.28, 0.93, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.03, 0.2, 10]} />
        <meshStandardMaterial color={skinColor} roughness={0.6} />
      </mesh>

      {/* Right hand */}
      <mesh position={[0.28, 0.78, 0]} castShadow>
        <boxGeometry args={[0.05, 0.08, 0.025]} />
        <meshStandardMaterial color={skinColor} roughness={0.6} />
      </mesh>

      {/* Selection highlight */}
      {selected && (
        <mesh position={[0, 0.95, 0]}>
          <boxGeometry args={[0.5, 1.9, 0.3]} />
          <meshBasicMaterial color="#4fc3f7" wireframe />
        </mesh>
      )}
    </group>
  );
}

// Backdrop node
function BackdropMesh({ node, selected, onSelect }: NodeMeshProps) {
  const transform = node.transform;
  const position = transform.position as [number, number, number];
  const rotation = transform.rotation as [number, number, number];
  const scale = transform.scale as [number, number, number];

  const color = node.userData?.color || '#ffffff';
  const backdropType = node.userData?.backdropType || 'seamless';

  const handleClick = (e: THREE.Event) => {
    e.stopPropagation();
    onSelect?.(node.id);
  };

  if (backdropType === 'cyclorama') {
    // Curved cyclorama
    return (
      <group position={position} rotation={rotation} scale={scale}>
        {/* Back wall */}
        <mesh position={[0, 1.5, -2]} onClick={handleClick}>
          <planeGeometry args={[6, 3]} />
          <meshStandardMaterial color={color} side={THREE.DoubleSide} />
        </mesh>

        {/* Curved corner */}
        <mesh position={[0, 0, -1.5]} rotation={[-Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.5, 0.5, 6, 32, 1, true, Math.PI, Math.PI / 2]} />
          <meshStandardMaterial color={color} side={THREE.DoubleSide} />
        </mesh>

        {/* Floor */}
        <mesh position={[0, 0, 0.5]} rotation={[-Math.PI / 2, 0, 0]} onClick={handleClick}>
          <planeGeometry args={[6, 4]} />
          <meshStandardMaterial color={color} side={THREE.DoubleSide} />
        </mesh>

        {selected && (
          <lineSegments>
            <edgesGeometry args={[new THREE.BoxGeometry(6.1, 3.1, 4.1)]} />
            <lineBasicMaterial color="#4fc3f7" />
          </lineSegments>
        )}
      </group>
    );
  }

  // Seamless paper backdrop
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* Back panel */}
      <mesh position={[0, 1.5, 0]} onClick={handleClick}>
        <planeGeometry args={[4, 3]} />
        <meshStandardMaterial color={color} side={THREE.DoubleSide} />
      </mesh>

      {/* Floor sweep */}
      <mesh position={[0, 0, 1]} rotation={[-Math.PI / 2, 0, 0]} onClick={handleClick}>
        <planeGeometry args={[4, 2]} />
        <meshStandardMaterial color={color} side={THREE.DoubleSide} />
      </mesh>

      {selected && (
        <mesh position={[0, 0.75, 0.5]}>
          <boxGeometry args={[4.1, 3.1, 2.1]} />
          <meshBasicMaterial color="#4fc3f7" wireframe />
        </mesh>
      )}
    </group>
  );
}

// Prop node
function PropMesh({ node, selected, onSelect }: NodeMeshProps) {
  const transform = node.transform;
  const position = transform.position as [number, number, number];
  const rotation = transform.rotation as [number, number, number];
  const scale = transform.scale as [number, number, number];

  const propType = node.userData?.propType || 'cube';
  const color = node.userData?.color || '#888888';

  const handleClick = (e: THREE.Event) => {
    e.stopPropagation();
    onSelect?.(node.id);
  };

  const renderProp = () => {
    switch (propType) {
      case 'chair':
        return (
          <group>
            {/* Seat */}
            <mesh position={[0, 0.45, 0]}>
              <boxGeometry args={[0.45, 0.05, 0.45]} />
              <meshStandardMaterial color={color} />
            </mesh>
            {/* Back */}
            <mesh position={[0, 0.75, -0.2]}>
              <boxGeometry args={[0.45, 0.6, 0.05]} />
              <meshStandardMaterial color={color} />
            </mesh>
            {/* Legs */}
            {[[-0.18, 0.22, 0.18], [0.18, 0.22, 0.18], [-0.18, 0.22, -0.18], [0.18, 0.22, -0.18]].map((pos, i) => (
              <mesh key={i} position={pos as [number, number, number]}>
                <cylinderGeometry args={[0.02, 0.02, 0.45]} />
                <meshStandardMaterial color="#333" />
              </mesh>
            ))}
          </group>
        );

      case 'table':
        return (
          <group>
            {/* Top */}
            <mesh position={[0, 0.75, 0]}>
              <boxGeometry args={[1.2, 0.05, 0.8]} />
              <meshStandardMaterial color={color} />
            </mesh>
            {/* Legs */}
            {[[-0.5, 0.36, 0.3], [0.5, 0.36, 0.3], [-0.5, 0.36, -0.3], [0.5, 0.36, -0.3]].map((pos, i) => (
              <mesh key={i} position={pos as [number, number, number]}>
                <cylinderGeometry args={[0.03, 0.03, 0.72]} />
                <meshStandardMaterial color="#333" />
              </mesh>
            ))}
          </group>
        );

      case 'stool':
        return (
          <group>
            {/* Seat */}
            <mesh position={[0, 0.6, 0]}>
              <cylinderGeometry args={[0.18, 0.18, 0.05, 16]} />
              <meshStandardMaterial color={color} />
            </mesh>
            {/* Legs */}
            {[[0.12, 0.3, 0.12], [-0.12, 0.3, 0.12], [-0.12, 0.3, -0.12], [0.12, 0.3, -0.12]].map((pos, i) => (
              <mesh key={i} position={pos as [number, number, number]}>
                <cylinderGeometry args={[0.015, 0.02, 0.6]} />
                <meshStandardMaterial color="#333" />
              </mesh>
            ))}
          </group>
        );

      case 'box':
      default:
        return (
          <mesh>
            <boxGeometry args={[0.5, 0.5, 0.5]} />
            <meshStandardMaterial color={color} />
          </mesh>
        );
    }
  };

  return (
    <group position={position} rotation={rotation} scale={scale} onClick={handleClick}>
      {renderProp()}
      {selected && (
        <mesh>
          <boxGeometry args={[0.6, 0.6, 0.6]} />
          <meshBasicMaterial color="#4fc3f7" wireframe />
        </mesh>
      )}
    </group>
  );
}

// Main SceneNodes component
export default function SceneNodes() {
  const scene = useAppStore((state) => state.scene);
  const selection = scene.selection;
  const { scene: threeScene } = useThree(); // Get THREE.Scene from React Three Fiber

  // Filter non-light, non-camera nodes
  const sceneNodes = useMemo(() => {
    // #region agent log
    const filtered = scene.nodes.filter(
      (node) =>
        node.visible &&
        ['model','backdrop','prop','clothing','hair'].includes(node.type)
    );
    fetch('http://127.0.0.1:7242/ingest/0bda4408-a4ac-499d-af8d-1291b9fac2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SceneNodes.tsx:464',message:'SceneNodes filter check',data:{totalNodes:scene.nodes.length,filteredCount:filtered.length,nodeTypes:filtered.map(n=>n.type)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    return filtered;
    // #endregion
  }, [scene.nodes]);

  const handleSelect = (id: string) => {
    useAppStore.getState().select([id]);
  };

  // Context menu for objects
  const { anchorEl, items, handleContextMenu, handleClose } = useContextMenu();

  const handleRightClick = (e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const node = sceneNodes.find(n => n.id === nodeId);
    if (!node) return;

    const menuItems = [
      {
        id: 'delete',
        label: 'Delete',
        icon: <span>🗑️</span>,
        onClick: () => {
          useAppStore.getState().actions.deleteNode(nodeId);
          handleClose();
        },
      },
      {
        id: 'duplicate',
        label: 'Duplicate',
        icon: <span>📋</span>,
        onClick: () => {
          // Duplicate logic
          handleClose();
        },
      },
      {
        id: 'rename',
        label: 'Rename',
        icon: <span>✏️</span>,
        onClick: () => {
          // Rename logic
          handleClose();
        },
      },
      {
        id: 'properties',
        label: 'Properties',
        icon: <span>⚙️</span>,
        onClick: () => {
          useAppStore.getState().select([nodeId]);
          handleClose();
        },
      },
    ];

    handleContextMenu(e as any, menuItems);
  };

  if (sceneNodes.length === 0) {
    return null;
  }

  return (
    <group name="scene-nodes">
      {sceneNodes.map((node) => {
        const isSelected = selection.includes(node.id);

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0bda4408-a4ac-499d-af8d-1291b9fac2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SceneNodes.tsx:481',message:'Rendering node',data:{nodeId:node.id,nodeType:node.type,isSelected},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion

        switch (node.type) {
          case 'model':
            return (
              <ModelMesh
                key={node.id}
                node={node}
                selected={isSelected}
                onSelect={handleSelect}
              />
            );
          case 'backdrop':
            // Use full BackdropMesh implementation that needs THREE.Scene
            return (
              <Suspense key={node.id} fallback={null}>
                <BackdropMeshFull
                  node={node}
                  scene={threeScene}
                />
              </Suspense>
            );
          case 'prop':
            return (
              <PropMesh
                key={node.id}
                node={node}
                selected={isSelected}
                onSelect={handleSelect}
              />
            );
          case 'clothing':
            // Find parent actor node if specified
            const clothingActorId = node.userData?.parentActorId;
            const clothingActorNode = clothingActorId 
              ? scene.nodes.find(n => n.id === clothingActorId)
              : undefined;
            return (
              <Suspense key={node.id} fallback={null}>
                <ClothingMesh
                  node={node}
                  actorNode={clothingActorNode}
                />
              </Suspense>
            );
          case 'hair':
            // Find parent actor node if specified
            const hairActorId = node.userData?.parentActorId;
            const hairActorNode = hairActorId 
              ? scene.nodes.find(n => n.id === hairActorId)
              : undefined;
            return (
              <Suspense key={node.id} fallback={null}>
                <HairMesh
                  node={node}
                  actorNode={hairActorNode}
                />
              </Suspense>
            );
          default:
            return null;
        }
      })}
    </group>
  );
}

export { ModelMesh, BackdropMesh, PropMesh, ModelPlaceholder };
