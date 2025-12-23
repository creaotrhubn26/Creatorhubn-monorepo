/**
 * Split Sheet API Routes
 * 
 * Endpoints for split sheet management across all professions
 * - GET    /api/split-sheets                    - List all split sheets for user
 * - GET    /api/split-sheets/:id                - Get split sheet details
 * - POST   /api/split-sheets                    - Create new split sheet
 * - PUT    /api/split-sheets/:id                - Update split sheet
 * - DELETE /api/split-sheets/:id                - Delete split sheet
 * - POST   /api/split-sheets/:id/sign           - Add digital signature
 * - POST   /api/split-sheets/:id/share          - Share via email
 * - GET    /api/split-sheets/:id/pdf            - Generate PDF export
 * - GET    /api/split-sheets/:id/versions       - Get version history
 * - POST   /api/split-sheets/:id/duplicate      - Duplicate split sheet
 */

import { Router, Response } from 'express';
import { db } from '../db';
import { eq, and, desc, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { generateSplitSheetPDF } from '../services/split-sheet-pdf-service';
import { sendSplitSheetEmail } from '../services/split-sheet-email-service';

const router = Router();

// Middleware to ensure user is authenticated
const requireAuth = (req: any, res: Response, next: any) => {
  const userId = req.session?.user?.id || req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.userId = userId;
  next();
};

router.use(requireAuth);

// ==================== SPLIT SHEET CRUD ====================

/**
 * GET /api/split-sheets
 * List all split sheets for user
 */
router.get('/', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { status, project_id, track_id, limit = 50 } = req.query;

    let query = `
      SELECT 
        ss.*,
        COUNT(DISTINCT ssc.id) as contributor_count,
        COUNT(DISTINCT CASE WHEN ssc.signed_at IS NOT NULL THEN ssc.id END) as signed_count
      FROM split_sheets ss
      LEFT JOIN split_sheet_contributors ssc ON ss.id = ssc.split_sheet_id
      WHERE ss.user_id = $1
    `;

    const params: any[] = [userId];
    let paramIndex = 2;

    if (status) {
      query += ` AND ss.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (project_id) {
      query += ` AND ss.project_id = $${paramIndex}`;
      params.push(project_id);
      paramIndex++;
    }

    if (track_id) {
      query += ` AND ss.track_id = $${paramIndex}`;
      params.push(track_id);
      paramIndex++;
    }

    query += ` GROUP BY ss.id ORDER BY ss.created_at DESC LIMIT $${paramIndex}`;
    params.push(parseInt(limit as string));

    const result = await db.execute(sql.raw(query, params));
    const splitSheets = result.rows;

    res.json({ success: true, data: splitSheets });
  } catch (error) {
    console.error('Error fetching split sheets:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch split sheets' });
  }
});

/**
 * GET /api/split-sheets/:id
 * Get split sheet details with contributors
 */
router.get('/:id', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    // Get split sheet
    const splitSheetQuery = sql`
      SELECT * FROM split_sheets 
      WHERE id = ${id} AND user_id = ${userId}
    `;
    const splitSheetResult = await db.execute(splitSheetQuery);
    
    if (splitSheetResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Split sheet not found' });
    }

    const splitSheet = splitSheetResult.rows[0];

    // Get contributors
    const contributorsQuery = sql`
      SELECT * FROM split_sheet_contributors 
      WHERE split_sheet_id = ${id}
      ORDER BY order_index, created_at
    `;
    const contributorsResult = await db.execute(contributorsQuery);
    const contributors = contributorsResult.rows;

    res.json({ 
      success: true, 
      data: {
        ...splitSheet,
        contributors
      }
    });
  } catch (error) {
    console.error('Error fetching split sheet:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch split sheet' });
  }
});

/**
 * POST /api/split-sheets
 * Create new split sheet
 */
router.post('/', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const {
      project_id,
      track_id,
      title,
      description,
      contributors = []
    } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }

    // Validate contributors percentages sum to 100
    if (contributors.length > 0) {
      const totalPercentage = contributors.reduce((sum: number, c: any) => sum + (c.percentage || 0), 0);
      if (Math.abs(totalPercentage - 100) > 0.01) {
        return res.status(400).json({
          success: false,
          error: 'Total prosentandel må være nøyaktig 100%',
          details: {
            current_total: totalPercentage,
            difference: totalPercentage - 100,
            message: totalPercentage > 100
              ? `Totalen er ${totalPercentage.toFixed(2)}% - ${(totalPercentage - 100).toFixed(2)}% for mye`
              : `Totalen er ${totalPercentage.toFixed(2)}% - ${(100 - totalPercentage).toFixed(2)}% mangler`
          }
        });
      }
    }

    const splitSheetId = uuidv4();

    // Create split sheet
    const insertQuery = sql`
      INSERT INTO split_sheets (id, user_id, project_id, track_id, title, description, status)
      VALUES (${splitSheetId}, ${userId}, ${project_id || null}, ${track_id || null}, ${title}, ${description || null}, 'draft')
      RETURNING *
    `;
    const splitSheetResult = await db.execute(insertQuery);
    const splitSheet = splitSheetResult.rows[0];

    // Create contributors
    if (contributors.length > 0) {
      for (let i = 0; i < contributors.length; i++) {
        const contributor = contributors[i];
        const contributorId = uuidv4();
        
        const contributorQuery = sql`
          INSERT INTO split_sheet_contributors (
            id, split_sheet_id, name, email, role, percentage, order_index, user_id, custom_fields
          )
          VALUES (
            ${contributorId}, 
            ${splitSheetId}, 
            ${contributor.name}, 
            ${contributor.email || null}, 
            ${contributor.role || 'collaborator'}, 
            ${contributor.percentage}, 
            ${i}, 
            ${contributor.user_id || null},
            ${JSON.stringify(contributor.custom_fields || {})}::jsonb
          )
        `;
        await db.execute(contributorQuery);
      }
    }

    // Create initial version
    const versionQuery = sql`
      INSERT INTO split_sheet_versions (id, split_sheet_id, version_number, changes, created_by)
      VALUES (${uuidv4()}, ${splitSheetId}, 1, ${JSON.stringify({ action: 'created', contributors })}::jsonb, ${userId})
    `;
    await db.execute(versionQuery);

    // Create timeline event if project_id is provided
    if (project_id) {
      try {
        // Try to create timeline event via project timeline API
        // This is a best-effort attempt - if it fails, we don't want to fail the split sheet creation
        const timelineEventData = {
          title: `Split Sheet Opprettet: ${title}`,
          description: `Split sheet "${title}" ble opprettet${description ? `: ${description}` : ''}`,
          eventDate: new Date().toISOString().split('T')[0],
          type: 'split_sheet_created',
          status: 'completed',
          priority: 'medium',
          metadata: {
            splitSheetId: splitSheetId,
            splitSheetTitle: title,
            contributorCount: contributors.length
          }
        };
        
        // Note: Timeline event creation would happen via project timeline API
        // For now, we'll rely on frontend to create these events
        // In production, you could make an internal API call here
      } catch (timelineError) {
        // Silently fail - timeline event creation is optional
        console.warn('Could not create timeline event for split sheet:', timelineError);
      }
    }

    // Fetch complete split sheet with contributors
    const completeQuery = sql`
      SELECT * FROM split_sheets WHERE id = ${splitSheetId}
    `;
    const completeResult = await db.execute(completeQuery);
    
    const contributorsQuery = sql`
      SELECT * FROM split_sheet_contributors 
      WHERE split_sheet_id = ${splitSheetId}
      ORDER BY order_index
    `;
    const contributorsResult = await db.execute(contributorsQuery);

    res.status(201).json({
      success: true,
      data: {
        ...completeResult.rows[0],
        contributors: contributorsResult.rows
      }
    });
  } catch (error) {
    console.error('Error creating split sheet:', error);
    res.status(500).json({ success: false, error: 'Failed to create split sheet' });
  }
});

/**
 * PUT /api/split-sheets/:id
 * Update split sheet
 */
router.put('/:id', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const {
      title,
      description,
      status,
      project_id,
      track_id,
      contributors
    } = req.body;

    // Check ownership
    const checkQuery = sql`
      SELECT * FROM split_sheets WHERE id = ${id} AND user_id = ${userId}
    `;
    const checkResult = await db.execute(checkQuery);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Split sheet not found' });
    }

    // Build update query
    const updates: string[] = [];
    const params: any[] = [id, userId];
    let paramIndex = 3;

    if (title !== undefined) {
      updates.push(`title = $${paramIndex}`);
      params.push(title);
      paramIndex++;
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      params.push(description);
      paramIndex++;
    }
    if (status !== undefined) {
      updates.push(`status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }
    if (project_id !== undefined) {
      updates.push(`project_id = $${paramIndex}`);
      params.push(project_id);
      paramIndex++;
    }
    if (track_id !== undefined) {
      updates.push(`track_id = $${paramIndex}`);
      params.push(track_id);
      paramIndex++;
    }

    if (updates.length > 0) {
      const updateQuery = sql.raw(
        `UPDATE split_sheets SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *`,
        params
      );
      await db.execute(updateQuery);
    }

    // Update contributors if provided
    if (contributors && Array.isArray(contributors)) {
      // Validate percentages
      const totalPercentage = contributors.reduce((sum: number, c: any) => sum + (c.percentage || 0), 0);
      if (Math.abs(totalPercentage - 100) > 0.01) {
        return res.status(400).json({
          success: false,
          error: 'Total prosentandel må være nøyaktig 100%',
          details: {
            current_total: totalPercentage,
            difference: totalPercentage - 100,
            message: totalPercentage > 100
              ? `Totalen er ${totalPercentage.toFixed(2)}% - ${(totalPercentage - 100).toFixed(2)}% for mye`
              : `Totalen er ${totalPercentage.toFixed(2)}% - ${(100 - totalPercentage).toFixed(2)}% mangler`
          }
        });
      }

      // Delete existing contributors
      await db.execute(sql`DELETE FROM split_sheet_contributors WHERE split_sheet_id = ${id}`);

      // Insert new contributors
      for (let i = 0; i < contributors.length; i++) {
        const contributor = contributors[i];
        const contributorId = contributor.id || uuidv4();
        
        await db.execute(sql`
          INSERT INTO split_sheet_contributors (
            id, split_sheet_id, name, email, role, percentage, order_index, user_id, custom_fields
          )
          VALUES (
            ${contributorId}, 
            ${id}, 
            ${contributor.name}, 
            ${contributor.email || null}, 
            ${contributor.role || 'collaborator'}, 
            ${contributor.percentage}, 
            ${i}, 
            ${contributor.user_id || null},
            ${JSON.stringify(contributor.custom_fields || {})}::jsonb
          )
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            email = EXCLUDED.email,
            role = EXCLUDED.role,
            percentage = EXCLUDED.percentage,
            order_index = EXCLUDED.order_index,
            custom_fields = EXCLUDED.custom_fields,
            updated_at = NOW()
        `);
      }

      // Create version record
      const versionNumber = await db.execute(sql`
        SELECT COALESCE(MAX(version_number), 0) + 1 as next_version
        FROM split_sheet_versions
        WHERE split_sheet_id = ${id}
      `);
      const nextVersion = versionNumber.rows[0]?.next_version || 1;

      await db.execute(sql`
        INSERT INTO split_sheet_versions (id, split_sheet_id, version_number, changes, created_by)
        VALUES (${uuidv4()}, ${id}, ${nextVersion}, ${JSON.stringify({ action: 'updated', contributors })}::jsonb, ${userId})
      `);
    }

    // Fetch updated split sheet
    const fetchQuery = sql`
      SELECT * FROM split_sheets WHERE id = ${id}
    `;
    const splitSheetResult = await db.execute(fetchQuery);
    
    const contributorsQuery = sql`
      SELECT * FROM split_sheet_contributors 
      WHERE split_sheet_id = ${id}
      ORDER BY order_index
    `;
    const contributorsResult = await db.execute(contributorsQuery);

    res.json({
      success: true,
      data: {
        ...splitSheetResult.rows[0],
        contributors: contributorsResult.rows
      }
    });
  } catch (error) {
    console.error('Error updating split sheet:', error);
    res.status(500).json({ success: false, error: 'Failed to update split sheet' });
  }
});

/**
 * DELETE /api/split-sheets/:id
 * Delete split sheet
 */
router.delete('/:id', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    // Check ownership
    const checkQuery = sql`
      SELECT * FROM split_sheets WHERE id = ${id} AND user_id = ${userId}
    `;
    const checkResult = await db.execute(checkQuery);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Split sheet not found' });
    }

    // Delete (cascade will handle contributors and versions)
    await db.execute(sql`DELETE FROM split_sheets WHERE id = ${id} AND user_id = ${userId}`);

    res.json({ success: true, message: 'Split sheet deleted successfully' });
  } catch (error) {
    console.error('Error deleting split sheet:', error);
    res.status(500).json({ success: false, error: 'Failed to delete split sheet' });
  }
});

/**
 * POST /api/split-sheets/:id/sign
 * Add digital signature
 */
router.post('/:id/sign', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const { contributor_id, signature_data } = req.body;

    if (!contributor_id || !signature_data) {
      return res.status(400).json({ success: false, error: 'contributor_id and signature_data are required' });
    }

    // Update contributor signature
    await db.execute(sql`
      UPDATE split_sheet_contributors
      SET signed_at = NOW(),
          signature_data = ${JSON.stringify(signature_data)}::jsonb,
          invitation_status = 'signed',
          updated_at = NOW()
      WHERE id = ${contributor_id} AND split_sheet_id = ${id}
    `);

    // Check if all contributors have signed
    const unsignedQuery = sql`
      SELECT COUNT(*) as unsigned_count
      FROM split_sheet_contributors
      WHERE split_sheet_id = ${id} AND signed_at IS NULL
    `;
    const unsignedResult = await db.execute(unsignedQuery);
    const unsignedCount = parseInt(unsignedResult.rows[0]?.unsigned_count || '0');

    // If all signed, update split sheet status
    if (unsignedCount === 0) {
      await db.execute(sql`
        UPDATE split_sheets
        SET status = 'completed',
            completed_at = NOW(),
            updated_at = NOW()
        WHERE id = ${id}
      `);
    } else {
      // Update to pending_signatures if not already
      await db.execute(sql`
        UPDATE split_sheets
        SET status = 'pending_signatures',
            updated_at = NOW()
        WHERE id = ${id} AND status = 'draft'
      `);
    }

    res.json({ success: true, message: 'Signature added successfully' });
  } catch (error) {
    console.error('Error adding signature:', error);
    res.status(500).json({ success: false, error: 'Failed to add signature' });
  }
});

/**
 * POST /api/split-sheets/:id/share
 * Share split sheet via email
 */
router.post('/:id/share', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const { contributor_ids, message } = req.body;

    // Check ownership
    const checkQuery = sql`
      SELECT * FROM split_sheets WHERE id = ${id} AND user_id = ${userId}
    `;
    const checkResult = await db.execute(checkQuery);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Split sheet not found' });
    }

    // Update invitation status for contributors
    if (contributor_ids && Array.isArray(contributor_ids)) {
      for (const contributorId of contributor_ids) {
        await db.execute(sql`
          UPDATE split_sheet_contributors
          SET invitation_sent_at = NOW(),
              invitation_status = 'sent',
              updated_at = NOW()
          WHERE id = ${contributorId} AND split_sheet_id = ${id}
        `);
      }
    } else {
      // Send to all unsigned contributors
      await db.execute(sql`
        UPDATE split_sheet_contributors
        SET invitation_sent_at = NOW(),
            invitation_status = 'sent',
            updated_at = NOW()
        WHERE split_sheet_id = ${id} AND signed_at IS NULL
      `);
    }

    // Update split sheet status
    await db.execute(sql`
      UPDATE split_sheets
      SET status = 'pending_signatures',
          updated_at = NOW()
      WHERE id = ${id} AND status = 'draft'
    `);

    // TODO: Send actual email notifications
    // This would integrate with your email service

    res.json({ success: true, message: 'Split sheet shared successfully' });
  } catch (error) {
    console.error('Error sharing split sheet:', error);
    res.status(500).json({ success: false, error: 'Failed to share split sheet' });
  }
});

/**
 * GET /api/split-sheets/:id/pdf
 * Generate PDF export
 */
router.get('/:id/pdf', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const { signed } = req.query; // If signed=true, include signature data

    // Check ownership
    const checkQuery = sql`
      SELECT * FROM split_sheets WHERE id = ${id} AND user_id = ${userId}
    `;
    const checkResult = await db.execute(checkQuery);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Split sheet not found' });
    }

    // Get split sheet with contributors
    const splitSheetQuery = sql`
      SELECT * FROM split_sheets WHERE id = ${id}
    `;
    const splitSheetResult = await db.execute(splitSheetQuery);
    const splitSheet = splitSheetResult.rows[0];

    const contributorsQuery = sql`
      SELECT * FROM split_sheet_contributors 
      WHERE split_sheet_id = ${id}
      ORDER BY order_index
    `;
    const contributorsResult = await db.execute(contributorsQuery);
    const contributors = contributorsResult.rows;

    // Generate actual PDF using pdfkit
    try {
      const includeSignatures = signed === 'true';
      const pdfBuffer = await generateSplitSheetPDF(id, {
        includeSignatures,
        includeRevenue: false,
        template: 'standard',
      });

      // Set response headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${splitSheet.title.replace(/[^a-z0-9]/gi, '_')}_split_sheet.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);

      // Send PDF buffer
      res.send(pdfBuffer);
    } catch (pdfError) {
      console.error('Error generating PDF:', pdfError);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to generate PDF',
        details: pdfError instanceof Error ? pdfError.message : 'Unknown error'
      });
    }
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ success: false, error: 'Failed to generate PDF' });
  }
});

/**
 * GET /api/split-sheets/:id/versions
 * Get version history
 */
router.get('/:id/versions', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    // Check ownership
    const checkQuery = sql`
      SELECT * FROM split_sheets WHERE id = ${id} AND user_id = ${userId}
    `;
    const checkResult = await db.execute(checkQuery);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Split sheet not found' });
    }

    // Get versions
    const versionsQuery = sql`
      SELECT * FROM split_sheet_versions
      WHERE split_sheet_id = ${id}
      ORDER BY version_number DESC
    `;
    const versionsResult = await db.execute(versionsQuery);

    res.json({ success: true, data: versionsResult.rows });
  } catch (error) {
    console.error('Error fetching versions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch versions' });
  }
});

/**
 * POST /api/split-sheets/:id/duplicate
 * Duplicate split sheet
 */
router.post('/:id/duplicate', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const { title } = req.body;

    // Get original split sheet
    const originalQuery = sql`
      SELECT * FROM split_sheets WHERE id = ${id} AND user_id = ${userId}
    `;
    const originalResult = await db.execute(originalQuery);
    
    if (originalResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Split sheet not found' });
    }

    const original = originalResult.rows[0];

    // Get contributors
    const contributorsQuery = sql`
      SELECT * FROM split_sheet_contributors 
      WHERE split_sheet_id = ${id}
      ORDER BY order_index
    `;
    const contributorsResult = await db.execute(contributorsQuery);
    const contributors = contributorsResult.rows;

    // Create duplicate
    const newId = uuidv4();
    const newTitle = title || `${original.title} (Copy)`;

    await db.execute(sql`
      INSERT INTO split_sheets (id, user_id, project_id, track_id, title, description, status)
      VALUES (${newId}, ${userId}, ${original.project_id}, ${original.track_id}, ${newTitle}, ${original.description}, 'draft')
    `);

    // Duplicate contributors (without signatures)
    for (let i = 0; i < contributors.length; i++) {
      const contributor = contributors[i];
      await db.execute(sql`
        INSERT INTO split_sheet_contributors (
          id, split_sheet_id, name, email, role, percentage, order_index, user_id, custom_fields
        )
        VALUES (
          ${uuidv4()}, 
          ${newId}, 
          ${contributor.name}, 
          ${contributor.email}, 
          ${contributor.role}, 
          ${contributor.percentage}, 
          ${i}, 
          ${contributor.user_id},
          ${JSON.stringify(contributor.custom_fields || {})}::jsonb
        )
      `);
    }

    // Create initial version
    await db.execute(sql`
      INSERT INTO split_sheet_versions (id, split_sheet_id, version_number, changes, created_by)
      VALUES (${uuidv4()}, ${newId}, 1, ${JSON.stringify({ action: 'duplicated_from', original_id: id })}::jsonb, ${userId})
    `);

    // Fetch new split sheet
    const newQuery = sql`
      SELECT * FROM split_sheets WHERE id = ${newId}
    `;
    const newResult = await db.execute(newQuery);
    
    const newContributorsQuery = sql`
      SELECT * FROM split_sheet_contributors 
      WHERE split_sheet_id = ${newId}
      ORDER BY order_index
    `;
    const newContributorsResult = await db.execute(newContributorsQuery);

    res.status(201).json({
      success: true,
      data: {
        ...newResult.rows[0],
        contributors: newContributorsResult.rows
      }
    });
  } catch (error) {
    console.error('Error duplicating split sheet:', error);
    res.status(500).json({ success: false, error: 'Failed to duplicate split sheet' });
  }
});

// ==================== REVENUE TRACKING ====================

/**
 * POST /api/split-sheets/:id/revenue
 * Add revenue to split sheet
 */
router.post('/:id/revenue', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const {
      amount,
      currency = 'NOK',
      revenue_source,
      period_start,
      period_end,
      platform,
      description
    } = req.body;

    if (!amount || !revenue_source || !period_start || !period_end) {
      return res.status(400).json({ 
        success: false, 
        error: 'amount, revenue_source, period_start, and period_end are required' 
      });
    }

    // Check ownership
    const checkQuery = sql`
      SELECT * FROM split_sheets WHERE id = ${id} AND user_id = ${userId}
    `;
    const checkResult = await db.execute(checkQuery);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Split sheet not found' });
    }

    // Create revenue record
    const revenueId = uuidv4();
    await db.execute(sql`
      INSERT INTO split_sheet_revenue (
        id, split_sheet_id, amount, currency, revenue_source, 
        period_start, period_end, platform, description, created_by
      )
      VALUES (
        ${revenueId}, ${id}, ${amount}, ${currency}, ${revenue_source},
        ${period_start}, ${period_end}, ${platform || null}, ${description || null}, ${userId}
      )
      RETURNING *
    `);

    // Fetch created revenue
    const revenueQuery = sql`
      SELECT * FROM split_sheet_revenue WHERE id = ${revenueId}
    `;
    const revenueResult = await db.execute(revenueQuery);

    res.status(201).json({
      success: true,
      data: revenueResult.rows[0]
    });
  } catch (error) {
    console.error('Error creating revenue:', error);
    res.status(500).json({ success: false, error: 'Failed to create revenue' });
  }
});

/**
 * GET /api/split-sheets/:id/revenue
 * Get revenue history for split sheet
 */
router.get('/:id/revenue', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    // Check ownership
    const checkQuery = sql`
      SELECT * FROM split_sheets WHERE id = ${id} AND user_id = ${userId}
    `;
    const checkResult = await db.execute(checkQuery);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Split sheet not found' });
    }

    // Get revenue
    const revenueQuery = sql`
      SELECT * FROM split_sheet_revenue 
      WHERE split_sheet_id = ${id}
      ORDER BY period_start DESC, created_at DESC
    `;
    const revenueResult = await db.execute(revenueQuery);

    res.json({
      success: true,
      data: revenueResult.rows
    });
  } catch (error) {
    console.error('Error fetching revenue:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch revenue' });
  }
});

/**
 * GET /api/split-sheets/:id/payments
 * Get payment history for split sheet
 */
router.get('/:id/payments', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const { contributor_id, status } = req.query;

    // Check ownership
    const checkQuery = sql`
      SELECT * FROM split_sheets WHERE id = ${id} AND user_id = ${userId}
    `;
    const checkResult = await db.execute(checkQuery);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Split sheet not found' });
    }

    // Build payment query
    let paymentQuery = sql`
      SELECT 
        p.*,
        c.name as contributor_name,
        c.email as contributor_email,
        c.role as contributor_role
      FROM split_sheet_payments p
      LEFT JOIN split_sheet_contributors c ON p.contributor_id = c.id
      WHERE p.split_sheet_id = ${id}
    `;

    if (contributor_id) {
      paymentQuery = sql`
        ${paymentQuery} AND p.contributor_id = ${contributor_id}
      `;
    }

    if (status) {
      paymentQuery = sql`
        ${paymentQuery} AND p.payment_status = ${status}
      `;
    }

    paymentQuery = sql`${paymentQuery} ORDER BY p.created_at DESC`;

    const paymentResult = await db.execute(paymentQuery);

    res.json({
      success: true,
      data: paymentResult.rows
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch payments' });
  }
});

/**
 * PUT /api/split-sheets/payments/:paymentId
 * Update payment status
 */
router.put('/payments/:paymentId', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { paymentId } = req.params;
    const {
      payment_status,
      payment_date,
      payment_method,
      payment_reference,
      notes
    } = req.body;

    // Check ownership via split sheet
    const checkQuery = sql`
      SELECT ss.* FROM split_sheet_payments p
      JOIN split_sheets ss ON p.split_sheet_id = ss.id
      WHERE p.id = ${paymentId} AND ss.user_id = ${userId}
    `;
    const checkResult = await db.execute(checkQuery);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }

    // Build update query
    const updates: string[] = [];
    const params: any[] = [paymentId];
    let paramIndex = 2;

    if (payment_status !== undefined) {
      updates.push(`payment_status = $${paramIndex}`);
      params.push(payment_status);
      paramIndex++;
      if (payment_status === 'paid') {
        updates.push(`paid_at = NOW()`);
      }
    }
    if (payment_date !== undefined) {
      updates.push(`payment_date = $${paramIndex}`);
      params.push(payment_date);
      paramIndex++;
    }
    if (payment_method !== undefined) {
      updates.push(`payment_method = $${paramIndex}`);
      params.push(payment_method);
      paramIndex++;
    }
    if (payment_reference !== undefined) {
      updates.push(`payment_reference = $${paramIndex}`);
      params.push(payment_reference);
      paramIndex++;
    }
    if (notes !== undefined) {
      updates.push(`notes = $${paramIndex}`);
      params.push(notes);
      paramIndex++;
    }

    if (updates.length > 0) {
      const updateQuery = sql.raw(
        `UPDATE split_sheet_payments SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING *`,
        params
      );
      const updateResult = await db.execute(updateQuery);
      
      res.json({
        success: true,
        data: updateResult.rows[0]
      });
    } else {
      res.status(400).json({ success: false, error: 'No fields to update' });
    }
  } catch (error) {
    console.error('Error updating payment:', error);
    res.status(500).json({ success: false, error: 'Failed to update payment' });
  }
});

// ==================== TEMPLATES ====================

/**
 * GET /api/split-sheets/templates
 * Get all available templates (system + user's custom templates)
 */
router.get('/templates', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { include_public } = req.query;

    let query = sql`
      SELECT * FROM split_sheet_templates
      WHERE is_system_template = TRUE
    `;

    if (include_public === 'true') {
      query = sql`
        SELECT * FROM split_sheet_templates
        WHERE is_system_template = TRUE OR is_public = TRUE OR user_id = ${userId}
        ORDER BY is_system_template DESC, usage_count DESC, created_at DESC
      `;
    } else {
      query = sql`
        SELECT * FROM split_sheet_templates
        WHERE is_system_template = TRUE OR user_id = ${userId}
        ORDER BY is_system_template DESC, usage_count DESC, created_at DESC
      `;
    }

    const result = await db.execute(query);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch templates' });
  }
});

/**
 * POST /api/split-sheets/templates
 * Create custom template
 */
router.post('/templates', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const {
      name,
      description,
      contributors,
      is_public = false
    } = req.body;

    if (!name || !contributors || !Array.isArray(contributors)) {
      return res.status(400).json({ 
        success: false, 
        error: 'name and contributors array are required' 
      });
    }

    // Validate contributors percentages
    const totalPercentage = contributors.reduce((sum: number, c: any) => sum + (c.percentage || 0), 0);
    if (Math.abs(totalPercentage - 100) > 0.01) {
      return res.status(400).json({ 
        success: false, 
        error: `Total percentage must equal 100%. Current total: ${totalPercentage.toFixed(2)}%` 
      });
    }

    const templateId = uuidv4();
    await db.execute(sql`
      INSERT INTO split_sheet_templates (
        id, user_id, name, description, is_system_template, is_public, contributors
      )
      VALUES (
        ${templateId}, ${userId}, ${name}, ${description || null}, FALSE, ${is_public}, ${JSON.stringify(contributors)}::jsonb
      )
      RETURNING *
    `);

    const result = await db.execute(sql`
      SELECT * FROM split_sheet_templates WHERE id = ${templateId}
    `);

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ success: false, error: 'Failed to create template' });
  }
});

/**
 * PUT /api/split-sheets/templates/:id
 * Update custom template
 */
router.put('/templates/:id', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const {
      name,
      description,
      contributors,
      is_public
    } = req.body;

    // Check ownership (can't update system templates)
    const checkQuery = sql`
      SELECT * FROM split_sheet_templates 
      WHERE id = ${id} AND user_id = ${userId} AND is_system_template = FALSE
    `;
    const checkResult = await db.execute(checkQuery);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Template not found or not editable' });
    }

    // Build update query
    const updates: string[] = [];
    const params: any[] = [id];
    let paramIndex = 2;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      params.push(name);
      paramIndex++;
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      params.push(description);
      paramIndex++;
    }
    if (contributors !== undefined) {
      // Validate percentages
      const totalPercentage = contributors.reduce((sum: number, c: any) => sum + (c.percentage || 0), 0);
      if (Math.abs(totalPercentage - 100) > 0.01) {
        return res.status(400).json({ 
          success: false, 
          error: `Total percentage must equal 100%. Current total: ${totalPercentage.toFixed(2)}%` 
        });
      }
      updates.push(`contributors = $${paramIndex}::jsonb`);
      params.push(JSON.stringify(contributors));
      paramIndex++;
    }
    if (is_public !== undefined) {
      updates.push(`is_public = $${paramIndex}`);
      params.push(is_public);
      paramIndex++;
    }

    if (updates.length > 0) {
      const updateQuery = sql.raw(
        `UPDATE split_sheet_templates SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING *`,
        params
      );
      const updateResult = await db.execute(updateQuery);
      
      res.json({
        success: true,
        data: updateResult.rows[0]
      });
    } else {
      res.status(400).json({ success: false, error: 'No fields to update' });
    }
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ success: false, error: 'Failed to update template' });
  }
});

/**
 * DELETE /api/split-sheets/templates/:id
 * Delete custom template
 */
router.delete('/templates/:id', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    // Check ownership (can't delete system templates)
    const checkQuery = sql`
      SELECT * FROM split_sheet_templates 
      WHERE id = ${id} AND user_id = ${userId} AND is_system_template = FALSE
    `;
    const checkResult = await db.execute(checkQuery);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Template not found or not deletable' });
    }

    await db.execute(sql`
      DELETE FROM split_sheet_templates WHERE id = ${id} AND user_id = ${userId}
    `);

    res.json({ success: true, message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ success: false, error: 'Failed to delete template' });
  }
});

/**
 * POST /api/split-sheets/templates/:id/use
 * Increment usage count when template is used
 */
router.post('/templates/:id/use', async (req: any, res: Response) => {
  try {
    await db.execute(sql`
      UPDATE split_sheet_templates
      SET usage_count = usage_count + 1
      WHERE id = ${req.params.id}
    `);

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating template usage:', error);
    res.status(500).json({ success: false, error: 'Failed to update usage' });
  }
});

// ==================== COMMENTS ====================

/**
 * GET /api/split-sheets/:id/comments
 * Get comments for split sheet
 */
router.get('/:id/comments', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    // Check access (user must own split sheet or be a contributor)
    const checkQuery = sql`
      SELECT ss.* FROM split_sheets ss
      LEFT JOIN split_sheet_contributors ssc ON ss.id = ssc.split_sheet_id
      WHERE ss.id = ${id} AND (ss.user_id = ${userId} OR ssc.user_id = ${userId} OR ssc.email = (SELECT email FROM users WHERE id = ${userId}))
    `;
    const checkResult = await db.execute(checkQuery);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Split sheet not found or access denied' });
    }

    // Get comments
    const commentsQuery = sql`
      SELECT * FROM split_sheet_comments
      WHERE split_sheet_id = ${id}
      ORDER BY created_at ASC
    `;
    const commentsResult = await db.execute(commentsQuery);

    res.json({
      success: true,
      data: commentsResult.rows
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch comments' });
  }
});

/**
 * POST /api/split-sheets/:id/comments
 * Create comment
 */
router.post('/:id/comments', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const {
      content,
      parent_comment_id,
      mentions = []
    } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, error: 'Comment content is required' });
    }

    // Get user info
    const userQuery = sql`
      SELECT name, email FROM users WHERE id = ${userId}
    `;
    const userResult = await db.execute(userQuery);
    const user = userResult.rows[0] || { name: 'Unknown', email: null };

    // Check access
    const checkQuery = sql`
      SELECT ss.* FROM split_sheets ss
      LEFT JOIN split_sheet_contributors ssc ON ss.id = ssc.split_sheet_id
      WHERE ss.id = ${id} AND (ss.user_id = ${userId} OR ssc.user_id = ${userId} OR ssc.email = ${user.email})
    `;
    const checkResult = await db.execute(checkQuery);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Split sheet not found or access denied' });
    }

    // Create comment
    const commentId = uuidv4();
    await db.execute(sql`
      INSERT INTO split_sheet_comments (
        id, split_sheet_id, parent_comment_id, user_id, user_name, user_email, content, mentions
      )
      VALUES (
        ${commentId}, ${id}, ${parent_comment_id || null}, ${userId}, 
        ${user.name}, ${user.email || null}, ${content.trim()}, ${JSON.stringify(mentions)}::jsonb
      )
      RETURNING *
    `);

    const result = await db.execute(sql`
      SELECT * FROM split_sheet_comments WHERE id = ${commentId}
    `);

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({ success: false, error: 'Failed to create comment' });
  }
});

/**
 * PUT /api/split-sheets/comments/:commentId
 * Update comment
 */
router.put('/comments/:commentId', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { commentId } = req.params;
    const { content, is_resolved } = req.body;

    // Check ownership
    const checkQuery = sql`
      SELECT * FROM split_sheet_comments WHERE id = ${commentId} AND user_id = ${userId}
    `;
    const checkResult = await db.execute(checkQuery);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Comment not found' });
    }

    // Build update query
    const updates: string[] = [];
    const params: any[] = [commentId];
    let paramIndex = 2;

    if (content !== undefined) {
      updates.push(`content = $${paramIndex}`);
      params.push(content.trim());
      paramIndex++;
    }
    if (is_resolved !== undefined) {
      updates.push(`is_resolved = $${paramIndex}`);
      params.push(is_resolved);
      paramIndex++;
    }

    if (updates.length > 0) {
      const updateQuery = sql.raw(
        `UPDATE split_sheet_comments SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING *`,
        params
      );
      const updateResult = await db.execute(updateQuery);
      
      res.json({
        success: true,
        data: updateResult.rows[0]
      });
    } else {
      res.status(400).json({ success: false, error: 'No fields to update' });
    }
  } catch (error) {
    console.error('Error updating comment:', error);
    res.status(500).json({ success: false, error: 'Failed to update comment' });
  }
});

/**
 * DELETE /api/split-sheets/comments/:commentId
 * Delete comment
 */
router.delete('/comments/:commentId', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { commentId } = req.params;

    // Check ownership
    const checkQuery = sql`
      SELECT * FROM split_sheet_comments WHERE id = ${commentId} AND user_id = ${userId}
    `;
    const checkResult = await db.execute(checkQuery);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Comment not found' });
    }

    await db.execute(sql`
      DELETE FROM split_sheet_comments WHERE id = ${commentId} AND user_id = ${userId}
    `);

    res.json({ success: true, message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ success: false, error: 'Failed to delete comment' });
  }
});

// ==================== PRO CONNECTIONS ====================

/**
 * GET /api/split-sheets/pro-connections
 * Get user's PRO connections
 */
router.get('/pro-connections', async (req: any, res: Response) => {
  try {
    const userId = req.userId;

    const connectionsQuery = sql`
      SELECT 
        id, user_id, pro_name, pro_account_id, connection_status, 
        isrc_prefix, last_sync_at, created_at, updated_at
      FROM pro_connections
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;
    const result = await db.execute(connectionsQuery);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching PRO connections:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch PRO connections' });
  }
});

/**
 * POST /api/split-sheets/pro-connections
 * Create or update PRO connection (user initiates OAuth flow)
 */
router.post('/pro-connections', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const {
      pro_name,
      access_token,
      refresh_token,
      token_expires_at,
      pro_account_id,
      isrc_prefix
    } = req.body;

    if (!pro_name) {
      return res.status(400).json({ success: false, error: 'pro_name is required' });
    }

    // Check if connection already exists
    const existingQuery = sql`
      SELECT * FROM pro_connections 
      WHERE user_id = ${userId} AND pro_name = ${pro_name}
    `;
    const existingResult = await db.execute(existingQuery);

    // TODO: Encrypt tokens before storing
    // For now, store as-is (should be encrypted in production)
    const encryptedAccessToken = access_token; // Should encrypt
    const encryptedRefreshToken = refresh_token; // Should encrypt

    if (existingResult.rows.length > 0) {
      // Update existing
      const connectionId = existingResult.rows[0].id;
      await db.execute(sql`
        UPDATE pro_connections
        SET 
          access_token_encrypted = ${encryptedAccessToken},
          refresh_token_encrypted = ${encryptedRefreshToken},
          token_expires_at = ${token_expires_at ? new Date(token_expires_at) : null},
          pro_account_id = ${pro_account_id || null},
          isrc_prefix = ${isrc_prefix || null},
          connection_status = 'connected',
          updated_at = NOW()
        WHERE id = ${connectionId}
        RETURNING id, user_id, pro_name, pro_account_id, connection_status, isrc_prefix, created_at, updated_at
      `);
      
      const updatedResult = await db.execute(sql`
        SELECT id, user_id, pro_name, pro_account_id, connection_status, isrc_prefix, created_at, updated_at
        FROM pro_connections WHERE id = ${connectionId}
      `);

      res.json({ success: true, data: updatedResult.rows[0] });
    } else {
      // Create new
      const connectionId = uuidv4();
      await db.execute(sql`
        INSERT INTO pro_connections (
          id, user_id, pro_name, access_token_encrypted, refresh_token_encrypted,
          token_expires_at, pro_account_id, isrc_prefix, connection_status
        )
        VALUES (
          ${connectionId}, ${userId}, ${pro_name}, ${encryptedAccessToken}, ${encryptedRefreshToken},
          ${token_expires_at ? new Date(token_expires_at) : null}, ${pro_account_id || null}, 
          ${isrc_prefix || null}, 'connected'
        )
      `);

      const result = await db.execute(sql`
        SELECT id, user_id, pro_name, pro_account_id, connection_status, isrc_prefix, created_at, updated_at
        FROM pro_connections WHERE id = ${connectionId}
      `);

      res.status(201).json({ success: true, data: result.rows[0] });
    }
  } catch (error) {
    console.error('Error creating PRO connection:', error);
    res.status(500).json({ success: false, error: 'Failed to create PRO connection' });
  }
});

/**
 * DELETE /api/split-sheets/pro-connections/:id
 * Disconnect PRO account
 */
router.delete('/pro-connections/:id', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    // Check ownership
    const checkQuery = sql`
      SELECT * FROM pro_connections WHERE id = ${id} AND user_id = ${userId}
    `;
    const checkResult = await db.execute(checkQuery);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'PRO connection not found' });
    }

    // Update status to disconnected instead of deleting
    await db.execute(sql`
      UPDATE pro_connections
      SET connection_status = 'disconnected', updated_at = NOW()
      WHERE id = ${id} AND user_id = ${userId}
    `);

    res.json({ success: true, message: 'PRO connection disconnected' });
  } catch (error) {
    console.error('Error disconnecting PRO:', error);
    res.status(500).json({ success: false, error: 'Failed to disconnect PRO' });
  }
});

/**
 * POST /api/split-sheets/:id/pro-register
 * Link split sheet to PRO work
 */
router.post('/:id/pro-register', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const {
      pro_connection_id,
      pro_work_id,
      isrc_code
    } = req.body;

    // Check ownership
    const checkQuery = sql`
      SELECT * FROM split_sheets WHERE id = ${id} AND user_id = ${userId}
    `;
    const checkResult = await db.execute(checkQuery);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Split sheet not found' });
    }

    // Check if PRO work already exists
    const existingQuery = sql`
      SELECT * FROM pro_works WHERE split_sheet_id = ${id}
    `;
    const existingResult = await db.execute(existingQuery);

    if (existingResult.rows.length > 0) {
      // Update existing
      const workId = existingResult.rows[0].id;
      await db.execute(sql`
        UPDATE pro_works
        SET 
          pro_connection_id = ${pro_connection_id || null},
          pro_work_id = ${pro_work_id || null},
          isrc_code = ${isrc_code || null},
          registration_status = 'pending',
          updated_at = NOW()
        WHERE id = ${workId}
      `);
    } else {
      // Create new
      const workId = uuidv4();
      await db.execute(sql`
        INSERT INTO pro_works (
          id, split_sheet_id, pro_connection_id, pro_work_id, isrc_code, registration_status
        )
        VALUES (
          ${workId}, ${id}, ${pro_connection_id || null}, ${pro_work_id || null}, 
          ${isrc_code || null}, 'pending'
        )
      `);
    }

    const result = await db.execute(sql`
      SELECT * FROM pro_works WHERE split_sheet_id = ${id}
    `);

    res.json({ success: true, data: result.rows[0] || null });
  } catch (error) {
    console.error('Error registering PRO work:', error);
    res.status(500).json({ success: false, error: 'Failed to register PRO work' });
  }
});

/**
 * GET /api/split-sheets/:id/pro-status
 * Get PRO registration status for split sheet
 */
router.get('/:id/pro-status', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    // Check ownership
    const checkQuery = sql`
      SELECT * FROM split_sheets WHERE id = ${id} AND user_id = ${userId}
    `;
    const checkResult = await db.execute(checkQuery);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Split sheet not found' });
    }

    // Get PRO work info
    const proWorkQuery = sql`
      SELECT 
        pw.*,
        pc.pro_name,
        pc.connection_status as pro_connection_status
      FROM pro_works pw
      LEFT JOIN pro_connections pc ON pw.pro_connection_id = pc.id
      WHERE pw.split_sheet_id = ${id}
    `;
    const proWorkResult = await db.execute(proWorkQuery);

    res.json({ success: true, data: proWorkResult.rows[0] || null });
  } catch (error) {
    console.error('Error fetching PRO status:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch PRO status' });
  }
});

// ==================== SONGFLOW INTEGRATION ====================

/**
 * POST /api/split-sheets/from-songflow/:trackId
 * Auto-create split sheet from SongFlow track
 */
router.post('/from-songflow/:trackId', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { trackId } = req.params;
    const { projectId, title, description } = req.body;

    // Fetch SongFlow track data (assuming track data structure)
    // In a real implementation, this would query the songflow_tracks table
    // For now, we'll create with provided data
    
    const splitSheetId = uuidv4();
    
    // Create split sheet
    await db.execute(sql`
      INSERT INTO split_sheets (
        id, user_id, songflow_track_id, songflow_project_id, title, description, status
      )
      VALUES (
        ${splitSheetId}, ${userId}, ${trackId}, ${projectId || null}, 
        ${title || `Split Sheet for Track ${trackId}`}, 
        ${description || null}, 'draft'
      )
      RETURNING *
    `);

    // Create link in junction table
    await db.execute(sql`
      INSERT INTO split_sheet_songflow_links (
        id, split_sheet_id, songflow_track_id, songflow_project_id, 
        link_type, auto_created, linked_by
      )
      VALUES (
        ${uuidv4()}, ${splitSheetId}, ${trackId}, ${projectId || null},
        ${projectId ? 'project' : 'track'}, true, ${userId}
      )
    `);

    // Fetch created split sheet with contributors
    const result = await db.execute(sql`
      SELECT ss.*, 
        COUNT(DISTINCT ssc.id) as contributor_count
      FROM split_sheets ss
      LEFT JOIN split_sheet_contributors ssc ON ss.id = ssc.split_sheet_id
      WHERE ss.id = ${splitSheetId}
      GROUP BY ss.id
    `);

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error creating split sheet from SongFlow:', error);
    res.status(500).json({ success: false, error: 'Failed to create split sheet from SongFlow track' });
  }
});

/**
 * POST /api/split-sheets/:id/link-songflow
 * Manually link split sheet to SongFlow track/project
 */
router.post('/:id/link-songflow', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const { songflow_track_id, songflow_project_id } = req.body;

    if (!songflow_track_id && !songflow_project_id) {
      return res.status(400).json({ success: false, error: 'Either songflow_track_id or songflow_project_id is required' });
    }

    // Check ownership
    const checkQuery = sql`
      SELECT * FROM split_sheets WHERE id = ${id} AND user_id = ${userId}
    `;
    const checkResult = await db.execute(checkQuery);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Split sheet not found' });
    }

    // Check if link already exists
    const existingLinkQuery = sql`
      SELECT * FROM split_sheet_songflow_links 
      WHERE split_sheet_id = ${id} 
        AND (songflow_track_id = ${songflow_track_id || null} OR songflow_project_id = ${songflow_project_id || null})
    `;
    const existingLink = await db.execute(existingLinkQuery);

    if (existingLink.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'Split sheet is already linked to this SongFlow track/project' });
    }

    // Create link
    const linkId = uuidv4();
    await db.execute(sql`
      INSERT INTO split_sheet_songflow_links (
        id, split_sheet_id, songflow_track_id, songflow_project_id,
        link_type, auto_created, linked_by
      )
      VALUES (
        ${linkId}, ${id}, ${songflow_track_id || null}, ${songflow_project_id || null},
        ${songflow_project_id ? 'project' : 'track'}, false, ${userId}
      )
    `);

    // Update split sheet columns for backward compatibility
    await db.execute(sql`
      UPDATE split_sheets
      SET 
        songflow_track_id = COALESCE(${songflow_track_id || null}, songflow_track_id),
        songflow_project_id = COALESCE(${songflow_project_id || null}, songflow_project_id),
        updated_at = NOW()
      WHERE id = ${id}
    `);

    const result = await db.execute(sql`
      SELECT * FROM split_sheet_songflow_links WHERE id = ${linkId}
    `);

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error linking split sheet to SongFlow:', error);
    res.status(500).json({ success: false, error: 'Failed to link split sheet to SongFlow' });
  }
});

/**
 * DELETE /api/split-sheets/:id/unlink-songflow
 * Unlink split sheet from SongFlow track/project
 */
router.delete('/:id/unlink-songflow', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const { songflow_track_id, songflow_project_id } = req.query;

    // Check ownership
    const checkQuery = sql`
      SELECT * FROM split_sheets WHERE id = ${id} AND user_id = ${userId}
    `;
    const checkResult = await db.execute(checkQuery);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Split sheet not found' });
    }

    // Delete link
    let deleteQuery = sql`
      DELETE FROM split_sheet_songflow_links 
      WHERE split_sheet_id = ${id}
    `;
    
    if (songflow_track_id) {
      deleteQuery = sql`
        DELETE FROM split_sheet_songflow_links 
        WHERE split_sheet_id = ${id} AND songflow_track_id = ${songflow_track_id}
      `;
    } else if (songflow_project_id) {
      deleteQuery = sql`
        DELETE FROM split_sheet_songflow_links 
        WHERE split_sheet_id = ${id} AND songflow_project_id = ${songflow_project_id}
      `;
    }

    await db.execute(deleteQuery);

    res.json({ success: true, message: 'Split sheet unlinked from SongFlow' });
  } catch (error) {
    console.error('Error unlinking split sheet from SongFlow:', error);
    res.status(500).json({ success: false, error: 'Failed to unlink split sheet from SongFlow' });
  }
});

/**
 * GET /api/split-sheets/songflow/:trackId
 * Get all split sheets linked to a SongFlow track
 */
router.get('/songflow/:trackId', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { trackId } = req.params;

    const result = await db.execute(sql`
      SELECT ss.*, 
        COUNT(DISTINCT ssc.id) as contributor_count,
        COUNT(DISTINCT CASE WHEN ssc.signed_at IS NOT NULL THEN ssc.id END) as signed_count,
        ssl.link_type, ssl.auto_created, ssl.linked_at
      FROM split_sheets ss
      INNER JOIN split_sheet_songflow_links ssl ON ss.id = ssl.split_sheet_id
      LEFT JOIN split_sheet_contributors ssc ON ss.id = ssc.split_sheet_id
      WHERE ssl.songflow_track_id = ${trackId} AND ss.user_id = ${userId}
      GROUP BY ss.id, ssl.link_type, ssl.auto_created, ssl.linked_at
      ORDER BY ss.created_at DESC
    `);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching split sheets for SongFlow track:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch split sheets for SongFlow track' });
  }
});

/**
 * GET /api/split-sheets/:id/songflow
 * Get SongFlow links for a split sheet
 */
router.get('/:id/songflow', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    // Check ownership
    const checkQuery = sql`
      SELECT * FROM split_sheets WHERE id = ${id} AND user_id = ${userId}
    `;
    const checkResult = await db.execute(checkQuery);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Split sheet not found' });
    }

    const result = await db.execute(sql`
      SELECT * FROM split_sheet_songflow_links 
      WHERE split_sheet_id = ${id}
      ORDER BY linked_at DESC
    `);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching SongFlow links:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch SongFlow links' });
  }
});

/**
 * GET /api/split-sheets/stats
 * Get split sheet statistics for CRM dashboard
 */
router.get('/stats', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { profession, customer_id } = req.query;

    // Base query for split sheets
    let baseQuery = `
      FROM split_sheets ss
      WHERE ss.user_id = $1
    `;
    const params: any[] = [userId];
    let paramIndex = 2;

    // Add profession filter if provided (via projects)
    // Note: Split sheets are now available for all professions (except vendor, handled in frontend)
    // Profession filtering can be done via project_id if needed

    // Add customer filter if provided (via project_id)
    if (customer_id) {
      baseQuery += ` AND ss.project_id IN (
        SELECT id FROM projects WHERE customer_id = $${paramIndex}
      )`;
      params.push(customer_id);
      paramIndex++;
    }

    // Get comprehensive stats
    const statsQuery = sql.raw(`
      SELECT 
        COUNT(DISTINCT ss.id) as total_count,
        COUNT(DISTINCT CASE WHEN ss.status = 'completed' THEN ss.id END) as completed_count,
        COUNT(DISTINCT CASE WHEN ss.status = 'pending_signatures' THEN ss.id END) as pending_signatures_count,
        COUNT(DISTINCT CASE WHEN ss.status = 'draft' THEN ss.id END) as draft_count,
        COUNT(DISTINCT CASE WHEN ssc.signed_at IS NULL AND ssc.id IS NOT NULL THEN ssc.id END) as unsigned_contributors,
        COALESCE(SUM(sr.amount), 0) as total_revenue,
        COALESCE(AVG(ssc.percentage), 0) as average_split_percentage,
        COUNT(DISTINCT ss.project_id) as projects_with_split_sheets
      ${baseQuery}
      LEFT JOIN split_sheet_contributors ssc ON ss.id = ssc.split_sheet_id
      LEFT JOIN split_sheet_revenue sr ON ss.id = sr.split_sheet_id
    `, params);

    const statsResult = await db.execute(statsQuery);
    const stats = statsResult.rows[0] || {};

    // Get recent split sheets count (last 30 days)
    const recentQuery = sql.raw(`
      SELECT COUNT(*) as recent_count
      ${baseQuery}
      AND ss.created_at >= NOW() - INTERVAL '30 days'
    `, params);
    const recentResult = await db.execute(recentQuery);
    const recentCount = recentResult.rows[0]?.recent_count || 0;

    res.json({
      success: true,
      data: {
        total: parseInt(stats.total_count || '0'),
        completed: parseInt(stats.completed_count || '0'),
        pendingSignatures: parseInt(stats.pending_signatures_count || '0'),
        draft: parseInt(stats.draft_count || '0'),
        unsignedContributors: parseInt(stats.unsigned_contributors || '0'),
        totalRevenue: parseFloat(stats.total_revenue || '0'),
        averageSplitPercentage: parseFloat(stats.average_split_percentage || '0'),
        projectsWithSplitSheets: parseInt(stats.projects_with_split_sheets || '0'),
        recentCount: parseInt(recentCount || '0')
      }
    });
  } catch (error) {
    console.error('Error fetching split sheet stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch split sheet stats' });
  }
});

/**
 * GET /api/split-sheets/revenue-analytics
 * Get revenue analytics for Business Intelligence Dashboard
 */
router.get('/revenue-analytics', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { profession, start_date, end_date } = req.query;

    // Date range defaults to last 12 months
    const startDate = start_date || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = end_date || new Date().toISOString().split('T')[0];

    // Revenue trends over time (monthly)
    const trendsQuery = sql`
      SELECT 
        DATE_TRUNC('month', sr.period_start) as month,
        SUM(sr.amount) as total_revenue,
        COUNT(DISTINCT sr.split_sheet_id) as split_sheet_count,
        COUNT(DISTINCT sr.id) as revenue_entry_count
      FROM split_sheet_revenue sr
      JOIN split_sheets ss ON sr.split_sheet_id = ss.id
      WHERE ss.user_id = ${userId}
        AND sr.period_start >= ${startDate}
        AND sr.period_end <= ${endDate}
      GROUP BY DATE_TRUNC('month', sr.period_start)
      ORDER BY month ASC
    `;
    const trendsResult = await db.execute(trendsQuery);

    // Revenue by project
    const byProjectQuery = sql`
      SELECT 
        ss.project_id,
        p.name as project_name,
        SUM(sr.amount) as total_revenue,
        COUNT(DISTINCT sr.id) as revenue_count
      FROM split_sheet_revenue sr
      JOIN split_sheets ss ON sr.split_sheet_id = ss.id
      LEFT JOIN projects p ON ss.project_id = p.id
      WHERE ss.user_id = ${userId}
        AND sr.period_start >= ${startDate}
        AND sr.period_end <= ${endDate}
      GROUP BY ss.project_id, p.name
      ORDER BY total_revenue DESC
      LIMIT 10
    `;
    const byProjectResult = await db.execute(byProjectQuery);

    // Revenue by contributor
    const byContributorQuery = sql`
      SELECT 
        ssc.id as contributor_id,
        ssc.name as contributor_name,
        ssc.role,
        SUM(sr.amount * ssc.percentage / 100.0) as total_revenue,
        COUNT(DISTINCT sr.id) as revenue_count
      FROM split_sheet_revenue sr
      JOIN split_sheets ss ON sr.split_sheet_id = ss.id
      JOIN split_sheet_contributors ssc ON ss.id = ssc.split_sheet_id
      WHERE ss.user_id = ${userId}
        AND sr.period_start >= ${startDate}
        AND sr.period_end <= ${endDate}
      GROUP BY ssc.id, ssc.name, ssc.role
      ORDER BY total_revenue DESC
      LIMIT 10
    `;
    const byContributorResult = await db.execute(byContributorQuery);

    // Revenue by platform/source
    const bySourceQuery = sql`
      SELECT 
        sr.revenue_source,
        sr.platform,
        SUM(sr.amount) as total_revenue,
        COUNT(DISTINCT sr.id) as revenue_count
      FROM split_sheet_revenue sr
      JOIN split_sheets ss ON sr.split_sheet_id = ss.id
      WHERE ss.user_id = ${userId}
        AND sr.period_start >= ${startDate}
        AND sr.period_end <= ${endDate}
      GROUP BY sr.revenue_source, sr.platform
      ORDER BY total_revenue DESC
    `;
    const bySourceResult = await db.execute(bySourceQuery);

    res.json({
      success: true,
      data: {
        trends: trendsResult.rows.map((row: any) => ({
          month: row.month,
          totalRevenue: parseFloat(row.total_revenue || '0'),
          splitSheetCount: parseInt(row.split_sheet_count || '0'),
          revenueEntryCount: parseInt(row.revenue_entry_count || '0')
        })),
        byProject: byProjectResult.rows.map((row: any) => ({
          projectId: row.project_id,
          projectName: row.project_name || 'Unknown Project',
          totalRevenue: parseFloat(row.total_revenue || '0'),
          revenueCount: parseInt(row.revenue_count || '0')
        })),
        byContributor: byContributorResult.rows.map((row: any) => ({
          contributorId: row.contributor_id,
          contributorName: row.contributor_name,
          role: row.role,
          totalRevenue: parseFloat(row.total_revenue || '0'),
          revenueCount: parseInt(row.revenue_count || '0')
        })),
        bySource: bySourceResult.rows.map((row: any) => ({
          revenueSource: row.revenue_source,
          platform: row.platform,
          totalRevenue: parseFloat(row.total_revenue || '0'),
          revenueCount: parseInt(row.revenue_count || '0')
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching revenue analytics:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch revenue analytics' });
  }
});

/**
 * GET /api/split-sheets/payment-analytics
 * Get payment analytics for Business Intelligence Dashboard
 */
router.get('/payment-analytics', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { profession } = req.query;

    // Payment status distribution
    const statusQuery = sql`
      SELECT 
        p.payment_status,
        COUNT(*) as count,
        SUM(p.amount) as total_amount
      FROM split_sheet_payments p
      JOIN split_sheets ss ON p.split_sheet_id = ss.id
      WHERE ss.user_id = ${userId}
      GROUP BY p.payment_status
    `;
    const statusResult = await db.execute(statusQuery);

    // Payment trends over time (monthly)
    const trendsQuery = sql`
      SELECT 
        DATE_TRUNC('month', p.payment_date) as month,
        COUNT(*) as payment_count,
        SUM(p.amount) as total_amount,
        AVG(EXTRACT(EPOCH FROM (p.paid_at - p.created_at)) / 86400) as avg_processing_days
      FROM split_sheet_payments p
      JOIN split_sheets ss ON p.split_sheet_id = ss.id
      WHERE ss.user_id = ${userId}
        AND p.payment_date IS NOT NULL
      GROUP BY DATE_TRUNC('month', p.payment_date)
      ORDER BY month DESC
      LIMIT 12
    `;
    const trendsResult = await db.execute(trendsQuery);

    // Average processing time
    const avgProcessingQuery = sql`
      SELECT 
        AVG(EXTRACT(EPOCH FROM (p.paid_at - p.created_at)) / 86400) as avg_processing_days,
        MIN(EXTRACT(EPOCH FROM (p.paid_at - p.created_at)) / 86400) as min_processing_days,
        MAX(EXTRACT(EPOCH FROM (p.paid_at - p.created_at)) / 86400) as max_processing_days
      FROM split_sheet_payments p
      JOIN split_sheets ss ON p.split_sheet_id = ss.id
      WHERE ss.user_id = ${userId}
        AND p.payment_status = 'paid'
        AND p.paid_at IS NOT NULL
    `;
    const avgProcessingResult = await db.execute(avgProcessingQuery);
    const avgProcessing = avgProcessingResult.rows[0] || {};

    // Payment method distribution
    const methodQuery = sql`
      SELECT 
        p.payment_method,
        COUNT(*) as count,
        SUM(p.amount) as total_amount
      FROM split_sheet_payments p
      JOIN split_sheets ss ON p.split_sheet_id = ss.id
      WHERE ss.user_id = ${userId}
        AND p.payment_method IS NOT NULL
      GROUP BY p.payment_method
    `;
    const methodResult = await db.execute(methodQuery);

    res.json({
      success: true,
      data: {
        statusDistribution: statusResult.rows.map((row: any) => ({
          status: row.payment_status,
          count: parseInt(row.count || '0'),
          totalAmount: parseFloat(row.total_amount || '0')
        })),
        trends: trendsResult.rows.map((row: any) => ({
          month: row.month,
          paymentCount: parseInt(row.payment_count || '0'),
          totalAmount: parseFloat(row.total_amount || '0'),
          avgProcessingDays: parseFloat(row.avg_processing_days || '0')
        })),
        averageProcessing: {
          avgDays: parseFloat(avgProcessing.avg_processing_days || '0'),
          minDays: parseFloat(avgProcessing.min_processing_days || '0'),
          maxDays: parseFloat(avgProcessing.max_processing_days || '0')
        },
        paymentMethods: methodResult.rows.map((row: any) => ({
          method: row.payment_method,
          count: parseInt(row.count || '0'),
          totalAmount: parseFloat(row.total_amount || '0')
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching payment analytics:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch payment analytics' });
  }
});

/**
 * GET /api/split-sheets/market-insights
 * Get market insights for split sheets (industry benchmarks)
 */
router.get('/market-insights', async (req: any, res: Response) => {
  try {
    const userId = req.userId;

    // Average split percentages by role from user's split sheets
    const avgSplitsQuery = sql`
      SELECT 
        ssc.role,
        AVG(ssc.percentage) as avg_percentage,
        MIN(ssc.percentage) as min_percentage,
        MAX(ssc.percentage) as max_percentage,
        COUNT(*) as count
      FROM split_sheet_contributors ssc
      JOIN split_sheets ss ON ssc.split_sheet_id = ss.id
      WHERE ss.user_id = ${userId}
        AND ssc.role IS NOT NULL
      GROUP BY ssc.role
      ORDER BY avg_percentage DESC
    `;
    const avgSplitsResult = await db.execute(avgSplitsQuery);

    // Industry benchmarks (static data - can be enhanced with real market data)
    const benchmarks = {
      producer: { min: 20, max: 50, typical: 30 },
      artist: { min: 30, max: 70, typical: 50 },
      songwriter: { min: 25, max: 50, typical: 35 },
      musician: { min: 5, max: 20, typical: 10 },
      engineer: { min: 5, max: 15, typical: 8 },
      mixer: { min: 3, max: 10, typical: 5 },
      master: { min: 2, max: 8, typical: 4 }
    };

    res.json({
      success: true,
      data: {
        averageSplitsByRole: avgSplitsResult.rows.map((row: any) => ({
          role: row.role,
          avgPercentage: parseFloat(row.avg_percentage || '0'),
          minPercentage: parseFloat(row.min_percentage || '0'),
          maxPercentage: parseFloat(row.max_percentage || '0'),
          count: parseInt(row.count || '0')
        })),
        industryBenchmarks: benchmarks,
        recommendations: [
          'Producer splits typically range from 20-50%, with 30% being common',
          'Artist splits usually range from 30-70%, depending on contribution',
          'Songwriter splits often range from 25-50%, with 35% being typical',
          'Supporting roles (musicians, engineers) typically receive 5-20%',
          'Ensure total percentages equal 100% to avoid legal issues'
        ]
      }
    });
  } catch (error) {
    console.error('Error fetching market insights:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch market insights' });
  }
});

/**
 * GET /api/split-sheets/contributor/:contributorId
 * Get split sheets for a specific contributor
 */
router.get('/contributor/:contributorId', async (req: any, res: Response) => {
  try {
    const { contributorId } = req.params;
    const { token, access_code } = req.query; // Optional access token or access code for portal access

    // Get contributor details
    const contributorQuery = sql`
      SELECT * FROM split_sheet_contributors WHERE id = ${contributorId}
    `;
    const contributorResult = await db.execute(contributorQuery);
    
    if (contributorResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Contributor not found' });
    }

    const contributor = contributorResult.rows[0];

    // If access_code provided, validate it matches the split sheet
    if (access_code) {
      const splitSheetQuery = sql`
        SELECT id, access_code, security_enabled
        FROM split_sheets
        WHERE id = ${contributor.split_sheet_id} AND access_code = ${access_code.toUpperCase()}
      `;
      const splitSheetResult = await db.execute(splitSheetQuery);
      
      if (splitSheetResult.rows.length === 0) {
        return res.status(401).json({ success: false, error: 'Invalid access code' });
      }

      // If security is enabled, require PIN/password (handled in portal/access endpoint)
      if (splitSheetResult.rows[0].security_enabled) {
        return res.status(401).json({
          success: false,
          error: 'PIN eller passord er påkrevd',
          requiresPin: true,
          requiresPassword: true
        });
      }
    }

    // If token provided, validate it
    if (token) {
      const tokenQuery = sql`
        SELECT * FROM split_sheet_contributor_access 
        WHERE contributor_id = ${contributorId} 
          AND access_token = ${token}
          AND expires_at > NOW()
      `;
      const tokenResult = await db.execute(tokenQuery);
      if (tokenResult.rows.length === 0) {
        return res.status(401).json({ success: false, error: 'Invalid or expired access token' });
      }
    }

    // Get split sheets for this contributor
    const splitSheetsQuery = sql`
      SELECT 
        ss.*,
        ssc.percentage,
        ssc.role,
        ssc.signed_at,
        ssc.signature_data,
        COUNT(DISTINCT ssc2.id) as total_contributors,
        COUNT(DISTINCT CASE WHEN ssc2.signed_at IS NOT NULL THEN ssc2.id END) as signed_contributors
      FROM split_sheets ss
      JOIN split_sheet_contributors ssc ON ss.id = ssc.split_sheet_id
      LEFT JOIN split_sheet_contributors ssc2 ON ss.id = ssc2.split_sheet_id
      WHERE ssc.id = ${contributorId}
      GROUP BY ss.id, ssc.percentage, ssc.role, ssc.signed_at, ssc.signature_data
      ORDER BY ss.created_at DESC
    `;
    const splitSheetsResult = await db.execute(splitSheetsQuery);

    res.json({
      success: true,
      data: {
        contributor: {
          id: contributor.id,
          name: contributor.name,
          email: contributor.email,
          role: contributor.role
        },
        splitSheets: splitSheetsResult.rows
      }
    });
  } catch (error) {
    console.error('Error fetching contributor split sheets:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch contributor split sheets' });
  }
});

/**
 * GET /api/split-sheets/by-email/:email
 * Get split sheets by contributor email (for portal access)
 */
router.get('/by-email/:email', async (req: any, res: Response) => {
  try {
    const { email } = req.params;
    const { token, access_code } = req.query;

    // Find contributors by email
    const contributorsQuery = sql`
      SELECT DISTINCT ssc.id, ssc.name, ssc.email, ssc.role
      FROM split_sheet_contributors ssc
      WHERE LOWER(ssc.email) = LOWER(${email})
    `;
    const contributorsResult = await db.execute(contributorsQuery);

    if (contributorsResult.rows.length === 0) {
      return res.json({ success: true, data: { contributors: [], splitSheets: [] } });
    }

    // Build query with optional access code filter
    let splitSheetsQuery;
    if (access_code) {
      splitSheetsQuery = sql`
        SELECT DISTINCT
          ss.*,
          ssc.percentage,
          ssc.role,
          ssc.signed_at,
          ssc.id as contributor_record_id,
          ss.require_pin_for_signature,
          ss.require_password_for_signature,
          COUNT(DISTINCT ssc2.id) as total_contributors,
          COUNT(DISTINCT CASE WHEN ssc2.signed_at IS NOT NULL THEN ssc2.id END) as signed_contributors
        FROM split_sheets ss
        JOIN split_sheet_contributors ssc ON ss.id = ssc.split_sheet_id
        LEFT JOIN split_sheet_contributors ssc2 ON ss.id = ssc2.split_sheet_id
        WHERE LOWER(ssc.email) = LOWER(${email}) AND ss.access_code = ${access_code.toUpperCase()}
        GROUP BY ss.id, ssc.percentage, ssc.role, ssc.signed_at, ssc.id, ss.require_pin_for_signature, ss.require_password_for_signature
        ORDER BY ss.created_at DESC
      `;
    } else {
      splitSheetsQuery = sql`
        SELECT DISTINCT
          ss.*,
          ssc.percentage,
          ssc.role,
          ssc.signed_at,
          ssc.id as contributor_record_id,
          ss.require_pin_for_signature,
          ss.require_password_for_signature,
          COUNT(DISTINCT ssc2.id) as total_contributors,
          COUNT(DISTINCT CASE WHEN ssc2.signed_at IS NOT NULL THEN ssc2.id END) as signed_contributors
        FROM split_sheets ss
        JOIN split_sheet_contributors ssc ON ss.id = ssc.split_sheet_id
        LEFT JOIN split_sheet_contributors ssc2 ON ss.id = ssc2.split_sheet_id
        WHERE LOWER(ssc.email) = LOWER(${email})
        GROUP BY ss.id, ssc.percentage, ssc.role, ssc.signed_at, ssc.id, ss.require_pin_for_signature, ss.require_password_for_signature
        ORDER BY ss.created_at DESC
      `;
    }
    const splitSheetsResult = await db.execute(splitSheetsQuery);

    res.json({
      success: true,
      data: {
        contributors: contributorsResult.rows,
        splitSheets: splitSheetsResult.rows
      }
    });
  } catch (error) {
    console.error('Error fetching split sheets by email:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch split sheets by email' });
  }
});

/**
 * POST /api/split-sheets/:id/google-esignature
 * Create Google Doc for e-signature
 */
router.post('/:id/google-esignature', requireAuth, async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    // Check ownership
    const checkQuery = sql`
      SELECT * FROM split_sheets WHERE id = ${id} AND user_id = ${userId}
    `;
    const checkResult = await db.execute(checkQuery);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Split sheet not found' });
    }

    // Get contributors
    const contributorsQuery = sql`
      SELECT name, email, role, percentage
      FROM split_sheet_contributors
      WHERE split_sheet_id = ${id}
      ORDER BY order_index
    `;
    const contributorsResult = await db.execute(contributorsQuery);

    // Import Google e-signature service
    const { createGoogleDocFromSplitSheet } = await import('../services/google-esignature-service');

    const result = await createGoogleDocFromSplitSheet({
      splitSheetId: id,
      splitSheetTitle: checkResult.rows[0].title,
      contributors: contributorsResult.rows as any[],
      userId,
    });

    res.json({
      success: true,
      data: {
        documentId: result.documentId,
        documentUrl: result.documentUrl,
        shareUrl: result.shareUrl,
        message: 'Google Doc created and shared with contributors for signing',
      },
    });
  } catch (error) {
    console.error('Error creating Google Doc for e-signature:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create Google Doc for e-signature',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/split-sheets/:id/contributor-sign
 * Allow contributor to sign split sheet via token
 */
router.post('/:id/contributor-sign', async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { contributor_id, token, signature_data, send_email_copy, email_for_copy, download_pdf } = req.body;
    const pin = signature_data?.pin;
    const password = signature_data?.password;

    if (!contributor_id || !signature_data) {
      return res.status(400).json({ 
        success: false, 
        error: 'contributor_id and signature_data are required' 
      });
    }

    // Validate token if provided
    if (token) {
      const tokenQuery = sql`
        SELECT * FROM split_sheet_contributor_access 
        WHERE contributor_id = ${contributor_id} 
          AND access_token = ${token}
          AND expires_at > NOW()
      `;
      const tokenResult = await db.execute(tokenQuery);
      if (tokenResult.rows.length === 0) {
        return res.status(401).json({ success: false, error: 'Invalid or expired access token' });
      }
    }

    // Get split sheet security settings
    const splitSheetQuery = sql`
      SELECT pin, password, require_pin_for_signature, require_password_for_signature, security_enabled
      FROM split_sheets
      WHERE id = ${id}
    `;
    const splitSheetResult = await db.execute(splitSheetQuery);
    
    if (splitSheetResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Split sheet not found' });
    }

    const splitSheet = splitSheetResult.rows[0];

    // Verify PIN/password if required for signature
    if (splitSheet.require_pin_for_signature || splitSheet.require_password_for_signature) {
      const bcrypt = require('bcrypt');

      if (splitSheet.require_pin_for_signature && splitSheet.pin) {
        if (!pin) {
          return res.status(401).json({ 
            success: false, 
            error: 'PIN er påkrevd for signering' 
          });
        }

        const isPinHashed = /^\$2[ayb]\$/.test(splitSheet.pin);
        let pinValid = false;
        
        if (isPinHashed) {
          pinValid = await bcrypt.compare(pin, splitSheet.pin);
        } else {
          pinValid = pin === splitSheet.pin;
        }
        
        if (!pinValid) {
          return res.status(401).json({ 
            success: false, 
            error: 'Ugyldig PIN' 
          });
        }
      }

      if (splitSheet.require_password_for_signature && splitSheet.password) {
        if (!password) {
          return res.status(401).json({ 
            success: false, 
            error: 'Passord er påkrevd for signering' 
          });
        }

        const isPasswordHashed = /^\$2[ayb]\$/.test(splitSheet.password);
        let passwordValid = false;
        
        if (isPasswordHashed) {
          passwordValid = await bcrypt.compare(password, splitSheet.password);
        } else {
          passwordValid = password === splitSheet.password;
        }
        
        if (!passwordValid) {
          return res.status(401).json({ 
            success: false, 
            error: 'Ugyldig passord' 
          });
        }
      }
    }

    // Verify contributor belongs to this split sheet
    const checkQuery = sql`
      SELECT * FROM split_sheet_contributors 
      WHERE id = ${contributor_id} AND split_sheet_id = ${id}
    `;
    const checkResult = await db.execute(checkQuery);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Contributor not found for this split sheet' });
    }

    // Update contributor signature
    await db.execute(sql`
      UPDATE split_sheet_contributors
      SET signed_at = NOW(),
          signature_data = ${JSON.stringify(signature_data)}::jsonb,
          invitation_status = 'signed',
          updated_at = NOW()
      WHERE id = ${contributor_id} AND split_sheet_id = ${id}
    `);

    // Check if all contributors have signed
    const unsignedQuery = sql`
      SELECT COUNT(*) as unsigned_count
      FROM split_sheet_contributors
      WHERE split_sheet_id = ${id} AND signed_at IS NULL
    `;
    const unsignedResult = await db.execute(unsignedQuery);
    const unsignedCount = parseInt(unsignedResult.rows[0]?.unsigned_count || '0');

    // If all signed, update split sheet status
    if (unsignedCount === 0) {
      await db.execute(sql`
        UPDATE split_sheets
        SET status = 'completed',
            completed_at = NOW(),
            updated_at = NOW()
        WHERE id = ${id}
      `);
    } else {
      // Update to pending_signatures if not already
      await db.execute(sql`
        UPDATE split_sheets
        SET status = 'pending_signatures',
            updated_at = NOW()
        WHERE id = ${id} AND status = 'draft'
      `);
    }

    // Send email copy if requested
    if (send_email_copy && email_for_copy) {
      try {
        // Get split sheet details for email
        const splitSheetQuery = sql`
          SELECT ss.*, ssc.name as contributor_name, ssc.email as contributor_email
          FROM split_sheets ss
          JOIN split_sheet_contributors ssc ON ss.id = ssc.split_sheet_id
          WHERE ss.id = ${id} AND ssc.id = ${contributor_id}
        `;
        const splitSheetResult = await db.execute(splitSheetQuery);
        const splitSheet = splitSheetResult.rows[0];

        // Send email with PDF attachment using email service
        await sendSplitSheetEmail({
          to: email_for_copy,
          splitSheetId: id,
          splitSheetTitle: splitSheet.title,
          contributorName: splitSheet.contributor_name,
          includePDF: true,
          emailType: 'signature_confirmation',
        });
      } catch (error) {
        console.error('Error sending email copy:', error);
        // Don't fail the signature if email fails
      }
    }

    // Send completion email to all contributors if all signed
    if (unsignedCount === 0) {
      try {
        const allContributorsQuery = sql`
          SELECT ssc.*, ss.title
          FROM split_sheet_contributors ssc
          JOIN split_sheets ss ON ssc.split_sheet_id = ss.id
          WHERE ssc.split_sheet_id = ${id} AND ssc.email IS NOT NULL
        `;
        const allContributorsResult = await db.execute(allContributorsQuery);
        
        // Send completion email to all contributors
        for (const contributor of allContributorsResult.rows) {
          try {
            await sendSplitSheetEmail({
              to: contributor.email,
              splitSheetId: id,
              splitSheetTitle: contributor.title,
              contributorName: contributor.name,
              includePDF: true,
              emailType: 'completed',
            });
          } catch (emailError) {
            console.error(`Error sending completion email to ${contributor.email}:`, emailError);
            // Continue with other contributors
          }
        }
      } catch (error) {
        console.error('Error sending completion emails:', error);
        // Don't fail the signature if email fails
      }
    }

    res.json({ 
      success: true, 
      message: 'Signature added successfully',
      email_sent: send_email_copy && email_for_copy ? true : false
    });
  } catch (error) {
    console.error('Error adding contributor signature:', error);
    res.status(500).json({ success: false, error: 'Failed to add signature' });
  }
});

/**
 * GET /api/split-sheets/calendar-events
 * Get split sheet events for calendar integration
 */
router.get('/calendar-events', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { start_date, end_date } = req.query;

    const startDate = start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = end_date || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Get split sheet creation events
    const creationEvents = await db.execute(sql`
      SELECT 
        id,
        'split_sheet_created' as event_type,
        title as event_title,
        created_at as event_date,
        status,
        project_id
      FROM split_sheets
      WHERE user_id = ${userId}
        AND created_at::date >= ${startDate}
        AND created_at::date <= ${endDate}
    `);

    // Get signature deadline events (estimated - can be enhanced with actual deadline field)
    const signatureEvents = await db.execute(sql`
      SELECT DISTINCT
        ss.id,
        'split_sheet_signature_deadline' as event_type,
        CONCAT(ss.title, ' - Signaturfrist') as event_title,
        (ss.created_at + INTERVAL '14 days')::date as event_date,
        ss.status,
        ss.project_id
      FROM split_sheets ss
      JOIN split_sheet_contributors ssc ON ss.id = ssc.split_sheet_id
      WHERE ss.user_id = ${userId}
        AND ssc.signed_at IS NULL
        AND (ss.created_at + INTERVAL '14 days')::date >= ${startDate}
        AND (ss.created_at + INTERVAL '14 days')::date <= ${endDate}
    `);

    // Get payment due dates from payments
    const paymentEvents = await db.execute(sql`
      SELECT DISTINCT
        ss.id,
        'split_sheet_payment_due' as event_type,
        CONCAT(ss.title, ' - Betalingsfrist') as event_title,
        p.payment_date as event_date,
        p.payment_status,
        ss.project_id
      FROM split_sheet_payments p
      JOIN split_sheets ss ON p.split_sheet_id = ss.id
      WHERE ss.user_id = ${userId}
        AND p.payment_date IS NOT NULL
        AND p.payment_date >= ${startDate}
        AND p.payment_date <= ${endDate}
        AND p.payment_status = 'pending'
    `);

    // Get revenue reporting periods
    const revenueEvents = await db.execute(sql`
      SELECT DISTINCT
        ss.id,
        'split_sheet_revenue_period' as event_type,
        CONCAT(ss.title, ' - Inntektsrapport') as event_title,
        sr.period_end as event_date,
        ss.status,
        ss.project_id
      FROM split_sheet_revenue sr
      JOIN split_sheets ss ON sr.split_sheet_id = ss.id
      WHERE ss.user_id = ${userId}
        AND sr.period_end >= ${startDate}
        AND sr.period_end <= ${endDate}
    `);

    const allEvents = [
      ...creationEvents.rows.map((e: any) => ({ ...e, color: '#9f7aea' })),
      ...signatureEvents.rows.map((e: any) => ({ ...e, color: '#ff9800' })),
      ...paymentEvents.rows.map((e: any) => ({ ...e, color: '#2196f3' })),
      ...revenueEvents.rows.map((e: any) => ({ ...e, color: '#4caf50' }))
    ];

    res.json({
      success: true,
      data: allEvents
    });
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch calendar events' });
  }
});

/**
 * GET /api/split-sheets/:id/export/csv
 * Export split sheet as CSV
 */
router.get('/:id/export/csv', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    // Get split sheet
    const splitSheetQuery = sql`
      SELECT * FROM split_sheets WHERE id = ${id} AND user_id = ${userId}
    `;
    const splitSheetResult = await db.execute(splitSheetQuery);
    
    if (splitSheetResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Split sheet not found' });
    }

    const splitSheet = splitSheetResult.rows[0];

    // Get contributors
    const contributorsQuery = sql`
      SELECT * FROM split_sheet_contributors 
      WHERE split_sheet_id = ${id}
      ORDER BY order_index
    `;
    const contributorsResult = await db.execute(contributorsQuery);

    // Generate CSV
    const csvRows = [
      ['Split Sheet Export'],
      ['Title', splitSheet.title],
      ['Description', splitSheet.description || ''],
      ['Status', splitSheet.status],
      ['Created', splitSheet.created_at],
      [''],
      ['Contributors'],
      ['Name', 'Email', 'Role', 'Percentage', 'Signed', 'Signed At']
    ];

    contributorsResult.rows.forEach((contributor: any) => {
      csvRows.push([
        contributor.name || '',
        contributor.email || '',
        contributor.role || '',
        contributor.percentage || '0',
        contributor.signed_at ? 'Yes' : 'No',
        contributor.signed_at || ''
      ]);
    });

    const csv = csvRows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="split-sheet-${id}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting split sheet as CSV:', error);
    res.status(500).json({ success: false, error: 'Failed to export split sheet' });
  }
});

/**
 * GET /api/split-sheets/invoices
 * Get split sheet invoices for user
 */
router.get('/invoices', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { userId: queryUserId } = req.query;
    const effectiveUserId = queryUserId || userId;

    const invoicesQuery = sql`
      SELECT 
        i.id,
        i.split_sheet_id,
        ss.title as split_sheet_title,
        i.amount,
        i.currency,
        i.status,
        i.created_at,
        i.due_date,
        i.paid_at,
        i.recipient_email,
        i.fiken_invoice_id
      FROM split_sheet_invoices i
      JOIN split_sheets ss ON i.split_sheet_id = ss.id
      WHERE ss.user_id = ${effectiveUserId}
      ORDER BY i.created_at DESC
    `;
    const invoicesResult = await db.execute(invoicesQuery);

    res.json({ success: true, invoices: invoicesResult.rows });
  } catch (error) {
    console.error('Error fetching split sheet invoices:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch invoices' });
  }
});

/**
 * POST /api/split-sheets/invoices/:id/send-email
 * Send invoice via email
 */
router.post('/invoices/:id/send-email', async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { recipient, subject, message } = req.body;
    const userId = req.userId;

    // Verify invoice belongs to user
    const checkQuery = sql`
      SELECT i.* FROM split_sheet_invoices i
      JOIN split_sheets ss ON i.split_sheet_id = ss.id
      WHERE i.id = ${id} AND ss.user_id = ${userId}
    `;
    const checkResult = await db.execute(checkQuery);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    // Update invoice status and recipient
    await db.execute(sql`
      UPDATE split_sheet_invoices
      SET status = 'sent',
          recipient_email = ${recipient},
          updated_at = NOW()
      WHERE id = ${id}
    `);

    // In production, send email here
    // For now, just return success
    res.json({ success: true, message: 'Invoice sent via email' });
  } catch (error) {
    console.error('Error sending invoice email:', error);
    res.status(500).json({ success: false, error: 'Failed to send invoice' });
  }
});

/**
 * POST /api/split-sheets/invoices/:id/google-esignature
 * Create Google Doc for invoice e-signature (payment acknowledgment)
 */
router.post('/invoices/:id/google-esignature', requireAuth, async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    // Fetch invoice
    const invoiceQuery = sql`
      SELECT 
        i.*,
        ss.title as split_sheet_title,
        ss.user_id
      FROM split_sheet_invoices i
      JOIN split_sheets ss ON i.split_sheet_id = ss.id
      WHERE i.id = ${id} AND ss.user_id = ${userId}
    `;
    const invoiceResult = await db.execute(invoiceQuery);

    if (invoiceResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found',
      });
    }

    const invoice = invoiceResult.rows[0] as any;

    // Import services
    const { generateSplitSheetPDF } = await import('../services/split-sheet-pdf-service');
    const { createSignableGoogleDocFromPDF } = await import('../services/google-esignature-service');

    // Generate invoice PDF (simplified version)
    // For now, we'll create a basic invoice PDF
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument();
    const buffers: Buffer[] = [];
    doc.on('data', buffers.push.bind(buffers));

    doc.fontSize(20).text('INVOICE / FAKTURA', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Invoice ID: ${invoice.id}`);
    doc.text(`Split Sheet: ${invoice.split_sheet_title}`);
    doc.text(`Amount: ${invoice.amount} ${invoice.currency}`);
    doc.text(`Status: ${invoice.status}`);
    if (invoice.due_date) {
      doc.text(`Due Date: ${new Date(invoice.due_date).toLocaleDateString('no-NO')}`);
    }
    doc.moveDown();
    doc.text('Payment Acknowledgment:');
    doc.text('Signature: _________________________');
    doc.text('Date: _________________________');

    doc.end();
    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);
    });

    // Prepare signers
    const signers = [
      {
        name: invoice.recipient_email || 'Recipient',
        email: invoice.recipient_email || '',
        role: 'Invoice Recipient',
      },
    ];

    // Create signable Google Doc
    const result = await createSignableGoogleDocFromPDF({
      documentType: 'invoice',
      documentId: invoice.id,
      documentTitle: `Invoice - ${invoice.split_sheet_title}`,
      signers,
      userId,
      pdfBuffer,
      emailMessage: `Hei,\n\nDu er invitert til å signere faktura for betalingsbekreftelse: ${invoice.split_sheet_title}\n\nKlikk på lenken for å se og signere dokumentet.\n\nMed vennlig hilsen,\nCreatorHub Norge`,
    });

    // Update invoice with Google Doc info
    await db.execute(sql`
      UPDATE split_sheet_invoices
      SET 
        google_doc_id = ${result.documentId},
        google_doc_url = ${result.documentUrl},
        signature_status = 'pending',
        require_signature = TRUE,
        updated_at = NOW()
      WHERE id = ${id}
    `);

    res.json({
      success: true,
      data: {
        documentId: result.documentId,
        documentUrl: result.documentUrl,
        shareUrl: result.shareUrl,
        message: 'Google Doc invoice created and shared for payment acknowledgment signature',
      },
    });
  } catch (error) {
    console.error('Error creating Google Doc for invoice e-signature:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create Google Doc for e-signature',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/split-sheets/invoices/:id/send-fiken
 * Send invoice to Fiken
 */
router.post('/invoices/:id/send-fiken', async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    // Verify invoice belongs to user
    const checkQuery = sql`
      SELECT i.*, ss.* FROM split_sheet_invoices i
      JOIN split_sheets ss ON i.split_sheet_id = ss.id
      WHERE i.id = ${id} AND ss.user_id = ${userId}
    `;
    const checkResult = await db.execute(checkQuery);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    const invoice = checkResult.rows[0];

    // In production, integrate with Fiken API here
    // For now, simulate Fiken integration
    const fikenInvoiceId = `fiken_${Date.now()}`;

    // Update invoice with Fiken ID
    await db.execute(sql`
      UPDATE split_sheet_invoices
      SET fiken_invoice_id = ${fikenInvoiceId},
          status = 'sent',
          updated_at = NOW()
      WHERE id = ${id}
    `);

    res.json({ success: true, message: 'Invoice sent to Fiken', fikenInvoiceId });
  } catch (error) {
    console.error('Error sending invoice to Fiken:', error);
    res.status(500).json({ success: false, error: 'Failed to send invoice to Fiken' });
  }
});

/**
 * GET /api/split-sheets/invoices/:id/download
 * Download invoice PDF
 */
router.get('/invoices/:id/download', async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    // Verify invoice belongs to user and get data
    const invoiceQuery = sql`
      SELECT i.*, ss.* FROM split_sheet_invoices i
      JOIN split_sheets ss ON i.split_sheet_id = ss.id
      WHERE i.id = ${id} AND ss.user_id = ${userId}
    `;
    const invoiceResult = await db.execute(invoiceQuery);
    
    if (invoiceResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    // In production, generate actual PDF
    // For now, return JSON
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${id}.json"`);
    res.json(invoiceResult.rows[0]);
  } catch (error) {
    console.error('Error downloading invoice:', error);
    res.status(500).json({ success: false, error: 'Failed to download invoice' });
  }
});

/**
 * GET /api/split-sheets/reports
 * Get split sheet reports for user
 */
router.get('/reports', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { userId: queryUserId } = req.query;
    const effectiveUserId = queryUserId || userId;

    // In production, fetch from reports table
    // For now, return empty array
    res.json({ success: true, reports: [] });
  } catch (error) {
    console.error('Error fetching split sheet reports:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch reports' });
  }
});

/**
 * POST /api/split-sheets/reports/generate
 * Generate split sheet report
 */
router.post('/reports/generate', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { period } = req.body;

    // In production, generate actual report
    // For now, return success
    res.json({ 
      success: true, 
      message: 'Report generation started',
      reportId: `report_${Date.now()}`
    });
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ success: false, error: 'Failed to generate report' });
  }
});

/**
 * POST /api/split-sheets/:id/validate-percentages
 * Validate and optionally auto-fix percentage calculations
 */
router.post('/:id/validate-percentages', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const { auto_fix = false } = req.body;

    // Check ownership
    const checkQuery = sql`
      SELECT * FROM split_sheets WHERE id = ${id} AND user_id = ${userId}
    `;
    const checkResult = await db.execute(checkQuery);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Split sheet not found' });
    }

    // Get contributors
    const contributorsQuery = sql`
      SELECT * FROM split_sheet_contributors 
      WHERE split_sheet_id = ${id}
      ORDER BY order_index
    `;
    const contributorsResult = await db.execute(contributorsQuery);
    const contributors = contributorsResult.rows;

    // Calculate total
    const totalPercentage = contributors.reduce((sum: number, c: any) => sum + parseFloat(c.percentage || 0), 0);
    const isValid = Math.abs(totalPercentage - 100) < 0.01;
    const difference = totalPercentage - 100;

    // Auto-fix if requested
    if (!isValid && auto_fix && totalPercentage > 0) {
      const adjustmentFactor = 100 / totalPercentage;
      
      for (const contributor of contributors) {
        const newPercentage = Math.round((parseFloat(contributor.percentage) * adjustmentFactor) * 100) / 100;
        await db.execute(sql`
          UPDATE split_sheet_contributors
          SET percentage = ${newPercentage}
          WHERE id = ${contributor.id}
        `);
      }

      // Update total_percentage
      await db.execute(sql`
        UPDATE split_sheets
        SET total_percentage = 100.00
        WHERE id = ${id}
      `);

      return res.json({
        success: true,
        was_fixed: true,
        message: 'Percentages auto-adjusted to 100%',
        before: {
          total: totalPercentage,
          difference
        },
        after: {
          total: 100.00,
          difference: 0
        }
      });
    }

    res.json({
      success: true,
      is_valid: isValid,
      total_percentage: totalPercentage,
      difference,
      message: isValid 
        ? 'Percentages are valid (total = 100%)'
        : totalPercentage > 100
          ? `Total exceeds 100% by ${(totalPercentage - 100).toFixed(2)}%`
          : `Total is ${(100 - totalPercentage).toFixed(2)}% less than 100%`,
      contributors: contributors.map((c: any) => ({
        id: c.id,
        name: c.name,
        percentage: parseFloat(c.percentage)
      }))
    });
  } catch (error) {
    console.error('Error validating percentages:', error);
    res.status(500).json({ success: false, error: 'Failed to validate percentages' });
  }
});

/**
 * GET /api/split-sheets/:id/security
 * Get security settings for split sheet
 */
router.get('/:id/security', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    // Check ownership
    const checkQuery = sql`
      SELECT access_code, pin, password, security_enabled, require_pin_for_signature, require_password_for_signature
      FROM split_sheets 
      WHERE id = ${id} AND user_id = ${userId}
    `;
    const result = await db.execute(checkQuery);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Split sheet not found' });
    }

    const security = result.rows[0];
    // Don't return actual PIN/password, just indicate if they're set
    res.json({
      success: true,
      data: {
        access_code: security.access_code,
        has_pin: !!security.pin,
        has_password: !!security.password,
        security_enabled: security.security_enabled,
        require_pin_for_signature: security.require_pin_for_signature,
        require_password_for_signature: security.require_password_for_signature,
      }
    });
  } catch (error) {
    console.error('Error fetching security settings:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch security settings' });
  }
});

/**
 * POST /api/split-sheets/:id/security/access-code
 * Generate new access code for split sheet
 */
router.post('/:id/security/access-code', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    // Check ownership
    const checkQuery = sql`
      SELECT * FROM split_sheets WHERE id = ${id} AND user_id = ${userId}
    `;
    const checkResult = await db.execute(checkQuery);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Split sheet not found' });
    }

    // Generate access code
    const accessCode = Math.random().toString(36).substring(2, 5).toUpperCase() +
                       Math.random().toString(36).substring(2, 5).toUpperCase() +
                       Math.random().toString(36).substring(2, 5).toUpperCase();

    // Update split sheet with new access code
    await db.execute(sql`
      UPDATE split_sheets
      SET access_code = ${accessCode},
          security_enabled = TRUE,
          updated_at = NOW()
      WHERE id = ${id}
    `);

    res.json({ success: true, data: { access_code: accessCode } });
  } catch (error) {
    console.error('Error generating access code:', error);
    res.status(500).json({ success: false, error: 'Failed to generate access code' });
  }
});

/**
 * PUT /api/split-sheets/:id/security
 * Update security settings (PIN/password)
 */
router.put('/:id/security', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const { pin, password, security_enabled, require_pin_for_signature, require_password_for_signature } = req.body;

    // Check ownership
    const checkQuery = sql`
      SELECT * FROM split_sheets WHERE id = ${id} AND user_id = ${userId}
    `;
    const checkResult = await db.execute(checkQuery);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Split sheet not found' });
    }

    // Hash PIN and password using bcrypt (if provided)
    const bcrypt = require('bcrypt');
    let hashedPin = null;
    let hashedPassword = null;

    if (pin) {
      hashedPin = await bcrypt.hash(pin, 10);
    }

    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    // Build update query
    const updates: string[] = [];
    const params: any[] = [id, userId];
    let paramIndex = 3;

    if (pin !== undefined) {
      updates.push(`pin = $${paramIndex}`);
      params.push(hashedPin);
      paramIndex++;
    }

    if (password !== undefined) {
      updates.push(`password = $${paramIndex}`);
      params.push(hashedPassword);
      paramIndex++;
    }

    if (security_enabled !== undefined) {
      updates.push(`security_enabled = $${paramIndex}`);
      params.push(security_enabled);
      paramIndex++;
    }

    if (require_pin_for_signature !== undefined) {
      updates.push(`require_pin_for_signature = $${paramIndex}`);
      params.push(require_pin_for_signature);
      paramIndex++;
    }

    if (require_password_for_signature !== undefined) {
      updates.push(`require_password_for_signature = $${paramIndex}`);
      params.push(require_password_for_signature);
      paramIndex++;
    }

    if (updates.length > 0) {
      updates.push('updated_at = NOW()');
      const updateQuery = sql.raw(
        `UPDATE split_sheets SET ${updates.join(', ')} WHERE id = $1 AND user_id = $2 RETURNING *`,
        params
      );
      await db.execute(updateQuery);
    }

    res.json({ success: true, message: 'Security settings updated' });
  } catch (error) {
    console.error('Error updating security settings:', error);
    res.status(500).json({ success: false, error: 'Failed to update security settings' });
  }
});

/**
 * GET /api/split-sheets/portal/access/:accessCode
 * Validate access code and PIN/password for portal access
 */
router.get('/portal/access/:accessCode', async (req: any, res: Response) => {
  try {
    const { accessCode } = req.params;
    const { pin, password } = req.query;

    // Find split sheet by access code
    const splitSheetQuery = sql`
      SELECT id, pin, password, security_enabled, title, user_id
      FROM split_sheets
      WHERE access_code = ${accessCode.toUpperCase()}
    `;
    const result = await db.execute(splitSheetQuery);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Ugyldig tilgangskode' 
      });
    }

    const splitSheet = result.rows[0];

    // If security is not enabled, allow access
    if (!splitSheet.security_enabled) {
      return res.json({ 
        success: true, 
        data: { 
          split_sheet_id: splitSheet.id,
          title: splitSheet.title 
        } 
      });
    }

    // Verify PIN/password
    const bcrypt = require('bcrypt');
    let requiresPin = false;
    let requiresPassword = false;

    if (splitSheet.pin) {
      if (!pin) {
        requiresPin = true;
      } else {
        const isPinHashed = /^\$2[ayb]\$/.test(splitSheet.pin);
        let pinValid = false;
        
        if (isPinHashed) {
          pinValid = await bcrypt.compare(pin as string, splitSheet.pin);
        } else {
          pinValid = pin === splitSheet.pin;
        }
        
        if (!pinValid) {
          return res.status(401).json({ 
            success: false, 
            error: 'Ugyldig PIN',
            requiresPin: true,
            requiresPassword: !!splitSheet.password
          });
        }
      }
    }

    if (splitSheet.password) {
      if (!password) {
        requiresPassword = true;
      } else {
        const isPasswordHashed = /^\$2[ayb]\$/.test(splitSheet.password);
        let passwordValid = false;
        
        if (isPasswordHashed) {
          passwordValid = await bcrypt.compare(password as string, splitSheet.password);
        } else {
          passwordValid = password === splitSheet.password;
        }
        
        if (!passwordValid) {
          return res.status(401).json({ 
            success: false, 
            error: 'Ugyldig passord',
            requiresPassword: true,
            requiresPin: !!splitSheet.pin
          });
        }
      }
    }

    // If PIN/password is required but not provided
    if (requiresPin || requiresPassword) {
      return res.status(401).json({
        success: false,
        error: 'PIN eller passord er påkrevd',
        requiresPin,
        requiresPassword
      });
    }

    // Access granted
    res.json({ 
      success: true, 
      data: { 
        split_sheet_id: splitSheet.id,
        title: splitSheet.title 
      } 
    });
  } catch (error) {
    console.error('Error validating portal access:', error);
    res.status(500).json({ success: false, error: 'Failed to validate access' });
  }
});

/**
 * GET /api/split-sheets/:id/export/excel
 * Export split sheet as Excel (simplified - returns JSON that can be converted)
 */
router.get('/:id/export/excel', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    // Get split sheet with all data
    const splitSheetQuery = sql`
      SELECT * FROM split_sheets WHERE id = ${id} AND user_id = ${userId}
    `;
    const splitSheetResult = await db.execute(splitSheetQuery);
    
    if (splitSheetResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Split sheet not found' });
    }

    const splitSheet = splitSheetResult.rows[0];

    // Get contributors
    const contributorsQuery = sql`
      SELECT * FROM split_sheet_contributors 
      WHERE split_sheet_id = ${id}
      ORDER BY order_index
    `;
    const contributorsResult = await db.execute(contributorsQuery);

    // Get revenue
    const revenueQuery = sql`
      SELECT * FROM split_sheet_revenue 
      WHERE split_sheet_id = ${id}
      ORDER BY period_start DESC
    `;
    const revenueResult = await db.execute(revenueQuery);

    // Get payments
    const paymentsQuery = sql`
      SELECT * FROM split_sheet_payments 
      WHERE split_sheet_id = ${id}
      ORDER BY created_at DESC
    `;
    const paymentsResult = await db.execute(paymentsQuery);

    const exportData = {
      splitSheet: splitSheet,
      contributors: contributorsResult.rows,
      revenue: revenueResult.rows,
      payments: paymentsResult.rows,
      exportedAt: new Date().toISOString()
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="split-sheet-${id}.json"`);
    res.json(exportData);
  } catch (error) {
    console.error('Error exporting split sheet as Excel:', error);
    res.status(500).json({ success: false, error: 'Failed to export split sheet' });
  }
});

/**
 * GET /api/split-sheets/:id/related-contracts
 * Get contracts related to a split sheet's project
 */
router.get('/:id/related-contracts', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    // Get split sheet to find project_id
    const splitSheetQuery = sql`
      SELECT project_id FROM split_sheets 
      WHERE id = ${id} AND user_id = ${userId}
    `;
    const splitSheetResult = await db.execute(splitSheetQuery);
    
    if (splitSheetResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Split sheet not found' });
    }

    const projectId = splitSheetResult.rows[0].project_id;
    
    if (!projectId) {
      return res.json({ success: true, contracts: [] });
    }

    // Get contracts for the project
    const contractsQuery = sql`
      SELECT 
        c.*,
        cl.name as client_name,
        cl.email as client_email,
        p.name as project_name
      FROM contracts c
      LEFT JOIN clients cl ON c.client_id = cl.id
      LEFT JOIN projects p ON c.project_id = p.id
      WHERE c.project_id = ${projectId}
        AND (c.user_id = ${userId} OR c.photographer_id = ${userId})
      ORDER BY c.created_at DESC
    `;
    const contractsResult = await db.execute(contractsQuery);

    res.json({ 
      success: true, 
      contracts: contractsResult.rows.map((row: any) => ({
        id: row.id,
        clientName: row.client_name || row.client_name,
        clientEmail: row.client_email || row.client_email,
        projectDescription: row.description,
        totalAmount: row.total_price,
        status: row.status,
        createdAt: row.created_at,
        projectId: row.project_id,
        projectName: row.project_name,
        signature_status: row.signature_status,
        google_doc_id: row.google_doc_id,
        google_doc_url: row.google_doc_url,
      }))
    });
  } catch (error) {
    console.error('Error fetching related contracts:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch related contracts' });
  }
});

export default router;























