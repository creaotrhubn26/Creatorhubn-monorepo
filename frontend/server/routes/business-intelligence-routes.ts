/**
 * Business Intelligence API Routes
 * 
 * Endpoints for SWOT analysis, customer personas, surveys, and market data
 */

import type { Response } from 'express';
import { Router } from 'express';
import { db } from '../db';
import {
  swotItems,
  swotHistory,
  customerPersonas,
  surveys,
  surveyResponses,
  marketingCampaigns,
  newsletterCampaigns,
} from '../../shared/business-intelligence-schema';
import { eq, and, desc, gte, sql } from 'drizzle-orm';

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

// ==================== SWOT ENDPOINTS ====================

/**
 * GET /api/business/swot-items
 * Get all SWOT items for a user/profession
 */
router.get('/swot-items', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { profession, type, status, category } = req.query;

    const query = db
      .select()
      .from(swotItems)
      .where(eq(swotItems.userId, userId));

    // Apply filters
    const conditions = [eq(swotItems.userId, userId)];
    
    if (profession) {
      conditions.push(eq(swotItems.profession, profession));
    }
    if (type) {
      conditions.push(eq(swotItems.type, type));
    }
    if (status) {
      conditions.push(eq(swotItems.status, status));
    }
    if (category) {
      conditions.push(eq(swotItems.category, category));
    }

    const items = await db
      .select()
      .from(swotItems)
      .where(and(...conditions))
      .orderBy(desc(swotItems.createdAt));

    res.json({ data: items });
  } catch (error) {
    console.error('Error fetching SWOT items:', error);
    res.status(500).json({ error: 'Failed to fetch SWOT items' });
  }
});

/**
 * POST /api/business/swot-items
 * Create a new SWOT item
 */
router.post('/swot-items', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const itemData = req.body;

    const newItem = await db
      .insert(swotItems)
      .values({
        userId,
        profession: itemData.profession,
        type: itemData.type,
        title: itemData.title,
        description: itemData.description,
        category: itemData.category,
        impact: itemData.impact,
        probability: itemData.probability,
        status: itemData.status || 'identified',
        tags: itemData.tags || [],
        metadata: itemData.metadata || {},
      })
      .returning();

    res.json({ data: newItem[0] });
  } catch (error) {
    console.error('Error creating SWOT item:', error);
    res.status(500).json({ error: 'Failed to create SWOT item' });
  }
});

/**
 * PUT /api/business/swot-items/:id
 * Update a SWOT item
 */
router.put('/swot-items/:id', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const itemId = req.params.id;
    const itemData = req.body;

    // Check ownership
    const existing = await db
      .select()
      .from(swotItems)
      .where(and(eq(swotItems.id, itemId), eq(swotItems.userId, userId)))
      .limit(1);

    if (existing.length === 0) {
      return res.status(404).json({ error: 'SWOT item not found' });
    }

    // Create history entry
    await db.insert(swotHistory).values({
      swotItemId: itemId,
      userId,
      changeType: 'update',
      oldValue: existing[0],
      newValue: itemData,
      changedBy: userId,
    });

    // Update item
    const updated = await db
      .update(swotItems)
      .set({
        ...itemData,
        updatedAt: new Date(),
      })
      .where(eq(swotItems.id, itemId))
      .returning();

    res.json({ data: updated[0] });
  } catch (error) {
    console.error('Error updating SWOT item:', error);
    res.status(500).json({ error: 'Failed to update SWOT item' });
  }
});

/**
 * DELETE /api/business/swot-items/:id
 * Delete a SWOT item
 */
router.delete('/swot-items/:id', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const itemId = req.params.id;

    // Check ownership
    const existing = await db
      .select()
      .from(swotItems)
      .where(and(eq(swotItems.id, itemId), eq(swotItems.userId, userId)))
      .limit(1);

    if (existing.length === 0) {
      return res.status(404).json({ error: 'SWOT item not found' });
    }

    // Create history entry
    await db.insert(swotHistory).values({
      swotItemId: itemId,
      userId,
      changeType: 'delete',
      oldValue: existing[0],
      newValue: null,
      changedBy: userId,
    });

    // Delete item
    await db
      .delete(swotItems)
      .where(eq(swotItems.id, itemId));

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting SWOT item:', error);
    res.status(500).json({ error: 'Failed to delete SWOT item' });
  }
});

/**
 * GET /api/business/swot-trends/:userId/:profession
 * Get SWOT trends over time
 */
router.get('/swot-trends/:userId/:profession', async (req: any, res: Response) => {
  try {
    const { userId, profession } = req.params;
    const days = parseInt(req.query.days as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get historical data
    const trends = await db
      .select({
        date: sql<string>`DATE(${swotHistory.timestamp})`,
        type: swotItems.type,
        changeType: swotHistory.changeType,
        count: sql<number>`COUNT(*)`,
      })
      .from(swotHistory)
      .innerJoin(swotItems, eq(swotHistory.swotItemId, swotItems.id))
      .where(
        and(
          eq(swotItems.userId, userId),
          eq(swotItems.profession, profession),
          gte(swotHistory.timestamp, startDate)
        )
      )
      .groupBy(sql`DATE(${swotHistory.timestamp})`, swotItems.type, swotHistory.changeType)
      .orderBy(sql`DATE(${swotHistory.timestamp})`);

    res.json({ data: trends });
  } catch (error) {
    console.error('Error fetching SWOT trends:', error);
    res.status(500).json({ error: 'Failed to fetch SWOT trends' });
  }
});

// ==================== PERSONA ENDPOINTS ====================

/**
 * GET /api/business/personas
 * Get all customer personas
 */
router.get('/personas', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { profession } = req.query;

    const conditions = [eq(customerPersonas.userId, userId)];
    if (profession) {
      conditions.push(eq(customerPersonas.profession, profession));
    }

    const personas = await db
      .select()
      .from(customerPersonas)
      .where(and(...conditions))
      .orderBy(desc(customerPersonas.createdAt));

    res.json({ data: personas });
  } catch (error) {
    console.error('Error fetching personas:', error);
    res.status(500).json({ error: 'Failed to fetch personas' });
  }
});

/**
 * POST /api/business/personas
 * Create a new customer persona
 */
router.post('/personas', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const personaData = req.body;

    const newPersona = await db
      .insert(customerPersonas)
      .values({
        userId,
        profession: personaData.profession,
        name: personaData.name,
        description: personaData.description,
        avatar: personaData.avatar,
        ageRange: personaData.ageRange,
        location: personaData.location,
        income: personaData.income,
        customerType: personaData.customerType,
        budgetTier: personaData.budgetTier,
        goals: personaData.goals || [],
        painPoints: personaData.painPoints || [],
        preferredChannels: personaData.preferredChannels || [],
        preferredBrands: personaData.preferredBrands || [],
        personality: personaData.personality || {},
        socialTraits: personaData.socialTraits || {},
        metadata: personaData.metadata || {},
      })
      .returning();

    res.json({ data: newPersona[0] });
  } catch (error) {
    console.error('Error creating persona:', error);
    res.status(500).json({ error: 'Failed to create persona' });
  }
});

/**
 * PUT /api/business/personas/:id
 * Update a customer persona
 */
router.put('/personas/:id', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const personaId = req.params.id;
    const personaData = req.body;

    const updated = await db
      .update(customerPersonas)
      .set({
        ...personaData,
        updatedAt: new Date(),
      })
      .where(and(eq(customerPersonas.id, personaId), eq(customerPersonas.userId, userId)))
      .returning();

    if (updated.length === 0) {
      return res.status(404).json({ error: 'Persona not found' });
    }

    res.json({ data: updated[0] });
  } catch (error) {
    console.error('Error updating persona:', error);
    res.status(500).json({ error: 'Failed to update persona' });
  }
});

/**
 * DELETE /api/business/personas/:id
 * Delete a customer persona
 */
router.delete('/personas/:id', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const personaId = req.params.id;

    const deleted = await db
      .delete(customerPersonas)
      .where(and(eq(customerPersonas.id, personaId), eq(customerPersonas.userId, userId)))
      .returning();

    if (deleted.length === 0) {
      return res.status(404).json({ error: 'Persona not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting persona:', error);
    res.status(500).json({ error: 'Failed to delete persona' });
  }
});

// ==================== SURVEY ENDPOINTS ====================

/**
 * GET /api/business/surveys
 * Get all surveys
 */
router.get('/surveys', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { profession, status } = req.query;

    const conditions = [eq(surveys.userId, userId)];
    if (profession) {
      conditions.push(eq(surveys.profession, profession));
    }
    if (status) {
      conditions.push(eq(surveys.status, status));
    }

    const allSurveys = await db
      .select()
      .from(surveys)
      .where(and(...conditions))
      .orderBy(desc(surveys.createdAt));

    res.json({ data: allSurveys });
  } catch (error) {
    console.error('Error fetching surveys:', error);
    res.status(500).json({ error: 'Failed to fetch surveys' });
  }
});

/**
 * POST /api/business/surveys
 * Create a new survey
 */
router.post('/surveys', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const surveyData = req.body;

    const newSurvey = await db
      .insert(surveys)
      .values({
        userId,
        profession: surveyData.profession,
        title: surveyData.title,
        description: surveyData.description,
        purpose: surveyData.purpose,
        questions: surveyData.questions || [],
        status: surveyData.status || 'draft',
        targetAudience: surveyData.targetAudience || {},
        settings: surveyData.settings || {},
      })
      .returning();

    res.json({ data: newSurvey[0] });
  } catch (error) {
    console.error('Error creating survey:', error);
    res.status(500).json({ error: 'Failed to create survey' });
  }
});

/**
 * PUT /api/business/surveys/:id
 * Update a survey
 */
router.put('/surveys/:id', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const surveyId = req.params.id;
    const surveyData = req.body;

    const updated = await db
      .update(surveys)
      .set({
        ...surveyData,
        updatedAt: new Date(),
      })
      .where(and(eq(surveys.id, surveyId), eq(surveys.userId, userId)))
      .returning();

    if (updated.length === 0) {
      return res.status(404).json({ error: 'Survey not found' });
    }

    res.json({ data: updated[0] });
  } catch (error) {
    console.error('Error updating survey:', error);
    res.status(500).json({ error: 'Failed to update survey' });
  }
});

/**
 * DELETE /api/business/surveys/:id
 * Delete a survey
 */
router.delete('/surveys/:id', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const surveyId = req.params.id;

    const deleted = await db
      .delete(surveys)
      .where(and(eq(surveys.id, surveyId), eq(surveys.userId, userId)))
      .returning();

    if (deleted.length === 0) {
      return res.status(404).json({ error: 'Survey not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting survey:', error);
    res.status(500).json({ error: 'Failed to delete survey' });
  }
});

/**
 * GET /api/business/surveys/:id/responses
 * Get all responses for a survey
 */
router.get('/surveys/:id/responses', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const surveyId = req.params.id;

    // Verify survey ownership
    const survey = await db
      .select()
      .from(surveys)
      .where(and(eq(surveys.id, surveyId), eq(surveys.userId, userId)))
      .limit(1);

    if (survey.length === 0) {
      return res.status(404).json({ error: 'Survey not found' });
    }

    const responses = await db
      .select()
      .from(surveyResponses)
      .where(eq(surveyResponses.surveyId, surveyId))
      .orderBy(desc(surveyResponses.submittedAt));

    res.json({ data: responses });
  } catch (error) {
    console.error('Error fetching survey responses:', error);
    res.status(500).json({ error: 'Failed to fetch survey responses' });
  }
});

/**
 * POST /api/business/surveys/:id/responses
 * Submit a survey response
 */
router.post('/surveys/:id/responses', async (req: any, res: Response) => {
  try {
    const surveyId = req.params.id;
    const responseData = req.body;

    // Verify survey exists and is active
    const survey = await db
      .select()
      .from(surveys)
      .where(eq(surveys.id, surveyId))
      .limit(1);

    if (survey.length === 0) {
      return res.status(404).json({ error: 'Survey not found' });
    }

    if (survey[0].status !== 'active') {
      return res.status(400).json({ error: 'Survey is not active' });
    }

    const newResponse = await db
      .insert(surveyResponses)
      .values({
        surveyId,
        respondentId: responseData.respondentId,
        respondentEmail: responseData.respondentEmail,
        answers: responseData.answers || {},
        sentiment: responseData.sentiment || 'neutral',
        keyInsights: responseData.keyInsights || [],
        metadata: responseData.metadata || {},
      })
      .returning();

    // Update survey response count
    await db
      .update(surveys)
      .set({
        responseCount: sql`${surveys.responseCount} + 1`,
      })
      .where(eq(surveys.id, surveyId));

    res.json({ data: newResponse[0] });
  } catch (error) {
    console.error('Error submitting survey response:', error);
    res.status(500).json({ error: 'Failed to submit survey response' });
  }
});

export default router;

