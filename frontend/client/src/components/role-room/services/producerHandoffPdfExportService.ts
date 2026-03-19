import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
  ProducerClientIntake,
  ProducerClientMaterial,
  ProducerPlanningFrameworkStepKey,
  ProducerProjectPlanning,
} from '../models/casting';
import type { ContentProductionEstimate } from './contentProductionEstimateService';
import { ROLE_ROOM_BRAND_ASSETS } from '../config/branding';
import {
  type ProducerDeliveryManifest,
  getProducerClientContributionTasks,
  PRODUCER_CLIENT_CONTRIBUTION_SOURCE_LABELS,
  PRODUCER_CLIENT_CONTRIBUTION_STATUS_LABELS,
  PRODUCER_PLANNING_CLIENT_MOMENT_LABELS,
  PRODUCER_PLANNING_FRAMEWORK_LABELS,
  PRODUCER_PLANNING_PHASE_LABELS,
} from '../utils/producerProjectPlanning';

export interface ProducerHandoffPdfExportPayload {
  projectName: string;
  planning: ProducerProjectPlanning;
  manifest: ProducerDeliveryManifest;
  estimate: ContentProductionEstimate;
  clientIntake: ProducerClientIntake;
  clientMaterials: ProducerClientMaterial[];
  generatedAt?: Date;
}

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 16;

const sanitizeFileName = (value: string): string => (
  value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\-_]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'role-room-handoff'
);

const formatDateTime = (value: Date | string, locale = 'nb-NO'): string => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return typeof value === 'string' ? value : '';
  }
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const toDisplayValue = (value: unknown): string => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '-';
  }
  if (typeof value === 'boolean') {
    return value ? 'Ja' : 'Nei';
  }
  if (typeof value === 'string') {
    return value.trim() || '-';
  }
  return '-';
};

const toPdfWrappedText = (value: string): string => (
  value
    .replace(/([/@._-])/g, '$1 ')
    .replace(/\?([^ ])/g, '? $1')
    .replace(/&([^ ])/g, '& $1')
    .replace(/=([^ ])/g, '= $1')
);

const MATERIAL_TYPE_LABELS: Record<string, string> = {
  brief_note: 'Briefnotat',
  asset_link: 'Lenke',
  brand_asset: 'Merkevarefil',
  reference: 'Referanse',
  document: 'Dokument',
  feedback: 'Tilbakemelding',
};

const MATERIAL_PRIORITY_LABELS: Record<'critical' | 'important' | 'reference', string> = {
  critical: 'Kritisk',
  important: 'Viktig',
  reference: 'Referanse',
};

const asRecord = (value: unknown): Record<string, unknown> => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
);

const readFirstNonEmptyString = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return '';
};

const parseClientMaterialMetadata = (material: ProducerClientMaterial) => {
  const metadata = asRecord(material.metadata);
  const rawPriority = readFirstNonEmptyString(metadata.priority);
  return {
    fileName: readFirstNonEmptyString(metadata.fileName, metadata.filename),
    versionLabel: readFirstNonEmptyString(metadata.versionLabel, metadata.version),
    usageNotes: readFirstNonEmptyString(metadata.usageNotes, metadata.usage),
    sourceLabel: readFirstNonEmptyString(metadata.sourceLabel, metadata.source),
    priority: rawPriority === 'critical' || rawPriority === 'reference' ? rawPriority : 'important',
  } as const;
};

class ProducerHandoffPdfExportService {
  private logoDataUrlPromise: Promise<string | null> | null = null;

  async exportReport(payload: ProducerHandoffPdfExportPayload): Promise<void> {
    const generatedAt = payload.generatedAt ?? new Date();
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const logoDataUrl = await this.getLogoDataUrl();

    this.addCoverPage(doc, payload, generatedAt, logoDataUrl);
    this.addStrategyPage(doc, payload);
    this.addFrameworkPage(doc, payload);
    this.addClientFlowPage(doc, payload);
    this.addDeliveryPage(doc, payload);
    this.addBrandAndWorkflowPage(doc, payload);
    this.addClientInputPage(doc, payload);
    this.addEstimatePage(doc, payload);
    this.addFooter(doc, generatedAt);

    doc.save(`${sanitizeFileName(payload.projectName)}-klientpakke.pdf`);
  }

  private addCoverPage(
    doc: jsPDF,
    payload: ProducerHandoffPdfExportPayload,
    generatedAt: Date,
    logoDataUrl: string | null,
  ): void {
    doc.setFillColor(8, 12, 20);
    doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, 'F');

    doc.setFillColor(139, 92, 246);
    doc.rect(0, 0, PAGE_WIDTH, 7, 'F');
    doc.setFillColor(0, 212, 255);
    doc.rect(0, 7, PAGE_WIDTH, 2.5, 'F');

    if (logoDataUrl) {
      doc.addImage(logoDataUrl, 'PNG', MARGIN, 18, 62, 18);
    }

    doc.setTextColor(203, 213, 225);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('THE ROLE ROOM · KLIENTPAKKE', MARGIN, 48);

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(26);
    const titleLines = doc.splitTextToSize(payload.projectName, PAGE_WIDTH - MARGIN * 2);
    doc.text(titleLines, MARGIN, 66);

    let cursorY = 66 + titleLines.length * 10;
    doc.setTextColor(191, 219, 254);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(13);
    const subtitle = [
      payload.manifest.direction || 'Retning ikke satt',
      payload.manifest.idea || 'Idé ikke satt',
      payload.manifest.activation || 'Aktivering ikke satt',
    ].join(' · ');
    const subtitleLines = doc.splitTextToSize(subtitle, PAGE_WIDTH - MARGIN * 2);
    doc.text(subtitleLines, MARGIN, cursorY);
    cursorY += subtitleLines.length * 6 + 12;

    doc.setFillColor(15, 23, 42);
    doc.setDrawColor(96, 165, 250);
    doc.roundedRect(MARGIN, cursorY, PAGE_WIDTH - MARGIN * 2, 42, 4, 4, 'FD');

    const metrics = [
      ['Mål', payload.manifest.businessGoal || 'Ikke satt'],
      ['Målgruppe', payload.manifest.targetAudience || 'Ikke satt'],
      ['Hovedleveranse', payload.manifest.primaryDeliveryLabel],
      ['Opptaksdager', String(payload.manifest.recommendedShootDays)],
    ];

    metrics.forEach(([label, value], index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = MARGIN + 5 + column * 86;
      const y = cursorY + 9 + row * 16;
      doc.setTextColor(148, 163, 184);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(label, x, y);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(doc.splitTextToSize(value, 76), x, y + 6);
    });

    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Generert ${formatDateTime(generatedAt)}`, MARGIN, PAGE_HEIGHT - 18);
  }

  private addStrategyPage(doc: jsPDF, payload: ProducerHandoffPdfExportPayload): void {
    doc.addPage();
    this.addSectionHeader(doc, 'Retning, idé og aktivering', 'Det klienten skal forstå og kunne beslutte raskt.');

    const paragraphs = [
      `Retning: ${payload.manifest.direction || 'Ikke satt'}`,
      `Idé: ${payload.manifest.idea || 'Ikke satt'}`,
      `Aktivering: ${payload.manifest.activation || 'Ikke satt'}`,
      `Kjernebudskap: ${payload.manifest.coreMessage || 'Ikke satt'}`,
    ];
    this.addParagraphs(doc, paragraphs, 44);

    autoTable(doc, {
      startY: 90,
      margin: { left: MARGIN, right: MARGIN },
      theme: 'grid',
      head: [['Signal', 'Verdi']],
      body: [
        ['Forretningsmål', payload.manifest.businessGoal || 'Ikke satt'],
        ['Målgruppe', payload.manifest.targetAudience || 'Ikke satt'],
        ['Hovedleveranse', payload.manifest.primaryDeliveryLabel],
        ['Produksjonsbelastning', payload.manifest.productionLoadLabel],
      ],
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [241, 245, 249],
      },
      bodyStyles: {
        fontSize: 9,
        textColor: [30, 41, 59],
      },
    });

    if (payload.manifest.successSignals.length > 0) {
      autoTable(doc, {
        startY: (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY
          ? ((doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 0) + 10
          : 146,
        margin: { left: MARGIN, right: MARGIN },
        theme: 'striped',
        head: [['Tegn på suksess']],
        body: payload.manifest.successSignals.map((signal) => [signal]),
        headStyles: {
          fillColor: [59, 130, 246],
          textColor: [239, 246, 255],
        },
        bodyStyles: {
          fontSize: 9,
          textColor: [30, 41, 59],
        },
      });
    }
  }

  private addFrameworkPage(doc: jsPDF, payload: ProducerHandoffPdfExportPayload): void {
    doc.addPage();
    this.addSectionHeader(doc, 'Prosjektlogikk', 'Strategi, konsept, kampanje, produksjon, gjennomføring og evaluering i samme struktur.');

    autoTable(doc, {
      startY: 42,
      margin: { left: MARGIN, right: MARGIN },
      theme: 'grid',
      head: [['Steg', 'Fokus']],
      body: payload.manifest.frameworkSections.map((section) => [
        PRODUCER_PLANNING_FRAMEWORK_LABELS[section.key as ProducerPlanningFrameworkStepKey],
        section.focus || 'Ikke satt',
      ]),
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [241, 245, 249],
      },
      bodyStyles: {
        fontSize: 9,
        textColor: [30, 41, 59],
        valign: 'top',
      },
      columnStyles: {
        0: { cellWidth: 34 },
        1: { cellWidth: 140 },
      },
    });

    autoTable(doc, {
      startY: ((doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 108) + 8,
      margin: { left: MARGIN, right: MARGIN },
      theme: 'striped',
      head: [['Steg', 'Leveranse og notater']],
      body: payload.manifest.frameworkSections.map((section) => [
        PRODUCER_PLANNING_FRAMEWORK_LABELS[section.key as ProducerPlanningFrameworkStepKey],
        [
          `Leveranse: ${section.output || 'Ikke satt'}`,
          `Notater: ${section.notes || 'Ingen notater'}`,
        ].join('\n'),
      ]),
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: [239, 246, 255],
      },
      bodyStyles: {
        fontSize: 8.6,
        textColor: [30, 41, 59],
        valign: 'top',
      },
      columnStyles: {
        0: { cellWidth: 34 },
        1: { cellWidth: 140 },
      },
    });
  }

  private addClientFlowPage(doc: jsPDF, payload: ProducerHandoffPdfExportPayload): void {
    doc.addPage();
    this.addSectionHeader(doc, 'Faseplan og klientpunkter', 'Godkjenninger, publisering og leveranser knyttet til samme produksjonsplan.');

    autoTable(doc, {
      startY: 42,
      margin: { left: MARGIN, right: MARGIN },
      theme: 'grid',
      head: [['Type', 'Tittel', 'Fase', 'Dato', 'Status']],
      body: payload.manifest.pendingClientMoments.map((moment) => [
        PRODUCER_PLANNING_CLIENT_MOMENT_LABELS[moment.type],
        moment.title,
        PRODUCER_PLANNING_PHASE_LABELS[moment.phase],
        moment.date || 'Ikke satt',
        moment.statusLabel,
      ]),
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [241, 245, 249],
      },
      bodyStyles: {
        fontSize: 9,
        textColor: [30, 41, 59],
      },
    });
  }

  private addDeliveryPage(doc: jsPDF, payload: ProducerHandoffPdfExportPayload): void {
    doc.addPage();
    this.addSectionHeader(doc, 'Content-kalender og leveranser', 'Det som skal produseres, publiseres og overleveres.');

    autoTable(doc, {
      startY: 42,
      margin: { left: MARGIN, right: MARGIN },
      theme: 'grid',
      head: [['Leveranse', 'Kanal', 'Format', 'Stage', 'Status']],
      body: payload.manifest.deliveryItems.map((item) => [
        item.title,
        item.channel,
        item.format,
        item.deliveryStageLabel,
        item.statusLabel,
      ]),
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [241, 245, 249],
      },
      bodyStyles: {
        fontSize: 8.8,
        textColor: [30, 41, 59],
      },
      columnStyles: {
        0: { cellWidth: 46 },
        1: { cellWidth: 40 },
        2: { cellWidth: 20 },
        3: { cellWidth: 38 },
        4: { cellWidth: 34 },
      },
    });

    autoTable(doc, {
      startY: ((doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 108) + 8,
      margin: { left: MARGIN, right: MARGIN },
      theme: 'striped',
      head: [['Leveranse', 'Mappe, filnavn og leveringsinfo']],
      body: payload.manifest.deliveryItems.map((item) => [
        item.title,
        [
          `Mappe: ${toPdfWrappedText(item.folderPath)}`,
          `Pakke: ${toPdfWrappedText(item.packageName)}`,
          `Filnavn: ${toPdfWrappedText(item.filename)}`,
          `Versjon: ${item.versionLabel}`,
          `Leveringstrinn: ${item.deliveryStageLabel}`,
          `Estimert lengde: ${item.estimatedDurationLabel || 'Ikke beregnet'}`,
          item.publishDateLabel ? `Publisering: ${item.publishDateLabel}` : 'Publisering: Ikke satt',
          `Backup: ${item.backupRuleLabel || 'Ikke satt'}`,
        ].join('\n'),
      ]),
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: [239, 246, 255],
      },
      bodyStyles: {
        fontSize: 8.4,
        textColor: [30, 41, 59],
        valign: 'top',
      },
      columnStyles: {
        0: { cellWidth: 42 },
        1: { cellWidth: 132 },
      },
    });
  }

  private addBrandAndWorkflowPage(doc: jsPDF, payload: ProducerHandoffPdfExportPayload): void {
    doc.addPage();
    this.addSectionHeader(doc, 'Merkevare og leveringsrutine', 'Sikrer konsistent kvalitet, filstruktur og overlevering.');

    const brandParagraphs = [
      `Logo: ${payload.planning.brandGuide.logoUrl || 'Ikke koblet til prosjektet'}`,
      `Fonter: ${payload.planning.brandGuide.fonts?.join(', ') || 'Ikke satt'}`,
      `Tone of voice: ${payload.planning.brandGuide.toneOfVoice || 'Ikke satt'}`,
      `Visuell stil: ${payload.planning.brandGuide.visualStyle || 'Ikke satt'}`,
    ];
    this.addParagraphs(doc, brandParagraphs, 44);

    const colorRows = (payload.planning.brandGuide.colors ?? []).map((color) => [
      color.label,
      color.hex,
      color.usage || 'Ikke satt',
    ]);

    if (colorRows.length > 0) {
      autoTable(doc, {
        startY: 92,
        margin: { left: MARGIN, right: MARGIN },
        theme: 'striped',
        head: [['Farge', 'HEX', 'Bruk']],
        body: colorRows,
        headStyles: {
          fillColor: [59, 130, 246],
          textColor: [239, 246, 255],
        },
        bodyStyles: {
          fontSize: 8.7,
          textColor: [30, 41, 59],
        },
      });
    }

    const startY = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY
      ? ((doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 0) + 10
      : 92;

    autoTable(doc, {
      startY,
      margin: { left: MARGIN, right: MARGIN },
      theme: 'grid',
      head: [['Rutine', 'Regel']],
      body: [
        ['Filnavn', payload.planning.deliveryWorkflow.fileNamingConvention || 'Ikke satt'],
        ['Versjonering', payload.planning.deliveryWorkflow.versioningRule || 'Ikke satt'],
        ['Mapper', payload.planning.deliveryWorkflow.folderStructure || 'Ikke satt'],
        ['Draft / final', payload.planning.deliveryWorkflow.draftVsFinalRule || 'Ikke satt'],
        ['Backup', payload.planning.deliveryWorkflow.backupRoutine || 'Ikke satt'],
        ['Leveringsrytme', payload.planning.deliveryWorkflow.deliveryCadence || 'Ikke satt'],
      ],
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [241, 245, 249],
      },
      bodyStyles: {
        fontSize: 8.7,
        textColor: [30, 41, 59],
      },
    });
  }

  private addClientInputPage(doc: jsPDF, payload: ProducerHandoffPdfExportPayload): void {
    const clientContributionTasks = getProducerClientContributionTasks(
      payload.planning,
      payload.clientIntake,
      payload.clientMaterials,
    ).filter((task) => task.status !== 'ready');

    doc.addPage();
    this.addSectionHeader(doc, 'Klientbrief og innsendt materiale', 'Det klienten faktisk har gitt produsenten å jobbe ut fra.');

    autoTable(doc, {
      startY: 42,
      margin: { left: MARGIN, right: MARGIN },
      theme: 'grid',
      head: [['Felt', 'Innhold']],
      body: [
        ['Prosjektmål', payload.clientIntake.projectGoal || 'Ikke satt'],
        ['Leveranser', payload.clientIntake.deliverables || 'Ikke satt'],
        ['Målgruppe', payload.clientIntake.targetAudience || 'Ikke satt'],
        ['Kjernebudskap', payload.clientIntake.keyMessage || 'Ikke satt'],
        ['Tidsrammer', payload.clientIntake.timingConstraints || 'Ikke satt'],
        ['Brand-notater', payload.clientIntake.brandNotes || 'Ikke satt'],
        ['Materialoversikt', payload.clientIntake.materialOverview || 'Ikke satt'],
        ['Referanselenker', payload.clientIntake.referenceLinks ? toPdfWrappedText(payload.clientIntake.referenceLinks) : 'Ikke satt'],
        ['Kontaktperson', payload.clientIntake.contactName || 'Ikke satt'],
        ['Kontakt-e-post', payload.clientIntake.contactEmail ? toPdfWrappedText(payload.clientIntake.contactEmail) : 'Ikke satt'],
        ['Kontakttelefon', payload.clientIntake.contactPhone || 'Ikke satt'],
        ['Tilleggsnotater', payload.clientIntake.additionalNotes || 'Ikke satt'],
      ],
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [241, 245, 249],
      },
      bodyStyles: {
        fontSize: 8.5,
        textColor: [30, 41, 59],
        valign: 'top',
      },
      columnStyles: {
        0: { cellWidth: 34 },
        1: { cellWidth: 132 },
      },
    });

    autoTable(doc, {
      startY: (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY
        ? ((doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 0) + 10
        : 150,
      margin: { left: MARGIN, right: MARGIN },
      theme: 'striped',
      head: [['Type', 'Innsendt materiale', 'Fase', 'Status']],
      body: payload.clientMaterials.length > 0
        ? payload.clientMaterials.map((item) => {
          const metadata = parseClientMaterialMetadata(item);
          return [
          MATERIAL_TYPE_LABELS[item.entry_type] ?? item.entry_type,
          [
            item.title,
            item.description ? `Beskrivelse: ${item.description}` : null,
            metadata.fileName ? `Filnavn: ${toPdfWrappedText(metadata.fileName)}` : null,
            metadata.versionLabel ? `Versjon: ${metadata.versionLabel}` : null,
            metadata.sourceLabel ? `Kilde: ${metadata.sourceLabel}` : null,
            metadata.usageNotes ? `Brukes til: ${metadata.usageNotes}` : null,
            item.external_url ? `Lenke registrert: ${toPdfWrappedText(item.external_url)}` : null,
          ].filter(Boolean).join('\n'),
          item.phase ? PRODUCER_PLANNING_PHASE_LABELS[item.phase] : 'Ikke satt',
          [
            item.status || 'Levert',
            `Prioritet: ${MATERIAL_PRIORITY_LABELS[metadata.priority]}`,
          ].join('\n'),
        ];
        })
        : [['Ingen klientmaterialer registrert', '-', '-', '-']],
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: [239, 246, 255],
      },
      bodyStyles: {
        fontSize: 8.5,
        textColor: [30, 41, 59],
        valign: 'top',
      },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 102 },
        2: { cellWidth: 24 },
        3: { cellWidth: 24 },
      },
    });

    autoTable(doc, {
      startY: (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY
        ? ((doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 0) + 10
        : 222,
      margin: { left: MARGIN, right: MARGIN },
      theme: 'grid',
      head: [['Åpent klientinnspill', 'Kilde', 'Fase', 'Status']],
      body: clientContributionTasks.length > 0
        ? clientContributionTasks.map((task) => [
          [task.title, task.detail].filter(Boolean).join('\n'),
          PRODUCER_CLIENT_CONTRIBUTION_SOURCE_LABELS[task.sourceType],
          PRODUCER_PLANNING_PHASE_LABELS[task.phase],
          PRODUCER_CLIENT_CONTRIBUTION_STATUS_LABELS[task.status],
        ])
        : [['Ingen åpne klientinnspill', '-', '-', 'Klar']],
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [241, 245, 249],
      },
      bodyStyles: {
        fontSize: 8.2,
        textColor: [30, 41, 59],
        valign: 'top',
      },
      columnStyles: {
        0: { cellWidth: 98 },
        1: { cellWidth: 34 },
        2: { cellWidth: 26 },
        3: { cellWidth: 20 },
      },
    });
  }

  private addEstimatePage(doc: jsPDF, payload: ProducerHandoffPdfExportPayload): void {
    doc.addPage();
    this.addSectionHeader(doc, 'Realistisk produksjonsestimat', 'Bruker manus, shotlist og produksjonsdata til å anslå faktisk belastning og leveranseomfang.');

    autoTable(doc, {
      startY: 42,
      margin: { left: MARGIN, right: MARGIN },
      theme: 'grid',
      head: [['Målepunkt', 'Verdi']],
      body: [
        ['Anbefalte opptaksdager', toDisplayValue(payload.estimate.suggestedShootDays)],
        ['Produksjonsbelastning', toDisplayValue(payload.manifest.productionLoadLabel)],
        ['Opptaksdager i risiko', toDisplayValue(payload.estimate.overloadedDayCount)],
        ['Totalt råopptak (min)', toDisplayValue(payload.estimate.totalRawCaptureMinutes)],
        ['Realistisk feltbruk (min)', toDisplayValue(payload.estimate.totalRealisticFieldMinutes)],
      ],
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [241, 245, 249],
      },
      bodyStyles: {
        fontSize: 9,
        textColor: [30, 41, 59],
      },
    });

    autoTable(doc, {
      startY: (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY
        ? ((doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 0) + 10
        : 104,
      margin: { left: MARGIN, right: MARGIN },
      theme: 'striped',
      head: [['Format', 'Forventet lengde', 'Vekt']],
      body: payload.estimate.formatEstimates.map((item) => [
        item.label,
        `${Math.floor(item.estimatedSeconds / 60)}:${String(item.estimatedSeconds % 60).padStart(2, '0')}`,
        item.emphasis === 'primary' ? 'Hovedleveranse' : 'Distribusjon',
      ]),
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: [239, 246, 255],
      },
      bodyStyles: {
        fontSize: 8.7,
        textColor: [30, 41, 59],
      },
    });
  }

  private addSectionHeader(doc: jsPDF, title: string, subtitle: string): void {
    doc.setFillColor(9, 16, 30);
    doc.rect(0, 0, PAGE_WIDTH, 26, 'F');
    doc.setFillColor(139, 92, 246);
    doc.rect(0, 24, PAGE_WIDTH, 2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text(title, MARGIN, 15);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(191, 219, 254);
    doc.text(doc.splitTextToSize(subtitle, PAGE_WIDTH - MARGIN * 2), MARGIN, 33);
  }

  private addParagraphs(doc: jsPDF, paragraphs: string[], startY: number): void {
    let cursorY = startY;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    paragraphs.forEach((paragraph) => {
      const lines = doc.splitTextToSize(paragraph, PAGE_WIDTH - MARGIN * 2);
      doc.text(lines, MARGIN, cursorY);
      cursorY += lines.length * 5 + 4;
    });
  }

  private addFooter(doc: jsPDF, generatedAt: Date): void {
    const pageCount = doc.getNumberOfPages();
    for (let pageIndex = 1; pageIndex <= pageCount; pageIndex += 1) {
      doc.setPage(pageIndex);
      doc.setDrawColor(203, 213, 225);
      doc.line(MARGIN, PAGE_HEIGHT - 12, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 12);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`The Role Room · Klientpakke · ${formatDateTime(generatedAt)}`, MARGIN, PAGE_HEIGHT - 6);
      doc.text(`Side ${pageIndex} / ${pageCount}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 6, { align: 'right' });
    }
  }

  private async getLogoDataUrl(): Promise<string | null> {
    if (!this.logoDataUrlPromise) {
      this.logoDataUrlPromise = this.loadImageAsPngDataUrl(ROLE_ROOM_BRAND_ASSETS.wordmark);
    }
    return this.logoDataUrlPromise;
  }

  private async loadImageAsPngDataUrl(sourceUrl: string): Promise<string | null> {
    if (typeof window === 'undefined') {
      return null;
    }

    return new Promise((resolve) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          const context = canvas.getContext('2d');
          if (!context) {
            resolve(null);
            return;
          }
          context.drawImage(image, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } catch (error) {
          console.warn('[ProducerHandoffPdfExportService] Could not convert logo to PNG', error);
          resolve(null);
        }
      };
      image.onerror = () => resolve(null);
      image.src = sourceUrl;
    });
  }
}

export const producerHandoffPdfExportService = new ProducerHandoffPdfExportService();
