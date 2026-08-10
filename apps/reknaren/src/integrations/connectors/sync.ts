/**
 * Connector-synk: kjører en (eller alle) koblede connectorer, fører nye poster
 * inn som bilag i innboksen — idempotent på ekstern id — og oppdaterer synk-
 * markøren. Bokfører ALDRI; menneskelig godkjenning skjer i innboksen som ellers.
 */
import type { Actor } from '../../audit/audit.js';
import { recordAuditEvent } from '../../audit/audit.js';
import type { Db } from '../../db/pool.js';
import { withTransaction } from '../../db/pool.js';
import { registerDocument, storeExtraction } from '../../documents/service.js';
import type { ExtractedData } from '../../documents/types.js';
import type { ObjectStorage } from '../../storage/port.js';
import { NotFoundError, ValidationError } from '../../shared/errors.js';
import { newId } from '../../shared/ids.js';
import type { SourceConnector } from './port.js';

export interface ConnectorDeps {
  db: Db;
  storage?: ObjectStorage | undefined;
  registry: Record<string, SourceConnector>;
}

export interface ConnectorStatus {
  id: string;
  label: string;
  description: string;
  configured: boolean;
  connected: boolean;
  lastSyncAt: string | null;
}

export async function listConnectorStatus(deps: ConnectorDeps, organizationId: string): Promise<ConnectorStatus[]> {
  const conns = (
    await deps.db.query(
      `SELECT connector_id, status, last_sync_at FROM connector_connections WHERE organization_id = $1`,
      [organizationId],
    )
  ).rows;
  const byId = new Map(conns.map((c) => [c.connector_id as string, c]));
  return Object.values(deps.registry).map((c) => {
    const row = byId.get(c.id);
    return {
      id: c.id,
      label: c.label,
      description: c.description,
      configured: c.configured(),
      connected: Boolean(row && row.status === 'active'),
      lastSyncAt: row?.last_sync_at ? new Date(row.last_sync_at).toISOString() : null,
    };
  });
}

export async function connectConnector(
  deps: ConnectorDeps,
  params: { organizationId: string; actor: Actor; connectorId: string; config?: Record<string, unknown> },
): Promise<void> {
  const connector = deps.registry[params.connectorId];
  if (!connector) throw new NotFoundError('Ukjent connector.');
  await deps.db.query(
    `INSERT INTO connector_connections (id, organization_id, connector_id, config, status, created_by)
     VALUES ($1,$2,$3,$4,'active',$5)
     ON CONFLICT (organization_id, connector_id)
     DO UPDATE SET status='active', config=EXCLUDED.config, updated_at=now()`,
    [newId(), params.organizationId, params.connectorId, JSON.stringify(params.config ?? {}), params.actor.userId],
  );
  await withTransaction(deps.db, (client) => recordAuditEvent(client, {
    organizationId: params.organizationId,
    actor: params.actor,
    action: 'connector.connected',
    entityType: 'connector_connection',
    newValue: { connectorId: params.connectorId },
  }));
}

export async function disconnectConnector(
  deps: ConnectorDeps,
  params: { organizationId: string; actor: Actor; connectorId: string },
): Promise<void> {
  const res = await deps.db.query(
    `UPDATE connector_connections SET status='disconnected', updated_at=now()
     WHERE organization_id = $1 AND connector_id = $2 AND status='active'`,
    [params.organizationId, params.connectorId],
  );
  if ((res.rowCount ?? 0) === 0) throw new NotFoundError('Connectoren er ikke koblet på.');
  await withTransaction(deps.db, (client) => recordAuditEvent(client, {
    organizationId: params.organizationId,
    actor: params.actor,
    action: 'connector.disconnected',
    entityType: 'connector_connection',
    newValue: { connectorId: params.connectorId },
  }));
}

export interface SyncResult {
  connectorId: string;
  imported: number;
  skipped: number;
  cursor: string | null;
}

export async function syncConnector(
  deps: ConnectorDeps,
  params: { organizationId: string; actor: Actor; connectorId: string },
): Promise<SyncResult> {
  const connector = deps.registry[params.connectorId];
  if (!connector) throw new NotFoundError('Ukjent connector.');
  if (!connector.configured()) throw new ValidationError('Connectoren er ikke konfigurert (mangler legitimasjon).');

  const conn = (
    await deps.db.query(
      `SELECT cursor FROM connector_connections WHERE organization_id = $1 AND connector_id = $2 AND status='active'`,
      [params.organizationId, params.connectorId],
    )
  ).rows[0];
  if (!conn) throw new ValidationError('Connectoren er ikke koblet på.');

  const { records, nextCursor } = await connector.fetch(conn.cursor ?? null);
  let imported = 0;
  let skipped = 0;
  for (const r of records) {
    // Idempotens: har vi importert denne eksterne id-en før?
    const claim = await deps.db.query(
      `INSERT INTO connector_imports (id, organization_id, connector_id, external_id)
       VALUES ($1,$2,$3,$4) ON CONFLICT (organization_id, connector_id, external_id) DO NOTHING
       RETURNING id`,
      [newId(), params.organizationId, params.connectorId, r.externalId],
    );
    if ((claim.rowCount ?? 0) === 0) {
      skipped++;
      continue;
    }
    // Nytt bilag i innboksen (kilde 'integration') + strukturert uttrekk.
    const doc = await registerDocument(
      deps.db,
      {
        organizationId: params.organizationId,
        actor: params.actor,
        source: 'integration',
        filename: `${params.connectorId}-${r.externalId}.xml`,
        mimeType: 'application/xml',
        content: Buffer.from(r.receiptXml, 'utf8'),
      },
      deps.storage,
    );
    await storeExtraction(deps.db, {
      organizationId: params.organizationId,
      documentId: doc.id,
      actor: params.actor,
      engine: `connector:${params.connectorId}`,
      data: {
        documentType: r.documentType,
        ...(r.vendorName ? { vendorName: r.vendorName } : {}),
        invoiceDate: r.occurredAt,
        currency: r.currency,
        grossMinor: r.amountMinor,
      } as ExtractedData,
      issues: [],
    });
    await deps.db.query(`UPDATE connector_imports SET document_id = $1 WHERE organization_id = $2 AND connector_id = $3 AND external_id = $4`, [
      doc.id,
      params.organizationId,
      params.connectorId,
      r.externalId,
    ]);
    imported++;
  }

  await deps.db.query(
    `UPDATE connector_connections SET cursor = $1, last_sync_at = now(), updated_at = now()
     WHERE organization_id = $2 AND connector_id = $3`,
    [nextCursor, params.organizationId, params.connectorId],
  );
  await withTransaction(deps.db, (client) => recordAuditEvent(client, {
    organizationId: params.organizationId,
    actor: params.actor,
    action: 'connector.synced',
    entityType: 'connector_connection',
    newValue: { connectorId: params.connectorId, imported, skipped },
  }));
  return { connectorId: params.connectorId, imported, skipped, cursor: nextCursor };
}

/** Cron: synk alle aktive connectorer på tvers av virksomheter. Aktør = den som
 *  koblet på connectoren (for et gyldig kontrollspor). */
export async function syncAllConnectors(deps: ConnectorDeps): Promise<SyncResult[]> {
  const active = (
    await deps.db.query(`SELECT organization_id, connector_id, created_by FROM connector_connections WHERE status='active'`)
  ).rows;
  const out: SyncResult[] = [];
  for (const a of active) {
    const connector = deps.registry[a.connector_id as string];
    if (!connector || !connector.configured()) continue;
    try {
      out.push(
        await syncConnector(deps, {
          organizationId: a.organization_id,
          actor: { userId: a.created_by, role: 'owner' },
          connectorId: a.connector_id,
        }),
      );
    } catch {
      // Én connector-feil skal ikke stoppe de andre.
    }
  }
  return out;
}
