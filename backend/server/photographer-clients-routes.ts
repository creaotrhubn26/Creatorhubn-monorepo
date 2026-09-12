import express from "express";
import type { Pool } from "pg";

export interface PhotographerClientsRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireUserSession: (req: any, res: any) => any;
}

export function setupPhotographerClientsRoutes(
  deps: PhotographerClientsRoutesDeps,
): void {
  const { app, pool, requireUserSession } = deps;

  // Liste alle klienter for fotograf, med count-aggregeringer.
  app.get("/api/photographer/clients", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const photographerId = session.userId;

    try {
      const result = await pool.query(
        `SELECT
           c.id, c.email, c.first_name, c.last_name, c.phone,
           c.address, c.city, c.postal_code, c.notes,
           c.created_at, c.updated_at,
           COALESCE(g.gallery_count, 0)::int     AS gallery_count,
           COALESCE(po.order_count, 0)::int      AS order_count,
           COALESCE(po.total_spent, 0)::numeric  AS total_spent,
           COALESCE(ct.contract_count, 0)::int   AS contract_count,
           GREATEST(
             c.updated_at,
             COALESCE(g.last_gallery_at,  c.created_at),
             COALESCE(po.last_order_at,   c.created_at),
             COALESCE(ct.last_contract_at, c.created_at)
           ) AS last_activity_at
         FROM clients c
         LEFT JOIN (
           SELECT canonical_client_id,
                  COUNT(*)        AS gallery_count,
                  MAX(created_at) AS last_gallery_at
             FROM photographer_client_galleries
            WHERE canonical_client_id IS NOT NULL
            GROUP BY canonical_client_id
         ) g ON g.canonical_client_id = c.id
         LEFT JOIN (
           SELECT canonical_client_id,
                  COUNT(*)              AS order_count,
                  COALESCE(SUM(total_amount), 0) AS total_spent,
                  MAX(created_at)       AS last_order_at
             FROM print_orders
            WHERE canonical_client_id IS NOT NULL
              AND payment_status = 'paid'
            GROUP BY canonical_client_id
         ) po ON po.canonical_client_id = c.id
         LEFT JOIN (
           SELECT canonical_client_id,
                  COUNT(*)        AS contract_count,
                  MAX(created_at) AS last_contract_at
             FROM contracts
            WHERE canonical_client_id IS NOT NULL
            GROUP BY canonical_client_id
         ) ct ON ct.canonical_client_id = c.id
         WHERE c.photographer_id = $1
         ORDER BY last_activity_at DESC NULLS LAST`,
        [photographerId],
      );

      res.json({
        clients: result.rows.map((r: Record<string, unknown>) => ({
          id: r.id,
          email: r.email,
          firstName: r.first_name ?? "",
          lastName: r.last_name ?? "",
          displayName:
            [r.first_name, r.last_name].filter(Boolean).join(" ") ||
            (r.email as string),
          phone: r.phone ?? null,
          address: r.address ?? null,
          city: r.city ?? null,
          postalCode: r.postal_code ?? null,
          notes: r.notes ?? null,
          galleryCount: Number(r.gallery_count ?? 0),
          orderCount: Number(r.order_count ?? 0),
          totalSpent: Number(r.total_spent ?? 0),
          contractCount: Number(r.contract_count ?? 0),
          lastActivityAt: r.last_activity_at,
          createdAt: r.created_at,
        })),
      });
    } catch (err) {
      // Schema-drift på joined tables (photographer_client_galleries / print_orders /
      // contracts) skal ikke krasje CRM-listen. Returner tom-shape i stedet for 500.
      console.warn("[crm] list clients degraded:", (err as any)?.message || err);
      res.json({ clients: [] });
    }
  });

  app.post("/api/photographer/clients", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const photographerId = session.userId;
    const {
      firstName,
      lastName,
      email,
      phone,
      city,
      address,
      postalCode,
      notes,
    } = req.body ?? {};

    const trimmedEmail =
      typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!trimmedEmail)
      return res.status(400).json({ error: "email_required" });

    try {
      const result = await pool.query(
        `INSERT INTO clients
           (photographer_id, email, first_name, last_name, phone, address, city, postal_code, notes,
            created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
         ON CONFLICT (photographer_id, email) DO UPDATE SET
           first_name  = COALESCE(NULLIF(EXCLUDED.first_name,  ''), clients.first_name),
           last_name   = COALESCE(NULLIF(EXCLUDED.last_name,   ''), clients.last_name),
           phone       = COALESCE(EXCLUDED.phone,       clients.phone),
           address     = COALESCE(EXCLUDED.address,     clients.address),
           city        = COALESCE(EXCLUDED.city,        clients.city),
           postal_code = COALESCE(EXCLUDED.postal_code, clients.postal_code),
           notes       = COALESCE(EXCLUDED.notes,       clients.notes),
           updated_at  = NOW()
         RETURNING id, (xmax = 0) AS was_inserted`,
        [
          photographerId,
          trimmedEmail,
          typeof firstName === "string" ? firstName.trim() : "",
          typeof lastName === "string" ? lastName.trim() : "",
          typeof phone === "string" && phone.trim() ? phone.trim() : null,
          typeof address === "string" && address.trim()
            ? address.trim()
            : null,
          typeof city === "string" && city.trim() ? city.trim() : null,
          typeof postalCode === "string" && postalCode.trim()
            ? postalCode.trim()
            : null,
          typeof notes === "string" && notes.trim() ? notes.trim() : null,
        ],
      );
      const id = result.rows[0]?.id as string;
      const wasInserted = result.rows[0]?.was_inserted === true;
      res.status(201).json({ id });

      if (wasInserted) {
        void (async () => {
          try {
            const { fireWorkflowTrigger } = await import(
              "./workflow-triggers.js"
            );
            await fireWorkflowTrigger({
              pool,
              eventType: "client.created",
              userId: photographerId,
              payload: {
                client_id: id,
                client_email: trimmedEmail,
                client_name:
                  `${(firstName || "").trim()} ${(lastName || "").trim()}`.trim() ||
                  null,
                city: city || null,
              },
            });
          } catch (e: any) {
            console.warn(
              "[workflow-triggers] client.created fire failed:",
              e.message,
            );
          }
        })();
      }
    } catch (err) {
      console.error("[crm] create client failed:", err);
      res.status(500).json({ error: "create_client_failed" });
    }
  });

  app.get("/api/photographer/clients/:clientId", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const photographerId = session.userId;
    const clientId = String(req.params.clientId || "").trim();
    if (!clientId)
      return res.status(400).json({ error: "missing_client_id" });

    try {
      const clientRow = await pool.query(
        `SELECT id, email, first_name, last_name, phone, address, city,
                postal_code, notes, preferences,
                COALESCE(customer_type, 'person') AS customer_type,
                organization_number,
                created_at, updated_at
           FROM clients
          WHERE id = $1 AND photographer_id = $2
          LIMIT 1`,
        [clientId, photographerId],
      );
      if (clientRow.rows.length === 0) {
        return res.status(404).json({ error: "client_not_found" });
      }
      const c = clientRow.rows[0] as Record<string, unknown>;

      const [galleries, orders, contracts, messages] = await Promise.all([
        pool
          .query(
            `SELECT id, project_title, access_token, status,
                    gallery_settings, created_at, completed_at
               FROM photographer_client_galleries
              WHERE canonical_client_id = $1 AND photographer_id = $2
              ORDER BY created_at DESC`,
            [clientId, photographerId],
          )
          .catch(() => ({ rows: [] as Record<string, unknown>[] })),
        pool
          .query(
            `SELECT id, gallery_id, total_amount, currency, payment_status,
                    fulfillment_status, created_at
               FROM print_orders
              WHERE canonical_client_id = $1 AND photographer_id = $2
              ORDER BY created_at DESC`,
            [clientId, photographerId],
          )
          .catch(() => ({ rows: [] as Record<string, unknown>[] })),
        pool
          .query(
            `SELECT id, title, status, contract_value, currency,
                    signed_at, created_at
               FROM contracts
              WHERE canonical_client_id = $1 AND user_id = $2
              ORDER BY created_at DESC`,
            [clientId, photographerId],
          )
          .catch(() => ({
            rows: [] as Record<string, unknown>[],
          })),
        pool
          .query(
            `SELECT cc.id, cc.communication_type, cc.direction, cc.subject,
                    cc.content, cc.from_email, cc.to_email, cc.created_at
               FROM client_communications cc
              WHERE cc.user_id = $1
                AND (cc.from_email = $2 OR cc.to_email = $2)
              ORDER BY cc.created_at DESC
              LIMIT 50`,
            [photographerId, c.email],
          )
          .catch(() => ({
            rows: [] as Record<string, unknown>[],
          })),
      ]);

      res.json({
        client: {
          id: c.id,
          email: c.email,
          firstName: c.first_name ?? "",
          lastName: c.last_name ?? "",
          displayName:
            [c.first_name, c.last_name].filter(Boolean).join(" ") ||
            (c.email as string),
          phone: c.phone ?? null,
          address: c.address ?? null,
          city: c.city ?? null,
          postalCode: c.postal_code ?? null,
          notes: c.notes ?? null,
          preferences: c.preferences ?? null,
          customerType: (c.customer_type ?? 'person') as 'person' | 'company',
          organizationNumber: c.organization_number ?? null,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
        },
        galleries: galleries.rows.map((r: Record<string, unknown>) => ({
          id: r.id,
          projectTitle: r.project_title,
          accessToken: r.access_token,
          status: r.status,
          gallerySettings: r.gallery_settings ?? {},
          createdAt: r.created_at,
          completedAt: r.completed_at,
        })),
        orders: orders.rows.map((r: Record<string, unknown>) => ({
          id: r.id,
          galleryId: r.gallery_id,
          totalAmount: Number(r.total_amount ?? 0),
          currency: r.currency ?? "NOK",
          paymentStatus: r.payment_status,
          fulfillmentStatus: r.fulfillment_status,
          createdAt: r.created_at,
        })),
        contracts: contracts.rows.map((r: Record<string, unknown>) => ({
          id: r.id,
          title: r.title,
          status: r.status,
          contractValue:
            r.contract_value != null ? Number(r.contract_value) : null,
          currency: r.currency ?? "NOK",
          signedAt: r.signed_at,
          createdAt: r.created_at,
        })),
        messages: messages.rows.map((r: Record<string, unknown>) => ({
          id: r.id,
          type: r.communication_type,
          direction: r.direction,
          subject: r.subject ?? "",
          content: r.content,
          fromEmail: r.from_email ?? null,
          toEmail: r.to_email ?? null,
          createdAt: r.created_at,
        })),
      });
    } catch (err) {
      console.error("[crm] get client failed:", err);
      res.status(500).json({ error: "get_client_failed" });
    }
  });

  app.patch("/api/photographer/clients/:clientId", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const photographerId = session.userId;
    const clientId = String(req.params.clientId || "").trim();
    if (!clientId)
      return res.status(400).json({ error: "missing_client_id" });

    const {
      firstName,
      lastName,
      phone,
      address,
      city,
      postalCode,
      notes,
      customerType,
      organizationNumber,
    } = req.body ?? {};

    // Valider customer_type — eneste lovlige verdier er 'person' og 'company'.
    const validCustomerType =
      customerType === 'person' || customerType === 'company'
        ? customerType
        : null;

    try {
      const result = await pool.query(
        `UPDATE clients
            SET first_name         = COALESCE($1, first_name),
                last_name          = COALESCE($2, last_name),
                phone              = COALESCE($3, phone),
                address            = COALESCE($4, address),
                city               = COALESCE($5, city),
                postal_code        = COALESCE($6, postal_code),
                notes              = COALESCE($7, notes),
                customer_type      = COALESCE($8, customer_type),
                organization_number = COALESCE($9, organization_number),
                updated_at         = NOW()
          WHERE id = $10 AND photographer_id = $11`,
        [
          firstName ?? null,
          lastName ?? null,
          phone ?? null,
          address ?? null,
          city ?? null,
          postalCode ?? null,
          notes ?? null,
          validCustomerType,
          typeof organizationNumber === 'string' ? organizationNumber : null,
          clientId,
          photographerId,
        ],
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: "client_not_found" });
      }
      res.json({ success: true });
    } catch (err) {
      console.error("[crm] update client failed:", err);
      res.status(500).json({ error: "update_client_failed" });
    }
  });
}
