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
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import { clearHelperConfig, fetchProjectInfo, ProjectInfo, StoredConfig } from "../api";
import MountsSection from "./MountsSection";
import CopyProgressView from "./CopyProgressView";
import IPadPairingSection from "./IPadPairingSection";

interface Props {
  config: StoredConfig;
  onLoggedOut: () => void;
}

export default function ProjectInfoScreen({ config, onLoggedOut }: Props) {
  const [info, setInfo] = useState<ProjectInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
        <Box>
          <Typography variant="overline" color="text.secondary">
            Creatorhub One Desk
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
            {info?.project.name || config.project_id}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {config.api_base} · prosjekt {config.project_id}
          </Typography>
        </Box>

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
            F5 — iPad-paring (Bonjour-discovery, manuell PIN-confirmation
            inntil CaptureApp støtter automatisk bekreftelse). Live mirror
            kommer i F6.
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
