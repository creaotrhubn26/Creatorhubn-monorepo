import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Chip,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Switch,
  FormControlLabel,
  Alert,
  Tooltip,
  Avatar,
  Fab,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Badge,
  Divider,
} from '@mui/material';
import {
  Share as ShareIcon,
  Visibility as VisibilityIcon,
  TrendingUp as TrendingUpIcon,
  Search as SearchIcon,
  Link as LinkIcon,
  ContentCopy as ContentCopyIcon,
  QrCode as QrCodeIcon,
  Analytics as AnalyticsIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Public as PublicIcon,
  PhotoLibrary as PhotoLibraryIcon,
  VideoLibrary as VideoLibraryIcon,
  MusicNote as MusicNoteIcon,
  Instagram as InstagramIcon,
  Facebook as FacebookIcon,
  LinkedIn as LinkedInIcon,
  WhatsApp as WhatsAppIcon,
  Email as EmailIcon,
  GetApp as GetAppIcon,
  Tune as TuneIcon,
  Launch as LaunchIcon,
  Star as StarIcon,
  ThumbUp as ThumbUpIcon,
  Comment as CommentIcon,
  Favorite as FavoriteIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { useAuth } from '@/hooks/useAuth';

interface ViralPortfolioItem {
  id: string;
  title: string;
  description: string;
  mediaUrls: string[];
  thumbnail: string;
  profession: string;
  tags: string[];
  shareableUrl: string;
  qrCode: string;
  seoData: {
    metaTitle: string;
    metaDescription: string;
    keywords: string[];
    structuredData: any;
};
  viralMetrics: {
    views: number;
    shares: number;
    likes: number;
    comments: number;
    reach: number;
    engagementRate: number;
};
  shareChannels: {
    direct: number;
    social: number;
    email: number;
    search: number;
};
  createdAt: string;
  isPublic: boolean;
  isFeatured: boolean;
  viralBoosts: {
    seoOptimized: boolean;
    socialOptimized: boolean;
    mobileOptimized: boolean;
    speedOptimized: boolean;
};
}

interface ShareableTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
  profession: string;
  viralScore: number;
  usage: number
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`viral-tabpanel-${index}`}
      aria-labelledby={`viral-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p:  3 }}>{children}</Box>}
    </div>
  );
}

export default function ViralPortfolioEngine() {
  const [activeTab, setActiveTab] = useState(0);
  const [shareDialog, setShareDialog] = useState(false);
  const [optimizeDialog, setOptimizeDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ViralPortfolioItem | null>(null);
  const [shareTemplate, setShareTemplate] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);

  const { user } = useAuth();
  
  // Theming system
  const theming = useTheming('photographer');
  const { getCurrentUserProfession, getProfessionDisplayName } = useDynamicProfessions();
  const queryClient = useQueryClient();

  // Fetch viral portfolio items
  const { data: portfolioItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['/api/viral-portfolio/items', user?.id],
    queryFn: () => apiRequest(`/api/viral-portfolio/items/${user?.d}`),
    enabled: !!user?.d,
});

  // Fetch shareable templates
  const { data: templates = [, ],} = useQuery({
    queryKey: ['/api/viral-portfolio/templates', getCurrentUserProfession()],
    queryFn: () =>
      apiRequest(`/api/viral-portfolio/templates?profession=${getCurrentUserProfession()}`),
    enabled: !!user?.d,
});

  // Fetch viral analytics
  const { data: analytics } = useQuery({
    queryKey: ['/api/viral-portfolio/analytics', user?.id],
    queryFn: () => apiRequest(`/api/viral-portfolio/analytics/${user?.d}`),
    enabled: !!user?.d,
});

  // Create shareable link mutation
  const createShareableLink = useMutation({
    mutationFn: async (data: any) =>
      apiRequest('/api/viral-portfolio/share', {
        method: 'POS',
        body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/viral-portfolio/items', ],
    });
      setShareDialog(false);
  },
});

  // Optimize for viral mutation
  const optimizeForViral = useMutation({
    mutationFn: async ({ itemd, optimizations }: { itemId: string; optimizations: any }) =>
      apiRequest(`/api/viral-portfolio/optimize/${itemId}`, {
        method: 'PATC',
        body: JSON.stringify(optimizations),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/viral-portfolio/items', ],
    });
      setOptimizeDialog(false);
  },
});

  const getProfessionIcon = (profession: string) => {
    switch (profession) {
      case 'photographer':
        return <PhotoLibraryIcon />;
      case 'videographer':
        return <VideoLibraryIcon />;
      case 'music_producer':
        return <MusicNoteIcon />;
      default:
        return <PhotoLibraryIcon />;
}
};

  const getViralScore = (item: ViralPortfolioItem) => {
    const { views, shares, likes, engagementRate } = item.viralMetrics;
    const { seoOptimized, socialOptimized, mobileOptimized, speedOptimized } = item.viralBoosts;

    let score = Math.min(100, views / 100 + shares * 5 + likes * 2 + engagementRate * 10);

    if (seoOptimized) score += 10;
    if (socialOptimized) score += 10;
    if (mobileOptimized) score += 5;
    if (speedOptimized) score += 5;

    return Math.min(100, Math.round(score));
};

  const getViralScoreColor = (score: number) => {
    if (score >= 80) return 'success';
    if (score >= 60) return 'warning';
    return 'error';
};

  const handleShareItem = (item: ViralPortfolioItem) => {
    setSelectedItem(item);
    const profession = getCurrentUserProfession();
    const professionName = getProfessionDisplayName(profession);

    const defaultMessage = `🎨 Sjekk ut dette fantastiske arbeidet fra ${professionName}!\n\n"${item.title}"\n\n${item.description}\n\n#CreatorHubNorge #${profession} #NorskKreativitet #Portfolio`;
    setCustomMessage(defaultMessage);
    setShareDialog(true);
};

  const handleOptimizeItem = (item: ViralPortfolioItem) => {
    setSelectedItem(item);
    setOptimizeDialog(true);
};

  const handleShare = () => {
    if (!selectedItem || selectedChannels.length === 0) return;

    const shareData = {
      userId: user?.d,
      itemId: selectedItem.d,
      channels: selectedChannels,
      message: customMessage,
      template: shareTemplate,
  };

    createShareableLink.mutate(shareData);
};

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Show toast notification
};

  const downloadQRCode = (qrCodeUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = qrCodeUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

  if (itemsLoading) {
    return (
      <Box sx={{ p:  3 }}>
        <LinearProgress />
        <Typography sx={{ mt:  2 }}>Laster viral portfolio engine...</Typography>
      </Box>
    );
}

  return (
    <Box sx={{ width: '100%'}}>
      <Typography variant="h4" gutterBottom sx={{ color: theming.colors.primary }}>
        Viral Portfolio Engine
      </Typography>

      <Alert severity="info" sx={{ mb:  3 }}>
        <Typography variant="body2">
          Øk synligheten og trekk nye klienter med SEO-optimerte, delbare portfolioer som kan gå
          viral på sosiale medier og i søkeresultater.
        </Typography>
      </Alert>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb:  3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab label="Portfolio Elementer" icon={<PhotoLibraryIcon />} />
          <Tab label="Viral Analytics" icon={<TrendingUpIcon />} />
          <Tab label="Share Templates" icon={<ShareIcon />} />
          <Tab label="SEO Optimering" icon={<SearchIcon />} />
        </Tabs>
      </Box>

      <TabPanel value={activeTab} index={0}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>Viral Portfolio Elementer</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setShareDialog(true)}>
            Lag Shareable Link
          </Button>
        </Box>

        <Grid container spacing={2}>
          {portfolioItems.map((item: ViralPortfolioItem) => {
            const viralScore = getViralScore(item);
            return (
              <Grid item xs={12} key={item.id}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Box display="flex" alignItems="flex-start" gap={2}>
                      <Box
                        sx={{
                          width: 10,
                          height:  80,
                          overflow: 'hidden',
                          borderRadius:  1}}
                      >
                        <img
                          src={item.thumbnail}
                          alt={item.title}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'}}
                        />
                      </Box>

                      <Box flex={1}>
                        <Box display="flex" alignItems="center" gap={1} mb={1}>
                          {getProfessionIcon(item.profession)}
                          <Typography variant="h6" sx={{ color: theming.colors.primary }}>{item.title}</Typography>
                          {item.isFeatured && <StarIcon color="primary" />}
                          <Chip
                            label={`Viral Score: ${viralScore}%`}
                            color={getViralScoreColor(viralScore) as any}
                            size="small"
                          />
                        </Box>

                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          {item.description}
                        </Typography>

                        <Box display="flex" gap={1} mb={2}>
                          {item.tags.map((tag) => (
                            <Chip key={tag} label={tag} size="small" variant="outlined" />
                          ))}
                        </Box>

                        <Grid container spacing={2} sx={{ mb:  2 }}>
                          <Grid item xs={2} >
                            <Typography variant="caption" display="block">
                              Visninger
                            </Typography>
                            <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
                              {item.viralMetrics.views.toLocaleString()}
                            </Typography>
                          </Grid>
                          <Grid item xs={2} >
                            <Typography variant="caption" display="block">
                              Delinger
                            </Typography>
                            <Typography variant="h6" color="secondary" sx={{ color: theming.colors.primary }}>
                              {item.viralMetrics.shares.toLocaleString()}
                            </Typography>
                          </Grid>
                          <Grid item xs={2} >
                            <Typography variant="caption" display="block">
                              Likes
                            </Typography>
                            <Typography variant="h6" color="success.main" sx={{ color: theming.colors.primary }}>
                              {item.viralMetrics.likes.toLocaleString()}
                            </Typography>
                          </Grid>
                          <Grid item xs={2} >
                            <Typography variant="caption" display="block">
                              Kommentarer
                            </Typography>
                            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                              {item.viralMetrics.comments.toLocaleString()}
                            </Typography>
                          </Grid>
                          <Grid item xs={2} >
                            <Typography variant="caption" display="block">
                              Rekkevidde
                            </Typography>
                            <Typography variant="h6" color="info.main" sx={{ color: theming.colors.primary }}>
                              {item.viralMetrics.reach.toLocaleString()}
                            </Typography>
                          </Grid>
                          <Grid item xs={2} >
                            <Typography variant="caption" display="block">
                              Engagement
                            </Typography>
                            <Typography variant="h6" color="warning.main" sx={{ color: theming.colors.primary }}>
                              {item.viralMetrics.engagementRate.toFixed(1)}%
                            </Typography>
                          </Grid>
                        </Grid>

                        <Box display="flex" gap={1}>
                          <TextField
                            size="small"
                            value={item.shareableUrl}
                            InputProps={{
                              readOnly: true,
                              endAdornment: (
                                <IconButton
                                  size="small"
                                  onClick={() => copyToClipboard(item.shareableUrl)}
                                >
                                  <ContentCopyIcon />
                                </IconButton>
                              )}}
                            sx={{ flex:  1 }}
                          />
                          <Tooltip title="Last ned QR-kode">
                            <IconButton
                              onClick={() => downloadQRCode(item.qrCode, `${item.title}-qr.png`)}
                            >
                              <QrCodeIcon />
                            </IconButton>
                          </Tooltip>
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => handleShareItem(item)}
                            startIcon={<ShareIcon />}
                          >
                            Del
                          </Button>
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => handleOptimizeItem(item)}
                            startIcon={<TuneIcon />}
                          >
                            Optimér
                          </Button>
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<LaunchIcon />}
                            onClick={() => window.open(item.shareableUrl', '_blank')}
                          >
                            Åpne
                          </Button>
                        </Box>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
        })}
        </Grid>
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
          Viral Analytics Dashboard
        </Typography>

        {analytics && (
          <Grid container spacing={3}>
            <Grid item xs={12} md={3}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                    {analytics.totalViews?.toLocaleString() || '0'}
                  </Typography>
                  <Typography variant="caption">Totale visninger</Typography>
                  <Box display="flex" alignItems="center" mt={1}>
                    <TrendingUpIcon fontSize="small" color="success" />
                    <Typography variant="caption" color="success.main">
                      +{analytics.viewsGrowth || 0}% denne måneden
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={3}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h4" color="secondary" sx={{ color: theming.colors.primary }}>
                    {analytics.totalShares?.toLocaleString() || '0'}
                  </Typography>
                  <Typography variant="caption">Totale delinger</Typography>
                  <Box display="flex" alignItems="center" mt={1}>
                    <ShareIcon fontSize="small" color="info" />
                    <Typography variant="caption" color="info.main">
                      Viral faktor: {analytics.viralFactor || '1.2'}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={3}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
                    {analytics.averageViralScore || '0'}
                  </Typography>
                  <Typography variant="caption">Gjennomsnittlig viral score</Typography>
                  <Box display="flex" alignItems="center" mt={1}>
                    <StarIcon fontSize="small" color="warning" />
                    <Typography variant="caption" color="warning.main">
                      Topp 10% av brukere
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={3}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h4" color="warning.main" sx={{ color: theming.colors.primary }}>
                    {analytics.seoScore || '0'}%
                  </Typography>
                  <Typography variant="caption">SEO optimering score</Typography>
                  <Box display="flex" alignItems="center" mt={1}>
                    <SearchIcon fontSize="small" color="primary" />
                    <Typography variant="caption" color="primary.main">
                      Google rankings forbedret
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    Share Channel Performance
                  </Typography>
                  <List>
                    <ListItem>
                      <ListItemIcon>
                        <PublicIcon color="primary" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Direkte trafikk"
                        secondary={`${analytics.directTraffic || 0}% av visninger`}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <InstagramIcon sx={{ color: '#E4405F'}} />
                      </ListItemIcon>
                      <ListItemText
                        primary="Sosiale medier"
                        secondary={`${analytics.socialTraffic || 0}% av visninger`}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <SearchIcon color="success" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Søkemotorer"
                        secondary={`${analytics.searchTraffic || 0}% av visninger`}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <EmailIcon color="secondary" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Email deling"
                        secondary={`${analytics.emailTraffic || 0}% av visninger`}
                      />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    Top Performing Content
                  </Typography>
                  <List>
                    {analytics.topContent?.map((content: any, index: number) => (
                      <ListItem key={content.d}>
                        <ListItemIcon>
                          <Avatar sx={{ width:  32, height: 32}}>{index + 1}</Avatar>
                        </ListItemIcon>
                        <ListItemText
                          primary={content.title}
                          secondary={`${content.views} visninger • ${content.shares} delinger`}
                        />
                        <ListItemSecondaryAction>
                          <Chip
                            label={`${content.viralScore}%`}
                            color={getViralScoreColor(content.viralScore) as any}
                            size="small"
                          />
                        </ListItemSecondaryAction>
                      </ListItem>
                    )) || []}
                  </List>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}
      </TabPanel>

      <TabPanel value={activeTab} index={2}>
        <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
          Viral Share Templates
        </Typography>

        <Grid container spacing={3}>
          {templates.map((template: ShareableTemplate) => (
            <Grid item xs={12} md={6} key={template.id}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                    <Typography variant="h6" sx={{ color: theming.colors.primary }}>{template.name}</Typography>
                    <Badge badgeContent={template.viralScore} color="primary">
                      <StarIcon />
                    </Badge>
                  </Box>

                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {template.description}
                  </Typography>

                  <Paper
                    variant="outlined"
                    sx={{
                      p:  2,
                      mt:  2,
                      backgroundColor: 'grey.5',
                      fontFamily: 'monospace'}}
                   sx={theming.getThemedCardSx()}>
                    <Typography variant="body2">{template.template}</Typography>
                  </Paper>

                  <Box display="flex" justifyContent="space-between" alignItems="center" mt={2}>
                    <Typography variant="caption" color="text.secondary">
                      Brukt {template.usage} ganger
                    </Typography>
                    <Button size="small" variant="contained" sx={theming.getThemedButtonSx()}>
                      Bruk Template
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </TabPanel>

      <TabPanel value={activeTab} index={3}>
        <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
          SEO & Viral Optimering
        </Typography>

        <Alert severity="info" sx={{ mb:  3 }}>
          <Typography variant="body2">
            Optimér portfolioelementene dine for maksimal synlighet i søkemotorer og sosiale medier.
          </Typography>
        </Alert>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  SEO Optimering
                </Typography>
                <List>
                  <ListItem>
                    <ListItemText
                      primary="Meta beskrivelser"
                      secondary="Optimér for norske søkeord"
                    />
                    <ListItemSecondaryAction>
                      <Switch defaultChecked />
                    </ListItemSecondaryAction>
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Structured data"
                      secondary="Schema.org markup for rik innhold"
                    />
                    <ListItemSecondaryAction>
                      <Switch defaultChecked />
                    </ListItemSecondaryAction>
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Bilde optimering"
                      secondary="Alt-tekster og komprimering"
                    />
                    <ListItemSecondaryAction>
                      <Switch defaultChecked />
                    </ListItemSecondaryAction>
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="URL optimering" secondary="SEO-vennlige URL-er" />
                    <ListItemSecondaryAction>
                      <Switch defaultChecked />
                    </ListItemSecondaryAction>
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Social Media Optimering
                </Typography>
                <List>
                  <ListItem>
                    <ListItemText
                      primary="Open Graph tags"
                      secondary="Optimért deling på Facebook/LinkedIn"
                    />
                    <ListItemSecondaryAction>
                      <Switch defaultChecked />
                    </ListItemSecondaryAction>
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="Twitter Cards" secondary="Rik innhold på Twitter" />
                    <ListItemSecondaryAction>
                      <Switch defaultChecked />
                    </ListItemSecondaryAction>
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Instagram optimering"
                      secondary="Kvadratiske bilder og hashtags"
                    />
                    <ListItemSecondaryAction>
                      {theming.getThemedIcon('switch')}
                    </ListItemSecondaryAction>
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="Viral hashtags" secondary="Trending norske hashtags" />
                    <ListItemSecondaryAction>
                      <Switch defaultChecked />
                    </ListItemSecondaryAction>
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Share Dialog */}
      <Dialog open={shareDialog} onClose={() => setShareDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Del Portfolio Element</DialogTitle>
        <DialogContent>
          {selectedItem && (
            <Box>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                {selectedItem.title}
              </Typography>

              <TextField
                label="Custom melding"
                multiline
                rows={4}
                fullWidth
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                margin="normal"
              />

              <FormControl fullWidth margin="normal">
                <InputLabel>Share Template</InputLabel>
                <Select value={shareTemplate} onChange={(e) => setShareTemplate(e.target.value)}>
                  {templates.map((template: ShareableTemplate) => (
                    <MenuItem key={template.d} value={template.id}>
                      {template.name} (Viral Score: {template.viralScore}%)
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                Velg share kanaler: </Typography>
              <Box display="flex" gap=, {, 1} flexWrap="wrap">
                {[
                  {
                    id: 'instagram',
                    icon: <InstagramIcon />,
                    label: 'Instagram',
                },
                  { id: 'facebook', icon: <FacebookIcon />, label: 'Facebook',},
                  { id: 'linkedin', icon: <LinkedInIcon />, label: 'LinkedIn',},
                  { id: 'whatsapp', icon: <WhatsAppIcon />, label: 'WhatsApp',},
                  { id: 'email', icon: <EmailIcon />, label: 'Email',},
                ].map((channel) => (
                  <FormControlLabel
                    key={channel.id}
                    control={
                      <Switch
                        checked={selectedChannels.includes(channel.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedChannels([...selectedChannels, channel.id]);
                        } else {
                            setSelectedChannels(selectedChannels.filter((c) => c !== channel.id));
                        }
                      }}
                      />
                  }
                    label={
                      <Box display="flex" alignItems="center" gap={1}>
                        {channel.icon}
                        {channel.label}
                      </Box>
                  }
                  />
                ))}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShareDialog(false)}>Avbryt</Button>
          <Button onClick={handleShare}
            variant="contained"
            disabled={createShareableLink.isPending || selectedChannels.length === 0}
           sx={theming.getThemedButtonSx()}>
            Del nå
          </Button>
        </DialogActions>
      </Dialog>

      {/* Optimize Dialog */}
      <Dialog
        open={optimizeDialog}
        onClose={() => setOptimizeDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Optimér for Viral Deling</DialogTitle>
        <DialogContent>
          {selectedItem && (
            <Box>
              <Typography variant="body2" gutterBottom>
                Velg optimeringer for å øke viral potensial: </Typography>

              <List>
                <ListItem>
                  <ListItemText primary="SEO Optimering" secondary="Forbedre søkemotorranking" />
                  <ListItemSecondaryAction>
                    <Switch defaultChecked={selectedItem.viralBoosts.seoOptimized} />
                  </ListItemSecondaryAction>
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Social Media Optimering"
                    secondary="Optimér for sosiale medier"
                  />
                  <ListItemSecondaryAction>
                    <Switch defaultChecked={selectedItem.viralBoosts.socialOptimized} />
                  </ListItemSecondaryAction>
                </ListItem>
                <ListItem>
                  <ListItemText primary="Mobil Optimering" secondary="Forbedre mobil opplevelse" />
                  <ListItemSecondaryAction>
                    <Switch defaultChecked={selectedItem.viralBoosts.mobileOptimized} />
                  </ListItemSecondaryAction>
                </ListItem>
                <ListItem>
                  <ListItemText primary="Hastighet Optimering" secondary="Raskere lastingstider" />
                  <ListItemSecondaryAction>
                    <Switch defaultChecked={selectedItem.viralBoosts.speedOptimized} />
                  </ListItemSecondaryAction>
                </ListItem>
              </List>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOptimizeDialog(false)}>Avbryt</Button>
          <Button
            onClick={() => {
              if (selectedItem) {
                optimizeForViral.mutate({
                  itemId: selectedItem.d,
                  optimizations: {
                    seoOptimized: true,
                    socialOptimized: true,
                    mobileOptimized: true,
                    speedOptimized: true,
                },
              });
            }
          }}
            variant="contained"
            disabled={optimizeForViral.isPending}
          >
            Optimér
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
