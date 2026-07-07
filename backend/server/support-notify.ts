/**
 * support-notify.ts — felles admin-varsel når en ny ticket sendes inn.
 * Brukes av både produkt-support (support_tickets) og The Role Room
 * (role_room_tickets). Fire-and-forget: feiler aldri ticket-opprettelsen.
 */
import type { Pool } from "pg";

// Admin som varsles ved nye tickets (env-overstyrbar).
export const SUPPORT_NOTIFY_EMAIL = (process.env.SUPPORT_NOTIFY_EMAIL || "daniel@creatorhubn.com").trim();

const escH = (s: any) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export interface NotifyTicket {
  id: string;
  origin: string;        // «Support» | «Role Room» — vises i emne/overskrift
  category: string;
  priority: string;
  title: string;
  description: string;
  source?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  context?: any;
}

export async function notifySupportTicket(
  sendEmail: ((opts: any) => Promise<any>) | undefined,
  pool: Pool,
  t: NotifyTicket,
): Promise<void> {
  if (!sendEmail) return;
  try {
    const who = t.userName || t.userEmail || "en bruker";
    const ctxUrl = t.context?.url ? String(t.context.url) : "";
    const srcLine = [t.source, t.category].filter(Boolean).map(escH).join(" · ");
    const html =
      `<div style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px">` +
      `<h2 style="margin:0 0 4px;color:#1a1a1a">Ny ${escH(t.origin)}-ticket (${escH(t.priority)})</h2>` +
      (srcLine ? `<p style="color:#666;margin:0 0 16px">${srcLine}</p>` : "") +
      `<p style="font-size:16px;font-weight:700;color:#1a1a1a;margin:0 0 6px">${escH(t.title)}</p>` +
      `<p style="font-size:14px;color:#333;white-space:pre-wrap;margin:0 0 16px">${escH(t.description)}</p>` +
      `<p style="font-size:13px;color:#666">Fra: ${escH(who)}${t.userEmail ? ` (${escH(t.userEmail)})` : ""}</p>` +
      (ctxUrl ? `<p style="font-size:12px;color:#999;word-break:break-all">URL: ${escH(ctxUrl)}</p>` : "") +
      `</div>`;
    const text =
      `Ny ${t.origin}-ticket (${t.priority})${srcLine ? ` — ${t.source || ""}/${t.category}` : ""}\n` +
      `${t.title}\n\n${t.description}\n\nFra: ${who}${t.userEmail ? ` (${t.userEmail})` : ""}${ctxUrl ? `\nURL: ${ctxUrl}` : ""}`;
    await sendEmail({
      to: SUPPORT_NOTIFY_EMAIL,
      subject: `[${t.origin}] ${t.title}`,
      html,
      text,
      fromLabel: "Creatorhubn Support",
      kind: "support_ticket",
      pool,
    });
  } catch (err) {
    console.warn("[support-notify] admin-varsel ikke sendt:", (err as any)?.message);
  }
}
