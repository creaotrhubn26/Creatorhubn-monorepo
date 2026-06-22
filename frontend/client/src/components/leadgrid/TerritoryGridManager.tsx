/**
 * TerritoryGridManager.tsx
 *
 * Admin-flate for å definere og forvalte selger-grids ("territorier").
 * En grid er en KOMBINASJON av:
 *   - kommuner (kommunenummer) og/eller postnummer, og/eller
 *   - et tegnet polygon (GeoJSON).
 * Kart-tegning kommer som neste steg; foreløpig kan en GeoJSON-geometri
 * limes inn direkte. Listen viser overlapp-advarsler mellom grids.
 *
 * Krever territories.view (liste) / territories.manage (opprett/slett).
 * Auth + org-resolve håndteres backend-side; organizationId er valgfri.
 *
 * Endepunkter:
 *   GET    /api/leadgrid/territories
 *   POST   /api/leadgrid/territories
 *   DELETE /api/leadgrid/territories/:id
 *   GET    /api/leadgrid/territories/overlaps
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box, Stack, Typography, Button, TextField, Chip, IconButton, Divider,
  Card, CardContent, CircularProgress, Snackbar, Alert, Tooltip,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";

interface Territory {
  id: string;
  name: string;
  assigned_user_id: string | null;
  assigned_email: string | null;
  sales_team_id: string | null;
  geometry: unknown | null;
  municipalities: string[];
  postal_codes: string[];
  priority: number;
  active: boolean;
}

interface Overlap {
  a: string;
  b: string;
  shared: string[];
}

interface Props {
  organizationId?: string;
}

function withOrg(path: string, organizationId?: string): string {
  if (!organizationId) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}organization_id=${encodeURIComponent(organizationId)}`;
}

function parseList(s: string): string[] {
  return s.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean);
}

export function TerritoryGridManager({ organizationId }: Props) {
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [overlaps, setOverlaps] = useState<Overlap[]>([]);
  const [loading, setLoading] = useState(true);
  const [snack, setSnack] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  // Skjema for ny grid
  const [name, setName] = useState("");
  const [assignedUserId, setAssignedUserId] = useState("");
  const [municipalities, setMunicipalities] = useState("");
  const [postalCodes, setPostalCodes] = useState("");
  const [geometryText, setGeometryText] = useState("");
  const [priority, setPriority] = useState(100);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, oRes] = await Promise.all([
        fetch(withOrg("/api/leadgrid/territories", organizationId), { credentials: "include" }),
        fetch(withOrg("/api/leadgrid/territories/overlaps", organizationId), { credentials: "include" }),
      ]);
      if (tRes.ok) setTerritories((await tRes.json()).territories ?? []);
      if (oRes.ok) setOverlaps((await oRes.json()).overlaps ?? []);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => { void load(); }, [load]);

  const overlapByTerritory = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const o of overlaps) {
      for (const id of [o.a, o.b]) {
        m.set(id, [...(m.get(id) ?? []), ...o.shared]);
      }
    }
    return m;
  }, [overlaps]);

  const create = async () => {
    if (name.trim().length < 2) {
      setSnack({ kind: "err", msg: "Navn må ha minst 2 tegn" });
      return;
    }
    const muni = parseList(municipalities);
    const post = parseList(postalCodes);
    let geometry: unknown = null;
    if (geometryText.trim()) {
      try { geometry = JSON.parse(geometryText); }
      catch { setSnack({ kind: "err", msg: "Ugyldig GeoJSON" }); return; }
    }
    if (!geometry && muni.length === 0 && post.length === 0) {
      setSnack({ kind: "err", msg: "Angi minst kommuner, postnummer eller polygon" });
      return;
    }
    setSaving(true);
    try {
      const r = await fetch(withOrg("/api/leadgrid/territories", organizationId), {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          assigned_user_id: assignedUserId.trim() || null,
          municipalities: muni,
          postal_codes: post,
          geometry,
          priority,
        }),
      });
      const j = await r.json();
      if (r.ok) {
        setSnack({
          kind: "ok",
          msg: j.overlaps?.length
            ? `Grid opprettet — OBS: overlapper med ${j.overlaps.length} andre`
            : "Grid opprettet",
        });
        setName(""); setAssignedUserId(""); setMunicipalities("");
        setPostalCodes(""); setGeometryText(""); setPriority(100);
        await load();
      } else {
        setSnack({ kind: "err", msg: j?.error ?? "Kunne ikke opprette" });
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    const r = await fetch(`/api/leadgrid/territories/${id}`, {
      method: "DELETE", credentials: "include",
    });
    if (r.ok) { setSnack({ kind: "ok", msg: "Grid deaktivert" }); await load(); }
    else setSnack({ kind: "err", msg: "Kunne ikke slette" });
  };

  if (loading) {
    return <Box sx={{ textAlign: "center", py: 4 }}><CircularProgress /></Box>;
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>Selger-grids (territorier)</Typography>
      <Typography variant="body2" color="text.secondary">
        Hver selger/promotør holdes innenfor sin grid. Definer en grid med kommuner,
        postnummer og/eller et polygon. Håndhevingen er myk: utenfor-sonen-aktivitet
        gir advarsel til selgeren og varsel til teamleder.
      </Typography>

      {/* Ny grid */}
      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>Ny grid</Typography>
          <Stack spacing={1.5}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField label="Navn" size="small" fullWidth value={name}
                         onChange={(e) => setName(e.target.value)} />
              <TextField label="Tildelt bruker-ID (valgfri)" size="small" fullWidth
                         value={assignedUserId} onChange={(e) => setAssignedUserId(e.target.value)} />
              <TextField label="Prioritet" size="small" type="number" sx={{ width: 120 }}
                         value={priority} onChange={(e) => setPriority(Number(e.target.value) || 100)} />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField label="Kommunenummer (komma/space)" size="small" fullWidth
                         placeholder="0301, 4601" value={municipalities}
                         onChange={(e) => setMunicipalities(e.target.value)} />
              <TextField label="Postnummer (komma/space)" size="small" fullWidth
                         placeholder="0150 0151 5003" value={postalCodes}
                         onChange={(e) => setPostalCodes(e.target.value)} />
            </Stack>
            <TextField label="Polygon-GeoJSON (valgfritt — kart-tegning kommer)" size="small"
                       fullWidth multiline minRows={2}
                       placeholder='{"type":"Polygon","coordinates":[[[10,59],[11,59],[11,60],[10,60],[10,59]]]}'
                       value={geometryText} onChange={(e) => setGeometryText(e.target.value)} />
            <Box>
              <Button variant="contained" startIcon={<AddIcon />} disabled={saving} onClick={create}>
                {saving ? "Lagrer…" : "Opprett grid"}
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {/* Liste */}
      <Stack spacing={1}>
        {territories.length === 0 && (
          <Typography variant="body2" color="text.secondary">Ingen grids definert enda.</Typography>
        )}
        {territories.map((t) => {
          const shared = overlapByTerritory.get(t.id);
          return (
            <Card key={t.id} variant="outlined"
                  sx={{ opacity: t.active ? 1 : 0.5 }}>
              <CardContent sx={{ py: 1.5 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" rowGap={0.5}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{t.name}</Typography>
                      <Chip size="small" label={`prioritet ${t.priority}`} />
                      {t.assigned_email && <Chip size="small" color="primary" label={t.assigned_email} />}
                      {t.geometry != null && <Chip size="small" variant="outlined" label="polygon" />}
                      {shared && shared.length > 0 && (
                        <Tooltip title={`Overlapper på: ${[...new Set(shared)].join(", ")}`}>
                          <Chip size="small" color="warning" icon={<WarningAmberIcon sx={{ fontSize: 14 }} />}
                                label="overlapp" />
                        </Tooltip>
                      )}
                    </Stack>
                    {(t.municipalities.length > 0 || t.postal_codes.length > 0) && (
                      <Typography variant="caption" color="text.secondary">
                        {t.municipalities.length > 0 && `Kommuner: ${t.municipalities.join(", ")}`}
                        {t.municipalities.length > 0 && t.postal_codes.length > 0 && " · "}
                        {t.postal_codes.length > 0 && `Postnr: ${t.postal_codes.join(", ")}`}
                      </Typography>
                    )}
                  </Box>
                  <Tooltip title="Deaktiver grid">
                    <IconButton size="small" color="error" onClick={() => remove(t.id)}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </CardContent>
            </Card>
          );
        })}
      </Stack>

      <Divider />
      <Typography variant="caption" color="text.secondary">
        {territories.length} grid(s) · {overlaps.length} overlapp-par
      </Typography>

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)}>
        <Alert severity={snack?.kind === "ok" ? "success" : "error"} onClose={() => setSnack(null)}>
          {snack?.msg}
        </Alert>
      </Snackbar>
    </Stack>
  );
}
