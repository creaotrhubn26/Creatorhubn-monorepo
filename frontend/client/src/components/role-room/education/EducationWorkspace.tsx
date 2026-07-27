/**
 * EducationWorkspace.tsx — parallell workspace for utdanningsinstitusjon-modus
 * (professionMode = 'education'), montert av CastingPlannerPanel sitt mode-short-
 * circuit (som DanceWorkspace for dans).
 *
 * Redesign: venstre sidemeny (nav + kom-i-gang-kort + konto) + toppbar (modus-
 * velger, søk, varsler, tema, avatar) + innholdsområde som rendrer aktiv fane.
 * Hver fane eier sin egen sidetittel; Oversikt = det aggregerte dashbordet.
 */

import { useState, useEffect, type ReactNode } from 'react';
import { CohortsTab } from './CohortsTab';
import { CoursesTab } from './CoursesTab';
import { OverviewTab } from './OverviewTab';
import { AssignmentsTab } from './AssignmentsTab';
import { ProductionsTab } from './ProductionsTab';
import { FagstoffTab } from './FagstoffTab';
import { AssessmentTab } from './AssessmentTab';
import { PortfolioTab } from './PortfolioTab';
import { IndustryTab } from './IndustryTab';
import { FacultyTab } from './FacultyTab';
import educationLtiService from './educationLtiService';
import { RoleRoomEduLogo } from './RoleRoomEduLogo';
import { EducationTour, hasSeenEducationTour } from './EducationTour';
import {
  Box, Typography, Card, CardContent, Chip, Stack, Button, InputBase, IconButton, Tooltip, Avatar,
} from '@mui/material';
import {
  School as SchoolIcon,
  Groups as CohortIcon,
  Class as CourseTabIcon,
  MovieCreation as ProductionIcon,
  Assignment as AssignmentIcon,
  Grading as AssessmentIcon,
  CollectionsBookmark as PortfolioIcon,
  Storefront as IndustryIcon,
  SupervisorAccount as FacultyIcon,
  MenuBook as LibraryIcon,
  DashboardCustomize as OverviewIcon,
  Search as SearchIcon,
  NotificationsNone as BellIcon,
  HelpOutline as HelpIcon,
  DarkModeOutlined as ThemeIcon,
  UnfoldMore as SwitchIcon,
  ChatBubbleOutline as FeedbackIcon,
  KeyboardArrowDown as CaretIcon,
} from '@mui/icons-material';

export type EducationTabId =
  | 'overview'
  | 'cohorts'
  | 'courses'
  | 'productions'
  | 'assignments'
  | 'fagstoff'
  | 'assessment'
  | 'portfolio'
  | 'industry'
  | 'faculty';

interface EducationTabDef {
  id: EducationTabId;
  label: string;
  icon: ReactNode;
  blurb: string;
}

const EDUCATION_TABS: EducationTabDef[] = [
  { id: 'overview', label: 'Oversikt', icon: <OverviewIcon fontSize="small" />, blurb: 'Faglærer-oversikt: alle kull, aktive studentproduksjoner, progresjon, frister og flagg i én flate.' },
  { id: 'cohorts', label: 'Kull & studenter', icon: <CohortIcon fontSize="small" />, blurb: 'Klasse-/kull-grupper, student-roster og student-seter.' },
  { id: 'courses', label: 'Emner', icon: <CourseTabIcon fontSize="small" />, blurb: 'Studiepoenggivende emner med læringsutbytte (kunnskap/ferdigheter/generell kompetanse), vurderingsform og oppgaver.' },
  { id: 'productions', label: 'Studentproduksjoner', icon: <ProductionIcon fontSize="small" />, blurb: 'Hver produksjon er et fullt Role Room-prosjekt (story-arc, roller, call-sheet, leveranser). Opprett, tildel og overvåk.' },
  { id: 'assignments', label: 'Oppgaver', icon: <AssignmentIcon fontSize="small" />, blurb: 'Oppgave-brief → student-leveranse → frist. Emner, moduler og læringsmål.' },
  { id: 'fagstoff', label: 'Fagstoff', icon: <LibraryIcon fontSize="small" />, blurb: 'Korte «hvordan»-leksjoner gruppert etter produksjonssteg — lær faget mens dere bruker verktøyet.' },
  { id: 'assessment', label: 'Vurdering', icon: <AssessmentIcon fontSize="small" />, blurb: 'Karakter og tilbakemelding på leveranser (gjenbruker godkjennings-/review-flyten).' },
  { id: 'portfolio', label: 'Portefølje', icon: <PortfolioIcon fontSize="small" />, blurb: 'Studentenes showreels og eksamensmapper.' },
  { id: 'industry', label: 'Bransje', icon: <IndustryIcon fontSize="small" />, blurb: 'Avgangs-pipeline: promoter studenter til Role Room Talents (talent registry), gjør profilene søkbare for byråer/casting og styr avgangs-showcase.' },
  { id: 'faculty', label: 'Fakultet', icon: <FacultyIcon fontSize="small" />, blurb: 'Stab-seter, lærer-roller og hvem som veileder hvilket kull.' },
];

const ACCENT = '#8B5CF6';

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

function Sidebar({ activeTab, onNavigate }: { activeTab: EducationTabId; onNavigate: (t: EducationTabId) => void }) {
  return (
    <Box component="nav" sx={{
      width: 252, flexShrink: 0, height: '100vh', position: 'sticky', top: 0,
      borderRight: '1px solid rgba(255,255,255,0.07)',
      // Kinematisk The Role Room-backdrop (klaffbrett + lilla lys) med mørk
      // gradient-overlegg så nav-teksten holder seg lesbar.
      background: 'linear-gradient(180deg, rgba(10,10,10,0.5) 0%, rgba(12,8,22,0.86) 100%), url(/trr-edu-sidebar-bg.png)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      display: { xs: 'none', md: 'flex' }, flexDirection: 'column', p: 1.75,
    }}>
      {/* Logo — ekte merke + hvitt ordmerke (lesbart på mørk backdrop). */}
      <Box sx={{ px: 0.75, pt: 1.25, pb: 1, mb: 0.5 }}>
        <RoleRoomEduLogo markSize={46} />
      </Box>

      {/* Nav */}
      <Stack spacing={0.4} sx={{ flex: 1, overflow: 'auto' }}>
        {EDUCATION_TABS.map((t) => {
          const active = t.id === activeTab;
          return (
            <Box key={t.id} onClick={() => onNavigate(t.id)} data-edit-id={`edu-nav-${t.id}`} sx={{
              display: 'flex', alignItems: 'center', gap: 1.25, px: 1.5, py: 1.05, borderRadius: 2, cursor: 'pointer',
              color: active ? '#fff' : 'rgba(255,255,255,0.62)',
              bgcolor: active ? 'rgba(139,92,246,0.16)' : 'transparent',
              boxShadow: active ? 'inset 3px 0 0 #8B5CF6' : 'none',
              transition: 'background .15s, color .15s',
              '&:hover': { bgcolor: active ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.05)', color: '#fff' },
              '& svg': { fontSize: 20, color: active ? ACCENT : 'inherit' },
            }}>
              {t.icon}
              <Typography data-edit-id={`edu-nav-lbl-${t.id}`} sx={{ fontSize: 13.5, fontWeight: active ? 700 : 500 }}>{t.label}</Typography>
            </Box>
          );
        })}
      </Stack>

      {/* Kom i gang-kort */}
      <Card sx={{ bgcolor: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.28)', borderRadius: 2.5, p: 1.75, mt: 1 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 13.5, mb: 0.5 }}>Kom i gang med workspace</Typography>
        <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.6)', mb: 1.25 }}>Opprett ditt første kull og inviter studenter for å komme i gang.</Typography>
        <Button fullWidth size="small" variant="contained" onClick={() => onNavigate('cohorts')}
          sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#7c3aed' }, textTransform: 'none', fontWeight: 700, borderRadius: 1.5 }}>Opprett kull</Button>
      </Card>

      {/* Feedback */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 1.5, py: 1.1, mt: 0.5, borderRadius: 2, cursor: 'pointer', color: 'rgba(255,255,255,0.6)', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)', color: '#fff' } }}>
        <FeedbackIcon sx={{ fontSize: 19 }} />
        <Typography sx={{ fontSize: 13 }}>Gi tilbakemelding</Typography>
      </Box>

      {/* Konto */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 1, py: 1, mt: 0.5, borderTop: '1px solid rgba(255,255,255,0.07)', pt: 1.25 }}>
        <Avatar sx={{ width: 30, height: 30, bgcolor: 'rgba(139,92,246,0.3)', color: '#e9d5ff', fontSize: 12, fontWeight: 700 }}>TRR</Avatar>
        <Typography sx={{ fontSize: 13, fontWeight: 600, flex: 1 }}>The Role Room</Typography>
        <CaretIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.4)' }} />
      </Box>
    </Box>
  );
}

function TopBar({ onHelp }: { onHelp: () => void }) {
  const now = new Date();
  const dateLabel = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit' }) +
    ' ' + now.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 2, px: { xs: 2, md: 3 }, py: 1.5,
      borderBottom: '1px solid rgba(255,255,255,0.06)', bgcolor: 'rgba(10,10,10,0.6)',
      backdropFilter: 'blur(8px)', position: 'sticky', top: 0, zIndex: 5,
    }}>
      {/* Modus-velger */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.75, borderRadius: 2, border: '1px solid rgba(255,255,255,0.12)', bgcolor: 'rgba(139,92,246,0.1)', flexShrink: 0 }}>
        <SchoolIcon sx={{ fontSize: 17, color: ACCENT }} />
        <Typography sx={{ fontSize: 13, fontWeight: 600 }}>Utdannings-modus</Typography>
        <SwitchIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.5)' }} />
      </Box>

      {/* Søk */}
      <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 1, flex: 1, maxWidth: 460, px: 1.5, py: 0.6, borderRadius: 2, border: '1px solid rgba(255,255,255,0.1)', bgcolor: 'rgba(255,255,255,0.03)' }}>
        <SearchIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.4)' }} />
        <InputBase placeholder="Søk i workspace…" sx={{ flex: 1, color: '#fff', fontSize: 13.5, '& input::placeholder': { color: 'rgba(255,255,255,0.4)', opacity: 1 } }} />
        <Chip label="⌘K" size="small" sx={{ height: 20, fontSize: 10, bgcolor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }} />
      </Box>
      <Box sx={{ flex: { xs: 1, sm: 0 } }} />

      {/* Ikoner */}
      <Stack direction="row" spacing={0.5} alignItems="center">
        <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.6)' }}><BellIcon fontSize="small" /></IconButton>
        <Tooltip title="Rundtur"><IconButton size="small" onClick={onHelp} sx={{ color: 'rgba(255,255,255,0.6)' }}><HelpIcon fontSize="small" /></IconButton></Tooltip>
        <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.6)' }}><ThemeIcon fontSize="small" /></IconButton>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ pl: 1 }}>
          <Box sx={{ textAlign: 'right', display: { xs: 'none', md: 'block' } }}>
            <Typography sx={{ fontSize: 12, fontWeight: 600, lineHeight: 1.2 }}>{dateLabel}</Typography>
            <Typography sx={{ fontSize: 11, color: ACCENT, lineHeight: 1.2 }}>Faglærer</Typography>
          </Box>
          <Avatar sx={{ width: 34, height: 34, bgcolor: 'rgba(139,92,246,0.35)', color: '#e9d5ff', fontSize: 13, fontWeight: 700 }}>F</Avatar>
        </Stack>
      </Stack>
    </Box>
  );
}

export function EducationWorkspace(_props: EducationWorkspaceProps = {}) {
  const [activeTab, setActiveTab] = useState<EducationTabId>('overview');
  const [tourOpen, setTourOpen] = useState(false);
  // «Legg til oppgave» fra en produksjon → forhåndsvelg produksjonen i Oppgaver.
  const [assignmentPrefillProd, setAssignmentPrefillProd] = useState<string | null>(null);
  const active = EDUCATION_TABS.find((t) => t.id === activeTab) ?? EDUCATION_TABS[0];

  useEffect(() => {
    if (!hasSeenEducationTour()) setTourOpen(true);
  }, []);

  useEffect(() => {
    educationLtiService.captureLaunchContext();
  }, []);

  const renderTab = () => {
    switch (active.id) {
      case 'overview': return <OverviewTab onNavigate={setActiveTab} />;
      case 'cohorts': return <CohortsTab onNavigate={setActiveTab} />;
      case 'courses': return <CoursesTab />;
      case 'productions': return <ProductionsTab onNavigate={setActiveTab} onAddAssignment={(pid) => { setAssignmentPrefillProd(pid); setActiveTab('assignments'); }} />;
      case 'assignments': return <AssignmentsTab prefillProductionId={assignmentPrefillProd} onPrefillConsumed={() => setAssignmentPrefillProd(null)} />;
      case 'fagstoff': return <FagstoffTab />;
      case 'assessment': return <AssessmentTab />;
      case 'portfolio': return <PortfolioTab />;
      case 'industry': return <IndustryTab />;
      case 'faculty': return <FacultyTab />;
      default: return <EmptyState tab={active} />;
    }
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#0a0a0a', color: '#fff' }}>
      <EducationTour open={tourOpen} onClose={() => setTourOpen(false)} onNavigate={(tab) => setActiveTab(tab)} />
      <Sidebar activeTab={activeTab} onNavigate={setActiveTab} />
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <TopBar onHelp={() => setTourOpen(true)} />
        <Box sx={{ flex: 1, position: 'relative' }}>
          {/* Ambient The Role Room-backdrop (lilla lys top-høyre + fage merker
              i hjørnet) — glir ned i solid mørk så innholdskortene forblir rene. */}
          <Box sx={{
            position: 'absolute', top: 0, right: 0, width: '78%', height: 560, pointerEvents: 'none', opacity: 0.7,
            backgroundImage: 'url(/trr-edu-content-bg.png)', backgroundSize: 'cover', backgroundPosition: 'top right', backgroundRepeat: 'no-repeat',
            WebkitMaskImage: 'linear-gradient(to bottom, #000 35%, transparent 100%)',
            maskImage: 'linear-gradient(to bottom, #000 35%, transparent 100%)',
          }} />
          <Box sx={{ position: 'relative', p: { xs: 2, md: 4 } }}>
            {renderTab()}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default EducationWorkspace;
