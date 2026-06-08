/**
 * MonthlyManagementFeeBox — viser klienten månedens akkumulerte
 * ads-spend + management-fee fordelt per config og total.
 *
 * Inntil spend-sync lander (P2 — Google Ads API), viser 0 kr per config
 * med info om at tall fylles inn etter setup. Etter P2: live tall.
 *
 * Mountes i ClientEconomyPanel.
 */

import { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, CircularProgress, Stack, Typography, Chip,
} from '@mui/material';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';

interface ConfigSummary {
  config_id: string;
  client_name: string;
  management_fee_pct: number;
  is_negotiated: boolean;
  spend_mtd_nok: number;
  mgmt_fee_mtd_nok: number;
  is_synced: boolean;
}

interface Summary {
  month_start: string;
  configs: ConfigSummary[];
  totals: {
    spend_mtd_nok: number;
    mgmt_fee_mtd_nok: number;
  };
}

const fmt = (n: number) => n.toLocaleString('nb-NO', { maximumFractionDigits: 0 });

export default function MonthlyManagementFeeBox({
  clientProjectId,
}: {
  clientProjectId: string;
}) {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/role-room/ads/management-fee-summary?clientProjectId=${encodeURIComponent(clientProjectId)}`, {
      credentials: 'include',
    })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [clientProjectId]);

  if (loading || !data || data.configs.length === 0) return null;

  const monthLabel = new Date(data.month_start).toLocaleDateString('nb-NO', {
    month: 'long', year: 'numeric',
  });

  return (
    <Card sx={{
      bgcolor: '#150b2e',
      border: '1px solid rgba(168,85,247,0.32)',
      color: '#f5f3ff',
      mb: 2,
    }}>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1.4} sx={{ mb: 2 }}>
          <Box sx={{
            width: 36, height: 36, borderRadius: 1.4,
            bgcolor: 'rgba(251,191,36,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <PaymentsOutlinedIcon sx={{ color: '#fbbf24', fontSize: 22 }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 800, fontSize: '1.04rem' }}>
              Ads-spend + management-fee — {monthLabel}
            </Typography>
            <Typography sx={{ color: 'rgba(196,181,253,0.85)', fontSize: '0.82rem' }}>
              Fordelt på {data.configs.length} aktive ads-konfigurasjoner
            </Typography>
          </Box>
        </Stack>

        {/* Totaler */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
            gap: 1.4,
            mb: 2,
          }}
        >
          <SummaryCard
            label="Spend MTD"
            value={`${fmt(data.totals.spend_mtd_nok)} kr`}
            sub="trekkes direkte fra dere til Google"
            color="#60a5fa"
          />
          <SummaryCard
            label="Mgmt-fee MTD"
            value={`${fmt(data.totals.mgmt_fee_mtd_nok)} kr`}
            sub="til innholdsprodusent (egen faktura)"
            color="#fbbf24"
          />
          <SummaryCard
            label="Totalt månedlig kost"
            value={`${fmt(data.totals.spend_mtd_nok + data.totals.mgmt_fee_mtd_nok)} kr`}
            sub="spend + mgmt-fee"
            color="#c084fc"
          />
        </Box>

        {/* Fordeling per config */}
        <Typography sx={{ color: 'rgba(148,163,184,0.85)', fontSize: '0.74rem', fontWeight: 700, letterSpacing: 1, mb: 1, textTransform: 'uppercase' }}>
          Fordeling per konfigurasjon
        </Typography>
        <Stack spacing={1}>
          {data.configs.map((c) => {
            const pctOfTotal = data.totals.spend_mtd_nok > 0
              ? Math.round((c.spend_mtd_nok / data.totals.spend_mtd_nok) * 100)
              : 0;
            return (
              <Box
                key={c.config_id}
                sx={{
                  bgcolor: 'rgba(168,85,247,0.06)',
                  border: '1px solid rgba(168,85,247,0.18)',
                  borderRadius: 1.2,
                  p: 1.4,
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 0.6 }}>
                  <Box>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.92rem' }}>
                      {c.client_name}
                    </Typography>
                    <Stack direction="row" spacing={0.6} sx={{ mt: 0.4 }}>
                      <Chip
                        label={`${c.management_fee_pct}% mgmt-fee${c.is_negotiated ? ' (forhandlet)' : ''}`}
                        size="small"
                        sx={{ bgcolor: 'rgba(251,191,36,0.18)', color: '#fbbf24', fontSize: '0.7rem', height: 20 }}
                      />
                      {c.is_synced ? (
                        <Chip
                          icon={<CheckCircleOutlineIcon sx={{ color: '#34d399 !important', fontSize: 14 }} />}
                          label="Synket med Google Ads"
                          size="small"
                          sx={{ bgcolor: 'rgba(52,211,153,0.18)', color: '#34d399', fontSize: '0.7rem', height: 20 }}
                        />
                      ) : (
                        <Chip
                          icon={<ScheduleOutlinedIcon sx={{ color: '#94a3b8 !important', fontSize: 14 }} />}
                          label="Venter på OAuth-setup"
                          size="small"
                          sx={{ bgcolor: 'rgba(148,163,184,0.18)', color: '#94a3b8', fontSize: '0.7rem', height: 20 }}
                        />
                      )}
                    </Stack>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography sx={{ fontWeight: 800, fontSize: '0.96rem', color: '#60a5fa' }}>
                      {fmt(c.spend_mtd_nok)} kr
                    </Typography>
                    <Typography sx={{ color: 'rgba(196,181,253,0.7)', fontSize: '0.74rem' }}>
                      spend {pctOfTotal > 0 ? `(${pctOfTotal}% av total)` : ''}
                    </Typography>
                  </Box>
                </Stack>
                <Box sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  pt: 0.8,
                  borderTop: '1px solid rgba(168,85,247,0.12)',
                  mt: 0.6,
                }}>
                  <Typography sx={{ color: 'rgba(148,163,184,0.85)', fontSize: '0.78rem' }}>
                    Mgmt-fee til produsent: {fmt(c.mgmt_fee_mtd_nok)} kr
                  </Typography>
                  {!c.is_synced ? (
                    <Typography sx={{ color: '#fbbf24', fontSize: '0.74rem' }}>
                      Tall fylles ut etter første ads-spend
                    </Typography>
                  ) : null}
                </Box>
              </Box>
            );
          })}
        </Stack>

        {data.totals.spend_mtd_nok === 0 ? (
          <Typography sx={{ color: 'rgba(196,181,253,0.7)', fontSize: '0.78rem', mt: 1.4, fontStyle: 'italic' }}>
            Ingen ads-spend registrert så langt denne måneden. Tall oppdateres hver time
            når kampanjer er live og spend kommer inn fra Google Ads.
          </Typography>
        ) : null}
      </CardContent>
    </Card>
  );
}

function SummaryCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <Box sx={{
      bgcolor: `${color}10`,
      border: `1px solid ${color}30`,
      borderRadius: 1.4,
      p: 1.4,
    }}>
      <Typography sx={{ color: `${color}cc`, fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, mb: 0.4 }}>
        {label}
      </Typography>
      <Typography sx={{ color, fontWeight: 800, fontSize: '1.3rem', mb: 0.4 }}>
        {value}
      </Typography>
      <Typography sx={{ color: 'rgba(148,163,184,0.85)', fontSize: '0.72rem' }}>
        {sub}
      </Typography>
    </Box>
  );
}
