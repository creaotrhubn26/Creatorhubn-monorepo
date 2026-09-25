import React, { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, ButtonBase, Checkbox, Chip, CircularProgress, Divider, FormControl,
  IconButton, InputAdornment, InputLabel, MenuItem, Select, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import AutoFixHigh from '@mui/icons-material/AutoFixHigh';
import Block from '@mui/icons-material/Block';
import Brush from '@mui/icons-material/Brush';
import CheckCircle from '@mui/icons-material/CheckCircle';
import Close from '@mui/icons-material/Close';
import Compare from '@mui/icons-material/Compare';
import DeleteOutline from '@mui/icons-material/DeleteOutline';
import Download from '@mui/icons-material/Download';
import EditOutlined from '@mui/icons-material/EditOutlined';
import GridView from '@mui/icons-material/GridView';
import Collections from '@mui/icons-material/Collections';
import CreateNewFolder from '@mui/icons-material/CreateNewFolder';
import FilterAltOff from '@mui/icons-material/FilterAltOff';
import FolderOutlined from '@mui/icons-material/FolderOutlined';
import History from '@mui/icons-material/History';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import Keyboard from '@mui/icons-material/Keyboard';
import PhotoLibrary from '@mui/icons-material/PhotoLibrary';
import RateReview from '@mui/icons-material/RateReview';
import SettingsSuggest from '@mui/icons-material/SettingsSuggest';
import Movie from '@mui/icons-material/Movie';
import Refresh from '@mui/icons-material/Refresh';
import Reply from '@mui/icons-material/Reply';
import Search from '@mui/icons-material/Search';
import Send from '@mui/icons-material/Send';
import Star from '@mui/icons-material/Star';
import StarBorder from '@mui/icons-material/StarBorder';
import ViewCarousel from '@mui/icons-material/ViewCarousel';
import { VirtuosoGrid } from 'react-virtuoso';

import { apiRequest } from '@/lib/queryClient';
import AiBuyCreditsModal from '../AiBuyCreditsModal';
import { makeT, type WsDict, useWsLocale } from '../wsLocale';
import { WsCard, WsErrorState, WsModal, wsAlert, wsConfirm } from '../ui';
import { ws } from '../workspaceTheme';
import MediaRoomCommandCenter, { type MediaRoomCommand } from '../media-room/MediaRoomCommandCenter';
import { useMediaRoomShortcuts } from '../media-room/useMediaRoomShortcuts';
import PhotoCompare from '../photo-room/PhotoCompare';
import {
  readPhotoRoomViewState,
  writePhotoRoomViewState,
  type PhotoRoomInspectorTab,
  type PhotoRoomViewMode,
} from '../photo-room/photoRoomViewState';

type ReviewStatus = 'approved' | 'needs_edit' | 'rejected' | 'flagged' | null;
type CommentScope = 'internal' | 'client';
interface PhotoAsset {
  id: string; filename: string; mime?: string; rating: number; flagged: boolean;
  rejected: boolean; colorLabel?: string | null; reviewStatus: ReviewStatus;
  folderId?: string | null; folderName?: string | null; galleryImageId?: string | null;
  galleryId?: string | null; clientSelection?: string | null; clientCommentCount: number;
  thumbUrl?: string | null; fullUrl?: string | null;
  exif?: Record<string, string | number | null>; createdAt?: string;
  sizeBytes?: number | null; state?: string | null; sessionId?: string;
  sourceName?: string; sourceType?: 'capture' | 'lightroom' | 'memory_card';
  collections?: string[];
}

interface PhotoComment {
  id: string; source: 'project' | 'client_gallery' | 'client_gallery_response';
  assetId: string; scope: CommentScope; authorName: string;
  authorKind: 'creator' | 'client' | 'system'; comment: string;
  status: 'open' | 'resolved'; tag?: string | null; pinned: boolean;
  parentId?: string | null; canEdit: boolean; createdAt?: string; updatedAt?: string;
}

interface AiJob {
  id: string; model?: string; kind: string; status: string; sourceAssetId?: string | null;
  prompt?: string | null; afterUrl?: string | null; createdAt?: string;
}

interface PhotoRoomData {
  hasSession: boolean; stats: Record<string, number>; commentScopes: Record<string, number>;
  folders: Array<{ id: string; name: string; assetCount?: number }>;
  sources?: Array<{ id: string; name: string; kind: string; assetCount: number; readyCount: number; createdAt?: string }>;
  collections?: Array<{ name: string; assetCount: number }>;
  deliveries?: Array<{ id: string; galleryId: string; proofingRound: number; clientName: string; clientEmail: string; emailSent: boolean; assetCount: number; createdAt?: string }>;
  gallery: { id: string; shareUrl: string; clientName: string; clientEmail: string; proofingRound: number } | null;
  pageInfo: { offset: number; limit: number; total: number; hasMore: boolean };
  assets: PhotoAsset[];
}

const VirtualGridList = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>((props, ref) => (
  <Box {...props} ref={ref} sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(168px,1fr))', gap: 1, p: 1 }} />
));
VirtualGridList.displayName = 'VirtualGridList';
const VirtualGridItem = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>((props, ref) => <Box {...props} ref={ref} />);
VirtualGridItem.displayName = 'VirtualGridItem';
const VIRTUAL_GRID_COMPONENTS = { List: VirtualGridList, Item: VirtualGridItem };

const COPY: WsDict = {
  title: { no: 'Photo Room', en: 'Photo Room' },
  subtitle: { no: 'Ett felles reviewrom for fotograf, team og klientgalleri.', en: 'One shared review room for photographer, team and client gallery.' },
  readOnly: { no: 'Du har lesetilgang. Endringer og AI-jobber er låst.', en: 'You have read access. Changes and AI jobs are locked.' },
  search: { no: 'Søk etter filnavn', en: 'Search filenames' },
  allStatuses: { no: 'Alle statuser', en: 'All statuses' },
  pending: { no: 'Venter', en: 'Pending' },
  approved: { no: 'Godkjent', en: 'Approved' },
  needsEdit: { no: 'Må redigeres', en: 'Needs editing' },
  rejected: { no: 'Avvist', en: 'Rejected' },
  flagged: { no: 'Flagget', en: 'Flagged' },
  allFolders: { no: 'Alle mapper', en: 'All folders' },
  unassigned: { no: 'Uten samling', en: 'Unassigned' },
  library: { no: 'Bibliotek', en: 'Library' }, review: { no: 'Review', en: 'Review' },
  delivery: { no: 'Levering', en: 'Delivery' },
  filmstrip: { no: 'Filmstripe', en: 'Filmstrip' }, grid: { no: 'Rutenett', en: 'Grid' },
  newest: { no: 'Nyeste først', en: 'Newest first' },
  oldest: { no: 'Eldste først', en: 'Oldest first' },
  nameAsc: { no: 'Filnavn A–Å', en: 'Filename A–Z' },
  nameDesc: { no: 'Filnavn Å–A', en: 'Filename Z–A' },
  rating: { no: 'Høyest vurdert', en: 'Highest rated' },
  sort: { no: 'Sortering', en: 'Sort order' },
  refresh: { no: 'Oppdater', en: 'Refresh' },
  selected: { no: 'valgt', en: 'selected' },
  selectAll: { no: 'Velg alle viste', en: 'Select all shown' },
  clear: { no: 'Tøm utvalg', en: 'Clear selection' },
  approve: { no: 'Godkjenn', en: 'Approve' },
  requestChanges: { no: 'Be om endringer', en: 'Request changes' },
  sendClient: { no: 'Send til kunde', en: 'Send to client' },
  compare: { no: 'Sammenlign', en: 'Compare' },
  compareHint: { no: 'Velg nøyaktig to bilder for sammenligning.', en: 'Select exactly two images to compare.' },
  loadMore: { no: 'Last inn flere', en: 'Load more' },
  showing: { no: 'Viser', en: 'Showing' },
  of: { no: 'av', en: 'of' },
  noPhotos: { no: 'Ingen bilder matcher filtrene.', en: 'No photos match the filters.' },
  noSession: { no: 'Ingen Capture-bilder er koblet til prosjektet ennå.', en: 'No Capture photos are linked to this project yet.' },
  comments: { no: 'Kommentarer', en: 'Comments' },
  internal: { no: 'Internt', en: 'Internal' },
  client: { no: 'Klient', en: 'Client' },
  all: { no: 'Alle', en: 'All' },
  noComments: { no: 'Ingen kommentarer på dette bildet.', en: 'No comments on this photo.' },
  writeComment: { no: 'Skriv en kommentar til valgt bilde', en: 'Write a comment on the selected photo' },
  reply: { no: 'Svar', en: 'Reply' }, edit: { no: 'Rediger', en: 'Edit' },
  remove: { no: 'Slett', en: 'Delete' }, save: { no: 'Lagre', en: 'Save' },
  cancel: { no: 'Avbryt', en: 'Cancel' }, resolve: { no: 'Løs', en: 'Resolve' },
  reopen: { no: 'Gjenåpne', en: 'Reopen' }, send: { no: 'Send', en: 'Send' },
  replyTo: { no: 'Svarer', en: 'Replying to' }, clientGallery: { no: 'Klientgalleri', en: 'Client gallery' },
  sharedRoom: { no: 'Klientkommentarer, favoritter og godkjenninger vises her.', en: 'Client comments, favourites and approvals appear here.' },
  aiHistory: { no: 'AI-jobber', en: 'AI jobs' }, aiEdit: { no: 'AI-rediger', en: 'AI edit' },
  animate: { no: 'Animer', en: 'Animate' }, download: { no: 'Last ned', en: 'Download' },
  noAiJobs: { no: 'Ingen AI-jobber i dette prosjektet.', en: 'No AI jobs in this project.' },
  aiPrompt: { no: 'Beskriv resultatet du ønsker', en: 'Describe the result you want' },
  suggestions: { no: 'Foreslå', en: 'Suggest' }, consentTitle: { no: 'AI-samtykke', en: 'AI consent' },
  consentText: { no: 'Kundebilder sendes til valgt AI-leverandør. Resultatet arkiveres i CreatorHub sin private AWS S3-bøtte.', en: 'Client photos are sent to the selected AI provider. Results are archived in CreatorHub’s private AWS S3 bucket.' },
  consent: { no: 'Jeg samtykker', en: 'I consent' }, start: { no: 'Start', en: 'Start' },
  queued: { no: 'I kø', en: 'Queued' }, running: { no: 'Behandles', en: 'Processing' },
  completed: { no: 'Ferdig', en: 'Completed' }, failed: { no: 'Feilet', en: 'Failed' },
  deliveryTitle: { no: 'Send utvalg til klient', en: 'Send selection to client' },
  clientName: { no: 'Klientnavn', en: 'Client name' }, clientEmail: { no: 'E-post', en: 'Email' },
  newRound: { no: 'Start ny revisjonsrunde', en: 'Start a new review round' },
  round: { no: 'runde', en: 'round' },
  sendEmail: { no: 'Send e-postvarsel', en: 'Send email notification' },
  deliver: { no: 'Oppdater galleri og send', en: 'Update gallery and send' },
  openGallery: { no: 'Åpne klientgalleri', en: 'Open client gallery' },
  totalPhotos: { no: 'Bilder', en: 'Photos' }, totalComments: { no: 'Kommentarer', en: 'Comments' },
  retry: { no: 'Prøv igjen', en: 'Try again' },
  loadFailed: { no: 'Photo Room kunne ikke lastes.', en: 'Photo Room could not be loaded.' },
  unknownError: { no: 'Noe gikk galt.', en: 'Something went wrong.' },
  storageNote: { no: 'Originaler og AI-resultater lagres privat i CreatorHub AWS S3.', en: 'Originals and AI results are stored privately in CreatorHub AWS S3.' },
  smartViews: { no: 'Smartvisninger', en: 'Smart views' },
  sources: { no: 'Kilder og importer', en: 'Sources and imports' },
  collections: { no: 'Samlinger', en: 'Collections' },
  deliveries: { no: 'Leveranser og runder', en: 'Deliveries and rounds' },
  allPhotos: { no: 'Alle bilder', en: 'All photos' },
  favorites: { no: 'Favoritter', en: 'Favourites' },
  uploadIssues: { no: 'Opplastingsfeil', en: 'Upload issues' },
  organize: { no: 'Organiser', en: 'Organize' },
  moveToFolder: { no: 'Flytt til mappe', en: 'Move to folder' },
  addCollection: { no: 'Legg i samling', en: 'Add to collection' },
  collectionName: { no: 'Navn på samling', en: 'Collection name' },
  createFolder: { no: 'Opprett mappe', en: 'Create folder' },
  folderName: { no: 'Mappenavn', en: 'Folder name' },
  inspector: { no: 'Inspektør', en: 'Inspector' },
  metadata: { no: 'Metadata', en: 'Metadata' },
  versions: { no: 'Versjoner', en: 'Versions' },
  activity: { no: 'Aktivitet', en: 'Activity' },
  shortcuts: { no: 'Hurtigtaster', en: 'Shortcuts' },
  commands: { no: 'Kommandoer', en: 'Commands' },
  clearFilters: { no: 'Nullstill filtre', en: 'Clear filters' },
  verified: { no: 'Verifisert i CreatorHub', en: 'Verified in CreatorHub' },
  noDeliveries: { no: 'Ingen leveranser er sendt ennå.', en: 'No deliveries have been sent yet.' },
};

const STATUS_COLOR: Record<Exclude<ReviewStatus, null>, string> = {
  approved: ws.green, needs_edit: ws.amber, rejected: ws.red, flagged: ws.accent,
};

const uniqueIds = (values: string[]) => [...new Set(values)];
const formatBytes = (value?: number | null) => {
  const bytes = Number(value || 0);
  if (!bytes) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / (1024 ** index)).toFixed(index > 1 ? 1 : 0)} ${units[index]}`;
};

const PhotoRoomTab: React.FC<{ projectId: string; readOnly?: boolean }> = ({ projectId, readOnly = false }) => {
  const locale = useWsLocale();
  const t = makeT(COPY, locale);
  const isReal = Boolean(projectId && projectId !== 'sample');
  const initialView = useMemo(() => readPhotoRoomViewState(
    typeof window === 'undefined' ? '' : window.location.search,
    typeof window === 'undefined' ? null : window.localStorage.getItem(`creatorhub.photo-room.${projectId}`),
  ), [projectId]);
  const [data, setData] = useState<PhotoRoomData | null>(null);
  const [assets, setAssets] = useState<PhotoAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(initialView.query);
  const [search, setSearch] = useState(initialView.query);
  const [statusFilter, setStatusFilter] = useState(initialView.status);
  const [folderFilter, setFolderFilter] = useState(initialView.folder);
  const [sourceFilter, setSourceFilter] = useState(initialView.source);
  const [collectionFilter, setCollectionFilter] = useState(initialView.collection);
  const [sort, setSort] = useState(initialView.sort);
  const [viewMode, setViewMode] = useState<PhotoRoomViewMode>(initialView.view);
  const [inspectorTab, setInspectorTab] = useState<PhotoRoomInspectorTab>(initialView.inspector);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [comments, setComments] = useState<PhotoComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentFilter, setCommentFilter] = useState<'all' | CommentScope>('all');
  const [commentScope, setCommentScope] = useState<CommentScope>('internal');
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState<PhotoComment | null>(null);
  const [editing, setEditing] = useState<PhotoComment | null>(null);
  const [editingText, setEditingText] = useState('');
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [newRound, setNewRound] = useState(false);
  const [notifyClient, setNotifyClient] = useState(true);
  const [busy, setBusy] = useState(false);
  const [aiConfig, setAiConfig] = useState<Record<string, any> | null>(null);
  const [credits, setCredits] = useState<Record<string, any> | null>(null);
  const [aiJobs, setAiJobs] = useState<AiJob[]>([]);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMode, setAiMode] = useState<'edit' | 'motion'>('edit');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const [commandCenter, setCommandCenter] = useState<'commands' | 'help' | null>(null);
  const [organizeOpen, setOrganizeOpen] = useState(false);
  const [organizeFolderId, setOrganizeFolderId] = useState('');
  const [organizeCollection, setOrganizeCollection] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const searchRef = useRef<HTMLInputElement | null>(null);
  const roomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const state = {
      view: viewMode, status: statusFilter, folder: folderFilter, source: sourceFilter,
      collection: collectionFilter, sort, query: search, inspector: inspectorTab,
    };
    window.localStorage.setItem(`creatorhub.photo-room.${projectId}`, JSON.stringify(state));
    const nextSearch = writePhotoRoomViewState(window.location.search, state);
    window.history.replaceState({}, '', `${window.location.pathname}${nextSearch}${window.location.hash}`);
  }, [collectionFilter, folderFilter, inspectorTab, projectId, search, sort, sourceFilter, statusFilter, viewMode]);

  const queryString = useCallback((offset: number) => {
    const params = new URLSearchParams({ limit: '80', offset: String(offset), sort });
    if (search) params.set('search', search);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (folderFilter !== 'all') params.set('folderId', folderFilter);
    if (sourceFilter !== 'all') params.set('sourceId', sourceFilter);
    if (collectionFilter !== 'all') params.set('collection', collectionFilter);
    return params.toString();
  }, [collectionFilter, folderFilter, search, sort, sourceFilter, statusFilter]);

  const loadAi = useCallback(async () => {
    if (!isReal) return;
    const results = await Promise.allSettled([
      apiRequest(`/api/projects/${encodeURIComponent(projectId)}/ai/config`),
      apiRequest(`/api/projects/${encodeURIComponent(projectId)}/ai/credits`),
      apiRequest(`/api/projects/${encodeURIComponent(projectId)}/ai/jobs?room=photo`),
    ]);
    if (results[0].status === 'fulfilled') setAiConfig(results[0].value as Record<string, any>);
    if (results[1].status === 'fulfilled') setCredits(results[1].value as Record<string, any>);
    if (results[2].status === 'fulfilled') setAiJobs(((results[2].value as { jobs?: AiJob[] })?.jobs || []));
  }, [isReal, projectId]);

  const loadPhotos = useCallback(async (offset = 0) => {
    if (!isReal) { setLoading(false); return; }
    offset === 0 ? setLoading(true) : setLoadingMore(true);
    setError(null);
    try {
      const response = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/photo-review?${queryString(offset)}`) as PhotoRoomData;
      setData(response);
      setAssets((current) => offset === 0 ? response.assets : [...current, ...response.assets.filter((asset) => !current.some((item) => item.id === asset.id))]);
      if (offset === 0) {
        const visibleIds = new Set(response.assets.map((asset) => asset.id));
        setSelectedIds((current) => current.filter((id) => visibleIds.has(id)));
        setSelectedAssetId((current) => response.assets.some((asset) => asset.id === current) ? current : response.assets[0]?.id || null);
        setClientName(response.gallery?.clientName || '');
        setClientEmail(response.gallery?.clientEmail || '');
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'photo_room_load_failed'); }
    finally { setLoading(false); setLoadingMore(false); }
  }, [isReal, projectId, queryString]);

  useEffect(() => { void loadPhotos(0); }, [loadPhotos]);
  useEffect(() => { void loadAi(); }, [loadAi]);
  useEffect(() => {
    const active = aiJobs.filter((job) => job.status === 'queued' || job.status === 'running');
    if (!active.length) return;
    const timer = window.setInterval(() => {
      void Promise.allSettled(active.map((job) => apiRequest(
        `/api/projects/${encodeURIComponent(projectId)}/ai/jobs/${job.id}`,
      ))).then(() => loadAi());
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [aiJobs, loadAi, projectId]);

  const selectedAsset = assets.find((asset) => asset.id === selectedAssetId) || assets[0] || null;
  const selectedForAction = selectedIds.length ? selectedIds : selectedAsset ? [selectedAsset.id] : [];

  const loadComments = useCallback(async (assetId: string) => {
    setCommentsLoading(true);
    try {
      const response = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/photo-comments?assetId=${encodeURIComponent(assetId)}`) as { comments?: PhotoComment[] };
      setComments(response.comments || []);
    } catch { setComments([]); }
    finally { setCommentsLoading(false); }
  }, [projectId]);

  useEffect(() => {
    setReplyTo(null); setEditing(null); setCommentText('');
    if (selectedAsset?.id) void loadComments(selectedAsset.id); else setComments([]);
  }, [loadComments, selectedAsset?.id]);

  useEffect(() => {
    if (!isReal) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('ai_credits') === 'ok' && params.get('cs')) {
      void apiRequest(`/api/projects/${encodeURIComponent(projectId)}/ai/credits/confirm`, {
        method: 'POST', body: { sessionId: params.get('cs') },
      }).then(() => loadAi()).finally(() => {
        const url = new URL(window.location.href);
        url.searchParams.delete('ai_credits'); url.searchParams.delete('cs');
        window.history.replaceState({}, '', url.toString());
      });
    }
  }, [isReal, loadAi, projectId]);

  const statusLabel = (status: ReviewStatus) => status === 'approved' ? t('approved')
    : status === 'needs_edit' ? t('needsEdit') : status === 'rejected' ? t('rejected')
      : status === 'flagged' ? t('flagged') : t('pending');

  const setStatus = async (ids: string[], status: Exclude<ReviewStatus, null>) => {
    if (readOnly || !ids.length) return;
    setBusy(true);
    try {
      if (ids.length === 1) await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/photo-review/${ids[0]}`, { method: 'PATCH', body: { reviewStatus: status } });
      else await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/photo-review/bulk`, { method: 'POST', body: { assetIds: ids, reviewStatus: status, createTasks: status === 'needs_edit' } });
      await loadPhotos(0);
    } catch (reason) { await wsAlert(reason instanceof Error ? reason.message : t('unknownError')); }
    finally { setBusy(false); }
  };

  const toggleSelected = (id: string) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : uniqueIds([...current, id]));

  const updateAssetLabel = async (assetId: string, body: { rating?: number; colorLabel?: string | null }) => {
    if (readOnly || busy) return;
    setBusy(true);
    try {
      await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/photo-review/${assetId}`, { method: 'PATCH', body });
      setAssets((current) => current.map((asset) => asset.id === assetId ? { ...asset, ...body } : asset));
    } catch (reason) { await wsAlert(reason instanceof Error ? reason.message : t('unknownError')); }
    finally { setBusy(false); }
  };

  const organize = async (action: 'move_folder' | 'add_collection' | 'remove_collection') => {
    if (readOnly || !selectedForAction.length || busy) return;
    setBusy(true);
    try {
      await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/photo-review/organize`, {
        method: 'POST',
        body: {
          action,
          assetIds: selectedForAction,
          folderId: organizeFolderId || null,
          collection: organizeCollection.trim(),
        },
      });
      setOrganizeOpen(false);
      setOrganizeCollection('');
      await loadPhotos(0);
    } catch (reason) { await wsAlert(reason instanceof Error ? reason.message : t('unknownError')); }
    finally { setBusy(false); }
  };

  const createFolder = async () => {
    const name = newFolderName.trim();
    if (readOnly || !name || busy) return;
    setBusy(true);
    try {
      const created = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/media-folders`, {
        method: 'POST', body: { name },
      }) as { id?: string };
      setNewFolderName('');
      if (created.id) setOrganizeFolderId(created.id);
      await loadPhotos(0);
    } catch (reason) { await wsAlert(reason instanceof Error ? reason.message : t('unknownError')); }
    finally { setBusy(false); }
  };

  const clearFilters = () => {
    setSearchInput(''); setSearch(''); setStatusFilter('all'); setFolderFilter('all');
    setSourceFilter('all'); setCollectionFilter('all');
  };

  const moveActive = (delta: number, extend = false) => {
    if (!assets.length) return;
    const index = Math.max(0, assets.findIndex((asset) => asset.id === selectedAsset?.id));
    const next = assets[(index + delta + assets.length) % assets.length];
    setSelectedAssetId(next.id);
    if (extend) setSelectedIds((current) => uniqueIds([...current, next.id]));
  };

  const toggleFullscreen = () => {
    if (typeof document === 'undefined') return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else if (roomRef.current?.requestFullscreen) void roomRef.current.requestFullscreen();
  };

  const submitComment = async () => {
    if (readOnly || !selectedAsset || !commentText.trim()) return;
    setBusy(true);
    try {
      await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/photo-comments`, {
        method: 'POST', body: { assetId: selectedAsset.id, scope: replyTo?.scope || commentScope,
          comment: commentText.trim(), parentId: replyTo?.id || null,
          parentSource: replyTo?.source === 'client_gallery' ? 'client_gallery' : 'project' },
      });
      setCommentText(''); setReplyTo(null); await loadComments(selectedAsset.id); await loadPhotos(0);
    } catch (reason) { await wsAlert(reason instanceof Error ? reason.message : t('unknownError')); }
    finally { setBusy(false); }
  };

  const updateComment = async (comment: PhotoComment, body: Record<string, unknown>) => {
    if (readOnly || comment.source !== 'project') return;
    try {
      await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/photo-comments/${comment.id}`, { method: 'PATCH', body });
      if (selectedAsset) await loadComments(selectedAsset.id); setEditing(null);
    } catch (reason) { await wsAlert(reason instanceof Error ? reason.message : t('unknownError')); }
  };

  const deleteComment = async (comment: PhotoComment) => {
    if (readOnly || comment.source !== 'project' || !await wsConfirm(`${t('remove')}?`)) return;
    try {
      await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/photo-comments/${comment.id}`, { method: 'DELETE' });
      if (selectedAsset) await loadComments(selectedAsset.id);
    } catch (reason) { await wsAlert(reason instanceof Error ? reason.message : t('unknownError')); }
  };

  const deliver = async () => {
    if (readOnly || !selectedForAction.length) return;
    setBusy(true);
    try {
      const result = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/photo-deliveries`, {
        method: 'POST', body: { assetIds: selectedForAction, clientName, clientEmail, startNewRound: newRound, notifyClient },
      }) as { delivered?: number; emailSent?: boolean };
      setDeliveryOpen(false); setNewRound(false); setSelectedIds([]); await loadPhotos(0);
      await wsAlert(`${result.delivered || 0} ${t('totalPhotos').toLowerCase()}. ${result.emailSent ? t('sendClient') : ''}`.trim());
    } catch (reason) { await wsAlert(reason instanceof Error ? reason.message : t('unknownError')); }
    finally { setBusy(false); }
  };

  const buyPack = async (packId: string) => {
    try {
      const result = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/ai/credits/checkout`, {
        method: 'POST', body: { packId, returnPath: `/workspace/${projectId}/photo-room` },
      }) as { url?: string };
      if (result.url) window.location.assign(result.url);
    } catch (reason) { await wsAlert(reason instanceof Error ? reason.message : t('unknownError')); }
  };

  const suggestAi = async () => {
    if (!selectedAsset || aiBusy) return;
    setAiBusy(true);
    try {
      const result = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/ai/suggest`, { method: 'POST', body: { assetId: selectedAsset.id, mode: aiMode } }) as { suggestions?: string[] };
      setAiSuggestions(result.suggestions || []);
    } catch (reason) { await wsAlert(reason instanceof Error ? reason.message : t('unknownError')); }
    finally { setAiBusy(false); }
  };

  const runAi = async () => {
    if (readOnly || !selectedAsset || !aiPrompt.trim() || aiBusy) return;
    setAiBusy(true);
    try {
      const endpoint = aiMode === 'edit' ? 'image-edit' : 'image-to-video';
      const result = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/ai/${endpoint}`, { method: 'POST', body: { assetId: selectedAsset.id, prompt: aiPrompt.trim(), duration: 5 } }) as { jobId?: string };
      if (!result.jobId) throw new Error(t('unknownError'));
      setAiOpen(false); setAiPrompt(''); setAiSuggestions([]); await loadAi();
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : t('unknownError');
      if (/credit|kreditt|402/i.test(message)) { setAiOpen(false); setBuyOpen(true); } else await wsAlert(message);
    } finally { setAiBusy(false); }
  };

  const visibleComments = comments.filter((comment) => commentFilter === 'all' || comment.scope === commentFilter);
  const rootComments = visibleComments.filter((comment) => !comment.parentId);
  const repliesFor = (id: string) => visibleComments.filter((comment) => comment.parentId === id);
  const compareAssets = selectedIds.map((id) => assets.find((asset) => asset.id === id)).filter(Boolean) as PhotoAsset[];
  const stats = data?.stats || {};
  const activeAiJobs = aiJobs.filter((job) => !selectedAsset || job.sourceAssetId === selectedAsset.id);
  const roomCommands: MediaRoomCommand[] = [
    { id: 'grid', label: t('library'), shortcut: 'G', run: () => setViewMode('grid') },
    { id: 'review', label: t('review'), shortcut: 'E', disabled: !selectedAsset, run: () => setViewMode('review') },
    { id: 'compare', label: t('compare'), shortcut: 'C', disabled: selectedIds.length !== 2, run: () => setCompareOpen(true) },
    { id: 'approve', label: t('approve'), shortcut: 'A', disabled: readOnly || !selectedForAction.length, run: () => void setStatus(selectedForAction, 'approved') },
    { id: 'needsChanges', label: t('requestChanges'), shortcut: 'N', disabled: readOnly || !selectedForAction.length, run: () => void setStatus(selectedForAction, 'needs_edit') },
    { id: 'reject', label: t('rejected'), shortcut: 'X', disabled: readOnly || !selectedForAction.length, run: () => void setStatus(selectedForAction, 'rejected') },
    { id: 'flag', label: t('flagged'), shortcut: 'P', disabled: readOnly || !selectedForAction.length, run: () => void setStatus(selectedForAction, 'flagged') },
    { id: 'organize', label: t('organize'), disabled: readOnly || !selectedForAction.length, run: () => setOrganizeOpen(true) },
    { id: 'delivery', label: t('sendClient'), disabled: readOnly || !selectedForAction.length, run: () => setDeliveryOpen(true) },
    { id: 'clearFilters', label: t('clearFilters'), run: clearFilters },
  ];

  useMediaRoomShortcuts({
    previous: () => moveActive(-1), next: () => moveActive(1),
    extendPrevious: () => moveActive(-1, true), extendNext: () => moveActive(1, true),
    grid: () => setViewMode('grid'), review: () => selectedAsset && setViewMode('review'),
    compare: () => selectedIds.length === 2 && setCompareOpen(true), fullscreen: toggleFullscreen,
    search: () => searchRef.current?.focus(),
    selectAll: () => setSelectedIds(assets.map((asset) => asset.id)),
    clear: () => {
      if (commandCenter) setCommandCenter(null);
      else if (compareOpen) setCompareOpen(false);
      else if (organizeOpen) setOrganizeOpen(false);
      else setSelectedIds([]);
    },
    approve: () => !readOnly && void setStatus(selectedForAction, 'approved'),
    needsChanges: () => !readOnly && void setStatus(selectedForAction, 'needs_edit'),
    reject: () => !readOnly && void setStatus(selectedForAction, 'rejected'),
    flag: () => !readOnly && void setStatus(selectedForAction, 'flagged'),
    rate0: () => selectedAsset && void updateAssetLabel(selectedAsset.id, { rating: 0 }),
    rate1: () => selectedAsset && void updateAssetLabel(selectedAsset.id, { rating: 1 }),
    rate2: () => selectedAsset && void updateAssetLabel(selectedAsset.id, { rating: 2 }),
    rate3: () => selectedAsset && void updateAssetLabel(selectedAsset.id, { rating: 3 }),
    rate4: () => selectedAsset && void updateAssetLabel(selectedAsset.id, { rating: 4 }),
    rate5: () => selectedAsset && void updateAssetLabel(selectedAsset.id, { rating: 5 }),
    submit: () => commentText.trim() && void submitComment(),
    commands: () => setCommandCenter('commands'), help: () => setCommandCenter('help'),
  });

  if (loading && !data) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress sx={{ color: ws.accent }} /></Box>;
  if (error && !data) return <WsErrorState message={t('loadFailed')} retryLabel={t('retry')} onRetry={() => void loadPhotos(0)} />;
  if (isReal && data && !data.hasSession) return <WsCard><Typography sx={{ fontWeight: 800, mb: 1 }}>{t('title')}</Typography><Typography sx={{ color: ws.textDim }}>{t('noSession')}</Typography></WsCard>;

  const renderTile = (asset: PhotoAsset, compact: boolean) => {
    const active = asset.id === selectedAsset?.id;
    const checked = selectedIds.includes(asset.id);
    return <Box key={asset.id} sx={{ position: 'relative', flex: compact ? '0 0 112px' : undefined, minWidth: 0, contentVisibility: compact ? 'visible' : 'auto', containIntrinsicSize: compact ? undefined : '168px 150px' }}>
      <Box component="button" type="button" aria-label={`${asset.filename}, ${statusLabel(asset.reviewStatus)}`}
        aria-current={active ? 'true' : undefined}
        onClick={(event) => { setSelectedAssetId(asset.id); if (event.shiftKey) toggleSelected(asset.id); }}
        onDoubleClick={() => setViewMode('review')}
        sx={{ display: 'block', width: '100%', p: 0, overflow: 'hidden', cursor: 'pointer', textAlign: 'left',
          borderRadius: `${ws.radiusSm}px`, border: `2px solid ${active ? ws.accent : checked ? ws.blue : ws.border}`,
          bgcolor: ws.panelAlt, color: ws.text, '&:focus-visible': { outline: `3px solid ${ws.accentBorder}`, outlineOffset: 2 } }}>
        <Box component="img" src={asset.thumbUrl || undefined} alt="" sx={{ display: 'block', width: '100%', aspectRatio: compact ? '4 / 3' : '3 / 2', objectFit: 'cover', bgcolor: '#090b0e' }} />
        {!compact && <Box sx={{ p: 1 }}><Typography noWrap sx={{ fontSize: 12, fontWeight: 700 }}>{asset.filename}</Typography><Typography noWrap sx={{ fontSize: 10.5, color: ws.textDim }}>{asset.folderName || t('unassigned')} · {asset.sourceName || 'Capture'}</Typography></Box>}
      </Box>
      <Checkbox size="small" checked={checked} onChange={() => toggleSelected(asset.id)}
        inputProps={{ 'aria-label': `${t('selected')}: ${asset.filename}` }}
        sx={{ position: 'absolute', top: 2, left: 2, p: 0.35, bgcolor: 'rgba(8,10,13,.72)', borderRadius: 1, color: '#fff', '&.Mui-checked': { color: ws.accent } }} />
      {asset.reviewStatus && <Box aria-hidden sx={{ position: 'absolute', top: 6, right: 6, width: 10, height: 10, borderRadius: '50%', bgcolor: STATUS_COLOR[asset.reviewStatus], boxShadow: '0 0 0 2px rgba(0,0,0,.7)' }} />}
      {asset.clientSelection && <Chip label={asset.clientSelection === 'favorite' ? '♥' : asset.clientSelection} size="small" sx={{ position: 'absolute', bottom: compact ? 5 : 42, right: 5, height: 20, fontSize: 10, bgcolor: 'rgba(8,10,13,.78)', color: ws.text }} />}
      {!!asset.clientCommentCount && <Chip label={asset.clientCommentCount} size="small" sx={{ position: 'absolute', bottom: compact ? 5 : 42, left: 5, height: 20, minWidth: 22, fontSize: 10, bgcolor: 'rgba(8,10,13,.78)', color: ws.blue }} />}
    </Box>;
  };

  const renderComment = (comment: PhotoComment, nested = false) => <Box key={comment.id} sx={{ ml: nested ? 2 : 0, pl: nested ? 1.25 : 0, borderLeft: nested ? `2px solid ${ws.border}` : 0, py: 1 }}>
    <Stack direction="row" alignItems="center" spacing={0.75}><Typography sx={{ fontSize: 11.5, fontWeight: 800 }}>{comment.authorName}</Typography><Chip size="small" label={comment.authorKind === 'client' ? t('client') : t('internal')} sx={{ height: 18, fontSize: 9.5 }} /><Box sx={{ flex: 1 }} />{comment.status === 'resolved' && <Typography sx={{ fontSize: 10, color: ws.green }}>{t('resolve')}</Typography>}</Stack>
    {editing?.id === comment.id ? <Stack spacing={0.75} sx={{ mt: 0.75 }}><TextField size="small" multiline value={editingText} onChange={(event) => setEditingText(event.target.value)} /><Stack direction="row" spacing={0.5}><Button size="small" onClick={() => void updateComment(comment, { comment: editingText })}>{t('save')}</Button><Button size="small" onClick={() => setEditing(null)}>{t('cancel')}</Button></Stack></Stack> : <Typography sx={{ mt: 0.5, fontSize: 12.5, color: ws.textDim, whiteSpace: 'pre-wrap' }}>{comment.comment}</Typography>}
    {!readOnly && !editing && comment.source !== 'client_gallery_response' && <Stack direction="row" spacing={0.25} sx={{ mt: 0.5 }}><Button size="small" startIcon={<Reply />} onClick={() => { setReplyTo(comment); setCommentScope(comment.scope); }}>{t('reply')}</Button>{comment.source === 'project' && <Button size="small" onClick={() => void updateComment(comment, { status: comment.status === 'open' ? 'resolved' : 'open' })}>{comment.status === 'open' ? t('resolve') : t('reopen')}</Button>}{comment.canEdit && <Tooltip title={t('edit')}><IconButton size="small" onClick={() => { setEditing(comment); setEditingText(comment.comment); }}><EditOutlined fontSize="small" /></IconButton></Tooltip>}{comment.canEdit && <Tooltip title={t('remove')}><IconButton size="small" onClick={() => void deleteComment(comment)}><DeleteOutline fontSize="small" /></IconButton></Tooltip>}</Stack>}
  </Box>;

  const navItem = (label: string, count: number | undefined, active: boolean, onClick: () => void, icon?: React.ReactNode) => (
    <ButtonBase onClick={onClick} sx={{ width: '100%', px: 1, py: 0.75, borderRadius: 1.5, justifyContent: 'flex-start', gap: 1,
      color: active ? ws.accent : ws.textDim, bgcolor: active ? ws.accentSoft : 'transparent',
      border: `1px solid ${active ? ws.accentBorder : 'transparent'}`,
      '&:hover': { bgcolor: active ? ws.accentSoft : ws.panelAlt, color: ws.text },
      '&:focus-visible': { outline: `2px solid ${ws.accent}`, outlineOffset: 1 } }}>
      {icon}<Typography noWrap sx={{ flex: 1, textAlign: 'left', fontSize: 12.5, fontWeight: active ? 750 : 550 }}>{label}</Typography>
      {count !== undefined && <Typography sx={{ fontSize: 10.5, color: active ? ws.accent : ws.textFaint }}>{count}</Typography>}
    </ButtonBase>
  );

  const renderInspector = () => {
    if (!selectedAsset) return <Typography sx={{ color: ws.textFaint, fontSize: 12 }}>{t('noPhotos')}</Typography>;
    if (inspectorTab === 'comments') return <>
      <Stack direction="row" spacing={0.5} sx={{ mb: 1 }}>{(['all', 'internal', 'client'] as const).map((scope) => <Chip key={scope} clickable label={t(scope)} color={commentFilter === scope ? 'primary' : 'default'} onClick={() => setCommentFilter(scope)} />)}</Stack>
      <Typography sx={{ fontSize: 10.5, color: ws.textFaint }}>{t('sharedRoom')}</Typography><Divider sx={{ my: 1.25 }} />
      <Box sx={{ maxHeight: '48vh', overflowY: 'auto' }}>{commentsLoading ? <CircularProgress size={22} /> : rootComments.length ? rootComments.map((comment) => <React.Fragment key={comment.id}>{renderComment(comment)}{repliesFor(comment.id).map((reply) => renderComment(reply, true))}</React.Fragment>) : <Typography sx={{ py: 3, textAlign: 'center', fontSize: 12, color: ws.textFaint }}>{t('noComments')}</Typography>}</Box>
      {!readOnly && <><Divider sx={{ my: 1.25 }} />{replyTo && <Stack direction="row" alignItems="center"><Typography sx={{ flex: 1, fontSize: 10.5, color: ws.textFaint }}>{t('replyTo')} {replyTo.authorName}</Typography><IconButton size="small" onClick={() => setReplyTo(null)}><Close fontSize="small" /></IconButton></Stack>}{!replyTo && <Stack direction="row" spacing={0.5} sx={{ mb: 0.75 }}>{(['internal', 'client'] as const).map((scope) => <Chip key={scope} clickable label={t(scope)} color={commentScope === scope ? 'primary' : 'default'} onClick={() => setCommentScope(scope)} />)}</Stack>}<TextField fullWidth multiline minRows={2} value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder={t('writeComment')} inputProps={{ maxLength: 4000 }} /><Button fullWidth variant="contained" onClick={() => void submitComment()} disabled={busy || !commentText.trim()} sx={{ mt: 1, bgcolor: ws.accent, color: ws.accentContrast }}>{t('send')} · ⌘↵</Button></>}
    </>;
    if (inspectorTab === 'metadata') return <Stack spacing={1}>
      <Box><Typography sx={{ fontSize: 10.5, color: ws.textFaint }}>{t('sources')}</Typography><Typography sx={{ fontSize: 13, fontWeight: 700 }}>{selectedAsset.sourceName || 'Capture'}</Typography></Box>
      <Box><Typography sx={{ fontSize: 10.5, color: ws.textFaint }}>{t('collections')}</Typography><Typography sx={{ fontSize: 12.5 }}>{selectedAsset.collections?.join(', ') || t('unassigned')}</Typography></Box>
      <Box><Typography sx={{ fontSize: 10.5, color: ws.textFaint }}>{t('storageNote')}</Typography><Typography sx={{ fontSize: 12.5, color: selectedAsset.state === 'verified' || selectedAsset.state === 'uploaded' ? ws.green : ws.textDim }}>{selectedAsset.state || t('verified')} · {formatBytes(selectedAsset.sizeBytes)}</Typography></Box>
      <Divider />
      {Object.entries(selectedAsset.exif || {}).filter(([, value]) => value != null).map(([key, value]) => <Stack key={key} direction="row" justifyContent="space-between" spacing={1}><Typography sx={{ fontSize: 11, color: ws.textFaint }}>{key}</Typography><Typography sx={{ fontSize: 11.5, textAlign: 'right' }}>{String(value)}</Typography></Stack>)}
    </Stack>;
    if (inspectorTab === 'versions') return <Stack spacing={1}>
      <Typography sx={{ fontSize: 11, color: ws.textDim }}>Originalen og alle AI-resultater er samlet på dette bildet.</Typography>
      <Box sx={{ p: 1, border: `1px solid ${ws.accentBorder}`, borderRadius: 1.5 }}><Typography sx={{ fontSize: 11.5, fontWeight: 750 }}>Original</Typography><Typography noWrap sx={{ fontSize: 10.5, color: ws.textFaint }}>{selectedAsset.filename}</Typography></Box>
      {activeAiJobs.map((job) => <Box key={job.id} sx={{ p: 1, border: `1px solid ${ws.border}`, borderRadius: 1.5, bgcolor: ws.panelAlt }}><Stack direction="row" justifyContent="space-between"><Typography sx={{ fontSize: 11.5, fontWeight: 750 }}>{job.kind === 'image-to-video' ? t('animate') : t('aiEdit')}</Typography><Chip size="small" label={t(job.status)} /></Stack>{job.afterUrl && <Box component={job.kind === 'image-to-video' ? 'video' : 'img'} src={job.afterUrl} controls={job.kind === 'image-to-video'} alt="" sx={{ width: '100%', aspectRatio: '3/2', objectFit: 'cover', mt: 0.75, borderRadius: 1 }} />}{job.status === 'completed' && <Button component="a" href={`/api/projects/${encodeURIComponent(projectId)}/ai/jobs/${job.id}/download`} size="small" startIcon={<Download />}>{t('download')}</Button>}</Box>)}
      {!activeAiJobs.length && <Typography sx={{ color: ws.textFaint, fontSize: 12 }}>{t('noAiJobs')}</Typography>}
    </Stack>;
    if (inspectorTab === 'activity') return <Stack spacing={1}>
      <Typography sx={{ fontSize: 12.5, fontWeight: 750 }}>{selectedAsset.filename}</Typography>
      <Stack direction="row" justifyContent="space-between"><Typography sx={{ fontSize: 11, color: ws.textFaint }}>{t('review')}</Typography><Typography sx={{ fontSize: 11.5 }}>{statusLabel(selectedAsset.reviewStatus)}</Typography></Stack>
      <Stack direction="row" justifyContent="space-between"><Typography sx={{ fontSize: 11, color: ws.textFaint }}>{t('client')}</Typography><Typography sx={{ fontSize: 11.5 }}>{selectedAsset.clientSelection || '—'}</Typography></Stack>
      <Stack direction="row" justifyContent="space-between"><Typography sx={{ fontSize: 11, color: ws.textFaint }}>{t('comments')}</Typography><Typography sx={{ fontSize: 11.5 }}>{selectedAsset.clientCommentCount || 0}</Typography></Stack>
      <Stack direction="row" justifyContent="space-between"><Typography sx={{ fontSize: 11, color: ws.textFaint }}>{t('activity')}</Typography><Typography sx={{ fontSize: 11.5 }}>{selectedAsset.createdAt ? new Date(selectedAsset.createdAt).toLocaleString(locale === 'en' ? 'en-GB' : 'nb-NO') : '—'}</Typography></Stack>
    </Stack>;
    return <Stack spacing={1.25}>
      <Box><Typography noWrap sx={{ fontSize: 13, fontWeight: 800 }}>{selectedAsset.filename}</Typography><Typography sx={{ fontSize: 11, color: selectedAsset.reviewStatus ? STATUS_COLOR[selectedAsset.reviewStatus] : ws.textDim }}>{statusLabel(selectedAsset.reviewStatus)}</Typography></Box>
      <Stack direction="row" spacing={0.25}>{[1, 2, 3, 4, 5].map((rating) => <IconButton key={rating} size="small" aria-label={`${rating} ${t('rating')}`} disabled={readOnly || busy} onClick={() => void updateAssetLabel(selectedAsset.id, { rating })}>{rating <= selectedAsset.rating ? <Star sx={{ fontSize: 19, color: ws.amber }} /> : <StarBorder sx={{ fontSize: 19, color: ws.textFaint }} />}</IconButton>)}</Stack>
      {!readOnly && <><Stack direction="row" flexWrap="wrap" gap={0.75}><Button size="small" startIcon={<CheckCircle />} onClick={() => void setStatus([selectedAsset.id], 'approved')}>{t('approve')}</Button><Button size="small" startIcon={<Brush />} onClick={() => void setStatus([selectedAsset.id], 'needs_edit')}>{t('needsEdit')}</Button><Button size="small" startIcon={<Block />} onClick={() => void setStatus([selectedAsset.id], 'rejected')}>{t('rejected')}</Button></Stack><Button size="small" startIcon={<Collections />} onClick={() => setOrganizeOpen(true)}>{t('organize')}</Button>{aiConfig?.enabled && aiConfig?.whitelisted && <Stack direction="row" spacing={0.5}><Button size="small" startIcon={<AutoFixHigh />} onClick={() => { setAiMode('edit'); setAiOpen(true); }}>{t('aiEdit')}</Button><Button size="small" startIcon={<Movie />} onClick={() => { setAiMode('motion'); setAiOpen(true); }}>{t('animate')}</Button></Stack>}</>}
    </Stack>;
  };

  return <Box ref={roomRef} sx={{ minWidth: 0, bgcolor: ws.bg }}>
    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5} sx={{ mb: 1.5 }}><Box><Typography component="h1" sx={{ fontSize: 22, fontWeight: 850 }}>{t('title')}</Typography><Typography sx={{ fontSize: 12.5, color: ws.textDim }}>{t('subtitle')}</Typography><Typography sx={{ mt: 0.35, fontSize: 10.5, color: ws.textDim }}>{t('storageNote')}</Typography></Box><Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap"><Button size="small" startIcon={<Keyboard />} onClick={() => setCommandCenter('help')}>{t('shortcuts')}</Button>{data?.gallery && <Button component="a" href={data.gallery.shareUrl} target="_blank" rel="noreferrer" variant="outlined">{t('openGallery')}</Button>}<Tooltip title={t('refresh')}><IconButton aria-label={t('refresh')} onClick={() => { void loadPhotos(0); void loadAi(); }}><Refresh /></IconButton></Tooltip></Stack></Stack>
    {readOnly && <Alert severity="info" sx={{ mb: 1.5 }}>{t('readOnly')}</Alert>}

    <Stack direction="row" spacing={0.75} flexWrap="wrap" sx={{ mb: 1.5 }}>
      {[
        ['all', t('totalPhotos'), stats.total || 0, ws.text], ['pending', t('pending'), stats.pending || 0, ws.amber],
        ['approved', t('approved'), stats.approved || 0, ws.green], ['needs_edit', t('needsEdit'), stats.needsEdit || 0, ws.red],
        ['favorites', t('favorites'), stats.favorites || 0, ws.accent],
      ].map(([key, label, value, color]) => <ButtonBase key={String(key)} onClick={() => setStatusFilter(String(key))} sx={{ px: 1.2, py: 0.7, borderRadius: 2, gap: 0.75, border: `1px solid ${statusFilter === key ? ws.accentBorder : ws.borderSoft}`, bgcolor: statusFilter === key ? ws.accentSoft : ws.panel, '&:focus-visible': { outline: `2px solid ${ws.accent}` } }}><Typography sx={{ fontSize: 11, color: ws.textDim }}>{label}</Typography><Typography sx={{ fontSize: 13, fontWeight: 850, color }}>{value}</Typography></ButtonBase>)}
      <Box sx={{ flex: 1 }} />
      {([['grid', t('library'), <GridView key="g" />], ['review', t('review'), <ViewCarousel key="r" />], ['delivery', t('delivery'), <Send key="d" />]] as const).map(([key, label, icon]) => <Button size="small" key={key} startIcon={icon} variant={viewMode === key ? 'contained' : 'outlined'} onClick={() => setViewMode(key)}>{label}</Button>)}
    </Stack>

    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0,1fr)', lg: `210px minmax(0,1fr) ${inspectorOpen ? '330px' : '42px'}` }, gap: 1.5, alignItems: 'start' }}>
      <WsCard pad={1} sx={{ display: { xs: 'none', lg: 'block' }, position: 'sticky', top: 12, maxHeight: 'calc(100vh - 32px)', overflowY: 'auto' }}>
        <Typography sx={{ px: 1, mb: 0.5, fontSize: 10.5, fontWeight: 800, color: ws.textDim, textTransform: 'uppercase' }}>{t('smartViews')}</Typography>
        <Stack spacing={0.25}>{navItem(t('allPhotos'), stats.total || 0, statusFilter === 'all' && folderFilter === 'all' && sourceFilter === 'all' && collectionFilter === 'all', clearFilters, <PhotoLibrary fontSize="small" />)}{navItem(t('pending'), stats.pending || 0, statusFilter === 'pending', () => setStatusFilter('pending'))}{navItem(t('needsEdit'), stats.needsEdit || 0, statusFilter === 'needs_edit', () => setStatusFilter('needs_edit'))}{navItem(t('approved'), stats.approved || 0, statusFilter === 'approved', () => setStatusFilter('approved'))}{navItem(t('favorites'), stats.favorites || 0, statusFilter === 'favorites', () => setStatusFilter('favorites'))}</Stack>
        <Divider sx={{ my: 1.25 }} /><Typography sx={{ px: 1, mb: 0.5, fontSize: 10.5, fontWeight: 800, color: ws.textDim, textTransform: 'uppercase' }}>{t('sources')}</Typography>
        <Stack spacing={0.25}>{(data?.sources || []).map((source) => <React.Fragment key={source.id}>{navItem(source.name, source.assetCount, sourceFilter === source.id, () => setSourceFilter(sourceFilter === source.id ? 'all' : source.id), source.kind === 'lightroom' ? <SettingsSuggest fontSize="small" /> : <PhotoLibrary fontSize="small" />)}</React.Fragment>)}</Stack>
        <Divider sx={{ my: 1.25 }} /><Typography sx={{ px: 1, mb: 0.5, fontSize: 10.5, fontWeight: 800, color: ws.textDim, textTransform: 'uppercase' }}>{t('collections')}</Typography>
        <Stack spacing={0.25}>{navItem(t('unassigned'), undefined, folderFilter === 'unassigned', () => setFolderFilter(folderFilter === 'unassigned' ? 'all' : 'unassigned'), <FolderOutlined fontSize="small" />)}{(data?.folders || []).map((folder) => <React.Fragment key={folder.id}>{navItem(folder.name, folder.assetCount, folderFilter === folder.id, () => setFolderFilter(folderFilter === folder.id ? 'all' : folder.id), <FolderOutlined fontSize="small" />)}</React.Fragment>)}{(data?.collections || []).map((collection) => <React.Fragment key={collection.name}>{navItem(collection.name, collection.assetCount, collectionFilter === collection.name, () => setCollectionFilter(collectionFilter === collection.name ? 'all' : collection.name), <Collections fontSize="small" />)}</React.Fragment>)}</Stack>
        <Divider sx={{ my: 1.25 }} /><Typography sx={{ px: 1, mb: 0.5, fontSize: 10.5, fontWeight: 800, color: ws.textDim, textTransform: 'uppercase' }}>{t('deliveries')}</Typography>
        {(data?.deliveries || []).slice(0, 5).map((delivery) => navItem(`${t('round')} ${delivery.proofingRound} · ${delivery.clientName}`, delivery.assetCount, false, () => setViewMode('delivery'), <History key={delivery.id} fontSize="small" />))}
      </WsCard>

      <Box sx={{ minWidth: 0 }}>
        <WsCard pad={1} sx={{ mb: 1 }}><Stack direction={{ xs: 'column', md: 'row' }} spacing={0.75} alignItems={{ md: 'center' }}>
          <TextField inputRef={searchRef} size="small" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder={t('search')} InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }} sx={{ minWidth: 190, flex: 1 }} />
          <FormControl size="small" sx={{ minWidth: 135 }}><InputLabel>{t('allStatuses')}</InputLabel><Select value={statusFilter} label={t('allStatuses')} inputProps={{ 'aria-label': t('allStatuses') }} onChange={(event) => setStatusFilter(event.target.value)}><MenuItem value="all">{t('allStatuses')}</MenuItem><MenuItem value="pending">{t('pending')}</MenuItem><MenuItem value="approved">{t('approved')}</MenuItem><MenuItem value="needs_edit">{t('needsEdit')}</MenuItem><MenuItem value="rejected">{t('rejected')}</MenuItem><MenuItem value="flagged">{t('flagged')}</MenuItem><MenuItem value="favorites">{t('favorites')}</MenuItem></Select></FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}><Select value={sort} inputProps={{ 'aria-label': t('sort') }} onChange={(event) => setSort(event.target.value)}><MenuItem value="newest">{t('newest')}</MenuItem><MenuItem value="oldest">{t('oldest')}</MenuItem><MenuItem value="name_asc">{t('nameAsc')}</MenuItem><MenuItem value="name_desc">{t('nameDesc')}</MenuItem><MenuItem value="rating">{t('rating')}</MenuItem></Select></FormControl>
          <Tooltip title={t('clearFilters')}><IconButton aria-label={t('clearFilters')} onClick={clearFilters}><FilterAltOff /></IconButton></Tooltip>
        </Stack></WsCard>

        {!!selectedIds.length && <WsCard pad={1} sx={{ mb: 1, position: 'sticky', top: 8, zIndex: 5, borderColor: ws.accentBorder }}><Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap"><Chip label={`${selectedIds.length} ${t('selected')}`} color="primary" /><Button size="small" onClick={() => setSelectedIds(assets.map((asset) => asset.id))}>{t('selectAll')}</Button><Button size="small" onClick={() => setSelectedIds([])}>{t('clear')}</Button><Box sx={{ flex: 1 }} /><Button size="small" startIcon={<Collections />} onClick={() => setOrganizeOpen(true)} disabled={readOnly}>{t('organize')}</Button><Button size="small" startIcon={<Compare />} onClick={() => setCompareOpen(true)} disabled={selectedIds.length !== 2}>{t('compare')}</Button><Button size="small" startIcon={<Brush />} onClick={() => void setStatus(selectedIds, 'needs_edit')} disabled={readOnly || busy}>{t('requestChanges')}</Button><Button size="small" startIcon={<CheckCircle />} onClick={() => void setStatus(selectedIds, 'approved')} disabled={readOnly || busy}>{t('approve')}</Button><Button size="small" variant="contained" startIcon={<Send />} onClick={() => setDeliveryOpen(true)} disabled={readOnly || busy} sx={{ bgcolor: ws.accent, color: ws.accentContrast }}>{t('sendClient')}</Button></Stack></WsCard>}

        {viewMode === 'grid' && <WsCard pad={0.5} sx={{ mb: 1 }}>
          {typeof ResizeObserver !== 'undefined' && assets.length > 40 ? <VirtuosoGrid style={{ height: '68vh', minHeight: 520 }} totalCount={assets.length} components={VIRTUAL_GRID_COMPONENTS} itemContent={(index) => renderTile(assets[index], false)} endReached={() => { if (data?.pageInfo?.hasMore && !loadingMore) void loadPhotos(assets.length); }} /> : <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(168px,1fr))', gap: 1 }}>{assets.map((asset) => renderTile(asset, false))}</Box>}
          {!assets.length && <Typography sx={{ py: 6, textAlign: 'center', color: ws.textFaint }}>{t('noPhotos')}</Typography>}
        </WsCard>}

        {viewMode === 'review' && <>{selectedAsset ? <WsCard pad={1} sx={{ mb: 1 }}><Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.75 }}><Box sx={{ minWidth: 0 }}><Typography noWrap sx={{ fontWeight: 800 }}>{selectedAsset.filename}</Typography><Typography sx={{ fontSize: 10.5, color: ws.textFaint }}>{selectedAsset.sourceName || 'Capture'} · {selectedAsset.folderName || t('unassigned')}</Typography></Box><Button size="small" startIcon={<GridView />} onClick={() => setViewMode('grid')}>{t('library')}</Button></Stack><Box component="img" src={selectedAsset.fullUrl || selectedAsset.thumbUrl || undefined} alt={selectedAsset.filename} sx={{ display: 'block', width: '100%', height: 'min(68vh,760px)', minHeight: 360, objectFit: 'contain', bgcolor: '#05070a', borderRadius: `${ws.radiusSm}px` }} /></WsCard> : <WsCard><Typography sx={{ color: ws.textDim }}>{t('noPhotos')}</Typography></WsCard>}<WsCard pad={0.75} sx={{ mb: 1 }}><Stack direction="row" spacing={0.75} sx={{ overflowX: 'auto', pb: 0.25 }}>{assets.map((asset) => renderTile(asset, true))}</Stack></WsCard></>}

        {viewMode === 'delivery' && <Stack spacing={1}>
          <WsCard><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}><Box><Typography sx={{ fontWeight: 850 }}>{t('deliveries')}</Typography><Typography sx={{ fontSize: 12, color: ws.textDim }}>Hver utsending fryses som en etterprøvbar revisjonsrunde.</Typography></Box><Button variant="contained" startIcon={<Send />} disabled={readOnly || !selectedForAction.length} onClick={() => setDeliveryOpen(true)} sx={{ bgcolor: ws.accent, color: ws.accentContrast }}>{t('sendClient')}</Button></Stack></WsCard>
          {(data?.deliveries || []).length ? (data?.deliveries || []).map((delivery) => <WsCard key={delivery.id} pad={1.25}><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}><History sx={{ color: ws.accent }} /><Box sx={{ flex: 1 }}><Typography sx={{ fontSize: 13, fontWeight: 750 }}>{delivery.clientName} · {t('round')} {delivery.proofingRound}</Typography><Typography sx={{ fontSize: 10.5, color: ws.textFaint }}>{delivery.assetCount} {t('totalPhotos').toLowerCase()} · {delivery.createdAt ? new Date(delivery.createdAt).toLocaleString(locale === 'en' ? 'en-GB' : 'nb-NO') : ''}</Typography></Box><Chip size="small" color={delivery.emailSent ? 'success' : 'default'} label={delivery.emailSent ? t('sendEmail') : delivery.clientEmail} /></Stack></WsCard>) : <WsCard><Typography sx={{ color: ws.textFaint }}>{t('noDeliveries')}</Typography></WsCard>}
        </Stack>}

        <Stack direction="row" justifyContent="center" alignItems="center" spacing={1} sx={{ py: 1 }}><Typography sx={{ fontSize: 11, color: ws.textDim }}>{t('showing')} {assets.length} {t('of')} {data?.pageInfo?.total || assets.length}</Typography>{data?.pageInfo?.hasMore && <Button size="small" disabled={loadingMore} onClick={() => void loadPhotos(assets.length)}>{loadingMore ? <CircularProgress size={16} /> : t('loadMore')}</Button>}</Stack>
      </Box>

      {inspectorOpen ? <WsCard pad={1.25} sx={{ position: { lg: 'sticky' }, top: 12, width: '100%', maxHeight: { lg: 'calc(100vh - 32px)' }, overflowY: 'auto' }}><Stack direction="row" alignItems="center" justifyContent="space-between"><Typography sx={{ fontSize: 13.5, fontWeight: 850 }}>{t('inspector')}</Typography><IconButton size="small" aria-label="Lukk inspektør" onClick={() => setInspectorOpen(false)}><Close fontSize="small" /></IconButton></Stack><Stack direction="row" spacing={0.25} sx={{ mt: 0.75, overflowX: 'auto' }}>{([['review', <RateReview key="r" />], ['comments', <Reply key="c" />], ['metadata', <InfoOutlined key="m" />], ['versions', <AutoFixHigh key="v" />], ['activity', <History key="a" />]] as const).map(([key, icon]) => <Tooltip key={key} title={t(key)}><IconButton size="small" color={inspectorTab === key ? 'primary' : 'default'} aria-label={t(key)} onClick={() => setInspectorTab(key)}>{icon}</IconButton></Tooltip>)}</Stack><Divider sx={{ my: 1.1 }} />{renderInspector()}</WsCard> : <Tooltip title={t('inspector')}><IconButton aria-label={t('inspector')} onClick={() => setInspectorOpen(true)} sx={{ display: { xs: 'none', lg: 'inline-flex' }, position: 'sticky', top: 12, border: `1px solid ${ws.border}` }}><InfoOutlined /></IconButton></Tooltip>}
    </Box>

    <WsModal open={compareOpen} onClose={() => setCompareOpen(false)} title={t('compare')} maxWidth="lg">{compareAssets.length === 2 ? <PhotoCompare assets={compareAssets as [PhotoAsset, PhotoAsset]} /> : <Alert severity="info">{t('compareHint')}</Alert>}</WsModal>

    <WsModal open={deliveryOpen} onClose={() => setDeliveryOpen(false)} title={t('deliveryTitle')} maxWidth="sm"><Stack spacing={2}><Typography sx={{ color: ws.textDim }}>{selectedForAction.length} {t('selected')} · {t('clientGallery')}</Typography><TextField label={t('clientName')} value={clientName} onChange={(event) => setClientName(event.target.value)} required /><TextField label={t('clientEmail')} type="email" value={clientEmail} onChange={(event) => setClientEmail(event.target.value)} required />{data?.gallery && <><Chip clickable color={newRound ? 'primary' : 'default'} label={t('newRound')} onClick={() => setNewRound((value) => !value)} /><Typography sx={{ fontSize: 11, color: ws.textFaint }}>{t('clientGallery')} · {t('round')} {data.gallery.proofingRound}</Typography></>}<Chip clickable color={notifyClient ? 'primary' : 'default'} label={t('sendEmail')} onClick={() => setNotifyClient((value) => !value)} /><Stack direction="row" justifyContent="flex-end" spacing={1}><Button onClick={() => setDeliveryOpen(false)}>{t('cancel')}</Button><Button variant="contained" disabled={busy || !clientName.trim() || !clientEmail.trim()} onClick={() => void deliver()} sx={{ bgcolor: ws.accent, color: ws.accentContrast }}>{t('deliver')}</Button></Stack></Stack></WsModal>

    <WsModal open={organizeOpen} onClose={() => setOrganizeOpen(false)} title={t('organize')} maxWidth="sm"><Stack spacing={2}>
      <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>{selectedForAction.length} {t('selected')}. Originalfilene blir liggende urørt i CreatorHub S3.</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <FormControl size="small" fullWidth><InputLabel>{t('moveToFolder')}</InputLabel><Select value={organizeFolderId} label={t('moveToFolder')} onChange={(event) => setOrganizeFolderId(event.target.value)}><MenuItem value="">{t('unassigned')}</MenuItem>{(data?.folders || []).map((folder) => <MenuItem key={folder.id} value={folder.id}>{folder.name}</MenuItem>)}</Select></FormControl>
        <Button variant="outlined" disabled={busy || readOnly} onClick={() => void organize('move_folder')}>{t('moveToFolder')}</Button>
      </Stack>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <TextField size="small" fullWidth label={t('collectionName')} value={organizeCollection} onChange={(event) => setOrganizeCollection(event.target.value)} inputProps={{ maxLength: 80 }} />
        <Button variant="outlined" disabled={busy || readOnly || !organizeCollection.trim()} onClick={() => void organize('add_collection')}>{t('addCollection')}</Button>
      </Stack>
      <Divider />
      <Typography sx={{ fontSize: 11, fontWeight: 750, color: ws.textDim }}>{t('createFolder')}</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><TextField size="small" fullWidth label={t('folderName')} value={newFolderName} onChange={(event) => setNewFolderName(event.target.value)} inputProps={{ maxLength: 120 }} /><Button startIcon={<CreateNewFolder />} disabled={busy || readOnly || !newFolderName.trim()} onClick={() => void createFolder()}>{t('createFolder')}</Button></Stack>
    </Stack></WsModal>

    <WsModal open={aiOpen} onClose={() => setAiOpen(false)} title={aiMode === 'edit' ? t('aiEdit') : t('animate')} maxWidth="sm"><Stack spacing={1.5}>{!aiConfig?.consent?.consented ? <><Alert severity="warning"><Typography sx={{ fontWeight: 800 }}>{t('consentTitle')}</Typography>{t('consentText')}</Alert><Button disabled={readOnly} onClick={() => void apiRequest(`/api/projects/${encodeURIComponent(projectId)}/ai/consent`, { method: 'PUT', body: { consented: true } }).then(loadAi)}>{t('consent')}</Button></> : <><TextField autoFocus multiline minRows={3} label={t('aiPrompt')} value={aiPrompt} onChange={(event) => setAiPrompt(event.target.value)} inputProps={{ maxLength: 1000 }} /><Button size="small" startIcon={<AutoFixHigh />} disabled={aiBusy} onClick={() => void suggestAi()}>{t('suggestions')}</Button><Stack spacing={0.5}>{aiSuggestions.map((suggestion) => <Button key={suggestion} variant="outlined" onClick={() => setAiPrompt(suggestion)} sx={{ justifyContent: 'flex-start', textAlign: 'left' }}>{suggestion}</Button>)}</Stack><Stack direction="row" justifyContent="space-between" alignItems="center"><Typography sx={{ fontSize: 11, color: ws.textFaint }}>${Number(credits?.balanceUsd || 0).toFixed(2)}</Typography><Button variant="contained" disabled={readOnly || aiBusy || !aiPrompt.trim()} onClick={() => void runAi()} sx={{ bgcolor: ws.accent, color: ws.accentContrast }}>{aiBusy ? <CircularProgress size={18} /> : t('start')}</Button></Stack></>}</Stack></WsModal>
    <MediaRoomCommandCenter open={commandCenter !== null} mode={commandCenter || 'commands'} locale={locale} commands={roomCommands} onClose={() => setCommandCenter(null)} />
    <AiBuyCreditsModal open={buyOpen} onClose={() => setBuyOpen(false)} credits={credits} onBuy={(packId) => void buyPack(packId)} />
  </Box>;
};

export default PhotoRoomTab;
