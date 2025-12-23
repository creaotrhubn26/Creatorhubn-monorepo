/**
 * Wedding Timeline Contract PDF Generation Service
 * Generates professional PDF contracts for wedding services using pdfkit
 */

import PDFDocument from 'pdfkit';

interface WeddingTimelinePDFOptions {
  includeSignatures?: boolean;
  template?: 'standard' | 'detailed' | 'minimal';
  watermark?: string;
}

interface WeddingTimelineData {
  id: string;
  projectId: string;
  projectName: string;
  coupleName: string;
  weddingDate: string;
  venue?: string;
  culturalType?: string;
  profession?: string;
  photographerName?: string;
  photographerEmail?: string;
  photographerPhone?: string;
  clientEmail?: string;
  clientPhone?: string;
  services?: Array<{
    name: string;
    description?: string;
    price?: number;
  }>;
  totalPrice?: number;
  depositAmount?: number;
  balanceDue?: number;
  paymentTerms?: string;
  cancellationPolicy?: string;
  createdAt: string;
  status?: string;
}

/**
 * Generate PDF contract for wedding timeline
 */
export async function generateWeddingTimelineContractPDF(
  timelineData: WeddingTimelineData,
  options: WeddingTimelinePDFOptions = {}
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
      Title: `Wedding Contract - ${timelineData.coupleName}`,
      Author: 'CreatorHub Norge',
      Subject: 'Wedding Service Contract',
      Creator: 'CreatorHub Wedding Timeline System',
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
  doc.text('BRUDEKONTRAKT / WEDDING CONTRACT', { align: 'center' });
  doc.moveDown(0.5);

  doc.fontSize(16).font('Helvetica');
  doc.text(`Prosjekt: ${timelineData.projectName}`, { align: 'center' });
  doc.moveDown(1);

  // Document Info
  doc.fontSize(10).fillColor('#666666');
  doc.text(`Contract ID: ${timelineData.id}`, { align: 'left' });
  doc.text(`Project ID: ${timelineData.projectId}`, { align: 'left' });
  doc.text(`Created: ${new Date(timelineData.createdAt).toLocaleDateString('no-NO')}`, { align: 'left' });
  if (timelineData.status) {
    doc.text(`Status: ${timelineData.status.toUpperCase()}`, { align: 'left' });
  }
  doc.moveDown(1);
  doc.fillColor('#000000');

  // Parties Information
  doc.fontSize(14).font('Helvetica-Bold');
  doc.text('PARTER / PARTIES', { underline: true });
  doc.moveDown(0.5);

  doc.fontSize(11).font('Helvetica');
  doc.text('Brudepar / Couple:');
  doc.text(`  Navn / Name: ${timelineData.coupleName}`);
  if (timelineData.clientEmail) {
    doc.text(`  E-post / Email: ${timelineData.clientEmail}`);
  }
  if (timelineData.clientPhone) {
    doc.text(`  Telefon / Phone: ${timelineData.clientPhone}`);
  }
  doc.moveDown(0.5);

  doc.text('Fotograf / Photographer:');
  if (timelineData.photographerName) {
    doc.text(`  Navn / Name: ${timelineData.photographerName}`);
  } else {
    doc.text('  Navn / Name: CreatorHub Norge');
  }
  if (timelineData.photographerEmail) {
    doc.text(`  E-post / Email: ${timelineData.photographerEmail}`);
  }
  if (timelineData.photographerPhone) {
    doc.text(`  Telefon / Phone: ${timelineData.photographerPhone}`);
  }
  doc.moveDown(1);

  // Wedding Details
  doc.fontSize(14).font('Helvetica-Bold');
  doc.text('BRUDEDETALJER / WEDDING DETAILS', { underline: true });
  doc.moveDown(0.5);

  doc.fontSize(11).font('Helvetica');
  doc.text(`Bryllupsdato / Wedding Date: ${new Date(timelineData.weddingDate).toLocaleDateString('no-NO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })}`);
  
  if (timelineData.venue) {
    doc.text(`Lokasjon / Venue: ${timelineData.venue}`);
  }
  
  if (timelineData.culturalType) {
    doc.text(`Kulturtype / Cultural Type: ${timelineData.culturalType}`);
  }
  doc.moveDown(1);

  // Services
  if (timelineData.services && timelineData.services.length > 0) {
    doc.fontSize(14).font('Helvetica-Bold');
    doc.text('TJENESTER / SERVICES', { underline: true });
    doc.moveDown(0.5);

    const tableTop = doc.y;
    const tableLeft = 50;
    const tableWidth = 500;
    const rowHeight = 25;
    const colWidths = [350, 150]; // Service, Price

    // Header row
    doc.fontSize(10).font('Helvetica-Bold');
    doc.fillColor('#333333');
    doc.rect(tableLeft, tableTop, tableWidth, rowHeight).stroke();
    
    doc.text('Tjeneste / Service', tableLeft + 5, tableTop + 8);
    doc.text('Pris / Price', tableLeft + colWidths[0] + 5, tableTop + 8);

    // Service rows
    let currentY = tableTop + rowHeight;
    doc.font('Helvetica').fontSize(10);
    
    timelineData.services.forEach((service) => {
      if (currentY > 700) {
        doc.addPage();
        currentY = 50;
      }

      doc.rect(tableLeft, currentY, tableWidth, rowHeight).stroke();
      
      doc.fillColor('#000000');
      const serviceText = service.description 
        ? `${service.name}\n${service.description}`
        : service.name;
      
      doc.text(serviceText, tableLeft + 5, currentY + 5, {
        width: colWidths[0] - 10,
        ellipsis: true,
      });

      const price = service.price || 0;
      doc.text(
        price > 0
          ? new Intl.NumberFormat('nb-NO', {
              style: 'currency',
              currency: 'NOK',
            }).format(price)
          : 'Inkludert / Included',
        tableLeft + colWidths[0] + 5,
        currentY + 8,
        {
          width: colWidths[1] - 10,
          align: 'right',
        }
      );

      currentY += rowHeight;
    });

    // Total row
    if (timelineData.totalPrice) {
      doc.font('Helvetica-Bold');
      doc.rect(tableLeft, currentY, tableWidth, rowHeight).stroke();
      doc.text('TOTAL / TOTAL', tableLeft + 5, currentY + 8);
      doc.text(
        new Intl.NumberFormat('nb-NO', {
          style: 'currency',
          currency: 'NOK',
        }).format(timelineData.totalPrice),
        tableLeft + colWidths[0] + 5,
        currentY + 8,
        {
          width: colWidths[1] - 10,
          align: 'right',
        }
      );
    }

    doc.moveDown(2);
  }

  // Payment Terms
  if (timelineData.depositAmount || timelineData.balanceDue || timelineData.paymentTerms) {
    doc.fontSize(14).font('Helvetica-Bold');
    doc.text('BETALINGSVILKÅR / PAYMENT TERMS', { underline: true });
    doc.moveDown(0.5);

    doc.fontSize(11).font('Helvetica');
    if (timelineData.depositAmount) {
      doc.text(`Depositum / Deposit: ${new Intl.NumberFormat('nb-NO', {
        style: 'currency',
        currency: 'NOK',
      }).format(timelineData.depositAmount)}`);
    }
    if (timelineData.balanceDue) {
      doc.text(`Gjenstående beløp / Balance Due: ${new Intl.NumberFormat('nb-NO', {
        style: 'currency',
        currency: 'NOK',
      }).format(timelineData.balanceDue)}`);
    }
    if (timelineData.paymentTerms) {
      doc.text(`Betalingsbetingelser / Payment Terms: ${timelineData.paymentTerms}`);
    } else {
      doc.text('Betalingsbetingelser / Payment Terms: 50% ved bestilling, 50% ved levering');
    }
    doc.moveDown(1);
  }

  // Cancellation Policy
  if (timelineData.cancellationPolicy) {
    doc.fontSize(14).font('Helvetica-Bold');
    doc.text('AVBESTILLINGSPOLICY / CANCELLATION POLICY', { underline: true });
    doc.moveDown(0.5);

    doc.fontSize(11).font('Helvetica');
    doc.text(timelineData.cancellationPolicy);
    doc.moveDown(1);
  }

  // General Terms
  doc.fontSize(14).font('Helvetica-Bold');
  doc.text('VILKÅR OG BETINGELSER / TERMS AND CONDITIONS', { underline: true });
  doc.moveDown(0.5);

  doc.fontSize(9).font('Helvetica');
  doc.text('• Alle priser er eksklusiv mva. / All prices are exclusive of VAT.');
  doc.text('• Leveringstid for ferdige bilder: 4-6 uker etter bryllupet. / Delivery time for finished photos: 4-6 weeks after wedding.');
  doc.text('• Klienten har rett til å be om endringer innen 14 dager etter levering. / Client has the right to request changes within 14 days of delivery.');
  doc.text('• Fotografen beholder opphavsretten til alle bilder. / Photographer retains copyright to all photos.');
  doc.text('• Klienten får lisens til personlig bruk av bildene. / Client receives license for personal use of photos.');
  doc.moveDown(2);

  // Signatures section
  if (includeSignatures) {
    doc.fontSize(14).font('Helvetica-Bold');
    doc.text('SIGNATURER / SIGNATURES', { underline: true });
    doc.moveDown(1);

    // Client signature
    doc.fontSize(11).font('Helvetica');
    doc.text(`Brudepar / Couple: ${timelineData.coupleName}`);
    doc.text('Signature: _________________________');
    doc.text('Date: _________________________');
    doc.moveDown(1);

    // Photographer signature
    doc.text(`Fotograf / Photographer: ${timelineData.photographerName || 'CreatorHub Norge'}`);
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























