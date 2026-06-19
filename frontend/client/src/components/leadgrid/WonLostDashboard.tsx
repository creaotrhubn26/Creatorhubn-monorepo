/**
 * WonLostDashboard.tsx
 *
 * KPI-dashboard for Won/Lost-tracking:
 *   - 4 KPI-cards: vunnet, tapt, total kr, win-rate
 *   - Month-over-month bar-chart (6 mnd)
 *   - Top 5 lost-reasons
 *   - Top 5 reps (basert på vunnet beløp)
 *   - Conversion-funnel
 *   - Periode-switcher 7d/30d/90d
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  Box, Card, CardContent, Stack, Typography, Chip, ToggleButton,
  ToggleButtonGroup, Avatar, LinearProgress, Tooltip, CircularProgress,
  Divider,
} from "@mui/material";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import PaidIcon from "@mui/icons-material/Paid";
import PercentIcon from "@mui/icons-material/Percent";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";

interface Stats {
  period_days: number;
  won_count: string; lost_count: string; in_pipeline: string;
  total_won_oere: string; total_recurring_oere: string;
  win_rate: number;
  top_lost_reasons: { lost_reason: string; n: string }[];
  month_over_month: {
    month: string; won: string; lost: string;
    won_amount_oere: string; won_recurring_oere: string;
  }[];
  top_reps: {
    assigned_user_id: string; first_name: string | null; last_name: string | null;
    profile_image_url: string | null;
    won_count: string; won_amount_oere: string;
  }[];
  funnel: {
    new_leads: string; contacted: string; meeting_booked: string;
    proposal_sent: string; negotiating: string; won: string; lost: string;
  };
}

const REASON_LABELS: Record<string, string> = {
  no_budget: "Ingen budsjett",
  no_decision_maker: "Ingen avgjørelsestaker",
  no_timeline: "Ingen tidshorisont",
  competitor: "Tapt til konkurrent",
  bad_fit: "Dårlig fit",
  unresponsive: "Ikke responderer",
  too_expensive: "For dyrt",
  other: "Annet",
};

function nokFmt(oere: string | number): string {
  const v = Number(oere) / 100;
  return v >= 1000
    ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`
    : v.toFixed(0);
}

export function WonLostDashboard() {
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/leadgrid/won-lost-stats?period=${period}`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then(setStats)
      .finally(() => setLoading(false));
  }, [period]);

  const maxMomWon = useMemo(() => {
    if (!stats) return 1;
    return Math.max(1, ...stats.month_over_month.map((m) => Number(m.won)));
  }, [stats]);

  return (
    <Card sx={{ bgcolor: "rgba(155,225,93,0.04)",
                 border: "1px solid rgba(155,225,93,0.20)" }}>
      <CardContent>
        <Stack direction="row" alignItems="center" mb={2}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Vunnet / Tapt
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Salgsresultat for hele organisasjonen
            </Typography>
          </Box>
          <ToggleButtonGroup size="small" value={period}
                              exclusive onChange={(_, v) => v && setPeriod(v)}>
            <ToggleButton value="7d">7d</ToggleButton>
            <ToggleButton value="30d">30d</ToggleButton>
            <ToggleButton value="90d">90d</ToggleButton>
          </ToggleButtonGroup>
        </Stack>

        {loading ? (
          <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress /></Box>
        ) : !stats ? (
          <Typography variant="body2" color="text.secondary"
                      sx={{ textAlign: "center", py: 3 }}>
            Ingen data
          </Typography>
        ) : (
          <Stack spacing={3}>
            {/* 4 KPI-cards */}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <KpiCard icon={<CheckCircleIcon />} color="#9be15d"
                        label="Vunnet" value={stats.won_count}
                        subText={`${stats.in_pipeline} i pipeline`} />
              <KpiCard icon={<CancelIcon />} color="#f87171"
                        label="Tapt" value={stats.lost_count} />
              <KpiCard icon={<PaidIcon />} color="#a78bfa"
                        label="Sum vunnet"
                        value={`${nokFmt(stats.total_won_oere)} kr`}
                        subText={Number(stats.total_recurring_oere) > 0
                          ? `+ ${nokFmt(stats.total_recurring_oere)} kr/mnd recurring` : undefined} />
              <KpiCard icon={<PercentIcon />} color="#ffb86b"
                        label="Win-rate"
                        value={`${(stats.win_rate * 100).toFixed(0)}%`} />
            </Stack>

            <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />

            {/* MoM */}
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                Siste 6 måneder
              </Typography>
              <Stack direction="row" spacing={1} alignItems="flex-end"
                     sx={{ height: 140 }}>
                {stats.month_over_month.map((m) => {
                  const wonN = Number(m.won);
                  const lostN = Number(m.lost);
                  const pct = (wonN / maxMomWon) * 100;
                  const lostPct = (lostN / maxMomWon) * 100;
                  return (
                    <Box key={m.month} sx={{ flex: 1, textAlign: "center" }}>
                      <Stack alignItems="center" spacing={0.5}>
                        <Tooltip title={`${wonN} vunnet · ${nokFmt(m.won_amount_oere)} kr`}>
                          <Box sx={{ width: "100%",
                                      height: `${Math.max(2, pct)}px`,
                                      bgcolor: "#9be15d",
                                      borderRadius: 0.5,
                                      transition: "height 0.3s" }} />
                        </Tooltip>
                        {lostN > 0 && (
                          <Tooltip title={`${lostN} tapt`}>
                            <Box sx={{ width: "100%",
                                        height: `${Math.max(1, lostPct * 0.4)}px`,
                                        bgcolor: "rgba(248,113,113,0.6)",
                                        borderRadius: 0.5 }} />
                          </Tooltip>
                        )}
                      </Stack>
                      <Typography variant="caption" sx={{ fontSize: 10, mt: 0.5,
                                                            display: "block",
                                                            color: "rgba(255,255,255,0.5)" }}>
                        {m.month.slice(5)}
                      </Typography>
                    </Box>
                  );
                })}
              </Stack>
              <Stack direction="row" spacing={2} mt={1}>
                <Chip size="small" icon={<CheckCircleIcon sx={{ fontSize: 12 }} />}
                      label="Vunnet" sx={{ bgcolor: "#9be15d", color: "#0a0512",
                                            fontSize: 10, height: 18, fontWeight: 600 }} />
                <Chip size="small" icon={<CancelIcon sx={{ fontSize: 12 }} />}
                      label="Tapt" sx={{ bgcolor: "rgba(248,113,113,0.6)", color: "#0a0512",
                                          fontSize: 10, height: 18, fontWeight: 600 }} />
              </Stack>
            </Box>

            <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />

            {/* Top performers + lost reasons side by side */}
            <Stack direction={{ xs: "column", md: "row" }} spacing={3}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5,
                                                       display: "flex", alignItems: "center", gap: 1 }}>
                  <EmojiEventsIcon sx={{ color: "#fbbf24", fontSize: 18 }} />
                  Top selgere
                </Typography>
                {stats.top_reps.length === 0 ? (
                  <Typography variant="caption" color="text.disabled">
                    Ingen vunnet i perioden enda
                  </Typography>
                ) : (
                  <Stack spacing={1}>
                    {stats.top_reps.map((r, i) => (
                      <Stack key={r.assigned_user_id} direction="row" spacing={1.5}
                             alignItems="center">
                        <Typography variant="caption" sx={{ width: 16,
                                                              color: i === 0 ? "#fbbf24"
                                                                   : i === 1 ? "#9ca3af"
                                                                   : i === 2 ? "#b45309"
                                                                   : "text.disabled",
                                                              fontWeight: 700 }}>
                          #{i + 1}
                        </Typography>
                        <Avatar src={r.profile_image_url ?? undefined}
                                sx={{ width: 24, height: 24, fontSize: 10 }}>
                          {[r.first_name, r.last_name].filter(Boolean)
                            .map((s) => s![0]).slice(0, 2).join("")}
                        </Avatar>
                        <Typography variant="body2" sx={{ flex: 1, fontSize: 13 }}>
                          {[r.first_name, r.last_name].filter(Boolean).join(" ") || "—"}
                        </Typography>
                        <Typography variant="caption" sx={{ color: "#9be15d", fontWeight: 700 }}>
                          {r.won_count} · {nokFmt(r.won_amount_oere)} kr
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                )}
              </Box>

              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5,
                                                       display: "flex", alignItems: "center", gap: 1 }}>
                  <TrendingDownIcon sx={{ color: "#f87171", fontSize: 18 }} />
                  Hvorfor vi tapte
                </Typography>
                {stats.top_lost_reasons.length === 0 ? (
                  <Typography variant="caption" color="text.disabled">
                    Ingen tapte leads i perioden
                  </Typography>
                ) : (
                  <Stack spacing={1}>
                    {stats.top_lost_reasons.map((r) => {
                      const pct = (Number(r.n) / Number(stats.lost_count)) * 100;
                      return (
                        <Box key={r.lost_reason}>
                          <Stack direction="row" justifyContent="space-between"
                                 alignItems="center" mb={0.3}>
                            <Typography variant="caption" sx={{ fontSize: 12 }}>
                              {REASON_LABELS[r.lost_reason] ?? r.lost_reason}
                            </Typography>
                            <Typography variant="caption" sx={{ color: "#f87171", fontWeight: 600 }}>
                              {r.n}
                            </Typography>
                          </Stack>
                          <LinearProgress variant="determinate" value={pct}
                                          sx={{ height: 4, borderRadius: 1,
                                                bgcolor: "rgba(255,255,255,0.06)",
                                                "& .MuiLinearProgress-bar": {
                                                  bgcolor: "#f87171",
                                                } }} />
                        </Box>
                      );
                    })}
                  </Stack>
                )}
              </Box>
            </Stack>

            <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />

            {/* Conversion-funnel */}
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                Konverterings-trakt
              </Typography>
              <ConversionFunnel funnel={stats.funnel} />
            </Box>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

function KpiCard({ icon, color, label, value, subText }: {
  icon: React.ReactNode; color: string; label: string;
  value: string | number; subText?: string;
}) {
  return (
    <Box sx={{ flex: 1, p: 2, borderRadius: 1,
                bgcolor: "rgba(0,0,0,0.20)",
                border: `1px solid ${color}33` }}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Box sx={{ color, fontSize: 24, display: "flex" }}>{icon}</Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)",
                                                fontSize: 11 }}>
            {label}
          </Typography>
          <Typography variant="h5" sx={{ color, fontWeight: 800, mt: -0.3 }}>
            {value}
          </Typography>
          {subText && (
            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)",
                                                  fontSize: 10 }}>
              {subText}
            </Typography>
          )}
        </Box>
      </Stack>
    </Box>
  );
}

function ConversionFunnel({ funnel }: { funnel: Stats["funnel"] }) {
  const steps = [
    { key: "new_leads",      label: "Nye leads",       color: "#a78bfa" },
    { key: "contacted",      label: "Kontaktet",        color: "#60a5fa" },
    { key: "meeting_booked", label: "Møte booket",      color: "#a78bfa" },
    { key: "proposal_sent",  label: "Forslag sendt",   color: "#fbbf24" },
    { key: "negotiating",    label: "I forhandling",    color: "#ffb86b" },
    { key: "won",            label: "Vunnet",            color: "#9be15d" },
  ];
  const max = Math.max(1, Number(funnel.new_leads), Number(funnel.contacted));
  return (
    <Stack spacing={1}>
      {steps.map((s) => {
        const n = Number((funnel as any)[s.key] ?? 0);
        const pct = (n / max) * 100;
        return (
          <Stack key={s.key} direction="row" spacing={1.5} alignItems="center">
            <Typography variant="caption" sx={{ width: 110, fontSize: 12,
                                                  color: "rgba(255,255,255,0.7)" }}>
              {s.label}
            </Typography>
            <Box sx={{ flex: 1, position: "relative",
                        bgcolor: "rgba(255,255,255,0.04)",
                        borderRadius: 0.5, height: 24 }}>
              <Box sx={{ position: "absolute", left: 0, top: 0, bottom: 0,
                          width: `${Math.max(4, pct)}%`,
                          bgcolor: s.color, borderRadius: 0.5,
                          transition: "width 0.4s",
                          display: "flex", alignItems: "center", px: 1 }}>
                <Typography variant="caption" sx={{ color: "#0a0512", fontWeight: 700,
                                                      fontSize: 11 }}>
                  {n}
                </Typography>
              </Box>
            </Box>
          </Stack>
        );
      })}
    </Stack>
  );
}
