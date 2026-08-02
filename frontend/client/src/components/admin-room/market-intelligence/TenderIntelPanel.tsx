/**
 * TenderIntelPanel.tsx — anbudsintelligens i MI
 *
 * To ting: «Hva krever markedet?» (aggregat over innsamlede anbud per
 * vertikal, deterministisk leksikon — ærlig merket som nedre grense) og
 * leverandørprofilen (kapabilitetene kan-vi-levere-vurderingen bygger på).
 */

import { useCallback, useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Checkbox, Chip, Dialog,
  DialogActions, DialogContent, DialogTitle, FormControlLabel,
  LinearProgress, Stack, Typography,
} from "@mui/material";
import {
  Gavel as TenderIcon,
  FactCheck as ProfileIcon,
} from "@mui/icons-material";
import PanelStateContainer, { toLoadingState } from "./PanelStateContainer";

interface RequirementShare {
  key: string;
  label: string;
  hits: number;
  share: number;
}

interface VerticalRequirements {
  topic: string;
  tenders: number;
  requirements: RequirementShare[];
}

const CAPABILITY_LABELS: Record<string, string> = {
  miljo: "Miljøkrav (Miljøfyrtårn/ISO 14001)",
  kvalitet: "Kvalitetssystem (ISO 9001)",
  sikkerhet: "Sikkerhetsklarering",
  personvern: "Personvern/GDPR (databehandleravtale)",
  universell: "Universell utforming (WCAG)",
  laerling: "Lærlingordning",
  ehf: "EHF-faktura",
};

function authHeaders(): Record<string, string> {
  const token =
    localStorage.getItem("creatorhub_auth_token") ?? localStorage.getItem("token") ?? "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function TenderIntelPanel() {
  const [verticals, setVerticals] = useState<VerticalRequirements[]>([]);
  const [note, setNote] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profileOpen, setProfileOpen] = useState(false);
  const [capabilities, setCapabilities] = useState<Record<string, boolean>>({});
  const [profileExists, setProfileExists] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [reqRes, profRes] = await Promise.all([
        fetch("/api/integrations/tender-requirements", { credentials: "include", headers: authHeaders() }),
        fetch("/api/integrations/supplier-profile", { credentials: "include", headers: authHeaders() }),
      ]);
      if (!reqRes.ok) {
        setError(`HTTP ${reqRes.status}`);
        return;
      }
      const reqBody = await reqRes.json();
      setVerticals(reqBody.verticals ?? []);
      setNote(reqBody.note ?? "");
      if (profRes.ok) {
        const p = (await profRes.json()).profile;
        setProfileExists(Boolean(p));
        setCapabilities(p?.capabilities ?? {});
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const saveProfile = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const r = await fetch("/api/integrations/supplier-profile", {
        method: "PUT",
        credentials: "include",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ capabilities }),
      });
      if (!r.ok) {
        setSaveError(`HTTP ${r.status}`);
        return;
      }
      setProfileOpen(false);
      setProfileExists(true);
    } catch (e) {
      setSaveError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <TenderIcon sx={{ color: "#c084fc" }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Anbud — hva krever markedet?
            </Typography>
          </Stack>
          <Button size="small" startIcon={<ProfileIcon />} onClick={() => setProfileOpen(true)}
            color={profileExists ? "inherit" : "warning"}>
            {profileExists ? "Leverandørprofil" : "Fyll leverandørprofil"}
          </Button>
        </Stack>

        {!profileExists && !loading && (
          <Alert severity="warning" sx={{ mb: 1.5 }}>
            Leverandørprofilen er ikke utfylt — «kan vi levere»-vurderingen i
            tilbudsstrategi-briefene viser UBESVART til den er på plass (~2 min).
          </Alert>
        )}

        <PanelStateContainer
          state={toLoadingState({ loading, error })}
          error={error}
          onRetry={load}
          isEmpty={verticals.length === 0}
          empty="Ingen anbud samlet ennå — kravbildet bygges etter hvert som triggerne fyller på."
        >
          <Stack spacing={1.5}>
            {verticals.map((v) => (
              <Box key={v.topic}>
                <Typography variant="caption" sx={{ fontWeight: 700 }}>
                  {v.topic} <span style={{ opacity: 0.6 }}>· {v.tenders} anbud siste 180 dager</span>
                </Typography>
                {v.requirements.length === 0 ? (
                  <Typography variant="caption" color="text.disabled" sx={{ display: "block" }}>
                    Ingen leksikon-krav funnet i kunngjøringstekstene ennå.
                  </Typography>
                ) : (
                  <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                    {v.requirements.map((r) => (
                      <Stack key={r.key} direction="row" alignItems="center" spacing={1}>
                        <Typography variant="caption" sx={{ width: 150 }}>{r.label}</Typography>
                        <LinearProgress variant="determinate" value={r.share * 100}
                          sx={{ flex: 1, height: 6, borderRadius: 3 }} />
                        <Typography variant="caption" sx={{ width: 70, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                          {Math.round(r.share * 100)} % ({r.hits})
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                )}
              </Box>
            ))}
          </Stack>
        </PanelStateContainer>

        {note && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
            {note}
          </Typography>
        )}
      </CardContent>

      <Dialog open={profileOpen} onClose={() => setProfileOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Leverandørprofil</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Hva kan dere dokumentere i et tilbud? Ubesvart = ukjent i
            vurderingen — kryss av det som stemmer, la resten stå.
          </Typography>
          <Stack>
            {Object.entries(CAPABILITY_LABELS).map(([key, label]) => (
              <FormControlLabel key={key}
                control={
                  <Checkbox
                    checked={capabilities[key] === true}
                    indeterminate={capabilities[key] === undefined}
                    onChange={(e) => setCapabilities((c) => ({ ...c, [key]: e.target.checked }))}
                  />
                }
                label={<Typography variant="body2">{label}</Typography>}
              />
            ))}
          </Stack>
          {saveError && <Alert severity="error" sx={{ mt: 1 }}>{saveError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProfileOpen(false)}>Avbryt</Button>
          <Button variant="contained" onClick={() => void saveProfile()} disabled={saving}>
            {saving ? "Lagrer…" : "Lagre profil"}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
