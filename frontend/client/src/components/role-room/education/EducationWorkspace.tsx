/**
 * EducationWorkspace.tsx — parallell workspace for utdanningsinstitusjon-modus
 * (professionMode = 'education'), montert av CastingPlannerPanel sitt mode-short-
 * circuit (som DanceWorkspace for dans).
 *
 * SCAFFOLD (fase 1): gjør at workspacet EKSISTERER og er nåbart med en ekte
 * faglærer-oversikt-struktur + tom-tilstander som beskriver hva hver flate skal
 * inneholde. Innholdet fylles i senere skiver:
 *   - Kull & studenter (roster/grupper, student-seter)
 *   - Studentproduksjoner (hver = fullt Role Room-prosjekt: story-arc/casting/
 *     call-sheet/leveranser)
 *   - Oppgaver & innleveringer (brief → leveranse → frist)
 *   - Vurdering & tilbakemelding (karakter/feedback, gjenbruk godkjenningsflyt)
 *   - Portfolio (showreels/eksamensmapper)
 *   - Fakultet & roller (stab-seter, veileder-tilganger)
 *
 * Selvstendig (ingen backend-kall enda) — plain norske labels, ikke branding-
 * token-systemet, for å holde scaffoldet isolert til education-modus.
 */

import { useState, useEffect, type ReactNode } from 'react';
import { CohortsTab } from './CohortsTab';
import { AssignmentsTab } from './AssignmentsTab';
import { ProductionsTab } from './ProductionsTab';
import { FagstoffTab } from './FagstoffTab';
import { AssessmentTab } from './AssessmentTab';
import { EducationTour, hasSeenEducationTour } from './EducationTour';
import {
  Box, Tabs, Tab, Typography, Card, CardContent, Chip, Stack, Button,
} from '@mui/material';
import {
  School as SchoolIcon,
  Groups as CohortIcon,
  MovieCreation as ProductionIcon,
  Assignment as AssignmentIcon,
  Grading as AssessmentIcon,
  CollectionsBookmark as PortfolioIcon,
  SupervisorAccount as FacultyIcon,
  MenuBook as LibraryIcon,
  Explore as TourIcon,
} from '@mui/icons-material';

type EducationTabId =
  | 'overview'
  | 'cohorts'
  | 'productions'
  | 'assignments'
  | 'fagstoff'
  | 'assessment'
  | 'portfolio'
  | 'faculty';

interface EducationTabDef {
  id: EducationTabId;
  label: string;
  icon: ReactNode;
  /** Hva flaten skal inneholde (vises i tom-tilstand). */
  blurb: string;
}

const EDUCATION_TABS: EducationTabDef[] = [
  { id: 'overview', label: 'Oversikt', icon: <SchoolIcon fontSize="small" />, blurb: 'Faglærer-oversikt: alle kull, aktive studentproduksjoner, progresjon, frister og flagg i én flate.' },
  { id: 'cohorts', label: 'Kull & studenter', icon: <CohortIcon fontSize="small" />, blurb: 'Klasse-/kull-grupper, student-roster og student-seter.' },
  { id: 'productions', label: 'Studentproduksjoner', icon: <ProductionIcon fontSize="small" />, blurb: 'Hver produksjon er et fullt Role Room-prosjekt (story-arc, roller, call-sheet, leveranser). Opprett, tildel og overvåk.' },
  { id: 'assignments', label: 'Oppgaver', icon: <AssignmentIcon fontSize="small" />, blurb: 'Oppgave-brief → student-leveranse → frist. Emner, moduler og læringsmål.' },
  { id: 'fagstoff', label: 'Fagstoff', icon: <LibraryIcon fontSize="small" />, blurb: 'Korte «hvordan»-leksjoner gruppert etter produksjonssteg — lær faget mens dere bruker verktøyet.' },
  { id: 'assessment', label: 'Vurdering', icon: <AssessmentIcon fontSize="small" />, blurb: 'Karakter og tilbakemelding på leveranser (gjenbruker godkjennings-/review-flyten).' },
  { id: 'portfolio', label: 'Portfolio', icon: <PortfolioIcon fontSize="small" />, blurb: 'Studentenes showreels og eksamensmapper.' },
  { id: 'faculty', label: 'Fakultet', icon: <FacultyIcon fontSize="small" />, blurb: 'Stab-seter, lærer-roller og hvem som veileder hvilket kull.' },
];

const ACCENT = '#8B5CF6'; // matcher ProfessionModeChip education-fargen

interface EducationWorkspaceProps {
  projectId?: string;
}

function EmptyState({ tab }: { tab: EducationTabDef }) {
  return (
    <Card sx={{ bgcolor: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.24)', borderRadius: 3 }}>
      <CardContent sx={{ p: 4, textAlign: 'center' }}>
        <Box sx={{ color: ACCENT, mb: 1.5, '& svg': { fontSize: 40 } }}>{tab.icon}</Box>
        <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, mb: 1 }}>{tab.label}</Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.72)', maxWidth: 520, mx: 'auto', fontSize: 14 }}>{tab.blurb}</Typography>
        <Chip label="Kommer i neste skive" size="small" sx={{ mt: 2, bgcolor: 'rgba(139,92,246,0.22)', color: '#e9d5ff', fontWeight: 600 }} />
      </CardContent>
    </Card>
  );
}

export function EducationWorkspace(_props: EducationWorkspaceProps = {}) {
  const [activeTab, setActiveTab] = useState<EducationTabId>('overview');
  const [tourOpen, setTourOpen] = useState(false);
  const active = EDUCATION_TABS.find((t) => t.id === activeTab) ?? EDUCATION_TABS[0];

  // Vis rundturen automatisk én gang for nye faglærere.
  useEffect(() => {
    if (!hasSeenEducationTour()) setTourOpen(true);
  }, []);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0a0a0a', color: '#fff', p: { xs: 2, md: 4 } }}>
      <EducationTour
        open={tourOpen}
        onClose={() => setTourOpen(false)}
        onNavigate={(tab) => setActiveTab(tab)}
      />
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 0.5 }}>
        <SchoolIcon sx={{ color: ACCENT }} />
        <Typography variant="h5" sx={{ fontWeight: 800 }}>Utdannings-workspace</Typography>
        <Chip label="Faglærer" size="small" sx={{ bgcolor: 'rgba(139,92,246,0.22)', color: '#e9d5ff', fontWeight: 700 }} />
        <Box sx={{ flexGrow: 1 }} />
        <Button
          size="small"
          startIcon={<TourIcon />}
          onClick={() => setTourOpen(true)}
          sx={{ color: ACCENT, textTransform: 'none', fontWeight: 600 }}
        >
          Rundtur
        </Button>
      </Stack>
      <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 13.5, mb: 3 }}>
        Undervisning, studentproduksjoner og samarbeid med eksterne oppdragsgivere — i én flate.
      </Typography>

      <Tabs
        value={activeTab}
        onChange={(_e, v: EducationTabId) => setActiveTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          mb: 3,
          '& .MuiTab-root': { color: 'rgba(255,255,255,0.6)', textTransform: 'none', minHeight: 44, fontWeight: 600 },
          '& .Mui-selected': { color: '#fff' },
          '& .MuiTabs-indicator': { backgroundColor: ACCENT },
        }}
      >
        {EDUCATION_TABS.map((t) => (
          <Tab key={t.id} value={t.id} icon={t.icon as React.ReactElement} iconPosition="start" label={t.label} />
        ))}
      </Tabs>

      {active.id === 'overview' ? (
        <Box sx={{ display: 'grid', gap: 2 }}>
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
            {[
              { label: 'Aktive kull', hint: 'Fylles når kull opprettes' },
              { label: 'Studentproduksjoner', hint: 'Pågående prosjekter' },
              { label: 'Leveranser denne uken', hint: 'Frister som nærmer seg' },
              { label: 'Til vurdering', hint: 'Venter på faglærer' },
            ].map((k) => (
              <Card key={k.label} sx={{ flex: '1 1 200px', bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3 }}>
                <CardContent>
                  <Typography sx={{ fontSize: 28, fontWeight: 800, color: ACCENT }}>—</Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{k.label}</Typography>
                  <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>{k.hint}</Typography>
                </CardContent>
              </Card>
            ))}
          </Stack>
          <EmptyState tab={active} />
          <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
            <Button variant="contained" disabled sx={{ bgcolor: ACCENT, '&.Mui-disabled': { bgcolor: 'rgba(139,92,246,0.3)', color: 'rgba(255,255,255,0.5)' } }}>
              Opprett kull (kommer)
            </Button>
            <Button variant="outlined" disabled sx={{ borderColor: 'rgba(139,92,246,0.5)', color: 'rgba(255,255,255,0.5)' }}>
              Ny studentproduksjon (kommer)
            </Button>
          </Stack>
        </Box>
      ) : active.id === 'cohorts' ? (
        <CohortsTab />
      ) : active.id === 'productions' ? (
        <ProductionsTab />
      ) : active.id === 'assignments' ? (
        <AssignmentsTab />
      ) : active.id === 'fagstoff' ? (
        <FagstoffTab />
      ) : active.id === 'assessment' ? (
        <AssessmentTab />
      ) : (
        <EmptyState tab={active} />
      )}
    </Box>
  );
}

export default EducationWorkspace;
