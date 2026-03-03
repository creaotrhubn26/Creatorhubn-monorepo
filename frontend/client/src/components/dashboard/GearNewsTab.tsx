import React, { useMemo, useState } from 'react';
import {
  Article,
  CameraAlt,
  Close,
  DirectionsBusiness,
  LibraryMusic,
  OpenInNew,
  Search,
  Settings,
  Star,
  TrendingUp,
  Videocam,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  CardHeader,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useTheming } from '../../utils/theming-helper';

interface GearNewsTabProps {
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise';
  className?: string;
}

interface GearNewsArticle {
  title?: string;
  summary?: string;
  content?: string;
  category?: string;
  brand?: string;
  rating?: number | string;
  source?: string;
  url?: string;
  isNew?: boolean;
  norwegian_source?: boolean;
  international_source?: boolean;
  published_date?: string;
  tags?: string[];
}

interface GearNewsApiResponse {
  success?: boolean;
  data?: GearNewsArticle[];
}

interface ProfessionConfig {
  title: string;
  icon: React.ReactElement;
  color: string;
  categories: string[];
  description: string;
}

interface TabPanelProps {
  children: React.ReactNode;
  value: number;
  index: number;
}

function CustomTabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

function getProfessionConfig(profession: GearNewsTabProps['profession']): ProfessionConfig {
  switch (profession) {
    case 'photographer':
      return {
        title: 'Fotoutstyr Nyheter',
        icon: <CameraAlt />,
        color: '#f59e00',
        categories: ['Kameraer', 'Objektiver', 'Blits', 'Stativer', 'Tilbehør', 'Software'],
        description: 'Siste nytt innen fotografiutstyr og teknologi',
      };
    case 'videographer':
      return {
        title: 'Videoutstyr Nyheter',
        icon: <Videocam />,
        color: '#dc2620',
        categories: ['Kameraer', 'Gimbals', 'Lyd', 'Belysning', 'Editing', 'Droner'],
        description: 'Siste nytt innen videoproduksjon og utstyr',
      };
    case 'music_producer':
      return {
        title: 'Studioutstyr Nyheter',
        icon: <LibraryMusic />,
        color: '#7c3aed',
        categories: ['Audio Interface', 'Mikrofoner', 'Hodetelefoner', 'Software', 'Synthesizers'],
        description: 'Siste nytt innen lydproduksjon og studioutstyr',
      };
    case 'vendor':
      return {
        title: 'Leverandør Nyheter',
        icon: <DirectionsBusiness />,
        color: '#2563eb',
        categories: ['AV-utstyr', 'Sceneteknikk', 'Lys', 'Lyd', 'Streaming', 'Installasjoner'],
        description: 'Siste nytt innen profesjonelt AV-utstyr og installasjoner',
      };
    default:
      return {
        title: 'Utstyr Nyheter',
        icon: <Article />,
        color: '#6b7280',
        categories: ['Generelt', 'Software', 'Tilbehør'],
        description: 'Generelle nyheter om utstyr og teknologi',
      };
  }
}

export function GearNewsTab({ profession, className }: GearNewsTabProps) {
  const theming = useTheming(profession);
  const config = useMemo(() => getProfessionConfig(profession), [profession]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [tabValue, setTabValue] = useState(0);
  const [selectedArticle, setSelectedArticle] = useState<GearNewsArticle | null>(null);
  const [readMoreOpen, setReadMoreOpen] = useState(false);

  const { data, isLoading } = useQuery<GearNewsApiResponse>({
    queryKey: ['/api/gear-news', profession],
    queryFn: () => fetch(`/api/gear-news?profession=${profession}`).then((res) => res.json()),
    refetchInterval: 30 * 60 * 1000,
    staleTime: 10 * 60 * 1000,
  });

  const articles = useMemo<GearNewsArticle[]>(() => {
    if (!data?.success || !Array.isArray(data.data)) return [];
    return data.data;
  }, [data]);

  const filteredNews = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return articles.filter((item) => {
      const matchesSearch =
        q.length === 0 ||
        item.title?.toLowerCase().includes(q) ||
        item.summary?.toLowerCase().includes(q) ||
        item.brand?.toLowerCase().includes(q);
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      return Boolean(matchesSearch && matchesCategory);
    });
  }, [articles, searchQuery, selectedCategory]);

  const trendingNews = useMemo(() => {
    return filteredNews.filter((item) => item.isNew || (item.rating !== undefined && Number(item.rating) >= 4));
  }, [filteredNews]);

  const reviewNews = useMemo(() => {
    return filteredNews.filter((item) => item.tags?.includes('review') || item.summary?.toLowerCase().includes('review'));
  }, [filteredNews]);

  const dealsNews = useMemo(() => {
    return filteredNews.filter((item) => item.tags?.includes('deal') || item.summary?.toLowerCase().includes('tilbud'));
  }, [filteredNews]);

  const handleReadMore = (article: GearNewsArticle) => {
    setSelectedArticle(article);
    setReadMoreOpen(true);
  };

  const renderArticles = (list: GearNewsArticle[]) => {
    if (list.length === 0) {
      return (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Article sx={{ fontSize: '4rem', color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Ingen nyheter funnet
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Prøv et annet søk eller en annen kategori.
          </Typography>
        </Box>
      );
    }

    return (
      <Grid container spacing={3}>
        {list.map((article, index) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={`${article.title ?? 'article'}-${index}`}>
            <Card sx={{ ...theming.getThemedCardSx(), height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardHeader
                title={
                  <Typography variant="h6" sx={{ fontSize: '1rem', lineHeight: 1.3 }}>
                    {article.title || 'Ny produktlansering'}
                  </Typography>
                }
                subheader={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                    <Chip label={article.category || 'Utstyr'} size="small" color="primary" />
                    {article.isNew && <Chip label="NY" size="small" color="error" />}
                  </Box>
                }
              />

              <CardContent sx={{ flexGrow: 1 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {article.summary || 'Oppdatering om nytt utstyr i markedet.'}
                </Typography>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    {article.brand || 'Ukjent merke'}
                  </Typography>
                  {article.rating && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Star sx={{ fontSize: '1rem', color: '#ffd700' }} />
                      <Typography variant="body2">{article.rating}</Typography>
                    </Box>
                  )}
                </Box>
              </CardContent>

              <CardActions sx={{ justifyContent: 'space-between' }}>
                <Button
                  size="small"
                  onClick={() => handleReadMore(article)}
                  sx={{ color: config.color, '&:hover': { bgcolor: `${config.color}15` } }}
                >
                  Les mer
                </Button>

                {article.url && (
                  <Button
                    size="small"
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    startIcon={<OpenInNew sx={{ fontSize: 16 }} />}
                    sx={{ color: 'text.secondary' }}
                  >
                    Kilde
                  </Button>
                )}
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    );
  };

  return (
    <Box className={className} sx={{ width: '100%' }}>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box
          sx={{
            p: 1,
            borderRadius: '50%',
            bgcolor: `${config.color}20`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {React.cloneElement(config.icon, { sx: { color: config.color, fontSize: '1.5rem' } })}
        </Box>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600, mb: 0.5 }}>
            {config.title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {config.description}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, sm: 8 }}>
            <TextField
              fullWidth
              placeholder="Søk etter utstyr, merker eller nyheter..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search color="action" />
                  </InputAdornment>
                ),
              }}
              size="small"
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Kategori</InputLabel>
              <Select
                value={selectedCategory}
                label="Kategori"
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <MenuItem value="all">Alle kategorier</MenuItem>
                {config.categories.map((category) => (
                  <MenuItem key={category} value={category}>
                    {category}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Box>

      <Card sx={theming.getThemedCardSx()}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} aria-label="gear news tabs">
            <Tab label="Siste nytt" />
            <Tab label="Trending" />
            <Tab label="Anmeldelser" />
            <Tab label="Tilbud" />
          </Tabs>
        </Box>

        <CustomTabPanel value={tabValue} index={0}>
          {isLoading ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CircularProgress size={26} />
            </Box>
          ) : (
            renderArticles(filteredNews)
          )}
        </CustomTabPanel>

        <CustomTabPanel value={tabValue} index={1}>
          {renderArticles(trendingNews)}
        </CustomTabPanel>

        <CustomTabPanel value={tabValue} index={2}>
          {renderArticles(reviewNews)}
        </CustomTabPanel>

        <CustomTabPanel value={tabValue} index={3}>
          {renderArticles(dealsNews)}
        </CustomTabPanel>
      </Card>

      <Dialog
        open={readMoreOpen}
        onClose={() => setReadMoreOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { bgcolor: 'background.paper', backgroundImage: 'none' } }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Typography variant="h6" sx={{ pr: 2 }}>
            {selectedArticle?.title}
          </Typography>
          <Button onClick={() => setReadMoreOpen(false)} sx={{ minWidth: 'auto', color: 'text.secondary' }}>
            <Close />
          </Button>
        </DialogTitle>

        <DialogContent sx={{ p: 3 }}>
          {selectedArticle && (
            <Box>
              <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                {selectedArticle.source && <Chip label={selectedArticle.source} size="small" color="primary" />}
                {selectedArticle.category && (
                  <Chip label={selectedArticle.category} size="small" variant="outlined" />
                )}
                {selectedArticle.norwegian_source && (
                  <Chip label="Norsk kilde" size="small" sx={{ bgcolor: '#2e7d30', color: 'white' }} />
                )}
                {selectedArticle.international_source && (
                  <Chip
                    label="Internasjonal kilde"
                    size="small"
                    sx={{ bgcolor: '#1976d0', color: 'white' }}
                  />
                )}
              </Box>

              <Typography variant="body1" sx={{ mb: 2, lineHeight: 1.6 }}>
                {selectedArticle.summary}
              </Typography>

              <Divider sx={{ my: 2 }} />

              <Typography variant="body1" sx={{ lineHeight: 1.7, whiteSpace: 'pre-line' }}>
                {selectedArticle.content || selectedArticle.summary}
              </Typography>

              {selectedArticle.published_date && (
                <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                  <Typography variant="body2" color="text.secondary">
                    Publisert:{' '}
                    {new Date(selectedArticle.published_date).toLocaleDateString('no-NO', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 3, pt: 1 }}>
          {selectedArticle?.url && (
            <Button
              href={selectedArticle.url}
              target="_blank"
              rel="noopener noreferrer"
              startIcon={<OpenInNew />}
              variant="outlined"
              sx={{ mr: 'auto' }}
            >
              Les hele artikkelen
            </Button>
          )}
          <Button onClick={() => setReadMoreOpen(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default GearNewsTab;
