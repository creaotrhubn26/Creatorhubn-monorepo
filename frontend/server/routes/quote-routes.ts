/**
 * Quote Routes
 * Handles quote creation, management, and e-signature workflows
 */

import { Router, Response } from 'express';
import { db } from '../../../creatorhub-backend/server/db';
import { sql } from 'drizzle-orm';
import { isAuthenticated } from '../../../creatorhub-backend/server/simple-auth';
import { generateQuotePDF } from '../services/quote-pdf-service';
import { createSignableGoogleDocFromPDF } from '../services/google-esignature-service';

const router = Router();

/**
 * POST /api/quotes/create
 * Create a new quote
 */
router.post('/create', isAuthenticated, async (req: any, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).session?.user?.id || 'unknown';
    const {
      title,
      description,
      basePrice,
      additionalServices,
      totalPrice,
      validUntil,
      notes,
      clientInfo,
      approvers,
      profession,
      projectType,
      status = 'pending',
    } = req.body;

    // Validate required fields
    if (!title || !description || !basePrice || !clientInfo || !clientInfo.email) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: title, description, basePrice, clientInfo.email',
      });
    }

    // Insert quote into database
    const insertQuery = sql`
      INSERT INTO quotes (
        id, user_id, title, description, base_price, additional_services,
        total_price, valid_until, notes, client_info, approvers,
        profession, project_type, status, created_at, updated_at
      ) VALUES (
        gen_random_uuid(),
        ${userId},
        ${title},
        ${description},
        ${basePrice},
        ${JSON.stringify(additionalServices || [])}::jsonb,
        ${totalPrice || basePrice},
        ${validUntil},
        ${notes || null},
        ${JSON.stringify(clientInfo)}::jsonb,
        ${JSON.stringify(approvers || [])}::jsonb,
        ${profession || null},
        ${projectType || null},
        ${status},
        NOW(),
        NOW()
      )
      RETURNING *
    `;

    const result = await db.execute(insertQuery);
    const quote = result.rows[0];

    res.json({
      success: true,
      data: quote,
    });
  } catch (error) {
    console.error('Error creating quote:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create quote',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/quotes
 * Get all quotes for the authenticated user
 */
router.get('/', isAuthenticated, async (req: any, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).session?.user?.id || 'unknown';

    const query = sql`
      SELECT * FROM quotes
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;

    const result = await db.execute(query);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Error fetching quotes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch quotes',
    });
  }
});

/**
 * GET /api/quotes/:id
 * Get a specific quote
 */
router.get('/:id', isAuthenticated, async (req: any, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).session?.user?.id || 'unknown';
    const { id } = req.params;

    const query = sql`
      SELECT * FROM quotes
      WHERE id = ${id} AND user_id = ${userId}
    `;

    const result = await db.execute(query);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Quote not found',
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error fetching quote:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch quote',
    });
  }
});

/**
 * POST /api/quotes/:id/google-esignature
 * Create Google Doc for e-signature
 */
router.post('/:id/google-esignature', isAuthenticated, async (req: any, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).session?.user?.id || 'unknown';
    const { id } = req.params;

    // Fetch quote
    const quoteQuery = sql`
      SELECT * FROM quotes
      WHERE id = ${id} AND user_id = ${userId}
    `;
    const quoteResult = await db.execute(quoteQuery);

    if (quoteResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Quote not found',
      });
    }

    const quote = quoteResult.rows[0] as any;

    // Prepare quote data for PDF generation
    const quoteData = {
      id: quote.id,
      title: quote.title,
      description: quote.description,
      basePrice: quote.base_price,
      additionalServices: quote.additional_services || [],
      totalPrice: quote.total_price || quote.base_price,
      validUntil: quote.valid_until,
      notes: quote.notes,
      createdAt: quote.created_at,
      status: quote.status,
      clientInfo: quote.client_info,
      approvers: quote.approvers || [],
      profession: quote.profession,
      projectType: quote.project_type,
    };

    // Generate PDF
    const pdfBuffer = await generateQuotePDF(quoteData, {
      includeSignatures: false,
      template: 'standard',
    });

    // Prepare signers list
    const signers = [
      {
        name: quoteData.clientInfo.name,
        email: quoteData.clientInfo.email,
        role: 'Client',
      },
      ...(quoteData.approvers || []).map((approver: any) => ({
        name: approver.name,
        email: approver.email,
        role: 'Approver',
      })),
    ];

    // Create signable Google Doc
    const result = await createSignableGoogleDocFromPDF({
      documentType: 'quote',
      documentId: quote.id,
      documentTitle: quote.title,
      signers,
      userId,
      pdfBuffer,
      emailMessage: `Hei,\n\nDu er invitert til å signere tilbud: ${quote.title}\n\nKlikk på lenken for å se og signere dokumentet.\n\nMed vennlig hilsen,\nCreatorHub Norge`,
    });

    // Store Google Doc info in database
    const updateQuery = sql`
      UPDATE quotes
      SET 
        google_doc_id = ${result.documentId},
        google_doc_url = ${result.documentUrl},
        signature_status = 'pending',
        updated_at = NOW()
      WHERE id = ${id}
    `;
    await db.execute(updateQuery);

    res.json({
      success: true,
      data: {
        documentId: result.documentId,
        documentUrl: result.documentUrl,
        shareUrl: result.shareUrl,
        message: 'Google Doc created and shared with client and approvers for signing',
      },
    });
  } catch (error) {
    console.error('Error creating Google Doc for quote e-signature:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create Google Doc for e-signature',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/quotes/:id/pdf
 * Generate and download quote PDF
 */
router.get('/:id/pdf', isAuthenticated, async (req: any, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).session?.user?.id || 'unknown';
    const { id } = req.params;
    const { signed } = req.query;

    // Fetch quote
    const quoteQuery = sql`
      SELECT * FROM quotes
      WHERE id = ${id} AND user_id = ${userId}
    `;
    const quoteResult = await db.execute(quoteQuery);

    if (quoteResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Quote not found',
      });
    }

    const quote = quoteResult.rows[0] as any;

    // Prepare quote data
    const quoteData = {
      id: quote.id,
      title: quote.title,
      description: quote.description,
      basePrice: quote.base_price,
      additionalServices: quote.additional_services || [],
      totalPrice: quote.total_price || quote.base_price,
      validUntil: quote.valid_until,
      notes: quote.notes,
      createdAt: quote.created_at,
      status: quote.status,
      clientInfo: quote.client_info,
      approvers: quote.approvers || [],
      profession: quote.profession,
      projectType: quote.project_type,
    };

    // Generate PDF
    const pdfBuffer = await generateQuotePDF(quoteData, {
      includeSignatures: signed === 'true',
      template: 'standard',
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="quote-${quote.id}.pdf"`
    );

    // Send PDF
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating quote PDF:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate PDF',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PUT /api/quotes/:id/status
 * Update quote status
 */
router.put('/:id/status', isAuthenticated, async (req: any, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).session?.user?.id || 'unknown';
    const { id } = req.params;
    const { status, signatureStatus } = req.body;

    // Verify ownership
    const checkQuery = sql`
      SELECT * FROM quotes WHERE id = ${id} AND user_id = ${userId}
    `;
    const checkResult = await db.execute(checkQuery);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Quote not found',
      });
    }

    // Update status
    const updateQuery = sql`
      UPDATE quotes
      SET 
        status = ${status || 'pending'},
        signature_status = ${signatureStatus || null},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    const result = await db.execute(updateQuery);

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error updating quote status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update quote status',
    });
  }
});

export default router;























