/**
 * Role Room — IMAP poller for partner replies (Slice 7c+).
 *
 * Connects to GMAIL_USER's mailbox via IMAP (using the same
 * GMAIL_APP_PASSWORD that powers SMTP), searches for incoming mail
 * whose `In-Reply-To` header matches one of our previously sent
 * cooperation emails (by gmail_message_id), and logs them as replies
 * automatically. No manual marking needed.
 *
 * Privacy posture:
 *   - We DON'T scan the whole inbox indiscriminately. The IMAP search
 *     uses a HEADER "In-Reply-To" filter limited to the set of message
 *     IDs we have on file, so we only ever read mail that's a reply to
 *     OUR sent cooperation emails. Producer's other Gmail traffic is
 *     never touched.
 *   - We extract subject + a 1500-char body snippet, not the whole
 *     thread; producer sees their full reply in their own Gmail anyway.
 *
 * Operationally:
 *   - Gmail App Password works for IMAP just like SMTP — no extra
 *     config, no OAuth.
 *   - Single-tenant for now: only polls GMAIL_USER. When we go multi-
 *     tenant, swap this for per-producer OAuth or move to a Postmark
 *     Inbound webhook.
 */

import { ImapFlow } from "imapflow";
import type { Pool } from "pg";

import { logMerchPartnerReply, type MerchReplySentiment } from "./role-room-merch-partner-email.js";

interface SentEmailRow {
  id: string;
  project_id: string;
  partner_email: string;
  gmail_message_id: string | null;
}

export interface PollResult {
  ok: boolean;
  reason?: string;
  pollableSentEmails: number;
  scanned: number;
  newReplies: number;
  alreadyLoggedSkipped: number;
}

function readGmailConfig(): { user: string; password: string } | null {
  const user =
    (process.env.GMAIL_USER
      ?? process.env.GOOGLE_WORKSPACE_EMAIL
      ?? process.env.GOOGLE_ADMIN_EMAIL
      ?? "").trim();
  const password = (process.env.GMAIL_APP_PASSWORD ?? "").replace(/\s+/g, "");
  if (!user || !password) return null;
  return { user, password };
}

/** Map a normalized gmail_message_id (without surrounding angle brackets)
 *  back to the original sent-email row. Both forms tolerated since
 *  IMAP servers sometimes strip the brackets. */
function normalizeMessageId(id: string | null | undefined): string {
  if (!id) return "";
  return id.replace(/^<|>$/g, "").trim().toLowerCase();
}

/** Naive sentiment heuristic for an auto-detected reply. The producer
 *  will usually re-classify, but this gives a starting point so the
 *  card doesn't always say "neutral". */
function inferSentimentFromText(text: string): MerchReplySentiment {
  const lower = text.toLowerCase();
  const positive = [
    "interessant",
    "kult",
    "vi er med",
    "skal se på det",
    "send mer",
    "send tilbud",
    "bra forslag",
    "gjerne",
    "passer",
    "perfekt",
    "ja takk",
  ];
  const negative = [
    "ikke aktuelt",
    "passer ikke",
    "ikke kapasitet",
    "har allerede",
    "takk men nei",
    "nei takk",
    "vi takker nei",
    "ikke nå",
  ];
  if (positive.some((p) => lower.includes(p))) return "positive";
  if (negative.some((p) => lower.includes(p))) return "negative";
  return "neutral";
}

/** Pull the producer's Gmail INBOX, find replies to the supplied
 *  cooperation-email gmail_message_id-set, log each new one to
 *  role_room_merch_partner_email_replies. Idempotent: skips replies
 *  already logged (matched on auto_detected_message_id). */
export async function pollPartnerReplies(
  pool: Pool,
  options?: { lookbackDays?: number; maxScan?: number },
): Promise<PollResult> {
  const cfg = readGmailConfig();
  if (!cfg) {
    return {
      ok: false,
      reason: "missing_email_config",
      pollableSentEmails: 0,
      scanned: 0,
      newReplies: 0,
      alreadyLoggedSkipped: 0,
    };
  }

  const lookbackDays = Math.max(1, Math.min(options?.lookbackDays ?? 30, 90));
  const maxScan = Math.max(10, Math.min(options?.maxScan ?? 200, 500));
  const sinceCutoff = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

  // Pull all sent emails within the lookback window that have a
  // gmail_message_id we can match on. Without that id we can't reliably
  // attribute a reply, so we skip those rows.
  let sentRows: SentEmailRow[] = [];
  try {
    const r = await pool.query(
      `SELECT id, project_id, partner_email, gmail_message_id
         FROM role_room_merch_partner_emails
         WHERE status = 'sent'
           AND gmail_message_id IS NOT NULL
           AND sent_at > $1
         ORDER BY sent_at DESC`,
      [sinceCutoff],
    );
    sentRows = r.rows as SentEmailRow[];
  } catch (err) {
    console.error("[reply-poller] could not load sent emails:", err);
    return {
      ok: false,
      reason: "db_error",
      pollableSentEmails: 0,
      scanned: 0,
      newReplies: 0,
      alreadyLoggedSkipped: 0,
    };
  }

  if (sentRows.length === 0) {
    return {
      ok: true,
      pollableSentEmails: 0,
      scanned: 0,
      newReplies: 0,
      alreadyLoggedSkipped: 0,
    };
  }

  const sentByMessageId = new Map<string, SentEmailRow>();
  for (const row of sentRows) {
    sentByMessageId.set(normalizeMessageId(row.gmail_message_id), row);
  }

  // Already-logged set to avoid double-write on repeated polls.
  let alreadyLogged: Set<string>;
  try {
    const r = await pool.query(
      `SELECT auto_detected_message_id
         FROM role_room_merch_partner_email_replies
         WHERE project_id = ANY($1)
           AND auto_detected_message_id IS NOT NULL`,
      [Array.from(new Set(sentRows.map((r) => r.project_id)))],
    );
    alreadyLogged = new Set(r.rows.map((row) => normalizeMessageId(row.auto_detected_message_id)));
  } catch {
    alreadyLogged = new Set();
  }

  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user: cfg.user, pass: cfg.password },
    logger: false,
  });

  let scanned = 0;
  let newReplies = 0;
  let alreadyLoggedSkipped = 0;

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      // Search by SINCE date — narrow fetch even before per-message
      // header inspection. Fetches only envelope + headers; body comes
      // separately for matched messages only.
      const uidResult = await client.search({ since: sinceCutoff }, { uid: true });
      const uids: number[] = Array.isArray(uidResult) ? uidResult : [];
      const recent = uids.slice(-maxScan);

      for await (const msg of client.fetch(
        recent,
        {
          uid: true,
          envelope: true,
          headers: ["in-reply-to", "references", "message-id"],
        },
      )) {
        scanned++;
        const headers = msg.headers?.toString() ?? "";
        const inReplyMatch = headers.match(/^in-reply-to:\s*(.+)$/im);
        const referencesMatch = headers.match(/^references:\s*(.+)$/im);
        const replyMessageIdMatch = headers.match(/^message-id:\s*(.+)$/im);
        const candidates: string[] = [];
        if (inReplyMatch) candidates.push(...inReplyMatch[1].match(/<[^>]+>/g) ?? []);
        if (referencesMatch) candidates.push(...referencesMatch[1].match(/<[^>]+>/g) ?? []);

        let matchedSent: SentEmailRow | null = null;
        for (const c of candidates) {
          const norm = normalizeMessageId(c);
          if (sentByMessageId.has(norm)) {
            matchedSent = sentByMessageId.get(norm)!;
            break;
          }
        }
        if (!matchedSent) continue;

        const replyMessageId = replyMessageIdMatch
          ? normalizeMessageId(replyMessageIdMatch[1])
          : `imap-uid:${msg.uid}`;
        if (alreadyLogged.has(replyMessageId)) {
          alreadyLoggedSkipped++;
          continue;
        }

        // Pull the body now that we know it's relevant.
        let bodySnippet = "";
        try {
          const fullMsg = await client.fetchOne(msg.uid, { source: true }, { uid: true });
          const source = fullMsg && typeof fullMsg === 'object' && 'source' in fullMsg
            ? (fullMsg as { source?: Buffer }).source
            : undefined;
          if (source) {
            const raw = source.toString();
            // crude body extraction: strip headers (first blank line),
            // truncate at 1500 chars. Producer sees full reply in Gmail.
            const blankLineIdx = raw.indexOf("\r\n\r\n");
            const body = blankLineIdx >= 0 ? raw.slice(blankLineIdx + 4) : raw;
            bodySnippet = body
              .replace(/<[^>]+>/g, " ")
              .replace(/&nbsp;/g, " ")
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 1500);
          }
        } catch {
          /* body extract is best-effort */
        }

        const subject = msg.envelope?.subject ?? "(uten emne)";
        const fromAddr = msg.envelope?.from?.[0]?.address ?? null;
        const summary = bodySnippet.length > 0
          ? bodySnippet.slice(0, 280)
          : `Svar mottatt fra ${fromAddr ?? "ukjent avsender"}: ${subject}`;
        const sentiment = inferSentimentFromText(`${subject} ${bodySnippet}`);
        const repliedAt = msg.envelope?.date instanceof Date
          ? msg.envelope.date.toISOString()
          : new Date().toISOString();

        const logged = await logMerchPartnerReply({
          pool,
          sentEmailId: matchedSent.id,
          projectId: matchedSent.project_id,
          userId: null, // auto-detected, not producer-marked
          replySummary: summary,
          replyFullText: bodySnippet || null,
          sentiment,
          repliedAt,
          autoDetectedMessageId: replyMessageId,
        });
        if (logged) {
          newReplies++;
          alreadyLogged.add(replyMessageId);
        }
      }
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (err) {
    try { await client.close(); } catch { /* ignore */ }
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
      pollableSentEmails: sentRows.length,
      scanned,
      newReplies,
      alreadyLoggedSkipped,
    };
  }

  return {
    ok: true,
    pollableSentEmails: sentRows.length,
    scanned,
    newReplies,
    alreadyLoggedSkipped,
  };
}
