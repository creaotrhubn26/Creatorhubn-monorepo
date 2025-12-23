import { Scene } from '@/core/models/scene';
import { getBrand } from '@/core/services/config';
import { logger } from './logger';

const log = logger.module('Exporter');

export function exportJSON(scene: Scene) {
  const blob = new Blob([JSON.stringify(scene, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'scene.json';
  a.click();
  URL.revokeObjectURL(url);
}

async function getJSPDF() {
  try {
    const mod = await import('jspdf');
    // @ts-ignore
    return mod.jsPDF || mod.default || mod;
  } catch (e) {
    log.warn('jsPDF not available. npm i jspdf');
    return null;
  }
}

function mmScaleForRoom(
  room: { size: [number, number, number] } | undefined,
  maxWidthMM: number,
  maxHeightMM: number,
) {
  if (!room) return 10;
  const wM = Math.max(1e-3, room.size[0]);
  const hM = Math.max(1e-3, room.size[2]);
  const sx = maxWidthMM / (wM * 1000);
  const sy = maxHeightMM / (hM * 1000);
  return Math.min(sx, sy) * 1000;
}

function drawArrow(doc: any, x1: number, y1: number, x2: number, y2: number, label?: string) {
  doc.setDrawColor(37, 99, 235);
  doc.setFillColor(255, 255, 255);
  doc.setLineWidth(0.4);
  doc.line(x1, y1, x2, y2);
  const a = Math.atan2(y2 - y1, x2 - x1);
  const ah = 3;
  const ax = x2 - ah * Math.cos(a - Math.PI / 6);
  const ay = y2 - ah * Math.sin(a - Math.PI / 6);
  const bx = x2 - ah * Math.cos(a + Math.PI / 6);
  const by = y2 - ah * Math.sin(a + Math.PI / 6);
  doc.line(x2, y2, ax, ay);
  doc.line(x2, y2, bx, by);
  if (label) {
    const mx = (x1 + x2) / 2,
      my = (y1 + y2) / 2;
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(9);
    doc.text(label, mx, my - 2, { align: 'center' });
  }
}

function drawRoomScaled(
  doc: any,
  scene: Scene,
  frame: { x: number; y: number; w: number; h: number },
  measurements?: Array<{
    a: [number, number];
    b: [number, number];
    label?: string;
    color?: string;
    name?: string;
  }>,
) {
  const room = scene.environment.room;
  const mmPerMeter = mmScaleForRoom(room, frame.w, frame.h);
  const cx = frame.x + frame.w / 2,
    cy = frame.y + frame.h / 2;

  if (room) {
    const wmm = room.size[0] * mmPerMeter;
    const hmm = room.size[2] * mmPerMeter;
    doc.setDrawColor(200);
    doc.rect(cx - wmm / 2, cy - hmm / 2, wmm, hmm);
    drawArrow(
      doc,
      cx - wmm / 2,
      cy - hmm / 2 - 6,
      cx + wmm / 2,
      cy - hmm / 2 - 6,
      `${room.size[0].toFixed(2)} m`,
    );
    drawArrow(
      doc,
      cx + wmm / 2 + 6,
      cy - hmm / 2,
      cx + wmm / 2 + 6,
      cy + hmm / 2,
      `${room.size[2].toFixed(2)} m`,
    );
  }

  scene.nodes
    .filter((n) => n.type !== 'backdrop' && n.visible !== false)
    .forEach((n) => {
      const x = cx + n.transform.position[0] * mmPerMeter;
      const z = cy - n.transform.position[2] * mmPerMeter;
      const r = n.type === 'model' ? 2.5 : 2;
      const color = n.type === 'camera' ? [14, 165, 233] : n.light ? [245, 158, 11] : [51, 65, 85];
      doc.setFillColor(color[0], color[1], color[2]);
        doc.circle(x, z, r, 'F');
    });

  const cam = scene.nodes.find((n) => n.camera);
  const model = scene.nodes.find((n) => n.type === 'model');
  const key = scene.nodes.find((n) => n.light);
  const pos = (n: any) =>
    n
      ? [cx + n.transform.position[0] * mmPerMeter, cy - n.transform.position[2] * mmPerMeter]
      : null;
  const dist = (a?: number[], b?: number[]) => {
    if (!a || !b) return '-';
    const dx = a[0] - b[0],
      dy = a[1] - b[1];
    const meters = Math.hypot(dx, dy) / mmPerMeter;
    return `${meters.toFixed(2)} m`;
  };
  const pc = pos(cam),
    pm = pos(model),
    pk = pos(key);
  if (pc && pm) drawArrow(doc, pc[0], pc[1], pm[0], pm[1], `Camera→Model ${dist(pc, pm)}`);
  if (pk && pm) drawArrow(doc, pk[0], pk[1], pm[0], pm[1], `Key→Model ${dist(pk, pm)}`);

  /* draw manual measurements */
  if (measurements && measurements.length) {
    measurements.forEach((m) => {
      const ax = cx + m.a[0] * mmPerMeter;
      const ay = cy - m.a[1] * mmPerMeter;
      const bx = cx + m.b[0] * mmPerMeter;
      const by = cy - m.b[1] * mmPerMeter;
      const lbl =
        (m.label || m.name) ?? `${Math.hypot(m.a[0] - m.b[0], m.a[1] - m.b[1]).toFixed(2)} m`;
      doc.setDrawColor(
        m.color ? parseInt(m.color.slice(1, 3), 16) : 37,
        m.color ? parseInt(m.color.slice(3, 5), 16) : 99,
        m.color ? parseInt(m.color.slice(5, 7), 16) : 235,
      );
      drawArrow(doc, ax, ay, bx, by, lbl);
    });
  }
}

function drawHeader(doc: any, scene: Scene, logoDataUrl?: string) {
  const brand = getBrand();
  doc.setFillColor(248, 250, 252);
  doc.rect(0, 0, 210, 22, 'F');
  if (logoDataUrl ?? brand.logoDataUrl) {
    try {
      doc.addImage(logoDataUrl ?? brand.logoDataUrl, 'PNG', 8, 4, 24, 14);
    } catch {}
  }
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(15);
  doc.text('Set Plan • ' + (brand.name || ','), 40, 12);
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Scene: ${scene.id}   Version: ${scene.version}`, 40, 18);
}

function drawFooter(doc: any) {
  const brand = getBrand();
  doc.setFillColor(248, 250, 252);
  doc.rect(0, 287, 210, 10, 'F');
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(9);
  doc.text(`${brand.name}  •  ${brand.website ?? ', '}`, 105, 293, { align: 'center' });
}

function drawTables(doc: any, scene: Scene, originY: number) {
  let y = originY;
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('Cameras', 20, y);
  y += 5;
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  scene.nodes
    .filter((n) => n.camera)
    .forEach((n) => {
      const c = n.camera!;
      doc.text(
        `• ${n.name || n.id}: ${c.focalLength}mm, f/${c.aperture}, ISO ${c.iso}, ${c.shutter}s`,
        24,
        y,
      );
      y += 5;
    });

  y += 3;
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('Lights', 20, y);
  y += 5;
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  scene.nodes
    .filter((n) => n.light)
    .forEach((n) => {
      const l = n.light!;
      doc.text(
        `• ${n.name || n.id}: power ${Math.round((l.power ?? 0) * 100)}%, beam ${l.beam ?? '-'}°, modifier ${l.modifier ?? '-'}`,
        24,
        y,
      );
      y += 5;
    });

  return y + 2;
}

export async function exportPDF(scene: Scene, options?: { logoDataUrl?: string }) {
  const jsPDF = await getJSPDF();
  if (!jsPDF) {
    alert('Install jsPDF to enable PDF export: npm i jspdf');
    return;
  }
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  drawHeader(doc, scene, options?.logoDataUrl);

  const nextY = drawTables(doc, scene, 28);

  const frame = { x: 110, y: 35, w: 90, h: 140 };
  doc.setDrawColor(226, 232, 240);
  doc.rect(frame.x - 2, frame.y - 2, frame.w + 4, frame.h + 4);
  drawRoomScaled(doc, scene, frame, options?.measurements);

  drawFooter(doc);
  doc.save('setplan.pdf');
}

export function exportPNGfromCanvas(canvas: HTMLCanvasElement, name ='preview.png') {
  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
}
