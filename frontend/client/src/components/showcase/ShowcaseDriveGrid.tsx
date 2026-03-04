import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  ImageList,
  ImageListItem,
  ImageListItemBar,
  Slider,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Edit as EditIcon,
  Fullscreen as FullscreenIcon,
  PlayArrow as PlayArrowIcon,
  Tune as TuneIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import type { CropSettings, FocalPoint } from './ImageCropEditor';
import { ImageCropEditor } from './ImageCropEditor';

interface ContentItem {
  id: number;
  driveFileId: string;
  fileName: string;
  fileType: 'image' | 'video' | 'document';
  mimeType: string;
  fileSize: number;
  isVisible: boolean;
  displayOrder: number;
  title?: string;
  description?: string;
  thumbnailUrl?: string;
  cropSettings?: CropSettings;
  focalPoint?: FocalPoint;
  videoThumbnailTime?: number;
  driveMetadata?: Record<string, unknown>;
  lastModifiedInDrive: string;
}

interface ShowcaseDriveGridProps {
  categoryId: number;
  categoryName: string;
  gridLayout: 'grid' | 'masonry' | 'carousel';
  isEditable?: boolean;
  accessToken: string;
  onItemSelect?: (item: ContentItem) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const normalized = bytes / Math.pow(1024, index);
  return `${normalized.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function normalizeContentItems(payload: unknown): ContentItem[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((entry, index) => {
      if (typeof entry !== 'object' || entry === null) {
        return null;
      }

      const raw = entry as Partial<ContentItem>;
      const fileType: ContentItem['fileType'] =
        raw.fileType === 'image' || raw.fileType === 'video' || raw.fileType === 'document'
          ? raw.fileType
          : 'document';

      return {
        id: typeof raw.id === 'number' ? raw.id : index,
        driveFileId: typeof raw.driveFileId === 'string' ? raw.driveFileId : '',
        fileName: typeof raw.fileName === 'string' ? raw.fileName : `file-${index}`,
        fileType,
        mimeType: typeof raw.mimeType === 'string' ? raw.mimeType : 'application/octet-stream',
        fileSize: typeof raw.fileSize === 'number' ? raw.fileSize : 0,
        isVisible: raw.isVisible !== false,
        displayOrder: typeof raw.displayOrder === 'number' ? raw.displayOrder : index,
        title: raw.title,
        description: raw.description,
        thumbnailUrl: raw.thumbnailUrl,
        cropSettings: raw.cropSettings,
        focalPoint: raw.focalPoint,
        videoThumbnailTime: raw.videoThumbnailTime,
        driveMetadata: raw.driveMetadata,
        lastModifiedInDrive: typeof raw.lastModifiedInDrive === 'string' ? raw.lastModifiedInDrive : new Date().toISOString(),
      };
    })
    .filter((item): item is ContentItem => item !== null)
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

function driveThumbnailUrl(item: ContentItem): string {
  if (item.thumbnailUrl) {
    return item.thumbnailUrl;
  }

  return `https://drive.google.com/thumbnail?id=${item.driveFileId}&sz=w800-h800`;
}

function driveOpenUrl(item: ContentItem): string {
  return `https://drive.google.com/uc?id=${item.driveFileId}`;
}

export const ShowcaseDriveGrid: React.FC<ShowcaseDriveGridProps> = ({
  categoryId,
  categoryName,
  gridLayout,
  isEditable = false,
  accessToken,
  onItemSelect,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [cropEditorOpen, setCropEditorOpen] = useState(false);
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [videoThumbnailTime, setVideoThumbnailTime] = useState(0);

  const contentQuery = useQuery({
    queryKey: ['showcase-content', categoryId, isEditable],
    queryFn: async () => {
      const response = await fetch(
        `/api/showcase/drive/category/${encodeURIComponent(String(categoryId))}/items?onlyVisible=${String(!isEditable)}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error('Kunne ikke hente showcase-innhold.');
      }

      const payload = (await response.json()) as { data?: unknown[] };
      return normalizeContentItems(payload.data ?? []);
    },
  });

  const items = contentQuery.data ?? [];

  const openItem = (item: ContentItem) => {
    setSelectedItem(item);
    if (onItemSelect) {
      onItemSelect(item);
      return;
    }
    setPreviewOpen(true);
  };

  const openCropEditor = (item: ContentItem) => {
    setSelectedItem(item);
    setCropEditorOpen(true);
  };

  const openVideoThumbnailEditor = (item: ContentItem) => {
    setSelectedItem(item);
    setVideoThumbnailTime(item.videoThumbnailTime ?? 0);
    setVideoDialogOpen(true);
  };

  const saveCropData = async (cropSettings: CropSettings, focalPoint: FocalPoint) => {
    if (!selectedItem) {
      return;
    }

    try {
      await fetch(`/api/showcase/drive/item/${selectedItem.id}/crop`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cropSettings, focalPoint }),
      });
    } catch {
      // Ignore backend availability in local mode; query refresh still provides latest when available.
    }

    setCropEditorOpen(false);
    contentQuery.refetch();
  };

  const saveVideoThumbnail = async () => {
    if (!selectedItem) {
      return;
    }

    try {
      await fetch(`/api/showcase/drive/item/${selectedItem.id}/video-thumbnail`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ thumbnailTime: videoThumbnailTime }),
      });
    } catch {
      // best effort in local mode
    }

    setVideoDialogOpen(false);
    contentQuery.refetch();
  };

  const gridNode = useMemo(() => {
    if (gridLayout === 'masonry') {
      return (
        <ImageList variant="masonry" cols={isMobile ? 2 : 4} gap={8}>
          {items.map((item) => (
            <ImageListItem key={item.id} onClick={() => openItem(item)} sx={{ cursor: 'pointer' }}>
              {item.fileType === 'image' ? (
                <img src={driveThumbnailUrl(item)} alt={item.title ?? item.fileName} loading="lazy" style={{ borderRadius: 8 }} />
              ) : (
                <Box
                  sx={{
                    minHeight: 160,
                    borderRadius: 2,
                    background: 'rgba(10,20,30,0.8)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <PlayArrowIcon fontSize="large" />
                </Box>
              )}

              <ImageListItemBar
                title={item.title ?? item.fileName}
                subtitle={`${item.fileType.toUpperCase()} · ${formatFileSize(item.fileSize)}`}
                actionIcon={
                  <IconButton sx={{ color: 'rgba(255,255,255,0.85)' }} onClick={() => openItem(item)}>
                    <FullscreenIcon />
                  </IconButton>
                }
              />
            </ImageListItem>
          ))}
        </ImageList>
      );
    }

    if (gridLayout === 'carousel') {
      return (
        <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 1 }}>
          {items.map((item) => (
            <Card key={item.id} sx={{ minWidth: 280, maxWidth: 280, cursor: 'pointer' }} onClick={() => openItem(item)}>
              {item.fileType === 'image' ? (
                <CardMedia component="img" image={driveThumbnailUrl(item)} sx={{ height: 180, objectFit: 'cover' }} />
              ) : (
                <Box
                  sx={{
                    height: 180,
                    background: 'rgba(10,20,30,0.85)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <PlayArrowIcon fontSize="large" />
                </Box>
              )}

              <CardContent>
                <Typography variant="subtitle2" noWrap>
                  {item.title ?? item.fileName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {item.fileType.toUpperCase()} · {formatFileSize(item.fileSize)}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Box>
      );
    }

    return (
      <Grid container spacing={2}>
        {items.map((item) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={item.id}>
            <Card sx={{ cursor: 'pointer', height: '100%' }} onClick={() => openItem(item)}>
              {item.fileType === 'image' ? (
                <CardMedia component="img" image={driveThumbnailUrl(item)} sx={{ height: 180, objectFit: 'cover' }} />
              ) : (
                <Box
                  sx={{
                    height: 180,
                    background: 'rgba(10,20,30,0.85)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <PlayArrowIcon fontSize="large" />
                </Box>
              )}

              <CardContent>
                <Typography variant="subtitle2" noWrap>
                  {item.title ?? item.fileName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {item.fileType.toUpperCase()} · {formatFileSize(item.fileSize)}
                </Typography>
                {isEditable && (
                  <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
                    <Chip size="small" label={item.isVisible ? 'Synlig' : 'Skjult'} color={item.isVisible ? 'success' : 'default'} />
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    );
  }, [gridLayout, isMobile, isEditable, items]);

  if (contentQuery.isLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (contentQuery.isError) {
    return <Typography color="error">Kunne ikke laste innhold for {categoryName}.</Typography>;
  }

  if (items.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <Typography variant="h6">Ingen innhold funnet i {categoryName}</Typography>
        <Typography variant="body2" color="text.secondary">
          Synkroniser denne kategorien for a hente filer fra Google Drive.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 1.5 }}>
        {categoryName}
      </Typography>

      {gridNode}

      {selectedItem && (
        <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="lg" fullWidth>
          <DialogTitle>{selectedItem.title ?? selectedItem.fileName}</DialogTitle>
          <DialogContent>
            {selectedItem.fileType === 'image' ? (
              <img
                src={driveOpenUrl(selectedItem)}
                alt={selectedItem.title ?? selectedItem.fileName}
                style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain' }}
              />
            ) : selectedItem.fileType === 'video' ? (
              <video controls style={{ width: '100%', maxHeight: '70vh' }}>
                <source src={driveOpenUrl(selectedItem)} type={selectedItem.mimeType} />
              </video>
            ) : (
              <Stack spacing={1.5}>
                <Typography>{selectedItem.fileName}</Typography>
                <Button variant="outlined" href={driveOpenUrl(selectedItem)} target="_blank" startIcon={<DownloadIcon />}>
                  Last ned
                </Button>
              </Stack>
            )}
          </DialogContent>

          <DialogActions>
            {isEditable && selectedItem.fileType === 'image' && (
              <Button startIcon={<EditIcon />} onClick={() => openCropEditor(selectedItem)}>
                Crop
              </Button>
            )}
            {isEditable && selectedItem.fileType === 'video' && (
              <Button startIcon={<TuneIcon />} onClick={() => openVideoThumbnailEditor(selectedItem)}>
                Thumbnail
              </Button>
            )}
            <Button href={driveOpenUrl(selectedItem)} target="_blank" startIcon={<DownloadIcon />}>
              Download
            </Button>
            <Button onClick={() => setPreviewOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>
      )}

      {selectedItem && cropEditorOpen && (
        <ImageCropEditor
          open={cropEditorOpen}
          onClose={() => setCropEditorOpen(false)}
          imageUrl={driveOpenUrl(selectedItem)}
          currentCropSettings={selectedItem.cropSettings}
          currentFocalPoint={selectedItem.focalPoint}
          onSave={saveCropData}
        />
      )}

      <Dialog open={videoDialogOpen} onClose={() => setVideoDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Video thumbnail tid</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Sett tidspunkt (sekunder) som skal brukes som preview-thumbnail.
          </Typography>
          <Slider
            min={0}
            max={300}
            step={1}
            value={videoThumbnailTime}
            onChange={(_, value) => setVideoThumbnailTime(value as number)}
          />
          <Typography variant="caption" color="text.secondary">
            Valgt: {videoThumbnailTime}s
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVideoDialogOpen(false)}>Avbryt</Button>
          <Button variant="contained" onClick={saveVideoThumbnail}>
            Lagre
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ShowcaseDriveGrid;
