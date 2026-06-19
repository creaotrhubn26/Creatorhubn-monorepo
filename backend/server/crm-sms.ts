// CRM SMS channel (#49) — provider abstraction. Default adapter is Twilio via
// its REST API (no SDK dep). Provider-agnostic: a different adapter can be
// swapped behind sendSms() later. Env-gated — when unconfigured, sendSms throws
// a clear "not configured" error rather than pretending to send (cf. the email
// send no-op fix #7).
export interface SmsResult { sid: string; provider: string; }

export function smsConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    (process.env.TWILIO_FROM || process.env.TWILIO_MESSAGING_SERVICE_SID),
  );
}

export async function sendSms(to: string, body: string): Promise<SmsResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  const messagingService = process.env.TWILIO_MESSAGING_SERVICE_SID;
  if (!sid || !token || (!from && !messagingService)) {
    const err = new Error("SMS-provider er ikke konfigurert. Sett TWILIO_ACCOUNT_SID/AUTH_TOKEN + TWILIO_FROM.") as Error & { code?: string };
    err.code = "sms_not_configured";
    throw err;
  }
  if (!to) throw new Error("Mottakernummer mangler.");
  if (!body) throw new Error("Meldingstekst mangler.");

  const params = new URLSearchParams();
  params.set("To", to);
  params.set("Body", body);
  if (messagingService) params.set("MessagingServiceSid", messagingService);
  else params.set("From", from as string);

  const resp = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
      // A hung Twilio socket would otherwise block the caller until the OS TCP
      // timeout (minutes). Fail fast so the request/cron slot is freed.
      signal: AbortSignal.timeout(10_000),
    },
  );
  const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
  if (!resp.ok) {
    throw new Error(`Twilio-feil (${resp.status}): ${(data?.message as string) || "ukjent"}`);
  }
  return { sid: String(data.sid || ""), provider: "twilio" };
}
