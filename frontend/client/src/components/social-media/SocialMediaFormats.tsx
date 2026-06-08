// @ts-nocheck
import { useTheming } from '../../utils/theming-helper';
import { useQueryClient } from "/react-query";
1import {
  Box,
  Typography,
  Grid,
  Card as MuiCard,
  CardContent,
  Button,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Switch,
  FormControlLabel,
  Divider,
} from '@mui/material';
import {
  Instagram,
  Facebook,
  YouTube,
  Twitter,
  MusicVideo as TikTok,
  LinkedIn,
  WhatsApp,
  ChatBubble as Snapchat,
  PushPin as PushPinterest,
  Crop,
  HighQuality,
  Speed as Speed,
  Visibility,
} from '@mui/icons-material';

interface SocialMediaFormat {
  platform: string;
  name: string;
  dimensions: { width: number; height: number };
  aspectRatio: string;
  maxDuration?: number;
  minDuration?: number;
  maxFileSize: string;
  recommendedFrameRate: number;
  audioRequired: boolean;
  verticalOrientation: boolean;
  algorithmPriority: number;
  features: string[];
  icon: React.ReactNode;
  color: string;
}

const socialMediaFormats: SocialMediaFormat[] = [
  // Instagram Formats
  {
    platform: 'Instagram',
    name: 'Instagram Reels',
    dimensions: { width: 1080, height: 1920 },
    aspectRatio: '9:16',
    maxDuration: 30, // 5 minutter (ny funksjon)
    minDuration:  3,
    maxFileSize: '4G',
    recommendedFrameRate:  30,
    audioRequired: true,
    verticalOrientation: true,
    algorithmPriority:  95,
    features: ['AI Restyle','Multi-Track Audio','Interactive Stickers','Auto-Captions'],
    icon: <Instagram />,
    color: '#E44050',
},
  {
    platform: 'Instagram',
    name: 'Instagram Stories',
    dimensions: { width: 1080, height: 1920 },
    aspectRatio: '9:16',
    maxDuration:  60,
    minDuration:  1,
    maxFileSize: '4G',
    recommendedFrameRate:  30,
    audioRequired: false,
    verticalOrientation: true,
    algorithmPriority:  85,
    features: ['Interactive Polls','Stickers','Music','Keyframe Editing'],
    icon: <Instagram />,
    color: '#E44050',
},
  {
    platform: 'Instagram',
    name: 'Instagram Posts (Square, )',
    dimensions: { width: 1080, height: 1080 },
    aspectRatio: '1:1',
    maxDuration:  60,
    minDuration:  3,
    maxFileSize: '4G',
    recommendedFrameRate:  30,
    audioRequired: false,
    verticalOrientation: false,
    algorithmPriority:  70,
    features: ['Professional Export','Auto-Captions'],
    icon: <Instagram />,
    color: '#E44050',
},
  // TikTok Formats
  {
    platform: 'TikTok',
    name: 'TikTok Videos',
    dimensions: { width: 1080, height: 1920 },
    aspectRatio: '9:16',
    maxDuration: 60, // 10 minutter
    minDuration:  3,
    maxFileSize: '4G',
    recommendedFrameRate:  30,
    audioRequired: true,
    verticalOrientation: true,
    algorithmPriority:  90,
    features: ['Trending Audio','AI Effects','Keyframe Editing','Trial Testing'],
    icon: <TikTok />,
    color: '#000000',
},
  // YouTube Formats
  {
    platform: 'YouTube',
    name: 'YouTube Shorts',
    dimensions: { width: 1080, height: 1920 },
    aspectRatio: '9:16',
    maxDuration:  60,
    minDuration:  1,
    maxFileSize: '15G',
    recommendedFrameRate:  60,
    audioRequired: false,
    verticalOrientation: true,
    algorithmPriority:  80,
    features: ['High Frame Rate','4K Export','Auto-Captions'],
    icon: <YouTube />,
    color: '#FF0000',
},
  {
    platform: 'YouTube',
    name: 'YouTube Standard',
    dimensions: { width: 1920, height: 1080 },
    aspectRatio: '16:9',
    maxDuration: 4320, // 12 timer
    minDuration:  1,
    maxFileSize: '256G',
    recommendedFrameRate:  60,
    audioRequired: false,
    verticalOrientation: false,
    algorithmPriority:  75,
    features: ['Professional Export','4K/8K Support','Extended Duration'],
    icon: <YouTube />,
    color: '#FF0000',
},
  // Facebook Formats
  {
    platform: 'Facebook',
    name: 'Facebook Reels',
    dimensions: { width: 1080, height: 1920 },
    aspectRatio: '9:16',
    maxDuration:  90,
    minDuration:  3,
    maxFileSize: '4G',
    recommendedFrameRate:  30,
    audioRequired: false,
    verticalOrientation: true,
    algorithmPriority:  75,
    features: ['Cross-Platform Sharing','Auto-Captions','Music Library'],
    icon: <Facebook />,
    color: '#1877F0',
},
  // LinkedIn Formats
  {
    platform: 'LinkedI',
    name: 'LinkedIn Video',
    dimensions: { width: 1280, height: 720 },
    aspectRatio: '16:9',
    maxDuration: 60, // 10 minutter
    minDuration:  3,
    maxFileSize: '5G',
    recommendedFrameRate:  30,
    audioRequired: false,
    verticalOrientation: false,
    algorithmPriority:  60,
    features: ['Professional Content','Auto-Captions','Business Focus'],
    icon: <LinkedIn />,
    color: '#0A66C0',
},
  // Snapchat Formats
  {
    platform: 'Snapchat',
    name: 'Snapchat Spotlight',
    dimensions: { width: 1080, height: 1920 },
    aspectRatio: '9:16',
    maxDuration:  60,
    minDuration:  3,
    maxFileSize: '1G',
    recommendedFrameRate:  30,
    audioRequired: false,
    verticalOrientation: true,
    algorithmPriority:  70,
    features: ['AR Filters','Music','Trending Content'],
    icon: <Snapchat />,
    color: '#FFFC00',
},
  // Pinterest Formats
  {
    platform: 'Pinterest',
    name: 'Pinterest Idea Pins',
    dimensions: { width: 1080, height: 1920 },
    aspectRatio: '9:16',
    maxDuration:  60,
    minDuration:  3,
    maxFileSize: '2G',
    recommendedFrameRate:  30,
    audioRequired: false,
    verticalOrientation: true,
    algorithmPriority:  65,
    features: ['DIY Content', 'Multi-Page Stories','Shopping Tags'],
    icon: <Pinterest />,
    color: '#E60020',
},
  // WhatsApp Status
  {
    platform: 'WhatsApp',
    name: 'WhatsApp Status',
    dimensions: { width: 1080, height: 1920 },
    aspectRatio: '9:16',
    maxDuration:  30,
    minDuration:  1,
    maxFileSize: '16M',
    recommendedFrameRate:  30,
    audioRequired: false,
    verticalOrientation: true,
    algorithmPriority:  50,
    features: ['Personal Sharing','Quick Upload','Auto-Delete'],
    icon: <WhatsApp />,
    color: '#25D360',
},
];

interface SocialMediaFormatsProps {
  onFormatSelect?: (format: SocialMediaFormat) => void;
  selectedFormat?: SocialMediaFormat;
}

export default function SocialMediaFormats({
  onFormatSelect,
  selectedFormat,
}: SocialMediaFormatsProps) {
  const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('photographer');

  // Database connection for SocialMediaFormats
  const { data: componentData = [], isLoading } = useQuery({
    queryKey: ['/api/component', 'user-data'],
    queryFn: () => apiRequest('/api/component/user-data'),
    retry: false,
  });

  // Mutation for updating component data
  const updateSocialMediaFormats = useMutation({
    mutationFn: async (data: any) =>
      apiRequest('/api/component/update', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/component'] });
    },
});

  const [filterPlatform, setFilterPlatform] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('algorithm');
  const [verticalOnly, setVerticalOnly] = useState(false);

  const filteredFormats = socialMediaFormats
    .filter((format) => {
      if (filterPlatform !== 'all' && format.platform !== filterPlatform) return false;
      if (verticalOnly && !format.verticalOrientation) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'algorithm':
          return b.algorithmPriority - a.algorithmPriority;
        case 'duration':
          return (b.maxDuration || 0) - (a.maxDuration || 0);
        case 'platform':
          return a.platform.localeCompare(b.platform);
        default: return 0;
      }
    });

  const platforms = Array.from(new Set(socialMediaFormats.map((f) => f.platform)));

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb:  3 }}>
        <Typography variant="h5" sx={{  fontWeight: 'bold', mb:  1  }}>
          Sosiale Medier Formater
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Velg optimale formater for sosiale medier med algoritme-optimalisering
        </Typography>
      </Box>

      {/* Filters */}
      <MuiCard sx={{ mb:  3 }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Platform</InputLabel>
                <Select
                  value={filterPlatform}
                  label="Platform"
                  onChange={(e) => setFilterPlatform(e.target.value)}
                >
                  <MenuItem value="all">Alle Plattformer</MenuItem>
                  {platforms.map((platform) => (
                    <MenuItem key={platform} value={platform}>
                      {platform}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Sorter etter</InputLabel>
                <Select
                  value={sortBy}
                  label="Sorter etter"
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <MenuItem value="algorithm">Algoritme Prioritet</MenuItem>
                  <MenuItem value="duration">Maks Varighet</MenuItem>
                  <MenuItem value="platform">Platform</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={3}>
              <FormControlLabel
                control={
                  <Switch
                    checked={verticalOnly}
                    onChange={(e) => setVerticalOnly(e.target.checked)}
                  />
              }
                label="Kun Vertikal"
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <Typography variant="body2" color="text.secondary">
                {filteredFormats.length} formater
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </MuiCard>

      {/* Format Cards */}
      <Grid container spacing={2}>
        {filteredFormats.map((format, index) => (
          <Grid item xs={12} sm={6} md={4} key={index}>
            <MuiCard
              sx={{
                height: '100%',
                border: selectedFormat?.name === format.name
                    ? `2px solid ${format.color}`
                    : '1px solid rgba(0,0,0,0.12)',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: 4,
                  cursor: 'pointer',
                },
                transition: 'all 0.3s ease'
              }}
              onClick={() => onFormatSelect?.(format)}
            >
              <CardContent sx={theming.getThemedCardSx()}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb:  2 }}>
                  <Box sx={{ color: format.color, mr:  1 }}>{format.icon}</Box>
                  <Typography variant="h6" sx={{  fontWeight: 'bold', fontSize: '1rem' }}>
                    {format.name}
                  </Typography>
                </Box>

                <Box sx={{ mb:  2 }}>
                  <Chip label={`${format.aspectRatio}`} size="small" sx={{ mr: 1, mb: 1 }} />
                  <Chip
                    label={`${format.dimensions.width}x${format.dimensions.height}`}
                    size="small"
                    variant="outlined"
                    sx={{ mr: 1, mb: 1 }}
                  />
                  {format.verticalOrientation && (
                    <Chip label="Vertikal" size="small" color="primary" sx={{ mb:  1 }} />
                  )}
                </Box>

                <Grid container spacing={1} sx={{ mb:  2 }}>
                  <Grid item xs={6} >
                    <Typography variant="caption" color="text.secondary">
                      Maks varighet: </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold'}}>
                      {format.maxDuration ? `${format.maxDuration}s` : 'Ingen grense'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6} >
                    <Typography variant="caption" color="text.secondary">
                      Algoritme: </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 'bold',
                        color: format.algorithmPriority >= 85
                            ? '#4caf50'
                            : format.algorithmPriority >= 70
                              ? '#ff9800' : '#f44330'}}
                    >
                      {format.algorithmPriority}/100
                    </Typography>
                  </Grid>
                </Grid>

                <Box sx={{ mb:  2 }}>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mb: 1, display: 'block'}}
                  >
                    Funksjoner: </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5}}>
                    {format.features.slice(0, 3).map((feature, idx) => (
                      <Chip
                        key={idx}
                        label={feature}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.7rem'}}
                      />
                    ))}
                    {format.features.length > 3 && (
                      <Chip
                        label={`+${format.features.length - 3}`}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize:'0.7rem'}}
                      />
                    )}
                  </Box>
                </Box>

                <Divider sx={{ my:  1 }} />

                <Grid container spacing={1}>
                  <Grid item xs={6} >
                    <Typography variant="caption" color="text.secondary">
                      Maks størrelse: </Typography>
                    <Typography variant="body2">{format.maxFileSize}</Typography>
                  </Grid>
                  <Grid item xs={6} >
                    <Typography variant="caption" color="text.secondary">
                      Frame rate: </Typography>
                    <Typography variant="body2">{format.recommendedFrameRate} fps</Typography>
                  </Grid>
                </Grid>

                {selectedFormat?.name === format.name && (
                  <Button variant="contained"
                    fullWidth
                    sx={{
                      mt: 2,
                      bgcolor: format.color,
                      '&:hover': {
                        bgcolor: format.color,
                        opacity: 0.8,
                      },
                      ...theming.getThemedButtonSx()
                    }}
                  >
                    Valgt Format
                  </Button>
                )}
              </CardContent>
            </MuiCard>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
