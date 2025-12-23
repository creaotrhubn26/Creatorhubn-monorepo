/**
 * Quote PDF Generation Service
 * Generates professional PDF documents for quotes/proposals using pdfkit
 */

import PDFDocument from 'pdfkit';

interface QuotePDFOptions {
  includeSignatures?: boolean;
  template?: 'standard' | 'detailed' | 'minimal';
  watermark?: string;
}

interface QuoteData {
  id: string;
  title: string;
  description: string;
  basePrice: number;
  additionalServices?: Array<{ name: string; price?: number }>;
  totalPrice: number;
  validUntil: string;
  notes?: string;
  createdAt: string;
  status: string;
  clientInfo: {
    name: string;
    email: string;
    address: string;
    phoneNumber: string;
  };
  approvers?: Array<{
    name: string;
    email: string;
    address: string;
    phoneNumber: string;
  }>;
  profession?: string;
  projectType?: string;
}

/**
 * Generate PDF for quote
 */
export async function generateQuotePDF(
  quoteData: QuoteData,
  options: QuotePDFOptions = {}
): Promise<Buffer> {
  const {
    includeSignatures = false,
    template = 'standard',
    watermark,
  } = options;

  // Create PDF document
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
    info: {
      Title: quoteData.title,
      Author: 'CreatorHub Norge',
      Subject: 'Quote/Proposal',
      Creator: 'CreatorHub Quote System',
    },
  });

  const buffers: Buffer[] = [];
  doc.on('data', buffers.push.bind(buffers));

  // Helper function to add watermark
  if (watermark) {
    doc.save();
    doc.opacity(0.1);
    doc.fontSize(60);
    doc.rotate(45);
    doc.text(watermark, 200, 400);
    doc.restore();
  }

  // Header
  doc.fontSize(24).font('Helvetica-Bold');
  doc.text('TILBUD / QUOTE', { align: 'center' });
  doc.moveDown(0.5);

  doc.fontSize(16).font('Helvetica');
  doc.text(quoteData.title, { align: 'center' });
  doc.moveDown(1);

  // Document Info
  doc.fontSize(10).fillColor('#666666');
  doc.text(`Quote ID: ${quoteData.id}`, { align: 'left' });
  doc.text(`Created: ${new Date(quoteData.createdAt).toLocaleDateString('no-NO')}`, { align: 'left' });
  doc.text(`Valid Until: ${new Date(quoteData.validUntil).toLocaleDateString('no-NO')}`, { align: 'left' });
  doc.text(`Status: ${quoteData.status.toUpperCase()}`, { align: 'left' });
  doc.moveDown(1);
  doc.fillColor('#000000');

  // Client Information
  doc.fontSize(14).font('Helvetica-Bold');
  doc.text('KUNDEINFORMASJON / CLIENT INFORMATION', { underline: true });
  doc.moveDown(0.5);

  doc.fontSize(11).font('Helvetica');
  doc.text(`Navn / Name: ${quoteData.clientInfo.name}`);
  doc.text(`E-post / Email: ${quoteData.clientInfo.email}`);
  doc.text(`Adresse / Address: ${quoteData.clientInfo.address}`);
  doc.text(`Telefon / Phone: ${quoteData.clientInfo.phoneNumber}`);
  doc.moveDown(1);

  // Approvers (if multiple)
  if (quoteData.approvers && quoteData.approvers.length > 0) {
    doc.fontSize(14).font('Helvetica-Bold');
    doc.text('GODKJENNERE / APPROVERS', { underline: true });
    doc.moveDown(0.5);

    doc.fontSize(11).font('Helvetica');
    quoteData.approvers.forEach((approver, index) => {
      doc.text(`Godkjenner ${index + 1} / Approver ${index + 1}:`);
      doc.text(`  Navn / Name: ${approver.name}`);
      doc.text(`  E-post / Email: ${approver.email}`);
      doc.text(`  Adresse / Address: ${approver.address}`);
      doc.text(`  Telefon / Phone: ${approver.phoneNumber}`);
      doc.moveDown(0.5);
    });
    doc.moveDown(1);
  }

  // Description
  if (quoteData.description) {
    doc.fontSize(14).font('Helvetica-Bold');
    doc.text('BESKRIVELSE / DESCRIPTION', { underline: true });
    doc.moveDown(0.5);

    doc.fontSize(11).font('Helvetica');
    doc.text(quoteData.description);
    doc.moveDown(1);
  }

  // Services and Pricing
  doc.fontSize(14).font('Helvetica-Bold');
  doc.text('TJENESTER OG PRISER / SERVICES AND PRICING', { underline: true });
  doc.moveDown(0.5);

  // Table Header
  const tableTop = doc.y;
  const tableLeft = 50;
  const tableWidth = 500;
  const rowHeight = 25;
  const colWidths = [300, 100, 100]; // Service, Quantity, Price

  // Header row
  doc.fontSize(10).font('Helvetica-Bold');
  doc.fillColor('#333333');
  doc.rect(tableLeft, tableTop, tableWidth, rowHeight).stroke();
  
  doc.text('Tjeneste / Service', tableLeft + 5, tableTop + 8);
  doc.text('Antall / Qty', tableLeft + colWidths[0] + 5, tableTop + 8);
  doc.text('Pris / Price', tableLeft + colWidths[0] + colWidths[1] + 5, tableTop + 8);

  // Base service row
  let currentY = tableTop + rowHeight;
  doc.font('Helvetica').fontSize(10);
  doc.rect(tableLeft, currentY, tableWidth, rowHeight).stroke();
  
  doc.fillColor('#000000');
  doc.text('Grunnpakke / Base Package', tableLeft + 5, currentY + 8, {
    width: colWidths[0] - 10,
    ellipsis: true,
  });
  doc.text('1', tableLeft + colWidths[0] + 5, currentY + 8, {
    width: colWidths[1] - 10,
    align: 'center',
  });
  doc.text(
    new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency: 'NOK',
    }).format(quoteData.basePrice),
    tableLeft + colWidths[0] + colWidths[1] + 5,
    currentY + 8,
    {
      width: colWidths[2] - 10,
      align: 'right',
    }
  );

  currentY += rowHeight;

  // Additional services
  if (quoteData.additionalServices && quoteData.additionalServices.length > 0) {
    quoteData.additionalServices.forEach((service) => {
      if (currentY > 700) {
        doc.addPage();
        currentY = 50;
      }

      doc.rect(tableLeft, currentY, tableWidth, rowHeight).stroke();
      
      const serviceName = typeof service === 'string' ? service : service.name;
      const servicePrice = typeof service === 'object' && service.price ? service.price : 1000;

      doc.text(serviceName, tableLeft + 5, currentY + 8, {
        width: colWidths[0] - 10,
        ellipsis: true,
      });
      doc.text('1', tableLeft + colWidths[0] + 5, currentY + 8, {
        width: colWidths[1] - 10,
        align: 'center',
      });
      doc.text(
        new Intl.NumberFormat('nb-NO', {
          style: 'currency',
          currency: 'NOK',
        }).format(servicePrice),
        tableLeft + colWidths[0] + colWidths[1] + 5,
        currentY + 8,
        {
          width: colWidths[2] - 10,
          align: 'right',
        }
      );

      currentY += rowHeight;
    });
  }

  // Total row
  doc.font('Helvetica-Bold');
  doc.rect(tableLeft, currentY, tableWidth, rowHeight).stroke();
  doc.text('TOTAL / TOTAL', tableLeft + 5, currentY + 8);
  doc.text(
    new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency: 'NOK',
    }).format(quoteData.totalPrice),
    tableLeft + colWidths[0] + colWidths[1] + 5,
    currentY + 8,
    {
      width: colWidths[2] - 10,
      align: 'right',
    }
  );

  doc.moveDown(2);

  // Notes
  if (quoteData.notes) {
    doc.fontSize(12).font('Helvetica-Bold');
    doc.text('NOTATER / NOTES', { underline: true });
    doc.moveDown(0.5);

    doc.fontSize(10).font('Helvetica');
    doc.text(quoteData.notes);
    doc.moveDown(1);
  }

  // Terms and Conditions
  doc.fontSize(12).font('Helvetica-Bold');
  doc.text('VILKÅR OG BETINGELSER / TERMS AND CONDITIONS', { underline: true });
  doc.moveDown(0.5);

  doc.fontSize(9).font('Helvetica');
  doc.text('• Dette tilbudet er gyldig til angitt dato. / This quote is valid until the specified date.');
  doc.text('• Priser er eksklusiv mva. / Prices are exclusive of VAT.');
  doc.text('• Betalingsbetingelser: 50% ved bestilling, 50% ved levering. / Payment terms: 50% upon order, 50% upon delivery.');
  doc.text('• Alle priser er i norske kroner (NOK). / All prices are in Norwegian kroner (NOK).');
  doc.moveDown(2);

  // Signatures section
  if (includeSignatures) {
    doc.fontSize(14).font('Helvetica-Bold');
    doc.text('SIGNATURER / SIGNATURES', { underline: true });
    doc.moveDown(1);

    // Client signature
    doc.fontSize(11).font('Helvetica');
    doc.text(`Kunde / Client: ${quoteData.clientInfo.name}`);
    doc.text('Signature: _________________________');
    doc.text('Date: _________________________');
    doc.moveDown(1);

    // Approver signatures
    if (quoteData.approvers && quoteData.approvers.length > 0) {
      quoteData.approvers.forEach((approver, index) => {
        doc.text(`Godkjenner ${index + 1} / Approver ${index + 1}: ${approver.name}`);
        doc.text('Signature: _________________________');
        doc.text('Date: _________________________');
        doc.moveDown(1);
      });
    }

    // Provider signature
    doc.text('Leverandør / Provider: CreatorHub Norge');
    doc.text('Signature: _________________________');
    doc.text('Date: _________________________');
  }

  // Footer on each page
  const pageCount = doc.bufferedPageRange().count;
  for (let i = 0; i < pageCount; i++) {
    doc.switchToPage(i);
    doc.fontSize(8).fillColor('#666666');
    doc.text(
      `Page ${i + 1} of ${pageCount} | Generated by CreatorHub Norge | ${new Date().toLocaleString('no-NO')}`,
      50,
      doc.page.height - 30,
      { align: 'center', width: 500 }
    );
    doc.fillColor('#000000');
  }

  // Finalize PDF
  doc.end();

  // Wait for PDF to be generated
  return new Promise((resolve, reject) => {
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(buffers);
      resolve(pdfBuffer);
    });
    doc.on('error', reject);
  });
}























