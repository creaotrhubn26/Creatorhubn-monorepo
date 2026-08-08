/**
 * mockup3d.ts — ekte 3D device-render (Three.js), bakt til et 2D-canvas.
 *
 * Én GJENBRUKT WebGLRenderer + scene + kamera (ikke ny kontekst per bake — dyrt
 * + WebGL-kontekst-grense). Parametrisk geometri (avrundet slab-kropp + skjerm-
 * plan m/ skjermbilde-tekstur). Returnerer et 2D-canvas som rasterisatoren
 * drawImage-er inn i device-boksen → WYSIWYG + alle eksporter.
 */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { deviceDims, type Device3DVariant } from './deviceGeometry';

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;

export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

function ensure(): { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera } {
  if (!renderer || !scene || !camera) {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setClearColor(0x000000, 0);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
    camera.position.set(0, 0, 5.2); // strammet så telefonen (høyde ~2.06) fyller ~85% + margin for tilt
    const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(3, 4, 5); scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.8); fill.position.set(-4, 1, 3); scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 0.6); rim.position.set(0, -3, -4); scene.add(rim);
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  }
  return { renderer, scene, camera };
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('img')); im.src = src; });
}

const bodyMat = () => new THREE.MeshStandardMaterial({ color: 0x1b1d22, metalness: 0.85, roughness: 0.38 });

/** Selv-lyst (unlit) skjerm-materiale — skjermbilde i sanne farger uansett lys. */
async function screenMat(shot?: string): Promise<THREE.Material> {
  if (shot) {
    try {
      const img = await loadImg(shot);
      const tex = new THREE.CanvasTexture(img);
      tex.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshBasicMaterial({ map: tex });
    } catch { /* svart skjerm */ }
  }
  return new THREE.MeshBasicMaterial({ color: 0x000000 });
}

async function buildDevice(variant: Device3DVariant, shot?: string): Promise<THREE.Group> {
  const d = deviceDims(variant);
  const g = new THREE.Group();
  const mat = await screenMat(shot);

  if (d.kind === 'clamshell') {
    // Laptop: flat base (tastatur-dekk) + skjerm-plate hengslet ved bakre kant.
    const baseTh = 0.045;
    const baseDepth = d.baseDepth ?? d.bodyW * 0.68;
    const base = new THREE.Mesh(new RoundedBoxGeometry(d.bodyW, baseTh, baseDepth, 3, 0.02), bodyMat());
    base.position.set(0, -baseTh / 2, baseDepth / 2); // fremkant ved z=0, strekker seg bakover
    g.add(base);
    const hinge = new THREE.Group();
    hinge.position.set(0, 0, baseDepth); // bakre kant
    // Panelet peker alt +Y (vertikal = 90° fra base); len KUN (hingeDeg-90)° bakover.
    hinge.rotation.x = -THREE.MathUtils.degToRad((d.hingeDeg ?? 100) - 90);
    const panel = new THREE.Mesh(new RoundedBoxGeometry(d.bodyW, d.bodyH, d.bodyD, 3, d.cornerR * d.bodyW), bodyMat());
    panel.position.set(0, d.bodyH / 2, 0); // bunnkant ved hengsel
    hinge.add(panel);
    const sw = d.bodyW - d.screenInset * 2, sh = d.bodyH - d.screenInset * 2;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), mat);
    screen.position.set(0, d.bodyH / 2, d.bodyD / 2 + 0.002); // front (mot kamera)
    hinge.add(screen);
    g.add(hinge);
    return g;
  }

  // Slab (telefon/tablet).
  const body = new THREE.Mesh(new RoundedBoxGeometry(d.bodyW, d.bodyH, d.bodyD, 4, d.cornerR * d.bodyW), bodyMat());
  g.add(body);
  const sw = d.bodyW - d.screenInset * 2, sh = d.bodyH - d.screenInset * 2;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), mat);
  screen.position.z = d.bodyD / 2 + 0.002;
  g.add(screen);
  return g;
}

export async function render3dDevice(opts: { variant: Device3DVariant; shot?: string; rotX: number; rotY: number; rotZ: number; light?: string; w: number; h: number }): Promise<HTMLCanvasElement> {
  const { renderer: r, scene: s, camera: c } = ensure();
  r.setSize(opts.w, opts.h, false);
  const aspect = opts.w / opts.h;
  c.aspect = aspect; c.updateProjectionMatrix();
  const prev = s.getObjectByName('device');
  if (prev) { s.remove(prev); }
  const dev = await buildDevice(opts.variant, opts.shot);
  dev.name = 'device';
  dev.rotation.set(THREE.MathUtils.degToRad(opts.rotX), THREE.MathUtils.degToRad(opts.rotY), THREE.MathUtils.degToRad(opts.rotZ));
  s.add(dev);
  // Sentrer (pivot rundt senter) + auto-fit kamera til den roterte enhetens bbox.
  const box = new THREE.Box3().setFromObject(dev);
  const center = new THREE.Vector3(); box.getCenter(center);
  dev.position.sub(center);
  const size = new THREE.Vector3(); box.getSize(size);
  const halfFov = THREE.MathUtils.degToRad(c.fov) / 2;
  const distH = (size.y / 2) / Math.tan(halfFov);
  const distW = (size.x / 2) / (Math.tan(halfFov) * aspect);
  c.position.set(0, 0, Math.max(distH, distW) * 1.14 + size.z);
  c.lookAt(0, 0, 0);
  r.render(s, c);
  const out = document.createElement('canvas');
  out.width = opts.w; out.height = opts.h;
  const octx = out.getContext('2d');
  if (octx) octx.drawImage(r.domElement, 0, 0);
  return out;
}

export function dispose3d(): void {
  renderer?.dispose();
  renderer = null; scene = null; camera = null;
}
