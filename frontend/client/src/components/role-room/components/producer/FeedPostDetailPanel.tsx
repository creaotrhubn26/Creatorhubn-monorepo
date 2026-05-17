import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Autorenew as AutorenewIcon,
  AddPhotoAlternate as AddPhotoAlternateIcon,
  AutoAwesome as AutoAwesomeIcon,
  Bookmark as BookmarkIcon,
  BookmarkAdd as BookmarkAddIcon,
  Close as CloseIcon,
  Collections as CollectionsIcon,
  DeleteOutline as DeleteOutlineIcon,
  LockOpen as LockOpenIcon,
  Lock as LockIcon,
  Movie as MovieIcon,
  Tag as TagIcon,
} from '@mui/icons-material';
import roleRoomAgentService, {
  RoleRoomFeedEntitlementError,
} from '../../services/roleRoomAgentService';
import RoleRoomTierIcon, { ROLE_ROOM_TIERS, tierForEntitlementSource } from './RoleRoomTierIcon';
import type {
  RoleRoomAgentBrandColor,
  RoleRoomAgentProducerBootstrapResult,
  RoleRoomFeedBrandSnapshot,
  RoleRoomFeedLogoPlacement,
  RoleRoomFeedMediaType,
  RoleRoomFeedPlatform,
  RoleRoomFeedPost,
  RoleRoomFeedPostConcept,
  RoleRoomFeedTemplate,
  RoleRoomFeedTemplatePayload,
} from '../../services/roleRoomAgentService';
import { CONCEPT_LABELS, FEED_POST_CONCEPT_ORDER, buildFeedPost } from '../../utils/feedPlanner';
import FeedPostTile from './FeedPostTile';
import GoogleDriveImagePicker from './GoogleDriveImagePicker';
import FeedPostApprovalActions from './FeedPostApprovalActions';
import LinkedInPublishAsSelector from './LinkedInPublishAsSelector';

type FeedPostDetailPanelProps = {
  projectId: string;
  post: RoleRoomFeedPost;
  postIndex: number;
  bootstrap: RoleRoomAgentProducerBootstrapResult;
  brandSnapshot: RoleRoomFeedBrandSnapshot | null;
  platform: RoleRoomFeedPlatform;
  isShowrunner?: boolean;
  instagramConnections?: { id: string; igUsername: string | null }[];
  onUpdate: (patch: Partial<RoleRoomFeedPost>) => void;
  onRegenerate: (post: RoleRoomFeedPost) => void;
  onClose?: () => void;
  onEntitlementBlocked?: (message: string) => void;
};

const LOGO_PLACEMENT_OPTIONS: { value: RoleRoomFeedLogoPlacement; label: string }[] = [
  { value: 'top-left', label: 'Oppe venstre' },
  { value: 'top-right', label: 'Oppe høyre' },
  { value: 'bottom-left', label: 'Nede venstre' },
  { value: 'bottom-right', label: 'Nede høyre' },
  { value: 'center', label: 'Sentrert' },
];

const MEDIA_TYPE_OPTIONS: { value: RoleRoomFeedMediaType; label: string }[] = [
  { value: 'image', label: 'Bilde' },
  { value: 'reel', label: 'Reel' },
  { value: 'carousel', label: 'Karusell' },
];

function formatScheduleInputValue(iso: string | null): string {
  if (!iso) return '';
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (value: number) => value.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  } catch {
    return '';
  }
}

export default function FeedPostDetailPanel({
  projectId,
  post,
  postIndex,
  bootstrap,
  brandSnapshot,
  platform,
  isShowrunner = false,
  instagramConnections = [],
  onUpdate,
  onRegenerate,
  onClose,
  onEntitlementBlocked,
}: FeedPostDetailPanelProps) {
  const hashtagsText = useMemo(() => post.hashtags.join(' '), [post.hashtags]);
  const [drivePickerOpen, setDrivePickerOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiNote, setAiNote] = useState<{ strategyNotes: string; bestTimeRationale: string; freshness: string } | null>(null);
  const [tierSlug, setTierSlug] = useState<'spotlight' | 'headliner' | 'showrunner' | 'admin' | null>(null);
  const [templates, setTemplates] = useState<RoleRoomFeedTemplate[]>([]);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await roleRoomAgentService.listFeedTemplates(projectId, platform);
        if (!cancelled) setTemplates(list);
      } catch {
        /* templates are optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, platform]);

  const applyTemplate = (template: RoleRoomFeedTemplatePayload) => {
    if (post.locked) return;
    // Apply all template fields except customImageUrl/customImageName + scheduledFor.
    // Image stays per-post; schedule is per-post too.
    onUpdate({
      concept: template.concept || post.concept,
      title: template.title || post.title,
      caption: template.caption || post.caption,
      hashtags: template.hashtags?.length ? template.hashtags : post.hashtags,
      callToAction: template.callToAction || post.callToAction,
      imageStyle: template.imageStyle || post.imageStyle,
      backgroundColor: template.backgroundColor ?? post.backgroundColor,
      accentColor: template.accentColor ?? post.accentColor,
      textColor: template.textColor ?? post.textColor,
      logoPlacement: template.logoPlacement ?? post.logoPlacement,
      mediaType: template.mediaType ?? post.mediaType,
    });
  };

  const saveCurrentAsTemplate = async () => {
    const name = window.prompt(
      'Navn på malen?',
      `${post.title?.slice(0, 40) || 'Mal'} — ${new Date().toLocaleDateString('nb-NO')}`,
    );
    if (!name?.trim()) return;
    setSavingTemplate(true);
    setTemplateError(null);
    try {
      const created = await roleRoomAgentService.createFeedTemplate({
        projectId,
        platform,
        name: name.trim(),
        template: {
          concept: String(post.concept),
          title: post.title,
          caption: post.caption,
          hashtags: post.hashtags,
          callToAction: post.callToAction,
          imageStyle: post.imageStyle,
          backgroundColor: post.backgroundColor,
          accentColor: post.accentColor,
          textColor: post.textColor,
          logoPlacement: post.logoPlacement,
          mediaType: post.mediaType,
        },
      });
      if (created) setTemplates((current) => [created, ...current]);
    } catch (caught) {
      setTemplateError(caught instanceof Error ? caught.message : 'Kunne ikke lagre malen.');
    } finally {
      setSavingTemplate(false);
    }
  };

  const archiveTemplate = async (templateId: string) => {
    if (!window.confirm('Arkiver denne malen?')) return;
    const ok = await roleRoomAgentService.archiveFeedTemplate(templateId);
    if (ok) setTemplates((current) => current.filter((t) => t.id !== templateId));
  };

  const [publishing, setPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState<string | null>(null);
  const [fbPages, setFbPages] = useState<Array<{ id: string; name: string | null }>>([]);
  const [fbSelectedPageId, setFbSelectedPageId] = useState<string>('');
  const [fbPublishing, setFbPublishing] = useState(false);
  const [fbPublishStatus, setFbPublishStatus] = useState<string | null>(null);
  const [hashtagSuggesting, setHashtagSuggesting] = useState(false);
  const [hashtagSuggestError, setHashtagSuggestError] = useState<string | null>(null);
  const [hashtagSuggestions, setHashtagSuggestions] = useState<Array<{
    hashtag: string;
    reasoning: string;
    hashtagId: string | null;
    topMediaPreview: string | null;
    validationError: string | null;
  }>>([]);

  const resolveAuthToken = (): string | null => {
    try {
      const rr = localStorage.getItem('role_room_auth_token');
      if (rr) return rr;
      const ch = localStorage.getItem('creatorhub_auth_token');
      if (ch) return ch;
    } catch { /* ignore */ }
    return null;
  };

  // Load the producer's admin-able FB Pages once so the "Publish to
  // FB Page" action can render a picker alongside the IG publish CTA.
  useEffect(() => {
    const headers: Record<string, string> = {};
    const tok = resolveAuthToken();
    if (tok) headers['Authorization'] = `Bearer ${tok}`;
    fetch('/api/role-room/facebook/pages', { headers, credentials: 'include' })
      .then((r) => r.json().catch(() => ({})))
      .then((body) => {
        if (body?.success && Array.isArray(body.pages)) {
          setFbPages(body.pages);
          if (body.pages.length > 0) setFbSelectedPageId(body.pages[0].id);
        }
      })
      .catch(() => { /* silently ignore — button handles errors */ });
  }, []);

  const publishToFacebookPage = async () => {
    if (!post.customVideoDataUrl) {
      setFbPublishStatus('FB Page-publisering krever en video (reel-type).');
      return;
    }
    if (!fbSelectedPageId) {
      setFbPublishStatus('Velg en Facebook Page først.');
      return;
    }
    if (!window.confirm(`Publiser video til Facebook Page?`)) return;
    setFbPublishing(true);
    setFbPublishStatus(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const tok = resolveAuthToken();
      if (tok) headers['Authorization'] = `Bearer ${tok}`;
      const response = await fetch('/api/role-room/facebook/publish-video', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          pageId: fbSelectedPageId,
          videoDataUrl: post.customVideoDataUrl,
          description: `${post.title}\n\n${post.caption}\n\n${post.callToAction}\n\n${post.hashtags.join(' ')}`.trim(),
          scheduledFor: post.scheduledFor,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setFbPublishStatus(body?.error || `HTTP ${response.status}`);
        return;
      }
      if (body?.video?.scheduled) {
        setFbPublishStatus(`Køet for publisering ${post.scheduledFor ? new Date(post.scheduledFor).toLocaleString('nb-NO') : 'snart'} (video id ${body.video.id ?? '(ukjent)'})`);
      } else {
        setFbPublishStatus(`✓ Publisert til Facebook Page (video id ${body?.video?.id ?? '(ukjent)'})`);
      }
    } catch (e) {
      setFbPublishStatus(e instanceof Error ? e.message : 'FB-publisering feilet.');
    } finally {
      setFbPublishing(false);
    }
  };

  const publishToInstagram = async () => {
    if (!isShowrunner || platform !== 'instagram' || instagramConnections.length === 0) return;

    // Per-mediaType readiness check, aligned with the backend's
    // validation in queueAndPublish so the user gets the "missing X"
    // message before we even send the request.
    if (post.mediaType === 'carousel') {
      const count = post.customImageUrls?.length ?? 0;
      if (count < 2 || count > 10) {
        setPublishStatus('Carousel krever 2-10 bilder fra Drive.');
        return;
      }
    } else if (post.mediaType === 'reel') {
      if (!post.customVideoDataUrl) {
        setPublishStatus('Reel krever en video fra Drive.');
        return;
      }
    } else if (!post.customImageUrl) {
      setPublishStatus('Posten må ha et bilde fra Drive før den kan publiseres.');
      return;
    }

    if (!window.confirm(`Publiser nå til @${instagramConnections[0]?.igUsername ?? 'Instagram'}?`)) return;
    setPublishing(true);
    setPublishStatus(null);
    try {
      const result = await roleRoomAgentService.publishInstagram({
        connectionId: instagramConnections[0].id,
        projectId,
        feedPlanPostId: post.id,
        mediaType: post.mediaType,
        caption: `${post.title}\n\n${post.caption}\n\n${post.hashtags.join(' ')}\n\n${post.callToAction}`.trim(),
        imageDataUrl: post.mediaType === 'image' ? post.customImageUrl ?? undefined : undefined,
        imageDataUrls: post.mediaType === 'carousel' ? post.customImageUrls ?? undefined : undefined,
        videoDataUrl: post.mediaType === 'reel' ? post.customVideoDataUrl ?? undefined : undefined,
        scheduledFor: post.scheduledFor,
      });
      if (result.rateLimited) {
        setPublishStatus('Rate-limit nådd (50/24t). Prøv igjen senere.');
      } else if (result.immediatelyPublished) {
        setPublishStatus(`✓ Publisert (media id ${result.job.igMediaId})`);
      } else {
        setPublishStatus(`Køet for publisering ${post.scheduledFor ? new Date(post.scheduledFor).toLocaleString('nb-NO') : 'snart'}`);
      }
    } catch (caught) {
      if (caught instanceof RoleRoomFeedEntitlementError) {
        const message = caught.message || 'IG-publisering krever Showrunner.';
        setPublishStatus(message);
        onEntitlementBlocked?.(message);
      } else {
        setPublishStatus(caught instanceof Error ? caught.message : 'Publisering feilet.');
      }
    } finally {
      setPublishing(false);
    }
  };

  const requestAiRecommendation = async () => {
    if (post.locked) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const { recommendation, entitlement } = await roleRoomAgentService.recommendFeedPost({
        projectId,
        platform,
        post: {
          concept: String(post.concept),
          title: post.title,
          caption: post.caption,
          callToAction: post.callToAction,
          hashtags: post.hashtags,
          mediaType: post.mediaType,
        },
        brand: {
          companyName: bootstrap.companyProfile?.companyName ?? null,
          industry: bootstrap.companyProfile?.industry ?? null,
          subIndustry: bootstrap.companyProfile?.subIndustry ?? null,
          businessModel: bootstrap.companyProfile?.businessModel ?? null,
          targetAudience: bootstrap.companyProfile?.targetAudience ?? [],
          offerings: bootstrap.companyProfile?.offerings ?? [],
          toneOfVoice: bootstrap.planningDraft?.brandGuide?.toneOfVoice ?? null,
          visualStyle: bootstrap.planningDraft?.brandGuide?.visualStyle ?? null,
          keyMessage: bootstrap.intakeDraft?.keyMessage ?? null,
          dos: bootstrap.planningDraft?.brandGuide?.dos ?? [],
          donts: bootstrap.planningDraft?.brandGuide?.donts ?? [],
          logoUrl:
            bootstrap.planningDraft?.brandGuide?.logoUrl
            ?? bootstrap.companyProfile?.logoUrl
            ?? null,
          brandColors: (bootstrap.planningDraft?.brandGuide?.colors ?? [])
            .filter((entry): entry is RoleRoomAgentBrandColor => Boolean(entry?.hex))
            .map((entry) => ({
              label: entry.label,
              hex: entry.hex,
              usage: entry.usage ?? null,
            })),
        },
        scheduleHint: post.scheduledFor,
      });

      onUpdate({
        caption: recommendation.caption || post.caption,
        hashtags: recommendation.hashtags.length > 0 ? recommendation.hashtags : post.hashtags,
        callToAction: recommendation.callToAction || post.callToAction,
        scheduledFor: recommendation.scheduledFor ?? post.scheduledFor,
      });
      setAiNote({
        strategyNotes: recommendation.strategyNotes,
        bestTimeRationale: recommendation.bestTimeRationale,
        freshness: recommendation.strategyFreshness,
      });
      if (entitlement?.source) {
        setTierSlug(tierForEntitlementSource(entitlement.source));
      }
    } catch (caught) {
      if (caught instanceof RoleRoomFeedEntitlementError) {
        const message = caught.message || 'AI-anbefaling krever aktiv Role Room-pakke.';
        setAiError(message);
        onEntitlementBlocked?.(message);
      } else {
        setAiError(caught instanceof Error ? caught.message : 'Kunne ikke hente AI-anbefaling.');
      }
    } finally {
      setAiLoading(false);
    }
  };

  const handleConceptChange = (next: RoleRoomFeedPostConcept) => {
    if (post.locked) return;
    const rebuilt = buildFeedPost(bootstrap, {
      id: post.id,
      index: postIndex,
      concept: next,
      platform,
    });
    onUpdate({
      concept: next,
      title: rebuilt.title,
      caption: rebuilt.caption,
      hashtags: rebuilt.hashtags,
      callToAction: rebuilt.callToAction,
      imageStyle: rebuilt.imageStyle,
      mediaType: rebuilt.mediaType,
    });
  };

  const handleHashtagChange = (value: string) => {
    const tokens = value
      .split(/[\s,]+/)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => (entry.startsWith('#') ? entry : `#${entry}`));
    onUpdate({ hashtags: tokens.slice(0, 30) });
  };

  const handleScheduleChange = (value: string) => {
    if (!value) {
      onUpdate({ scheduledFor: null });
      return;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return;
    onUpdate({ scheduledFor: date.toISOString() });
  };

  return (
    <Stack
      spacing={1.6}
      sx={{
        p: 1.8,
        borderRadius: 2.5,
        bgcolor: 'rgba(15,23,42,0.72)',
        border: '1px solid rgba(148,163,184,0.16)',
        height: '100%',
        minHeight: 520,
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Stack spacing={0.2}>
          <Typography sx={{ color: '#e2e8f0', fontWeight: 800, fontSize: '0.98rem' }}>
            Rediger post
          </Typography>
          <Typography sx={{ color: 'rgba(226,232,240,0.58)', fontSize: '0.78rem' }}>
            Post {postIndex + 1} · {CONCEPT_LABELS[post.concept as RoleRoomFeedPostConcept] || 'Post'}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={0.5}>
          <Tooltip title={post.locked ? 'Lås opp' : 'Lås denne posten mot regenerering'}>
            <IconButton
              size="small"
              onClick={() => onUpdate({ locked: !post.locked })}
              sx={{ color: post.locked ? '#fbbf24' : 'rgba(226,232,240,0.7)' }}
            >
              {post.locked ? <LockIcon fontSize="small" /> : <LockOpenIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          {onClose ? (
            <IconButton size="small" onClick={onClose} aria-label="Lukk" sx={{ color: 'rgba(226,232,240,0.7)' }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          ) : null}
        </Stack>
      </Stack>

      <Box sx={{ mx: 'auto', width: 180 }}>
        <FeedPostTile post={post} index={postIndex} brandSnapshot={brandSnapshot} />
      </Box>

      <FeedPostApprovalActions
        projectId={projectId}
        platform={platform}
        post={post}
        onStateChanged={(nextState, note) =>
          onUpdate({
            approvalState: nextState,
            approvalChangedAt: new Date().toISOString(),
            approvalNote: note ?? null,
          })
        }
      />

      {platform === 'linkedin' ? (
        <LinkedInPublishAsSelector
          value={post.linkedInOrganizationUrn ?? null}
          onChange={(urn) => onUpdate({ linkedInOrganizationUrn: urn })}
        />
      ) : null}

      {/* Media picker — reacts to the post's mediaType: image = single
          picker, carousel = multi-pick (2-10), reel = video picker. All
          three surface the same Drive flow; kind= filters the listing
          server-side. */}
      {post.mediaType === 'carousel' ? (
        <Stack
          spacing={0.8}
          sx={{
            p: 1,
            borderRadius: 1.8,
            bgcolor: 'rgba(15,23,42,0.55)',
            border: '1px solid rgba(148,163,184,0.16)',
          }}
        >
          <Stack direction="row" spacing={0.8} alignItems="center">
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ color: '#e2e8f0', fontSize: '0.78rem', fontWeight: 700 }}>
                {post.customImageUrls && post.customImageUrls.length > 0
                  ? `${post.customImageUrls.length} bilder valgt`
                  : 'Carousel trenger 2-10 bilder'}
              </Typography>
              <Typography sx={{ color: 'rgba(226,232,240,0.58)', fontSize: '0.72rem' }}>
                {post.customImageUrls && post.customImageUrls.length > 0
                  ? (post.customImageNames ?? []).join(', ')
                  : 'Velg flere bilder fra Drive — holdes sammen som én carousel.'}
              </Typography>
            </Box>
            <Button
              size="small"
              variant="outlined"
              startIcon={<CollectionsIcon fontSize="small" />}
              onClick={() => setDrivePickerOpen(true)}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                color: '#22d3ee',
                borderColor: 'rgba(34,211,238,0.5)',
                '&:hover': { borderColor: '#22d3ee', bgcolor: 'rgba(34,211,238,0.08)' },
              }}
            >
              {post.customImageUrls && post.customImageUrls.length > 0 ? 'Endre utvalg' : 'Velg fra Drive'}
            </Button>
            {post.customImageUrls && post.customImageUrls.length > 0 ? (
              <Tooltip title="Fjern alle">
                <IconButton
                  size="small"
                  onClick={() => onUpdate({ customImageUrls: null, customImageNames: null })}
                  sx={{ color: 'rgba(248,113,113,0.9)' }}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            ) : null}
          </Stack>
          {post.customImageUrls && post.customImageUrls.length > 0 ? (
            <Stack direction="row" spacing={0.6} sx={{ overflowX: 'auto', py: 0.4 }}>
              {post.customImageUrls.map((url, index) => (
                <Box
                  key={`${url.slice(-16)}-${index}`}
                  sx={{
                    flexShrink: 0,
                    width: 56,
                    height: 56,
                    borderRadius: 1.2,
                    border: '1px solid rgba(148,163,184,0.22)',
                    background: `center/cover no-repeat url(${url})`,
                    position: 'relative',
                  }}
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 2,
                      left: 2,
                      bgcolor: 'rgba(15,23,42,0.82)',
                      color: '#fff',
                      fontSize: '0.64rem',
                      fontWeight: 800,
                      px: 0.5,
                      borderRadius: 0.6,
                    }}
                  >
                    {index + 1}
                  </Box>
                </Box>
              ))}
            </Stack>
          ) : null}
        </Stack>
      ) : post.mediaType === 'reel' ? (
        <Stack
          spacing={0.8}
          sx={{
            p: 1,
            borderRadius: 1.8,
            bgcolor: 'rgba(15,23,42,0.55)',
            border: '1px solid rgba(148,163,184,0.16)',
          }}
        >
          <Stack direction="row" spacing={0.8} alignItems="center">
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ color: '#e2e8f0', fontSize: '0.78rem', fontWeight: 700 }}>
                {post.customVideoDataUrl ? 'Video valgt' : 'Ingen video ennå'}
              </Typography>
              <Typography
                sx={{
                  color: 'rgba(226,232,240,0.58)',
                  fontSize: '0.72rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {post.customVideoDataUrl
                  ? post.customVideoName || 'Importert fra Drive (konverteres automatisk til 1080×1920 ved publisering)'
                  : 'Velg en video fra Drive — konverteres til IG-reel-spec ved publisering.'}
              </Typography>
            </Box>
            <Button
              size="small"
              variant="outlined"
              startIcon={<MovieIcon fontSize="small" />}
              onClick={() => setDrivePickerOpen(true)}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                color: '#22d3ee',
                borderColor: 'rgba(34,211,238,0.5)',
                '&:hover': { borderColor: '#22d3ee', bgcolor: 'rgba(34,211,238,0.08)' },
              }}
            >
              {post.customVideoDataUrl ? 'Bytt video' : 'Fra Drive'}
            </Button>
            {post.customVideoDataUrl ? (
              <Tooltip title="Fjern video">
                <IconButton
                  size="small"
                  onClick={() => onUpdate({ customVideoDataUrl: null, customVideoName: null })}
                  sx={{ color: 'rgba(248,113,113,0.9)' }}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            ) : null}
          </Stack>
          {post.customVideoDataUrl ? (
            <Box
              sx={{
                mt: 0.4,
                borderRadius: 1.4,
                overflow: 'hidden',
                bgcolor: '#000',
                maxWidth: 260,
                aspectRatio: '9 / 16',
              }}
            >
              <Box
                component="video"
                src={post.customVideoDataUrl}
                controls
                playsInline
                sx={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
              />
            </Box>
          ) : null}
        </Stack>
      ) : (
        <Stack
          spacing={0.8}
          sx={{
            p: 1,
            borderRadius: 1.8,
            bgcolor: 'rgba(15,23,42,0.55)',
            border: '1px solid rgba(148,163,184,0.16)',
          }}
        >
          <Stack direction="row" spacing={0.8} alignItems="center">
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ color: '#e2e8f0', fontSize: '0.78rem', fontWeight: 700 }}>
                {post.customImageUrl ? 'Eget bilde valgt' : 'Ingen egne bilder ennå'}
              </Typography>
              <Typography
                sx={{
                  color: 'rgba(226,232,240,0.58)',
                  fontSize: '0.72rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {post.customImageUrl
                  ? post.customImageName || 'Importert fra Google Drive'
                  : 'Velg et bilde fra Google Drive for å erstatte placeholder.'}
              </Typography>
            </Box>
            <Button
              size="small"
              variant="outlined"
              startIcon={<AddPhotoAlternateIcon fontSize="small" />}
              onClick={() => setDrivePickerOpen(true)}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                color: '#22d3ee',
                borderColor: 'rgba(34,211,238,0.5)',
                '&:hover': { borderColor: '#22d3ee', bgcolor: 'rgba(34,211,238,0.08)' },
              }}
            >
              {post.customImageUrl ? 'Bytt bilde' : 'Fra Drive'}
            </Button>
            {post.customImageUrl ? (
              <Tooltip title="Fjern eget bilde">
                <IconButton
                  size="small"
                  onClick={() => onUpdate({ customImageUrl: null, customImageName: null })}
                  sx={{ color: 'rgba(248,113,113,0.9)' }}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            ) : null}
          </Stack>
          {post.customImageUrl ? (
            <Box
              component="img"
              src={post.customImageUrl}
              alt={post.customImageName ?? 'valgt bilde'}
              sx={{
                mt: 0.4,
                maxWidth: 260,
                maxHeight: 260,
                borderRadius: 1.4,
                border: '1px solid rgba(148,163,184,0.18)',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          ) : null}
        </Stack>
      )}

      <GoogleDriveImagePicker
        open={drivePickerOpen}
        onClose={() => setDrivePickerOpen(false)}
        kind={post.mediaType === 'reel' ? 'video' : 'image'}
        multiSelect={post.mediaType === 'carousel' ? { min: 2, max: 10 } : undefined}
        onPick={(media) => {
          if (post.mediaType === 'reel') {
            onUpdate({ customVideoDataUrl: media.dataUrl, customVideoName: media.name });
          } else {
            onUpdate({ customImageUrl: media.dataUrl, customImageName: media.name });
          }
        }}
        onPickMultiple={(items) => {
          // Carousel branch — store parallel arrays.
          onUpdate({
            customImageUrls: items.map((i) => i.dataUrl),
            customImageNames: items.map((i) => i.name),
          });
        }}
      />

      {/* Brand-fargekontrollere — applied template-farger kan finjusteres her */}
      <Stack
        spacing={0.8}
        sx={{
          p: 1,
          borderRadius: 1.8,
          bgcolor: 'rgba(15,23,42,0.55)',
          border: '1px solid rgba(148,163,184,0.16)',
        }}
      >
        <Typography sx={{ color: '#e2e8f0', fontSize: '0.78rem', fontWeight: 700 }}>
          Brand-farger
        </Typography>
        <Stack direction="row" spacing={1.2} flexWrap="wrap" useFlexGap>
          <ColorSwatchInput
            label="Bakgrunn"
            value={post.backgroundColor || '#0f172a'}
            onChange={(value) => onUpdate({ backgroundColor: value })}
          />
          <ColorSwatchInput
            label="Accent"
            value={post.accentColor || '#22d3ee'}
            onChange={(value) => onUpdate({ accentColor: value })}
          />
          <ColorSwatchInput
            label="Tekst"
            value={post.textColor || '#f8fafc'}
            onChange={(value) => onUpdate({ textColor: value })}
          />
        </Stack>
      </Stack>

      {/* Maler — apply preserves edit-flow: feltene kan endres etterpå */}
      <Stack
        spacing={0.8}
        sx={{
          p: 1,
          borderRadius: 1.8,
          bgcolor: 'rgba(15,23,42,0.55)',
          border: '1px solid rgba(148,163,184,0.16)',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={0.6}>
          <BookmarkIcon fontSize="small" sx={{ color: '#a78bfa' }} />
          <Typography sx={{ color: '#e2e8f0', fontSize: '0.78rem', fontWeight: 700 }}>
            Maler
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Button
            size="small"
            startIcon={<BookmarkAddIcon fontSize="small" />}
            onClick={saveCurrentAsTemplate}
            disabled={savingTemplate}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '0.72rem',
              color: '#a78bfa',
              '&:hover': { bgcolor: 'rgba(167,139,250,0.08)' },
            }}
          >
            {savingTemplate ? 'Lagrer…' : 'Lagre som mal'}
          </Button>
        </Stack>
        {templates.length === 0 ? (
          <Typography sx={{ color: 'rgba(226,232,240,0.55)', fontSize: '0.7rem' }}>
            Ingen lagrede maler ennå. Tilpass posten og lagre den som mal for gjenbruk på fremtidige innlegg.
          </Typography>
        ) : (
          <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
            {templates.map((tpl) => (
              <Chip
                key={tpl.id}
                label={tpl.name}
                size="small"
                onClick={() => applyTemplate(tpl.template)}
                onDelete={() => archiveTemplate(tpl.id)}
                disabled={post.locked}
                sx={{
                  fontWeight: 600,
                  fontSize: '0.7rem',
                  color: 'rgba(226,232,240,0.88)',
                  borderColor: 'rgba(167,139,250,0.4)',
                  bgcolor: 'rgba(167,139,250,0.08)',
                  '&:hover': { bgcolor: 'rgba(167,139,250,0.16)' },
                  '& .MuiChip-deleteIcon': { color: 'rgba(248,113,113,0.7)' },
                }}
                variant="outlined"
                title={`Bruk malen "${tpl.name}". Du kan redigere felt etterpå.`}
              />
            ))}
          </Stack>
        )}
        {templateError ? (
          <Typography sx={{ color: '#fca5a5', fontSize: '0.7rem' }}>{templateError}</Typography>
        ) : null}
      </Stack>

      <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
        {FEED_POST_CONCEPT_ORDER.map((concept) => (
          <Chip
            key={concept}
            label={CONCEPT_LABELS[concept]}
            size="small"
            onClick={() => handleConceptChange(concept)}
            variant={concept === post.concept ? 'filled' : 'outlined'}
            disabled={post.locked}
            sx={{
              fontWeight: 700,
              fontSize: '0.72rem',
              color: concept === post.concept ? '#0b1220' : 'rgba(226,232,240,0.8)',
              bgcolor: concept === post.concept ? '#22d3ee' : 'transparent',
              borderColor: 'rgba(148,163,184,0.28)',
              '&:hover': {
                bgcolor: concept === post.concept ? '#22d3ee' : 'rgba(34,211,238,0.08)',
              },
            }}
          />
        ))}
      </Stack>

      <TextField
        size="small"
        label="Tittel"
        value={post.title}
        onChange={(event) => onUpdate({ title: event.target.value })}
        inputProps={{ maxLength: 160 }}
        fullWidth
        variant="outlined"
        sx={textFieldSx}
      />

      <TextField
        size="small"
        label="Caption"
        value={post.caption}
        onChange={(event) => onUpdate({ caption: event.target.value })}
        inputProps={{ maxLength: 2000 }}
        fullWidth
        multiline
        minRows={3}
        maxRows={6}
        variant="outlined"
        sx={textFieldSx}
      />

      <TextField
        size="small"
        label="Call to action"
        value={post.callToAction}
        onChange={(event) => onUpdate({ callToAction: event.target.value })}
        inputProps={{ maxLength: 160 }}
        fullWidth
        variant="outlined"
        sx={textFieldSx}
      />

      <TextField
        size="small"
        label="Hashtags"
        value={hashtagsText}
        onChange={(event) => handleHashtagChange(event.target.value)}
        placeholder="#kunde #bransje #kampanje"
        fullWidth
        variant="outlined"
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <TagIcon fontSize="small" sx={{ color: 'rgba(226,232,240,0.5)' }} />
            </InputAdornment>
          ),
        }}
        sx={textFieldSx}
      />

      <Stack direction="row" spacing={0.8} alignItems="center" flexWrap="wrap" useFlexGap>
        <Button
          size="small"
          variant="outlined"
          disabled={hashtagSuggesting || post.locked}
          onClick={async () => {
            setHashtagSuggesting(true);
            setHashtagSuggestError(null);
            setHashtagSuggestions([]);
            try {
              const headers: Record<string, string> = { 'Content-Type': 'application/json' };
              const tok = resolveAuthToken();
              if (tok) headers['Authorization'] = `Bearer ${tok}`;
              const response = await fetch('/api/role-room/agent/hashtag-suggest', {
                method: 'POST',
                headers,
                credentials: 'include',
                body: JSON.stringify({
                  context: `${post.title}\n${post.caption}\n${post.callToAction}\nKonsept: ${post.concept}`.trim(),
                  brand: bootstrap?.companyProfile?.companyName ?? '',
                  count: 10,
                }),
              });
              const body = await response.json().catch(() => ({}));
              if (!response.ok) {
                setHashtagSuggestError(body?.error || `HTTP ${response.status}`);
                return;
              }
              setHashtagSuggestions(body?.candidates || []);
            } catch (e) {
              setHashtagSuggestError(e instanceof Error ? e.message : 'Suggest feilet');
            } finally {
              setHashtagSuggesting(false);
            }
          }}
          startIcon={hashtagSuggesting ? <CircularProgress size={12} sx={{ color: '#c084fc' }} /> : <AutoAwesomeIcon fontSize="small" sx={{ color: '#c084fc' }} />}
          sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.75rem' }}
          data-testid="feedpost-hashtag-suggest"
        >
          {hashtagSuggesting ? 'Foreslår…' : 'Foreslå hashtags (AI + Meta)'}
        </Button>
        {hashtagSuggestions.length > 0 ? (
          <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.6)' }}>
            Klikk for å legge til:
          </Typography>
        ) : null}
      </Stack>
      {hashtagSuggestError ? (
        <Alert severity="error" sx={{ mt: -0.5 }}>{hashtagSuggestError}</Alert>
      ) : null}
      {hashtagSuggestions.length > 0 ? (
        <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap sx={{ gap: 0.6, mt: -0.6 }}>
          {hashtagSuggestions.map((s) => (
            <Chip
              key={s.hashtag}
              size="small"
              label={`#${s.hashtag}${s.hashtagId ? ' ✓' : ''}`}
              onClick={() => {
                const existing = hashtagsText.trim();
                const tag = `#${s.hashtag}`;
                if (existing.includes(tag)) return;
                handleHashtagChange(existing ? `${existing} ${tag}` : tag);
              }}
              title={s.reasoning || ''}
              color={s.hashtagId ? 'secondary' : 'default'}
              variant={s.hashtagId ? 'filled' : 'outlined'}
              clickable
            />
          ))}
        </Stack>
      ) : null}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2}>
        <FormControl size="small" fullWidth sx={selectSx}>
          <InputLabel>Medietype</InputLabel>
          <Select
            label="Medietype"
            value={post.mediaType}
            onChange={(event) => onUpdate({ mediaType: event.target.value as RoleRoomFeedMediaType })}
          >
            {MEDIA_TYPE_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" fullWidth sx={selectSx}>
          <InputLabel>Logo-plassering</InputLabel>
          <Select
            label="Logo-plassering"
            value={post.logoPlacement ?? 'top-left'}
            onChange={(event) => onUpdate({ logoPlacement: event.target.value as RoleRoomFeedLogoPlacement })}
          >
            {LOGO_PLACEMENT_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      <TextField
        size="small"
        label="Publiseringstidspunkt"
        type="datetime-local"
        value={formatScheduleInputValue(post.scheduledFor)}
        onChange={(event) => handleScheduleChange(event.target.value)}
        InputLabelProps={{ shrink: true }}
        fullWidth
        variant="outlined"
        sx={textFieldSx}
      />

      <Stack
        spacing={0.8}
        sx={{
          p: 1.2,
          borderRadius: 1.8,
          background: 'linear-gradient(135deg, rgba(34,211,238,0.08) 0%, rgba(168,85,247,0.08) 100%)',
          border: '1px solid rgba(168,85,247,0.2)',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={0.8}>
          <AutoAwesomeIcon fontSize="small" sx={{ color: '#c084fc' }} />
          <Typography sx={{ color: '#e2e8f0', fontSize: '0.82rem', fontWeight: 700 }}>
            AI-anbefaling
          </Typography>
          {tierSlug ? (
            <Chip
              size="small"
              icon={
                <Box sx={{ display: 'inline-flex', ml: 0.6 }}>
                  <RoleRoomTierIcon tier={tierSlug} size={14} />
                </Box>
              }
              label={ROLE_ROOM_TIERS[tierSlug].shortName}
              sx={{
                ml: 'auto',
                height: 22,
                fontSize: '0.68rem',
                fontWeight: 700,
                color: ROLE_ROOM_TIERS[tierSlug].accentHex,
                borderColor: `${ROLE_ROOM_TIERS[tierSlug].accentHex}55`,
                bgcolor: 'transparent',
              }}
              variant="outlined"
            />
          ) : null}
        </Stack>
        <Typography sx={{ color: 'rgba(226,232,240,0.62)', fontSize: '0.72rem' }}>
          Henter norsk caption, hashtags, CTA og anbefalt publiseringstidspunkt. Bruker plattform-strategi oppdatert daglig.
        </Typography>
        <Stack direction="row" spacing={0.8} alignItems="center">
          <Button
            size="small"
            variant="contained"
            startIcon={aiLoading ? <CircularProgress size={14} sx={{ color: '#0b1220' }} /> : <AutoAwesomeIcon fontSize="small" />}
            onClick={requestAiRecommendation}
            disabled={aiLoading || post.locked}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              color: '#0b1220',
              background: 'linear-gradient(135deg, #22d3ee 0%, #a855f7 100%)',
              boxShadow: 'none',
              '&:hover': { boxShadow: '0 4px 16px rgba(168,85,247,0.3)' },
            }}
          >
            {aiLoading ? 'Henter anbefaling…' : 'Anbefal med AI'}
          </Button>
          {aiNote ? (
            <Typography sx={{ color: 'rgba(226,232,240,0.55)', fontSize: '0.68rem', fontStyle: 'italic' }}>
              Strategi: {aiNote.freshness === 'fresh' ? 'fersk' : aiNote.freshness === 'seed' ? 'grunndata' : 'utdatert – oppdateres i bakgrunnen'}
            </Typography>
          ) : null}
        </Stack>
        {aiError ? (
          <Alert
            severity="warning"
            sx={{
              bgcolor: 'rgba(234,179,8,0.08)',
              color: '#fde68a',
              border: '1px solid rgba(234,179,8,0.25)',
              '& .MuiAlert-icon': { color: '#fbbf24' },
            }}
          >
            {aiError}
          </Alert>
        ) : null}
        {aiNote && !aiError ? (
          <Stack spacing={0.4}>
            {aiNote.strategyNotes ? (
              <Typography sx={{ color: 'rgba(226,232,240,0.72)', fontSize: '0.72rem' }}>
                <strong>Strategi:</strong> {aiNote.strategyNotes}
              </Typography>
            ) : null}
            {aiNote.bestTimeRationale ? (
              <Typography sx={{ color: 'rgba(226,232,240,0.72)', fontSize: '0.72rem' }}>
                <strong>Tidspunkt:</strong> {aiNote.bestTimeRationale}
              </Typography>
            ) : null}
          </Stack>
        ) : null}
      </Stack>

      {isShowrunner && platform === 'instagram' ? (
        <Stack
          spacing={0.6}
          sx={{
            p: 1.2,
            borderRadius: 1.8,
            background: 'linear-gradient(135deg, rgba(245,133,41,0.06) 0%, rgba(81,91,212,0.06) 100%)',
            border: '1px solid rgba(221,42,123,0.25)',
          }}
        >
          <Stack direction="row" alignItems="center" spacing={0.6}>
            <Typography sx={{ color: '#e2e8f0', fontSize: '0.82rem', fontWeight: 700 }}>
              Publiser til Instagram
            </Typography>
          </Stack>
          {instagramConnections.length === 0 ? (
            <Typography sx={{ color: 'rgba(226,232,240,0.62)', fontSize: '0.72rem' }}>
              Ingen IG-konto koblet. Koble en konto øverst i feed-planneren.
            </Typography>
          ) : (
            <Typography sx={{ color: 'rgba(226,232,240,0.62)', fontSize: '0.72rem' }}>
              Publiseres til <strong>@{instagramConnections[0].igUsername ?? 'IG-konto'}</strong>{' '}
              {post.scheduledFor ? `på ${new Date(post.scheduledFor).toLocaleString('nb-NO')}` : 'umiddelbart'}.
            </Typography>
          )}
          <Button
            size="small"
            variant="contained"
            onClick={publishToInstagram}
            disabled={
              publishing
              || post.locked
              || instagramConnections.length === 0
              || (post.mediaType === 'image' && !post.customImageUrl)
              || (post.mediaType === 'carousel' && (post.customImageUrls?.length ?? 0) < 2)
              || (post.mediaType === 'reel' && !post.customVideoDataUrl)
            }
            sx={{
              alignSelf: 'flex-start',
              textTransform: 'none',
              fontWeight: 700,
              color: '#fff',
              background: 'linear-gradient(135deg, #f58529 0%, #DD2A7B 50%, #515BD4 100%)',
              boxShadow: 'none',
              '&:hover': { boxShadow: '0 4px 16px rgba(221,42,123,0.3)' },
            }}
          >
            {publishing ? 'Publiserer…' : post.scheduledFor ? 'Køleg for publisering' : 'Publiser nå'}
          </Button>
          {publishStatus ? (
            <Typography sx={{ color: 'rgba(226,232,240,0.78)', fontSize: '0.74rem' }}>
              {publishStatus}
            </Typography>
          ) : null}
        </Stack>
      ) : null}

      {post.mediaType === 'reel' ? (
        <Stack
          spacing={0.8}
          data-testid="fb-publish-section"
          sx={{
            p: 1.2,
            borderRadius: 2,
            bgcolor: 'rgba(24,119,242,0.06)',
            border: '1px solid rgba(24,119,242,0.22)',
          }}
        >
          <Stack direction="row" alignItems="center" spacing={0.6}>
            <Typography sx={{ color: '#e2e8f0', fontSize: '0.82rem', fontWeight: 700 }}>
              Publiser til Facebook Page
            </Typography>
          </Stack>
          {fbPages.length === 0 ? (
            <Typography sx={{ color: 'rgba(226,232,240,0.62)', fontSize: '0.72rem' }}>
              Ingen FB Pages funnet — koble Meta-kontoen på nytt for å få pages_manage_posts + publish_video scopes.
            </Typography>
          ) : (
            <TextField
              select
              SelectProps={{ native: true }}
              size="small"
              value={fbSelectedPageId}
              onChange={(e) => setFbSelectedPageId(e.target.value)}
              disabled={fbPublishing || post.locked}
              inputProps={{ 'data-testid': 'fb-publish-page-select' }}
              sx={{ '& .MuiSelect-select': { fontSize: '0.82rem', py: 0.6 } }}
            >
              {fbPages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name ?? '(unnamed)'} ({p.id})
                </option>
              ))}
            </TextField>
          )}
          <Button
            size="small"
            variant="contained"
            onClick={publishToFacebookPage}
            disabled={fbPublishing || post.locked || fbPages.length === 0 || !post.customVideoDataUrl}
            data-testid="fb-publish-submit"
            sx={{
              alignSelf: 'flex-start',
              textTransform: 'none',
              fontWeight: 700,
              color: '#fff',
              background: 'linear-gradient(135deg, #1877F2 0%, #0866ff 100%)',
              boxShadow: 'none',
              '&:hover': { boxShadow: '0 4px 16px rgba(24,119,242,0.3)' },
            }}
          >
            {fbPublishing ? 'Laster opp til Facebook…' : 'Publiser til Facebook Page'}
          </Button>
          {fbPublishStatus ? (
            <Typography sx={{ color: 'rgba(226,232,240,0.78)', fontSize: '0.74rem' }}>
              {fbPublishStatus}
            </Typography>
          ) : null}
        </Stack>
      ) : null}

      <Button
        variant="outlined"
        size="small"
        startIcon={<AutorenewIcon fontSize="small" />}
        onClick={() => onRegenerate(post)}
        disabled={post.locked}
        sx={{
          textTransform: 'none',
          fontWeight: 700,
          color: '#22d3ee',
          borderColor: 'rgba(34,211,238,0.5)',
          '&:hover': { borderColor: '#22d3ee', bgcolor: 'rgba(34,211,238,0.08)' },
        }}
      >
        Regenerer mal (placeholder)
      </Button>
    </Stack>
  );
}

const textFieldSx = {
  '& .MuiInputBase-root': {
    color: '#e2e8f0',
    bgcolor: 'rgba(15,23,42,0.55)',
  },
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: 'rgba(148,163,184,0.25)',
  },
  '& .MuiInputLabel-root': {
    color: 'rgba(226,232,240,0.65)',
  },
  '& .Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderColor: '#22d3ee',
  },
};

const selectSx = {
  ...textFieldSx,
  '& .MuiSelect-icon': { color: 'rgba(226,232,240,0.6)' },
};

function ColorSwatchInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Stack
      direction="row"
      spacing={0.6}
      alignItems="center"
      sx={{
        px: 0.8,
        py: 0.5,
        borderRadius: 1,
        bgcolor: 'rgba(15,23,42,0.6)',
        border: '1px solid rgba(148,163,184,0.18)',
      }}
    >
      <Box
        component="label"
        sx={{
          width: 26,
          height: 26,
          borderRadius: 0.8,
          bgcolor: value,
          border: '1px solid rgba(255,255,255,0.18)',
          cursor: 'pointer',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box
          component="input"
          type="color"
          value={value}
          onChange={(event) => onChange((event.target as HTMLInputElement).value)}
          sx={{
            position: 'absolute',
            inset: 0,
            opacity: 0,
            cursor: 'pointer',
            border: 'none',
            padding: 0,
          }}
        />
      </Box>
      <Stack spacing={0}>
        <Typography sx={{ color: 'rgba(226,232,240,0.85)', fontSize: '0.68rem', fontWeight: 700 }}>
          {label}
        </Typography>
        <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.6rem', fontFamily: 'monospace' }}>
          {value.toUpperCase()}
        </Typography>
      </Stack>
    </Stack>
  );
}
