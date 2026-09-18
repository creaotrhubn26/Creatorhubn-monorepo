import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  LinearProgress,
  MenuItem,
  Slider,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import PersonSearchOutlinedIcon from '@mui/icons-material/PersonSearchOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import SyncOutlinedIcon from '@mui/icons-material/SyncOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';

import { CvImportVerificationDialog } from './CvImportVerificationDialog';

import {
  WORKSPACE_PROJECT_CATEGORY_LABELS,
  WORKSPACE_PROJECT_LINK_LABELS,
  WORKSPACE_PROJECT_STATUS_LABELS,
  workspaceProjectsApi,
  type WorkspaceProject,
  type WorkspaceProjectFile,
  type WorkspaceProjectCategory,
  type WorkspaceProjectLink,
  type WorkspaceProjectLinkOption,
  type WorkspaceProjectLinkType,
  type WorkspaceProjectPriority,
  type WorkspaceProjectStatus,
} from '../../services/adminRoomApi';

const BRAND = {
  panelBg: 'rgba(26, 10, 46, 0.72)',
  panelSolid: '#1a0a2e',
  accent: '#a78bfa',
  accentStrong: '#7c3aed',
  border: 'rgba(167, 139, 250, 0.2)',
  borderHover: 'rgba(167, 139, 250, 0.42)',
  text: '#f1f5f9',
  textMuted: 'rgba(241, 245, 249, 0.76)',
  textDim: 'rgba(241, 245, 249, 0.52)',
  hoverBg: 'rgba(167, 139, 250, 0.08)',
  selectedBg: 'rgba(167, 139, 250, 0.15)',
};

const STATUS_COLORS: Record<WorkspaceProjectStatus, string> = {
  planned: '#94a3b8',
  active: '#22c55e',
  blocked: '#ef4444',
  on_hold: '#f59e0b',
  completed: '#38bdf8',
  archived: '#64748b',
};

const PRIORITY_LABELS: Record<WorkspaceProjectPriority, string> = {
  low: 'Lav',
  normal: 'Normal',
  high: 'Høy',
  urgent: 'Haster',
};

const LINK_ROUTES: Record<WorkspaceProjectLinkType, string> = {
  funding_app: 'funding',
  industry_target: 'industry-crm',
  leadgrid_lead: 'marketing-cockpit',
  investor: 'investors',
  partner: 'partners',
  workspace_case: 'cases',
};

const fieldSx = {
  '& .MuiInputBase-root': { color: BRAND.text },
  '& .MuiInputLabel-root': { color: BRAND.textDim },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: BRAND.border },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: BRAND.borderHover },
  '& .MuiSvgIcon-root': { color: BRAND.textDim },
};

function formatDate(value: string | null): string {
  if (!value) return 'Ingen frist';
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function dueTone(value: string | null): string {
  if (!value) return BRAND.textDim;
  const due = new Date(`${value.slice(0, 10)}T23:59:59`).getTime();
  if (due < Date.now()) return '#f87171';
  if (due - Date.now() < 14 * 86_400_000) return '#fbbf24';
  return BRAND.textMuted;
}

function productLabel(value: WorkspaceProject['product_key']): string {
  if (value === 'role_room') return 'The Role Room';
  if (value === 'leadgrid') return 'Leadgrid';
  return 'Creatorhub / internt';
}

function formatFileSize(value: number | string): string {
  const bytes = Number(value || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / (1024 * 1024)).toLocaleString('nb-NO', { maximumFractionDigits: 1 })} MB`;
}

function extractionStatus(file: WorkspaceProjectFile): {
  label: string;
  color: 'success' | 'warning' | 'error' | 'default';
} {
  if (file.extraction_status === 'ready') return { label: 'Klar som kilde', color: 'success' };
  if (file.extraction_status === 'processing') return { label: 'Leser innhold', color: 'warning' };
  if (file.extraction_status === 'failed') return { label: 'Kunne ikke leses', color: 'error' };
  if (file.extraction_status === 'unsupported') return { label: 'Ikke søkbar', color: 'default' };
  return { label: 'Venter', color: 'warning' };
}

interface ProjectsTabProps {
  parentProduct: 'roleroom' | 'leadgrid';
}

interface CreateDraft {
  title: string;
  summary: string;
  category: WorkspaceProjectCategory;
  productKey: 'role_room' | 'leadgrid' | 'internal';
  targetDate: string;
}

function newCreateDraft(parentProduct: ProjectsTabProps['parentProduct']): CreateDraft {
  return {
    title: '',
    summary: '',
    category: 'internal',
    productKey: parentProduct === 'roleroom' ? 'role_room' : 'leadgrid',
    targetDate: '',
  };
}

const CONTEXT_COPY = {
  roleroom: {
    heading: 'Adminprosjekter — The Role Room',
    description: 'Styr The Role Room-initiativer som støttearbeid, partnerskap og markedsinngang. Her bygger du relasjoner med castingbyråer og andre nøkkelpersoner i markedet.',
    relationStat: 'Koblede markedskontakter',
    emptyProject: 'Start for eksempel «Innovasjon Norge-søknad» eller «Møte castingbyråene».',
    linkedWork: 'Søknader, bransjekontakter og saker som driver prosjektet fremover.',
    emptyLink: 'Koble for eksempel Innovasjon Norge-søknaden eller castingbyråene du følger opp.',
    linkSearch: 'Søk etter søknad, person, partner eller sak',
    noLink: 'Opprett søknaden eller kontakten i riktig adminmodul først.',
  },
  leadgrid: {
    heading: 'Adminprosjekter — Leadgrid',
    description: 'Styr Leadgrid som et operativt vekstløp: markedsinngang, pilotkunder, byråpartnerskap og oppfølging fra første kontakt til betalende kunde.',
    relationStat: 'Koblede leads / kunder',
    emptyProject: 'Start for eksempel «Pilotløp med fem norske B2B-byråer» eller «Leadgrid-partnerprogram».',
    linkedWork: 'Leadgrid-leads, søknader, partnere og saker som driver initiativet fremover.',
    emptyLink: 'Koble for eksempel et pilotbyrå eller en kunde du følger opp i Leadgrid.',
    linkSearch: 'Søk etter lead, kunde, søknad, partner eller sak',
    noLink: 'Opprett leadet i Leadgrid eller arbeidselementet i riktig adminmodul først.',
  },
} as const;

export function ProjectsTab({ parentProduct }: ProjectsTabProps) {
  const [projects, setProjects] = useState<WorkspaceProject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      return new URLSearchParams(window.location.search).get('project');
    } catch {
      return null;
    }
  });
  const [selected, setSelected] = useState<WorkspaceProject | null>(null);
  const [links, setLinks] = useState<WorkspaceProjectLink[]>([]);
  const [files, setFiles] = useState<WorkspaceProjectFile[]>([]);
  const [fileQuery, setFileQuery] = useState('');
  const [fileBusy, setFileBusy] = useState<string | null>(null);
  const [replaceFileId, setReplaceFileId] = useState<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = useState<WorkspaceProject | null>(null);
  const [tagsText, setTagsText] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | WorkspaceProjectStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | WorkspaceProjectCategory>('all');
  const [productFilter, setProductFilter] = useState<'context' | 'all' | 'internal'>('context');

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createDraft, setCreateDraft] = useState<CreateDraft>(() => newCreateDraft(parentProduct));

  const [linkOpen, setLinkOpen] = useState(false);
  const [linkOptions, setLinkOptions] = useState<WorkspaceProjectLinkOption[]>([]);
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkType, setLinkType] = useState<'all' | WorkspaceProjectLinkType>('all');
  const [linkQuery, setLinkQuery] = useState('');
  const [cvOpen, setCvOpen] = useState(false);

  const refreshProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await workspaceProjectsApi.list({
        ...(productFilter === 'context'
          ? { product: parentProduct === 'roleroom' ? 'role_room' : 'leadgrid' }
          : productFilter === 'internal' ? { product: 'internal' } : {}),
        ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
        ...(categoryFilter !== 'all' ? { category: categoryFilter } : {}),
      });
      setProjects(items);
      setSelectedId((current) => {
        if (current && items.some((item) => item.id === current)) return current;
        return items[0]?.id ?? null;
      });
    } catch (err) {
      setError((err as Error).message || 'Kunne ikke hente prosjekter');
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, parentProduct, productFilter, statusFilter]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setError(null);
    try {
      const [data, projectFiles] = await Promise.all([
        workspaceProjectsApi.get(id),
        workspaceProjectsApi.files(id),
      ]);
      setSelected(data.item);
      setDraft(data.item);
      setTagsText(data.item.tags.join(', '));
      setLinks(data.links);
      setFiles(projectFiles);
    } catch (err) {
      setError((err as Error).message || 'Kunne ikke hente prosjektet');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshProjects();
  }, [refreshProjects]);

  useEffect(() => {
    if (!selectedId) {
      setSelected(null);
      setDraft(null);
      setLinks([]);
      setFiles([]);
      return;
    }
    void loadDetail(selectedId);
  }, [loadDetail, selectedId]);

  const visibleProjects = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('nb-NO');
    if (!needle) return projects;
    return projects.filter((project) =>
      `${project.title} ${project.summary ?? ''} ${WORKSPACE_PROJECT_CATEGORY_LABELS[project.category]}`
        .toLocaleLowerCase('nb-NO')
        .includes(needle),
    );
  }, [projects, query]);

  const visibleFiles = useMemo(() => {
    const needle = fileQuery.trim().toLocaleLowerCase('nb-NO');
    if (!needle) return files;
    return files.filter((file) => file.file_name.toLocaleLowerCase('nb-NO').includes(needle));
  }, [fileQuery, files]);

  const stats = useMemo(() => {
    const active = projects.filter((project) => project.status === 'active').length;
    const now = Date.now();
    const dueSoon = projects.filter((project) => {
      if (!project.target_date || project.status === 'completed' || project.status === 'archived') return false;
      const due = new Date(`${project.target_date.slice(0, 10)}T23:59:59`).getTime();
      return due >= now && due - now <= 30 * 86_400_000;
    }).length;
    return {
      active,
      dueSoon,
      relations: projects.reduce((sum, project) => {
        const count = productFilter === 'context'
          ? parentProduct === 'leadgrid' ? project.lead_count : project.contact_count
          : Number(project.contact_count || 0) + Number(project.lead_count || 0);
        return sum + Number(count || 0);
      }, 0),
      linked: projects.reduce((sum, project) => sum + Number(project.linked_count || 0), 0),
    };
  }, [parentProduct, productFilter, projects]);

  const contextCopy = CONTEXT_COPY[parentProduct];

  const createProject = async () => {
    if (!createDraft.title.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const created = await workspaceProjectsApi.create({
        title: createDraft.title.trim(),
        summary: createDraft.summary.trim() || null,
        category: createDraft.category,
        productKey: createDraft.productKey === 'internal' ? null : createDraft.productKey,
        targetDate: createDraft.targetDate || null,
        status: 'planned',
      });
      setCreateOpen(false);
      setCreateDraft(newCreateDraft(parentProduct));
      await refreshProjects();
      setSelectedId(created.id);
    } catch (err) {
      setError((err as Error).message || 'Kunne ikke opprette prosjekt');
    } finally {
      setCreating(false);
    }
  };

  const saveProject = async () => {
    if (!draft || !draft.title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await workspaceProjectsApi.update(draft.id, {
        title: draft.title.trim(),
        summary: draft.summary,
        objective: draft.objective,
        category: draft.category,
        status: draft.status,
        priority: draft.priority,
        progressPercent: draft.progress_percent,
        productKey: draft.product_key,
        startDate: draft.start_date?.slice(0, 10) || null,
        targetDate: draft.target_date?.slice(0, 10) || null,
        tags: tagsText.split(',').map((tag) => tag.trim()).filter(Boolean),
      });
      await Promise.all([refreshProjects(), loadDetail(draft.id)]);
    } catch (err) {
      setError((err as Error).message || 'Kunne ikke lagre prosjektet');
    } finally {
      setSaving(false);
    }
  };

  const refreshProjectFiles = async (projectId: string) => {
    const projectFiles = await workspaceProjectsApi.files(projectId);
    setFiles(projectFiles);
  };

  const uploadProjectFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!selectedId || !file) return;
    setFileBusy('upload');
    setError(null);
    try {
      await workspaceProjectsApi.uploadFile(selectedId, file);
      await Promise.all([refreshProjectFiles(selectedId), refreshProjects()]);
    } catch (err) {
      setError((err as Error).message || 'Kunne ikke laste opp prosjektfilen');
    } finally {
      setFileBusy(null);
    }
  };

  const chooseReplacement = (fileId: string) => {
    setReplaceFileId(fileId);
    replaceInputRef.current?.click();
  };

  const replaceProjectFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!selectedId || !replaceFileId || !file) {
      setReplaceFileId(null);
      return;
    }
    const currentFileId = replaceFileId;
    setFileBusy(currentFileId);
    setError(null);
    try {
      await workspaceProjectsApi.replaceFile(selectedId, currentFileId, file);
      await refreshProjectFiles(selectedId);
    } catch (err) {
      setError((err as Error).message || 'Kunne ikke lagre ny filversjon');
    } finally {
      setFileBusy(null);
      setReplaceFileId(null);
    }
  };

  const toggleProjectFileContext = async (file: WorkspaceProjectFile) => {
    if (!selectedId) return;
    setFileBusy(file.id);
    setError(null);
    try {
      await workspaceProjectsApi.setFileContextEnabled(selectedId, file.id, !file.context_enabled);
      await refreshProjectFiles(selectedId);
    } catch (err) {
      setError((err as Error).message || 'Kunne ikke endre kildeinnstillingen');
    } finally {
      setFileBusy(null);
    }
  };

  const reindexProjectFile = async (file: WorkspaceProjectFile) => {
    if (!selectedId) return;
    setFileBusy(file.id);
    setError(null);
    try {
      await workspaceProjectsApi.reindexFile(selectedId, file.id);
      await refreshProjectFiles(selectedId);
    } catch (err) {
      setError((err as Error).message || 'Kunne ikke lese prosjektfilen på nytt');
    } finally {
      setFileBusy(null);
    }
  };

  const downloadProjectFile = async (file: WorkspaceProjectFile) => {
    if (!selectedId) return;
    setFileBusy(file.id);
    setError(null);
    try {
      const blob = await workspaceProjectsApi.downloadFile(selectedId, file.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = file.file_name;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError((err as Error).message || 'Kunne ikke laste ned prosjektfilen');
    } finally {
      setFileBusy(null);
    }
  };

  const deleteProjectFile = async (file: WorkspaceProjectFile) => {
    if (!selectedId || !window.confirm(`Slette «${file.file_name}» fra prosjektet?`)) return;
    setFileBusy(file.id);
    setError(null);
    try {
      await workspaceProjectsApi.removeFile(selectedId, file.id);
      await Promise.all([refreshProjectFiles(selectedId), refreshProjects()]);
    } catch (err) {
      setError((err as Error).message || 'Kunne ikke slette prosjektfilen');
    } finally {
      setFileBusy(null);
    }
  };

  const deleteProject = async () => {
    if (!selected || !window.confirm(`Slette «${selected.title}»? Koblingene fjernes, men originaldataene beholdes.`)) return;
    try {
      await workspaceProjectsApi.delete(selected.id);
      setSelectedId(null);
      await refreshProjects();
    } catch (err) {
      setError((err as Error).message || 'Kunne ikke slette prosjektet');
    }
  };

  const openLinkDialog = async () => {
    if (!selectedId) return;
    setLinkOpen(true);
    setLinkLoading(true);
    setLinkQuery('');
    setLinkType('all');
    try {
      setLinkOptions(await workspaceProjectsApi.linkOptions(selectedId));
    } catch (err) {
      setError((err as Error).message || 'Kunne ikke hente elementer');
    } finally {
      setLinkLoading(false);
    }
  };

  const addLink = async (option: WorkspaceProjectLinkOption) => {
    if (!selectedId || option.linked) return;
    try {
      await workspaceProjectsApi.addLink(selectedId, option.entity_type, option.entity_id);
      setLinkOptions((items) => items.map((item) =>
        item.entity_type === option.entity_type && item.entity_id === option.entity_id
          ? { ...item, linked: true }
          : item,
      ));
      await Promise.all([loadDetail(selectedId), refreshProjects()]);
    } catch (err) {
      setError((err as Error).message || 'Kunne ikke koble elementet');
    }
  };

  const removeLink = async (link: WorkspaceProjectLink) => {
    if (!selectedId) return;
    try {
      await workspaceProjectsApi.removeLink(selectedId, link.link_id);
      await Promise.all([loadDetail(selectedId), refreshProjects()]);
    } catch (err) {
      setError((err as Error).message || 'Kunne ikke fjerne koblingen');
    }
  };

  const filteredLinkOptions = useMemo(() => {
    const needle = linkQuery.trim().toLocaleLowerCase('nb-NO');
    return linkOptions.filter((option) => {
      if (linkType !== 'all' && option.entity_type !== linkType) return false;
      if (!needle) return true;
      return `${option.title} ${option.subtitle ?? ''}`.toLocaleLowerCase('nb-NO').includes(needle);
    });
  }, [linkOptions, linkQuery, linkType]);

  return (
    <Stack spacing={2.5} data-testid="workspace-projects">
      <Box>
        <Typography variant="h5" sx={{ color: BRAND.text, fontWeight: 700 }}>
          {contextCopy.heading}
        </Typography>
        <Typography sx={{ color: BRAND.textMuted, mt: 0.5, maxWidth: 900 }}>
          {contextCopy.description}
        </Typography>
      </Box>

      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, 1fr)' }, gap: 1.5 }}>
        {[
          { label: 'Aktive initiativer', value: stats.active, icon: <FolderOpenOutlinedIcon /> },
          { label: 'Frist neste 30 dager', value: stats.dueSoon, icon: <CalendarMonthOutlinedIcon /> },
          {
            label: productFilter === 'context'
              ? contextCopy.relationStat
              : 'Koblede markedskontakter / leads',
            value: stats.relations,
            icon: parentProduct === 'leadgrid' && productFilter === 'context'
              ? <PersonSearchOutlinedIcon />
              : <GroupsOutlinedIcon />,
          },
          { label: 'Arbeidselementer samlet', value: stats.linked, icon: <AssignmentOutlinedIcon /> },
        ].map((stat) => (
          <Box key={stat.label} sx={{ p: 1.75, border: `1px solid ${BRAND.border}`, borderRadius: 2, bgcolor: BRAND.panelBg }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography sx={{ color: BRAND.textDim, fontSize: 12 }}>{stat.label}</Typography>
              <Box sx={{ color: BRAND.accent, display: 'flex' }}>{stat.icon}</Box>
            </Stack>
            <Typography sx={{ color: BRAND.text, fontWeight: 750, fontSize: 25, mt: 0.5 }}>{stat.value}</Typography>
          </Box>
        ))}
      </Box>

      <Stack direction={{ xs: 'column', xl: 'row' }} spacing={1.25}>
        <TextField
          size="small"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Søk i prosjekter"
          slotProps={{ input: { startAdornment: <SearchOutlinedIcon sx={{ mr: 1, color: BRAND.textDim }} /> } }}
          sx={{ ...fieldSx, minWidth: { md: 280 } }}
          inputProps={{ 'aria-label': 'Søk i prosjekter' }}
        />
        <TextField select size="small" label="Status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} sx={{ ...fieldSx, minWidth: 145 }}>
          <MenuItem value="all">Alle statuser</MenuItem>
          {Object.entries(WORKSPACE_PROJECT_STATUS_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
        </TextField>
        <TextField select size="small" label="Type" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as typeof categoryFilter)} sx={{ ...fieldSx, minWidth: 190 }}>
          <MenuItem value="all">Alle typer</MenuItem>
          {Object.entries(WORKSPACE_PROJECT_CATEGORY_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
        </TextField>
        <TextField
          select
          size="small"
          label="Visning"
          value={productFilter}
          onChange={(event) => setProductFilter(event.target.value as typeof productFilter)}
          sx={{ ...fieldSx, minWidth: 190 }}
          inputProps={{ 'data-testid': 'project-product-filter' }}
        >
          <MenuItem value="context">{parentProduct === 'leadgrid' ? 'Leadgrid-prosjekter' : 'The Role Room-prosjekter'}</MenuItem>
          <MenuItem value="all">Alle prosjekter</MenuItem>
          <MenuItem value="internal">Creatorhub / internt</MenuItem>
        </TextField>
        <Box sx={{ flex: { xl: 1 } }} />
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)} data-testid="create-project-button" sx={{ bgcolor: BRAND.accentStrong, alignSelf: { xs: 'stretch', xl: 'center' }, '&:hover': { bgcolor: '#6d28d9' } }}>
          Nytt prosjekt
        </Button>
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '360px minmax(0, 1fr)' }, minHeight: 540, border: `1px solid ${BRAND.border}`, borderRadius: 2.5, overflow: 'hidden', bgcolor: 'rgba(11, 5, 24, 0.34)' }}>
        <Box sx={{ borderRight: { xl: `1px solid ${BRAND.border}` }, borderBottom: { xs: `1px solid ${BRAND.border}`, xl: 'none' }, maxHeight: { xs: 380, xl: 680 }, overflowY: 'auto' }}>
          {loading ? (
            <Stack alignItems="center" py={8}><CircularProgress size={26} sx={{ color: BRAND.accent }} /></Stack>
          ) : visibleProjects.length === 0 ? (
            <Stack alignItems="center" textAlign="center" px={3} py={7} spacing={1.5}>
              <FolderOpenOutlinedIcon sx={{ color: BRAND.accent, fontSize: 40 }} />
              <Typography sx={{ color: BRAND.text, fontWeight: 650 }}>Ingen prosjekter her ennå</Typography>
              <Typography sx={{ color: BRAND.textDim, fontSize: 13 }}>
                {contextCopy.emptyProject}
              </Typography>
              <Button size="small" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>Opprett første prosjekt</Button>
            </Stack>
          ) : visibleProjects.map((project) => {
            const active = project.id === selectedId;
            return (
              <Box
                key={project.id}
                component="button"
                type="button"
                onClick={() => setSelectedId(project.id)}
                data-testid={`project-row-${project.id}`}
                sx={{ width: '100%', p: 2, textAlign: 'left', border: 0, borderBottom: `1px solid ${BRAND.border}`, bgcolor: active ? BRAND.selectedBg : 'transparent', cursor: 'pointer', '&:hover': { bgcolor: active ? BRAND.selectedBg : BRAND.hoverBg } }}
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: STATUS_COLORS[project.status], flex: '0 0 auto' }} />
                  <Typography noWrap sx={{ color: BRAND.text, fontWeight: 650, flex: 1 }}>{project.title}</Typography>
                  {project.priority === 'urgent' || project.priority === 'high' ? <Chip size="small" label={PRIORITY_LABELS[project.priority]} sx={{ height: 20, color: '#fecaca', bgcolor: 'rgba(239,68,68,.15)', fontSize: 10 }} /> : null}
                </Stack>
                <Typography noWrap sx={{ color: BRAND.textDim, fontSize: 12.5, mt: 0.6 }}>
                  {WORKSPACE_PROJECT_CATEGORY_LABELS[project.category]} · {productLabel(project.product_key)}
                  {project.file_count ? ` · ${project.file_count} ${project.file_count === 1 ? 'fil' : 'filer'}` : ''}
                </Typography>
                <LinearProgress variant="determinate" value={project.progress_percent} sx={{ mt: 1.4, height: 5, borderRadius: 4, bgcolor: 'rgba(255,255,255,.08)', '& .MuiLinearProgress-bar': { bgcolor: BRAND.accent } }} />
                <Stack direction="row" justifyContent="space-between" mt={0.8}>
                  <Typography sx={{ color: BRAND.textDim, fontSize: 11 }}>{project.progress_percent}%</Typography>
                  <Typography sx={{ color: dueTone(project.target_date), fontSize: 11 }}>{formatDate(project.target_date)}</Typography>
                </Stack>
              </Box>
            );
          })}
        </Box>

        <Box sx={{ minWidth: 0, maxHeight: { xl: 680 }, overflowY: 'auto' }}>
          {detailLoading ? (
            <Stack alignItems="center" py={12}><CircularProgress size={28} sx={{ color: BRAND.accent }} /></Stack>
          ) : !draft || !selected ? (
            <Stack alignItems="center" justifyContent="center" minHeight={420} spacing={1} px={3} textAlign="center">
              <FolderOpenOutlinedIcon sx={{ color: BRAND.textDim, fontSize: 44 }} />
              <Typography sx={{ color: BRAND.textMuted }}>Velg et prosjekt for å arbeide videre.</Typography>
            </Stack>
          ) : (
            <Stack spacing={2.5} p={{ xs: 2, md: 3 }} data-testid="project-detail">
              <Stack direction="row" alignItems="flex-start" spacing={1}>
                <Box sx={{ flex: 1 }}>
                  <TextField fullWidth variant="standard" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} inputProps={{ 'aria-label': 'Prosjekttittel' }} sx={{ '& .MuiInputBase-input': { color: BRAND.text, fontSize: 23, fontWeight: 720 }, '& .MuiInput-underline:before': { borderColor: BRAND.border }, '& .MuiInput-underline:after': { borderColor: BRAND.accent } }} />
                  <Typography sx={{ color: BRAND.textDim, fontSize: 12, mt: 0.6 }}>Oppdatert {new Date(selected.updated_at).toLocaleDateString('nb-NO')}</Typography>
                </Box>
                <Tooltip title="Slett prosjekt"><IconButton onClick={deleteProject} aria-label="Slett prosjekt" sx={{ color: BRAND.textDim }}><DeleteOutlineIcon /></IconButton></Tooltip>
              </Stack>

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 1.5 }}>
                <TextField select size="small" label="Status" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as WorkspaceProjectStatus })} sx={fieldSx}>
                  {Object.entries(WORKSPACE_PROJECT_STATUS_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
                </TextField>
                <TextField select size="small" label="Type" value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as WorkspaceProjectCategory })} sx={fieldSx}>
                  {Object.entries(WORKSPACE_PROJECT_CATEGORY_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
                </TextField>
                <TextField select size="small" label="Prioritet" value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as WorkspaceProjectPriority })} sx={fieldSx}>
                  {Object.entries(PRIORITY_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
                </TextField>
                <TextField select size="small" label="Tilhørighet" value={draft.product_key ?? 'internal'} onChange={(event) => setDraft({ ...draft, product_key: event.target.value === 'internal' ? null : event.target.value as 'role_room' | 'leadgrid' })} sx={fieldSx}>
                  <MenuItem value="internal">Creatorhub / internt</MenuItem>
                  <MenuItem value="role_room">The Role Room</MenuItem>
                  <MenuItem value="leadgrid">Leadgrid</MenuItem>
                </TextField>
                <TextField size="small" type="date" label="Startdato" value={draft.start_date?.slice(0, 10) ?? ''} onChange={(event) => setDraft({ ...draft, start_date: event.target.value || null })} slotProps={{ inputLabel: { shrink: true } }} sx={fieldSx} />
                <TextField size="small" type="date" label="Målfrist" value={draft.target_date?.slice(0, 10) ?? ''} onChange={(event) => setDraft({ ...draft, target_date: event.target.value || null })} slotProps={{ inputLabel: { shrink: true } }} sx={fieldSx} />
              </Box>

              <Box>
                <Stack direction="row" justifyContent="space-between"><Typography sx={{ color: BRAND.textMuted, fontSize: 13 }}>Fremdrift</Typography><Typography sx={{ color: BRAND.accent, fontWeight: 650 }}>{draft.progress_percent}%</Typography></Stack>
                <Slider value={draft.progress_percent} onChange={(_event, value) => setDraft({ ...draft, progress_percent: value as number })} step={5} min={0} max={100} aria-label="Fremdrift i prosent" sx={{ color: BRAND.accent, py: 1 }} />
              </Box>

              <TextField fullWidth multiline minRows={2} label="Kort beskrivelse" value={draft.summary ?? ''} onChange={(event) => setDraft({ ...draft, summary: event.target.value || null })} placeholder="Hva er dette initiativet?" sx={fieldSx} />
              <TextField fullWidth multiline minRows={3} label="Mål / ønsket resultat" value={draft.objective ?? ''} onChange={(event) => setDraft({ ...draft, objective: event.target.value || null })} placeholder="Hva skal være sant når prosjektet er fullført?" sx={fieldSx} />
              <TextField fullWidth size="small" label="Etiketter (kommaseparert)" value={tagsText} onChange={(event) => setTagsText(event.target.value)} sx={fieldSx} />

              <Stack direction="row" justifyContent="flex-end"><Button variant="contained" onClick={saveProject} disabled={saving || !draft.title.trim()} data-testid="save-project-button" sx={{ bgcolor: BRAND.accentStrong }}>{saving ? 'Lagrer…' : 'Lagre prosjekt'}</Button></Stack>

              <Divider sx={{ borderColor: BRAND.border }} />

              <Stack spacing={1.5} data-testid="project-file-bank">
                <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" gap={1}>
                  <Box>
                    <Typography sx={{ color: BRAND.text, fontWeight: 700 }}>Filer og kunnskap</Typography>
                    <Typography sx={{ color: BRAND.textDim, fontSize: 12.5 }}>
                      Last opp grunnlag én gang. Innholdet blir en søkbar kilde i alle dokumenter som er koblet til prosjektet.
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={0.8} flexWrap="wrap">
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<BadgeOutlinedIcon />}
                      onClick={() => setCvOpen(true)}
                      data-testid="open-cv-builder"
                      sx={{ whiteSpace: 'nowrap', borderColor: BRAND.borderHover, color: BRAND.accent }}
                    >
                      Bygg CV
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={fileBusy === 'upload' ? <CircularProgress size={15} color="inherit" /> : <UploadFileOutlinedIcon />}
                      onClick={() => uploadInputRef.current?.click()}
                      disabled={Boolean(fileBusy)}
                      data-testid="project-file-upload-button"
                      sx={{ bgcolor: BRAND.accentStrong, whiteSpace: 'nowrap' }}
                    >
                      Last opp fil
                    </Button>
                  </Stack>
                  <input
                    ref={uploadInputRef}
                    hidden
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.md,.csv,.png,.jpg,.jpeg"
                    onChange={(event) => void uploadProjectFile(event)}
                    data-testid="project-file-input"
                  />
                  <input
                    ref={replaceInputRef}
                    hidden
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.md,.csv,.png,.jpg,.jpeg"
                    onChange={(event) => void replaceProjectFile(event)}
                    data-testid="project-file-replace-input"
                  />
                </Stack>

                {files.length > 0 && (
                  <TextField
                    size="small"
                    value={fileQuery}
                    onChange={(event) => setFileQuery(event.target.value)}
                    placeholder="Søk i prosjektfiler"
                    slotProps={{ input: { startAdornment: <SearchOutlinedIcon sx={{ mr: 1, color: BRAND.textDim }} /> } }}
                    sx={fieldSx}
                    inputProps={{ 'aria-label': 'Søk i prosjektfiler' }}
                  />
                )}

                {files.length === 0 ? (
                  <Box sx={{ p: 2.5, border: `1px dashed ${BRAND.borderHover}`, borderRadius: 2, textAlign: 'center' }}>
                    <UploadFileOutlinedIcon sx={{ color: BRAND.accent, mb: 0.5 }} />
                    <Typography sx={{ color: BRAND.textMuted, fontSize: 13 }}>Ingen prosjektfiler ennå.</Typography>
                    <Typography sx={{ color: BRAND.textDim, fontSize: 12, mt: 0.4 }}>
                      Legg til for eksempel CV, kravdokument, budsjett, intervju eller markedsanalyse. Maks 15 MB per fil.
                    </Typography>
                  </Box>
                ) : visibleFiles.length === 0 ? (
                  <Alert severity="info">Ingen prosjektfiler matcher søket.</Alert>
                ) : visibleFiles.map((file) => {
                  const status = extractionStatus(file);
                  const busy = fileBusy === file.id;
                  return (
                    <Stack
                      key={file.id}
                      data-testid={`project-file-row-${file.id}`}
                      direction={{ xs: 'column', md: 'row' }}
                      alignItems={{ md: 'center' }}
                      spacing={1.25}
                      sx={{ p: 1.5, border: `1px solid ${BRAND.border}`, borderRadius: 1.75, bgcolor: BRAND.hoverBg }}
                    >
                      <UploadFileOutlinedIcon sx={{ color: BRAND.accent, flex: '0 0 auto' }} />
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Stack direction="row" alignItems="center" spacing={0.7} flexWrap="wrap">
                          <Typography noWrap sx={{ color: BRAND.text, fontWeight: 650, maxWidth: { xs: '100%', md: 360 } }}>
                            {file.file_name}
                          </Typography>
                          <Chip size="small" label={`v${file.version_no}`} sx={{ height: 19, fontSize: 10 }} />
                          <Chip size="small" label={status.label} color={status.color} variant="outlined" sx={{ height: 21, fontSize: 10 }} />
                        </Stack>
                        <Typography sx={{ color: BRAND.textDim, fontSize: 11.5, mt: 0.35 }}>
                          {formatFileSize(file.file_size)}
                          {file.character_count ? ` · ${Number(file.character_count).toLocaleString('nb-NO')} tegn` : ''}
                          {file.linked_document_count ? ` · Tilgjengelig i ${file.linked_document_count} koblede dokumenter` : ''}
                        </Typography>
                        {file.extraction_error && (
                          <Typography sx={{ color: '#fca5a5', fontSize: 11.5, mt: 0.3 }}>{file.extraction_error}</Typography>
                        )}
                      </Box>
                      <Stack direction="row" alignItems="center" spacing={0.35} flexWrap="wrap">
                        <Tooltip title="Gjør filen tilgjengelig for skriveassistenten i prosjektets dokumenter">
                          <Stack direction="row" alignItems="center" spacing={0.1}>
                            <Switch
                              size="small"
                              checked={file.context_enabled}
                              disabled={busy}
                              onChange={() => void toggleProjectFileContext(file)}
                              inputProps={{ 'aria-label': `Bruk ${file.file_name} som prosjektkilde` }}
                            />
                            <Typography sx={{ color: BRAND.textDim, fontSize: 11 }}>Kilde</Typography>
                          </Stack>
                        </Tooltip>
                        <Tooltip title="Last ned"><IconButton size="small" disabled={busy} onClick={() => void downloadProjectFile(file)} aria-label={`Last ned ${file.file_name}`} sx={{ color: BRAND.textDim }}><DownloadOutlinedIcon fontSize="small" /></IconButton></Tooltip>
                        <Tooltip title="Last opp ny versjon"><IconButton size="small" disabled={busy} onClick={() => chooseReplacement(file.id)} aria-label={`Ny versjon av ${file.file_name}`} sx={{ color: BRAND.textDim }}><UploadFileOutlinedIcon fontSize="small" /></IconButton></Tooltip>
                        <Tooltip title="Les og indekser filen på nytt"><IconButton size="small" disabled={busy} onClick={() => void reindexProjectFile(file)} aria-label={`Indekser ${file.file_name} på nytt`} sx={{ color: BRAND.textDim }}><SyncOutlinedIcon fontSize="small" /></IconButton></Tooltip>
                        <Tooltip title="Slett fil"><IconButton size="small" disabled={busy} onClick={() => void deleteProjectFile(file)} aria-label={`Slett ${file.file_name}`} sx={{ color: BRAND.textDim }}><DeleteOutlineIcon fontSize="small" /></IconButton></Tooltip>
                        {busy && <CircularProgress size={16} sx={{ color: BRAND.accent, ml: 0.5 }} />}
                      </Stack>
                    </Stack>
                  );
                })}
              </Stack>

              <Divider sx={{ borderColor: BRAND.border }} />

              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography sx={{ color: BRAND.text, fontWeight: 700 }}>Koblet arbeid</Typography>
                  <Typography sx={{ color: BRAND.textDim, fontSize: 12.5 }}>{contextCopy.linkedWork}</Typography>
                </Box>
                <Button size="small" startIcon={<LinkOutlinedIcon />} onClick={openLinkDialog} data-testid="link-work-button">Koble arbeid</Button>
              </Stack>

              {links.length === 0 ? (
                <Box sx={{ p: 2.5, border: `1px dashed ${BRAND.borderHover}`, borderRadius: 2, textAlign: 'center' }}>
                  <Typography sx={{ color: BRAND.textMuted, fontSize: 13 }}>Ingen arbeidselementer er koblet ennå.</Typography>
                  <Typography sx={{ color: BRAND.textDim, fontSize: 12, mt: 0.5 }}>{contextCopy.emptyLink}</Typography>
                </Box>
              ) : links.map((link) => (
                <Stack key={link.link_id} direction="row" alignItems="center" spacing={1.25} sx={{ p: 1.4, border: `1px solid ${BRAND.border}`, borderRadius: 1.5, bgcolor: BRAND.hoverBg }}>
                  <Box sx={{ color: BRAND.accent, display: 'flex' }}>{link.entity_type === 'funding_app' ? <AccountBalanceOutlinedIcon /> : link.entity_type === 'industry_target' ? <GroupsOutlinedIcon /> : link.entity_type === 'leadgrid_lead' ? <PersonSearchOutlinedIcon /> : <AssignmentOutlinedIcon />}</Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Stack direction="row" spacing={0.8} alignItems="center"><Chip size="small" label={WORKSPACE_PROJECT_LINK_LABELS[link.entity_type]} sx={{ height: 19, fontSize: 10, color: BRAND.accent, bgcolor: 'rgba(167,139,250,.12)' }} /><Typography noWrap sx={{ color: BRAND.text, fontWeight: 620 }}>{link.title}</Typography></Stack>
                    <Typography noWrap sx={{ color: BRAND.textDim, fontSize: 12, mt: 0.3 }}>{[link.subtitle, link.status, link.due_date ? `Frist ${formatDate(link.due_date)}` : null].filter(Boolean).join(' · ') || 'Ingen flere detaljer'}</Typography>
                  </Box>
                  {!link.missing && <Tooltip title="Åpne original"><IconButton size="small" aria-label={`Åpne ${link.title}`} onClick={() => window.location.assign(link.entity_type === 'leadgrid_lead' ? '/admin-room?adminTab=marketing-cockpit&cockpitTab=leads' : `/admin-workspace?view=${LINK_ROUTES[link.entity_type]}&product=${parentProduct}`)} sx={{ color: BRAND.textDim }}><OpenInNewOutlinedIcon fontSize="small" /></IconButton></Tooltip>}
                  <Tooltip title="Fjern kobling"><IconButton size="small" aria-label={`Fjern kobling til ${link.title}`} onClick={() => void removeLink(link)} sx={{ color: BRAND.textDim }}><DeleteOutlineIcon fontSize="small" /></IconButton></Tooltip>
                </Stack>
              ))}
            </Stack>
          )}
        </Box>
      </Box>

      <Dialog open={createOpen} onClose={() => !creating && setCreateOpen(false)} fullWidth maxWidth="sm" PaperProps={{ sx: { bgcolor: BRAND.panelSolid, color: BRAND.text, border: `1px solid ${BRAND.border}` } }}>
        <DialogTitle>Nytt adminprosjekt</DialogTitle>
        <DialogContent><Stack spacing={2} pt={1}>
          <Alert severity="info" sx={{ bgcolor: 'rgba(56,189,248,.1)', color: BRAND.text }}>Dette er et internt initiativ. Kunde- og castingproduksjoner hører fortsatt hjemme i sine produktflater.</Alert>
          <TextField autoFocus fullWidth required label="Prosjektnavn" value={createDraft.title} onChange={(event) => setCreateDraft({ ...createDraft, title: event.target.value })} placeholder="F.eks. Søke Innovasjon Norge om støtte" sx={fieldSx} inputProps={{ 'data-testid': 'project-title-input' }} />
          <TextField fullWidth multiline minRows={2} label="Kort beskrivelse" value={createDraft.summary} onChange={(event) => setCreateDraft({ ...createDraft, summary: event.target.value })} sx={fieldSx} />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField select fullWidth label="Type" value={createDraft.category} onChange={(event) => setCreateDraft({ ...createDraft, category: event.target.value as WorkspaceProjectCategory })} sx={fieldSx}>{Object.entries(WORKSPACE_PROJECT_CATEGORY_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField>
            <TextField select fullWidth label="Tilhørighet" value={createDraft.productKey} onChange={(event) => setCreateDraft({ ...createDraft, productKey: event.target.value as CreateDraft['productKey'] })} sx={fieldSx}><MenuItem value="internal">Creatorhub / internt</MenuItem><MenuItem value="role_room">The Role Room</MenuItem><MenuItem value="leadgrid">Leadgrid</MenuItem></TextField>
          </Stack>
          <TextField type="date" label="Målfrist" value={createDraft.targetDate} onChange={(event) => setCreateDraft({ ...createDraft, targetDate: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} sx={fieldSx} />
        </Stack></DialogContent>
        <DialogActions><Button onClick={() => setCreateOpen(false)} disabled={creating}>Avbryt</Button><Button variant="contained" onClick={() => void createProject()} disabled={creating || !createDraft.title.trim()} data-testid="confirm-create-project" sx={{ bgcolor: BRAND.accentStrong }}>{creating ? 'Oppretter…' : 'Opprett prosjekt'}</Button></DialogActions>
      </Dialog>

      <Dialog open={linkOpen} onClose={() => setLinkOpen(false)} fullWidth maxWidth="md" PaperProps={{ sx: { bgcolor: BRAND.panelSolid, color: BRAND.text, border: `1px solid ${BRAND.border}`, minHeight: 560 } }}>
        <DialogTitle>Koble eksisterende arbeid</DialogTitle>
        <DialogContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} pt={1} mb={2}>
            <TextField size="small" fullWidth value={linkQuery} onChange={(event) => setLinkQuery(event.target.value)} placeholder={contextCopy.linkSearch} sx={fieldSx} />
            <TextField select size="small" label="Type" value={linkType} onChange={(event) => setLinkType(event.target.value as typeof linkType)} sx={{ ...fieldSx, minWidth: 190 }}><MenuItem value="all">Alle typer</MenuItem>{Object.entries(WORKSPACE_PROJECT_LINK_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField>
          </Stack>
          {linkLoading ? <Stack alignItems="center" py={8}><CircularProgress sx={{ color: BRAND.accent }} /></Stack> : filteredLinkOptions.length === 0 ? <Stack alignItems="center" py={8} spacing={1}><LinkOutlinedIcon sx={{ color: BRAND.textDim, fontSize: 38 }} /><Typography sx={{ color: BRAND.textMuted }}>Ingen elementer funnet.</Typography><Typography sx={{ color: BRAND.textDim, fontSize: 12 }}>{contextCopy.noLink}</Typography></Stack> : <Stack spacing={1}>{filteredLinkOptions.map((option) => <Stack key={`${option.entity_type}:${option.entity_id}`} direction="row" alignItems="center" spacing={1.2} sx={{ p: 1.4, border: `1px solid ${BRAND.border}`, borderRadius: 1.5 }}><Box sx={{ minWidth: 0, flex: 1 }}><Stack direction="row" spacing={0.8} alignItems="center"><Chip size="small" label={WORKSPACE_PROJECT_LINK_LABELS[option.entity_type]} sx={{ height: 19, fontSize: 10, color: BRAND.accent, bgcolor: 'rgba(167,139,250,.12)' }} /><Typography noWrap sx={{ color: BRAND.text, fontWeight: 620 }}>{option.title}</Typography></Stack><Typography noWrap sx={{ color: BRAND.textDim, fontSize: 12, mt: 0.3 }}>{[option.subtitle, option.status, option.due_date ? `Frist ${formatDate(option.due_date)}` : null].filter(Boolean).join(' · ') || 'Ingen flere detaljer'}</Typography></Box><Button size="small" variant={option.linked ? 'outlined' : 'contained'} disabled={option.linked} onClick={() => void addLink(option)} sx={!option.linked ? { bgcolor: BRAND.accentStrong } : undefined}>{option.linked ? 'Koblet' : 'Koble'}</Button></Stack>)}</Stack>}
        </DialogContent>
        <DialogActions><Button onClick={() => setLinkOpen(false)}>Ferdig</Button></DialogActions>
      </Dialog>

      {selected && (
        <CvImportVerificationDialog
          open={cvOpen}
          project={selected}
          files={files}
          onClose={() => setCvOpen(false)}
          onGenerated={() => void loadDetail(selected.id)}
        />
      )}
    </Stack>
  );
}
