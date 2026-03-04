/**
 * Virtual Studio API Routes
 * 
 * Endpoints:
 * - POST   /api/virtual-studio/projects        - Create/update project
 * - GET    /api/virtual-studio/projects        - List user's projects
 * - GET    /api/virtual-studio/projects/:id    - Get specific project
 * - DELETE /api/virtual-studio/projects/:id    - Delete project
 * - POST   /api/virtual-studio/projects/:id/share - Share project
 */

import type { Response } from 'express';
import { Router, Request } from 'express';
import { db } from '../db';
import { virtualStudioProjects } from '../../shared/virtual-studio-schema';
import { eq, and, desc } from 'drizzle-orm';

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
 * Create or update a project
 */
router.post('/projects', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const projectData = req.body;
    
    // Validate required fields
    if (!projectData.name) {
      return res.status(400).json({ error: 'Project name is required' });
    }
    
    // Check if updating existing project
    if (projectData.id) {
      const existing = await db
        .select()
        .from(virtualStudioProjects)
        .where(
          and(
            eq(virtualStudioProjects.id, projectData.id),
            eq(virtualStudioProjects.userId, userId)
          )
        )
        .limit(1);
      
      if (existing.length > 0) {
        // Update existing project
        const updated = await db
          .update(virtualStudioProjects)
          .set({
            name: projectData.name,
            description: projectData.description,
            sceneData: projectData.scene,
            timelineData: projectData.timeline,
            colorGradingData: projectData.colorGrading,
            renderSettings: projectData.renderSettings,
            thumbnail: projectData.thumbnail,
            tags: projectData.tags,
            version: existing[0].version + 1,
            updatedAt: new Date(),
          })
          .where(eq(virtualStudioProjects.id, projectData.id))
          .returning();
        
        return res.json(updated[0]);
      }
    }
    
    // Create new project
    const newProject = await db
      .insert(virtualStudioProjects)
      .values({
        userId,
        name: projectData.name,
        description: projectData.description,
        sceneData: projectData.scene,
        timelineData: projectData.timeline,
        colorGradingData: projectData.colorGrading,
        renderSettings: projectData.renderSettings,
        thumbnail: projectData.thumbnail,
        tags: projectData.tags,
        version: 1,
      })
      .returning();
    
    res.json(newProject[0]);
  } catch (error) {
    console.error('Error saving project:', error);
    res.status(500).json({ error: 'Failed to save project' });
  }
});

/**
 * List all projects for the current user
 */
router.get('/projects', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    
    const projects = await db
      .select({
        id: virtualStudioProjects.id,
        name: virtualStudioProjects.name,
        description: virtualStudioProjects.description,
        thumbnail: virtualStudioProjects.thumbnail,
        tags: virtualStudioProjects.tags,
        version: virtualStudioProjects.version,
        createdAt: virtualStudioProjects.createdAt,
        updatedAt: virtualStudioProjects.updatedAt,
      })
      .from(virtualStudioProjects)
      .where(eq(virtualStudioProjects.userId, userId))
      .orderBy(desc(virtualStudioProjects.updatedAt));
    
    res.json(projects);
  } catch (error) {
    console.error('Error loading projects:', error);
    res.status(500).json({ error: 'Failed to load projects' });
  }
});

/**
 * Get a specific project
 */
router.get('/projects/:id', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const projectId = req.params.id;
    
    const project = await db
      .select()
      .from(virtualStudioProjects)
      .where(
        and(
          eq(virtualStudioProjects.id, projectId),
          eq(virtualStudioProjects.userId, userId)
        )
      )
      .limit(1);
    
    if (project.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    res.json(project[0]);
  } catch (error) {
    console.error('Error loading project:', error);
    res.status(500).json({ error: 'Failed to load project' });
  }
});

/**
 * Delete a project
 */
router.delete('/projects/:id', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const projectId = req.params.id;
    
    const deleted = await db
      .delete(virtualStudioProjects)
      .where(
        and(
          eq(virtualStudioProjects.id, projectId),
          eq(virtualStudioProjects.userId, userId)
        )
      )
      .returning();
    
    if (deleted.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

export default router;

