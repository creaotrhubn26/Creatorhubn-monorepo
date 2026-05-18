/**
 * wedding-assistant-subcontract.ts
 *
 * Slice 9X.46 — Sub-kontrakt-generering + signering for assistent.
 *
 * Pragmatisk e-sign-flyt:
 *   1. Når Stine inviterer (9X.44) bygger vi terms-snapshot
 *   2. Assistent ser kontraktstekst i accept-siden
 *   3. Accept = elektronisk signering — vi lagrer timestamp, navn, IP
 *      (og frivillig 4 siste fødselsnr-sifre)
 *
 * Norske standardvilkår basert på Fotografforbundets veileding for
 * sub-fotograferings-avtaler:
 *   - Hovedfotograf eier opphavsretten til alt materiale
 *   - Assistent får portfolio-rett (vise i eget portfolio) ETTER at
 *     hovedfotograf har publisert galleriet
 *   - Sletting innen 30 dager etter ferdig levering
 *   - Kompensasjon utbetales innen 14 dager etter at brudeparet har betalt
 *
 * Endpoints:
 *   GET  /api/wedding/assistant-invite/:token/contract
 *   POST /api/wedding/assistant-invite/:token/sign
 *        { signerName, signerIdLast4? }
 */

import type express from "express";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface WeddingAssistantSubcontractDeps {
  app: express.Application;
  pool: any;
}

interface SubcontractTerms {
  // Partene
  primaryPhotographerName: string;
  primaryPhotographerEmail: string | null;
  primaryPhotographerOrgNumber: string | null;
  assistantName: string | null;
  assistantEmail: string | null;
  // Oppdraget
  coupleName: string | null;
  weddingDate: string | null;
  role: string;
  // Kompensasjon
  compensationType: string;
  compensationValue: number | null;
  sharePct: number | null;
  paymentTermsDays: number; // dager etter brudeparets innbetaling
  // Levering
  deliveryDeadlineDays: number; // dager etter bryllup
  deliveryMethod: string; // "Delt Google Drive-mappe satt opp av hovedfotograf"
  // Opphavsrett + portfolio
  primaryOwnsCopyright: boolean;
  assistantPortfolioRightAfterDelivery: boolean;
  confidentialityIncluded: boolean;
  // Misc
  governingLaw: string;
  termsVersion: string;
}

export const STANDARD_NORWEGIAN_TERMS = {
  paymentTermsDays: 14,
  deliveryDeadlineDays: 7,
  deliveryMethod: "Delt Google Drive-mappe satt opp av hovedfotograf",
  primaryOwnsCopyright: true,
  assistantPortfolioRightAfterDelivery: true,
  confidentialityIncluded: true,
  governingLaw: "Norsk lov, verneting Oslo tingrett",
  termsVersion: "2026-05",
};

export async function buildSubcontractTerms(
  pool: any,
  assistantId: string,
): Promise<SubcontractTerms | null> {
  const r = await pool.query(
    `SELECT a.*, w.couple_name, w.wedding_date,
            u.first_name AS p_first_name, u.last_name AS p_last_name,
            u.email AS p_email, u.organization_number AS p_org_no, u.company_name AS p_company
       FROM wedding_assistants a
       JOIN wedding_timelines w ON w.id = a.wedding_id
       LEFT JOIN users u ON u.id = a.primary_photographer_id
       WHERE a.id = $1 LIMIT 1`,
    [assistantId],
  );
  if (r.rowCount === 0) return null;
  const row = r.rows[0];
  const primaryName = row.p_company || [row.p_first_name, row.p_last_name].filter(Boolean).join(" ") || "Hovedfotograf";

  return {
    primaryPhotographerName: primaryName,
    primaryPhotographerEmail: row.p_email || null,
    primaryPhotographerOrgNumber: row.p_org_no || null,
    assistantName: row.assistant_name || null,
    assistantEmail: row.assistant_email || null,
    coupleName: row.couple_name || null,
    weddingDate: row.wedding_date || null,
    role: row.role,
    compensationType: row.compensation_type,
    compensationValue: row.compensation_value != null ? Number(row.compensation_value) : null,
    sharePct: row.share_pct != null ? Number(row.share_pct) : null,
    ...STANDARD_NORWEGIAN_TERMS,
  };
}

export function renderContractText(terms: SubcontractTerms): string {
  const roleLabels: Record<string, string> = {
    primary: "hovedfotograf",
    assistant: "assistent-fotograf",
    second_shooter: "second shooter",
    video: "videograf",
    misc: "annet",
  };
  const role = roleLabels[terms.role] || terms.role;
  const weddingDateNorsk = terms.weddingDate
    ? new Date(terms.weddingDate).toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" })
    : "[dato ikke satt]";

  let compStr = "";
  if (terms.compensationType === "fixed") {
    compStr = `Fast honorar på ${terms.compensationValue?.toFixed(0) ?? "[ikke satt]"} kr.`;
  } else if (terms.compensationType === "hourly") {
    compStr = `Timesats på ${terms.compensationValue?.toFixed(0) ?? "[ikke satt]"} kr per time, basert på dokumenterte arbeidstimer på bryllupsdagen.`;
  } else if (terms.compensationType === "percentage") {
    compStr = `${terms.sharePct ?? "[ikke satt]"} % av hovedfotografens netto-honorar (etter MVA og dokumenterte utlegg).`;
  }

  return [
    "AVTALE OM ASSISTENT-FOTOGRAFERING",
    "",
    "§1 Partene",
    `Oppdragsgiver (hovedfotograf): ${terms.primaryPhotographerName}${terms.primaryPhotographerOrgNumber ? ` (org.nr. ${terms.primaryPhotographerOrgNumber})` : ""}.`,
    `Oppdragstaker (${role}): ${terms.assistantName || "[navn]"} (${terms.assistantEmail || "[e-post]"}).`,
    "",
    "§2 Oppdraget",
    `Oppdragstaker skal yte foto-tjenester som ${role} ved bryllupet for ${terms.coupleName || "[brudepar]"} den ${weddingDateNorsk}.`,
    "Oppdragsgiver leder oppdraget og fastsetter timeline, lokasjoner og rekkefølge.",
    "",
    "§3 Honorar og oppgjør",
    compStr,
    `Honorar utbetales innen ${terms.paymentTermsDays} dager etter at brudeparet har betalt hovedfaktura til oppdragsgiver.`,
    "Oppdragstaker er ansvarlig for egen skatt og MVA-rapportering.",
    "",
    "§4 Levering",
    `Oppdragstaker leverer alle rå-bilder fra oppdraget til oppdragsgiver innen ${terms.deliveryDeadlineDays} dager etter bryllupsdagen.`,
    `Levering skjer via: ${terms.deliveryMethod}.`,
    "Bilder skal være kameraets originalfiler (CR3/NEF/RAW) — ikke kun JPEG.",
    "",
    "§5 Opphavsrett og bruk",
    terms.primaryOwnsCopyright
      ? "Oppdragsgiver erverver eksklusiv opphavsrett til alle bilder tatt under oppdraget mot betalt honorar (jfr. åndsverkloven § 71)."
      : "Opphavsretten deles mellom partene.",
    terms.assistantPortfolioRightAfterDelivery
      ? "Oppdragstaker har portfolio-rett: vise inntil 10 bilder i eget portfolio (nettside/sosiale medier) ETTER at oppdragsgiver har levert ferdig galleri til brudeparet. Bilder skal krediteres oppdragsgiver."
      : "Oppdragstaker har ingen portfolio-rett.",
    "",
    "§6 Konfidensialitet",
    terms.confidentialityIncluded
      ? "Partene skal behandle informasjon om brudeparet, lokasjoner, gjesteliste og kontaktinformasjon konfidensielt. Forbudt å dele eller publisere uten skriftlig samtykke fra brudeparet."
      : "Ingen særskilt konfidensialitets-bestemmelse.",
    "",
    "§7 Avlysning",
    "Ved avlysning fra oppdragstaker mindre enn 14 dager før bryllupet faller honoraret bort. Ved sykdom dokumentert med legeattest betales 50 % i kompensasjon.",
    "",
    "§8 Tvister",
    `Avtalen reguleres av ${terms.governingLaw}.`,
    "",
    `Vilkår-versjon ${terms.termsVersion}.`,
  ].join("\n");
}

async function ensureSchema(pool: any): Promise<void> {
  const cols = [
    "subcontract_terms JSONB",
    "subcontract_signed_at TIMESTAMPTZ",
    "subcontract_signer_name TEXT",
    "subcontract_signer_id_last4 TEXT",
    "subcontract_signer_ip TEXT",
  ];
  for (const col of cols) {
    await pool.query(`ALTER TABLE wedding_assistants ADD COLUMN IF NOT EXISTS ${col}`).catch(() => undefined);
  }
}

/** Kalles fra invite-flyten (9X.44) for å lagre snapshot ved opprettelse. */
export async function persistSubcontractSnapshot(pool: any, assistantId: string): Promise<void> {
  await ensureSchema(pool);
  const terms = await buildSubcontractTerms(pool, assistantId);
  if (!terms) return;
  await pool.query(
    `UPDATE wedding_assistants SET subcontract_terms = $1::jsonb, updated_at = NOW() WHERE id = $2`,
    [JSON.stringify(terms), assistantId],
  );
}

export function setupWeddingAssistantSubcontractRoutes(deps: WeddingAssistantSubcontractDeps): void {
  const { app, pool } = deps;

  // ─── GET /api/wedding/assistant-invite/:token/contract ──────
  app.get("/api/wedding/assistant-invite/:token/contract", async (req, res) => {
    try {
      await ensureSchema(pool);
      const r = await pool.query(
        `SELECT id, subcontract_terms, subcontract_signed_at, subcontract_signer_name
           FROM wedding_assistants WHERE invite_token = $1 OR id = $1 LIMIT 1`,
        [req.params.token],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "Invitasjon finnes ikke" });
      const row = r.rows[0];
      let terms = row.subcontract_terms;
      if (!terms) {
        // Generer on-the-fly hvis snapshot mangler
        terms = await buildSubcontractTerms(pool, row.id);
        if (terms) {
          await pool.query(
            `UPDATE wedding_assistants SET subcontract_terms = $1::jsonb, updated_at = NOW() WHERE id = $2`,
            [JSON.stringify(terms), row.id],
          );
        }
      }
      const text = terms ? renderContractText(terms) : "Kunne ikke generere kontraktstekst.";
      res.json({
        terms,
        contractText: text,
        signedAt: row.subcontract_signed_at,
        signedBy: row.subcontract_signer_name,
      });
    } catch (err) {
      console.error("GET /assistant-invite/:token/contract:", err);
      res.status(500).json({ error: "Kunne ikke hente kontrakt" });
    }
  });

  // ─── POST /api/wedding/assistant-invite/:token/sign ─────────
  // Brukes som del av accept-flyten: signerer + setter status='accepted'.
  app.post("/api/wedding/assistant-invite/:token/sign", async (req, res) => {
    try {
      await ensureSchema(pool);
      const { signerName, signerIdLast4 } = req.body || {};
      if (!signerName || !String(signerName).trim()) {
        return res.status(400).json({ error: "Fullt navn påkrevd for signering" });
      }
      const last4 = typeof signerIdLast4 === "string" && /^\d{4}$/.test(signerIdLast4) ? signerIdLast4 : null;
      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || null;

      const r = await pool.query(
        `UPDATE wedding_assistants
           SET subcontract_signed_at = NOW(),
               subcontract_signer_name = $1,
               subcontract_signer_id_last4 = $2,
               subcontract_signer_ip = $3,
               status = CASE WHEN status = 'invited' THEN 'accepted' ELSE status END,
               accepted_at = COALESCE(accepted_at, NOW()),
               invite_token = NULL,
               updated_at = NOW()
           WHERE invite_token = $4 AND status = 'invited'
         RETURNING id, wedding_id`,
        [String(signerName).trim().slice(0, 200), last4, ip, req.params.token],
      );
      if (r.rowCount === 0) {
        return res.status(404).json({ error: "Invitasjon finnes ikke eller er allerede signert" });
      }
      res.json({ success: true, signedAt: new Date().toISOString() });
    } catch (err) {
      console.error("POST /assistant-invite/:token/sign:", err);
      res.status(500).json({ error: "Kunne ikke signere" });
    }
  });
}
