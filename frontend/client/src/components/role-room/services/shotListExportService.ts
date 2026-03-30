import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import type { CastingShot, SceneBreakdown, ShotList, StoryboardFrame } from '../models/casting';
import type { ShotListSummary } from '../models/derivedState';

export interface ShotListExportPayload {
  projectName?: string;
  shotLists: ShotList[];
  sceneMap?: Map<string, SceneBreakdown>;
  summaryMap?: Map<string, ShotListSummary>;
}

interface ResolvedShotEntry {
  shotList: ShotList;
  shot: CastingShot;
  scene?: SceneBreakdown;
  frame?: StoryboardFrame;
  shotIndex: number;
}

const NB_NO_DATE = new Intl.DateTimeFormat('nb-NO', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'shot-list';

const formatSceneName = (shotList: ShotList, scene?: SceneBreakdown): string =>
  shotList.sceneName
  || scene?.sceneName
  || scene?.heading
  || scene?.sceneHeading
  || shotList.sceneId;

const resolveShotFrame = (shot: CastingShot, scene?: SceneBreakdown): StoryboardFrame | undefined => {
  if (!scene || !Array.isArray(scene.storyboardFrames) || typeof shot.storyboardFrameId !== 'string') {
    return undefined;
  }
  return scene.storyboardFrames.find((frame) => frame.id === shot.storyboardFrameId);
};

const resolveShotImageUrl = (shot: CastingShot, frame?: StoryboardFrame): string | undefined =>
  (typeof shot.imageUrl === 'string' && shot.imageUrl.trim().length > 0 ? shot.imageUrl : undefined)
  || (typeof frame?.thumbnailUrl === 'string' && frame.thumbnailUrl.trim().length > 0 ? frame.thumbnailUrl : undefined)
  || (typeof frame?.imageUrl === 'string' && frame.imageUrl.trim().length > 0 ? frame.imageUrl : undefined);

const getShotDurationLabel = (shot: CastingShot): string => {
  const duration = typeof shot.duration === 'number' && Number.isFinite(shot.duration)
    ? shot.duration
    : typeof shot.estimatedTime === 'number' && Number.isFinite(shot.estimatedTime)
      ? shot.estimatedTime
      : null;
  return duration ? `${Math.max(1, Math.round(duration))}s` : 'Varighet ukjent';
};

const getShotSubtitle = (shot: CastingShot): string => {
  const parts = [
    shot.shotType || 'Shot',
    shot.cameraAngle,
    shot.cameraMovement,
    getShotDurationLabel(shot),
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

  return parts.join(' • ');
};

const getShotDeckTitle = (shot: CastingShot, frame?: StoryboardFrame, shotIndex?: number): string =>
  frame?.shotNumber
  || frame?.title
  || shot.description
  || `Shot ${typeof shotIndex === 'number' ? shotIndex + 1 : ''}`.trim();

const getImageFormat = (dataUrl: string): 'PNG' | 'JPEG' => (
  dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg') ? 'JPEG' : 'PNG'
);

const dataUrlCache = new Map<string, Promise<string | null>>();

async function loadImageAsDataUrl(url?: string): Promise<string | null> {
  if (!url || url.trim().length === 0) return null;
  if (url.startsWith('data:')) return url;

  const cached = dataUrlCache.get(url);
  if (cached) return cached;

  const promise = (async () => {
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      const blob = await response.blob();
      return await new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  })();

  dataUrlCache.set(url, promise);
  return promise;
}

function addPlaceholderImage(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  label = 'Ingen frame tilgjengelig',
): void {
  doc.setDrawColor(210, 214, 220);
  doc.setFillColor(244, 246, 248);
  doc.roundedRect(x, y, width, height, 2, 2, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120, 126, 138);
  doc.text(label, x + width / 2, y + height / 2, { align: 'center' });
}

async function addResolvedImage(
  doc: jsPDF,
  url: string | undefined,
  x: number,
  y: number,
  width: number,
  height: number,
  label?: string,
): Promise<void> {
  const dataUrl = await loadImageAsDataUrl(url);
  if (!dataUrl) {
    addPlaceholderImage(doc, x, y, width, height, label);
    return;
  }

  try {
    doc.addImage(dataUrl, getImageFormat(dataUrl), x, y, width, height, undefined, 'FAST');
  } catch {
    addPlaceholderImage(doc, x, y, width, height, label);
  }
}

function resolveShotEntries(payload: ShotListExportPayload): ResolvedShotEntry[] {
  return payload.shotLists.flatMap((shotList) => {
    const scene = payload.sceneMap?.get(shotList.sceneId);
    return shotList.shots.map((shot, shotIndex) => ({
      shotList,
      shot,
      scene,
      frame: resolveShotFrame(shot, scene),
      shotIndex,
    }));
  });
}

function buildBaseFilename(payload: ShotListExportPayload, suffix: string): string {
  const sceneName =
    payload.shotLists.length === 1
      ? formatSceneName(payload.shotLists[0], payload.sceneMap?.get(payload.shotLists[0].sceneId))
      : payload.projectName || 'shot-lists';
  return `${slugify(sceneName)}-${suffix}.pdf`;
}

function addExportHeader(
  doc: jsPDF,
  title: string,
  subtitle: string,
  x: number,
  y: number,
): void {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(24, 30, 42);
  doc.text(title, x, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(102, 112, 133);
  doc.text(subtitle, x, y + 7);
}

export async function exportShotListsBoardPdf(payload: ShotListExportPayload): Promise<void> {
  if (payload.shotLists.length === 0) return;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const margin = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;

  addExportHeader(
    doc,
    payload.projectName || 'Storyboard Board PDF',
    `Eksportert ${NB_NO_DATE.format(new Date())} • ${payload.shotLists.length} shotlist${payload.shotLists.length === 1 ? '' : 'er'}`,
    margin,
    18,
  );

  autoTable(doc, {
    startY: 32,
    head: [['Scene', 'Shots', 'Storyboard', 'Coverage', 'Linked']],
    body: payload.shotLists.map((shotList) => {
      const scene = payload.sceneMap?.get(shotList.sceneId);
      const summary = payload.summaryMap?.get(shotList.id)
        || payload.summaryMap?.get(shotList.sceneId)
        || undefined;
      return [
        formatSceneName(shotList, scene),
        String(shotList.shots.length),
        String(summary?.storyboardFrameCount ?? (Array.isArray(scene?.storyboardFrames) ? scene.storyboardFrames.length : 0)),
        `${summary?.storyboardCoverage.coveredFrames ?? 0}/${summary?.storyboardCoverage.totalFrames ?? 0}`,
        String(summary?.storyboardCoverage.linkedShots ?? 0),
      ];
    }),
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: 2.2,
      lineColor: [224, 229, 236],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [24, 30, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    margin: { left: margin, right: margin },
  });

  for (const shotList of payload.shotLists) {
    const scene = payload.sceneMap?.get(shotList.sceneId);
    const summary = payload.summaryMap?.get(shotList.id) || payload.summaryMap?.get(shotList.sceneId);
    const coverageLabel = summary?.storyboardCoverage.totalFrames
      ? `${summary.storyboardCoverage.coveredFrames}/${summary.storyboardCoverage.totalFrames} frames brukt`
      : 'Ingen scene-storyboard';

    doc.addPage('a4', 'landscape');
    addExportHeader(
      doc,
      formatSceneName(shotList, scene),
      `${shotList.shots.length} shots • ${coverageLabel}`,
      margin,
      18,
    );

    let y = 30;
    for (let index = 0; index < shotList.shots.length; index += 2) {
      const rowShots = shotList.shots.slice(index, index + 2);
      const rowHeight = 78;
      if (y + rowHeight > pageHeight - margin) {
        doc.addPage('a4', 'landscape');
        y = margin;
      }

      for (let column = 0; column < rowShots.length; column += 1) {
        const shot = rowShots[column];
        const frame = resolveShotFrame(shot, scene);
        const cardWidth = (contentWidth - 8) / 2;
        const x = margin + column * (cardWidth + 8);
        const imageWidth = 86;
        const imageHeight = 48;

        doc.setFillColor(250, 251, 253);
        doc.setDrawColor(224, 229, 236);
        doc.roundedRect(x, y, cardWidth, rowHeight - 4, 3, 3, 'FD');

        const imageX = x + 4;
        const imageY = y + 8;
        await addResolvedImage(
          doc,
          resolveShotImageUrl(shot, frame),
          imageX,
          imageY,
          imageWidth,
          imageHeight,
          'Ingen preview',
        );

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(24, 30, 42);
        doc.text(getShotDeckTitle(shot, frame, index + column), x + 4, y + 6);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(84, 92, 107);
        const metaX = imageX + imageWidth + 6;
        const metaWidth = cardWidth - imageWidth - 14;
        const description = doc.splitTextToSize(shot.description || frame?.description || 'Uten beskrivelse', metaWidth);
        doc.text(description.slice(0, 6), metaX, imageY + 4);
        doc.text(getShotSubtitle(shot), metaX, imageY + 33);
        const noteLabel = frame?.shotNumber
          ? `Storyboard ${frame.shotNumber}`
          : shot.notes && shot.notes.trim().length > 0
            ? shot.notes
            : 'Fri shot';
        doc.text(noteLabel, metaX, imageY + 40);
      }

      y += rowHeight;
    }
  }

  doc.save(buildBaseFilename(payload, 'board'));
}

export async function exportShotListsContactSheetPdf(payload: ShotListExportPayload): Promise<void> {
  const entries = resolveShotEntries(payload);
  if (entries.length === 0) return;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const margin = 12;
  const pageWidth = doc.internal.pageSize.getWidth();
  const cellWidth = 88;
  const cellHeight = 58;
  const columns = 3;
  const gap = 6;
  const startY = 30;
  const rowsPerPage = 2;
  const pageCapacity = columns * rowsPerPage;

  for (let start = 0; start < entries.length; start += pageCapacity) {
    if (start > 0) {
      doc.addPage('a4', 'landscape');
    }

    addExportHeader(
      doc,
      payload.projectName || 'Contact Sheet',
      `Eksportert ${NB_NO_DATE.format(new Date())}`,
      margin,
      16,
    );

    const pageEntries = entries.slice(start, start + pageCapacity);
    for (let index = 0; index < pageEntries.length; index += 1) {
      const entry = pageEntries[index];
      const row = Math.floor(index / columns);
      const column = index % columns;
      const x = margin + column * (cellWidth + gap);
      const y = startY + row * (cellHeight + 18);

      await addResolvedImage(
        doc,
        resolveShotImageUrl(entry.shot, entry.frame),
        x,
        y,
        cellWidth,
        cellHeight,
        'Ingen preview',
      );

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(20, 26, 38);
      doc.text(getShotDeckTitle(entry.shot, entry.frame, entry.shotIndex), x, y + cellHeight + 5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(90, 98, 112);
      doc.text(formatSceneName(entry.shotList, entry.scene), x, y + cellHeight + 10);
    }
  }

  doc.save(buildBaseFilename(payload, 'contact-sheet'));
}

export async function exportShotListsShotDeckPdf(payload: ShotListExportPayload): Promise<void> {
  const entries = resolveShotEntries(payload);
  if (entries.length === 0) return;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const margin = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let index = 0; index < entries.length; index += 1) {
    if (index > 0) {
      doc.addPage('a4', 'landscape');
    }
    const entry = entries[index];

    addExportHeader(
      doc,
      getShotDeckTitle(entry.shot, entry.frame, entry.shotIndex),
      `${formatSceneName(entry.shotList, entry.scene)} • ${getShotSubtitle(entry.shot)}`,
      margin,
      18,
    );

    await addResolvedImage(
      doc,
      resolveShotImageUrl(entry.shot, entry.frame),
      margin,
      28,
      pageWidth - margin * 2,
      130,
      'Ingen preview',
    );

    autoTable(doc, {
      startY: 166,
      head: [['Felt', 'Verdi']],
      body: [
        ['Scene', formatSceneName(entry.shotList, entry.scene)],
        ['Beskrivelse', entry.shot.description || entry.frame?.description || 'Uten beskrivelse'],
        ['Storyboard', entry.frame?.shotNumber || 'Ikke koblet til scene-frame'],
        ['Kamera', `${entry.shot.cameraAngle || 'Eye Level'} • ${entry.shot.cameraMovement || 'Static'}`],
        ['Varighet', getShotDurationLabel(entry.shot)],
        ['Notater', entry.shot.notes || 'Ingen notater'],
      ],
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 2.4,
        lineColor: [224, 229, 236],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [24, 30, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { cellWidth: 34, fontStyle: 'bold' },
        1: { cellWidth: pageWidth - margin * 2 - 34 },
      },
      margin: { left: margin, right: margin },
    });
  }

  doc.save(buildBaseFilename(payload, 'shot-deck'));
}
