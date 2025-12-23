/**
 * PDF Export Service for Business Intelligence Dashboard
 * Exports SWOT analysis, personas, and survey results to PDF using jsPDF
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { SWOTItem, CustomerPersona, Survey, SurveyResponse } from './BusinessIntelligenceService';

export interface PDFExportOptions {
  title?: string;
  subtitle?: string;
  logoDataUrl?: string;
  includeTimestamp?: boolean;
  includePageNumbers?: boolean;
  primaryColor?: string;
}

class PDFExportService {
  private readonly DEFAULT_PRIMARY_COLOR = '#ff6b35';
  private readonly PAGE_WIDTH = 210; // A4 width in mm
  private readonly PAGE_HEIGHT = 297; // A4 height in mm
  private readonly MARGIN = 20;

  /**
   * Export SWOT Analysis to PDF
   */
  async exportSWOTAnalysis(
    items: SWOTItem[],
    options: PDFExportOptions = {}
  ): Promise<void> {
    const doc = new jsPDF('p', 'mm','a4');
    const primaryColor = options.primaryColor || this.DEFAULT_PRIMARY_COLOR;

    // Header
    this.addHeader(doc, options.title || 'SWOT Analysis Report', options.subtitle, options.logoDataUrl, primaryColor);

    let yPos = 50;

    // Group items by type
    const strengths = items.filter((item) => item.type === 'strength');
    const weaknesses = items.filter((item) => item.type === 'weakness');
    const opportunities = items.filter((item) => item.type === 'opportunity');
    const threats = items.filter((item) => item.type === 'threat');

    // Strengths Section
    if (strengths.length > 0) {
      yPos = this.addSWOTSection(doc, 'Strengths', strengths, yPos, '#4caf50');
    }

    // Weaknesses Section
    if (weaknesses.length > 0) {
      if (yPos > 200) {
        doc.addPage();
        yPos = 20;
      }
      yPos = this.addSWOTSection(doc, 'Weaknesses', weaknesses, yPos, '#f44336');
    }

    // Opportunities Section
    if (opportunities.length > 0) {
      if (yPos > 200) {
        doc.addPage();
        yPos = 20;
      }
      yPos = this.addSWOTSection(doc, 'Opportunities', opportunities, yPos, '#2196f3');
    }

    // Threats Section
    if (threats.length > 0) {
      if (yPos > 200) {
        doc.addPage();
        yPos = 20;
      }
      yPos = this.addSWOTSection(doc, 'Threats', threats, yPos, '#ff9800');
    }

    // Footer
    this.addFooter(doc, options);

    // Save
    doc.save(`swot-analysis-${new Date().toISOString().split('T')[0]}.pdf`);
  }

  /**
   * Export Customer Personas to PDF
   */
  async exportPersonas(
    personas: CustomerPersona[],
    options: PDFExportOptions = {}
  ): Promise<void> {
    const doc = new jsPDF('p','mm','a4');
    const primaryColor = options.primaryColor || this.DEFAULT_PRIMARY_COLOR;

    // Header
    this.addHeader(doc, options.title || 'Customer Personas', options.subtitle, options.logoDataUrl, primaryColor);

    let yPos = 50;

    personas.forEach((persona, index) => {
      if (index > 0) {
        doc.addPage();
        yPos = 20;
      }

      // Persona Name
      doc.setFontSize(18);
      doc.setTextColor(primaryColor);
      doc.text(persona.name, this.MARGIN, yPos);
      yPos += 10;

      // Description
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      const descLines = doc.splitTextToSize(persona.description, this.PAGE_WIDTH - 2 * this.MARGIN);
      doc.text(descLines, this.MARGIN, yPos);
      yPos += descLines.length * 5 + 5;

      // Demographics Table
      autoTable(doc, {
        startY: yPos,
        head: [['Attribute','Value']],
        body: [
          ['Age Range', persona.ageRange],
          ['Location', persona.location],
          ['Income', persona.income],
          ['Customer Type', persona.customerType.replace(/_/g, ', ')],
          ['Budget Tier', persona.budgetTier],
        ],
        theme: 'striped',
        headStyles: { fillColor: primaryColor },
        margin: { left: this.MARGIN, right: this.MARGIN },
      });

      yPos = (doc as any).lastAutoTable.finalY + 10;

      // Goals
      if (persona.goals && persona.goals.length > 0) {
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text('Goals: ', this.MARGIN, yPos);
        yPos += 7;

        doc.setFontSize(10);
        doc.setTextColor(60, 60, 60);
        persona.goals.forEach((goal) => {
          doc.text(`• ${goal}`, this.MARGIN + 5, yPos);
          yPos += 6;
        });
        yPos += 5;
      }

      // Pain Points
      if (persona.painPoints && persona.painPoints.length > 0) {
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text('Pain Points:', this.MARGIN, yPos);
        yPos += 7;

        doc.setFontSize(10);
        doc.setTextColor(60, 60, 60);
        persona.painPoints.forEach((painPoint) => {
          doc.text(`• ${painPoint}`, this.MARGIN + 5, yPos);
          yPos += 6;
        });
      }
    });

    // Footer
    this.addFooter(doc, options);

    // Save
    doc.save(`customer-personas-${new Date().toISOString().split('T')[0]}.pdf`);
  }

  /**
   * Export Survey Results to PDF
   */
  async exportSurveyResults(
    survey: Survey,
    responses: SurveyResponse[],
    options: PDFExportOptions = {}
  ): Promise<void> {
    const doc = new jsPDF('p','mm','a4');
    const primaryColor = options.primaryColor || this.DEFAULT_PRIMARY_COLOR;

    // Header
    this.addHeader(doc, options.title || `Survey Results: ${survey.title}`, options.subtitle, options.logoDataUrl, primaryColor);

    let yPos = 50;

    // Survey Info
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text('Survey Information', this.MARGIN, yPos);
    yPos += 7;

    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.text(`Description: ${survey.description}`, this.MARGIN, yPos);
    yPos += 6;
    doc.text(`Purpose: ${survey.purpose.replace(/_/g, ', ')}`, this.MARGIN, yPos);
    yPos += 6;
    doc.text(`Status: ${survey.status}`, this.MARGIN, yPos);
    yPos += 6;
    doc.text(`Total Responses: ${responses.length}`, this.MARGIN, yPos);
    yPos += 6;
    doc.text(`Completion Rate: ${survey.completionRate}%`, this.MARGIN, yPos);
    yPos += 15;

    // Sentiment Analysis
    const sentimentCounts = {
      positive: responses.filter((r) => r.sentiment === 'positive').length,
      neutral: responses.filter((r) => r.sentiment === 'neutral').length,
      negative: responses.filter((r) => r.sentiment === 'negative').length,
    };

    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text('Sentiment Analysis', this.MARGIN, yPos);
    yPos += 7;

    autoTable(doc, {
      startY: yPos,
      head: [['Sentiment','Count','Percentage']],
      body: [
        ['Positive', sentimentCounts.positive.toString(), `${((sentimentCounts.positive / responses.length) * 100).toFixed(1)}%`],
        ['Neutral', sentimentCounts.neutral.toString(), `${((sentimentCounts.neutral / responses.length) * 100).toFixed(1)}%`],
        ['Negative', sentimentCounts.negative.toString(), `${((sentimentCounts.negative / responses.length) * 100).toFixed(1)}%`],
      ],
      theme: 'striped',
      headStyles: { fillColor: primaryColor },
      margin: { left: this.MARGIN, right: this.MARGIN },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;

    // Key Insights
    if (responses.length > 0 && responses[0].keyInsights) {
      if (yPos > 220) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text('Key Insights', this.MARGIN, yPos);
      yPos += 7;

      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);

      const allInsights = responses.flatMap((r) => r.keyInsights);
      const uniqueInsights = [...new Set(allInsights)].slice(0, 10);

      uniqueInsights.forEach((insight) => {
        const lines = doc.splitTextToSize(`• ${insight}`, this.PAGE_WIDTH - 2 * this.MARGIN - 5);
        doc.text(lines, this.MARGIN + 5, yPos);
        yPos += lines.length * 5 + 2;

        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
      });
    }

    // Footer
    this.addFooter(doc, options);

    // Save
    doc.save(`survey-results-${survey.id}-${new Date().toISOString().split('T')[0]}.pdf`);
  }

  /**
   * Add header to PDF
   */
  private addHeader(
    doc: jsPDF,
    title: string,
    subtitle?: string,
    logoDataUrl?: string,
    primaryColor: string = this.DEFAULT_PRIMARY_COLOR
  ): void {
    // Logo (if provided)
    if (logoDataUrl) {
      try {
        doc.addImage(logoDataUrl, 'PNG', this.MARGIN, 10, 30, 30);
      } catch (error) {
        console.warn('Failed to add logo to PDF:', error);
      }
    }

    // Title
    doc.setFontSize(20);
    doc.setTextColor(primaryColor);
    doc.text(title, logoDataUrl ? this.MARGIN + 35 : this.MARGIN, 25);

    // Subtitle
    if (subtitle) {
      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      doc.text(subtitle, logoDataUrl ? this.MARGIN + 35 : this.MARGIN, 33);
    }

    // Horizontal line
    doc.setDrawColor(200, 200, 200);
    doc.line(this.MARGIN, 42, this.PAGE_WIDTH - this.MARGIN, 42);
  }

  /**
   * Add SWOT section to PDF
   */
  private addSWOTSection(
    doc: jsPDF,
    sectionTitle: string,
    items: SWOTItem[],
    startY: number,
    color: string
  ): number {
    let yPos = startY;

    // Section Title
    doc.setFontSize(14);
    doc.setTextColor(color);
    doc.text(sectionTitle, this.MARGIN, yPos);
    yPos += 10;

    // Items Table
    const tableData = items.map((item) => [
      item.title,
      item.description,
      item.impact,
      item.status,
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Title','Description', 'Impact', 'Status']],
      body: tableData,
      theme:'striped',
      headStyles: { fillColor: color },
      margin: { left: this.MARGIN, right: this.MARGIN },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 70 },
        2: { cellWidth: 25 },
        3: { cellWidth: 25 },
      },
    });

    return (doc as any).lastAutoTable.finalY + 15;
  }

  /**
   * Add footer to PDF
   */
  private addFooter(doc: jsPDF, options: PDFExportOptions): void {
    const pageCount = doc.getNumberOfPages();

    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);

      // Timestamp
      if (options.includeTimestamp !== false) {
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        const timestamp = new Date().toLocaleString('nb-NO');
        doc.text(`Generated: ${timestamp}`, this.MARGIN, this.PAGE_HEIGHT - 10);
      }

      // Page numbers
      if (options.includePageNumbers !== false) {
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `Page ${i} of ${pageCount}`,
          this.PAGE_WIDTH - this.MARGIN - 20,
          this.PAGE_HEIGHT - 10
        );
      }
    }
  }
}

// Export singleton instance
export const pdfExportService = new PDFExportService();
export default pdfExportService;
