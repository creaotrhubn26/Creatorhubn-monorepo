import { useState, useId, useMemo, useEffect, useRef, useCallback, type ReactElement } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  Menu,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Stack,
  Grid,
  Tooltip,
  useMediaQuery,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Paper,
  Checkbox,
  Collapse,
  Alert,
  Snackbar,
  Avatar,
  Grow,
  Slide,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Badge,
  LinearProgress,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemSecondaryAction,
  RadioGroup,
  Radio,
  FormControlLabel,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Search as SearchIcon,
  ViewModule as ViewModuleIcon,
  ViewList as ViewListIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  FilterList as FilterListIcon,
  People as PeopleIcon,
  Badge as BadgeIcon,
  ChevronRight as ChevronRightIcon,
  AssignmentTurnedIn as AssignIcon,
  CalendarToday as CalendarTodayIcon,
  ContentCopy as CopyIcon,
  CheckCircle as CheckCircleIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Download as DownloadIcon,
  ContentCopy as DuplicateIcon,
  Undo as UndoIcon,
  Calculate as CalculateIcon,
  Close as CloseIcon,
  Movie as MovieIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  PersonAdd as PersonAddIcon,
  WarningAmber as WarningAmberIcon,
  CheckCircleOutline as ConfirmedIcon,
  HourglassEmpty as PendingIcon,
  MailOutline as InvitedIcon,
  Block as UnavailableIcon,
  ChevronLeft as ChevronLeftIcon,
  Groups as GroupsDetailIcon,
  Sync as SyncIcon,
  WifiOff as WifiOffIcon,
  EventNote as CallsheetIcon,
  TableChart as DoodIcon,
  CalendarMonth as CalendarMonthIcon,
  FiberManualRecord as DotIcon,
  Schedule as ScheduleIcon,
  HourglassEmpty as HourglassIcon,
  AccountBalanceWallet as WalletIcon,
  LinkOff as UnassignIcon,
  HelpOutline as HelpIcon,
  WorkOutline as ProductionDeptIcon,
  Videocam as CameraDeptIcon,
  Lightbulb as LightingDeptIcon,
  GraphicEq as SoundDeptIcon,
  PostAdd as PostDeptIcon,
  Palette as ArtDeptIcon,
  Checkroom as WardrobeDeptIcon,
  Brush as MakeupHairDeptIcon,
  LocalShipping as TransportDeptIcon,
  Category as OtherDeptIcon,
  WhatsApp as WhatsAppIcon,
} from '@mui/icons-material';
import settingsService from '../services/settingsService';
import globalTagService from '../services/globalTagService';
import { 
  TeamIcon as GroupsIcon, 
  PersonNameIcon, 
  EmailIcon as CustomEmailIcon, 
  PhoneIcon as CustomPhoneIcon,
  AddressIcon,
  RateIcon,
  SplitSheetIcon,
} from './icons/CastingIcons';
import type { CrewMember, CrewRole, CrewStatus, ProductionDay, SceneBreakdown, CrewAssignment } from '../models/casting';
import { castingService } from '../services/castingService';
import { useProjectMemberAvailability } from '../hooks/useProjectMemberAvailability';
import {
  memberToVirtualCrew,
  isVirtualCrewId,
} from '../utils/crewAvailabilitySync';
import { roleRoomAnalytics } from '../services/roleRoomAnalytics';
import { useToast } from './ToastStack';
import { RoleRoomEmptyState } from './icons/RoleRoomEmptyState';
import ProjectWhatsAppGroupDialog from './ProjectWhatsAppGroupDialog';
import { CallSheetGenerator } from './CallSheetGenerator';
import { detectConflicts, getCrewOfflineQueueStorageKey } from '../hooks/useCrewData';
import { useAuth } from '../../../hooks/useAuth';
import crewPng from './icons/Keep/roleroom_crew.png';
import { CrewManagementGuide } from './production/CrewManagementGuide';
import {
  getRoleColor as getSharedRoleColor,
  getRoleLabel as getSharedRoleLabel,
  isTechnicalCrewMember as isTechnicalCrewMemberFromShared,
} from './shared/technicalCrew';
import GlobalMentionHelper from './shared/GlobalMentionHelper';
import { useT, type TranslationKey } from '../../../i18n';

// ─── Sort / view types ────────────────────────────────────────────────────────
type SortField = 'name' | 'role' | 'rate' | 'availability';
type SortDirection = 'asc' | 'desc';
type ViewMode = 'grid' | 'table';
type WorkspaceView = 'standard' | 'pro';
type ProViewFocus = 'all' | 'overview' | 'risks' | 'budget' | 'planner';
type ProActionSeverity = 'low' | 'medium' | 'high';
type ProActionId =
  | 'resolve-conflicts'
  | 'reduce-overtime'
  | 'complete-contact'
  | 'review-budget'
  | 'staff-unassigned'
  | 'maintain-plan';

interface ProActionItem {
  id: ProActionId;
  title: string;
  detail: string;
  focus: ProViewFocus;
  severity: ProActionSeverity;
}

interface SavedCrewView {
  id: string;
  name: string;
  createdAt: string;
  state: {
    searchQuery: string;
    filterRole: CrewRole | 'all';
    filterDept: DeptKey | 'all';
    filterStatus: CrewStatus | 'all';
    filterAvailable: boolean;
    filterAssignedToday: boolean;
    sortField: SortField;
    sortDirection: SortDirection;
    viewMode: ViewMode;
    workspaceView: WorkspaceView;
    proViewFocus: ProViewFocus;
    showDeptSidebar: boolean;
    showStats: boolean;
    compactMode: boolean;
    pinNameColumn: boolean;
    pinContactColumn: boolean;
  };
}

interface CrewActivityLogEntry {
  id: string;
  action: string;
  details: string;
  timestamp: number;
}

import { TOUCH_TARGET_SIZE } from '../constants/accessibility';
import { RoleStatPillRow } from './primitives';

// Shared focus styles for WCAG 2.4.7 Focus Visible
const focusVisibleStyles = {
  '&:focus-visible': {
    outline: '3px solid #b86bff',
    outlineOffset: '2px',
  },
};

const formatCrewNoteTimestamp = (value: unknown): string => {
  if (typeof value !== 'string' || !value.trim()) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleString('nb-NO', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// ─── Department config ────────────────────────────────────────────────────────
type DeptKey = 'production' | 'camera' | 'lighting' | 'sound' | 'post' | 'art' | 'wardrobe' | 'makeup_hair' | 'transport' | 'other';

const DEPT_ORDER: DeptKey[] = ['production', 'camera', 'lighting', 'sound', 'post', 'art', 'wardrobe', 'makeup_hair', 'transport', 'other'];

const DEPT_LABEL_KEY: Record<DeptKey, TranslationKey> = {
  production: 'crew.dept.production',
  camera: 'crew.dept.camera',
  lighting: 'crew.dept.lighting',
  sound: 'crew.dept.sound',
  post: 'crew.dept.post',
  art: 'crew.dept.art',
  wardrobe: 'crew.dept.wardrobe',
  makeup_hair: 'crew.dept.makeup_hair',
  transport: 'crew.dept.transport',
  other: 'crew.dept.other',
};

const DEPT_COLORS: Record<DeptKey, string> = {
  production: '#ef4444',
  camera: '#8b5cf6',
  lighting: '#3b82f6',
  sound: '#06b6d4',
  post: '#f59e0b',
  art: '#ec4899',
  wardrobe: '#a78bfa',
  makeup_hair: '#fb7185',
  transport: 'var(--role-cyan, #22d3ee)',
  other: '#64748b',
};

const DEPT_ICONS: Record<DeptKey, React.ElementType> = {
  production: ProductionDeptIcon,
  camera: CameraDeptIcon,
  lighting: LightingDeptIcon,
  sound: SoundDeptIcon,
  post: PostDeptIcon,
  art: ArtDeptIcon,
  wardrobe: WardrobeDeptIcon,
  makeup_hair: MakeupHairDeptIcon,
  transport: TransportDeptIcon,
  other: OtherDeptIcon,
};

const ROLE_TO_DEPT: Record<CrewRole, DeptKey> = {
  director: 'production', producer: 'production', casting_director: 'production',
  production_manager: 'production', production_assistant: 'production',
  script_supervisor: 'production', location_manager: 'production',
  camera_operator: 'camera', camera_assistant: 'camera',
  cinematographer: 'camera', drone_pilot: 'camera',
  gaffer: 'lighting', grip: 'lighting',
  sound_engineer: 'sound', audio_mixer: 'sound',
  video_editor: 'post', colorist: 'post', vfx_artist: 'post', motion_graphics: 'post',
  production_designer: 'art',
  makeup_artist: 'makeup_hair', wardrobe: 'wardrobe', stylist: 'wardrobe',
  collaborator: 'other', other: 'other',
};

// ─── Status badge ─────────────────────────────────────────────────────────────
const STATUS_META: Record<CrewStatus | 'none', { color: string; bg: string; Icon: React.ElementType }> = {
  confirmed:   { color: '#10b981', bg: 'rgba(16,185,129,0.18)',  Icon: ConfirmedIcon },
  pending:     { color: '#ffb800', bg: 'rgba(255,184,0,0.18)',   Icon: PendingIcon },
  invited:     { color: '#3b82f6', bg: 'rgba(59,130,246,0.18)',  Icon: InvitedIcon },
  unavailable: { color: '#ef4444', bg: 'rgba(239,68,68,0.18)',   Icon: UnavailableIcon },
  none:        { color: '#64748b', bg: 'rgba(100,116,139,0.12)', Icon: PendingIcon },
};

const STATUS_LABEL_KEY: Record<CrewStatus | 'none', TranslationKey> = {
  confirmed: 'crew.status.confirmed',
  pending: 'crew.status.pending',
  invited: 'crew.status.invited',
  unavailable: 'crew.status.unavailable',
  none: 'crew.status.none',
};

function StatusBadge({ status, size = 'small' }: { status?: CrewStatus; size?: 'small' | 'medium' }) {
  const { t } = useT();
  const meta = STATUS_META[status ?? 'none'];
  const { Icon } = meta;
  return (
    <Box sx={{
      display: 'inline-flex', alignItems: 'center', gap: 0.5,
      px: size === 'small' ? 0.75 : 1.25, py: size === 'small' ? 0.25 : 0.5,
      borderRadius: 10, bgcolor: meta.bg, border: `1px solid ${meta.color}44`,
    }}>
      <Icon sx={{ fontSize: size === 'small' ? 11 : 14, color: meta.color }} />
      <Typography sx={{ fontSize: size === 'small' ? 11 : 13, fontWeight: 600, color: meta.color, lineHeight: 1 }}>
        {t(STATUS_LABEL_KEY[status ?? 'none'])}
      </Typography>
    </Box>
  );
}

// ─── Availability week dots (Mon–Fri) ─────────────────────────────────────────
function AvailabilityWeekDots({ member, hasConflict }: { member: CrewMember; hasConflict?: boolean }) {
  const { t } = useT();
  const today = new Date();
  // Start from Monday this week
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const days = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().split('T')[0];
  });
  const getColor = (dateStr: string) => {
    const cell = member.availabilityCells?.find(c => c.date === dateStr);
    if (cell) {
      if (cell.availability === 'available') return '#10b981';
      if (cell.availability === 'hold') return '#ffb800';
      return '#ef4444';
    }
    const start = member.availability?.startDate;
    const end = member.availability?.endDate ?? '9999-12-31';
    if (!start) return '#374151';
    return dateStr >= start && dateStr <= end ? '#10b981' : '#374151';
  };
  return (
    <Box sx={{ display: 'flex', gap: 0.4, alignItems: 'center' }}>
      {days.map((d, i) => (
        <Tooltip key={d} title={[t('crew.weekday.mon'),t('crew.weekday.tue'),t('crew.weekday.wed'),t('crew.weekday.thu'),t('crew.weekday.fri')][i]} arrow placement="top">
          <Box sx={{
            width: 8, height: 8, borderRadius: '50%',
            bgcolor: getColor(d), flexShrink: 0,
            border: '1px solid rgba(255,255,255,0.1)',
          }} />
        </Tooltip>
      ))}
      {hasConflict && (
        <Tooltip title={t('crew.tooltip.doubleBooked')} arrow>
          <WarningAmberIcon sx={{ fontSize: 12, color: '#ef4444', ml: 0.3 }} />
        </Tooltip>
      )}
      {Boolean((member as { availabilitySynced?: boolean }).availabilitySynced) && (
        <Tooltip title={t('crew.tooltip.availabilitySynced')} arrow>
          <Box sx={{
            width: 6, height: 6, borderRadius: '50%', ml: 0.3, flexShrink: 0,
            bgcolor: '#a030c0', boxShadow: '0 0 4px rgba(160,48,192,0.9)',
          }} />
        </Tooltip>
      )}
    </Box>
  );
}

// ─── Department sidebar ───────────────────────────────────────────────────────
interface DeptSidebarProps {
  crewMembers: CrewMember[];
  filterDept: DeptKey | 'all';
  onDeptClick: (dept: DeptKey | 'all') => void;
  favorites: Set<string>;
  /** Optional handler for "+ LEGG TIL ROLLE"-knappen i header — typisk
   *  åpner ny-medlem-dialog. Hvis ikke gitt, vises ikke knappen. */
  onAddRole?: () => void;
}

function DeptSidebarPanel({ crewMembers, filterDept, onDeptClick, favorites, onAddRole }: DeptSidebarProps) {
  const { t } = useT();
  const grouped = useMemo(() => {
    const map = new Map<DeptKey, CrewMember[]>();
    DEPT_ORDER.forEach(d => map.set(d, []));
    crewMembers.forEach(m => {
      const d = ROLE_TO_DEPT[m.role] ?? 'other';
      map.get(d)!.push(m);
    });
    return map;
  }, [crewMembers]);

  return (
    <Box sx={{
      width: 280,
      flexShrink: 0,
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      border: '1px solid rgba(184,107,255,0.32)',
      borderRadius: 2,
      bgcolor: 'rgba(20,14,48,0.84)',
      backdropFilter: 'blur(6px)',
      boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
    }}>
      {/* "ROLLER & AVDELINGER"-header + "+ LEGG TIL ROLLE"-knapp (matcher team-design) */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          px: 2,
          pt: 1.5,
          pb: 1,
          borderBottom: '1px solid rgba(184,107,255,0.18)',
        }}
      >
        <Typography
          sx={{
            color: 'rgba(255,255,255,0.62)',
            fontSize: '0.68rem',
            fontWeight: 700,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
          }}
        >{t('crew.sidebar.rolesDepartments')}</Typography>
        {onAddRole && (
          <Box
            component="button"
            onClick={onAddRole}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.4,
              px: 1,
              py: 0.4,
              borderRadius: 1,
              border: '1px solid rgba(184,107,255,0.42)',
              bgcolor: 'rgba(184,107,255,0.14)',
              color: '#c4b5fd',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: '0.68rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 0.3,
              transition: 'background-color 160ms ease-out',
              '&:hover': { bgcolor: 'rgba(184,107,255,0.24)', color: '#fff' },
            }}
          >{t('crew.sidebar.addRole')}</Box>
        )}
      </Box>

      {/* All crews */}
      <Box
        onClick={() => onDeptClick('all')}
        sx={{
          px: 2.5, py: 1.45, cursor: 'pointer', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          bgcolor: filterDept === 'all' ? 'rgba(184,107,255,0.18)' : 'transparent',
          borderLeft: filterDept === 'all' ? '3px solid #b86bff' : '3px solid transparent',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          '&:hover': { bgcolor: 'rgba(184,107,255,0.1)' },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <GroupsDetailIcon sx={{ fontSize: 20, color: '#ffffff' }} />
          <Typography sx={{ color: '#ffffff', fontSize: 17, fontWeight: 800, lineHeight: 1.1 }}>{t('crew.all')}</Typography>
        </Box>
        <Chip label={crewMembers.length} size="small" sx={{ height: 28, fontSize: 14, fontWeight: 700, color: '#ffffff', bgcolor: 'rgba(184,107,255,0.36)', border: '1px solid rgba(255,255,255,0.26)' }} />
      </Box>
      <Divider sx={{ borderColor: 'rgba(184,107,255,0.2)' }} />
      {/* Vis ALLE 10 avdelinger med count (også 0) — designet ber om
          komplett oversikt slik at brukeren ser hele rolle-spekteret */}
      {DEPT_ORDER.map(dept => {
        const members = grouped.get(dept) ?? [];
        const count = members.length;
        const color = DEPT_COLORS[dept];
        const active = filterDept === dept;
        const isEmpty = count === 0;
        const DeptIcon = DEPT_ICONS[dept];
        return (
          <Box
            key={dept}
            onClick={() => onDeptClick(active ? 'all' : dept)}
            sx={{
              px: 2.5, py: 1.25, cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'space-between',
              bgcolor: active ? `${color}18` : 'transparent',
              borderLeft: active ? `3px solid ${color}` : '3px solid transparent',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              opacity: isEmpty && !active ? 0.55 : 1,
              transition: 'opacity 160ms ease-out',
              '&:hover': { bgcolor: 'rgba(184,107,255,0.1)', opacity: 1 },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <DeptIcon sx={{ fontSize: 18, color: '#ffffff' }} />
              <Typography sx={{ color: '#ffffff', fontSize: 16, fontWeight: active ? 800 : 700, lineHeight: 1.1 }}>
                {t(DEPT_LABEL_KEY[dept])}
              </Typography>
            </Box>
            <Chip
              label={count}
              size="small"
              sx={{
                height: 26,
                fontSize: 13,
                fontWeight: 700,
                color: isEmpty ? 'rgba(255,255,255,0.55)' : '#ffffff',
                bgcolor: active
                  ? `${color}66`
                  : isEmpty
                    ? 'rgba(255,255,255,0.08)'
                    : 'rgba(255,255,255,0.2)',
                border: `1px solid ${isEmpty ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.22)'}`,
              }}
            />
          </Box>
        );
      })}
      <Divider sx={{ borderColor: 'rgba(184,107,255,0.2)', mt: 1 }} />
      {/* Favorites */}
      {favorites.size > 0 && (
        <Box sx={{ px: 2, py: 1 }}>
          <Typography sx={{ color: '#ffffff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <StarIcon sx={{ fontSize: 12 }} />
            {t('crew.favorites')} ({favorites.size})
          </Typography>
        </Box>
      )}
    </Box>
  );
}

// ─── Bulk action bar ──────────────────────────────────────────────────────────
interface BulkBarProps {
  selectedIds: Set<string>;
  totalCount: number;
  isAllSelected: boolean;
  onSelectAll: () => void;
  onDelete: () => void;
  onChangeStatus: (status: CrewStatus) => void;
  onDeselect: () => void;
  onAssignDay: () => void;
  productionDays: ProductionDay[];
}

function CrewBulkBar({ selectedIds, isAllSelected, onSelectAll, onDelete, onChangeStatus, onDeselect, onAssignDay }: BulkBarProps) {
  const { t } = useT();
  const [statusAnchor, setStatusAnchor] = useState<HTMLElement | null>(null);
  if (selectedIds.size === 0) return null;
  return (
    <Slide direction="up" in mountOnEnter unmountOnExit>
      <Box sx={{
        position: 'sticky', bottom: 0, left: 0, right: 0, zIndex: 50,
        bgcolor: '#140e30', borderTop: '1px solid rgba(184,107,255,0.32)',
        display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap',
        px: { xs: 1.5, sm: 3 }, py: 1.25,
        boxShadow: '0 -4px 24px rgba(0,0,0,0.4)',
      }}>
        {/* Select All */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mr: 0.5 }}>
          <Checkbox
            checked={isAllSelected}
            indeterminate={selectedIds.size > 0 && !isAllSelected}
            onChange={onSelectAll}
            sx={{ color: 'rgba(255,255,255,0.5)', '&.Mui-checked,&.MuiCheckbox-indeterminate': { color: 'var(--role-accent, #b86bff)' }, p: 0.5 }}
          />
          <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap' }}>{t('crew.bulk.selectAll')}</Typography>
        </Box>
        {/* Assign to Day */}
        <Button
          size="small" variant="outlined"
          startIcon={<AssignIcon sx={{ fontSize: 15 }} />}
          onClick={onAssignDay}
          sx={{ borderColor: 'rgba(184,107,255,0.45)', color: 'var(--role-accent, #b86bff)', fontSize: 12, textTransform: 'none', whiteSpace: 'nowrap',
            '&:hover': { bgcolor: 'rgba(184,107,255,0.12)' } }}
        >
          {t('crew.bulk.assignDay')}
        </Button>
        {/* Change Status */}
        <Button
          size="small" variant="outlined"
          endIcon={<ExpandMoreIcon sx={{ fontSize: 14 }} />}
          onClick={e => setStatusAnchor(e.currentTarget)}
          sx={{ borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.8)', fontSize: 12, textTransform: 'none', whiteSpace: 'nowrap',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.07)' } }}
        >
          {t('crew.bulk.changeStatus')}
        </Button>
        <Menu
          anchorEl={statusAnchor}
          open={Boolean(statusAnchor)}
          onClose={() => setStatusAnchor(null)}
          PaperProps={{ sx: { bgcolor: '#1c2128', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' } }}
        >
          {(['confirmed','pending','invited','unavailable'] as CrewStatus[]).map(s => {
            const meta = STATUS_META[s];
            const { Icon } = meta;
            return (
              <MenuItem key={s} onClick={() => { onChangeStatus(s); setStatusAnchor(null); }}
                sx={{ gap: 1, fontSize: 13, '&:hover': { bgcolor: meta.bg } }}>
                <Icon sx={{ fontSize: 15, color: meta.color }} />
                <Typography sx={{ color: meta.color, fontSize: 13 }}>{t(STATUS_LABEL_KEY[s])}</Typography>
              </MenuItem>
            );
          })}
        </Menu>
        {/* Remove */}
        <Button
          size="small" variant="outlined"
          startIcon={<DeleteIcon sx={{ fontSize: 15 }} />}
          onClick={onDelete}
          sx={{ borderColor: 'rgba(239,68,68,0.4)', color: '#ef4444', fontSize: 12, textTransform: 'none', whiteSpace: 'nowrap',
            '&:hover': { bgcolor: 'rgba(239,68,68,0.1)' } }}
        >
          {t('crew.remove')} {selectedIds.size}
        </Button>
        {/* Right side */}
        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Chip
            label={selectedIds.size}
            size="small"
            onDelete={onDeselect}
            sx={{ bgcolor: 'rgba(184,107,255,0.15)', color: 'var(--role-accent, #b86bff)', fontWeight: 700, height: 22, fontSize: 12 }}
          />
          <Tooltip title={t('crew.bulk.sync')}>
            <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.4)' }}><SyncIcon sx={{ fontSize: 18 }} /></IconButton>
          </Tooltip>
          <Tooltip title={t('crew.bulk.export')}>
            <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.4)' }}><CalendarMonthIcon sx={{ fontSize: 18 }} /></IconButton>
          </Tooltip>
          <Tooltip title={t('crew.bulk.list')}>
            <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.4)' }}><ViewListIcon sx={{ fontSize: 18 }} /></IconButton>
          </Tooltip>
          <Tooltip title={t('crew.bulk.grid')}>
            <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.4)' }}><ViewModuleIcon sx={{ fontSize: 18 }} /></IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Slide>
  );
}

// ─── Invite crew dialog ───────────────────────────────────────────────────────
interface InviteDialogProps {
  open: boolean;
  onClose: () => void;
  onInvite: (data: { name: string; role: CrewRole; email?: string; phone?: string }) => void;
  getRoleLabel: (role: CrewRole) => string;
  crewRoles: CrewRole[];
}

function InviteCrewDialog({ open, onClose, onInvite, getRoleLabel, crewRoles }: InviteDialogProps) {
  const { t } = useT();
  const [name, setName] = useState('');
  const [role, setRole] = useState<CrewRole>('other');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const handleSubmit = () => {
    if (!name.trim()) return;
    onInvite({ name: name.trim(), role, email: email || undefined, phone: phone || undefined });
    setName(''); setRole('other'); setEmail(''); setPhone('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth
      PaperProps={{ sx: { bgcolor: '#1c2128', color: '#fff', border: '1px solid rgba(184,107,255,0.32)' } }}>
      <DialogTitle sx={{ color: 'var(--role-accent, #b86bff)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
        <PersonAddIcon /> {t('crew.invite.title')}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField label={t('crew.field.nameRequired')} fullWidth value={name} onChange={e => setName(e.target.value)}
            sx={{ '& .MuiOutlinedInput-root': { color: '#fff', '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' } }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' } }} />
          <FormControl fullWidth>
            <InputLabel sx={{ color: 'rgba(255,255,255,0.7)' }}>{t('crew.field.role')}</InputLabel>
            <Select value={role} onChange={e => setRole(e.target.value as CrewRole)} label={t('crew.field.role')}
              sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' } }}>
              {crewRoles.map(r => <MenuItem key={r} value={r}>{getRoleLabel(r)}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField label={t('crew.field.email')} fullWidth type="email" value={email} onChange={e => setEmail(e.target.value)}
            sx={{ '& .MuiOutlinedInput-root': { color: '#fff', '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' } }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' } }} />
          <TextField label={t('crew.field.phone')} fullWidth type="tel" value={phone} onChange={e => setPhone(e.target.value)}
            sx={{ '& .MuiOutlinedInput-root': { color: '#fff', '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' } }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' } }} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: 'rgba(255,255,255,0.7)' }}>{t('crew.action.cancel')}</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={!name.trim()}
          sx={{ bgcolor: 'var(--role-accent, #b86bff)', color: '#160a24', fontWeight: 700, '&:hover': { bgcolor: '#a855f7' } }}>
          {t('crew.invite.send')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Offline banner ───────────────────────────────────────────────────────────
function OfflineBanner({ pending }: { pending: number }) {
  const { t } = useT();
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  if (online && pending === 0) return null;
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 0.75,
      bgcolor: online ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
      border: `1px solid ${online ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
      borderRadius: 1, mb: 1.5, fontSize: 13,
    }}>
      {online ? <SyncIcon sx={{ fontSize: 16, color: '#10b981' }} /> : <WifiOffIcon sx={{ fontSize: 16, color: '#ef4444' }} />}
      <Typography sx={{ fontSize: 13, color: online ? '#10b981' : '#ef4444' }}>
        {online ? t('crew.offline.syncing', { n: pending }) : t('crew.offline.pending', { n: pending })}
      </Typography>
    </Box>
  );
}

// ─── DOOD helpers ─────────────────────────────────────────────────────────────

type CrewDOODCode = 'W' | 'H' | 'O' | 'SW' | 'WF' | 'SWF' | 'TF' | 'T';

const DOOD_COLORS: Record<CrewDOODCode, { bg: string; text: string }> = {
  W:   { bg: 'rgba(16,185,129,0.85)',  text: '#fff' },
  SW:  { bg: 'rgba(16,185,129,0.85)',  text: '#fff' },
  WF:  { bg: 'rgba(16,185,129,0.85)',  text: '#fff' },
  SWF: { bg: 'rgba(16,185,129,0.85)',  text: '#fff' },
  H:   { bg: 'rgba(255,184,0,0.85)',   text: '#000' },
  T:   { bg: 'rgba(59,130,246,0.85)',  text: '#fff' },
  TF:  { bg: 'rgba(59,130,246,0.85)',  text: '#fff' },
  O:   { bg: 'rgba(96,125,139,0.4)',   text: 'rgba(255,255,255,0.5)' },
};

function getMemberDOODCode(
  memberId: string,
  dayId: string,
  assignments: CrewAssignment[],
  allDays: ProductionDay[],
): CrewDOODCode | null {
  const a = assignments.find(x => x.crewMemberId === memberId && x.shootDayId === dayId);
  if (!a) return null;
  if (a.assignmentStatus === 'release') return 'O';
  if (a.assignmentStatus === 'hold') return 'H';
  // Travel day — T unless it is also the final active day in this run
  if (a.assignmentStatus === 'travel') {
    const memberActiveDays = assignments
      .filter(x => x.crewMemberId === memberId && (x.assignmentStatus === 'assigned' || x.assignmentStatus === 'travel'))
      .map(x => x.shootDayId);
    const dayIdx = allDays.findIndex(d => d.id === dayId);
    const isLast = !allDays.slice(dayIdx + 1).some(d => memberActiveDays.includes(d.id));
    return isLast ? 'TF' : 'T';
  }
  // 'assigned' = work day — apply S/F decoration
  const memberWorkDays = assignments
    .filter(x => x.crewMemberId === memberId && x.assignmentStatus === 'assigned')
    .map(x => x.shootDayId);
  const dayIdx = allDays.findIndex(d => d.id === dayId);
  const isFirst = !allDays.slice(0, dayIdx).some(d => memberWorkDays.includes(d.id));
  const isLast  = !allDays.slice(dayIdx + 1).some(d => memberWorkDays.includes(d.id));
  if (isFirst && isLast) return 'SWF';
  if (isFirst) return 'SW';
  if (isLast)  return 'WF';
  return 'W';
}

// ─── DOODMiniStrip ───────────────────────────────────────────────────────────

interface DOODMiniStripProps {
  member: CrewMember;
  productionDays: ProductionDay[];
  assignments: CrewAssignment[];
}

function DOODMiniStrip({ member, productionDays, assignments }: DOODMiniStripProps) {
  const { t } = useT();
  if (!productionDays.length) return null;
  const memberAssignments = assignments.filter(a => a.crewMemberId === member.id);
  if (!memberAssignments.length) return null;

  return (
    <Box sx={{ mt: 1, mb: 0.5 }}>
      <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', mb: 0.5, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>
        DOOD
      </Typography>
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
        {productionDays.map((day, idx) => {
          const code = getMemberDOODCode(member.id, day.id, assignments, productionDays);
          if (!code) return (
            <Tooltip key={day.id} title={t('crew.dayLabel', { n: idx + 1, date: day.date ?? '' })}>
              <Box sx={{ width: 22, height: 22, borderRadius: 0.5, border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography sx={{ fontSize: 8, color: 'rgba(255,255,255,0.25)' }}>–</Typography>
              </Box>
            </Tooltip>
          );
          const colors = DOOD_COLORS[code];
          return (
            <Tooltip key={day.id} title={t('crew.dood.dayCodeTooltip', { n: idx + 1, date: day.date ?? '', code, call: day.callTime ?? '' })}>
              <Box sx={{ width: 26, height: 22, borderRadius: 0.5, bgcolor: colors.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'default' }}>
                <Typography sx={{ fontSize: 8, fontWeight: 800, color: colors.text, fontFamily: 'monospace' }}>{code}</Typography>
              </Box>
            </Tooltip>
          );
        })}
      </Box>
    </Box>
  );
}

// ─── AssignShootDayDialog ─────────────────────────────────────────────────────

interface AssignShootDayDialogProps {
  open: boolean;
  onClose: () => void;
  member: CrewMember | null;
  productionDays: ProductionDay[];
  assignments: CrewAssignment[];
  onAssign: (crewMemberId: string, dayId: string, date: string, status: 'assigned' | 'hold' | 'travel' | 'release', unit: 'A' | 'B', callTime: string) => void;
  onUnassign: (crewMemberId: string, dayId: string) => void;
}

function AssignShootDayDialog({
  open, onClose, member, productionDays, assignments, onAssign, onUnassign,
}: AssignShootDayDialogProps) {
  const { t } = useT();
  const [unit, setUnit] = useState<'A' | 'B'>('A');
  if (!member) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { bgcolor: '#1c2128', color: '#fff', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 3 } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
        <CalendarMonthIcon sx={{ color: 'var(--role-cyan, #00d4ff)' }} />
        {t('crew.assign.title', { name: member.name })}
      </DialogTitle>
      <DialogContent dividers sx={{ borderColor: 'rgba(255,255,255,0.1)', p: 0 }}>
        <Box sx={{ px: 2, py: 1, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', mb: 0.5 }}>{t('crew.assign.unit')}</Typography>
          <RadioGroup row value={unit} onChange={e => setUnit(e.target.value as 'A' | 'B')}>
            {(['A', 'B'] as const).map(u => (
              <FormControlLabel key={u} value={u} control={<Radio size="small" sx={{ color: 'var(--role-cyan, #00d4ff)', '&.Mui-checked': { color: 'var(--role-cyan, #00d4ff)' } }} />}
                label={<Typography sx={{ fontSize: 13, color: '#fff' }}>{t('crew.assign.unitOption', { u })}</Typography>} />
            ))}
          </RadioGroup>
        </Box>
        <List dense disablePadding>
          {productionDays.length === 0 && (
            <ListItem>
              <ListItemText primary={<Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>{t('crew.assign.noShootDays')}</Typography>} />
            </ListItem>
          )}
          {productionDays.map((day, idx) => {
            const existing = assignments.find(a => a.crewMemberId === member.id && a.shootDayId === day.id);
            const code = getMemberDOODCode(member.id, day.id, assignments, productionDays);
            return (
              <ListItem key={day.id} disablePadding divider sx={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                <ListItemButton dense disableRipple sx={{ py: 0.75, px: 2, cursor: 'default', '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}>
                  <ListItemText
                    primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', minWidth: 28 }}>D{idx + 1}</Typography>
                      <Typography sx={{ fontSize: 13, color: '#fff' }}>{day.date}</Typography>
                      {day.callTime && <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Call: {day.callTime}</Typography>}
                      {code && (
                        <Box sx={{ px: 0.75, py: 0.25, borderRadius: 0.5, bgcolor: DOOD_COLORS[code]?.bg, ml: 0.5 }}>
                          <Typography sx={{ fontSize: 10, fontWeight: 800, color: DOOD_COLORS[code]?.text, fontFamily: 'monospace' }}>{code}</Typography>
                        </Box>
                      )}
                    </Box>
                  }
                />
                </ListItemButton>
                <ListItemSecondaryAction>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {!existing ? (
                      <>
                        <Button size="small" variant="outlined"
                          onClick={() => onAssign(member.id, day.id, day.date ?? '', 'assigned', unit, day.callTime ?? '07:00')}
                          sx={{ fontSize: 11, color: '#10b981', borderColor: '#10b981', minWidth: 36, py: 0.25, px: 0.5 }}>W</Button>
                        <Button size="small" variant="outlined"
                          onClick={() => onAssign(member.id, day.id, day.date ?? '', 'hold', unit, day.callTime ?? '07:00')}
                          sx={{ fontSize: 11, color: '#ffb800', borderColor: '#ffb800', minWidth: 36, py: 0.25, px: 0.5 }}>H</Button>
                        <Button size="small" variant="outlined"
                          onClick={() => onAssign(member.id, day.id, day.date ?? '', 'travel', unit, day.callTime ?? '07:00')}
                          sx={{ fontSize: 11, color: '#3b82f6', borderColor: '#3b82f6', minWidth: 36, py: 0.25, px: 0.5 }}>T</Button>
                      </>
                    ) : (
                      <Tooltip title={t('crew.tt.removeFromThisDay')}>
                        <IconButton size="small" onClick={() => onUnassign(member.id, day.id)} sx={{ color: '#ff4444', ...focusVisibleStyles }}>
                          <UnassignIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </ListItemSecondaryAction>
              </ListItem>
            );
          })}
        </List>
      </DialogContent>
      <DialogActions sx={{ px: 2, py: 1.5, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <Button onClick={onClose} sx={{ color: 'rgba(255,255,255,0.7)' }}>{t('crew.assign.close')}</Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── DOODOverviewPanel ────────────────────────────────────────────────────────

interface DOODOverviewPanelProps {
  open: boolean;
  onClose: () => void;
  crewMembers: CrewMember[];
  productionDays: ProductionDay[];
  assignments: CrewAssignment[];
  getRoleLabel: (role: CrewRole) => string;
}

function DOODOverviewPanel({ open, onClose, crewMembers, productionDays, assignments, getRoleLabel }: DOODOverviewPanelProps) {
  const { t } = useT();
  const crewWithAssignments = crewMembers.filter(m =>
    assignments.some(a => a.crewMemberId === m.id),
  );

  // Work day count per crew member
  const workDayCount = (memberId: string) =>
    assignments.filter(a => a.crewMemberId === memberId && a.assignmentStatus === 'assigned').length;
  const holdDayCount = (memberId: string) =>
    assignments.filter(a => a.crewMemberId === memberId && a.assignmentStatus === 'hold').length;

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { bgcolor: '#1c2128', borderTop: '2px solid rgba(0,212,255,0.3)', borderRadius: '12px 12px 0 0', maxHeight: '70vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' } }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2.5, pt: 2, pb: 1, flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <DoodIcon sx={{ color: 'var(--role-cyan, #00d4ff)', fontSize: 22 }} />
          <Box>
            <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>Days Out Of Days</Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
              {t('crew.dood.subtitle', { crew: crewWithAssignments.length, days: productionDays.length })}
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={onClose} sx={{ color: 'rgba(255,255,255,0.6)', ...focusVisibleStyles }}>
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Legend */}
      <Box sx={{ display: 'flex', gap: 2, px: 2.5, pb: 1, flexShrink: 0, flexWrap: 'wrap' }}>
        {([
          ['W',   t('crew.dood.legendWork')],
          ['SW',  t('crew.dood.legendStart')],
          ['WF',  t('crew.dood.legendEnd')],
          ['SWF', t('crew.dood.legendOneDay')],
          ['H',   t('crew.dood.legendHold')],
          ['T',   t('crew.dood.legendTravel')],
          ['O',   t('crew.dood.legendOff')],
        ] as [CrewDOODCode, string][]).map(([code, label]) => (
          <Box key={code} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <DotIcon sx={{ fontSize: 14, color: DOOD_COLORS[code]?.bg }} />
            <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{label}</Typography>
          </Box>
        ))}
      </Box>

      {productionDays.length === 0 ? (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>{t('crew.assign.noShootDays')}</Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, mt: 0.5 }}>{t('crew.dood.addDays')}</Typography>
        </Box>
      ) : (
        <Box sx={{ overflowX: 'auto', overflowY: 'auto', flex: 1 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ bgcolor: '#1c2128', color: 'rgba(255,255,255,0.7)', fontWeight: 700, fontSize: 12, minWidth: 160, borderColor: 'rgba(255,255,255,0.1)', position: 'sticky', left: 0, zIndex: 3 }}>
                  {t('crew.dood.crewMember')}
                </TableCell>
                {productionDays.map((day, idx) => (
                  <TableCell key={day.id} align="center" sx={{ bgcolor: '#1c2128', color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: 700, borderColor: 'rgba(255,255,255,0.1)', minWidth: 38, px: 0.5, whiteSpace: 'nowrap' }}>
                    <Box>D{idx + 1}</Box>
                    <Box sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 9 }}>{day.date?.slice(5)}</Box>
                  </TableCell>
                ))}
                <TableCell align="center" sx={{ bgcolor: '#1c2128', color: '#10b981', fontSize: 10, fontWeight: 700, borderColor: 'rgba(255,255,255,0.1)', minWidth: 38 }}>W</TableCell>
                <TableCell align="center" sx={{ bgcolor: '#1c2128', color: '#ffb800', fontSize: 10, fontWeight: 700, borderColor: 'rgba(255,255,255,0.1)', minWidth: 38 }}>H</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {crewMembers.map(member => {
                const wCount = workDayCount(member.id);
                const hCount = holdDayCount(member.id);
                return (
                  <TableRow key={member.id} sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}>
                    <TableCell sx={{ color: '#fff', fontSize: 12, borderColor: 'rgba(255,255,255,0.07)', position: 'sticky', left: 0, bgcolor: '#1c2128', zIndex: 1 }}>
                      <Box>
                        <Typography sx={{ fontSize: 12, fontWeight: 600 }}>{member.name}</Typography>
                        <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>{getRoleLabel(member.role)}</Typography>
                      </Box>
                    </TableCell>
                    {productionDays.map(day => {
                      const code = getMemberDOODCode(member.id, day.id, assignments, productionDays);
                      return (
                        <TableCell key={day.id} align="center" sx={{ borderColor: 'rgba(255,255,255,0.07)', p: 0.5 }}>
                          {code ? (
                            <Tooltip title={t('crew.dood.cellTooltip', { name: member.name, date: day.date ?? '', code })}>
                              <Box sx={{ width: 28, height: 18, borderRadius: 0.5, bgcolor: DOOD_COLORS[code]?.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto' }}>
                                <Typography sx={{ fontSize: 8, fontWeight: 800, color: DOOD_COLORS[code]?.text, fontFamily: 'monospace' }}>{code}</Typography>
                              </Box>
                            </Tooltip>
                          ) : (
                            <Box sx={{ width: 28, height: 18, borderRadius: 0.5, border: '1px solid rgba(255,255,255,0.06)', mx: 'auto' }} />
                          )}
                        </TableCell>
                      );
                    })}
                    <TableCell align="center" sx={{ borderColor: 'rgba(255,255,255,0.07)', color: wCount > 0 ? '#10b981' : 'rgba(255,255,255,0.3)', fontWeight: 700, fontSize: 12 }}>{wCount || '–'}</TableCell>
                    <TableCell align="center" sx={{ borderColor: 'rgba(255,255,255,0.07)', color: hCount > 0 ? '#ffb800' : 'rgba(255,255,255,0.3)', fontWeight: 700, fontSize: 12 }}>{hCount || '–'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      )}
    </Drawer>
  );
}

// ─── CallsheetDrawer ──────────────────────────────────────────────────────────

interface CallsheetDrawerProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  crew: CrewMember[];
  selectedDay: ProductionDay | null;
  scenes: SceneBreakdown[];
  /** All production days for the day-picker inside the drawer */
  productionDays: ProductionDay[];
}

function CallsheetDrawer({ open, onClose, projectId, crew, selectedDay: initialDay, scenes, productionDays }: CallsheetDrawerProps) {
  const { t } = useT();
  const [currentDay, setCurrentDay] = useState<ProductionDay | null>(initialDay);
  // Sync if parent changes the initial day (e.g. user clicks a different day)
  useEffect(() => { setCurrentDay(initialDay); }, [initialDay]);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100vw', md: 700, lg: 800 }, bgcolor: '#13181e', borderLeft: '2px solid rgba(0,212,255,0.25)', display: 'flex', flexDirection: 'column' } }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, px: 2, pt: 2, pb: 1, flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CallsheetIcon sx={{ color: 'var(--role-cyan, #00d4ff)' }} />
          <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>Callsheet-generator</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {productionDays.length > 1 && (
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <Select
                value={currentDay?.id ?? ''}
                onChange={e => setCurrentDay(productionDays.find(d => d.id === e.target.value) ?? null)}
                displayEmpty
                sx={{ color: '#fff', fontSize: 13, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.4)' }, '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.7)' } }}
                MenuProps={{ slotProps: { paper: { sx: { bgcolor: '#1c2128', color: '#fff' } } } }}
              >
                <MenuItem value="">{t('crew.allDays')}</MenuItem>
                {productionDays.map((d, idx) => (
                  <MenuItem key={d.id} value={d.id} sx={{ fontSize: 13 }}>{t('crew.dayLabel', { n: idx + 1, date: d.date ?? '' })}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          <IconButton onClick={onClose} sx={{ color: 'rgba(255,255,255,0.6)', ...focusVisibleStyles }}>
            <CloseIcon />
          </IconButton>
        </Box>
      </Box>
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <CallSheetGenerator
          projectId={projectId}
          crew={crew}
          scenes={scenes}
          productionDay={currentDay ?? undefined}
        />
      </Box>
    </Drawer>
  );
}


interface CrewManagementPanelProps {
  projectId: string;
  onUpdate?: () => void;
  profession?: 'photographer' | 'videographer' | null;
  totalBudget?: number;
  onTotalBudgetChange?: (budget: number) => void;
  onOpenTechnicalTeamDashboard?: () => void;
  externalCreateSignal?: number;
  onExternalCreated?: (crewMember: CrewMember) => void;
  onExternalCreateCancelled?: () => void;
  /** Shoot day schedule from the Stripboard module */
  productionDays?: ProductionDay[];
  /** Scenes list for Callsheet pre-fill */
  scenes?: SceneBreakdown[];
}

const EMPTY_PRODUCTION_DAYS: ProductionDay[] = [];
const EMPTY_SCENES: SceneBreakdown[] = [];

export function CrewManagementPanel({
  projectId,
  onUpdate,
  profession,
  totalBudget = 0,
  onTotalBudgetChange,
  onOpenTechnicalTeamDashboard,
  externalCreateSignal,
  onExternalCreated,
  onExternalCreateCancelled,
  productionDays: propProductionDays,
  scenes: propScenes,
}: CrewManagementPanelProps) {
  const { t } = useT();
  const resolvedProductionDays = propProductionDays ?? EMPTY_PRODUCTION_DAYS;
  const resolvedScenes = propScenes ?? EMPTY_SCENES;
  const isMobile = useMediaQuery('(max-width: 767px)');
  const dialogTitleId = useId();
  const dialogDescId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Toast notifications
  const { showSuccess, showError, showInfo } = useToast();
  const { user } = useAuth();
  const noteActorLabel = useMemo(() => {
    const raw = user?.displayName ?? user?.name ?? user?.email;
    return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : t('crew.unknownUser');
  }, [user, t]);
  const noteActorId = user?.id !== undefined && user?.id !== null ? String(user.id) : undefined;
  const roleTabAccent = 'var(--role-accent, #b86bff)';
  const roleTabAccentHover = '#a855f7';
  const roleTabAccentSoft = 'rgba(184,107,255,0.18)';
  const roleSurface = 'rgba(20,14,48,0.84)';
  const roleSurfaceMuted = 'rgba(33,24,70,0.72)';
  const roleBorder = 'var(--role-border, rgba(184,107,255,0.32))';
  const roleText = '#ffffff';
  const roleTextMuted = 'rgba(255,255,255,0.92)';
  const rolePanelBackdrop = "url('/role-room-assets/role_panel_backdrop.webp')";

  // Core state
  const [crewMembers, setCrewMembers] = useState<CrewMember[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [whatsAppGroupDialogOpen, setWhatsAppGroupDialogOpen] = useState(false);
  const mentionCandidates = useMemo(
    () =>
      crewMembers
        .map((member) => member.name)
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
    [crewMembers],
  );
  const applyMentionSuggestion = useCallback((sourceText: string | undefined, name: string): string => {
    const current = typeof sourceText === 'string' ? sourceText : '';
    if (!current.trim()) return name;
    const replaced = current.replace(/([A-Za-zÆØÅæøå][A-Za-z0-9ÆØÅæøå'.-]*)$/u, name);
    return replaced !== current ? replaced : `${current.trimEnd()} ${name}`;
  }, []);
  
  // Load crew members when projectId changes
  useEffect(() => {
    const loadCrew = async () => {
      if (projectId) {
        setIsLoading(true);
        try {
          const crew = await castingService.getCrew(projectId);
          setCrewMembers(Array.isArray(crew) ? crew : []);
        } catch (error) {
          console.error('Error loading crew:', error);
          setCrewMembers([]);
        } finally {
          setIsLoading(false);
        }
      }
    };
    loadCrew();
  }, [projectId]);

  // ─── Auto-vis brukere lagt til i prosjektet + synk tilgjengeligheten deres ──
  // Medlemmer som deler produksjonsteam-prosjektet (medlemskatalogen) dukker
  // automatisk opp som crew-rader, med tilgjengelighet hentet fra deres egen
  // kalender (role_room_member_availability). Delt hook = samme kilde som resten
  // av The Role Room synker mot. Manuelt opprettede crew-rader med samme e-post
  // beriker vi i stedet for å duplisere.
  const { members: projectMembers, availabilityByUser, emailToUser } =
    useProjectMemberAvailability(projectId);

  // Manuelle crew-rader beriket med kalender + virtuelle rader for lagt-til
  // medlemmer. Kun display-avledet: `crewMembers` (persistert kilde) er urørt,
  // så redigering/lagring/sletting nedenfor treffer aldri synket data.
  const enrichedCrew = useMemo<CrewMember[]>(() => {
    if (projectMembers.length === 0) return crewMembers;

    const usedUserIds = new Set<string>();
    const rows: CrewMember[] = crewMembers.map((member) => {
      let userId = typeof (member as { memberUserId?: unknown }).memberUserId === 'string'
        ? (member as { memberUserId?: string }).memberUserId
        : undefined;
      if (!userId && isVirtualCrewId(member.id)) userId = member.id.slice('member:'.length);
      if (!userId) {
        const em = (member.contactInfo?.email || '').toLowerCase().trim();
        if (em) userId = emailToUser.get(em);
      }
      if (userId) usedUserIds.add(userId);
      const overlay = userId ? availabilityByUser.get(userId) : undefined;
      if (!overlay) return member;
      return {
        ...member,
        availabilityCells: overlay.cells.length ? overlay.cells : member.availabilityCells,
        availability: overlay.range ? { ...member.availability, ...overlay.range } : member.availability,
        availabilitySynced: true,
      } as CrewMember;
    });

    for (const m of projectMembers) {
      if (usedUserIds.has(m.userId)) continue;
      const overlay = availabilityByUser.get(m.userId);
      rows.push({ ...memberToVirtualCrew(m, overlay), availabilitySynced: Boolean(overlay) } as CrewMember);
    }
    return rows;
  }, [crewMembers, projectMembers, availabilityByUser, emailToUser]);

  const [editingCrewMember, setEditingCrewMember] = useState<CrewMember | null>(null);
  const [formData, setFormData] = useState<Partial<CrewMember>>({
    name: '',
    role: 'other',
    contactInfo: {},
    availability: {},
    assignedScenes: [],
    notes: '',
  });

  // Local budget state (used if not provided via props)
  const [localBudget, setLocalBudget] = useState<number>(0);
  const effectiveBudget = totalBudget > 0 ? totalBudget : localBudget;

  // Calculate percentage based on rate and budget
  const calculatedPercentage = useMemo(() => {
    if (effectiveBudget > 0 && formData.rate && formData.rate > 0) {
      return (formData.rate / effectiveBudget) * 100;
    }
    return formData.splitSheet?.percentage ?? 0;
  }, [effectiveBudget, formData.rate, formData.splitSheet?.percentage]);

  // Auto-update percentage when rate or budget changes
  useEffect(() => {
    if (effectiveBudget > 0 && formData.rate && formData.rate > 0) {
      const newPercentage = (formData.rate / effectiveBudget) * 100;
      setFormData((prev) => ({
        ...prev,
        splitSheet: {
          ...(prev.splitSheet ?? {}),
          percentage: newPercentage,
        },
      }));
    }
  }, [effectiveBudget, formData.rate]);

  // Search, filter, sort state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<CrewRole | 'all'>('all');
  const [filterAvailable, setFilterAvailable] = useState(false);
  const [filterAssignedToday, setFilterAssignedToday] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('standard');
  const [proViewFocus, setProViewFocus] = useState<ProViewFocus>('all');
  const [compactMode, setCompactMode] = useState(false);
  const [showStats, setShowStats] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pinNameColumn, setPinNameColumn] = useState(true);
  const [pinContactColumn, setPinContactColumn] = useState(false);
  const [filterDept, setFilterDept] = useState<DeptKey | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<CrewStatus | 'all'>('all');
  const [showDeptSidebar, setShowDeptSidebar] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const externalCreateSignalRef = useRef(0);
  const externalCreatePendingRef = useRef(false);
  const crewOfflineQueueStorageKey = getCrewOfflineQueueStorageKey(projectId);
  const [offlinePending, setOfflinePending] = useState<number>(() => {
    try {
      const q = JSON.parse(localStorage.getItem(crewOfflineQueueStorageKey) || '[]') as Array<{ projectId: string }>;
      return q.length;
    } catch {
      return 0;
    }
  });
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const commandInputRef = useRef<HTMLInputElement>(null);

  const [savedViews, setSavedViews] = useState<SavedCrewView[]>([]);
  const [savedViewAnchor, setSavedViewAnchor] = useState<HTMLElement | null>(null);
  const [activityOpen, setActivityOpen] = useState(false);
  const [activityLog, setActivityLog] = useState<CrewActivityLogEntry[]>([]);
  const [plannerSourceMemberId, setPlannerSourceMemberId] = useState<string | null>(null);
  const [plannerDragOverDayId, setPlannerDragOverDayId] = useState<string | null>(null);

  const [bulkRole, setBulkRole] = useState<CrewRole | 'none'>('none');
  const [bulkRateInput, setBulkRateInput] = useState('');

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Favorites with database sync
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);

  const FAVORITES_NAMESPACE = 'virtualStudio_crewFavorites';
  const SAVED_VIEWS_KEY = `crew-management:saved-views:${projectId}`;
  const ACTIVITY_LOG_KEY = `crew-management:activity-log:${projectId}`;

  const logActivity = useCallback((action: string, details: string) => {
    setActivityLog((previous) => {
      const next: CrewActivityLogEntry[] = [
        {
          id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          action,
          details,
          timestamp: Date.now(),
        },
        ...previous,
      ].slice(0, 120);
      try {
        localStorage.setItem(ACTIVITY_LOG_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage errors in local dev/private mode.
      }
      return next;
    });
  }, [ACTIVITY_LOG_KEY]);

  const captureViewState = useCallback((): SavedCrewView['state'] => ({
    searchQuery,
    filterRole,
    filterDept,
    filterStatus,
    filterAvailable,
    filterAssignedToday,
    sortField,
    sortDirection,
    viewMode,
    workspaceView,
    proViewFocus,
    showDeptSidebar,
    showStats,
    compactMode,
    pinNameColumn,
    pinContactColumn,
  }), [
    searchQuery,
    filterRole,
    filterDept,
    filterStatus,
    filterAvailable,
    filterAssignedToday,
    sortField,
    sortDirection,
    viewMode,
    workspaceView,
    proViewFocus,
    showDeptSidebar,
    showStats,
    compactMode,
    pinNameColumn,
    pinContactColumn,
  ]);

  const applySavedView = useCallback((view: SavedCrewView) => {
    const state = view.state;
    setSearchQuery(state.searchQuery);
    setFilterRole(state.filterRole);
    setFilterDept(state.filterDept);
    setFilterStatus(state.filterStatus);
    setFilterAvailable(state.filterAvailable);
    setFilterAssignedToday(state.filterAssignedToday);
    setSortField(state.sortField);
    setSortDirection(state.sortDirection);
    setViewMode(state.viewMode);
    setWorkspaceView(state.workspaceView);
    setProViewFocus(state.proViewFocus ?? 'all');
    setShowDeptSidebar(state.showDeptSidebar);
    setShowStats(state.showStats);
    setCompactMode(state.compactMode);
    setPinNameColumn(state.pinNameColumn ?? true);
    setPinContactColumn(state.pinContactColumn ?? false);
    setSavedViewAnchor(null);
    logActivity('Saved view', t('crew.log.viewActivated', { name: view.name }));
  }, [logActivity]);
  
  // Load favorites from database (with settings cache fallback)
  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const { favoritesApi } = await import('../services/castingApiService');
        const dbFavorites = await favoritesApi.get(projectId, 'crew');
        if (dbFavorites.length > 0) {
          setFavorites(new Set(dbFavorites));
          await settingsService.setSetting(FAVORITES_NAMESPACE, dbFavorites, { projectId });
          setFavoritesLoaded(true);
          return;
        }
      } catch (error) {
        console.warn('Database unavailable, using settings cache:', error);
      }
      const cached = await settingsService.getSetting<string[]>(FAVORITES_NAMESPACE, { projectId });
      if (cached && cached.length > 0) {
        setFavorites(new Set(cached));
        setFavoritesLoaded(true);
        return;
      }
      setFavoritesLoaded(true);
    };
    loadFavorites();
  }, [projectId]);

  useEffect(() => {
    try {
      const rawSavedViews = localStorage.getItem(SAVED_VIEWS_KEY);
      if (rawSavedViews) {
        const parsed = JSON.parse(rawSavedViews) as SavedCrewView[];
        if (Array.isArray(parsed)) {
          setSavedViews(parsed);
        }
      } else {
        setSavedViews([]);
      }
    } catch {
      setSavedViews([]);
    }

    try {
      const rawLog = localStorage.getItem(ACTIVITY_LOG_KEY);
      if (rawLog) {
        const parsed = JSON.parse(rawLog) as CrewActivityLogEntry[];
        if (Array.isArray(parsed)) {
          setActivityLog(parsed.slice(0, 120));
        }
      } else {
        setActivityLog([]);
      }
    } catch {
      setActivityLog([]);
    }
  }, [SAVED_VIEWS_KEY, ACTIVITY_LOG_KEY]);

  useEffect(() => {
    try {
      localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(savedViews));
    } catch {
      // Ignore storage errors in local dev/private mode.
    }
  }, [savedViews, SAVED_VIEWS_KEY]);

  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [deletedCrew, setDeletedCrew] = useState<CrewMember | null>(null);
  const [showUndoSnackbar, setShowUndoSnackbar] = useState(false);
  const [showCostCalculator, setShowCostCalculator] = useState(false);
  const [costStartDate, setCostStartDate] = useState('');
  const [costEndDate, setCostEndDate] = useState('');

  // ── Production / Stripboard integration ──────────────────────────────────
  const [productionDays, setProductionDays] = useState<ProductionDay[]>(resolvedProductionDays);
  const [crewAssignments, setCrewAssignments] = useState<CrewAssignment[]>([]);
  const [callsheetOpen, setCallsheetOpen] = useState(false);
  const [callsheetDay, setCallsheetDay] = useState<ProductionDay | null>(null);
  const [callsheetCrewScope, setCallsheetCrewScope] = useState<'all' | 'technical'>('all');
  const [doodOpen, setDoodOpen] = useState(false);
  const [assignDayOpen, setAssignDayOpen] = useState(false);
  const [assigningMember, setAssigningMember] = useState<CrewMember | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);

  const callsheetCrewPool = useMemo(() => {
    const baseCrew = selectedIds.size > 0 ? crewMembers.filter((member) => selectedIds.has(member.id)) : crewMembers;
    if (callsheetCrewScope === 'technical') {
      return baseCrew.filter((member) => isTechnicalCrewMemberFromShared(member));
    }
    return baseCrew;
  }, [callsheetCrewScope, crewMembers, selectedIds]);

  const roleLegendEntries = useMemo(
    () => Array.from(new Set(crewMembers.map((member) => String(member.role)))).slice(0, 18),
    [crewMembers]
  );

  // Keep productionDays in sync with parent prop changes
  useEffect(() => { setProductionDays(resolvedProductionDays); }, [resolvedProductionDays]);

  // Load crew assignments from service
  useEffect(() => {
    if (!projectId) return;
    castingService.getCrewAssignments(projectId)
      .then((data: CrewAssignment[]) => setCrewAssignments(Array.isArray(data) ? data : []))
      .catch(() => { /* service unavailable — start with empty assignments */ });
  }, [projectId]);

  // Debounce search query (300 ms) – avoids re-filtering on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Keep offlinePending in sync with the localStorage queue (written by useCrewData)
  useEffect(() => {
    const countPending = () => {
      try {
        const q = JSON.parse(localStorage.getItem(crewOfflineQueueStorageKey) || '[]') as Array<{ projectId: string }>;
        setOfflinePending(q.length);
      } catch { setOfflinePending(0); }
    };
    window.addEventListener('online', countPending);
    window.addEventListener('storage', countPending);
    return () => {
      window.removeEventListener('online', countPending);
      window.removeEventListener('storage', countPending);
    };
  }, [crewOfflineQueueStorageKey]);

  // Profession-specific crew role priorities
  const getCrewRoles = (): CrewRole[] => {
    const allRoles: CrewRole[] = [
      'director',
      'producer',
      'casting_director',
      'production_manager',
      'cinematographer',
      'camera_operator',
      'camera_assistant',
      'drone_pilot',
      'video_editor',
      'colorist',
      'gaffer',
      'grip',
      'sound_engineer',
      'audio_mixer',
      'vfx_artist',
      'motion_graphics',
      'production_assistant',
      'script_supervisor',
      'location_manager',
      'production_designer',
      'makeup_artist',
      'wardrobe',
      'stylist',
      'collaborator',
      'other',
    ];
    
    if (profession === 'photographer') {
      // Prioritize photographer-relevant roles
      return [
        'camera_operator',
        'camera_assistant',
        'makeup_artist',
        'stylist',
        'wardrobe',
        'producer',
        'production_manager',
        'gaffer',
        'grip',
        'director',
        'casting_director',
        'production_assistant',
        'location_manager',
        'collaborator',
        'other',
      ];
    } else if (profession === 'videographer') {
      // Prioritize videographer-relevant roles
      return [
        'director',
        'producer',
        'cinematographer',
        'camera_operator',
        'drone_pilot',
        'video_editor',
        'colorist',
        'sound_engineer',
        'audio_mixer',
        'gaffer',
        'grip',
        'camera_assistant',
        'production_assistant',
        'script_supervisor',
        'location_manager',
        'production_designer',
        'vfx_artist',
        'motion_graphics',
        'production_manager',
        'casting_director',
        'makeup_artist',
        'wardrobe',
        'stylist',
        'collaborator',
        'other',
      ];
    }
    
    return allRoles;
  };

  const crewRoles = getCrewRoles();

  const getRoleLabel = (role: CrewRole): string => {
    const labels: Record<CrewRole, string> = {
      director: t('crew.role.director'),
      producer: t('crew.role.producer'),
      casting_director: t('crew.role.casting_director'),
      production_manager: t('crew.role.production_manager'),
      cinematographer: t('crew.role.cinematographer'),
      camera_operator: t('crew.role.camera_operator'),
      camera_assistant: t('crew.role.camera_assistant'),
      drone_pilot: t('crew.role.drone_pilot'),
      video_editor: t('crew.role.video_editor'),
      colorist: t('crew.role.colorist'),
      gaffer: t('crew.role.gaffer'),
      grip: t('crew.role.grip'),
      sound_engineer: t('crew.role.sound_engineer'),
      audio_mixer: t('crew.role.audio_mixer'),
      vfx_artist: t('crew.role.vfx_artist'),
      motion_graphics: t('crew.role.motion_graphics'),
      production_assistant: t('crew.role.production_assistant'),
      script_supervisor: t('crew.role.script_supervisor'),
      location_manager: t('crew.role.location_manager'),
      production_designer: t('crew.role.production_designer'),
      makeup_artist: t('crew.role.makeup_artist'),
      wardrobe: t('crew.role.wardrobe'),
      stylist: t('crew.role.stylist'),
      collaborator: t('crew.role.collaborator'),
      other: t('crew.role.other'),
    };
    return labels[role] || role;
  };

  const ROLE_WEBP: Record<CrewRole, string> = {
    director:              '/role-room-assets/roleroom_director.webp',
    producer:              '/role-room-assets/roleroom_producer.webp',
    casting_director:      '/role-room-assets/roleroom_casting_director.webp',
    production_manager:    '/role-room-assets/roleroom_photo_director.webp',
    cinematographer:       '/role-room-assets/roleroom_filmfotograf.webp',
    camera_operator:       '/role-room-assets/roleroom_photographer.webp',
    camera_assistant:      '/role-room-assets/roleroom_photo_assistant.webp',
    drone_pilot:           '/role-room-assets/roleroom_camera.webp',
    video_editor:          '/role-room-assets/roleroom_cinemag.webp',
    colorist:              '/role-room-assets/roleroom_cinemag.webp',
    gaffer:                '/role-room-assets/roleroom_lys.webp',
    grip:                  '/role-room-assets/roleroom_camera.webp',
    sound_engineer:        '/role-room-assets/roleroom_sound_designer.webp',
    audio_mixer:           '/role-room-assets/roleroom_boom_operator.webp',
    vfx_artist:            '/role-room-assets/roleroom_cinemag.webp',
    motion_graphics:       '/role-room-assets/roleroom_composer.webp',
    production_assistant:  '/role-room-assets/roleroom_photo_assistant.webp',
    script_supervisor:     '/role-room-assets/roleroom_agent.webp',
    location_manager:      '/role-room-assets/roleroom_camp.webp',
    production_designer:   '/role-room-assets/roleroom_photo_director.webp',
    makeup_artist:         '/role-room-assets/roleroom_skuespiller.webp',
    wardrobe:              '/role-room-assets/roleroom_skuespiller.webp',
    stylist:               '/role-room-assets/roleroom_skuespiller.webp',
    collaborator:          '/role-room-assets/roleroom_klient.webp',
    other:                 '/role-room-assets/roleroom_crew.webp',
  };

  const getRoleIcon = (role: CrewRole, size: number = 20): ReactElement => {
    const src = ROLE_WEBP[role] ?? ROLE_WEBP.other;
    return (
      <Box
        component="img"
        src={src}
        alt={getRoleLabel(role)}
        sx={{
          width: size,
          height: size,
          objectFit: 'cover',
          borderRadius: '50%',
          display: 'block',
          flexShrink: 0,
        }}
      />
    );
  };

  // Check if crew member is currently available
  const isAvailableNow = (member: CrewMember): boolean => {
    if (!member.availability?.startDate || !member.availability?.endDate) return true;
    const today = new Date().toISOString().split('T')[0];
    return member.availability.startDate <= today && member.availability.endDate >= today;
  };

  // Stable today string – computed once at mount (date won't change during a session)
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Statistics calculations
  const stats = useMemo(() => {
    const roleCount: Record<string, number> = {};
    let totalRate = 0;
    let availableCount = 0;
    let pendingCount = 0;
    let invitedCount = 0;
    let confirmedCount = 0;
    const assignedTodaySet = new Set(
      crewAssignments
        .filter(a => a.shootDayDate === todayStr && a.assignmentStatus === 'assigned')
        .map(a => a.crewMemberId),
    );

    enrichedCrew.forEach(member => {
      roleCount[member.role] = (roleCount[member.role] || 0) + 1;
      if (member.rate) totalRate += member.rate;
      if (isAvailableNow(member)) availableCount++;
      if (member.status === 'pending') pendingCount++;
      else if (member.status === 'invited') invitedCount++;
      else if (member.status === 'confirmed') confirmedCount++;
    });

    const conflicts = detectConflicts(crewAssignments);

    // Opptatt = bekreftet + tildelt i dag (eller fra crewAssignments) — folk som er bundet opp
    const busyCount = assignedTodaySet.size;

    return {
      total: enrichedCrew.length,
      roleCount,
      totalDailyRate: totalRate,
      availableNow: availableCount,
      pendingCount,
      invitedCount,
      confirmedCount,
      busyCount,
      assignedToday: assignedTodaySet.size,
      totalConflicts: conflicts.length,
    };
  }, [enrichedCrew, crewAssignments, todayStr]);

  // Filtered and sorted crew members
  const filteredAndSortedCrew = useMemo(() => {
    let result = [...enrichedCrew];

    // Search filter (debounced – avoids re-filtering on every keystroke)
    if (debouncedSearch.trim()) {
      const query = debouncedSearch.toLowerCase();
      result = result.filter(member =>
        member.name.toLowerCase().includes(query) ||
        member.contactInfo?.email?.toLowerCase().includes(query) ||
        member.contactInfo?.phone?.includes(query) ||
        getRoleLabel(member.role).toLowerCase().includes(query)
      );
    }

    // Role filter
    if (filterRole !== 'all') {
      result = result.filter(member => member.role === filterRole);
    }

    // Department filter
    if (filterDept !== 'all') {
      result = result.filter(member => (ROLE_TO_DEPT[member.role] ?? 'other') === filterDept);
    }

    // Status filter
    if (filterStatus !== 'all') {
      result = result.filter(member => member.status === filterStatus);
    }

    // Availability filter
    if (filterAvailable) {
      result = result.filter(member => isAvailableNow(member));
    }

    // Assigned today filter – shows only crew with an active shoot-day assignment today
    if (filterAssignedToday) {
      const todayAssignedIds = new Set(
        crewAssignments
          .filter(a => a.shootDayDate === todayStr && a.assignmentStatus === 'assigned')
          .map(a => a.crewMemberId),
      );
      result = result.filter(member => todayAssignedIds.has(member.id));
    }

    // Sorting
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name, 'no');
          break;
        case 'role':
          comparison = getRoleLabel(a.role).localeCompare(getRoleLabel(b.role), 'no');
          break;
        case 'rate':
          comparison = (a.rate || 0) - (b.rate || 0);
          break;
        case 'availability':
          comparison = (a.availability?.startDate || '').localeCompare(b.availability?.startDate || '');
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [enrichedCrew, debouncedSearch, filterRole, filterDept, filterStatus, filterAvailable, filterAssignedToday, crewAssignments, todayStr, sortField, sortDirection]);

  // Conflict map: crewMemberId → has double-booking conflict (O(assignments) once per assignment change)
  const conflictMap = useMemo<Map<string, boolean>>(() => {
    const raw = detectConflicts(crewAssignments);
    const map = new Map<string, boolean>();
    for (const c of raw) map.set(c.crewMemberId, true);
    return map;
  }, [crewAssignments]);

  const proInsights = useMemo(() => {
    const confirmed = filteredAndSortedCrew.filter((member) => member.status === 'confirmed').length;
    const pending = filteredAndSortedCrew.filter((member) => member.status === 'pending').length;
    const invited = filteredAndSortedCrew.filter((member) => member.status === 'invited').length;
    const unavailable = filteredAndSortedCrew.filter((member) => member.status === 'unavailable').length;
    const averageRate = filteredAndSortedCrew.length > 0
      ? Math.round(filteredAndSortedCrew.reduce((sum, member) => sum + (member.rate || 0), 0) / filteredAndSortedCrew.length)
      : 0;
    const topRoles = Object.entries(stats.roleCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([role, count]) => `${getRoleLabel(role as CrewRole)} (${count})`);

    return {
      confirmed,
      pending,
      invited,
      unavailable,
      averageRate,
      topRoles,
    };
  }, [filteredAndSortedCrew, stats.roleCount, t]);

  const riskInsights = useMemo(() => {
    const availabilityConflicts: CrewMember[] = [];
    const overtimeRisk: CrewMember[] = [];
    const missingContact: CrewMember[] = [];
    const assignmentCountByMember = new Map<string, number>();

    for (const assignment of crewAssignments) {
      if (assignment.assignmentStatus !== 'assigned' && assignment.assignmentStatus !== 'travel') continue;
      assignmentCountByMember.set(
        assignment.crewMemberId,
        (assignmentCountByMember.get(assignment.crewMemberId) ?? 0) + 1
      );

      const member = crewMembers.find((item) => item.id === assignment.crewMemberId);
      if (!member) continue;
      const startDate = member.availability?.startDate;
      const endDate = member.availability?.endDate;
      const shootDayDate = assignment.shootDayDate;
      if (startDate && shootDayDate && (shootDayDate < startDate || (endDate && shootDayDate > endDate))) {
        if (!availabilityConflicts.some((item) => item.id === member.id)) {
          availabilityConflicts.push(member);
        }
      }
    }

    for (const member of crewMembers) {
      const assignmentCount = assignmentCountByMember.get(member.id) ?? 0;
      if (assignmentCount >= 6) {
        overtimeRisk.push(member);
      }
      if (!member.contactInfo?.email || !member.contactInfo?.phone) {
        missingContact.push(member);
      }
    }

    return {
      availabilityConflicts,
      overtimeRisk,
      missingContact,
      totalRisk: availabilityConflicts.length + overtimeRisk.length + stats.totalConflicts,
    };
  }, [crewAssignments, crewMembers, stats.totalConflicts]);

  const budgetIntelligence = useMemo(() => {
    const assignedCrewIds = new Set(
      crewAssignments
        .filter((assignment) => assignment.assignmentStatus === 'assigned' || assignment.assignmentStatus === 'travel')
        .map((assignment) => assignment.crewMemberId)
    );
    const assignedDailyCost = crewMembers
      .filter((member) => assignedCrewIds.has(member.id))
      .reduce((sum, member) => sum + (member.rate || 0), 0);
    const overallDailyCost = crewMembers.reduce((sum, member) => sum + (member.rate || 0), 0);
    const utilizationRatio = effectiveBudget > 0 ? overallDailyCost / effectiveBudget : null;
    const assignedUtilization = effectiveBudget > 0 ? assignedDailyCost / effectiveBudget : null;
    const highCostMembers = [...crewMembers]
      .filter((member) => (member.rate || 0) > 0)
      .sort((a, b) => (b.rate || 0) - (a.rate || 0))
      .slice(0, 3);

    const recommendations: string[] = [];
    if (utilizationRatio !== null && utilizationRatio > 1) {
      recommendations.push(t('crew.budgetRec.exceed'));
    } else if (utilizationRatio !== null && utilizationRatio > 0.8) {
      recommendations.push(t('crew.budgetRec.high'));
    }
    if (riskInsights.overtimeRisk.length > 0) {
      recommendations.push(t('crew.budgetRec.dayLoad'));
    }
    if (recommendations.length === 0) {
      recommendations.push(t('crew.budgetRec.stable'));
    }

    return {
      assignedDailyCost,
      overallDailyCost,
      utilizationRatio,
      assignedUtilization,
      highCostMembers,
      recommendations,
    };
  }, [crewAssignments, crewMembers, effectiveBudget, riskInsights.overtimeRisk.length, t]);

  const proActionItems = useMemo<ProActionItem[]>(() => {
    const items: ProActionItem[] = [];
    const assignedCrewIds = new Set(
      crewAssignments
        .filter((assignment) => assignment.assignmentStatus === 'assigned' || assignment.assignmentStatus === 'travel')
        .map((assignment) => assignment.crewMemberId)
    );
    const unassignedCrewCount = crewMembers.filter((member) => !assignedCrewIds.has(member.id)).length;

    if (stats.totalConflicts > 0) {
      items.push({
        id: 'resolve-conflicts',
        title: t('crew.pro.resolveTitle'),
        detail: t(stats.totalConflicts === 1 ? 'crew.pro.resolveDetailOne' : 'crew.pro.resolveDetailMany', { n: stats.totalConflicts }),
        focus: 'risks',
        severity: 'high',
      });
    }

    if (riskInsights.overtimeRisk.length > 0) {
      items.push({
        id: 'reduce-overtime',
        title: t('crew.pro.overtimeTitle'),
        detail: t('crew.pro.overtimeDetail', { n: riskInsights.overtimeRisk.length }),
        focus: 'risks',
        severity: 'medium',
      });
    }

    if (riskInsights.missingContact.length > 0) {
      items.push({
        id: 'complete-contact',
        title: t('crew.pro.contactTitle'),
        detail: t('crew.pro.contactDetail', { n: riskInsights.missingContact.length }),
        focus: 'risks',
        severity: 'medium',
      });
    }

    if ((budgetIntelligence.utilizationRatio ?? 0) > 0.85) {
      items.push({
        id: 'review-budget',
        title: t('crew.pro.budgetTitle'),
        detail: t('crew.pro.budgetDetail', { pct: ((budgetIntelligence.utilizationRatio ?? 0) * 100).toFixed(1) }),
        focus: 'budget',
        severity: (budgetIntelligence.utilizationRatio ?? 0) > 1 ? 'high' : 'medium',
      });
    }

    if (productionDays.length > 0 && unassignedCrewCount > 0) {
      items.push({
        id: 'staff-unassigned',
        title: t('crew.pro.staffTitle'),
        detail: t('crew.pro.staffDetail', { n: unassignedCrewCount }),
        focus: 'planner',
        severity: 'low',
      });
    }

    if (items.length === 0) {
      items.push({
        id: 'maintain-plan',
        title: t('crew.pro.maintainTitle'),
        detail: t('crew.pro.maintainDetail'),
        focus: 'overview',
        severity: 'low',
      });
    }

    return items.slice(0, 3);
  }, [
    budgetIntelligence.utilizationRatio,
    crewAssignments,
    crewMembers,
    productionDays.length,
    riskInsights.missingContact.length,
    riskInsights.overtimeRisk.length,
    stats.totalConflicts,
    t,
  ]);

  const plannerCandidates = useMemo(() => {
    const selectedCrew = selectedIds.size > 0
      ? filteredAndSortedCrew.filter((member) => selectedIds.has(member.id))
      : filteredAndSortedCrew;
    return selectedCrew.slice(0, 12);
  }, [filteredAndSortedCrew, selectedIds]);

  const plannerDays = useMemo(() => productionDays.slice(0, 8), [productionDays]);

  const plannerAssignmentsByDay = useMemo(() => {
    const byDay = new Map<string, Array<{
      assignment: CrewAssignment;
      member: CrewMember;
      doodCode: CrewDOODCode | null;
      status: 'assigned' | 'hold' | 'travel' | 'release' | 'unknown';
    }>>();
    const plannerDayIds = new Set(plannerDays.map((day) => day.id));
    const memberById = new Map(crewMembers.map((member) => [member.id, member]));

    plannerDays.forEach((day) => {
      byDay.set(day.id, []);
    });

    crewAssignments.forEach((assignment) => {
      if (!plannerDayIds.has(assignment.shootDayId)) return;
      const member = memberById.get(assignment.crewMemberId);
      if (!member) return;

      const rawStatus = String(assignment.assignmentStatus ?? assignment.status ?? 'assigned').toLowerCase();
      const status: 'assigned' | 'hold' | 'travel' | 'release' | 'unknown' =
        rawStatus === 'assigned' || rawStatus === 'hold' || rawStatus === 'travel' || rawStatus === 'release'
          ? rawStatus
          : 'unknown';

      const list = byDay.get(assignment.shootDayId);
      if (!list) return;
      list.push({
        assignment,
        member,
        doodCode: getMemberDOODCode(member.id, assignment.shootDayId, crewAssignments, productionDays),
        status,
      });
    });

    byDay.forEach((list) => {
      list.sort((a, b) => a.member.name.localeCompare(b.member.name, 'no'));
    });

    return byDay;
  }, [crewAssignments, crewMembers, plannerDays, productionDays]);

  const plannerAssignmentCountByMember = useMemo(() => {
    const counts = new Map<string, number>();
    plannerAssignmentsByDay.forEach((list) => {
      list.forEach(({ member, status }) => {
        if (status === 'release') return;
        counts.set(member.id, (counts.get(member.id) ?? 0) + 1);
      });
    });
    return counts;
  }, [plannerAssignmentsByDay]);

  // Bulk operations
  const handleSelectAll = () => {
    if (selectedIds.size === filteredAndSortedCrew.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAndSortedCrew.map(m => m.id)));
    }
  };

  const handleSelectOne = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (window.confirm(t('crew.confirm.bulkDelete', { n: selectedIds.size }))) {
      try {
        for (const id of selectedIds) {
          await castingService.deleteCrew(projectId, id);
        }
        const crew = await castingService.getCrew(projectId);
        setCrewMembers(Array.isArray(crew) ? crew : []);
        setSelectedIds(new Set());
        logActivity('Bulk', t('crew.log.deletedMembers', { n: selectedIds.size }));
        if (onUpdate) onUpdate();
      } catch (error) {
        console.error('Error deleting crew:', error);
        showError(t('crew.toast.deleteMembersError'));
      }
    }
  };

  // Invite a new crew member (saves with status: 'invited')
  const handleInviteCrew = async (data: { name: string; role: CrewRole; email?: string; phone?: string }) => {
    try {
      const member: CrewMember = {
        id: `crew-${Date.now()}`,
        name: data.name,
        role: data.role,
        status: 'invited',
        contactInfo: { email: data.email, phone: data.phone },
        availability: {},
        assignedScenes: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await castingService.saveCrew(projectId, member);
      const crew = await castingService.getCrew(projectId);
      setCrewMembers(Array.isArray(crew) ? crew : []);
      showSuccess(t('crew.toast.invitationSent', { name: data.name }), 3000);
      logActivity('Crew', t('crew.log.invited', { name: data.name }));
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error inviting crew member:', error);
      showError(t('crew.toast.inviteError'));
    }
  };

  // Bulk-update status for all selected crew members
  const handleBulkStatusChange = async (status: CrewStatus) => {
    try {
      for (const id of selectedIds) {
        const m = crewMembers.find(x => x.id === id);
        if (m) await castingService.saveCrew(projectId, { ...m, status, updatedAt: new Date().toISOString() });
      }
      const crew = await castingService.getCrew(projectId);
      setCrewMembers(Array.isArray(crew) ? crew : []);
      const count = selectedIds.size;
      setSelectedIds(new Set());
      showSuccess(t('crew.toast.statusUpdated', { n: count }), 3000);
      logActivity('Bulk', t('crew.log.updatedStatus', { status: t(STATUS_LABEL_KEY[status]), n: count }));
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error updating crew status:', error);
      showError(t('crew.toast.statusUpdateError'));
    }
  };

  // Bulk assign to shoot day – opens AssignShootDayDialog for first selected member
  const handleBulkAssignDay = useCallback(() => {
    const firstId = [...selectedIds][0];
    if (!firstId) return;
    const member = crewMembers.find(m => m.id === firstId);
    if (member) {
      setAssigningMember(member);
      setAssignDayOpen(true);
      logActivity('Bulk', t('crew.log.openedDayAssign', { n: selectedIds.size }));
    }
  }, [selectedIds, crewMembers, logActivity]);

  // Assign crew member to active scene / shoot day
  const handleAssignToScene = useCallback((member: CrewMember) => {
    setAssigningMember(member);
    setAssignDayOpen(true);
  }, []);

  const handleCrewAssign = useCallback(async (
    crewMemberId: string, dayId: string, date: string,
    status: 'assigned' | 'hold' | 'travel' | 'release', unit: 'A' | 'B', callTime: string,
  ) => {
    const newAssignment: CrewAssignment = {
      id: `ca-${Date.now()}`,
      crewMemberId,
      shootDayId: dayId,
      shootDayDate: date,
      unit,
      callTime,
      assignmentStatus: status,
    };
    const updated = [
      ...crewAssignments.filter(a => !(a.crewMemberId === crewMemberId && a.shootDayId === dayId)),
      newAssignment,
    ];
    setCrewAssignments(updated);
    try {
      await castingService.saveCrewAssignment(projectId, newAssignment);
      const code = getMemberDOODCode(crewMemberId, dayId, updated, productionDays) ?? status.toUpperCase();
      showSuccess(t('crew.toast.assignedDay', { name: crewMembers.find(m => m.id === crewMemberId)?.name ?? 'Crew', date, code }), 3000);
      roleRoomAnalytics.crewAssigned({
        project_id: projectId,
        crew_id: crewMemberId,
        role: crewMembers.find(m => m.id === crewMemberId)?.role ?? undefined,
      });
    } catch {
      showInfo(t('crew.toast.assignSavedLocal'));
    }
    logActivity('Plan', t('crew.log.assignedTo', { name: crewMembers.find(m => m.id === crewMemberId)?.name ?? 'Crew', date }));
    if (onUpdate) onUpdate();
  }, [crewAssignments, projectId, productionDays, crewMembers, showSuccess, showInfo, onUpdate, logActivity]);

  const handleCrewUnassign = useCallback(async (crewMemberId: string, dayId: string) => {
    const updated = crewAssignments.filter(a => !(a.crewMemberId === crewMemberId && a.shootDayId === dayId));
    setCrewAssignments(updated);
    try {
      await castingService.deleteCrewAssignment(projectId, crewMemberId, dayId);
      showSuccess(t('crew.toast.assignRemoved'), 2000);
    } catch {
      showInfo(t('crew.toast.removedLocal'));
    }
    logActivity('Plan', t('crew.log.removedDayAssign'));
    if (onUpdate) onUpdate();
  }, [crewAssignments, projectId, showSuccess, showInfo, onUpdate, logActivity]);

  // Copy to clipboard
  const handleCopy = async (text: string, fieldId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldId);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      console.error('Failed to copy to clipboard');
    }
  };

  // Sort handler
  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField, sortDirection]);

  const handleSaveCurrentView = useCallback(() => {
    const name = window.prompt(t('crew.prompt.savedViewName'));
    const trimmedName = name?.trim();
    if (!trimmedName) return;

    const nextView: SavedCrewView = {
      id: `view-${Date.now()}`,
      name: trimmedName,
      createdAt: new Date().toISOString(),
      state: captureViewState(),
    };
    setSavedViews((previous) => [nextView, ...previous].slice(0, 12));
    setSavedViewAnchor(null);
    showSuccess(t('crew.toast.savedView', { name: trimmedName }), 2500);
    logActivity('Saved view', t('crew.log.savedView', { name: trimmedName }));
  }, [captureViewState, showSuccess, logActivity]);

  const handleDeleteSavedView = useCallback((id: string) => {
    setSavedViews((previous) => previous.filter((view) => view.id !== id));
    logActivity('Saved view', t('crew.log.deletedSavedView'));
  }, [logActivity]);

  const handleBulkRoleChange = useCallback(async () => {
    if (bulkRole === 'none' || selectedIds.size === 0) return;
    try {
      const selectedMembers = crewMembers.filter((member) => selectedIds.has(member.id));
      await Promise.all(
        selectedMembers.map((member) => castingService.saveCrew(projectId, {
          ...member,
          role: bulkRole,
          updatedAt: new Date().toISOString(),
        }))
      );
      const crew = await castingService.getCrew(projectId);
      setCrewMembers(Array.isArray(crew) ? crew : []);
      showSuccess(t('crew.toast.roleUpdated', { n: selectedMembers.length }), 3000);
      logActivity('Bulk', t('crew.log.setRole', { role: getRoleLabel(bulkRole), n: selectedMembers.length }));
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error updating bulk role:', error);
      showError(t('crew.toast.roleUpdateError'));
    }
  }, [bulkRole, selectedIds, crewMembers, projectId, showSuccess, showError, onUpdate, logActivity]);

  const handleBulkRateUpdate = useCallback(async () => {
    const parsedRate = Number.parseInt(bulkRateInput, 10);
    if (!Number.isFinite(parsedRate) || parsedRate < 0 || selectedIds.size === 0) return;
    try {
      const selectedMembers = crewMembers.filter((member) => selectedIds.has(member.id));
      await Promise.all(
        selectedMembers.map((member) => castingService.saveCrew(projectId, {
          ...member,
          rate: parsedRate,
          updatedAt: new Date().toISOString(),
        }))
      );
      const crew = await castingService.getCrew(projectId);
      setCrewMembers(Array.isArray(crew) ? crew : []);
      showSuccess(t('crew.toast.rateUpdated', { n: selectedMembers.length }), 3000);
      logActivity('Bulk', t('crew.log.setRate', { amount: parsedRate.toLocaleString('nb-NO'), n: selectedMembers.length }));
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error updating bulk rate:', error);
      showError(t('crew.toast.rateUpdateError'));
    }
  }, [bulkRateInput, selectedIds, crewMembers, projectId, showSuccess, showError, onUpdate, logActivity]);

  const assignCrewToDayQuick = useCallback((crewMemberId: string, dayId: string) => {
    const targetDay = productionDays.find((day) => day.id === dayId);
    if (!targetDay) return;
    void handleCrewAssign(crewMemberId, targetDay.id, targetDay.date ?? '', 'assigned', 'A', '08:00');
    logActivity('Planner', t('crew.log.draggedCrew', { date: targetDay.date ?? '' }));
  }, [productionDays, handleCrewAssign, logActivity]);

  // Toggle favorite with database sync
  const toggleFavorite = async (id: string) => {
    const newFavorites = new Set(favorites);
    const isAdding = !newFavorites.has(id);
    if (isAdding) {
      newFavorites.add(id);
    } else {
      newFavorites.delete(id);
    }
    setFavorites(newFavorites);
    if (favoritesLoaded) {
      await settingsService.setSetting(FAVORITES_NAMESPACE, [...newFavorites], { projectId });
    }
    try {
      const { favoritesApi } = await import('../services/castingApiService');
      if (isAdding) {
        await favoritesApi.add(projectId, 'crew', id);
      } else {
        await favoritesApi.remove(projectId, 'crew', id);
      }
      logActivity('Crew', t(isAdding ? 'crew.log.addedFavorite' : 'crew.log.removedFavorite'));
    } catch (error) {
      console.warn('Database sync failed:', error);
    }
  };

  // Toggle expanded card
  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedCards(newExpanded);
  };

  // Get initials for avatar
  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Get avatar color based on role
  const getAvatarColor = (role: CrewRole): string => {
    const colors: Record<CrewRole, string> = {
      director: '#ef4444', // Red for leadership
      producer: '#ef4444', // Red for leadership
      casting_director: '#673ab7',
      production_manager: '#3f51b5',
      cinematographer: '#8b5cf6', // Purple for camera
      camera_operator: '#8b5cf6', // Purple for camera
      camera_assistant: '#a78bfa',
      drone_pilot: '#8b5cf6', // Purple for camera
      video_editor: '#f59e0b', // Orange for post-production
      colorist: '#f59e0b', // Orange for post-production
      gaffer: '#3b82f6', // Blue for lighting
      grip: '#3b82f6', // Blue for grip
      sound_engineer: '#06b6d4', // Cyan for audio
      audio_mixer: '#06b6d4', // Cyan for audio
      vfx_artist: '#f59e0b', // Orange for post-production
      motion_graphics: '#f59e0b', // Orange for post-production
      production_assistant: '#22c55e', // Green for production support
      script_supervisor: '#22c55e', // Green for production support
      location_manager: '#22c55e', // Green for production support
      production_designer: '#22c55e', // Green for production support
      makeup_artist: '#ec4899',
      wardrobe: '#ec4899',
      stylist: '#ec4899',
      collaborator: '#3b82f6',
      other: '#607d8b',
    };
    return colors[role] || '#607d8b';
  };

  // Export to HTML (was CSV)
  const exportToCSV = async () => {
    try {
      const project = await castingService.getProject(projectId);
      if (!project) {
        alert(t('crew.toast.projectNotFound'));
        return;
      }

      const htmlContent = generateCrewHTML(project, filteredAndSortedCrew);

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert(t('crew.toast.exportWindowError'));
        return;
      }

      printWindow.document.write(htmlContent);
      printWindow.document.close();

      setTimeout(() => {
        printWindow.print();
      }, 250);
      logActivity('Export', t('crew.log.exportedList', { n: filteredAndSortedCrew.length }));
    } catch (error) {
      console.error('Error exporting crew:', error);
      alert(t('crew.toast.exportError'));
    }
  };

  type ProjectExportInfo = { id: string; name: string };
  const generateCrewHTML = (project: ProjectExportInfo, crew: CrewMember[]): string => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('nb-NO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const totalCrew = crew.length;
    const crewByRole: Record<string, number> = {};
    crew.forEach(member => {
      crewByRole[member.role] = (crewByRole[member.role] || 0) + 1;
    });

    const crewIconSVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00d4ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>`;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${project.name} - Team</title>
  <style>
    @page { margin: 0; counter-increment: page; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1a1a1a; line-height: 1.7; padding: 0; background: #fff; font-size: 14px; }
    .page { padding: 50px 60px 80px 60px; max-width: 210mm; margin: 0 auto; min-height: 297mm; position: relative; }
    .header { background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-bottom: 5px solid #00d4ff; padding: 30px 35px; margin: -50px -60px 40px -60px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
    .title { font-size: 36px; font-weight: 800; color: #00d4ff; margin-bottom: 10px; letter-spacing: -1px; line-height: 1.2; display: flex; align-items: center; gap: 12px; }
    .title svg { flex-shrink: 0; }
    .subtitle { color: #64748b; font-size: 15px; font-weight: 500; margin-top: 5px; }
    .summary { background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-left: 6px solid #00d4ff; padding: 30px; margin-bottom: 45px; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
    .summary-title { font-size: 20px; font-weight: 700; color: #00d4ff; margin-bottom: 25px; letter-spacing: -0.3px; display: flex; align-items: center; gap: 12px; }
    .summary-title svg { flex-shrink: 0; }
    .summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 25px; }
    .summary-item { background: white; padding: 25px 20px; border-radius: 10px; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
    .summary-number { font-size: 36px; font-weight: 800; color: #00d4ff; display: block; margin-bottom: 8px; line-height: 1; }
    .summary-label { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 600; display: block; }
    .section { margin-bottom: 50px; page-break-inside: avoid; }
    .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 22px; padding-bottom: 15px; border-bottom: 3px solid #e2e8f0; }
    .section-title { font-size: 24px; font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 12px; letter-spacing: -0.4px; }
    .section-icon { display: inline-flex; align-items: center; }
    .section-icon svg { flex-shrink: 0; }
    .section-count { font-size: 13px; font-weight: 600; color: #64748b; background: #f1f5f9; padding: 6px 14px; border-radius: 20px; border: 1px solid #e2e8f0; }
    .section-content { background: #fafbfc; padding: 0; border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
    table { width: 100%; border-collapse: collapse; }
    th { background: linear-gradient(135deg, #00d4ff 0%, #00b8e6 100%); color: white; font-weight: 700; padding: 18px 20px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.8px; border: none; }
    th:first-child { border-top-left-radius: 10px; }
    th:last-child { border-top-right-radius: 10px; }
    td { padding: 16px 20px; border-bottom: 1px solid #e2e8f0; color: #334155; font-size: 14px; font-weight: 400; vertical-align: top; }
    tr:last-child td { border-bottom: none; }
    tr:nth-child(even) { background-color: #f8fafc; }
    .footer { position: fixed; bottom: 0; left: 0; right: 0; padding: 15px 60px; border-top: 2px solid #e2e8f0; background: #fafbfc; display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #64748b; font-weight: 500; }
    .footer-left { display: flex; gap: 20px; }
    .footer-right { display: flex; gap: 20px; }
    .page-number { font-weight: 600; }
    .page-number::after { content: counter(page); }
    .empty-state { padding: 50px; text-align: center; color: #94a3b8; font-style: italic; font-size: 15px; }
    @media print {
      .page { padding: 30px 40px 70px 40px; }
      .section { page-break-inside: avoid; margin-bottom: 35px; }
      .summary { page-break-inside: avoid; }
      .footer { padding: 12px 40px; }
      .header { margin: -30px -40px 35px -40px; padding: 25px 30px; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="title">
        ${crewIconSVG}
        ${project.name} - Team
      </div>
      <div class="subtitle">${t('crew.export.exportedAt', { date: dateStr })}</div>
    </div>
    <div class="summary">
      <div class="summary-title">
        ${crewIconSVG}
        ${t('crew.export.overview')}
      </div>
      <div class="summary-grid">
        <div class="summary-item">
          <span class="summary-number">${totalCrew}</span>
          <span class="summary-label">${t('crew.export.totalMembers')}</span>
        </div>
        <div class="summary-item">
          <span class="summary-number">${Object.keys(crewByRole).length}</span>
          <span class="summary-label">${t('crew.export.differentRoles')}</span>
        </div>
      </div>
    </div>
    <div class="section">
      <div class="section-header">
        <div class="section-title">
          <span class="section-icon">${crewIconSVG}</span>
          Team
        </div>
        <span class="section-count">${t(totalCrew === 1 ? 'crew.export.memberCountOne' : 'crew.export.memberCountMany', { n: totalCrew })}</span>
      </div>
      <div class="section-content">
        ${crew.length === 0
          ? `<div class="empty-state">${t('crew.noTeamMembers')}</div>`
          : `<table>
          <thead>
            <tr>
              <th style="width: 18%;">${t('crew.export.colName')}</th>
              <th style="width: 12%;">${t('crew.export.colRole')}</th>
              <th style="width: 15%;">${t('crew.export.colEmail')}</th>
              <th style="width: 12%;">${t('crew.export.colPhone')}</th>
              <th style="width: 18%;">${t('crew.export.colAddress')}</th>
              <th style="width: 8%;">${t('crew.export.colRate')}</th>
              <th style="width: 12%;">${t('crew.export.colAvail')}</th>
              <th style="width: 5%;">${t('crew.export.colNotes')}</th>
            </tr>
          </thead>
          <tbody>
            ${crew.map((member) => {
              const availability = member.availability?.startDate && member.availability?.endDate 
                ? `${new Date(member.availability.startDate).toLocaleDateString('nb-NO')} - ${new Date(member.availability.endDate).toLocaleDateString('nb-NO')}` 
                : member.availability?.startDate 
                  ? t('crew.export.availFrom', { date: new Date(member.availability.startDate).toLocaleDateString('nb-NO') }) 
                  : '-';
              const notes = member.notes || '-';
              return `<tr>
              <td><strong>${member.name}</strong></td>
              <td>${getRoleLabel(member.role)}</td>
              <td style="font-size: 13px;">${member.contactInfo?.email || '-'}</td>
              <td style="font-size: 13px;">${member.contactInfo?.phone || '-'}</td>
              <td style="font-size: 13px;">${member.contactInfo?.address || '-'}</td>
              <td style="text-align: center;">${member.rate ? `${member.rate} kr` : '-'}</td>
              <td style="font-size: 13px;">${availability}</td>
              <td style="font-size: 13px;">${notes.length > 50 ? notes.substring(0, 50) + '...' : notes}</td>
            </tr>`;
            }).join('')}
          </tbody>
        </table>`
        }
      </div>
    </div>
    <div class="footer">
      <div class="footer-left">
        <span>${project.name}</span>
        <span>|</span>
        <span>ID: ${project.id.substring(0, 8)}</span>
      </div>
      <div class="footer-right">
        <span class="page-number">${t('crew.export.page')}</span>
        <span>|</span>
        <span>${dateStr}</span>
      </div>
    </div>
  </div>
</body>
</html>`;
  };

  // Duplicate crew member
  const handleDuplicate = async (member: CrewMember) => {
    try {
      const duplicate: CrewMember = {
        ...member,
        id: `crew-${Date.now()}`,
        name: `${member.name} (kopi)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await castingService.saveCrew(projectId, duplicate);
      const crew = await castingService.getCrew(projectId);
      setCrewMembers(Array.isArray(crew) ? crew : []);
      logActivity('Crew', t('crew.log.duplicated', { name: member.name }));
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error duplicating crew member:', error);
      showError(t('crew.toast.duplicateError'));
    }
  };

  // Delete with undo support
  const handleDeleteWithUndo = async (crewId: string) => {
    const member = crewMembers.find(m => m.id === crewId);
    if (!member) return;

    try {
      setDeletedCrew(member);
      await castingService.deleteCrew(projectId, crewId);
      const crew = await castingService.getCrew(projectId);
      setCrewMembers(Array.isArray(crew) ? crew : []);
      setShowUndoSnackbar(true);
      showInfo(t('crew.toast.deletedUndo', { name: member.name }), 6000);
      logActivity('Crew', t('crew.log.deleted', { name: member.name }));
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error deleting crew member:', error);
      showError(t('crew.toast.deleteError'));
    }
  };

  // Undo delete
  const handleUndoDelete = async () => {
    if (deletedCrew) {
      try {
        await castingService.saveCrew(projectId, deletedCrew);
        const crew = await castingService.getCrew(projectId);
        setCrewMembers(Array.isArray(crew) ? crew : []);
        showSuccess(t('crew.toast.restored', { name: deletedCrew.name }), 3000);
        logActivity('Crew', t('crew.log.restored', { name: deletedCrew.name }));
        setDeletedCrew(null);
        setShowUndoSnackbar(false);
        if (onUpdate) onUpdate();
      } catch (error) {
        console.error('Error undoing delete:', error);
        showError(t('crew.toast.restoreError'));
      }
    }
  };

  // Calculate cost for date range
  const calculateCost = useMemo(() => {
    if (!costStartDate || !costEndDate) return null;
    const start = new Date(costStartDate);
    const end = new Date(costEndDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    if (days <= 0) return null;

    const selectedCrewForCost = selectedIds.size > 0
      ? crewMembers.filter(m => selectedIds.has(m.id))
      : crewMembers;

    const totalDailyRate = selectedCrewForCost.reduce((sum, m) => sum + (m.rate || 0), 0);
    return {
      days,
      dailyRate: totalDailyRate,
      total: days * totalDailyRate,
      crewCount: selectedCrewForCost.length,
    };
  }, [costStartDate, costEndDate, crewMembers, selectedIds]);

  const costCalculatorIntelligence = useMemo(() => {
    if (!calculateCost) return null;

    const periodBudget = effectiveBudget > 0 ? effectiveBudget * calculateCost.days : null;
    const projectedTotal = calculateCost.total;
    const assignedProjection = budgetIntelligence.assignedDailyCost * calculateCost.days;
    const utilization = periodBudget && periodBudget > 0 ? projectedTotal / periodBudget : null;
    const assignedUtilization = periodBudget && periodBudget > 0 ? assignedProjection / periodBudget : null;
    const budgetDelta = periodBudget !== null ? projectedTotal - periodBudget : null;

    let severity: 'low' | 'medium' | 'high' = 'low';
    if (utilization !== null) {
      if (utilization > 1) severity = 'high';
      else if (utilization > 0.85) severity = 'medium';
    }

    const recommendations: string[] = [];
    if (periodBudget === null) {
      recommendations.push(t('crew.calc.enterBudget'));
    } else if (budgetDelta !== null && budgetDelta > 0) {
      recommendations.push(t('crew.calc.overBudget', { amount: budgetDelta.toLocaleString('nb-NO') }));
    } else if (budgetDelta !== null && budgetDelta < 0) {
      recommendations.push(t('crew.calc.underBudget', { amount: (Math.abs(budgetDelta)).toLocaleString('nb-NO') }));
    }

    if (selectedIds.size > 0) {
      recommendations.push(t('crew.calc.filteredSelection'));
    }
    if (riskInsights.overtimeRisk.length > 0) {
      recommendations.push(t('crew.calc.overtimeRisk'));
    }
    if (recommendations.length === 0) {
      recommendations.push(t('crew.calc.withinBudget'));
    }

    return {
      periodBudget,
      projectedTotal,
      assignedProjection,
      utilization,
      assignedUtilization,
      budgetDelta,
      severity,
      recommendations,
    };
  }, [budgetIntelligence.assignedDailyCost, calculateCost, effectiveBudget, riskInsights.overtimeRisk.length, selectedIds.size, t]);

  // Keyboard shortcuts
  const handleOpenDialog = useCallback((crewMember?: CrewMember) => {
    if (crewMember) {
      // Rediger den PERSISTERTE raden, ikke den kalender-berikede visningen —
      // ellers ville synket tilgjengelighet lekket inn i lagret data. Virtuelle
      // «lagt til i prosjekt»-rader finnes ikke i crewMembers og materialiseres
      // (med sin kalender-snapshot) ved første lagring.
      const original = crewMembers.find((m) => m.id === crewMember.id) ?? crewMember;
      setEditingCrewMember(original);
      setFormData(original);
    } else {
      setEditingCrewMember(null);
      // Set profession-specific default role
      const defaultRole: CrewRole = profession === 'photographer' 
        ? 'camera_operator' 
        : profession === 'videographer' 
        ? 'director' 
        : 'other';
      setFormData({
        name: '',
        role: defaultRole,
        contactInfo: {},
        availability: {},
        assignedScenes: [],
        notes: '',
      });
    }
    setDialogOpen(true);
  }, [profession, crewMembers]);

  useEffect(() => {
    if (!externalCreateSignal || externalCreateSignal === externalCreateSignalRef.current) {
      return;
    }
    externalCreateSignalRef.current = externalCreateSignal;
    externalCreatePendingRef.current = true;
    handleOpenDialog();
  }, [externalCreateSignal, handleOpenDialog]);

  const handleCloseDialog = useCallback(() => {
    if (externalCreatePendingRef.current) {
      externalCreatePendingRef.current = false;
      onExternalCreateCancelled?.();
    }
    setDialogOpen(false);
    setEditingCrewMember(null);
    setFormData({
      name: '',
      role: 'other',
      contactInfo: {},
      availability: {},
      assignedScenes: [],
      notes: '',
    });
  }, [onExternalCreateCancelled]);

  const commandActions = useMemo(() => {
    return [
      { id: 'new', label: t('crew.btn.newMember'), shortcut: 'Cmd/Ctrl+N', run: () => handleOpenDialog() },
      { id: 'search', label: t('crew.cmd.focusSearch'), shortcut: 'Cmd/Ctrl+F', run: () => searchInputRef.current?.focus() },
      { id: 'export', label: t('crew.cmd.exportList'), shortcut: 'Cmd/Ctrl+E', run: () => exportToCSV() },
      { id: 'toggle-view', label: workspaceView === 'pro' ? t('crew.cmd.switchStandard') : t('crew.cmd.switchPro'), shortcut: '', run: () => setWorkspaceView(workspaceView === 'pro' ? 'standard' : 'pro') },
      ...(workspaceView === 'pro'
        ? [
            { id: 'focus-all', label: proViewFocus === 'all' ? t('crew.cmd.focusAll') + t('crew.cmd.active') : t('crew.cmd.focusAll'), shortcut: '', run: () => setProViewFocus('all') },
            { id: 'focus-overview', label: proViewFocus === 'overview' ? t('crew.cmd.focusOverview') + t('crew.cmd.active') : t('crew.cmd.focusOverview'), shortcut: '', run: () => setProViewFocus('overview') },
            { id: 'focus-risks', label: proViewFocus === 'risks' ? t('crew.cmd.focusRisks') + t('crew.cmd.active') : t('crew.cmd.focusRisks'), shortcut: '', run: () => setProViewFocus('risks') },
            { id: 'focus-budget', label: proViewFocus === 'budget' ? t('crew.cmd.focusBudget') + t('crew.cmd.active') : t('crew.cmd.focusBudget'), shortcut: '', run: () => setProViewFocus('budget') },
            { id: 'focus-planner', label: proViewFocus === 'planner' ? t('crew.cmd.focusPlanner') + t('crew.cmd.active') : t('crew.cmd.focusPlanner'), shortcut: '', run: () => setProViewFocus('planner') },
          ]
        : []),
      { id: 'toggle-density', label: compactMode ? t('crew.cmd.compactOff') : t('crew.cmd.compactOn'), shortcut: '', run: () => setCompactMode((previous) => !previous) },
      { id: 'open-dood', label: t('crew.cmd.openDood'), shortcut: '', run: () => setDoodOpen(true) },
      { id: 'open-callsheet', label: t('crew.cmd.openCallsheet'), shortcut: '', run: () => { setCallsheetCrewScope('all'); setCallsheetDay(productionDays[0] ?? null); setCallsheetOpen(true); } },
      { id: 'open-technical-callsheet', label: t('crew.tt.dailyTechCallsheet'), shortcut: '', run: () => { setCallsheetCrewScope('technical'); setCallsheetDay(productionDays[0] ?? null); setCallsheetOpen(true); } },
      { id: 'clear-filters', label: t('crew.cmd.resetFilters'), shortcut: '', run: () => { setFilterStatus('all'); setFilterAvailable(false); setFilterAssignedToday(false); setFilterDept('all'); setFilterRole('all'); setSearchQuery(''); } },
      { id: 'open-invite', label: t('crew.invite.title'), shortcut: 'F', run: () => setInviteDialogOpen(true) },
      { id: 'open-log', label: t('crew.cmd.openLog'), shortcut: '', run: () => setActivityOpen(true) },
      ...(onOpenTechnicalTeamDashboard
        ? [{ id: 'open-technical-dashboard', label: t('crew.cmd.openTechDashboard'), shortcut: 'Shift+T', run: () => onOpenTechnicalTeamDashboard() }]
        : []),
    ];
  }, [handleOpenDialog, exportToCSV, workspaceView, proViewFocus, compactMode, productionDays, onOpenTechnicalTeamDashboard, t]);

  const filteredCommandActions = useMemo(() => {
    const query = commandQuery.trim().toLowerCase();
    if (!query) return commandActions;
    return commandActions.filter((action) => action.label.toLowerCase().includes(query));
  }, [commandActions, commandQuery]);

  const runCommandAction = useCallback((action: { id: string; label: string; run: () => void }) => {
    action.run();
    setCommandPaletteOpen(false);
    setCommandQuery('');
    logActivity('Command', action.label);
  }, [logActivity]);

  useEffect(() => {
    if (!commandPaletteOpen) return;
    const handle = window.setTimeout(() => {
      commandInputRef.current?.focus();
    }, 20);
    return () => window.clearTimeout(handle);
  }, [commandPaletteOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+N or Cmd+N to add new crew
      if ((e.ctrlKey || e.metaKey) && e.key === 'n' && !dialogOpen) {
        e.preventDefault();
        handleOpenDialog();
      }
      // Escape to close dialog
      if (e.key === 'Escape' && dialogOpen) {
        handleCloseDialog();
      }
      if (e.key === 'Escape' && commandPaletteOpen) {
        setCommandPaletteOpen(false);
      }
      // Ctrl+E to export
      if ((e.ctrlKey || e.metaKey) && e.key === 'e' && !dialogOpen) {
        e.preventDefault();
        exportToCSV();
      }
      // Ctrl+F to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f' && !dialogOpen) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // Cmd/Ctrl+K to open command palette
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && !dialogOpen) {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
      // F (no modifier) to open invite dialog
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isTyping = tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target as HTMLElement)?.isContentEditable;
      if (e.key === 'f' && !e.ctrlKey && !e.metaKey && !e.altKey && !isTyping && !dialogOpen && !inviteDialogOpen) {
        e.preventDefault();
        setInviteDialogOpen(true);
      }
      // Shift+T opens technical Team Dashboard from Crew tab
      if (e.key.toLowerCase() === 't' && e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && !isTyping && !dialogOpen && onOpenTechnicalTeamDashboard) {
        e.preventDefault();
        onOpenTechnicalTeamDashboard();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dialogOpen, inviteDialogOpen, handleOpenDialog, handleCloseDialog, exportToCSV, commandPaletteOpen, onOpenTechnicalTeamDashboard]);

  const handleSave = async () => {
    if (!formData.name?.trim()) {
      showError(t('crew.toast.nameRequired'));
      return;
    }

    try {
      const isCreating = !editingCrewMember;
      const nowIso = new Date().toISOString();
      const notesText = typeof formData.notes === 'string' ? formData.notes.trim() : '';
      const splitSheetDraft =
        formData.splitSheet && typeof formData.splitSheet === 'object'
          ? { ...(formData.splitSheet as Record<string, unknown>) }
          : undefined;
      const splitNotesText =
        splitSheetDraft && typeof splitSheetDraft.notes === 'string'
          ? splitSheetDraft.notes.trim()
          : '';

      if (splitSheetDraft && splitNotesText) {
        splitSheetDraft.notesAuthorName = noteActorLabel;
        splitSheetDraft.notesAuthorId = noteActorId;
        splitSheetDraft.notesUpdatedAt = nowIso;
      }

      const crewMember: CrewMember = editingCrewMember
        ? {
            ...editingCrewMember,
            ...formData,
            splitSheet: splitSheetDraft ?? formData.splitSheet,
            ...(notesText
              ? {
                  notesAuthorName: noteActorLabel,
                  notesAuthorId: noteActorId,
                  notesUpdatedAt: nowIso,
                }
              : {}),
            updatedAt: nowIso,
          }
        : {
            id: `crew-${Date.now()}`,
            name: formData.name || '',
            role: formData.role || 'other',
            contactInfo: formData.contactInfo || {},
            availability: formData.availability || {},
            assignedScenes: formData.assignedScenes || [],
            rate: formData.rate,
            notes: formData.notes,
            splitSheet: splitSheetDraft,
            ...(notesText
              ? {
                  notesAuthorName: noteActorLabel,
                  notesAuthorId: noteActorId,
                  notesUpdatedAt: nowIso,
                }
              : {}),
            createdAt: nowIso,
            updatedAt: nowIso,
          };

      await castingService.saveCrew(projectId, crewMember);
      void globalTagService
        .add([
          formData.name || '',
          ...(typeof formData.notes === 'string' ? globalTagService.parseExplicitMentions(formData.notes) : []),
          ...(typeof formData.splitSheet?.notes === 'string' ? globalTagService.parseExplicitMentions(formData.splitSheet.notes) : []),
        ])
        .catch((error) => {
          console.warn('Could not update global tag registry from crew notes:', error);
        });
      const crew = await castingService.getCrew(projectId);
      setCrewMembers(Array.isArray(crew) ? crew : []);

      // Show success notification
      if (editingCrewMember) {
        showSuccess(t('crew.toast.memberUpdated', { name: formData.name }), 3000);
        logActivity('Crew', t('crew.log.updated', { name: formData.name }));
      } else {
        showSuccess(t('crew.toast.memberAddedTeam', { name: formData.name }), 3000);
        logActivity('Crew', t('crew.log.added', { name: formData.name }));
      }

      if (isCreating) {
        externalCreatePendingRef.current = false;
        onExternalCreated?.(crewMember);
      }

      handleCloseDialog();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error saving crew member:', error);
      showError(t('crew.toast.saveError'));
    }
  };

  const showProOverview = proViewFocus === 'all' || proViewFocus === 'overview';
  const showProRisks = proViewFocus === 'all' || proViewFocus === 'risks';
  const showProBudget = proViewFocus === 'all' || proViewFocus === 'budget';
  const showProPlanner = proViewFocus === 'all' || proViewFocus === 'planner';

  const handleProActionClick = useCallback((action: ProActionItem) => {
    setProViewFocus(action.focus);
    if (action.id === 'review-budget') {
      setShowCostCalculator(true);
    }
    if (action.id === 'resolve-conflicts') {
      setFilterAssignedToday(true);
    }
    if (action.id === 'maintain-plan') {
      setFilterAssignedToday(false);
    }
  }, []);

  return (
    <Box
      ref={panelRef}
      component="section"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        bgcolor: 'transparent',
        backgroundImage: `linear-gradient(180deg, rgba(10, 6, 26, 0.9) 0%, rgba(10, 6, 26, 0.94) 100%), ${rolePanelBackdrop}`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <OfflineBanner pending={offlinePending} />

      {/* ── HEADER ── */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          px: 2,
          pt: 1.5,
          pb: 1,
          gap: 1,
          flexWrap: 'wrap',
          border: `1px solid ${roleBorder}`,
          borderRadius: 2,
          mx: 2,
          mb: 1,
          bgcolor: roleSurface,
          backdropFilter: 'blur(8px)',
          boxShadow: '0 16px 40px rgba(0,0,0,0.35)',
        }}
      >
        {/* Title */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 44, height: 44, borderRadius: 2, background: `linear-gradient(135deg,${roleTabAccentSoft},rgba(184,107,255,0.08))`, border: `2px solid ${roleBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <GroupsIcon sx={{ color: roleTabAccent, fontSize: 26 }} />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ color: roleText, fontWeight: 800, fontSize: { xs: '1.1rem', sm: '1.4rem' } }}>{t('crew.header.title')}</Typography>
            <Typography sx={{ color: roleTextMuted, fontSize: 12 }}>
              <BadgeIcon sx={{ fontSize: 13, verticalAlign: 'middle', mr: 0.5, color: 'rgba(220,205,255,0.6)' }} />
              {t('crew.header.totalAvailable', { total: crewMembers.length, available: stats.availableNow })}
              {stats.assignedToday > 0 && t('crew.header.assignedToday', { n: stats.assignedToday })}
              {stats.totalConflicts > 0 && (
                <Typography component="span" sx={{ color: '#ef4444', fontSize: 12, ml: 0.5 }}>
                  · <WarningAmberIcon sx={{ fontSize: 11, verticalAlign: 'middle', mr: 0.25 }} />
                  {t(stats.totalConflicts === 1 ? 'crew.header.conflictOne' : 'crew.header.conflictMany', { n: stats.totalConflicts })}
                </Typography>
              )}
              {filteredAndSortedCrew.length < crewMembers.length && t('crew.header.shown', { n: filteredAndSortedCrew.length })}
            </Typography>
          </Box>
        </Box>

        {/* Header actions */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            size="small"
            onClick={() => setWhatsAppGroupDialogOpen(true)}
            startIcon={<WhatsAppIcon sx={{ color: '#22c55e' }} />}
            sx={{
              minHeight: 34,
              color: '#86efac',
              borderColor: 'rgba(34,197,94,0.4)',
              bgcolor: 'rgba(34,197,94,0.06)',
              '&:hover': { bgcolor: 'rgba(34,197,94,0.12)', borderColor: '#22c55e' },
            }}
          >
            {t('crew.btn.whatsappGroup')}
          </Button>
          <Button
            variant={workspaceView === 'standard' ? 'contained' : 'outlined'}
            size="small"
            onClick={() => setWorkspaceView('standard')}
            sx={{
              minHeight: 34,
              bgcolor: workspaceView === 'standard' ? roleTabAccentSoft : 'transparent',
              color: '#ffffff',
              borderColor: workspaceView === 'standard' ? roleTabAccent : roleBorder,
              '&:hover': { bgcolor: workspaceView === 'standard' ? 'rgba(184,107,255,0.28)' : 'rgba(255,255,255,0.06)' },
            }}
          >
            Standard
          </Button>
          <Button
            variant={workspaceView === 'pro' ? 'contained' : 'outlined'}
            size="small"
            onClick={() => setWorkspaceView('pro')}
            sx={{
              minHeight: 34,
              bgcolor: workspaceView === 'pro' ? roleTabAccentSoft : 'transparent',
              color: '#ffffff',
              borderColor: workspaceView === 'pro' ? roleTabAccent : roleBorder,
              '&:hover': { bgcolor: workspaceView === 'pro' ? 'rgba(184,107,255,0.28)' : 'rgba(255,255,255,0.06)' },
            }}
          >
            Pro view
          </Button>
          <Button
            variant={compactMode ? 'contained' : 'outlined'}
            size="small"
            onClick={() => setCompactMode((previous) => !previous)}
            sx={{
              minHeight: 34,
              bgcolor: compactMode ? roleTabAccentSoft : 'transparent',
              color: '#ffffff',
              borderColor: compactMode ? roleTabAccent : roleBorder,
              '&:hover': { bgcolor: compactMode ? 'rgba(184,107,255,0.28)' : 'rgba(255,255,255,0.06)' },
            }}
          >
            {t('crew.btn.compact')}
          </Button>
          <Button
            variant={pinNameColumn ? 'contained' : 'outlined'}
            size="small"
            onClick={() => setPinNameColumn((previous) => !previous)}
            sx={{ minHeight: 34, bgcolor: pinNameColumn ? roleTabAccentSoft : 'transparent', color: '#fff', borderColor: roleBorder }}
          >
            {t('crew.btn.pinName')}
          </Button>
          <Button
            variant={pinContactColumn ? 'contained' : 'outlined'}
            size="small"
            onClick={() => setPinContactColumn((previous) => !previous)}
            sx={{ minHeight: 34, bgcolor: pinContactColumn ? roleTabAccentSoft : 'transparent', color: '#fff', borderColor: roleBorder }}
          >
            {t('crew.btn.pinContact')}
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={(event) => setSavedViewAnchor(event.currentTarget)}
            sx={{ minHeight: 34, borderColor: roleBorder, color: '#ffffff', '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' } }}
          >
            Saved views ({savedViews.length})
          </Button>
          <Menu
            anchorEl={savedViewAnchor}
            open={Boolean(savedViewAnchor)}
            onClose={() => setSavedViewAnchor(null)}
            PaperProps={{ sx: { bgcolor: '#1c2128', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', minWidth: 280 } }}
          >
            <MenuItem onClick={handleSaveCurrentView} sx={{ fontWeight: 700 }}>
              <SaveIcon sx={{ fontSize: 16, mr: 1 }} />
              {t('crew.menu.saveCurrentView')}
            </MenuItem>
            {savedViews.length === 0 && (
              <MenuItem disabled sx={{ opacity: 0.7 }}>{t('crew.menu.noSavedViews')}</MenuItem>
            )}
            {savedViews.map((view) => (
              <MenuItem
                key={view.id}
                sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}
              >
                <Button
                  onClick={() => applySavedView(view)}
                  sx={{ color: '#ffffff', textTransform: 'none', justifyContent: 'flex-start', flex: 1, px: 0 }}
                >
                  {view.name}
                </Button>
                <IconButton
                  size="small"
                  onClick={() => handleDeleteSavedView(view.id)}
                  sx={{ color: 'rgba(255,255,255,0.55)' }}
                  aria-label={t('crew.aria.deleteSavedView', { name: view.name })}
                >
                  <DeleteIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </MenuItem>
            ))}
          </Menu>
          <Tooltip title={t('crew.tt.showHideDepts')}>
            <IconButton onClick={() => setShowDeptSidebar(p => !p)} sx={{ color: '#ffffff', ...focusVisibleStyles }}>
              {showDeptSidebar ? <ChevronLeftIcon /> : <ChevronRightIcon />}
            </IconButton>
          </Tooltip>
          <Tooltip title={showStats ? t('crew.tt.hideStats') : t('crew.tt.showStats')}>
            <IconButton onClick={() => setShowStats(p => !p)} sx={{ color: '#ffffff', ...focusVisibleStyles }}>
              {showStats ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Tooltip>
          <Tooltip title={t('crew.tt.exportCtrlE')}>
            <IconButton onClick={exportToCSV} sx={{ color: 'rgba(255,255,255,0.7)', ...focusVisibleStyles }}>
              <DownloadIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Days Out Of Days (DOOD)">
            <Badge badgeContent={productionDays.length > 0 ? crewAssignments.length : 0} color="primary" max={99}
              sx={{ '& .MuiBadge-badge': { fontSize: 10, minWidth: 16, height: 16 } }}>
              <IconButton onClick={() => setDoodOpen(true)} sx={{ color: '#ffffff', ...focusVisibleStyles }}>
                <DoodIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Badge>
          </Tooltip>
          <Tooltip title="Callsheet-generator">
            <IconButton
              onClick={() => { setCallsheetCrewScope('all'); setCallsheetDay(productionDays[0] ?? null); setCallsheetOpen(true); }}
              sx={{ color: '#ffffff', ...focusVisibleStyles }}
            >
              <CallsheetIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('crew.tt.dailyTechCallsheet')}>
            <IconButton
              onClick={() => { setCallsheetCrewScope('technical'); setCallsheetDay(productionDays[0] ?? null); setCallsheetOpen(true); }}
              sx={{ color: '#38bdf8', ...focusVisibleStyles }}
            >
              <MovieIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Tooltip>
          {onOpenTechnicalTeamDashboard && (
            <Tooltip title={t('crew.tt.openTechDashboard')}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<MovieIcon />}
                onClick={onOpenTechnicalTeamDashboard}
                sx={{
                  minHeight: 34,
                  borderColor: roleBorder,
                  color: '#ffffff',
                  '&:hover': { bgcolor: roleTabAccentSoft, borderColor: roleTabAccent },
                }}
              >
                {t('crew.btn.techDashboard')}
              </Button>
            </Tooltip>
          )}
          <Tooltip title={t('crew.tt.help')}>
            <IconButton onClick={() => setGuideOpen(true)} sx={{ color: '#ffffff', '&:hover': { color: '#ffffff' }, ...focusVisibleStyles }} aria-label="Open Crew Management guide">
              <HelpIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('crew.tt.costCalculator')}>
            <IconButton onClick={() => setShowCostCalculator(p => !p)} sx={{ color: '#ffffff', ...focusVisibleStyles }}>
              <CalculateIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Command palette (Cmd/Ctrl+K)">
            <IconButton onClick={() => setCommandPaletteOpen(true)} sx={{ color: '#ffffff', ...focusVisibleStyles }}>
              <SearchIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('crew.tt.activityLog')}>
            <Badge badgeContent={activityLog.length > 99 ? '99+' : activityLog.length} color="primary" max={99}>
              <IconButton onClick={() => setActivityOpen(true)} sx={{ color: '#ffffff', ...focusVisibleStyles }}>
                <ScheduleIcon />
              </IconButton>
            </Badge>
          </Tooltip>
          <ToggleButtonGroup value={viewMode} exclusive onChange={(_, v) => v && setViewMode(v)} size="small">
            <ToggleButton value="grid" sx={{ color: '#ffffff', borderColor: roleBorder, '&.Mui-selected': { color: '#ffffff', bgcolor: roleTabAccentSoft } }}>
              <ViewModuleIcon sx={{ fontSize: 18 }} />
            </ToggleButton>
            <ToggleButton value="table" sx={{ color: '#ffffff', borderColor: roleBorder, '&.Mui-selected': { color: '#ffffff', bgcolor: roleTabAccentSoft } }}>
              <ViewListIcon sx={{ fontSize: 18 }} />
            </ToggleButton>
          </ToggleButtonGroup>
          <Button variant="outlined" startIcon={<PersonAddIcon />} onClick={() => setInviteDialogOpen(true)}
            sx={{ borderColor: roleBorder, color: '#ffffff', fontWeight: 700, '&:hover': { bgcolor: roleTabAccentSoft, borderColor: roleTabAccent } }}>
            {t('crew.btn.inviteF')}
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}
            sx={{ bgcolor: roleTabAccent, color: '#ffffff', fontWeight: 800, '&:hover': { bgcolor: roleTabAccentHover } }}>
            {isMobile ? t('crew.btn.newShort') : t('crew.btn.newMember')}
          </Button>
        </Box>
      </Box>

      {roleLegendEntries.length > 0 && (
        <Box sx={{ px: 2, pb: 1, mx: 2, display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
          {roleLegendEntries.map((role) => {
            const color = getSharedRoleColor(role);
            return (
              <Chip
                key={role}
                size="small"
                label={getSharedRoleLabel(role)}
                sx={{
                  bgcolor: `${color}24`,
                  color,
                  border: `1px solid ${color}66`,
                  '& .MuiChip-label': { fontWeight: 600 },
                }}
              />
            );
          })}
        </Box>
      )}

      {/* ── SEARCH + FILTER TOOLBAR ── */}
      <Box sx={{ px: 2, pb: 1, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', border: `1px solid ${roleBorder}`, borderRadius: 2, mx: 2, py: 1, bgcolor: roleSurfaceMuted }}>
        <TextField
          inputRef={searchInputRef}
          size="small"
          placeholder={t('crew.search.placeholder')}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 18 }} /></InputAdornment> } }}
          sx={{ flex: 1, minWidth: 200, '& .MuiOutlinedInput-root': { color: roleText, bgcolor: 'rgba(255,255,255,0.05)', '& fieldset': { borderColor: roleBorder }, '&:hover fieldset': { borderColor: roleTabAccentSoft }, '&.Mui-focused fieldset': { borderColor: roleTabAccent } } }}
        />
        {/* Status filter chips */}
        {(['all', 'confirmed', 'pending', 'invited', 'unavailable'] as const).map(s => {
          const meta = s === 'all' ? null : STATUS_META[s];
          const active = filterStatus === s;
          return (
            <Chip
              key={s}
              label={s === 'all' ? t('crew.all') : t(STATUS_LABEL_KEY[s as CrewStatus])}
              size="small"
              onClick={() => setFilterStatus(s as CrewStatus | 'all')}
              sx={{ fontWeight: active ? 700 : 500, bgcolor: active ? (meta?.bg ?? roleTabAccentSoft) : 'rgba(255,255,255,0.06)', color: '#ffffff', border: `1px solid ${active ? (meta?.color ?? roleTabAccent) + '55' : 'rgba(255,255,255,0.24)'}`, cursor: 'pointer' }}
            />
          );
        })}
        <Tooltip title={t('crew.tt.filterAvailability')}>
          <Chip
            label={t('crew.chip.availableNow')}
            size="small"
            onClick={() => setFilterAvailable(p => !p)}
            sx={{ bgcolor: filterAvailable ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.06)', color: filterAvailable ? '#10b981' : 'rgba(255,255,255,0.6)', border: `1px solid ${filterAvailable ? '#10b98155' : 'rgba(255,255,255,0.1)'}`, cursor: 'pointer', fontWeight: filterAvailable ? 700 : 400 }}
          />
        </Tooltip>
        {productionDays.length > 0 && (
          <Tooltip title={t('crew.tt.showAssignedTodayOnly')}>
            <Chip
              label={t('crew.chip.assignedTodayStatic')}
              size="small"
              onClick={() => setFilterAssignedToday(p => !p)}
              sx={{ bgcolor: filterAssignedToday ? roleTabAccentSoft : 'rgba(255,255,255,0.06)', color: '#ffffff', border: `1px solid ${filterAssignedToday ? `${roleTabAccent}55` : 'rgba(255,255,255,0.24)'}`, cursor: 'pointer', fontWeight: filterAssignedToday ? 700 : 500 }}
            />
          </Tooltip>
        )}
        {(filterStatus !== 'all' || filterAvailable || filterAssignedToday || filterDept !== 'all' || filterRole !== 'all' || searchQuery) && (
          <Chip
            label={t('crew.chip.reset')}
            size="small"
            onDelete={() => { setFilterStatus('all'); setFilterAvailable(false); setFilterAssignedToday(false); setFilterDept('all'); setFilterRole('all'); setSearchQuery(''); }}
            sx={{ bgcolor: 'rgba(147,51,234,0.15)', color: '#9333ea', border: '1px solid rgba(147,51,234,0.3)' }}
          />
        )}
        {/* Filter panel toggle */}
        {(() => {
          const activeFilterCount = [filterRole !== 'all', filterDept !== 'all', filterStatus !== 'all', filterAvailable, filterAssignedToday].filter(Boolean).length;
          return (
            <Tooltip title={showFilters ? t('crew.tt.hideRoleFilter') : t('crew.tt.showRoleFilter')}>
              <Badge badgeContent={activeFilterCount} color="primary" overlap="circular" sx={{ '& .MuiBadge-badge': { fontSize: 10, minWidth: 16, height: 16 } }}>
                <IconButton
                  onClick={() => setShowFilters(p => !p)}
                  sx={{ color: showFilters ? roleTabAccent : roleTextMuted, ...focusVisibleStyles }}
                  aria-label={t('crew.aria.showHideRoleFilter')}
                >
                  <FilterListIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </Badge>
            </Tooltip>
          );
        })()}
      </Box>

      {/* ── ACTIVE FILTER CHIPS ── */}
      {(filterAssignedToday || filterDept !== 'all' || filterStatus !== 'all' || filterRole !== 'all') && (
        <Box sx={{ px: 2, pb: 0.75, pt: 0.25, mx: 2, display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
          {filterAssignedToday && (
            <Chip
              label={t('crew.chip.assignedToday', { n: stats.assignedToday })}
              size="small"
              onDelete={() => setFilterAssignedToday(false)}
              sx={{ bgcolor: 'rgba(147,51,234,0.2)', color: '#ffb800', border: '1px solid rgba(147,51,234,0.4)', fontWeight: 700, fontSize: 12 }}
            />
          )}
          {filterDept !== 'all' && (
            <Chip
              label={t('crew.chip.dept', { dept: t(DEPT_LABEL_KEY[filterDept]) })}
              size="small"
              onDelete={() => setFilterDept('all')}
              sx={{ bgcolor: `${DEPT_COLORS[filterDept]}22`, color: DEPT_COLORS[filterDept], border: `1px solid ${DEPT_COLORS[filterDept]}44`, fontWeight: 600, fontSize: 12 }}
            />
          )}
          {filterStatus !== 'all' && (
            <Chip
              label={t(STATUS_LABEL_KEY[filterStatus as CrewStatus])}
              size="small"
              onDelete={() => setFilterStatus('all')}
              sx={{ bgcolor: STATUS_META[filterStatus as CrewStatus].bg, color: STATUS_META[filterStatus as CrewStatus].color, border: `1px solid ${STATUS_META[filterStatus as CrewStatus].color}55`, fontWeight: 600, fontSize: 12 }}
            />
          )}
          {filterRole !== 'all' && (
            <Chip
              label={getRoleLabel(filterRole as CrewRole)}
              size="small"
              onDelete={() => setFilterRole('all')}
              sx={{ bgcolor: roleTabAccentSoft, color: '#ffffff', border: `1px solid ${roleBorder}`, fontWeight: 700, fontSize: 12 }}
            />
          )}
        </Box>
      )}

      {/* ── ROLE FILTER PANEL ── */}
      <Collapse in={showFilters}>
        <Box sx={{ px: 2, pb: 1, mx: 2 }}>
          <Accordion
            disableGutters
            sx={{ bgcolor: 'rgba(255,255,255,0.03)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 1, '&:before': { display: 'none' } }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: 'rgba(255,255,255,0.7)' }} />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PeopleIcon sx={{ fontSize: 16, color: '#ffffff' }} />
                <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>{t('crew.filter.roleFilter')}</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0, pb: 1.5 }}>
              <FormControl size="small" fullWidth>
                <InputLabel sx={{ color: 'rgba(255,255,255,0.6)' }}>{t('crew.filter.byRole')}</InputLabel>
                <Select
                  value={filterRole}
                  onChange={e => setFilterRole(e.target.value as CrewRole | 'all')}
                  label={t('crew.filter.byRole')}
                  sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' }, '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.7)' } }}
                >
                  <MenuItem value="all">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PeopleIcon sx={{ fontSize: 18, color: '#ffffff' }} />{t('crew.filter.allRoles')}</Box>
                  </MenuItem>
                  {crewRoles.map(role => (
                    <MenuItem key={role} value={role}>{getRoleLabel(role)}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </AccordionDetails>
          </Accordion>
        </Box>
      </Collapse>

      {/* ── COST CALCULATOR ── */}
      <Collapse in={showCostCalculator}>
        <Box sx={{ mx: 2, mb: 1, p: 2, bgcolor: roleTabAccentSoft, borderRadius: 2, border: `1px solid ${roleBorder}` }}>
          <Typography sx={{ color: '#ffffff', fontWeight: 700, mb: 1.5, fontSize: 14 }}>
            {t('crew.cost.estimator')} {selectedIds.size > 0 && t('crew.cost.selectedCount', { n: selectedIds.size })}
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField type="date" label={t('crew.cost.from')} size="small" value={costStartDate} onChange={e => setCostStartDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ '& .MuiOutlinedInput-root': { color: '#fff' }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' } }} />
            <TextField type="date" label={t('crew.cost.to')} size="small" value={costEndDate} onChange={e => setCostEndDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ '& .MuiOutlinedInput-root': { color: '#fff' }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' } }} />
            {calculateCost && (
              <Box sx={{ display: 'flex', gap: 3 }}>
                <Box><Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{t('crew.cost.days')}</Typography><Typography sx={{ color: '#fff', fontWeight: 700 }}>{calculateCost.days}</Typography></Box>
                <Box><Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Crew</Typography><Typography sx={{ color: '#fff', fontWeight: 700 }}>{calculateCost.crewCount}</Typography></Box>
                <Box><Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{t('crew.cost.dailyRate')}</Typography><Typography sx={{ color: '#fff', fontWeight: 700 }}>{calculateCost.dailyRate.toLocaleString('nb-NO')} kr</Typography></Box>
                <Box><Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Total</Typography><Typography sx={{ color: '#4caf50', fontWeight: 700, fontSize: '1.1rem' }}>{calculateCost.total.toLocaleString('nb-NO')} kr</Typography></Box>
              </Box>
            )}
          </Box>
          {costCalculatorIntelligence && (
            <Box sx={{ mt: 1.75, p: 1.25, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.04)', border: `1px solid ${roleBorder}` }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#ffffff', mb: 0.75 }}>{t('crew.cost.budgetIntel')}</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25, mb: 0.85 }}>
                {costCalculatorIntelligence.periodBudget !== null ? (
                  <Typography sx={{ fontSize: 12, color: '#ffffff' }}>
                    {t('crew.cost.periodBudget')} <strong>{costCalculatorIntelligence.periodBudget.toLocaleString('nb-NO')} kr</strong>
                  </Typography>
                ) : (
                  <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.78)' }}>
                    {t('crew.cost.periodBudget')} <strong>{t('crew.cost.notSet')}</strong>
                  </Typography>
                )}
                <Typography sx={{ fontSize: 12, color: '#ffffff' }}>
                  {t('crew.cost.forecast')} <strong>{costCalculatorIntelligence.projectedTotal.toLocaleString('nb-NO')} kr</strong>
                </Typography>
                <Typography sx={{ fontSize: 12, color: '#ffffff' }}>
                  {t('crew.cost.assignedForecast')} <strong>{costCalculatorIntelligence.assignedProjection.toLocaleString('nb-NO')} kr</strong>
                </Typography>
                {costCalculatorIntelligence.budgetDelta !== null && (
                  <Typography
                    sx={{
                      fontSize: 12,
                      color: costCalculatorIntelligence.budgetDelta > 0 ? '#ef4444' : '#10b981',
                      fontWeight: 700,
                    }}
                  >
                    {t('crew.cost.deviation')} {costCalculatorIntelligence.budgetDelta > 0 ? '+' : ''}
                    {costCalculatorIntelligence.budgetDelta.toLocaleString('nb-NO')} kr
                  </Typography>
                )}
              </Box>
              {costCalculatorIntelligence.utilization !== null && (
                <Box sx={{ mb: 0.85 }}>
                  <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', mb: 0.25 }}>
                    {t('crew.budget.utilization')} {(costCalculatorIntelligence.utilization * 100).toFixed(1)}%
                    {costCalculatorIntelligence.assignedUtilization !== null
                      ? t('crew.cost.assignedUtil', { pct: (costCalculatorIntelligence.assignedUtilization * 100).toFixed(1) })
                      : ''}
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(100, Math.max(0, costCalculatorIntelligence.utilization * 100))}
                    sx={{
                      height: 7,
                      borderRadius: 10,
                      bgcolor: 'rgba(255,255,255,0.1)',
                      '& .MuiLinearProgress-bar': {
                        bgcolor:
                          costCalculatorIntelligence.severity === 'high'
                            ? '#ef4444'
                            : costCalculatorIntelligence.severity === 'medium'
                            ? '#ffb800'
                            : '#10b981',
                      },
                    }}
                  />
                </Box>
              )}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.35 }}>
                {costCalculatorIntelligence.recommendations.map((text) => (
                  <Typography key={text} sx={{ fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>
                    • {text}
                  </Typography>
                ))}
              </Box>
            </Box>
          )}
        </Box>
      </Collapse>

      {/* ── LOADING INDICATOR ── */}
      {isLoading && (
        <LinearProgress sx={{ mx: 0, height: 2, bgcolor: 'rgba(184,107,255,0.1)', '& .MuiLinearProgress-bar': { bgcolor: roleTabAccent } }} />
      )}

      {/* ── STATS BAR (6 fargekodete kort matcher team-fane-design) ── */}
      <Collapse in={showStats && crewMembers.length > 0}>
        <Box sx={{ mx: 2, mb: 1.5 }}>
          <RoleStatPillRow
            pills={[
              { icon: <PeopleIcon />, count: stats.total, label: t('crew.stat.totalMembers'), color: '#a78bfa' },
              { icon: <CheckCircleIcon />, count: stats.availableNow, label: t('crew.stat.availableNow'), color: '#10b981' },
              { icon: <ScheduleIcon />, count: stats.busyCount, label: t('crew.stat.busy'), color: '#f59e0b' },
              { icon: <HourglassIcon />, count: stats.pendingCount, label: t('crew.stat.awaitingReply'), color: '#c084fc' },
              { icon: <PersonAddIcon />, count: stats.invitedCount, label: t('crew.stat.invited'), color: '#60a5fa' },
              { icon: <WalletIcon />, count: `${stats.totalDailyRate.toLocaleString('nb-NO')} kr`, label: t('crew.stat.totalCost'), color: 'var(--role-cyan, #22d3ee)' },
            ]}
          />
        </Box>
      </Collapse>

      {workspaceView === 'pro' && (
        <Box
          sx={{
            mx: 2,
            mb: 1,
            p: 1.5,
            borderRadius: 2,
            bgcolor: roleSurface,
            border: `1px solid ${roleBorder}`,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(4, minmax(0,1fr))' },
            gap: 1.25,
          }}
        >
          <Box sx={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 800, color: '#ffffff' }}>{t('crew.pro.controlCenter')}</Typography>
              <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.72)' }}>{t('crew.pro.controlDesc')}</Typography>
            </Box>
            <Box sx={{ width: '100%', overflowX: 'auto', pb: 0.25 }}>
              <ToggleButtonGroup
                value={proViewFocus}
                exclusive
                size="small"
                aria-label={t('crew.aria.proFocus')}
                onChange={(_, next) => {
                  if (next) setProViewFocus(next as ProViewFocus);
                }}
                sx={{
                  flexWrap: { xs: 'wrap', md: 'nowrap' },
                  gap: 0.25,
                  '& .MuiToggleButtonGroup-grouped': {
                    borderColor: roleBorder,
                    m: 0,
                  },
                }}
              >
                <ToggleButton value="all" sx={{ color: '#ffffff', borderColor: roleBorder, '&.Mui-selected': { color: '#ffffff', bgcolor: roleTabAccentSoft } }}>{t('crew.all')}</ToggleButton>
                <ToggleButton value="overview" sx={{ color: '#ffffff', borderColor: roleBorder, '&.Mui-selected': { color: '#ffffff', bgcolor: roleTabAccentSoft } }}>{t('crew.focus.overview')}</ToggleButton>
                <ToggleButton value="risks" sx={{ color: '#ffffff', borderColor: roleBorder, '&.Mui-selected': { color: '#ffffff', bgcolor: roleTabAccentSoft } }}>{t('crew.focus.risks')}</ToggleButton>
                <ToggleButton value="budget" sx={{ color: '#ffffff', borderColor: roleBorder, '&.Mui-selected': { color: '#ffffff', bgcolor: roleTabAccentSoft } }}>{t('crew.focus.budget')}</ToggleButton>
                <ToggleButton value="planner" sx={{ color: '#ffffff', borderColor: roleBorder, '&.Mui-selected': { color: '#ffffff', bgcolor: roleTabAccentSoft } }}>{t('crew.focus.planner')}</ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </Box>

          <Box sx={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('crew.pro.nextSteps')}</Typography>
          </Box>

          <Box sx={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0,1fr))' }, gap: 0.75 }}>
            {proActionItems.map((action) => {
              const tone =
                action.severity === 'high'
                  ? { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.45)', hover: '#fca5a5' }
                  : action.severity === 'medium'
                  ? { bg: 'rgba(255,184,0,0.12)', border: 'rgba(255,184,0,0.42)', hover: '#fcd34d' }
                  : { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)', hover: '#6ee7b7' };

              return (
                <Button
                  key={action.id}
                  variant="outlined"
                  onClick={() => handleProActionClick(action)}
                  sx={{
                    textTransform: 'none',
                    justifyContent: 'flex-start',
                    alignItems: 'flex-start',
                    flexDirection: 'column',
                    gap: 0.2,
                    px: 1.1,
                    py: 0.85,
                    borderRadius: 1.25,
                    borderColor: tone.border,
                    bgcolor: tone.bg,
                    color: '#ffffff',
                    '&:hover': {
                      bgcolor: tone.bg,
                      borderColor: tone.hover,
                    },
                  }}
                >
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#ffffff', lineHeight: 1.2 }}>
                    {action.title}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.78)', lineHeight: 1.2, textAlign: 'left' }}>
                    {action.detail}
                  </Typography>
                </Button>
              );
            })}
          </Box>

          {showProOverview && (
            <>
              <Box sx={{ p: 1.25, borderRadius: 1.5, bgcolor: roleSurfaceMuted, border: `1px solid ${roleBorder}` }}>
                <Typography sx={{ fontSize: 11, color: '#ffffff', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('crew.pro.confirmed')}</Typography>
                <Typography sx={{ fontSize: 22, fontWeight: 700, color: '#ffffff' }}>{proInsights.confirmed}</Typography>
              </Box>
              <Box sx={{ p: 1.25, borderRadius: 1.5, bgcolor: roleSurfaceMuted, border: `1px solid ${roleBorder}` }}>
                <Typography sx={{ fontSize: 11, color: '#ffffff', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('crew.pro.pendingInvited')}</Typography>
                <Typography sx={{ fontSize: 22, fontWeight: 700, color: '#ffffff' }}>{proInsights.pending + proInsights.invited}</Typography>
              </Box>
              <Box sx={{ p: 1.25, borderRadius: 1.5, bgcolor: roleSurfaceMuted, border: `1px solid ${roleBorder}` }}>
                <Typography sx={{ fontSize: 11, color: '#ffffff', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('crew.pro.conflicts')}</Typography>
                <Typography sx={{ fontSize: 22, fontWeight: 700, color: '#ffffff' }}>{stats.totalConflicts}</Typography>
              </Box>
              <Box sx={{ p: 1.25, borderRadius: 1.5, bgcolor: roleSurfaceMuted, border: `1px solid ${roleBorder}` }}>
                <Typography sx={{ fontSize: 11, color: '#ffffff', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('crew.pro.avgRate')}</Typography>
                <Typography sx={{ fontSize: 22, fontWeight: 700, color: '#ffffff' }}>{proInsights.averageRate.toLocaleString('nb-NO')} kr</Typography>
              </Box>
              {proInsights.topRoles.length > 0 && (
                <Box sx={{ gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', gap: 0.75, pt: 0.25 }}>
                  {proInsights.topRoles.map((roleLabel) => (
                    <Chip
                      key={roleLabel}
                      label={roleLabel}
                      size="small"
                      sx={{ bgcolor: roleTabAccentSoft, color: '#ffffff', border: `1px solid ${roleBorder}` }}
                    />
                  ))}
                  <Button
                    size="small"
                    onClick={() => {
                      setFilterStatus('pending');
                      setShowFilters(false);
                    }}
                    sx={{ color: '#ffffff', borderColor: roleBorder }}
                    variant="outlined"
                  >
                    {t('crew.pro.focusPending')}
                  </Button>
                  <Button
                    size="small"
                    onClick={() => setShowCostCalculator(true)}
                    sx={{ color: '#ffffff', borderColor: roleBorder }}
                    variant="outlined"
                  >{t('crew.pro.openBudgetPanel')}</Button>
                </Box>
              )}
            </>
          )}

          {showProRisks && (
            <Box sx={{ gridColumn: '1 / -1', p: 1.25, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.02)', border: `1px solid ${roleBorder}` }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#ffffff', mb: 0.75 }}>{t('crew.pro.conflictEngine')}</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                <Chip label={t('crew.pro.doubleBooking', { n: stats.totalConflicts })} size="small" sx={{ bgcolor: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)' }} />
                <Chip label={t('crew.pro.outsideAvail', { n: riskInsights.availabilityConflicts.length })} size="small" sx={{ bgcolor: 'rgba(255,184,0,0.15)', color: '#ffb800', border: '1px solid rgba(255,184,0,0.4)' }} />
                <Chip label={t('crew.pro.overtimeRiskChip', { n: riskInsights.overtimeRisk.length })} size="small" sx={{ bgcolor: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.4)' }} />
                <Chip label={t('crew.pro.missingContact', { n: riskInsights.missingContact.length })} size="small" sx={{ bgcolor: 'rgba(168,85,247,0.18)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.4)' }} />
              </Box>
            </Box>
          )}

          {showProBudget && (
            <Box sx={{ gridColumn: '1 / -1', p: 1.25, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.02)', border: `1px solid ${roleBorder}` }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#ffffff', mb: 0.75 }}>{t('crew.budget.title')}</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                <Typography sx={{ fontSize: 12, color: '#ffffff' }}>
                  {t('crew.budget.plannedDaily')} <strong>{budgetIntelligence.overallDailyCost.toLocaleString('nb-NO')} kr</strong>
                </Typography>
                <Typography sx={{ fontSize: 12, color: '#ffffff' }}>
                  {t('crew.budget.assignedDaily')} <strong>{budgetIntelligence.assignedDailyCost.toLocaleString('nb-NO')} kr</strong>
                </Typography>
                {effectiveBudget > 0 && (
                  <Typography sx={{ fontSize: 12, color: '#ffffff' }}>
                    {t('crew.budget.utilization')} <strong>{((budgetIntelligence.utilizationRatio ?? 0) * 100).toFixed(1)}%</strong>
                  </Typography>
                )}
              </Box>
              <Box sx={{ mt: 0.75, display: 'flex', flexDirection: 'column', gap: 0.35 }}>
                {budgetIntelligence.recommendations.map((text) => (
                  <Typography key={text} sx={{ fontSize: 12, color: 'rgba(255,255,255,0.78)' }}>
                    • {text}
                  </Typography>
                ))}
              </Box>
              {budgetIntelligence.highCostMembers.length > 0 && (
                <Box sx={{ mt: 0.75, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {budgetIntelligence.highCostMembers.map((member) => (
                    <Chip
                      key={member.id}
                      label={`${member.name} · ${(member.rate || 0).toLocaleString('nb-NO')} kr`}
                      size="small"
                      onClick={() => setSearchQuery(member.name)}
                      sx={{ bgcolor: 'rgba(255,255,255,0.06)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.15)' }}
                    />
                  ))}
                </Box>
              )}
            </Box>
          )}

          {showProPlanner && selectedIds.size > 0 && (
            <Box sx={{ gridColumn: '1 / -1', p: 1.25, borderRadius: 1.5, bgcolor: roleSurfaceMuted, border: `1px solid ${roleBorder}`, display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
              <Typography sx={{ color: '#ffffff', fontSize: 12, fontWeight: 700 }}>
                {t('crew.bulk.tools', { n: selectedIds.size })}
              </Typography>
              <FormControl size="small" sx={{ minWidth: 170 }}>
                <InputLabel sx={{ color: 'rgba(255,255,255,0.75)' }}>{t('crew.field.role')}</InputLabel>
                <Select
                  value={bulkRole}
                  label={t('crew.field.role')}
                  onChange={(event) => setBulkRole(event.target.value as CrewRole | 'none')}
                  sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } }}
                >
                  <MenuItem value="none">{t('crew.pro.noRoleChange')}</MenuItem>
                  {crewRoles.map((role) => (
                    <MenuItem key={role} value={role}>{getRoleLabel(role)}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                size="small"
                type="number"
                label={t('crew.field.rate')}
                value={bulkRateInput}
                onChange={(event) => setBulkRateInput(event.target.value)}
                sx={{ width: 170, '& .MuiOutlinedInput-root': { color: '#fff' }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.75)' } }}
              />
              <Button size="small" variant="outlined" onClick={handleBulkRoleChange} sx={{ color: '#ffffff', borderColor: roleBorder }}>
                {t('crew.pro.applyRole')}
              </Button>
              <Button size="small" variant="outlined" onClick={handleBulkRateUpdate} sx={{ color: '#ffffff', borderColor: roleBorder }}>
                {t('crew.pro.applyFee')}
              </Button>
            </Box>
          )}

          {showProPlanner && productionDays.length > 0 && (
            <Box sx={{ gridColumn: '1 / -1', p: 1.25, borderRadius: 1.5, bgcolor: roleSurfaceMuted, border: `1px solid ${roleBorder}` }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#ffffff', mb: 0.75 }}>{t('crew.planner.title')}</Typography>
              <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', mb: 0.75 }}>{t('crew.planner.desc')}</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1 }}>
                {plannerCandidates.map((member) => (
                  <Tooltip
                    key={member.id}
                    title={t('crew.planner.memberTooltip', { role: getRoleLabel(member.role), n: plannerAssignmentCountByMember.get(member.id) ?? 0 })}
                    arrow
                  >
                    <Chip
                      draggable
                      onDragStart={() => setPlannerSourceMemberId(member.id)}
                      onDragEnd={() => { setPlannerSourceMemberId(null); setPlannerDragOverDayId(null); }}
                      label={`${member.name} (${plannerAssignmentCountByMember.get(member.id) ?? 0})`}
                      sx={{
                        cursor: 'grab',
                        bgcolor: plannerSourceMemberId === member.id ? 'rgba(184,107,255,0.34)' : 'rgba(255,255,255,0.07)',
                        color: '#ffffff',
                        border: `1px solid ${roleBorder}`,
                      }}
                    />
                  </Tooltip>
                ))}
              </Box>
              <Box sx={{ display: 'grid', gap: 0.75, gridTemplateColumns: { xs: '1fr', md: `repeat(${Math.min(plannerDays.length, 4)}, minmax(0,1fr))` } }}>
                {plannerDays.map((day, index) => {
                  const dayAssignments = plannerAssignmentsByDay.get(day.id) ?? [];
                  return (
                    <Box
                      key={day.id}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setPlannerDragOverDayId(day.id);
                      }}
                      onDragLeave={() => setPlannerDragOverDayId((previous) => (previous === day.id ? null : previous))}
                      onDrop={(event) => {
                        event.preventDefault();
                        if (plannerSourceMemberId) {
                          assignCrewToDayQuick(plannerSourceMemberId, day.id);
                        }
                        setPlannerSourceMemberId(null);
                        setPlannerDragOverDayId(null);
                      }}
                      sx={{
                        p: 1,
                        borderRadius: 1.25,
                        border: `1px dashed ${plannerDragOverDayId === day.id ? roleTabAccent : 'rgba(255,255,255,0.24)'}`,
                        bgcolor: plannerDragOverDayId === day.id ? 'rgba(184,107,255,0.24)' : 'rgba(255,255,255,0.03)',
                        minHeight: 134,
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 0.75 }}>
                        <Box>
                          <Typography sx={{ fontSize: 11, color: '#ffffff', fontWeight: 700 }}>
                            {t('crew.dayShort', { n: index + 1 })}
                          </Typography>
                          <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.72)' }}>
                            {day.date}
                          </Typography>
                        </Box>
                        <Chip
                          size="small"
                          label={`${dayAssignments.length} crew`}
                          sx={{
                            height: 20,
                            bgcolor: dayAssignments.length > 0 ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.08)',
                            color: dayAssignments.length > 0 ? '#34d399' : 'rgba(255,255,255,0.7)',
                            border: `1px solid ${dayAssignments.length > 0 ? 'rgba(52,211,153,0.4)' : 'rgba(255,255,255,0.2)'}`,
                            fontWeight: 700,
                            fontSize: 11,
                          }}
                        />
                      </Box>
                      <Box sx={{ mt: 0.75, display: 'flex', flexDirection: 'column', gap: 0.5, maxHeight: 130, overflowY: 'auto', pr: 0.25 }}>
                        {dayAssignments.length === 0 ? (
                          <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{t('crew.planner.noCrewYet')}</Typography>
                        ) : (
                          dayAssignments.map(({ member, assignment, doodCode, status }) => {
                            const statusColor =
                              status === 'hold'
                                ? '#ffb800'
                                : status === 'travel'
                                ? '#60a5fa'
                                : status === 'release'
                                ? '#94a3b8'
                                : status === 'unknown'
                                ? '#c084fc'
                                : '#34d399';
                            return (
                              <Box
                                key={`${day.id}-${member.id}`}
                                sx={{
                                  px: 0.75,
                                  py: 0.5,
                                  borderRadius: 1,
                                  bgcolor: 'rgba(255,255,255,0.04)',
                                  border: `1px solid ${statusColor}55`,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: 0.75,
                                }}
                              >
                                <Box sx={{ minWidth: 0 }}>
                                  <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#ffffff', lineHeight: 1.2 }} noWrap>
                                    {member.name}
                                  </Typography>
                                  <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.72)', lineHeight: 1.2 }} noWrap>
                                    {getRoleLabel(member.role)} · {assignment.callTime || '08:00'} · Unit {assignment.unit || 'A'}
                                  </Typography>
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}>
                                  {doodCode && (
                                    <Chip
                                      size="small"
                                      label={doodCode}
                                      sx={{
                                        height: 18,
                                        fontSize: 10,
                                        fontWeight: 700,
                                        bgcolor: `${statusColor}22`,
                                        color: statusColor,
                                        border: `1px solid ${statusColor}55`,
                                      }}
                                    />
                                  )}
                                  <Tooltip title={t('crew.tt.removeFromDay')}>
                                    <IconButton
                                      size="small"
                                      onClick={() => void handleCrewUnassign(member.id, day.id)}
                                      sx={{ color: 'rgba(255,255,255,0.7)', p: 0.4 }}
                                    >
                                      <UnassignIcon sx={{ fontSize: 14 }} />
                                    </IconButton>
                                  </Tooltip>
                                </Box>
                              </Box>
                            );
                          })
                        )}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          )}

          {showProPlanner && productionDays.length === 0 && (
            <Box sx={{ gridColumn: '1 / -1', p: 1.25, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.02)', border: `1px dashed ${roleBorder}` }}>
              <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.82)' }}>{t('crew.planner.inactive')}</Typography>
            </Box>
          )}
        </Box>
      )}

      {/* ── MAIN BODY: dept sidebar + crew list ── */}
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden', gap: 1.25, px: 2, pb: 1.25 }}>
        {/* LEFT: department sidebar */}
        <Collapse in={showDeptSidebar && !isMobile} orientation="horizontal" sx={{ flexShrink: 0 }}>
          <DeptSidebarPanel
            crewMembers={crewMembers}
            filterDept={filterDept}
            onDeptClick={setFilterDept}
            favorites={favorites}
            onAddRole={() => handleOpenDialog()}
          />
        </Collapse>

        {/* CENTER: crew list */}
        <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', border: `1px solid ${roleBorder}`, borderRadius: 2, bgcolor: roleSurfaceMuted, backdropFilter: 'blur(6px)', p: 1 }}>
          {enrichedCrew.length === 0 ? (
            <RoleRoomEmptyState
              iconSrc={crewPng}
              title={t('crew.noTeamMembers')}
              subtitle={t('crew.empty.subtitle')}
              color={roleTabAccent}
            />
          ) : filteredAndSortedCrew.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6, color: 'rgba(255,255,255,0.5)' }}>
              <SearchIcon sx={{ fontSize: 48, mb: 2, opacity: 0.3 }} />
              <Typography>{t('crew.noMatches')}</Typography>
            </Box>
          ) : viewMode === 'table' ? (
        /* Table View - Responsive with horizontal scroll */
        <TableContainer
          component={Paper}
          sx={{
            bgcolor: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 2,
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch', // Smooth scrolling on iOS
            // Scroll indicator shadow
            '&::-webkit-scrollbar': { height: 8 },
            '&::-webkit-scrollbar-track': { bgcolor: 'rgba(255,255,255,0.05)' },
            '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(0,212,255,0.3)', borderRadius: 4 },
            ...(pinNameColumn && {
              '& th:nth-of-type(1), & td:nth-of-type(1)': {
                position: 'sticky',
                left: 0,
                zIndex: 4,
                bgcolor: 'rgba(17, 13, 33, 0.98)',
              },
              '& th:nth-of-type(2), & td:nth-of-type(2)': {
                position: 'sticky',
                left: 52,
                zIndex: 3,
                bgcolor: 'rgba(17, 13, 33, 0.96)',
              },
            }),
            ...(pinNameColumn && pinContactColumn && {
              '& th:nth-of-type(4), & td:nth-of-type(4)': {
                position: 'sticky',
                left: 280,
                zIndex: 2,
                bgcolor: 'rgba(17, 13, 33, 0.95)',
              },
            }),
            ...(compactMode && {
              '& .MuiTableCell-root': {
                py: 0.75,
                fontSize: '0.78rem',
              },
            }),
          }}
        >
          <Table
            aria-label={t('crew.aria.crewTable')}
            sx={{ minWidth: { xs: compactMode ? 520 : 600, sm: compactMode ? 620 : 700, md: compactMode ? 680 : 750, lg: compactMode ? 780 : 850, xl: compactMode ? 1000 : 1100 } }}
          >
            <TableHead>
              <TableRow sx={{ bgcolor: 'rgba(255,255,255,0.05)' }}>
                <TableCell padding="checkbox" sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                  <Checkbox
                    checked={selectedIds.size === filteredAndSortedCrew.length && filteredAndSortedCrew.length > 0}
                    indeterminate={selectedIds.size > 0 && selectedIds.size < filteredAndSortedCrew.length}
                    onChange={handleSelectAll}
                    aria-label={t('crew.aria.selectAllMembers')}
                    sx={{
                      color: 'rgba(255,255,255,0.87)',
                      '&.Mui-checked': { color: 'var(--role-cyan, #00d4ff)' },
                    }}
                  />
                </TableCell>
                <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                  <TableSortLabel
                    active={sortField === 'name'}
                    direction={sortField === 'name' ? sortDirection : 'asc'}
                    onClick={() => handleSort('name')}
                    sx={{ color: '#fff', fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' }, '&:hover': { color: 'var(--role-cyan, #00d4ff)' } }}
                  >{t('crew.sort.name')}</TableSortLabel>
                </TableCell>
                <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                  <TableSortLabel
                    active={sortField === 'role'}
                    direction={sortField === 'role' ? sortDirection : 'asc'}
                    onClick={() => handleSort('role')}
                    sx={{ color: '#fff', fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' }, '&:hover': { color: 'var(--role-cyan, #00d4ff)' } }}
                  >{t('crew.field.role')}</TableSortLabel>
                </TableCell>
                <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 }, fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>{t('crew.col.contact')}</TableCell>
                <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                  <TableSortLabel
                    active={sortField === 'rate'}
                    direction={sortField === 'rate' ? sortDirection : 'asc'}
                    onClick={() => handleSort('rate')}
                    sx={{ color: '#fff', fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' }, '&:hover': { color: 'var(--role-cyan, #00d4ff)' } }}
                  >{t('crew.sort.rate')}</TableSortLabel>
                </TableCell>
                <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                  <TableSortLabel
                    active={sortField === 'availability'}
                    direction={sortField === 'availability' ? sortDirection : 'asc'}
                    onClick={() => handleSort('availability')}
                    sx={{ color: '#fff', fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' }, '&:hover': { color: 'var(--role-cyan, #00d4ff)' } }}
                  >{t('crew.sort.availability')}</TableSortLabel>
                </TableCell>
                <TableCell align="right" sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 }, fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>Status</TableCell>
                {productionDays.slice(0, 4).map((day, i) => (
                  <TableCell key={day.id} align="center" sx={{ py: 1, fontSize: 11, color: 'rgba(255,255,255,0.55)', whiteSpace: 'nowrap', px: 1, fontWeight: 600, letterSpacing: 0.5 }}>
                    {(['Mon','Tue','Wed','Thu'] as const)[i] ?? new Date(day.date ?? '').toLocaleDateString('en', { weekday: 'short' })}
                  </TableCell>
                ))}
                <TableCell align="right" sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 }, fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>{t('crew.col.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredAndSortedCrew.flatMap((member, idx) => {
                const deptKey = ROLE_TO_DEPT[member.role] ?? 'other';
                const prevDeptKey = idx > 0 ? (ROLE_TO_DEPT[filteredAndSortedCrew[idx - 1].role] ?? 'other') : null;
                const dColor = DEPT_COLORS[deptKey];
                const deptCount = filteredAndSortedCrew.filter(m => (ROLE_TO_DEPT[m.role] ?? 'other') === deptKey).length;
                const deptHeader = deptKey !== prevDeptKey ? (
                  <TableRow key={`dh-${deptKey}-${idx}`} sx={{ bgcolor: 'rgba(255,255,255,0.022)', '&:hover': { bgcolor: 'rgba(255,255,255,0.035)' } }}>
                    <TableCell padding="checkbox" sx={{ borderBottom: `1px solid ${dColor}22`, py: 0.5 }} />
                    <TableCell colSpan={6 + Math.min(productionDays.length, 4)} sx={{ borderBottom: `1px solid ${dColor}22`, py: 0.75 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 3, height: 14, bgcolor: dColor, borderRadius: 1, flexShrink: 0 }} />
                        <Typography sx={{ fontSize: 11, fontWeight: 700, color: dColor, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                          {t(DEPT_LABEL_KEY[deptKey])}
                        </Typography>
                        <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>({deptCount})</Typography>
                            <Button size="small" startIcon={<AddIcon sx={{ fontSize: 12 }} />} onClick={() => handleOpenDialog()}
                              sx={{ ml: 'auto', fontSize: 11, color: 'rgba(255,255,255,0.45)', textTransform: 'none', minHeight: 'auto', py: 0.2, px: 1,
                                '&:hover': { color: roleTabAccent, bgcolor: roleTabAccentSoft } }}>
                          {t('crew.btn.newMemberPlus')}
                        </Button>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ borderBottom: `1px solid ${dColor}22`, py: 0.5 }} />
                  </TableRow>
                ) : null;
                const memberRow = (
                  <TableRow
                    key={member.id}
                    hover
                    selected={selectedIds.has(member.id)}
                    sx={{
                      '&:hover': { bgcolor: roleTabAccentSoft },
                      '&.Mui-selected': { bgcolor: 'rgba(184,107,255,0.22)' },
                    }}
                  >
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedIds.has(member.id)}
                      onChange={() => handleSelectOne(member.id)}
                      aria-label={t('crew.aria.selectMember', { name: member.name })}
                      sx={{
                        color: 'rgba(255,255,255,0.87)',
                        '&.Mui-checked': { color: roleTabAccent },
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                      <Avatar
                        sx={{
                          width: { xs: 32, sm: 36, md: 34, lg: 40, xl: 48 },
                          height: { xs: 32, sm: 36, md: 34, lg: 40, xl: 48 },
                          bgcolor: getAvatarColor(member.role),
                          fontSize: { xs: '0.75rem', sm: '0.8125rem', md: '0.78125rem', lg: '0.875rem', xl: '1rem' },
                          fontWeight: 600,
                        }}
                        aria-hidden="true"
                      >
                        {getInitials(member.name)}
                      </Avatar>
                      <Box>
                        <Typography sx={{ color: '#fff', fontWeight: 500, lineHeight: 1.2, fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>
                          {member.name}
                        </Typography>
                        {favorites.has(member.id) && (
                          <StarIcon sx={{ fontSize: { xs: 12, sm: 14, md: 13, lg: 15, xl: 18 }, color: '#ffc107', ml: 0.5, verticalAlign: 'middle' }} />
                        )}
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                    <Chip
                      label={getRoleLabel(member.role)}
                      size="small"
                      sx={{
                        bgcolor: roleTabAccentSoft,
                        color: roleTabAccent,
                        fontWeight: 600,
                        fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' },
                        height: { xs: 22, sm: 24, md: 23, lg: 26, xl: 30 },
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 } }}>
                      {member.contactInfo?.email && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 } }}>
                          <Typography
                            variant="body2"
                            component="a"
                            href={`mailto:${member.contactInfo.email}`}
                            sx={{ color: 'rgba(255,255,255,0.87)', textDecoration: 'none', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' } }}
                          >
                            {member.contactInfo.email}
                          </Typography>
                          <Tooltip title={copiedField === `email-${member.id}` ? t('crew.copied') : t('crew.copy')}>
                            <IconButton
                              size="small"
                              onClick={() => handleCopy(member.contactInfo?.email ?? '', `email-${member.id}`)}
                              sx={{ color: copiedField === `email-${member.id}` ? '#4caf50' : 'rgba(255,255,255,0.5)', minWidth: TOUCH_TARGET_SIZE, minHeight: TOUCH_TARGET_SIZE }}
                            >
                              {copiedField === `email-${member.id}` ? <CheckCircleIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 20 } }} /> : <CopyIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 20 } }} />}
                            </IconButton>
                          </Tooltip>
                        </Box>
                      )}
                      {member.contactInfo?.phone && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 } }}>
                          <Typography
                            variant="body2"
                            component="a"
                            href={`tel:${member.contactInfo.phone}`}
                            sx={{ color: 'rgba(255,255,255,0.87)', textDecoration: 'none', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' } }}
                          >
                            {member.contactInfo.phone}
                          </Typography>
                          <Tooltip title={copiedField === `phone-${member.id}` ? t('crew.copied') : t('crew.copy')}>
                            <IconButton
                              size="small"
                              onClick={() => handleCopy(member.contactInfo?.phone ?? '', `phone-${member.id}`)}
                              sx={{ color: copiedField === `phone-${member.id}` ? '#4caf50' : 'rgba(255,255,255,0.5)', minWidth: TOUCH_TARGET_SIZE, minHeight: TOUCH_TARGET_SIZE }}
                            >
                              {copiedField === `phone-${member.id}` ? <CheckCircleIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 20 } }} /> : <CopyIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 20 } }} />}
                            </IconButton>
                          </Tooltip>
                        </Box>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.87)', py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 }, fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>
                    {member.rate ? `${member.rate.toLocaleString('no-NO')} kr` : '-'}
                  </TableCell>
                  <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                    {member.availability?.startDate && member.availability?.endDate ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 } }}>
                        <CalendarTodayIcon sx={{ fontSize: { xs: 11, sm: 12, md: 12, lg: 13, xl: 14 }, color: isAvailableNow(member) ? '#4caf50' : '#9333ea' }} />
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' } }}>
                          {member.availability.startDate} - {member.availability.endDate}
                        </Typography>
                      </Box>
                    ) : (
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' } }}>
                        {t('crew.notSetCap')}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right" sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                      <StatusBadge status={member.status} size="small" />
                      {conflictMap.has(member.id) && (
                        <Tooltip title={t('crew.tt.doubleBookedCheck')}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                            <WarningAmberIcon sx={{ fontSize: 11, color: '#ef4444' }} />
                            <Typography sx={{ fontSize: 10, color: '#ef4444', fontWeight: 700 }}>{t('crew.conflict')}</Typography>
                          </Box>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                  {productionDays.slice(0, 4).map(day => {
                    const code = getMemberDOODCode(member.id, day.id, crewAssignments, productionDays);
                    const dotColor = !code ? 'rgba(255,255,255,0.14)' :
                      (code === 'W' || code === 'SW' || code === 'SWF') ? '#10b981' :
                      (code === 'H' || code === 'O') ? '#ef4444' : '#ffb800';
                    return (
                      <TableCell key={day.id} align="center" sx={{ py: 1, px: 1 }}>
                        <Box sx={{ display: 'flex', gap: 0.35, justifyContent: 'center' }}>
                          {([0,1,2] as const).map(i => (
                            <Box key={i} sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: dotColor }} />
                          ))}
                        </Box>
                      </TableCell>
                    );
                  })}
                  <TableCell align="right" sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 } }}>
                      <Tooltip title={favorites.has(member.id) ? t('crew.tt.removeFavorite') : t('crew.tt.addFavorite')}>
                        <IconButton
                          onClick={() => toggleFavorite(member.id)}
                          aria-label={favorites.has(member.id) ? t('crew.aria.removeFavorite', { name: member.name }) : t('crew.aria.addFavorite', { name: member.name })}
                          sx={{ color: favorites.has(member.id) ? '#ffc107' : 'rgba(255,255,255,0.3)', minWidth: TOUCH_TARGET_SIZE, minHeight: TOUCH_TARGET_SIZE, ...focusVisibleStyles }}
                        >
                          {favorites.has(member.id) ? <StarIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} /> : <StarBorderIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('crew.tt.duplicate')}>
                        <IconButton
                          onClick={() => handleDuplicate(member)}
                          aria-label={t('crew.aria.duplicate', { name: member.name })}
                          sx={{ color: 'rgba(255,255,255,0.87)', minWidth: TOUCH_TARGET_SIZE, minHeight: TOUCH_TARGET_SIZE, ...focusVisibleStyles }}
                        >
                          <DuplicateIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('crew.tt.edit')}>
                        <IconButton
                          onClick={() => handleOpenDialog(member)}
                          aria-label={t('crew.aria.edit', { name: member.name })}
                          sx={{ color: roleTabAccent, minWidth: TOUCH_TARGET_SIZE, minHeight: TOUCH_TARGET_SIZE, ...focusVisibleStyles }}
                        >
                          <EditIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('crew.tt.assignScene')}>
                        <IconButton
                          onClick={() => handleAssignToScene(member)}
                          aria-label={t('crew.aria.assignToScene', { name: member.name })}
                          sx={{ color: roleTabAccent, minWidth: TOUCH_TARGET_SIZE, minHeight: TOUCH_TARGET_SIZE, ...focusVisibleStyles }}
                        >
                          <AssignIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('crew.tt.delete')}>
                        <IconButton
                          onClick={() => handleDeleteWithUndo(member.id)}
                          aria-label={t('crew.aria.delete', { name: member.name })}
                          sx={{ color: '#ff4444', minWidth: TOUCH_TARGET_SIZE, minHeight: TOUCH_TARGET_SIZE, ...focusVisibleStyles }}
                        >
                          <DeleteIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                  </TableRow>
                );
                return deptHeader ? [deptHeader, memberRow] : [memberRow];
              })}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        /* Grid View - Enhanced cards matching ProductionDayView */
        <Grid
          container
          spacing={compactMode ? { xs: 1, sm: 1.25, md: 1.1, lg: 1.25, xl: 1.5 } : { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 3 }}
          role="list"
          aria-label={t('crew.aria.crewList', { n: filteredAndSortedCrew.length })}
        >
          {filteredAndSortedCrew.map((member) => (
            <Grid
              item
              xs={12} sm={6} md={4} lg={3}
              key={member.id}
              role="listitem"
            >
              <Card
                component="article"
                aria-labelledby={`crew-name-${member.id}`}
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  bgcolor: selectedIds.has(member.id) ? 'rgba(77,208,225,0.15)' : 'rgba(255,255,255,0.05)',
                  border: selectedIds.has(member.id) ? '2px solid #4dd0e1' : '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 2,
                  transition: 'all 0.2s ease',
                  ...focusVisibleStyles,
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.08)',
                    borderColor: '#4dd0e1',
                    boxShadow: '0 8px 24px rgba(77,208,225,0.2)',
                    transform: 'translateY(-2px)',
                  },
                }}
              >
                <CardContent sx={{ p: compactMode ? { xs: 1.25, sm: 1.5, md: 1.4, lg: 1.5, xl: 1.75 } : { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }, flex: 1, display: 'flex', flexDirection: 'column' }}>
                  {/* Header with gradient box */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 } }}>
                      <Checkbox
                        checked={selectedIds.has(member.id)}
                        onChange={() => handleSelectOne(member.id)}
                        aria-label={t('crew.aria.selectMember', { name: member.name })}
                        sx={{ p: 0.5, color: 'rgba(255,255,255,0.6)', '&.Mui-checked': { color: '#4dd0e1' } }}
                      />
                      <Box sx={{ flex: 1 }}>
                        {/* Eye-catching Member Header */}
                        <Box
                          sx={{
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                            mb: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                            p: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                            borderRadius: 2.5,
                            background: 'linear-gradient(135deg, rgba(77,208,225,0.25) 0%, rgba(0,188,212,0.15) 100%)',
                            border: '2px solid rgba(77,208,225,0.4)',
                            boxShadow: '0 4px 12px rgba(77,208,225,0.2), inset 0 1px 0 rgba(255,255,255,0.1)',
                            overflow: 'hidden',
                            '&::before': {
                              content: '""',
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              height: '3px',
                              background: 'linear-gradient(90deg, #4dd0e1 0%, #00bcd4 50%, #4dd0e1 100%)',
                            },
                          }}
                        >
                          {/* Avatar with gradient */}
                          <Avatar
                            sx={{
                              width: { xs: 50, sm: 60, md: 55, lg: 70, xl: 80 },
                              height: { xs: 50, sm: 60, md: 55, lg: 70, xl: 80 },
                              background: `linear-gradient(135deg, ${getAvatarColor(member.role)} 0%, ${getAvatarColor(member.role)}dd 100%)`,
                              fontSize: { xs: '1rem', sm: '1.25rem', md: '1.125rem', lg: '1.375rem', xl: '1.5rem' },
                              fontWeight: 700,
                              border: '2px solid rgba(255,255,255,0.3)',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                            }}
                            aria-hidden="true"
                          >
                            {getInitials(member.name)}
                          </Avatar>

                          {/* Name and role */}
                          <Box sx={{ flex: 1, zIndex: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 } }}>
                              <Typography
                                variant="h6"
                                component="h3"
                                id={`crew-name-${member.id}`}
                                sx={{
                                  color: '#fff',
                                  fontWeight: 700,
                                  fontSize: { xs: '1rem', sm: '1.125rem', md: '1.0625rem', lg: '1.1875rem', xl: '1.25rem' },
                                  lineHeight: 1.2,
                                  textShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                }}
                              >
                                {member.name}
                              </Typography>
                              {favorites.has(member.id) && (
                                <StarIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 }, color: '#ffc107' }} aria-label={t('crew.aria.favorite')} />
                              )}
                            </Box>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 }, mt: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 } }}>
                              <Chip
                                label={getRoleLabel(member.role)}
                                size="small"
                                sx={{
                                  bgcolor: 'rgba(77,208,225,0.3)',
                                  color: '#4dd0e1',
                                  fontWeight: 700,
                                  height: { xs: 22, sm: 24, md: 23, lg: 26, xl: 30 },
                                  fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' },
                                  border: '1px solid rgba(77,208,225,0.5)',
                                }}
                              />
                              <StatusBadge status={member.status} />
                              {isAvailableNow(member) && (
                                <Chip
                                  label={t('crew.card.available')}
                                  size="small"
                                  sx={{
                                    bgcolor: 'rgba(76,175,80,0.3)',
                                    color: '#81c784',
                                    fontWeight: 600,
                                    height: { xs: 22, sm: 24, md: 23, lg: 26, xl: 30 },
                                    fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' },
                                    border: '1px solid rgba(76,175,80,0.5)',
                                  }}
                                />
                              )}
                            </Box>
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                    <IconButton
                      onClick={() => toggleFavorite(member.id)}
                      aria-label={favorites.has(member.id) ? t('crew.aria.removeFavorite', { name: member.name }) : t('crew.aria.addFavorite', { name: member.name })}
                      sx={{
                        color: favorites.has(member.id) ? '#ffc107' : 'rgba(255,255,255,0.3)',
                        minWidth: TOUCH_TARGET_SIZE,
                        minHeight: TOUCH_TARGET_SIZE,
                        ...focusVisibleStyles,
                      }}
                    >
                      {favorites.has(member.id) ? <StarIcon sx={{ fontSize: { xs: 20, sm: 24, md: 22, lg: 26, xl: 30 } }} /> : <StarBorderIcon sx={{ fontSize: { xs: 20, sm: 24, md: 22, lg: 26, xl: 30 } }} />}
                    </IconButton>
                  </Box>

                  {/* Availability week dots */}
                  <AvailabilityWeekDots member={member} hasConflict={conflictMap.has(member.id)} />

                  {/* Contact Info Cards - Enhanced */}
                  <Stack spacing={{ xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 }} sx={{ mb: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 } }}>
                    {member.contactInfo?.email && (
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                          p: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                          borderRadius: 2,
                          bgcolor: 'rgba(77,208,225,0.1)',
                          border: '1px solid rgba(77,208,225,0.25)',
                        }}
                      >
                        <Box
                          sx={{
                            width: { xs: 40, sm: 48, md: 44, lg: 52, xl: 60 },
                            height: { xs: 40, sm: 48, md: 44, lg: 52, xl: 60 },
                            borderRadius: 1.5,
                            bgcolor: 'rgba(77,208,225,0.25)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <EmailIcon sx={{ fontSize: { xs: 22, sm: 26, md: 24, lg: 28, xl: 32 }, color: '#4dd0e1' }} />
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography
                            sx={{
                              color: 'rgba(255,255,255,0.87)',
                              fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' },
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                            }}
                          >{t('crew.field.email')}</Typography>
                          <Typography
                            component="a"
                            href={`mailto:${member.contactInfo.email}`}
                            sx={{
                              color: '#fff',
                              fontSize: { xs: '0.85rem', sm: '0.95rem', md: '0.9rem', lg: '1rem', xl: '1.125rem' },
                              fontWeight: 600,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              display: 'block',
                              textDecoration: 'none',
                              '&:hover': { color: '#4dd0e1' },
                            }}
                          >
                            {member.contactInfo.email}
                          </Typography>
                        </Box>
                        <Tooltip title={copiedField === `grid-email-${member.id}` ? t('crew.copied') : t('crew.copy')}>
                          <IconButton
                            size="small"
                            onClick={() => handleCopy(member.contactInfo?.email ?? '', `grid-email-${member.id}`)}
                            sx={{ color: copiedField === `grid-email-${member.id}` ? '#4caf50' : 'rgba(255,255,255,0.4)', minWidth: TOUCH_TARGET_SIZE, minHeight: TOUCH_TARGET_SIZE }}
                          >
                            {copiedField === `grid-email-${member.id}` ? <CheckCircleIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} /> : <CopyIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
                          </IconButton>
                        </Tooltip>
                      </Box>
                    )}

                    {member.contactInfo?.phone && (
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                          p: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                          borderRadius: 2,
                          bgcolor: 'rgba(139,92,246,0.1)',
                          border: '1px solid rgba(139,92,246,0.25)',
                        }}
                      >
                        <Box
                          sx={{
                            width: { xs: 40, sm: 48, md: 44, lg: 52, xl: 60 },
                            height: { xs: 40, sm: 48, md: 44, lg: 52, xl: 60 },
                            borderRadius: 1.5,
                            bgcolor: 'rgba(139,92,246,0.25)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <PhoneIcon sx={{ fontSize: { xs: 22, sm: 26, md: 24, lg: 28, xl: 32 }, color: '#a78bfa' }} />
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography
                            sx={{
                              color: 'rgba(255,255,255,0.87)',
                              fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' },
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                            }}
                          >{t('crew.field.phone')}</Typography>
                          <Typography
                            component="a"
                            href={`tel:${member.contactInfo.phone}`}
                            sx={{
                              color: '#fff',
                              fontSize: { xs: '0.95rem', sm: '1.1rem', md: '1.025rem', lg: '1.15rem', xl: '1.25rem' },
                              fontWeight: 700,
                              display: 'block',
                              textDecoration: 'none',
                              '&:hover': { color: '#a78bfa' },
                            }}
                          >
                            {member.contactInfo.phone}
                          </Typography>
                        </Box>
                        <Tooltip title={copiedField === `grid-phone-${member.id}` ? t('crew.copied') : t('crew.copy')}>
                          <IconButton
                            size="small"
                            onClick={() => handleCopy(member.contactInfo?.phone ?? '', `grid-phone-${member.id}`)}
                            sx={{ color: copiedField === `grid-phone-${member.id}` ? '#4caf50' : 'rgba(255,255,255,0.4)', minWidth: TOUCH_TARGET_SIZE, minHeight: TOUCH_TARGET_SIZE }}
                          >
                            {copiedField === `grid-phone-${member.id}` ? <CheckCircleIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} /> : <CopyIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
                          </IconButton>
                        </Tooltip>
                      </Box>
                    )}

                    {/* Rate Card */}
                    {member.rate && (
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                          p: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                          borderRadius: 2,
                          bgcolor: 'rgba(76,175,80,0.1)',
                          border: '1px solid rgba(76,175,80,0.25)',
                        }}
                      >
                        <Box
                          sx={{
                            width: { xs: 40, sm: 48, md: 44, lg: 52, xl: 60 },
                            height: { xs: 40, sm: 48, md: 44, lg: 52, xl: 60 },
                            borderRadius: 1.5,
                            bgcolor: 'rgba(76,175,80,0.25)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Typography sx={{ fontSize: { xs: 18, sm: 22, md: 20, lg: 24, xl: 28 }, fontWeight: 700, color: '#81c784' }}>kr</Typography>
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography
                            sx={{
                              color: 'rgba(255,255,255,0.87)',
                              fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' },
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                            }}
                          >{t('crew.sort.rate')}</Typography>
                          <Typography
                            sx={{
                              color: '#fff',
                              fontSize: { xs: '0.95rem', sm: '1.1rem', md: '1.025rem', lg: '1.15rem', xl: '1.25rem' },
                              fontWeight: 700,
                            }}
                          >
                            {member.rate.toLocaleString('nb-NO')} kr
                          </Typography>
                        </Box>
                      </Box>
                    )}
                  </Stack>

                  {/* Expandable details */}
                  <Collapse in={expandedCards.has(member.id)}>
                    <Box sx={{ mt: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                      {member.contactInfo?.address && (
                        <Box
                          sx={{
                            mb: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
                            p: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                            borderRadius: 2,
                            bgcolor: 'rgba(77,208,225,0.08)',
                            border: '1px solid rgba(77,208,225,0.2)',
                          }}
                        >
                          <Typography
                            variant="subtitle2"
                            sx={{
                              color: '#4dd0e1',
                              fontWeight: 700,
                              mb: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 },
                              fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.85rem', lg: '0.88rem', xl: '1rem' },
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                            }}
                          >{t('crew.field.address')}</Typography>
                          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>
                            {member.contactInfo.address}
                          </Typography>
                        </Box>
                      )}
                      {member.notes && (
                        <Box
                          sx={{
                            mb: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
                            p: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                            borderRadius: 2,
                            bgcolor: 'rgba(139,92,246,0.08)',
                            border: '1px solid rgba(139,92,246,0.2)',
                          }}
                        >
                          <Typography
                            variant="subtitle2"
                            sx={{
                              color: '#a78bfa',
                              fontWeight: 700,
                              mb: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 },
                              fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.85rem', lg: '0.88rem', xl: '1rem' },
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                            }}
                          >{t('crew.field.notes')}</Typography>
                          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>
                            {member.notes}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{ color: 'rgba(255,255,255,0.6)', fontSize: { xs: '0.7rem', sm: '0.75rem' }, mt: 0.5, display: 'block' }}
                          >
                            {t('crew.card.writtenBy')}{' '}
                            {(() => {
                              const rawAuthor =
                                member.notesAuthorName
                                ?? member.notesAuthor
                                ?? member.notesBy;
                              return typeof rawAuthor === 'string' && rawAuthor.trim().length > 0
                                ? rawAuthor.trim()
                                : t('crew.notRegistered');
                            })()}
                            {(() => {
                              const rawUpdatedAt =
                                member.notesUpdatedAt
                                ?? member.notesLastEditedAt
                                ?? member.notesTimestamp;
                              const updatedText = formatCrewNoteTimestamp(rawUpdatedAt);
                              return updatedText ? ` • ${updatedText}` : '';
                            })()}
                          </Typography>
                        </Box>
                      )}
                      {member.assignedScenes && member.assignedScenes.length > 0 && (
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                            p: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                            borderRadius: 2,
                            bgcolor: 'rgba(244,143,177,0.1)',
                            border: '1px solid rgba(244,143,177,0.25)',
                          }}
                        >
                          <Box
                            sx={{
                              width: { xs: 40, sm: 48, md: 44, lg: 52, xl: 60 },
                              height: { xs: 40, sm: 48, md: 44, lg: 52, xl: 60 },
                              borderRadius: 1.5,
                              bgcolor: 'rgba(77,208,225,0.25)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <MovieIcon sx={{ fontSize: { xs: 22, sm: 26, md: 24, lg: 28, xl: 32 }, color: '#4dd0e1' }} />
                          </Box>
                          <Box sx={{ flex: 1 }}>
                            <Typography
                              sx={{
                                color: 'rgba(255,255,255,0.87)',
                                fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' },
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                              }}
                            >{t('crew.card.assignedScenes')}</Typography>
                            <Typography
                              sx={{
                                color: '#fff',
                                fontSize: { xs: '0.95rem', sm: '1.1rem', md: '1.025rem', lg: '1.15rem', xl: '1.25rem' },
                                fontWeight: 700,
                              }}
                            >
                              {t(member.assignedScenes.length === 1 ? 'crew.card.sceneOne' : 'crew.card.sceneMany', { n: member.assignedScenes.length })}
                            </Typography>
                          </Box>
                        </Box>
                      )}
                      {/* ── DOOD strip + shoot day assignments ── */}
                      {productionDays.length > 0 && (
                        <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 2, bgcolor: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.12)' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                              <DoodIcon sx={{ fontSize: 14, color: 'var(--role-cyan, #00d4ff)' }} />
                              <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'var(--role-cyan, #00d4ff)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('crew.card.shootDays')}</Typography>
                            </Box>
                            <Tooltip title={t('crew.tt.manageAssignments')}>
                              <IconButton size="small" onClick={() => handleAssignToScene(member)} sx={{ color: 'rgba(0,212,255,0.7)', p: 0.5, ...focusVisibleStyles }}>
                                <ScheduleIcon sx={{ fontSize: 15 }} />
                              </IconButton>
                            </Tooltip>
                          </Box>
                          <DOODMiniStrip member={member} productionDays={productionDays} assignments={crewAssignments} />
                          {!crewAssignments.some(a => a.crewMemberId === member.id) && (
                            <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>{t('crew.card.notAssignedDays')}</Typography>
                          )}
                        </Box>
                      )}
                    </Box>
                  </Collapse>

                  {/* Availability - compact */}
                  {member.availability?.startDate && member.availability?.endDate && (
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.75,
                        mt: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 },
                      }}
                    >
                      <CalendarTodayIcon sx={{ fontSize: 13, color: roleTextMuted }} />
                      <Typography
                        variant="caption"
                        sx={{
                          color: roleText,
                          display: 'block',
                          fontSize: { xs: '0.75rem', sm: '0.8125rem', md: '0.78125rem', lg: '0.875rem', xl: '1rem' },
                        }}
                      >
                        {member.availability.startDate} - {member.availability.endDate}
                      </Typography>
                    </Box>
                  )}

                  {/* Card Actions - Enhanced */}
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      pt: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
                      mt: 'auto',
                      borderTop: '2px solid rgba(77,208,225,0.2)',
                    }}
                  >
                    <Button
                      variant="contained"
                      size="medium"
                      onClick={() => toggleExpanded(member.id)}
                      endIcon={expandedCards.has(member.id) ? <ExpandLessIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} /> : <ExpandMoreIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
                      aria-expanded={expandedCards.has(member.id)}
                      aria-label={expandedCards.has(member.id) ? t('crew.card.hideDetails') : t('crew.card.showMore')}
                      sx={{
                        bgcolor: expandedCards.has(member.id)
                          ? 'rgba(77,208,225,0.25)'
                          : 'rgba(77,208,225,0.15)',
                        color: expandedCards.has(member.id) ? '#4dd0e1' : '#fff',
                        fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.85rem', lg: '0.88rem', xl: '1rem' },
                        fontWeight: 600,
                        minHeight: TOUCH_TARGET_SIZE,
                        px: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
                        py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
                        border: expandedCards.has(member.id)
                          ? '2px solid rgba(77,208,225,0.5)'
                          : '2px solid rgba(77,208,225,0.3)',
                        borderRadius: 2,
                        textTransform: 'none',
                        boxShadow: expandedCards.has(member.id)
                          ? '0 4px 12px rgba(77,208,225,0.3)'
                          : '0 2px 8px rgba(77,208,225,0.2)',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          bgcolor: 'rgba(77,208,225,0.35)',
                          borderColor: 'rgba(77,208,225,0.6)',
                          transform: 'translateY(-1px)',
                          boxShadow: '0 6px 16px rgba(77,208,225,0.4)',
                        },
                        ...focusVisibleStyles,
                      }}
                    >
                      {expandedCards.has(member.id) ? t('crew.card.hideDetails') : t('crew.card.showDetails')}
                    </Button>
                    <Box sx={{ display: 'flex', gap: { xs: 0.5, sm: 1, md: 0.75, lg: 1, xl: 1.25 } }}>
                      <Tooltip title={t('crew.tt.duplicate')} arrow>
                        <IconButton
                          onClick={() => handleDuplicate(member)}
                          aria-label={t('crew.aria.duplicate', { name: member.name })}
                          sx={{
                            minWidth: TOUCH_TARGET_SIZE,
                            minHeight: TOUCH_TARGET_SIZE,
                            color: 'rgba(255,255,255,0.87)',
                            '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                            ...focusVisibleStyles,
                          }}
                        >
                          <DuplicateIcon sx={{ fontSize: { xs: 20, sm: 22, md: 21, lg: 24, xl: 28 } }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('crew.tt.edit')} arrow>
                        <IconButton
                          onClick={() => handleOpenDialog(member)}
                          aria-label={t('crew.aria.edit', { name: member.name })}
                          sx={{
                            minWidth: TOUCH_TARGET_SIZE,
                            minHeight: TOUCH_TARGET_SIZE,
                            color: '#4dd0e1',
                            '&:hover': { bgcolor: 'rgba(77,208,225,0.1)' },
                            ...focusVisibleStyles,
                          }}
                        >
                          <EditIcon sx={{ fontSize: { xs: 20, sm: 22, md: 21, lg: 24, xl: 28 } }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('crew.tt.assignScene')} arrow>
                        <IconButton
                          onClick={() => handleAssignToScene(member)}
                          aria-label={t('crew.aria.assignToScene', { name: member.name })}
                          sx={{
                            minWidth: TOUCH_TARGET_SIZE,
                            minHeight: TOUCH_TARGET_SIZE,
                            color: 'rgba(0,212,255,0.7)',
                            '&:hover': { bgcolor: 'rgba(0,212,255,0.1)' },
                            ...focusVisibleStyles,
                          }}
                        >
                          <AssignIcon sx={{ fontSize: { xs: 20, sm: 22, md: 21, lg: 24, xl: 28 } }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('crew.tt.delete')} arrow>
                        <IconButton
                          onClick={() => handleDeleteWithUndo(member.id)}
                          aria-label={t('crew.aria.delete', { name: member.name })}
                          sx={{
                            minWidth: TOUCH_TARGET_SIZE,
                            minHeight: TOUCH_TARGET_SIZE,
                            color: '#ff4444',
                            '&:hover': { bgcolor: 'rgba(255,68,68,0.1)' },
                            ...focusVisibleStyles,
                          }}
                        >
                          <DeleteIcon sx={{ fontSize: { xs: 20, sm: 22, md: 21, lg: 24, xl: 28 } }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

        </Box>{/* end center box */}
      </Box>{/* end main body */}

      {/* ── BULK ACTION BAR ── */}
      <CrewBulkBar
        selectedIds={selectedIds}
        totalCount={filteredAndSortedCrew.length}
        isAllSelected={selectedIds.size === filteredAndSortedCrew.length && filteredAndSortedCrew.length > 0}
        onSelectAll={handleSelectAll}
        onDelete={handleBulkDelete}
        onChangeStatus={handleBulkStatusChange}
        onDeselect={() => setSelectedIds(new Set())}
        onAssignDay={handleBulkAssignDay}
        productionDays={productionDays}
      />

      {/* ── INVITE CREW DIALOG ── */}
      <InviteCrewDialog
        open={inviteDialogOpen}
        onClose={() => setInviteDialogOpen(false)}
        onInvite={handleInviteCrew}
        getRoleLabel={getRoleLabel}
        crewRoles={crewRoles}
      />

      {/* ── PROJECT WHATSAPP GROUP DIALOG ── */}
      <ProjectWhatsAppGroupDialog
        open={whatsAppGroupDialogOpen}
        projectId={projectId}
        onClose={() => setWhatsAppGroupDialogOpen(false)}
      />

      {/* ── ASSIGN TO SHOOT DAY DIALOG ── */}
      <AssignShootDayDialog
        open={assignDayOpen}
        onClose={() => { setAssignDayOpen(false); setAssigningMember(null); }}
        member={assigningMember}
        productionDays={productionDays}
        assignments={crewAssignments}
        onAssign={handleCrewAssign}
        onUnassign={handleCrewUnassign}
      />

      {/* ── DOOD OVERVIEW DRAWER ── */}
      <DOODOverviewPanel
        open={doodOpen}
        onClose={() => setDoodOpen(false)}
        crewMembers={crewMembers}
        productionDays={productionDays}
        assignments={crewAssignments}
        getRoleLabel={getRoleLabel}
      />

      {/* ── CALLSHEET DRAWER ── */}
      <CallsheetDrawer
        open={callsheetOpen}
        onClose={() => setCallsheetOpen(false)}
        projectId={projectId}
        crew={callsheetCrewPool}
        selectedDay={callsheetDay}
        scenes={resolvedScenes}
        productionDays={productionDays}
      />

      {/* ── CREW MANAGEMENT GUIDE ── */}
      <CrewManagementGuide
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
      />

      <Drawer
        anchor="right"
        open={activityOpen}
        onClose={() => setActivityOpen(false)}
        PaperProps={{ sx: { width: { xs: '100vw', sm: 420 }, bgcolor: '#13181e', color: '#fff', borderLeft: '1px solid rgba(184,107,255,0.32)' } }}
      >
        <Box sx={{ p: 2, borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography sx={{ fontWeight: 700, color: '#ffffff' }}>{t('crew.tt.activityLog')}</Typography>
          <Button
            size="small"
            onClick={() => {
              setActivityLog([]);
              try {
                localStorage.removeItem(ACTIVITY_LOG_KEY);
              } catch {
                // Ignore storage errors in local dev/private mode.
              }
            }}
            sx={{ color: 'rgba(255,255,255,0.75)' }}
          >
            {t('crew.activity.clear')}
          </Button>
        </Box>
        <List dense sx={{ py: 0 }}>
          {activityLog.length === 0 && (
            <ListItem>
              <ListItemText primary={t('crew.activity.empty')} secondary={t('crew.activity.emptyDesc')} />
            </ListItem>
          )}
          {activityLog.map((entry) => (
            <ListItem key={entry.id} divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <ListItemText
                primary={<Typography sx={{ fontSize: 13, color: '#fff', fontWeight: 700 }}>{entry.action}</Typography>}
                secondary={
                  <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.72)' }}>
                    {entry.details} • {new Date(entry.timestamp).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}
                  </Typography>
                }
              />
            </ListItem>
          ))}
        </List>
      </Drawer>

      <Dialog
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { bgcolor: '#13181e', border: '1px solid rgba(184,107,255,0.3)' } }}
      >
        <DialogTitle sx={{ color: '#fff', fontWeight: 700, pb: 1 }}>
          Command palette
        </DialogTitle>
        <DialogContent sx={{ pt: '8px !important' }}>
          <TextField
            inputRef={commandInputRef}
            fullWidth
            placeholder={t('crew.cmd.searchPlaceholder')}
            value={commandQuery}
            onChange={(event) => setCommandQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && filteredCommandActions[0]) {
                event.preventDefault();
                runCommandAction(filteredCommandActions[0]);
              }
            }}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: 'rgba(255,255,255,0.6)' }} /></InputAdornment> } }}
            sx={{ mb: 1.25, '& .MuiOutlinedInput-root': { color: '#fff', '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } }}
          />
          <List dense sx={{ maxHeight: 320, overflowY: 'auto', bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 1.5 }}>
            {filteredCommandActions.map((action) => (
              <ListItemButton
                key={action.id}
                onClick={() => runCommandAction(action)}
                sx={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
              >
                <ListItemText
                  primary={<Typography sx={{ fontSize: 13, color: '#fff' }}>{action.label}</Typography>}
                  secondary={action.shortcut ? <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{action.shortcut}</Typography> : null}
                />
              </ListItemButton>
            ))}
          </List>
        </DialogContent>
      </Dialog>

      {/* Undo delete snackbar */}
      <Snackbar
        open={showUndoSnackbar}
        autoHideDuration={6000}
        onClose={() => {
          setShowUndoSnackbar(false);
          setDeletedCrew(null);
        }}
        message={deletedCrew ? t('crew.snackbar.deleted', { name: deletedCrew.name }) : t('crew.snackbar.memberDeleted')}
        action={
          <>
            <Button
              color="primary"
              size="small"
              onClick={handleUndoDelete}
              startIcon={<UndoIcon />}
              sx={{ color: 'var(--role-cyan, #00d4ff)', fontWeight: 600 }}
            >
              {t('crew.snackbar.undo')}
            </Button>
            <IconButton
              size="small"
              aria-label={t('crew.aria.close')}
              color="inherit"
              onClick={() => {
                setShowUndoSnackbar(false);
                setDeletedCrew(null);
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </>
        }
        sx={{
          '& .MuiSnackbarContent-root': {
            bgcolor: '#1c2128',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)',
          },
        }}
      />

      {/* Edit/Create Dialog - WCAG 2.2 compliant and responsive */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile} // Full screen on mobile for better UX
        container={() => document.body}
        aria-labelledby={dialogTitleId}
        aria-describedby={dialogDescId}
        TransitionComponent={Grow}
        TransitionProps={{
          timeout: { enter: 225, exit: 150 },
          enter: true,
          exit: true,
        }}
        slotProps={{
          paper: {
            sx: {
              background:
                'linear-gradient(160deg, rgba(8,5,20,0.96) 0%, rgba(14,10,34,0.93) 52%, rgba(24,17,49,0.9) 100%)',
              color: '#fff',
              // iPad-friendly: ensure dialog doesn't go off-screen
              maxHeight: { xs: '100%', sm: '90vh' },
              m: { xs: 0, sm: 2, md: 2.5, lg: 3, xl: 4 },
              borderRadius: { xs: 0, sm: 2.5 },
              maxWidth: { xs: '95vw', sm: '90vw', md: '85vw', lg: '80vw', xl: '75vw' },
              border: '1px solid rgba(184,107,255,0.34)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
              willChange: 'transform, opacity',
              transformOrigin: 'center center',
              zIndex: 100000,
            },
          },
        }}
        sx={{
          zIndex: 100000,
          '& .MuiBackdrop-root': {
            zIndex: 99998,
            bgcolor: 'rgba(8,5,20,0.86)',
            backdropFilter: 'blur(3px)',
            willChange: 'opacity',
          },
          '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: `${roleTabAccent} !important`,
            borderWidth: '2px !important',
          },
          '& .MuiInputLabel-root.Mui-focused': {
            color: `${roleTabAccent} !important`,
          },
        }}
      >
        <DialogTitle
          id={dialogTitleId}
          sx={{
            color: '#fff',
            borderBottom: '1px solid rgba(184,107,255,0.34)',
            fontSize: { xs: '1.1rem', sm: '1.25rem', md: '1.2rem', lg: '1.375rem', xl: '1.75rem' },
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            py: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
            px: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
            gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
            background: 'linear-gradient(180deg, rgba(184,107,255,0.16) 0%, rgba(184,107,255,0.04) 100%)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box
              sx={{
                width: 34,
                height: 34,
                borderRadius: 1.5,
                border: '1px solid rgba(184,107,255,0.42)',
                background: 'linear-gradient(135deg, rgba(184,107,255,0.28), rgba(88,28,135,0.2))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <GroupsIcon sx={{ color: '#e9d5ff', fontSize: 18 }} />
            </Box>
            <Typography sx={{ fontSize: { xs: '1rem', sm: '1.1rem' }, fontWeight: 700 }}>
              {editingCrewMember ? t('crew.dialog.editMember') : t('crew.dialog.newMember')}
            </Typography>
          </Box>
          <IconButton
            onClick={handleCloseDialog}
            aria-label={t('crew.aria.closeDialog')}
            sx={{
              color: 'rgba(255,255,255,0.87)',
              border: '1px solid rgba(184,107,255,0.34)',
              bgcolor: 'rgba(255,255,255,0.02)',
              '&:hover': { bgcolor: 'rgba(184,107,255,0.14)' },
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent
          sx={{
            pt: { xs: 2, sm: 3, md: 2.75, lg: 3, xl: 3.5 },
            px: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
            pb: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
            // Better scroll behavior for iPad
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            bgcolor: 'rgba(15,23,42,0.25)',
          }}
        >
          <Typography
            id={dialogDescId}
            variant="body2"
            sx={{ color: 'rgba(255,255,255,0.87)', mb: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }, fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}
          >
            {t('crew.dialog.desc')}
          </Typography>
          <Stack spacing={{ xs: 2.5, sm: 3, md: 2.75, lg: 3, xl: 3.5 }} sx={{ mt: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
            <TextField
              label={t('crew.field.nameRequired')}
              fullWidth
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              autoComplete="name"
              slotProps={{
                htmlInput: {
                  'aria-required': true,
                  'aria-label': t('crew.aria.nameField'),
                },
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonNameIcon sx={{ color: 'rgba(255,255,255,0.87)', fontSize: 20 }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  minHeight: { xs: 40, sm: 44, md: 48, lg: 52, xl: 60 },
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                  '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.5)' },
                  '&.Mui-focused fieldset': { borderColor: 'var(--role-cyan, #00d4ff)', borderWidth: 2 },
                  '& input': {
                    py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 },
                  },
                },
                '& .MuiInputLabel-root': { 
                  color: 'rgba(255,255,255,0.87)',
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                },
                '& .MuiInputLabel-root.Mui-focused': { color: 'var(--role-cyan, #00d4ff)' },
              }}
            />

            <FormControl fullWidth>
              <InputLabel
                id="crew-role-label"
                sx={{
                  color: 'rgba(255,255,255,0.87)',
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                  '&.Mui-focused': { color: 'var(--role-cyan, #00d4ff)' },
                }}
              >
                {t('crew.field.role')}
              </InputLabel>
              <Select
                labelId="crew-role-label"
                value={formData.role || 'other'}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as CrewRole })}
                label={t('crew.field.role')}
                inputProps={{ 'aria-label': t('crew.aria.roleField') }}
                MenuProps={{
                  sx: { zIndex: 100001 },
                  slotProps: {
                    paper: {
                      sx: {
                        bgcolor: '#1c2128',
                        color: '#fff',
                        maxHeight: 300,
                        '& .MuiMenuItem-root': {
                          '&:hover': { bgcolor: 'rgba(184,107,255,0.12)' },
                          '&.Mui-selected': { bgcolor: 'rgba(184,107,255,0.2)' },
                        },
                      },
                    },
                  },
                }}
                sx={{
                  color: '#fff',
                  minHeight: { xs: 40, sm: 44, md: 48, lg: 52, xl: 60 },
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--role-cyan, #00d4ff)', borderWidth: 2 },
                  '& .MuiSelect-select': {
                    py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 },
                  },
                }}
              >
                {crewRoles.map((role) => (
                  <MenuItem
                    key={role}
                    value={role}
                    sx={{
                      minHeight: { xs: 40, sm: 44, md: 48, lg: 52, xl: 60 },
                      fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                      py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 },
                      '&:focus-visible': { bgcolor: 'rgba(184,107,255,0.2)' },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 } }}>
                      {getRoleIcon(role)}
                      <span>{getRoleLabel(role)}</span>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label={t('crew.field.email')}
              fullWidth
              type="email"
              inputMode="email"
              autoComplete="email"
              value={formData.contactInfo?.email || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  contactInfo: { ...formData.contactInfo, email: e.target.value },
                })
              }
              slotProps={{ htmlInput: { 'aria-label': t('crew.aria.emailField') } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <CustomEmailIcon sx={{ color: 'rgba(255,255,255,0.87)', fontSize: 20 }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  minHeight: { xs: 40, sm: 44, md: 48, lg: 52, xl: 60 },
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                  '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.5)' },
                  '&.Mui-focused fieldset': { borderColor: 'var(--role-cyan, #00d4ff)', borderWidth: 2 },
                  '& input': {
                    py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 },
                  },
                },
                '& .MuiInputLabel-root': { 
                  color: 'rgba(255,255,255,0.87)',
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                },
                '& .MuiInputLabel-root.Mui-focused': { color: 'var(--role-cyan, #00d4ff)' },
              }}
            />

            <TextField
              label={t('crew.field.phone')}
              fullWidth
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={formData.contactInfo?.phone || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  contactInfo: { ...formData.contactInfo, phone: e.target.value },
                })
              }
              slotProps={{ htmlInput: { 'aria-label': t('crew.aria.phoneField') } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <CustomPhoneIcon sx={{ color: 'rgba(255,255,255,0.87)', fontSize: 20 }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  minHeight: { xs: 40, sm: 44, md: 48, lg: 52, xl: 60 },
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                  '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.5)' },
                  '&.Mui-focused fieldset': { borderColor: 'var(--role-cyan, #00d4ff)', borderWidth: 2 },
                  '& input': {
                    py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 },
                  },
                },
                '& .MuiInputLabel-root': { 
                  color: 'rgba(255,255,255,0.87)',
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                },
                '& .MuiInputLabel-root.Mui-focused': { color: 'var(--role-cyan, #00d4ff)' },
              }}
            />

            <TextField
              label={t('crew.field.address')}
              fullWidth
              autoComplete="street-address"
              value={formData.contactInfo?.address || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  contactInfo: { ...formData.contactInfo, address: e.target.value },
                })
              }
              slotProps={{ htmlInput: { 'aria-label': t('crew.aria.addressField') } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <AddressIcon sx={{ color: 'rgba(255,255,255,0.87)', fontSize: 20 }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  minHeight: { xs: 40, sm: 44, md: 48, lg: 52, xl: 60 },
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                  '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.5)' },
                  '&.Mui-focused fieldset': { borderColor: 'var(--role-cyan, #00d4ff)', borderWidth: 2 },
                  '& input': {
                    py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 },
                  },
                },
                '& .MuiInputLabel-root': { 
                  color: 'rgba(255,255,255,0.87)',
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                },
                '& .MuiInputLabel-root.Mui-focused': { color: 'var(--role-cyan, #00d4ff)' },
              }}
            />

            <TextField
              label={t('crew.field.rate')}
              fullWidth
              type="number"
              value={formData.rate || ''}
              onChange={(e) => setFormData({ ...formData, rate: parseInt(e.target.value) || undefined })}
              slotProps={{ htmlInput: { 'aria-label': t('crew.aria.rateField'), min: 0 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <RateIcon sx={{ color: 'rgba(255,255,255,0.87)', fontSize: 20 }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  minHeight: { xs: 40, sm: 44, md: 48, lg: 52, xl: 60 },
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                  '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.5)' },
                  '&.Mui-focused fieldset': { borderColor: 'var(--role-cyan, #00d4ff)', borderWidth: 2 },
                  '& input': {
                    py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 },
                  },
                },
                '& .MuiInputLabel-root': { 
                  color: 'rgba(255,255,255,0.87)',
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                },
                '& .MuiInputLabel-root.Mui-focused': { color: 'var(--role-cyan, #00d4ff)' },
              }}
            />

            {/* Split Sheet Section - synced with NewProjectCreationModal */}
            <Box sx={{ mt: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
              <Typography
                variant="subtitle2"
                sx={{
                  color: '#f59e0b',
                  fontWeight: 600,
                  mb: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                  display: 'flex',
                  alignItems: 'center',
                  gap: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                }}
              >
                <SplitSheetIcon sx={{ color: '#f59e0b', fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 20 } }} />
                Split Sheet
              </Typography>
              
              <Stack spacing={{ xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }}>
                {/* Total Budget Input - only show if not provided via props */}
                {totalBudget === 0 && (
                  <TextField
                    label={t('crew.split.totalBudget')}
                    fullWidth
                    type="number"
                    value={localBudget || ''}
                    onChange={(e) => {
                      const newBudget = parseFloat(e.target.value) || 0;
                      setLocalBudget(newBudget);
                      onTotalBudgetChange?.(newBudget);
                    }}
                    slotProps={{ 
                      htmlInput: { 
                        'aria-label': t('crew.aria.budgetField'), 
                        min: 0 
                      } 
                    }}
                    helperText={t('crew.split.budgetHelper')}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        color: '#fff',
                        minHeight: { xs: 40, sm: 44, md: 48, lg: 52, xl: 60 },
                        fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                        '& fieldset': { borderColor: 'rgba(245,158,11,0.5)' },
                        '&:hover fieldset': { borderColor: 'rgba(245,158,11,0.7)' },
                        '&.Mui-focused fieldset': { borderColor: '#f59e0b', borderWidth: 2 },
                        '& input': {
                          py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 },
                        },
                      },
                      '& .MuiInputLabel-root': { 
                        color: '#f59e0b',
                        fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                      },
                      '& .MuiInputLabel-root.Mui-focused': { color: '#f59e0b' },
                      '& .MuiFormHelperText-root': { 
                        color: 'rgba(255,255,255,0.87)',
                        fontSize: { xs: '0.75rem', sm: '0.8125rem', md: '0.78125rem', lg: '0.875rem', xl: '1rem' },
                      },
                    }}
                  />
                )}

                {/* Calculated percentage display */}
                {effectiveBudget > 0 && formData.rate && formData.rate > 0 && (
                  <Alert 
                    severity="info" 
                    sx={{ 
                      bgcolor: 'rgba(245,158,11,0.1)', 
                      color: '#f59e0b',
                      border: '1px solid rgba(245,158,11,0.3)',
                      p: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                      '& .MuiAlert-icon': { color: '#f59e0b', fontSize: { xs: 20, sm: 22, md: 21, lg: 24, xl: 28 } },
                      '& .MuiAlert-message': { fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } },
                    }}
                  >
                    <Typography variant="body2" sx={{ fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>
                      <strong>{t('crew.split.calculatedShare')}</strong> {calculatedPercentage.toFixed(2)}% {t('crew.split.ofBudget')}
                      <br />
                      <span style={{ fontSize: '0.85em', opacity: 0.8 }}>
                        ({formData.rate?.toLocaleString('no-NO')} kr / {effectiveBudget.toLocaleString('no-NO')} kr)
                      </span>
                    </Typography>
                  </Alert>
                )}

                <TextField
                  label={t('crew.split.percent')}
                  fullWidth
                  type="number"
                  value={formData.splitSheet?.percentage?.toFixed(2) ?? ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    splitSheet: {
                      ...(formData.splitSheet ?? {}),
                      percentage: parseFloat(e.target.value) || 0 
                    }
                  })}
                  slotProps={{ 
                    htmlInput: { 
                      'aria-label': t('crew.aria.percentField'), 
                      min: 0, 
                      max: 100, 
                      step: 0.01,
                      readOnly: effectiveBudget > 0 && formData.rate ? true : false
                    } 
                  }}
                  helperText={
                    effectiveBudget > 0 && formData.rate 
                      ? t('crew.split.percentHelperAuto')
                      : t('crew.split.percentHelperManual')
                  }
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: '#fff',
                      minHeight: { xs: 40, sm: 44, md: 48, lg: 52, xl: 60 },
                      fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                      '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                      '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.5)' },
                      '&.Mui-focused fieldset': { borderColor: 'var(--role-cyan, #00d4ff)', borderWidth: 2 },
                      '& input': {
                        py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 },
                      },
                      ...(effectiveBudget > 0 && formData.rate && {
                        bgcolor: 'rgba(245,158,11,0.1)',
                        '& fieldset': { borderColor: 'rgba(245,158,11,0.3)' },
                      }),
                    },
                    '& .MuiInputLabel-root': { 
                      color: 'rgba(255,255,255,0.87)',
                      fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                    },
                    '& .MuiInputLabel-root.Mui-focused': { color: 'var(--role-cyan, #00d4ff)' },
                    '& .MuiFormHelperText-root': { 
                      color: 'rgba(255,255,255,0.87)',
                      fontSize: { xs: '0.75rem', sm: '0.8125rem', md: '0.78125rem', lg: '0.875rem', xl: '1rem' },
                    },
                  }}
                />

                <FormControl fullWidth>
                  <InputLabel
                    id="invitation-status-label"
                    sx={{
                      color: 'rgba(255,255,255,0.87)',
                      fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                      '&.Mui-focused': { color: 'var(--role-cyan, #00d4ff)' },
                    }}
                  >
                    {t('crew.split.invStatus')}
                  </InputLabel>
                  <Select
                    labelId="invitation-status-label"
                    value={formData.splitSheet?.invitationStatus || 'not_sent'}
                    onChange={(e) => setFormData({
                      ...formData,
                      splitSheet: {
                        ...(formData.splitSheet ?? {}),
                        percentage: formData.splitSheet?.percentage ?? 0,
                        invitationStatus: e.target.value as 'not_sent' | 'sent' | 'viewed' | 'signed' | 'declined'
                      }
                    })}
                    label={t('crew.split.invStatus')}
                    inputProps={{ 'aria-label': t('crew.aria.invStatusField') }}
                    MenuProps={{
                      sx: { zIndex: 100001 },
                      slotProps: {
                        paper: {
                          sx: {
                            bgcolor: '#1c2128',
                            color: '#fff',
                            '& .MuiMenuItem-root': {
                              '&:hover': { bgcolor: 'rgba(184,107,255,0.12)' },
                              '&.Mui-selected': { bgcolor: 'rgba(184,107,255,0.2)' },
                            },
                          },
                        },
                      },
                    }}
                    sx={{
                      color: '#fff',
                      minHeight: { xs: 40, sm: 44, md: 48, lg: 52, xl: 60 },
                      fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--role-cyan, #00d4ff)', borderWidth: 2 },
                      '& .MuiSelect-select': {
                        py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 },
                      },
                    }}
                  >
                    <MenuItem value="not_sent" sx={{ minHeight: { xs: 40, sm: 44, md: 48, lg: 52, xl: 60 }, fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' }, py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 } }}>
                      {t('crew.invStatus.notSent')}
                    </MenuItem>
                    <MenuItem value="sent" sx={{ minHeight: { xs: 40, sm: 44, md: 48, lg: 52, xl: 60 }, fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' }, py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 } }}>
                      {t('crew.invStatus.sent')}
                    </MenuItem>
                    <MenuItem value="viewed" sx={{ minHeight: { xs: 40, sm: 44, md: 48, lg: 52, xl: 60 }, fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' }, py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 } }}>
                      {t('crew.invStatus.viewed')}
                    </MenuItem>
                    <MenuItem value="signed" sx={{ minHeight: { xs: 40, sm: 44, md: 48, lg: 52, xl: 60 }, fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' }, py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 } }}>
                      {t('crew.invStatus.signed')}
                    </MenuItem>
                    <MenuItem value="declined" sx={{ minHeight: { xs: 40, sm: 44, md: 48, lg: 52, xl: 60 }, fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' }, py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 } }}>
                      {t('crew.invStatus.declined')}
                    </MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  label={t('crew.split.notes')}
                  fullWidth
                  multiline
                  rows={2}
                  value={formData.splitSheet?.notes || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    splitSheet: {
                      ...(formData.splitSheet ?? {}),
                      percentage: formData.splitSheet?.percentage ?? 0,
                      notes: e.target.value 
                    }
                  })}
                  placeholder={t('crew.split.notesPlaceholder')}
                  slotProps={{ htmlInput: { 'aria-label': t('crew.aria.splitNotesField') } }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: '#fff',
                      fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                      '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                      '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.5)' },
                      '&.Mui-focused fieldset': { borderColor: 'var(--role-cyan, #00d4ff)', borderWidth: 2 },
                      '& textarea': {
                        py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 },
                      },
                    },
                    '& .MuiInputLabel-root': { 
                      color: 'rgba(255,255,255,0.87)',
                      fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                    },
                    '& .MuiInputLabel-root.Mui-focused': { color: 'var(--role-cyan, #00d4ff)' },
                  }}
                />
                {(() => {
                  const splitSheetMeta =
                    formData.splitSheet && typeof formData.splitSheet === 'object'
                      ? (formData.splitSheet as Record<string, unknown>)
                      : undefined;
                  const rawAuthor =
                    splitSheetMeta?.notesAuthorName
                    ?? splitSheetMeta?.notesAuthor
                    ?? splitSheetMeta?.notesBy;
                  const rawUpdatedAt =
                    splitSheetMeta?.notesUpdatedAt
                    ?? splitSheetMeta?.notesLastEditedAt
                    ?? splitSheetMeta?.notesTimestamp;
                  const authorText =
                    typeof rawAuthor === 'string' && rawAuthor.trim().length > 0
                      ? rawAuthor.trim()
                      : t('crew.notRegistered');
                  const updatedText = formatCrewNoteTimestamp(rawUpdatedAt);
                  return (
                    <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.72rem' }}>
                      {t('crew.split.writtenBy')} {authorText}{updatedText ? ` • ${updatedText}` : ''}
                    </Typography>
                  );
                })()}
                <GlobalMentionHelper
                  text={typeof formData.splitSheet?.notes === 'string' ? formData.splitSheet.notes : ''}
                  localCandidates={mentionCandidates}
                  onApplySuggestion={(name) =>
                    setFormData((prev) => ({
                      ...prev,
                      splitSheet: {
                        ...(prev.splitSheet ?? {}),
                        percentage: prev.splitSheet?.percentage ?? 0,
                        notes: applyMentionSuggestion(
                          typeof prev.splitSheet?.notes === 'string' ? prev.splitSheet.notes : '',
                          name,
                        ),
                      },
                    }))
                  }
                />
              </Stack>
            </Box>

            <TextField
              label={t('crew.field.availFrom')}
              fullWidth
              type="date"
              value={formData.availability?.startDate || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  availability: { ...formData.availability, startDate: e.target.value },
                })
              }
              slotProps={{
                inputLabel: { shrink: true },
                htmlInput: { 'aria-label': t('crew.aria.availFromField') },
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  minHeight: { xs: 40, sm: 44, md: 48, lg: 52, xl: 60 },
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                  '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.5)' },
                  '&.Mui-focused fieldset': { borderColor: 'var(--role-cyan, #00d4ff)', borderWidth: 2 },
                  '& input': {
                    py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 },
                  },
                },
                '& .MuiInputLabel-root': { 
                  color: 'rgba(255,255,255,0.87)',
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                },
                '& .MuiInputLabel-root.Mui-focused': { color: 'var(--role-cyan, #00d4ff)' },
              }}
            />

            <TextField
              label={t('crew.field.availTo')}
              fullWidth
              type="date"
              value={formData.availability?.endDate || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  availability: { ...formData.availability, endDate: e.target.value },
                })
              }
              slotProps={{
                inputLabel: { shrink: true },
                htmlInput: { 'aria-label': t('crew.aria.availToField') },
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  minHeight: { xs: 40, sm: 44, md: 48, lg: 52, xl: 60 },
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                  '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.5)' },
                  '&.Mui-focused fieldset': { borderColor: 'var(--role-cyan, #00d4ff)', borderWidth: 2 },
                  '& input': {
                    py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 },
                  },
                },
                '& .MuiInputLabel-root': { 
                  color: 'rgba(255,255,255,0.87)',
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                },
                '& .MuiInputLabel-root.Mui-focused': { color: 'var(--role-cyan, #00d4ff)' },
              }}
            />

            <TextField
              label={t('crew.field.notes')}
              fullWidth
              multiline
              rows={3}
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              slotProps={{ htmlInput: { 'aria-label': t('crew.aria.notesField') } }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                  '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.5)' },
                  '&.Mui-focused fieldset': { borderColor: 'var(--role-cyan, #00d4ff)', borderWidth: 2 },
                  '& textarea': {
                    py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 },
                  },
                },
                '& .MuiInputLabel-root': { 
                  color: 'rgba(255,255,255,0.87)',
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                },
                '& .MuiInputLabel-root.Mui-focused': { color: 'var(--role-cyan, #00d4ff)' },
              }}
            />
            <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.72rem' }}>
              {t('crew.card.writtenBy')} {(() => {
                const rawAuthor =
                  formData.notesAuthorName
                  ?? formData.notesAuthor
                  ?? formData.notesBy;
                return typeof rawAuthor === 'string' && rawAuthor.trim().length > 0
                  ? rawAuthor.trim()
                  : t('crew.notRegistered');
              })()}
              {(() => {
                const rawUpdatedAt =
                  formData.notesUpdatedAt
                  ?? formData.notesLastEditedAt
                  ?? formData.notesTimestamp;
                const updatedText = formatCrewNoteTimestamp(rawUpdatedAt);
                return updatedText ? ` • ${updatedText}` : '';
              })()}
            </Typography>
            <GlobalMentionHelper
              text={typeof formData.notes === 'string' ? formData.notes : ''}
              localCandidates={mentionCandidates}
              onApplySuggestion={(name) =>
                setFormData((prev) => ({
                  ...prev,
                  notes: applyMentionSuggestion(typeof prev.notes === 'string' ? prev.notes : '', name),
                }))
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions
          sx={{
            borderTop: '1px solid rgba(184,107,255,0.28)',
            p: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
            gap: { xs: 1, sm: 1.5, md: 1.25, lg: 1.5, xl: 2 },
            flexDirection: { xs: 'column-reverse', sm: 'row' },
            justifyContent: { xs: 'stretch', sm: 'flex-end' },
            // Sticky at bottom for mobile
            position: { xs: 'sticky', sm: 'relative' },
            bottom: 0,
            bgcolor: 'rgba(17,24,39,0.85)',
          }}
        >
          <Button
            onClick={handleCloseDialog}
            startIcon={<CancelIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
            aria-label={t('crew.aria.cancelDialog')}
            fullWidth={isMobile}
            sx={{
              color: 'rgba(255,255,255,0.87)',
              minHeight: TOUCH_TARGET_SIZE,
              minWidth: { xs: 'auto', sm: 100, md: 110, lg: 120, xl: 140 },
              fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
              px: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
              py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
              border: '1px solid rgba(184,107,255,0.34)',
              bgcolor: 'rgba(255,255,255,0.02)',
              ...focusVisibleStyles,
              '&:hover': { bgcolor: 'rgba(184,107,255,0.14)' },
            }}
          >{t('crew.action.cancel')}</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            startIcon={<SaveIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
            aria-label={editingCrewMember ? t('crew.aria.saveChanges') : t('crew.aria.createNew')}
            fullWidth={isMobile}
            sx={{
              bgcolor: roleTabAccent,
              color: '#fff',
              fontWeight: 700,
              fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
              px: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
              py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
              minHeight: TOUCH_TARGET_SIZE,
              minWidth: { xs: 'auto', sm: 100 },
              ...focusVisibleStyles,
              boxShadow: '0 10px 24px rgba(88,28,135,0.35)',
              '&:hover': { bgcolor: roleTabAccentHover, boxShadow: '0 12px 28px rgba(88,28,135,0.45)' },
            }}
          >{t('crew.action.save')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
