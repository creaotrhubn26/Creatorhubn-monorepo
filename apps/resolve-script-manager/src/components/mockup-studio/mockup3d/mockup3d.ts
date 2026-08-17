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
import { deckRows, type KbLayout, type TypeState, type FieldStyle, drawField, drawOnScreenKeyboard, drawKeyPop, typedState } from './keyboardAnim';
import iphoneGlb from './deviceMeshes/iphone.glb';
import ipadGlb from './deviceMeshes/ipad.glb';

/** Skrive-animasjons-tilstand for ett bake-bilde. */
type ScreenAnim = { st: TypeState; onScreenKb: boolean; pop?: { char: string; rise: number }; style?: FieldStyle; placeholder?: string };

/**
 * Egne Blender-genererte device-KROPPER (glb; scripts/gen-device-glb.py). Kroppen
 * (m/ side-knapper + bak-kamera-modul) er mer detaljert enn parametrisk. Skjermen
 * legges av APPEN på +Z-fronten (deterministisk, unngår Blender↔glTF-orientering).
 * macbook = Blender clamshell (base + tiltet panel + 'Screen'-mesh som appen swapper).
 */
const DEVICE_GLB: Partial<Record<Device3DVariant, string>> = { iphone: iphoneGlb, ipad: ipadGlb };
// macbook: parametrisk clamshell m/ tastatur-dekk (buildDevice), ikke glb.
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
async function buildDeviceGltf(url: string, shot: string | undefined, variant: Device3DVariant, anim?: ScreenAnim): Promise<THREE.Group> {
  const body = (await loadGltfScene(url)).clone(true);
  const mat = await screenMat(shot, variant, anim);
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
    // Filmisk tone-mapping (ACES) + sRGB → premium produkt-render-look. Skjermbildet
    // markeres toneMapped=false (screenMat) så UI-farger forblir sanne.
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
    camera.position.set(0, 0, 5.2); // strammet så telefonen (høyde ~2.06) fyller ~85% + margin for tilt
    // 3-punkts studio: sterk key (spekulær-streik i metall) + myk fill + kald rim-kant.
    const key = new THREE.DirectionalLight(0xffffff, 2.6); key.position.set(3.5, 5, 4); scene.add(key);
    const fill = new THREE.DirectionalLight(0xdfe6ff, 0.55); fill.position.set(-5, 1.5, 3); scene.add(fill);
    const rim = new THREE.DirectionalLight(0xbcd0ff, 1.1); rim.position.set(-1.5, 2, -5); scene.add(rim);
    const under = new THREE.DirectionalLight(0xffffff, 0.25); under.position.set(0, -4, 2); scene.add(under);
    scene.add(new THREE.AmbientLight(0xffffff, 0.28));
    // HDRI-lignende miljø (nøytralt studio) via PMREM → refleksjoner i metall + glass.
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  }
  return { renderer, scene, camera };
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('img')); im.src = src; });
}

/**
 * Premium chassis — anodisert aluminium (graphite/space-black). MeshPhysical m/
 * tynt clearcoat gir den maskinerte, halvblanke Apple-finishen: metallisk kjerne,
 * mykt clearcoat-høylys oppå. envMap-refleksjoner fra studio-HDRI.
 */
const bodyMat = () => new THREE.MeshPhysicalMaterial({
  color: 0x17191e, metalness: 0.86, roughness: 0.42,
  clearcoat: 0.55, clearcoatRoughness: 0.28,
  envMapIntensity: 1.15,
});

/**
 * Tastatur-dekk-tekstur: KOMPLETT fysisk tastatur (Mac/Windows) + trackpad.
 * `res` skalerer canvas-oppløsningen (fra zoom) så tegn holder seg skarpe ved
 * innzooming. Data-drevet layout (deckRows) → variabel tast-bredde + alle taster.
 */
function deckTexture(pressed?: string | null, layout: KbLayout = 'mac', res = 1): THREE.Texture {
  const p = pressed ? pressed.toLowerCase() : null;
  const scale = Math.max(1, Math.min(2.5, res));
  const W = Math.round(1024 * scale), H = Math.round(704 * scale);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const x = cv.getContext('2d')!;
  // Dekk: svak vertikal gradient (maskinert alu).
  const deckG = x.createLinearGradient(0, 0, 0, H);
  deckG.addColorStop(0, '#202227'); deckG.addColorStop(1, '#2b2d33');
  x.fillStyle = deckG; x.fillRect(0, 0, W, H);
  // Tastatur-brønn (bakre ~63%, 6 rader), nedsenket m/ indre skygge.
  const kbX = W * 0.05, kbY = H * 0.04, kbW = W * 0.90, kbH = H * 0.60;
  x.fillStyle = '#131519'; roundRectPath(x, kbX, kbY, kbW, kbH, 10 * scale); x.fill();
  x.save(); roundRectPath(x, kbX, kbY, kbW, kbH, 10 * scale); x.clip();
  const well = x.createLinearGradient(0, kbY, 0, kbY + kbH);
  well.addColorStop(0, 'rgba(0,0,0,0.5)'); well.addColorStop(0.05, 'rgba(0,0,0,0)');
  x.fillStyle = well; x.fillRect(kbX, kbY, kbW, kbH); x.restore();

  const rows = deckRows(layout);
  const rowGap = kbH * 0.012, kpad = kbW * 0.006;
  const rowH = (kbH - rowGap * (rows.length + 1)) / rows.length;
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const ky = kbY + rowGap + r * (rowH + rowGap);
    const total = row.reduce((s, k) => s + k.w, 0);
    const availW = kbW - kpad * (row.length + 1);
    let kx = kbX + kpad;
    // Funksjons-raden (r=0) er lavere.
    const kh = r === 0 ? rowH * 0.62 : rowH;
    const ky0 = r === 0 ? ky + rowH * 0.2 : ky;
    for (const k of row) {
      const kw = (k.w / total) * availW;
      const isHot = !!p && k.char === p;
      const dy = isHot ? 1 * scale : 0;
      x.fillStyle = '#0e1013'; roundRectPath(x, kx, ky0 + (isHot ? 0.4 : 1.4) * scale, kw, kh, 4 * scale); x.fill();
      if (isHot) { x.fillStyle = '#2f6bff'; roundRectPath(x, kx, ky0 + dy, kw, kh, 4 * scale); x.fill(); }
      else {
        const kg = x.createLinearGradient(0, ky0, 0, ky0 + kh);
        kg.addColorStop(0, '#3c3f46'); kg.addColorStop(1, '#2c2f35');
        x.fillStyle = kg; roundRectPath(x, kx, ky0, kw, kh, 4 * scale); x.fill();
      }
      x.strokeStyle = isHot ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.10)'; x.lineWidth = 1 * scale;
      roundRectPath(x, kx + 0.6 * scale, ky0 + 0.6 * scale + dy, kw - 1.2 * scale, kh - 1.2 * scale, 3.5 * scale); x.stroke();
      if (k.label) {
        // Font tilpasses tast-høyde; krymper for å få plass til flertegns-etiketter.
        let fs = kh * (k.label.length === 1 ? 0.5 : 0.34);
        x.font = `600 ${Math.round(fs)}px -apple-system, "SF Pro Text", system-ui, sans-serif`;
        while (x.measureText(k.label).width > kw * 0.84 && fs > 6) { fs *= 0.9; x.font = `600 ${Math.round(fs)}px -apple-system, system-ui, sans-serif`; }
        x.fillStyle = isHot ? '#ffffff' : '#e9edf2';
        x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(k.label, kx + kw / 2, ky0 + kh / 2 + dy);
      }
      kx += kw + kpad;
    }
  }
  // Trackpad: fremre senter under tastaturet.
  const tpW = W * 0.34, tpH = H * 0.26, tpX = (W - tpW) / 2, tpY = kbY + kbH + H * 0.035;
  const tg = x.createLinearGradient(0, tpY, 0, tpY + tpH);
  tg.addColorStop(0, '#191b20'); tg.addColorStop(0.12, '#25272d'); tg.addColorStop(1, '#292b31');
  x.fillStyle = tg; roundRectPath(x, tpX, tpY, tpW, tpH, 12 * scale); x.fill();
  x.strokeStyle = '#3d4048'; x.lineWidth = 1.5 * scale; roundRectPath(x, tpX, tpY, tpW, tpH, 12 * scale); x.stroke();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

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

/** Rundet-rektangel-sti (med fallback for eldre canvas). */
function roundRectPath(cx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  cx.beginPath();
  if (typeof cx.roundRect === 'function') cx.roundRect(x, y, w, h, r);
  else { cx.moveTo(x + r, y); cx.arcTo(x + w, y, x + w, y + h, r); cx.arcTo(x + w, y + h, x, y + h, r); cx.arcTo(x, y + h, x, y, r); cx.arcTo(x, y, x + w, y, r); cx.closePath(); }
}

/**
 * Komponer glass-skjerm: avrundede hjørner (transparente → viser kropp), tynn
 * bezel-ramme, diagonal glass-sheen (spekulær-streik) + svak lit-display-glød +
 * notch. Transparente hjørner krever transparent:true på materialet.
 */
function composeScreen(img: HTMLImageElement | null, W: number, H: number, variant?: Device3DVariant, anim?: ScreenAnim): HTMLCanvasElement {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const x = cv.getContext('2d')!;
  const r = Math.min(W, H) * (variant === 'macbook' || variant === 'ipad' || variant === 'tablet' ? 0.03 : 0.055);
  x.save();
  roundRectPath(x, 0, 0, W, H, r); x.clip();
  // Bezel-base (svart) + skjermbilde innfelt.
  x.fillStyle = '#05070a'; x.fillRect(0, 0, W, H);
  const bez = Math.min(W, H) * 0.012;
  if (img) x.drawImage(img, bez, bez, W - bez * 2, H - bez * 2);
  else { x.fillStyle = '#0b0d12'; x.fillRect(bez, bez, W - bez * 2, H - bez * 2); }
  // Skrive-animasjon: tekstfelt (+ on-screen-tastatur på telefon/tablet).
  if (anim) {
    const fo = { style: anim.style, placeholder: anim.placeholder };
    if (anim.onScreenKb) {
      const kbTop = drawOnScreenKeyboard(x, W, H, anim.st.pressed);
      drawField(x, W, H, anim.st, kbTop - 0.13, fo);
    } else {
      drawField(x, W, H, anim.st, 0.42, fo);
    }
    // Taste-pop: tegnet svever opp fra tastatur-området.
    if (anim.pop) drawKeyPop(x, W, H, anim.pop.char, anim.pop.rise, anim.onScreenKb ? 0.58 : 0.40);
  }
  // Lit-display: svak lys-løft øverst (som et selvlyst panel).
  const glow = x.createLinearGradient(0, 0, 0, H);
  glow.addColorStop(0, 'rgba(255,255,255,0.06)'); glow.addColorStop(0.25, 'rgba(255,255,255,0)');
  x.fillStyle = glow; x.fillRect(0, 0, W, H);
  // Glass-sheen: diagonal lys-streik (screen-blend).
  x.globalCompositeOperation = 'lighter';
  const sheen = x.createLinearGradient(0, 0, W, H);
  sheen.addColorStop(0.0, 'rgba(255,255,255,0)');
  sheen.addColorStop(0.42, 'rgba(255,255,255,0)');
  sheen.addColorStop(0.5, 'rgba(255,255,255,0.10)');
  sheen.addColorStop(0.58, 'rgba(255,255,255,0)');
  sheen.addColorStop(1.0, 'rgba(255,255,255,0)');
  x.fillStyle = sheen; x.fillRect(0, 0, W, H);
  x.globalCompositeOperation = 'source-over';
  drawNotch(x, W, H, variant);
  x.restore();
  return cv;
}

/** Selv-lyst (unlit) glass-skjerm — sanne UI-farger (toneMapped=false), premium finish. */
async function screenMat(shot?: string, variant?: Device3DVariant, anim?: ScreenAnim): Promise<THREE.Material> {
  let img: HTMLImageElement | null = null;
  if (shot) { try { img = await loadImg(shot); } catch { img = null; } }
  // Uten skjermbilde: bruk skjerm-planets aspect (unngå forvrengt tekstfelt).
  const land = variant === 'macbook';
  const sq = variant === 'ipad' || variant === 'tablet';
  const W = img ? (img.naturalWidth || img.width) : (land ? 1600 : sq ? 1200 : 1170);
  const H = img ? (img.naturalHeight || img.height) : (land ? 1000 : sq ? 1600 : 2532);
  const tex = new THREE.CanvasTexture(composeScreen(img, W, H, variant, anim));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false });
}

async function buildDevice(variant: Device3DVariant, shot?: string, anim?: ScreenAnim, kbLayout: KbLayout = 'mac', deckRes = 1): Promise<THREE.Group> {
  const d = deviceDims(variant);
  const g = new THREE.Group();
  const mat = await screenMat(shot, variant, anim);

  if (d.kind === 'clamshell') {
    // Laptop: flat base (tastatur-dekk) + skjerm-plate hengslet ved bakre kant.
    const baseTh = 0.045;
    const baseDepth = d.baseDepth ?? d.bodyW * 0.68;
    // Kamera står i +Z (større z = nærmere). Palm-rest/tastatur-fremkant må derfor
    // ligge ved +z (nær), og hengsel+skjerm ved z=0 (fjern/bak) — ellers ender
    // laptopen bak-frem (tastatur bak skjermen).
    const base = new THREE.Mesh(new RoundedBoxGeometry(d.bodyW, baseTh, baseDepth, 3, 0.02), bodyMat());
    base.position.set(0, -baseTh / 2, baseDepth / 2); // fremkant (nær) ved z=baseDepth, hengsel-kant ved z=0
    g.add(base);
    // Tastatur-dekk (key-grid + trackpad) på topp-flaten av basen.
    const deck = new THREE.Mesh(
      new THREE.PlaneGeometry(d.bodyW * 0.985, baseDepth * 0.985),
      new THREE.MeshBasicMaterial({ map: deckTexture(anim?.st.pressed, kbLayout, deckRes) }),
    );
    deck.rotation.x = -Math.PI / 2; // legg flatt (peker +Y opp)
    deck.position.set(0, 0.0012, baseDepth / 2); // rett over topp-flaten
    g.add(deck);
    const hinge = new THREE.Group();
    hinge.position.set(0, 0, 0); // bakre (fjerne) kant — skjermen reiser seg bak tastaturet
    // Panelet peker alt +Y (vertikal = 90° fra base); len KUN (hingeDeg-90)° bakover (mot -z).
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

/**
 * Serialiser bakingene: renderer/scene/camera er ÉN delt singleton. Under dra
 * fyrer forhåndsvisningen mange samtidige render3dDevice-kall — uten kø vil
 * kall B fjerne+bytte 'device' mens kall A er midt i sin async-bygging, og A
 * rendrer en halvbygd/tom scene → 3D-enheten «forsvinner» ved justering.
 * Kjeden garanterer at kun ÉN bake rører scenen om gangen.
 */
type Render3dOpts = { variant: Device3DVariant; shot?: string; rotX: number; rotY: number; rotZ: number; light?: string; w: number; h: number; zoom?: number; kbLayout?: KbLayout; type?: { text: string; progress: number; keyPop?: boolean; field?: FieldStyle; placeholder?: string; payoff?: boolean; correct?: boolean } };
let _bakeChain: Promise<unknown> = Promise.resolve();
export function render3dDevice(opts: Render3dOpts): Promise<HTMLCanvasElement> {
  const run = () => _render3dNow(opts);
  const p = _bakeChain.then(run, run);
  _bakeChain = p.then(() => undefined, () => undefined); // aldri brekk kjeden på feil
  return p;
}

async function _render3dNow(opts: Render3dOpts): Promise<HTMLCanvasElement> {
  const { renderer: r, scene: s, camera: c } = ensure();
  r.setSize(opts.w, opts.h, false);
  const aspect = opts.w / opts.h;
  c.aspect = aspect; c.updateProjectionMatrix();
  const prev = s.getObjectByName('device');
  if (prev) { s.remove(prev); }
  // Skrive-animasjons-tilstand (om aktiv): humanisert typing + felt-kontekst.
  let anim: ScreenAnim | undefined;
  if (opts.type && opts.type.text) {
    const ty = opts.type;
    const st = typedState(ty.text, ty.progress, { payoff: ty.payoff, correct: ty.correct });
    const onScreenKb = deviceDims(opts.variant).kind !== 'clamshell';
    // Taste-pop: tegnet som skrives nå svever opp (rise = sub-progresjon).
    const pop = ty.keyPop && st.next && st.next !== ' ' && !st.done ? { char: st.next, rise: st.sub } : undefined;
    anim = { st, onScreenKb, pop, style: ty.field, placeholder: ty.placeholder };
  }
  const glb = DEVICE_GLB[opts.variant];
  const deckRes = Math.max(1, Math.min(2.5, opts.zoom ?? 1)); // høyere zoom → skarpere dekk-tekstur
  const dev = glb ? await buildDeviceGltf(glb, opts.shot, opts.variant, anim) : await buildDevice(opts.variant, opts.shot, anim, opts.kbLayout ?? 'mac', deckRes);
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
  // Clamshell (laptop) ligger flatt → tastatur-dekket er edge-on fra øyehøyde.
  // Hev kameraet til en 3/4 produkt-vinkel som viser BÅDE skjerm og tastatur.
  // Slab (telefon/tablet) beholder frontal-view (svak hev = naturlig).
  const isClam = deviceDims(opts.variant).kind === 'clamshell';
  const elev = isClam ? 0.5 : 0.12;
  // zoom>1 = enheten fyller mer av rammen (kortere kamera-avstand). Default 1.
  const zoom = Math.max(0.5, Math.min(2, opts.zoom ?? 1));
  const dist = (Math.max(distH, distW) * 1.14 + size.z) * (1 + elev * 0.42) / zoom;
  c.position.set(0, dist * elev, dist);
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
