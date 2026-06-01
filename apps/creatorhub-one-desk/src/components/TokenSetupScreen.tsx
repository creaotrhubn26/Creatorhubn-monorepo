import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Collapse,
  TextField,
  Typography,
} from "@mui/material";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ContentPasteRoundedIcon from "@mui/icons-material/ContentPasteRounded";
import { getDefaultApiBase, saveHelperConfig } from "../api";

interface Props {
  onSaved: () => void;
}

// Tre formater paste-feltet aksepterer (i prioritetsrekkefølge):
//   1. chub://connect?p=<projectId>&t=<token>[&b=<apiBase>]   ← anbefalt
//   2. base64-encoded JSON: { "p": "...", "t": "...", "b"?: "..." }
//   3. rå token `trr_dit_<hex>` (krever da projektID separat)
type ParsedToken = {
  projectId: string | null;
  token: string | null;
  apiBase: string | null;
  rawAcceptable: boolean;
};

function parsePasteInput(raw: string): ParsedToken {
  const trimmed = raw.trim();
  if (!trimmed) return { projectId: null, token: null, apiBase: null, rawAcceptable: false };

  // 1. chub://connect URI
  if (trimmed.startsWith("chub://")) {
    try {
      // URL doesn't like custom schemes uniformly; parse query-string manually.
      const qIdx = trimmed.indexOf("?");
      if (qIdx > 0) {
        const search = new URLSearchParams(trimmed.slice(qIdx + 1));
        return {
          projectId: search.get("p"),
          token: search.get("t"),
          apiBase: search.get("b"),
          rawAcceptable: true,
        };
      }
    } catch {
      /* ignore — falls through */
    }
  }

  // 2. base64 JSON. Looks like base64 if it's URL-safe-ish and long enough.
  if (/^[A-Za-z0-9+/=_-]{20,}$/.test(trimmed) && !trimmed.startsWith("trr_")) {
    try {
      const decoded = atob(trimmed.replace(/-/g, "+").replace(/_/g, "/"));
      const obj = JSON.parse(decoded);
      if (obj && typeof obj === "object") {
        return {
          projectId: typeof obj.p === "string" ? obj.p : typeof obj.projectId === "string" ? obj.projectId : null,
          token: typeof obj.t === "string" ? obj.t : typeof obj.token === "string" ? obj.token : null,
          apiBase: typeof obj.b === "string" ? obj.b : typeof obj.apiBase === "string" ? obj.apiBase : null,
          rawAcceptable: true,
        };
      }
    } catch {
      /* ignore */
    }
  }

  // 3. Plain-text JSON (admin kan også lime inn { token, projectId })
  if (trimmed.startsWith("{")) {
    try {
      const obj = JSON.parse(trimmed);
      return {
        projectId: typeof obj.projectId === "string" ? obj.projectId : typeof obj.p === "string" ? obj.p : null,
        token: typeof obj.token === "string" ? obj.token : typeof obj.t === "string" ? obj.t : null,
        apiBase: typeof obj.apiBase === "string" ? obj.apiBase : typeof obj.b === "string" ? obj.b : null,
        rawAcceptable: true,
      };
    } catch {
      /* ignore */
    }
  }

  // 4. Rå token uten projekt — vi godtar, men krever projektID separat.
  if (trimmed.startsWith("trr_dit_")) {
    return { projectId: null, token: trimmed, apiBase: null, rawAcceptable: false };
  }

  return { projectId: null, token: null, apiBase: null, rawAcceptable: false };
}

export default function TokenSetupScreen({ onSaved }: Props) {
  const [defaultApiBase, setDefaultApiBase] = useState("https://creatorhubn.com");
  const [pasteValue, setPasteValue] = useState("");
  const [manualProjectId, setManualProjectId] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [apiBaseOverride, setApiBaseOverride] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getDefaultApiBase()
      .then((v) => {
        setDefaultApiBase(v);
        setApiBaseOverride(v);
      })
      .catch(() => {
        /* keep static fallback */
      });
  }, []);

  const parsed = useMemo(() => parsePasteInput(pasteValue), [pasteValue]);
  const effectiveProjectId = parsed.projectId || manualProjectId.trim();
  const effectiveToken = parsed.token ?? "";
  const effectiveApiBase = (apiBaseOverride.trim() || parsed.apiBase || defaultApiBase).trim();

  const ready = !!(effectiveToken && effectiveProjectId && effectiveApiBase);
  const needsManualProject = !!parsed.token && !parsed.projectId;
  const showInvalidFormat = pasteValue.trim().length > 8 && !parsed.token;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveHelperConfig({
        apiBase: effectiveApiBase,
        token: effectiveToken,
        projectId: effectiveProjectId,
      });
      onSaved();
    } catch (e) {
      setError(typeof e === "string" ? e : String(e));
    } finally {
      setSaving(false);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setPasteValue(text);
    } catch {
      /* clipboard access kan være blokkert — bruker kan paste manuelt */
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#0b0f17",
        backgroundImage:
          "radial-gradient(circle at 20% 0%, rgba(245, 166, 35, 0.10) 0%, transparent 55%)",
        color: "#edf0f7",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 3,
      }}
    >
      <Box sx={{ width: "100%", maxWidth: 480 }}>
        {/* Brand-mark */}
        <Box sx={{ textAlign: "center", mb: 5 }}>
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: "16px",
              bgcolor: "#f5a623",
              mx: "auto",
              mb: 2.5,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow:
                "0 2px 4px rgba(0,0,0,0.4), 0 12px 32px rgba(245,166,35,0.35)",
              fontSize: 28,
              fontWeight: 800,
              color: "#0b0f17",
              letterSpacing: "-0.02em",
            }}
          >
            C1
          </Box>
          <Typography
            sx={{
              fontSize: 11,
              letterSpacing: "0.2em",
              color: "rgba(237,240,247,0.5)",
              textTransform: "uppercase",
              fontWeight: 600,
              mb: 0.5,
            }}
          >
            Creatorhub One Desk
          </Typography>
          <Typography
            sx={{
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
            }}
          >
            Koble til ditt prosjekt
          </Typography>
          <Typography
            sx={{
              fontSize: 14,
              color: "rgba(237,240,247,0.6)",
              mt: 1.5,
              lineHeight: 1.5,
            }}
          >
            Lim inn connection-koden fra CreatorHub. Vi gjenkjenner formatet
            automatisk.
          </Typography>
        </Box>

        {/* Paste-field */}
        <Box
          sx={{
            bgcolor: "rgba(255,255,255,0.04)",
            border: `1px solid ${
              ready ? "rgba(76,175,80,0.45)" : showInvalidFormat ? "rgba(244,67,54,0.45)" : "rgba(255,255,255,0.10)"
            }`,
            borderRadius: 2,
            p: 2.5,
            mb: 2,
            transition: "border-color 0.2s",
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              mb: 1,
            }}
          >
            <Typography
              sx={{
                fontSize: 11,
                letterSpacing: "0.12em",
                fontWeight: 600,
                color: "rgba(237,240,247,0.5)",
                textTransform: "uppercase",
              }}
            >
              Connection-kode
            </Typography>
            <Button
              size="small"
              startIcon={<ContentPasteRoundedIcon sx={{ fontSize: 14 }} />}
              onClick={handlePasteFromClipboard}
              sx={{
                fontSize: 11,
                py: 0.25,
                color: "rgba(237,240,247,0.7)",
                "&:hover": { bgcolor: "rgba(255,255,255,0.05)" },
              }}
            >
              Lim inn
            </Button>
          </Box>
          <TextField
            multiline
            minRows={2}
            maxRows={4}
            fullWidth
            value={pasteValue}
            onChange={(e) => setPasteValue(e.target.value)}
            placeholder="trr_dit_… eller chub://connect?p=…&t=…"
            variant="standard"
            slotProps={{ input: { disableUnderline: true } }}
            sx={{
              "& .MuiInputBase-root": {
                fontFamily:
                  '"SF Mono", "JetBrains Mono", "Menlo", monospace',
                fontSize: 13,
                color: "#edf0f7",
                p: 0,
              },
              "& textarea::placeholder": {
                color: "rgba(237,240,247,0.35)",
                opacity: 1,
              },
            }}
          />

          {/* Live validation-badge */}
          {ready && (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                mt: 1.5,
                color: "#81c784",
                fontSize: 12,
              }}
            >
              <CheckCircleRoundedIcon sx={{ fontSize: 16 }} />
              <Typography sx={{ fontSize: 12 }}>
                Klar — prosjekt-ID + token gjenkjent
              </Typography>
            </Box>
          )}
          {showInvalidFormat && !needsManualProject && (
            <Typography
              sx={{
                fontSize: 12,
                color: "rgba(244,67,54,0.85)",
                mt: 1.5,
              }}
            >
              Gjenkjenner ikke formatet. Forventet token som starter med{" "}
              <code>trr_dit_</code> eller <code>chub://connect?…</code>
            </Typography>
          )}
        </Box>

        {/* Bare token — be om project-id separat */}
        {needsManualProject && (
          <TextField
            label="Prosjekt-ID"
            value={manualProjectId}
            onChange={(e) => setManualProjectId(e.target.value)}
            fullWidth
            size="small"
            placeholder="proj_xxxxxxxx"
            helperText="Du limte inn bare tokenet. Finn prosjekt-ID i CreatorHub-URLen."
            sx={{ mb: 2 }}
          />
        )}

        {/* Advanced toggle */}
        <Box sx={{ mb: 3 }}>
          <Button
            size="small"
            onClick={() => setAdvancedOpen((v) => !v)}
            sx={{
              fontSize: 11,
              color: "rgba(237,240,247,0.5)",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              p: 0,
              minWidth: 0,
              "&:hover": { bgcolor: "transparent", color: "rgba(237,240,247,0.8)" },
            }}
          >
            {advancedOpen ? "Skjul avansert" : "Avansert"}
          </Button>
          <Collapse in={advancedOpen}>
            <TextField
              label="Backend-URL"
              value={apiBaseOverride}
              onChange={(e) => setApiBaseOverride(e.target.value)}
              fullWidth
              size="small"
              helperText={`Default: ${defaultApiBase}`}
              sx={{ mt: 1.5 }}
            />
          </Collapse>
        </Box>

        {error && (
          <Alert severity="error" sx={{ whiteSpace: "pre-wrap", mb: 2 }}>
            {error}
          </Alert>
        )}

        <Button
          variant="contained"
          fullWidth
          size="large"
          onClick={handleSave}
          disabled={saving || !ready}
          sx={{
            bgcolor: "#f5a623",
            color: "#0b0f17",
            fontWeight: 700,
            letterSpacing: "0.02em",
            py: 1.5,
            "&:hover": { bgcolor: "#ffb84d" },
            "&.Mui-disabled": {
              bgcolor: "rgba(245,166,35,0.20)",
              color: "rgba(11,15,23,0.50)",
            },
          }}
        >
          {saving ? "Kobler til…" : "Koble til prosjekt"}
        </Button>

        <Typography
          sx={{
            fontSize: 11,
            color: "rgba(237,240,247,0.35)",
            textAlign: "center",
            mt: 3,
            lineHeight: 1.6,
          }}
        >
          Tokenet lagres lokalt i <code>~/.creatorhub-one-desk/config.json</code>{" "}
          med 0600-permissions, og brukes kun fra Rust-prosessen.
        </Typography>
      </Box>
    </Box>
  );
}
