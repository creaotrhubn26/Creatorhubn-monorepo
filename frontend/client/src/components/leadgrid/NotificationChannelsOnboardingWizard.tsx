/**
 * NotificationChannelsOnboardingWizard.tsx
 *
 * 5/7-stegs wizard som kundens admin går gjennom for å sette opp
 * Leadgrid-varslings-kanaler (e-post + WhatsApp).
 *
 * Modell:
 *   shared   → 4 steg: choose_model → email_branding → verify_email → activate
 *   own_waba → 7 steg: choose_model → email_branding → waba_credentials
 *               → validate_waba → sync_templates → test_send → activate
 */

import React, { useEffect, useState } from "react";
import {
  Box, Card, CardContent, Stack, Typography, Button, Stepper, Step, StepLabel,
  Alert, CircularProgress, TextField, Snackbar, Chip, Divider,
  Radio, RadioGroup, FormControlLabel, FormControl, FormLabel, Link,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import EmailIcon from "@mui/icons-material/Email";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

interface State {
  state: {
    delivery_model: "shared" | "own_waba" | null;
    current_step: string;
    steps_completed: string[];
    activated: boolean;
    last_test_phone: string | null;
    last_test_error: string | null;
  };
  org_key: string;
  email_branding_exists: boolean;
  email_branding_has_sender: boolean;
  waba_config_exists: boolean;
  waba_validated: boolean;
  waba_validation_error: string | null;
}

const SHARED_STEPS = [
  { key: "choose_model", label: "Velg modell" },
  { key: "email_branding", label: "E-post-branding" },
  { key: "verify_email", label: "Test-sending" },
  { key: "activate", label: "Aktiver" },
];

const OWN_WABA_STEPS = [
  { key: "choose_model", label: "Velg modell" },
  { key: "email_branding", label: "E-post-branding" },
  { key: "waba_credentials", label: "WABA-credentials" },
  { key: "validate_waba", label: "Valider WABA" },
  { key: "sync_templates", label: "Sync templates" },
  { key: "test_send", label: "Send test" },
  { key: "activate", label: "Aktiver" },
];

export function NotificationChannelsOnboardingWizard() {
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [snack, setSnack] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const load = async () => {
    const r = await fetch("/api/leadgrid/onboarding/channels/state",
                          { credentials: "include" });
    if (r.ok) setState(await r.json());
  };

  useEffect(() => { load(); }, []);

  const setModel = async (model: "shared" | "own_waba") => {
    setBusy(true);
    try {
      const r = await fetch("/api/leadgrid/onboarding/channels/model", {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model }),
      });
      if (r.ok) await load();
    } finally { setBusy(false); }
  };

  const advance = async (fromStep: string) => {
    setBusy(true);
    try {
      const r = await fetch("/api/leadgrid/onboarding/channels/advance", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from_step: fromStep }),
      });
      if (r.ok) await load();
    } finally { setBusy(false); }
  };

  const activate = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/leadgrid/onboarding/channels/activate", {
        method: "POST", credentials: "include",
      });
      if (r.ok) {
        setSnack({ kind: "ok", msg: "Aktivert! Klient-varsler er nå live." });
        await load();
      }
    } finally { setBusy(false); }
  };

  if (!state) {
    return <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress /></Box>;
  }

  if (state.state.activated) {
    return (
      <Card>
        <CardContent>
          <Stack alignItems="center" spacing={2}>
            <CheckCircleIcon sx={{ fontSize: 64, color: "#9be15d" }} />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Varslings-kanalene er aktivert
            </Typography>
            <Typography color="text.secondary">
              Leadgrid sender nå klient-varsler via{" "}
              {state.state.delivery_model === "own_waba"
                ? "ditt eget WhatsApp Business-nummer"
                : "Leadgrids delte WhatsApp Business-nummer"}.
            </Typography>
            <Chip color="success" label={`Modell: ${state.state.delivery_model === "own_waba" ? "Eget nummer" : "Delt nummer"}`} />
          </Stack>
        </CardContent>
      </Card>
    );
  }

  const steps = state.state.delivery_model === "own_waba" ? OWN_WABA_STEPS : SHARED_STEPS;
  const activeIdx = steps.findIndex((s) => s.key === state.state.current_step);

  return (
    <Box>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
            Sett opp varslings-kanaler
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Vi tar deg gjennom oppsett av e-post og WhatsApp for klient-varsler.
            Tar 5-15 minutter.
          </Typography>
          <Stepper activeStep={activeIdx} alternativeLabel>
            {steps.map((s) => (
              <Step key={s.key}>
                <StepLabel>{s.label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </CardContent>
      </Card>

      {state.state.current_step === "choose_model" && (
        <ChooseModelStep busy={busy} onChoose={setModel} />
      )}
      {state.state.current_step === "email_branding" && (
        <EmailBrandingStep state={state} onNext={() => advance("email_branding")}
                            onSnack={setSnack} />
      )}
      {state.state.current_step === "verify_email" && (
        <VerifyEmailStep onNext={() => advance("verify_email")} onSnack={setSnack} />
      )}
      {state.state.current_step === "waba_credentials" && (
        <WabaCredentialsStep state={state} orgKey={state.org_key}
                              onNext={() => advance("waba_credentials")}
                              onSnack={setSnack} />
      )}
      {state.state.current_step === "validate_waba" && (
        <ValidateWabaStep state={state} onNext={() => advance("validate_waba")}
                           onSnack={setSnack} />
      )}
      {state.state.current_step === "sync_templates" && (
        <SyncTemplatesStep orgKey={state.org_key}
                            onNext={() => advance("sync_templates")}
                            onSnack={setSnack} />
      )}
      {state.state.current_step === "test_send" && (
        <TestSendStep state={state} onNext={() => advance("test_send")}
                       onSnack={setSnack} />
      )}
      {state.state.current_step === "activate" && (
        <ActivateStep busy={busy} onActivate={activate} />
      )}

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)}>
        <Alert severity={snack?.kind === "ok" ? "success" : "error"}
               onClose={() => setSnack(null)}>{snack?.msg}</Alert>
      </Snackbar>
    </Box>
  );
}

// ============================================================
// Steg-komponenter
// ============================================================
function ChooseModelStep({ busy, onChoose }: {
  busy: boolean; onChoose: (m: "shared" | "own_waba") => void;
}) {
  const [choice, setChoice] = useState<"shared" | "own_waba">("shared");
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          Hvordan vil dere sende WhatsApp-meldinger til kundene deres?
        </Typography>
        <FormControl component="fieldset">
          <RadioGroup value={choice} onChange={(_, v) => setChoice(v as any)}>
            <Box sx={{ display: "flex", alignItems: "flex-start", mb: 2,
                       p: 2, border: "1px solid", borderColor: choice === "shared" ? "primary.main" : "divider",
                       borderRadius: 1, cursor: "pointer" }}
                  onClick={() => setChoice("shared")}>
              <Radio value="shared" />
              <Box sx={{ flex: 1 }}>
                <Typography variant="body1" sx={{ fontWeight: 700 }}>
                  Delt nummer (anbefalt) <Chip size="small" label="3 trinn" color="success" sx={{ ml: 1 }} />
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Bruk Leadgrids felles WhatsApp Business-nummer. Vi sender med
                  din branding (logo, signatur). Du betaler ~0,15 NOK per melding.
                  Raskest å sette opp — ingen Meta-konto nødvendig.
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: "flex", alignItems: "flex-start",
                       p: 2, border: "1px solid", borderColor: choice === "own_waba" ? "primary.main" : "divider",
                       borderRadius: 1, cursor: "pointer" }}
                  onClick={() => setChoice("own_waba")}>
              <Radio value="own_waba" />
              <Box sx={{ flex: 1 }}>
                <Typography variant="body1" sx={{ fontWeight: 700 }}>
                  Eget telefonnummer (egen WABA) <Chip size="small" label="5 trinn" sx={{ ml: 1 }} />
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Bruk eget firmanummer. Du eier WhatsApp Business-kontoen,
                  betaler direkte til Meta (~0,12 NOK/melding utility).
                  Krever Meta Business Manager + tilgang til SMS/voice på nummeret.
                </Typography>
                <Link href="/docs/leadgrid/customer-onboarding.md" target="_blank"
                      sx={{ display: "inline-flex", alignItems: "center",
                            gap: 0.5, mt: 1, fontSize: 13 }}>
                  Les guiden <OpenInNewIcon sx={{ fontSize: 14 }} />
                </Link>
              </Box>
            </Box>
          </RadioGroup>
        </FormControl>
        <Box sx={{ mt: 3, textAlign: "right" }}>
          <Button variant="contained" disabled={busy}
                  onClick={() => onChoose(choice)}>
            Neste →
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}

function EmailBrandingStep({ state, onNext, onSnack }: {
  state: State; onNext: () => void;
  onSnack: (s: { kind: "ok" | "err"; msg: string }) => void;
}) {
  const ready = state.email_branding_exists && state.email_branding_has_sender;
  return (
    <Card>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1} mb={2}>
          <EmailIcon sx={{ color: "#a78bfa" }} />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Konfigurer e-post-branding</Typography>
        </Stack>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Sett opp avsender-info og branding som vises på e-postene Leadgrid
          sender til klientene dine. Logo, signatur, farger, footer.
        </Typography>

        {ready ? (
          <Alert severity="success" sx={{ mb: 2 }}>
            E-post-branding er konfigurert. Du kan gå videre.
          </Alert>
        ) : (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Du må konfigurere e-post-branding først.
            <Button size="small" href={`/admin-room/leadgrid?tab=email&org=${state.org_key}`}
                    target="_blank" sx={{ ml: 2 }}>
              Åpne branding-fanen ↗
            </Button>
          </Alert>
        )}

        <Box sx={{ textAlign: "right" }}>
          <Button variant="contained" onClick={onNext} disabled={!ready}>
            Neste →
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}

function VerifyEmailStep({ onNext, onSnack }: {
  onNext: () => void; onSnack: (s: { kind: "ok" | "err"; msg: string }) => void;
}) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const send = async () => {
    setSending(true);
    try {
      const r = await fetch("/api/leadgrid/onboarding/channels/test-send", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name: "Test-mottaker" }),
      });
      const j = await r.json();
      if (r.ok && j.sent > 0) {
        setSent(true);
        onSnack({ kind: "ok", msg: "Test-e-post sendt. Sjekk innboksen!" });
      } else onSnack({ kind: "err", msg: j?.error ?? "Ingen leveranse" });
    } finally { setSending(false); }
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          Test e-post-rendering
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Vi sender en test-e-post til adressen du skriver inn under for å verifisere
          at logoen, signaturen og brandingen er som forventet.
        </Typography>
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <TextField label="Test-e-postadresse" value={email}
                     onChange={(e) => setEmail(e.target.value)}
                     fullWidth size="small" />
          <Button variant="outlined" onClick={send} disabled={!email || sending}>
            {sending ? "Sender…" : "Send test"}
          </Button>
        </Stack>
        {sent && (
          <Alert severity="success" sx={{ mb: 2 }}>
            ✓ Sjekk innboksen og verifiser at e-posten ser riktig ut.
            Hvis ikke — gå tilbake og juster brandingen.
          </Alert>
        )}
        <Box sx={{ textAlign: "right" }}>
          <Button variant="contained" onClick={onNext} disabled={!sent}>
            Det ser bra ut — neste →
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}

function WabaCredentialsStep({ state, orgKey, onNext, onSnack }: {
  state: State; orgKey: string; onNext: () => void;
  onSnack: (s: { kind: "ok" | "err"; msg: string }) => void;
}) {
  const [form, setForm] = useState({
    business_account_id: "", phone_number_id: "", access_token: "",
    display_name: "", template_language: "nb",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch(`/api/superadmin/wa-org-configs/${encodeURIComponent(orgKey)}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (r.ok) { onSnack({ kind: "ok", msg: "Lagret" }); onNext(); }
      else onSnack({ kind: "err", msg: "Lagring feilet" });
    } finally { setSaving(false); }
  };

  const upd = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Card>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1} mb={2}>
          <WhatsAppIcon sx={{ color: "#25D366" }} />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>WABA-credentials</Typography>
        </Stack>
        <Alert severity="info" sx={{ mb: 3 }}>
          Du trenger 3 verdier fra Meta Business Manager. Se{" "}
          <Link href="/docs/leadgrid/customer-onboarding.md" target="_blank">
            steg-for-steg-guiden ↗
          </Link>.
        </Alert>
        <Stack spacing={2}>
          <TextField label="WhatsApp Business Account ID (WABA ID)"
                     value={form.business_account_id}
                     onChange={(e) => upd("business_account_id", e.target.value)}
                     fullWidth size="small"
                     helperText="16-sifret kode fra Meta Business Manager → WhatsApp Accounts" />
          <TextField label="Phone Number ID"
                     value={form.phone_number_id}
                     onChange={(e) => upd("phone_number_id", e.target.value)}
                     fullWidth size="small"
                     helperText="15-sifret kode fra Phone numbers-fanen i WABA" />
          <TextField label="System User Access Token"
                     value={form.access_token}
                     onChange={(e) => upd("access_token", e.target.value)}
                     fullWidth size="small" type="password"
                     placeholder="EAA..."
                     helperText="Generert under Business settings → System Users" />
          <TextField label="Display-navn (intern referanse)"
                     value={form.display_name}
                     onChange={(e) => upd("display_name", e.target.value)}
                     fullWidth size="small" />
        </Stack>
        <Box sx={{ mt: 3, textAlign: "right" }}>
          <Button variant="contained" onClick={save}
                  disabled={!form.business_account_id || !form.phone_number_id
                            || !form.access_token || saving}>
            {saving ? "Lagrer + validerer…" : "Lagre og valider →"}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}

function ValidateWabaStep({ state, onNext, onSnack }: {
  state: State; onNext: () => void;
  onSnack: (s: { kind: "ok" | "err"; msg: string }) => void;
}) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          Valider WABA-credentials
        </Typography>
        {state.waba_validated ? (
          <Alert severity="success" sx={{ mb: 2 }}>
            ✓ Credentials validert mot Meta API. WABA er klar.
          </Alert>
        ) : state.waba_validation_error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            Validering feilet: {state.waba_validation_error}
          </Alert>
        ) : (
          <Alert severity="info" sx={{ mb: 2 }}>
            Validerer mot Meta...
          </Alert>
        )}
        <Box sx={{ textAlign: "right" }}>
          <Button variant="contained" onClick={onNext}
                  disabled={!state.waba_validated}>
            Neste →
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}

function SyncTemplatesStep({ orgKey, onNext, onSnack }: {
  orgKey: string; onNext: () => void;
  onSnack: (s: { kind: "ok" | "err"; msg: string }) => void;
}) {
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);

  const sync = async () => {
    setSyncing(true);
    try {
      const r = await fetch("/api/superadmin/wa-templates/sync-leadgrid", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_key: orgKey }),
      });
      const j = await r.json();
      if (r.ok) {
        const created = j.results.filter((x: any) => x.action === "created").length;
        onSnack({ kind: "ok", msg: `${created} templates sendt til Meta for godkjenning` });
        setSynced(true);
      } else onSnack({ kind: "err", msg: "Sync feilet" });
    } finally { setSyncing(false); }
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          Sync Leadgrid-templates til WABA
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Vi sender alle 10 Leadgrid-templates (5 events × NO+EN) til Meta for godkjenning.
          UTILITY-templates godkjennes typisk innen 5-15 minutter.
        </Typography>
        {!synced ? (
          <Button variant="contained" onClick={sync} disabled={syncing}
                  startIcon={syncing ? <CircularProgress size={16} /> : null}>
            {syncing ? "Sender til Meta…" : "Sync nå"}
          </Button>
        ) : (
          <Alert severity="success" sx={{ mb: 2 }}>
            ✓ Templates sendt til Meta. Sjekk status i Templates-fanen — typisk APPROVED innen 15 min.
          </Alert>
        )}
        <Box sx={{ mt: 3, textAlign: "right" }}>
          <Button variant="contained" onClick={onNext} disabled={!synced}>
            Neste →
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}

function TestSendStep({ state, onNext, onSnack }: {
  state: State; onNext: () => void;
  onSnack: (s: { kind: "ok" | "err"; msg: string }) => void;
}) {
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const send = async () => {
    setSending(true);
    try {
      const r = await fetch("/api/leadgrid/onboarding/channels/test-send", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, name: "Test-mottaker" }),
      });
      const j = await r.json();
      if (r.ok && j.sent > 0) {
        setSent(true);
        onSnack({ kind: "ok", msg: "Test-WhatsApp sendt." });
      } else onSnack({ kind: "err", msg: j?.error ?? "Ingen leveranse" });
    } finally { setSending(false); }
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          Send test-WhatsApp
        </Typography>
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <TextField label="Test-mobilnummer (E.164)" value={phone}
                     onChange={(e) => setPhone(e.target.value)}
                     fullWidth size="small" placeholder="+47..." />
          <Button variant="outlined" onClick={send} disabled={!phone || sending}>
            {sending ? "Sender…" : "Send test"}
          </Button>
        </Stack>
        {sent && (
          <Alert severity="success" sx={{ mb: 2 }}>
            ✓ Sjekk WhatsApp og verifiser meldingen.
          </Alert>
        )}
        <Box sx={{ textAlign: "right" }}>
          <Button variant="contained" onClick={onNext} disabled={!sent}>
            Det funket — neste →
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}

function ActivateStep({ busy, onActivate }: {
  busy: boolean; onActivate: () => void;
}) {
  return (
    <Card>
      <CardContent>
        <Stack alignItems="center" spacing={2}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Klar til å aktivere?
          </Typography>
          <Typography color="text.secondary" textAlign="center">
            Når du klikker «Aktiver» vil Leadgrid heretter sende klient-varsler
            via den valgte kanal-strategien. Du kan endre dette senere i
            Innstillinger.
          </Typography>
          <Button variant="contained" size="large" disabled={busy}
                  onClick={onActivate}
                  startIcon={busy ? <CircularProgress size={16} /> : <CheckCircleIcon />}>
            {busy ? "Aktiverer…" : "Aktiver varslings-kanaler"}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
