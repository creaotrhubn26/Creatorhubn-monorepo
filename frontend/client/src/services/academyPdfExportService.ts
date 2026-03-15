import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface AcademyPdfMetric {
  label: string;
  value: string | number;
}

export interface AcademyPdfTable {
  columns: string[];
  rows: Array<Array<string | number | boolean | null | undefined>>;
}

export interface AcademyPdfSection {
  title: string;
  subtitle?: string;
  intro?: string;
  metrics?: AcademyPdfMetric[];
  paragraphs?: string[];
  table?: AcademyPdfTable;
}

export interface AcademyPdfExportPayload {
  fileName: string;
  title: string;
  subtitle?: string;
  courseLabel?: string;
  locale?: string;
  generatedAt?: Date;
  sections: AcademyPdfSection[];
}

class AcademyPdfExportService {
  private readonly pageWidth = 210;
  private readonly pageHeight = 297;
  private readonly margin = 16;
  private logoDataUrlPromise: Promise<string | null> | null = null;

  async exportReport(payload: AcademyPdfExportPayload): Promise<void> {
    const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
    const generatedAt = payload.generatedAt ?? new Date();
    const locale = payload.locale || "nb-NO";
    const logoDataUrl = await this.getLogoDataUrl();

    this.addCoverPage(doc, payload, generatedAt, locale, logoDataUrl);

    payload.sections.forEach((section) => {
      this.addSectionPage(doc, section);
    });

    this.addFooter(doc, generatedAt, locale);
    doc.save(this.toSafeFileName(payload.fileName, generatedAt));
  }

  private addCoverPage(
    doc: jsPDF,
    payload: AcademyPdfExportPayload,
    generatedAt: Date,
    locale: string,
    logoDataUrl: string | null,
  ): void {
    doc.setFillColor(8, 12, 20);
    doc.rect(0, 0, this.pageWidth, this.pageHeight, "F");

    doc.setFillColor(218, 151, 34);
    doc.rect(0, 0, this.pageWidth, 6, "F");
    doc.setFillColor(22, 30, 49);
    doc.rect(0, 6, this.pageWidth, 16, "F");

    if (logoDataUrl) {
      doc.addImage(logoDataUrl, "PNG", this.margin, 20, 48, 14);
    }

    doc.setTextColor(214, 220, 233);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("CREATOR STUDIO · ACADEMY", this.margin, 44);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    const titleLines = doc.splitTextToSize(
      payload.title || "Academy Export",
      this.pageWidth - this.margin * 2,
    );
    doc.text(titleLines, this.margin, 64);

    let y = 64 + titleLines.length * 11;
    if (payload.subtitle) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(14);
      doc.setTextColor(194, 201, 216);
      const subtitleLines = doc.splitTextToSize(
        payload.subtitle,
        this.pageWidth - this.margin * 2,
      );
      doc.text(subtitleLines, this.margin, y);
      y += subtitleLines.length * 7 + 10;
    } else {
      y += 10;
    }

    if (payload.courseLabel) {
      doc.setDrawColor(233, 186, 88);
      doc.setFillColor(22, 28, 41);
      doc.roundedRect(this.margin, y, this.pageWidth - this.margin * 2, 18, 3, 3, "FD");
      doc.setTextColor(241, 225, 178);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Scope", this.margin + 4, y + 6.5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
      doc.setTextColor(223, 227, 238);
      doc.text(
        doc.splitTextToSize(payload.courseLabel, this.pageWidth - this.margin * 2 - 8),
        this.margin + 4,
        y + 13,
      );
      y += 26;
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(178, 185, 202);
    doc.text(
      `Generated ${new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(generatedAt)}`,
      this.margin,
      y,
    );

    doc.setTextColor(130, 138, 160);
    doc.setFontSize(9);
    doc.text(
      "Presentation export with section-ready breakdown.",
      this.margin,
      this.pageHeight - 18,
    );
  }

  private addSectionPage(doc: jsPDF, section: AcademyPdfSection): void {
    doc.addPage();
    let cursorY = this.margin;

    doc.setFillColor(9, 16, 30);
    doc.rect(0, 0, this.pageWidth, 26, "F");
    doc.setFillColor(218, 151, 34);
    doc.rect(0, 24, this.pageWidth, 2, "F");

    doc.setTextColor(239, 243, 250);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.text(section.title, this.margin, 16);

    cursorY = 38;

    if (section.subtitle) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(64, 73, 94);
      const subtitleLines = doc.splitTextToSize(
        section.subtitle,
        this.pageWidth - this.margin * 2,
      );
      doc.text(subtitleLines, this.margin, cursorY);
      cursorY += subtitleLines.length * 5.2 + 4;
    }

    if (section.intro) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(79, 87, 104);
      const introLines = doc.splitTextToSize(
        section.intro,
        this.pageWidth - this.margin * 2,
      );
      doc.text(introLines, this.margin, cursorY);
      cursorY += introLines.length * 4.8 + 5;
    }

    if (section.metrics && section.metrics.length > 0) {
      cursorY = this.renderMetrics(doc, section.metrics, cursorY);
    }

    if (section.paragraphs && section.paragraphs.length > 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(66, 74, 92);
      section.paragraphs.forEach((paragraph) => {
        const lines = doc.splitTextToSize(paragraph, this.pageWidth - this.margin * 2);
        doc.text(lines, this.margin, cursorY);
        cursorY += lines.length * 4.8 + 3;
      });
      cursorY += 1;
    }

    if (section.table && section.table.columns.length > 0) {
      const tableStartY = Math.min(cursorY, this.pageHeight - 30);
      autoTable(doc, {
        startY: tableStartY,
        head: [section.table.columns],
        body: section.table.rows.map((row) =>
          row.map((value) => this.toPrintableValue(value)),
        ),
        theme: "grid",
        headStyles: {
          fillColor: [13, 24, 45],
          textColor: [241, 244, 250],
          fontSize: 9,
        },
        bodyStyles: {
          fontSize: 9,
          textColor: [24, 31, 46],
        },
        alternateRowStyles: {
          fillColor: [245, 247, 252],
        },
        margin: { left: this.margin, right: this.margin },
      });
    }
  }

  private renderMetrics(
    doc: jsPDF,
    metrics: AcademyPdfMetric[],
    startY: number,
  ): number {
    const gap = 4;
    const cardWidth = (this.pageWidth - this.margin * 2 - gap) / 2;
    const cardHeight = 18;
    let y = startY;

    metrics.forEach((metric, index) => {
      if (index > 0 && index % 2 === 0) {
        y += cardHeight + gap;
      }

      const column = index % 2;
      const x = this.margin + column * (cardWidth + gap);

      doc.setFillColor(248, 250, 255);
      doc.setDrawColor(219, 225, 239);
      doc.roundedRect(x, y, cardWidth, cardHeight, 2, 2, "FD");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(91, 99, 116);
      doc.text(metric.label, x + 3, y + 6);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(23, 30, 45);
      doc.text(String(metric.value), x + 3, y + 14);
    });

    return (
      y +
      cardHeight +
      (metrics.length > 0 && metrics.length % 2 === 0 ? 4 : metrics.length > 1 ? 4 : 0)
    );
  }

  private addFooter(doc: jsPDF, generatedAt: Date, locale: string): void {
    const pages = doc.getNumberOfPages();
    const timestamp = new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(generatedAt);

    for (let page = 1; page <= pages; page += 1) {
      doc.setPage(page);
      const cover = page === 1;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      if (cover) {
        doc.setTextColor(154, 162, 180);
      } else {
        doc.setTextColor(100, 108, 126);
      }
      doc.text(
        `CreatorHub Academy · ${timestamp}`,
        this.margin,
        this.pageHeight - 8,
      );

      doc.text(`Page ${page}/${pages}`, this.pageWidth - this.margin, this.pageHeight - 8, {
        align: "right",
      });
    }
  }

  private toPrintableValue(
    value: string | number | boolean | null | undefined,
  ): string | number {
    if (value === null || value === undefined) return "-";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    return value;
  }

  private toSafeFileName(fileName: string, now: Date): string {
    const datePart = now.toISOString().slice(0, 10);
    const base = (fileName || `academy-export-${datePart}`)
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");

    const safe = base.length > 0 ? base : `academy-export-${datePart}`;
    return safe.toLowerCase().endsWith(".pdf") ? safe : `${safe}.pdf`;
  }

  private async getLogoDataUrl(): Promise<string | null> {
    if (!this.logoDataUrlPromise) {
      this.logoDataUrlPromise = this.loadLogoDataUrl();
    }
    return this.logoDataUrlPromise;
  }

  private async loadLogoDataUrl(): Promise<string | null> {
    if (typeof window === "undefined") return null;
    try {
      const response = await fetch("/creatorhub-logo-amber.svg");
      if (!response.ok) return null;
      const svg = await response.text();
      const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      return await this.rasterizeToPng(svgDataUrl, 1200, 340);
    } catch {
      return null;
    }
  }

  private rasterizeToPng(
    source: string,
    targetWidth: number,
    targetHeight: number,
  ): Promise<string | null> {
    return new Promise((resolve) => {
      if (typeof document === "undefined") {
        resolve(null);
        return;
      }

      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const context = canvas.getContext("2d");
        if (!context) {
          resolve(null);
          return;
        }

        context.clearRect(0, 0, targetWidth, targetHeight);
        const ratio = Math.min(
          targetWidth / Math.max(image.naturalWidth, 1),
          targetHeight / Math.max(image.naturalHeight, 1),
        );
        const width = image.naturalWidth * ratio;
        const height = image.naturalHeight * ratio;
        const x = (targetWidth - width) / 2;
        const y = (targetHeight - height) / 2;

        context.drawImage(image, x, y, width, height);
        resolve(canvas.toDataURL("image/png"));
      };

      image.onerror = () => resolve(null);
      image.src = source;
    });
  }
}

export const academyPdfExportService = new AcademyPdfExportService();
export default academyPdfExportService;
