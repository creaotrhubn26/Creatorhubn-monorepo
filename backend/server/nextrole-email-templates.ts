/**
 * nextrole-email-templates.ts
 *
 * HTML + plain-text e-post-templates for NextRole-livssyklusen:
 *
 *   • welcomeEmail()         — etter første pålogging
 *   • trialStartedEmail()    — etter at trial er aktivert
 *   • trialExpiringEmail()   — 3 dager før trial utløper
 *   • paymentReceiptEmail()  — etter checkout.session.completed
 *
 * Styling matcher NextRole-branding:
 *   • Navy (#1F2937) for tekst og header-bar
 *   • Amber (#F5B82E) for CTA-knapper og accent
 *   • Cream (#FAF5E8) for soft callout-bokser
 *   • Inter / system-stack font
 *
 * Bruk:
 *   import { renderWelcomeEmail } from './nextrole-email-templates';
 *   const { subject, html, text } = renderWelcomeEmail({ name, ... });
 *   await transporter.sendMail({ from, to, subject, html, text });
 *
 * Hooks inn i eksisterende Stripe-webhook (index.ts:830/931) ved å
 * matche metadata.app_id === 'next-role'.
 */

// ── Brand-konstanter ────────────────────────────────────────────────
const BRAND = {
  navy: "#1F2937",
  navyDark: "#0F172A",
  amber: "#F5B82E",
  amberDark: "#D49B1A",
  amberSoft: "#FFF4D6",
  amberAccent: "#7A5A0B",
  cream: "#FAF5E8",
  muted: "#6B7280",
  divider: "#E5E7EB",
  appUrl: (process.env.CREATORHUB_PUBLIC_URL ?? "https://app.creatorhubn.com").replace(/\/$/, ""),
  logoUrl: `${(process.env.CREATORHUB_PUBLIC_URL ?? "https://app.creatorhubn.com").replace(/\/$/, "")}/NextRole_Iconapp.png`,
};

const FONT_STACK = `-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif`;

// ── Felles wrapper — header med logo + footer med vilkår ────────────

function layout(opts: {
  preheader: string;
  bodyHtml: string;
}): string {
  return `<!DOCTYPE html>
<html lang="no">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>NextRole</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.cream};font-family:${FONT_STACK};color:${BRAND.navy};">

<!-- Preheader (skjult, men vises i innboks-preview) -->
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:transparent;">
${escapeHtml(opts.preheader)}
</div>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${BRAND.cream};">
  <tr><td align="center" style="padding:32px 16px;">

    <!-- Hoved-card -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;box-shadow:0 4px 24px rgba(15,23,42,0.08);">

      <!-- Header — navy bar med logo -->
      <tr><td style="background:${BRAND.navy};padding:24px 32px;border-radius:16px 16px 0 0;text-align:center;">
        <img src="${BRAND.logoUrl}" alt="NextRole" width="56" height="56" style="display:block;margin:0 auto 8px;border-radius:12px;" />
        <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">
          Next<span style="color:${BRAND.amber};">Role</span>
        </div>
        <div style="font-size:11px;color:#9CA3AF;letter-spacing:2px;text-transform:uppercase;margin-top:4px;">
          by CreatorHub
        </div>
      </td></tr>

      <!-- Body -->
      <tr><td style="padding:32px;color:${BRAND.navy};font-size:15px;line-height:1.6;">
${opts.bodyHtml}
      </td></tr>

      <!-- Footer -->
      <tr><td style="padding:24px 32px;border-top:1px solid ${BRAND.divider};font-size:12px;color:${BRAND.muted};text-align:center;border-radius:0 0 16px 16px;">
        <p style="margin:0 0 8px 0;">
          NextRole by CreatorHub Norge AS · Lørenskog, Norge
        </p>
        <p style="margin:0 0 8px 0;">
          <a href="${BRAND.appUrl}/privacy-policy" style="color:${BRAND.muted};text-decoration:underline;">Personvern</a>
          ·
          <a href="${BRAND.appUrl}/terms-and-conditions" style="color:${BRAND.muted};text-decoration:underline;">Vilkår</a>
          ·
          <a href="${BRAND.appUrl}/settings" style="color:${BRAND.muted};text-decoration:underline;">Innstillinger</a>
        </p>
        <p style="margin:8px 0 0 0;font-size:11px;color:#9CA3AF;">
          Dette er en transaksjonell e-post knyttet til kontoen din. Du kan administrere e-post-preferanser i innstillinger.
        </p>
      </td></tr>

    </table>

  </td></tr>
</table>

</body>
</html>`;
}

// CTA-knapp generator
function button(href: string, label: string): string {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
  <tr><td style="background:${BRAND.amber};border-radius:8px;">
    <a href="${href}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:${BRAND.navy};text-decoration:none;">
      ${escapeHtml(label)}
    </a>
  </td></tr>
</table>`;
}

// Callout-boks (informasjon)
function callout(content: string): string {
  return `
<div style="background:${BRAND.amberSoft};border-left:4px solid ${BRAND.amber};padding:16px 20px;border-radius:0 8px 8px 0;margin:20px 0;color:${BRAND.amberAccent};font-size:14px;line-height:1.55;">
${content}
</div>`;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatNok(amountOre: number): string {
  return `${(amountOre / 100).toLocaleString("no-NO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} kr`;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("no-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ════════════════════════════════════════════════════════════════════
// TEMPLATES
// ════════════════════════════════════════════════════════════════════

export interface WelcomeEmailInput {
  firstName: string;
  email: string;
}

export function renderWelcomeEmail(input: WelcomeEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = "Velkommen til NextRole — la oss bygge CV-en din";
  const greeting = input.firstName?.trim() || "Hei";

  const bodyHtml = `
<h1 style="margin:0 0 16px 0;font-size:24px;font-weight:800;color:${BRAND.navy};">
  Hei ${escapeHtml(greeting)} 👋
</h1>

<p style="margin:0 0 16px 0;">
  Velkommen til NextRole. Du er ett klikk unna å bygge en CV som faktisk får deg lagt merke til —
  ATS-optimalisert, AI-drevet, og bygget for norsk jobmarked.
</p>

${callout(`
  <strong style="color:${BRAND.navy};">Din 14-dagers prøveperiode er aktiv.</strong><br />
  Du har full Pro-tilgang i 14 dager — uten å oppgi kortinformasjon.
  Etter prøveperioden velger du hvilken pakke som passer deg.
`)}

<p style="margin:24px 0 0 0;font-weight:700;color:${BRAND.navy};">Slik kommer du raskt i gang:</p>
<ol style="margin:8px 0 0 0;padding-left:24px;color:${BRAND.navy};">
  <li style="margin-bottom:8px;">
    <strong>Importer din eksisterende CV</strong> (PDF/DOCX) — Claude leser den og strukturerer den på 30 sekunder.
  </li>
  <li style="margin-bottom:8px;">
    <strong>Velg mal og fargeskjema</strong> — 15 maler, 8 farger, live preview mens du redigerer.
  </li>
  <li style="margin-bottom:8px;">
    <strong>Lim inn en stillingsannonse</strong> — du får ATS-skåre, manglende nøkkelord, og søknadsbrev.
  </li>
</ol>

${button(`${BRAND.appUrl}/resume-builder`, "Start din første CV")}

<p style="margin:24px 0 0 0;color:${BRAND.muted};font-size:13px;">
  Trenger du hjelp? Svar på denne e-posten — vi svarer som regel innen 24 timer.
</p>
`;

  const text = `Hei ${greeting},

Velkommen til NextRole. Du er ett klikk unna å bygge en CV som faktisk får deg lagt merke til.

Din 14-dagers prøveperiode er aktiv. Full Pro-tilgang i 14 dager uten kortinformasjon.

Slik kommer du i gang:
1. Importer din eksisterende CV (PDF/DOCX) — Claude strukturerer den på 30 sekunder
2. Velg mal og fargeskjema — 15 maler med live preview
3. Lim inn en stillingsannonse — få ATS-skåre, nøkkelord og søknadsbrev

Start her: ${BRAND.appUrl}/resume-builder

Hilsen,
NextRole-teamet
by CreatorHub`;

  return {
    subject,
    html: layout({
      preheader: "Din 14-dagers prøveperiode er aktiv. Bygg din første CV nå.",
      bodyHtml,
    }),
    text,
  };
}

// ────────────────────────────────────────────────────────────────────

export interface TrialStartedEmailInput {
  firstName: string;
  trialEndsAt: Date;
}

export function renderTrialStartedEmail(input: TrialStartedEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = "Din NextRole-prøveperiode er aktiv";
  const greeting = input.firstName?.trim() || "Hei";
  const endDate = formatDate(input.trialEndsAt);

  const bodyHtml = `
<h1 style="margin:0 0 16px 0;font-size:24px;font-weight:800;color:${BRAND.navy};">
  Du er i gang, ${escapeHtml(greeting)}
</h1>

<p style="margin:0 0 16px 0;">
  Din NextRole Pro-prøveperiode er aktiv. Du har full tilgang til alt:
</p>

<ul style="margin:0 0 20px 0;padding-left:24px;color:${BRAND.navy};">
  <li style="margin-bottom:6px;">Ubegrenset antall CV-er + alle 15 maler</li>
  <li style="margin-bottom:6px;">AI-søknadsbrev, oversettelse og intervjuforberedelse</li>
  <li style="margin-bottom:6px;">PDF-import (Claude leser eksisterende CV)</li>
  <li style="margin-bottom:6px;">Offentlig CV-deling + versjon-historikk</li>
  <li style="margin-bottom:6px;">GitHub-import + prioritert AI-rate</li>
</ul>

${callout(`
  <strong style="color:${BRAND.navy};">Prøveperioden utløper ${endDate}.</strong><br />
  Auto-konverterer til <strong>Standard (49 kr/mnd)</strong>. Kanselleres når som helst — ingen kortinformasjon kreves nå.
`)}

${button(`${BRAND.appUrl}/resume-builder`, "Fortsett med CV-en")}

<p style="margin:32px 0 0 0;font-size:13px;color:${BRAND.muted};">
  Vi sender en påminnelse 3 dager før prøveperioden utløper — så du har full kontroll.
</p>
`;

  const text = `Hei ${greeting},

Din NextRole Pro-prøveperiode er aktiv. Du har full tilgang til alt:
- Ubegrenset antall CV-er + alle 15 maler
- AI-søknadsbrev, oversettelse og intervjuforberedelse
- PDF-import (Claude leser eksisterende CV)
- Offentlig CV-deling + versjon-historikk
- GitHub-import + prioritert AI-rate

Prøveperioden utløper ${endDate}. Auto-konverterer til Standard (49 kr/mnd). Kanselleres når som helst.

Fortsett: ${BRAND.appUrl}/resume-builder

Hilsen,
NextRole-teamet`;

  return {
    subject,
    html: layout({
      preheader: `Pro-tilgang aktiv frem til ${endDate}. Full feature-tilgang.`,
      bodyHtml,
    }),
    text,
  };
}

// ────────────────────────────────────────────────────────────────────

export interface TrialExpiringEmailInput {
  firstName: string;
  daysLeft: number;
  trialEndsAt: Date;
  /** Hvilken pakke prøveperioden konverterer til. */
  convertingTo?: "standard" | "pro";
}

export function renderTrialExpiringEmail(input: TrialExpiringEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const daysLeft = Math.max(0, input.daysLeft);
  const greeting = input.firstName?.trim() || "Hei";
  const endDate = formatDate(input.trialEndsAt);
  const tier = input.convertingTo ?? "standard";
  const tierPrice = tier === "pro" ? "99 kr / mnd" : "49 kr / mnd";
  const tierName = tier === "pro" ? "Pro" : "Standard";

  const subject =
    daysLeft === 0
      ? "Prøveperioden din utløper i dag"
      : daysLeft === 1
      ? "1 dag igjen av prøveperioden"
      : `${daysLeft} dager igjen — velg pakke før ${endDate}`;

  const urgency = daysLeft <= 1 ? "high" : daysLeft <= 3 ? "medium" : "low";
  const urgencyText =
    urgency === "high"
      ? `Prøveperioden din utløper ${daysLeft === 0 ? "i dag" : "i morgen"}.`
      : `Du har <strong>${daysLeft} ${daysLeft === 1 ? "dag" : "dager"}</strong> igjen av prøveperioden.`;

  const bodyHtml = `
<h1 style="margin:0 0 16px 0;font-size:24px;font-weight:800;color:${BRAND.navy};">
  ${escapeHtml(greeting)}, ${daysLeft === 0 ? "siste dag på prøveperioden" : "tiden går ut"}
</h1>

<p style="margin:0 0 16px 0;">
  ${urgencyText} Etter den datoen mister du tilgang til Pro-funksjoner med mindre du velger en pakke.
</p>

${callout(`
  <strong style="color:${BRAND.navy};">Hva skjer ${endDate}?</strong><br />
  Du auto-konverterer til <strong>${tierName} (${tierPrice})</strong>.
  Du beholder alle CV-er og kan oppgradere/avbryte når som helst.
`)}

<p style="margin:24px 0 12px 0;font-weight:700;color:${BRAND.navy};">Hva får du etter prøveperioden?</p>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 20px 0;">
  <tr>
    <td valign="top" style="width:50%;padding:16px;background:#F9FAFB;border-radius:8px;vertical-align:top;">
      <div style="font-size:11px;font-weight:700;color:${BRAND.muted};letter-spacing:1.5px;text-transform:uppercase;">Standard</div>
      <div style="font-size:22px;font-weight:800;color:${BRAND.navy};margin:6px 0;">49 kr / mnd</div>
      <div style="font-size:13px;color:${BRAND.navy};line-height:1.5;">
        5 CV-er · Alle maler · AI ATS-analyse · PDF-import · Offentlig CV
      </div>
    </td>
    <td style="width:12px;"></td>
    <td valign="top" style="width:50%;padding:16px;background:${BRAND.amberSoft};border:1px solid ${BRAND.amber};border-radius:8px;vertical-align:top;">
      <div style="font-size:11px;font-weight:700;color:${BRAND.amberAccent};letter-spacing:1.5px;text-transform:uppercase;">Pro</div>
      <div style="font-size:22px;font-weight:800;color:${BRAND.navy};margin:6px 0;">99 kr / mnd</div>
      <div style="font-size:13px;color:${BRAND.navy};line-height:1.5;">
        Ubegrenset · AI-søknadsbrev · Oversettelse · Versjon-historikk · GitHub
      </div>
    </td>
  </tr>
</table>

${button(`${BRAND.appUrl}/nextrole`, "Velg pakke nå")}

<p style="margin:24px 0 0 0;font-size:13px;color:${BRAND.muted};">
  Trenger du mer tid? Svar på denne e-posten og fortell oss hva som mangler — vi hjelper deg gjerne.
</p>
`;

  const text = `Hei ${greeting},

${daysLeft === 0 ? "Prøveperioden din utløper i dag" : `Du har ${daysLeft} ${daysLeft === 1 ? "dag" : "dager"} igjen av prøveperioden.`}

${endDate}: Auto-konvertering til ${tierName} (${tierPrice}). Du beholder alle CV-er.

Velg pakke nå: ${BRAND.appUrl}/nextrole

Standard 49 kr/mnd: 5 CV-er, alle maler, AI ATS-analyse, PDF-import, offentlig CV
Pro 99 kr/mnd: Ubegrenset, AI-søknadsbrev, oversettelse, versjon-historikk, GitHub

Hilsen,
NextRole-teamet`;

  return {
    subject,
    html: layout({
      preheader:
        daysLeft === 0
          ? "Siste dag på prøveperioden. Velg pakke nå."
          : `${daysLeft} dager igjen. Velg pakke før auto-konvertering.`,
      bodyHtml,
    }),
    text,
  };
}

// ────────────────────────────────────────────────────────────────────

export interface PaymentReceiptEmailInput {
  firstName: string;
  /** Tier-id ('standard' eller 'pro') */
  tierId: "standard" | "pro";
  /** Beløp i øre (Stripe-format) */
  amountOre: number;
  currency: string;
  /** Stripe invoice-ID for referanse */
  invoiceId?: string;
  /** Neste fakturering — dato eller null hvis kansellert */
  nextBillingDate?: Date;
  /** PDF-lenke til kvittering fra Stripe */
  invoiceUrl?: string;
}

export function renderPaymentReceiptEmail(input: PaymentReceiptEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const greeting = input.firstName?.trim() || "Hei";
  const tierName = input.tierId === "pro" ? "Pro" : "Standard";
  const amount = formatNok(input.amountOre);
  const nextBilling = input.nextBillingDate ? formatDate(input.nextBillingDate) : null;
  const subject = `Kvittering: NextRole ${tierName} — ${amount}`;

  const bodyHtml = `
<h1 style="margin:0 0 16px 0;font-size:24px;font-weight:800;color:${BRAND.navy};">
  Takk for kjøpet, ${escapeHtml(greeting)}
</h1>

<p style="margin:0 0 16px 0;">
  Betalingen er bekreftet. Du har nå <strong>NextRole ${tierName}</strong> aktivt på kontoen din.
</p>

<!-- Kvittering-tabell -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0;border:1px solid ${BRAND.divider};border-radius:8px;overflow:hidden;">
  <tr><td colspan="2" style="background:${BRAND.navy};padding:16px 20px;color:#fff;font-weight:700;font-size:14px;">
    Kvittering
  </td></tr>
  <tr><td style="padding:12px 20px;border-top:1px solid ${BRAND.divider};color:${BRAND.muted};font-size:13px;">
    Produkt
  </td><td style="padding:12px 20px;border-top:1px solid ${BRAND.divider};text-align:right;font-weight:600;color:${BRAND.navy};">
    NextRole ${tierName}
  </td></tr>
  <tr><td style="padding:12px 20px;border-top:1px solid ${BRAND.divider};color:${BRAND.muted};font-size:13px;">
    Pris
  </td><td style="padding:12px 20px;border-top:1px solid ${BRAND.divider};text-align:right;font-weight:600;color:${BRAND.navy};">
    ${amount} <span style="color:${BRAND.muted};font-weight:400;">/ mnd</span>
  </td></tr>
  ${input.invoiceId ? `
  <tr><td style="padding:12px 20px;border-top:1px solid ${BRAND.divider};color:${BRAND.muted};font-size:13px;">
    Faktura-ID
  </td><td style="padding:12px 20px;border-top:1px solid ${BRAND.divider};text-align:right;font-family:monospace;font-size:12px;color:${BRAND.muted};">
    ${escapeHtml(input.invoiceId)}
  </td></tr>` : ""}
  ${nextBilling ? `
  <tr><td style="padding:12px 20px;border-top:1px solid ${BRAND.divider};color:${BRAND.muted};font-size:13px;">
    Neste fakturering
  </td><td style="padding:12px 20px;border-top:1px solid ${BRAND.divider};text-align:right;color:${BRAND.navy};">
    ${nextBilling}
  </td></tr>` : ""}
</table>

${input.invoiceUrl ? button(input.invoiceUrl, "Last ned PDF-kvittering") : ""}

${button(`${BRAND.appUrl}/resume-builder`, "Gå til NextRole")}

${callout(`
  <strong style="color:${BRAND.navy};">Faktura-info for selskap</strong><br />
  Skal kvitteringen brukes som regnskapsbilag? Last ned PDF-versjonen via knappen over.
  Den inneholder MVA-spesifikasjon og organisasjonsnummer.
`)}

<p style="margin:24px 0 0 0;font-size:13px;color:${BRAND.muted};">
  Avbryt eller endre pakke når som helst i <a href="${BRAND.appUrl}/settings" style="color:${BRAND.navy};">Innstillinger → Abonnement</a>.
  Spørsmål? Svar på denne e-posten.
</p>
`;

  const text = `Hei ${greeting},

Takk for kjøpet! Du har nå NextRole ${tierName} aktivt.

Kvittering:
- Produkt: NextRole ${tierName}
- Pris: ${amount}/mnd
${input.invoiceId ? `- Faktura-ID: ${input.invoiceId}` : ""}
${nextBilling ? `- Neste fakturering: ${nextBilling}` : ""}

${input.invoiceUrl ? `PDF-kvittering: ${input.invoiceUrl}\n` : ""}
Gå til NextRole: ${BRAND.appUrl}/resume-builder
Avbryt/endre pakke: ${BRAND.appUrl}/settings

Hilsen,
NextRole-teamet`;

  return {
    subject,
    html: layout({
      preheader: `Kvittering for NextRole ${tierName} — ${amount}/mnd`,
      bodyHtml,
    }),
    text,
  };
}
