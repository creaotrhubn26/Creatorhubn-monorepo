/**
 * Feed-plan PDF export.
 *
 * Vector-drawn with jsPDF for crisp text + brand colors at any zoom level.
 * Uploaded images (customImageUrl) are embedded; placeholder concepts get a
 * brand-color gradient panel so every page reflects the merket.
 *
 * Page structure:
 *   1. Cover  — Role Room wordmark, brand name, platform, generated date
 *   2. Brand  — logo, color palette, tone, visual style, dos/donts
 *   3. Feed   — 3×N visual grid preview
 *   4..N      — one detail page per post (image, title, caption, hashtags,
 *               CTA, scheduled date)
 */

import jsPDF from 'jspdf';
import type {
  RoleRoomFeedBrandSnapshot,
  RoleRoomFeedPlatform,
  RoleRoomFeedPost,
  RoleRoomFeedPostConcept,
} from '../services/roleRoomAgentService';
import { CONCEPT_LABELS } from './feedPlanner';
import type { RoleRoomTierSlug } from '../components/producer/RoleRoomTierIcon';

const A4_WIDTH_MM = 297;
const A4_HEIGHT_MM = 210;
const MARGIN = 14;

const ROLE_ROOM_INK = '#0b1220';
const ROLE_ROOM_TEXT = '#e2e8f0';
const ROLE_ROOM_TEXT_MUTED = '#94a3b8';
const ROLE_ROOM_ACCENT = '#22d3ee';
const ROLE_ROOM_ACCENT_2 = '#a855f7';

const TIER_LABELS: Record<RoleRoomTierSlug, string> = {
  spotlight: 'Spotlight',
  headliner: 'Headliner',
  showrunner: 'Showrunner',
  admin: 'Admin',
};

interface GenerateFeedPlanPdfInput {
  brand: RoleRoomFeedBrandSnapshot | null;
  platform: RoleRoomFeedPlatform;
  posts: RoleRoomFeedPost[];
  tier?: RoleRoomTierSlug;
  generatedAt?: Date;
}

const WEEKDAY_NB = ['søn', 'man', 'tir', 'ons', 'tor', 'fre', 'lør'];
const MONTH_NB = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des'];

function formatDateLong(iso: string | null): string {
  if (!iso) return 'Tidspunkt ikke satt';
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return 'Tidspunkt ikke satt';
    const pad = (value: number) => value.toString().padStart(2, '0');
    return `${WEEKDAY_NB[date.getDay()]} ${date.getDate()} ${MONTH_NB[date.getMonth()]} ${date.getFullYear()} kl ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  } catch {
    return 'Tidspunkt ikke satt';
  }
}

function platformLabel(platform: RoleRoomFeedPlatform): string {
  switch (platform) {
    case 'instagram':
      return 'Instagram';
    case 'tiktok':
      return 'TikTok';
    case 'linkedin':
      return 'LinkedIn';
    default:
      return platform;
  }
}

function rgbFromHex(hex: string | null | undefined, fallback: [number, number, number]): [number, number, number] {
  if (!hex) return fallback;
  const cleaned = hex.replace('#', '');
  const value = cleaned.length === 3 ? cleaned.split('').map((c) => c + c).join('') : cleaned.padEnd(6, '0').slice(0, 6);
  try {
    return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
  } catch {
    return fallback;
  }
}

function setFill(doc: jsPDF, hex: string | null | undefined, fallback: [number, number, number]) {
  const [r, g, b] = rgbFromHex(hex, fallback);
  doc.setFillColor(r, g, b);
}

function setStroke(doc: jsPDF, hex: string | null | undefined, fallback: [number, number, number]) {
  const [r, g, b] = rgbFromHex(hex, fallback);
  doc.setDrawColor(r, g, b);
}

function setText(doc: jsPDF, hex: string) {
  const [r, g, b] = rgbFromHex(hex, [255, 255, 255]);
  doc.setTextColor(r, g, b);
}

function paintBackground(doc: jsPDF, color = ROLE_ROOM_INK) {
  setFill(doc, color, [11, 18, 32]);
  doc.rect(0, 0, A4_WIDTH_MM, A4_HEIGHT_MM, 'F');
}

function drawHeaderBar(doc: jsPDF, brand: RoleRoomFeedBrandSnapshot | null, tier?: RoleRoomTierSlug) {
  // Top thin gradient (drawn as two stripes)
  setFill(doc, ROLE_ROOM_ACCENT, [34, 211, 238]);
  doc.rect(0, 0, A4_WIDTH_MM / 2, 1.2, 'F');
  setFill(doc, ROLE_ROOM_ACCENT_2, [168, 85, 247]);
  doc.rect(A4_WIDTH_MM / 2, 0, A4_WIDTH_MM / 2, 1.2, 'F');

  // Wordmark
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  setText(doc, ROLE_ROOM_TEXT);
  doc.text('THE ROLE ROOM', MARGIN, 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  setText(doc, ROLE_ROOM_TEXT_MUTED);
  doc.text('Innholdsplan generert av feed-planner', MARGIN, 11.6);

  if (tier) {
    const tierLabel = `Role Room ${TIER_LABELS[tier] ?? tier}`;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    const w = doc.getTextWidth(tierLabel) + 5;
    setFill(doc, ROLE_ROOM_ACCENT, [34, 211, 238]);
    doc.roundedRect(A4_WIDTH_MM - MARGIN - w, 4.5, w, 5.4, 1.2, 1.2, 'F');
    setText(doc, '#0b1220');
    doc.text(tierLabel, A4_WIDTH_MM - MARGIN - w + 2.5, 8.2);
  }

  if (brand?.companyName) {
    setText(doc, ROLE_ROOM_TEXT_MUTED);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(brand.companyName, A4_WIDTH_MM - MARGIN, 12.6, { align: 'right' });
  }
}

function drawFooterBar(doc: jsPDF, pageNumber: number, totalPages: number) {
  doc.setDrawColor(40, 50, 70);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, A4_HEIGHT_MM - 10, A4_WIDTH_MM - MARGIN, A4_HEIGHT_MM - 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  setText(doc, ROLE_ROOM_TEXT_MUTED);
  doc.text('theroleroom.com', MARGIN, A4_HEIGHT_MM - 6);
  doc.text(`Side ${pageNumber} / ${totalPages}`, A4_WIDTH_MM - MARGIN, A4_HEIGHT_MM - 6, { align: 'right' });
}

async function drawImageOrPlaceholder(
  doc: jsPDF,
  post: RoleRoomFeedPost,
  x: number,
  y: number,
  width: number,
  height: number,
  brand: RoleRoomFeedBrandSnapshot | null,
  showText: boolean,
) {
  if (post.customImageUrl) {
    try {
      doc.addImage(post.customImageUrl, 'JPEG', x, y, width, height, undefined, 'FAST');
      return;
    } catch {
      // fall through to placeholder
    }
  }

  // Placeholder: solid background + diagonal stripe overlay for visual variety
  setFill(doc, post.backgroundColor || brand?.primaryColor || ROLE_ROOM_INK, [15, 23, 42]);
  doc.rect(x, y, width, height, 'F');

  setFill(doc, post.accentColor || brand?.accentColor || ROLE_ROOM_ACCENT, [34, 211, 238]);
  doc.rect(x, y + height * 0.7, width, height * 0.3, 'F');

  if (showText) {
    setText(doc, post.textColor || '#f8fafc');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(Math.max(7, Math.floor(width / 6)));
    const titleLines = doc.splitTextToSize(post.title || 'Ingen tittel', width - 4);
    doc.text(titleLines.slice(0, 2), x + 2, y + 6);

    setText(doc, '#0b1220');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text(post.callToAction || 'Les mer', x + 2, y + height - 2);
  }
}

function drawCoverPage(
  doc: jsPDF,
  input: GenerateFeedPlanPdfInput,
  generatedAt: Date,
) {
  paintBackground(doc);
  drawHeaderBar(doc, input.brand, input.tier);

  // Brand-color accent stripes left side
  setFill(doc, input.brand?.primaryColor || ROLE_ROOM_ACCENT, [34, 211, 238]);
  doc.rect(MARGIN, 30, 4, A4_HEIGHT_MM - 60, 'F');

  setFill(doc, input.brand?.secondaryColor || ROLE_ROOM_ACCENT_2, [168, 85, 247]);
  doc.rect(MARGIN + 6, 30, 2, A4_HEIGHT_MM - 60, 'F');

  // Title
  setText(doc, ROLE_ROOM_TEXT);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(36);
  doc.text('Innholdsplan', MARGIN + 16, 60);

  doc.setFontSize(20);
  setText(doc, ROLE_ROOM_TEXT);
  const brandLine = input.brand?.companyName || 'Ukjent merke';
  doc.text(brandLine, MARGIN + 16, 76);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  setText(doc, ROLE_ROOM_TEXT_MUTED);
  doc.text(`${platformLabel(input.platform)} · ${input.posts.length} planlagte innlegg`, MARGIN + 16, 86);

  // Generated date
  doc.setFontSize(10);
  setText(doc, ROLE_ROOM_TEXT_MUTED);
  doc.text(`Generert ${formatDateLong(generatedAt.toISOString())}`, MARGIN + 16, A4_HEIGHT_MM - 26);

  // Tone + visual style summary block
  if (input.brand?.toneOfVoice || input.brand?.visualStyle) {
    setFill(doc, '#111c33', [17, 28, 51]);
    doc.roundedRect(A4_WIDTH_MM - MARGIN - 90, 60, 88, 60, 3, 3, 'F');

    setText(doc, ROLE_ROOM_ACCENT);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('TONE & STIL', A4_WIDTH_MM - MARGIN - 86, 70);

    setText(doc, ROLE_ROOM_TEXT);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const tone = input.brand.toneOfVoice || 'Ikke satt';
    const visual = input.brand.visualStyle || 'Ikke satt';
    const lines = [
      ...doc.splitTextToSize(`Tone: ${tone}`, 80),
      ...doc.splitTextToSize(`Stil: ${visual}`, 80),
    ];
    doc.text(lines.slice(0, 6), A4_WIDTH_MM - MARGIN - 86, 78);
  }
}

function drawBrandPage(doc: jsPDF, input: GenerateFeedPlanPdfInput) {
  paintBackground(doc);
  drawHeaderBar(doc, input.brand, input.tier);

  setText(doc, ROLE_ROOM_TEXT);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('Brand-grunnlag', MARGIN, 30);

  // Logo (if available)
  let logoX = MARGIN;
  let nextY = 38;
  if (input.brand?.logoUrl) {
    try {
      // Logo can be PNG or other — guess from prefix; safe fallback to PNG.
      const format = input.brand.logoUrl.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
      doc.addImage(input.brand.logoUrl, format as any, MARGIN, nextY, 30, 30, undefined, 'FAST');
      logoX = MARGIN + 36;
    } catch {
      logoX = MARGIN;
    }
  }

  setText(doc, ROLE_ROOM_TEXT);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(input.brand?.companyName || 'Ukjent merke', logoX, nextY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  setText(doc, ROLE_ROOM_TEXT_MUTED);
  if (input.brand?.toneOfVoice) {
    doc.text(`Tone: ${input.brand.toneOfVoice}`, logoX, nextY + 14);
  }
  if (input.brand?.visualStyle) {
    doc.text(`Stil: ${input.brand.visualStyle}`, logoX, nextY + 20);
  }

  // Color palette
  const swatchY = nextY + 38;
  setText(doc, ROLE_ROOM_TEXT);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Fargepalett', MARGIN, swatchY - 4);

  const colors: Array<{ label: string; hex: string }> = [
    input.brand?.primaryColor ? { label: 'Primær', hex: input.brand.primaryColor } : null,
    input.brand?.secondaryColor ? { label: 'Sekundær', hex: input.brand.secondaryColor } : null,
    input.brand?.accentColor ? { label: 'Accent', hex: input.brand.accentColor } : null,
  ].filter((entry): entry is { label: string; hex: string } => entry !== null);

  let swatchX = MARGIN;
  for (const color of colors) {
    setFill(doc, color.hex, [34, 211, 238]);
    doc.roundedRect(swatchX, swatchY, 28, 28, 2, 2, 'F');

    setText(doc, ROLE_ROOM_TEXT);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(color.label.toUpperCase(), swatchX, swatchY + 36);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    setText(doc, ROLE_ROOM_TEXT_MUTED);
    doc.text(color.hex.toUpperCase(), swatchX, swatchY + 41);

    swatchX += 38;
  }

  // Posts summary
  setText(doc, ROLE_ROOM_TEXT);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Innholdsplan i tall', MARGIN, swatchY + 60);

  const concepts = new Map<string, number>();
  let scheduled = 0;
  for (const post of input.posts) {
    concepts.set(String(post.concept), (concepts.get(String(post.concept)) ?? 0) + 1);
    if (post.scheduledFor) scheduled += 1;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  setText(doc, ROLE_ROOM_TEXT_MUTED);
  let lineY = swatchY + 68;
  doc.text(`Totalt ${input.posts.length} planlagte innlegg, ${scheduled} med dato.`, MARGIN, lineY);
  lineY += 6;
  for (const [concept, count] of concepts.entries()) {
    const label = CONCEPT_LABELS[concept as RoleRoomFeedPostConcept] || concept;
    doc.text(`• ${label}: ${count}`, MARGIN + 2, lineY);
    lineY += 5;
  }
}

async function drawFeedGridPage(doc: jsPDF, input: GenerateFeedPlanPdfInput) {
  paintBackground(doc);
  drawHeaderBar(doc, input.brand, input.tier);

  setText(doc, ROLE_ROOM_TEXT);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(`${platformLabel(input.platform)}-feed`, MARGIN, 30);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setText(doc, ROLE_ROOM_TEXT_MUTED);
  doc.text('Visualisering av planlagt feed-rekkefølge.', MARGIN, 36);

  const gridLeft = MARGIN;
  const gridTop = 44;
  const cols = 6;
  const gap = 2.4;
  const cellWidth = (A4_WIDTH_MM - MARGIN * 2 - gap * (cols - 1)) / cols;
  const cellHeight = cellWidth * 1.25; // 4:5

  for (let i = 0; i < input.posts.length; i += 1) {
    const post = input.posts[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = gridLeft + col * (cellWidth + gap);
    const y = gridTop + row * (cellHeight + gap);
    if (y + cellHeight > A4_HEIGHT_MM - 14) break;
    await drawImageOrPlaceholder(doc, post, x, y, cellWidth, cellHeight, input.brand, true);

    // Index badge top-left
    setFill(doc, '#0b1220', [11, 18, 32]);
    doc.roundedRect(x + 1, y + 1, 6, 5, 0.8, 0.8, 'F');
    setText(doc, ROLE_ROOM_ACCENT);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.text(`#${i + 1}`, x + 2, y + 4.5);
  }
}

function drawPostDetailPage(
  doc: jsPDF,
  input: GenerateFeedPlanPdfInput,
  post: RoleRoomFeedPost,
  postIndex: number,
) {
  paintBackground(doc);
  drawHeaderBar(doc, input.brand, input.tier);

  // Left: visual
  const visualSize = 100;
  drawImageOrPlaceholder(
    doc,
    post,
    MARGIN,
    30,
    visualSize * 0.8,
    visualSize,
    input.brand,
    !post.customImageUrl,
  );

  // Right: meta
  const rightX = MARGIN + visualSize * 0.8 + 10;
  const rightWidth = A4_WIDTH_MM - rightX - MARGIN;

  // Index + concept badge
  setFill(doc, ROLE_ROOM_ACCENT, [34, 211, 238]);
  doc.roundedRect(rightX, 30, 18, 6, 1, 1, 'F');
  setText(doc, '#0b1220');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(`#${postIndex + 1}`, rightX + 2, 34);

  setText(doc, ROLE_ROOM_TEXT_MUTED);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(
    CONCEPT_LABELS[post.concept as RoleRoomFeedPostConcept] || String(post.concept),
    rightX + 22,
    34,
  );

  // Title
  setText(doc, ROLE_ROOM_TEXT);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  const titleLines = doc.splitTextToSize(post.title || 'Ingen tittel', rightWidth);
  doc.text(titleLines.slice(0, 3), rightX, 46);

  // Caption
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  setText(doc, ROLE_ROOM_TEXT_MUTED);
  doc.text('CAPTION', rightX, 70);

  setText(doc, ROLE_ROOM_TEXT);
  doc.setFontSize(10);
  const captionLines = doc.splitTextToSize(post.caption || '(Ingen caption)', rightWidth);
  doc.text(captionLines.slice(0, 12), rightX, 76);

  // Hashtags
  let bottomY = 76 + Math.min(captionLines.length, 12) * 4.5 + 6;
  if (post.hashtags && post.hashtags.length > 0) {
    setText(doc, ROLE_ROOM_TEXT_MUTED);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('HASHTAGS', rightX, bottomY);
    bottomY += 4;
    setText(doc, ROLE_ROOM_ACCENT);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const hashtagsText = post.hashtags.join('  ');
    const hashLines = doc.splitTextToSize(hashtagsText, rightWidth);
    doc.text(hashLines.slice(0, 4), rightX, bottomY);
    bottomY += Math.min(hashLines.length, 4) * 4.4 + 4;
  }

  // CTA + scheduled
  setText(doc, ROLE_ROOM_TEXT_MUTED);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('CALL TO ACTION', rightX, bottomY);
  bottomY += 4;
  setText(doc, ROLE_ROOM_TEXT);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(post.callToAction || '(ingen)', rightX, bottomY);
  bottomY += 8;

  setText(doc, ROLE_ROOM_TEXT_MUTED);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('PUBLISERINGSTIDSPUNKT', rightX, bottomY);
  bottomY += 4;
  setText(doc, ROLE_ROOM_TEXT);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(formatDateLong(post.scheduledFor), rightX, bottomY);

  // Image style note (under visual)
  if (post.imageStyle) {
    setText(doc, ROLE_ROOM_TEXT_MUTED);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    const noteLines = doc.splitTextToSize(`Bildestil: ${post.imageStyle}`, visualSize * 0.8);
    doc.text(noteLines.slice(0, 3), MARGIN, 30 + visualSize + 6);
  }
}

export async function generateFeedPlanPdf(input: GenerateFeedPlanPdfInput): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const generatedAt = input.generatedAt ?? new Date();

  drawCoverPage(doc, input, generatedAt);

  doc.addPage();
  drawBrandPage(doc, input);

  doc.addPage();
  await drawFeedGridPage(doc, input);

  for (let i = 0; i < input.posts.length; i += 1) {
    doc.addPage();
    drawPostDetailPage(doc, input, input.posts[i], i);
  }

  // Now stamp footers (need totalPages first)
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p += 1) {
    doc.setPage(p);
    drawFooterBar(doc, p, totalPages);
  }

  return doc.output('blob');
}

export function downloadFeedPlanPdf(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
