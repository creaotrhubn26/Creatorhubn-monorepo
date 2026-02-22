import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  useAdminPageCustomizations,
  usePublishPage,
  useSavePageCustomizations,
} from '@/hooks/usePageCustomizations';
import { useAuth } from '@/hooks/useAuth';

interface ShowcaseItem {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  fileUrl?: string;
  category?: string;
  type?: string;
}

interface ShowcaseCategory {
  id: string;
  name: string;
  profession: string;
  description?: string;
}

interface ShowcasePublisherPanelProps {
  userId?: string;
}

const PAGE_OPTIONS = [
  { id: 'landing-desktop', label: 'Landing Desktop' },
  { id: 'landing-mobile', label: 'Landing Mobile' },
];

const DEFAULT_PROFESSION = 'videographer';

const getCategoryForPage = (pageId: string, categories: ShowcaseCategory[]) => {
  const directMatch = categories.find((category) => category.name === pageId);
  if (directMatch) return directMatch.name;

  const normalized = pageId.replace(/[-_]/g, ' ').toLowerCase();
  const friendlyMatch = categories.find((category) =>
    category.name.replace(/[-_]/g, ' ').toLowerCase() === normalized
  );
  return friendlyMatch?.name || '';
};

const ShowcasePublisherPanel: React.FC<ShowcasePublisherPanelProps> = ({ userId }) => {
  const { user } = useAuth();
  const _effectiveUserId = userId || user?.id;
  const [pageId, setPageId] = useState(PAGE_OPTIONS[0].id);
  const [profession, setProfession] = useState(DEFAULT_PROFESSION);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [publishNow, setPublishNow] = useState(true);
  const [selectedItem, setSelectedItem] = useState<ShowcaseItem | null>(null);

  const { data: customizations } = useAdminPageCustomizations(pageId);
  const saveMutation = useSavePageCustomizations();
  const publishMutation = usePublishPage();

  const { data: categories = [] } = useQuery<ShowcaseCategory[]>({
    queryKey: ['showcase-categories', profession],
    queryFn: () =>
      apiRequest(`/api/showcase/categories?profession=${encodeURIComponent(profession)}`),
  });

  const { data: items = [] } = useQuery<ShowcaseItem[]>({
    queryKey: ['showcase-items', profession],
    queryFn: () => apiRequest(`/api/showcase/profession/${profession}`),
  });

  useEffect(() => {
    const nextCategory = getCategoryForPage(pageId, categories);
    setCategory((prev) => prev || nextCategory);
  }, [pageId, categories]);

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return items
      .filter((item) => item.type === 'video')
      .filter((item) => (category ? item.category === category : true))
      .filter((item) =>
        normalizedSearch
          ? `${item.title} ${item.description || ''}`.toLowerCase().includes(normalizedSearch)
          : true
      );
  }, [items, category, search]);

  const currentVideo: { videoUrl?: string; title?: string; showcaseItemId?: string } = customizations?.draftSections?.video || customizations?.sections?.video || {};

  const handlePublishSelection = () => {
    if (!selectedItem) return;

    const currentSections = customizations?.draftSections || customizations?.sections || {};
    const updatedVideo = {
      ...currentSections.video,
      enabled: true,
      showEmbeddedVideo: true,
      title: selectedItem.title || currentSections.video?.title,
      description: selectedItem.description || currentSections.video?.description,
      videoUrl: selectedItem.fileUrl || currentSections.video?.videoUrl,
      posterUrl: selectedItem.thumbnailUrl || currentSections.video?.posterUrl,
      showcaseItemId: selectedItem.id,
    };

    const updatedSections = {
      ...currentSections,
      video: updatedVideo,
    };

    saveMutation.mutate(
      {
        pageId,
        customizations: { sections: updatedSections },
        saveAsDraft: !publishNow,
      },
      {
        onSuccess: () => {
          if (publishNow) {
            publishMutation.mutate(pageId);
          }
        },
      }
    );
  };

  const handleCreateCategory = async () => {
    if (!pageId) return;
    const newCategory = await apiRequest('/api/showcase/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: pageId,
        profession,
        description: `Auto-generated for ${pageId}`,
      }),
    });
    setCategory(newCategory.name);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Typography variant="h5">Showcase Publisher</Typography>
        <Typography variant="body2" color="text.secondary">
          Velg video fra Universal Showcase og publiser til en spesifikk CreatorHub-side.
        </Typography>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>Side</InputLabel>
            <Select
              label="Side"
              value={pageId}
              onChange={(event) => setPageId(event.target.value as string)}
            >
              {PAGE_OPTIONS.map((page) => (
                <MenuItem key={page.id} value={page.id}>
                  {page.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Profesjon</InputLabel>
            <Select
              label="Profesjon"
              value={profession}
              onChange={(event) => setProfession(event.target.value as string)}
            >
              <MenuItem value="videographer">Videograf</MenuItem>
              <MenuItem value="photographer">Fotograf</MenuItem>
              <MenuItem value="music_producer">Musikkprodusent</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 240 }}>
            <InputLabel>Kategori</InputLabel>
            <Select
              label="Kategori"
              value={category}
              onChange={(event) => setCategory(event.target.value as string)}
            >
              {categories.map((categoryItem) => (
                <MenuItem key={categoryItem.id} value={categoryItem.name}>
                  {categoryItem.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button variant="outlined" onClick={() => setPickerOpen(true)}>
            Velg video
          </Button>
        </Stack>

        {!category && (
          <Button variant="text" onClick={handleCreateCategory}>
            Opprett kategori for {pageId}
          </Button>
        )}

        <Card variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Gjeldende video for {pageId}
          </Typography>
          {currentVideo?.videoUrl ? (
            <Stack spacing={1}>
              <Typography variant="body2">{currentVideo.title || 'Ingen tittel'}</Typography>
              <Chip size="small" label={currentVideo.showcaseItemId || 'Manuelt valgt'} />
              <Typography variant="caption" color="text.secondary">
                {currentVideo.videoUrl}
              </Typography>
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Ingen video er publisert ennå.
            </Typography>
          )}
        </Card>

        {selectedItem && (
          <Card variant="outlined" sx={{ display: 'flex', gap: 2, p: 2 }}>
            {selectedItem.thumbnailUrl && (
              <CardMedia
                component="img"
                image={selectedItem.thumbnailUrl}
                sx={{ width: 160, borderRadius: 1 }}
              />
            )}
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6">{selectedItem.title}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {selectedItem.description || 'Ingen beskrivelse'}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip size="small" label={selectedItem.category || 'Uten kategori'} />
                <Typography variant="caption" color="text.secondary">
                  {selectedItem.fileUrl}
                </Typography>
              </Stack>
            </Box>
          </Card>
        )}

        <Stack direction="row" spacing={2} alignItems="center">
          <Switch checked={publishNow} onChange={(event) => setPublishNow(event.target.checked)} />
          <Typography variant="body2">Publiser direkte</Typography>
        </Stack>

        <Button
          variant="contained"
          disabled={!selectedItem || saveMutation.isPending}
          onClick={handlePublishSelection}
        >
          {publishNow ? 'Publiser video til side' : 'Lagre som utkast'}
        </Button>
      </Stack>

      <Dialog open={pickerOpen} onClose={() => setPickerOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Velg video fra Showcase</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              size="small"
              label="Sok"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                gap: 2,
              }}
            >
              {filteredItems.map((item) => (
                <Card key={item.id} variant="outlined">
                  {item.thumbnailUrl && (
                    <CardMedia component="img" image={item.thumbnailUrl} sx={{ height: 160 }} />
                  )}
                  <CardContent>
                    <Typography variant="subtitle1" sx={{ mb: 1 }}>
                      {item.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {item.description || 'Ingen beskrivelse'}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip size="small" label={item.category || 'Uten kategori'} />
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          setSelectedItem(item);
                          setPickerOpen(false);
                        }}
                      >
                        Bruk video
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPickerOpen(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ShowcasePublisherPanel;
