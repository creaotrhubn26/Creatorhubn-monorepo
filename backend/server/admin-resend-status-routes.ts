/**
 * admin-resend-status-routes.ts
 *
 * Health-status for Resend (transactional email-provider).
 * Spør Resend API om domains, API-keys og siste sending-status.
 *
 * Endpoint: GET /api/admin-room/resend/status
 *
 * Returnerer: { healthy, apiConfigured, domainCount, verifiedDomainCount,
 *   lastErrorMessage, lastSendCheckedAt, recentEmails }
 */

import type { AdminRoomRoutesDeps } from "./_shared";

interface ResendDomain {
  id: string;
  name: string;
  status: string;       // 'verified' | 'pending' | 'failed'
  created_at: string;
}

interface ResendStatusResponse {
  healthy: boolean;
  apiConfigured: boolean;
  domainCount: number;
  verifiedDomainCount: number;
  domains: ResendDomain[];
  lastErrorMessage: string | null;
  lastSendCheckedAt: string;
  recentEmails: {
    id: string;
    to: string;
    subject: string;
    status: string;
    sentAt: string;
  }[];
}

export function setupAdminResendStatusRoutes(deps: AdminRoomRoutesDeps): void {
  const { app, pool, requireAdminRoomAccess } = deps;

  app.get("/api/admin-room/resend/status", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;

    // Samme fallback-pattern som transactional-email-service og
    // resend-admin-routes: ROLE_ROOM_RESEND_API_KEY er primær (det Daniel
    // har satt i Render); RESEND_API_KEY er sekundær fallback. Uten denne
    // dual-check rapporterte status-routen «ikke konfigurert» feilaktig.
    const apiKey = (process.env.ROLE_ROOM_RESEND_API_KEY?.trim() || '')
      || (process.env.RESEND_API_KEY?.trim() || '');
    const now = new Date().toISOString();

    if (!apiKey) {
      const fallback: ResendStatusResponse = {
        healthy: false,
        apiConfigured: false,
        domainCount: 0,
        verifiedDomainCount: 0,
        domains: [],
        lastErrorMessage: "Verken ROLE_ROOM_RESEND_API_KEY eller RESEND_API_KEY er satt",
        lastSendCheckedAt: now,
        recentEmails: [],
      };
      return res.json(fallback);
    }

    try {
      // 1. Domains
      const dRes = await fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(8000),
      });

      if (!dRes.ok) {
        const fallback: ResendStatusResponse = {
          healthy: false,
          apiConfigured: true,
          domainCount: 0,
          verifiedDomainCount: 0,
          domains: [],
          lastErrorMessage: `Resend API returnerte ${dRes.status}`,
          lastSendCheckedAt: now,
          recentEmails: [],
        };
        return res.json(fallback);
      }

      const dJson = await dRes.json() as { data?: ResendDomain[] };
      const domains = dJson.data ?? [];
      const verified = domains.filter((d) => d.status === "verified");

      // 2. Siste 20 emails fra vår egen log (hvis tabellen finnes)
      let recentEmails: ResendStatusResponse["recentEmails"] = [];
      try {
        const eRes = await pool.query<{
          id: string;
          recipient: string;
          subject: string | null;
          status: string;
          created_at: string;
        }>(
          `SELECT id::text, recipient,
                  COALESCE(metadata->>'subject', '—') AS subject,
                  status, created_at::text
             FROM resend_email_log
             ORDER BY created_at DESC
             LIMIT 20`,
        );
        recentEmails = eRes.rows.map((r) => ({
          id: r.id,
          to: r.recipient,
          subject: r.subject ?? "—",
          status: r.status,
          sentAt: r.created_at,
        }));
      } catch {
        // resend_email_log finnes ikke i alle env — skip.
      }

      const response: ResendStatusResponse = {
        healthy: verified.length > 0,
        apiConfigured: true,
        domainCount: domains.length,
        verifiedDomainCount: verified.length,
        domains,
        lastErrorMessage: null,
        lastSendCheckedAt: now,
        recentEmails,
      };
      return res.json(response);
    } catch (err) {
      console.error("[resend-status] error", err);
      const fallback: ResendStatusResponse = {
        healthy: false,
        apiConfigured: true,
        domainCount: 0,
        verifiedDomainCount: 0,
        domains: [],
        lastErrorMessage: String(err).slice(0, 300),
        lastSendCheckedAt: now,
        recentEmails: [],
      };
      return res.json(fallback);
    }
  });
}
