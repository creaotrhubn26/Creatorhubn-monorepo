/**
 * Client Gallery Page - For photo selection and viewing
 * Material UI implementation with Norwegian localization
 * Using Universal Showcase design and profession adapter integration
 */

import React, { useState, useEffect, useRef } from 'react';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '@/components/universal/hooks/useDynamicProfessions';
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

  // Fetch gallery data (includes project ID linkage)
  const { data: gallery, isLoading: galleryLoading } = useQuery({
    queryKey: ['/api/client/gallery', accessToken],
    queryFn: () => apiRequest(`/api/client/gallery/${accessToken}`),
    enabled: !!accessToken,
});

  // Fetch gallery images (linked to project)
  const { data: images = [], isLoading: imagesLoading } = useQuery({
    queryKey: ['/api/client/gallery', accessToken, 'images'],
    queryFn: () => apiRequest(`/api/client/gallery/${accessToken}/images`),
    enabled: !!accessToken,
});

  // Fetch existing selections (linked to project and client). Backend
  // returns { galleryId, selections: [...] } for the whole gallery;
  // clientEmail filtering is done locally.
  const { data: selections = { selections: [] } } = useQuery({
    queryKey: ['/api/client/gallery', accessToken, 'selections'],
    queryFn: () =>
      apiRequest(`/api/client/gallery/${accessToken}/selections`),
    enabled: !!accessToken,
});

  // Fetch existing comments so the gallery can show prior notes on the
  // image detail view + comment counts. Mirrors the selections query
  // shape; both come back as { galleryId, <collection>: [...] }.
  const { data: commentsData = { comments: [] } } = useQuery({
    queryKey: ['/api/client/gallery', accessToken, 'comments'],
    queryFn: () =>
      apiRequest(`/api/client/gallery/${accessToken}/comments`),
    enabled: !!accessToken,
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
                inkluderte bilder
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
                Valgte bilder:
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
                  {gallery.gallerySettings.currency} {gallery.gallerySettings.pricePerImage}/bilde
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

        {/* Action Button */}
        {selectedImages.size > 0 && (
          <Button
            variant="contained"
            fullWidth
            onClick={handleProceedToCheckout}
            sx={{
              mt: 'auto',
              bgcolor: config.primaryColor,
              color: 'white',
              py: 1.5, '&:hover': {
                bgcolor: alpha(config.primaryColor, 0.8),
            },
          }}
            startIcon={<ShoppingCart />}
          >
            Fortsett ({selectedImages.size} bilder)
          </Button>
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
              {gallery?.projectTitle || 'Fotogalleri'}
            </Typography>
            <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.7)' }}>
              Hei {gallery?.clientName}! Velg dine favorittbilder
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

          {/* Images Grid */}
          <Grid container spacing={viewMode === 'grid' ? 3 : 2}>
            {filteredImages.map((image: GalleryImage) => (
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
            ))}
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
              <IconButton
                onClick={() => setImageDialogOpen(false)}
                sx={{ color: 'rgba(255,255,255,0.7)' }}
              >
                <Close />
              </IconButton>
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
                {selectedImages.has(selectedImageForView.id) ? 'Fjern valg' : 'Velg bilde'}
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
                  Inkluderte bilder: {calculatePricingMutation.data.pricing.includedImages}
                </Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.8)' }}>
                  Ekstra bilder: {calculatePricingMutation.data.pricing.extraImages}
                </Typography>
                <Typography variant="h6" sx={{ mt: 1, color: config.primaryColor }}>
                  Total: {calculatePricingMutation.data.pricing.currency},{', '}
                  {calculatePricingMutation.data.pricing.totalAmount}
                </Typography>
              </Box>

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
          <Button
            onClick={() => submitSelectionMutation.mutate(calculatePricingMutation.data)}
            variant="contained"
            disabled={submitSelectionMutation.isPending}
            sx={{ bgcolor: config.primaryColor, color: '#fff' }}
          >
            Bekreft valg
          </Button>
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
    </Box>
  );
}
