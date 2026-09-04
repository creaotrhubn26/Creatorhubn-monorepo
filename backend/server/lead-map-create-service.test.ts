import { describe, expect, it, vi } from 'vitest';
import type { Pool, PoolClient } from 'pg';

import {
  hashLeadCreationBody,
  parseLeadCreationBody,
} from './lead-map-create-contract.js';
import {
  createLeadFromPin,
  DuplicateLeadError,
  LeadCreationIdempotencyConflictError,
} from './lead-map-service.js';

const IDEMPOTENCY_KEY = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const ORGANIZATION_ID = '22222222-2222-4222-8222-222222222222';

function creationBody() {
  return parseLeadCreationBody({
    name: 'Nordic Elektro AS',
    company: 'Nordic Elektro AS',
    contact_name: 'Anders Johansen',
    contact_role: 'Daglig leder',
    organization_number: '912345678',
    website_url: 'https://www.Nordic.example/kontakt',
    google_place_id: 'places/nordic-elektro',
    phone: '+4799999999',
    email: 'post@nordic.example',
    industry_label: 'Elektro',
    employee_count_estimate: 25,
    annual_revenue_nok_estimate: 10_000_000,
    notes: 'Notat',
    lead_temperature: 'ready',
    lead_status: 'proposal_sent',
    next_follow_up_at: '2026-09-03T10:00:00Z',
    next_action: 'Følg opp tilbud',
    latitude: 59.91,
    longitude: 10.75,
    address: 'Storgata 12, 0184 Oslo',
    postal_code: '0184',
    city: 'Oslo',
    location_confidence: 'exact',
    lead_source: 'manual_form',
  });
}

type QueryResultLike = { rows: Record<string, unknown>[]; rowCount?: number };

function mockPool(
  handler: (
    sql: string,
    params?: readonly unknown[],
  ) => QueryResultLike | Promise<QueryResultLike>,
) {
  const query = vi.fn(async (sql: string, params?: readonly unknown[]) =>
    handler(sql, params),
  );
  const release = vi.fn();
  const client = { query, release } as unknown as PoolClient;
  const connect = vi.fn(async () => client);
  const pool = { connect } as unknown as Pool;
  return { pool, query, release };
}

function creationInput() {
  const body = creationBody();
  return {
    ...body,
    ownerUserId: OWNER_ID,
    organizationId: ORGANIZATION_ID,
    idempotencyKey: IDEMPOTENCY_KEY,
    requestHash: hashLeadCreationBody(body),
  };
}

describe('createLeadFromPin', () => {
  it('persisterer identiteter, tenant-scope og idempotens atomisk', async () => {
    const { pool, query, release } = mockPool((sql) => {
      if (sql.includes('INSERT INTO crm_customers')) {
        return { rows: [{ id: 'lead-1' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    await expect(createLeadFromPin(pool, creationInput())).resolves.toEqual({
      id: 'lead-1',
      created: true,
      idempotentReplay: false,
    });

    const insertCall = query.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO crm_customers'),
    );
    expect(insertCall).toBeDefined();
    const [sql, params] = insertCall as unknown as [string, unknown[]];
    for (const column of [
      'website_domain_normalized',
      'google_place_id',
      'organization_id',
      'creation_idempotency_key',
      'creation_request_hash',
    ]) {
      expect(sql).toContain(column);
    }
    expect(sql).toContain(
      'ON CONFLICT (organization_id, creation_idempotency_key)',
    );
    expect(sql).toContain(
      '$28::text, $29::uuid, $28::text',
    );
    expect(sql).toContain('NOW(), $28::text, $30');
    expect(params[12]).toBe('nordic.example');
    expect(params[14]).toBe('places/nordic-elektro');
    expect(params[28]).toBe(ORGANIZATION_ID);
    expect(params[30]).toBe(IDEMPOTENCY_KEY);
    expect(params[31]).toMatch(/^[0-9a-f]{64}$/);
    expect(query).toHaveBeenCalledWith('COMMIT');
    expect(release).toHaveBeenCalledOnce();
  });

  it('returnerer samme lead uten ny INSERT når retry bruker samme payload', async () => {
    const input = creationInput();
    const { pool, query } = mockPool((sql) => {
      if (sql.includes('SELECT id::text, creation_request_hash')) {
        return {
          rows: [
            { id: 'lead-existing', creation_request_hash: input.requestHash },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    await expect(createLeadFromPin(pool, input)).resolves.toEqual({
      id: 'lead-existing',
      created: false,
      idempotentReplay: true,
    });
    expect(
      query.mock.calls.some(([sql]) =>
        String(sql).includes('INSERT INTO crm_customers'),
      ),
    ).toBe(false);
  });

  it('prioriterer replay når parallell request fullfører mens identitetslåsen ventes på', async () => {
    const input = creationInput();
    let idempotencyLookups = 0;
    const { pool, query } = mockPool((sql) => {
      if (sql.includes('SELECT id::text, creation_request_hash')) {
        idempotencyLookups += 1;
        return idempotencyLookups === 1
          ? { rows: [], rowCount: 0 }
          : {
              rows: [
                { id: 'lead-race', creation_request_hash: input.requestHash },
              ],
              rowCount: 1,
            };
      }
      return { rows: [], rowCount: 0 };
    });

    await expect(createLeadFromPin(pool, input)).resolves.toEqual({
      id: 'lead-race',
      created: false,
      idempotentReplay: true,
    });
    expect(idempotencyLookups).toBe(2);
    expect(
      query.mock.calls.some(([sql]) =>
        String(sql).includes('INSERT INTO crm_customers'),
      ),
    ).toBe(false);
    expect(
      query.mock.calls.some(([sql]) =>
        String(sql).includes('AS organization_number_match'),
      ),
    ).toBe(false);
  });

  it('avviser samme nøkkel med endret payload', async () => {
    const { pool, query } = mockPool((sql) => {
      if (sql.includes('SELECT id::text, creation_request_hash')) {
        return {
          rows: [{ id: 'lead-existing', creation_request_hash: 'annen-hash' }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    await expect(
      createLeadFromPin(pool, creationInput()),
    ).rejects.toBeInstanceOf(LeadCreationIdempotencyConflictError);
    expect(query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('finner naturlig duplikat bare innenfor samme workspace', async () => {
    const { pool, query } = mockPool((sql, params) => {
      if (sql.includes('SELECT id::text, creation_request_hash')) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes('AS organization_number_match')) {
        expect(params?.[0]).toBe(ORGANIZATION_ID);
        return {
          rows: [
            {
              id: 'lead-duplicate',
              organization_number_match: true,
              google_place_id_match: false,
              website_domain_match: true,
              email_match: true,
              phone_match: true,
              geographic_proximity_match: true,
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    try {
      await createLeadFromPin(pool, creationInput());
      throw new Error('forventet DuplicateLeadError');
    } catch (error) {
      expect(error).toBeInstanceOf(DuplicateLeadError);
      expect((error as DuplicateLeadError).existingLeadId).toBe(
        'lead-duplicate',
      );
      expect((error as DuplicateLeadError).matchedFields).toEqual([
        'organization_number',
        'website_domain',
        'email',
        'phone',
        'geographic_proximity',
      ]);
    }
    const duplicateQuery = query.mock.calls.find(([sql]) =>
      String(sql).includes('AS geographic_proximity_match'),
    );
    expect(duplicateQuery).toBeDefined();
    const [duplicateSql, duplicateParams] = duplicateQuery as unknown as [
      string,
      unknown[],
    ];
    expect(duplicateSql).toContain('organization_id = $1::uuid');
    expect(duplicateSql).toContain('email_normalized = $5::text');
    expect(duplicateSql).toContain('phone_normalized = $6::text');
    expect(duplicateSql).toContain('<= 25.0');
    expect(duplicateParams[4]).toBe('post@nordic.example');
    expect(duplicateParams[5]).toBe('+4799999999');
    expect(duplicateParams[6]).toBe(true);
    expect(
      query.mock.calls.some(([_sql, params]) =>
        Array.isArray(params)
        && params[0] === `leadgrid:${ORGANIZATION_ID}:geographic_proximity`
      ),
    ).toBe(true);
    expect(query).toHaveBeenCalledWith('ROLLBACK');
  });
});
