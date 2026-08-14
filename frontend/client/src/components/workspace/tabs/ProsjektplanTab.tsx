/**
 * ProsjektplanTab — design #2 (Gantt/Prosjektplan), dark CreatorHub.
 * Tidslinje (Gantt) med faser + oppgave-bars + høyre sidebar
 * (Prosjektinformasjon / Milepæler / Ressursallokering / Hurtighandlinger)
 * + Faseoversikt-tabell.
 *
 * Views: Tidslinje (Gantt), Liste, Kalender, Fasevisning
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Box, Stack, Typography, Button, Switch, Avatar, IconButton, Menu, MenuItem, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Accordion, AccordionSummary, AccordionDetails, FormControl, InputLabel, Select, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions, Tooltip, Checkbox, TableSortLabel, TablePagination,
  Divider, useMediaQuery, CircularProgress,
} from '@mui/material';
import { useLocation } from 'wouter';
import FilterList from '@mui/icons-material/FilterList';
import Add from '@mui/icons-material/Add';
import Flag from '@mui/icons-material/Flag';
import UploadFile from '@mui/icons-material/UploadFile';
import CalendarMonth from '@mui/icons-material/CalendarMonth';
import Event from '@mui/icons-material/Event';
import ChevronRight from '@mui/icons-material/ChevronRight';
import Search from '@mui/icons-material/Search';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Remove from '@mui/icons-material/Remove';
import Edit from '@mui/icons-material/Edit';
import Delete from '@mui/icons-material/Delete';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUp from '@mui/icons-material/KeyboardArrowUp';
import CalendarToday from '@mui/icons-material/CalendarToday';
import MoreHoriz from '@mui/icons-material/MoreHoriz';
import AddTask from '@mui/icons-material/AddTask';
import Close from '@mui/icons-material/Close';
import TitleIcon from '@mui/icons-material/Title';
import RadioButtonUnchecked from '@mui/icons-material/RadioButtonUnchecked';
import PlayCircleOutline from '@mui/icons-material/PlayCircleOutline';
import CheckCircleOutline from '@mui/icons-material/CheckCircleOutline';
import Check from '@mui/icons-material/Check';
import {
  DndContext, DragOverlay, useDraggable, useDroppable, PointerSensor, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { apiRequest } from '@/lib/queryClient';
import { CREW_ROLE_CATALOG } from '@shared/crew-roles';
import { ws } from '../workspaceTheme';
import { WsCard, WsSectionTitle, WsBar, WsPills, WsTag, WsTable } from '../ui';
import { crewIcon } from '../crewIcons';
import { useWsLocale, makeT, wsDateLocale, type WsDict, type WsLocale } from '../wsLocale';

// ===== Types =====
interface Milestone {
  id?: string;
  title: string;
  category?: string;
  dueDate?: string | null;
  scheduledDate?: string | null;
  status?: string;
  progress?: number;
  assignee?: string;
  deps?: string[];
  createdAt?: string;
}

interface MilestonesResponse {
  milestones: Milestone[];
}

interface ProjectDetail {
  clientName?: string;
  projectType?: string;
  eventDate?: string | null;
  location?: string;
  status?: string;
}

interface TeamMember {
  crewRole?: string;
  name?: string;
}

interface TimelineBar {
  label: string;
  start: number;
  span: number;
  color: string;
  id?: string;
  milestone?: Milestone;
  deps?: string[];
}

interface Phase {
  name: string;
  dot: string;
  count: string;
  bars: TimelineBar[];
}

type ZoomKey = 'week' | 'month' | 'quarter';
type ViewKey = 'tidslinje' | 'liste' | 'kalender' | 'fase';
type StatusTone = 'green' | 'amber' | 'red' | 'blue' | 'accent' | 'neutral';
type Resource = [string, number, string];
type InfoRow = [string, string];

interface FaseRow {
  name: string;
  st: [string, string];
  avg: number;
  count: string;
  frist: string;
}

interface PhaseViewProps {
  phases: Phase[];
  ms: Milestone[];
  t: (k: string) => string;
  dloc: string;
}

// Lokal no/en-ordbok for fanen (samme mønster som OppdragTab).
const T: WsDict = {
  title: { no: 'Prosjektplan', en: 'Project plan' },
  subtitle: { no: 'Planlegg, organiser og hold oversikt over hele produksjonen.', en: 'Plan, organise and keep track of the entire production.' },
  filter: { no: 'Filter', en: 'Filter' },
  filterAll: { no: 'Alle milepæler', en: 'All milestones' },
  filterUpcoming: { no: 'Kun kommende', en: 'Upcoming only' },
  showMilestones: { no: 'Vis milepæler', en: 'Show milestones' },
  viewTimeline: { no: 'Tidslinje', en: 'Timeline' },
  viewList: { no: 'Liste', en: 'List' },
  viewCalendar: { no: 'Kalender', en: 'Calendar' },
  viewPhase: { no: 'Fasevisning', en: 'Phase view' },
  monthLabel: { no: 'Oktober 2024', en: 'October 2024' },
  today: { no: 'I DAG', en: 'TODAY' },
  phaseOverview: { no: 'Faseoversikt', en: 'Phase overview' },
  colPhase: { no: 'Fase', en: 'Phase' },
  colStatus: { no: 'Status', en: 'Status' },
  colProgress: { no: 'Fremdrift', en: 'Progress' },
  colTasks: { no: 'Oppgaver', en: 'Tasks' },
  colDeadline: { no: 'Frist', en: 'Deadline' },
  stDone: { no: 'Ferdig', en: 'Done' },
  stActive: { no: 'I gang', en: 'In progress' },
  stUpcoming: { no: 'Kommende', en: 'Upcoming' },
  of: { no: 'av', en: 'of' },
  milestonesWord: { no: 'milepæler', en: 'milestones' },
  projectInfo: { no: 'Prosjektinformasjon', en: 'Project information' },
  edit: { no: 'Rediger', en: 'Edit' },
  infoClient: { no: 'Klient', en: 'Client' },
  infoType: { no: 'Prosjekttype', en: 'Project type' },
  infoDate: { no: 'Dato', en: 'Date' },
  infoLocation: { no: 'Lokasjon', en: 'Location' },
  infoStatus: { no: 'Status', en: 'Status' },
  milestones: { no: 'Milepæler', en: 'Milestones' },
  addShort: { no: 'Legg til', en: 'Add' },
  resources: { no: 'Ressursallokering', en: 'Resource allocation' },
  totalLabel: { no: 'Totalt', en: 'Total' },
  quickActions: { no: 'Hurtighandlinger', en: 'Quick actions' },
  newTask: { no: 'Ny oppgave', en: 'New task' },
  taskTitle: { no: 'Tittel', en: 'Title' },
  taskTitlePlaceholder: { no: 'f.eks. Leveransepakke klar', en: 'e.g. Delivery package ready' },
  taskRole: { no: 'Rolle', en: 'Role' },
  taskStatus: { no: 'Status', en: 'Status' },
  taskStatusTodo: { no: 'Å gjøre', en: 'To do' },
  sampleOnly: { no: 'Lagres når prosjektet er ekte.', en: 'Saved once the project is real.' },
  addFailed: { no: 'Kunne ikke legge til', en: 'Could not add' },
  newMilestone: { no: 'Ny milepæl', en: 'New milestone' },
  importPlan: { no: 'Importer plan', en: 'Import plan' },
  promptMsTitle: { no: 'Tittel på milepæl:', en: 'Milestone title:' },
  promptMsDate: { no: 'Dato (ÅÅÅÅ-MM-DD), valgfritt:', en: 'Date (YYYY-MM-DD), optional:' },
  addMsFailed: { no: 'Kunne ikke legge til milepæl', en: 'Could not add the milestone' },
  importedOne: { no: 'milepæl importert.', en: 'milestone imported.' },
  importedMany: { no: 'milepæler importert.', en: 'milestones imported.' },
  importFailed: { no: 'Kunne ikke importere planen', en: 'Could not import the plan' },
  listTitle: { no: 'Oppgaver og milepæler', en: 'Tasks and milestones' },
  listSearch: { no: 'Søk oppgaver...', en: 'Search tasks...' },
  listAll: { no: 'Alle', en: 'All' },
  listPhase: { no: 'Fase', en: 'Phase' },
  listStatus: { no: 'Status', en: 'Status' },
  listAssignee: { no: 'Ansvarlig', en: 'Assignee' },
  listDue: { no: 'Frist', en: 'Due' },
  listActions: { no: 'Handlinger', en: 'Actions' },
  calMonth: { no: 'Måned', en: 'Month' },
  calWeek: { no: 'Uke', en: 'Week' },
  calDay: { no: 'Dag', en: 'Day' },
  calNoEvents: { no: 'Ingen hendelser denne måneden', en: 'No events this month' },
  listEmpty: { no: 'Ingen hendelser i perioden', en: 'No events in this period' },
  calEventsOn: { no: 'hendelser', en: 'events' },
  phaseViewTitle: { no: 'Fasevisning', en: 'Phase view' },
  phaseViewDesc: { no: 'Oversikt over alle faser med fremdrift og milepæler', en: 'Overview of all phases with progress and milestones' },
  phaseNoMilestones: { no: 'Ingen milepæler i denne fasen', en: 'No milestones in this phase' },
  zoomIn: { no: 'Zoom inn', en: 'Zoom in' },
  zoomOut: { no: 'Zoom ut', en: 'Zoom out' },
  zoomLevel: { no: 'Zoom', en: 'Zoom' },
  prevPeriod: { no: 'Forrige periode', en: 'Previous period' },
  nextPeriod: { no: 'Neste periode', en: 'Next period' },
  goToToday: { no: 'Gå til i dag', en: 'Go to today' },
  weekView: { no: 'Ukevisning', en: 'Week view' },
  monthView: { no: 'Månedsvisning', en: 'Month view' },
  quarterView: { no: 'Kvartalsvisning', en: 'Quarter view' },
  dragToResize: { no: 'Dra for å endre varighet', en: 'Drag to resize' },
  plan: { no: 'Plan', en: 'Plan' },
  ttAssignee: { no: 'Ansvarlig', en: 'Assignee' },
  ttPeriod: { no: 'Periode', en: 'Period' },
  ttDeps: { no: 'Avhenger av', en: 'Depends on' },
  menuDeps: { no: 'Vis avhengigheter', en: 'Show dependencies' },
  menuZoom: { no: 'Zoom', en: 'Zoom' },
  menuToToday: { no: 'Gå til i dag', en: 'Go to today' },
  moreActions: { no: 'Flere handlinger', en: 'More actions' },
  emptyPlan: { no: 'Ingen milepæler i tidsrommet ennå. Legg til milepæler eller juster filteret.', en: 'No milestones in this period yet. Add milestones or adjust the filter.' },
  selectAll: { no: 'Velg alle', en: 'Select all' },
  bulkDelete: { no: 'Slett valgte', en: 'Delete selected' },
  bulkMovePhase: { no: 'Flytt til fase', en: 'Move to phase' },
  bulkSetStatus: { no: 'Sett status', en: 'Set status' },
  inlineEdit: { no: 'Rediger', en: 'Edit inline' },
  save: { no: 'Lagre', en: 'Save' },
  cancel: { no: 'Avbryt', en: 'Cancel' },
  expandAll: { no: 'Vis alle', en: 'Expand all' },
  collapseAll: { no: 'Skjul alle', en: 'Collapse all' },
  noEventsThisPeriod: { no: 'Ingen hendelser i denne perioden', en: 'No events this period' },
  progressAutoCalc: { no: 'Fremdrift beregnes automatisk fra oppgaver', en: 'Progress calculated automatically from tasks' },
  groupBy: { no: 'Gruppér', en: 'Group' },
  deps: { no: 'Avhengigheter', en: 'Dependencies' },
  depLegend: { no: 'Etter kildens fremdrift', en: 'By source progress' },
  startWord: { no: 'Start', en: 'Start' },
  endWord: { no: 'Slutt', en: 'End' },
  progressWord: { no: 'Fremdrift', en: 'Progress' },
  commentsWord: { no: 'Kommentarer', en: 'Comments' },
  milestoneWord: { no: 'Milepæl', en: 'Milestone' },
  expandGroup: { no: 'Vis oppgaver', en: 'Show tasks' },
  collapseGroup: { no: 'Skjul oppgaver', en: 'Hide tasks' },
  empty: { no: '—', en: '—' },
  confirmDelete: { no: 'Slette valgte milepæler?', en: 'Delete selected milestones?' },
  resizeLeft: { no: 'Endre start', en: 'Resize start' },
  resizeRight: { no: 'Endre slutt', en: 'Resize end' },
  rowsPerPageWord: { no: 'Rader per side', en: 'Rows per page' },
};

const ROLE_I18N: Record<string, [{ no: string; en: string }, string]> = {
  fotograf: [{ no: 'Foto', en: 'Photo' }, ws.roleFoto],
  videograf: [{ no: 'Video', en: 'Video' }, ws.roleVideo],
  lyd: [{ no: 'Lyd', en: 'Sound' }, ws.roleLyd],
  editor: [{ no: 'Editor', en: 'Editor' }, ws.blue],
  begge: [{ no: 'Foto+Video', en: 'Photo+Video' }, ws.roleFoto],
  assistent: [{ no: 'Assistent', en: 'Assistant' }, ws.roleAnnet],
};

const PHASE_COLORS: string[] = [ws.accent, ws.blue, ws.green, ws.amber, ws.roleAnnet];
// Status → oversatt etikett + tone (brukes i alle visninger)
const statusInfo = (status: string | undefined, t: (k: string) => string): [string, StatusTone] => {
  const TONES: Record<string, StatusTone> = { in_progress: 'accent', pågår: 'accent', completed: 'green', done: 'green', pending: 'neutral', planned: 'neutral' };
  const tone = TONES[status || ''] || 'neutral';
  let label: string;
  if (status === 'completed' || status === 'done') label = t('stDone');
  else if (status === 'in_progress' || status === 'pågår') label = t('stActive');
  else label = t('stUpcoming');
  return [label, tone];
};

// ISO "YYYY-MM-DD" parses som LOKAL dato (ny Date('YYYY-MM-DD') = UTC → tidssonefeil)
const parseISODate = (s: string): Date => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(s);
};
const toISODate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const ZOOM_LEVELS: { key: ZoomKey; label: string; weeks: number; dayWidth: number }[] = [
  { key: 'week', label: 'Uke', weeks: 8, dayWidth: 120 },
  { key: 'month', label: 'Måned', weeks: 16, dayWidth: 60 },
  { key: 'quarter', label: 'Kvartal', weeks: 52, dayWidth: 18 },
];

// Gantt-layout-konstanter
const GANTT_GROUP_H = 44;
const GANTT_ROW_H = 30;
const GANTT_MONTH_H = 22;
const GANTT_DAY_H = 24;

// Helper to get ISO week number
const getISOWeek = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

const INFO: InfoRow[] = [
  ['Klient', 'Sample Studio AS'],
  ['Prosjekttype', 'Brandfilm'],
  ['Dato', '14. september 2024'],
  ['Lokasjon', 'Oslo'],
  ['Status', 'I produksjon'],
];

// Demo-milepæler for /sample: relative datoer (fremover fra i dag) slik at
// kalender/liste/fasevisning viser den samme historien som Gantt-visningen.
const SAMPLE_MS: Milestone[] = (() => {
  const base = new Date();
  const d = (offset: number) => { const x = new Date(base); x.setDate(x.getDate() + offset); return toISODate(x); };
  return [
    { title: 'Forproduksjon ferdig', dueDate: d(-14), status: 'completed', category: '1. Forproduksjon', assignee: 'Anna' },
    { title: 'Opptaksdag', dueDate: d(3), status: 'in_progress', category: '2. Produksjon', assignee: 'Teamet' },
    { title: 'Klar for levering', dueDate: d(24), status: 'pending', category: '3. Etterproduksjon', assignee: 'Daniel' },
    { title: 'Prosjekt levert', dueDate: d(38), status: 'pending', category: '4. Leveranse', assignee: 'Teamet' },
  ];
})();

const RESOURCES: Resource[] = [
  ['Foto', 6, ws.roleFoto],
  ['Video', 6, ws.roleVideo],
  ['Lyd', 2, ws.roleLyd],
  ['Drone', 2, ws.roleDrone],
  ['Annet', 2, ws.roleAnnet],
];

const PHASES: Phase[] = [
  {
    name: '1. Forproduksjon', dot: ws.accent, count: '6 oppgaver', bars: [
      { label: 'Kickoff & brief', start: 0, span: 1.4, color: ws.accent },
      { label: 'Location scout', start: 0.6, span: 1.8, color: ws.accent },
      { label: 'Shotlist & planlegging', start: 1, span: 2.6, color: ws.accent },
      { label: 'Utstyrssjekk', start: 1.4, span: 2.8, color: ws.accent },
    ],
  },
  {
    name: '2. Produksjon', dot: ws.blue, count: '5 oppgaver', bars: [
      { label: 'Opptaksdag (14. sep)', start: 3.4, span: 1.6, color: ws.blue },
      { label: 'Backup & import', start: 4.4, span: 1.0, color: ws.blue },
    ],
  },
  {
    name: '3. Etterproduksjon', dot: ws.green, count: '7 oppgaver', bars: [
      { label: 'Råklipp', start: 0.2, span: 1.6, color: ws.green },
      { label: 'Fargekorrigering', start: 2.0, span: 2.4, color: ws.green },
      { label: 'Lydmix', start: 4.0, span: 1.6, color: ws.green },
      { label: 'Grafikk & titler', start: 4.8, span: 1.8, color: ws.green },
      { label: 'Finpuss', start: 5.6, span: 1.6, color: ws.green },
    ],
  },
  {
    name: '4. Leveranse', dot: ws.amber, count: '4 oppgaver', bars: [
      { label: 'Klientgjennomgang', start: 4.0, span: 1.8, color: ws.amber },
      { label: 'Revisjoner', start: 5.0, span: 1.8, color: ws.amber },
      { label: 'Endelig godkjenning', start: 5.8, span: 1.6, color: ws.amber },
      { label: 'Leveranse', start: 6.6, span: 1.2, color: ws.amber },
    ],
  },
];

const phaseColorFor = (category: string | undefined, phases: Phase[]): string => {
  const idx = phases.findIndex((p) => p.name === category);
  return idx >= 0 ? PHASE_COLORS[idx % PHASE_COLORS.length] : ws.accent;
};

// Demo-metadata for statiske sample-oppgaver (progresjon / ansvarlig / avhengigheter)
const SAMPLE_TASK_META: Record<string, { progress: number; assignee: string; deps: string[] }> = {
  'Kickoff & brief': { progress: 100, assignee: 'Anna', deps: [] },
  'Location scout': { progress: 70, assignee: 'Ola', deps: ['Kickoff & brief'] },
  'Shotlist & planlegging': { progress: 40, assignee: 'Ola', deps: ['Location scout'] },
  'Utstyrssjekk': { progress: 10, assignee: 'Kari', deps: ['Shotlist & planlegging'] },
  'Opptaksdag (14. sep)': { progress: 100, assignee: 'Teamet', deps: ['Utstyrssjekk'] },
  'Backup & import': { progress: 100, assignee: 'Peder', deps: ['Opptaksdag (14. sep)'] },
  'Råklipp': { progress: 60, assignee: 'Daniel', deps: ['Backup & import'] },
  'Fargekorrigering': { progress: 25, assignee: 'Mona', deps: ['Råklipp'] },
  'Lydmix': { progress: 0, assignee: 'Sara', deps: ['Fargekorrigering'] },
  'Grafikk & titler': { progress: 0, assignee: 'Sara', deps: ['Lydmix'] },
  'Finpuss': { progress: 0, assignee: 'Daniel', deps: ['Grafikk & titler'] },
  'Klientgjennomgang': { progress: 0, assignee: 'Klient', deps: ['Finpuss'] },
  'Revisjoner': { progress: 0, assignee: 'Teamet', deps: ['Klientgjennomgang'] },
  'Endelig godkjenning': { progress: 0, assignee: 'Klient', deps: ['Revisjoner'] },
  'Leveranse': { progress: 0, assignee: 'Teamet', deps: ['Endelig godkjenning'] },
};

// ===== MAIN TAB =====
const ProsjektplanTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  const locale: WsLocale = useWsLocale();
  const t = makeT(T, locale);
  const dloc = wsDateLocale(locale);
  const [view, setView] = useState<ViewKey>('tidslinje');
  const [zoomLevel, setZoomLevel] = useState<ZoomKey>('week');
  const [timelineStart, setTimelineStart] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 21);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const isReal = projectId !== 'sample';
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [msAll, setMsAll] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [, navigate] = useLocation();
  const [filterMenu, setFilterMenu] = useState<HTMLElement | null>(null);
  const [dotsMenu, setDotsMenu] = useState<HTMLElement | null>(null);
  const [showMilestones, setShowMilestones] = useState(true);
  const [showDeps, setShowDeps] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [onlyUpcoming, setOnlyUpcoming] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [depHover, setDepHover] = useState<{ src: string; dst: string; depsOfDst: string[] } | null>(null);
  const ms = onlyUpcoming
    ? (isReal ? msAll : SAMPLE_MS).filter((m) => {
      const d = new Date(m.dueDate || m.scheduledDate || m.createdAt || '');
      return isNaN(d.getTime()) || d.getTime() >= Date.now();
    })
    : (isReal ? msAll : SAMPLE_MS);

  // Timeline zoom/pan helpers
  const currentZoom = ZOOM_LEVELS.find((z) => z.key === zoomLevel) || ZOOM_LEVELS[0];
  const isNarrow = useMediaQuery('(max-width: 640px)');
  const ganttLabelW = isNarrow ? 150 : 200;
  const timelineEnd = useMemo(() => {
    const end = new Date(timelineStart);
    end.setDate(end.getDate() + currentZoom.weeks * 7);
    return end;
  }, [timelineStart, currentZoom.weeks]);

  const dateToPercent = useCallback((date: Date): number => {
    const totalMs = timelineEnd.getTime() - timelineStart.getTime();
    if (totalMs <= 0) return 0;
    return ((date.getTime() - timelineStart.getTime()) / totalMs) * 100;
  }, [timelineStart, timelineEnd]);

  const percentToDate = useCallback((percent: number): Date => {
    const totalMs = timelineEnd.getTime() - timelineStart.getTime();
    return new Date(timelineStart.getTime() + (percent / 100) * totalMs);
  }, [timelineStart, timelineEnd]);

  const isTodayInRange = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today >= timelineStart && today <= timelineEnd;
  }, [timelineStart, timelineEnd]);

  const todayPercent = useMemo(() => {
    if (!isTodayInRange) return -1;
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    return dateToPercent(today);
  }, [isTodayInRange, dateToPercent]);

  const goToToday = () => {
    // «I dag» setter vinduets START på dagens dato (vinduet følger fra i dag og utover)
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setTimelineStart(d);
  };

  const handleZoom = (key: ZoomKey) => {
    if (key === zoomLevel) return;
    const center = new Date((timelineStart.getTime() + timelineEnd.getTime()) / 2);
    const target = ZOOM_LEVELS.find((z) => z.key === key);
    if (!target) return;
    const half = (target.weeks * 7) / 2;
    const next = new Date(center);
    next.setDate(next.getDate() - half);
    setZoomLevel(key);
    setTimelineStart(next);
  };

  // Steg zoom med − (ut / mer oversikt) og + (inn / mer detalj)
  const stepZoom = (dir: 1 | -1) => {
    const idx = ZOOM_LEVELS.findIndex((z) => z.key === zoomLevel);
    const next = ZOOM_LEVELS[Math.max(0, Math.min(ZOOM_LEVELS.length - 1, idx + dir))];
    if (next) handleZoom(next.key);
  };

  const loadMs = useCallback(() => {
    if (!isReal) return;
    setLoading(true);
    apiRequest(`/api/photographer/projects/${encodeURIComponent(projectId)}/milestones`)
      .then((r: MilestonesResponse) => setMsAll(Array.isArray(r?.milestones) ? r.milestones : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isReal, projectId]);

  const addMilestone = async () => {
    if (!isReal) return;
    const title = window.prompt(t('promptMsTitle'));
    if (!title?.trim()) return;
    const date = window.prompt(t('promptMsDate')) || '';
    try {
      await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/milestones`, {
        method: 'POST',
        body: { title: title.trim(), dueDate: date.trim() || null, category: 'Milepæler' },
      });
      loadMs();
    } catch (e) {
      const err = e as Error;
      window.alert(err?.message || t('addMsFailed'));
    }
  };

  const importPlan = async (file: File) => {
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      let n = 0;
      for (const line of lines) {
        const [title, date] = line.split(/[;,\t]/).map((x) => (x || '').trim());
        if (!title || /tittel|title/i.test(title)) continue;
        await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/milestones`, {
          method: 'POST',
          body: { title, dueDate: date || null, category: 'Importert' },
        });
        n++;
      }
      loadMs();
      window.alert(`${n} ${n === 1 ? t('importedOne') : t('importedMany')}`);
    } catch (e) {
      const err = e as Error;
      window.alert(err?.message || t('importFailed'));
    }
  };

  useEffect(() => {
    if (!isReal) return;
    apiRequest(`/api/photographer/projects/${encodeURIComponent(projectId)}`)
      .then((r: { project?: ProjectDetail }) => setDetail(r?.project || null))
      .catch(() => {});
    loadMs();
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/team/members`)
      .then((r: { members?: TeamMember[] }) => setMembers(Array.isArray(r?.members) ? r.members : []))
      .catch(() => {});
    const onReload = () => loadMs();
    window.addEventListener('ws-milestones-reload', onReload);
    return () => window.removeEventListener('ws-milestones-reload', onReload);
  }, [projectId, isReal, loadMs]);

  // Build phases from milestones (real) or use static (sample)
  const dates = useMemo(
    () => ms.map((m) => new Date(m.dueDate || m.scheduledDate || m.createdAt || '')).filter((d) => !isNaN(d.getTime())),
    [ms],
  );
  const minT = dates.length ? Math.min(...dates.map((d) => d.getTime())) : 0;
  const maxT = dates.length ? Math.max(...dates.map((d) => d.getTime())) : 1;
  const span = Math.max(1, maxT - minT);
  const cats = useMemo(() => [...new Set(ms.map((m) => m.category || 'Milepæler'))], [ms]);
  const realPhases = useMemo(() => (isReal && ms.length ? cats.map((cat, ci) => ({
    name: cat,
    dot: PHASE_COLORS[ci % PHASE_COLORS.length],
    count: `${ms.filter((m) => (m.category || 'Milepæler') === cat).length} ${t('milestonesWord')}`,
    bars: ms.filter((m) => (m.category || 'Milepæler') === cat).map((m) => {
      const d = new Date(m.dueDate || m.scheduledDate || m.createdAt || '').getTime();
      const start = ((d - minT) / span) * 100;
      return { label: m.title, start, span: 1.2, color: PHASE_COLORS[ci % PHASE_COLORS.length], id: m.id, milestone: m, deps: Array.isArray(m.deps) ? m.deps : [] };
    }),
  })) : null), [isReal, ms, cats, minT, span, t]);
  const phases = useMemo(() => (isReal ? realPhases || [] : PHASES), [isReal, realPhases]);

  // Gantt-radlayout: fasegruppe + enkeltrad per oppgave/milepæl (kollapsbart)
  const ganttRows = useMemo(() => {
    type GanttRow = {
      kind: 'phase' | 'task';
      key: string;
      label: string;
      phase: Phase;
      y: number;
      h: number;
      bar?: TimelineBar;
    };
    const rows: GanttRow[] = [];
    let y = GANTT_MONTH_H + GANTT_DAY_H;
    phases.forEach((ph) => {
      const collapsed = expandedGroups[ph.name] === false;
      rows.push({ kind: 'phase', key: `ph:${ph.name}`, label: ph.name, phase: ph, y, h: GANTT_GROUP_H });
      y += GANTT_GROUP_H;
      if (!collapsed && showMilestones) {
        ph.bars.forEach((b, bi) => {
          rows.push({ kind: 'task', key: b.id || `task:${ph.name}:${bi}`, label: b.label, phase: ph, y, h: GANTT_ROW_H, bar: b });
          y += GANTT_ROW_H;
        });
      }
    });
    return { rows, totalH: y };
  }, [phases, expandedGroups, showMilestones]);

  // Faseoversikt
  const faseRows = useMemo(() => (isReal && ms.length ? cats.map((cat): FaseRow => {
    const items = ms.filter((m) => (m.category || 'Milepæler') === cat);
    const doneN = items.filter((m) => m.status === 'completed' || m.status === 'done').length;
    const avg = items.length ? Math.round(items.reduce((s, m) => s + (Number(m.progress) || 0), 0) / items.length) : 0;
    const dts = items.map((m) => new Date(m.dueDate || m.scheduledDate || '')).filter((d) => !isNaN(d.getTime()));
    const frist = dts.length ? new Date(Math.max(...dts.map((d) => d.getTime()))).toLocaleDateString(dloc, { day: 'numeric', month: 'short' }) : '—';
    const st: [string, string] = doneN === items.length ? [t('stDone'), 'green'] : avg > 0 ? [t('stActive'), 'accent'] : [t('stUpcoming'), 'neutral'];
    return { name: cat, st, avg, count: `${doneN} ${t('of')} ${items.length}`, frist };
  }) : null), [isReal, ms, cats, dloc, t]);

  // Prosjektinformasjon — ekte prosjekt viser ekte detaljer (manglende = «—»), mock kun på /sample.
  const infoRows = useMemo<InfoRow[]>(() => (isReal
    ? [
      [t('infoClient'), detail?.clientName || '—'],
      [t('infoType'), detail?.projectType || '—'],
      [t('infoDate'), detail?.eventDate ? new Date(detail.eventDate).toLocaleDateString(dloc, { day: 'numeric', month: 'long', year: 'numeric' }) : '—'],
      [t('infoLocation'), detail?.location || '—'],
      [t('infoStatus'), detail?.status || '—'],
    ]
    : INFO), [isReal, detail, dloc, t]);

  // Milepæler
  const msList = useMemo(() => ms.slice(0, 8).map((m, i) => [m.title, (m.dueDate || m.scheduledDate)
    ? parseISODate(m.dueDate || m.scheduledDate || '').toLocaleDateString(dloc, { day: 'numeric', month: 'short', year: 'numeric' })
    : '—', PHASE_COLORS[i % PHASE_COLORS.length]] as [string, string, string]), [ms, dloc]);

  // Ressursallokering fra crew-roller
  const roleCount = useMemo(() => {
    const rc: Record<string, number> = {};
    members.forEach((m) => {
      const k = m.crewRole || 'annet';
      rc[k] = (rc[k] || 0) + 1;
    });
    return rc;
  }, [members]);
  const resources = useMemo<Resource[]>(() => (isReal
    ? Object.entries(roleCount).map(([k, v]): Resource => [ROLE_I18N[k]?.[0]?.[locale] || k, v, ROLE_I18N[k]?.[1] || ws.roleAnnet])
    : RESOURCES), [isReal, roleCount, locale]);
  const total = resources.reduce((s, r) => s + r[1], 0);

  // Faseoversikt-tabell-rows (React nodes) — mock kun på /sample, ellers ekte data
  const faseRowsNodes: React.ReactNode[][] = (isReal
    ? (faseRows || [])
    : [
      { name: '1. Forproduksjon', st: ['I gang', 'accent'], avg: 83, count: '5 av 6', frist: '1. sep' },
      { name: '2. Produksjon', st: ['Kommende', 'neutral'], avg: 0, count: '0 av 5', frist: '14. sep' },
      { name: '3. Etterproduksjon', st: ['Kommende', 'neutral'], avg: 0, count: '0 av 7', frist: '5. okt' },
      { name: '4. Leveranse', st: ['Kommende', 'neutral'], avg: 0, count: '0 av 4', frist: '20. okt' },
    ]).map((r) => [
    <Typography key="n" sx={{ fontSize: 13, fontWeight: 600 }}>{r.name}</Typography>,
    <WsTag key="s" label={r.st[0]} tone={r.st[1] as StatusTone} />,
    <Box key="p" sx={{ width: 120 }}><WsBar value={r.avg} /></Box>,
    '',
    <Typography key="c" sx={{ fontSize: 12.5, color: ws.textDim }}>{r.count}</Typography>,
    <Typography key="f" sx={{ fontSize: 12.5, color: ws.textDim }}>{r.frist}</Typography>,
  ]);

  const showSkeleton = isReal && loading && msAll.length === 0;
  return (
    <Stack spacing={2}>
      {/* Tittel */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" sx={{ gap: 1 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>{t('title')}</Typography>
          <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>{t('subtitle')}</Typography>
        </Box>
      </Stack>

      {/* Grid: main (8) + sidebar (4) */}
      {showSkeleton ? (
        <Box sx={{ py: 12, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress size={30} sx={{ color: ws.accent }} />
        </Box>
      ) : (
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '8fr 4fr' }, gap: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <WsCard>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 1.5 }}>
              <WsPills
                items={[
                  { key: 'tidslinje', label: t('viewTimeline') },
                  { key: 'liste', label: t('viewList') },
                  { key: 'kalender', label: t('viewCalendar') },
                  { key: 'fase', label: t('viewPhase') },
                ]}
                value={view}
                onChange={(k) => setView(k as ViewKey)}
              />
            </Stack>

            {view === 'tidslinje' && (
              <>
                {/* Timeline toolbar — zoom (segmented) + navigasjon */}
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5, px: 1, flexWrap: 'wrap', gap: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', gap: 1 }}>
                    {/* Zoom: − | Uke | Måned | Kvartal | + */}
                    <Box sx={{ display: 'flex', alignItems: 'center', border: `1px solid ${ws.border}`, borderRadius: 2, overflow: 'hidden' }}>
                      <IconButton
                        size="small"
                        onClick={() => stepZoom(1)}
                        disabled={zoomLevel === 'quarter'}
                        aria-label={t('zoomOut')}
                        sx={{ borderRadius: 0, color: ws.textDim, '&.Mui-disabled': { color: ws.border } }}
                      >
                        <Remove fontSize="small" />
                      </IconButton>
                      {(['week', 'month', 'quarter'] as ZoomKey[]).map((k) => (
                        <Button
                          key={k}
                          size="small"
                          onClick={() => handleZoom(k)}
                          sx={{
                            borderRadius: 0,
                            minWidth: 44,
                            py: 0.5,
                            textTransform: 'none',
                            color: zoomLevel === k ? ws.accentContrast : ws.text,
                            bgcolor: zoomLevel === k ? ws.accent : 'transparent',
                            fontWeight: zoomLevel === k ? 700 : 500,
                            fontSize: 12,
                            '&:hover': { bgcolor: zoomLevel === k ? ws.accentHover : ws.panelAlt },
                          }}
                        >
                          {t(k === 'week' ? 'weekView' : k === 'month' ? 'monthView' : 'quarterView').replace(/s?visning$/i, '').replace(/ view$/i, '')}
                        </Button>
                      ))}
                      <IconButton
                        size="small"
                        onClick={() => stepZoom(-1)}
                        disabled={zoomLevel === 'week'}
                        aria-label={t('zoomIn')}
                        sx={{ borderRadius: 0, color: ws.textDim, '&.Mui-disabled': { color: ws.border } }}
                      >
                        <Add fontSize="small" />
                      </IconButton>
                    </Box>
                    {/* Navigasjon: ‹ I dag › */}
                    <Box sx={{ display: 'flex', alignItems: 'center', border: `1px solid ${ws.border}`, borderRadius: 2, overflow: 'hidden' }}>
                      <IconButton size="small" onClick={() => setTimelineStart((d) => { const nd = new Date(d); nd.setDate(nd.getDate() - Math.round(currentZoom.weeks * 7 / 2)); return nd; })} aria-label={t('prevPeriod')} sx={{ borderRadius: 0, color: ws.textDim }}><ChevronLeft /></IconButton>
                      <Button size="small" onClick={goToToday} startIcon={<CalendarToday fontSize="small" />} sx={{ borderRadius: 0, textTransform: 'none', color: ws.text, fontSize: 12.5, px: 1 }}>{t('today')}</Button>
                      <IconButton size="small" onClick={() => setTimelineStart((d) => { const nd = new Date(d); nd.setDate(nd.getDate() + Math.round(currentZoom.weeks * 7 / 2)); return nd; })} aria-label={t('nextPeriod')} sx={{ borderRadius: 0, color: ws.textDim }}><ChevronRight /></IconButton>
                    </Box>
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', gap: 1 }}>
                    {/* Filter | Milepæler | ⋯ */}
                    <Button
                      size="small"
                      startIcon={<FilterList />}
                      onClick={(e) => setFilterMenu(e.currentTarget)}
                      sx={{ color: ws.text, border: `1px solid ${ws.border}`, textTransform: 'none', fontSize: 12 }}
                    >
                      {t('filter')}
                    </Button>
                    <Menu anchorEl={filterMenu} open={!!filterMenu} onClose={() => setFilterMenu(null)} PaperProps={{ sx: { bgcolor: ws.panelSolid, color: ws.text, border: `1px solid ${ws.border}` } }}>
                      <MenuItem onClick={() => { setOnlyUpcoming(false); setFilterMenu(null); }}>{t('filterAll')}</MenuItem>
                      <MenuItem onClick={() => { setOnlyUpcoming(true); setFilterMenu(null); }}>{t('filterUpcoming')}</MenuItem>
                    </Menu>
                    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ pl: 0.5, pr: 0.75, border: `1px solid ${ws.border}`, borderRadius: 2, height: 32 }}>
                      <Switch size="small" checked={showMilestones} onChange={(e) => setShowMilestones(e.target.checked)} inputProps={{ 'aria-label': t('showMilestones') }} />
                      <Typography
                        onClick={() => setShowMilestones((v) => !v)}
                        sx={{ fontSize: 12, color: ws.textDim, whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }}
                      >{t('showMilestones')}</Typography>
                    </Stack>
                    {showDeps && (
                      <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mr: 0.75, display: { xs: 'none', md: 'flex' } }}>
                        {([[t('stDone'), ws.green], [t('stActive'), ws.amber], [t('stUpcoming'), ws.textFaint]] as [string, string][]).map(([lbl, c]) => (
                          <Stack key={lbl} direction="row" spacing={0.5} alignItems="center">
                            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: c }} />
                            <Typography sx={{ fontSize: 10.5, color: ws.textDim }}>{lbl}</Typography>
                          </Stack>
                        ))}
                      </Stack>
                    )}
                    <IconButton
                      size="small"
                      onClick={(e) => setDotsMenu(e.currentTarget)}
                      aria-label={t('moreActions')}
                      sx={{ color: ws.textDim, border: `1px solid ${ws.border}`, borderRadius: 2 }}
                    >
                      <MoreHoriz />
                    </IconButton>
                    <Menu anchorEl={dotsMenu} open={!!dotsMenu} onClose={() => setDotsMenu(null)} PaperProps={{ sx: { bgcolor: ws.panelSolid, color: ws.text, border: `1px solid ${ws.border}` } }}>
                      <MenuItem dense onClick={() => { setShowDeps((v) => !v); setDotsMenu(null); }}>
                        <Checkbox size="small" checked={showDeps} sx={{ p: 0, mr: 1 }} />{t('menuDeps')}
                      </MenuItem>
                    </Menu>
                    <Typography variant="caption" sx={{ color: ws.textFaint, display: { xs: 'none', sm: 'inline' } }}>
                      {timelineStart.toLocaleDateString(locale)} — {timelineEnd.toLocaleDateString(locale)}
                    </Typography>
                  </Stack>
                </Stack>

                {/* Timeline header with date labels */}
                <Box sx={{ overflowX: 'auto', overflowY: 'hidden', pb: 1, mb: 1, '&::-webkit-scrollbar': { height: 8 }, '&::-webkit-scrollbar-thumb': { bgcolor: ws.border, borderRadius: 4 } }}>
                  <Box sx={{ width: ganttLabelW + currentZoom.weeks * currentZoom.dayWidth * 7, position: 'relative' }}>
                    {/* Header — to lag: måned + dag/uke */}
                    <Stack direction="row">
                      <Box sx={{ width: ganttLabelW, flexShrink: 0, position: 'sticky', left: 0, zIndex: 3, bgcolor: ws.panelSolid, borderBottom: `1px solid ${ws.border}`, borderRight: `1px solid ${ws.border}`, display: 'flex', alignItems: 'center', px: 1.5 }}>
                        <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: ws.textFaint, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('plan')}</Typography>
                      </Box>
                      <Box sx={{ flex: 1, position: 'relative' }}>
                        {/* Månedslag */}
                        <Box sx={{ height: GANTT_MONTH_H, position: 'relative', borderBottom: `1px solid ${ws.border}`, bgcolor: ws.panel }}>
                          {(() => {
                            const segs: { key: string; left: number; width: number; label: string }[] = [];
                            let segStart = new Date(timelineStart);
                            const cursor = new Date(timelineStart.getFullYear(), timelineStart.getMonth(), 1);
                            while (segStart.getTime() < timelineEnd.getTime()) {
                              const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
                              const segEnd = new Date(Math.min(timelineEnd.getTime(), monthEnd.getTime()));
                              const w = dateToPercent(segEnd) - dateToPercent(segStart);
                              if (w > 0.2) {
                                segs.push({ key: `${cursor.getFullYear()}-${cursor.getMonth()}`, left: dateToPercent(segStart), width: w, label: segStart.toLocaleDateString(locale, { month: 'long', year: 'numeric' }) });
                              }
                              segStart = segEnd;
                              cursor.setMonth(cursor.getMonth() + 1);
                            }
                            return segs.map((s) => (
                              <Box key={s.key} sx={{ position: 'absolute', left: `${s.left}%`, width: `${s.width}%`, top: 0, bottom: 0, display: 'flex', alignItems: 'center', px: 1, borderLeft: `1px solid ${ws.borderSoft}` }}>
                                <Typography sx={{ fontSize: 11, fontWeight: 600, color: ws.textDim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</Typography>
                              </Box>
                            ));
                          })()}
                        </Box>
                        {/* Dag/ukelag */}
                        <Box sx={{ height: GANTT_DAY_H, position: 'relative', borderBottom: `1px solid ${ws.borderSoft}` }}>
                          {currentZoom.dayWidth >= 55 ? (
                            Array.from({ length: currentZoom.weeks * 7 }, (_, i) => {
                              const d = new Date(timelineStart);
                              d.setDate(d.getDate() + i);
                              const dow = d.getDay();
                              const weekend = dow === 0 || dow === 6;
                              const isToday = d.toDateString() === new Date().toDateString();
                              return (
                                <Box key={i} sx={{ position: 'absolute', left: `${(i / (currentZoom.weeks * 7)) * 100}%`, width: `${100 / (currentZoom.weeks * 7)}%`, top: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, borderLeft: `1px solid ${ws.borderSoft}`, bgcolor: weekend ? ws.panelAlt : 'transparent' }}>
                                  <Typography sx={{ fontSize: 10, fontWeight: isToday ? 800 : 500, color: isToday ? ws.accent : weekend ? ws.textFaint : ws.textDim, textTransform: 'capitalize' }}>{d.toLocaleDateString(locale, { weekday: 'short' })}</Typography>
                                  <Typography sx={{ fontSize: 9.5, fontWeight: isToday ? 800 : 500, color: isToday ? ws.accent : ws.textFaint }}>{d.getDate()}</Typography>
                                </Box>
                              );
                            })
                          ) : (
                            Array.from({ length: currentZoom.weeks }, (_, i) => {
                              const wsDate = new Date(timelineStart);
                              wsDate.setDate(wsDate.getDate() + i * 7);
                              return (
                                <Box key={i} sx={{ position: 'absolute', left: `${(i / currentZoom.weeks) * 100}%`, width: `${100 / currentZoom.weeks}%`, top: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: `1px solid ${ws.borderSoft}` }}>
                                  <Typography sx={{ fontSize: currentZoom.dayWidth >= 30 ? 10.5 : 9, fontWeight: 600, color: ws.textDim }}>U{String(getISOWeek(wsDate)).padStart(2, '0')}</Typography>
                                </Box>
                              );
                            })
                          )}
                          {isTodayInRange && (
                            <Box sx={{ position: 'absolute', left: `${todayPercent}%`, top: 0, bottom: 0, width: 2, bgcolor: ws.accent, zIndex: 6 }}>
                              <Box sx={{ position: 'absolute', top: 3, left: -1, transform: 'translateX(-50%)', px: 0.75, py: 0.25, borderRadius: 1, bgcolor: ws.accent, color: ws.accentContrast, fontSize: 9, fontWeight: 800, whiteSpace: 'nowrap' }}>{t('today')}</Box>
                            </Box>
                          )}
                        </Box>
                      </Box>
                    </Stack>

                    {/* Faser + oppgaver — Gantt-kropp */}
                    {ganttRows.rows.length === 0 ? (
                      <Box sx={{ py: 6, textAlign: 'center', color: ws.textFaint, fontSize: 12.5, borderBottom: `1px solid ${ws.borderSoft}` }}>
                        {t('emptyPlan')}
                      </Box>
                    ) : (
                    <Box sx={{ position: 'relative' }}>
                      {ganttRows.rows.map((row) => (
                        <Stack key={row.key} direction="row">
                          <Box sx={{ width: ganttLabelW, flexShrink: 0, position: 'sticky', left: 0, zIndex: 2, bgcolor: ws.panelSolid, borderBottom: `1px solid ${ws.borderSoft}`, borderRight: `1px solid ${ws.border}`, pr: 1, pl: row.kind === 'task' ? 2.5 : 1, display: 'flex', alignItems: 'center', height: row.h }}>
                            {row.kind === 'phase' ? (
                              <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                                <IconButton
                                  size="small"
                                  onClick={() => setExpandedGroups((p) => ({ ...p, [row.phase.name]: !(p[row.phase.name] ?? true) }))}
                                  sx={{ p: 0.25, color: ws.textDim }}
                                  aria-label={expandedGroups[row.phase.name] === false ? t('expandGroup') : t('collapseGroup')}
                                >
                                  <ChevronRight sx={{ fontSize: 16, transform: (expandedGroups[row.phase.name] === false) ? 'rotate(0deg)' : 'rotate(90deg)', transition: 'transform 0.15s' }} />
                                </IconButton>
                                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: row.phase.dot, flexShrink: 0 }} />
                                <Typography noWrap sx={{ fontSize: 13, fontWeight: 700 }}>{row.phase.name}</Typography>
                                <Typography sx={{ fontSize: 10.5, color: ws.textFaint, ml: 'auto', pr: 0.5 }}>{row.phase.count}</Typography>
                              </Stack>
                            ) : (
                              <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: row.bar?.color || ws.accent, flexShrink: 0 }} />
                                <Typography noWrap sx={{ fontSize: 12.5, fontWeight: 500 }}>{row.bar?.label}</Typography>
                              </Stack>
                            )}
                          </Box>
                          <Box sx={{ flex: 1, position: 'relative', height: row.h, borderBottom: `1px solid ${ws.borderSoft}`, bgcolor: row.kind === 'phase' ? ws.panelAlt : 'transparent' }}>
                            {/* Uke-rutenett + i dag-linje */}
                            {Array.from({ length: currentZoom.weeks }, (_, i) => i > 0 && (
                              <Box key={i} sx={{ position: 'absolute', left: `${(i / currentZoom.weeks) * 100}%`, top: 0, bottom: 0, width: 1, bgcolor: ws.borderSoft }} />
                            ))}
                            {isTodayInRange && <Box sx={{ position: 'absolute', left: `${todayPercent}%`, top: 0, bottom: 0, width: 2, bgcolor: ws.accent, opacity: 0.55, zIndex: 2 }} />}
                            {row.kind === 'phase' ? (
                              <Box sx={{ position: 'absolute', left: 10, right: 10, top: '50%', transform: 'translateY(-50%)', height: 5, borderRadius: 3, bgcolor: 'rgba(127,127,127,0.18)', overflow: 'hidden' }}>
                                <Box sx={{ width: `${row.phase.bars.length ? (row.phase.bars.filter((b) => (SAMPLE_TASK_META[b.label]?.progress ?? (Number(b.milestone?.progress) || 0)) === 100).length / row.phase.bars.length) * 100 : 0}%`, height: '100%', bgcolor: row.phase.dot, borderRadius: 3, transition: 'width 0.35s ease' }} />
                              </Box>
                            ) : row.bar ? (
                              <TimelineBarComponent
                                key={row.bar.id || row.bar.label}
                                bar={row.bar}
                                row={0}
                                timelineStart={timelineStart}
                                dateToPercent={dateToPercent}
                                zoomLevel={zoomLevel}
                                locale={locale}
                                t={t}
                                dimmed={depHover !== null && depHover.dst !== row.bar.label && depHover.depsOfDst.indexOf(row.bar.label) === -1}
                                onUpdate={async (updatedBar) => {
                                  if (isReal && row.bar?.milestone?.id) {
                                    const newDate = percentToDate(updatedBar.start);
                                    try {
                                      await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/milestones/${encodeURIComponent(row.bar.milestone.id)}`, {
                                        method: 'PATCH',
                                        body: { dueDate: toISODate(newDate) },
                                      });
                                      window.dispatchEvent(new CustomEvent('ws-milestones-reload'));
                                    } catch {
                                      // ignore
                                    }
                                  }
                                }}
                              />
                            ) : null}
                          </Box>
                        </Stack>
                      ))}
                      {/* Avhengigheter: ortogonale albue-forbindelser med farge etter kildens fremdrift */}
                      {showDeps && ganttRows.rows.length > 0 && (
                        <Box sx={{ position: 'absolute', left: ganttLabelW, top: 0, width: currentZoom.weeks * currentZoom.dayWidth * 7, height: Math.max(0, ganttRows.totalH - GANTT_MONTH_H - GANTT_DAY_H), pointerEvents: 'none', zIndex: 5 }}>
                            {(() => {
                              const totalDays = currentZoom.weeks * 7;
                              const trackW = totalDays * currentZoom.dayWidth;
                              const headerH = GANTT_MONTH_H + GANTT_DAY_H;
                              const byLabel: Record<string, { rowY: number; left: number; right: number; progress: number }> = {};
                              ganttRows.rows.forEach((r) => {
                                if (r.kind !== 'task' || !r.bar) return;
                                const sDate = new Date(timelineStart);
                                sDate.setDate(sDate.getDate() + r.bar.start * 7);
                                const startPct = dateToPercent(sDate);
                                const eDate = new Date(sDate);
                                eDate.setDate(eDate.getDate() + r.bar.span * 7);
                                const spanPct = Math.max(0.5, dateToPercent(eDate) - startPct);
                                const meta = SAMPLE_TASK_META[r.bar.label];
                                const progress = isReal
                                  ? (Number(r.bar.milestone?.progress) || (r.bar.milestone?.status === 'completed' || r.bar.milestone?.status === 'done' ? 100 : r.bar.milestone?.status === 'in_progress' ? 50 : 0))
                                  : (meta ? meta.progress : 0);
                                byLabel[r.bar.label] = {
                                  rowY: (r.y - headerH) + r.h / 2,
                                  left: (startPct / 100) * trackW,
                                  right: ((startPct + spanPct) / 100) * trackW,
                                  progress,
                                };
                              });
                              const depsOf = (label: string): string[] => isReal
                                ? (byLabel[label] ? ganttRows.rows.find((r) => r.kind === 'task' && r.bar?.label === label)?.bar?.deps || [] : [])
                                : (SAMPLE_TASK_META[label]?.deps || []);
                              // Samle: { dst: string; srcDeps: [src, ...][] } og fan-index per kilde
                              const depsByDst = new Map<string, string[]>();
                              const srcCount = new Map<string, number>();
                              const segs: { key: string; from: { x: number; y: number }; to: { x: number; y: number }; dropX: number; color: string; label: string; src: string; dst: string; dimmed: boolean; crossed: boolean }[] = [];
                              Object.keys(byLabel).forEach((dst) => {
                                depsOf(dst).forEach((dep) => {
                                  if (!byLabel[dep]) return;
                                  if (!depsByDst.has(dst)) depsByDst.set(dst, []);
                                  depsByDst.get(dst)!.push(dep);
                                });
                              });
                              Object.entries(Object.fromEntries(depsByDst)).forEach(([dst, srcLabels]) => {
                                srcLabels.forEach((src) => {
                                  const s = byLabel[src];
                                  const d = byLabel[dst];
                                  const idx = (srcCount.get(src) || 0);
                                  srcCount.set(src, idx + 1);
                                  const crossed = s.right >= d.left;
                                  const FAN_STEP = 26;
                                  let dropX = srcCount.size ? s.right + 10 + idx * FAN_STEP : s.right + 10;
                                  if (dropX > d.left - 24) dropX = Math.max(s.right + 8, d.left - 24);
                                  const progress = s.progress;
                                  const color = progress >= 100 ? ws.green : progress > 0 ? ws.amber : ws.textFaint;
                                  segs.push({
                                    key: `${src}->${dst}`,
                                    from: { x: s.right + 2, y: s.rowY },
                                    to: { x: d.left - 5, y: d.rowY },
                                    dropX,
                                    color,
                                    label: `${src} → ${dst}`,
                                    src,
                                    dst,
                                    dimmed: depHover !== null && depHover.dst !== dst && depHover.depsOfDst.indexOf(src) === -1,
                                    crossed,
                                  });
                                });
                              });
                              const mid = (a: number, b: number) => (a + b) / 2;
                              return (
                                <>
                                  <svg width="100%" height="100%" style={{ overflow: 'visible' }}>
                                  {segs.map((s) => {
                                    const hovered = depHover !== null && depHover.dst === s.dst;
                                    const mx = mid(s.from.x, s.to.x);
                                    const pathD = `M ${s.from.x} ${s.from.y} H ${s.dropX} V ${s.to.y} H ${s.to.x}`;
                                    return (
                                      <g
                                        key={s.key}
                                        style={{ pointerEvents: 'visibleStroke', cursor: 'crosshair' }}
                                        onMouseEnter={() => setDepHover({ src: s.src, dst: s.dst, depsOfDst: depsByDst.get(s.dst) || [] })}
                                        onMouseLeave={() => setDepHover((p) => (p && p.dst === s.dst ? null : p))}
                                      >
                                        <path
                                          d={pathD}
                                          fill="none"
                                          stroke={s.color}
                                          strokeWidth={hovered ? 2.6 : 1.8}
                                          strokeOpacity={s.dimmed ? 0.12 : hovered ? 1 : 0.85}
                                          opacity={s.crossed ? 0.7 : 1}
                                        />
                                        {/* Pilspiss inn i mål-baren (flippet retning for kryssede forbindelser) */}
                                        <path
                                          d={s.crossed
                                            ? `M ${s.to.x + 3} ${s.to.y - 4} L ${s.to.x - 1} ${s.to.y} L ${s.to.x + 3} ${s.to.y + 4}`
                                            : `M ${s.to.x - 5} ${s.to.y - 4} L ${s.to.x + 1} ${s.to.y} L ${s.to.x - 5} ${s.to.y + 4}`}
                                          fill="none"
                                          stroke={s.color}
                                          strokeWidth={hovered ? 2.6 : 1.8}
                                          strokeOpacity={s.dimmed ? 0.12 : hovered ? 1 : 0.9}
                                          opacity={s.crossed ? 0.7 : 1}
                                        />
                                        {/* Startpunkt-sirkel ved kilden */}
                                        <circle cx={s.from.x} cy={s.from.y} r={hovered ? 3.5 : 2.6} fill={s.color} opacity={s.dimmed ? 0.12 : 1} />
                                      </g>
                                    );
                                  })}
                                </svg>
                                {/* Hover-chip: «kilde → mål» */}
                                {depHover && segs.length > 0 && (() => {
                                  const active = segs.find((s) => s.dst === depHover.dst);
                                  if (!active) return null;
                                  const cx = mid(active.from.x, active.to.x);
                                  const cy = mid(active.from.y, active.to.y);
                                  return (
                                    <Box
                                      sx={{
                                        position: 'absolute',
                                        left: cx,
                                        top: cy - 14,
                                        transform: 'translate(-50%, -100%)',
                                        px: 1, py: 0.5, borderRadius: 1,
                                        bgcolor: ws.panelSolid,
                                        color: ws.text,
                                        border: `1px solid ${ws.border}`,
                                        fontSize: 10.5, fontWeight: 600,
                                        whiteSpace: 'nowrap',
                                        zIndex: 7,
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
                                      }}
                                    >
                                      {active.label}
                                    </Box>
                                  );
                                })()}
                              </>
                            );
                          })()}
                        </Box>
                      )}
                    </Box>
                    )}
                  </Box>
                </Box>
              </>
            )}

            {view === 'liste' && (
              <ListView
                ms={ms}
                phases={phases}
                t={t}
                dloc={dloc}
                projectId={projectId}
                isReal={isReal}
                navigate={navigate}
              />
            )}

            {view === 'kalender' && (
              <CalendarView
                ms={ms}
                phases={phases}
                t={t}
                locale={locale}
                dloc={dloc}
                projectId={projectId}
              />
            )}

            {view === 'fase' && (
              <PhaseView
                phases={phases}
                ms={ms}
                t={t}
                dloc={dloc}
              />
            )}
          </WsCard>
        </Box>

        {/* Sidebar */}
        <Stack spacing={2} sx={{ minWidth: 0 }}>
          <WsCard>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 1.5 }}>
              <WsSectionTitle title={t('projectInfo')} />
            </Stack>
            {infoRows.map(([k, v]) => (
              <Stack key={k} direction="row" justifyContent="space-between" sx={{ py: 0.7, borderBottom: `1px solid ${ws.borderSoft}` }}>
                <Typography sx={{ fontSize: 12, color: ws.textDim }}>{k}</Typography>
                <Typography sx={{ fontSize: 12, fontWeight: 600 }}>{v}</Typography>
              </Stack>
            ))}
          </WsCard>

          <WsCard>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 1.5 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{t('milestones')}</Typography>
              <Button size="small" startIcon={<Add />} onClick={addMilestone} disabled={!isReal} sx={{ color: ws.accent, textTransform: 'none' }}>{t('addShort')}</Button>
            </Stack>
            <Stack spacing={1}>
              {msList.map(([title, date, color], i) => (
                <Stack key={i} direction="row" spacing={1} alignItems="center">
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
                  <Typography sx={{ fontSize: 12.5, flex: 1 }}>{title}</Typography>
                  <Typography sx={{ fontSize: 11.5, color: ws.textFaint }}>{date}</Typography>
                </Stack>
              ))}
            </Stack>
          </WsCard>

          <WsCard>
            <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 1.5 }}>{t('resources')}</Typography>
            <Stack direction="row" spacing={2} alignItems="center">
              <Box sx={{ position: 'relative', width: 96, height: 96 }}>
                <svg width={96} height={96} viewBox="0 0 96 96">
                  {(() => {
                    let a = -90;
                    const r = 40, cx = 48, cy = 48, C = 2 * Math.PI * r;
                    return resources.map(([n, v, c], i) => {
                      const frac = v / (total || 1);
                      const dash = C * frac;
                      const el = (
                        <circle
                          key={`${n}-${i}`}
                          cx={cx} cy={cy} r={r} fill="none" stroke={c} strokeWidth={12}
                          strokeDasharray={`${dash} ${C - dash}`}
                          strokeDashoffset={-C * ((a + 90) / 360)}
                          transform={`rotate(-90 ${cx} ${cy})`}
                        />
                      );
                      a += frac * 360;
                      return el;
                    });
                  })()}
                </svg>
                <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography sx={{ fontSize: 20, fontWeight: 800 }}>{total}</Typography>
                  <Typography sx={{ fontSize: 10, color: ws.textDim }}>{t('totalLabel')}</Typography>
                </Box>
              </Box>
              <Stack spacing={0.5} sx={{ flex: 1 }}>
                {resources.map(([n, v, c]) => (
                  <Stack key={n} direction="row" spacing={1} alignItems="center">
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: c }} />
                    <Typography sx={{ fontSize: 12, flex: 1 }}>{n}</Typography>
                    <Typography sx={{ fontSize: 12, fontWeight: 700 }}>{v}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Stack>
          </WsCard>

          <WsCard>
            <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 1 }}>{t('quickActions')}</Typography>
            <Stack spacing={1}>
              <Button fullWidth size="small" startIcon={<Add sx={{ fontSize: 15 }} />} onClick={() => setTaskModalOpen(true)} sx={{ justifyContent: 'flex-start', color: ws.text, border: `1px solid ${ws.border}`, textTransform: 'none' }}>{t('newTask')}</Button>
              <Button fullWidth size="small" startIcon={<Flag sx={{ fontSize: 15 }} />} onClick={addMilestone} disabled={!isReal} sx={{ justifyContent: 'flex-start', color: ws.text, border: `1px solid ${ws.border}`, textTransform: 'none' }}>{t('newMilestone')}</Button>
              <Button fullWidth size="small" startIcon={<UploadFile sx={{ fontSize: 15 }} />} onClick={() => fileInput.current?.click()} disabled={!isReal} sx={{ justifyContent: 'flex-start', color: ws.text, border: `1px solid ${ws.border}`, textTransform: 'none' }}>{t('importPlan')}</Button>
              <input ref={fileInput} type="file" accept=".csv,.txt" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importPlan(f); e.target.value = ''; }} />
            </Stack>
          </WsCard>
        </Stack>
      </Box>
      )}

      {/* Faseoversikt (under visningen, ikke i tidslinjen) */}
      {view !== 'tidslinje' && (
      <Box sx={{ mt: 2 }}>
        <Typography sx={{ fontSize: 15, fontWeight: 700, mb: 1.5 }}>{t('phaseOverview')}</Typography>
        {faseRowsNodes.length === 0 ? (
          <Box sx={{ py: 5, textAlign: 'center', color: ws.textDim, fontSize: 13, border: `1px solid ${ws.borderSoft}`, borderRadius: 2 }}>
            {t('listEmpty')}
          </Box>
        ) : (
        <WsTable
          columns={[t('colPhase'), t('colStatus'), t('colProgress'), '', t('colTasks'), t('colDeadline')]}
          rows={faseRowsNodes}
        />
        )}
      </Box>
      )}

      {taskModalOpen && (
        <NewTaskModal
          projectId={projectId}
          isReal={isReal}
          locale={locale}
          t={t}
          onClose={() => setTaskModalOpen(false)}
        />
      )}
    </Stack>
  );
};

// ===== NEW TASK MODAL =====
const NewTaskModal: React.FC<{
  projectId: string;
  isReal: boolean;
  locale: WsLocale;
  t: (k: string) => string;
  onClose: () => void;
}> = ({ projectId, isReal, locale, t, onClose }) => {
  const [title, setTitle] = useState('');
  const [crewRole, setCrewRole] = useState('begge');
  const [status, setStatus] = useState('todo');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const name = title.trim();
    if (!name) return;
    if (!isReal) { window.alert(t('sampleOnly')); return; }
    setSaving(true);
    try {
      await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/board-tasks`, {
        method: 'POST',
        body: { title: name, crewRole, status },
      });
      onClose();
    } catch (err) {
      const e = err as Error;
      window.alert(e?.message || t('addFailed'));
    } finally {
      setSaving(false);
    }
  };

  const STATUS_OPTS = [
    { value: 'todo', icon: <RadioButtonUnchecked sx={{ fontSize: 16, color: ws.textFaint }} />, label: t('taskStatusTodo') },
    { value: 'in_progress', icon: <PlayCircleOutline sx={{ fontSize: 16, color: ws.amber }} />, label: t('stActive') },
    { value: 'done', icon: <CheckCircleOutline sx={{ fontSize: 16, color: ws.green }} />, label: t('stDone') },
  ];
  const roleDef = (key: string) => CREW_ROLE_CATALOG.find((r) => r.key === key);

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs" PaperProps={{ sx: { bgcolor: ws.panelSolid, color: ws.text, border: `1px solid ${ws.border}`, borderRadius: 2.5 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontSize: 16, fontWeight: 700, pr: 1 }}>
        <Box sx={{ width: 34, height: 34, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: ws.accentSoft, flexShrink: 0 }}>
          <AddTask sx={{ fontSize: 18, color: ws.accent }} />
        </Box>
        {t('newTask')}
        <Box sx={{ flex: 1 }} />
        <IconButton size="small" onClick={onClose} aria-label={t('cancel')} sx={{ color: ws.textFaint }}><Close sx={{ fontSize: 18 }} /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: '16px !important' }}>
        <Stack spacing={2}>
          <TextField
            autoFocus
            label={t('taskTitle')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
            placeholder={t('taskTitlePlaceholder')}
            fullWidth
            size="small"
            slotProps={{
              input: {
                sx: { color: ws.text },
                startAdornment: <TitleIcon sx={{ fontSize: 18, color: ws.textFaint, mr: 1 }} />,
              },
            }}
            InputLabelProps={{ sx: { color: ws.textDim } }}
            sx={{ '& .MuiOutlinedInput-notchedOutline': { borderColor: ws.border }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: ws.textFaint }, '& .Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: ws.accent } }}
          />
          <FormControl fullWidth size="small">
            <InputLabel sx={{ color: ws.textDim }}>{t('taskRole')}</InputLabel>
            <Select
              value={crewRole}
              onChange={(e) => setCrewRole(e.target.value)}
              label={t('taskRole')}
              renderValue={(v) => {
                const r = roleDef(v);
                return (
                  <Stack direction="row" spacing={1} alignItems="center">
                    {crewIcon(r?.icon || 'Groups', { fontSize: 16 })}
                    <Typography sx={{ fontSize: 13 }}>{locale === 'en' ? r?.labelEn : r?.label}</Typography>
                  </Stack>
                );
              }}
              sx={{ color: ws.text, '& .MuiOutlinedInput-notchedOutline': { borderColor: ws.border }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: ws.textFaint } }}
            >
              {CREW_ROLE_CATALOG.map((r) => (
                <MenuItem key={r.key} value={r.key} sx={{ gap: 1, fontSize: 13 }}>
                  {crewIcon(r.icon, { fontSize: 16 })} {locale === 'en' ? r.labelEn : r.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth size="small">
            <InputLabel sx={{ color: ws.textDim }}>{t('taskStatus')}</InputLabel>
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              label={t('taskStatus')}
              renderValue={(v) => {
                const o = STATUS_OPTS.find((s) => s.value === v);
                return (
                  <Stack direction="row" spacing={1} alignItems="center">
                    {o?.icon}
                    <Typography sx={{ fontSize: 13 }}>{o?.label}</Typography>
                  </Stack>
                );
              }}
              sx={{ color: ws.text, '& .MuiOutlinedInput-notchedOutline': { borderColor: ws.border }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: ws.textFaint } }}
            >
              {STATUS_OPTS.map((o) => (
                <MenuItem key={o.value} value={o.value} sx={{ gap: 1, fontSize: 13 }}>
                  {o.icon} {o.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
        <Button size="small" startIcon={<Close sx={{ fontSize: 15 }} />} onClick={onClose} sx={{ color: ws.textDim, textTransform: 'none', border: `1px solid ${ws.border}`, borderRadius: 2 }}>{t('cancel')}</Button>
        <Button
          size="small"
          variant="contained"
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <Check sx={{ fontSize: 15 }} />}
          onClick={save}
          disabled={!title.trim() || saving}
          sx={{ textTransform: 'none', bgcolor: ws.accent, color: ws.accentContrast, borderRadius: 2, '&:hover': { bgcolor: ws.accentHover } }}
        >{t('save')}</Button>
      </DialogActions>
    </Dialog>
  );
};

// ===== TIMELINE BAR COMPONENT =====
interface TimelineBarProps {
  bar: TimelineBar;
  dateToPercent: (date: Date) => number;
  zoomLevel: ZoomKey;
  row?: number;
  timelineStart: Date;
  locale?: string;
  t?: (k: string) => string;
  dimmed?: boolean;
  onUpdate: (updatedBar: { start: number; span: number }) => void;
}

const TimelineBarComponent: React.FC<TimelineBarProps> = ({ bar, dateToPercent, zoomLevel, row = 0, timelineStart, locale, t, dimmed = false, onUpdate }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, start: 0, span: 0 });
  const [live, setLive] = useState<{ start: number; span: number } | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  // Compute position: real milestones use dates; hardcoded sample bars use week-index start/span.
  const hasDate = !!(bar.milestone?.dueDate || bar.milestone?.scheduledDate);
  let startPercent: number;
  let actualSpan: number;
  if (hasDate) {
    startPercent = dateToPercent(new Date(bar.milestone?.dueDate || bar.milestone?.scheduledDate || ''));
    const endDate = new Date(bar.milestone?.dueDate || bar.milestone?.scheduledDate || '');
    endDate.setDate(endDate.getDate() + Math.round(bar.span * (zoomLevel === 'week' ? 7 : zoomLevel === 'month' ? 30 : 90)));
    const endPercent = dateToPercent(endDate);
    actualSpan = Math.max(0.5, endPercent - startPercent);
  } else {
    const sDate = new Date(timelineStart);
    sDate.setDate(sDate.getDate() + bar.start * 7);
    startPercent = dateToPercent(sDate);
    const eDate = new Date(sDate);
    eDate.setDate(eDate.getDate() + bar.span * 7);
    actualSpan = Math.max(0.5, dateToPercent(eDate) - startPercent);
  }
  startPercent = Math.max(0, Math.min(100 - actualSpan, startPercent));

  // Under aktiv dra/resize brukes live-posisjon slik at baren følger musepekeren
  const effStart = live ? live.start : startPercent;
  const effSpan = live ? live.span : actualSpan;

  const handlePointerDown = (e: React.PointerEvent, mode: 'drag' | 'resize-left' | 'resize-right') => {
    e.stopPropagation();
    e.preventDefault();
    setDragStart({ x: e.clientX, start: live ? live.start : startPercent, span: live ? live.span : actualSpan });
    setLive(null);
    if (mode === 'drag') setIsDragging(true);
    else if (mode === 'resize-left') setIsResizingLeft(true);
    else setIsResizingRight(true);
  };

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (!isDragging && !isResizingLeft && !isResizingRight) return;
      const deltaX = e.clientX - dragStart.x;
      const totalWidth = barRef.current?.parentElement?.getBoundingClientRect().width || 1000;
      const percentPerPx = 100 / totalWidth;
      const deltaPercent = deltaX * percentPerPx;

      let newStart = dragStart.start;
      let newSpan = dragStart.span;

      if (isDragging) {
        newStart = Math.max(0, Math.min(100 - dragStart.span, dragStart.start + deltaPercent));
      } else if (isResizingLeft) {
        newStart = Math.max(0, dragStart.start + deltaPercent);
        newSpan = Math.max(0.5, dragStart.span - deltaPercent);
      } else if (isResizingRight) {
        newSpan = Math.max(0.5, Math.min(100 - dragStart.start, dragStart.span + deltaPercent));
      }

      onUpdate({ start: newStart, span: newSpan });
      setLive({ start: newStart, span: newSpan });
    };

    const handleUp = () => {
      setLive(null);
      setIsDragging(false);
      setIsResizingLeft(false);
      setIsResizingRight(false);
    };

    if (isDragging || isResizingLeft || isResizingRight) {
      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
    }
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [isDragging, isResizingLeft, isResizingRight, dragStart, bar, onUpdate]);

  const active = isDragging || isResizingLeft || isResizingRight;

  // Metadata: progresjon / ansvarlig / avhengigheter (sample → statisk meta, ekte → milepæl)
  const meta = SAMPLE_TASK_META[bar.label];
  const progress = Math.max(0, Math.min(100, meta ? meta.progress : Number(bar.milestone?.progress) || 0));
  const assignee = meta ? meta.assignee : (bar.milestone?.assignee || '');
  const deps = meta ? meta.deps : (bar.deps || []);
  const startDate = hasDate
    ? new Date(bar.milestone?.dueDate || bar.milestone?.scheduledDate || '')
    : (() => { const d = new Date(timelineStart); d.setDate(d.getDate() + bar.start * 7); return d; })();
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + (hasDate ? Math.round(bar.span * (zoomLevel === 'week' ? 7 : zoomLevel === 'month' ? 30 : 90)) : bar.span * 7));
  const done = progress >= 100;
  const wideEnough = effSpan > 7;

  return (
    <Tooltip
      title={
        <Box>
          <Typography sx={{ fontSize: 12, fontWeight: 700, mb: 0.5 }}>{bar.label}</Typography>
          {assignee && <Typography sx={{ fontSize: 11.5, color: ws.textDim }}>{t ? t('ttAssignee') : 'Ansvarlig'}: {assignee}</Typography>}
          <Typography sx={{ fontSize: 11.5, color: ws.textDim }}>{t ? t('ttPeriod') : 'Periode'}: {startDate.toLocaleDateString(locale || 'nb-NO', { day: 'numeric', month: 'short' })} → {endDate.toLocaleDateString(locale || 'nb-NO', { day: 'numeric', month: 'short' })}</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
            <Box sx={{ flex: 1, height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.15)', overflow: 'hidden' }}>
              <Box sx={{ width: `${progress}%`, height: '100%', bgcolor: done ? ws.green : ws.accent, borderRadius: 2 }} />
            </Box>
            <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: done ? ws.green : ws.textDim }}>{progress}%</Typography>
          </Box>
          {deps.length > 0 && <Typography sx={{ fontSize: 11, color: ws.textFaint, mt: 0.5 }}>{t ? t('ttDeps') : 'Avhenger av'}: {deps.join(', ')}</Typography>}
        </Box>
      }
      arrow
      placement="top"
      slotProps={{ tooltip: { sx: { bgcolor: ws.panelSolid, color: ws.text, border: `1px solid ${ws.border}`, borderRadius: `${ws.radiusSm}px`, fontSize: 11 } } }}
    >
      <Box
        ref={barRef}
        sx={{
          position: 'absolute',
          top: row * GANTT_ROW_H + 3,
          left: `${effStart}%`,
          width: `${effSpan}%`,
          height: 24,
          borderRadius: 2,
          bgcolor: bar.color,
          display: 'flex',
          alignItems: 'center',
          px: 1,
          overflow: 'visible',
          cursor: 'grab',
          touchAction: 'none',
          zIndex: active ? 100 : 1,
          transition: active ? 'opacity 0.1s' : 'left 0.18s ease, width 0.18s ease, opacity 0.15s',
          opacity: active ? 0.7 : dimmed ? 0.3 : done ? 0.75 : 0.95,
          '&:hover': { opacity: 1 },
          '&:focus-visible': { outline: `2px solid ${ws.accent}`, outlineOffset: 2 },
        }}
        onPointerDown={(e) => handlePointerDown(e, 'drag')}
        role="slider"
        aria-label={bar.label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(effStart)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            const step = 0.5;
            const newStart = Math.max(0, Math.min(100 - actualSpan, effStart + (e.key === 'ArrowLeft' ? -step : step)));
            setLive({ start: newStart, span: actualSpan });
            onUpdate({ start: newStart, span: actualSpan });
          }
        }}
      >
        {/* Fremdrift */}
        {progress > 0 && progress < 100 && (
          <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${progress}%`, bgcolor: 'rgba(255,255,255,0.28)', borderRadius: 2, pointerEvents: 'none' }} />
        )}
        {done && <Box sx={{ position: 'absolute', right: 4, top: 0, bottom: 0, display: 'flex', alignItems: 'center', fontSize: 11, fontWeight: 800, color: 'rgba(10,10,10,0.55)', pointerEvents: 'none' }}>✓</Box>}
        <Typography
          noWrap
          sx={{ fontSize: 11, fontWeight: 600, color: '#0a0a0a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
        >
          {bar.label}
        </Typography>
        {assignee && wideEnough && (
          <Box sx={{ ml: 'auto', pl: 1, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: 'rgba(10,10,10,0.28)', color: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8.5, fontWeight: 800 }}>{assignee.slice(0, 1)}</Box>
            <Typography sx={{ fontSize: 9.5, fontWeight: 600, color: 'rgba(10,10,10,0.7)' }}>{assignee}</Typography>
          </Box>
        )}
        <Box
          sx={{
            position: 'absolute', left: -4, top: '50%', transform: 'translateY(-50%)',
            width: 8, height: 16, bgcolor: 'inherit', border: '1px solid #0a0a0a', borderRadius: 1,
            cursor: 'ew-resize', touchAction: 'none', opacity: 0, transition: 'opacity 0.1s', '&:hover': { opacity: 1 }, '@media (pointer: coarse)': { opacity: 1 },
          }}
          onPointerDown={(e) => handlePointerDown(e, 'resize-left')}
          aria-label={t ? t('resizeLeft') : 'Resize start'}
        />
        <Box
          sx={{
            position: 'absolute', right: -4, top: '50%', transform: 'translateY(-50%)',
            width: 8, height: 16, bgcolor: 'inherit', border: '1px solid #0a0a0a', borderRadius: 1,
            cursor: 'ew-resize', touchAction: 'none', opacity: 0, transition: 'opacity 0.1s', '&:hover': { opacity: 1 }, '@media (pointer: coarse)': { opacity: 1 },
          }}
          onPointerDown={(e) => handlePointerDown(e, 'resize-right')}
          aria-label={t ? t('resizeRight') : 'Resize end'}
        />
      </Box>
    </Tooltip>
  );
};

// ===== LIST VIEW =====
interface ListViewProps {
  ms: Milestone[];
  phases: Phase[];
  t: (k: string) => string;
  dloc: string;
  projectId: string;
  isReal: boolean;
  navigate: (path: string) => void;
}

const ListView: React.FC<ListViewProps> = ({ ms, phases, t, dloc, projectId, isReal, navigate }) => {
  const [search, setSearch] = useState('');
  const [phaseFilter, setPhaseFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortKey, setSortKey] = useState<string>('title');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ title?: string; status?: string; dueDate?: string }>({});
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [reload, setReload] = useState(0);

  const phaseOptions = ['all', ...phases.map((p) => p.name)];
  const statusOptions = ['all', 'completed', 'in_progress', 'pending', 'planned'];

  const filtered = useMemo(() => {
    let list = ms.filter((m) => {
      const title = (m.title || '').toLowerCase();
      const matchesSearch = title.includes(search.toLowerCase());
      const cat = m.category || 'Milepæler';
      const matchesPhase = phaseFilter === 'all' || cat === phaseFilter;
      const status = m.status || 'pending';
      const matchesStatus = statusFilter === 'all' || status === statusFilter;
      return matchesSearch && matchesPhase && matchesStatus;
    });
    list = [...list].sort((a, b) => {
      if (sortKey === 'dueDate') {
        const va = new Date(a.dueDate || a.scheduledDate || 0).getTime();
        const vb = new Date(b.dueDate || b.scheduledDate || 0).getTime();
        return va === vb ? 0 : (va < vb ? -1 : 1) * (sortDir === 'asc' ? 1 : -1);
      }
      const va = String(a[sortKey as keyof Milestone] || '').toString().toLowerCase();
      const vb = String(b[sortKey as keyof Milestone] || '').toString().toLowerCase();
      if (va === vb) return 0;
      return (va < vb ? -1 : 1) * (sortDir === 'asc' ? 1 : -1);
    });
    return list;
  }, [ms, search, phaseFilter, statusFilter, sortKey, sortDir]);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filtered.length && filtered.length > 0) setSelected(new Set());
    else setSelected(new Set(filtered.map((m) => String(m.id))));
  };

  const bulkAction = async (action: 'delete' | 'move' | 'status', value?: string) => {
    if (action === 'delete' && !window.confirm(t('confirmDelete'))) return;
    if (!isReal) {
      setSelected(new Set());
      setReload((r) => r + 1);
      return;
    }
    for (const id of selected) {
      try {
        if (action === 'delete') {
          await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/milestones/${encodeURIComponent(id)}`, { method: 'DELETE' });
        } else if (action === 'move') {
          await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/milestones/${encodeURIComponent(id)}`, { method: 'PATCH', body: { category: value } });
        } else if (action === 'status') {
          await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/milestones/${encodeURIComponent(id)}`, { method: 'PATCH', body: { status: value } });
        }
      } catch {
        // ignore per-item failures
      }
    }
    setSelected(new Set());
    setReload((r) => r + 1);
  };

  const startEdit = (m: Milestone) => {
    setEditingId(String(m.id || m.title));
    setEditDraft({ title: m.title, status: m.status || 'pending', dueDate: m.dueDate || m.scheduledDate || '' });
  };

  const saveEdit = async () => {
    if (!editingId || !isReal) {
      setEditingId(null);
      setEditDraft({});
      return;
    }
    try {
      await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/milestones/${encodeURIComponent(editingId)}`, {
        method: 'PATCH',
        body: { title: editDraft.title, status: editDraft.status, dueDate: editDraft.dueDate || null },
      });
    } catch {
      // ignore
    }
    setEditingId(null);
    setEditDraft({});
    setReload((r) => r + 1);
  };

  useEffect(() => {
    if (reload > 0 && isReal) {
      window.dispatchEvent(new CustomEvent('ws-milestones-reload'));
    }
  }, [reload, isReal]);

  // Hold side innenfor gyldig område når data reduseres (sletting/filtrering)
  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(filtered.length / rowsPerPage) - 1);
    setPage((p) => Math.min(p, maxPage));
  }, [filtered.length, rowsPerPage]);

  const pageRows = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Box>
      <Stack direction="row" spacing={2} sx={{ mb: 2, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder={t('listSearch')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 250 }}
          InputProps={{ startAdornment: <Search sx={{ color: ws.textDim }} /> }}
          aria-label={t('listSearch')}
        />
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="phase-filter-label">{t('listPhase')}</InputLabel>
          <Select label={t('listPhase')} value={phaseFilter} labelId="phase-filter-label" onChange={(e) => setPhaseFilter(e.target.value as string)}>
            {phaseOptions.map((opt) => <MenuItem key={opt} value={opt}>{opt === 'all' ? t('listAll') : opt}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel id="status-filter-label">{t('listStatus')}</InputLabel>
          <Select label={t('listStatus')} value={statusFilter} labelId="status-filter-label" onChange={(e) => setStatusFilter(e.target.value as string)}>
            {statusOptions.map((opt) => <MenuItem key={opt} value={opt}>{opt === 'all' ? t('listAll') : (opt === 'completed' ? t('stDone') : opt === 'in_progress' ? t('stActive') : t('stUpcoming'))}</MenuItem>)}
          </Select>
        </FormControl>
        {selected.size > 0 && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ ml: 'auto', flexWrap: 'wrap' }}>
            <Typography variant="caption" sx={{ color: ws.textDim }}>{selected.size} {t('of')} {filtered.length}</Typography>
            <Button size="small" color="error" startIcon={<Delete />} onClick={() => bulkAction('delete')}>{t('bulkDelete')}</Button>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <Select
                value=""
                displayEmpty
                onChange={(e) => { if (e.target.value) bulkAction('move', e.target.value as string); }}
                renderValue={() => <span style={{ fontSize: 12 }}>{t('bulkMovePhase')}</span>}
              >
                {phases.map((p) => <MenuItem key={p.name} value={p.name}>{p.name}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <Select
                value=""
                displayEmpty
                onChange={(e) => { if (e.target.value) bulkAction('status', e.target.value as string); }}
                renderValue={() => <span style={{ fontSize: 12 }}>{t('bulkSetStatus')}</span>}
              >
                {statusOptions.filter((o) => o !== 'all').map((opt) => <MenuItem key={opt} value={opt}>{(opt === 'completed' ? t('stDone') : opt === 'in_progress' ? t('stActive') : t('stUpcoming'))}</MenuItem>)}
              </Select>
            </FormControl>
          </Stack>
        )}
      </Stack>

      <TableContainer sx={{ border: `1px solid ${ws.border}`, borderRadius: 2 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  indeterminate={selected.size > 0 && selected.size < filtered.length}
                  checked={filtered.length > 0 && selected.size === filtered.length}
                  onChange={toggleSelectAll}
                  aria-label={t('selectAll')}
                  sx={{ color: ws.textDim, '&.Mui-checked': { color: ws.accent }, '&.MuiCheckbox-indeterminate': { color: ws.accent } }}
                />
              </TableCell>
              <TableCell>
                <TableSortLabel active={sortKey === 'title'} direction={sortDir} onClick={() => handleSort('title')}>{t('listTitle')}</TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel active={sortKey === 'category'} direction={sortDir} onClick={() => handleSort('category')}>{t('listPhase')}</TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel active={sortKey === 'status'} direction={sortDir} onClick={() => handleSort('status')}>{t('listStatus')}</TableSortLabel>
              </TableCell>
              <TableCell>{t('listAssignee')}</TableCell>
              <TableCell>
                <TableSortLabel active={sortKey === 'dueDate'} direction={sortDir} onClick={() => handleSort('dueDate')}>{t('listDue')}</TableSortLabel>
              </TableCell>
              <TableCell align="right">{t('listActions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} sx={{ textAlign: 'center', py: 4, color: ws.textDim }}>
                  {t('listEmpty')}
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((m) => {
                const id = String(m.id || m.title);
                const isEditing = editingId === id;
                const [stLabel, stTone] = statusInfo(m.status, t);
                return (
                  <TableRow key={id} hover selected={selected.has(id)}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selected.has(id)}
                        onChange={() => toggleSelect(id)}
                        sx={{ color: ws.textDim, '&.Mui-checked': { color: ws.accent } }}
                      />
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <TextField size="small" value={editDraft.title || ''} onChange={(e) => setEditDraft((d) => ({ ...d, title: e.target.value }))} sx={{ minWidth: 180 }} />
                      ) : (
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>{m.title}</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <FormControl size="small" sx={{ minWidth: 140 }}>
                          <Select value={editDraft.status || 'pending'} onChange={(e) => setEditDraft((d) => ({ ...d, status: e.target.value as string }))}>
                            {statusOptions.filter((o) => o !== 'all').map((opt) => <MenuItem key={opt} value={opt}>{(opt === 'completed' ? t('stDone') : opt === 'in_progress' ? t('stActive') : t('stUpcoming'))}</MenuItem>)}
                          </Select>
                        </FormControl>
                      ) : (
                        <Chip label={m.category || 'Milepæler'} size="small" variant="outlined" sx={{ borderColor: ws.border }} />
                      )}
                    </TableCell>
                    <TableCell>
                      <WsTag label={stLabel} tone={stTone} />
                    </TableCell>
                    <TableCell>
                      {m.assignee ? <Avatar sx={{ width: 28, height: 28, fontSize: 11 }}>{m.assignee[0]}</Avatar> : '—'}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <TextField
                          size="small"
                          type="date"
                          value={editDraft.dueDate || ''}
                          onChange={(e) => setEditDraft((d) => ({ ...d, dueDate: e.target.value }))}
                          sx={{ minWidth: 140 }}
                        />
                      ) : (
                        (m.dueDate || m.scheduledDate) ? new Date(m.dueDate || m.scheduledDate || '').toLocaleDateString(dloc) : '—'
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        {isEditing ? (
                          <>
                            <Button size="small" onClick={saveEdit}>{t('save')}</Button>
                            <Button size="small" onClick={() => { setEditingId(null); setEditDraft({}); }}>{t('cancel')}</Button>
                          </>
                        ) : (
                          <>
                            <Tooltip title={t('inlineEdit')}>
                              <IconButton size="small" onClick={() => startEdit(m)} aria-label={t('inlineEdit')}><Edit fontSize="small" /></IconButton>
                            </Tooltip>
                            <Tooltip title={t('bulkDelete')}>
                              <IconButton size="small" onClick={() => { setSelected(new Set([id])); bulkAction('delete'); }} aria-label={t('bulkDelete')}><Delete fontSize="small" /></IconButton>
                            </Tooltip>
                            <IconButton size="small" onClick={() => navigate(`/workspace/${projectId}/oppgaver`)}><ChevronRight fontSize="small" /></IconButton>
                          </>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={filtered.length}
        page={page}
        onPageChange={(_e, p) => setPage(p)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
        labelRowsPerPage={t('rowsPerPageWord')}
        labelDisplayedRows={({ from, to, count }) => `${from}–${to} ${t('of')} ${count}`}
        sx={{ color: ws.textDim, '& .MuiTablePagination-toolbar': { minHeight: 52 } }}
      />
    </Box>
  );
};

// ===== CALENDAR VIEW =====
interface CalendarViewProps {
  ms: Milestone[];
  phases: Phase[];
  t: (k: string) => string;
  locale: WsLocale;
  dloc: string;
  projectId: string;
}

const dayKeyOf = (d: Date): string => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const isoDateOf = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// ===== Draggable event chip (calendar) =====
interface DraggableEventChipProps {
  event: Milestone;
  compact?: boolean;
  color: string;
  onClick: (ev: Milestone) => void;
}

const DraggableEventChip: React.FC<DraggableEventChipProps> = ({ event, compact = false, color, onClick }) => {
  const dragId = `cal-event-${event.id || event.title}`;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId,
    data: { event },
  });
  return (
    <Box ref={setNodeRef} {...listeners} {...attributes} sx={{ opacity: isDragging ? 0.35 : 1 }}>
      <Chip
        label={event.title}
        size="small"
        variant="filled"
        onClick={(e) => { e.stopPropagation(); onClick(event); }}
        sx={{
          fontSize: compact ? 9 : 10,
          height: compact ? 18 : 20,
          maxWidth: '100%',
          bgcolor: color,
          cursor: 'grab',
          '& .MuiChip-label': { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
        }}
      />
    </Box>
  );
};

// ===== Droppable day box (calendar) =====
interface DroppableDayBoxProps {
  isoDate: string;
  children: React.ReactNode;
  sx?: Record<string, unknown>;
  onClick?: () => void;
}

const DroppableDayBox: React.FC<DroppableDayBoxProps> = ({ isoDate, children, sx, onClick }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `cal-day-${isoDate}`,
    data: { isoDate },
  });
  return (
    <Box
      ref={setNodeRef}
      onClick={onClick}
      onKeyDown={(e) => { if (onClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick(); } }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      sx={{
        ...sx,
        outline: isOver ? `2px solid ${ws.accent}` : undefined,
        bgcolor: isOver ? ws.accentSoft : (sx?.bgcolor as string | undefined),
        '&:focus-visible': { outline: `2px solid ${ws.accent}`, outlineOffset: -2 },
      }}
    >
      {children}
    </Box>
  );
};

const CalendarView: React.FC<CalendarViewProps> = ({ ms, phases, t, locale, dloc, projectId }) => {
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
  const [selectedEvent, setSelectedEvent] = useState<Milestone | null>(null);
  const [activeDragEvent, setActiveDragEvent] = useState<Milestone | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const today = new Date();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const startDay = (firstDayOfMonth.getDay() + 6) % 7;
  const daysInMonth = lastDayOfMonth.getDate();
  const prevMonthDays = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0).getDate();

  const monthName = currentDate.toLocaleDateString(locale === 'en' ? 'en-US' : 'nb-NO', { month: 'long', year: 'numeric' });

  const eventsByDate = useMemo<Record<string, Milestone[]>>(() => {
    const map: Record<string, Milestone[]> = {};
    ms.forEach((m) => {
      const date = m.dueDate || m.scheduledDate;
      if (date) {
        const d = parseISODate(date);
        const key = dayKeyOf(d);
        if (!map[key]) map[key] = [];
        map[key].push(m);
      }
    });
    return map;
  }, [ms]);

  const isToday = (y: number, m: number, d: number) =>
    d === today.getDate() && m === today.getMonth() && y === today.getFullYear();

  const renderEventChip = (ev: Milestone, compact = false) => (
    <DraggableEventChip
      event={ev}
      compact={compact}
      color={phaseColorFor(ev.category, phases)}
      onClick={setSelectedEvent}
    />
  );

  // Drag-drop: flytt hendelse til ny dag → PATCH dueDate
  const handleDragStart = useCallback((e: DragStartEvent) => {
    const ev = e.active.data.current?.event as Milestone | undefined;
    if (ev) setActiveDragEvent(ev);
  }, []);

  const handleDragEnd = useCallback(async (e: DragEndEvent) => {
    setActiveDragEvent(null);
    const ev = e.active.data.current?.event as Milestone | undefined;
    const isoDate = e.over?.data.current?.isoDate as string | undefined;
    if (!ev || !isoDate) return;
    const existing = ev.dueDate || ev.scheduledDate;
    if (existing && isoDateOf(parseISODate(existing)) === isoDate) return; // dropped on same day
    if (projectId !== 'sample' && ev.id) {
      try {
        await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/milestones/${encodeURIComponent(ev.id)}`, {
          method: 'PATCH',
          body: { dueDate: isoDate },
        });
        window.dispatchEvent(new CustomEvent('ws-milestones-reload'));
      } catch {
        // ignore
      }
    }
  }, [projectId]);

  const dragOverlay = (
    <DragOverlay>
      {activeDragEvent ? (
        <Chip
          label={activeDragEvent.title}
          size="small"
          variant="filled"
          sx={{
            fontSize: 10, height: 20, bgcolor: phaseColorFor(activeDragEvent.category, phases),
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)', cursor: 'grabbing',
          }}
        />
      ) : null}
    </DragOverlay>
  );

  // ===== MONTH VIEW =====
  if (viewMode === 'month') {
    return (
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <Box>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <IconButton onClick={() => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))} aria-label={t('prevPeriod')}><ChevronLeft /></IconButton>
            <Typography variant="h6" sx={{ minWidth: 200, textAlign: 'center' }}>{monthName}</Typography>
            <IconButton onClick={() => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))} aria-label={t('nextPeriod')}><ChevronRight /></IconButton>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button variant="contained" onClick={() => setViewMode('month')} startIcon={<CalendarMonth />}>{t('calMonth')}</Button>
            <Button variant="outlined" onClick={() => setViewMode('week')} startIcon={<Event />}>{t('calWeek')}</Button>
            <Button variant="outlined" onClick={() => setViewMode('day')}>{t('calDay')}</Button>
          </Stack>
        </Stack>

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, mb: 1 }}>
          {Array.from({ length: 7 }, (_, i) => (
            <Box key={i} sx={{ textAlign: 'center', py: 1, fontWeight: 600, color: ws.textDim, fontSize: 12 }}>
              {new Date(2024, 0, 1 + i).toLocaleDateString(locale === 'en' ? 'en-US' : 'nb-NO', { weekday: 'short' })}
            </Box>
          ))}
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
          {Array.from({ length: startDay }, (_, i) => {
            const day = prevMonthDays - startDay + i + 1;
            const prevD = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, day);
            const key = dayKeyOf(prevD);
            return (
              <DroppableDayBox
                key={`prev-${i}`}
                isoDate={isoDateOf(prevD)}
                onClick={() => { setCurrentDate(prevD); setViewMode('day'); }}
                sx={{ minHeight: { xs: 72, sm: 100 }, border: `1px solid ${ws.border}`, borderRadius: 1, p: 1, bgcolor: 'rgba(255,255,255,0.02)' }}
              >
                <Typography variant="caption" sx={{ color: ws.textFaint }}>{day}</Typography>
                {(eventsByDate[key] || []).slice(0, 2).map((ev, j) => (
                  <Box key={j} sx={{ mb: 0.25 }}>{renderEventChip(ev, true)}</Box>
                ))}
                {(eventsByDate[key] || []).length > 2 && (
                  <Typography variant="caption" sx={{ color: ws.textDim, fontSize: 9 }}>+{(eventsByDate[key] || []).length - 2}</Typography>
                )}
              </DroppableDayBox>
            );
          })}

          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const cellDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
            const key = dayKeyOf(cellDate);
            const dayEvents = eventsByDate[key] || [];
            return (
              <DroppableDayBox
                key={`curr-${i}`}
                isoDate={isoDateOf(cellDate)}
                onClick={() => { setCurrentDate(cellDate); setViewMode('day'); }}
                sx={{
                  minHeight: { xs: 72, sm: 100 },
                  border: `1px solid ${isToday(currentDate.getFullYear(), currentDate.getMonth(), day) ? ws.accent : ws.border}`,
                  bgcolor: isToday(currentDate.getFullYear(), currentDate.getMonth(), day) ? ws.accentSoft : 'transparent',
                  borderRadius: 1,
                  p: 1,
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
                }}
              >
                <Typography variant="caption" sx={{ color: isToday(currentDate.getFullYear(), currentDate.getMonth(), day) ? ws.accent : ws.text, fontWeight: isToday(currentDate.getFullYear(), currentDate.getMonth(), day) ? 700 : 400, mb: 0.5 }}>
                  {day}
                </Typography>
                {dayEvents.slice(0, 3).map((ev, j) => (
                  <Box key={j} sx={{ mb: 0.25 }}>{renderEventChip(ev)}</Box>
                ))}
                {dayEvents.length > 3 && (
                  <Typography
                    variant="caption"
                    sx={{ color: ws.accent, fontSize: 10, fontWeight: 700, cursor: 'pointer', display: 'inline-block', mt: 0.25, '&:hover': { textDecoration: 'underline' } }}
                    onClick={(e) => { e.stopPropagation(); setCurrentDate(cellDate); setViewMode('day'); }}
                  >+{dayEvents.length - 3} {t('calEventsOn')}</Typography>
                )}
              </DroppableDayBox>
            );
          })}

          {Array.from({ length: Math.max(0, 42 - startDay - daysInMonth) }, (_, i) => {
            const day = i + 1;
            const nextD = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, day);
            const key = dayKeyOf(nextD);
            return (
              <DroppableDayBox
                key={`next-${i}`}
                isoDate={isoDateOf(nextD)}
                onClick={() => { setCurrentDate(nextD); setViewMode('day'); }}
                sx={{ minHeight: { xs: 72, sm: 100 }, border: `1px solid ${ws.border}`, borderRadius: 1, p: 1, bgcolor: 'rgba(255,255,255,0.02)' }}
              >
                <Typography variant="caption" sx={{ color: ws.textFaint }}>{day}</Typography>
                {(eventsByDate[key] || []).slice(0, 2).map((ev, j) => (
                  <Box key={j} sx={{ mb: 0.25 }}>{renderEventChip(ev, true)}</Box>
                ))}
              </DroppableDayBox>
            );
          })}
        </Box>

        {(() => {
          const monthKeys: string[] = [];
          for (let d = 1; d <= daysInMonth; d++) {
            monthKeys.push(dayKeyOf(new Date(currentDate.getFullYear(), currentDate.getMonth(), d)));
          }
          const hasEvents = monthKeys.some((k) => (eventsByDate[k] || []).length > 0);
          return !hasEvents && (
            <Box sx={{ textAlign: 'center', py: 6, color: ws.textDim }}>{t('listEmpty')}</Box>
          );
        })()}

        <EventDetailsDialog event={selectedEvent} onClose={() => setSelectedEvent(null)} t={t} dloc={dloc} phases={phases} />
        {dragOverlay}
      </Box>
      </DndContext>
    );
  }

  // ===== WEEK VIEW =====
  if (viewMode === 'week') {
    const weekStart = new Date(currentDate);
    weekStart.setDate(currentDate.getDate() - ((currentDate.getDay() + 6) % 7));
    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    });
    return (
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <Box>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <IconButton onClick={() => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7))} aria-label={t('prevPeriod')}><ChevronLeft /></IconButton>
            <Typography variant="h6">
              {weekDays[0].toLocaleDateString(locale)} — {weekDays[6].toLocaleDateString(locale)}
            </Typography>
            <IconButton onClick={() => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7))} aria-label={t('nextPeriod')}><ChevronRight /></IconButton>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" onClick={() => setViewMode('month')} startIcon={<CalendarMonth />}>{t('calMonth')}</Button>
            <Button variant="contained" onClick={() => setViewMode('week')} startIcon={<Event />}>{t('calWeek')}</Button>
            <Button variant="outlined" onClick={() => setViewMode('day')}>{t('calDay')}</Button>
          </Stack>
        </Stack>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
          {weekDays.map((d, i) => {
            const key = dayKeyOf(d);
            const dayEvents = eventsByDate[key] || [];
            return (
              <DroppableDayBox
                key={i}
                isoDate={isoDateOf(d)}
                sx={{
                  minHeight: 140,
                  border: `1px solid ${isToday(d.getFullYear(), d.getMonth(), d.getDate()) ? ws.accent : ws.border}`,
                  bgcolor: isToday(d.getFullYear(), d.getMonth(), d.getDate()) ? ws.accentSoft : 'transparent',
                  borderRadius: 1,
                  p: 1,
                }}
              >
                <Typography sx={{ fontSize: 11, fontWeight: isToday(d.getFullYear(), d.getMonth(), d.getDate()) ? 700 : 400, color: isToday(d.getFullYear(), d.getMonth(), d.getDate()) ? ws.accent : ws.text }}>
                  {d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric' })}
                </Typography>
                <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                  {dayEvents.length === 0 ? (
                    <Typography variant="caption" sx={{ color: ws.textFaint }}>{t('noEventsThisPeriod')}</Typography>
                  ) : (
                    dayEvents.map((ev, j) => <Box key={j}>{renderEventChip(ev)}</Box>)
                  )}
                </Stack>
              </DroppableDayBox>
            );
          })}
        </Box>
        <EventDetailsDialog event={selectedEvent} onClose={() => setSelectedEvent(null)} t={t} dloc={dloc} phases={phases} />
        {dragOverlay}
      </Box>
      </DndContext>
    );
  }

  // ===== DAY VIEW =====
  const dayKey = dayKeyOf(currentDate);
  const dayEvents = eventsByDate[dayKey] || [];
  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <IconButton onClick={() => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1))} aria-label={t('prevPeriod')}><ChevronLeft /></IconButton>
          <Typography variant="h6">{currentDate.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</Typography>
          <IconButton onClick={() => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1))} aria-label={t('nextPeriod')}><ChevronRight /></IconButton>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={() => setViewMode('month')} startIcon={<CalendarMonth />}>{t('calMonth')}</Button>
          <Button variant="outlined" onClick={() => setViewMode('week')} startIcon={<Event />}>{t('calWeek')}</Button>
          <Button variant="contained" onClick={() => setViewMode('day')}>{t('calDay')}</Button>
        </Stack>
      </Stack>
      <DroppableDayBox
        isoDate={isoDateOf(currentDate)}
        sx={{ borderRadius: 2 }}
      >
      <Paper sx={{ border: `1px solid ${ws.border}`, borderRadius: 2, p: 2, minHeight: 200 }}>
        {dayEvents.length === 0 ? (
          <Typography sx={{ color: ws.textDim, py: 6, textAlign: 'center' }}>{t('noEventsThisPeriod')}</Typography>
        ) : (
          <Stack spacing={1}>
            {dayEvents.map((ev, j) => {
              const [stLabel, stTone] = statusInfo(ev.status, t);
              return (
              <Box key={j} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.03)', flexWrap: 'wrap' }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: phaseColorFor(ev.category, phases), flexShrink: 0 }} />
                <Typography sx={{ flex: 1, fontWeight: 600, minWidth: 120 }}>{ev.title}</Typography>
                <Chip label={ev.category || 'Milepæler'} size="small" variant="outlined" sx={{ borderColor: ws.border, display: { xs: 'none', sm: 'inline-flex' } }} />
                <WsTag label={stLabel} tone={stTone} />
              </Box>
              );
            })}
          </Stack>
        )}
      </Paper>
      </DroppableDayBox>
      <EventDetailsDialog event={selectedEvent} onClose={() => setSelectedEvent(null)} t={t} dloc={dloc} phases={phases} />
      {dragOverlay}
    </Box>
    </DndContext>
  );
};

// ===== EVENT DETAILS DIALOG =====
interface EventDetailsDialogProps {
  event: Milestone | null;
  onClose: () => void;
  t: (k: string) => string;
  dloc: string;
  phases: Phase[];
}

const EventDetailsDialog: React.FC<EventDetailsDialogProps> = ({ event, onClose, t, dloc, phases }) => (
  <Dialog
    open={!!event}
    onClose={onClose}
    maxWidth="sm"
    fullWidth
    PaperProps={{ sx: { bgcolor: ws.panelSolid, color: ws.text, border: `1px solid ${ws.border}` } }}
  >
    <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 6 }}>
      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: phaseColorFor(event?.category, phases), flexShrink: 0 }} />
      <Typography noWrap>{event?.title || ''}</Typography>
    </DialogTitle>
    <DialogContent dividers>
      <Stack spacing={1.5}>
        <Box>
          <Typography variant="caption" sx={{ color: ws.textFaint }}>{t('listPhase')}</Typography>
          <Typography variant="body2">{event?.category || 'Milepæler'}</Typography>
        </Box>
        <Box>
          <Typography variant="caption" sx={{ color: ws.textFaint }}>{t('listDue')}</Typography>
          <Typography variant="body2">
            {(event?.dueDate || event?.scheduledDate) ? parseISODate(event.dueDate || event.scheduledDate || '').toLocaleDateString(dloc, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" sx={{ color: ws.textFaint }}>{t('listStatus')}</Typography>
          <Typography variant="body2">{statusInfo(event?.status || '', t)[0]}</Typography>
        </Box>
      </Stack>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>{t('cancel')}</Button>
    </DialogActions>
  </Dialog>
);

// ===== PHASE VIEW =====
const PhaseView: React.FC<PhaseViewProps> = ({ phases, ms, t, dloc }) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const msByPhase = useMemo(() => {
    const map: Record<string, Milestone[]> = {};
    ms.forEach((m) => {
      const cat = m.category || 'Milepæler';
      if (!map[cat]) map[cat] = [];
      map[cat].push(m);
    });
    return map;
  }, [ms]);

  const allExpanded = phases.length > 0 && phases.every((p) => expanded[p.name]);

  const toggleAll = () => {
    if (allExpanded) setExpanded({});
    else {
      const next: Record<string, boolean> = {};
      phases.forEach((p) => { next[p.name] = true; });
      setExpanded(next);
    }
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
        <Typography variant="caption" sx={{ color: ws.textDim }}>{t('progressAutoCalc')}</Typography>
        <Button size="small" startIcon={allExpanded ? <KeyboardArrowUp /> : <KeyboardArrowDown />} onClick={toggleAll} variant="outlined" sx={{ color: ws.text, borderColor: ws.border, textTransform: 'none' }}>
          {allExpanded ? t('collapseAll') : t('expandAll')}
        </Button>
      </Stack>

      {phases.map((ph) => {
        const phaseMs = msByPhase[ph.name] || [];
        const doneCount = phaseMs.filter((m) => m.status === 'completed' || m.status === 'done').length;
        const totalCount = phaseMs.length;
        const progress = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;
        const isExpanded = Boolean(expanded[ph.name]);

        return (
          <Paper key={ph.name} sx={{ border: `1px solid ${ws.border}`, borderRadius: 2, overflow: 'hidden' }}>
            <Accordion expanded={isExpanded} onChange={() => setExpanded((prev) => ({ ...prev, [ph.name]: !prev[ph.name] }))} square>
              <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2, py: 1.5, minHeight: 56 }}>
                <Stack direction="row" alignItems="center" spacing={2} sx={{ width: '100%', flexWrap: 'wrap', gap: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: ph.dot, flexShrink: 0 }} />
                    <Typography variant="h6" noWrap sx={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>{ph.name}</Typography>
                  </Box>
                  <Stack direction="row" alignItems="center" spacing={1.5} sx={{ flex: 1, justifyContent: 'flex-end', flexWrap: 'wrap', gap: 0.5 }}>
                    <Box sx={{ width: 150, display: { xs: 'none', sm: 'block' } }}><WsBar value={progress} /></Box>
                    <Typography variant="body2" sx={{ color: ws.textDim, minWidth: 50 }}>{progress}%</Typography>
                    <WsTag
                      label={doneCount === totalCount && totalCount > 0 ? t('stDone') : progress > 0 ? t('stActive') : t('stUpcoming')}
                      tone={doneCount === totalCount && totalCount > 0 ? 'green' : progress > 0 ? 'accent' : 'neutral'}
                    />
                    <Typography variant="body2" sx={{ color: ws.textFaint, whiteSpace: 'nowrap' }}>{doneCount} {t('of')} {totalCount} {t('milestonesWord')}</Typography>
                  </Stack>
                </Stack>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 2, pb: 2 }}>
                {phaseMs.length === 0 ? (
                  <Typography sx={{ color: ws.textDim, py: 2 }}>{t('phaseNoMilestones')}</Typography>
                ) : (
                  <Stack spacing={1}>
                    {phaseMs.map((m, i) => {
                      const [stLabel, stTone] = statusInfo(m.status, t);
                      return (
                      <Box key={m.id || i} sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 1, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.03)', flexWrap: 'wrap' }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: ph.dot, flexShrink: 0 }} />
                        <Typography variant="body2" sx={{ flex: 1, fontWeight: 500, minWidth: 140 }}>{m.title}</Typography>
                        <WsTag label={stLabel} tone={stTone} />
                        <Typography variant="body2" sx={{ color: ws.textDim, whiteSpace: 'nowrap' }}>
                          {(m.dueDate || m.scheduledDate) ? parseISODate(m.dueDate || m.scheduledDate || '').toLocaleDateString(dloc) : '—'}
                        </Typography>
                        {m.assignee && (
                          <Avatar sx={{ width: 28, height: 28, fontSize: 11 }}>{m.assignee[0]}</Avatar>
                        )}
                      </Box>
                      );
                    })}
                  </Stack>
                )}
              </AccordionDetails>
            </Accordion>
          </Paper>
        );
      })}
      {phases.length === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center', border: `1px solid ${ws.border}` }}>
          <Typography variant="h6" sx={{ color: ws.textDim }}>{t('phaseViewDesc')}</Typography>
        </Paper>
      )}
    </Stack>
  );
};

export default ProsjektplanTab;
