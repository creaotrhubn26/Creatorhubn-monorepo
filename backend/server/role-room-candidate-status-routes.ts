/**
 * role-room-candidate-status-routes.ts
 *
 * Dedikert endepunkt for å oppdatere casting_candidates.status med
 * automatisk callback til byrå når kandidaten kom via partnership
 * talent-foreslåelse (metadata.source === 'partnership_talent_proposal').
 *
 * Hvorfor egen vei: frontend sin saveCandidate-flyt lagrer prosjektet
 * i compat-store (kv-blob), ikke i den relasjonelle casting_candidates-
 * tabellen. Den auto-opprettede candidate-raden (Phase 9) lever i
 * casting_candidates direkte og må oppdateres separat for å holde
 * statusen synkron med produksjons-UI-en.
 *
 * Endpoints:
 *   PATCH /api/role-room/candidates/:candidateId/status { status, notes? }
 */

import type express from "express";
import type { Pool } from "pg";

interface SessionLike {
  userId: string;
  email?: string;
}

export interface RoleRoomCandidateStatusRoutesDeps {
  app: express.Application;
  pool: Pool;
  getActiveSession: (req: express.Request) => SessionLike | null;
}

const ALLOWED_STATUSES = new Set([
  "pending",
  "screening",
  "callback",
  "callbacks",
  "final",
  "cast",
  "selected",
  "declined",
  "withdrawn",
  "hold",
  "passed",
]);

/** Lesbar norsk label for status — brukes i e-post-emne og audit. */
/**
 * Mapper Kanban-status → self-tape-submission-status.
 * - 'pending'   → null (ingen propagasjon — submission beholder status)
 * - 'requested' → null (allerede 'submitted' eller 'viewed')
 * - 'shortlist' → 'shortlisted'
 * - 'selected' / 'confirmed' → 'shortlisted' (positiv mot talenten)
 * - 'rejected' → 'passed'
 */
function mapKanbanToSubmissionStatus(kanbanStatus: string): string | null {
  switch (kanbanStatus) {
    case "shortlist":
    case "selected":
    case "confirmed":
      return "shortlisted";
    case "rejected":
      return "passed";
    default:
      return null;
  }
}

function statusLabel(status: string): string {
  const m: Record<string, string> = {
    pending: "Avventer",
    screening: "Screening",
    callback: "Callback",
    callbacks: "Callback",
    final: "Final selection",
    cast: "Castet",
    selected: "Valgt",
    declined: "Ikke valgt",
    withdrawn: "Trukket",
    hold: "På hold",
    passed: "Passet på",
  };
  return m[status] ?? status;
}

export function setupRoleRoomCandidateStatusRoutes(deps: RoleRoomCandidateStatusRoutesDeps): void {
  const { app, pool, getActiveSession } = deps;

  app.patch("/api/role-room/candidates/:candidateId/status", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const { status, notes } = (req.body || {}) as { status?: string; notes?: string };
    if (!status || !ALLOWED_STATUSES.has(status)) {
      return res.status(400).json({
        error: `status må være en av: ${Array.from(ALLOWED_STATUSES).join(", ")}`,
      });
    }

    try {
      // Hent kandidat + verifiser at innlogget bruker eier prosjektet
      const cur = await pool.query(
        `SELECT cc.id, cc.project_id, cc.name, cc.status AS prev_status,
                cc.metadata, cc.talent_id::text AS talent_id,
                cp.created_by AS project_owner,
                cp.name AS project_name
           FROM casting_candidates cc
           JOIN casting_projects cp ON cp.id = cc.project_id
          WHERE cc.id = $1 LIMIT 1`,
        [req.params.candidateId],
      );
      const candidate = cur.rows[0];
      if (!candidate) return res.status(404).json({ error: "Kandidat ikke funnet" });
      if (candidate.project_owner !== session.userId) {
        return res.status(403).json({ error: "Du eier ikke prosjektet" });
      }
      if (candidate.prev_status === status) {
        return res.json({ candidate: { id: candidate.id, status }, unchanged: true });
      }

      // Oppdater status + legg til entry i metadata.status_history
      const existingMeta = (candidate.metadata as Record<string, unknown>) || {};
      const history = Array.isArray(existingMeta.status_history)
        ? (existingMeta.status_history as unknown[])
        : [];
      const nextMeta = {
        ...existingMeta,
        status_history: [
          ...history,
          {
            from: candidate.prev_status ?? null,
            to: status,
            at: new Date().toISOString(),
            by: session.userId,
            notes: notes ?? null,
          },
        ],
      };

      await pool.query(
        `UPDATE casting_candidates
            SET status = $1, metadata = $2::jsonb, updated_at = NOW()
          WHERE id = $3`,
        [status, JSON.stringify(nextMeta), candidate.id],
      );

      // Hvis kandidaten er fra et partnership-talent-forslag, varsle byrået
      const source = (existingMeta as { source?: string }).source;
      const isFromPartnership = source === "partnership_talent_proposal";
      let agencyNotified = false;
      if (isFromPartnership) {
        const proposalId = (existingMeta as { proposal_id?: string }).proposal_id;
        if (proposalId) {
          // Fire-and-forget e-post til byrå
          void (async () => {
            try {
              const detail = await pool.query(
                `SELECT a.name AS agency_name, a.contact_email AS agency_email,
                        prod.first_name || ' ' || prod.last_name AS production_name
                   FROM partnership_talent_proposals ptp
                   JOIN partnership_project_invitations i ON i.id = ptp.invitation_id
                   JOIN agency_production_partnerships p ON p.id = i.partnership_id
                   JOIN agency_orgs a ON a.id = p.agency_org_id
                   JOIN users prod ON prod.id = p.production_user_id
                  WHERE ptp.id = $1::uuid`,
                [proposalId],
              );
              const d = detail.rows[0];
              if (!d || !d.agency_email) return;
              const { sendCandidateStatusUpdate } = await import("./role-room-partnerships-emails");
              await sendCandidateStatusUpdate(pool, {
                candidateId: candidate.id,
                proposalId,
                talentDisplayName: candidate.name,
                projectName: candidate.project_name,
                productionName: d.production_name || "Produksjonsteam",
                previousStatus: candidate.prev_status ?? "pending",
                newStatus: status,
                productionNotes: notes ?? null,
                recipientEmail: d.agency_email,
                sentByUserId: session.userId,
              });
              agencyNotified = true;
            } catch (mailErr) {
              console.error(
                "[candidate-status] partnership-callback e-post feilet (uten å blokkere)",
                mailErr,
              );
            }
          })();

          // Audit-log i partnership_audit også
          void pool.query(
            `INSERT INTO partnership_audit
               (invitation_id, actor_user_id, action, details)
              SELECT ptp.invitation_id, $1, 'candidate_status_changed',
                     jsonb_build_object(
                       'candidate_id', $2::text,
                       'proposal_id', $3::text,
                       'from', $4::text,
                       'to', $5::text)
                FROM partnership_talent_proposals ptp
               WHERE ptp.id = $3::uuid`,
            [session.userId, candidate.id, proposalId, candidate.prev_status ?? "pending", status],
          ).catch((auditErr) => {
            console.error("[candidate-status] audit-log feilet", auditErr);
          });
        }
      }

      // Propagér til linket self-tape-submission (hvis trigger 238 har
      // koblet kandidaten ved opprettelse). Mapper Kanban-status til
      // submission-status så talent kan revoke / varsles korrekt.
      // Best-effort — feiler ikke hovedflyten.
      void (async () => {
        try {
          const submissionId = (existingMeta as { self_tape_submission_id?: string }).self_tape_submission_id
            ?? (existingMeta as { submission_id?: string }).submission_id;
          if (!submissionId) return;
          const submissionStatus = mapKanbanToSubmissionStatus(status);
          if (!submissionStatus) return;
          await pool.query(
            `UPDATE talent_selftape_submissions
                SET status = $1, status_updated_at = now()
              WHERE id = $2::uuid AND status NOT IN ('revoked')`,
            [submissionStatus, submissionId],
          );
          // Trigger varsel hvis status ble shortlisted (PATCH-endepunkt
          // varsler ikke når UPDATE skjer her — kall direkte).
          if (submissionStatus === "shortlisted") {
            const { notifySelftapeActivity } = await import(
              "./talent-selftape-notifications.js"
            );
            notifySelftapeActivity(pool, {
              submissionId,
              kind: "shortlisted",
              actorLabel: session.email ?? "Produksjon",
            }).catch((err) => console.warn("[candidate-status selftape notify]", err));
          }
        } catch (err) {
          console.warn("[candidate-status] selftape-propagation feilet", err);
        }
      })();

      return res.json({
        candidate: { id: candidate.id, status },
        agency_will_be_notified: isFromPartnership,
        previous_status: candidate.prev_status,
        new_status: status,
        status_label: statusLabel(status),
      });
    } catch (err) {
      console.error("[candidates/status PATCH] failed", err);
      return res.status(500).json({ error: "Kunne ikke oppdatere status", detail: String(err) });
    }
  });
}
