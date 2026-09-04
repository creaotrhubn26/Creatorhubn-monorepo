import type { Pool, PoolClient } from "pg";

type OutboxEvent = {
  organizationId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  recipientUserId?: string | null;
  actorUserId?: string | null;
  title: string;
  body: string;
  deepLink?: string | null;
  metadata?: Record<string, unknown>;
};

export async function enqueueSalesManagementEvent(
  client: PoolClient,
  event: OutboxEvent,
): Promise<void> {
  await client.query(
    `INSERT INTO leadgrid_sales_management_outbox
       (organization_id, event_type, aggregate_type, aggregate_id, payload)
     VALUES ($1::uuid, $2, $3, $4, $5::jsonb)
     ON CONFLICT (organization_id, event_type, aggregate_type, aggregate_id)
     DO NOTHING`,
    [
      event.organizationId,
      event.eventType.slice(0, 80),
      event.aggregateType.slice(0, 40),
      event.aggregateId.slice(0, 255),
      JSON.stringify({
        recipientUserId: event.recipientUserId ?? null,
        actorUserId: event.actorUserId ?? null,
        title: event.title,
        body: event.body,
        deepLink: event.deepLink ?? null,
        metadata: event.metadata ?? {},
      }),
    ],
  );
}

type ClaimedRow = {
  id: string;
  organization_id: string;
  event_type: string;
  payload: Record<string, unknown>;
};

/**
 * Drains a small outbox batch. `source_event_id` makes notification creation
 * replay-safe if the process stops between delivery and outbox acknowledgement.
 */
export async function drainSalesManagementOutbox(pool: Pool): Promise<number> {
  const client = await pool.connect();
  let events: ClaimedRow[] = [];
  try {
    await client.query("BEGIN");
    const claimed = await client.query<ClaimedRow>(
      `SELECT id::text, organization_id::text, event_type, payload
         FROM leadgrid_sales_management_outbox
        WHERE (
          (status IN ('pending','failed') AND next_attempt_at <= NOW())
          OR (status = 'processing' AND updated_at < NOW() - INTERVAL '5 minutes')
        )
        ORDER BY created_at
        FOR UPDATE SKIP LOCKED
        LIMIT 20`,
    );
    events = claimed.rows;
    if (events.length > 0) {
      await client.query(
        `UPDATE leadgrid_sales_management_outbox
            SET status = 'processing', attempts = attempts + 1, updated_at = NOW()
          WHERE id = ANY($1::uuid[])`,
        [events.map((event) => event.id)],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  for (const event of events) {
    const payload = event.payload ?? {};
    const recipient = typeof payload.recipientUserId === "string"
      ? payload.recipientUserId
      : null;
    try {
      if (recipient) {
        await pool.query(
          `INSERT INTO notification_events
             (recipient_user_id, organization_id, event_type, title, body,
              triggered_by_user_id, deep_link, meta, email_sent, source_event_id)
           VALUES ($1, $2::uuid, $3, $4, $5, $6, $7, $8::jsonb, FALSE, $9::uuid)
           ON CONFLICT (source_event_id) DO NOTHING`,
          [
            recipient,
            event.organization_id,
            event.event_type.slice(0, 40),
            String(payload.title ?? "Leadgrid-oppdatering").slice(0, 255),
            String(payload.body ?? "").slice(0, 2000),
            typeof payload.actorUserId === "string" ? payload.actorUserId : null,
            typeof payload.deepLink === "string" ? payload.deepLink : null,
            JSON.stringify(payload.metadata ?? {}),
            event.id,
          ],
        );
      }
      await pool.query(
        `UPDATE leadgrid_sales_management_outbox
            SET status = 'delivered', delivered_at = NOW(), last_error = NULL, updated_at = NOW()
          WHERE id = $1::uuid`,
        [event.id],
      );
    } catch (error) {
      await pool.query(
        `UPDATE leadgrid_sales_management_outbox
            SET status = 'failed',
                last_error = $2,
                next_attempt_at = NOW() + make_interval(secs => LEAST(3600, 15 * (2 ^ LEAST(attempts, 8)))),
                updated_at = NOW()
          WHERE id = $1::uuid`,
        [event.id, error instanceof Error ? error.message.slice(0, 2000) : "delivery_failed"],
      ).catch(() => undefined);
    }
  }
  return events.length;
}

export function startSalesManagementOutboxWorker(pool: Pool): () => void {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await drainSalesManagementOutbox(pool);
    } catch (error) {
      console.warn("[leadgrid-sales-management] outbox drain failed", error);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => { void tick(); }, 30_000);
  timer.unref?.();
  void tick();
  return () => clearInterval(timer);
}
