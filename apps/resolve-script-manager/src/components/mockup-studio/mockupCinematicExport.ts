/**
 * mockupCinematicExport.ts — cinematic Blender-eksport (Cycles). Rendrer den
 * første 3D-enheten (Ekte 3D på) i et studio-environment via headless Blender
 * → MP4. Frontend-tynt lag: velg destinasjon → Rust-kommando gjør render+kode.
 */
import { invoke } from '@tauri-apps/api/core';
import { save as saveFileDialog } from '@tauri-apps/plugin-dialog';
import { openPath } from '@tauri-apps/plugin-opener';
import type { MockupDoc } from './mockupStudioModel';
import { is3dVariant } from './mockup3d/deviceGeometry';

function safeName(n?: string): string {
  return (n || 'mockup').replace(/[^\w.-]+/g, '_').slice(0, 40) || 'mockup';
}

/**
 * Rendrer den første 3D-enheten som cinematic MP4. Returnerer stien, eller null
 * hvis brukeren avbryter lagre-dialogen. Kaster hvis ingen 3D-enhet finnes eller
 * Blender/ffmpeg feiler.
 */
export async function exportCinematic(doc: MockupDoc, frames = 36, onMsg?: (m: string) => void): Promise<string | null> {
  const dev = doc.devices.find((d) => d.threeD && is3dVariant(d.variant));
  if (!dev) throw new Error('Slå på «Ekte 3D» på en enhet først — Blender rendrer den enheten.');
  const dest = await saveFileDialog({
    defaultPath: `${safeName(doc.name)}-cinematic.mp4`,
    filters: [{ name: 'MP4', extensions: ['mp4'] }],
  });
  if (!dest) return null;
  onMsg?.('🎬 Blender rendrer (Cycles) — dette tar ~1–3 min…');
  const out = await invoke<string>('render_blender_cinematic', {
    variant: dev.variant,
    shot: dev.image ?? null,
    frames,
    dest,
    typeText: dev.typeAnim?.text ?? null,
    rotX: dev.threeD?.rotX ?? 0,
    rotY: dev.threeD?.rotY ?? 0,
    rotZ: dev.threeD?.rotZ ?? 0,
    keyPop: dev.typeAnim?.keyPop ?? false,
    kbLayout: dev.threeD?.kbLayout ?? 'mac',
  });
  void openPath(out).catch(() => {});
  return out;
}
