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
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { deviceDims, type Device3DVariant } from './deviceGeometry';
import iphoneGlb from './deviceMeshes/iphone.glb';
import ipadGlb from './deviceMeshes/ipad.glb';
import macbookGlb from './deviceMeshes/macbook.glb';

/**
 * Egne Blender-genererte device-KROPPER (glb; scripts/gen-device-glb.py). Kroppen
 * (m/ side-knapper + bak-kamera-modul) er mer detaljert enn parametrisk. Skjermen
 * legges av APPEN på +Z-fronten (deterministisk, unngår Blender↔glTF-orientering).
 * macbook = Blender clamshell (base + tiltet panel + 'Screen'-mesh som appen swapper).
 */
const DEVICE_GLB: Partial<Record<Device3DVariant, string>> = { iphone: iphoneGlb, ipad: ipadGlb, macbook: macbookGlb };
const _gltfScene = new Map<string, Promise<THREE.Group>>();

function loadGltfScene(url: string): Promise<THREE.Group> {
  let p = _gltfScene.get(url);
  if (!p) { p = new GLTFLoader().loadAsync(url).then((g) => g.scene); _gltfScene.set(url, p); }
  return p;
}

/**
 * Bygg fra Blender-glb. To skjerm-strategier:
 *  • Har glb en 'Screen'-mesh (laptop/clamshell, skjerm på tiltet panel) → SWAP dens
 *    materiale til skjermbildet.
 *  • Ellers (slab: telefon/tablet, kropp-only) → APP legger skjermen på box.max.z-fronten.
 */
async function buildDeviceGltf(url: string, shot: string | undefined, variant: Device3DVariant): Promise<THREE.Group> {
  const body = (await loadGltfScene(url)).clone(true);
  const mat = await screenMat(shot, variant);
  let hasScreen = false;
  body.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mn = Array.isArray(mesh.material) ? mesh.material[0]?.name : mesh.material?.name;
    if (o.name === 'Screen' || o.name.startsWith('Screen') || mn === 'Screen') { (mat as THREE.MeshBasicMaterial).side = THREE.DoubleSide; mesh.material = mat; hasScreen = true; }
  });
  const g = new THREE.Group();
  g.add(body);
  if (!hasScreen) {
    const box = new THREE.Box3().setFromObject(body);
    const size = new THREE.Vector3(); box.getSize(size);
    const ctr = new THREE.Vector3(); box.getCenter(ctr);
    const inset = size.x * 0.05;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(size.x - inset * 2, size.y - inset * 2), mat);
    screen.position.set(ctr.x, ctr.y, box.max.z + 0.002);
    g.add(screen);
  }
  return g;
}

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
    const key = new THREE.DirectionalLight(0xffffff, 2.0); key.position.set(3, 4, 5); scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.7); fill.position.set(-4, 1, 3); scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 0.5); rim.position.set(0, -3, -4); scene.add(rim);
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    // HDRI-lignende miljø (nøytralt studio) via PMREM → refleksjoner i metall + glass.
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  }
  return { renderer, scene, camera };
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('img')); im.src = src; });
}

const bodyMat = () => new THREE.MeshStandardMaterial({ color: 0x1b1d22, metalness: 0.9, roughness: 0.32, envMapIntensity: 0.9 });

/** Tegn notch/hole-punch øverst på skjerm-canvaset (moderne telefon-look). */
function drawNotch(cx: CanvasRenderingContext2D, w: number, h: number, variant?: Device3DVariant): void {
  cx.fillStyle = '#000';
  if (variant === 'iphone') {
    // Dynamic Island: avrundet pille, topp-senter.
    const iw = w * 0.30, ih = h * 0.020, ix = (w - iw) / 2, iy = h * 0.016;
    cx.beginPath();
    if (typeof cx.roundRect === 'function') cx.roundRect(ix, iy, iw, ih, ih / 2);
    else cx.rect(ix, iy, iw, ih);
    cx.fill();
  } else if (variant === 'android') {
    // Hole-punch: liten sirkel topp-senter.
    cx.beginPath(); cx.arc(w / 2, h * 0.028, Math.min(w, h) * 0.014, 0, Math.PI * 2); cx.fill();
  }
}

/** Selv-lyst (unlit) skjerm-materiale — skjermbilde i sanne farger uansett lys. */
async function screenMat(shot?: string, variant?: Device3DVariant): Promise<THREE.Material> {
  if (shot) {
    try {
      const img = await loadImg(shot);
      const cv = document.createElement('canvas');
      cv.width = img.naturalWidth || img.width; cv.height = img.naturalHeight || img.height;
      const cx = cv.getContext('2d');
      let tex: THREE.Texture;
      if (cx) { cx.drawImage(img, 0, 0); drawNotch(cx, cv.width, cv.height, variant); tex = new THREE.CanvasTexture(cv); }
      else tex = new THREE.CanvasTexture(img);
      tex.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshBasicMaterial({ map: tex });
    } catch { /* svart skjerm */ }
  }
  return new THREE.MeshBasicMaterial({ color: 0x000000 });
}

async function buildDevice(variant: Device3DVariant, shot?: string): Promise<THREE.Group> {
  const d = deviceDims(variant);
  const g = new THREE.Group();
  const mat = await screenMat(shot, variant);

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
  const glb = DEVICE_GLB[opts.variant];
  const dev = glb ? await buildDeviceGltf(glb, opts.shot, opts.variant) : await buildDevice(opts.variant, opts.shot);
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
