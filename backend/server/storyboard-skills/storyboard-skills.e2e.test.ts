import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { createAISuggestionService } from '../ai-suggestion-service.js';
import { setupStoryboardSkillRoutes } from './storyboard-skill-routes.js';
import { createStoryboardSkillAgents } from './storyboard-skills.js';

type SuggestionRow = Record<string, unknown> & { id: string; status: string };

class MemorySuggestionPool {
  rows: SuggestionRow[] = [];
  private nextId = 1;

  async query(statement: string, values: unknown[] = []) {
    const sql = statement.replace(/\s+/g, ' ').trim();
    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
      return { rows: [], rowCount: 0 };
    }
    if (sql.startsWith('INSERT INTO casting_ai_suggestions')) {
      const now = new Date();
      const row: SuggestionRow = {
        id: `suggestion-${this.nextId++}`,
        project_id: values[0],
        suggestion_type: values[1],
        payload: JSON.parse(String(values[2])),
        source_type: values[3],
        source_id: values[4],
        agent_name: values[5],
        model_version: values[6],
        confidence: values[7],
        status: 'pending',
        created_at: now,
        updated_at: now,
      };
      this.rows.push(row);
      return { rows: [row], rowCount: 1 };
    }
    if (sql.includes("SET status = 'superseded'")) {
      for (const row of this.rows) {
        if (
          row.project_id === values[0] && row.source_id === values[1] &&
          row.agent_name === values[2] && row.status === 'pending'
        ) row.status = 'superseded';
      }
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes("SET status = 'accepted'")) {
      const row = this.rows.find((entry) => entry.id === values[2]);
      if (row) {
        row.status = 'accepted';
        row.reviewed_by = values[0];
        row.review_note = values[1];
        row.reviewed_at = new Date();
        row.updated_at = new Date();
      }
      return { rows: [], rowCount: row ? 1 : 0 };
    }
    if (sql.startsWith('SELECT * FROM casting_ai_suggestions WHERE id = $1')) {
      const row = this.rows.find((entry) => entry.id === values[0]);
      return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
    }
    if (sql.includes('FOR UPDATE')) {
      const row = this.rows.find((entry) => entry.id === values[0]);
      return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
    }
    if (sql.startsWith('SELECT * FROM casting_ai_suggestions')) {
      const statuses = Array.isArray(values[1]) ? values[1] : [values[1]];
      const matching = this.rows.filter((row) =>
        row.project_id === values[0] && statuses.includes(row.status) &&
        Number(row.confidence) >= Number(values[2]) &&
        (!values[3] || row.suggestion_type === values[3]));
      return { rows: matching, rowCount: matching.length };
    }
    throw new Error(`Unhandled in-memory SQL: ${sql}`);
  }

  async connect() {
    return {
      query: this.query.bind(this),
      release() {},
    };
  }
}

const context = {
  project: { id: 'legacy-project-troll', title: 'TROLL' },
  scene: {
    id: 'scene-1',
    heading: 'INT. TOG — NATT',
    action: 'Nora løper gjennom vognen og stanser ved vinduet.',
    dialogue: [],
  },
  frames: [{
    id: 'frame-1',
    shotNumber: '1A',
    description: 'Nora stanser.',
    shotType: 'CU',
    duration: 2,
  }],
  activeFrameId: 'frame-1',
};

describe('Storyboard skills HTTP workflow', () => {
  it('runs, persists, reloads and explicitly accepts a proposal without an applier', async () => {
    const pool = new MemorySuggestionPool();
    const service = createAISuggestionService({ pool: pool as unknown as Pool });
    for (const agent of createStoryboardSkillAgents()) service.registerAgent(agent);

    const app = express();
    app.use(express.json());
    setupStoryboardSkillRoutes({
      app,
      pool: pool as unknown as Pool,
      requireUserSession: () => ({ userId: 'artist-session-user' }),
      aiSuggestionService: service,
      canAccessProject: async () => true,
      meetsTabLevel: async () => true,
    });

    const catalog = await request(app)
      .get('/api/role-room/projects/legacy-project-troll/storyboard-skills/catalog')
      .expect(200);
    expect(catalog.body.data).toHaveLength(8);

    const generated = await request(app)
      .post('/api/role-room/projects/legacy-project-troll/storyboard-skills/plan_scene_coverage/run')
      .send({ context })
      .expect(201);
    const suggestion = generated.body.data[0];
    expect(suggestion.status).toBe('pending');
    expect(suggestion.payload.recommendedChanges).not.toHaveLength(0);
    expect(context.frames).toHaveLength(1);

    const pending = await request(app)
      .get('/api/role-room/projects/legacy-project-troll/storyboard-skills/suggestions')
      .expect(200);
    expect(pending.body.data.map((entry: { id: string }) => entry.id)).toEqual([suggestion.id]);

    const accepted = await request(app)
      .post(`/api/role-room/projects/legacy-project-troll/storyboard-skills/suggestions/${suggestion.id}/accept`)
      .send({ note: 'Godkjent i HTTP E2E.' })
      .expect(200);
    expect(accepted.body.data.status).toBe('accepted');
    expect(accepted.body.data.reviewedBy).toBe('artist-session-user');
    expect(accepted.body.data).not.toHaveProperty('appliedAt');

    const afterReview = await request(app)
      .get('/api/role-room/projects/legacy-project-troll/storyboard-skills/suggestions')
      .expect(200);
    expect(afterReview.body.data).toEqual([]);
  });
});
