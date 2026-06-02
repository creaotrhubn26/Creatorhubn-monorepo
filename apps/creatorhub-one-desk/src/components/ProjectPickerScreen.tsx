import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/DeleteOutlined";
import {
  ProjectEntry,
  listProjects,
  removeProject,
  setActiveProject,
} from "../api";

interface Props {
  onProjectSelected: () => void;
  onAddNew: () => void;
}

function formatRelativeTime(tsMs: number): string {
  if (!tsMs) return "aldri";
  const diff = Date.now() - tsMs;
  if (diff < 60_000) return "akkurat nå";
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)} min siden`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)} t siden`;
  return `${Math.round(diff / 86_400_000)} d siden`;
}

export default function ProjectPickerScreen({ onProjectSelected, onAddNew }: Props) {
  const [projects, setProjects] = useState<ProjectEntry[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setProjects(await listProjects());
    } catch (e) {
      setError(typeof e === "string" ? e : String(e));
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const handleSelect = async (projectId: string) => {
    setBusy(projectId);
    setError(null);
    try {
      await setActiveProject(projectId);
      onProjectSelected();
    } catch (e) {
      setError(typeof e === "string" ? e : String(e));
      setBusy(null);
    }
  };

  const handleRemove = async (e: React.MouseEvent, projectId: string, label: string) => {
    e.stopPropagation();
    if (!window.confirm(`Fjern "${label}" fra listen?\n\nTokenet slettes lokalt. Du kan legge til prosjektet på nytt med samme token senere.`)) {
      return;
    }
    setBusy(projectId);
    setError(null);
    try {
      await removeProject(projectId);
      await refresh();
    } catch (er) {
      setError(typeof er === "string" ? er : String(er));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="overline" color="text.secondary">
            Creatorhub One Desk
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
            Velg prosjekt
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Du har {projects.length} {projects.length === 1 ? "prosjekt" : "prosjekter"}{" "}
            konfigurert. Velg ett for å fortsette, eller legg til et nytt.
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Card variant="outlined">
          <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
            <List dense disablePadding>
              {projects.map((p, idx) => (
                <ListItem
                  key={p.project_id}
                  divider={idx < projects.length - 1}
                  onClick={() => !busy && handleSelect(p.project_id)}
                  sx={{
                    cursor: busy ? "not-allowed" : "pointer",
                    opacity: busy && busy !== p.project_id ? 0.5 : 1,
                    "&:hover": busy ? {} : { bgcolor: "action.hover" },
                  }}
                  secondaryAction={
                    <Tooltip title="Fjern fra listen">
                      <IconButton
                        edge="end"
                        size="small"
                        onClick={(e) => handleRemove(e, p.project_id, p.label)}
                        disabled={!!busy}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  }
                >
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>
                          {p.label}
                        </Typography>
                        {busy === p.project_id && (
                          <Chip size="small" label="Bytter…" color="primary" />
                        )}
                      </Stack>
                    }
                    secondary={
                      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                        <Typography variant="caption" color="text.secondary">
                          {p.project_id}
                        </Typography>
                        <Typography variant="caption" color="text.disabled">
                          · sist brukt {formatRelativeTime(p.last_used_ms)}
                        </Typography>
                      </Stack>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>

        <Button
          variant="outlined"
          size="large"
          startIcon={<AddIcon />}
          onClick={onAddNew}
          disabled={!!busy}
        >
          Legg til nytt prosjekt
        </Button>
      </Stack>
    </Container>
  );
}
