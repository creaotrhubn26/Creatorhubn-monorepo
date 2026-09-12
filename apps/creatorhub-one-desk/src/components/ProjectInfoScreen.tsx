import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutlineOutlined";
import DeskIcon from "./DeskIcon";
import {
  clearHelperConfig,
  fetchProjectInfo,
  listProjects,
  ProjectEntry,
  ProjectInfo,
  setActiveProject,
  StoredConfig,
} from "../api";
import MountsSection from "./MountsSection";
import CopyProgressView from "./CopyProgressView";
import ResumeBanner from "./ResumeBanner";
import IPadPairingSection from "./IPadPairingSection";
import CaptureMirrorSection from "./CaptureMirrorSection";

interface Props {
  config: StoredConfig;
  onLoggedOut: () => void;
  onSwitchProject?: () => void;
}

export default function ProjectInfoScreen({ config, onLoggedOut, onSwitchProject }: Props) {
  const [info, setInfo] = useState<ProjectInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Quick-switch dropdown state: list av andre prosjekter brukeren har
  // konfigurert. Vises som en chevron-meny ved siden av prosjekt-tittelen
  // når det finnes >1 prosjekt totalt.
  const [otherProjects, setOtherProjects] = useState<ProjectEntry[]>([]);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [switching, setSwitching] = useState(false);

  // Last opp liste av andre prosjekter ved mount + når active config endres.
  // Filtrerer ut aktivt prosjekt fra listen (vises uansett i tittelen).
  useEffect(() => {
    void listProjects()
      .then((all) => {
        setOtherProjects(all.filter((p) => p.project_id !== config.project_id));
      })
      .catch(() => setOtherProjects([]));
  }, [config.project_id]);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      setInfo(await fetchProjectInfo());
    } catch (e) {
      setError(typeof e === "string" ? e : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const handleClear = async () => {
    await clearHelperConfig();
    onLoggedOut();
  };

  const handleSwitchTo = async (projectId: string) => {
    setMenuAnchor(null);
    setSwitching(true);
    try {
      await setActiveProject(projectId);
      // Trigger parent-refresh som leser nytt active project og rendrer på nytt
      onLoggedOut();
    } catch (e) {
      setError(typeof e === "string" ? e : String(e));
      setSwitching(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 6, textAlign: "center" }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }} color="text.secondary">
          Henter prosjekt-info fra {config.api_base}…
        </Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Stack spacing={3}>
        <Stack
          direction="row"
          sx={{ alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}
        >
          <Stack direction="row" spacing={2} sx={{ flex: 1, minWidth: 0, alignItems: "center" }}>
            <DeskIcon size={56} shadow={false} />
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="overline" color="text.secondary">
                Creatorhub One Desk
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1.1 }} noWrap>
                {info?.project.name || config.project_id}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {config.api_base} · prosjekt {config.project_id}
              </Typography>
            </Box>
          </Stack>

          {/* Quick-switcher: vis bare når det er flere prosjekter ELLER
              parent har gitt oss onSwitchProject (Picker-tilgang). */}
          {(otherProjects.length > 0 || onSwitchProject) && (
            <Box>
              <Tooltip title="Bytt prosjekt">
                <IconButton
                  onClick={(e) => setMenuAnchor(e.currentTarget)}
                  disabled={switching}
                  size="small"
                >
                  <SwapHorizIcon />
                </IconButton>
              </Tooltip>
              <Menu
                anchorEl={menuAnchor}
                open={!!menuAnchor}
                onClose={() => setMenuAnchor(null)}
              >
                {otherProjects.map((p) => (
                  <MenuItem
                    key={p.project_id}
                    onClick={() => handleSwitchTo(p.project_id)}
                  >
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {p.label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {p.project_id}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
                {otherProjects.length > 0 && <Divider />}
                {onSwitchProject && (
                  <MenuItem
                    onClick={() => {
                      setMenuAnchor(null);
                      onSwitchProject();
                    }}
                  >
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                      <AddCircleOutlineIcon fontSize="small" />
                      <Typography variant="body2">Administrer prosjekter…</Typography>
                    </Stack>
                  </MenuItem>
                )}
              </Menu>
            </Box>
          )}
        </Stack>

        {/* Resume-banner — vises kun hvis det finnes interrupted backup-økter
            etter app-crash eller forced quit. Skjult når listen er tom. */}
        <ResumeBanner />

        {error && (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={reload}>
                Prøv på nytt
              </Button>
            }
          >
            {error}
          </Alert>
        )}

        {info && (
          <>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                  Planlagte minnekort ({info.memory_card_configs.length})
                </Typography>
                {info.memory_card_configs.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    Ingen minnekort planlagt i prosjekt-wizarden ennå.
                  </Typography>
                ) : (
                  <List dense>
                    {info.memory_card_configs.map((c, i) => (
                      <ListItem key={i} divider>
                        <ListItemText
                          primary={
                            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                              <Chip size="small" label={c.label || "?"} />
                              <Typography variant="body2">
                                {c.type || "?"} · {c.capacity || "?"}
                              </Typography>
                            </Stack>
                          }
                          secondary={c.dayName ? `Dag ${c.dayNumber}: ${c.dayName}` : undefined}
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>

            <MountsSection
              plannedCards={info.memory_card_configs}
              plannedDestinations={info.destinations}
            />

            <CopyProgressView />

            <IPadPairingSection />

            <CaptureMirrorSection plannedDestinations={info.destinations} />

            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                  Backup-destinasjoner ({info.destinations.length})
                </Typography>
                {info.destinations.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    Ingen destinasjoner konfigurert. Be admin sette opp dette i Admin Room.
                  </Typography>
                ) : (
                  <List dense>
                    {info.destinations.map((d) => (
                      <ListItem key={d.id} divider>
                        <ListItemText
                          primary={
                            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                              <Chip
                                size="small"
                                label={d.destination_type}
                                color={d.destination_type === "original" ? "default" : "primary"}
                              />
                              <Typography variant="body2">{d.label}</Typography>
                            </Stack>
                          }
                          secondary={d.path || "(in-place)"}
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </>
        )}

        <Divider />

        <Box
          sx={{
            p: 2,
            borderRadius: 1,
            border: "1px dashed",
            borderColor: "divider",
            color: "text.secondary",
          }}
        >
          <Typography variant="caption">
            F6b — live WebSocket-subscriber + asset-mirror. Når mirror-toggle
            er PÅ, lastes hver nye iPad-asset ned via signed R2-URL og
            kopieres til backend-tracked destinasjoner med xxHash64-verify.
          </Typography>
        </Box>

        <Box>
          <Button variant="text" color="error" onClick={handleClear}>
            Koble fra prosjekt
          </Button>
        </Box>
      </Stack>
    </Container>
  );
}
