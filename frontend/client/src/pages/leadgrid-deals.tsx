/**
 * leadgrid-deals.tsx — /leadgrid/deals
 *
 * Leadgrid Pipeline Kanban med Deal Management-felt (#154/#155, mig 0349).
 *
 * Funksjonalitet:
 *   - Kanban med 8 stages (new → won/lost)
 *   - Per kort: deal_probability slider, expected_close_date, deal_amount
 *   - Weighted-value pill: "NOK X × Y% = NOK Z weighted"
 *   - Sort-option: "Sorter etter weighted value"
 *   - Filter: "Lukker innen 30 dager"
 *   - Sidebar: Weighted forecast (denne måneden) + Top deals at risk
 *
 * Backend:
 *   GET   /api/leadgrid/deals/forecast       — weighted pipeline
 *   GET   /api/leadgrid/deals/by-month       — månedlig brutt ned
 *   GET   /api/leadgrid/deals/at-risk        — overdue deals
 *   GET   /api/leadgrid/leads/:id/deal       — deal-info
 *   PATCH /api/leadgrid/leads/:id/deal       — oppdater deal-felt
 */
import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Box,
  Container,
  Typography,
  Stack,
  Card,
  CardContent,
  Chip,
  Slider,
  TextField,
  CircularProgress,
  Alert,
  FormControlLabel,
  Switch,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Tooltip,
} from "@mui/material";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";

const STAGES: Array<{ key: string; label: string; color: string }> = [
  { key: "new", label: "Ny", color: "#94a3b8" },
  { key: "first_contact", label: "Første kontakt", color: "#64748b" },
  { key: "qualified", label: "Kvalifisert", color: "#0288d1" },
  { key: "meeting", label: "Møte", color: "#60a5fa" },
  { key: "proposal", label: "Tilbud", color: "#7c3aed" },
  { key: "negotiation", label: "Forhandling", color: "#f59e0b" },
  { key: "won", label: "Vunnet", color: "#16a34a" },
  { key: "lost", label: "Tapt", color: "#9ca3af" },
];

interface Lead {
  id: string;
  name: string | null;
  pipelineStage: string;
  dealAmount: number | null;
  dealProbability: number | null;
  expectedCloseDate: string | null;
  dealCurrency: string | null;
}

interface ForecastSummary {
  totalWeightedValue: number;
  totalPipelineValue: number;
  dealsCount: number;
  averageProbability: number;
  currency: string;
}

interface DealAtRisk {
  leadId: string;
  name: string | null;
  pipelineStage: string;
  dealAmount: number;
  dealProbability: number;
  weightedValue: number;
  expectedCloseDate: string;
  daysOverdue: number;
}

const fmtNok = (v: number | null | undefined): string => {
  if (v === null || v === undefined) return "—";
  return `${Math.round(v).toLocaleString("nb-NO")} kr`;
};

export default function LeadgridDealsPage(): JSX.Element {
  const [sortBy, setSortBy] = useState<"close_date" | "weighted">("weighted");
  const [filterCloseSoon, setFilterCloseSoon] = useState(false);

  // Forecast
  const { data: forecastData } = useQuery<{
    forecast: { summary: ForecastSummary; byMonth: Array<{ period: string; weightedValue: number; dealsCount: number }> };
  }>({
    queryKey: ["leadgrid-deals-forecast"],
    queryFn: () => apiRequest("/api/leadgrid/deals/forecast"),
  });

  // At-risk
  const { data: atRiskData } = useQuery<{ deals: DealAtRisk[] }>({
    queryKey: ["leadgrid-deals-at-risk"],
    queryFn: () => apiRequest("/api/leadgrid/deals/at-risk?limit=10"),
  });

  // Leads (vi henter via eksisterende leadgrid-leads endepunkt; appen kan
  // tilby /api/admin-room/lead-map/leads-listen)
  const { data: leadsData, isLoading } = useQuery<{ leads: Lead[] }>({
    queryKey: ["leadgrid-leads-for-deals"],
    queryFn: async () => {
      const res = await apiRequest("/api/admin-room/lead-map/leads");
      // Normaliser fra backend-snake til camelCase
      const leads = (res.leads ?? []).map((l: Record<string, unknown>) => ({
        id: String(l.id),
        name:
          (l.business_name as string | undefined) ??
          (l.name as string | undefined) ??
          null,
        pipelineStage: String(l.pipeline_stage ?? l.pipelineStage ?? "new"),
        dealAmount:
          l.deal_amount !== undefined && l.deal_amount !== null
            ? Number(l.deal_amount)
            : (l.dealAmount as number | null | undefined) ?? null,
        dealProbability:
          (l.deal_probability as number | null | undefined) ??
          (l.dealProbability as number | null | undefined) ??
          null,
        expectedCloseDate:
          (l.expected_close_date as string | null | undefined) ??
          (l.expectedCloseDate as string | null | undefined) ??
          null,
        dealCurrency:
          (l.deal_currency as string | null | undefined) ??
          (l.dealCurrency as string | null | undefined) ??
          "NOK",
      }));
      return { leads };
    },
  });

  const leads = leadsData?.leads ?? [];

  const filteredLeads = useMemo(() => {
    let res = leads;
    if (filterCloseSoon) {
      const cutoff = new Date(Date.now() + 30 * 86400000)
        .toISOString()
        .slice(0, 10);
      res = res.filter(
        (l) =>
          l.expectedCloseDate && l.expectedCloseDate <= cutoff,
      );
    }
    return res;
  }, [leads, filterCloseSoon]);

  const leadsByStage = useMemo(() => {
    const map = new Map<string, Lead[]>();
    for (const s of STAGES) map.set(s.key, []);
    for (const l of filteredLeads) {
      const arr = map.get(l.pipelineStage) ?? [];
      arr.push(l);
      map.set(l.pipelineStage, arr);
    }
    if (sortBy === "weighted") {
      for (const [k, arr] of map) {
        map.set(
          k,
          arr.slice().sort((a, b) => {
            const wa = (a.dealAmount ?? 0) * ((a.dealProbability ?? 0) / 100);
            const wb = (b.dealAmount ?? 0) * ((b.dealProbability ?? 0) / 100);
            return wb - wa;
          }),
        );
      }
    } else {
      for (const [k, arr] of map) {
        map.set(
          k,
          arr.slice().sort((a, b) => {
            if (!a.expectedCloseDate) return 1;
            if (!b.expectedCloseDate) return -1;
            return a.expectedCloseDate.localeCompare(b.expectedCloseDate);
          }),
        );
      }
    }
    return map;
  }, [filteredLeads, sortBy]);

  const forecast = forecastData?.forecast;
  const atRisk = atRiskData?.deals ?? [];

  return (
    <Container maxWidth={false} sx={{ py: 4 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <Box>
          <Stack direction="row" alignItems="center" gap={1}>
            <TrendingUpIcon sx={{ color: "#a855f7" }} />
            <Typography variant="h4" fontWeight={700}>
              Deal Pipeline
            </Typography>
          </Stack>
          <Typography color="text.secondary">
            Weighted forecast = sum(amount × probability/100). Endre verdier på
            kortene for å se prognosen oppdateres.
          </Typography>
        </Box>
        <Stack direction="row" gap={2} alignItems="center">
          <FormControlLabel
            control={
              <Switch
                checked={filterCloseSoon}
                onChange={(e) => setFilterCloseSoon(e.target.checked)}
              />
            }
            label="Lukker innen 30 dager"
          />
          <FormControl size="small">
            <InputLabel>Sortering</InputLabel>
            <Select
              label="Sortering"
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as "close_date" | "weighted")
              }
            >
              <MenuItem value="weighted">Weighted value</MenuItem>
              <MenuItem value="close_date">Forventet close</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Stack>

      {/* Forecast-sammendrag */}
      {forecast && (
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} mb={3}>
          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Weighted pipeline
              </Typography>
              <Typography variant="h4" fontWeight={700} color="primary">
                {fmtNok(forecast.summary.totalWeightedValue)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                av {fmtNok(forecast.summary.totalPipelineValue)} total ·{" "}
                {forecast.summary.dealsCount} deals · snitt{" "}
                {Math.round(forecast.summary.averageProbability)}%
              </Typography>
            </CardContent>
          </Card>
          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Stack direction="row" alignItems="center" gap={1}>
                <CalendarMonthIcon color="primary" />
                <Typography variant="body2" color="text.secondary">
                  Neste 3 måneder
                </Typography>
              </Stack>
              <Stack direction="row" spacing={2} mt={1}>
                {forecast.byMonth.slice(0, 3).map((m) => (
                  <Box key={m.period}>
                    <Typography variant="caption" color="text.secondary">
                      {m.period}
                    </Typography>
                    <Typography variant="h6">{fmtNok(m.weightedValue)}</Typography>
                    <Typography variant="caption">
                      {m.dealsCount} deals
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
          <Card sx={{ flex: 1, bgcolor: atRisk.length > 0 ? "warning.light" : undefined }}>
            <CardContent>
              <Stack direction="row" alignItems="center" gap={1}>
                <WarningAmberIcon color="warning" />
                <Typography variant="body2">Top deals at risk</Typography>
              </Stack>
              <Typography variant="h6" mt={1}>
                {atRisk.length} overdue deals
              </Typography>
              {atRisk.slice(0, 3).map((d) => (
                <Typography key={d.leadId} variant="caption" display="block">
                  {d.name ?? d.leadId.slice(0, 8)} — {d.daysOverdue} d ·{" "}
                  {fmtNok(d.weightedValue)}
                </Typography>
              ))}
            </CardContent>
          </Card>
        </Stack>
      )}

      {/* Kanban */}
      {isLoading ? (
        <CircularProgress />
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: `repeat(${STAGES.length}, minmax(260px, 1fr))`,
            gap: 2,
            overflowX: "auto",
          }}
        >
          {STAGES.map((s) => {
            const stageLeads = leadsByStage.get(s.key) ?? [];
            const stageWeighted = stageLeads.reduce(
              (acc, l) =>
                acc + (l.dealAmount ?? 0) * ((l.dealProbability ?? 0) / 100),
              0,
            );
            return (
              <Box key={s.key}>
                <Stack
                  direction="row"
                  alignItems="center"
                  gap={1}
                  mb={1}
                  px={1}
                >
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      bgcolor: s.color,
                    }}
                  />
                  <Typography variant="subtitle1" fontWeight={600}>
                    {s.label}
                  </Typography>
                  <Chip size="small" label={stageLeads.length} />
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ ml: "auto" }}
                  >
                    {fmtNok(stageWeighted)}
                  </Typography>
                </Stack>
                <Stack spacing={1}>
                  {stageLeads.length === 0 && (
                    <Alert severity="info" sx={{ opacity: 0.5 }}>
                      Tom
                    </Alert>
                  )}
                  {stageLeads.map((l) => (
                    <DealCard key={l.id} lead={l} />
                  ))}
                </Stack>
              </Box>
            );
          })}
        </Box>
      )}
    </Container>
  );
}

function DealCard({ lead }: { lead: Lead }): JSX.Element {
  const queryClient = useQueryClient();
  const [probability, setProbability] = useState<number>(
    lead.dealProbability ?? 0,
  );
  const [amount, setAmount] = useState<string>(
    lead.dealAmount !== null ? String(lead.dealAmount) : "",
  );
  const [closeDate, setCloseDate] = useState<string>(
    lead.expectedCloseDate ?? "",
  );

  const saveMutation = useMutation({
    mutationFn: async (patch: {
      deal_probability?: number | null;
      deal_amount?: number | null;
      expected_close_date?: string | null;
    }) =>
      apiRequest(`/api/leadgrid/leads/${lead.id}/deal`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leadgrid-leads-for-deals"] });
      queryClient.invalidateQueries({ queryKey: ["leadgrid-deals-forecast"] });
    },
  });

  const weighted = (Number(amount) || 0) * (probability / 100);

  return (
    <Card variant="outlined">
      <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Typography variant="body2" fontWeight={600} noWrap>
          {lead.name ?? lead.id.slice(0, 8)}
        </Typography>

        {/* Weighted-value-pill */}
        <Tooltip title="NOK amount × probability% = weighted">
          <Chip
            size="small"
            color="primary"
            variant="filled"
            label={`${fmtNok(Number(amount) || 0)} × ${probability}% = ${fmtNok(weighted)}`}
            sx={{ mt: 1, mb: 1, fontWeight: 600 }}
          />
        </Tooltip>

        <Typography variant="caption" color="text.secondary">
          Probability ({probability}%)
        </Typography>
        <Slider
          size="small"
          value={probability}
          onChange={(_, v) => setProbability(Array.isArray(v) ? v[0] : v)}
          onChangeCommitted={(_, v) =>
            saveMutation.mutate({
              deal_probability: Array.isArray(v) ? v[0] : v,
            })
          }
          sx={{
            color:
              probability < 30
                ? "#dc2626"
                : probability < 70
                  ? "#f59e0b"
                  : "#16a34a",
          }}
          min={0}
          max={100}
        />

        <Stack direction="row" spacing={1} mt={0.5}>
          <TextField
            label="Beløp"
            size="small"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onBlur={() =>
              saveMutation.mutate({
                deal_amount: amount === "" ? null : Number(amount),
              })
            }
            sx={{ flex: 1 }}
          />
          <TextField
            label="ECD"
            size="small"
            type="date"
            value={closeDate}
            InputLabelProps={{ shrink: true }}
            onChange={(e) => setCloseDate(e.target.value)}
            onBlur={() =>
              saveMutation.mutate({
                expected_close_date: closeDate === "" ? null : closeDate,
              })
            }
            sx={{ flex: 1 }}
          />
        </Stack>
      </CardContent>
    </Card>
  );
}
