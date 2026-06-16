/**
 * LeadDetailDialog — utvidet lead-detalj (porter ld-detalj-designet).
 * Header (avatar/navn/firma/segment), kontakt, stadium + estimert verdi, og en
 * tidslinje satt sammen av EKTE signaler vi har om leaden (fanget-dato, AI-
 * segmentering, oppfølging sendt, nåværende stadium) + foreslått neste steg.
 *
 * Ingen ny backend — bruker lead-objektet LeadsPanel allerede har hentet.
 */

import * as React from 'react';
import { Dialog, DialogContent, Box, Stack, Typography, Chip, IconButton } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CloseIcon from '@mui/icons-material/Close';
import ContactPageIcon from '@mui/icons-material/ContactPage';
import BusinessIcon from '@mui/icons-material/Business';
import MailIcon from '@mui/icons-material/Mail';
import CallIcon from '@mui/icons-material/Call';
import TimelineIcon from '@mui/icons-material/Timeline';
import PaymentsIcon from '@mui/icons-material/Payments';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import DeviceThermostatIcon from '@mui/icons-material/DeviceThermostat';
import AcUnitIcon from '@mui/icons-material/AcUnit';
import DoNotDisturbOnIcon from '@mui/icons-material/DoNotDisturbOn';

const ACCENT = '#a78bfa';
const GRAD = 'linear-gradient(135deg, #a855f7, #d946ef)';
const INK = '#f5f3ff';
const MUTED = 'rgba(226,232,240,0.62)';

export interface LeadDetailLead {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  segment: string | null;
  segmentReason: string | null;
  stage: string | null;
  valueKr: number;
  createdTime: string | null;
  followedUpAt?: string | null;
  fields?: Record<string, string>;
}

export interface LeadDetailDialogProps {
  open: boolean;
  onClose: () => void;
  lead: LeadDetailLead;
}

const SEGMENT_META: Record<string, { label: string; icon: React.ReactElement; color: string; bg: string }> = {
  varm: { label: 'Varm', icon: <LocalFireDepartmentIcon sx={{ fontSize: 14 }} />, color: '#fecdd3', bg: 'rgba(244,63,94,0.16)' },
  lunken: { label: 'Lunken', icon: <DeviceThermostatIcon sx={{ fontSize: 14 }} />, color: '#fde68a', bg: 'rgba(245,158,11,0.16)' },
  kald: { label: 'Kald', icon: <AcUnitIcon sx={{ fontSize: 14 }} />, color: '#bfdbfe', bg: 'rgba(59,130,246,0.16)' },
  tapt: { label: 'Tapt', icon: <DoNotDisturbOnIcon sx={{ fontSize: 14 }} />, color: '#e5e7eb', bg: 'rgba(107,114,128,0.18)' },
};

const STAGE_LABEL: Record<string, string> = { svart: 'Svart', booket: 'Møte booket', kunde: 'Kunde', tapt: 'Tapt' };

function initials(name: string | null): string {
  const p = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '?';
  return ((p[0][0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return '';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' });
}

function pickCompany(fields?: Record<string, string>): string | null {
  if (!fields) return null;
  const key = Object.keys(fields).find((k) => /firma|bedrift|company|selskap|org/i.test(k));
  return key ? fields[key] : null;
}

function fmtKr(n: number): string { return `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} kr`; }

export default function LeadDetailDialog({ open, onClose, lead }: LeadDetailDialogProps): React.ReactElement {
  const seg = lead.segment ? SEGMENT_META[lead.segment] : null;
  const company = pickCompany(lead.fields);
  const stageLabel = lead.stage ? (STAGE_LABEL[lead.stage] ?? lead.stage) : 'Ny';

  // Tidslinje fra ekte signaler.
  const events: Array<{ title: string; detail: string; when: string; done: boolean }> = [];
  events.push({ title: 'Lead fanget', detail: 'Fanget som ny henvendelse fra annonse/skjema', when: fmtDate(lead.createdTime) || '—', done: true });
  if (lead.segmentReason) events.push({ title: `AI-segmentert som ${seg?.label ?? lead.segment}`, detail: lead.segmentReason, when: '', done: true });
  if (lead.followedUpAt) events.push({ title: 'Automatisk oppfølging sendt', detail: 'Agenten fulgte opp med SMS + e-post', when: fmtDate(lead.followedUpAt), done: true });
  if (lead.stage) events.push({ title: `Stadium: ${stageLabel}`, detail: lead.stage === 'kunde' ? 'Konvertert til kunde' : 'Oppdatert status i pipelinen', when: 'Nå', done: true });
  // Foreslått neste steg basert på stadium.
  const next = lead.stage === 'kunde'
    ? null
    : lead.stage === 'booket'
      ? { title: 'Neste steg: send tilbud', detail: 'Lever pakketilbud og følg opp innen 2 dager' }
      : lead.stage === 'svart'
        ? { title: 'Neste steg: book oppdagelsessamtale', detail: 'Avtal en kort samtale for å bekrefte behov og budsjett' }
        : { title: 'Neste steg: følg opp', detail: 'Ta kontakt mens leaden er fersk' };
  if (next) events.push({ title: next.title, detail: next.detail, when: 'Planlagt', done: false });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden', background: 'linear-gradient(180deg, #0a0a14 0%, #100923 55%, #1a0f2e 100%)', border: '1px solid rgba(167,139,250,0.2)' } }}>
      <DialogContent sx={{ p: { xs: 2, md: 2.8 } }}>
        {/* Header */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.8 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Box sx={{ width: 26, height: 26, borderRadius: 1.2, display: 'grid', placeItems: 'center', background: GRAD, boxShadow: '0 6px 16px rgba(168,85,247,0.45)' }}>
              <AutoAwesomeIcon sx={{ fontSize: 15, color: '#fff' }} />
            </Box>
            <Stack direction="row" alignItems="center" spacing={0.7}>
              <ContactPageIcon sx={{ fontSize: 16, color: ACCENT }} />
              <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: '#c4b5fd', letterSpacing: '0.04em' }}>Lead-detalj</Typography>
            </Stack>
          </Stack>
          <IconButton size="small" onClick={onClose} sx={{ color: 'rgba(226,232,240,0.5)' }}><CloseIcon fontSize="small" /></IconButton>
        </Stack>

        {/* Lead-header */}
        <Stack direction="row" alignItems="center" spacing={1.4} sx={{ mb: 2 }}>
          <Box sx={{ width: 52, height: 52, borderRadius: '50%', display: 'grid', placeItems: 'center', background: GRAD, color: '#fff', fontWeight: 800, fontSize: 19, flexShrink: 0 }}>
            {initials(lead.name)}
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontSize: 18, fontWeight: 800, color: INK, lineHeight: 1.15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.name || 'Ukjent lead'}</Typography>
            {company ? (
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <BusinessIcon sx={{ fontSize: 14, color: MUTED }} />
                <Typography sx={{ fontSize: 12.5, color: MUTED }}>{company}</Typography>
              </Stack>
            ) : null}
          </Box>
          {seg ? (
            <Chip size="small" icon={React.cloneElement(seg.icon, { sx: { fontSize: 14, color: `${seg.color} !important` } })} label={seg.label}
              sx={{ bgcolor: seg.bg, color: seg.color, fontWeight: 700, fontSize: 11.5, flexShrink: 0 }} />
          ) : null}
        </Stack>

        {/* Kontakt + stadium + verdi */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1, mb: 2 }}>
          {[
            { icon: <MailIcon sx={{ fontSize: 16, color: ACCENT }} />, label: 'E-post', val: lead.email || '—' },
            { icon: <CallIcon sx={{ fontSize: 16, color: ACCENT }} />, label: 'Telefon', val: lead.phone || '—' },
            { icon: <TimelineIcon sx={{ fontSize: 16, color: ACCENT }} />, label: 'Stadium', val: stageLabel },
            { icon: <PaymentsIcon sx={{ fontSize: 16, color: ACCENT }} />, label: 'Estimert verdi', val: lead.valueKr ? fmtKr(lead.valueKr) : '—' },
          ].map((r) => (
            <Stack key={r.label} direction="row" alignItems="center" spacing={1} sx={{ p: 1, borderRadius: 1.8, bgcolor: 'rgba(15,23,42,0.5)', border: '1px solid rgba(148,163,184,0.12)' }}>
              {r.icon}
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: 10.5, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{r.label}</Typography>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.val}</Typography>
              </Box>
            </Stack>
          ))}
        </Box>

        {/* Tidslinje */}
        <Stack direction="row" alignItems="center" spacing={0.7} sx={{ mb: 1 }}>
          <TimelineIcon sx={{ fontSize: 16, color: ACCENT }} />
          <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#c4b5fd' }}>Tidslinje</Typography>
        </Stack>
        <Stack spacing={0}>
          {events.map((e, i) => (
            <Stack key={i} direction="row" spacing={1.4}>
              {/* Akse */}
              <Stack alignItems="center" sx={{ width: 22, flexShrink: 0 }}>
                <Box sx={{ width: 12, height: 12, borderRadius: '50%', mt: 0.4, background: e.done ? GRAD : 'transparent', border: e.done ? 'none' : `2px dashed ${ACCENT}`, boxShadow: e.done ? '0 0 0 3px rgba(168,85,247,0.18)' : 'none' }} />
              {i < events.length - 1 ? <Box sx={{ width: 2, flex: 1, minHeight: 26, bgcolor: 'rgba(167,139,250,0.3)', my: 0.3 }} /> : null}
              </Stack>
              <Box sx={{ pb: 1.6, minWidth: 0, flex: 1, opacity: e.done ? 1 : 0.8 }}>
                <Stack direction="row" alignItems="baseline" justifyContent="space-between" spacing={1}>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: INK }}>{e.title}</Typography>
                  {e.when ? <Typography sx={{ fontSize: 11, color: e.when === 'Nå' ? ACCENT : MUTED, fontWeight: e.when === 'Nå' ? 700 : 400, flexShrink: 0 }}>{e.when}</Typography> : null}
                </Stack>
                <Typography sx={{ fontSize: 12, color: MUTED, lineHeight: 1.45 }}>{e.detail}</Typography>
              </Box>
            </Stack>
          ))}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
