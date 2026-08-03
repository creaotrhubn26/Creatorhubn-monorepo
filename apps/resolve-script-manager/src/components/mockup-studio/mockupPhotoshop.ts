/**
 * mockupPhotoshop.ts — bygg en EKTE REDIGERBAR PSD via den eksisterende UXP-
 * Photoshop-broen (WS → plugin `template.scaffold`).
 *
 * I motsetning til den selvstendige PSD-eksporten (mockupPsd.ts, rasteriserte
 * lag) gir denne veien:
 *   • hvert device-skjermbilde som et SMART-OBJEKT (dobbeltklikk for å redigere
 *     / bytt innhold), og
 *   • hver tekst som et EKTE tekst-lag (redigerbar tekst, riktig farge + font).
 *
 * Krever at Photoshop-broen er tilkoblet (Photoshop-fanen / UXP-plugin lastet).
 * Bakgrunn + enheter rendres til temp-PNG-er i app-data og embedes; tekst
 * sendes som scaffold-tekstfelt.
 */

import { getStatus, photoshop } from '../../services/photoshopBridgeService';
import { getAppDataDir, demoWriteBinary } from '../../api';
import { rasterizeLayers } from './mockupRaster';
import { resolveColor, resolveBaseBg, type MockupDoc } from './mockupStudioModel';

function hexToRgb(hex: string): { red: number; green: number; blue: number } {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return { red: 30, green: 30, blue: 30 };
  const n = parseInt(m[1], 16);
  return { red: (n >> 16) & 0xff, green: (n >> 8) & 0xff, blue: n & 0xff };
}

function canvasToPngBase64(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png').split(',')[1] ?? '';
}

export interface EditablePsdResult {
  output_path: string;
  layers: number;
}

/** Er Photoshop-broen tilkoblet akkurat nå? */
export async function isBridgeConnected(): Promise<boolean> {
  try {
    return (await getStatus()).connected;
  } catch {
    return false;
  }
}

/**
 * Bygg en redigerbar PSD på `outputPath` via broen. Kaster hvis broen ikke er
 * tilkoblet eller scaffold feiler.
 */
export async function buildEditablePsdViaBridge(doc: MockupDoc, outputPath: string): Promise<EditablePsdResult> {
  const status = await getStatus();
  if (!status.connected) {
    throw new Error('Photoshop-broen er ikke tilkoblet. Åpne Photoshop-fanen og last UXP-pluginen først.');
  }

  const layers = await rasterizeLayers(doc);
  // rasterizeLayers-rekkefølge: [Bakgrunn, ...enheter (doc.devices-rekkefølge), ...tekster]
  const bg = layers[0];
  const deviceLayers = layers.slice(1, 1 + doc.devices.length);

  const base = (await getAppDataDir()).replace(/\/+$/, '');
  const tmpPaths: { key: string; path: string; canvas: HTMLCanvasElement }[] = [
    { key: 'bakgrunn', path: `${base}/mockup-so-bakgrunn.png`, canvas: bg.canvas },
    ...deviceLayers.map((dl, i) => ({ key: `enhet_${i}`, path: `${base}/mockup-so-enhet-${i}.png`, canvas: dl.canvas })),
  ];

  // Skriv temp-PNG-ene (embedes som smart-objekter av scaffolden).
  for (const t of tmpPaths) {
    await demoWriteBinary(t.path, canvasToPngBase64(t.canvas));
  }

  // Felt: bilde-lag nederst (bakgrunn → enheter), deretter redigerbare tekst-lag øverst.
  const imageFields = tmpPaths.map((t) => ({
    key: t.key,
    type: 'image_placeholder' as const,
    file_path: t.path,
  }));

  const textFields = doc.texts.map((t, i) => {
    const hex = resolveColor(t.color, doc.canvas);
    const rgb = hexToRgb(hex);
    const fontName = t.weight >= 700 ? 'Helvetica-Bold' : 'Helvetica';
    const content = t.uppercase ? t.text.toUpperCase() : t.text;
    // Avsnitts-tekst: boks-topp-venstre = (x, y), bredde + justering styrer
    // ombrekking/plassering i boksen (matcher lerretets tekst-slot).
    return {
      key: `tekst_${i}`,
      type: 'text' as const,
      hint: content || 'Tekst',
      x: Math.round(t.x),
      y: Math.round(t.y),
      width: Math.round(t.w),
      align: t.align,
      font_size: Math.round(t.size),
      font: fontName,
      color: rgb,
    };
  });

  const res = await photoshop.scaffoldTemplate({
    output_path: outputPath,
    spec: {
      name: doc.name,
      width: doc.canvas.w,
      height: doc.canvas.h,
      background_color: hexToRgb(resolveBaseBg(doc.canvas)),
      fields: [...imageFields, ...textFields],
    },
  });

  return { output_path: res.output_path, layers: res.created_layers.length };
}
