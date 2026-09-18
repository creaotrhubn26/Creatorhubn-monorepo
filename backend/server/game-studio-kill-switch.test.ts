import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import {
  GAME_STUDIO_DISABLED_ERROR,
  GAME_STUDIO_ENABLED_ENV,
  createGameStudioDisabledRouter,
  isGameStudioEnabled,
} from './game-studio-kill-switch.js';

describe('game-studio kill switch', () => {
  it('er på uten variabel og for alle andre verdier enn av-verdiene', () => {
    expect(isGameStudioEnabled({})).toBe(true);
    expect(isGameStudioEnabled({ [GAME_STUDIO_ENABLED_ENV]: 'true' })).toBe(true);
    expect(isGameStudioEnabled({ [GAME_STUDIO_ENABLED_ENV]: '' })).toBe(true);
    expect(isGameStudioEnabled({ [GAME_STUDIO_ENABLED_ENV]: 'yes' })).toBe(true);
  });

  it('er av for false/0/off/no (uavhengig av store/små bokstaver og mellomrom)', () => {
    for (const v of ['false', 'FALSE', ' 0 ', 'off', 'No']) {
      expect(isGameStudioEnabled({ [GAME_STUDIO_ENABLED_ENV]: v })).toBe(false);
    }
  });

  it('avslått-routeren svarer 503 game_studio_disabled på alle stier og metoder', async () => {
    const app = express();
    app.use(['/api/role-room/narrative', '/api/game'], createGameStudioDisabledRouter());
    app.get('/api/health', (_req, res) => { res.json({ ok: true }); });

    const get = await request(app).get('/api/role-room/narrative/projects/p1/graph');
    expect(get.status).toBe(503);
    expect(get.body).toMatchObject({ success: false, error: GAME_STUDIO_DISABLED_ERROR });
    expect(get.headers['retry-after']).toBe('300');

    const post = await request(app).post('/api/game/billing/checkout').send({});
    expect(post.status).toBe(503);
    expect(post.body.error).toBe(GAME_STUDIO_DISABLED_ERROR);

    // Resten av backend er upåvirket.
    const health = await request(app).get('/api/health');
    expect(health.status).toBe(200);
  });
});
