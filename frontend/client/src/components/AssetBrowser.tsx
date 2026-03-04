import { useTheming } from '../utils/theming-helper';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Paper,
  Chip,
  Avatar,
  Stack,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Card,
  CardContent,
  CardActions,
  Button,
  Divider,
  Snackbar,
  Alert,
  Popover,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  FormControlLabel,
  InputLabel,
  Select,
  Switch,
} from '@mui/material';
import {
  Search,
  Movie,
  Timeline,
  ContentCut,
  MoreVert,
  ExpandMore,
  PlayArrow,
  Favorite,
  FavoriteBorder,
  Download,
  Info,
  Folder,
  VideoLibrary,
  MusicNote,
  PhotoCamera,
  Business,
  Celebration,
  Article,
  PermMedia,
  CloudUpload,
  GetApp,
  Share,
  Delete,
  Visibility,
  CloudDownload,
  CloudQueue,
  Sync,
  FolderOpen,
  KeyboardArrowLeft,
} from '@mui/icons-material';
import { UniversalFileUpload } from './universal/UniversalFileUpload';
import { FileManagementStatusProvider } from '../contexts/FileManagementStatusContext';
import type { StoryArc, BeatClip, Track } from '../services/storyArcDataIntegration';
import StoryArcDataIntegration from '../services/storyArcDataIntegration';
import { apiRequest } from '@/lib/queryClient';

interface AssetBrowserProps {
  onTemplateSelect?: (templateId: string) => void;
  onSnippetDrag?: (snippetId: string) => void;
  onSnippetInsert?: (snippet: {
    id: string;
    name: string;
    type: 'transition' | 'opening' | 'closing' | 'montage' | 'dialogue' | 'action';
    duration: number;
    tags: string[];
  }) => void;
  onMediaSelect?: (mediaFile: MediaFile) => void;
  height?: number | string;
  // Integration props for unified workflow connectivity
  onMeetingCreate?: (meeting: any) => void;
  onProjectUpdate?: (project: any) => void;
  onWorklogCreate?: (worklog: any) => void;
  onClientSelect?: (client: any) => void;
  onClientUpdate?: (client: any) => void;
  onShowcaseCreate?: (showcase: any) => void;
  onFileUpload?: (file: any) => void;
  onFileDownload?: (file: any) => void;
  selectedProject?: any;
  onProjectSelect?: (project: any) => void;
  selectedClient?: any;
  onSettingsUpdate?: (settings: any) => void;
  onNotificationCreate?: (notification: any) => void;
  // Optional: enable Drive import into a specific story arc
  storyArcId?: string;
  // Optional: bubble timeline initialization (beats/tracks) to parent
  onTimelineInit?: (payload: { storyArc: StoryArc; clips: BeatClip[]; tracks: Track[] }) => void;
}

interface Template {
  id: string;
  name: string;
  type: 'wedding' | 'corporate' | 'documentary' | 'commercial' | 'music_video' | 'event';
  duration: string;
  description: string;
  segments: number;
  emotionalCurve: 'rising' | 'falling' | 'wave' | 'mountain';
  tags: string[];
  isFavorite: boolean;
  thumbnail?: string;
  previewUrl?: string
}

interface Snippet {
  id: string;
  name: string;
  type: 'transition' | 'opening' | 'closing' | 'montage' | 'dialogue' | 'action';
  duration: number;
  description: string;
  tags: string[];
  isFavorite: boolean;
  previewUrl?: string
}

interface Arc {
  id: string;
  name: string;
  type: string;
  totalDuration: number;
  segments: number;
  confidence: number;
  createdAt: string;
  tags: string[];
  isFavorite: boolean
}

interface MediaFile {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'image' | 'document';
  size: number;
  duration?: number;
  url: string;
  file?: File;
  thumbnail?: string;
  uploadedAt: string;
  tags: string[];
  isFavorite: boolean;
  source?: 'local' | 'google_drive';
  driveFileId?: string;
  downloadLink?: string;
  mimeType?: string
}

const STORY_ARC_TEMPLATES: Template[] = [
  {
    id: 'wedding_classic_8min',
    name: 'Classic Wedding 8-Min Arc',
    type: 'wedding',
    duration: '8',
    description: 'Balanced wedding narrative with prep, ceremony, reception, and finale.',
    segments: 4,
    emotionalCurve: 'rising',
    tags: ['wedding', 'classic', 'ceremony', 'reception'],
    isFavorite: true,
  },
  {
    id: 'wedding_cinematic_5min',
    name: 'Cinematic Wedding 5-Min',
    type: 'wedding',
    duration: '5',
    description: 'Short cinematic cut with stronger emotional peaks and dynamic pacing.',
    segments: 3,
    emotionalCurve: 'mountain',
    tags: ['wedding', 'cinematic', 'short-form'],
    isFavorite: true,
  },
  {
    id: 'corporate_brand_story_3min',
    name: 'Corporate Brand Story',
    type: 'corporate',
    duration: '3',
    description: 'Brand narrative template with intro, value proof, and CTA close.',
    segments: 3,
    emotionalCurve: 'rising',
    tags: ['corporate', 'brand', 'marketing'],
    isFavorite: false,
  },
  {
    id: 'documentary_short_12min',
    name: 'Documentary Short',
    type: 'documentary',
    duration: '12',
    description: 'Documentary flow tuned for interviews, B-roll, and a clear resolution.',
    segments: 6,
    emotionalCurve: 'wave',
    tags: ['documentary', 'interview', 'b-roll'],
    isFavorite: false,
  },
  {
    id: 'commercial_social_1min',
    name: 'Social Commercial',
    type: 'commercial',
    duration: '1',
    description: 'Fast social ad structure with punchy opening and product payoff.',
    segments: 3,
    emotionalCurve: 'mountain',
    tags: ['commercial', 'social', 'ad'],
    isFavorite: false,
  },
  {
    id: 'music_video_performance_3m30',
    name: 'Music Performance 3m30',
    type: 'music_video',
    duration: '3m30',
    description: 'Performance-led cut with chorus emphasis and beat-driven transitions.',
    segments: 5,
    emotionalCurve: 'rising',
    tags: ['music', 'performance', 'beat-sync'],
    isFavorite: true,
  },
  {
    id: 'event_recap_4min',
    name: 'Event Recap 4-Min',
    type: 'event',
    duration: '4',
    description: 'Event highlight recap for speaker moments, crowd energy, and outro.',
    segments: 4,
    emotionalCurve: 'wave',
    tags: ['event', 'recap', 'highlight'],
    isFavorite: false,
  },
];
/*
  // Wedding Videography Templates - 8-minute Professional Templates
  {
    id: 'wedding_classic_8min',
    name: 'Classic Wedding 8-Min Arc',
    type: 'wedding',
    duration: '8',
    description: 'Professional 8-minute wedding story arc with preparation, ceremony, celebration, and farewell',
    segments:  4,
    emotionalCurve: 'rising',
    tags: ['wedding','romantic','traditional','ceremony','8-minute','professional'],
    isFavorite: true
},
  {
    id: 'wedding_cinematic_8min',
    name: 'Cinematic Wedding 8-Min',
    type: 'wedding',
    duration: '8',
    description: 'Cinematic wedding videography with dramatic emotional peaks and cinematic transitions',
    segments:  4,
    emotionalCurve: 'mountain',
    tags: ['wedding','cinematic','dramatic','emotional','8-minute','luxury'],
    isFavorite: true
},
  {
    id: 'wedding_intimate_5min',
    name: 'Intimate Wedding 5-Min',
    type: 'wedding',
    duration: '5',
    description: 'Focused on emotional moments and personal connections for intimate ceremonies',
    segments:  3,
    emotionalCurve: 'wave',
    tags: ['wedding','intimate','emotional','personal','5-minute'],
    isFavorite: false
},
  {
    id: 'wedding_documentary_10min',
    name: 'Wedding Documentary 10-Min',
    type: 'wedding',
    duration: '10',
    description: 'Extended documentary-style wedding coverage with interviews and behind-the-scenes',
    segments:  6,
    emotionalCurve: 'wave',
    tags: ['wedding','documentary','extended','interviews','10-minute'],
    isFavorite: false
},
  {
    id: 'wedding_social_1min',
    name: 'Wedding Social Media',
    type: 'wedding',
    duration: '1',
    description: 'Short-form wedding highlight reel perfect for social media sharing',
    segments:  3,
    emotionalCurve: 'rising',
    tags: ['wedding','social','short','highlights','1-minute','instagram'],
    isFavorite: false
},

  // Podcast Video Templates
  {
    id: 'podcast_interview_long',
    name: 'Podcast Interview Long-Form',
    type: 'documentary',
    duration: '45',
    description: 'Extended podcast interview with intro, main discussion, and wrap-up segments',
    segments:  5,
    emotionalCurve: 'wave',
    tags: ['podcast','interview','long-form''discussion','talk'],
    isFavorite: true
},
  {
    id: 'podcast_highlight_reel',
    name: 'Podcast Highlight Reel',
    type: 'documentary',
    duration: '3',
    description: 'Best moments from podcast episodes edited for social media promotion',
    segments:  6,
    emotionalCurve: 'mountain',
    tags: ['podcast','highlights','social','promotion','best-moments'],
    isFavorite: false
},
  {
    id: 'podcast_solo_episode',
    name: 'Solo Podcast Episode',
    type: 'documentary',
    duration: '20',
    description: 'Single-host podcast format with structured narrative flow',
    segments:  4,
    emotionalCurve: 'rising',
    tags: ['podcast','solo','narrative','structured','monologue'],
    isFavorite: false
},
  {
    id: 'podcast_roundtable',
    name: 'Podcast Roundtable Discussion',
    type: 'documentary',
    duration: '60',
    description: 'Multi-guest roundtable discussion with moderator and dynamic interactions',
    segments:  7,
    emotionalCurve: 'wave',
    tags: ['podcast','roundtable','multi-guest''discussion','debate'],
    isFavorite: false
},

  // Music Video Templates
  {
    id: 'music_video_performance',
    name: 'Music Video Performance',
    type: 'music_video',
    duration: '3m30',
    description: 'Band/artist performance video with multiple camera angles and dynamic cuts',
    segments:  5,
    emotionalCurve: 'rising',
    tags: ['music','performance','band','live','dynamic'],
    isFavorite: true
},
  {
    id: 'music_video_narrative',
    name: 'Music Video Narrative',
    type: 'music_video',
    duration: '4',
    description: 'Story-driven music video with visual narrative parallel to lyrics',
    segments:  8,
    emotionalCurve: 'wave',
    tags: ['music','narrative','visual','story','lyrics'],
    isFavorite: false
},
  {
    id: 'music_video_lyric',
    name: 'Lyric Music Video',
    type: 'music_video',
    duration: '3',
    description: 'Typography-focused lyric video with animated text and visual effects',
    segments:  4,
    emotionalCurve: 'rising',
    tags: ['music','lyrics','typography','animated','text'],
    isFavorite: false
},
  {
    id: 'music_video_acoustic',
    name: 'Acoustic Session',
    type: 'music_video',
    duration: '4m30',
    description: 'Intimate acoustic performance in studio or natural setting',
    segments:  3,
    emotionalCurve: 'wave',
    tags: ['music','acoustic','intimate','session','natural'],
    isFavorite: false
},

  // Documentary Templates
  {
    id: 'documentary_personal_story',
    name: 'Personal Story Documentary',
    type: 'documentary',
    duration: '15',
    description: 'Individual journey documentary with interviews and archival footage',
    segments:  6,
    emotionalCurve: 'mountain',
    tags: ['documentary','personal','journey','interviews','archival'],
    isFavorite: false
},
  {
    id: 'documentary_investigation',
    name: 'Investigative Documentary',
    type: 'documentary',
    duration: '25',
    description: 'Investigative structure with gradual revelation and expert interviews',
    segments:  8,
    emotionalCurve: 'mountain',
    tags: ['documentary','investigation','reveal','truth','experts'],
    isFavorite: false
},
  {
    id: 'documentary_nature',
    name: 'Nature Documentary',
    type: 'documentary',
    duration: '12',
    description: 'Wildlife and nature documentary with cinematic visuals and narration',
    segments:  5,
    emotionalCurve: 'wave',
    tags: ['documentary','nature','wildlife','cinematic','narration'],
    isFavorite: false
},
  {
    id: 'documentary_historical',
    name: 'Historical Documentary',
    type: 'documentary',
    duration: '20',
    description: 'Historical events documentary with archival footage and expert commentary',
    segments:  7,
    emotionalCurve: 'rising',
    tags: ['documentary','historical','archival','expert','commentary'],
    isFavorite: false
},

  // Corporate Templates
  {
    id: 'corporate_company_story',
    name: 'Company Story',
    type: 'corporate',
    duration: '5',
    description: 'Company origin and values story for brand building',
    segments:  5,
    emotionalCurve: 'rising',
    tags: ['corporate','company','brand','values','origin'],
    isFavorite: false
},
  {
    id: 'corporate_product_launch',
    name: 'Product Launch Video',
    type: 'corporate',
    duration: '2m30',
    description: 'Product announcement and demonstration video for marketing',
    segments:  4,
    emotionalCurve: 'rising',
    tags: ['corporate','product','launch','marketing','demo'],
    isFavorite: false
},
  {
    id: 'corporate_employee_testimonials',
    name: 'Employee Testimonials',
    type: 'corporate',
    duration: '4',
    description: 'Employee interviews and workplace culture showcase',
    segments:  6,
    emotionalCurve: 'wave',
    tags: ['corporate','employees','testimonials','culture','workplace'],
    isFavorite: false
},
  {
    id: 'corporate_annual_report',
    name: 'Annual Report Video',
    type: 'corporate',
    duration: '6',
    description: 'Year in review with statistics, achievements, and future plans',
    segments:  7,
    emotionalCurve: 'rising',
    tags: ['corporate','annual','report','statistics','achievements'],
    isFavorite: false
},

  // Commercial Templates
  {
    id: 'commercial_product_demo',
    name: 'Product Demo Commercial',
    type: 'commercial',
    duration: '30',
    description: 'Product demonstration with AIDA structure for maximum impact',
    segments:  4,
    emotionalCurve: 'rising',
    tags: ['commercial','product','demo','aida','impact'],
    isFavorite: false
},
  {
    id: 'commercial_lifestyle',
    name: 'Lifestyle Commercial',
    type: 'commercial',
    duration: '60',
    description: 'Lifestyle-focused commercial showing product in daily use',
    segments:  5,
    emotionalCurve: 'wave',
    tags: ['commercial','lifestyle','daily','use','relatable'],
    isFavorite: false
},
  {
    id: 'commercial_testimonial',
    name: 'Customer Testimonial',
    type: 'commercial',
    duration: '45',
    description: 'Real customer testimonials with authentic experiences',
    segments:  3,
    emotionalCurve: 'rising',
    tags: ['commercial','testimonial','customer','authentic','real'],
    isFavorite: false
},
  {
    id: 'commercial_brand_story',
    name: 'Brand Story Commercial',
    type: 'commercial',
    duration: '90',
    description: 'Emotional brand storytelling with values and mission focus',
    segments:  6,
    emotionalCurve: 'mountain',
    tags: ['commercial','brand','story','emotional','values'],
    isFavorite: false
},

  // Event Templates
  {
    id: 'event_conference_recap',
    name: 'Conference Recap',
    type: 'event',
    duration: '8',
    description: 'Conference highlights with keynotes, networking, and key moments',
    segments:  6,
    emotionalCurve: 'rising',
    tags: ['event','conference','recap','keynotes','networking'],
    isFavorite: false
},
  {
    id: 'event_concert_highlights',
    name: 'Concert Highlights',
    type: 'event',
    duration: '6',
    description: 'Live concert footage with audience reactions and best performances',
    segments:  5,
    emotionalCurve: 'mountain',
    tags: ['event','concert','live','audience','performance'],
    isFavorite: false
},
  {
    id: 'event_festival_recap',
    name: 'Festival Recap',
    type: 'event',
    duration: '10',
    description: 'Multi-day festival coverage with atmosphere and highlights',
    segments:  8,
    emotionalCurve: 'wave',
    tags: ['event','festival','multi-day''atmosphere','highlights'],
    isFavorite: false
},
  {
    id: 'event_sports_highlights',
    name: 'Sports Event Highlights',
    type: 'event',
    duration: '5',
    description: 'Sports competition highlights with key moments and victories',
    segments:  4,
    emotionalCurve: 'rising',
    tags: ['event','sports','competition','highlights','victory'],
    isFavorite: false
},

  // Social Media Templates
  {
    id: 'social_instagram_reel',
    name: 'Instagram Reel',
    type: 'commercial',
    duration: '30',
    description: 'Vertical format reel with trending audio and quick cuts',
    segments:  3,
    emotionalCurve: 'rising',
    tags: ['social','instagram','reel','vertical','trending'],
    isFavorite: true
},
  {
    id: 'social_tiktok_video',
    name: 'TikTok Video',
    type: 'commercial',
    duration: '15',
    description: 'Short-form TikTok content with hook and viral potential',
    segments:  3,
    emotionalCurve: 'mountain',
    tags: ['social','tiktok','short-form''hook','viral'],
    isFavorite: false
},
  {
    id: 'social_youtube_short',
    name: 'YouTube Short',
    type: 'commercial',
    duration: '60',
    description: 'YouTube Shorts format with engaging content and clear message',
    segments:  4,
    emotionalCurve: 'rising',
    tags: ['social','youtube','shorts','engaging','message'],
    isFavorite: false
},
  {
    id: 'social_facebook_story',
    name: 'Facebook Story',
    type: 'commercial',
    duration: '15',
    description: 'Facebook Story format with visual appeal and brand message',
    segments:  2,
    emotionalCurve: 'rising',
    tags: ['social','facebook','story','visual','brand'],
    isFavorite: false
},

  // Educational Templates
  {
    id: 'educational_tutorial',
    name: 'Tutorial Video',
    type: 'documentary',
    duration: '12',
    description: 'Step-by-step tutorial with clear instructions and demonstrations',
    segments:  6,
    emotionalCurve: 'rising',
    tags: ['educational','tutorial','step-by-step''instructions','demo'],
    isFavorite: false
},
  {
    id: 'educational_course_intro',
    name: 'Course Introduction',
    type: 'documentary',
    duration: '3',
    description: 'Online course introduction with curriculum overview and instructor',
    segments:  4,
    emotionalCurve: 'rising',
    tags: ['educational','course','introduction','curriculum','instructor'],
    isFavorite: false
},
  {
    id: 'educational_webinar',
    name: 'Webinar Recording',
    type: 'documentary',
    duration: '90',
    description: 'Professional webinar with presentation, Q&A, and interactions',
    segments:  8,
    emotionalCurve: 'wave',
    tags: ['educational','webinar','presentation','qa','interaction'],
    isFavorite: false
},
  {
    id: 'educational_explainer',
    name: 'Explainer Video',
    type: 'documentary',
    duration: '4',
    description: 'Animated explainer video for complex topics and concepts',
    segments:  5,
    emotionalCurve: 'rising',
    tags: ['educational','explainer','animated','complex','concepts'],
    isFavorite: false
}
*/

const VIDEO_SNIPPETS: Snippet[] = [
  {
    id: 'transition_smooth_crossfade',
    name: 'Smooth Crossfade',
    type: 'transition',
    duration: 1.2,
    description: 'Soft crossfade transition for natural cut points.',
    tags: ['transition', 'crossfade', 'smooth'],
    isFavorite: true,
  },
  {
    id: 'opening_title_reveal',
    name: 'Title Reveal Opener',
    type: 'opening',
    duration: 4,
    description: 'Cinematic opener with room for logo/title animation.',
    tags: ['opening', 'title', 'branding'],
    isFavorite: true,
  },
  {
    id: 'montage_fast_cuts',
    name: 'Fast-Cut Montage',
    type: 'montage',
    duration: 12,
    description: 'Rhythmic montage block for high-energy sequences.',
    tags: ['montage', 'fast', 'energy'],
    isFavorite: false,
  },
  {
    id: 'dialogue_interview_block',
    name: 'Interview Dialogue Block',
    type: 'dialogue',
    duration: 20,
    description: 'Stable interview layout segment for talking-head sections.',
    tags: ['dialogue', 'interview', 'talking-head'],
    isFavorite: false,
  },
  {
    id: 'action_dynamic_push',
    name: 'Dynamic Action Push',
    type: 'action',
    duration: 6,
    description: 'Aggressive action beat with tighter pacing.',
    tags: ['action', 'dynamic', 'impact'],
    isFavorite: false,
  },
  {
    id: 'closing_end_credits',
    name: 'Elegant End Credits',
    type: 'closing',
    duration: 8,
    description: 'Closing section for credits and final logo.',
    tags: ['closing', 'credits', 'outro'],
    isFavorite: false,
  },
];
/*
    name: 'Smooth Fade Transition',
    type: 'transition',
    duration:  2,
    description: 'Elegant fade transition between scenes',
    tags: ['transition','fade','smooth','elegant'],
    isFavorite: false
},
  {
    id: 'title_opener',
    name: 'Cinematic Title Opener',
    type: 'opening',
    duration:  5,
    description: 'Professional title sequence with animation',
    tags: ['opening','title','cinematic','professional'],
    isFavorite: true
},
  {
    id: 'montage_fast',
    name: 'Fast Montage Sequence',
    type: 'montage',
    duration:  15,
    description: 'Quick-cut montage for energy and excitement',
    tags: ['montage','fast','energy','quick'],
    isFavorite: false
},
  {
    id: 'dialogue_scene',
    name: 'Interview Setup',
    type: 'dialogue',
    duration:  30,
    description: 'Professional interview scene template',
    tags: ['dialogue','interview','professional','talking'],
    isFavorite: false
},
  {
    id: 'action_sequence',
    name: 'Dynamic Action',
    type: 'action',
    duration:  20,
    description: 'High-energy action sequence with multiple angles',
    tags: ['action','dynamic','energy','multiple'],
    isFavorite: true
},
  {
    id: 'end_credits',
    name: 'Elegant End Credits',
    type: 'closing',
    duration:  10,
    description: 'Beautiful closing credits with fade out',
    tags: ['closing','credits','elegant','fade'],
    isFavorite: false
}
*/

const SAMPLE_ARCS: Arc[] = [
  {
    id: 'arc_wedding_sample',
    name: 'Sample Wedding Story',
    type: 'wedding',
    totalDuration: 480,
    segments: 4,
    confidence: 0.89,
    createdAt: '2026-02-12T10:30:00Z',
    tags: ['wedding', 'sample', 'highlight'],
    isFavorite: true,
  },
  {
    id: 'arc_brand_sample',
    name: 'Sample Brand Reel',
    type: 'corporate',
    totalDuration: 180,
    segments: 3,
    confidence: 0.84,
    createdAt: '2026-01-28T09:15:00Z',
    tags: ['corporate', 'sample', 'brand'],
    isFavorite: false,
  },
];
/*
    name: 'Maria & John Wedding',
    type: 'wedding',
    totalDuration: 40,
    segments:  4,
    confidence: 0.5,
    createdAt: '2024-08-20T10:30:00',
    tags: ['wedding','outdoor','summer'],
    isFavorite: true
},
  {
    id: 'arc_corporate_',
    name: 'TechCorp Presentation',
    type: 'corporate',
    totalDuration: 10,
    segments:  5,
    confidence: 0.8,
    createdAt: '2024-08-18T14:15:00',
    tags: ['corporate','tech','innovation'],
    isFavorite: false
},
  {
    id: 'arc_documentary_',
    name: 'Ocean Conservation',
    type: 'documentary',
    totalDuration: 60,
    segments:  6,
    confidence: 0.2,
    createdAt: '2024-08-15T09:45:00',
    tags: ['documentary','nature','conservation'],
    isFavorite: false
}
*/

const SAMPLE_MEDIA_FILES: MediaFile[] = [];
/*
    name: 'Wedding_Ceremony.mp',
    type: 'video',
    size: 107374184, // 1GB
    duration: 180, // 30 minutes
    url: '/media/wedding-ceremony.mp',
    thumbnail: '/thumbnails/wedding-ceremony.jpg',
    uploadedAt: '2024-08-20T10:30:00',
    tags: ['wedding','ceremony','main'],
    isFavorite: true
},
  {
    id: 'video_',
    name: 'Reception_Dance.mov',
    type: 'video',
    size: 53687092, // 512MB
    duration: 90, // 15 minutes
    url: '/media/reception-dance.mov',
    thumbnail: '/thumbnails/reception-dance.jpg',
    uploadedAt: '2024-08-20T14:15:00',
    tags: ['wedding','reception','dance'],
    isFavorite: false
},
  {
    id: 'audio_',
    name: 'Wedding_Vows_Audio.wav',
    type: 'audio',
    size: 6710884, // 64MB
    duration: 30, // 5 minutes
    url: '/media/wedding-vows.wav',
    uploadedAt: '2024-08-20T11:00:00',
    tags: ['wedding','vows','audio'],
    isFavorite: true
},
  {
    id: 'audio_',
    name: 'Reception_Music.mp',
    type: 'audio',
    size: 838868, // 8MB
    duration: 20, // 4 minutes
    url: '/media/reception-music.mp',
    uploadedAt: '2024-08-20T15:30:00',
    tags: ['wedding','music','background'],
    isFavorite: false
},
  {
    id: 'image_',
    name: 'Wedding_Photos.zip',
    type: 'image',
    size: 26843546, // 256MB
    url: '/media/wedding-photos.zip',
    thumbnail: '/thumbnails/wedding-photos.jpg',
    uploadedAt: '2024-08-20T16:00:00',
    tags: ['wedding','photos','still'],
    isFavorite: false
},
  {
    id: 'document_',
    name: 'Shot_List.pdf',
    type: 'document',
    size: 209712, // 2MB
    url: '/media/shot-list.pdf',
    uploadedAt: '2024-08-19T09:00:00',
    tags: ['planning','shot-list','reference'],
    isFavorite: false
}
*/

export default function AssetBrowser({ 
  onTemplateSelect, 
  onSnippetDrag, 
  onSnippetInsert,
  onMediaSelect, 
  height = '100%',
  onMeetingCreate,
  onProjectUpdate,
  onWorklogCreate,
  onClientSelect,
  onClientUpdate,
  onShowcaseCreate,
  onFileUpload,
  onFileDownload,
  selectedProject,
  onProjectSelect,
  selectedClient,
  onSettingsUpdate,
  onNotificationCreate,
  storyArcId,
  onTimelineInit,
}: AssetBrowserProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set<string>([]));
  const [showUpload, setShowUpload] = useState(false);
  const [googleDriveTab, setGoogleDriveTab] = useState(0); // 0: Local Files, 1: Google Drive
  const [googleDriveFolder, setGoogleDriveFolder] = useState('CreatorHub Norge Projects, ');
  const [autoGenerateProxy, setAutoGenerateProxy] = useState(true);
  const [proxyMap, setProxyMap] = useState<Record<string, string>>({});
  const [storyArcName, setStoryArcName] = useState<string | null>(null);
  const [folderHistory, setFolderHistory] = useState<string[]>([]); // Track folder navigation history
  const [localMediaFiles, setLocalMediaFiles] = useState<MediaFile[]>([]);
  const localObjectUrlsRef = React.useRef<string[]>([]);
  const autoSelectedVideoRef = React.useRef(false);
  
  // Hover preview state
  const [hoverAnchor, setHoverAnchor] = useState<HTMLElement | null>(null);
  const [hoverMedia, setHoverMedia] = useState<MediaFile | null>(null);

  // Add-to-timeline dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addTargetMedia, setAddTargetMedia] = useState<MediaFile | null>(null);
  const [addPosition, setAddPosition] = useState<'playhead' | 'append'>('playhead');
  const [addTrack, setAddTrack] = useState<'video-1' | 'video-2' | 'audio-1'>('video-1');
  const [addCamera, setAddCamera] = useState<string>('');
  const [addSyncGroup, setAddSyncGroup] = useState<string>('');
  const [addTags, setAddTags] = useState<string[]>([]);
  const { profession } = useProfessionAdapter();
  
  // Theming system - use dynamic profession
  const theming = useTheming(profession || 'photographer,');


  const [currentUser, setCurrentUser] = useState<any>(null);

  // Local snackbar toast
  const [snackOpen, setSnackOpen] = useState(false);
  const [snackMessage, setSnackMessage] = useState('');
  const [snackSeverity, setSnackSeverity] = useState<'success' | 'info' | 'warning' | 'error'>('info');
  const showToast = (opts: { title?: string; description?: string; variant?: 'default' | 'destructive' | 'success' }) => {
    const severity = opts.variant === 'destructive' ? 'error' : opts.variant === 'success' ? 'success' : 'info';
    setSnackSeverity(severity);
    setSnackMessage([opts.title, opts.description].filter(Boolean).join(' — '));
    setSnackOpen(true);
  };
  React.useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth/public-session', { credentials: 'include' });
        const json = await res.json();
        setCurrentUser(json);
      } catch {}
    })();
  }, []);

  React.useEffect(() => {
    const releaseObjectUrls = () => {
      localObjectUrlsRef.current.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // Ignore URL cleanup failures during page teardown.
        }
      });
      localObjectUrlsRef.current = [];
    };

    window.addEventListener('beforeunload', releaseObjectUrls);

    return () => {
      window.removeEventListener('beforeunload', releaseObjectUrls);
    };
  }, []);

  // Fetch story arc data when storyArcId is available
  React.useEffect(() => {
    if (storyArcId) {
      (async () => {
        try {
          const arc = await StoryArcDataIntegration.fetchStoryArcData(storyArcId);
          if (arc?.name) {
            setStoryArcName(arc.name);
            // Update Google Drive folder to project-specific path (only if not already set)
            if (!googleDriveFolder || googleDriveFolder === 'CreatorHub Norge Projects') {
              setGoogleDriveFolder(`CreatorHub Norge Projects/Story Arc Studio/${arc.name}`);
              setFolderHistory([]); // Reset folder history when switching projects
            }
          }
        } catch (error) {
          console.error('Failed to fetch story arc data: ', error);
        }
      })();
    } else {
      // Reset to default folder when no storyArcId
      setStoryArcName(null);
      setGoogleDriveFolder('CreatorHub Norge Projects');
    }
  }, [storyArcId]);

  // Filter data based on search
  const filteredTemplates = useMemo(() => {
    return STORY_ARC_TEMPLATES.filter(template =>
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    );
}, [searchQuery]);

  const filteredSnippets = useMemo(() => {
    return VIDEO_SNIPPETS.filter(snippet =>
      snippet.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      snippet.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      snippet.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    );
}, [searchQuery]);

  const filteredArcs = useMemo(() => {
    return SAMPLE_ARCS.filter(arc =>
      arc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      arc.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      arc.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    );
}, [searchQuery]);

  const filteredMedia = useMemo(() => {
    const query = searchQuery.toLowerCase();
    const localMatches = localMediaFiles.filter((media) => {
      return (
        media.name.toLowerCase().includes(query) ||
        media.type.toLowerCase().includes(query) ||
        media.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    });

    const sampleMatches = SAMPLE_MEDIA_FILES.filter((media) => {
      return (
        media.name.toLowerCase().includes(query) ||
        media.type.toLowerCase().includes(query) ||
        media.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    });

    if (sampleMatches.length === 0) {
      return localMatches;
    }

    const deduped = new Map<string, MediaFile>();
    [...localMatches, ...sampleMatches].forEach((media) => {
      deduped.set(media.id, media);
    });
    return Array.from(deduped.values());
  }, [localMediaFiles, searchQuery]);

  // Google Drive Integration - Browse media files
  // When storyArcId is available, show project-specific folders
  const { 
    data: googleDriveFiles = [], 
    isLoading: isLoadingDriveFiles,
    refetch: refetchDriveFiles 
  } = useQuery({
    queryKey: ['/api/story-arc/google-drive/browse', currentUser?.id, googleDriveFolder, storyArcId, storyArcName],
    queryFn: async (): Promise<MediaFile[]> => {
      const userId = currentUser?.id;
      if (!userId) return [];
      
      // Use current folder path (may have been navigated into)
      // If storyArcId is available but no navigation has occurred, use project root
      const folderPath = googleDriveFolder || (storyArcId && storyArcName 
        ? `CreatorHub Norge Projects/Story Arc Studio/${storyArcName}`
        : 'CreatorHub Norge Projects');
      
      const data = await apiRequest(`/api/story-arc/google-drive/browse/${userId}?folderPath=${encodeURIComponent(folderPath)}`);
      const files = (data?.files || []) as Array<any>;
      
      // Include folders in the results for navigation
      return files.map((f) => {
        const mime = f.mimeType || '';
        const isFolder = mime === 'application/vnd.google-apps.folder';
        const type: MediaFile['type'] = isFolder 
          ? 'document' // Use document type for folders
          : mime.startsWith('video/') ? 'video' 
          : mime.startsWith('audio/') ? 'audio' 
          : mime.startsWith('image/') ? 'image' 
          : 'document';
        const sizeNum = typeof f.size === 'string' ? parseInt(f.size, 10) : Number(f.size || 0);
        const mf: MediaFile = {
          id: f.id,
          name: f.name || 'Untitled',
          type,
          size: Number.isFinite(sizeNum) ? sizeNum : 0,
          url: f.webViewLink || '#',
          uploadedAt: f.createdTime || f.modifiedTime || new Date().toISOString(),
          tags: isFolder ? ['folder','google_drive'] : ['google_drive'],
          isFavorite: false,
          source: 'google_drive',
          driveFileId: f.id,
          mimeType: mime,
          isFolder: isFolder, // Add folder flag
        } as MediaFile;
        // Attach any client-known proxy
        const proxy = proxyMap[f.id];
        return proxy ? ({ ...mf, url: mf.url, previewProxyUrl: proxy } as any) : mf;
      });
    },
    enabled: googleDriveTab === 1 && !!currentUser?.id,
    retry: false,
    onError: (err: any) => {
      showToast({
        title: 'Kunne ikke hente Google Drive-filer, ',
        description: typeof err?.message === 'string' ? err.message : 'Ukjent feil under henting',
        variant: 'destructive',
      });
    },
  });


  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    setSearchQuery(''); // Clear search when switching tabs
};

  const toggleFavorite = useCallback((itemId: string) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(itemId)) {
        newFavorites.delete(itemId);
  } else {
        newFavorites.add(itemId);
    }
      return newFavorites;
  });
}, []);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, itemId: string) => {
    event.stopPropagation();
    setMenuAnchor(event.currentTarget);
    setSelectedItem(itemId);
};

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedItem(null);
};

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'wedding': return <Celebration fontSize="small" />;
      case 'corporate': return <Business fontSize="small" />;
      case 'documentary': return <Article fontSize="small" />;
      case 'commercial': return <VideoLibrary fontSize="small" />;
      case 'music_video': return <MusicNote fontSize="small" />;
      case 'event': return <PhotoCamera fontSize="small" />;
      case 'transition': return <ContentCut fontSize="small" />;
      case 'opening': return <PlayArrow fontSize="small" />;
      case 'closing': return <Timeline fontSize="small" />;
      case 'montage': return <Movie fontSize="small" />;
      case 'dialogue': return <Article fontSize="small" />;
      case 'action': return <VideoLibrary fontSize="small" />;
      default: return <Folder fontSize="small" />;
}
};

  const getEmotionalCurveColor = (curve: string) => {
    switch (curve) {
      case 'rising': return '#23C3A6';
      case 'falling': return '#FF6B6B';
      case 'wave': return '#6AB8FF';
      case 'mountain': return '#7C5CFF';
      default: return '#A0E7E5';
}
};

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('no-NO', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
};

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes','KB','MB','GB','TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ', ' + sizes[i];
};

  const inferMediaTypeFromFile = useCallback((file: File): MediaFile['type'] => {
    const mime = (file.type || '').toLowerCase();
    if (mime.startsWith('video/')) return 'video';
    if (mime.startsWith('audio/')) return 'audio';
    if (mime.startsWith('image/')) return 'image';

    const fileName = file.name.toLowerCase();
    if (/\.(mp4|mov|mkv|webm|m4v|avi)$/.test(fileName)) return 'video';
    if (/\.(mp3|wav|aac|m4a|ogg|flac)$/.test(fileName)) return 'audio';
    if (/\.(jpg|jpeg|png|gif|webp|heic|heif|bmp|tiff)$/.test(fileName)) return 'image';
    return 'document';
  }, []);

  const inferDurationFromMedia = useCallback(
    (id: string, url: string, mediaType: MediaFile['type']) => {
      if (mediaType !== 'video' && mediaType !== 'audio') {
        return;
      }

      const mediaElement = document.createElement(mediaType === 'video' ? 'video' : 'audio');
      mediaElement.preload = 'metadata';
      mediaElement.src = url;
      mediaElement.onloadedmetadata = () => {
        const durationSeconds = Number(mediaElement.duration);
        if (Number.isFinite(durationSeconds) && durationSeconds > 0) {
          setLocalMediaFiles((previous) =>
            previous.map((item) => (item.id === id ? { ...item, duration: durationSeconds } : item))
          );
        }
      };
      mediaElement.onerror = () => {
        // Ignore metadata parsing failures for unsupported codecs.
      };
    },
    []
  );

  const createLocalMediaFile = useCallback(
    (file: File): MediaFile => {
      const objectUrl = URL.createObjectURL(file);
      localObjectUrlsRef.current.push(objectUrl);
      return {
        id: `local-${file.name}-${file.size}-${file.lastModified}`,
        name: file.name,
        type: inferMediaTypeFromFile(file),
        size: file.size,
        url: objectUrl,
        file,
        uploadedAt: new Date().toISOString(),
        tags: ['local_upload'],
        isFavorite: false,
        source: 'local',
        mimeType: file.type || undefined,
      };
    },
    [inferMediaTypeFromFile]
  );

  const readFirstString = (record: Record<string, unknown>, keys: string[]): string | undefined => {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
    }
    return undefined;
  };

  const handleMediaUpload = (files: File[]) => {
    if (!Array.isArray(files) || files.length === 0) {
      return;
    }

    const createdMedia = files.map((file) => createLocalMediaFile(file));
    setLocalMediaFiles((previous) => {
      const merged = new Map(previous.map((item) => [item.id, item]));
      createdMedia.forEach((item) => merged.set(item.id, item));
      return Array.from(merged.values()).sort(
        (left, right) => new Date(right.uploadedAt).getTime() - new Date(left.uploadedAt).getTime()
      );
    });

    createdMedia.forEach((mediaFile) => {
      inferDurationFromMedia(mediaFile.id, mediaFile.url, mediaFile.type);
      onFileUpload?.({
        id: mediaFile.id,
        name: mediaFile.name,
        type: mediaFile.type,
        source: mediaFile.url,
        mimeType: mediaFile.mimeType,
        size: mediaFile.size,
      });
    });

    const firstVideo = createdMedia.find((item) => item.type === 'video');
    if (firstVideo && !autoSelectedVideoRef.current) {
      autoSelectedVideoRef.current = true;
      onMediaSelect?.(firstVideo);
      showToast({
        title: 'Video valgt',
        description: `${firstVideo.name} lastet i Source Monitor`,
        variant: 'success',
      });
    }
  };

  const handleUploadComplete = (results: unknown[] = []) => {
    setShowUpload(false);

    if (!Array.isArray(results) || results.length === 0) {
      return;
    }

    setLocalMediaFiles((previous) => {
      const merged = new Map(previous.map((item) => [item.id, item]));

      results.forEach((entry) => {
        if (!entry || typeof entry !== 'object') {
          return;
        }

        const payload = entry as Record<string, unknown>;
        const fileValue = payload.file;
        if (!(fileValue instanceof File)) {
          return;
        }

        const resultValue = payload.result;
        const resultRecord =
          resultValue && typeof resultValue === 'object' ? (resultValue as Record<string, unknown>) : null;
        const completionStatus = typeof payload.status === 'string' ? payload.status : '';
        const isSuccessful =
          payload.success === true || completionStatus === 'completed' || completionStatus === 'queued';
        if (!isSuccessful) {
          return;
        }

        const localId = `local-${fileValue.name}-${fileValue.size}-${fileValue.lastModified}`;
        const existing = merged.get(localId);
        const remoteUrl = resultRecord
          ? readFirstString(resultRecord, ['url', 'fileUrl', 'webViewLink', 'downloadUrl', 'signedUrl'])
          : undefined;
        // Keep the in-session local object URL as primary source for editor playback/captions.
        // Remote URLs can be metadata endpoints during background uploads and may not be
        // directly streamable as media.
        const resolvedUrl = existing?.url || remoteUrl;
        if (!resolvedUrl) {
          return;
        }

        const inferredType = existing?.type || inferMediaTypeFromFile(fileValue);
        const durationRaw = resultRecord?.duration;
        const duration = typeof durationRaw === 'number' && Number.isFinite(durationRaw) ? durationRaw : existing?.duration;
        merged.set(localId, {
          id: localId,
          name: existing?.name || fileValue.name,
          type: inferredType,
          size: existing?.size || fileValue.size,
          duration,
          url: resolvedUrl,
          file: existing?.file || fileValue,
          uploadedAt: existing?.uploadedAt || new Date().toISOString(),
          tags: existing?.tags || ['local_upload'],
          isFavorite: existing?.isFavorite || false,
          source: existing?.source || 'local',
          mimeType:
            existing?.mimeType ||
            fileValue.type ||
            (resultRecord ? readFirstString(resultRecord, ['mimeType', 'contentType']) : undefined),
        });
      });

      return Array.from(merged.values()).sort(
        (left, right) => new Date(right.uploadedAt).getTime() - new Date(left.uploadedAt).getTime()
      );
    });
  };

  useEffect(() => {
    if (autoSelectedVideoRef.current) {
      return;
    }

    const firstVideo = localMediaFiles.find(
      (media) => media.type === 'video' && typeof media.url === 'string' && media.url.trim().length > 0
    );

    if (!firstVideo) {
      return;
    }

    autoSelectedVideoRef.current = true;
    onMediaSelect?.(firstVideo);
  }, [localMediaFiles, onMediaSelect]);

  // Drive import mutation (requires storyArcId)
  const importGoogleDriveFile = useMutation({
    mutationFn: async ({ fileId, fileName }: { fileId: string; fileName: string }) => {
      if (!storyArcId) throw new Error('storyArcId mangler');
      const userId = currentUser?.id;
      if (!userId) throw new Error('Bruker ikke innlogget');
      return apiRequest(`/api/story-arc/${storyArcId}/google-drive/import`, {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ userId, googleDriveFileId: fileId, fileName }),
      });
    },
    onSuccess: () => {
      showToast({ title: 'Import startet', description: 'Filen importeres fra Google Drive', variant: 'success' });
    },
    onError: (error: any) => {
      showToast({ title: 'Import feilet', description: error?.message || 'Ukjent feil', variant: 'destructive' });
    },
  });

  const handleGoogleDriveImport = (file: MediaFile) => {
    const fileId = file.driveFileId || file.id;
    if (!fileId) return;
    importGoogleDriveFile.mutate({ fileId, fileName: file.name }, {
      onSuccess: async () => {
        if (autoGenerateProxy && (file.mimeType || '').startsWith('video/')) {
          try {
            const job = await apiRequest('/api/media/proxy/jobs', {
              method: 'POST',
              headers: { 'Content-Type' : 'application/json' },
              body: JSON.stringify({ fileId, sourceUrl: file.url }),
            });
            const jobId = job?.jobId;
            if (!jobId) throw new Error('Ingen jobId returnert');
            // Poll status for up to ~45s
            const started = Date.now();
            let previewUrl: string | undefined;
            while (Date.now() - started < 45000) {
              await new Promise((r) => setTimeout(r, 1500));
              const st = await apiRequest(`/api/media/proxy/jobs/${jobId}`, { method: 'GET' });
              if (st?.job?.status === 'completed') { previewUrl = st.job.previewUrl; break; }
              if (st?.job?.status === 'failed') throw new Error(st?.job?.error || 'Proxy job feilet');
            }
            if (previewUrl) {
              setProxyMap((m) => ({ ...m, [fileId]: previewUrl! }));
              showToast({ title: 'Forhåndsvisning opprettet', description: 'Proxy generert for hover preview', variant: 'success' });
            } else {
              showToast({ title: 'Proxy tar tid', description: 'Proxy jobben fortsetter i bakgrunnen', variant: 'default' });
            }
          } catch (e: any) {
            showToast({ title: 'Proxy-feil', description: e?.message || 'Kunne ikke generere proxy', variant: 'destructive' });
          }
        }
      },
    });
  };

  // Get currently displayed media files based on active tab
  const getCurrentMediaFiles = () => {
    if (googleDriveTab === 1) {
      // Google Drive files
      return googleDriveFiles as MediaFile[];
  } else {
      // Local files
      return filteredMedia;
  }
};

  // Helpers to build StoryArc from a template
  const parseDurationToSeconds = (s: string): number => {
    if (!s) return 0;
    const m = s.match(/^(\d+)(?:m(\d+))?$/i);
    if (m) {
      const minutes = parseInt(m[1], 10) || 0;
      const seconds = m[2] ? parseInt(m[2], 10) : 0;
      return minutes * 60 + seconds;
    }
    const asNum = parseInt(s, 10);
    if (!isNaN(asNum)) return asNum * 60; // assume minutes
    return 0;
  };

  const generateStoryArcFromTemplate = (template: Template): StoryArc => {
    const total = parseDurationToSeconds(template.duration) || template.segments * 60;
    const segCount = Math.max(1, template.segments);
    const segDur = Math.floor(total / segCount);
    const now = new Date().toISOString();
    const segments = Array.from({ length: segCount }).map((_, i) => {
      const start = i * segDur;
      const end = i === segCount - 1 ? total : (i + 1) * segDur;
      let segmentType: 'opening' | 'build-up' | 'climax' | 'resolution' | 'closing' = 'build-up';
      if (i === 0) segmentType = 'opening';
      else if (i === segCount - 1) segmentType = 'closing';
      else if (i === Math.floor(segCount / 2)) segmentType = 'climax';
      else if (i === segCount - 2) segmentType = 'resolution';
      return {
        id: `${template.id}_seg_${i + 1}`,
        title: `${template.name} - Del ${i + 1}`,
        startTime: start,
        endTime: end,
        sourceClips: [],
        segmentType,
        pacing: 'medium',
        emotionalArc: { joy: 0.6, sadness: 0.1, excitement: 0.5, calm: 0.5, tension: 0.2, romance: 0.3 },
        priority: i + 1,
      };
    });
    return {
      id: `arc_from_${template.id}`,
      title: template.name,
      type: template.type,
      totalDuration: total,
      segments,
      musicSuggestions: [],
      transitionEffects: [],
      colorGrading: {
        name: 'Default', temperature: 0, tint: 0, exposure: 0, contrast: 1, highlights: 0, shadows: 0, saturation: 1, vibrance: 1, luts: []
      },
      confidence: 0.8,
      createdAt: now,
    };
  };

  const generateStoryArcFromSampleArc = (arc: Arc): StoryArc => {
    const total = Math.max(60, Math.round(arc.totalDuration || 0));
    const segCount = Math.max(1, arc.segments || 1);
    const segDur = Math.floor(total / segCount);
    const now = new Date().toISOString();
    const segments = Array.from({ length: segCount }).map((_, i) => {
      const start = i * segDur;
      const end = i === segCount - 1 ? total : (i + 1) * segDur;
      let segmentType: 'opening' | 'build-up' | 'climax' | 'resolution' | 'closing' = 'build-up';
      if (i === 0) segmentType = 'opening';
      else if (i === segCount - 1) segmentType = 'closing';
      else if (i === Math.floor(segCount / 2)) segmentType = 'climax';
      else if (i === segCount - 2) segmentType = 'resolution';
      return {
        id: `${arc.id}_seg_${i + 1}`,
        title: `${arc.name} - Del ${i + 1}`,
        startTime: start,
        endTime: end,
        sourceClips: [],
        segmentType,
        pacing: 'medium',
        emotionalArc: { joy: 0.6, sadness: 0.1, excitement: 0.5, calm: 0.5, tension: 0.2, romance: 0.3 },
        priority: i + 1,
      };
    });
    return {
      id: arc.id,
      title: arc.name,
      type: arc.type as StoryArc['type'],
      totalDuration: total,
      segments,
      musicSuggestions: [],
      transitionEffects: [],
      colorGrading: {
        name: 'Default', temperature: 0, tint: 0, exposure: 0, contrast: 1, highlights: 0, shadows: 0, saturation: 1, vibrance: 1, luts: []
      },
      confidence: arc.confidence,
      createdAt: now,
    };
  };

  return (
    <Box data-testid="storyarc-asset-browser" sx={{ height, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider'}}>
        <Typography variant="subtitle2" fontWeight={600} gutterBottom>
          Asset Browser
        </Typography>
        
        {/* Search */}
        <TextField
          fullWidth
          size="small"
          placeholder="Søk i assets..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            )}}
          sx={{ mb:  2 }}
        />

        {/* Tabs */}
        <Tabs 
          value={activeTab}
          onChange={handleTabChange}
          variant="fullWidth"
          sx={{ 
            minHeight: 40,
            '& .MuiTab-root': {
              minHeight: 40,
              fontSize: 12,
              fontWeight: 500,
            }}}
        >
          <Tab data-testid="asset-tab-story-arcs" label="Story Arcs" icon={<Timeline fontSize="small" />} iconPosition="start" />
          <Tab data-testid="asset-tab-templates" label="Templates" icon={<Movie fontSize="small" />} iconPosition="start" />
          <Tab data-testid="asset-tab-snippets" label="Snippets" icon={<ContentCut fontSize="small" />} iconPosition="start" />
          <Tab data-testid="asset-tab-media" label="Media" icon={<PermMedia fontSize="small" />} iconPosition="start" />
        </Tabs>
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto', p:  1 }}>
        {/* Story Arcs Tab */}
        {activeTab === 0 && (
          <Stack spacing={1}>
            {filteredArcs.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center'}}>
                {searchQuery ? 'Ingen story arcs matchet søket' : 'Ingen story arcs tilgjengelig'}
              </Typography>
            ) : (
              filteredArcs.map((arc) => (
                <Card 
                  key={arc.id}
                  variant="outlined" 
                  sx={{ 
                    cursor: 'pointer', '&:hover': { borderColor: 'primary.main',}
                }}
                  onClick={() => {
                    onTemplateSelect?.(arc.id);
                    if (onTimelineInit) {
                      try {
                        const storyArc = generateStoryArcFromSampleArc(arc);
                        const { clips, tracks } = StoryArcDataIntegration.convertStoryArcToBeats(storyArc);
                        onTimelineInit({ storyArc, clips, tracks });
                        showToast({ title: 'Tidslinje fra Story Arc', description: `Lastet ${clips.length} klipp`, variant: 'success' });
                      } catch (error: unknown) {
                        const message = error instanceof Error ? error.message : 'Ukjent feil';
                        showToast({ title: 'Klarte ikke å laste Story Arc', description: message, variant: 'destructive' });
                      }
                    }
                  }}
                >
                  <CardContent sx={{ p: 2,...theming.getThemedCardSx() }}>
                    <Stack direction="row" spacing={1} alignItems="flex-start">
                      <Avatar sx={{ bgcolor: 'primary.main', width:  32, height: 32}}>
                        {getTypeIcon(arc.type)}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth:  0 }}>
                        <Typography variant="body2" fontWeight={500} noWrap>
                          {arc.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatDuration(arc.totalDuration)} • {arc.segments} segments
                        </Typography>
                        <Stack direction="row" spacing={0.5} sx={{ mt: 0.5}}>
                          <Chip 
                            label={`${Math.round(arc.confidence * 100)}%`}
                            size="small" 
                            color="success"
                            sx={{ height:  16, fontSize: 10}}
                          />
                          <Chip 
                            label={formatDate(arc.createdAt)}
                            size="small" 
                            variant="outlined"
                            sx={{ height:  16, fontSize: 10}}
                          />
                        </Stack>
                      </Box>
                      <IconButton 
                        size="small" 
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(arc.id);
                      }}
                      >
                        {favorites.has(arc.id) ? <Favorite fontSize="small" color="error" /> : <FavoriteBorder fontSize="small" />}
                      </IconButton>
                    </Stack>
                  </CardContent>
                </Card>
              ))
            )}
          </Stack>
        )}

        {/* Templates Tab */}
        {activeTab === 1 && (
          <Stack spacing={1}>
            {filteredTemplates.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center'}}>
                {searchQuery ? 'Ingen templates matchet søket' : 'Ingen templates tilgjengelig'}
              </Typography>
            ) : (
              filteredTemplates.map((template) => (
                <Card 
                  key={template.id}
                  variant="outlined"
                  sx={{ 
                    cursor: 'pointer','&:hover': { borderColor: 'primary.main',}
                }}
                  onClick={async () => {
                    onTemplateSelect?.(template.id);
                    if (onTimelineInit) {
                      try {
                        const arc = generateStoryArcFromTemplate(template);
                        const { clips, tracks } = StoryArcDataIntegration.convertStoryArcToBeats(arc);
                        onTimelineInit({ storyArc: arc, clips, tracks });
                        showToast({ title: 'Tidslinje fra mal', description: `Genererte ${clips.length} klipp`, variant: 'success' });
                      } catch (e: any) {
                        showToast({ title: 'Klarte ikke å generere tidslinje fra mal', description: e?.message || 'Ukjent feil', variant: 'destructive' });
                      }
                    }
                  }}
                >
                  <CardContent sx={{ p: 2,...theming.getThemedCardSx() }}>
                    <Stack direction="row" spacing={1} alignItems="flex-start">
                      <Avatar sx={{ bgcolor: 'secondary.main', width:  32, height: 32}}>
                        {getTypeIcon(template.type)}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth:  0 }}>
                        <Typography variant="body2" fontWeight={500} noWrap>
                          {template.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block'}}>
                          {template.duration} • {template.segments} segments
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5}}>
                          {template.description}
                        </Typography>
                        <Stack direction="row" spacing={0.5} sx={{ mt:  1 }}>
                          <Chip 
                            label={template.emotionalCurve}
                            size="small"
                            sx={{ 
                              height:  16, 
                              fontSize:  10,
                              bgcolor: getEmotionalCurveColor(template.emotionalCurve),
                              color: 'white'
                        }}
                          />
                          {template.tags.slice(0, 2).map(tag => (
                            <Chip 
                              key={tag}
                              label={tag}
                              size="small" 
                              variant="outlined"
                              sx={{ height:  16, fontSize: 10}}
                            />
                          ))}
                        </Stack>
                      </Box>
                      <Stack>
                        <IconButton 
                          size="small" 
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(template.id);
                        }}
                        >
                          {favorites.has(template.id) ? <Favorite fontSize="small" color="error" /> : <FavoriteBorder fontSize="small" />}
                        </IconButton>
                        <IconButton 
                          size="small"
                          onClick={(e) => handleMenuOpen(e, template.id)}
                        >
                          <MoreVert fontSize="small" />
                        </IconButton>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              ))
            )}
          </Stack>
        )}

        {/* Snippets Tab */}
        {activeTab === 2 && (
          <Stack spacing={1}>
            {filteredSnippets.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center'}}>
                {searchQuery ? 'Ingen snippets matchet søket' : 'Ingen snippets tilgjengelig'}
              </Typography>
            ) : (
              filteredSnippets.map((snippet) => (
                <Card 
                  key={snippet.id}
                  variant="outlined"
                  sx={{ 
                    cursor: 'grab','&:hover': { borderColor: 'primary.main' }, '&:active': { cursor: 'grabbing' }}}
                  draggable
                  onDragStart={() => onSnippetDrag?.(snippet.id)}
                >
                  <CardContent sx={{ p: 2,...theming.getThemedCardSx() }}>
                    <Stack direction="row" spacing={1} alignItems="flex-start">
                      <Avatar sx={{ bgcolor: 'info.main', width:  32, height: 32}}>
                        {getTypeIcon(snippet.type)}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth:  0 }}>
                        <Typography variant="body2" fontWeight={500} noWrap>
                          {snippet.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatDuration(snippet.duration)} • {snippet.type}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5}}>
                          {snippet.description}
                        </Typography>
                        <Stack direction="row" spacing={0.5} sx={{ mt:  1 }}>
                          {snippet.tags.slice(0, 3).map(tag => (
                            <Chip 
                              key={tag}
                              label={tag}
                              size="small" 
                              variant="outlined"
                              sx={{ height:  16, fontSize: 10}}
                            />
                          ))}
                        </Stack>
                      </Box>
                      <Stack spacing={0.5} alignItems="center">
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSnippetInsert?.({
                              id: snippet.id,
                              name: snippet.name,
                              type: snippet.type,
                              duration: snippet.duration,
                              tags: snippet.tags,
                            });
                          }}
                        >
                          Insert
                        </Button>
                        <IconButton 
                          size="small" 
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(snippet.id);
                        }}
                        >
                          {favorites.has(snippet.id) ? <Favorite fontSize="small" color="error" /> : <FavoriteBorder fontSize="small" />}
                        </IconButton>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              ))
            )}
          </Stack>
        )}

        {/* Media Tab */}
        {activeTab === 3 && (
          <Stack spacing={2}>
            {/* Google Drive Sub-tabs */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider'}}>
              <Tabs 
                value={googleDriveTab}
                onChange={(e, newValue) => setGoogleDriveTab(newValue)}
                variant="fullWidth"
                sx={{ 
                  minHeight: 36,
                  '& .MuiTab-root': {
                    minHeight: 36,
                    fontSize: 11,
                    fontWeight: 500,
                  }}}
              >
                <Tab
                  data-testid="asset-subtab-local"
                  label="Lokale Filer" 
                  icon={<Folder fontSize="small" />}
                  iconPosition="start" 
                />
                <Tab
                  data-testid="asset-subtab-google-drive"
                  label="Google Drive" 
                  icon={<CloudQueue fontSize="small" />}
                  iconPosition="start" 
                />
              </Tabs>
            </Box>

            {/* Upload Section - only show for local files */}
            {googleDriveTab === 0 && (
              <Card variant="outlined" sx={theming.getThemedCardSx()}>
                <CardContent sx={{ p: 2,...theming.getThemedCardSx() }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb:  2 }}>
                    <Typography variant="subtitle2" fontWeight={600}>
                      Media Upload
                    </Typography>
                    <Button
                      data-testid="asset-upload-toggle"
                      size="small"
                      variant={showUpload ? "outlined" : "contained"}
                      startIcon={<CloudUpload fontSize="small" />}
                      onClick={() => setShowUpload(!showUpload)}
                    >
                      {showUpload ? 'Hide Upload' : 'Upload Media'}
                    </Button>
                  </Stack>
                  
                  {showUpload && (
                    <Box sx={{ mt:  2 }}>
                      <FileManagementStatusProvider>
                        <UniversalFileUpload
                          onFilesSelected={handleMediaUpload}
                          onUploadComplete={handleUploadComplete}
                          maxFiles={10}
                          maxFileSizeMB={500}
                          allowedTypes="all"
                          profession="videographer"
                          enableBackgroundUpload={true}
                          showFormatInfo={false}
                        />
                      </FileManagementStatusProvider>
                    </Box>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Google Drive Controls */}
            {googleDriveTab === 1 && (
              <Card variant="outlined" sx={theming.getThemedCardSx()}>
                <CardContent sx={{ p: 2,...theming.getThemedCardSx() }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb:  2 }}>
                    <Typography variant="subtitle2" fontWeight={600}>
                      Google Drive Media Browser
                    </Typography>
                    <FormControlLabel
                      control={<Switch checked={autoGenerateProxy} onChange={(e) => setAutoGenerateProxy(e.target.checked)} size="small" />}
                      label={<Typography variant="caption">Auto-generate preview proxies</Typography>}
                    />
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<Sync fontSize="small" />}
                        onClick={async () => {
                          const res = await refetchDriveFiles();
                          if (!res?.data || res.data.length === 0) {
                            showToast({ title: 'Ingen filer funnet', description: 'Ingen filer i valgt Google Drive-mappe', variant: 'default' });
                          }
                        }}
                        disabled={isLoadingDriveFiles}
                      >
                        {isLoadingDriveFiles ? 'Syncing...' : 'Sync'}
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<FolderOpen fontSize="small" />}
                        onClick={() => setGoogleDriveFolder('CreatorHub Norge Projects')}
                      >
                        Reset Folder
                      </Button>
                    </Stack>
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<CloudDownload fontSize="small" />}
                        onClick={async () => {
                          setGoogleDriveFolder('CreatorHub Norge Projects/studio_arc_create');
                        const res = await refetchDriveFiles();
                        if (!res?.data || res.data.length === 0) {
                          showToast({ title: 'Ingen filer funnet', description: 'Ingen filer i overvåket mappe', variant: 'default' });
                        }
                        }}
                        disabled={isLoadingDriveFiles}
                      >
                        Importer fra overvåket mappe
                      </Button>
                      {storyArcId && (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={async () => {
                            try {
                              const arc = await StoryArcDataIntegration.fetchStoryArcData(storyArcId);
                              if (!arc) throw new Error('Fant ikke Story Arc-data');
                              const { clips, tracks } = StoryArcDataIntegration.convertStoryArcToBeats(arc);
                              onTimelineInit?.({ storyArc: arc, clips, tracks });
                              showToast({ title: 'Tidslinje opprettet', description: 'Genererte klipp og spor fra Story Arc', variant: 'success' });
                            } catch (e: any) {
                              showToast({ title: 'Klarte ikke å generere tidslinje', description: e?.message || 'Ukjent feil', variant: 'destructive' });
                            }
                          }}
                        >
                          Generer tidslinje
                        </Button>
                      )}
                    </Stack>
                  </Stack>
                  
                  {storyArcId && storyArcName ? (
                    <Box sx={{ mb: 1 }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                        <Chip 
                          label={`Project: ${storyArcName}`}
                          color="primary"
                          size="small"
                        />
                        {folderHistory.length > 0 && (
                          <Button
                            size="small"
                            startIcon={<KeyboardArrowLeft />}
                            onClick={() => {
                              const previousFolder = folderHistory[folderHistory.length - 1];
                              setFolderHistory(folderHistory.slice(0, -1));
                              setGoogleDriveFolder(previousFolder);
                            }}
                          >
                            Back
                          </Button>
                        )}
                        {googleDriveFolder !== `CreatorHub Norge Projects/Story Arc Studio/${storyArcName}` && (
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => {
                              const projectRoot = `CreatorHub Norge Projects/Story Arc Studio/${storyArcName}`;
                              setFolderHistory([...folderHistory, googleDriveFolder]);
                              setGoogleDriveFolder(projectRoot);
                            }}
                          >
                            Project Root
                          </Button>
                        )}
                      </Stack>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {googleDriveFolder || `CreatorHub Norge Projects/Story Arc Studio/${storyArcName}`}
                      </Typography>
                    </Box>
                  ) : (
                    <>
                      <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                        {folderHistory.length > 0 && (
                          <Button
                            size="small"
                            startIcon={<KeyboardArrowLeft />}
                            onClick={() => {
                              const previousFolder = folderHistory[folderHistory.length - 1];
                              setFolderHistory(folderHistory.slice(0, -1));
                              setGoogleDriveFolder(previousFolder);
                            }}
                          >
                            Back
                          </Button>
                        )}
                        <TextField
                          fullWidth
                          size="small"
                          label="Google Drive Folder Path"
                          value={googleDriveFolder}
                          onChange={(e) => setGoogleDriveFolder(e.target.value)}
                          placeholder="CreatorHub Norge Projects"
                        />
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        Browse and import media files directly from your Google Drive
                      </Typography>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Media Files Display */}
            {(() => {
              const currentFiles: MediaFile[] = getCurrentMediaFiles();
              const isLoading = googleDriveTab === 1 ? isLoadingDriveFiles : false;
              
              if (isLoading) {
                return (
                  <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center'}}>
                    Loading Google Drive files...
                  </Typography>
                );
            }

              if (currentFiles.length === 0) {
                return (
                  <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center'}}>
                    {googleDriveTab === 1 
                      ? (searchQuery ? 'Ingen Google Drive filer matchet søket' : 'Ingen mediefiler funnet i Google Drive') 
                      : (searchQuery ? 'Ingen lokale filer matchet søket' : 'Ingen lokale mediefiler tilgjengelig')
                  }
                  </Typography>
                );
            }

              return currentFiles.map((media) => {
                const isFolder = (media as any).isFolder || media.mimeType === 'application/vnd.google-apps.folder';
                
                return (
                <Card 
                  data-testid={isFolder ? undefined : `asset-media-card-${media.id}`}
                  key={media.id}
                  variant="outlined"
                  sx={{ cursor: isFolder ? 'pointer' : 'grab', '&:hover': { borderColor: 'primary.main' }, '&:active': { cursor: isFolder ? 'pointer' : 'grabbing' } }}
                  draggable={!isFolder}
                  onDragStart={(event) => {
                    if (isFolder) return;
                    const dragPayload = {
                      id: media.id,
                      name: media.name,
                      url: media.url,
                      type: media.type,
                      mimeType: media.mimeType,
                      duration: media.duration,
                      camera: media.camera,
                      syncGroup: media.syncGroup,
                      tags: media.tags || [],
                    };
                    event.dataTransfer.effectAllowed = 'copy';
                    event.dataTransfer.setData('application/x-storyarc-media', JSON.stringify(dragPayload));
                    event.dataTransfer.setData('text/plain', media.name || media.id || 'media');
                  }}
                  onClick={() => {
                    if (isFolder && googleDriveTab === 1) {
                      // Navigate into folder
                      const currentPath = storyArcId && storyArcName 
                        ? (googleDriveFolder || `CreatorHub Norge Projects/Story Arc Studio/${storyArcName}`)
                        : googleDriveFolder;
                      const newPath = currentPath ? `${currentPath}/${media.name}` : media.name;
                      setFolderHistory([...folderHistory, currentPath]);
                      setGoogleDriveFolder(newPath);
                    } else {
                      onMediaSelect?.(media);
                    }
                  }}
                  onMouseEnter={(e) => { setHoverAnchor(e.currentTarget as HTMLElement); setHoverMedia(media); }}
                  onMouseLeave={() => { setHoverAnchor(null); setHoverMedia(null); }}
                >
                  <CardContent sx={{ p: 2,...theming.getThemedCardSx() }}>
                    <Stack direction="row" spacing={1} alignItems="flex-start">
                      <Avatar sx={{ bgcolor: isFolder ? 'warning.main' : 'info.main', width:  32, height: 32}}>
                        {isFolder ? <Folder fontSize="small" /> : getTypeIcon(media.type)}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth:  0 }}>
                        <Typography variant="body2" fontWeight={500} noWrap>
                          {media.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block'}}>
                          {formatFileSize(media.size)}
                          {media.duration && ` • ${formatDuration(media.duration)}`}
                        </Typography>
                        {media.uploadedAt && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block'}}>
                            {formatDate(media.uploadedAt)}
                          </Typography>
                        )}
                        <Stack direction="row" spacing={0.5} sx={{ mt:  1 }}>
                          <Chip 
                            label={isFolder ? 'Folder' : media.type}
                            size="small"
                            color={isFolder ? 'warning' : 'primary'}
                            sx={{ height:  16, fontSize: 10}}
                          />
                          {(media.tags || []).slice(0, 2).map(tag => (
                            <Chip 
                              key={tag}
                              label={tag}
                              size="small" 
                              variant="outlined"
                              sx={{ height:  16, fontSize: 10}}
                            />
                          ))}
                        </Stack>
                      </Box>
                      <Stack>
                        <IconButton 
                          size="small" 
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(media.id);
                        }}
                        >
                          {favorites.has(media.id) ? <Favorite fontSize="small" color="error" /> : <FavoriteBorder fontSize="small" />}
                        </IconButton>
                        <IconButton 
                          size="small"
                          onClick={(e) => handleMenuOpen(e, media.id)}
                        >
                          <MoreVert fontSize="small" />
                        </IconButton>
                      </Stack>
                    </Stack>
                  </CardContent>
                  {!isFolder && (
                    <CardActions sx={{ p: 1, pt: 0, ...theming.getThemedCardSx() }}>
                      <Button size="small" startIcon={<Visibility fontSize="small" />}
                        onClick={(e) => { e.stopPropagation(); window.open(media.url, '_blank'); }}>Preview</Button>
                      <Button size="small" startIcon={<GetApp fontSize="small" />}
                        onClick={(e) => { e.stopPropagation(); const link = document.createElement('a'); link.href = media.url; link.download = media.name; link.click(); }}>Download</Button>
                      <Button size="small" startIcon={<Share fontSize="small" />}
                        onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(media.url); }}>Share</Button>
                      <Button
                        data-testid={`asset-add-to-timeline-${media.id}`}
                        size="small"
                        variant="outlined"
                        onClick={(e) => { e.stopPropagation(); setAddTargetMedia(media); setAddDialogOpen(true); }}>
                        Add to timeline…
                      </Button>
                      {media.source === 'google_drive' && storyArcId && (
                        <Button size="small" startIcon={<CloudDownload fontSize="small" />}
                          onClick={(e) => { e.stopPropagation(); handleGoogleDriveImport(media); }}
                          disabled={importGoogleDriveFile.isPending}>
                          {importGoogleDriveFile.isPending ? 'Importerer...': 'Importer'}
                        </Button>
                      )}
                    </CardActions>
                  )}
                </Card>
              );
              });
            })()}
          </Stack>
        )}
      </Box>

      {/* Hover Preview Popover */}
      <Popover
        open={!!hoverAnchor && !!hoverMedia}
        anchorEl={hoverAnchor}
        onClose={() => { setHoverAnchor(null); setHoverMedia(null); }}
        anchorOrigin={{ vertical: 'center', horizontal: 'right' }}
        transformOrigin={{ vertical: 'center', horizontal: 'left' }}
        sx={{ pointerEvents: 'none' }}
        disableRestoreFocus
      >
        <Box sx={{ p: 1, maxWidth: 280 }}>
          {hoverMedia?.type === 'video' && (
            <video src={(hoverMedia as any).previewProxyUrl || hoverMedia.url} muted playsInline autoPlay loop style={{ width: 260, height: 'auto', borderRadius: 4 }} />
          )}
          {hoverMedia?.type === 'audio' && (
            <audio src={hoverMedia.url} controls style={{ width: 260 }} />
          )}
          {hoverMedia?.type === 'image' && (
            <img src={hoverMedia.thumbnail || hoverMedia.url} alt={hoverMedia.name} style={{ width: 260, borderRadius: 4 }} />
          )}
          {hoverMedia && (
            <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
              {hoverMedia.name}
            </Typography>
          )}
        </Box>
      </Popover>

      {/* Add-to-timeline Dialog */}
      <Dialog open={addDialogOpen} onClose={() => {
        setAddDialogOpen(false);
        setAddCamera('');
        setAddSyncGroup('');
        setAddTags([]);
      }} maxWidth="sm" fullWidth>
        <DialogTitle>Add to timeline</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl size="small" fullWidth>
              <InputLabel id="position-label">Position</InputLabel>
              <Select native labelId="position-label" value={addPosition} onChange={(e: any) => setAddPosition(e.target.value)}>
                <option value="playhead">At playhead</option>
                <option value="append">Append to end</option>
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <InputLabel id="track-label">Track</InputLabel>
              <Select native labelId="track-label" value={addTrack} onChange={(e: any) => setAddTrack(e.target.value)}>
                <option value="video-1">Video 1</option>
                <option value="video-2">Video 2</option>
                <option value="audio-1">Audio 1</option>
              </Select>
            </FormControl>
            
            <Divider />
            <Typography variant="subtitle2" sx={{ fontWeight: 600}}>Multi-Angle Sync Metadata</Typography>
            
            <FormControl size="small" fullWidth>
              <InputLabel id="camera-label">Camera/Angle</InputLabel>
              <Select 
                native 
                labelId="camera-label" 
                value={addCamera} 
                onChange={(e: any) => setAddCamera(e.target.value)}
              >
                <option value="">None</option>
                <option value="Angle A">Angle A</option>
                <option value="Angle B">Angle B</option>
                <option value="Angle C">Angle C</option>
                <option value="Angle D">Angle D</option>
                <option value="Wide">Wide</option>
                <option value="Close-up">Close-up</option>
                <option value="Audio Recorder 1">Audio Recorder 1</option>
                <option value="Audio Recorder 2">Audio Recorder 2</option>
                <option value="Audio Recorder 3">Audio Recorder 3</option>
              </Select>
            </FormControl>
            
            <FormControl size="small" fullWidth>
              <InputLabel id="sync-group-label">Sync Group</InputLabel>
              <Select 
                native 
                labelId="sync-group-label" 
                value={addSyncGroup} 
                onChange={(e: any) => setAddSyncGroup(e.target.value)}
              >
                <option value="">None</option>
                <option value="sync-group-1">Sync Group 1</option>
                <option value="sync-group-2">Sync Group 2</option>
                <option value="sync-group-3">Sync Group 3</option>
                <option value="sync-group-4">Sync Group 4</option>
              </Select>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                Clips in the same sync group will be synchronized together
              </Typography>
            </FormControl>
            
            <TextField
              size="small"
              fullWidth
              label="Tags (comma-separated)"
              value={addTags.join(', ')}
              onChange={(e) => {
                const tags = e.target.value
                  .split(',')
                  .map((tag) => tag.trim())
                  .filter(Boolean);
                setAddTags(tags);
              }}
              placeholder="e.g. scene-1, take-2, master"
              helperText="Add tags to organize and filter clips"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setAddDialogOpen(false);
            setAddCamera('');
            setAddSyncGroup('');
            setAddTags([]);
          }}>Cancel</Button>
          <Button data-testid="asset-add-dialog-confirm" variant="contained" onClick={() => {
            if (!addTargetMedia) return;
            const detail = { 
              media: {
                ...addTargetMedia,
                // Add metadata
                camera: addCamera || undefined,
                syncGroup: addSyncGroup || undefined,
                tags: addTags.length > 0 ? addTags : undefined,
              },
              position: addPosition, 
              track: addTrack 
            };
            window.dispatchEvent(new CustomEvent('storyarc:add-media', { detail }));
            setAddDialogOpen(false);
            setAddCamera('');
            setAddSyncGroup('');
            setAddTags([]);
            showToast({ title: 'Lagt til', description: `La til ${addTargetMedia.name} i tidslinjen`, variant: 'success' });
          }}>Add</Button>
        </DialogActions>
      </Dialog>

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleMenuClose}>
          <PlayArrow fontSize="small" sx={{ mr: 1 }} />
          Preview
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <Download fontSize="small" sx={{ mr: 1 }} />
          Download
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <Info fontSize="small" sx={{ mr: 1 }} />
          Details
        </MenuItem>
      </Menu>
      {/* Snackbar Toast */}
      <Snackbar
        open={snackOpen}
        autoHideDuration={3500}
        onClose={() => setSnackOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setSnackOpen(false)} severity={snackSeverity} sx={{ width:'100%' }}>
          {snackMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
