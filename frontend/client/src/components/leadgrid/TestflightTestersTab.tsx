/**
 * TestflightTestersTab.tsx
 *
 * Superadmin-UI for TestFlight-tester-flyten:
 *   - Liste av testere m/ status (invited/active/graduated/removed)
 *   - Signering-checkliste (NDA + intent)
 *   - "Send NDA" / "Send intent" hvis ikke sendt
 *   - "Graduate" når begge er signert
 *   - "Legg til tester"-dialog
 */

import React, { useEffect, useState, useCallback } from "react";
import {
  Box, Stack, Typography, Button, IconButton, Tooltip, Chip, Avatar,
  Card, CardContent, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, FormControl, InputLabel, Select, MenuItem, Alert, Divider,
  Snackbar, CircularProgress, Drawer, List, ListItem, ListItemText,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import SendIcon from "@mui/icons-material/Send";
import GavelIcon from "@mui/icons-material/Gavel";
import SchoolIcon from "@mui/icons-material/School";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import PhoneIphoneIcon from "@mui/icons-material/PhoneIphone";
import RefreshIcon from "@mui/icons-material/Refresh";
import { apiFetch } from "@/lib/queryClient";

interface Tester {
  id: string;
  email: string;
  full_name: string | null;
  apple_id: string | null;
  organization_id: string;
  org_name: string;
  org_type: string;
  plan: string;
  app_bundle_id: string | null;
  app_version: string | null;
  status: string;
  invited_at: string;
  accepted_invite_at: string | null;
  graduated_at: string | null;
  graduated_to_org_id: string | null;
  graduated_to_org_name: string | null;
  removed_at: string | null;
  nda_agreement_id: string | null;
  intent_agreement_id: string | null;
  nda_signed_at: string | null;
  intent_signed_at: string | null;
  nda_status: string | null;
  intent_status: string | null;
  nda_sign_token: string | null;
  intent_sign_token: string | null;
  notes: string | null;
}

export default function TestflightTestersTab() {
  const [testers, setTesters] = useState<Tester[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [selectedTester, setSelectedTester] = useState<Tester | null>(null);
  const [graduateOpen, setGraduateOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<{ msg: string; severity: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiFetch("/api/superadmin/testflight-testers");
      if (r.ok) {
        const d = await r.json();
        setTesters(d.testers ?? []);
      }
    } catch (e) { setSnackbar({ msg: String(e), severity: "error" }); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === "all" ? testers : testers.filter((t) => t.status === filter);

  // Stats
  const stats = {
    total: testers.length,
    invited: testers.filter((t) => t.status === "invited").length,
    active: testers.filter((t) => t.status === "active").length,
    graduated: testers.filter((t) => t.status === "graduated").length,
    nda_signed: testers.filter((t) => t.nda_signed_at).length,
    intent_signed: testers.filter((t) => t.intent_signed_at).length,
  };

  const sendNda = async (testerId: string) => {
    const r = await apiFetch(`/api/superadmin/testflight-testers/${testerId}/send-nda`, { method: "POST" });
    const d = await r.json();
    if (r.ok) {
      setSnackbar({ msg: "NDA sendt", severity: "success" });
      load();
    } else {
      setSnackbar({ msg: d.error ?? "Feil", severity: "error" });
    }
  };

  const sendIntent = async (testerId: string) => {
    const r = await apiFetch(`/api/superadmin/testflight-testers/${testerId}/send-intent`, { method: "POST" });
    const d = await r.json();
    if (r.ok) {
      setSnackbar({ msg: "Intent-avtale sendt", severity: "success" });
      load();
    } else {
      setSnackbar({ msg: d.error ?? "Feil", severity: "error" });
    }
  };

  const removeTester = async (testerId: string) => {
    if (!window.confirm("Fjerne testeren? Avtalene beholdes i audit-loggen.")) return;
    const r = await apiFetch(`/api/superadmin/testflight-testers/${testerId}/remove`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Fjernet av superadmin" }),
    });
    if (r.ok) { setSnackbar({ msg: "Tester fjernet", severity: "success" }); load(); }
  };

  return (
    <Box>
      {/* Stats-rad */}
      <Stack direction="row" spacing={2} mb={3}>
        {[
          { label: "Totalt", value: stats.total, color: "rgba(255,255,255,0.7)" },
          { label: "Invitert", value: stats.invited, color: "#ffb86b" },
          { label: "Aktive", value: stats.active, color: "#9be15d" },
          { label: "Gradert", value: stats.graduated, color: "#a78bfa" },
          { label: "NDA signert", value: `${stats.nda_signed}/${stats.total}`, color: "#7ab8ff" },
          { label: "Intent signert", value: `${stats.intent_signed}/${stats.total}`, color: "#f472b6" },
        ].map((k) => (
          <Card key={k.label} sx={{ flex: 1, bgcolor: "rgba(255,255,255,0.05)", color: "#fff" }}>
            <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
              <Typography variant="overline" sx={{ color: "rgba(255,255,255,0.5)", fontSize: 10 }}>{k.label}</Typography>
              <Typography variant="h5" sx={{ color: k.color, fontWeight: 700 }}>{k.value}</Typography>
            </CardContent>
          </Card>
        ))}
      </Stack>

      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography variant="h6">TestFlight-testere</Typography>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <Select
              value={filter} onChange={(e) => setFilter(e.target.value)}
              sx={{ color: "#fff", "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.15)" } }}
            >
              <MenuItem value="all">Alle statuser</MenuItem>
              <MenuItem value="invited">Invitert</MenuItem>
              <MenuItem value="active">Aktive</MenuItem>
              <MenuItem value="graduated">Gradert</MenuItem>
              <MenuItem value="removed">Fjernet</MenuItem>
            </Select>
          </FormControl>
          <Tooltip title="Oppdater">
            <IconButton onClick={load} sx={{ color: "rgba(255,255,255,0.6)" }}><RefreshIcon /></IconButton>
          </Tooltip>
        </Stack>
        <Button
          variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}
          sx={{ bgcolor: "#9be15d", color: "#0a0e1a", "&:hover": { bgcolor: "#7fb849" } }}
        >
          Legg til tester
        </Button>
      </Stack>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>
      ) : filtered.length === 0 ? (
        <Card sx={{ bgcolor: "rgba(255,255,255,0.03)", color: "#fff" }}>
          <CardContent sx={{ textAlign: "center", py: 6 }}>
            <PhoneIphoneIcon sx={{ fontSize: 48, color: "rgba(255,255,255,0.3)", mb: 2 }} />
            <Typography variant="h6" color="rgba(255,255,255,0.7)">Ingen testere ennå</Typography>
            <Typography variant="body2" color="rgba(255,255,255,0.4)" mt={1}>
              Legg til din første TestFlight-tester for å starte
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={1.5}>
          {filtered.map((t) => (
            <TesterCard
              key={t.id}
              tester={t}
              onSendNda={() => sendNda(t.id)}
              onSendIntent={() => sendIntent(t.id)}
              onGraduate={() => { setSelectedTester(t); setGraduateOpen(true); }}
              onRemove={() => removeTester(t.id)}
              onView={() => setSelectedTester(t)}
            />
          ))}
        </Stack>
      )}

      <AddTesterDialog
        open={addOpen} onClose={() => setAddOpen(false)}
        onAdded={() => { setAddOpen(false); load(); setSnackbar({ msg: "Tester lagt til", severity: "success" }); }}
        onError={(msg) => setSnackbar({ msg, severity: "error" })}
      />

      {selectedTester && (
        <GraduateDialog
          open={graduateOpen} onClose={() => setGraduateOpen(false)}
          tester={selectedTester}
          onGraduated={() => { setGraduateOpen(false); load(); setSnackbar({ msg: "Gradert!", severity: "success" }); }}
          onError={(msg) => setSnackbar({ msg, severity: "error" })}
        />
      )}

      <Snackbar
        open={!!snackbar} autoHideDuration={4000} onClose={() => setSnackbar(null)}
        message={snackbar?.msg}
      />
    </Box>
  );
}

function TesterCard({
  tester, onSendNda, onSendIntent, onGraduate, onRemove, onView,
}: {
  tester: Tester;
  onSendNda: () => void;
  onSendIntent: () => void;
  onGraduate: () => void;
  onRemove: () => void;
  onView: () => void;
}) {
  const statusColor = tester.status === "active" ? "#9be15d"
                    : tester.status === "graduated" ? "#a78bfa"
                    : tester.status === "removed" ? "#ff6b6b"
                    : "#ffb86b";

  const ndaDone = !!tester.nda_signed_at;
  const intentDone = !!tester.intent_signed_at;
  const ndaSent = !!tester.nda_agreement_id;
  const intentSent = !!tester.intent_agreement_id;
  const canGraduate = ndaDone && intentDone && tester.status !== "graduated" && tester.status !== "removed";

  const initial = tester.full_name?.[0]?.toUpperCase() ?? tester.email[0]?.toUpperCase() ?? "?";

  return (
    <Card sx={{
      bgcolor: "rgba(255,255,255,0.05)", color: "#fff",
      border: `1px solid ${statusColor}40`,
    }}>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Avatar sx={{ bgcolor: statusColor, color: "#0a0e1a", fontWeight: 700 }}>{initial}</Avatar>
          <Box flex={1}>
            <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
              <Typography variant="h6">{tester.full_name ?? tester.email}</Typography>
              <Chip size="small" label={tester.status}
                    sx={{ bgcolor: statusColor, color: "#0a0e1a", fontWeight: 600 }} />
              {tester.app_bundle_id && (
                <Chip size="small" label={tester.app_bundle_id} variant="outlined"
                      sx={{ color: "rgba(255,255,255,0.7)", borderColor: "rgba(255,255,255,0.2)" }} />
              )}
              {tester.app_version && <Chip size="small" label={`v${tester.app_version}`} variant="outlined"
                    sx={{ color: "rgba(255,255,255,0.7)", borderColor: "rgba(255,255,255,0.2)" }} />}
            </Stack>
            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)" }}>
              {tester.email} · {tester.org_name}
              {tester.invited_at && ` · invitert ${new Date(tester.invited_at).toLocaleDateString("no-NO")}`}
            </Typography>

            {/* Signering-checkliste */}
            <Stack direction="row" spacing={3} mt={1.5}>
              <Stack direction="row" alignItems="center" spacing={0.8}>
                {ndaDone ? (
                  <CheckCircleIcon sx={{ color: "#9be15d", fontSize: 18 }} />
                ) : ndaSent ? (
                  <RadioButtonUncheckedIcon sx={{ color: "#ffb86b", fontSize: 18 }} />
                ) : (
                  <RadioButtonUncheckedIcon sx={{ color: "rgba(255,255,255,0.3)", fontSize: 18 }} />
                )}
                <Typography variant="caption" sx={{ color: ndaDone ? "#9be15d" : ndaSent ? "#ffb86b" : "rgba(255,255,255,0.5)" }}>
                  NDA {ndaDone ? "signert" : ndaSent ? "ventes" : "ikke sendt"}
                </Typography>
              </Stack>
              <Stack direction="row" alignItems="center" spacing={0.8}>
                {intentDone ? (
                  <CheckCircleIcon sx={{ color: "#9be15d", fontSize: 18 }} />
                ) : intentSent ? (
                  <RadioButtonUncheckedIcon sx={{ color: "#ffb86b", fontSize: 18 }} />
                ) : (
                  <RadioButtonUncheckedIcon sx={{ color: "rgba(255,255,255,0.3)", fontSize: 18 }} />
                )}
                <Typography variant="caption" sx={{ color: intentDone ? "#9be15d" : intentSent ? "#ffb86b" : "rgba(255,255,255,0.5)" }}>
                  Intent {intentDone ? "signert" : intentSent ? "ventes" : "ikke sendt"}
                </Typography>
              </Stack>
              {tester.graduated_at && (
                <Stack direction="row" alignItems="center" spacing={0.8}>
                  <SchoolIcon sx={{ color: "#a78bfa", fontSize: 18 }} />
                  <Typography variant="caption" sx={{ color: "#a78bfa" }}>
                    Gradert {new Date(tester.graduated_at).toLocaleDateString("no-NO")}
                  </Typography>
                </Stack>
              )}
            </Stack>
          </Box>

          <Stack direction="column" spacing={1}>
            {!ndaSent && tester.status !== "removed" && tester.status !== "graduated" && (
              <Button size="small" variant="outlined" startIcon={<GavelIcon />} onClick={onSendNda}
                      sx={{ color: "#ffb86b", borderColor: "rgba(255,184,107,0.4)" }}>
                Send NDA
              </Button>
            )}
            {ndaSent && !intentSent && tester.status !== "removed" && tester.status !== "graduated" && (
              <Button size="small" variant="outlined" startIcon={<SendIcon />} onClick={onSendIntent}
                      sx={{ color: "#7ab8ff", borderColor: "rgba(122,184,255,0.4)" }}>
                Send intent
              </Button>
            )}
            {canGraduate && (
              <Button size="small" variant="contained" startIcon={<SchoolIcon />} onClick={onGraduate}
                      sx={{ bgcolor: "#a78bfa", color: "#0a0e1a", fontWeight: 700, "&:hover": { bgcolor: "#9171e6" } }}>
                Graduate
              </Button>
            )}
            {tester.status !== "removed" && tester.status !== "graduated" && (
              <Tooltip title="Fjern tester">
                <IconButton size="small" onClick={onRemove} sx={{ color: "rgba(255,107,107,0.7)" }}>
                  <RemoveCircleOutlineIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Add Tester Dialog
// ---------------------------------------------------------------------------

function AddTesterDialog({
  open, onClose, onAdded, onError,
}: {
  open: boolean; onClose: () => void; onAdded: () => void; onError: (msg: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [appleId, setAppleId] = useState("");
  const [appBundleId, setAppBundleId] = useState("com.creatorhub.leadmap");
  const [appVersion, setAppVersion] = useState("");
  const [orgName, setOrgName] = useState("");
  const [notes, setNotes] = useState("");
  const [autoSend, setAutoSend] = useState({ nda: true, intent: true });
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      const r = await apiFetch("/api/superadmin/testflight-testers", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email, fullName: fullName || undefined, appleId: appleId || undefined,
          appBundleId: appBundleId || undefined, appVersion: appVersion || undefined,
          orgName: orgName || undefined, notes: notes || undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) { onError(d.error ?? "Feil"); setSubmitting(false); return; }
      // Auto-send avtaler hvis ønsket
      if (autoSend.nda) {
        try { await apiFetch(`/api/superadmin/testflight-testers/${d.tester_id}/send-nda`, { method: "POST" }); }
        catch { /* ignore */ }
      }
      if (autoSend.intent) {
        try { await apiFetch(`/api/superadmin/testflight-testers/${d.tester_id}/send-intent`, { method: "POST" }); }
        catch { /* ignore */ }
      }
      // Reset
      setEmail(""); setFullName(""); setAppleId(""); setAppVersion("");
      setOrgName(""); setNotes("");
      onAdded();
    } catch (e: any) { onError(String(e?.message ?? e)); }
    setSubmitting(false);
  };

  const inputSx = {
    "& .MuiOutlinedInput-root": { color: "#fff", "& fieldset": { borderColor: "rgba(255,255,255,0.15)" } },
    "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.6)" },
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
            PaperProps={{ sx: { bgcolor: "#0a0512", color: "#fff" } }}>
      <DialogTitle>Legg til TestFlight-tester</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField fullWidth required label="E-post" type="email" value={email}
                     onChange={(e) => setEmail(e.target.value)} sx={inputSx}
                     placeholder="ola@bedrift.no" />
          <TextField fullWidth label="Fullt navn" value={fullName}
                     onChange={(e) => setFullName(e.target.value)} sx={inputSx} />
          <Stack direction="row" spacing={2}>
            <TextField fullWidth label="Apple ID (valgfritt)" value={appleId}
                       onChange={(e) => setAppleId(e.target.value)} sx={inputSx} />
            <TextField fullWidth label="App-versjon" value={appVersion}
                       onChange={(e) => setAppVersion(e.target.value)} sx={inputSx}
                       placeholder="1.0.0" />
          </Stack>
          <FormControl fullWidth>
            <InputLabel sx={{ color: "rgba(255,255,255,0.6)" }}>App</InputLabel>
            <Select value={appBundleId} label="App"
                    onChange={(e) => setAppBundleId(e.target.value)}
                    sx={{ color: "#fff" }}>
              <MenuItem value="com.creatorhub.leadmap">Lead Map / Leadgrid (iPad)</MenuItem>
              <MenuItem value="com.theroleroom.app">The Role Room (iPhone)</MenuItem>
              <MenuItem value="com.creatorhub.capture">Capture (iPad)</MenuItem>
              <MenuItem value="com.creatorhub.easeverse">EaseVerse (iPhone)</MenuItem>
            </Select>
          </FormControl>
          <TextField fullWidth label="Organisasjons-navn (valgfritt)" value={orgName}
                     onChange={(e) => setOrgName(e.target.value)} sx={inputSx}
                     placeholder="Hvis tom: '{navn} (beta)'" />
          <TextField fullWidth multiline rows={2} label="Notater" value={notes}
                     onChange={(e) => setNotes(e.target.value)} sx={inputSx} />
          <Divider sx={{ borderColor: "rgba(255,255,255,0.1)" }} />
          <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)" }}>
            Auto-send avtaler etter at testeren er lagt til:
          </Typography>
          <Stack direction="row" spacing={2}>
            <Chip
              icon={<GavelIcon />} label="Send NDA automatisk"
              onClick={() => setAutoSend((p) => ({ ...p, nda: !p.nda }))}
              sx={{
                bgcolor: autoSend.nda ? "rgba(155,225,93,0.2)" : "rgba(255,255,255,0.04)",
                color: autoSend.nda ? "#9be15d" : "rgba(255,255,255,0.5)",
                cursor: "pointer",
              }}
            />
            <Chip
              icon={<SendIcon />} label="Send intent automatisk"
              onClick={() => setAutoSend((p) => ({ ...p, intent: !p.intent }))}
              sx={{
                bgcolor: autoSend.intent ? "rgba(155,225,93,0.2)" : "rgba(255,255,255,0.04)",
                color: autoSend.intent ? "#9be15d" : "rgba(255,255,255,0.5)",
                cursor: "pointer",
              }}
            />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Avbryt</Button>
        <Button variant="contained" disabled={!email || submitting} onClick={submit}
                sx={{ bgcolor: "#9be15d", color: "#0a0e1a", fontWeight: 700 }}>
          {submitting ? "Legger til…" : "Legg til"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Graduate Dialog
// ---------------------------------------------------------------------------

function GraduateDialog({
  open, onClose, tester, onGraduated, onError,
}: {
  open: boolean; onClose: () => void; tester: Tester;
  onGraduated: () => void; onError: (msg: string) => void;
}) {
  const [orgType, setOrgType] = useState<"customer" | "agency">("customer");
  const [plan, setPlan] = useState<"solo_pro" | "agency">("solo_pro");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      const r = await apiFetch(`/api/superadmin/testflight-testers/${tester.id}/graduate`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ graduateToOrgType: orgType, graduateToPlan: plan }),
      });
      const d = await r.json();
      if (!r.ok) { onError(d.error ?? "Feil"); setSubmitting(false); return; }
      onGraduated();
    } catch (e: any) { onError(String(e?.message ?? e)); }
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
            PaperProps={{ sx: { bgcolor: "#0a0512", color: "#fff" } }}>
      <DialogTitle>
        Graduate {tester.full_name ?? tester.email}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Alert severity="success" icon={<SchoolIcon />}>
            Testeren har signert både NDA og intent. Du kan nå konvertere
            beta-test-organisasjonen til en ordinær Leadgrid-org.
          </Alert>
          <Alert severity="info">
            Som takk for innsatsen får organisasjonen <strong>Solo Pro gratis i 6 måneder</strong>.
          </Alert>
          <FormControl fullWidth>
            <InputLabel sx={{ color: "rgba(255,255,255,0.6)" }}>Org-type</InputLabel>
            <Select value={orgType} label="Org-type"
                    onChange={(e) => setOrgType(e.target.value as any)}
                    sx={{ color: "#fff" }}>
              <MenuItem value="customer">Customer — solo-bruker</MenuItem>
              <MenuItem value="agency">Agency — byrå m/ flere brukere</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel sx={{ color: "rgba(255,255,255,0.6)" }}>Plan etter graduate</InputLabel>
            <Select value={plan} label="Plan etter graduate"
                    onChange={(e) => setPlan(e.target.value as any)}
                    sx={{ color: "#fff" }}>
              <MenuItem value="solo_pro">Solo Pro (gratis i 6 mnd)</MenuItem>
              <MenuItem value="agency">Agency (gratis i 6 mnd)</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Avbryt</Button>
        <Button variant="contained" disabled={submitting} onClick={submit}
                sx={{ bgcolor: "#a78bfa", color: "#0a0e1a", fontWeight: 700 }}>
          {submitting ? "Graduerer…" : "Graduate"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
