/**
 * Kvittering på signert avtale.
 *
 * To mottakere, to formål. Signataren får beviset: hva de signerte, når, med
 * hvilken sjekksum, og underskriften slik den så ut på skjermen. Du får
 * beskjed om at det skjedde, slik at du ikke må lete i en oversikt for å
 * oppdage at en kunde er ferdig onboardet.
 *
 * Kvitteringen inneholder ikke avtaleteksten. Den kan endres i en innboks;
 * sjekksummen kan ikke. Kunden finner den fulle teksten under «Mine avtaler»,
 * og sjekksummen i kvitteringen viser at det er samme dokument.
 */
import type { Pool } from "pg";

import { notifyAdmins } from "./admin-notify.js";
import { sendTransactionalEmail } from "./transactional-email-service.js";
import {
  PROVIDER,
  SIGNATURE_FONTS,
  markReceiptSent,
  type AgreementType,
  type SignatureStyle,
} from "./leadgrid-org-agreements.js";

export interface AgreementReceipt {
  agreementId: string;
  agreementType: AgreementType;
  documentTitle: string;
  documentVersion: string;
  documentSha256: string;
  organizationName: string;
  organizationId: string;
  signerName: string;
  signerTitle: string | null;
  signerEmail: string;
  signatureText: string;
  signatureStyle: SignatureStyle;
  signedAt: string;
}

function escape(text: string): string {
  return text.replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c,
  );
}

function norskTid(iso: string): string {
  return new Date(iso).toLocaleString("nb-NO", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Oslo",
  });
}

function kvitteringHtml(kv: AgreementReceipt): string {
  // Signaturen tegnes med samme skriftstakk som på skjermen. Slår den feil i
  // en e-postklient, faller den til kursiv — navnet er fortsatt lesbart.
  const font = SIGNATURE_FONTS[kv.signatureStyle];
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;color:#1a1a1a">
  <h2 style="margin:0 0 4px">${escape(kv.documentTitle)} er signert</h2>
  <p style="margin:0 0 24px;color:#555">
    Avtale mellom ${escape(kv.organizationName)} og ${escape(PROVIDER.legalName)},
    org.nr ${PROVIDER.orgNumber}.
  </p>
  <div style="border:1px solid #e0e0e0;border-radius:8px;padding:20px 24px">
    <div style="font-family:${font};font-size:32px;font-style:italic;line-height:1.3">
      ${escape(kv.signatureText)}
    </div>
    <div style="border-top:1px solid #ccc;margin-top:6px;padding-top:6px;font-size:13px;color:#555">
      ${escape(kv.signerName)}${kv.signerTitle ? ` · ${escape(kv.signerTitle)}` : ""}<br>
      ${escape(norskTid(kv.signedAt))}
    </div>
  </div>
  <table style="margin-top:20px;font-size:13px;color:#555;border-collapse:collapse">
    <tr><td style="padding:2px 12px 2px 0">Versjon</td><td>${escape(kv.documentVersion)}</td></tr>
    <tr><td style="padding:2px 12px 2px 0">Sjekksum</td><td style="font-family:monospace">${escape(kv.documentSha256)}</td></tr>
  </table>
  <p style="margin-top:24px;font-size:13px;color:#555">
    Du finner avtalen igjen under <strong>Mine avtaler</strong> i profilen din.
    Sjekksummen over hører til akkurat den teksten du leste — stemmer den, er
    dokumentet uendret.
  </p>
</div>`;
}

function kvitteringTekst(kv: AgreementReceipt): string {
  return [
    `${kv.documentTitle} er signert`,
    "",
    `Avtale mellom ${kv.organizationName} og ${PROVIDER.legalName}, org.nr ${PROVIDER.orgNumber}.`,
    "",
    `Signert av: ${kv.signerName}${kv.signerTitle ? ` (${kv.signerTitle})` : ""}`,
    `Tidspunkt:  ${norskTid(kv.signedAt)}`,
    `Versjon:    ${kv.documentVersion}`,
    `Sjekksum:   ${kv.documentSha256}`,
    "",
    "Du finner avtalen igjen under «Mine avtaler» i profilen din.",
  ].join("\n");
}

/**
 * Sender kvittering til signataren og varsel til super admin.
 *
 * Kaster aldri. En avtale er signert i det øyeblikket raden er skrevet — at
 * e-posten feiler skal ikke gjøre signeringen om til en feilmelding foran
 * kunden. Uteblitt kvittering synes som `receipt_sent_at IS NULL`.
 */
export async function sendAgreementReceipt(
  pool: Pool,
  kv: AgreementReceipt,
): Promise<{ sent: boolean }> {
  let sent = false;
  try {
    const resultat = await sendTransactionalEmail({
      to: kv.signerEmail,
      subject: `Kvittering: ${kv.documentTitle} signert — ${kv.organizationName}`,
      html: kvitteringHtml(kv),
      text: kvitteringTekst(kv),
      fromLabel: PROVIDER.legalName,
      kind: "leadgrid_agreement_receipt",
      pool,
    });
    sent = resultat.sent;
    if (sent) await markReceiptSent(pool, kv.agreementId);
    else console.warn("[avtaler] kvittering ikke sendt:", resultat.reason);
  } catch (error) {
    console.warn("[avtaler] kvittering feilet:", (error as Error).message);
  }

  try {
    await notifyAdmins(pool, {
      type: "leadgrid_agreement_signed",
      source: "Leadgrid · avtalesignering",
      title: `${kv.documentTitle} signert: ${kv.organizationName}`,
      summary:
        `${kv.signerName}${kv.signerTitle ? ` (${kv.signerTitle})` : ""}` +
        ` · ${norskTid(kv.signedAt)} · versjon ${kv.documentVersion}` +
        `${sent ? "" : " · KVITTERING IKKE SENDT"}`,
      link: `/superadmin?org=${kv.organizationId}`,
      contactName: kv.signerName,
      contactEmail: kv.signerEmail,
    });
  } catch (error) {
    console.warn("[avtaler] adminvarsel feilet:", (error as Error).message);
  }

  return { sent };
}
