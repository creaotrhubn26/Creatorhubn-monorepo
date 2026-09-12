/**
 * BrandKitPanel.tsx
 *
 * Per-prosjekt Brand Kit-panel. Viser den siste auto-detekterte brand-
 * profilen (fra role-room-website-analyzer) + lar produsenten overstyre
 * verdier som er feil. Brand Kit konsumeres av Market Intelligence Scanner
 * (Fase 2+) og Campaign Builder (Fase 4).
 *
 * Bestemor-vennlig: hver tekniske term er forklart i UI-en. Confidence
 * vises tydelig per felt (Auto / Bruker / Mangler).
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  AutoAwesome as AutoAwesomeIcon,
  Brush as BrushIcon,
  ColorLens as ColorLensIcon,
  Edit as EditIcon,
  PlayArrow as RunIcon,
  Refresh as RefreshIcon,
  Verified as VerifiedIcon,
} from "@mui/icons-material";

type FieldSource = "auto" | "user" | "missing";

interface BrandKitData {
  id: string;
  projectId: string;
  sourceUrl: string;
  lastScannedAt: string;
  fieldConfidence: Record<string, FieldSource>;
  effective: {
    businessName: string;
    tagline: string;
    description: string;
    toneOfVoice: string;
    usps: string[];
    primaryCTA: string;
    colors: {
      primary: string;
      secondary: string;
      accent: string;
      background: string;
      text: string;
    };
    fonts: { heading: string; body: string };
    logoUrl: string | null;
    industry: string;
    targetAudience: string;
  };
}

function authHeaders(): HeadersInit {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("rr_bearer") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function SourceBadge({ source }: { source: FieldSource | undefined }) {
  const meta = {
    auto: { label: "Auto-detektert", color: "#60a5fa", icon: <AutoAwesomeIcon sx={{ fontSize: 11 }} /> },
    user: { label: "Du har endret", color: "#34d399", icon: <EditIcon sx={{ fontSize: 11 }} /> },
    missing: { label: "Mangler", color: "#fda4af", icon: null },
  }[source ?? "missing"];
  return (
    <Chip
      size="small"
      icon={meta.icon ?? undefined}
      label={meta.label}
      sx={{
        bgcolor: `${meta.color}22`,
        color: meta.color,
        height: 18,
        fontSize: 10,
        fontWeight: 700,
      }}
    />
  );
}

interface Props {
  projectId: string;
  defaultScanUrl?: string;
}

export default function BrandKitPanel({ projectId, defaultScanUrl }: Props) {
  const [kit, setKit] = useState<BrandKitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snack, setSnack] = useState<string | null>(null);

  const [scanUrl, setScanUrl] = useState(defaultScanUrl ?? "https://theroleroom.com");
  const [scanning, setScanning] = useState(false);

  const fetchKit = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/role-room/brand-kit/${projectId}`, {
        credentials: "include",
        headers: authHeaders(),
      });
      if (r.status === 404) {
        setKit(null);
        return;
      }
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        setError(body.error ?? `HTTP ${r.status}`);
        return;
      }
      const body = await r.json();
      setKit(body.brandKit);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void fetchKit();
  }, [fetchKit]);

  const handleScan = async () => {
    setScanning(true);
    setError(null);
    try {
      const r = await fetch(`/api/role-room/brand-kit/${projectId}/scan`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ url: scanUrl }),
      });
      const body = await r.json();
      if (!r.ok) {
        setError(body.error ?? `HTTP ${r.status}`);
        setSnack(`Scan feilet: ${body.error ?? r.status}`);
      } else {
        setKit(body.brandKit);
        setSnack(`Brand-scan ferdig (${body.brandKit.effective.businessName})`);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setScanning(false);
    }
  };

  // ──────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 2 }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <BrushIcon sx={{ color: "#a78bfa" }} />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Brand Kit
          </Typography>
          <Chip
            size="small"
            label="Fase 1 av Market Intelligence"
            sx={{
              bgcolor: "rgba(167, 139, 250, 0.15)",
              color: "#a78bfa",
              fontSize: 10,
              fontWeight: 700,
            }}
          />
        </Stack>
        {kit && (
          <Button
            size="small"
            startIcon={<RefreshIcon />}
            onClick={fetchKit}
          >
            Oppdater
          </Button>
        )}
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Brand Kit lagrer merkevarens farger, font, tone og slagord — automatisk
        plukket fra nettstedet. Brukes som referanse av Market Intelligence
        Scanner (sammenligning med konkurrenter) og Campaign Builder (holder
        generert innhold i samme stil).
      </Typography>

      {error && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Scan-rad */}
      <Card sx={{ mb: 2, bgcolor: "rgba(167, 139, 250, 0.05)", border: "1px solid rgba(167, 139, 250, 0.2)" }}>
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              fullWidth
              size="small"
              label="Nettstedet ditt"
              placeholder="https://theroleroom.com"
              value={scanUrl}
              onChange={(e) => setScanUrl(e.target.value)}
              helperText={
                kit
                  ? `Sist scannet: ${new Date(kit.lastScannedAt).toLocaleString("nb-NO")}`
                  : "Ingen scan kjørt ennå — start her"
              }
            />
            <Button
              variant="contained"
              onClick={handleScan}
              disabled={scanning || !scanUrl.trim()}
              startIcon={scanning ? <CircularProgress size={14} /> : <RunIcon />}
              sx={{
                bgcolor: "#a78bfa",
                color: "#0a0a0f",
                "&:hover": { bgcolor: "#8b5cf6" },
                minWidth: 130,
                whiteSpace: "nowrap",
              }}
            >
              {scanning ? "Scanner…" : kit ? "Re-scan" : "Kjør scan"}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {!kit ? (
        <Alert severity="info">
          Ingen Brand Kit ennå. Skriv inn nettstedet ditt over og klikk «Kjør
          scan» — vi henter farger fra logoen, finner slagord og analyserer
          tone-of-voice automatisk (cirka 8–15 sekunder).
        </Alert>
      ) : (
        <Stack spacing={2}>
          {/* Identitet */}
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                <VerifiedIcon sx={{ color: "#34d399", fontSize: 18 }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Identitet
                </Typography>
              </Stack>
              <Stack spacing={1.5}>
                <Box>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      Merkenavn
                    </Typography>
                    <SourceBadge source={kit.fieldConfidence.businessName} />
                  </Stack>
                  <Typography variant="body1">{kit.effective.businessName || "—"}</Typography>
                </Box>
                <Box>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      Slagord
                    </Typography>
                    <SourceBadge source={kit.fieldConfidence.tagline} />
                  </Stack>
                  <Typography variant="body1">{kit.effective.tagline || "—"}</Typography>
                </Box>
                <Box>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      Tone-of-voice
                    </Typography>
                    <SourceBadge source={kit.fieldConfidence.toneOfVoice} />
                  </Stack>
                  <Chip
                    size="small"
                    label={kit.effective.toneOfVoice}
                    sx={{ bgcolor: "rgba(167, 139, 250, 0.2)", color: "#a78bfa" }}
                  />
                </Box>
                <Box>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      Primær CTA — den viktigste knappen
                    </Typography>
                    <SourceBadge source={kit.fieldConfidence.primaryCTA} />
                  </Stack>
                  <Typography variant="body1">{kit.effective.primaryCTA || "—"}</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>

          {/* Farger */}
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                <ColorLensIcon sx={{ color: kit.effective.colors.primary, fontSize: 18 }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Farger
                </Typography>
                <SourceBadge source={kit.fieldConfidence.colors} />
              </Stack>
              <Stack direction="row" spacing={1.5}>
                {Object.entries(kit.effective.colors).map(([role, hex]) => (
                  <Box key={role} sx={{ textAlign: "center" }}>
                    <Box
                      sx={{
                        width: 56,
                        height: 56,
                        borderRadius: 1.5,
                        bgcolor: hex,
                        border: "1px solid rgba(255,255,255,0.1)",
                      }}
                    />
                    <Typography variant="caption" sx={{ display: "block", mt: 0.5, fontSize: 10 }}>
                      {role}
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: 9, color: "text.secondary" }}>
                      {hex}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>

          {/* USPs */}
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Dine viktigste salgsargumenter
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  (det som gjør deg unik)
                </Typography>
                <SourceBadge source={kit.fieldConfidence.usps} />
              </Stack>
              {kit.effective.usps.length > 0 ? (
                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                  {kit.effective.usps.map((u, i) => (
                    <Chip key={i} label={u} size="small" sx={{ bgcolor: "rgba(52, 211, 153, 0.15)" }} />
                  ))}
                </Stack>
              ) : (
                <Typography variant="caption" color="text.secondary">
                  Ingen funnet — kan settes manuelt i overrides.
                </Typography>
              )}
            </CardContent>
          </Card>

          {/* Industri + målgruppe */}
          <Card>
            <CardContent>
              <Stack spacing={1.5}>
                <Box>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      Industri
                    </Typography>
                    <SourceBadge source={kit.fieldConfidence.industry} />
                  </Stack>
                  <Typography variant="body1">{kit.effective.industry || "—"}</Typography>
                </Box>
                <Divider />
                <Box>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      Målgruppe — hvem dette er for
                    </Typography>
                    <SourceBadge source={kit.fieldConfidence.targetAudience} />
                  </Stack>
                  <Typography variant="body1">{kit.effective.targetAudience || "—"}</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      )}

      <Snackbar
        open={!!snack}
        autoHideDuration={5000}
        onClose={() => setSnack(null)}
        message={snack}
      />
    </Box>
  );
}
