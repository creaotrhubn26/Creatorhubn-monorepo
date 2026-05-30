import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Container,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { getDefaultApiBase, saveHelperConfig } from "../api";

interface Props {
  onSaved: () => void;
}

export default function TokenSetupScreen({ onSaved }: Props) {
  const [apiBase, setApiBase] = useState("");
  const [token, setToken] = useState("");
  const [projectId, setProjectId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getDefaultApiBase().then(setApiBase).catch(() => setApiBase(""));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveHelperConfig({ apiBase, token, projectId });
      onSaved();
    } catch (e) {
      setError(typeof e === "string" ? e : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="overline" color="text.secondary">
            CreatorHub
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
            Koble til prosjekt
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Lim inn helper-tokenet du genererte i CreatorHub. Tokenet lagres
            lokalt med 0600-permissions i <code>~/.creatorhub-one-desk/config.json</code>
            {" "}og brukes kun fra Rust-prosessen — det eksponeres ikke til
            frontend etter lagring.
          </Typography>
        </Box>

        <TextField
          label="Backend-URL"
          value={apiBase}
          onChange={(e) => setApiBase(e.target.value)}
          fullWidth
          size="small"
          helperText="Standard: https://creatorhubn.com"
        />
        <TextField
          label="Prosjekt-ID"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          fullWidth
          size="small"
          placeholder="proj_xxxxxxxx"
          helperText="Finn i CreatorHub-URLen for prosjektet"
        />
        <TextField
          label="Helper-token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          fullWidth
          size="small"
          type="password"
          placeholder="trr_dit_xxxxxxxxxxxxxxxxxxxxxx"
          helperText="Generér fra Admin Room → DIT Helper Tokens"
        />

        {error && (
          <Alert severity="error" sx={{ whiteSpace: "pre-wrap" }}>
            {error}
          </Alert>
        )}

        <Button
          variant="contained"
          size="large"
          onClick={handleSave}
          disabled={saving || !apiBase || !token || !projectId}
        >
          {saving ? "Lagrer…" : "Lagre og koble til"}
        </Button>
      </Stack>
    </Container>
  );
}
