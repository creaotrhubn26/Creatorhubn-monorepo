/**
 * leadgrid-avtaler.tsx — /leadgrid/avtaler
 *
 * Én side, to tilstander av samme sak: det som må signeres, og det som er
 * signert. Å skille dem i to sider ville tvunget kunden til å vite hvilken
 * av dem de er i — og det vet de ikke før de har sett listen.
 *
 * Arkivdelen henter fra et endepunkt som krever admin i bedriften, så en
 * vanlig bruker ser signeringen (den de faktisk kan gjøre noe med) og en
 * rolig forklaring i stedet for arkivet.
 */
import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Card, CardContent, CircularProgress, Container, Divider, FormControl,
  InputLabel, MenuItem, Select, Stack, Typography,
} from "@mui/material";
import { apiRequest, getStoredAuthToken } from "@/lib/queryClient";
import { AgreementSigning } from "@/components/leadgrid/AgreementSigning";
import { MyAgreements } from "@/components/leadgrid/MyAgreements";

interface ProjectOption { id: string; name: string }

export default function LeadgridAvtalerPage() {
  const isAuthenticated = typeof window !== "undefined" && Boolean(getStoredAuthToken());
  const [projectId, setProjectId] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : localStorage.getItem("rr_lead_map_active_project"),
  );

  const { data, isLoading } = useQuery<{ projects: ProjectOption[] }>({
    queryKey: ["leadgrid-projects-for-agreements"],
    queryFn: () => apiRequest("/api/admin-room/lead-map/projects"),
    enabled: isAuthenticated,
    retry: false,
  });
  const projects = data?.projects ?? [];

  useEffect(() => {
    if (!data) return;
    const neste = projects.some((p) => p.id === projectId) ? projectId : projects[0]?.id ?? null;
    if (neste !== projectId) setProjectId(neste);
  }, [data, projectId, projects]);

  if (!isAuthenticated) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>Avtaler</Typography>
        <Typography color="text.secondary">
          Logg inn for å se og signere avtalene bedriften din har med Creatorhub AS.
        </Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: { xs: 3, md: 6 } }}>
      <Stack spacing={4}>
        <Box>
          <Typography variant="overline" sx={{ color: "#7c3aed", fontWeight: 700, letterSpacing: 1.5 }}>
            Leadgrid · Avtaler
          </Typography>
          <Typography component="h1" variant="h4" sx={{ fontWeight: 800 }}>
            Avtalene dine
          </Typography>
        </Box>

        {isLoading ? (
          <CircularProgress />
        ) : projects.length === 0 ? (
          <Typography color="text.secondary">
            Du har ingen prosjekter ennå. Avtalene hører til bedriften bak prosjektet.
          </Typography>
        ) : (
          <>
            {projects.length > 1 && (
              <FormControl sx={{ maxWidth: 360 }}>
                <InputLabel id="avtale-prosjekt">Prosjekt</InputLabel>
                <Select
                  labelId="avtale-prosjekt" label="Prosjekt" value={projectId ?? ""}
                  onChange={(e) => setProjectId(String(e.target.value))}
                >
                  {projects.map((p) => (
                    <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {projectId && (
              <Stack spacing={4}>
                <Card variant="outlined">
                  <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                    <AgreementSigning projectId={projectId} />
                  </CardContent>
                </Card>
                <Divider />
                <Card variant="outlined">
                  <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                    <MyAgreements projectId={projectId} />
                  </CardContent>
                </Card>
              </Stack>
            )}
          </>
        )}
      </Stack>
    </Container>
  );
}
