/**
 * Photo Enhancement Service Contract PDF Generation Service
 * Generates professional PDF contracts for photo enhancement services using pdfkit
 */

import PDFDocument from 'pdfkit';

interface PhotoEnhancementContractPDFOptions {
  includeSignatures?: boolean;
  template?: 'standard' | 'detailed' | 'minimal';
  watermark?: string;
}

interface PhotoEnhancementContractData {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  serviceType: string; // 'upscale', 'face_restore', 'denoise', 'colorize', 'batch'
  filesCount: number;
  processingOptions?: {
    upscaleFactor?: number;
    denoiseStrength?: number;
    colorizeStrength?: number;
    outputFormat?: string;
    outputQuality?: number;
  };
  estimatedPrice?: number;
  estimatedProcessingTime?: string;
  terms?: string;
  createdAt: string;
}

/**
 * Generate PDF contract for photo enhancement service
 */
export async function generatePhotoEnhancementContractPDF(
  contractData: PhotoEnhancementContractData,
  options: PhotoEnhancementContractPDFOptions = {}
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
      Title: `Photo Enhancement Service Contract - ${contractData.serviceType}`,
      Author: 'CreatorHub Norge',
      Subject: 'Photo Enhancement Service Contract',
      Creator: 'CreatorHub Photo Enhancement System',
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
  doc.text('BILDEFORBEDRINGSTJENESTE KONTRAKT', { align: 'center' });
  doc.text('PHOTO ENHANCEMENT SERVICE CONTRACT', { align: 'center' });
  doc.moveDown(0.5);

  doc.fontSize(16).font('Helvetica');
  doc.text(`Tjenestetype / Service Type: ${contractData.serviceType.toUpperCase()}`, { align: 'center' });
  doc.moveDown(1);

  // Document Info
  doc.fontSize(10).fillColor('#666666');
  doc.text(`Contract ID: ${contractData.id}`, { align: 'left' });
  doc.text(`User ID: ${contractData.userId}`, { align: 'left' });
  doc.text(`Created: ${new Date(contractData.createdAt).toLocaleDateString('no-NO')}`, { align: 'left' });
  doc.moveDown(1);
  doc.fillColor('#000000');

  // Client Information
  doc.fontSize(14).font('Helvetica-Bold');
  doc.text('KUNDEINFORMASJON / CLIENT INFORMATION', { underline: true });
  doc.moveDown(0.5);

  doc.fontSize(11).font('Helvetica');
  if (contractData.userName) {
    doc.text(`Navn / Name: ${contractData.userName}`);
  }
  if (contractData.userEmail) {
    doc.text(`E-post / Email: ${contractData.userEmail}`);
  }
  doc.moveDown(1);

  // Service Details
  doc.fontSize(14).font('Helvetica-Bold');
  doc.text('TJENESTEDETALJER / SERVICE DETAILS', { underline: true });
  doc.moveDown(0.5);

  doc.fontSize(11).font('Helvetica');
  doc.text(`Tjenestetype / Service Type: ${contractData.serviceType}`);
  doc.text(`Antall filer / Number of Files: ${contractData.filesCount}`);

  if (contractData.processingOptions) {
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold');
    doc.text('Behandlingsalternativer / Processing Options:');
    doc.font('Helvetica');
    
    if (contractData.processingOptions.upscaleFactor) {
      doc.text(`  Oppskalering / Upscale Factor: ${contractData.processingOptions.upscaleFactor}x`);
    }
    if (contractData.processingOptions.denoiseStrength !== undefined) {
      doc.text(`  Støyreduksjon / Denoise Strength: ${contractData.processingOptions.denoiseStrength}`);
    }
    if (contractData.processingOptions.colorizeStrength !== undefined) {
      doc.text(`  Fargelegging / Colorize Strength: ${contractData.processingOptions.colorizeStrength}`);
    }
    if (contractData.processingOptions.outputFormat) {
      doc.text(`  Utdataformat / Output Format: ${contractData.processingOptions.outputFormat.toUpperCase()}`);
    }
    if (contractData.processingOptions.outputQuality) {
      doc.text(`  Utdata-kvalitet / Output Quality: ${contractData.processingOptions.outputQuality}%`);
    }
  }

  if (contractData.estimatedProcessingTime) {
    doc.moveDown(0.5);
    doc.text(`Estimert behandlingstid / Estimated Processing Time: ${contractData.estimatedProcessingTime}`);
  }

  doc.moveDown(1);

  // Pricing
  if (contractData.estimatedPrice) {
    doc.fontSize(14).font('Helvetica-Bold');
    doc.text('PRISING / PRICING', { underline: true });
    doc.moveDown(0.5);

    doc.fontSize(11).font('Helvetica');
    doc.text(`Estimert pris / Estimated Price: ${new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency: 'NOK',
    }).format(contractData.estimatedPrice)}`);
    doc.moveDown(1);
  }

  // Terms and Conditions
  doc.fontSize(14).font('Helvetica-Bold');
  doc.text('VILKÅR OG BETINGELSER / TERMS AND CONDITIONS', { underline: true });
  doc.moveDown(0.5);

  doc.fontSize(9).font('Helvetica');
  if (contractData.terms) {
    doc.text(contractData.terms);
  } else {
    doc.text('• Tjenesten utføres med AI-drevet bildeforbedringsteknologi. / Service is performed using AI-driven photo enhancement technology.');
    doc.text('• Klienten gir tillatelse til behandling av bildene. / Client grants permission for image processing.');
    doc.text('• Opphavsretten tilbildene forblir hos klienten. / Copyright of images remains with the client.');
    doc.text('• CreatorHub Norge beholder rettigheter til forbedrede versjoner for kvalitetssikring. / CreatorHub Norge retains rights to enhanced versions for quality assurance.');
    doc.text('• Leveringstid avhenger av antall filer og kompleksitet. / Delivery time depends on number of files and complexity.');
    doc.text('• Alle priser er eksklusiv mva. / All prices are exclusive of VAT.');
  }
  doc.moveDown(2);

  // Signatures section
  if (includeSignatures) {
    doc.fontSize(14).font('Helvetica-Bold');
    doc.text('SIGNATURER / SIGNATURES', { underline: true });
    doc.moveDown(1);

    // Client signature
    doc.fontSize(11).font('Helvetica');
    doc.text(`Kunde / Client: ${contractData.userName || contractData.userEmail || 'Client'}`);
    doc.text('Signature: _________________________');
    doc.text('Date: _________________________');
    doc.moveDown(1);

    // Service provider signature
    doc.text('Tjenesteleverandør / Service Provider: CreatorHub Norge');
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























