/**
 * GrantWorkspacePanel.tsx — søknads-arbeidsboken (IN)
 *
 * Søknaden som objekt: seksjoner med livssyklus (tom → utkast → revisjon
 * → ferdig), automatisk [FYLL INN]-sjekkliste og samlet eksport.
 * Sjekklisten er ferdig-definisjonen — panelet sier ærlig fra når
 * søknaden IKKE er innsendingsklar.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog,
  DialogActions, DialogContent, DialogTitle, LinearProgress, MenuItem,
  Select, Stack, TextField, Typography,
} from "@mui/material";
import {
  Description as GrantIcon,
  Download as ExportIcon,
} from "@mui/icons-material";

interface Section {
  sectionKey: string;
  title: string;
  guidance: string;
  status: "empty" | "drafted" | "review" | "done";
  draftText: string | null;
  userNotes: string | null;
  fillIns: string[];
}

interface Application {
  id: string;
  solution: string;
  program: string;
  title: string;
  sections: Section[];
  progress: { total: number; done: number; drafted: number; openFillIns: number };
}

const STATUS_STYLE: Record<string, { label: string; color: string }> = {
  empty: { label: "Tom", color: "#94a3b8" },
  drafted: { label: "Utkast", color: "#60a5fa" },
  review: { label: "Revisjon", color: "#f59e0b" },
  done: { label: "Ferdig", color: "#4ade80" },
};

function authHeaders(): Record<string, string> {
  const token =
    localStorage.getItem("creatorhub_auth_token") ?? localStorage.getItem("token") ?? "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function GrantWorkspacePanel() {
  const [apps, setApps] = useState<Array<{ id: string; title: string }>>([]);
  const [selected, setSelected] = useState<string>("");
  const [app, setApp] = useState<Application | null>(null);
  const [openSection, setOpenSection] = useState<Section | null>(null);
  const [notes, setNotes] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newSolution, setNewSolution] = useState("theroleroom");

  const loadList = useCallback(async () => {
    const r = await fetch("/api/integrations/grant-workspace", { credentials: "include", headers: authHeaders() });
    if (!r.ok) return;
    const list = (await r.json()).applications ?? [];
    setApps(list);
    if (list.length > 0 && !selected) setSelected(list[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const loadApp = useCallback(async (id: string) => {
    if (!id) return;
    const r = await fetch(`/api/integrations/grant-workspace/${id}`, { credentials: "include", headers: authHeaders() });
    if (r.ok) setApp((await r.json()).application);
  }, []);

  useEffect(() => { void loadList(); }, [loadList]);
  useEffect(() => { void loadApp(selected); }, [selected, loadApp]);

  const createApp = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/integrations/grant-workspace", {
        method: "POST", credentials: "include",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          solution: newSolution,
          program: "Oppstartstilskudd 1 (markedsavklaring)",
          title: `IN-søknad — ${newSolution === "theroleroom" ? "The Role Room" : newSolution === "leadgrid" ? "Leadgrid" : "CreatorHub"} som spydspiss`,
        }),
      });
      if (r.ok) {
        const { id } = await r.json();
        await loadList();
        setSelected(id);
      }
    } finally { setBusy(false); }
  };

  const openEditor = (s: Section) => {
    setOpenSection(s);
    setNotes(s.userNotes ?? "");
    setDraft(s.draftText ?? "");
    setError(null);
  };

  const saveSection = async (patch: Record<string, unknown>) => {
    if (!app || !openSection) return;
    setBusy(true);
    try {
      await fetch(`/api/integrations/grant-workspace/${app.id}/sections/${openSection.sectionKey}`, {
        method: "PATCH", credentials: "include",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      await loadApp(app.id);
    } finally { setBusy(false); }
  };

  const generateDraft = async () => {
    if (!app || !openSection) return;
    setBusy(true);
    setError(null);
    try {
      await saveSection({ userNotes: notes });
      const r = await fetch(
        `/api/integrations/grant-workspace/${app.id}/sections/${openSection.sectionKey}/draft`,
        { method: "POST", credentials: "include", headers: authHeaders() },
      );
      if (!r.ok) {
        const body = await r.json().catch(() => null);
        setError(body?.error === "utkast_besto_ikke_siterings_validering"
          ? "JARVIS fant på tall og ble avvist — prøv igjen."
          : `Utkast feilet (${body?.error ?? r.status})`);
        return;
      }
      await loadApp(app.id);
      const updated = (await (await fetch(`/api/integrations/grant-workspace/${app.id}`, { credentials: "include", headers: authHeaders() })).json()).application as Application;
      const fresh = updated.sections.find((s) => s.sectionKey === openSection.sectionKey);
      if (fresh) { setDraft(fresh.draftText ?? ""); setOpenSection(fresh); }
    } finally { setBusy(false); }
  };

  return (
    <Card>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }} flexWrap="wrap" useFlexGap>
          <GrantIcon sx={{ color: "#a78bfa" }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Søknads-arbeidsbok (IN)</Typography>
          {app && (
            <Chip size="small"
              label={`${app.progress.done}/${app.progress.total} ferdige · ${app.progress.openFillIns} åpne hull`}
              sx={{
                bgcolor: app.progress.openFillIns === 0 && app.progress.done === app.progress.total ? "#4ade8022" : "#f59e0b22",
                color: app.progress.openFillIns === 0 && app.progress.done === app.progress.total ? "#4ade80" : "#f59e0b",
                fontWeight: 700,
              }} />
          )}
          <Box sx={{ flex: 1 }} />
          {app && (
            <Button size="small" startIcon={<ExportIcon />} component="a"
              href={`/api/integrations/grant-workspace/${app.id}/export`} target="_blank">
              Eksporter
            </Button>
          )}
        </Stack>

        <Stack direction="row" spacing={1} sx={{ mb: 1.5 }} flexWrap="wrap" useFlexGap>
          {apps.length > 0 && (
            <Select size="small" value={selected} onChange={(e) => setSelected(e.target.value)} sx={{ minWidth: 280 }}>
              {apps.map((a) => <MenuItem key={a.id} value={a.id}>{a.title}</MenuItem>)}
            </Select>
          )}
          <Select size="small" value={newSolution} onChange={(e) => setNewSolution(e.target.value)}>
            <MenuItem value="theroleroom">The Role Room</MenuItem>
            <MenuItem value="leadgrid">Leadgrid</MenuItem>
            <MenuItem value="creatorhub">CreatorHub</MenuItem>
          </Select>
          <Button size="small" variant="outlined" onClick={() => void createApp()} disabled={busy}>
            Ny søknad
          </Button>
        </Stack>

        {app && (
          <Stack spacing={0.75}>
            {app.sections.map((s) => {
              const st = STATUS_STYLE[s.status];
              return (
                <Stack key={s.sectionKey} direction="row" alignItems="center" spacing={1}
                  onClick={() => openEditor(s)}
                  sx={{ p: 1, borderRadius: 1, border: "1px solid rgba(148,163,184,0.2)", cursor: "pointer",
                        "&:hover": { bgcolor: "rgba(167,139,250,0.06)" } }}>
                  <Chip size="small" label={st.label}
                    sx={{ bgcolor: `${st.color}22`, color: st.color, fontWeight: 700, width: 76, height: 20, fontSize: 10 }} />
                  <Typography variant="body2" sx={{ flex: 1, fontWeight: 600 }}>{s.title}</Typography>
                  {s.fillIns.length > 0 && s.status !== "done" && (
                    <Chip size="small" variant="outlined" label={`${s.fillIns.length} hull`}
                      sx={{ height: 18, fontSize: 10, color: "#f59e0b", borderColor: "#f59e0b55" }} />
                  )}
                </Stack>
              );
            })}
          </Stack>
        )}
        {!app && apps.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            Ingen søknader ennå — velg løsning og opprett den første. JARVIS henter
            bevisene og skriver seksjon for seksjon; du eier teksten.
          </Typography>
        )}
      </CardContent>

      <Dialog open={openSection !== null} onClose={() => setOpenSection(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontSize: "1rem" }}>{openSection?.title}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5}>
            <Alert severity="info" icon={false} sx={{ fontSize: "0.8rem" }}>
              IN-veiledning: {openSection?.guidance}
            </Alert>
            <TextField label="Dine notater (JARVIS bruker dem i utkastet)" multiline minRows={2}
              value={notes} onChange={(e) => setNotes(e.target.value)} fullWidth size="small" />
            <Stack direction="row" spacing={1}>
              <Button variant="contained" onClick={() => void generateDraft()} disabled={busy}
                startIcon={busy ? <CircularProgress size={14} /> : undefined}>
                {openSection?.draftText ? "Nytt JARVIS-utkast" : "JARVIS-utkast"}
              </Button>
              <Button onClick={() => void saveSection({ userNotes: notes, draftText: draft })} disabled={busy}>
                Lagre
              </Button>
              <Box sx={{ flex: 1 }} />
              {(["review", "done"] as const).map((st) => (
                <Button key={st} size="small" variant={openSection?.status === st ? "contained" : "outlined"}
                  onClick={() => void saveSection({ status: st })}>
                  {STATUS_STYLE[st].label}
                </Button>
              ))}
            </Stack>
            {error && <Alert severity="warning">{error}</Alert>}
            <TextField label="Seksjonstekst (din å redigere)" multiline minRows={8} maxRows={18}
              value={draft} onChange={(e) => setDraft(e.target.value)} fullWidth size="small" />
            {(openSection?.fillIns.length ?? 0) > 0 && (
              <Alert severity="warning" icon={false}>
                <Typography variant="caption" sx={{ fontWeight: 700, display: "block" }}>
                  Åpne utfyllingspunkter ([FYLL INN]):
                </Typography>
                {openSection!.fillIns.map((f, i) => (
                  <Typography key={i} variant="caption" sx={{ display: "block" }}>• {f}</Typography>
                ))}
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenSection(null)}>Lukk</Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
