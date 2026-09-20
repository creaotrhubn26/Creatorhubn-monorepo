// Role-by-role authorization matrix for the production surface.
//
// The handover asks for owner, producer, department head, assistant, reader
// and outsider to be tested against the same project, through real API calls
// rather than through the UI's hidden controls. Each guard validates its
// payload immediately after deciding access, so an empty body separates the
// two outcomes cleanly:
//
//   404 -> the guard refused (existence stays private across tenants)
//   400 -> the guard allowed, the payload was then rejected
//
// That keeps the assertions about authorization only, with no dependency on
// what the handler would have done with a valid request.
import express from 'express';
import type { Pool } from 'pg';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createCastingProductionRouter } from './casting-production-routes.js';

const SESSION_TOKEN = 'matrix-session';
const PROJECT_ID = 'project-1';
const USER_ID = 'member-1';

type Persona = {
  label: string;
  role: string | null;
  isOwner?: boolean;
  additionalRoles?: string[];
};

const PERSONAS: Persona[] = [
  { label: 'eier', role: null, isOwner: true },
  { label: 'produsent', role: 'producer' },
  { label: 'produksjonsleder', role: 'production_manager' },
  { label: 'location manager', role: 'location_manager' },
  { label: 'script supervisor', role: 'script_supervisor' },
  { label: 'produksjonsdesigner', role: 'production_designer' },
  { label: '1st AD', role: 'first_ad' },
  { label: 'leser', role: 'viewer' },
  { label: 'utenforstående', role: null },
];

type Probe = {
  key: string;
  send: (agent: ReturnType<typeof request>) => request.Test;
};

// One request per guarded lane. Bodies are deliberately empty.
const PROBES: Probe[] = [
  {
    key: 'les',
    send: (agent) => agent.get(`/api/role-room/projects/${PROJECT_ID}/location-operations`),
  },
  {
    key: 'lokasjon',
    send: (agent) => agent
      .patch(`/api/role-room/projects/${PROJECT_ID}/locations/location-1/operations`)
      .send({}),
  },
  {
    key: 'dagskontroll',
    send: (agent) => agent
      .patch(`/api/role-room/projects/${PROJECT_ID}/production-days/day-1/production-management`)
      .send({}),
  },
  {
    key: 'koordinering',
    send: (agent) => agent
      .patch(`/api/role-room/projects/${PROJECT_ID}/production-days/day-1/production-coordination`)
      .send({}),
  },
  {
    key: 'kontinuitet',
    send: (agent) => agent
      .patch(`/api/role-room/projects/${PROJECT_ID}/production-days/day-1/continuity`)
      .send({}),
  },
  {
    key: 'kommentar',
    send: (agent) => agent
      .post(`/api/role-room/projects/${PROJECT_ID}/production-days/day-1/continuity/comments`)
      .send({}),
  },
  {
    key: 'art department',
    send: (agent) => agent
      .patch(`/api/role-room/projects/${PROJECT_ID}/art-department`)
      .send({}),
  },
];

// true = past the guard, false = refused.
const EXPECTED: Record<string, Record<string, boolean>> = {
  'eier':               { les: true,  lokasjon: true,  dagskontroll: true,  koordinering: true,  kontinuitet: true,  kommentar: true,  'art department': true },
  'produsent':          { les: true,  lokasjon: true,  dagskontroll: true,  koordinering: true,  kontinuitet: false, kommentar: true,  'art department': false },
  'produksjonsleder':   { les: true,  lokasjon: true,  dagskontroll: true,  koordinering: true,  kontinuitet: false, kommentar: false, 'art department': false },
  'location manager':   { les: true,  lokasjon: true,  dagskontroll: false, koordinering: false, kontinuitet: false, kommentar: false, 'art department': false },
  'script supervisor':  { les: true,  lokasjon: false, dagskontroll: false, koordinering: false, kontinuitet: true,  kommentar: true,  'art department': false },
  'produksjonsdesigner': { les: true, lokasjon: false, dagskontroll: false, koordinering: false, kontinuitet: false, kommentar: false, 'art department': true },
  '1st AD':             { les: true,  lokasjon: false, dagskontroll: false, koordinering: false, kontinuitet: false, kommentar: true,  'art department': false },
  'leser':              { les: true,  lokasjon: false, dagskontroll: false, koordinering: false, kontinuitet: false, kommentar: false, 'art department': false },
  'utenforstående':     { les: false, lokasjon: false, dagskontroll: false, koordinering: false, kontinuitet: false, kommentar: false, 'art department': false },
};

function createApp(persona: Persona) {
  const query = async (text: string) => {
    if (/ALTER TABLE|CREATE TABLE|CREATE INDEX|CREATE UNIQUE INDEX/.test(text)) {
      return { rows: [], rowCount: 0 };
    }
    if (text.includes('AS member_role')) {
      return {
        rows: [{
          project_exists: true,
          is_owner: persona.isOwner === true,
          member_role: persona.role,
          member_permissions: null,
          member_additional_roles: persona.additionalRoles ?? null,
        }],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 0 };
  };

  const app = express();
  app.use(express.json());
  app.use('/api/role-room', createCastingProductionRouter(
    { query } as unknown as Pool,
    {
      activeSessions: new Map([[SESSION_TOKEN, {
        userId: USER_ID,
        email: 'member@example.test',
        name: 'Member',
        role: persona.role ?? 'member',
        loginAt: new Date().toISOString(),
      }]]),
    },
  ));
  return app;
}

describe('production surface authorization matrix', () => {
  for (const persona of PERSONAS) {
    for (const probe of PROBES) {
      const allowed = EXPECTED[persona.label][probe.key];
      it(`${persona.label} ${allowed ? 'slipper gjennom' : 'avvises på'} ${probe.key}`, async () => {
        const response = await probe.send(
          request(createApp(persona)) as ReturnType<typeof request>,
        ).set('authorization', `Bearer ${SESSION_TOKEN}`);

        if (allowed) {
          expect(response.status).not.toBe(404);
        } else {
          // Denials read as 404 so project existence stays private.
          expect(response.status).toBe(404);
        }
      });
    }
  }

  it('avviser uautentiserte kall før rollen i det hele tatt slås opp', async () => {
    const response = await request(createApp(PERSONAS[0]))
      .get(`/api/role-room/projects/${PROJECT_ID}/location-operations`);

    expect(response.status).toBe(401);
  });

  it('gir en produsent som også er script supervisor begge baner', async () => {
    const persona: Persona = {
      label: 'produsent+script',
      role: 'producer',
      additionalRoles: ['script_supervisor'],
    };
    const app = createApp(persona);

    const continuity = await request(app)
      .patch(`/api/role-room/projects/${PROJECT_ID}/production-days/day-1/continuity`)
      .set('authorization', `Bearer ${SESSION_TOKEN}`)
      .send({});
    const management = await request(app)
      .patch(`/api/role-room/projects/${PROJECT_ID}/production-days/day-1/production-management`)
      .set('authorization', `Bearer ${SESSION_TOKEN}`)
      .send({});

    expect(continuity.status).not.toBe(404);
    expect(management.status).not.toBe(404);
  });
});
