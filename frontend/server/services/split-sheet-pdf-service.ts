/**
 * Split Sheet PDF Generation Service
 * Generates professional PDF documents for split sheets using pdfkit
 */

import PDFDocument from 'pdfkit';
import { db } from '../db';
import { sql } from 'drizzle-orm';

interface SplitSheetPDFOptions {
  includeSignatures?: boolean;
  includeRevenue?: boolean;
  template?: 'standard' | 'legal' | 'minimal';
  watermark?: string;
}

interface Contributor {
  id: string;
  name: string;
  email?: string;
  role: string;
  percentage: number;
  signed_at?: string;
  signature_data?: any;
  order_index: number;
}

interface SplitSheet {
  id: string;
  title: string;
  description?: string;
  status: string;
  total_percentage: number;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  project_id?: string;
  track_id?: string;
}

/**
 * Generate PDF for split sheet
 */
export async function generateSplitSheetPDF(
  splitSheetId: string,
  options: SplitSheetPDFOptions = {}
): Promise<Buffer> {
  const {
    includeSignatures = true,
    includeRevenue = false,
    template = 'standard',
    watermark,
  } = options;

  // Fetch split sheet data
  const splitSheetQuery = sql`
    SELECT * FROM split_sheets WHERE id = ${splitSheetId}
  `;
  const splitSheetResult = await db.execute(splitSheetQuery);
  
  if (splitSheetResult.rows.length === 0) {
    throw new Error('Split sheet not found');
  }

  const splitSheet: SplitSheet = splitSheetResult.rows[0] as any;

  // Fetch contributors
  const contributorsQuery = sql`
    SELECT * FROM split_sheet_contributors 
    WHERE split_sheet_id = ${splitSheetId}
    ORDER BY order_index, created_at
  `;
  const contributorsResult = await db.execute(contributorsQuery);
  const contributors: Contributor[] = contributorsResult.rows as any[];

  // Create PDF document
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
    info: {
      Title: splitSheet.title,
      Author: 'CreatorHub Norge',
      Subject: 'Split Sheet Agreement',
      Creator: 'CreatorHub Split Sheet System',
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
  doc.text('SPLIT SHEET AGREEMENT', { align: 'center' });
  doc.moveDown(0.5);

  doc.fontSize(16).font('Helvetica');
  doc.text(splitSheet.title, { align: 'center' });
  doc.moveDown(1);

  // Document Info
  doc.fontSize(10).fillColor('#666666');
  doc.text(`Document ID: ${splitSheet.id}`, { align: 'left' });
  doc.text(`Created: ${new Date(splitSheet.created_at).toLocaleDateString('no-NO')}`, { align: 'left' });
  if (splitSheet.completed_at) {
    doc.text(`Completed: ${new Date(splitSheet.completed_at).toLocaleDateString('no-NO')}`, { align: 'left' });
  }
  doc.moveDown(1);
  doc.fillColor('#000000');

  // Description
  if (splitSheet.description) {
    doc.fontSize(12).font('Helvetica');
    doc.text('Description:', { underline: true });
    doc.font('Helvetica');
    doc.text(splitSheet.description);
    doc.moveDown(1);
  }

  // Status
  doc.fontSize(12).font('Helvetica-Bold');
  doc.text(`Status: ${splitSheet.status.toUpperCase()}`, { align: 'left' });
  doc.moveDown(1);

  // Contributors Table
  doc.fontSize(14).font('Helvetica-Bold');
  doc.text('OWNERSHIP DISTRIBUTION', { underline: true });
  doc.moveDown(0.5);

  // Table Header
  const tableTop = doc.y;
  const tableLeft = 50;
  const tableWidth = 500;
  const rowHeight = 25;
  const colWidths = [200, 150, 100, 50]; // Name, Role, Percentage, Signed

  // Header row
  doc.fontSize(10).font('Helvetica-Bold');
  doc.fillColor('#333333');
  doc.rect(tableLeft, tableTop, tableWidth, rowHeight).stroke();
  
  doc.text('Name', tableLeft + 5, tableTop + 8);
  doc.text('Role', tableLeft + colWidths[0] + 5, tableTop + 8);
  doc.text('Percentage', tableLeft + colWidths[0] + colWidths[1] + 5, tableTop + 8);
  doc.text('Signed', tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + 5, tableTop + 8);

  // Contributor rows
  let currentY = tableTop + rowHeight;
  doc.font('Helvetica').fontSize(10);
  
  contributors.forEach((contributor, index) => {
    if (currentY > 700) {
      // New page if needed
      doc.addPage();
      currentY = 50;
    }

    doc.rect(tableLeft, currentY, tableWidth, rowHeight).stroke();
    
    // Name
    doc.fillColor('#000000');
    doc.text(contributor.name || 'N/A', tableLeft + 5, currentY + 8, {
      width: colWidths[0] - 10,
      ellipsis: true,
    });

    // Role
    doc.text(contributor.role || 'N/A', tableLeft + colWidths[0] + 5, currentY + 8, {
      width: colWidths[1] - 10,
      ellipsis: true,
    });

    // Percentage
    doc.text(`${contributor.percentage.toFixed(2)}%`, tableLeft + colWidths[0] + colWidths[1] + 5, currentY + 8, {
      width: colWidths[2] - 10,
      align: 'right',
    });

    // Signed status
    if (includeSignatures && contributor.signed_at) {
      doc.fillColor('#00AA00');
      doc.text('✓', tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + 5, currentY + 8);
    } else {
      doc.fillColor('#FF0000');
      doc.text('✗', tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + 5, currentY + 8);
    }
    doc.fillColor('#000000');

    currentY += rowHeight;
  });

  // Total percentage
  doc.font('Helvetica-Bold');
  doc.rect(tableLeft, currentY, tableWidth, rowHeight).stroke();
  doc.text('TOTAL', tableLeft + 5, currentY + 8);
  doc.text(`${splitSheet.total_percentage.toFixed(2)}%`, 
    tableLeft + colWidths[0] + colWidths[1] + 5, currentY + 8, {
      width: colWidths[2] - 10,
      align: 'right',
    });

  doc.moveDown(2);

  // Signatures section
  if (includeSignatures) {
    doc.fontSize(14).font('Helvetica-Bold');
    doc.text('SIGNATURES', { underline: true });
    doc.moveDown(0.5);

    contributors.forEach((contributor, index) => {
      if (contributor.signed_at) {
        doc.fontSize(10).font('Helvetica');
        doc.text(`${contributor.name} (${contributor.role})`, { indent: 20 });
        doc.text(`Signed: ${new Date(contributor.signed_at).toLocaleString('no-NO')}`, { indent: 20 });
        
        if (contributor.signature_data?.name) {
          doc.text(`Signature Name: ${contributor.signature_data.name}`, { indent: 20 });
        }
        doc.moveDown(0.5);
      }
    });
  }

  // Revenue section (if requested)
  if (includeRevenue) {
    doc.addPage();
    doc.fontSize(14).font('Helvetica-Bold');
    doc.text('REVENUE TRACKING', { underline: true });
    doc.moveDown(1);

    const revenueQuery = sql`
      SELECT * FROM split_sheet_revenue 
      WHERE split_sheet_id = ${splitSheetId}
      ORDER BY period_start DESC
      LIMIT 20
    `;
    const revenueResult = await db.execute(revenueQuery);
    
    if (revenueResult.rows.length > 0) {
      doc.fontSize(10).font('Helvetica');
      revenueResult.rows.forEach((revenue: any) => {
        doc.text(`${revenue.revenue_source}: ${revenue.amount} ${revenue.currency}`, { indent: 20 });
        doc.text(`Period: ${new Date(revenue.period_start).toLocaleDateString('no-NO')} - ${new Date(revenue.period_end).toLocaleDateString('no-NO')}`, { indent: 20 });
        doc.moveDown(0.5);
      });
    } else {
      doc.text('No revenue data available', { indent: 20 });
    }
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























