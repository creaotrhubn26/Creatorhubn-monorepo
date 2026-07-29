/**
 * geo-visibility-digest.ts
 *
 * Ukentlig e-post-digest av GEO-synlighet. For hvert `approved` prompt-sett
 * hentes siste-kjørings-rapporten (computeReport) og oppsummeres til én e-post
 * til mottakeren (env GEO_DIGEST_EMAIL, default daniel@creatorhubn.com).
 *
 * Nøkkelverdien: engine-breakdown viser bare-modell vs søk-augmentert side om
 * side (anthropic vs anthropic-search, openai vs openai-search, perplexity), så
 * man ser om søk gir treff der det parametriske minnet ikke gjør det.
 *
 * Kalles fra POST /api/geo-visibility/cron/email-digest (x-cron-token) via en
 * egen ukentlig GitHub Actions-workflow ~2t etter probe-cronen (så kjøringene
 * er ferdige). Kaster aldri stille: feil bobler til ruten som logger + 500.
 */

import type { Pool } from "pg";
import { computeReport } from "./geo-probe-runner-service.js";
import { sendEmail } from "../casting-reminder-sender.js";

const DEFAULT_RECIPIENT = "daniel@creatorhubn.com";

function esc(s: unknown): string {
  return String(s ?? "").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c,
  );
}

export interface GeoDigestResult {
  approvedSets: number;
  recipient: string;
}

/** Bygger og sender den ukentlige GEO-digesten. */
export async function sendGeoVisibilityDigest(pool: Pool): Promise<GeoDigestResult> {
  const recipient = process.env.GEO_DIGEST_EMAIL || DEFAULT_RECIPIENT;

  const sets = await pool.query<{ id: string; name: string; workspace_owner_user_id: string }>(
    `SELECT id::text, name, workspace_owner_user_id
       FROM geo_prompt_sets WHERE status = 'approved'
      ORDER BY name ASC LIMIT 50`,
  );

  const sections: string[] = [];
  const textLines: string[] = ["GEO-synlighet — ukentlig digest", ""];

  for (const s of sets.rows) {
    const report = await computeReport(pool, s.id, s.workspace_owner_user_id).catch(() => null);

    if (!report || !report.latestRun) {
      sections.push(
        `<h2 style="margin:24px 0 4px;font-size:16px">${esc(s.name)}</h2>` +
          `<p style="margin:0;color:#999">Ingen kjøring ennå.</p>`,
      );
      textLines.push(`## ${s.name}`, "Ingen kjøring ennå.", "");
      continue;
    }

    const target = report.brandShare.find((b) => b.isTarget);
    const share = target ? target.sharePercent : 0;
    const prev =
      report.trend.length >= 2 ? report.trend[report.trend.length - 2].targetSharePercent : null;
    const arrow = prev === null ? "" : share > prev ? " ▲" : share < prev ? " ▼" : " →";
    const date = String(report.latestRun.completedAt ?? report.latestRun.startedAt ?? "").slice(0, 10);

    const engineRows = report.engineBreakdown
      .map(
        (e) =>
          `<tr><td style="padding:2px 16px 2px 0;font-family:monospace">${esc(e.engine)}</td>` +
          `<td style="padding:2px 0">${e.targetMentioned}/${e.answers}</td></tr>`,
      )
      .join("");
    const compRows = report.brandShare
      .slice(0, 5)
      .map(
        (b) =>
          `<tr><td style="padding:2px 16px 2px 0${b.isTarget ? ";font-weight:700;color:#0d9488" : ""}">` +
          `${esc(b.brand)}${b.isTarget ? " (deg)" : ""}</td>` +
          `<td style="padding:2px 0">${b.sharePercent}% (${b.mentions})</td></tr>`,
      )
      .join("");

    sections.push(
      `<h2 style="margin:24px 0 4px;font-size:16px">${esc(s.name)}</h2>` +
        `<p style="margin:0 0 8px;color:#555">Din andel: <b style="font-size:18px">${share}%${arrow}</b>` +
        ` · siste kjøring ${esc(date)} (${report.latestRun.answers} svar, ${esc(report.latestRun.status)})</p>` +
        `<table style="border-collapse:collapse;font-size:13px"><tr>` +
        `<td style="vertical-align:top;padding-right:32px"><b style="color:#888">Per motor (treff/svar)</b>` +
        `<table style="margin-top:4px">${engineRows}</table></td>` +
        `<td style="vertical-align:top"><b style="color:#888">Andel-toppen</b>` +
        `<table style="margin-top:4px">${compRows}</table></td></tr></table>`,
    );

    textLines.push(
      `## ${s.name}`,
      `Din andel: ${share}%${arrow} · siste kjøring ${date} (${report.latestRun.answers} svar, ${report.latestRun.status})`,
      "Per motor (treff/svar): " +
        report.engineBreakdown.map((e) => `${e.engine} ${e.targetMentioned}/${e.answers}`).join(", "),
      "",
    );
  }

  const html =
    `<div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;max-width:640px;margin:0 auto;color:#222">` +
    `<h1 style="font-size:20px;margin:0 0 4px">GEO-synlighet — ukentlig digest</h1>` +
    `<p style="color:#666;margin:0 0 16px">AI-synlighet per merke og motor. Bare-modell (parametrisk minne) vs ` +
    `<code>-search</code> (søk på) side om side — se om søk gir treff der bare-modellen står på 0.</p>` +
    sections.join("\n") +
    `<p style="color:#999;font-size:12px;margin-top:28px;border-top:1px solid #eee;padding-top:8px">` +
    `Automatisk fra GEO Visibility-trackeren, mandager etter probe-kjøringen. Endre mottaker via GEO_DIGEST_EMAIL.</p>` +
    `</div>`;

  await sendEmail({
    to: recipient,
    subject: "GEO-synlighet — ukentlig digest",
    html,
    text: textLines.join("\n"),
    fromName: "Creatorhub GEO",
  });

  return { approvedSets: sets.rows.length, recipient };
}
