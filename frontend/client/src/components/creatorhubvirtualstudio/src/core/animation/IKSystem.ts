/**
 * IK/FK System for Human Posing
 * 
 * Implements inverse kinematics for character rigging
 * Features:
 * - IK for limbs (arms, legs)
 * - FK for spine and fingers
 * - Rotation constraints
 * - Pose blending
 */

import * as THREE from 'three';

export interface IKChain {
  bones: THREE.Bone[];
  target: THREE.Vector3;
  poleTarget?: THREE.Vector3; // For elbow/knee direction
  iterations: number;
  tolerance: number;
}

export interface PoseData {
  name: string;
  boneRotations: Map<string, THREE.Quaternion>;
  bonePositions: Map<string, THREE.Vector3>;
}

export class IKSystem {
  private skeleton: THREE.Skeleton;
  private ikChains: Map<string, IKChain> = new Map();

  constructor(skeleton: THREE.Skeleton) {
    this.skeleton = skeleton;
  }

  /**
   * Create IK chain for a limb
   */
  public createIKChain(
    name: string,
    bones: THREE.Bone[],
    target: THREE.Vector3,
    options: {
      poleTarget?: THREE.Vector3;
      iterations?: number;
      tolerance?: number;
    } = {},
  ): void {
    this.ikChains.set(name, {
      bones,
      target,
      poleTarget: options.poleTarget,
      iterations: options.iterations || 10,
      tolerance: options.tolerance || 0.01,
    });
  }

  /**
   * Solve IK using CCD (Cyclic Coordinate Descent)
   */
  public solveIK(chainName: string): boolean {
    const chain = this.ikChains.get(chainName);
    if (!chain) return false;

    const { bones, target, iterations, tolerance } = chain;
    const endEffector = bones[bones.length - 1];

    for (let iter = 0; iter < iterations; iter++) {
      // Get end effector world position
      const endPos = new THREE.Vector3();
      endEffector.getWorldPosition(endPos);

      // Check if close enough
      const distance = endPos.distanceTo(target);
      if (distance < tolerance) {
        return true;
      }

      // Iterate through bones from end to start
      for (let i = bones.length - 2; i >= 0; i--) {
        const bone = bones[i];

        // Get bone world position
        const bonePos = new THREE.Vector3();
        bone.getWorldPosition(bonePos);

        // Calculate vectors
        const toEnd = new THREE.Vector3().subVectors(endPos, bonePos).normalize();
        const toTarget = new THREE.Vector3().subVectors(target, bonePos).normalize();

        // Calculate rotation
        const axis = new THREE.Vector3().crossVectors(toEnd, toTarget).normalize();
        const angle = Math.acos(Math.max(-1, Math.min(1, toEnd.dot(toTarget))));

        if (angle > 0.001) {
          // Apply rotation
          const rotation = new THREE.Quaternion().setFromAxisAngle(axis, angle);
          bone.quaternion.multiply(rotation);
          bone.updateMatrixWorld(true);

          // Update end effector position
          endEffector.getWorldPosition(endPos);
        }
      }
    }

    return false;
  }

  /**
   * Apply FK (Forward Kinematics) rotation to a bone
   */
  public applyFK(boneName: string, rotation: THREE.Euler): void {
    const bone = this.skeleton.getBoneByName(boneName);
    if (bone) {
      bone.rotation.copy(rotation);
      bone.updateMatrixWorld(true);
    }
  }

  /**
   * Set bone rotation with constraints
   */
  public setBoneRotation(
    boneName: string,
    rotation: THREE.Euler,
    constraints?: {
      minX?: number;
      maxX?: number;
      minY?: number;
      maxY?: number;
      minZ?: number;
      maxZ?: number;
    },
  ): void {
    const bone = this.skeleton.getBoneByName(boneName);
    if (!bone) return;

    // Apply constraints
    if (constraints) {
      rotation.x = THREE.MathUtils.clamp(
        rotation.x,
        constraints.minX ?? -Math.PI,
        constraints.maxX ?? Math.PI,
      );
      rotation.y = THREE.MathUtils.clamp(
        rotation.y,
        constraints.minY ?? -Math.PI,
        constraints.maxY ?? Math.PI,
      );
      rotation.z = THREE.MathUtils.clamp(
        rotation.z,
        constraints.minZ ?? -Math.PI,
        constraints.maxZ ?? Math.PI,
      );
    }

    bone.rotation.copy(rotation);
    bone.updateMatrixWorld(true);
  }

  /**
   * Capture current pose
   */
  public capturePose(name: string): PoseData {
    const boneRotations = new Map<string, THREE.Quaternion>();
    const bonePositions = new Map<string, THREE.Vector3>();

    this.skeleton.bones.forEach((bone) => {
      boneRotations.set(bone.name, bone.quaternion.clone());
      bonePositions.set(bone.name, bone.position.clone());
    });

    return {
      name,
      boneRotations,
      bonePositions,
    };
  }

  /**
   * Apply saved pose
   */
  public applyPose(pose: PoseData): void {
    this.skeleton.bones.forEach((bone) => {
      const rotation = pose.boneRotations.get(bone.name);
      const position = pose.bonePositions.get(bone.name);

      if (rotation) {
        bone.quaternion.copy(rotation);
      }
      if (position) {
        bone.position.copy(position);
      }
    });

    this.skeleton.bones[0].updateMatrixWorld(true);
  }

  /**
   * Blend between two poses
   */
  public blendPoses(poseA: PoseData, poseB: PoseData, alpha: number): PoseData {
    const blendedRotations = new Map<string, THREE.Quaternion>();
    const blendedPositions = new Map<string, THREE.Vector3>();

    this.skeleton.bones.forEach((bone) => {
      const rotA = poseA.boneRotations.get(bone.name);
      const rotB = poseB.boneRotations.get(bone.name);
      const posA = poseA.bonePositions.get(bone.name);
      const posB = poseB.bonePositions.get(bone.name);

      if (rotA && rotB) {
        const blended = new THREE.Quaternion().slerpQuaternions(rotA, rotB, alpha);
        blendedRotations.set(bone.name, blended);
      }

      if (posA && posB) {
        const blended = new THREE.Vector3().lerpVectors(posA, posB, alpha);
        blendedPositions.set(bone.name, blended);
      }
    });

    return {
      name: `${poseA.name}_${poseB.name}_blend`,
      boneRotations: blendedRotations,
      bonePositions: blendedPositions,
    };
  }

  /**
   * Reset to T-pose
   */
  public resetToTPose(): void {
    this.skeleton.bones.forEach((bone) => {
      bone.rotation.set(0, 0, 0);
      bone.updateMatrixWorld(true);
    });
  }
}

