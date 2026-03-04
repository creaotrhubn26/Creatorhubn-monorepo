/**
 * Camera API Routes
 * 
 * Endpoints for camera database and user camera management
 * - GET    /api/cameras                    - Get all cameras from database
 * - GET    /api/cameras/search             - Search cameras by brand/model
 * - GET    /api/cameras/user/:userId       - Get user's selected cameras
 * - POST   /api/cameras/user               - Save user's camera selections
 * - PUT    /api/cameras/user/:id           - Update user camera
 * - DELETE /api/cameras/user/:id           - Remove user camera
 */

import type { Response } from 'express';
import { Router } from 'express';
import { db } from '../db';
import { cameras, userCameras } from '../../shared/camera-database-schema';
import { eq, and, like, or, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

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

// ==================== CAMERA DATABASE ENDPOINTS ====================

/**
 * GET /api/cameras
 * Get all cameras from database
 */
router.get('/', async (req: any, res: Response) => {
  try {
    const { brand, category, limit = 100 } = req.query;

    let query = db.select().from(cameras);

    // Apply filters
    const conditions = [];
    if (brand) {
      conditions.push(like(cameras.brand, `%${brand}%`));
    }
    if (category) {
      conditions.push(eq(cameras.category, category));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const results = await query
      .orderBy(desc(cameras.releaseYear), cameras.brand, cameras.model)
      .limit(parseInt(limit as string));

    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Error fetching cameras:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch cameras' });
  }
});

/**
 * GET /api/cameras/search
 * Search cameras by brand, model, or full name
 */
router.get('/search', async (req: any, res: Response) => {
  try {
    const { q, brand, limit = 50 } = req.query;

    if (!q && !brand) {
      return res.status(400).json({ success: false, error: 'Search query or brand required' });
    }

    const conditions = [];
    if (q) {
      conditions.push(
        or(
          like(cameras.model, `%${q}%`),
          like(cameras.fullName, `%${q}%`),
          like(cameras.brand, `%${q}%`)
        )
      );
    }
    if (brand) {
      conditions.push(like(cameras.brand, `%${brand}%`));
    }

    const results = await db
      .select()
      .from(cameras)
      .where(and(...conditions))
      .orderBy(desc(cameras.releaseYear), cameras.brand, cameras.model)
      .limit(parseInt(limit as string));

    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Error searching cameras:', error);
    res.status(500).json({ success: false, error: 'Failed to search cameras' });
  }
});

// ==================== USER CAMERA ENDPOINTS ====================

/**
 * GET /api/cameras/user/:userId
 * Get user's selected cameras with full camera details
 */
router.get('/user/:userId', async (req: any, res: Response) => {
  try {
    const { userId } = req.params;
    const requestUserId = req.userId;

    // Security: Users can only access their own cameras
    if (userId !== requestUserId) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const results = await db
      .select({
        id: userCameras.id,
        userId: userCameras.userId,
        cameraId: userCameras.cameraId,
        isPrimary: userCameras.isPrimary,
        nickname: userCameras.nickname,
        serialNumber: userCameras.serialNumber,
        createdAt: userCameras.createdAt,
        camera: cameras,
      })
      .from(userCameras)
      .leftJoin(cameras, eq(userCameras.cameraId, cameras.id))
      .where(eq(userCameras.userId, userId))
      .orderBy(desc(userCameras.isPrimary), userCameras.createdAt);

    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Error fetching user cameras:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch user cameras' });
  }
});

/**
 * POST /api/cameras/user
 * Save user's camera selections (bulk operation)
 * Body: { cameras: Array<{ cameraId: string, isPrimary?: boolean, nickname?: string, serialNumber?: string }> }
 */
router.post('/user', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { cameras: cameraSelections } = req.body;

    if (!Array.isArray(cameraSelections) || cameraSelections.length === 0) {
      return res.status(400).json({ success: false, error: 'Cameras array required' });
    }

    // Delete existing user cameras
    await db.delete(userCameras).where(eq(userCameras.userId, userId));

    // Insert new selections
    const newCameras = cameraSelections.map((cam: any, index: number) => ({
      id: uuidv4(),
      userId,
      cameraId: cam.cameraId,
      isPrimary: index === 0 ? true : (cam.isPrimary || false), // First camera is primary by default
      nickname: cam.nickname || null,
      serialNumber: cam.serialNumber || null,
    }));

    const inserted = await db.insert(userCameras).values(newCameras).returning();

    res.json({ success: true, data: inserted });
  } catch (error) {
    console.error('Error saving user cameras:', error);
    res.status(500).json({ success: false, error: 'Failed to save user cameras' });
  }
});

/**
 * PUT /api/cameras/user/:id
 * Update a user camera (nickname, serial number, primary status)
 */
router.put('/user/:id', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const { isPrimary, nickname, serialNumber } = req.body;

    // If setting as primary, unset all other cameras first
    if (isPrimary) {
      await db
        .update(userCameras)
        .set({ isPrimary: false })
        .where(eq(userCameras.userId, userId));
    }

    const updated = await db
      .update(userCameras)
      .set({
        isPrimary: isPrimary !== undefined ? isPrimary : undefined,
        nickname: nickname !== undefined ? nickname : undefined,
        serialNumber: serialNumber !== undefined ? serialNumber : undefined,
      })
      .where(and(eq(userCameras.id, id), eq(userCameras.userId, userId)))
      .returning();

    if (updated.length === 0) {
      return res.status(404).json({ success: false, error: 'Camera not found' });
    }

    res.json({ success: true, data: updated[0] });
  } catch (error) {
    console.error('Error updating user camera:', error);
    res.status(500).json({ success: false, error: 'Failed to update user camera' });
  }
});

/**
 * DELETE /api/cameras/user/:id
 * Remove a user camera
 */
router.delete('/user/:id', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    const deleted = await db
      .delete(userCameras)
      .where(and(eq(userCameras.id, id), eq(userCameras.userId, userId)))
      .returning();

    if (deleted.length === 0) {
      return res.status(404).json({ success: false, error: 'Camera not found' });
    }

    res.json({ success: true, data: deleted[0] });
  } catch (error) {
    console.error('Error deleting user camera:', error);
    res.status(500).json({ success: false, error: 'Failed to delete user camera' });
  }
});

export default router;

