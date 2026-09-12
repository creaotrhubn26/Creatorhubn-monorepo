/**
 * IndustryTab.tsx — «Bransje» (avgangs-pipeline cockpit, CMS-koblet).
 *
 * Førsteklasses flate for utdanning → bransje: promoter avgangsstudenter til
 * Role Room Talents, gjør profilene SØKBARE (casting-attributter) for byråer/
 * casting, marker NSF-medlemskap (tillitssignal), og styr avgangs-showcase.
 * Gjenbruker educationTalentPipelineService. Samtykke-gated: profilen er ikke
 * synlig i agency-search før studenten selv gir consent.
 *
 * 🔑 CMS: stabile data-edit-id (edu-br-*) på hvert statiske element.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Box, Stack, Typography, Button, IconButton, Tooltip, Chip, CircularProgress, Alert,
  Select, MenuItem, TextField, Avatar, Snackbar, FormControlLabel, Checkbox,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import {
  Storefront as IndustryIcon, TheaterComedy as TalentIcon, Verified as VerifiedIcon,
  Movie as ShowreelIcon, Search as SearchIcon, KeyboardArrowDown as CaretIcon,
  Edit as EditIcon, WorkspacePremium as NsfIcon, Groups as ClaimedIcon,
  Close as CloseIcon, Shield as ConsentIcon,
} from '@mui/icons-material';
import { educationCohortsService, type Cohort } from './educationCohortsService';
import { educationTalentPipelineService, type PipelineRow, type ShowcaseEntry, type TalentAttributes } from './educationTalentPipelineService';
import { ACCENT, Panel, T } from './_eduUi';

const initials = (name: string) => name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
const joinList = (a: string[]) => a.join(', ');
const parseList = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

export function IndustryTab() {
  const [pipeline, setPipeline] = useState<PipelineRow[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cohortFilter, setCohortFilter] = useState('');
  const [query, setQuery] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  // Rediger/promoter-dialog.
  const [edit, setEdit] = useState<PipelineRow | null>(null);
  const [institution, setInstitution] = useState('');
  const [program, setProgram] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [ageMin, setAgeMin] = useState('');
  const [ageMax, setAgeMax] = useState('');
  const [gender, setGender] = useState('');
  const [city, setCity] = useState('');
  const [skills, setSkills] = useState('');
  const [languages, setLanguages] = useState('');
  const [dialects, setDialects] = useState('');
  const [nsf, setNsf] = useState(false);
  const [attested, setAttested] = useState(false);
  const [busy, setBusy] = useState(false);

  // Showcase.
  const [showcaseOpen, setShowcaseOpen] = useState(false);
  const [showcase, setShowcase] = useState<ShowcaseEntry[]>([]);
  const [showcaseBusy, setShowcaseBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [chs, pipe] = await Promise.all([
        educationCohortsService.listCohorts(),
        educationTalentPipelineService.getPipeline().catch(() => [] as PipelineRow[]),
      ]);
      setCohorts(chs); setPipeline(pipe);
    } catch (e) { setError(e instanceof Error ? e.message : 'Kunne ikke hente pipeline'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const cohortName = (id: string | null) => cohorts.find((c) => c.id === id)?.name ?? '—';

  const openEdit = (row: PipelineRow) => {
    setEdit(row);
    const a = row.attributes;
    setInstitution(localStorage.getItem('rr_edu_institution') ?? '');
    setProgram(cohorts.find((c) => c.id === row.cohortId)?.program ?? '');
    setYear(String(new Date().getFullYear()));
    setAgeMin(a.playingAgeMin != null ? String(a.playingAgeMin) : '');
    setAgeMax(a.playingAgeMax != null ? String(a.playingAgeMax) : '');
    setGender(a.gender ?? '');
    setCity(a.city ?? '');
    setSkills(joinList(a.skills));
    setLanguages(joinList(a.languages));
    setDialects(joinList(a.dialects));
    setNsf(a.nsfMember);
    setAttested(false);
  };

  const withdraw = async (row: PipelineRow) => {
    try {
      await educationTalentPipelineService.withdraw(row.studentId);
      setToast(`Invitasjonen for ${row.name} er trukket tilbake.`);
      setPipeline(await educationTalentPipelineService.getPipeline().catch(() => pipeline));
    } catch (e) { setError(e instanceof Error ? e.message : 'Kunne ikke trekke tilbake'); }
  };

  const buildAttrs = (): Partial<TalentAttributes> => ({
    playingAgeMin: ageMin.trim() ? Number(ageMin) : null,
    playingAgeMax: ageMax.trim() ? Number(ageMax) : null,
    gender: gender.trim() || null,
    city: city.trim() || null,
    skills: parseList(skills),
    languages: parseList(languages),
    dialects: parseList(dialects),
    nsfMember: nsf,
  });

  const save = async () => {
    if (!edit || busy) return;
    setBusy(true); setError(null);
    try {
      if (edit.status === 'none') {
        if (institution.trim()) localStorage.setItem('rr_edu_institution', institution.trim());
        await educationTalentPipelineService.promote(edit.studentId, {
          institution: institution.trim() || undefined,
          program: program.trim() || undefined,
          year: Number(year) || undefined,
          attributes: buildAttrs(),
          consentAttested: attested,
        });
        setToast(`${edit.name} invitert til Talents — venter på studentens samtykke.`);
      } else {
        await educationTalentPipelineService.setAttributes(edit.studentId, buildAttrs());
        setToast(`Attributter lagret for ${edit.name}.`);
      }
      setEdit(null);
      setPipeline(await educationTalentPipelineService.getPipeline().catch(() => pipeline));
    } catch (e) { setError(e instanceof Error ? e.message : 'Kunne ikke lagre'); }
    finally { setBusy(false); }
  };

  const openShowcase = async () => {
    const cohortId = cohortFilter || cohorts[0]?.id;
    if (!cohortId) { setError('Velg et kull for avgangs-showcase.'); return; }
    setShowcaseOpen(true); setShowcaseBusy(true);
    try { setShowcase(await educationTalentPipelineService.getShowcase(cohortId)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Kunne ikke hente showcase'); }
    finally { setShowcaseBusy(false); }
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pipeline.filter((r) => (!cohortFilter || r.cohortId === cohortFilter) && (!q || r.name.toLowerCase().includes(q)));
  }, [pipeline, cohortFilter, query]);

  const kpis = [
    { id: 'promotert', label: 'Promoterte', value: pipeline.filter((r) => r.status !== 'none').length, hint: 'På Talents-registeret', icon: <TalentIcon />, bg: 'rgba(139,92,246,0.16)', c: '#c4b5fd' },
    { id: 'claimet', label: 'Overtatt av student', value: pipeline.filter((r) => r.status === 'claimed').length, hint: 'Studenten styrer selv', icon: <ClaimedIcon />, bg: 'rgba(16,185,129,0.16)', c: '#34d399' },
    { id: 'showreel', label: 'Med showreel', value: pipeline.filter((r) => r.hasShowreel).length, hint: 'Klar for visning', icon: <ShowreelIcon />, bg: 'rgba(236,72,153,0.16)', c: '#ec4899' },
    { id: 'sokbar', label: 'Søkbare', value: pipeline.filter((r) => r.searchable).length, hint: 'Dukker opp i casting-søk', icon: <SearchIcon />, bg: 'rgba(56,189,248,0.16)', c: '#38bdf8' },
    { id: 'nsf', label: 'NSF-medlemmer', value: pipeline.filter((r) => r.nsfMember).length, hint: 'Fagforening (manuelt merket)', icon: <NsfIcon />, bg: 'rgba(245,158,11,0.16)', c: '#f59e0b' },
  ];

  const statusChip = (r: PipelineRow) => {
    if (r.status === 'claimed') return { label: 'Overtatt ✓', color: '#34d399', bg: 'rgba(16,185,129,0.15)' };
    if (r.status === 'claimable') return { label: 'Claimable', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' };
    return { label: 'Ikke promotert', color: 'rgba(255,255,255,0.72)', bg: 'rgba(255,255,255,0.07)' };
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress sx={{ color: ACCENT }} /></Box>;

  return (
    <Box sx={{ display: 'grid', gap: 2.5 }}>
      {/* Header */}
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'flex-start' }} spacing={2}>
        <Stack direction="row" spacing={1.75} alignItems="flex-start">
          <Box sx={{ width: 50, height: 50, borderRadius: 3, bgcolor: 'rgba(139,92,246,0.16)', color: '#c4b5fd', display: 'grid', placeItems: 'center', flexShrink: 0 }}><IndustryIcon /></Box>
          <Box>
            <T eid="edu-br-title" variant="h5" sx={{ fontWeight: 800, letterSpacing: -0.4 }}>Bransje</T>
            <T eid="edu-br-subtitle" sx={{ color: 'rgba(255,255,255,0.72)', fontSize: 13.5, mt: 0.4 }}>Avgangs-pipeline: fra klasserom til rollebesetning. Promoter studenter til Talents-registeret, gjør profilene søkbare for byråer/casting, og styr avgangs-showcase.</T>
          </Box>
        </Stack>
        <Button variant="outlined" startIcon={<IndustryIcon />} onClick={openShowcase} sx={{ borderColor: 'rgba(255,255,255,0.15)', color: '#fff', textTransform: 'none', fontWeight: 600, borderRadius: 2 }}>
          <T eid="edu-br-btn-showcase" component="span" sx={{ fontWeight: 600 }}>Avgangs-showcase</T>
        </Button>
      </Stack>

      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      <Alert severity="info" icon={<TalentIcon fontSize="inherit" />}
        sx={{ bgcolor: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', color: 'rgba(255,255,255,0.82)', '& .MuiAlert-icon': { color: ACCENT } }}>
        <T eid="edu-br-consent" component="span">Samtykke først: en promotert profil er <b>ikke</b> synlig for byråer/casting før studenten selv har overtatt den og gitt consent. Skolen verifiserer utdanningen; studenten eier profilen.</T>
      </Alert>

      {/* KPI-kort */}
      <Box sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(5, 1fr)' } }}>
        {kpis.map((k) => (
          <Panel key={k.id} sx={{ p: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <T eid={`edu-br-kpi-${k.id}-label`} sx={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', fontWeight: 600 }}>{k.label}</T>
              <Box sx={{ width: 32, height: 32, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: k.bg, color: k.c, '& svg': { fontSize: 18 } }}>{k.icon}</Box>
            </Stack>
            <Typography sx={{ fontSize: 25, fontWeight: 700, mt: 1, lineHeight: 1 }}>{k.value}</Typography>
            <T eid={`edu-br-kpi-${k.id}-hint`} sx={{ fontSize: 11, color: 'rgba(255,255,255,0.72)', mt: 0.75 }}>{k.hint}</T>
          </Panel>
        ))}
      </Box>

      {/* Student-tabell */}
      <Panel sx={{ p: 0, overflowX: 'auto' }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ p: 2, flexWrap: 'wrap', gap: 1 }}>
          <T eid="edu-br-list-title" sx={{ fontWeight: 700, fontSize: 15, mr: 1 }}>Avgangsstudenter</T>
          <Select value={cohortFilter} onChange={(e) => setCohortFilter(e.target.value)} size="small" displayEmpty IconComponent={CaretIcon}
            sx={{ fontSize: 12.5, color: 'rgba(255,255,255,0.85)', borderRadius: 2, minWidth: 130, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.12)' }, '& .MuiSelect-select': { py: 0.75 }, '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.72)' } }}>
            <MenuItem value="" sx={{ fontSize: 12.5 }}>Alle kull</MenuItem>
            {cohorts.map((c) => <MenuItem key={c.id} value={c.id} sx={{ fontSize: 12.5 }}>{c.name}</MenuItem>)}
          </Select>
          <Box sx={{ flex: 1 }} />
          <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 1.25, py: 0.75, borderRadius: 2, border: '1px solid rgba(255,255,255,0.1)', bgcolor: 'rgba(255,255,255,0.03)' }}>
            <SearchIcon sx={{ fontSize: 15, color: 'rgba(255,255,255,0.75)' }} />
            <TextField variant="standard" placeholder="Søk etter student" value={query} onChange={(e) => setQuery(e.target.value)} InputProps={{ disableUnderline: true }} sx={{ '& input': { color: '#fff', fontSize: 12.5, width: 150 } }} />
          </Stack>
        </Stack>

        <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1.3fr 2.2fr 100px', minWidth: 560, px: 2, py: 1.25, bgcolor: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.08)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {[['student', 'Student'], ['kull', 'Kull'], ['status', 'Talent-status'], ['a', '']].map(([id, label]) => (
            <T key={id} eid={`edu-br-th-${id}`} sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.72)', fontWeight: 600 }}>{label}</T>
          ))}
        </Box>

        {pipeline.length === 0 ? (
          <T eid="edu-br-empty" sx={{ p: 4, textAlign: 'center', color: 'text.secondary', fontSize: 13.5, display: 'block' }}>Ingen studenter ennå — legg til studenter i Kull &amp; studenter først.</T>
        ) : visible.length === 0 ? (
          <T eid="edu-br-nomatch" sx={{ p: 4, textAlign: 'center', color: 'text.secondary', fontSize: 13.5, display: 'block' }}>Ingen studenter matcher filteret.</T>
        ) : visible.map((r) => {
          const sc = statusChip(r);
          return (
            <Box key={r.studentId} sx={{ display: 'grid', gridTemplateColumns: '2fr 1.3fr 2.2fr 100px', minWidth: 560, alignItems: 'center', px: 2, py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 0 }}>
                <Avatar sx={{ width: 32, height: 32, fontSize: 11.5, bgcolor: 'rgba(139,92,246,0.3)', color: '#e9d5ff' }}>{initials(r.name)}</Avatar>
                <Typography sx={{ fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</Typography>
              </Stack>
              <Typography sx={{ fontSize: 12.5, color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', pr: 1 }}>{cohortName(r.cohortId)}</Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                <Chip label={sc.label} size="small" sx={{ height: 20, fontSize: 10.5, fontWeight: 600, bgcolor: sc.bg, color: sc.color }} />
                {r.hasShowreel && <Chip icon={<ShowreelIcon sx={{ fontSize: '12px !important' }} />} label="Showreel" size="small" sx={{ height: 20, fontSize: 10, bgcolor: 'rgba(236,72,153,0.12)', color: '#ec4899', '& .MuiChip-icon': { color: '#ec4899' } }} />}
                {r.searchable && <Chip icon={<SearchIcon sx={{ fontSize: '12px !important' }} />} label="Søkbar" size="small" sx={{ height: 20, fontSize: 10, bgcolor: 'rgba(56,189,248,0.12)', color: '#38bdf8', '& .MuiChip-icon': { color: '#38bdf8' } }} />}
                {r.nsfMember && <Chip icon={<NsfIcon sx={{ fontSize: '12px !important' }} />} label="NSF" size="small" sx={{ height: 20, fontSize: 10, bgcolor: 'rgba(245,158,11,0.12)', color: '#f59e0b', '& .MuiChip-icon': { color: '#f59e0b' } }} />}
              </Stack>
              <Stack direction="row" spacing={0.25} sx={{ justifySelf: 'end' }} alignItems="center">
                <Button size="small" variant={r.status === 'none' ? 'contained' : 'outlined'} startIcon={r.status === 'none' ? <TalentIcon sx={{ fontSize: '15px !important' }} /> : <EditIcon sx={{ fontSize: '15px !important' }} />} onClick={() => openEdit(r)}
                  sx={r.status === 'none'
                    ? { bgcolor: ACCENT, '&:hover': { bgcolor: '#7c3aed' }, textTransform: 'none', borderRadius: 2, fontSize: 12, whiteSpace: 'nowrap' }
                    : { borderColor: 'rgba(255,255,255,0.15)', color: '#fff', textTransform: 'none', borderRadius: 2, fontSize: 12, whiteSpace: 'nowrap' }}>
                  {r.status === 'none' ? 'Promoter' : 'Rediger'}
                </Button>
                {r.status === 'claimable' && <Tooltip title="Trekk tilbake invitasjonen (sletter utkastet)"><IconButton size="small" onClick={() => withdraw(r)} sx={{ color: 'rgba(255,255,255,0.35)', fontSize: 15 }}><CloseIcon fontSize="inherit" /></IconButton></Tooltip>}
              </Stack>
            </Box>
          );
        })}
      </Panel>

      {/* Rediger/promoter-dialog */}
      <Dialog open={!!edit} onClose={() => setEdit(null)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: '#141018', color: '#fff', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>{edit?.status === 'none' ? `Promoter ${edit?.name} til Talents` : `Talent-attributter — ${edit?.name}`}</DialogTitle>
        <DialogContent>
          {edit?.status === 'none' && (
            <>
              <T eid="edu-br-dlg-cred" sx={{ fontSize: 11.5, fontWeight: 700, color: '#c4b5fd', textTransform: 'uppercase', letterSpacing: 0.5, mt: 0.5, mb: 1 }}>Skole-verifisert credential</T>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
                <TextField size="small" label="Institusjon" value={institution} onChange={(e) => setInstitution(e.target.value)} fullWidth />
                <TextField size="small" label="Program" value={program} onChange={(e) => setProgram(e.target.value)} fullWidth />
                <TextField size="small" type="number" label="Avgangsår" value={year} onChange={(e) => setYear(e.target.value)} sx={{ width: 130 }} />
              </Stack>
            </>
          )}
          <T eid="edu-br-dlg-attrs" sx={{ fontSize: 11.5, fontWeight: 700, color: '#c4b5fd', textTransform: 'uppercase', letterSpacing: 0.5, mb: 1 }}>Casting-attributter (gjør profilen søkbar)</T>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1.5}>
              <TextField size="small" type="number" label="Spillealder fra" value={ageMin} onChange={(e) => setAgeMin(e.target.value)} fullWidth />
              <TextField size="small" type="number" label="Spillealder til" value={ageMax} onChange={(e) => setAgeMax(e.target.value)} fullWidth />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField size="small" label="Kjønn" value={gender} onChange={(e) => setGender(e.target.value)} fullWidth />
              <TextField size="small" label="By" value={city} onChange={(e) => setCity(e.target.value)} fullWidth />
            </Stack>
            <TextField size="small" label="Ferdigheter (komma-separert)" value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="ridning, sang, fekting" fullWidth />
            <TextField size="small" label="Språk (komma-separert)" value={languages} onChange={(e) => setLanguages(e.target.value)} placeholder="norsk, engelsk" fullWidth />
            <TextField size="small" label="Dialekter (komma-separert)" value={dialects} onChange={(e) => setDialects(e.target.value)} placeholder="Oslo, Trøndersk" fullWidth />
            <FormControlLabel control={<Checkbox checked={nsf} onChange={(e) => setNsf(e.target.checked)} sx={{ color: 'rgba(255,255,255,0.72)', '&.Mui-checked': { color: '#f59e0b' } }} />}
              label={<Typography sx={{ fontSize: 13 }}>Medlem av Norsk Skuespillerforbund (NSF)</Typography>} />
          </Stack>

          {edit?.status === 'none' && (
            <Box sx={{ mt: 2, p: 1.75, borderRadius: 2, bgcolor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }}>
              <Stack direction="row" alignItems="flex-start" spacing={1}>
                <ConsentIcon sx={{ fontSize: 18, color: '#f59e0b', mt: 0.25 }} />
                <Box>
                  <T eid="edu-br-consent-note" sx={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>
                    Samtykke først: profilen opprettes som et <b>utkast</b> og er usynlig for byråer. Studenten <b>varsles på e-post</b>, får lese hva Role Room Talents er, og må selv bekrefte (eller avslå) før noe blir aktivt.
                  </T>
                  <FormControlLabel sx={{ mt: 0.5 }} control={<Checkbox checked={attested} onChange={(e) => setAttested(e.target.checked)} sx={{ color: 'rgba(255,255,255,0.72)', '&.Mui-checked': { color: '#f59e0b' } }} />}
                    label={<Typography sx={{ fontSize: 12.5 }}>Jeg bekrefter at studenten har samtykket til å bli lagt til i Role Room Talents.</Typography>} />
                </Box>
              </Stack>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEdit(null)} disabled={busy} sx={{ color: 'rgba(255,255,255,0.7)', textTransform: 'none' }}>Avbryt</Button>
          <Button variant="contained" onClick={save} disabled={busy || (edit?.status === 'none' && !attested)} sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#7c3aed' }, textTransform: 'none', fontWeight: 700 }}>{busy ? 'Lagrer…' : edit?.status === 'none' ? 'Promoter' : 'Lagre attributter'}</Button>
        </DialogActions>
      </Dialog>

      {/* Avgangs-showcase-dialog */}
      <Dialog open={showcaseOpen} onClose={() => setShowcaseOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: '#141018', color: '#fff', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>Avgangs-showcase</DialogTitle>
        <DialogContent>
          <T eid="edu-br-showcase-help" sx={{ fontSize: 12.5, color: 'rgba(255,255,255,0.75)', mb: 2 }}>Promoterte talenter i kullet. Byråer/casting ser kun de studentene selv har gitt samtykke til.</T>
          {showcaseBusy ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress size={24} sx={{ color: ACCENT }} /></Box>
          ) : showcase.length === 0 ? (
            <Typography sx={{ fontSize: 13, color: 'text.secondary', py: 2 }}>Ingen promoterte talenter i dette kullet ennå.</Typography>
          ) : showcase.map((s) => (
            <Stack key={s.talentId} direction="row" alignItems="center" spacing={1.5} sx={{ py: 1.25, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <Avatar sx={{ width: 36, height: 36, fontSize: 12, bgcolor: 'rgba(139,92,246,0.3)', color: '#e9d5ff' }}>{initials(s.name)}</Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" alignItems="center" spacing={0.75}>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>{s.name}</Typography>
                  {s.claimed ? <VerifiedIcon sx={{ fontSize: 15, color: '#34d399' }} /> : <Chip label="Claimable" size="small" sx={{ height: 17, fontSize: 9.5, bgcolor: 'rgba(245,158,11,0.15)', color: '#f59e0b' }} />}
                </Stack>
                <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>{[s.credential?.program, s.credential?.institution, s.credential?.year].filter(Boolean).join(' · ') || 'Skuespiller'}</Typography>
              </Box>
              {s.showreelUrl && <Button size="small" href={s.showreelUrl} target="_blank" rel="noopener" startIcon={<ShowreelIcon sx={{ fontSize: '15px !important' }} />} sx={{ color: '#c4b5fd', textTransform: 'none', fontSize: 12 }}>Showreel</Button>}
            </Stack>
          ))}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setShowcaseOpen(false)} sx={{ color: 'rgba(255,255,255,0.7)', textTransform: 'none' }}>Lukk</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!toast} autoHideDuration={4000} onClose={() => setToast(null)} message={toast ?? ''} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Box>
  );
}

export default IndustryTab;
