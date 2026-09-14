import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, Divider, FormControl,
  IconButton, InputLabel, MenuItem, Select, Stack, TextField, Tooltip, Typography,
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
import Movie from '@mui/icons-material/Movie';
import Refresh from '@mui/icons-material/Refresh';
import Reply from '@mui/icons-material/Reply';
import Search from '@mui/icons-material/Search';
import Send from '@mui/icons-material/Send';
import Star from '@mui/icons-material/Star';
import StarBorder from '@mui/icons-material/StarBorder';
import ViewCarousel from '@mui/icons-material/ViewCarousel';

import { apiRequest } from '@/lib/queryClient';
import AiBuyCreditsModal from '../AiBuyCreditsModal';
import { makeT, type WsDict, useWsLocale } from '../wsLocale';
import { WsCard, WsErrorState, WsModal, wsAlert, wsConfirm } from '../ui';
import { ws } from '../workspaceTheme';

type ReviewStatus = 'approved' | 'needs_edit' | 'rejected' | 'flagged' | null;
type CommentScope = 'internal' | 'client';
type ViewMode = 'filmstrip' | 'grid';

interface PhotoAsset {
  id: string; filename: string; mime?: string; rating: number; flagged: boolean;
  rejected: boolean; colorLabel?: string | null; reviewStatus: ReviewStatus;
  folderId?: string | null; folderName?: string | null; galleryImageId?: string | null;
  galleryId?: string | null; clientSelection?: string | null; clientCommentCount: number;
  thumbUrl?: string | null; fullUrl?: string | null;
  exif?: Record<string, string | number | null>; createdAt?: string;
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
  folders: Array<{ id: string; name: string }>;
  gallery: { id: string; shareUrl: string; clientName: string; clientEmail: string; proofingRound: number } | null;
  pageInfo: { offset: number; limit: number; total: number; hasMore: boolean };
  assets: PhotoAsset[];
}

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
  filmstrip: { no: 'Filmstripe', en: 'Filmstrip' }, grid: { no: 'Rutenett', en: 'Grid' },
  newest: { no: 'Nyeste først', en: 'Newest first' },
  oldest: { no: 'Eldste først', en: 'Oldest first' },
  nameAsc: { no: 'Filnavn A–Å', en: 'Filename A–Z' },
  nameDesc: { no: 'Filnavn Å–A', en: 'Filename Z–A' },
  rating: { no: 'Høyest vurdert', en: 'Highest rated' },
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
};

const STATUS_COLOR: Record<Exclude<ReviewStatus, null>, string> = {
  approved: ws.green, needs_edit: ws.amber, rejected: ws.red, flagged: ws.accent,
};

const uniqueIds = (values: string[]) => [...new Set(values)];

const PhotoRoomTab: React.FC<{ projectId: string; readOnly?: boolean }> = ({ projectId, readOnly = false }) => {
  const t = makeT(COPY, useWsLocale());
  const isReal = Boolean(projectId && projectId !== 'sample');
  const [data, setData] = useState<PhotoRoomData | null>(null);
  const [assets, setAssets] = useState<PhotoAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [folderFilter, setFolderFilter] = useState('all');
  const [sort, setSort] = useState('newest');
  const [viewMode, setViewMode] = useState<ViewMode>('filmstrip');
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

  useEffect(() => {
    const timeout = window.setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const queryString = useCallback((offset: number) => {
    const params = new URLSearchParams({ limit: '80', offset: String(offset), sort });
    if (search) params.set('search', search);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (folderFilter !== 'all') params.set('folderId', folderFilter);
    return params.toString();
  }, [folderFilter, search, sort, statusFilter]);

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
        setSelectedIds([]);
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
      setSelectedIds([]); await loadPhotos(0);
    } catch (reason) { await wsAlert(reason instanceof Error ? reason.message : t('unknownError')); }
    finally { setBusy(false); }
  };

  const toggleSelected = (id: string) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : uniqueIds([...current, id]));

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

  if (loading && !data) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress sx={{ color: ws.accent }} /></Box>;
  if (error && !data) return <WsErrorState message={t('loadFailed')} retryLabel={t('retry')} onRetry={() => void loadPhotos(0)} />;
  if (isReal && data && !data.hasSession) return <WsCard><Typography sx={{ fontWeight: 800, mb: 1 }}>{t('title')}</Typography><Typography sx={{ color: ws.textDim }}>{t('noSession')}</Typography></WsCard>;

  const renderTile = (asset: PhotoAsset, compact: boolean) => {
    const active = asset.id === selectedAsset?.id;
    const checked = selectedIds.includes(asset.id);
    return <Box key={asset.id} sx={{ position: 'relative', flex: compact ? '0 0 112px' : undefined, minWidth: 0 }}>
      <Box component="button" type="button" aria-label={`${asset.filename}, ${statusLabel(asset.reviewStatus)}`}
        aria-current={active ? 'true' : undefined} onClick={() => setSelectedAssetId(asset.id)}
        sx={{ display: 'block', width: '100%', p: 0, overflow: 'hidden', cursor: 'pointer', textAlign: 'left',
          borderRadius: `${ws.radiusSm}px`, border: `2px solid ${active ? ws.accent : checked ? ws.blue : ws.border}`,
          bgcolor: ws.panelAlt, color: ws.text, '&:focus-visible': { outline: `3px solid ${ws.accentBorder}`, outlineOffset: 2 } }}>
        <Box component="img" src={asset.thumbUrl || undefined} alt="" sx={{ display: 'block', width: '100%', aspectRatio: compact ? '4 / 3' : '3 / 2', objectFit: 'cover', bgcolor: '#090b0e' }} />
        {!compact && <Box sx={{ p: 1 }}><Typography noWrap sx={{ fontSize: 12, fontWeight: 700 }}>{asset.filename}</Typography><Typography sx={{ fontSize: 10.5, color: ws.textFaint }}>{asset.folderName || t('allFolders')}</Typography></Box>}
      </Box>
      <Checkbox size="small" checked={checked} onChange={() => toggleSelected(asset.id)}
        inputProps={{ 'aria-label': `${t('selected')}: ${asset.filename}` }}
        sx={{ position: 'absolute', top: 2, left: 2, p: 0.35, bgcolor: 'rgba(8,10,13,.72)', borderRadius: 1, color: '#fff', '&.Mui-checked': { color: ws.accent } }} />
      {asset.reviewStatus && <Box aria-hidden sx={{ position: 'absolute', top: 6, right: 6, width: 10, height: 10, borderRadius: '50%', bgcolor: STATUS_COLOR[asset.reviewStatus], boxShadow: '0 0 0 2px rgba(0,0,0,.7)' }} />}
      {asset.clientSelection && <Chip label={asset.clientSelection === 'favorite' ? '♥' : asset.clientSelection} size="small" sx={{ position: 'absolute', bottom: compact ? 5 : 42, right: 5, height: 20, fontSize: 10, bgcolor: 'rgba(8,10,13,.78)', color: ws.text }} />}
    </Box>;
  };

  const renderComment = (comment: PhotoComment, nested = false) => <Box key={comment.id} sx={{ ml: nested ? 2 : 0, pl: nested ? 1.25 : 0, borderLeft: nested ? `2px solid ${ws.border}` : 0, py: 1 }}>
    <Stack direction="row" alignItems="center" spacing={0.75}><Typography sx={{ fontSize: 11.5, fontWeight: 800 }}>{comment.authorName}</Typography><Chip size="small" label={comment.authorKind === 'client' ? t('client') : t('internal')} sx={{ height: 18, fontSize: 9.5 }} /><Box sx={{ flex: 1 }} />{comment.status === 'resolved' && <Typography sx={{ fontSize: 10, color: ws.green }}>{t('resolve')}</Typography>}</Stack>
    {editing?.id === comment.id ? <Stack spacing={0.75} sx={{ mt: 0.75 }}><TextField size="small" multiline value={editingText} onChange={(event) => setEditingText(event.target.value)} /><Stack direction="row" spacing={0.5}><Button size="small" onClick={() => void updateComment(comment, { comment: editingText })}>{t('save')}</Button><Button size="small" onClick={() => setEditing(null)}>{t('cancel')}</Button></Stack></Stack> : <Typography sx={{ mt: 0.5, fontSize: 12.5, color: ws.textDim, whiteSpace: 'pre-wrap' }}>{comment.comment}</Typography>}
    {!readOnly && !editing && comment.source !== 'client_gallery_response' && <Stack direction="row" spacing={0.25} sx={{ mt: 0.5 }}><Button size="small" startIcon={<Reply />} onClick={() => { setReplyTo(comment); setCommentScope(comment.scope); }}>{t('reply')}</Button>{comment.source === 'project' && <Button size="small" onClick={() => void updateComment(comment, { status: comment.status === 'open' ? 'resolved' : 'open' })}>{comment.status === 'open' ? t('resolve') : t('reopen')}</Button>}{comment.canEdit && <Tooltip title={t('edit')}><IconButton size="small" onClick={() => { setEditing(comment); setEditingText(comment.comment); }}><EditOutlined fontSize="small" /></IconButton></Tooltip>}{comment.canEdit && <Tooltip title={t('remove')}><IconButton size="small" onClick={() => void deleteComment(comment)}><DeleteOutline fontSize="small" /></IconButton></Tooltip>}</Stack>}
  </Box>;

  return <Box sx={{ minWidth: 0 }}>
    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5} sx={{ mb: 2 }}><Box><Typography component="h1" sx={{ fontSize: 22, fontWeight: 850 }}>{t('title')}</Typography><Typography sx={{ fontSize: 12.5, color: ws.textDim }}>{t('subtitle')}</Typography><Typography sx={{ mt: 0.5, fontSize: 10.5, color: ws.textFaint }}>{t('storageNote')}</Typography></Box><Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">{data?.gallery && <Button component="a" href={data.gallery.shareUrl} target="_blank" rel="noreferrer" variant="outlined">{t('openGallery')}</Button>}<Tooltip title={t('refresh')}><IconButton aria-label={t('refresh')} onClick={() => { void loadPhotos(0); void loadAi(); }}><Refresh /></IconButton></Tooltip></Stack></Stack>
    {readOnly && <Alert severity="info" sx={{ mb: 2 }}>{t('readOnly')}</Alert>}

    <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>{[[t('totalPhotos'), stats.total || 0, ws.text], [t('pending'), stats.pending || 0, ws.amber], [t('approved'), stats.approved || 0, ws.green], [t('needsEdit'), stats.needsEdit || 0, ws.red], [t('totalComments'), stats.comments || 0, ws.blue]].map(([label, value, color]) => <WsCard key={String(label)} pad={1.25} sx={{ minWidth: 125, flex: '1 1 125px' }}><Typography sx={{ fontSize: 10.5, color: ws.textFaint }}>{label}</Typography><Typography sx={{ fontSize: 20, fontWeight: 850, color }}>{value}</Typography></WsCard>)}</Stack>

    <WsCard pad={1.25} sx={{ mb: 2 }}><Stack direction={{ xs: 'column', lg: 'row' }} spacing={1} alignItems={{ lg: 'center' }}>
      <TextField size="small" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder={t('search')} InputProps={{ startAdornment: <Search sx={{ mr: 1, color: ws.textFaint }} /> }} sx={{ minWidth: 220, flex: 1 }} />
      <FormControl size="small" sx={{ minWidth: 150 }}><InputLabel>{t('allStatuses')}</InputLabel><Select value={statusFilter} label={t('allStatuses')} onChange={(event) => setStatusFilter(event.target.value)}><MenuItem value="all">{t('allStatuses')}</MenuItem><MenuItem value="pending">{t('pending')}</MenuItem><MenuItem value="approved">{t('approved')}</MenuItem><MenuItem value="needs_edit">{t('needsEdit')}</MenuItem><MenuItem value="rejected">{t('rejected')}</MenuItem><MenuItem value="flagged">{t('flagged')}</MenuItem></Select></FormControl>
      <FormControl size="small" sx={{ minWidth: 150 }}><InputLabel>{t('allFolders')}</InputLabel><Select value={folderFilter} label={t('allFolders')} onChange={(event) => setFolderFilter(event.target.value)}><MenuItem value="all">{t('allFolders')}</MenuItem>{(data?.folders || []).map((folder) => <MenuItem key={folder.id} value={folder.id}>{folder.name}</MenuItem>)}</Select></FormControl>
      <FormControl size="small" sx={{ minWidth: 150 }}><Select value={sort} onChange={(event) => setSort(event.target.value)}><MenuItem value="newest">{t('newest')}</MenuItem><MenuItem value="oldest">{t('oldest')}</MenuItem><MenuItem value="name_asc">{t('nameAsc')}</MenuItem><MenuItem value="name_desc">{t('nameDesc')}</MenuItem><MenuItem value="rating">{t('rating')}</MenuItem></Select></FormControl>
      <Tooltip title={t('filmstrip')}><IconButton aria-label={t('filmstrip')} color={viewMode === 'filmstrip' ? 'primary' : 'default'} onClick={() => setViewMode('filmstrip')}><ViewCarousel /></IconButton></Tooltip><Tooltip title={t('grid')}><IconButton aria-label={t('grid')} color={viewMode === 'grid' ? 'primary' : 'default'} onClick={() => setViewMode('grid')}><GridView /></IconButton></Tooltip>
    </Stack></WsCard>

    <WsCard pad={1.25} sx={{ mb: 2 }}><Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }}><Typography sx={{ fontSize: 12.5, fontWeight: 750 }}>{selectedIds.length} {t('selected')}</Typography><Button size="small" onClick={() => setSelectedIds(assets.map((asset) => asset.id))} disabled={!assets.length}>{t('selectAll')}</Button><Button size="small" onClick={() => setSelectedIds([])} disabled={!selectedIds.length}>{t('clear')}</Button><Box sx={{ flex: 1 }} /><Button size="small" startIcon={<Compare />} onClick={() => setCompareOpen(true)} disabled={selectedIds.length !== 2}>{t('compare')}</Button><Button size="small" startIcon={<Brush />} color="warning" onClick={() => void setStatus(selectedForAction, 'needs_edit')} disabled={readOnly || busy || !selectedForAction.length}>{t('requestChanges')}</Button><Button size="small" startIcon={<CheckCircle />} color="success" onClick={() => void setStatus(selectedForAction, 'approved')} disabled={readOnly || busy || !selectedForAction.length}>{t('approve')}</Button><Button size="small" variant="contained" startIcon={<Send />} onClick={() => setDeliveryOpen(true)} disabled={readOnly || busy || !selectedForAction.length} sx={{ bgcolor: ws.accent, color: ws.accentContrast, '&:hover': { bgcolor: ws.accentHover } }}>{t('sendClient')}</Button></Stack></WsCard>

    {viewMode === 'grid' && <WsCard sx={{ mb: 2 }}><Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 1 }}>{assets.map((asset) => renderTile(asset, false))}</Box></WsCard>}

    <Stack direction={{ xs: 'column', xl: 'row' }} spacing={2} alignItems="flex-start"><Box sx={{ minWidth: 0, flex: 1, width: '100%' }}>
      {selectedAsset ? <WsCard pad={1.25} sx={{ mb: 2 }}><Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}><Box sx={{ minWidth: 0 }}><Typography noWrap sx={{ fontWeight: 800 }}>{selectedAsset.filename}</Typography><Typography sx={{ fontSize: 11, color: selectedAsset.reviewStatus ? STATUS_COLOR[selectedAsset.reviewStatus] : ws.textFaint }}>{statusLabel(selectedAsset.reviewStatus)}</Typography></Box><Stack direction="row">{[1, 2, 3, 4, 5].map((rating) => rating <= selectedAsset.rating ? <Star key={rating} sx={{ fontSize: 17, color: ws.amber }} /> : <StarBorder key={rating} sx={{ fontSize: 17, color: ws.textFaint }} />)}</Stack></Stack><Box component="img" src={selectedAsset.fullUrl || selectedAsset.thumbUrl || undefined} alt={selectedAsset.filename} sx={{ display: 'block', width: '100%', maxHeight: '68vh', minHeight: 260, objectFit: 'contain', bgcolor: '#07090c', borderRadius: `${ws.radiusSm}px` }} /><Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1 }}>{Object.entries(selectedAsset.exif || {}).filter(([, value]) => value != null).slice(0, 6).map(([key, value]) => <Typography key={key} sx={{ fontSize: 10.5, color: ws.textFaint }}>{key}: {String(value)}</Typography>)}</Stack>{!readOnly && <Stack direction="row" spacing={0.75} flexWrap="wrap" sx={{ mt: 1.25 }}><Button size="small" startIcon={<CheckCircle />} onClick={() => void setStatus([selectedAsset.id], 'approved')}>{t('approve')}</Button><Button size="small" startIcon={<Brush />} onClick={() => void setStatus([selectedAsset.id], 'needs_edit')}>{t('needsEdit')}</Button><Button size="small" startIcon={<Block />} onClick={() => void setStatus([selectedAsset.id], 'rejected')}>{t('rejected')}</Button>{aiConfig?.enabled && aiConfig?.whitelisted && <><Button size="small" startIcon={<AutoFixHigh />} onClick={() => { setAiMode('edit'); setAiOpen(true); }}>{t('aiEdit')}</Button><Button size="small" startIcon={<Movie />} onClick={() => { setAiMode('motion'); setAiOpen(true); }}>{t('animate')}</Button></>}</Stack>}</WsCard> : <WsCard><Typography sx={{ color: ws.textDim }}>{t('noPhotos')}</Typography></WsCard>}
      {viewMode === 'filmstrip' && <WsCard pad={1.1} sx={{ mb: 2 }}><Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 0.5 }}>{assets.map((asset) => renderTile(asset, true))}</Stack></WsCard>}
      <Stack alignItems="center" spacing={1} sx={{ mb: 2 }}><Typography sx={{ fontSize: 11, color: ws.textFaint }}>{t('showing')} {assets.length} {t('of')} {data?.pageInfo?.total || assets.length}</Typography>{data?.pageInfo?.hasMore && <Button disabled={loadingMore} onClick={() => void loadPhotos(assets.length)}>{loadingMore ? <CircularProgress size={18} /> : t('loadMore')}</Button>}</Stack>
    </Box>

    <WsCard sx={{ width: { xs: '100%', xl: 380 }, flexShrink: 0 }}><Stack direction="row" justifyContent="space-between" alignItems="center"><Typography sx={{ fontSize: 15, fontWeight: 850 }}>{t('comments')}</Typography><Stack direction="row" spacing={0.5}>{(['all', 'internal', 'client'] as const).map((scope) => <Chip key={scope} clickable label={t(scope)} color={commentFilter === scope ? 'primary' : 'default'} onClick={() => setCommentFilter(scope)} />)}</Stack></Stack><Typography sx={{ mt: 0.5, fontSize: 10.5, color: ws.textFaint }}>{t('sharedRoom')}</Typography><Divider sx={{ my: 1.25 }} /><Box sx={{ maxHeight: 480, overflowY: 'auto' }}>{commentsLoading ? <CircularProgress size={22} /> : rootComments.length ? rootComments.map((comment) => <React.Fragment key={comment.id}>{renderComment(comment)}{repliesFor(comment.id).map((reply) => renderComment(reply, true))}</React.Fragment>) : <Typography sx={{ py: 3, textAlign: 'center', fontSize: 12, color: ws.textFaint }}>{t('noComments')}</Typography>}</Box>{!readOnly && selectedAsset && <><Divider sx={{ my: 1.25 }} />{replyTo && <Stack direction="row" alignItems="center"><Typography sx={{ flex: 1, fontSize: 10.5, color: ws.textFaint }}>{t('replyTo')} {replyTo.authorName}</Typography><IconButton size="small" onClick={() => setReplyTo(null)}><Close fontSize="small" /></IconButton></Stack>}{!replyTo && <Stack direction="row" spacing={0.5} sx={{ mb: 0.75 }}>{(['internal', 'client'] as const).map((scope) => <Chip key={scope} clickable label={t(scope)} color={commentScope === scope ? 'primary' : 'default'} onClick={() => setCommentScope(scope)} />)}</Stack>}<TextField fullWidth multiline minRows={2} value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder={t('writeComment')} inputProps={{ maxLength: 4000 }} /><Button fullWidth variant="contained" onClick={() => void submitComment()} disabled={busy || !commentText.trim()} sx={{ mt: 1, bgcolor: ws.accent, color: ws.accentContrast, '&:hover': { bgcolor: ws.accentHover } }}>{t('send')}</Button></>}</WsCard></Stack>

    <WsCard sx={{ mt: 2 }}><Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}><Typography sx={{ fontWeight: 850 }}>{t('aiHistory')}</Typography><Button size="small" startIcon={<Refresh />} onClick={() => void loadAi()}>{t('refresh')}</Button></Stack>{aiJobs.length ? <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 1 }}>{aiJobs.map((job) => <Box key={job.id} sx={{ p: 1.25, border: `1px solid ${ws.border}`, borderRadius: `${ws.radiusSm}px`, bgcolor: ws.panelAlt }}><Stack direction="row" justifyContent="space-between"><Typography sx={{ fontSize: 11.5, fontWeight: 800 }}>{job.kind === 'image-to-video' ? t('animate') : t('aiEdit')}</Typography><Chip size="small" label={t(job.status)} /></Stack>{job.afterUrl && <Box component={job.kind === 'image-to-video' ? 'video' : 'img'} src={job.afterUrl} controls={job.kind === 'image-to-video'} alt="" sx={{ display: 'block', width: '100%', aspectRatio: '3 / 2', objectFit: 'cover', mt: 1, borderRadius: 1 }} />}<Typography sx={{ fontSize: 10.5, color: ws.textFaint, mt: 0.75 }} noWrap>{job.prompt || job.model}</Typography>{job.status === 'completed' && <Button component="a" href={`/api/projects/${encodeURIComponent(projectId)}/ai/jobs/${job.id}/download`} size="small" startIcon={<Download />} sx={{ mt: 0.5 }}>{t('download')}</Button>}</Box>)}</Box> : <Typography sx={{ color: ws.textFaint, fontSize: 12 }}>{t('noAiJobs')}</Typography>}</WsCard>

    <WsModal open={compareOpen} onClose={() => setCompareOpen(false)} title={t('compare')} maxWidth="lg">{compareAssets.length === 2 ? <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>{compareAssets.map((asset) => <Box key={asset.id} sx={{ flex: 1, minWidth: 0 }}><Typography noWrap sx={{ mb: 0.75, fontWeight: 750 }}>{asset.filename}</Typography><Box component="img" src={asset.fullUrl || asset.thumbUrl || undefined} alt={asset.filename} sx={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', bgcolor: '#07090c' }} /></Box>)}</Stack> : <Alert severity="info">{t('compareHint')}</Alert>}</WsModal>

    <WsModal open={deliveryOpen} onClose={() => setDeliveryOpen(false)} title={t('deliveryTitle')} maxWidth="sm"><Stack spacing={2}><Typography sx={{ color: ws.textDim }}>{selectedForAction.length} {t('selected')} · {t('clientGallery')}</Typography><TextField label={t('clientName')} value={clientName} onChange={(event) => setClientName(event.target.value)} required /><TextField label={t('clientEmail')} type="email" value={clientEmail} onChange={(event) => setClientEmail(event.target.value)} required />{data?.gallery && <><Chip clickable color={newRound ? 'primary' : 'default'} label={t('newRound')} onClick={() => setNewRound((value) => !value)} /><Typography sx={{ fontSize: 11, color: ws.textFaint }}>{t('clientGallery')} · {t('round')} {data.gallery.proofingRound}</Typography></>}<Chip clickable color={notifyClient ? 'primary' : 'default'} label={t('sendEmail')} onClick={() => setNotifyClient((value) => !value)} /><Stack direction="row" justifyContent="flex-end" spacing={1}><Button onClick={() => setDeliveryOpen(false)}>{t('cancel')}</Button><Button variant="contained" disabled={busy || !clientName.trim() || !clientEmail.trim()} onClick={() => void deliver()} sx={{ bgcolor: ws.accent, color: ws.accentContrast }}>{t('deliver')}</Button></Stack></Stack></WsModal>

    <WsModal open={aiOpen} onClose={() => setAiOpen(false)} title={aiMode === 'edit' ? t('aiEdit') : t('animate')} maxWidth="sm"><Stack spacing={1.5}>{!aiConfig?.consent?.consented ? <><Alert severity="warning"><Typography sx={{ fontWeight: 800 }}>{t('consentTitle')}</Typography>{t('consentText')}</Alert><Button disabled={readOnly} onClick={() => void apiRequest(`/api/projects/${encodeURIComponent(projectId)}/ai/consent`, { method: 'PUT', body: { consented: true } }).then(loadAi)}>{t('consent')}</Button></> : <><TextField autoFocus multiline minRows={3} label={t('aiPrompt')} value={aiPrompt} onChange={(event) => setAiPrompt(event.target.value)} inputProps={{ maxLength: 1000 }} /><Button size="small" startIcon={<AutoFixHigh />} disabled={aiBusy} onClick={() => void suggestAi()}>{t('suggestions')}</Button><Stack spacing={0.5}>{aiSuggestions.map((suggestion) => <Button key={suggestion} variant="outlined" onClick={() => setAiPrompt(suggestion)} sx={{ justifyContent: 'flex-start', textAlign: 'left' }}>{suggestion}</Button>)}</Stack><Stack direction="row" justifyContent="space-between" alignItems="center"><Typography sx={{ fontSize: 11, color: ws.textFaint }}>${Number(credits?.balanceUsd || 0).toFixed(2)}</Typography><Button variant="contained" disabled={readOnly || aiBusy || !aiPrompt.trim()} onClick={() => void runAi()} sx={{ bgcolor: ws.accent, color: ws.accentContrast }}>{aiBusy ? <CircularProgress size={18} /> : t('start')}</Button></Stack></>}</Stack></WsModal>
    <AiBuyCreditsModal open={buyOpen} onClose={() => setBuyOpen(false)} credits={credits} onBuy={(packId) => void buyPack(packId)} />
  </Box>;
};

export default PhotoRoomTab;
