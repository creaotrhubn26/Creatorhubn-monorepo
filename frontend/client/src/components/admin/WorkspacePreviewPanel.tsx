/**
 * WorkspacePreviewPanel.tsx
 *
 * Super_admin «Workspace-velger» — Del 1 (forhåndsvis UI per profesjon).
 * Daniel kan velge en profesjon og se den workspacen sitt grensesnitt
 * (UniversalDashboard(profession)) med egne/tomme data, for å inspisere
 * layout/flyt for hver rolle. «Vis som ekte bruker» (impersonation) er Del 2.
 */

import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Box, Typography, Card, CardActionArea, CardContent, Stack, Alert, Button, TextField, Divider, CircularProgress } from "@mui/material";
import ArrowBack from "@mui/icons-material/ArrowBack";
import VisibilityIcon from "@mui/icons-material/Visibility";
import UniversalDashboard from "@/components/universal/UniversalDashboard";
import { apiRequest } from "@/lib/queryClient";
import { CANONICAL_PROFESSIONS } from "@shared/profession-types";

interface FoundUser { id: string; email: string; name: string; role: string; profession: string | null }

// Etter start-impersonation: rediriger til målbrukerens workspace ut fra rolle.
function routeForRole(role: string): string {
  const r = (role || "").toLowerCase();
  if (r === "editing_vendor" || r === "editing") return "/partner-portal";
  if (r === "vendor") return "/vendor-dashboard";
  if (r === "admin" || r === "super_admin") return "/admin";
  return "/workspace";
}

function ImpersonateSection() {
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const search = useQuery<{ users: FoundUser[] }>({
    queryKey: ["/api/superadmin/users/search", q],
    queryFn: () => apiRequest(`/api/superadmin/users/search?q=${encodeURIComponent(q)}`),
    enabled: q.trim().length >= 2,
  });
  const impersonate = useMutation({
    mutationFn: (u: FoundUser) => apiRequest("/api/superadmin/impersonate-user", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetUserId: u.id }) }) as Promise<{ ok?: boolean; target?: { role: string } }>,
    onSuccess: (r) => { if (r?.target?.role) window.location.href = routeForRole(r.target.role); },
    onError: () => setMsg("Kunne ikke starte impersonation."),
  });
  return (
    <Box sx={{ mt: 5 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <VisibilityIcon color="error" />
        <Typography variant="h6" sx={{ fontWeight: 700 }}>Vis som ekte bruker (impersonation)</Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 680 }}>
        Søk opp en bruker og se deres workspace med <b>ekte data</b>. Handlinger utføres som brukeren (audit-logget), og en rød banner vises hele tiden — «Avslutt» tar deg tilbake. Auto-utløp etter 30 min. Editing-partnere (f.eks. Orbit) vises med sin ekte portal.
      </Typography>
      <TextField size="small" fullWidth label="Søk bruker (navn / e-post)" value={q} onChange={(e) => setQ(e.target.value)} sx={{ maxWidth: 460 }} />
      {search.isFetching && <CircularProgress size={18} sx={{ ml: 2 }} />}
      <Stack spacing={1} sx={{ mt: 2 }}>
        {(search.data?.users || []).map((u) => (
          <Card key={u.id} variant="outlined">
            <CardContent sx={{ py: 1.2, "&:last-child": { pb: 1.2 } }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                <Box>
                  <Typography sx={{ fontWeight: 600 }}>{u.name} <Typography component="span" variant="caption" color="text.secondary">· {u.role}{u.profession ? ` · ${u.profession}` : ""}</Typography></Typography>
                  <Typography variant="caption" color="text.secondary">{u.email}</Typography>
                </Box>
                <Button size="small" color="error" variant="outlined" disabled={impersonate.isPending || u.role === "super_admin"} onClick={() => { if (confirm(`Se som ${u.name}? Du utfører handlinger som denne brukeren (audit-logget).`)) impersonate.mutate(u); }}>Vis som</Button>
              </Stack>
            </CardContent>
          </Card>
        ))}
        {q.trim().length >= 2 && !search.isFetching && (search.data?.users || []).length === 0 && <Typography color="text.secondary">Ingen treff.</Typography>}
      </Stack>
      {msg && <Alert severity="error" sx={{ mt: 2 }}>{msg}</Alert>}
    </Box>
  );
}

type Prof = string;

// Drift-sikker: alle aktive profesjoner fra den kanoniske registry-en
// (photographer/videographer/music_producer/pet_groomer/vendor/enterprise + evt. flere).
const PROFS: Array<{ id: Prof; label: string; color: string }> = CANONICAL_PROFESSIONS
  .filter((p) => p.isActive)
  .map((p) => ({ id: p.name, label: p.displayName, color: p.iconColor }));

export default function WorkspacePreviewPanel() {
  const [preview, setPreview] = useState<Prof | null>(null);

  if (preview) {
    const p = PROFS.find((x) => x.id === preview)!;
    return (
      <Box>
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          action={<Button color="inherit" size="small" startIcon={<ArrowBack />} onClick={() => setPreview(null)}>Tilbake til valg</Button>}
        >
          <b>Forhåndsvisning: {p.label}-workspace</b> — dette er grensesnittet rollen ser (med dine/tomme data). For ekte data, bruk «vis som bruker» (Del 2, kommer).
        </Alert>
        <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, overflow: "hidden" }}>
          {/* profession-typen er smal (ValidProfession); registry støtter flere → cast */}
          <UniversalDashboard profession={preview as never} />
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>Workspaces — forhåndsvis per profesjon</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 640 }}>
        <b>Forhåndsvis</b>: velg en profesjon for å se dens workspace-grensesnitt (tomme/egne data) — for å inspisere layout/flyt.
        For ekte data, bruk <b>«Vis som bruker»</b> lenger ned.
      </Typography>
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
        {PROFS.map((p) => (
          <Card key={p.id} variant="outlined" sx={{ width: 240 }}>
            <CardActionArea onClick={() => setPreview(p.id)}>
              <CardContent>
                <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 0.5 }}>
                  <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: p.color, flexShrink: 0 }} />
                  <Typography sx={{ fontWeight: 700 }}>{p.label}</Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary">{p.id}</Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Stack>

      <Divider sx={{ my: 4 }} />
      <ImpersonateSection />
    </Box>
  );
}
