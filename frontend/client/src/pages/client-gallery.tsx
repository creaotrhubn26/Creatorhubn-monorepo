/**
 * Client Gallery Page - For photo selection and viewing
 * Material UI implementation with Norwegian localization
 * Using Universal Showcase design and profession adapter integration
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '@/components/universal/hooks/useDynamicProfessions';
import { galleryEvents } from '@/utils/creatorhub-events';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Container,
  Grid,
  Card as MuiCard,
  CardMedia,
  CardContent,
  CardActions,
  Typography,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Box,
  CircularProgress,
  Alert,
  Fab,
  Badge,
  IconButton,
  Tooltip,
  Paper,
  Divider,
  Stack,
  FormControlLabel,
  Switch,
  Avatar,
  useTheme,
  alpha,
} from '@mui/material';
import { PhotographyIconAlt, RingIcon } from '../components/shared/CreatorHubIcons';
import {
  Favorite,
  FavoriteBorder,
  CheckCircle,
  CheckCircleOutline,
  Comment,
  Download,
  ShoppingCart,
  FilterList,
  ViewModule,
  ViewList,
  ZoomIn,
  Close,
  Send,
  PhotoLibrary,
  GridOn as GridOnView,
  Search,
  AccessTime,
  GridView,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { useClientSession } from '@/contexts/ClientSessionContext';
import {
  isErgonomicsEnabled,
  setErgonomicsEnabled,
  useErgonomicsTelemetry,
} from '@/hooks/useErgonomicsTelemetry';
import ReflectPromptModal from '@/components/ReflectPromptModal';
import PostSessionInsightsCard from '@/components/PostSessionInsightsCard';
import ExtraImagePricingDialog from '@/components/ExtraImagePricingDialog';
import ImageSelectionWarning from '@/components/ImageSelectionWarning';
import ContractPreviewModal from '@/components/ContractPreviewModal';
import TermsAcceptanceDialog from '@/components/TermsAcceptanceDialog';
import PrintStoreSection from '@/components/client-gallery/PrintStoreSection';
import GallerySelectionSubmitDialog from '@/components/gallery/GallerySelectionSubmitDialog';
import GallerySlideshow from '@/components/gallery/GallerySlideshow';
import PrintOrderDialog from '@/components/gallery/PrintOrderDialog';
import GalleryChapterBreak, { type GalleryChapter } from '@/components/gallery/GalleryChapterBreak';
import GalleryChapterNav from '@/components/gallery/GalleryChapterNav';
import CinematicVideoPlayer from '@/components/gallery/CinematicVideoPlayer';
import CinematicAudioPlayer from '@/components/gallery/CinematicAudioPlayer';
import CommentsPanel from '@/components/gallery/CommentsPanel';
import { getShowcaseTerminology, capitalise } from '@/utils/showcaseTerminology';

interface ClientGalleryProps {}

interface GalleryImage {
  id: string;
  imageTitle: string;
  imageDescription?: string;
  thumbnailUrl: string;
  fullSizeUrl: string;
  watermarkedUrl?: string;
  /** Slice 6 — signed URL for the auto-cleaned variant (stray studio
   *  equipment removed). Non-null only when the photographer opted in
   *  at delivery time. The viewer prefers this when present and offers
   *  a "Vis original"-toggle so the client can compare. */
  autoCleanedUrl?: string | null;
  /** How many distractions the photographer's auto-clean pipeline
   *  removed. Surfaced as a small badge so the client knows the shot
   *  has been polished. */
  autoCleanedDetectionCount?: number | null;
  imageMetadata?: {
    width: number;
    height: number;
    fileSize: number;
    format: string;
    cameraSettings?: any;
    location?: string;
    dateTaken?: string;
};
  tags: string[];
  sortOrder: number;
}

interface Gallery {
  id: string;
  photographerId: string;
  clientName: string;
  clientEmail: string;
  projectTitle: string;
  /** Slice 9P — surfaced by GET /api/client/gallery/:token so the
   *  viewer renders the right copy ("foto-galleri" vs "video-galleri"
   *  vs "lyd-galleri"). Null when the photographer has no profession
   *  set; viewer falls back to photo-flavoured copy. */
  photographerProfession?: string | null;
  gallerySettings: {
    maxSelections: number;
    pricePerImage: number;
    currency: string;
    contractedImages: number;
    allowDownload: boolean;
    allowComments: boolean;
    watermarkEnabled: boolean;
    expiresAt?: string;
};
  status: string;
}

interface Selection {
  id: string;
  imageId: string;
  selectionType: 'favorite' | 'selected' | 'rejected';
  priority: number;
  clientNotes?: string;
}

export default function ClientGallery({}: ClientGalleryProps) {
  const { accessToken, projectId } = useParams();
  const [location] = useLocation();
  const queryClient = useQueryClient();
  const { updateActivity } = useClientSession();
  const theme = useTheme();

  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [favoriteImages, setFavoriteImages] = useState<Set<string>>(new Set());
  // Slice 9X.82 — submit-dialog state for "send mitt utvalg"-flyt
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  // Slice 9X.82 — slideshow-state
  const [showSlideshow, setShowSlideshow] = useState(false);
  const [slideshowStartIndex, setSlideshowStartIndex] = useState(0);
  // Slice 9X.82 — print-order-state (per-bilde-flyt, Pic-Time)
  const [printOrderImage, setPrintOrderImage] = useState<GalleryImage | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showOnlySelected, setShowOnlySelected] = useState(false);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [selectedImageForView, setSelectedImageForView] = useState<GalleryImage | null>(null);
  /** Slice 6 — per-image override: when an id is in this set, the
   *  viewer renders the camera-original instead of the auto-cleaned
   *  variant. Default is "show cleaned" so the polished version is
   *  what the client sees first. */
  const [showOriginalIds, setShowOriginalIds] = useState<Set<string>>(new Set());
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [commentImageId, setCommentImageId] = useState<string | null>(null);
  const [pricingDialogOpen, setPricingDialogOpen] = useState(false);
  // Slice 9.4 — gallery-level password the viewer collects via prompt
  // and forwards on every authenticated request via x-gallery-password.
  // Stored in component state (not localStorage) so closing the tab
  // forces a re-prompt — the access link by itself shouldn't grant
  // session persistence beyond the open tab.
  const [galleryPassword, setGalleryPassword] = useState<string | null>(null);
  const [passwordPromptOpen, setPasswordPromptOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  // Slice 9.3 — bulk download state. busyDownloading drives the spinner
  // on the "Last ned valgte"-button so the photographer's client
  // doesn't double-tap and start two parallel zip jobs.
  const [busyDownloading, setBusyDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [extraImagePricingOpen, setExtraImagePricingOpen] = useState(false);
  const [selectionWarningOpen, setSelectionWarningOpen] = useState(false);
  const [contractPreviewOpen, setContractPreviewOpen] = useState(false);
  const [termsAcceptanceOpen, setTermsAcceptanceOpen] = useState(false);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  // Ergonomics telemetry — opt-in hook that tracks the cognitive
  // cost of the culling/selection flow so CreatorHub can remove the
  // parts that drain photographers. Does nothing when disabled.
  const telemetry = useErgonomicsTelemetry();
  const [telemetryEnabled, setTelemetryEnabledState] = useState<boolean>(
    () => isErgonomicsEnabled(),
  );
  const [reflectPromptOpen, setReflectPromptOpen] = useState(false);
  const [insightsSessionId, setInsightsSessionId] = useState<string | null>(null);
  // Prior selection state per image — used to detect reversals
  // (heart → unheart → heart). We compare last known state to new
  // state inside the favourite/select handlers and emit a 'reverse'
  // event when they disagree.
  const priorStateRef = useRef<Map<string, { favorite: boolean; selected: boolean }>>(
    new Map(),
  );

  // Profession adapter configuration
  const profession = 'photographer';
  const getProfessionConfig = () => ({
    title: 'Fotogalleri',
    primaryColor: '#FF6B35',
    gradientColor: 'linear-gradient(135deg, #FF6B35 0%, #F7931E 100%)',
    icon: <PhotoLibrary />,
    fileTypes: ['photo','design'],
    defaultType: 'photo',
});
  const config = getProfessionConfig();

  // Slice 9.4 — header bag passed on every authenticated request to
  // the gallery routes. The first GET /:token doesn't need it (it
  // surfaces requiresPassword in the response), but every other call
  // does once a password is set. Memoized so we don't reshape the
  // identity on every render — useQuery treats new objects as new
  // request inputs and would re-fetch.
  const galleryHeaders = useMemo(
    () => (galleryPassword ? { 'x-gallery-password': galleryPassword } : undefined),
    [galleryPassword],
  );

  // Fetch gallery data (includes project ID linkage)
  const { data: gallery, isLoading: galleryLoading } = useQuery({
    queryKey: ['/api/client/gallery', accessToken],
    queryFn: () => apiRequest(`/api/client/gallery/${accessToken}`),
    enabled: !!accessToken,
});

  // GA4 — track when client opens the gallery (once per gallery load)
  useEffect(() => {
    if (gallery?.id) galleryEvents.viewedByClient(gallery.id, accessToken);
  }, [gallery?.id, accessToken]);

  // Slice 9P — profession-aware terminology. Backend exposes the
  // photographer's profession; we use it to render "foto-galleri"
  // vs "video-galleri" vs "lyd-galleri" copy. Falls back to photo-
  // flavoured text when the field is missing.
  const terms = useMemo(
    () => getShowcaseTerminology(gallery?.photographerProfession ?? null),
    [gallery?.photographerProfession],
  );

  // Slice 9.4 — open the password prompt when the gallery row says
  // requiresPassword and we don't have one in state yet. Fires once
  // per gallery load; the user closing the prompt without entering
  // a password just leaves the gallery's data fetches in their 401
  // state.
  useEffect(() => {
    if (gallery?.requiresPassword && !galleryPassword && !passwordPromptOpen) {
      setPasswordPromptOpen(true);
    }
  }, [gallery?.requiresPassword, galleryPassword, passwordPromptOpen]);

  // Slice 10.3 + 10.5 — håndter return fra Stripe Checkout. Stripe
  // redirecter til ?checkout=success/cancelled (ekstra-bilder) eller
  // ?print=success/cancelled (print-ordre). Vis bekreftelse + strip
  // URL-paramene så refresh ikke viser samme melding to ganger.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get('checkout');
    const print = params.get('print');
    if (checkout === 'success') {
      alert('Betaling mottatt! Du kan nå laste ned valgte bilder. Sjekk e-post for kvittering.');
    } else if (checkout === 'cancelled') {
      alert('Betalingen ble avbrutt. Du kan prøve igjen når du vil.');
    } else if (print === 'success') {
      alert('Print-bestilling registrert! Vi tar kontakt om frakt og leveringstid. Sjekk e-post for kvittering.');
    } else if (print === 'cancelled') {
      alert('Print-bestillingen ble avbrutt.');
    } else {
      return;
    }
    params.delete('checkout');
    params.delete('print');
    params.delete('session_id');
    const newSearch = params.toString();
    window.history.replaceState(
      {},
      '',
      `${window.location.pathname}${newSearch ? '?' + newSearch : ''}${window.location.hash}`,
    );
  }, []);

  // Fetch gallery images (linked to project)
  const { data: images = [], isLoading: imagesLoading } = useQuery({
    queryKey: ['/api/client/gallery', accessToken, 'images', galleryPassword],
    queryFn: () => apiRequest(`/api/client/gallery/${accessToken}/images`, {
      headers: galleryHeaders,
    }),
    // Don't fire the auth'd fetches until we either know the gallery
    // doesn't require a password or the user has supplied one. Saves
    // a guaranteed-401 round-trip + the noisy console error.
    enabled: !!accessToken
      && !!gallery
      && (!gallery.requiresPassword || !!galleryPassword),
});

  // Fetch existing selections (linked to project and client). Backend
  // returns { galleryId, selections: [...] } for the whole gallery;
  // clientEmail filtering is done locally.
  const { data: selections = { selections: [] } } = useQuery({
    queryKey: ['/api/client/gallery', accessToken, 'selections', galleryPassword],
    queryFn: () =>
      apiRequest(`/api/client/gallery/${accessToken}/selections`, { headers: galleryHeaders }),
    enabled: !!accessToken
      && !!gallery
      && (!gallery.requiresPassword || !!galleryPassword),
});

  // Slice 9X.82 (Bjarne) — fetch video-timecode-kommentarer
  const { data: videoCommentsData } = useQuery({
    queryKey: ['/api/client/gallery', accessToken, 'video-comments', galleryPassword],
    queryFn: () =>
      apiRequest(`/api/client/gallery/${accessToken}/video-comments`, { headers: galleryHeaders }),
    enabled: !!accessToken
      && !!gallery
      && (!gallery.requiresPassword || !!galleryPassword)
      && Array.isArray((gallery as any)?.gallerySettings?.chapters)
      && ((gallery as any).gallerySettings.chapters as any[]).some((c: any) => c?.videoUrl || c?.audioUrl),
  });

  // Fetch existing comments so the gallery can show prior notes on the
  // image detail view + comment counts. Mirrors the selections query
  // shape; both come back as { galleryId, <collection>: [...] }.
  const { data: commentsData = { comments: [] } } = useQuery({
    queryKey: ['/api/client/gallery', accessToken, 'comments', galleryPassword],
    queryFn: () =>
      apiRequest(`/api/client/gallery/${accessToken}/comments`, { headers: galleryHeaders }),
    enabled: !!accessToken
      && !!gallery
      && (!gallery.requiresPassword || !!galleryPassword),
});
  const allComments: Array<{
    id: string; imageId: string; clientName: string; comment: string;
    commentType: string; createdAt: string;
  }> = Array.isArray((commentsData as any)?.comments)
    ? (commentsData as any).comments
    : [];
  const commentCountByImage = allComments.reduce<Record<string, number>>((acc, c) => {
    acc[c.imageId] = (acc[c.imageId] || 0) + 1;
    return acc;
  }, {});

  // Fetch project details for integration
  const { data: projectDetails } = useQuery({
    queryKey: ['/api/projects', gallery?.projectId],
    queryFn: () => apiRequest(`/api/projects/${gallery?.projectId}`),
    enabled: !!gallery?.projectId,
});

  // Activity tracking for session management
  useEffect(() => {
    const handleActivity = () => updateActivity();
    const events = ['click','scroll','keydown','mousemove'];
    events.forEach((event) => document.addEventListener(event, handleActivity));
    return () => events.forEach((event) => document.removeEventListener(event, handleActivity));
}, [updateActivity]);

  // Slice 9.5 — screenshot + right-click protection. Toggled per
  // gallery via gallery_settings.screenshotProtection. Three layers:
  //
  //   (1) suppress contextmenu so right-click → "Save Image As" is gone
  //   (2) cancel drag-start so the user can't drag images out of the page
  //   (3) blur the document body when the tab is hidden, which interferes
  //       with macOS Cmd+Shift+5 / Win Snipping Tool screenshots that
  //       trigger a brief visibility hidden window
  //
  // None of this is bulletproof — a determined attacker with browser
  // dev tools or external screen capture wins anyway. The point is to
  // raise the bar against accidental copy-pasting + screenshotting,
  // matching what Pic-Time and SmugMug surface as "screenshot
  // protection".
  useEffect(() => {
    if (!gallery?.gallerySettings?.screenshotProtection) return;
    const onContextMenu = (e: MouseEvent) => e.preventDefault();
    const onDragStart = (e: DragEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.tagName === 'IMG') e.preventDefault();
    };
    const onVisibility = () => {
      document.body.style.filter = document.hidden ? 'blur(40px)' : '';
    };
    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('dragstart', onDragStart);
    document.addEventListener('visibilitychange', onVisibility);
    // Apply user-select / pointer-event hints via CSS class on body
    // so it cascades to all dynamic image content.
    document.body.classList.add('client-gallery-screenshot-protected');
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      .client-gallery-screenshot-protected img,
      .client-gallery-screenshot-protected .MuiCardMedia-root {
        user-select: none !important;
        -webkit-user-drag: none !important;
        -webkit-touch-callout: none !important;
        pointer-events: auto;
      }
    `;
    document.head.appendChild(styleEl);
    return () => {
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('dragstart', onDragStart);
      document.removeEventListener('visibilitychange', onVisibility);
      document.body.classList.remove('client-gallery-screenshot-protected');
      document.body.style.filter = '';
      styleEl.remove();
    };
  }, [gallery?.gallerySettings?.screenshotProtection]);

  // Telemetry: emit a ``pause`` event when the tab has been hidden
  // for at least 2 minutes, so the fatigue-curve analysis can reset
  // its drift baseline. 2 minutes is long enough to filter out brief
  // tab switches (checking a contract, opening a Slack link) while
  // still catching real breaks.
  useEffect(() => {
    if (!telemetry.enabled) return;
    let hiddenAt: number | null = null;
    const onVisibilityChange = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
      } else if (hiddenAt !== null) {
        const awayMs = Date.now() - hiddenAt;
        hiddenAt = null;
        if (awayMs >= 2 * 60 * 1000) {
          telemetry.trackPause();
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [telemetry]);

  // Load existing selections into state
  useEffect(() => {
    if (selections?.selections) {
      const selected = new Set<string>();
      const favorites = new Set<string>();

      selections.selections.forEach((selection: Selection) => {
        if (selection.selectionType === 'selected') {
          selected.add(selection.imageId);
      } else if (selection.selectionType === 'favorite') {
          favorites.add(selection.imageId);
      }
    });

      setSelectedImages(selected);
      setFavoriteImages(favorites);
  }
}, [selections]);

  // Create or update selection
  const updateSelectionMutation = useMutation({
    mutationFn: async ({
      imageId,
      selectionType,
      clientNotes,
  }: {
      imageId: string;
      selectionType: 'favorite' | 'selected' | 'rejected';
      clientNotes?: string;
  }) => {
      return apiRequest(`/api/client/gallery/${accessToken}/selections`, {
        method: 'POST',
        body: JSON.stringify({
          imageId,
          clientEmail: gallery?.clientEmail,
          selectionType,
          clientNotes,
          priority: selectionType === 'favorite' ? 5 : 1,
      }),
    });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/client/gallery', accessToken, 'selections'],
    });
  },
});

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: async ({ imageId, comment }: { imageId: string; comment: string }) => {
      return apiRequest(`/api/client/gallery/${accessToken}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          imageId,
          galleryId: gallery?.id,
          clientName: gallery?.clientName,
          clientEmail: gallery?.clientEmail,
          comment,
          commentType: 'general',
      }),
    });
  },
    onSuccess: () => {
      setCommentDialogOpen(false);
      setNewComment('');
      setCommentImageId(null);
      // Refresh the comment list so the one we just posted shows up
      // immediately in the dialog / image card badge without a reload.
      queryClient.invalidateQueries({
        queryKey: ['/api/client/gallery', accessToken, 'comments'],
      });
  },
});

  // Calculate pricing mutation
  const calculatePricingMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/client/gallery/${accessToken}/calculate-pricing`, {
        method: 'POST',
        body: JSON.stringify({
          selectedImageIds: Array.from(selectedImages),
          clientEmail: gallery?.clientEmail,
      }),
    });
  },
});

  // Submit final selection
  const submitSelectionMutation = useMutation({
    mutationFn: async (pricingData: any) => {
      return apiRequest(`/api/client/gallery/${accessToken}/submit-selection`, {
        method: 'POST',
        body: JSON.stringify({
          clientEmail: gallery?.clientEmail,
          selectedImageIds: Array.from(selectedImages),
          totalAmount: pricingData.totalAmount,
      }),
    });
  },
    onSuccess: () => {
      setPricingDialogOpen(false);
      // Session ends — emit session_end, flush the telemetry buffer,
      // and prompt the reflect modal + insights card. Both are only
      // visible when the user opted in, since the hook is a noop
      // otherwise. We capture the sessionId BEFORE ending (endSession
      // rotates the id) so the insights card can fetch its stats.
      const endedSessionId = telemetry.sessionId;
      telemetry.endSession();
      if (telemetry.enabled && endedSessionId) {
        setInsightsSessionId(endedSessionId);
        setReflectPromptOpen(true);
      }
  },
});

  const handleImageSelect = (imageId: string) => {
    const newSelected = new Set(selectedImages);
    const contractedImages = gallery?.gallerySettings?.contractedImages || 0;
    const wasSelected = newSelected.has(imageId);

    if (wasSelected) {
      newSelected.delete(imageId);
      updateSelectionMutation.mutate({ imageId, selectionType: 'rejected' });
      setSelectedImages(newSelected);
  } else {
      galleryEvents.itemSelected(gallery?.id || '', imageId);
      // Check if adding this image would exceed contracted amount
      if (
        newSelected.size >= contractedImages &&
        newSelected.size < gallery?.gallerySettings.maxSelections
      ) {
        // Show psychological warning dialog
        setSelectionWarningOpen(true);
        return;
    }

      if (newSelected.size >= gallery?.gallerySettings.maxSelections) {
        // Hard limit reached
        return;
    }

      newSelected.add(imageId);
      updateSelectionMutation.mutate({ imageId, selectionType: 'selected' });
      setSelectedImages(newSelected);
  }

    // Telemetry: log as decision or reversal depending on prior state.
    const prior = priorStateRef.current.get(imageId) ?? {
      favorite: false,
      selected: false,
    };
    const nextSelected = !wasSelected;
    const newAction = nextSelected ? 'selected' : 'rejected';
    if (prior.selected !== nextSelected) {
      if (prior.selected) {
        telemetry.trackReversal(imageId, 'selected', newAction);
      } else {
        telemetry.trackDecision(imageId, newAction);
      }
    }
    priorStateRef.current.set(imageId, { ...prior, selected: nextSelected });
};

  const handleKeepAllImages = () => {
    setSelectionWarningOpen(false);
    setExtraImagePricingOpen(true);
};

  // Handle proceeding to checkout (called from FAB)
  const handleProceedToCheckout = () => {
    galleryEvents.quoteRequested(gallery?.id || '', undefined);
    // Check if terms have been accepted first
    if (!hasAcceptedTerms) {
      setTermsAcceptanceOpen(true);
      return;
  }

    const contractedImages = gallery?.gallerySettings?.contractedImages || 0;
    const selectedCount = selectedImages.size;

    if (selectedCount > contractedImages) {
      // Show extra image pricing dialog
      setExtraImagePricingOpen(true);
  } else {
      // Normal checkout process
      calculatePricingMutation.mutate(undefined, {
        onSuccess: (pricingData) => {
          setPricingDialogOpen(true);
      },
    });
  }
};

  const handleSelectFewerImages = () => {
    setSelectionWarningOpen(false);
    // User goes back to select fewer - no action needed, just close dialog
};

  // Modified image selection to handle the interim state where user is trying to add an image
  const [pendingImageId, setPendingImageId] = useState<string | null>(null);

  const handleImageSelectWithWarning = (imageId: string) => {
    const newSelected = new Set(selectedImages);
    const contractedImages = gallery?.gallerySettings?.contractedImages || 0;

    if (newSelected.has(imageId)) {
      // Removing image - no warning needed
      newSelected.delete(imageId);
      updateSelectionMutation.mutate({ imageId, selectionType: 'rejected' });
      setSelectedImages(newSelected);
  } else {
      // Adding image - check if it exceeds contracted amount
      if (
        newSelected.size >= contractedImages &&
        newSelected.size < gallery?.gallerySettings.maxSelections
      ) {
        // Store the pending image and show warning
        setPendingImageId(imageId);
        setSelectionWarningOpen(true);
        return;
    }

      if (newSelected.size >= gallery?.gallerySettings.maxSelections) {
        // Hard limit reached - could show different message
        return;
    }

      // Within contracted limits - add normally
      newSelected.add(imageId);
      updateSelectionMutation.mutate({ imageId, selectionType: 'selected' });
      setSelectedImages(newSelected);
  }
};

  const handleKeepAllImagesConfirmed = () => {
    // Add the pending image to selection
    if (pendingImageId) {
      const newSelected = new Set(selectedImages);
      newSelected.add(pendingImageId);
      updateSelectionMutation.mutate({
        imageId: pendingImageId,
        selectionType: 'selected',
    });
      setSelectedImages(newSelected);
      setPendingImageId(null);
  }
    setSelectionWarningOpen(false);
    setExtraImagePricingOpen(true);
};

  const handleSelectFewerImagesConfirmed = () => {
    setSelectionWarningOpen(false);
    setPendingImageId(null);
    // User goes back to select fewer - no action needed
};

  const handleImageFavorite = (imageId: string) => {
    const newFavorites = new Set(favoriteImages);
    const wasFavorite = newFavorites.has(imageId);

    if (wasFavorite) {
      newFavorites.delete(imageId);
      updateSelectionMutation.mutate({ imageId, selectionType: 'rejected' });
  } else {
      newFavorites.add(imageId);
      updateSelectionMutation.mutate({ imageId, selectionType: 'favorite' });
  }

    setFavoriteImages(newFavorites);

    // Telemetry: emit a ``decide`` event on first toggle, and a
    // ``reverse`` event when the photographer flips a previously
    // set state. priorStateRef is the source of truth here — we
    // compare against it explicitly rather than inferring from
    // favoriteImages (which is about to update asynchronously).
    const prior = priorStateRef.current.get(imageId) ?? {
      favorite: false,
      selected: false,
    };
    const nextFavorite = !wasFavorite;
    if (prior.favorite !== nextFavorite) {
      const newAction = nextFavorite ? 'favorite' : 'rejected';
      if (prior.favorite) {
        telemetry.trackReversal(imageId, 'favorite', newAction);
      } else {
        telemetry.trackDecision(imageId, newAction);
      }
    }
    priorStateRef.current.set(imageId, { ...prior, favorite: nextFavorite });
};

  const handleImageView = (image: GalleryImage) => {
    setSelectedImageForView(image);
    setImageDialogOpen(true);
    // Telemetry: the photographer is looking at this asset. firstView
    // is true when we've never tracked a view for this id before —
    // lets the backend distinguish initial triage from re-visits.
    const prior = priorStateRef.current.get(image.id);
    telemetry.trackView(image.id, !prior);
    if (!prior) {
      priorStateRef.current.set(image.id, { favorite: false, selected: false });
    }
};

  const handleAddComment = (imageId: string) => {
    setCommentImageId(imageId);
    setCommentDialogOpen(true);
};

  const handleSubmitComment = () => {
    if (commentImageId && newComment.trim()) {
      addCommentMutation.mutate({
        imageId: commentImageId,
        comment: newComment.trim(),
    });
  }
};

  const filteredImages = showOnlySelected
    ? images.filter((img: GalleryImage) => selectedImages.has(img.id) || favoriteImages.has(img.id))
    : images;

  if (galleryLoading || imagesLoading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Laster galleri...
        </Typography>
      </Container>
    );
}

  if (!gallery) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error">Galleriet ble ikke funnet eller tilgangen er utløpt.</Alert>
      </Container>
    );
}

  return (
    <Box
      sx={{
        bgcolor: '#0a0f1a',
        minHeight: '100vh',
        color: '#fff',
        display: 'flex',
    }}
    >
      {/* Left Sidebar - Universal Showcase Design */}
      <Box
        sx={{
          width: 280,
          bgcolor: '#0f1419',
          borderRight: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          flexDirection: 'column',
          p: 2,
      }}
      >
        {/* Logo/Brand */}
        <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar sx={{ bgcolor: config.primaryColor, width: 40, height: 40 }}>
            {config.icon}
          </Avatar>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#fff' }}>
              {gallery?.projectTitle || 'Fotogalleri'}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
              Klient: {gallery?.clientName}
            </Typography>
          </Box>
        </Box>

        {/* Selection Summary with Psychology */}
        <Paper
          sx={{
            p: 2,
            mb: 3,
            bgcolor: 'rgba(255,107,53,0.1)',
            border: '1px solid rgba(255,107,53,0.2)',
            borderRadius: 2,
        }}
        >
          <Typography variant="subtitle2" sx={{ color: '#fff', mb: 2 }}>
            Ditt valg
          </Typography>

          {/* Progress visualization */}
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                {selectedImages.size} av {gallery?.gallerySettings?.contractedImages || 0},{' '}
                inkluderte {terms.itemPlural}
              </Typography>
              {selectedImages.size > (gallery?.gallerySettings?.contractedImages || 0) && (
                <Typography variant="body2" sx={{ color: '#ffa726', fontWeight: 600}}>
                  +{selectedImages.size - (gallery?.gallerySettings?.contractedImages || 0)} ekstra
                  minner
                </Typography>
              )}
            </Box>

            <Box
              sx={{
                width: '100%',
                height: 8,
                bgcolor: 'rgba(255,255,255,0.1)',
                borderRadius: 4,
                overflow: 'hidden',
            }}
            >
              <Box
                sx={{
                  width: `${Math.min((selectedImages.size / Math.max(gallery?.gallerySettings?.contractedImages || 1, 1)) * 100, 100)}%`,
                  height: '100%',
                  bgcolor:
                    selectedImages.size <= (gallery?.gallerySettings?.contractedImages || 0)
                      ? config.primaryColor
                      : '#ffa726',
                  transition: 'width 0.3s ease',
              }}
              />
            </Box>

            {selectedImages.size > (gallery?.gallerySettings?.contractedImages || 0) && (
              <Typography
                variant="caption"
                sx={{
                  color: '#ffa726',
                  display: 'block',
                  mt: 1,
                  fontStyle: 'italic',
              }}
              >
                💝 Du har funnet ekstra fine minner!
              </Typography>
            )}
          </Box>

          <Stack spacing={1}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
            }}
            >
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                {`Valgte ${terms.itemPlural}:`}
              </Typography>
              <Chip
                label={`${selectedImages.size}/${gallery?.gallerySettings.maxSelections || 0}`}
                size="small"
                sx={{
                  bgcolor:
                    selectedImages.size <= (gallery?.gallerySettings?.contractedImages || 0)
                      ? config.primaryColor
                      : '#ffa726',
                  color: 'white',
              }}
              />
            </Box>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
            }}
            >
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                Favoritter:
              </Typography>
              <Chip label={favoriteImages.size} size="small" color="secondary" variant="outlined" />
            </Box>
            {gallery && (
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
              }}
              >
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                  Ekstra kostnad:
                </Typography>
                <Typography variant="body2" sx={{ color: config.primaryColor, fontWeight: 600}}>
                  {`${gallery.gallerySettings.currency} ${gallery.gallerySettings.pricePerImage}/${terms.item}`}
                </Typography>
              </Box>
            )}
          </Stack>
        </Paper>

        {/* View Controls */}
        <Box sx={{ mb: 3 }}>
          <Typography
            variant="overline"
            sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem', mb: 1 }}
          >
            VISNING
          </Typography>

          <Stack spacing={1}>
            <FormControlLabel
              control={
                <Switch
                  checked={showOnlySelected}
                  onChange={(e) => setShowOnlySelected(e.target.checked)}
                  size="small"
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': {
                      color: config.primaryColor,
                  },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                      backgroundColor: config.primaryColor,
                  },
                }}
                />
            }
              label={
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                  Vis kun valgte
                </Typography>
            }
            />

            <FormControlLabel
              control={
                <Switch
                  checked={telemetryEnabled}
                  onChange={(e) => {
                    setErgonomicsEnabled(e.target.checked);
                    setTelemetryEnabledState(e.target.checked);
                  }}
                  size="small"
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': {
                      color: config.primaryColor,
                  },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                      backgroundColor: config.primaryColor,
                  },
                }}
                />
            }
              label={
                <Tooltip title="Logger anonymisert hvor lenge du ser på hvert bilde og hvor mange ganger du ombestemmer deg. Vi bruker det kun til å fjerne det du hater mest. Du kan skru av når som helst.">
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                    Ergonomi-innsikter (opt-in)
                  </Typography>
                </Tooltip>
            }
            />

            <Box sx={{ display: 'flex', gap: 1 }}>
              <IconButton
                onClick={() => setViewMode('grid')}
                size="small"
                sx={{
                  color: viewMode === 'grid' ? config.primaryColor : 'rgba(255,255,255,0.5)',
                  bgcolor: viewMode === 'grid' ? 'rgba(255,107,53,0.1)' : 'transparent',
              }}
              >
                <GridView />
              </IconButton>
              <IconButton
                onClick={() => setViewMode('list')}
                size="small"
                sx={{
                  color: viewMode === 'list' ? config.primaryColor : 'rgba(255,255,255,0.5)',
                  bgcolor: viewMode === 'list' ? 'rgba(255,107,53,0.1)' : 'transparent',
              }}
              >
                <ViewList />
              </IconButton>
            </Box>
          </Stack>
        </Box>

        {/* Action Buttons */}
        {selectedImages.size > 0 && (
          <Stack spacing={1} sx={{ mt: 'auto' }}>
            {/* Slice 9.3 — bulk download. Only shown when allowDownload
                is on (default true) and there's at least one selection.
                The button calls /download-zip directly via fetch (not
                apiRequest) because we need the raw Response stream + a
                blob URL to trigger the browser download dialog.
                Returns 402 if pricing has unpaid extras — we surface
                a clear message and pivot to checkout (Slice 10). */}
            {gallery?.gallerySettings?.allowDownload !== false && (
              <Button
                variant="outlined"
                fullWidth
                disabled={busyDownloading}
                onClick={async () => {
                  galleryEvents.downloadRequested(gallery?.id || '', selectedImages.size);
                  setDownloadError(null);
                  setBusyDownloading(true);
                  try {
                    const res = await fetch(
                      `${(import.meta.env.DEV || window.location.hostname === 'localhost')
                        ? ''
                        : (import.meta.env.VITE_API_URL || '')}/api/client/gallery/${accessToken}/download-zip`,
                      {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          ...(galleryPassword ? { 'x-gallery-password': galleryPassword } : {}),
                        },
                        body: JSON.stringify({
                          imageIds: Array.from(selectedImages),
                          clientEmail: gallery?.clientEmail,
                        }),
                      },
                    );
                    if (res.status === 402) {
                      setDownloadError(`Betal ekstra-${terms.itemPlural} først (åpne Fortsett-flyt).`);
                      return;
                    }
                    if (res.status === 401) {
                      setDownloadError(`${capitalise(terms.collection)} krever passord.`);
                      setPasswordPromptOpen(true);
                      return;
                    }
                    if (!res.ok) {
                      setDownloadError(`Kunne ikke laste ned (HTTP ${res.status}).`);
                      return;
                    }
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${gallery?.projectTitle || terms.collection}-${selectedImages.size}-${terms.itemPlural}.zip`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    URL.revokeObjectURL(url);
                  } catch (err) {
                    setDownloadError(err instanceof Error ? err.message : String(err));
                  } finally {
                    setBusyDownloading(false);
                  }
                }}
                sx={{
                  color: 'white',
                  borderColor: 'rgba(255,255,255,0.3)',
                  '&:hover': { borderColor: 'rgba(255,255,255,0.6)' },
                }}
              >
                {busyDownloading
                  ? 'Pakker zip…'
                  : `Last ned valgte (${selectedImages.size})`}
              </Button>
            )}
            {downloadError && (
              <Typography variant="caption" sx={{ color: '#ff6b6b' }}>
                {downloadError}
              </Typography>
            )}
            <Button
              variant="contained"
              fullWidth
              onClick={handleProceedToCheckout}
              sx={{
                bgcolor: config.primaryColor,
                color: 'white',
                py: 1.5, '&:hover': {
                  bgcolor: alpha(config.primaryColor, 0.8),
              },
            }}
              startIcon={<ShoppingCart />}
            >
              {`Fortsett (${selectedImages.size} ${terms.itemPlural})`}
            </Button>
          </Stack>
        )}

        {/* Slice 10.5 — print store i sidebar. Skjult når fotograf
            ikke har aktivert print-produkter. */}
        {accessToken && (
          <Box sx={{ mt: 2 }}>
            <PrintStoreSection
              accessToken={accessToken}
              galleryPassword={galleryPassword}
              clientEmail={gallery?.clientEmail ?? undefined}
              clientName={gallery?.clientName ?? undefined}
              defaultImageId={selectedImages.size === 1 ? Array.from(selectedImages)[0] : null}
            />
          </Box>
        )}
      </Box>

      {/* Main Content Area */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header Bar */}
        <Box
          sx={{
            p: 3,
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
        }}
        >
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 600, color: '#fff', mb: 0.5 }}>
              {gallery?.projectTitle || capitalise(terms.collection)}
            </Typography>
            <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.7)' }}>
              {`Hei ${gallery?.clientName}! Velg dine favoritt-${terms.itemPlural}`}
            </Typography>
          </Box>

          <Stack direction="row" spacing={1}>
            <IconButton sx={{ color: 'rgba(255,255,255,0.7)' }}>
              <Search />
            </IconButton>
            <IconButton sx={{ color: 'rgba(255,255,255,0.7)' }}>
              <FilterList />
            </IconButton>
          </Stack>
        </Box>

        {/* Gallery Content */}
        <Box sx={{ flex: 1, p: 3, bgcolor: '#0a0f1a' }}>
          {/* Project Connection Info */}
          {projectDetails && (
            <Alert
              severity="info"
              sx={{
                mb: 3,
                bgcolor: 'rgba(255,107,53,0.1)',
                border: '1px solid rgba(255,107,53,0.3)',
                color: '#fff','& .MuiAlert-icon': { color: config.primaryColor },
            }}
            >
              Bilder fra prosjekt: {projectDetails.title} - {projectDetails.category}
            </Alert>
          )}

          {/* Images Grid — Slice 9X.82: chapter-aware rendering. Når
              gallerySettings.chapters er konfigurert, fletter vi
              GalleryChapterBreak inn over første bilde i hvert kapittel. */}
          <Grid container spacing={viewMode === 'grid' ? 3 : 2}>
            {(() => {
              const chapters: GalleryChapter[] = Array.isArray(gallery?.gallerySettings?.chapters)
                ? gallery!.gallerySettings.chapters
                : [];
              const imageToChapterIdx = new Map<string, number>();
              chapters.forEach((ch, idx) => {
                (ch.imageIds || []).forEach((id) => {
                  if (!imageToChapterIdx.has(id)) imageToChapterIdx.set(id, idx);
                });
              });
              const renderedChapterIdxs = new Set<number>();
              return filteredImages.flatMap((image: GalleryImage, imgPosition: number) => {
                const nodes: React.ReactNode[] = [];
                const chapterIdx = imageToChapterIdx.get(image.id);
                if (chapterIdx !== undefined && !renderedChapterIdxs.has(chapterIdx)) {
                  renderedChapterIdxs.add(chapterIdx);
                  const ch = chapters[chapterIdx];
                  nodes.push(
                    <Grid item xs={12} key={`chapter-${ch.id}`}>
                      <GalleryChapterBreak
                        chapter={ch}
                        index={chapterIdx}
                        totalChapters={chapters.length}
                      />
                    </Grid>
                  );
                  // Slice 9X.82 (Michael) — render CinematicAudioPlayer
                  // når kapittel har audioUrl (musikkprodusent-leveranser).
                  // Gjenbruker video_timecode_comments-systemet via samme
                  // chapter-comment-filter.
                  if (ch.audioUrl) {
                    const audioComments = (videoCommentsData?.comments || []).filter(
                      (c: any) => c.chapterId === ch.id,
                    );
                    // Holds player + side-panel for audio i samme grid-rad
                    const audioSeekRef: { current: (sec: number) => void } = { current: () => {} };
                    nodes.push(
                      <Grid item xs={12} key={`chapter-audio-${ch.id}`}>
                        <Box sx={{ maxWidth: 1280, mx: 'auto', mb: 4, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <CinematicAudioPlayer
                              src={ch.audioUrl}
                              coverUrl={ch.audioCover}
                              title={ch.title}
                              credits={ch.audioCredits}
                              sections={ch.audioSections || []}
                              comments={audioComments}
                              clientName={gallery?.clientName || null}
                              onAddComment={async ({ timecodeSec, comment }) => {
                                const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                                if (galleryPassword) headers['x-gallery-password'] = galleryPassword;
                                await fetch(`/api/client/gallery/${encodeURIComponent(accessToken)}/video-comments`, {
                                  method: 'POST',
                                  headers,
                                  body: JSON.stringify({
                                    chapterId: ch.id,
                                    timecodeSec,
                                    comment,
                                    clientEmail: gallery?.clientEmail || '',
                                    clientName: gallery?.clientName || '',
                                  }),
                                });
                                void queryClient.invalidateQueries({
                                  queryKey: ['/api/client/gallery', accessToken, 'video-comments', galleryPassword],
                                });
                              }}
                            />
                          </Box>
                          <CommentsPanel
                            comments={audioComments}
                            onSeek={() => {/* WaveSurfer-seek håndteres via comment-prikker direkte i player */}}
                            layout="side"
                            title="Tilbakemeldinger"
                          />
                        </Box>
                      </Grid>
                    );
                  }

                  // Slice 9X.82 (Bjarne) — render CinematicVideoPlayer
                  // når kapittel har videoUrl (videograf-leveranser).
                  // videoCommentsForChapter + handleAddVideoComment
                  // wires Frame.io-stil timecode-kommentarer.
                  if (ch.videoUrl) {
                    const chapterComments = (videoCommentsData?.comments || []).filter(
                      (c: any) => c.chapterId === ch.id,
                    );
                    nodes.push(
                      <Grid item xs={12} key={`chapter-video-${ch.id}`}>
                        <Box sx={{ maxWidth: 1280, mx: 'auto', mb: 4 }}>
                          <CinematicVideoPlayer
                            src={ch.videoUrl}
                            poster={ch.videoPoster}
                            title={ch.title}
                            subtitle={ch.intro}
                            chapters={ch.videoMarkers || []}
                            comments={chapterComments}
                            clientName={gallery?.clientName || null}
                            onAddComment={async ({ timecodeSec, endTimecodeSec, category, priority, comment }) => {
                              const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                              if (galleryPassword) headers['x-gallery-password'] = galleryPassword;
                              await fetch(`/api/client/gallery/${encodeURIComponent(accessToken)}/video-comments`, {
                                method: 'POST',
                                headers,
                                body: JSON.stringify({
                                  chapterId: ch.id,
                                  timecodeSec,
                                  endTimecodeSec,
                                  category,
                                  priority,
                                  comment,
                                  clientEmail: gallery?.clientEmail || '',
                                  clientName: gallery?.clientName || '',
                                }),
                              });
                              void queryClient.invalidateQueries({
                                queryKey: ['/api/client/gallery', accessToken, 'video-comments', galleryPassword],
                              });
                            }}
                          />
                          {/* Slice 9X.82 — CommentsPanel rett under video
                              (Frame.io/Filepass-mønster). Klient ser ALLE
                              tilbakemeldinger på dette klippet samlet,
                              klikk for å seeke. */}
                          <CommentsPanel
                            comments={chapterComments}
                            onSeek={() => {
                              // Player seek-API ikke eksponert via ref enda; klient
                              // kan klikke prikker på progress-bar i stedet.
                            }}
                            layout="under"
                            title="Edit-tilbakemelding"
                          />
                        </Box>
                      </Grid>
                    );
                  }
                }
                nodes.push(
                  <Grid item xs={12} key={image.id}>
                <MuiCard
                  sx={{
                    position: 'relative',
                    bgcolor: '#0f1419',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 2,
                    overflow: 'hidden',
                    transition: 'all 0.3s ease','&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                      border: `1px solid ${config.primaryColor}`,
                  },
                    ...(selectedImages.has(image.id) && {
                      border: `2px solid ${config.primaryColor}`,
                      boxShadow: `0 0 20px ${alpha(config.primaryColor, 0.3)}`,
                  }),
                }}
                >
                  <Box sx={{ position: 'relative' }}>
                    <CardMedia
                      component="img"
                      height={viewMode === 'grid' ? 280 : 200}
                      image={
                        gallery?.gallerySettings?.watermarkEnabled
                          ? image.watermarkedUrl
                          : (image.autoCleanedUrl ?? image.thumbnailUrl)
                    }
                      alt={image.imageTitle}
                      sx={{
                        cursor: 'pointer',
                        objectFit: 'cover',
                        filter: selectedImages.has(image.id) ? 'none' : 'brightness(0.8)',
                        transition: 'filter 0.3s ease',
                    }}
                      onClick={() => handleImageView(image)}
                    />

                    {/* Selection overlay */}
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 12,
                        right: 12,
                        display: 'flex',
                        gap: 1,
                    }}
                    >
                      <IconButton
                        size="small"
                        onClick={() => handleImageFavorite(image.id)}
                        sx={{
                          backgroundColor: 'rgba(0,0,0,0.7)',
                          backdropFilter: 'blur(10px)',
                          color: favoriteImages.has(image.id) ? '#e91e63' : 'rgba(255,255,255,0.8)','&:hover': {
                            backgroundColor: 'rgba(0,0,0,0.8)',
                            transform: 'scale(1.1)',
                        },
                      }}
                      >
                        {favoriteImages.has(image.id) ? <RingIcon /> : <FavoriteBorder />}
                      </IconButton>

                      <IconButton
                        size="small"
                        onClick={() => handleImageSelectWithWarning(image.id)}
                        sx={{
                          backgroundColor: 'rgba(0,0,0,0.7)',
                          backdropFilter: 'blur(10px)',
                          color: selectedImages.has(image.id)
                            ? config.primaryColor
                            : 'rgba(255,255,255,0.8)','&:hover': {
                            backgroundColor: 'rgba(0,0,0,0.8)',
                            transform: 'scale(1.1)',
                        },
                      }}
                      >
                        {selectedImages.has(image.id) ? <CheckCircle /> : <CheckCircleOutline />}
                      </IconButton>
                    </Box>

                    {/* Selection indicator */}
                    {selectedImages.has(image.id) && (
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: 4,
                          background: `linear-gradient(90deg, ${config.primaryColor}, ${alpha(config.primaryColor, 0.7)})`,
                      }}
                      />
                    )}
                  </Box>

                  <CardContent sx={{ p: 2, bgcolor: '#0f1419' }}>
                    <Typography
                      variant="subtitle1"
                      component="h3"
                      sx={{ color: '#fff', fontWeight: 600, mb: 1 }}
                      noWrap
                    >
                      {image.imageTitle}
                    </Typography>
                    {image.imageDescription && (
                      <Typography
                        variant="body2"
                        sx={{ color: 'rgba(255,255,255,0.7)', mb: 1 }}
                        noWrap
                      >
                        {image.imageDescription}
                      </Typography>
                    )}
                    {image.tags && image.tags.length > 0 && (
                      <Box
                        sx={{
                          mt: 1,
                          display: 'flex',
                          gap: 0.5,
                          flexWrap: 'wrap',
                      }}
                      >
                        {image.tags.slice(0, 3).map((tag) => (
                          <Chip
                            key={tag}
                            label={tag}
                            size="small"
                            sx={{
                              bgcolor: 'rgba(255,255,255,0.1)',
                              color: 'rgba(255,255,255,0.8)',
                              height: 24,
                          }}
                          />
                        ))}
                      </Box>
                    )}
                  </CardContent>

                  <CardActions
                    sx={{
                      p: 2,
                      pt: 0,
                      bgcolor: '#0f1419',
                      justifyContent: 'space-between',
                  }}
                  >
                    <Button
                      size="small"
                      startIcon={<ZoomIn />}
                      onClick={() => handleImageView(image)}
                      sx={{
                        color: 'rgba(255,255,255,0.7)','&:hover': { color: config.primaryColor },
                    }}
                    >
                      Se stort
                    </Button>
                    {gallery?.gallerySettings?.allowComments && (
                      <Badge
                        badgeContent={commentCountByImage[image.id] || 0}
                        color="primary"
                        overlap="rectangular"
                        sx={{ '& .MuiBadge-badge': { right: 6, top: 10 } }}
                      >
                        <Button
                          size="small"
                          startIcon={<Comment />}
                          onClick={() => handleAddComment(image.id)}
                          sx={{
                            color: 'rgba(255,255,255,0.7)','&:hover': { color: config.primaryColor },
                        }}
                        >
                          Kommentar
                        </Button>
                      </Badge>
                    )}
                  </CardActions>
                </MuiCard>
              </Grid>
                );
                return nodes;
              });
            })()}
          </Grid>
        </Box>
      </Box>

      {/* Image View Dialog with dark theme */}
      <Dialog
        open={imageDialogOpen}
        onClose={() => setImageDialogOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#0f1419',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)',
        },
      }}
      >
        {selectedImageForView && (
          <>
            <DialogTitle
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                bgcolor: '#0f1419',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
            }}
            >
              <Typography variant="h6" sx={{ color: '#fff' }}>
                {selectedImageForView.imageTitle}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                {/* Slice 9X.82 — Bestill print fra image-detail */}
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    setPrintOrderImage(selectedImageForView);
                    setImageDialogOpen(false);
                  }}
                  sx={{
                    color: '#fdfaf5',
                    borderColor: 'rgba(253, 250, 245, 0.4)',
                    fontFamily: '"Inter", "Segoe UI", sans-serif',
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    fontSize: '0.72rem',
                    px: 2,
                    borderRadius: 0,
                    minHeight: 36,
                    '&:hover': {
                      borderColor: '#fdfaf5',
                      bgcolor: 'rgba(253, 250, 245, 0.08)',
                    },
                  }}
                >
                  Bestill print
                </Button>
                <IconButton
                  onClick={() => setImageDialogOpen(false)}
                  sx={{ color: 'rgba(255,255,255,0.7)' }}
                >
                  <Close />
                </IconButton>
              </Stack>
            </DialogTitle>
            <DialogContent sx={{ bgcolor: '#0a0f1a', p: 3 }}>
              <Box sx={{ textAlign: 'center', mb: 2 }}>
                {(() => {
                  const showOriginal = showOriginalIds.has(selectedImageForView.id);
                  const watermarkOn = gallery?.gallerySettings?.watermarkEnabled;
                  const cleanedAvailable = Boolean(selectedImageForView.autoCleanedUrl);
                  const src = watermarkOn
                    ? selectedImageForView.watermarkedUrl
                    : (showOriginal || !cleanedAvailable
                        ? selectedImageForView.fullSizeUrl
                        : selectedImageForView.autoCleanedUrl);
                  return (
                    <img
                      src={src ?? undefined}
                      alt={selectedImageForView.imageTitle}
                      style={{
                        maxWidth: '100%',
                        height: 'auto',
                        maxHeight: '70vh',
                        borderRadius: '8px',
                      }}
                    />
                  );
                })()}
              </Box>
              {/* Slice 6 — auto-clean banner. Visible only when the photographer
                  opted in to deliver the cleaned variant. Watermark mode wins
                  (a watermarked preview can't be replaced mid-flow). */}
              {selectedImageForView.autoCleanedUrl
                && !gallery?.gallerySettings?.watermarkEnabled && (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    px: 2,
                    py: 1.5,
                    mb: 2,
                    bgcolor: 'rgba(0, 200, 200, 0.12)',
                    border: '1px solid rgba(0, 200, 200, 0.4)',
                    borderRadius: 1,
                  }}
                >
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.95)', fontWeight: 600 }}>
                      {showOriginalIds.has(selectedImageForView.id)
                        ? 'Viser original'
                        : `Auto-renset · ${selectedImageForView.autoCleanedDetectionCount ?? 0} objekter fjernet`}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)' }}>
                      {showOriginalIds.has(selectedImageForView.id)
                        ? 'Trykk for å gå tilbake til renset versjon'
                        : 'Trykk for å se originalbildet'}
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      setShowOriginalIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(selectedImageForView.id)) next.delete(selectedImageForView.id);
                        else next.add(selectedImageForView.id);
                        return next;
                      });
                    }}
                    sx={{
                      color: 'rgba(255,255,255,0.95)',
                      borderColor: 'rgba(0, 200, 200, 0.6)',
                      '&:hover': { borderColor: 'rgba(0, 200, 200, 1)' },
                    }}
                  >
                    {showOriginalIds.has(selectedImageForView.id) ? 'Vis renset' : 'Vis original'}
                  </Button>
                </Box>
              )}
              {selectedImageForView.imageDescription && (
                <Typography variant="body1" paragraph sx={{ color: 'rgba(255,255,255,0.8)' }}>
                  {selectedImageForView.imageDescription}
                </Typography>
              )}
              {selectedImageForView.imageMetadata && (
                <Paper
                  sx={{
                    p: 2,
                    mt: 2,
                    bgcolor: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                }}
                >
                  <Typography variant="subtitle2" gutterBottom sx={{ color: '#fff' }}>
                    Bildeinfo
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                    Oppløsning: {selectedImageForView.imageMetadata.width} ×{' '}
                    {selectedImageForView.imageMetadata.height}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                    Filstørrelse:{', '}
                    {(selectedImageForView.imageMetadata.fileSize / 1024 / 1024).toFixed(1)} MB
                  </Typography>
                  {selectedImageForView.imageMetadata.cameraSettings && (
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                      Kamera: {selectedImageForView.imageMetadata.cameraSettings.camera}
                    </Typography>
                  )}
                </Paper>
              )}
            </DialogContent>
            <DialogActions
              sx={{
                bgcolor: '#0f1419',
                borderTop: '1px solid rgba(255,255,255,0.1)',
            }}
            >
              <Button
                onClick={() => handleImageFavorite(selectedImageForView.id)}
                startIcon={
                  favoriteImages.has(selectedImageForView.id) ? <RingIcon /> : <FavoriteBorder />
              }
                sx={{ color: 'rgba(255,255,255,0.7)' }}
              >
                {favoriteImages.has(selectedImageForView.id)
                  ? 'Fjern favoritt'
                  : 'Legg til favoritt'}
              </Button>
              <Button
                onClick={() => handleImageSelect(selectedImageForView.id)}
                startIcon={
                  selectedImages.has(selectedImageForView.id) ? (
                    <CheckCircle />
                  ) : (
                    <CheckCircleOutline />
                  )
              }
                variant="contained"
                sx={{ bgcolor: config.primaryColor, color: '#fff' }}
              >
                {selectedImages.has(selectedImageForView.id) ? 'Fjern valg' : `Velg ${terms.item}`}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Comment Dialog with dark theme */}
      <Dialog
        open={commentDialogOpen}
        onClose={() => setCommentDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#0f1419',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)',
        },
      }}
      >
        <DialogTitle sx={{ color: '#fff' }}>Legg til kommentar</DialogTitle>
        <DialogContent sx={{ bgcolor: '#0a0f1a' }}>
          {(() => {
            const priorComments = commentImageId
              ? allComments.filter((c) => c.imageId === commentImageId)
              : [];
            if (priorComments.length === 0) return null;
            return (
              <Box sx={{ mb: 2, maxHeight: 240, overflowY: 'auto' }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                  Tidligere kommentarer
                </Typography>
                <Stack spacing={1} sx={{ mt: 1 }}>
                  {priorComments.map((c) => (
                    <Paper
                      key={c.id}
                      elevation={0}
                      sx={{
                        p: 1.25,
                        bgcolor: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)' }}>
                        {c.clientName || 'Klient'} · {new Date(c.createdAt).toLocaleString('nb-NO')}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#fff', whiteSpace: 'pre-wrap' }}>
                        {c.comment}
                      </Typography>
                    </Paper>
                  ))}
                </Stack>
              </Box>
            );
          })()}
          <TextField
            autoFocus
            margin="dense"
            label="Din kommentar"
            fullWidth
            multiline
            rows={4}
            variant="outlined"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Skriv din kommentar eller ønsker om redigering..."
            sx={{
              '& .MuiOutlinedInput-root': {
                color: '#fff','& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.5)' },
                '&.Mui-focused fieldset': { borderColor: config.primaryColor },
            },
              '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
          }}
          />
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#0f1419' }}>
          <Button
            onClick={() => setCommentDialogOpen(false)}
            sx={{ color: 'rgba(255,255,255,0.7)' }}
          >
            Avbryt
          </Button>
          <Button
            onClick={handleSubmitComment}
            variant="contained"
            startIcon={<Send />}
            disabled={!newComment.trim() || addCommentMutation.isPending}
            sx={{ bgcolor: config.primaryColor, color: '#fff' }}
          >
            Send kommentar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Pricing Dialog with dark theme */}
      <Dialog
        open={pricingDialogOpen}
        onClose={() => setPricingDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#0f1419',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)',
        },
      }}
      >
        <DialogTitle sx={{ color: '#fff' }}>Bekreft ditt valg</DialogTitle>
        <DialogContent sx={{ bgcolor: '#0a0f1a' }}>
          {calculatePricingMutation.data && (
            <Box>
              <Typography variant="h6" gutterBottom sx={{ color: '#fff' }}>
                Sammendrag
              </Typography>
              <Divider sx={{ mb: 2, borderColor: 'rgba(255,255,255,0.1)' }} />

              <Box sx={{ mb: 2 }}>
                <Typography sx={{ color: 'rgba(255,255,255,0.8)' }}>
                  {`Inkluderte ${terms.itemPlural}: ${calculatePricingMutation.data.pricing.includedImages}`}
                </Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.8)' }}>
                  {`Ekstra ${terms.itemPlural}: ${calculatePricingMutation.data.pricing.extraImages}`}
                </Typography>
                <Typography variant="h6" sx={{ mt: 1, color: config.primaryColor }}>
                  Total: {calculatePricingMutation.data.pricing.currency},{', '}
                  {calculatePricingMutation.data.pricing.totalAmount}
                </Typography>
              </Box>

              {calculatePricingMutation.data.pricing.totalAmount > 0 ? (
                <Alert
                  severity="warning"
                  sx={{
                    bgcolor: 'rgba(255, 152, 0, 0.1)',
                    border: '1px solid rgba(255, 152, 0, 0.3)',
                    color: '#fff',
                  }}
                >
                  Du blir sendt videre til Stripe for sikker betaling.
                  Etter betaling får du tilgang til å laste ned alle valgte {terms.itemPlural}.
                </Alert>
              ) : (
                <Alert
                  severity="info"
                  sx={{
                    bgcolor: 'rgba(33, 150, 243, 0.1)',
                    border: '1px solid rgba(33, 150, 243, 0.3)',
                    color: '#fff',
                  }}
                >
                  Fotografen vil bli varslet om ditt valg og kontakte deg for betaling og levering.
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#0f1419' }}>
          <Button
            onClick={() => setPricingDialogOpen(false)}
            sx={{ color: 'rgba(255,255,255,0.7)' }}
          >
            Tilbake
          </Button>
          {calculatePricingMutation.data?.pricing?.totalAmount > 0 ? (
            <Button
              onClick={async () => {
                // Slice 10.3 — Stripe Checkout Session redirect.
                // Backend lager session, vi navigerer til Stripe sin
                // hostede checkout-side; webhook fanger payment_intent
                // .succeeded og oppdaterer client_image_payments-rad
                // med download_token.
                try {
                  const res = await fetch(
                    `${(import.meta.env.DEV || window.location.hostname === 'localhost')
                      ? ''
                      : (import.meta.env.VITE_API_URL || '')}/api/client/gallery/${accessToken}/create-checkout-session`,
                    {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        ...(galleryPassword ? { 'x-gallery-password': galleryPassword } : {}),
                      },
                      body: JSON.stringify({
                        clientEmail: gallery?.clientEmail,
                        selectedImageIds: Array.from(selectedImages),
                      }),
                    },
                  );
                  if (!res.ok) {
                    throw new Error(`HTTP ${res.status}`);
                  }
                  const data = (await res.json()) as { checkoutUrl?: string };
                  if (data.checkoutUrl) {
                    window.location.href = data.checkoutUrl;
                  } else {
                    throw new Error('Mangler checkoutUrl i respons');
                  }
                } catch (err) {
                  console.error('[client-gallery] checkout-redirect failed:', err);
                  alert('Kunne ikke starte betaling. Prøv igjen eller kontakt fotografen.');
                }
              }}
              variant="contained"
              sx={{ bgcolor: config.primaryColor, color: '#fff' }}
            >
              {`Betal ${calculatePricingMutation.data.pricing.totalAmount} ${calculatePricingMutation.data.pricing.currency} →`}
            </Button>
          ) : (
            <Button
              onClick={() => submitSelectionMutation.mutate(calculatePricingMutation.data)}
              variant="contained"
              disabled={submitSelectionMutation.isPending}
              sx={{ bgcolor: config.primaryColor, color: '#fff' }}
            >
              Bekreft valg
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Selection Warning Dialog - Psykologisk tilnærming */}
      <ImageSelectionWarning
        open={selectionWarningOpen}
        onClose={() => setSelectionWarningOpen(false)}
        selectedCount={selectedImages.size + 1} // +1 for the image they're trying to add
        contractedImages={gallery?.gallerySettings?.contractedImages || 0}
        onKeepAllImages={handleKeepAllImagesConfirmed}
        onSelectFewer={handleSelectFewerImagesConfirmed}
        pricePerImage={gallery?.gallerySettings?.pricePerImage || 150}
        packageDeals={{
          package50: 6000,
          package100: 10000,
      }}
        contractId={gallery?.projectId}
        onViewContract={() => {
          setContractPreviewOpen(true);
      }}
      />

      {/* Extra Image Pricing Dialog */}
      <ExtraImagePricingDialog
        open={extraImagePricingOpen}
        onClose={() => setExtraImagePricingOpen(false)}
        galleryId={gallery?.id || ''}
        selectedImages={Array.from(selectedImages)}
        contractedImages={gallery?.gallerySettings?.contractedImages || 0}
        clientEmail={gallery?.clientEmail || ''}
        photographerId={gallery?.photographerId || ', '}
        onSubmitSuccess={() => {
          // Refresh gallery data
          queryClient.invalidateQueries({
            queryKey: ['/api/client/gallery', accessToken],
        });
      }}
      />

      {/* Selection Summary FAB with dark theme */}
      {(selectedImages.size > 0 || favoriteImages.size > 0) && (
        <Fab
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 100,
            bgcolor: config.primaryColor,
            color: '#fff',
            '&:hover': {
              bgcolor: alpha(config.primaryColor, 0.8),
          },
        }}
          onClick={handleProceedToCheckout}
        >
          <Badge badgeContent={selectedImages.size} color="secondary">
            <ShoppingCart />
          </Badge>
        </Fab>
      )}

      {/* Contract Preview Modal */}
      <ContractPreviewModal
        open={contractPreviewOpen}
        onClose={() => setContractPreviewOpen(false)}
        contractId={gallery?.projectId}
        projectId={gallery?.projectId}
      />

      {/* Terms Acceptance Dialog */}
      <TermsAcceptanceDialog
        open={termsAcceptanceOpen}
        onClose={() => setTermsAcceptanceOpen(false)}
        onAccept={() => {
          setHasAcceptedTerms(true);
          setTermsAcceptanceOpen(false);
          // Continue with checkout after accepting terms
          handleProceedToCheckout();
      }}
        projectType={projectDetails?.projectType ||'bryllup'}
        contractId={gallery?.projectId}
      />

      <ReflectPromptModal
        open={reflectPromptOpen}
        sessionId={insightsSessionId || telemetry.sessionId}
        onClose={() => setReflectPromptOpen(false)}
      />

      {insightsSessionId && (
        <Box sx={{ position: 'fixed', bottom: 16, right: 16, maxWidth: 420, zIndex: 1300 }}>
          <PostSessionInsightsCard
            sessionId={insightsSessionId}
            onClose={() => setInsightsSessionId(null)}
          />
        </Box>
      )}

      {/* Slice 9.4 — gallery password prompt. Opens automatically when
          GET /:token returns requiresPassword=true. Submitting saves
          to component state which then unblocks all the auth'd queries
          (images, selections, comments). Wrong password keeps the
          dialog open with an error so the client can retry. */}
      <Dialog
        open={passwordPromptOpen}
        onClose={() => {
          // Closing without entering a password just leaves the
          // gallery's auth'd content hidden — no harm. Don't auto-
          // dismiss otherwise photographer-shared galleries with a
          // typo'd password become permanently broken.
          setPasswordPromptOpen(false);
          setPasswordInput('');
          setPasswordError(null);
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Galleri passord</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
            Fotografen har låst dette galleriet. Skriv inn passordet du fikk i
            invitasjonen.
          </Typography>
          <input
            type="password"
            value={passwordInput}
            autoFocus
            onChange={(e) => {
              setPasswordInput(e.target.value);
              setPasswordError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && passwordInput.length > 0) {
                setGalleryPassword(passwordInput);
                setPasswordPromptOpen(false);
                setPasswordInput('');
              }
            }}
            placeholder="Passord"
            style={{
              width: '100%',
              padding: '12px 16px',
              fontSize: 16,
              borderRadius: 6,
              border: '1px solid #ccc',
              outline: 'none',
            }}
          />
          {passwordError && (
            <Typography variant="caption" sx={{ color: '#d32f2f', mt: 1, display: 'block' }}>
              {passwordError}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPasswordPromptOpen(false)}>Avbryt</Button>
          <Button
            variant="contained"
            disabled={passwordInput.length === 0}
            onClick={() => {
              setGalleryPassword(passwordInput);
              setPasswordPromptOpen(false);
              setPasswordInput('');
            }}
          >
            Lås opp
          </Button>
        </DialogActions>
      </Dialog>

      {/* Slice 9X.82 — Sticky "Send mitt utvalg"-FAB i Pic-Time-stil.
          Vises kun når klienten har valgt minst ett bilde + ikke alle
          allerede er submittet. */}
      {favoriteImages.size > 0 && (
        <Box
          sx={{
            position: 'fixed',
            bottom: { xs: 16, sm: 32 },
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1100,
            // Pulserende skygge for å trekke oppmerksomheten
            '@keyframes pulse-glow': {
              '0%, 100%': { boxShadow: '0 8px 24px rgba(217, 119, 6, 0.32)' },
              '50%': { boxShadow: '0 8px 32px rgba(217, 119, 6, 0.55)' },
            },
          }}
        >
          <Button
            variant="contained"
            size="large"
            onClick={() => setShowSubmitDialog(true)}
            sx={{
              bgcolor: '#1a1612',
              color: '#fdfaf5',
              fontFamily: '"Inter", "Segoe UI", sans-serif',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              fontSize: '0.78rem',
              px: 4,
              py: 1.5,
              borderRadius: 999,
              minHeight: 48,
              animation: 'pulse-glow 2.4s ease-in-out infinite',
              '@media (prefers-reduced-motion: reduce)': {
                animation: 'none',
                boxShadow: '0 8px 24px rgba(217, 119, 6, 0.32)',
              },
              '&:hover': { bgcolor: '#2d2620' },
            }}
          >
            Send mitt utvalg · {favoriteImages.size}
          </Button>
        </Box>
      )}

      {/* Slice 9X.82 — Submit-dialog (Pic-Time editorial) */}
      <GallerySelectionSubmitDialog
        open={showSubmitDialog}
        onClose={() => setShowSubmitDialog(false)}
        accessToken={accessToken}
        galleryPassword={galleryPassword}
        clientEmail={gallery?.clientEmail || ''}
        clientName={gallery?.clientName || null}
        favorites={Array.from(favoriteImages).map((id) => {
          const img = images.find((i: GalleryImage) => i.id === id);
          return {
            imageId: id,
            thumbnailUrl: img?.thumbnailUrl || null,
            title: img?.imageTitle || null,
          };
        })}
        onSubmitted={() => {
          void queryClient.invalidateQueries({
            queryKey: ['/api/client/gallery', accessToken, 'selections', galleryPassword],
          });
        }}
      />

      {/* Slice 9X.82 — Play-slideshow-knapp (sticky øverst-til-høyre) */}
      {images.length > 1 && (
        <Box
          sx={{
            position: 'fixed',
            top: { xs: 12, sm: 24 },
            right: { xs: 12, sm: 24 },
            zIndex: 1050,
          }}
        >
          <Tooltip title="Spill av slideshow">
            <IconButton
              onClick={() => {
                setSlideshowStartIndex(0);
                setShowSlideshow(true);
              }}
              aria-label="Spill av slideshow"
              sx={{
                bgcolor: 'rgba(10, 8, 7, 0.85)',
                color: '#fdfaf5',
                backdropFilter: 'blur(8px)',
                width: { xs: 44, sm: 48 },
                height: { xs: 44, sm: 48 },
                border: '1px solid rgba(253, 250, 245, 0.18)',
                '&:hover': {
                  bgcolor: 'rgba(217, 119, 6, 0.92)',
                  borderColor: '#fdfaf5',
                },
              }}
            >
              <PlayArrow />
            </IconButton>
          </Tooltip>
        </Box>
      )}

      {/* Slice 9X.82 — Fullskjerm slideshow */}
      <GallerySlideshow
        open={showSlideshow}
        onClose={() => setShowSlideshow(false)}
        startIndex={slideshowStartIndex}
        images={images.map((img: GalleryImage) => ({
          id: img.id,
          url: img.fullSizeUrl || img.thumbnailUrl || '',
          alt: img.imageTitle || '',
        }))}
      />

      {/* Slice 9X.82 — Floating chapter-nav (vertikal desktop / horisontal mobile) */}
      {Array.isArray(gallery?.gallerySettings?.chapters) && gallery!.gallerySettings.chapters.length >= 2 && (
        <GalleryChapterNav
          chapters={(gallery!.gallerySettings.chapters as GalleryChapter[]).map((c) => ({
            id: c.id,
            title: c.title,
          }))}
        />
      )}

      {/* Slice 9X.82 — Per-bilde print-bestilling (Pic-Time editorial) */}
      {printOrderImage && (
        <PrintOrderDialog
          open={!!printOrderImage}
          onClose={() => setPrintOrderImage(null)}
          accessToken={accessToken}
          galleryPassword={galleryPassword}
          imageId={printOrderImage.id}
          imageThumbnail={printOrderImage.thumbnailUrl || printOrderImage.fullSizeUrl || null}
          imageTitle={printOrderImage.imageTitle || null}
          clientEmail={gallery?.clientEmail || null}
          clientName={gallery?.clientName || null}
        />
      )}
    </Box>
  );
}
