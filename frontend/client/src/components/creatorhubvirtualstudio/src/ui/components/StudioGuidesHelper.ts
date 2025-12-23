/**
 * Studio Guides Helper
 * 
 * Vanilla Three.js implementation of studio guides for EnhancedStage3D
 * Creates visual indicators for distance, angle, and positioning
 */

import * as THREE from 'three';

export interface GuideConfig {
  showDistanceGuides: boolean;
  showAngleGuides: boolean;
  showPositionMarkers: boolean;
  showGridOverlay: boolean;
  subjectPosition: [number, number, number];
  backgroundDistance: number;
  keyLightDistance: number;
  keyLightAngle: number;
  keyLightHeight: number;
  fillDistance: number;
  cameraDistance: number;
}

export class StudioGuidesHelper extends THREE.Group {
  private config: GuideConfig;
  private gridHelper: THREE.GridHelper | null = null;
  private distanceLines: THREE.Group;
  private positionMarkers: THREE.Group;
  private angleGuides: THREE.Group;
  private labels: THREE.Group;

  constructor(config: GuideConfig) {
    super();
    this.config = config;
    this.distanceLines = new THREE.Group();
    this.positionMarkers = new THREE.Group();
    this.angleGuides = new THREE.Group();
    this.labels = new THREE.Group();

    this.add(this.distanceLines);
    this.add(this.positionMarkers);
    this.add(this.angleGuides);
    this.add(this.labels);

    this.rebuild();
  }

  updateConfig(config: Partial<GuideConfig>): void {
    this.config = { ...this.config, ...config };
    this.rebuild();
  }

  private rebuild(): void {
    this.clear();
    this.buildGrid();
    this.buildDistanceLines();
    this.buildPositionMarkers();
    this.buildAngleGuides();
  }

  private clear(): void {
    this.distanceLines.clear();
    this.positionMarkers.clear();
    this.angleGuides.clear();
    this.labels.clear();

    if (this.gridHelper) {
      this.remove(this.gridHelper);
      this.gridHelper.geometry.dispose();
      (this.gridHelper.material as THREE.Material).dispose();
      this.gridHelper = null;
    }
  }

  private buildGrid(): void {
    if (!this.config.showGridOverlay) return;

    this.gridHelper = new THREE.GridHelper(10, 20, 0x444444, 0x333333);
    this.gridHelper.position.y = 0.01;
    this.add(this.gridHelper);
  }

  private buildDistanceLines(): void {
    if (!this.config.showDistanceGuides) return;

    const subject = new THREE.Vector3(...this.config.subjectPosition);
    
    // Calculate positions
    const backgroundPos = new THREE.Vector3(
      subject.x,
      subject.y,
      subject.z - this.config.backgroundDistance
    );
    
    const angleRad = (this.config.keyLightAngle * Math.PI) / 180;
    const keyLightPos = new THREE.Vector3(
      subject.x + Math.sin(angleRad) * this.config.keyLightDistance,
      this.config.keyLightHeight,
      subject.z + Math.cos(angleRad) * this.config.keyLightDistance
    );
    
    const fillPos = new THREE.Vector3(
      subject.x - Math.sin(angleRad * 0.5) * this.config.fillDistance,
      this.config.keyLightHeight - 0.3,
      subject.z + Math.cos(angleRad * 0.5) * this.config.fillDistance
    );
    
    const cameraPos = new THREE.Vector3(
      subject.x,
      1.5,
      subject.z + this.config.cameraDistance
    );

    // Subject to Background line
    this.createDistanceLine(subject, backgroundPos, 0x4488ff);
    
    // Key Light to Subject line
    this.createDistanceLine(keyLightPos, subject, 0xffcc00);
    
    // Fill to Subject line
    this.createDistanceLine(fillPos, subject, 0x88ccff);
    
    // Camera to Subject line
    this.createDistanceLine(cameraPos, subject, 0xff8844);
  }

  private createDistanceLine(start: THREE.Vector3, end: THREE.Vector3, color: number): void {
    const material = new THREE.LineDashedMaterial({
      color,
      dashSize: 0.1,
      gapSize: 0.05,
      linewidth: 2,
    });

    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const line = new THREE.Line(geometry, material);
    line.computeLineDistances();
    this.distanceLines.add(line);

    // Start/end markers
    const sphereGeo = new THREE.SphereGeometry(0.05, 8, 8);
    const sphereMat = new THREE.MeshBasicMaterial({ color });
    
    const startMarker = new THREE.Mesh(sphereGeo, sphereMat);
    startMarker.position.copy(start);
    this.distanceLines.add(startMarker);
    
    const endMarker = new THREE.Mesh(sphereGeo, sphereMat.clone());
    endMarker.position.copy(end);
    this.distanceLines.add(endMarker);
  }

  private buildPositionMarkers(): void {
    if (!this.config.showPositionMarkers) return;

    const subject = new THREE.Vector3(...this.config.subjectPosition);
    
    // Subject marker
    this.createXMarker(subject, 0xff4488, 0.3);
    
    // Background marker
    const bgPos = new THREE.Vector3(
      subject.x,
      0,
      subject.z - this.config.backgroundDistance
    );
    this.createXMarker(bgPos, 0x4488ff, 0.3);

    // Subject silhouette (simplified cylinder + sphere)
    this.createSubjectSilhouette(subject);
  }

  private createXMarker(position: THREE.Vector3, color: number, size: number): void {
    const material = new THREE.LineBasicMaterial({ color, linewidth: 2 });
    
    // X shape
    const halfSize = size / 2;
    const points1 = [
      new THREE.Vector3(-halfSize, 0, -halfSize),
      new THREE.Vector3(halfSize, 0, halfSize),
    ];
    const points2 = [
      new THREE.Vector3(-halfSize, 0, halfSize),
      new THREE.Vector3(halfSize, 0, -halfSize),
    ];

    const line1 = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points1),
      material
    );
    const line2 = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points2),
      material.clone()
    );

    line1.position.copy(position);
    line2.position.copy(position);

    this.positionMarkers.add(line1);
    this.positionMarkers.add(line2);

    // Vertical indicator
    const verticalPoints = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0.5, 0),
    ];
    const verticalMaterial = new THREE.LineDashedMaterial({
      color,
      dashSize: 0.05,
      gapSize: 0.03,
    });
    const verticalLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(verticalPoints),
      verticalMaterial
    );
    verticalLine.position.copy(position);
    verticalLine.computeLineDistances();
    this.positionMarkers.add(verticalLine);
  }

  private createSubjectSilhouette(position: THREE.Vector3): void {
    const height = 1.7;
    
    // Body cylinder
    const bodyGeo = new THREE.CylinderGeometry(0.15, 0.2, height - 0.3, 8);
    const bodyMat = new THREE.MeshBasicMaterial({
      color: 0x444444,
      transparent: true,
      opacity: 0.3,
      wireframe: true,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(position.x, height / 2 - 0.15, position.z);
    this.positionMarkers.add(body);

    // Head sphere
    const headGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const headMat = new THREE.MeshBasicMaterial({
      color: 0x666666,
      transparent: true,
      opacity: 0.4,
      wireframe: true,
    });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(position.x, height - 0.15, position.z);
    this.positionMarkers.add(head);

    // Eye level indicator
    const eyeLevel = height - 0.18;
    const eyePoints = [
      new THREE.Vector3(position.x - 0.3, eyeLevel, position.z),
      new THREE.Vector3(position.x + 0.3, eyeLevel, position.z),
    ];
    const eyeMat = new THREE.LineBasicMaterial({ color: 0x00ff88 });
    const eyeLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(eyePoints),
      eyeMat
    );
    this.positionMarkers.add(eyeLine);
  }

  private buildAngleGuides(): void {
    if (!this.config.showAngleGuides) return;

    const subject = new THREE.Vector3(...this.config.subjectPosition);
    
    // Light placement circles
    this.createPlacementCircle(subject, 1.5, 0xffcc00, false);
    this.createPlacementCircle(subject, 2.0, 0x00ff88, true);
    this.createPlacementCircle(subject, 3.0, 0x88ccff, false);

    // Angle arc for key light
    this.createAngleArc(subject, this.config.keyLightAngle, 1.5, 0xffaa00);
  }

  private createPlacementCircle(
    center: THREE.Vector3,
    radius: number,
    color: number,
    recommended: boolean
  ): void {
    const segments = 64;
    const points: THREE.Vector3[] = [];
    
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push(new THREE.Vector3(
        center.x + Math.cos(angle) * radius,
        0.01,
        center.z + Math.sin(angle) * radius
      ));
    }

    const material = recommended
      ? new THREE.LineBasicMaterial({ color, linewidth: 3 })
      : new THREE.LineDashedMaterial({
          color,
          dashSize: 0.15,
          gapSize: 0.1,
          linewidth: 2,
        });

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const circle = new THREE.Line(geometry, material);
    
    if (!recommended) {
      circle.computeLineDistances();
    }
    
    this.angleGuides.add(circle);

    // Recommended zone highlight
    if (recommended) {
      const ringGeo = new THREE.RingGeometry(radius - 0.2, radius + 0.2, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.1,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(center.x, 0.01, center.z);
      this.angleGuides.add(ring);
    }
  }

  private createAngleArc(
    center: THREE.Vector3,
    angle: number,
    radius: number,
    color: number
  ): void {
    const segments = 20;
    const points: THREE.Vector3[] = [];
    
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * (angle * Math.PI / 180);
      points.push(new THREE.Vector3(
        center.x + Math.sin(a) * radius,
        0.01,
        center.z + Math.cos(a) * radius
      ));
    }

    const material = new THREE.LineBasicMaterial({ color, linewidth: 3 });
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const arc = new THREE.Line(geometry, material);
    this.angleGuides.add(arc);
  }

  dispose(): void {
    this.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
      if (obj instanceof THREE.Line) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
  }
}

export default StudioGuidesHelper;

