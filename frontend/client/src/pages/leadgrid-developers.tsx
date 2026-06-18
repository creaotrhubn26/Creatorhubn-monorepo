/**
 * leadgrid-developers.tsx — public dev-docs på /leadgrid/utviklere
 *
 * Innhold:
 *   - Hva er Leadgrid Partners API?
 *   - Auth-mønster (Bearer key)
 *   - Scopes
 *   - Endpoints m/ cURL-eksempler
 *   - Webhook-events + HMAC-validering
 *   - Kode-eksempler (Node.js + Python)
 */

import React, { useEffect } from "react";
import { Box, Container, Typography, Card, CardContent, Chip, Stack, Divider } from "@mui/material";

const PALETTE = {
  bg: "#0a0512",
  accent: "#a78bfa",
  text: "#f4f0ff",
  textMuted: "rgba(244,240,255,0.72)",
  textFaint: "rgba(244,240,255,0.45)",
};

const ENDPOINTS = [
  { method: "GET", path: "/api/v1/partner/me", scope: "*", desc: "Validate key + partner-info" },
  { method: "GET", path: "/api/v1/partner/customers", scope: "customers.read", desc: "List kunder for org" },
  { method: "GET", path: "/api/v1/partner/customers/:id", scope: "customers.read", desc: "Kunde-detalj" },
  { method: "GET", path: "/api/v1/partner/customers/:id/needs", scope: "needs.read", desc: "Needs på kunde" },
  { method: "GET", path: "/api/v1/partner/customers/:id/signals", scope: "signals.read", desc: "Signaler på kunde" },
  { method: "GET", path: "/api/v1/partner/customers/:id/deliverables", scope: "deliverables.read", desc: "Leveranser" },
  { method: "POST", path: "/api/v1/partner/customers", scope: "customers.write", desc: "Opprett kunde" },
  { method: "GET", path: "/api/v1/partner/organizations/:id", scope: "organizations.read", desc: "Org-info" },
];

const WEBHOOK_EVENTS = [
  { name: "customer.created",            desc: "Ny kunde ble opprettet" },
  { name: "customer.updated",            desc: "Kunde-felt endret" },
  { name: "customer.needs_changed",      desc: "Behov detektert eller endret" },
  { name: "customer.score_changed",      desc: "Leadgrid-score oppdatert" },
  { name: "deliverable.completed",       desc: "Leveranse ferdig" },
  { name: "focus_request.created",       desc: "Klient ba om fokus" },
  { name: "partnership.approved",        desc: "Partner-søknad godkjent" },
  { name: "intent_agreement.signed",     desc: "Intensjonsavtale signert" },
];

const CODE_NODE = `// Node.js — validate HMAC-SHA256 signature
import crypto from 'crypto';

function isValidLeadgridSignature(req, signingSecret) {
  const signature = req.headers['x-leadgrid-signature']; // 'sha256=abc...'
  const timestamp = req.headers['x-leadgrid-timestamp']; // unix-seconds
  const rawBody = req.rawBody; // viktig: bruk RAW body, ikke parsed JSON

  if (!signature?.startsWith('sha256=')) return false;
  const expected = crypto
    .createHmac('sha256', signingSecret)
    .update(\`\${timestamp}.\${rawBody}\`)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature.slice(7)),
    Buffer.from(expected),
  );
}

app.post('/leadgrid-webhook', express.raw({ type: '*/*' }), (req, res) => {
  if (!isValidLeadgridSignature(req, process.env.LEADGRID_WEBHOOK_SECRET)) {
    return res.status(401).end();
  }
  const event = JSON.parse(req.body);
  // … håndter event
  res.json({ received: true });
});`;

const CODE_PYTHON = `# Python — validate HMAC-SHA256 signature
import hmac, hashlib
from flask import request

def is_valid_leadgrid_signature(secret: str) -> bool:
    signature = request.headers.get('X-Leadgrid-Signature', '')
    timestamp = request.headers.get('X-Leadgrid-Timestamp', '')
    raw_body = request.get_data(as_text=True)

    if not signature.startswith('sha256='):
        return False
    expected = hmac.new(
        secret.encode(),
        f'{timestamp}.{raw_body}'.encode(),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(signature[7:], expected)

@app.route('/leadgrid-webhook', methods=['POST'])
def leadgrid_webhook():
    if not is_valid_leadgrid_signature(LEADGRID_WEBHOOK_SECRET):
        return '', 401
    event = request.get_json()
    # … håndter event
    return {'received': True}`;

const CODE_CURL = `# List kunder
curl https://creatorhub-backend-rtbl.onrender.com/api/v1/partner/customers \\
  -H "Authorization: Bearer lg_live_..."

# Opprett kunde
curl -X POST \\
  https://creatorhub-backend-rtbl.onrender.com/api/v1/partner/customers \\
  -H "Authorization: Bearer lg_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Eksempel AS",
    "website_url": "https://eksempel.no",
    "email": "ola@eksempel.no",
    "tags": ["b2b", "norge"]
  }'`;

export default function LeadgridDevelopersPage() {
  useEffect(() => {
    document.title = "Leadgrid Developers — API & Webhooks";
  }, []);

  return (
    <Box sx={{ bgcolor: PALETTE.bg, color: PALETTE.text, minHeight: "100vh", py: 8,
                fontFamily: '-apple-system, "SF Pro Display", "Inter", "Helvetica Neue", Arial, sans-serif' }}>
      <Container maxWidth="md">
        <Typography variant="overline" sx={{ color: PALETTE.accent, letterSpacing: 2 }}>
          Leadgrid Developers
        </Typography>
        <Typography variant="h2" sx={{ fontWeight: 800, mb: 2 }}>
          Partners API & Webhooks
        </Typography>
        <Typography variant="h6" sx={{ color: PALETTE.textMuted, mb: 6 }}>
          Integrer ditt system med Leadgrid. Hent kunder, opprett leads,
          ta imot real-time events.
        </Typography>

        {/* Auth */}
        <Section title="Autentisering">
          <Typography sx={{ mb: 2, color: PALETTE.textMuted }}>
            Alle API-kall krever en Bearer-token i Authorization-headeren:
          </Typography>
          <CodeBlock>{`Authorization: Bearer lg_live_abc123...`}</CodeBlock>
          <Typography sx={{ mt: 2, color: PALETTE.textMuted }}>
            API-keys genereres i superadmin-grensesnittet. Hver key er knyttet
            til enten en organisasjon eller en partner og har et sett med scopes.
          </Typography>
        </Section>

        {/* Scopes */}
        <Section title="Scopes">
          <Stack direction="row" spacing={1} flexWrap="wrap" rowGap={1}>
            {[
              "customers.read", "customers.write", "needs.read", "signals.read",
              "deliverables.read", "organizations.read", "webhooks.read",
            ].map((s) => (
              <Chip key={s} label={s} size="small"
                    sx={{ bgcolor: "rgba(155,225,93,0.10)", color: "#9be15d", fontFamily: "monospace" }} />
            ))}
          </Stack>
        </Section>

        {/* Endpoints */}
        <Section title="Endpoints">
          <Stack spacing={1}>
            {ENDPOINTS.map((e) => (
              <Box key={e.path + e.method} sx={{
                p: 2, borderRadius: 2, bgcolor: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}>
                <Stack direction="row" alignItems="center" spacing={2} flexWrap="wrap">
                  <Chip label={e.method} size="small"
                        sx={{ bgcolor: e.method === "GET" ? "#7ab8ff" : "#9be15d",
                              color: "#0a0512", fontWeight: 700, minWidth: 56 }} />
                  <Box sx={{ fontFamily: "monospace", fontSize: 13, color: "#fff", flex: 1 }}>
                    {e.path}
                  </Box>
                  <Chip label={e.scope} size="small"
                        sx={{ bgcolor: "rgba(155,225,93,0.10)", color: "#9be15d", fontFamily: "monospace" }} />
                </Stack>
                <Typography variant="caption" sx={{ color: PALETTE.textMuted, mt: 0.5, display: "block" }}>
                  {e.desc}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Section>

        {/* cURL-eksempler */}
        <Section title="cURL-eksempler">
          <CodeBlock>{CODE_CURL}</CodeBlock>
        </Section>

        {/* Webhook-events */}
        <Section title="Webhook events">
          <Typography sx={{ mb: 2, color: PALETTE.textMuted }}>
            Vi sender HTTP POST til ditt endpoint med JSON-body når events skjer.
            Hver request har headers:
          </Typography>
          <CodeBlock>{`X-Leadgrid-Signature: sha256=<hex>
X-Leadgrid-Event: <event_type>
X-Leadgrid-Delivery: <event_id>
X-Leadgrid-Timestamp: <unix-seconds>`}</CodeBlock>
          <Typography sx={{ mt: 3, mb: 2, color: PALETTE.textMuted }}>
            Disse events er tilgjengelig:
          </Typography>
          <Stack spacing={1}>
            {WEBHOOK_EVENTS.map((e) => (
              <Box key={e.name} sx={{ p: 1.5, bgcolor: "rgba(255,255,255,0.03)", borderRadius: 1 }}>
                <Box sx={{ fontFamily: "monospace", color: "#ffb86b", fontSize: 13 }}>{e.name}</Box>
                <Typography variant="caption" sx={{ color: PALETTE.textMuted }}>{e.desc}</Typography>
              </Box>
            ))}
          </Stack>
        </Section>

        {/* Signatur-validering */}
        <Section title="HMAC-validering">
          <Typography sx={{ mb: 2, color: PALETTE.textMuted }}>
            Hver webhook har en signatur i <code>X-Leadgrid-Signature</code> som er
            HMAC-SHA256 over <code>"{`<timestamp>.<raw-body>`}"</code> med
            ditt webhook-endpoint sin signing-secret.
            <strong>Valider alltid signaturen før du behandler eventet.</strong>
          </Typography>
          <Typography variant="overline" sx={{ color: PALETTE.accent, mb: 1, display: "block" }}>
            Node.js (Express)
          </Typography>
          <CodeBlock>{CODE_NODE}</CodeBlock>
          <Typography variant="overline" sx={{ color: PALETTE.accent, mb: 1, mt: 4, display: "block" }}>
            Python (Flask)
          </Typography>
          <CodeBlock>{CODE_PYTHON}</CodeBlock>
        </Section>

        {/* Retry-logikk */}
        <Section title="Retry-logikk">
          <Typography sx={{ mb: 2, color: PALETTE.textMuted }}>
            Hvis ditt endpoint returnerer 5xx eller timer ut, prøver vi på nytt
            opp til 6 ganger med eksponentiell backoff:
            <strong> 30s → 5min → 30min → 4t → 24t</strong>.
          </Typography>
          <Typography sx={{ mb: 2, color: PALETTE.textMuted }}>
            4xx-respons (utenom 408 og 429) regnes som permanent feil — vi
            prøver ikke på nytt. Etter 10 fortløpende fails auto-disables
            endpoint-et og du må re-aktivere det manuelt.
          </Typography>
          <Typography sx={{ color: PALETTE.textMuted }}>
            Ditt endpoint må svare innen 10 sekunder.
            <strong> Returner 200 raskt og prosesser eventet i bakgrunnen</strong>
            for å unngå unødvendige retries.
          </Typography>
        </Section>

        {/* Idempotency */}
        <Section title="Idempotency">
          <Typography sx={{ color: PALETTE.textMuted }}>
            Vi sender samme event-ID ved retry. Bruk <code>X-Leadgrid-Delivery</code>
            -headeren til å deduplisere — lagre IDs du allerede har behandlet.
          </Typography>
        </Section>

        <Divider sx={{ my: 6, borderColor: "rgba(255,255,255,0.08)" }} />

        <Typography variant="caption" sx={{ color: PALETTE.textFaint }}>
          Spørsmål? Send e-post til <a href="mailto:daniel@creatorhubn.com"
          style={{ color: PALETTE.accent }}>daniel@creatorhubn.com</a>.
          Vi svarer som regel innen 24 timer.
        </Typography>
      </Container>
    </Box>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card sx={{ bgcolor: "rgba(255,255,255,0.03)", color: "#fff", mb: 4,
                 border: "1px solid rgba(255,255,255,0.06)" }}>
      <CardContent sx={{ p: 4 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>{title}</Typography>
        {children}
      </CardContent>
    </Card>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <Box component="pre" sx={{
      p: 2.5, bgcolor: "#000", borderRadius: 2,
      fontSize: 13, lineHeight: 1.6, color: "#e5e2f0",
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      overflowX: "auto", border: "1px solid rgba(255,255,255,0.08)",
      whiteSpace: "pre-wrap", wordBreak: "break-word",
    }}>
      {children}
    </Box>
  );
}
