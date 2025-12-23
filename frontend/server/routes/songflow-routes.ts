/**
 * SongFlow API Routes
 * 
 * Endpoints for SongFlow platform integration with split sheets
 */

import { Router, Response } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';

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
 * GET /api/songflow-tracks/:trackId/split-sheets
 * Get all split sheets linked to a SongFlow track
 */
router.get('/tracks/:trackId/split-sheets', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { trackId } = req.params;

    const result = await db.execute(sql`
      SELECT 
        ss.*,
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
 * GET /api/songflow-projects/:projectId/split-sheets
 * Get all split sheets linked to a SongFlow project
 */
router.get('/projects/:projectId/split-sheets', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { projectId } = req.params;

    const result = await db.execute(sql`
      SELECT 
        ss.*,
        COUNT(DISTINCT ssc.id) as contributor_count,
        COUNT(DISTINCT CASE WHEN ssc.signed_at IS NOT NULL THEN ssc.id END) as signed_count,
        ssl.link_type, ssl.auto_created, ssl.linked_at
      FROM split_sheets ss
      INNER JOIN split_sheet_songflow_links ssl ON ss.id = ssl.split_sheet_id
      LEFT JOIN split_sheet_contributors ssc ON ss.id = ssc.split_sheet_id
      WHERE ssl.songflow_project_id = ${projectId} AND ss.user_id = ${userId}
      GROUP BY ss.id, ssl.link_type, ssl.auto_created, ssl.linked_at
      ORDER BY ss.created_at DESC
    `);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching split sheets for SongFlow project:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch split sheets for SongFlow project' });
  }
});

export default router;























