/**
 * EduAssignmentArrivalStripe.tsx — student-ankomststripe i produksjons-modus.
 *
 * Når en student launcher til en artefakt-targetet oppgave fra «Min side»
 * (StudentWorkspace → openProductionInRoleRoom med `assignmentId`), lander de
 * rett i produksjonsverktøyet (f.eks. Story Logic). Denne stripen legger seg
 * som et tynt, sticky bånd over verktøyet og minner om oppgavekonteksten
 * (tittel/brief/frist) + gir en vei tilbake («Min side») og en «Lever»-vei —
 * uten å kapre verktøyet (ingen full-skjerm modal).
 *
 * Bygger på designdoc `2026-08-09-edu-artifact-ui-design.md` §3 (Flate C),
 * Impeccable-korrigert: RailTips-behandlingen (full 1px hairline + lav-alfa
 * lilla vask, `_eduUi.tsx:40`) — IKKE en fargekant (Absolute Ban).
 *
 * Selvstyrt: fanger `?edu=1` + `?assignment=<id>` ÉN gang ved mount (samme
 * mønster som #1982's `isEduStudentSession` i CastingPlannerPanel — før SPA-en
 * ev. skriver om URL-en og dropper parameteret), henter oppgave-konteksten via
 * den eksisterende student-view-tjenesten, og renderer `null` når vilkårene
 * ikke er oppfylt. Ingen ny backend-endepunkt.
 */

import { useEffect, useRef, useState } from 'react';
import { Box, Stack, Typography, Chip, Button, IconButton, Collapse, Drawer } from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Upload as UploadIcon,
  ExpandMore as ExpandMoreIcon,
  AccessTime as OverdueIcon,
  CheckCircle as DeliveredIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { Z_INDEX } from '../config/zIndex';
import { educationStudentViewService, type StudentViewAssignment } from './educationStudentViewService';
import { AssignmentSubmit } from './StudentWorkspace';
import { ACCENT } from './_eduUi';

/** RailTips-behandlingen 1:1 (`_eduUi.tsx:40`) — full ring + lav-alfa vask, ikke en side-stripe. */
const WASH_BG = 'rgba(139,92,246,0.09)';
const WASH_BORDER = '1px solid rgba(139,92,246,0.26)';

function readArrivalParams(): { edu: boolean; assignmentId: string | null } {
  if (typeof window === 'undefined') return { edu: false, assignmentId: null };
  try {
    const sp = new URLSearchParams(window.location.search);
    return { edu: sp.get('edu') === '1', assignmentId: sp.get('assignment') };
  } catch {
    return { edu: false, assignmentId: null };
  }
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  try { return new Date(iso).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return null; }
}

/** Frist-chip-tekst + overtid-signal per designdoc §3.4/§4.1 — aldri kun via farge. */
function dueMeta(iso: string | null): { label: string; overdue: boolean; soon: boolean } | null {
  if (!iso) return null;
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return null;
  const days = Math.ceil((due.getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { label: `${Math.abs(days)} dager på overtid`, overdue: true, soon: false };
  if (days === 0) return { label: 'I dag', overdue: false, soon: true };
  const date = formatDate(iso);
  return { label: `Frist ${date}`, overdue: false, soon: days < 3 };
}

function goBackToStudentHome(): void {
  window.location.assign(`${window.location.origin}/?mode=student`);
}

export function EduAssignmentArrivalStripe() {
  // Fanget ÉN gang ved mount — matcher #1982's isEduStudentSession-mønster,
  // så en SPA-URL-omskriving underveis ikke lar stripen forsvinne/dukke opp
  // uventet.
  const [params] = useState(readArrivalParams);
  const [assignment, setAssignment] = useState<StudentViewAssignment | null>(null);
  const [fetchDone, setFetchDone] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [entered, setEntered] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const reducedMotion = useRef(
    typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  ).current;

  const active = params.edu && !!params.assignmentId;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void educationStudentViewService.getMyView()
      .then((view) => {
        if (cancelled) return;
        setAssignment(view.assignments.find((a) => a.id === params.assignmentId) ?? null);
      })
      .catch(() => { /* robusthet (§3.4): stripe forblir skjult ved feil, ingen feiltilstand vist over verktøyet */ })
      .finally(() => { if (!cancelled) setFetchDone(true); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Ankomst-entré: glir ned fra topp ved mount, én gang. `data-mounted`-styrt
  // i stedet for CSS @starting-style (bredere browser-støtte).
  useEffect(() => {
    if (!assignment) return;
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [assignment]);

  // Scroll-minimer (§3.6): IntersectionObserver på en sentinel rett over
  // stripen — ALDRI window.addEventListener('scroll') (perf-ban i designdocen).
  useEffect(() => {
    if (!assignment || typeof IntersectionObserver === 'undefined') return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setMinimized(!entry.isIntersecting),
      { threshold: 0, rootMargin: '-80px 0px 0px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [assignment]);

  if (!active || !fetchDone || !assignment) return null;

  const due = dueMeta(assignment.dueAt);
  const reviewed = assignment.submissionStatus === 'reviewed';
  const submitted = assignment.submissionStatus !== 'not_started';
  const enterTransform = reducedMotion
    ? {}
    : { transform: entered ? 'translateY(0)' : 'translateY(-100%)', opacity: entered ? 1 : 0 };
  const enterTransition = reducedMotion ? undefined : 'transform 260ms cubic-bezier(0.32,0.72,0,1), opacity 260ms cubic-bezier(0.32,0.72,0,1)';

  return (
    <>
      <Box ref={sentinelRef} sx={{ height: 1 }} aria-hidden />
      <Box
        role="region"
        aria-label={`Oppgave: ${assignment.title}`}
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: Z_INDEX.sticky,
          bgcolor: WASH_BG,
          border: WASH_BORDER,
          borderRadius: 2,
          mx: { xs: 1, sm: 1.5 },
          mt: 1,
          px: 2,
          py: minimized ? 0.75 : { xs: 1.25, sm: 1.5 },
          ...enterTransform,
          transition: enterTransition,
          overflow: 'hidden',
        }}
      >
        {minimized ? (
          <Stack direction="row" alignItems="center" spacing={1.25}>
            <Typography sx={{ fontWeight: 700, fontSize: 13, color: '#fff', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {assignment.title}
            </Typography>
            {due && <DueChip due={due} compact />}
            <SubmitAction reviewed={reviewed} submitted={submitted} grade={assignment.grade} onOpenDrawer={() => setDrawerOpen(true)} compact />
          </Stack>
        ) : (
          <Stack spacing={0.75}>
            <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
              <Typography sx={{ fontWeight: 700, fontSize: 14, color: '#fff', minWidth: 0 }}>
                Oppgave · {assignment.title}
              </Typography>
              <Box sx={{ flex: 1, minWidth: 8 }} />
              {due && <DueChip due={due} />}
              <IconButton
                size="small"
                onClick={() => setExpanded((v) => !v)}
                aria-label="Vis mer"
                sx={{
                  width: 44, height: 44, ml: -0.5,
                  color: 'rgba(255,255,255,0.75)',
                  transform: expanded ? 'rotate(180deg)' : 'none',
                  transition: reducedMotion ? undefined : 'transform 200ms cubic-bezier(0.23,1,0.32,1)',
                }}
              >
                <ExpandMoreIcon fontSize="small" />
              </IconButton>
            </Stack>

            {assignment.brief && (
              <Typography
                sx={{
                  fontSize: 12.5,
                  color: 'rgba(255,255,255,0.72)',
                  ...(expanded
                    ? { whiteSpace: 'pre-wrap' }
                    : { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }),
                }}
              >
                {assignment.brief}
              </Typography>
            )}

            <Collapse in={expanded} timeout={reducedMotion ? 0 : 200}>
              <Stack spacing={0.75} sx={{ pt: 0.5 }}>
                {assignment.learningGoals && (
                  <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                    Læringsmål: {assignment.learningGoals}
                  </Typography>
                )}
                {reviewed && (
                  <Typography sx={{ fontSize: 12, color: '#10b981', fontVariantNumeric: 'tabular-nums' }}>
                    Vurdert{assignment.grade ? ` · Karakter: ${assignment.grade}` : ''}
                  </Typography>
                )}
              </Stack>
            </Collapse>

            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              spacing={1}
              flexWrap="wrap"
              useFlexGap
              sx={{ pt: 0.25 }}
            >
              <Button
                size="small"
                variant="text"
                startIcon={<ArrowBackIcon />}
                onClick={goBackToStudentHome}
                sx={{ color: 'rgba(255,255,255,0.78)', textTransform: 'none', minHeight: 44 }}
              >
                Min side
              </Button>
              <SubmitAction reviewed={reviewed} submitted={submitted} grade={assignment.grade} onOpenDrawer={() => setDrawerOpen(true)} />
            </Stack>
          </Stack>
        )}
      </Box>

      <Drawer
        anchor="bottom"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        ModalProps={{ keepMounted: true }}
        slotProps={{
          paper: {
            sx: {
              bgcolor: '#121218',
              borderTop: '1px solid rgba(255,255,255,0.1)',
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              px: 2,
              pt: 2,
              pb: 'max(16px, env(safe-area-inset-bottom))',
              maxWidth: 480,
              mx: 'auto',
            },
          },
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>Lever arbeidet</Typography>
          <IconButton size="small" onClick={() => setDrawerOpen(false)} aria-label="Lukk" sx={{ color: 'rgba(255,255,255,0.7)', width: 44, height: 44 }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
        <AssignmentSubmit assignment={assignment} />
      </Drawer>
    </>
  );
}

function DueChip({ due, compact = false }: { due: { label: string; overdue: boolean; soon: boolean }; compact?: boolean }) {
  // Status ALDRI kun via farge (WCAG 1.4.1): overtid bærer ikonet i tillegg til
  // rosa/fet tekst. tabular-nums på tallene i «{n} dager på overtid» / dato.
  return (
    <Chip
      size="small"
      icon={due.overdue ? <OverdueIcon sx={{ fontSize: '13px !important' }} /> : undefined}
      label={due.label}
      sx={{
        height: compact ? 20 : 22,
        fontSize: compact ? 10 : 10.5,
        fontWeight: due.overdue ? 700 : 600,
        fontVariantNumeric: 'tabular-nums',
        color: due.overdue ? '#fda4c4' : due.soon ? '#fcd34d' : 'rgba(255,255,255,0.78)',
        bgcolor: due.overdue ? 'rgba(236,72,153,0.14)' : due.soon ? 'rgba(245,158,11,0.14)' : 'rgba(255,255,255,0.06)',
        border: `1px solid ${due.overdue ? 'rgba(236,72,153,0.4)' : due.soon ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.14)'}`,
        '& .MuiChip-icon': { color: 'inherit', ml: '4px' },
      }}
    />
  );
}

function SubmitAction({
  reviewed, submitted, grade, onOpenDrawer, compact = false,
}: {
  reviewed: boolean; submitted: boolean; grade: string | null; onOpenDrawer: () => void; compact?: boolean;
}) {
  if (reviewed) {
    return (
      <Chip
        size="small"
        icon={<DeliveredIcon sx={{ fontSize: '13px !important' }} />}
        label={grade ? `Vurdert · Karakter: ${grade}` : 'Vurdert'}
        sx={{ height: compact ? 20 : 22, fontSize: compact ? 10 : 10.5, fontWeight: 700, color: '#6ee7b7', bgcolor: 'rgba(16,185,129,0.14)', border: '1px solid rgba(16,185,129,0.4)', '& .MuiChip-icon': { color: 'inherit' } }}
      />
    );
  }
  if (submitted) {
    return (
      <Stack direction="row" alignItems="center" spacing={0.75}>
        <Chip
          size="small"
          icon={<DeliveredIcon sx={{ fontSize: '13px !important' }} />}
          label="Levert"
          sx={{ height: compact ? 20 : 22, fontSize: compact ? 10 : 10.5, fontWeight: 700, color: '#6ee7b7', bgcolor: 'rgba(16,185,129,0.14)', border: '1px solid rgba(16,185,129,0.4)', '& .MuiChip-icon': { color: 'inherit' } }}
        />
        {!compact && (
          <Button size="small" variant="text" onClick={onOpenDrawer} sx={{ color: 'rgba(255,255,255,0.6)', textTransform: 'none', fontSize: 11.5, minHeight: 44 }}>
            Rediger levering
          </Button>
        )}
      </Stack>
    );
  }
  return (
    <Button
      size="small"
      variant="contained"
      startIcon={compact ? undefined : <UploadIcon sx={{ fontSize: '15px !important' }} />}
      onClick={onOpenDrawer}
      sx={{
        bgcolor: ACCENT, color: '#fff', textTransform: 'none', fontWeight: 700,
        minHeight: 44, px: compact ? 1.25 : 2,
        '&:hover': { bgcolor: ACCENT },
        '&:active': { transform: 'scale(0.97)' },
      }}
    >
      Lever
    </Button>
  );
}

export default EduAssignmentArrivalStripe;
