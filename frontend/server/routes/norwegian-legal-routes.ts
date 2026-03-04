/**
 * Norwegian Legal Data API Routes
 * 
 * Endpoints for Norwegian legal data integration with split sheets
 */

import type { Response } from 'express';
import { Router } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { NorwegianLegalService } from '../services/norwegian-legal-service';

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

/**
 * GET /api/norwegian-laws
 * Search/filter laws by category, keywords
 */
router.get('/', async (req: any, res: Response) => {
  try {
    const { query, category, law_name, limit = 50, offset = 0 } = req.query;

    const laws = await NorwegianLegalService.searchLaws({
      query: query as string,
      category: category as string,
      law_name: law_name as string,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });

    res.json({ success: true, data: laws });
  } catch (error) {
    console.error('Error searching laws:', error);
    res.status(500).json({ success: false, error: 'Failed to search laws' });
  }
});

/**
 * GET /api/norwegian-laws/:id
 * Get specific law paragraph
 */
router.get('/:id', async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const law = await NorwegianLegalService.getLawById(id);

    if (!law) {
      return res.status(404).json({ success: false, error: 'Law not found' });
    }

    res.json({ success: true, data: law });
  } catch (error) {
    console.error('Error fetching law:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch law' });
  }
});

/**
 * GET /api/split-sheets/:id/legal-references
 * Get legal references for a split sheet
 */
router.get('/split-sheets/:id/legal-references', async (req: any, res: Response) => {
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

    const references = await NorwegianLegalService.getReferences(id);
    res.json({ success: true, data: references });
  } catch (error) {
    console.error('Error fetching legal references:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch legal references' });
  }
});

/**
 * POST /api/split-sheets/:id/legal-references
 * Add legal reference to split sheet
 */
router.post('/split-sheets/:id/legal-references', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const { law_id, section_type, relevance_score, notes } = req.body;

    if (!law_id) {
      return res.status(400).json({ success: false, error: 'law_id is required' });
    }

    // Check ownership
    const checkQuery = sql`
      SELECT * FROM split_sheets WHERE id = ${id} AND user_id = ${userId}
    `;
    const checkResult = await db.execute(checkQuery);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Split sheet not found' });
    }

    // Verify law exists
    const law = await NorwegianLegalService.getLawById(law_id);
    if (!law) {
      return res.status(404).json({ success: false, error: 'Law not found' });
    }

    await NorwegianLegalService.addReference(id, law_id, {
      section_type,
      relevance_score,
      notes,
      added_by: userId
    });

    const references = await NorwegianLegalService.getReferences(id);
    res.json({ success: true, data: references });
  } catch (error) {
    console.error('Error adding legal reference:', error);
    res.status(500).json({ success: false, error: 'Failed to add legal reference' });
  }
});

/**
 * DELETE /api/split-sheets/:id/legal-references/:referenceId
 * Remove legal reference from split sheet
 */
router.delete('/split-sheets/:id/legal-references/:referenceId', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { id, referenceId } = req.params;

    // Check ownership
    const checkQuery = sql`
      SELECT * FROM split_sheets WHERE id = ${id} AND user_id = ${userId}
    `;
    const checkResult = await db.execute(checkQuery);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Split sheet not found' });
    }

    await db.execute(sql`
      DELETE FROM split_sheet_legal_references 
      WHERE id = ${referenceId} AND split_sheet_id = ${id}
    `);

    res.json({ success: true, message: 'Legal reference removed' });
  } catch (error) {
    console.error('Error removing legal reference:', error);
    res.status(500).json({ success: false, error: 'Failed to remove legal reference' });
  }
});

/**
 * GET /api/split-sheets/:id/legal-suggestions
 * Get AI-generated legal suggestions for split sheet
 */
router.get('/split-sheets/:id/legal-suggestions', async (req: any, res: Response) => {
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

    // Get split sheet with contributors
    const splitSheetQuery = sql`
      SELECT 
        ss.*,
        COALESCE(SUM(ssc.percentage), 0) as total_percentage,
        json_agg(
          json_build_object(
            'id', ssc.id,
            'name', ssc.name,
            'role', ssc.role,
            'percentage', ssc.percentage,
            'signed_at', ssc.signed_at
          )
        ) FILTER (WHERE ssc.id IS NOT NULL) as contributors
      FROM split_sheets ss
      LEFT JOIN split_sheet_contributors ssc ON ss.id = ssc.split_sheet_id
      WHERE ss.id = ${id}
      GROUP BY ss.id
    `;
    const splitSheetResult = await db.execute(splitSheetQuery);
    const splitSheet = splitSheetResult.rows[0];

    // Generate suggestions
    const suggestions = await NorwegianLegalService.generateSuggestions(id, {
      contributors: splitSheet.contributors || [],
      total_percentage: parseFloat(splitSheet.total_percentage) || 0,
      status: splitSheet.status
    });

    // Store suggestions in database
    for (const suggestion of suggestions) {
      const suggestionId = uuidv4();
      await db.execute(sql`
        INSERT INTO legal_suggestions (
          id, split_sheet_id, law_id, suggestion_type, title, description,
          explanation, section_type, confidence_score, status
        )
        VALUES (
          ${suggestionId}, ${suggestion.split_sheet_id}, ${suggestion.law_id},
          ${suggestion.suggestion_type}, ${suggestion.title}, ${suggestion.description},
          ${suggestion.explanation || null}, ${suggestion.section_type || null},
          ${suggestion.confidence_score}, ${suggestion.status}
        )
        ON CONFLICT DO NOTHING
      `);
    }

    // Fetch stored suggestions
    const storedSuggestions = await db.execute(sql`
      SELECT 
        ls.*,
        nl.law_name,
        nl.law_code,
        nl.chapter,
        nl.paragraph,
        nl.content
      FROM legal_suggestions ls
      INNER JOIN norwegian_laws nl ON ls.law_id = nl.id
      WHERE ls.split_sheet_id = ${id} AND ls.status = 'pending'
      ORDER BY ls.confidence_score DESC, ls.created_at DESC
    `);

    res.json({ success: true, data: storedSuggestions.rows });
  } catch (error) {
    console.error('Error fetching legal suggestions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch legal suggestions' });
  }
});

/**
 * PUT /api/split-sheets/legal-suggestions/:suggestionId
 * Update suggestion status (accept/reject/dismiss)
 */
router.put('/split-sheets/legal-suggestions/:suggestionId', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { suggestionId } = req.params;
    const { status } = req.body;

    if (!['accepted', 'rejected', 'dismissed'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    // Check ownership through split sheet
    const checkQuery = sql`
      SELECT ss.* FROM split_sheets ss
      INNER JOIN legal_suggestions ls ON ss.id = ls.split_sheet_id
      WHERE ls.id = ${suggestionId} AND ss.user_id = ${userId}
    `;
    const checkResult = await db.execute(checkQuery);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Suggestion not found' });
    }

    await db.execute(sql`
      UPDATE legal_suggestions
      SET 
        status = ${status},
        accepted_at = ${status === 'accepted' ? sql`NOW()` : null},
        accepted_by = ${status === 'accepted' ? userId : null},
        updated_at = NOW()
      WHERE id = ${suggestionId}
    `);

    res.json({ success: true, message: 'Suggestion updated' });
  } catch (error) {
    console.error('Error updating suggestion:', error);
    res.status(500).json({ success: false, error: 'Failed to update suggestion' });
  }
});

/**
 * POST /api/norwegian-laws/sync-external
 * Sync laws from external API (Lovdata)
 */
router.post('/sync-external', async (req: any, res: Response) => {
  try {
    const { source = 'lovdata' } = req.body;
    const count = await NorwegianLegalService.syncFromExternal(source as 'lovdata');
    res.json({ success: true, message: `Synced ${count} laws from ${source}` });
  } catch (error) {
    console.error('Error syncing external laws:', error);
    res.status(500).json({ success: false, error: 'Failed to sync external laws' });
  }
});

export default router;























