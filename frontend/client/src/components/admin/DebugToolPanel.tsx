/**
 * DebugToolPanel.tsx
 *
 * Admin debug-/diagnose-verktøy. A) Bruker-diagnose (skriv inn bruker → rolle-
 * bevisst rapport med root-cause + fiks-knapper + «Vis som»). B) System-helse
 * (integrasjoner/config grønn/rød). Gjenbruker backend-diagnose som speiler
 * de ekte kodebanene.
 */

import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Box, Typography, TextField, Button, Stack, Card, CardContent, Alert, CircularProgress, Divider, Chip,
} from "@mui/material";
import CheckCircle from "@mui/icons-material/CheckCircle";
import Cancel from "@mui/icons-material/Cancel";
import WarningAmber from "@mui/icons-material/WarningAmber";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import BugReport from "@mui/icons-material/BugReport";
import HealthAndSafety from "@mui/icons-material/HealthAndSafety";
import Visibility from "@mui/icons-material/Visibility";
import { apiRequest } from "@/lib/queryClient";

type Status = "pass" | "fail" | "warn" | "info";
interface Check { key: string; label: string; status: Status; detail: string; fix?: { action: string; label: string } }
interface UserReport { found: boolean; query?: string; user?: { id: string; email: string; name: string; role: string; profession: string | null }; routesTo?: string; checks?: Check[]; rootCause?: Check | null }
interface HealthReport { checks: Check[]; env?: { paypal?: string } }

const ICON: Record<Status, React.ReactNode> = {
  pass: <CheckCircle sx={{ color: "success.main", fontSize: 20 }} />,
  fail: <Cancel sx={{ color: "error.main", fontSize: 20 }} />,
  warn: <WarningAmber sx={{ color: "warning.main", fontSize: 20 }} />,
  info: <InfoOutlined sx={{ color: "info.main", fontSize: 20 }} />,
};

function CheckRow({ c, onFix, fixing }: { c: Check; onFix?: (action: string) => void; fixing?: boolean }) {
  return (
    <Stack direction="row" spacing={1.2} alignItems="flex-start" sx={{ py: 1, borderBottom: "1px solid", borderColor: "divider" }}>
      <Box sx={{ mt: 0.2 }}>{ICON[c.status]}</Box>
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{c.label}</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ wordBreak: "break-word" }}>{c.detail}</Typography>
      </Box>
      {c.fix && onFix && (
        <Button size="small" variant="outlined" disabled={fixing} onClick={() => onFix(c.fix!.action)}>{c.fix.label}</Button>
      )}
    </Stack>
  );
}

function UserDiagnosis() {
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [msg, setMsg] = useState<{ sev: "success" | "error" | "info"; text: string } | null>(null);

  const report = useQuery<UserReport>({
    queryKey: ["/api/superadmin/debug/user", submitted],
    queryFn: () => apiRequest(`/api/superadmin/debug/user?q=${encodeURIComponent(submitted)}`),
    enabled: submitted.trim().length > 0,
  });

  const resend = useMutation({
    mutationFn: (userId: string) => apiRequest(`/api/superadmin/editing/vendors/${userId}/resend-link`, { method: "POST" }),
    onSuccess: () => { setMsg({ sev: "success", text: "Fersk magic-link sendt." }); report.refetch(); },
    onError: () => setMsg({ sev: "error", text: "Kunne ikke sende magic-link." }),
  });
  const impersonate = useMutation({
    mutationFn: (userId: string) => apiRequest("/api/superadmin/impersonate-user", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetUserId: userId }) }) as Promise<{ target?: { role: string } }>,
    onSuccess: (r) => {
      const role = (r?.target?.role || "").toLowerCase();
      window.location.href = role === "editing_vendor" ? "/partner-portal" : role === "vendor" ? "/vendor-dashboard" : "/workspace";
    },
  });

  const r = report.data;
  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <BugReport color="primary" /><Typography variant="h6" sx={{ fontWeight: 700 }}>Bruker-diagnose</Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 640 }}>
        Skriv inn en bruker (e-post eller id) → rolle-bevisst diagnose av hvorfor de har (eller ikke har) tilgang, med root-cause og fiks.
      </Typography>
      <Stack direction="row" spacing={1.5} sx={{ mb: 2 }} alignItems="center">
        <TextField size="small" label="E-post eller bruker-id" value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") setSubmitted(q.trim()); }} sx={{ flex: 1, maxWidth: 420 }} />
        <Button variant="contained" onClick={() => setSubmitted(q.trim())} disabled={!q.trim()}>Diagnostiser</Button>
      </Stack>
      {msg && <Alert severity={msg.sev} sx={{ mb: 2 }}>{msg.text}</Alert>}
      {report.isFetching && <CircularProgress size={22} />}
      {r && !r.found && submitted && <Alert severity="warning">Fant ingen bruker for «{r.query}».</Alert>}
      {r?.found && r.user && (
        <Card variant="outlined">
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1} sx={{ mb: 1 }}>
              <Box>
                <Typography sx={{ fontWeight: 700 }}>{r.user.name}</Typography>
                <Typography variant="caption" color="text.secondary">{r.user.email} · {r.user.role} · lander på {r.routesTo}</Typography>
              </Box>
              <Button size="small" color="error" variant="outlined" startIcon={<Visibility />} disabled={r.user.role === "super_admin" || impersonate.isPending}
                onClick={() => { if (confirm(`Se som ${r.user!.name}?`)) impersonate.mutate(r.user!.id); }}>Vis som</Button>
            </Stack>
            {r.rootCause
              ? <Alert severity="error" icon={<Cancel />} sx={{ mb: 1 }}><b>Root-cause: {r.rootCause.label}</b> — {r.rootCause.detail}</Alert>
              : <Alert severity="success" sx={{ mb: 1 }}>Ingen blokkerende feil — brukeren har tilgangen de skal ha.</Alert>}
            {(r.checks || []).map((c) => (
              <CheckRow key={c.key} c={c} fixing={resend.isPending}
                onFix={c.fix?.action === "resend_link" ? () => resend.mutate(r.user!.id) : undefined} />
            ))}
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

function SystemHealth() {
  const health = useQuery<HealthReport>({
    queryKey: ["/api/superadmin/debug/system-health"],
    queryFn: () => apiRequest("/api/superadmin/debug/system-health"),
    refetchInterval: 60000,
  });
  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <HealthAndSafety color="primary" /><Typography variant="h6" sx={{ fontWeight: 700 }}>System-helse</Typography>
        {health.data?.env?.paypal && <Chip size="small" label={`PayPal: ${health.data.env.paypal}`} />}
      </Stack>
      {health.isLoading ? <CircularProgress size={22} /> : (
        <Card variant="outlined">
          <CardContent>
            {(health.data?.checks || []).map((c) => <CheckRow key={c.key} c={c} />)}
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

export default function DebugToolPanel() {
  return (
    <Box>
      <UserDiagnosis />
      <Divider sx={{ my: 4 }} />
      <SystemHealth />
    </Box>
  );
}
