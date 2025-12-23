/**
 * Social Media Manager
 * Manage and publish content across Instagram, Facebook, Snapchat, YouTube, and TikTok
 */

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  TextField,
  Tab,
  Tabs,
  IconButton,
  Chip,
  Alert,
  LinearProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Divider,
  Avatar,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Instagram as InstagramIcon,
  Facebook as FacebookIcon,
  YouTube as YouTubeIcon,
  TrendingUp as TikTokIcon,
  CameraAlt as SnapchatIcon,
  Upload as UploadIcon,
  Send as SendIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Visibility as PreviewIcon,
  CalendarMonth as CalendarIcon,
  Campaign as CampaignIcon,
} from '@mui/icons-material';

interface SocialPost {
  id?: string;
  platform: 'instagram' | 'facebook' | 'snapchat' | 'youtube' | 'tiktok';
  content: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  scheduledFor?: string;
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  publishedAt?: string;
  engagement?: {
    likes: number;
    comments: number;
    shares: number;
    views: number;
  };
  hashtags?: string[];
  mentionedUsers?: string[];
  location?: string;
  // YouTube specific
  youtubeTitle?: string;
  youtubeDescription?: string;
  youtubeTags?: string[];
  youtubePrivacy?: 'public' | 'unlisted' | 'private';
  // Marketing Automation
  workflowId?: string;
  campaignId?: string;
  autoTrigger?: boolean;
}

const platformConfig = {
  instagram: {
    name: 'Instagram',
    icon: InstagramIcon,
    color: '#E4405F',
    maxLength: 2200,
    supportsVideo: true,
    supportsImage: true,
    maxVideoSize: 100, // MB
  },
  facebook: {
    name: 'Facebook',
    icon: FacebookIcon,
    color: '#1877F2',
    maxLength: 63206,
    supportsVideo: true,
    supportsImage: true,
    maxVideoSize: 1024, // MB
  },
  snapchat: {
    name: 'Snapchat',
    icon: SnapchatIcon,
    color: '#FFFC00',
    maxLength: 250,
    supportsVideo: true,
    supportsImage: true,
    maxVideoSize: 32, // MB
  },
  youtube: {
    name: 'YouTube',
    icon: YouTubeIcon,
    color: '#FF0000',
    maxLength: 5000, // description
    supportsVideo: true,
    supportsImage: false,
    maxVideoSize: 256000, // MB (256 GB)
  },
  tiktok: {
    name: 'TikTok',
    icon: TikTokIcon,
    color: '#000000',
    maxLength: 2200,
    supportsVideo: true,
    supportsImage: false,
    maxVideoSize: 287, // MB
  },
};

export default function SocialMediaManager() {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['instagram']);
  const [postForm, setPostForm] = useState<Partial<SocialPost>>({
    content: '',
    status: 'draft',
    hashtags: [],
    youtubePrivacy: 'public',
    autoTrigger: false,
  });
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedMediaUrl, setUploadedMediaUrl] = useState('');
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);

  const queryClient = useQueryClient();

  // Fetch social media posts
  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['/api/social-media/posts, '],
    queryFn: async () => {
      const response = await fetch('/api/social-media/posts');
      if (!response.ok) throw new Error('Failed to fetch posts');
      return response.json();
    },
  });

  // Upload media mutation (YouTube, Instagram, etc.)
  const uploadMediaMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('platforms', JSON.stringify(selectedPlatforms));

      // YouTube specific fields
      if (selectedPlatforms.includes('youtube')) {
        formData.append('youtubeTitle', postForm.youtubeTitle || 'CreatorHub Content');
        formData.append('youtubeDescription', postForm.youtubeDescription || postForm.content || ', ');
        formData.append('youtubeTags', JSON.stringify(postForm.youtubeTags || postForm.hashtags || []));
        formData.append('youtubePrivacy', postForm.youtubePrivacy || 'public');
        formData.append('websiteUrl','https://creatorhubn.com');
        formData.append('instagramHandle','https://instagram.com/creatorhubn');
      }

      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100);
            setUploadProgress(progress);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } else {
            reject(new Error('Upload failed'));
          }
          setIsUploading(false);
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed'));
          setIsUploading(false);
        });

        // Determine endpoint based on media type
        const isVideo = file.type.startsWith('video/');
        const endpoint = isVideo ? '/api/youtube/upload' : '/api/social-media/upload-media';

        xhr.open('POST', endpoint);
        xhr.send(formData);
      });
    },
    onSuccess: (data: any) => {
      setUploadedMediaUrl(data.embedUrl || data.url);
      setPostForm((prev) => ({
        ...prev,
        mediaUrl: data.embedUrl || data.url,
        mediaType: data.type,
      }));
    },
  });

  // Create/publish post mutation
  const createPostMutation = useMutation({
    mutationFn: async (post: Partial<SocialPost>) => {
      const response = await fetch('/api/social-media/posts', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify(post),
      });
      if (!response.ok) throw new Error('Failed to create post');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/social-media/posts'] });
      handleClear();
    },
  });

  // Schedule post mutation
  const schedulePostMutation = useMutation({
    mutationFn: async ({ post, scheduledTime }: { post: Partial<SocialPost>; scheduledTime: string }) => {
      const response = await fetch('/api/social-media/posts/schedule', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({
          ...post,
          scheduledFor: scheduledTime,
          status: 'scheduled',
        }),
      });
      if (!response.ok) throw new Error('Failed to schedule post');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/social-media/posts'] });
      handleClear();
      setScheduleDialogOpen(false);
    },
  });

  const handleMediaUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');

    // Validate file type
    if (!isVideo && !isImage) {
      alert('Vennligst velg en bilde- eller videofil');
      return;
    }

    // Validate platform support
    const anyPlatformSupportsType = selectedPlatforms.some((platform) => {
      const config = platformConfig[platform as keyof typeof platformConfig];
      return (isVideo && config.supportsVideo) || (isImage && config.supportsImage);
    });

    if (!anyPlatformSupportsType) {
      alert('Ingen av de valgte plattformene støtter denne filtypen');
      return;
    }

    // Validate file size
    const maxSize = Math.max(
      ...selectedPlatforms.map((p) => platformConfig[p as keyof typeof platformConfig].maxVideoSize)
    ) * 1024 * 1024;

    if (file.size > maxSize) {
      alert(`Filen er for stor. Maks størrelse er ${maxSize / (1024 * 1024)} MB`);
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    uploadMediaMutation.mutate(file);
  };

  const handlePublish = async () => {
    for (const platform of selectedPlatforms) {
      const result = await createPostMutation.mutateAsync({
        ...postForm,
        platform: platform as any,
        status: 'published',
        publishedAt: new Date().toISOString(),
      });

      // Trigger marketing automation workflow if enabled
      if (postForm.autoTrigger && postForm.workflowId) {
        try {
          await fetch(`/api/marketing-automation/workflows/${postForm.workflowId}/execute`, {
            method: 'POST',
            headers: { 'Content-Type' : 'application/json' },
            body: JSON.stringify({
              leadData: {
                socialPostId: result.post?.id,
                platform: platform,
                content: postForm.content,
                hashtags: postForm.hashtags,
                engagement: result.post?.engagement,
              },
            }),
          });
        } catch (error) {
          console.error('Failed to trigger workflow: ', error);
        }
      }
    }
  };

  const handleSchedule = async (scheduledTime: string) => {
    for (const platform of selectedPlatforms) {
      // Create social media post
      const postResult = await schedulePostMutation.mutateAsync({
        post: {
          ...postForm,
          platform: platform as any,
        },
        scheduledTime,
      });

      // ALSO create calendar event for unified view
      try {
        await fetch('/api/content-calendar/events', {
          method: 'POST',
          headers: { 'Content-Type' : 'application/json' },
          body: JSON.stringify({
            title: `${platformConfig[platform].name}: ${postForm.content?.substring(0, 50) || 'Social Post'}`,
            event_type: 'social',
            scheduled_date: scheduledTime.split('T')[0],
            scheduled_time: scheduledTime.split('T')[1]?.substring(0, 5) || '12:00',
            status: 'ready',
            marketing_purpose: 'engagement',
            target_audience: postForm.hashtags || [],
            metadata: {
              socialPostId: postResult.post?.id,
              platform: platform,
              mediaUrl: postForm.mediaUrl,
            },
          }),
        });
      } catch (error) {
        console.error('Failed to create calendar event:', error);
      }
    }
  };

  const handleClear = () => {
    setPostForm({
      content: ', ',
      status: 'draft',
      hashtags: [],
      youtubePrivacy: 'public',
    });
    setUploadedMediaUrl('');
    setUploadProgress(0);
  };

  const handlePlatformToggle = (platform: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
    );
  };

  const tabs = ['Opprett Innlegg','Planlagte','Publisert','Analyse'];

  return (
    <Box>
      {/* Header */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
            Sosiale Medier
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Administrer innhold på tvers av Instagram, Facebook, Snapchat, YouTube og TikTok
          </Typography>
        </Box>
      </Box>

      {/* Platform Selection */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Velg Plattformer
          </Typography>
          <Box display="flex" gap={2} flexWrap="wrap">
            {Object.entries(platformConfig).map(([platform, config]) => {
              const Icon = config.icon;
              const isSelected = selectedPlatforms.includes(platform);
              return (
                <Button
                  key={platform}
                  variant={isSelected ? 'contained' : 'outlined'}
                  startIcon={<Icon />}
                  onClick={() => handlePlatformToggle(platform)}
                  sx={{
                    borderColor: config.color,
                    color: isSelected ? '#fff' : config.color,
                    bgcolor: isSelected ? config.color : 'transparent', '&:hover': {
                      bgcolor: isSelected ? config.color : `${config.color}20`,
                      borderColor: config.color,
                    }}}
                >
                  {config.name}
                </Button>
              );
            })}
          </Box>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(_, newValue) => setActiveTab(newValue)}
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        {tabs.map((tab) => (
          <Tab key={tab} label={tab} />
        ))}
      </Tabs>

      {/* Tab Content */}
      {activeTab === 0 && (
        <Grid container spacing={3}>
          {/* Content Creation Form */}
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Opprett Innlegg
                </Typography>

                {/* Content Text */}
                <TextField
                  fullWidth
                  multiline
                  rows={6}
                  label="Innhold"
                  placeholder="Skriv innholdet ditt her..."
                  value={postForm.content}
                  onChange={(e) => setPostForm((prev) => ({ ...prev, content: e.target.value }))}
                  sx={{ mb: 2 }}
                  helperText={`${postForm.content?.length || 0} tegn`}
                />

                {/* Hashtags */}
                <TextField
                  fullWidth
                  label="Hashtags (kommaseparert)"
                  placeholder="#creatorhub, #norway, #photo"
                  value={postForm.hashtags?.join('')}
                  onChange={(e) =>
                    setPostForm((prev) => ({
                      ...prev,
                      hashtags: e.target.value.split('').map((tag) => tag.trim()),
                    }))
                  }
                  sx={{ mb: 2 }}
                />

                {/* YouTube Specific Fields */}
                {selectedPlatforms.includes('youtube') && (
                  <>
                    <Typography variant="subtitle2" sx={{ mb: 1, mt: 2 }}>
                      YouTube Innstillinger
                    </Typography>
                    <TextField
                      fullWidth
                      label="Video Tittel"
                      value={postForm.youtubeTitle || ', '}
                      onChange={(e) =>
                        setPostForm((prev) => ({ ...prev, youtubeTitle: e.target.value }))
                      }
                      sx={{ mb: 2 }}
                    />
                    <TextField
                      fullWidth
                      multiline
                      rows={3}
                      label="Video Beskrivelse"
                      value={postForm.youtubeDescription || ', '}
                      onChange={(e) =>
                        setPostForm((prev) => ({ ...prev, youtubeDescription: e.target.value }))
                      }
                      sx={{ mb: 2 }}
                    />
                    <FormControl fullWidth sx={{ mb: 2 }}>
                      <InputLabel>Personvern</InputLabel>
                      <Select
                        value={postForm.youtubePrivacy || 'public'}
                        label="Personvern"
                        onChange={(e) =>
                          setPostForm((prev) => ({
                            ...prev,
                            youtubePrivacy: e.target.value as any,
                          }))
                        }
                      >
                        <MenuItem value="public">Offentlig</MenuItem>
                        <MenuItem value="unlisted">Uoppført</MenuItem>
                        <MenuItem value="private">Privat</MenuItem>
                      </Select>
                    </FormControl>
                  </>
                )}

                {/* Media Upload */}
                <Box
                  sx={{
                    border: '2px dashed',
                    borderColor: uploadedMediaUrl ? 'success.main' : 'grey.300',
                    borderRadius: 2,
                    p: 3,
                    textAlign: 'center',
                    bgcolor: uploadedMediaUrl ? 'success.50' : 'grey.50',
                    transition: 'all 0.3s',
                    mb: 2}}
                >
                  {uploadedMediaUrl ? (
                    <Box>
                      <CheckCircleIcon sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
                      <Typography variant="h6" sx={{ mb: 1, color: 'success.main' }}>
                        Media lastet opp!
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {uploadedMediaUrl}
                      </Typography>
                      <Button
                        size="small"
                        onClick={() => {
                          setUploadedMediaUrl(', ');
                          setPostForm((prev) => ({ ...prev, mediaUrl: undefined }));
                        }}
                      >
                        Last opp ny fil
                      </Button>
                    </Box>
                  ) : isUploading ? (
                    <Box>
                      <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
                      <Typography variant="h6" sx={{ mb: 2 }}>
                        Laster opp...
                      </Typography>
                      <Box sx={{ width: '100%', maxWidth: 400, mx: 'auto', mb: 1 }}>
                        <LinearProgress variant="determinate" value={uploadProgress} />
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        {uploadProgress}% fullført
                      </Typography>
                    </Box>
                  ) : (
                    <Box>
                      <UploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                      <Typography variant="body1" sx={{ mb: 1 }}>
                        Last opp bilde eller video
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Støtter JPG, PNG, MP4, MOV
                      </Typography>
                      <Button variant="contained" component="label" startIcon={<UploadIcon />}>
                        Velg fil
                        <input type="file" hidden accept="image/*,video/*" onChange={handleMediaUpload} />
                      </Button>
                    </Box>
                  )}
                </Box>

                {/* Action Buttons */}
                <Box display="flex" gap={2} justifyContent="flex-end">
                  <Button startIcon={<PreviewIcon />} onClick={() => setPreviewDialogOpen(true)}>
                    Forhåndsvis
                  </Button>
                  <Button
                    startIcon={<ScheduleIcon />}
                    variant="outlined"
                    onClick={() => setScheduleDialogOpen(true)}
                    disabled={!postForm.content || selectedPlatforms.length === 0}
                  >
                    Planlegg
                  </Button>
                  <Button
                    startIcon={<SendIcon />}
                    variant="contained"
                    onClick={handlePublish}
                    disabled={!postForm.content || selectedPlatforms.length === 0 || createPostMutation.isPending}
                    sx={{ bgcolor: '#ff8c00', '&:hover': { bgcolor: '#e67e00' } }}
                  >
                    Publiser Nå
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Preview Panel */}
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Forhåndsvisning
                </Typography>
                <Box
                  sx={{
                    minHeight: 300,
                    bgcolor: 'grey.100',
                    borderRadius: 2,
                    p: 2,
                    mb: 2}}
                >
                  {uploadedMediaUrl && (
                    <Box
                      component="img"
                      src={uploadedMediaUrl}
                      sx={{
                        width: '100%',
                        height: 200,
                        objectFit: 'cover',
                        borderRadius: 1,
                        mb: 2}}
                    />
                  )}
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {postForm.content || 'Innholdet ditt vil vises her...'}
                  </Typography>
                  {postForm.hashtags && postForm.hashtags.length > 0 && (
                    <Box mt={2} display="flex" flexWrap="wrap" gap={0.5}>
                      {postForm.hashtags.map((tag, i) => (
                        <Chip key={i} label={tag} size="small" color="primary" variant="outlined" />
                      ))}
                    </Box>
                  )}
                </Box>
                <Alert severity="info" sx={{ fontSize: '0.875rem' }}>
                  Forhåndsvisning er tilnærmet og kan variere på ulike plattformer
                </Alert>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {activeTab === 1 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Planlagte Innlegg
            </Typography>
            <List>
              {posts
                .filter((post: SocialPost) => post.status === 'scheduled')
                .map((post: SocialPost) => (
                  <ListItem key={post.id}>
                    <ListItemIcon>
                      <CalendarIcon />
                    </ListItemIcon>
                    <ListItemText
                      primary={post.content.substring(0, 50) + '...'}
                      secondary={`${platformConfig[post.platform].name} - ${new Date(
                        post.scheduledFor!
                      ).toLocaleString('no-NO')}`}
                    />
                    <ListItemSecondaryAction>
                      <IconButton edge="end">
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              {posts.filter((post: SocialPost) => post.status === 'scheduled').length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                  Ingen planlagte innlegg
                </Typography>
              )}
            </List>
          </CardContent>
        </Card>
      )}

      {activeTab === 2 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Publiserte Innlegg
            </Typography>
            <Grid container spacing={2}>
              {posts
                .filter((post: SocialPost) => post.status ==='published')
                .map((post: SocialPost) => {
                  const Icon = platformConfig[post.platform].icon;
                  return (
                    <Grid item xs={12} sm={6} md={4} key={post.id}>
                      <Paper sx={{ p: 2 }}>
                        <Box display="flex" alignItems="center" mb={1}>
                          <Icon sx={{ color: platformConfig[post.platform].color, mr: 1 }} />
                          <Typography variant="subtitle2">
                            {platformConfig[post.platform].name}
                          </Typography>
                        </Box>
                        <Typography variant="body2" sx={{ mb: 2 }}>
                          {post.content.substring(0, 100)}...
                        </Typography>
                        {post.engagement && (
                          <Box display="flex" gap={2}>
                            <Typography variant="caption">❤️ {post.engagement.likes}</Typography>
                            <Typography variant="caption">💬 {post.engagement.comments}</Typography>
                            <Typography variant="caption">👁️ {post.engagement.views}</Typography>
                          </Box>
                        )}
                      </Paper>
                    </Grid>
                  );
                })}
            </Grid>
          </CardContent>
        </Card>
      )}

      {activeTab === 3 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Engasjement Analyse
            </Typography>
            <Alert severity="info">Analyse-funksjoner kommer snart...</Alert>
          </CardContent>
        </Card>
      )}

      {/* Schedule Dialog */}
      <Dialog open={scheduleDialogOpen} onClose={() => setScheduleDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Planlegg Innlegg</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            type="datetime-local"
            label="Publiseringsdato og tid"
            InputLabelProps={{ shrink: true }}
            sx={{ mt: 2 }}
            onChange={(e) => handleSchedule(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setScheduleDialogOpen(false)}>Avbryt</Button>
          <Button
            variant="contained"
            onClick={() => {
              // Handle schedule logic
            }}
          >
            Planlegg
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
