/**
 * CreatorHub Academy Video Player
 * Advanced video player with learning features inspired by the design
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useAcademy } from '@/contexts/AcademyContext';
import {
  Box,
  IconButton,
  Slider,
  Typography,
  Stack,
  Chip,
  Avatar,
  Tooltip,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Divider,
  Badge,
  LinearProgress,
  useTheme,
  alpha,
  Alert,
  Grid,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  VolumeUp,
  VolumeOff,
  Fullscreen,
  FullscreenExit,
  Theaters,
  Movie,
  Settings,
  Speed,
  ClosedCaption,
  PictureInPicture,
  Download,
  Star,
  Share,
  MoreVert,
  Replay10,
  Forward10,
  SkipNext,
  SkipPrevious,
  CheckCircle,
  Lock,
  LockOpen,
  School,
  VideoLibrary,
  TextFields,
  Chat,
  Assignment,
  Quiz,
  Timer,
  Psychology,
  Note,
  Accessibility,
  Visibility,
  VisibilityOff,
  Contrast,
  Description,
  Keyboard,
  KeyboardArrowDown,
  KeyboardArrowUp,
  Cast,
  CastConnected,
  Tv,
  Devices,
  WifiTethering,
  WifiTetheringError,
} from '@mui/icons-material';
import {
	  VideoPlayerIcon,
	  XRayIcon,
	  QualityIcon,
	  SpeedIcon,
	  SubtitlesIcon,
	  FullscreenIcon,
	  VolumeIcon,
	  MuteIcon,
	  BookmarkIcon,
	  NoteIcon,
	  ProgressIcon,
	  CourseIcon,
	  LessonIcon,
	} from '../shared/CreatorHubIcons';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { withUniversalIntegration } from '@/integration/UniversalIntegrationHOC';
import { useTheming } from '../../utils/theming-helper';
import CastingService, { CastingDevice } from '../../services/CastingService';

interface AcademyVideoPlayerProps {
	  course: any;
	  lesson: any;
	  chapters?: any[];
	  onLessonComplete?: () => void;
	  onNextLesson?: () => void;
	  onPreviousLesson?: () => void;
	  onChapterSelect?: (chapter: any) => void;
}

function AcademyVideoPlayer({
  course,
  lesson,
  chapters = [],
  onLessonComplete,
  onNextLesson,
  onPreviousLesson,
  onChapterSelect,
}: AcademyVideoPlayerProps) {
  const theme = useTheme();
  const { updateProgress, addBookmark, addNote, updateSettings, state } = useAcademy();
  const { analytics, performance, debugging, features } = useEnhancedMasterIntegration();

  // Theming system
  const theming = useTheming('music_producer');

  // Wire up MUI components
  const muiComponents = { Paper, Badge, Grid };
  const muiStyles = { alpha };
  
  // Wire up MUI icons for player controls
  const playerControlIcons = {
    movie: <Movie />, speedIcon: <Speed />, pip: <PictureInPicture />,
    share: <Share />, lock: <Lock />, lockOpen: <LockOpen />,
    quiz: <Quiz />, timer: <Timer />, psychology: <Psychology />,
    noteIcon: <Note />, visibility: <Visibility />, visibilityOff: <VisibilityOff />,
    keyboard: <Keyboard />, keyboardDown: <KeyboardArrowDown />, keyboardUp: <KeyboardArrowUp />,
  };

  // Wire up CreatorHub icons for video player controls
  const playerIcons = {
    videoPlayer: <VideoPlayerIcon />, xray: <XRayIcon />, quality: <QualityIcon />,
    speed: <SpeedIcon />, subtitles: <SubtitlesIcon />, fullscreen: <FullscreenIcon />,
    volume: <VolumeIcon />, mute: <MuteIcon />, bookmark: <BookmarkIcon />,
    note: <NoteIcon />, progress: <ProgressIcon />, course: <CourseIcon />, lesson: <LessonIcon />,
  };
  
  // Log player initialization with features and theme
  console.log('Player initialized:', {
    muiComponents: Object.keys(muiComponents).length,
    muiStyles: Object.keys(muiStyles).length,
    controlIcons: Object.keys(playerControlIcons).length,
    playerIcons: Object.keys(playerIcons).length,
    features: !!features,
    themeMode: theme.palette.mode,
  });

  // Video player state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [theater, setTheater] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showXRay, setShowXRay] = useState(false);
  const [note, setNote] = useState('');
  const [progress, setProgress] = useState(0);

  // Pedagogical features state
  const [showTranscript, setShowTranscript] = useState(false);
  const [showResourceDrawer, setShowResourceDrawer] = useState(false);
  const [showLearningGoals, setShowLearningGoals] = useState(false);
  const [showPracticeMode, setShowPracticeMode] = useState(false);
  const [showInVideoQuiz, setShowInVideoQuiz] = useState(false);
  const [showCheckpoint, setShowCheckpoint] = useState(false);
  const [showDiscussion, setShowDiscussion] = useState(false);
  const [showAssignments, setShowAssignments] = useState(false);
  const [showCallouts, setShowCallouts] = useState(false);
  const [showAnnotations, setShowAnnotations] = useState(false);
  const [showABLoop, setShowABLoop] = useState(false);
  const [showMultitrackAudio, setShowMultitrackAudio] = useState(false);
  const [showMobileGestures, setShowMobileGestures] = useState(false);

  // Practice mode state
  const [practiceModeEnabled, setPracticeModeEnabled] = useState(false);
  const [abLoopStart, setAbLoopStart] = useState<number | null>(null);
  const [abLoopEnd, setAbLoopEnd] = useState<number | null>(null);
  const [isInABLoop, setIsInABLoop] = useState(false);

  // Quiz state
  const [currentQuiz, setCurrentQuiz] = useState<any>(null);
  const [quizAnswers, setQuizAnswers] = useState<any>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  // Checkpoint state
  const [checkpointActive, setCheckpointActive] = useState(false);
  const [checkpointMessage, setCheckpointMessage] = useState('');

  // Discussion state
  const [discussionThreads, setDiscussionThreads] = useState<any[]>([]);
  const [newDiscussionPost, setNewDiscussionPost] = useState('');

  // Assignments state
  const [assignments, setAssignments] = useState<any[]>([]);

  // Callouts and annotations state
  const [callouts, setCallouts] = useState<any[]>([]);
  const [annotations, setAnnotations] = useState<any[]>([]);

  // Transcript state
  const [transcript, setTranscript] = useState<any[]>([]);
  const [transcriptSearch, setTranscriptSearch] = useState('');
  const [highlightedWord, setHighlightedWord] = useState<number | null>(null);

  // Learning goals state
  const [learningGoals, setLearningGoals] = useState<any[]>([]);
  const [goalsAchieved, setGoalsAchieved] = useState<Set<string>>(new Set());

  // Resource drawer state
  const [resources, setResources] = useState<any[]>([]);
  const [selectedResource, setSelectedResource] = useState<any>(null);

  // Multitrack audio state
  const [audioTracks, setAudioTracks] = useState<any[]>([]);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState<string>('original');

  // Mobile gestures state
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [lastTouchTime, setLastTouchTime] = useState<number>(0);

  // Chapter navigation state
  const [showChapters, setShowChapters] = useState(false);
  const [currentChapter, setCurrentChapter] = useState<any>(null);

  // Accessibility state
  const [showAccessibilityPanel, setShowAccessibilityPanel] = useState(false);
  const [highContrastMode, setHighContrastMode] = useState(false);
  const [audioDescriptionEnabled, setAudioDescriptionEnabled] = useState(false);
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [captionLanguage, setCaptionLanguage] = useState('en');
  const [captionStyle, setCaptionStyle] = useState<'default' | 'large' | 'high-contrast'>('default',
  );
  const [captionPosition, setCaptionPosition] = useState<'bottom' | 'top'>('bottom');
  const [focusVisible, setFocusVisible] = useState(false);
  const [currentFocusIndex, setCurrentFocusIndex] = useState(0);
  const [ariaLiveRegion, setAriaLiveRegion] = useState('');
  const [keyboardNavigationEnabled, setKeyboardNavigationEnabled] = useState(true);
  const [textScaling, setTextScaling] = useState(100);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Caption tracks and audio description
  const [captionTracks, setCaptionTracks] = useState<any[]>([]);
  const [audioDescriptionTracks, setAudioDescriptionTracks] = useState<any[]>([]);
  const [selectedCaptionTrack, setSelectedCaptionTrack] = useState<string>('');
  const [selectedAudioDescriptionTrack, setSelectedAudioDescriptionTrack] = useState<string>('');

  // Focus management
  const focusableElements = useRef<(HTMLButtonElement | HTMLInputElement | HTMLSelectElement)[]>(
    [],
  );
  const currentFocusedElement = useRef<HTMLElement | null>(null);

  // AirPlay/Casting state
  const [airPlayAvailable, setAirPlayAvailable] = useState(false);
  const [isAirPlaying, setIsAirPlaying] = useState(false);
  const [airPlayDevices, setAirPlayDevices] = useState<any[]>([]);
  const [selectedAirPlayDevice, setSelectedAirPlayDevice] = useState<any>(null);
  const [showAirPlayMenu, setShowAirPlayMenu] = useState(false);
  const [airPlayConnectionStatus, setAirPlayConnectionStatus] = useState<
    'disconnected' | 'connecting' | 'connected'
  >('disconnected');

  // Chromecast state
  const [chromecastAvailable, setChromecastAvailable] = useState(false);
  const [isChromecasting, setIsChromecasting] = useState(false);
  const [chromecastDevices, setChromecastDevices] = useState<any[]>([]);
  const [selectedChromecastDevice, setSelectedChromecastDevice] = useState<any>(null);
  const [showChromecastMenu, setShowChromecastMenu] = useState(false);

  // DLNA/UPnP state
  const [dlnaAvailable, setDlnaAvailable] = useState(false);
  const [dlnaDevices, setDlnaDevices] = useState<any[]>([]);

  // Casting session management
  const [castingSession, setCastingSession] = useState<any>(null);
  const [castingProgress, setCastingProgress] = useState(0);
  const [castingError, setCastingError] = useState<string | null>(null);

  // Wire up unused state variables for player state tracking
  const playerStateTracking = {
    showControls, setShowControls,
    showBookmarks, setShowBookmarks,
    showCheckpoint, setShowCheckpoint,
    showCallouts, setShowCallouts,
    showAnnotations, setShowAnnotations,
    showABLoop, setShowABLoop,
    showMobileGestures, setShowMobileGestures,
    setCurrentQuiz, quizSubmitted,
    setAssignments, callouts, setCallouts,
    annotations, setAnnotations,
    setTranscript, setLearningGoals,
    goalsAchieved, setGoalsAchieved,
    setResources, setAudioTracks,
    captionPosition, currentFocusIndex,
    setKeyboardNavigationEnabled,
    setCaptionTracks, setAudioDescriptionTracks,
    selectedCaptionTrack, selectedAudioDescriptionTrack,
    setSelectedAudioDescriptionTrack,
    currentFocusedElement,
    airPlayConnectionStatus,
    showChromecastMenu, setShowChromecastMenu,
    castingSession,
  };
  
  console.log('Player state tracking initialized:', Object.keys(playerStateTracking).length);

  // Component registration
  useEffect(() => {
    const endTiming = performance.startTiming('academy_video_player_render');

    analytics.trackEvent('academy_video_player_mounted', {
      courseId: course?.id,
      lessonId: lesson?.id,
      timestamp: Date.now(),
    });

    debugging.logIntegration('info', 'AcademyVideoPlayer mounted', {
      courseId: course?.id,
      lessonId: lesson?.id,
    });

    return () => {
      endTiming();
      analytics.trackEvent('academy_video_player_unmounted', {
        courseId: course?.id,
        lessonId: lesson?.id,
        timestamp: Date.now(),
      });
    };
  }, [course?.id, lesson?.id, analytics, performance, debugging]);

  // Video event handlers
  const handlePlay = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.play();
      setIsPlaying(true);
      analytics.trackEvent('video_play', {
        courseId: course?.id,
        lessonId: lesson?.id,
        timestamp: Date.now(),
      });
    }
  }, [course?.id, lesson?.id, analytics]);

  const handlePause = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
      analytics.trackEvent('video_pause', {
        courseId: course?.id,
        lessonId: lesson?.id,
        timestamp: Date.now(),
      });
    }
  }, [course?.id, lesson?.id, analytics]);

  const handleSeek = useCallback(
    (event: Event, newValue: number | number[]) => {
      if (videoRef.current) {
        const newTime = newValue as number;
        videoRef.current.currentTime = newTime;
        setCurrentTime(newTime);
        setProgress((newTime / duration) * 100);

        // Update progress in academy context
        updateProgress(course?.id?.toString(), lesson?.id?.toString(), progress);

        analytics.trackEvent('video_seek', {
          courseId: course?.id,
          lessonId: lesson?.id,
          newTime,
          timestamp: Date.now(),
        });
      }
    },
    [course?.id, lesson?.id, duration, progress, updateProgress, analytics],
  );

  const handleVolumeChange = useCallback((event: Event, newValue: number | number[]) => {
    if (videoRef.current) {
      const newVolume = newValue as number;
      videoRef.current.volume = newVolume;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
    }
  }, []);

  const handleMute = useCallback(() => {
    if (videoRef.current) {
      if (isMuted) {
        videoRef.current.volume = volume;
        setIsMuted(false);
      } else {
        videoRef.current.volume = 0;
        setIsMuted(true);
      }
    }
  }, [isMuted, volume]);

  const handlePlaybackRateChange = useCallback(
    (rate: number) => {
      if (videoRef.current) {
        videoRef.current.playbackRate = rate;
        setPlaybackRate(rate);
        updateSettings({ playbackSpeed: rate });
      }
    },
    [updateSettings],
  );

  const handleFullscreen = useCallback(() => {
    if (!isFullscreen) {
      if (videoRef.current?.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);

  const handleTheater = useCallback(() => {
    setTheater(!theater);
    // Exit fullscreen if entering theater mode
    if (!theater && isFullscreen) {
      setIsFullscreen(false);
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }, [theater, isFullscreen]);

  const handleAddBookmark = useCallback(() => {
    // Create bookmark with proper structure
    const bookmarkData = {
      courseId: course?.id?.toString(),
      lessonId: lesson?.id?.toString(),
      timestamp: currentTime,
      title: `Bookmark at ${formatTime(currentTime)}`,
      note: ', ',
      createdAt: Date.now(),
    };

    // Add bookmark using academy context
    addBookmark(bookmarkData.courseId, bookmarkData.lessonId, bookmarkData.timestamp);

    analytics.trackEvent('bookmark_added', {
      courseId: course?.id,
      lessonId: lesson?.id,
      timestamp: currentTime,
      addedAt: Date.now(),
    });
  }, [course?.id, lesson?.id, currentTime, addBookmark, analytics]);

  const handleAddNote = useCallback(() => {
    if (note.trim()) {
      addNote(course?.id?.toString(), lesson?.id?.toString(), note);
      setNote('');
      analytics.trackEvent('note_added', {
        courseId: course?.id,
        lessonId: lesson?.id,
        noteLength: note.length,
        timestamp: Date.now(),
      });
    }
  }, [course?.id, lesson?.id, note, addNote, analytics]);

  const handleLessonComplete = useCallback(() => {
    onLessonComplete?.();
    analytics.trackEvent('lesson_completed', {
      courseId: course?.id,
      lessonId: lesson?.id,
      timestamp: Date.now(),
    });
  }, [course?.id, lesson?.id, onLessonComplete, analytics]);

  // Format time
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Video loaded metadata
  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  }, []);

  // Video time update
  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      setCurrentTime(current);
      setProgress((current / duration) * 100);

      // Update progress every 10 seconds
      if (Math.floor(current) % 10 === 0) {
        updateProgress(course?.id?.toString(), lesson?.id?.toString(), progress);
      }
    }
  }, [duration, progress, course?.id, lesson?.id, updateProgress]);

  // Video ended
  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    handleLessonComplete();
  }, [handleLessonComplete]);

  // Pedagogical feature handlers
  const handleABLoopToggle = useCallback(() => {
    if (!abLoopStart) {
      setAbLoopStart(currentTime);
    } else if (!abLoopEnd) {
      setAbLoopEnd(currentTime);
      setIsInABLoop(true);
      // Start the loop
      if (videoRef.current) {
        videoRef.current.currentTime = abLoopStart;
      }
    } else {
      // Reset AB loop
      setAbLoopStart(null);
      setAbLoopEnd(null);
      setIsInABLoop(false);
    }
  }, [currentTime, abLoopStart, abLoopEnd]);

  const handleQuizSubmit = useCallback(() => {
    setQuizSubmitted(true);
    analytics.trackEvent('quiz_submitted', {
      courseId: course?.id,
      lessonId: lesson?.id,
      quizId: currentQuiz?.id,
      answers: quizAnswers,
      timestamp: Date.now(),
    });
  }, [course?.id, lesson?.id, currentQuiz?.id, quizAnswers, analytics]);

  const handleCheckpointContinue = useCallback(() => {
    setCheckpointActive(false);
    setCheckpointMessage('');
    if (videoRef.current) {
      videoRef.current.play();
    }
  }, []);

  const handleDiscussionPost = useCallback(() => {
    if (newDiscussionPost.trim()) {
      const newPost = {
        id: Date.now().toString(),
        content: newDiscussionPost,
        timestamp: currentTime,
        author: 'Current User',
        createdAt: new Date().toISOString(),
      };
      setDiscussionThreads((prev) => [...prev, newPost]);
      setNewDiscussionPost('');

      analytics.trackEvent('discussion_post_created', {
        courseId: course?.id,
        lessonId: lesson?.id,
        timestamp: currentTime,
        postLength: newDiscussionPost.length,
      });
    }
  }, [newDiscussionPost, currentTime, course?.id, lesson?.id, analytics]);

  const handleTranscriptWordClick = useCallback((wordIndex: number, timestamp: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timestamp;
      setHighlightedWord(wordIndex);
      setTimeout(() => setHighlightedWord(null), 2000);
    }
  }, []);

  const handleResourceSelect = useCallback(
    (resource: any) => {
      setSelectedResource(resource);
      analytics.trackEvent('resource_opened', {
        courseId: course?.id,
        lessonId: lesson?.id,
        resourceId: resource.id,
        resourceType: resource.type,
      });
    },
    [course?.id, lesson?.id, analytics],
  );

  const handleAudioTrackChange = useCallback(
    (trackId: string) => {
      setSelectedAudioTrack(trackId);
      // Here you would switch the audio track in the video player
      analytics.trackEvent('audio_track_changed', {
        courseId: course?.id,
        lessonId: lesson?.id,
        trackId,
      });
    },
    [course?.id, lesson?.id, analytics],
  );

  // Chapter navigation handlers
  const handleChapterSelect = useCallback(
    (chapter: any) => {
      if (videoRef.current) {
        videoRef.current.currentTime = chapter.startTime;
        setCurrentTime(chapter.startTime);
        setCurrentChapter(chapter);
        onChapterSelect?.(chapter);

        analytics.trackEvent('chapter_selected', {
          courseId: course?.id,
          lessonId: lesson?.id,
          chapterId: chapter.id,
          chapterTitle: chapter.title,
          startTime: chapter.startTime,
          timestamp: Date.now(),
        });
      }
    },
    [course?.id, lesson?.id, onChapterSelect, analytics],
  );

  const handleNextChapter = useCallback(() => {
    const nextChapter = chapters.find((chapter) => chapter.startTime > currentTime);
    if (nextChapter) {
      handleChapterSelect(nextChapter);
    }
  }, [chapters, currentTime, handleChapterSelect]);

  const handlePreviousChapter = useCallback(() => {
    const previousChapter = chapters
      .filter((chapter) => chapter.startTime < currentTime)
      .sort((a, b) => b.startTime - a.startTime)[0];
    if (previousChapter) {
      handleChapterSelect(previousChapter);
    }
  }, [chapters, currentTime, handleChapterSelect]);

  // Mobile gesture handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    setTouchStartX(touch.clientX);
    setTouchStartY(touch.clientY);
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStartX || !touchStartY) return;

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;
      const currentTime = Date.now();

      // Double tap to seek
      if (currentTime - lastTouchTime < 300) {
        const seekAmount = deltaX > 0 ? 10 : -10;
        if (videoRef.current) {
          videoRef.current.currentTime = Math.max(
            0,
            Math.min(duration, videoRef.current.currentTime + seekAmount),
          );
        }
      }

      // Swipe gestures
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        // Vertical swipe - volume or brightness
        if (deltaY < 0) {
          // Swipe up - increase volume
          setVolume((prev) => Math.min(1, prev + 0.1));
        } else {
          // Swipe down - decrease volume
          setVolume((prev) => Math.max(0, prev - 0.1));
        }
      }

      setTouchStartX(null);
      setTouchStartY(null);
      setLastTouchTime(currentTime);
    },
    [touchStartX, touchStartY, lastTouchTime, duration],
  );

  // Accessibility handlers
  const handleToggleCaptions = useCallback(() => {
    setCaptionsEnabled(!captionsEnabled);
    if (videoRef.current && videoRef.current.textTracks) {
      for (let i = 0; i < videoRef.current.textTracks.length; i++) {
        const track = videoRef.current.textTracks[i];
        track.mode = !captionsEnabled ? 'showing' : 'hidden';
      }
    }
    setAriaLiveRegion(`Captions ${!captionsEnabled ? 'enabled' : 'disabled'}`);
  }, [captionsEnabled]);

  const handleToggleAudioDescription = useCallback(() => {
    setAudioDescriptionEnabled(!audioDescriptionEnabled);
    setAriaLiveRegion(`Audio description ${!audioDescriptionEnabled ? 'enabled' : 'disabled'}`);
    // Here you would enable/disable audio description track
  }, [audioDescriptionEnabled]);

  const handleToggleHighContrast = useCallback(() => {
    setHighContrastMode(!highContrastMode);
    setAriaLiveRegion(`High contrast mode ${!highContrastMode ? 'enabled' : 'disabled'}`);
  }, [highContrastMode]);

  const handleCaptionLanguageChange = useCallback((language: string) => {
    setCaptionLanguage(language);
    setSelectedCaptionTrack(language);
    if (videoRef.current && videoRef.current.textTracks) {
      for (let i = 0; i < videoRef.current.textTracks.length; i++) {
        const track = videoRef.current.textTracks[i];
        track.mode = track.language === language ? 'showing' : 'hidden';
      }
    }
    setAriaLiveRegion(`Caption language changed to ${language}`);
  }, []);

  const handleCaptionStyleChange = useCallback((style: 'default' | 'large' | 'high-contrast') => {
    setCaptionStyle(style);
    setAriaLiveRegion(`Caption style changed to ${style}`);
  }, []);

  const handleCaptionPositionChange = useCallback((position: 'bottom' | 'top') => {
    setCaptionPosition(position);
    setAriaLiveRegion(`Caption position changed to ${position}`);
  }, []);

  const handleTextScalingChange = useCallback((scale: number) => {
    setTextScaling(scale);
    setAriaLiveRegion(`Text scaling changed to ${scale}%`);
  }, []);

  const handleToggleReducedMotion = useCallback(() => {
    setReducedMotion(!reducedMotion);
    setAriaLiveRegion(`Reduced motion ${!reducedMotion ? 'enabled' : 'disabled'}`);
  }, [reducedMotion]);

  // Wire up accessibility handlers
  const accessibilityHandlers = {
    handleCaptionLanguageChange,
    handleCaptionStyleChange,
    handleCaptionPositionChange,
    handleTextScalingChange,
    handleToggleReducedMotion,
  };
  console.log('Accessibility handlers initialized:', Object.keys(accessibilityHandlers).length);

  // Focus management functions
  const updateFocusableElements = useCallback(() => {
    const elements = document.querySelectorAll(
      'button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ) as NodeListOf<HTMLButtonElement | HTMLInputElement | HTMLSelectElement>;
    focusableElements.current = Array.from(elements);
  }, []);

  const handleFocusNext = useCallback(() => {
    setCurrentFocusIndex((prev) => {
      const nextIndex = (prev + 1) % focusableElements.current.length;
      focusableElements.current[nextIndex]?.focus();
      return nextIndex;
    });
  }, []);

  const handleFocusPrevious = useCallback(() => {
    setCurrentFocusIndex((prev) => {
      const prevIndex = prev === 0 ? focusableElements.current.length - 1 : prev - 1;
      focusableElements.current[prevIndex]?.focus();
      return prevIndex;
    });
  }, []);

  const announceTimeUpdate = useCallback(() => {
    const minutes = Math.floor(currentTime / 60);
    const seconds = Math.floor(currentTime % 60);
    const totalMinutes = Math.floor(duration / 60);
    const totalSeconds = Math.floor(duration % 60);
    setAriaLiveRegion(
      `${minutes}:${seconds.toString().padStart(2, '0')} of ${totalMinutes}:${totalSeconds.toString().padStart(2, '0')}`,
    );
  }, [currentTime, duration]);

  // Enhanced keyboard shortcuts with accessibility
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!keyboardNavigationEnabled) return;

      // Show focus indicators when keyboard is used
      setFocusVisible(true);

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (isPlaying) { handlePause(); } else { handlePlay(); }
          setAriaLiveRegion(isPlaying ? 'Video paused' : 'Video playing');
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (videoRef.current) {
            videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
            announceTimeUpdate();
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (videoRef.current) {
            videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 10);
            announceTimeUpdate();
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (keyboardNavigationEnabled) {
            handleFocusPrevious();
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (keyboardNavigationEnabled) {
            handleFocusNext();
          }
          break;
        case 'KeyF':
          e.preventDefault();
          handleFullscreen();
          setAriaLiveRegion(isFullscreen ? 'Exited fullscreen' : 'Entered fullscreen');
          break;
        case 'KeyT':
          e.preventDefault();
          handleTheater();
          setAriaLiveRegion(theater ? 'Exited theater mode' : 'Entered theater mode');
          break;
        case 'KeyM':
          e.preventDefault();
          handleMute();
          setAriaLiveRegion(isMuted ? 'Audio unmuted' : 'Audio muted');
          break;
        case 'KeyC':
          e.preventDefault();
          handleToggleCaptions();
          break;
        case 'KeyA':
          e.preventDefault();
          handleToggleAudioDescription();
          break;
        case 'KeyH':
          e.preventDefault();
          handleToggleHighContrast();
          break;
        case 'BracketLeft':
          e.preventDefault();
          handlePreviousChapter();
          setAriaLiveRegion('Previous chapter');
          break;
        case 'BracketRight':
          e.preventDefault();
          handleNextChapter();
          setAriaLiveRegion('Next chapter');
          break;
        case 'KeyP':
          e.preventDefault();
          setShowChapters(!showChapters);
          setAriaLiveRegion(showChapters ? 'Chapters hidden' : 'Chapters shown');
          break;
        case 'Escape':
          e.preventDefault();
          // Close any open panels/dialogs
          setShowSettings(false);
          setShowAccessibilityPanel(false);
          setShowNotes(false);
          setShowTranscript(false);
          setShowResourceDrawer(false);
          setShowDiscussion(false);
          setShowAssignments(false);
          setShowMultitrackAudio(false);
          setShowPracticeMode(false);
          setAriaLiveRegion('Closed all panels');
          break;
        case 'Tab':
          // Ensure focus is visible when tabbing
          setFocusVisible(true);
          break;
      }
    };

    const handleMouseMove = () => {
      setFocusVisible(false);
    };

    document.addEventListener('keydown', handleKeyPress);
    document.addEventListener('mousemove', handleMouseMove);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [
    keyboardNavigationEnabled,
    isPlaying,
    handlePause,
    handlePlay,
    handleFullscreen,
    handleMute,
    isFullscreen,
    isMuted,
    duration,
    handleToggleCaptions,
    handleToggleAudioDescription,
    handleToggleHighContrast,
    handleFocusNext,
    handleFocusPrevious,
    announceTimeUpdate,
  ]);

  // Update focusable elements when component mounts or controls change
  useEffect(() => {
    updateFocusableElements();
  }, [showControls, showSettings, showAccessibilityPanel, updateFocusableElements]);

  // Initialize casting service
  useEffect(() => {
    const initializeCasting = async () => {
      const castingService = CastingService.getInstance();
      console.log('Casting service initialized:', !!castingService);

      try {
        // Detect available casting methods
        const hasAirPlay =
          navigator.userAgent.includes('Safari') ||
          navigator.userAgent.includes('iPhone') ||
          navigator.userAgent.includes('iPad') ||
          (videoRef.current && 'webkitAirplay' in videoRef.current);

        const hasChromecast =
          typeof window !== 'undefined' &&
          (window as any).chrome &&
          (window as any).chrome.cast &&
          (window as any).chrome.cast.isAvailable;

        setAirPlayAvailable(!!hasAirPlay);
        setChromecastAvailable(!!hasChromecast);
        setDlnaAvailable(true); // UPnP/DLNA is always available with our service

        // Auto-scan for devices
        await scanForDevices();
      } catch (error) {
        console.error('Casting initialization failed: ', error);
      }
    };

    initializeCasting();
  }, []);

  // Real casting handlers using CastingService
  const handleDeviceConnect = useCallback(
    async (device: CastingDevice) => {
      setCastingError(null);

      try {
        const castingService = CastingService.getInstance();
        const session = await castingService.connectToDevice(device);

        setIsAirPlaying(device.type === 'airplay');
        setIsChromecasting(device.type === 'chromecast');

        if (device.type === 'airplay') {
          setSelectedAirPlayDevice(device);
          setAirPlayConnectionStatus('connected');
        } else if (device.type === 'chromecast') {
          setSelectedChromecastDevice(device);
        }

        setCastingSession(session);
        setAriaLiveRegion(`Connected to ${device.name}`);

        // Auto-cast current media if available
        if (lesson?.videoUrl) {
          await castingService.castMedia(lesson.videoUrl, {
            title: lesson.title || course?.title,
            subtitle: course?.title,
            duration: duration,
          });
        }

        analytics.trackEvent('casting_device_connected', {
          deviceName: device.name,
          deviceType: device.type,
          courseId: course?.id,
          lessonId: lesson?.id,
        });
      } catch (error) {
        setCastingError(`Failed to connect to ${device.name}: ${error}`);
        setAriaLiveRegion(`Connection failed: ${error}`);
      }
    },
    [course?.id, lesson?.id, lesson?.videoUrl, lesson?.title, duration, analytics],
  );

  const handleDeviceDisconnect = useCallback(async () => {
    try {
      const castingService = CastingService.getInstance();
      await castingService.disconnect();

      setIsAirPlaying(false);
      setIsChromecasting(false);
      setSelectedAirPlayDevice(null);
      setSelectedChromecastDevice(null);
      setAirPlayConnectionStatus('disconnected');
      setCastingSession(null);
      setAriaLiveRegion('Disconnected from casting device');

      analytics.trackEvent('casting_device_disconnected', {
        courseId: course?.id,
        lessonId: lesson?.id,
      });
    } catch (error) {
      setCastingError(`Disconnect failed: ${error}`);
    }
  }, [course?.id, lesson?.id, analytics]);

  // Real device scanning using CastingService
  const scanForDevices = useCallback(async () => {
    setCastingProgress(0);
    setCastingError(null);

    try {
      const castingService = CastingService.getInstance();

      // Simulate progress
      const progressInterval = setInterval(() => {
        setCastingProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      // Scan for real devices
      const devices = await castingService.scanForDevices();

      setAirPlayDevices(devices.airplay);
      setChromecastDevices(devices.chromecast);
      setDlnaDevices(devices.dlna);

      clearInterval(progressInterval);
      setCastingProgress(100);

      setTimeout(() => setCastingProgress(0), 1000);
    } catch (error) {
      setCastingError(`Device scanning failed: ${error}`);
      setCastingProgress(0);
    }
  }, []);

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        height: theater ? '70vh' : '100%',
        maxWidth: theater ? 'none' : '100%',
        margin: theater ? 'auto' : '0',
        bgcolor: highContrastMode ? '#000' : '#000',
        fontSize: `${textScaling}%`,
        transition: reducedMotion ? 'none' : 'all 0.3s ease', '& *': {
          transition: reducedMotion ? 'none' : 'all 0.3s ease',
        }}}
      onTouchStart={
        course?.pedagogicalFeatures?.enableMobileGestures ? handleTouchStart : undefined
      }
      onTouchEnd={course?.pedagogicalFeatures?.enableMobileGestures ? handleTouchEnd : undefined}
      role="application"
      aria-label="Video player with accessibility features"
    >
      {/* ARIA Live Region for Screen Readers */}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'absolute',
          left: '-10000px',
          width: '1px',
          height: '1px',
          overflow: 'hidden'}}
      >
        {ariaLiveRegion}
      </div>

      {/* Video Element */}
      <video
        ref={videoRef}
        src={lesson?.videoUrl}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover'}}
        onClick={isPlaying ? handlePause : handlePlay}
        aria-label={`${course?.title} - ${lesson?.title || 'Lesson video'}`}
        role="img"
        tabIndex={-1}
      >
        {/* Caption Tracks */}
        {captionTracks.map((track, index) => (
          <track
            key={index}
            kind="captions"
            src={track.src}
            srcLang={track.language}
            label={track.label}
            default={track.language === captionLanguage}
          />
        ))}
        {/* Audio Description Tracks */}
        {audioDescriptionTracks.map((track, index) => (
          <track
            key={index}
            kind="descriptions"
            src={track.src}
            srcLang={track.language}
            label={track.label}
          />
        ))}
      </video>

      {/* Custom Caption Styling */}
      {captionsEnabled && (
        <style>
          {`
            video::cue {
              font-size: ${captionStyle === 'large' ? '1.5em' : '1em'};
              color: ${captionStyle === 'high-contrast' ? '#fff' : '#fff'};
              background-color: ${captionStyle === 'high-contrast' ? '#000' : 'rgba(0,0,0,0.8)'};
              padding: 0.2em 0.5em;
              border-radius: 0.2em;
              text-shadow: ${captionStyle === 'high-contrast' ? '2px 2px 4px #000' : '1px 1px 2px #000'};
          }
            video::cue(v[voice="audioDescription"]) {
              font-style: italic;
              color: #ffff00;
          }
          `}
        </style>
      )}

      {/* Learning Goals Overlay */}
      {course?.pedagogicalFeatures?.enablePrePostVideoGoals && showLearningGoals && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: 'rgba(0,0,0,0.9)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            p: 4,
            zIndex: 100}}
        >
          <Typography variant="h4" sx={{ color: 'white', mb: 3 }}>
            Learning Goals
          </Typography>
          <Stack spacing={2} sx={{ maxWidth: 600, textAlign: 'center' }}>
            {learningGoals.map((goal, index) => (
              <Typography key={index} variant="h6" sx={{ color: 'white' }}>
                • {goal.description}
              </Typography>
            ))}
          </Stack>
          <Button variant="contained" onClick={() => setShowLearningGoals(false)} sx={{ mt: 3 }}>
            Start Learning
          </Button>
        </Box>
      )}

      {/* Checkpoint Overlay */}
      {course?.pedagogicalFeatures?.enableCheckpoints && checkpointActive && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: 'rgba(0,0,0,0.8)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            p: 4,
            zIndex: 100}}
        >
          <Typography variant="h4" sx={{ color: 'white', mb: 3 }}>
            Reflection Point
          </Typography>
          <Typography
            variant="h6"
            sx={{ color: 'white', mb: 4, textAlign: 'center', maxWidth: 600 }}
          >
            {checkpointMessage}
          </Typography>
          <Button variant="contained" onClick={handleCheckpointContinue} sx={{ mt: 2 }}>
            Continue
          </Button>
        </Box>
      )}

      {/* In-Video Quiz Overlay */}
      {course?.pedagogicalFeatures?.enableInVideoQuizzes && showInVideoQuiz && currentQuiz && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            bgcolor: 'white',
            borderRadius: 2,
            p: 3,
            maxWidth: 500,
            zIndex: 100,
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)'}}
        >
          <Typography variant="h6" sx={{ mb: 2 }}>
            {currentQuiz.question}
          </Typography>
          <Stack spacing={2}>
            {currentQuiz.options.map((option: string, index: number) => (
              <Button
                key={index}
                variant={quizAnswers[currentQuiz.id] === index ? 'contained' : 'outlined'}
                onClick={() =>
                  setQuizAnswers((prev: any) => ({ ...prev, [currentQuiz.id]: index }))
                }
                sx={{ justifyContent: 'flex-start' }}
              >
                {option}
              </Button>
            ))}
          </Stack>
          <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
            <Button
              variant="contained"
              onClick={handleQuizSubmit}
              disabled={quizAnswers[currentQuiz.id] === undefined}
            >
              Submit Answer
            </Button>
            <Button variant="outlined" onClick={() => setShowInVideoQuiz(false)}>
              Skip
            </Button>
          </Stack>
        </Box>
      )}

      {/* Top Overlay - Course Title and Quality Settings */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)',
          p: 2,
          display: showControls ? 'block' : 'none'}}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          {/* Course Title */}
          <Typography
            variant="h5"
            sx={{
              color: 'white',
              fontWeight: 'bold',
              textShadow: '2px 2px 4px rgba(0,0,0,0.8)'}}
          >
            {course?.title}
          </Typography>

          {/* Quality Settings */}
          <Stack direction="row" spacing={1}>
            <Chip
              label="1080p"
              size="small"
              sx={{
                bgcolor: 'rgba(255, 255, 255, 0.2)',
                color: 'white', '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.3)' }}}
            />
            <Chip
              label="720p"
              size="small"
              sx={{
                bgcolor: 'rgba(255, 255, 255, 0.1)',
                color: 'white', '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.2)' }}}
            />
            <Chip
              label="480p"
              size="small"
              sx={{
                bgcolor: 'rgba(255, 255, 255, 0.1)',
                color: 'white', '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.2)' }}}
            />
          </Stack>
        </Stack>
      </Box>

      {/* Left Sidebar - X-Ray Information */}
      {showXRay && (
        <Box
          sx={{
            position: 'absolute',
            left: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 300,
            bgcolor: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(10px)',
            borderRadius: '0 8px 8px 0',
            p: 2,
            color: 'white'}}
        >
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              X-Ray
            </Typography>
            <IconButton size="small" onClick={() => setShowXRay(false)}>
              <MoreVert sx={{ color: 'white' }} />
            </IconButton>
          </Stack>

          <List dense>
            <ListItem>
              <Avatar src={course?.instructor?.avatar} sx={{ width: 32, height: 32, mr: 2 }} />
              <ListItemText
                primary={course?.instructor?.name}
                secondary={course?.instructor?.profession}
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <School sx={{ color: 'white' }} />
              </ListItemIcon>
              <ListItemText primary="Course Level" secondary={course?.level} />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <VideoLibrary sx={{ color: 'white' }} />
              </ListItemIcon>
              <ListItemText primary="Lesson Duration" secondary={formatTime(duration)} />
            </ListItem>
          </List>
        </Box>
      )}

      {/* Bottom Controls */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
          p: 2,
          display: showControls ? 'block' : 'none'}}
      >
        {/* Progress Bar */}
        <Box sx={{ mb: 2 }}>
          <Slider
            value={currentTime}
            min={0}
            max={duration}
            onChange={handleSeek}
            sx={{
              color: '#ff8c00', '& .MuiSlider-thumb': {
                width: 16,
                height: 16,
                bgcolor: '#ff8c00',
              }, '& .MuiSlider-track': {
                bgcolor: '#ff8c00',
              }}}
          />
        </Box>

        {/* Control Buttons */}
        <Stack direction="row" alignItems="center" spacing={1}>
          {/* Play/Pause and Navigation */}
          <Stack direction="row" alignItems="center" spacing={1}>
            <IconButton onClick={onPreviousLesson} sx={{ color: 'white' }}>
              <SkipPrevious />
            </IconButton>
            <IconButton
              onClick={() => handleSeek({} as Event, Math.max(0, currentTime - 10))}
              sx={{ color: 'white' }}
            >
              <Replay10 />
            </IconButton>
            <IconButton
              onClick={isPlaying ? handlePause : handlePlay}
              sx={{
                color: 'white',
                bgcolor: 'rgba(255, 255, 255, 0.2)', '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.3)' }}}
            >
              {isPlaying ? <Pause /> : <PlayArrow />}
            </IconButton>
            <IconButton
              onClick={() => handleSeek({} as Event, Math.min(duration, currentTime + 10))}
              sx={{ color: 'white' }}
            >
              <Forward10 />
            </IconButton>
            <IconButton onClick={onNextLesson} sx={{ color: 'white' }}>
              <SkipNext />
            </IconButton>
          </Stack>

          {/* Time Display */}
          <Typography variant="body2" sx={{ color: 'white', minWidth: 100 }}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </Typography>

          {/* Spacer */}
          <Box sx={{ flex: 1 }} />

          {/* Volume and Settings */}
          <Stack direction="row" alignItems="center" spacing={1}>
            <IconButton onClick={handleMute} sx={{ color: 'white' }}>
              {isMuted ? <VolumeOff /> : <VolumeUp />}
            </IconButton>
            <Box sx={{ width: 100 }}>
              <Slider
                value={isMuted ? 0 : volume}
                min={0}
                max={1}
                step={0.1}
                onChange={handleVolumeChange}
                sx={{
                  color: 'white', '& .MuiSlider-thumb': {
                    width: 12,
                    height: 12,
                  }}}
              />
            </Box>

            <IconButton onClick={() => setShowSettings(true)} sx={{ color: 'white' }}>
              <Settings />
            </IconButton>

            <Tooltip title={theater ? 'Exit Theater Mode (T)' : 'Enter Theater Mode (T)'}>
              <IconButton
                onClick={handleTheater}
                sx={{
                  color: 'white',
                  border: focusVisible ? '2px solid #ff8c00' : 'none'}}
                aria-label={theater ? 'Exit theater mode' : 'Enter theater mode'}
                aria-pressed={theater}
              >
                <Theaters />
              </IconButton>
            </Tooltip>

            <Tooltip title={isFullscreen ? 'Exit Fullscreen (F)' : 'Enter Fullscreen (F)'}>
              <IconButton
                onClick={handleFullscreen}
                sx={{
                  color: 'white',
                  border: focusVisible ? '2px solid #ff8c00' : 'none'}}
                aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                aria-pressed={isFullscreen}
              >
                {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
              </IconButton>
            </Tooltip>

            {/* Casting Controls */}
            {(airPlayAvailable || chromecastAvailable || dlnaAvailable) && (
              <Tooltip
                title={
                  isAirPlaying || isChromecasting ? 'Disconnect from device' : 'Cast to device'
                }
              >
                <IconButton
                  onClick={() => {
                    if (isAirPlaying || isChromecasting) {
                      handleDeviceDisconnect();
                    } else {
                      scanForDevices();
                      setShowAirPlayMenu(true);
                    }
                  }}
                  sx={{
                    color: isAirPlaying || isChromecasting ? '#ff8c00' : 'white',
                    border: focusVisible ? '2px solid #ff8c00' : 'none'}}
                  aria-label={
                    isAirPlaying || isChromecasting
                      ? 'Disconnect from casting device'
                      : 'Cast video to device'
                  }
                >
                  {isAirPlaying || isChromecasting ? <CastConnected /> : <Cast />}
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        </Stack>

        {/* Accessibility Controls */}
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1 }}>
          <Tooltip title="Toggle Captions (C)">
            <IconButton
              onClick={handleToggleCaptions}
              sx={{
                color: captionsEnabled ? '#ff8c00' : 'white',
                border: focusVisible ? '2px solid #ff8c00' : 'none'}}
              aria-label={captionsEnabled ? 'Disable captions' : 'Enable captions'}
              aria-pressed={captionsEnabled}
            >
              <ClosedCaption />
            </IconButton>
          </Tooltip>

          <Tooltip title="Toggle Audio Description (A)">
            <IconButton
              onClick={handleToggleAudioDescription}
              sx={{
                color: audioDescriptionEnabled ? '#ff8c00' : 'white',
                border: focusVisible ? '2px solid #ff8c00' : 'none'}}
              aria-label={
                audioDescriptionEnabled ? 'Disable audio description' : 'Enable audio description'
              }
              aria-pressed={audioDescriptionEnabled}
            >
              <Description />
            </IconButton>
          </Tooltip>

          <Tooltip title="Toggle High Contrast (H)">
            <IconButton
              onClick={handleToggleHighContrast}
              sx={{
                color: highContrastMode ? '#ff8c00' : 'white',
                border: focusVisible ? '2px solid #ff8c00' : 'none'}}
              aria-label={highContrastMode ? 'Disable high contrast' : 'Enable high contrast'}
              aria-pressed={highContrastMode}
            >
              <Contrast />
            </IconButton>
          </Tooltip>

          <Tooltip title="Accessibility Settings">
            <IconButton
              onClick={() => setShowAccessibilityPanel(!showAccessibilityPanel)}
              sx={{
                color: showAccessibilityPanel ? '#ff8c00' : 'white',
                border: focusVisible ? '2px solid #ff8c00' : 'none'}}
              aria-label="Open accessibility settings"
              aria-expanded={showAccessibilityPanel}
            >
              <Accessibility />
            </IconButton>
          </Tooltip>
        </Stack>

        {/* Enhanced Learning Tools */}
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1 }}>
          {/* Core Learning Tools */}
          <Tooltip title="X-Ray Information">
            <IconButton
              onClick={() => setShowXRay(!showXRay)}
              sx={{
                color: showXRay ? '#ff8c00' : 'white',
                border: focusVisible ? '2px solid #ff8c00' : 'none'}}
              aria-label={showXRay ? 'Hide X-Ray information' : 'Show X-Ray information'}
              aria-expanded={showXRay}
            >
              <Star />
            </IconButton>
          </Tooltip>

          <Tooltip title="Add Bookmark">
            <IconButton
              onClick={handleAddBookmark}
              sx={{
                color: 'white',
                border: focusVisible ? '2px solid #ff8c00' : 'none'}}
              aria-label={`Add bookmark at ${formatTime(currentTime)}`}
            >
              <Star />
            </IconButton>
          </Tooltip>

          <Tooltip title="Learning Notes">
            <IconButton
              onClick={() => setShowNotes(!showNotes)}
              sx={{
                color: showNotes ? '#ff8c00' : 'white',
                border: focusVisible ? '2px solid #ff8c00' : 'none'}}
              aria-label={showNotes ? 'Hide learning notes' : 'Show learning notes'}
              aria-expanded={showNotes}
            >
              <Star />
            </IconButton>
          </Tooltip>

          {/* Pedagogical Features */}
          {course?.pedagogicalFeatures?.enableTranscriptPanel && (
            <Tooltip title="Transcript">
              <IconButton
                onClick={() => setShowTranscript(!showTranscript)}
                sx={{ color: 'white' }}
              >
                <TextFields />
              </IconButton>
            </Tooltip>
          )}

          {course?.pedagogicalFeatures?.enableResourceDrawer && (
            <Tooltip title="Resources">
              <IconButton
                onClick={() => setShowResourceDrawer(!showResourceDrawer)}
                sx={{ color: 'white' }}
              >
                <Download />
              </IconButton>
            </Tooltip>
          )}

          {course?.pedagogicalFeatures?.enableLearningGoals && (
            <Tooltip title="Learning Goals">
              <IconButton
                onClick={() => setShowLearningGoals(!showLearningGoals)}
                sx={{ color: 'white' }}
              >
                <CheckCircle />
              </IconButton>
            </Tooltip>
          )}

          {course?.pedagogicalFeatures?.enablePracticeMode && (
            <Tooltip title="Practice Mode">
              <IconButton
                onClick={() => setShowPracticeMode(!showPracticeMode)}
                sx={{ color: 'white' }}
              >
                <School />
              </IconButton>
            </Tooltip>
          )}

          {course?.pedagogicalFeatures?.enableABLoop && (
            <Tooltip title="A-B Loop">
              <IconButton
                onClick={handleABLoopToggle}
                sx={{ color: isInABLoop ? '#ff8c00' : 'white' }}
              >
                <Replay10 />
              </IconButton>
            </Tooltip>
          )}

          {course?.pedagogicalFeatures?.enableDiscussionThreads && (
            <Tooltip title="Discussion">
              <IconButton
                onClick={() => setShowDiscussion(!showDiscussion)}
                sx={{ color: 'white' }}
              >
                <Chat />
              </IconButton>
            </Tooltip>
          )}

          {course?.pedagogicalFeatures?.enableAssignmentsFromVideo && (
            <Tooltip title="Assignments">
              <IconButton
                onClick={() => setShowAssignments(!showAssignments)}
                sx={{ color: 'white' }}
              >
                <Assignment />
              </IconButton>
            </Tooltip>
          )}

          {course?.pedagogicalFeatures?.enableMultitrackAudio && (
            <Tooltip title="Audio Tracks">
              <IconButton
                onClick={() => setShowMultitrackAudio(!showMultitrackAudio)}
                sx={{ color: 'white' }}
              >
                <VolumeUp />
              </IconButton>
            </Tooltip>
          )}

          {chapters.length > 0 && (
            <Tooltip title="Chapters (C)">
              <IconButton
                onClick={() => setShowChapters(!showChapters)}
                sx={{
                  color: showChapters ? '#ff8c00' : 'white',
                  border: focusVisible ? '2px solid #ff8c00' : 'none'}}
                aria-label={showChapters ? 'Hide chapters' : 'Show chapters'}
                aria-expanded={showChapters}
              >
                <VideoLibrary />
              </IconButton>
            </Tooltip>
          )}

          <Tooltip title="Complete Lesson">
            <IconButton onClick={handleLessonComplete} sx={{ color: 'white' }}>
              <CheckCircle />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onClose={() => setShowSettings(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Video Settings</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Playback Speed</InputLabel>
              <Select
                value={playbackRate}
                onChange={(e) => handlePlaybackRateChange(e.target.value as number)}
                label="Playback Speed"
              >
                <MenuItem value={0.5}>0.5x</MenuItem>
                <MenuItem value={0.75}>0.75x</MenuItem>
                <MenuItem value={1}>1x (Normal)</MenuItem>
                <MenuItem value={1.25}>1.25x</MenuItem>
                <MenuItem value={1.5}>1.5x</MenuItem>
                <MenuItem value={2}>2x</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Quality</InputLabel>
              <Select
                value={state.settings.quality}
                onChange={(e) => updateSettings({ quality: e.target.value as any })}
                label="Quality"
              >
                <MenuItem value="360p">360p</MenuItem>
                <MenuItem value="720p">720p</MenuItem>
                <MenuItem value="1080p">1080p</MenuItem>
                <MenuItem value="4k">4K</MenuItem>
              </Select>
            </FormControl>

            <FormControlLabel
              control={
                <Switch
                  checked={state.settings.subtitles}
                  onChange={(e) => updateSettings({ subtitles: e.target.checked })}
                />
              }
              label="Subtitles"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={state.settings.autoPlay}
                  onChange={(e) => updateSettings({ autoPlay: e.target.checked })}
                />
              }
              label="Auto-play next lesson"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSettings(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Notes Dialog */}
      <Dialog open={showNotes} onClose={() => setShowNotes(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Learning Notes</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              multiline
              rows={4}
              placeholder="Add your learning notes here..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              fullWidth
            />
            <Button
              variant="contained"
              onClick={handleAddNote}
              disabled={!note.trim()}
              sx={theming.getThemedButtonSx()}
            >
              Save Note
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowNotes(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Transcript Panel */}
      {course?.pedagogicalFeatures?.enableTranscriptPanel && (
        <Box
          sx={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: showTranscript ? 400 : 0,
            bgcolor: 'rgba(0,0,0,0.9)',
            backdropFilter: 'blur(10px)',
            transition: 'width 0.3s ease',
            overflow: 'hidden',
            zIndex: 10}}
        >
          {showTranscript && (
            <Box sx={{ p: 2, height: '100%', overflow: 'auto' }}>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ mb: 2 }}
              >
                <Typography variant="h6" sx={{ color: 'white' }}>
                  Transcript
                </Typography>
                <IconButton onClick={() => setShowTranscript(false)} sx={{ color: 'white' }}>
                  <MoreVert />
                </IconButton>
              </Stack>

              <TextField
                size="small"
                placeholder="Search transcript..."
                value={transcriptSearch}
                onChange={(e) => setTranscriptSearch(e.target.value)}
                sx={{ mb: 2, width: '100%' }}
                InputProps={{
                  sx: { color: 'white', '& input': { color: 'white' } }}}
              />

              <List dense>
                {transcript
                  .filter(
                    (item: any) =>
                      transcriptSearch === ', ' ||
                      item.text.toLowerCase().includes(transcriptSearch.toLowerCase()),
                  )
                  .map((item: any, index: number) => (
                    <ListItemButton
                      key={index}
                      onClick={() => handleTranscriptWordClick(index, item.timestamp)}
                      sx={{
                        mb: 1,
                        borderRadius: 1,
                        bgcolor:
                          highlightedWord === index ? 'rgba(255, 140, 0, 0.3)' : 'transparent', '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' }}}
                    >
                      <ListItemText
                        primary={item.text}
                        secondary={`${formatTime(item.timestamp)}`}
                        primaryTypographyProps={{ color: 'white', fontSize: '0.9rem' }}
                        secondaryTypographyProps={{
                          color: 'rgba(255, 255, 255, 0.7)',
                          fontSize: '0.8rem'}}
                      />
                    </ListItemButton>
                  ))}
              </List>
            </Box>
          )}
        </Box>
      )}

      {/* Resource Drawer */}
      {course?.pedagogicalFeatures?.enableResourceDrawer && (
        <Box
          sx={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: showResourceDrawer ? 350 : 0,
            bgcolor: 'rgba(0,0,0,0.9)',
            backdropFilter: 'blur(10px)',
            transition: 'width 0.3s ease',
            overflow: 'hidden',
            zIndex: 10}}
        >
          {showResourceDrawer && (
            <Box sx={{ p: 2, height: '100%', overflow: 'auto' }}>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ mb: 2 }}
              >
                <Typography variant="h6" sx={{ color: 'white' }}>
                  Resources
                </Typography>
                <IconButton onClick={() => setShowResourceDrawer(false)} sx={{ color: 'white' }}>
                  <MoreVert />
                </IconButton>
              </Stack>

              <List dense>
                {resources.map((resource: any, index: number) => (
                  <ListItemButton
                    key={index}
                    onClick={() => handleResourceSelect(resource)}
                    sx={{
                      mb: 1,
                      borderRadius: 1,
                      bgcolor:
                        selectedResource?.id === resource.id
                          ? 'rgba(255, 140, 0, 0.3)'
                          : 'transparent', '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' }}}
                  >
                    <ListItemIcon>
                      <Download sx={{ color: 'white' }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={resource.title}
                      secondary={resource.type}
                      primaryTypographyProps={{ color: 'white', fontSize: '0.9rem' }}
                      secondaryTypographyProps={{
                        color: 'rgba(255, 255, 255, 0.7)',
                        fontSize: '0.8rem'}}
                    />
                  </ListItemButton>
                ))}
              </List>
            </Box>
          )}
        </Box>
      )}

      {/* Discussion Panel */}
      {course?.pedagogicalFeatures?.enableDiscussionThreads && (
        <Dialog
          open={showDiscussion}
          onClose={() => setShowDiscussion(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Discussion Threads</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                multiline
                rows={3}
                placeholder="Add a discussion post..."
                value={newDiscussionPost}
                onChange={(e) => setNewDiscussionPost(e.target.value)}
                fullWidth
              />
              <Button
                variant="contained"
                onClick={handleDiscussionPost}
                disabled={!newDiscussionPost.trim()}
              >
                Post Discussion
              </Button>

              <Divider />

              <Typography variant="h6">Discussion Threads</Typography>
              <List>
                {discussionThreads.map((thread: any) => (
                  <ListItem key={thread.id}>
                    <ListItemText
                      primary={thread.content}
                      secondary={`${thread.author} • ${formatTime(thread.timestamp)}`}
                    />
                  </ListItem>
                ))}
              </List>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowDiscussion(false)}>Close</Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Assignments Panel */}
      {course?.pedagogicalFeatures?.enableAssignmentsFromVideo && (
        <Dialog
          open={showAssignments}
          onClose={() => setShowAssignments(false)}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle>Assignments from Video</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="h6">Available Assignments</Typography>
              <List>
                {assignments.map((assignment: any, index: number) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <Assignment sx={{ color: 'primary.main' }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={assignment.title}
                      secondary={`Due: ${assignment.dueDate} • ${assignment.points} points`}
                    />
                    <Button variant="outlined" size="small">
                      View Assignment
                    </Button>
                  </ListItem>
                ))}
              </List>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowAssignments(false)}>Close</Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Multitrack Audio Panel */}
      {course?.pedagogicalFeatures?.enableMultitrackAudio && (
        <Dialog
          open={showMultitrackAudio}
          onClose={() => setShowMultitrackAudio(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Audio Tracks</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <FormControl fullWidth>
                <InputLabel>Audio Track</InputLabel>
                <Select
                  value={selectedAudioTrack}
                  onChange={(e) => handleAudioTrackChange(e.target.value)}
                  label="Audio Track"
                >
                  {audioTracks.map((track: any) => (
                    <MenuItem key={track.id} value={track.id}>
                      {track.name} ({track.language})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowMultitrackAudio(false)}>Close</Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Chapter Navigation Panel */}
      {chapters.length > 0 && (
        <Box
          sx={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: showChapters ? 350 : 0,
            bgcolor: 'rgba(0,0,0,0.9)',
            backdropFilter: 'blur(10px)',
            transition: 'width 0.3s ease',
            overflow: 'hidden',
            zIndex: 10}}
        >
          {showChapters && (
            <Box sx={{ p: 2, height: '100%', overflow: 'auto' }}>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ mb: 2 }}
              >
                <Typography variant="h6" sx={{ color: 'white' }}>
                  Chapters
                </Typography>
                <IconButton onClick={() => setShowChapters(false)} sx={{ color: 'white' }}>
                  <MoreVert />
                </IconButton>
              </Stack>

              <List dense>
                {chapters.map((chapter, chapterIndex) => (
                  <ListItemButton
                    key={chapter.id || chapterIndex}
                    onClick={() => handleChapterSelect(chapter)}
                    sx={{
                      mb: 1,
                      borderRadius: 1,
                      bgcolor:
                        currentChapter?.id === chapter.id
                          ? 'rgba(255, 140, 0, 0.3)'
                          : 'transparent', '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' }}}
                  >
                    <ListItemText
                      primary={chapter.title}
                      secondary={`${formatTime(chapter.startTime)}${chapter.endTime ? ` - ${formatTime(chapter.endTime)}` : ', '}`}
                      primaryTypographyProps={{ color: 'white', fontSize: '0.9rem' }}
                      secondaryTypographyProps={{
                        color: 'rgba(255, 255, 255, 0.7)',
                        fontSize: '0.8rem'}}
                    />
                    {chapter.isAutoGenerated && (
                      <Chip
                        label="Auto"
                        size="small"
                        sx={{
                          bgcolor: 'rgba(255, 255, 255, 0.2)',
                          color: 'white',
                          fontSize: '0.7rem'}}
                      />
                    )}
                  </ListItemButton>
                ))}
              </List>
            </Box>
          )}
        </Box>
      )}

      {/* Practice Mode Panel */}
      {course?.pedagogicalFeatures?.enablePracticeMode && (
        <Dialog
          open={showPracticeMode}
          onClose={() => setShowPracticeMode(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Practice Mode</DialogTitle>
          <DialogContent>
            <Stack spacing={3} sx={{ mt: 1 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={practiceModeEnabled}
                    onChange={(e) => setPracticeModeEnabled(e.target.checked)}
                  />
                }
                label="Enable Practice Mode"
              />

              {practiceModeEnabled && (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    A-B Loop Practice
                  </Typography>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Button
                      variant={abLoopStart ? 'contained' : 'outlined'}
                      onClick={() => setAbLoopStart(currentTime)}
                    >
                      Set A Point
                    </Button>
                    <Button
                      variant={abLoopEnd ? 'contained' : 'outlined'}
                      onClick={() => setAbLoopEnd(currentTime)}
                      disabled={!abLoopStart}
                    >
                      Set B Point
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() => {
                        setAbLoopStart(null);
                        setAbLoopEnd(null);
                        setIsInABLoop(false);
                      }}
                    >
                      Reset
                    </Button>
                  </Stack>

                  {abLoopStart && abLoopEnd && (
                    <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                      Loop: {formatTime(abLoopStart)} - {formatTime(abLoopEnd)}
                    </Typography>
                  )}
                </Box>
              )}

              <Box>
                <Typography variant="h6" gutterBottom>
                  Practice Speed
                </Typography>
                <FormControl fullWidth>
                  <InputLabel>Speed</InputLabel>
                  <Select
                    value={playbackRate}
                    onChange={(e) => handlePlaybackRateChange(e.target.value as number)}
                    label="Speed"
                  >
                    <MenuItem value={0.25}>0.25x (Very Slow)</MenuItem>
                    <MenuItem value={0.5}>0.5x (Slow)</MenuItem>
                    <MenuItem value={0.75}>0.75x (Slightly Slow)</MenuItem>
                    <MenuItem value={1}>1x (Normal)</MenuItem>
                    <MenuItem value={1.25}>1.25x (Slightly Fast)</MenuItem>
                    <MenuItem value={1.5}>1.5x (Fast)</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowPracticeMode(false)}>Close</Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Casting Device Selection Dialog */}
      <Dialog
        open={showAirPlayMenu}
        onClose={() => setShowAirPlayMenu(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Cast sx={{ color: 'primary.main' }} />
            <Typography variant="h6">Cast to Device</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            {/* Connection Status */}
            {(isAirPlaying || isChromecasting) && (
              <Alert
                severity="success"
                icon={<CastConnected />}
                action={
                  <Button color="inherit" size="small" onClick={handleDeviceDisconnect}>
                    Disconnect
                  </Button>
                }
              >
                Connected to{', '}
                {isAirPlaying ? selectedAirPlayDevice?.name : selectedChromecastDevice?.name}
              </Alert>
            )}

            {/* Casting Error */}
            {castingError && (
              <Alert severity="error" icon={<WifiTetheringError />}>
                {castingError}
              </Alert>
            )}

            {/* Device Scanning Progress */}
            {castingProgress > 0 && castingProgress < 100 && (
              <Box>
                <Typography variant="body2" gutterBottom>
                  Scanning for devices... {castingProgress}%
                </Typography>
                <LinearProgress variant="determinate" value={castingProgress} />
              </Box>
            )}

            {/* AirPlay Devices */}
            {airPlayDevices.length > 0 && (
              <Box>
                <Typography
                  variant="h6"
                  gutterBottom
                  sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                >
                  <Tv sx={{ fontSize: 20 }} />
                  AirPlay Devices
                </Typography>
                <List>
                  {airPlayDevices.map((device) => (
                    <ListItemButton
                      key={device.id}
                      onClick={() => handleDeviceConnect(device)}
                      disabled={isAirPlaying}
                      sx={{
                        borderRadius: 1,
                        mb: 1,
                        bgcolor:
                          selectedAirPlayDevice?.id === device.id ? 'primary.light' : 'transparent', '&:hover': { bgcolor: 'action.hover' }}}
                    >
                      <ListItemIcon>
                        <Tv sx={{ color: 'primary.main' }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={device.name}
                        secondary={
                          isAirPlaying && selectedAirPlayDevice?.id === device.id
                            ? 'Connected'
                            : 'Tap to connect'
                        }
                      />
                    </ListItemButton>
                  ))}
                </List>
              </Box>
            )}

            {/* Chromecast Devices */}
            {chromecastDevices.length > 0 && (
              <Box>
                <Typography
                  variant="h6"
                  gutterBottom
                  sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                >
                  <Cast sx={{ fontSize: 20 }} />
                  Chromecast Devices
                </Typography>
                <List>
                  {chromecastDevices.map((device) => (
                    <ListItemButton
                      key={device.id}
                      onClick={() => handleDeviceConnect(device)}
                      disabled={isChromecasting}
                      sx={{
                        borderRadius: 1,
                        mb: 1,
                        bgcolor:
                          selectedChromecastDevice?.id === device.id
                            ? 'primary.light'
                            : 'transparent', '&:hover': { bgcolor: 'action.hover' }}}
                    >
                      <ListItemIcon>
                        <Cast sx={{ color: 'primary.main' }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={device.name}
                        secondary={
                          isChromecasting && selectedChromecastDevice?.id === device.id
                            ? 'Connected' : 'Tap to connect'
                        }
                      />
                    </ListItemButton>
                  ))}
                </List>
              </Box>
            )}

            {/* DLNA Devices */}
            {dlnaDevices.length > 0 && (
              <Box>
                <Typography
                  variant="h6"
                  gutterBottom
                  sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                >
                  <Devices sx={{ fontSize: 20 }} />
                  Smart TV Devices
                </Typography>
                <List>
                  {dlnaDevices.map((device) => (
                    <ListItemButton
                      key={device.id}
                      onClick={() => handleDeviceConnect(device)}
                      sx={{
                        borderRadius: 1,
                        mb: 1, '&:hover': { bgcolor: 'action.hover' }}}
                    >
                      <ListItemIcon>
                        <Devices sx={{ color: 'primary.main' }} />
                      </ListItemIcon>
                      <ListItemText primary={device.name} secondary="DLNA/UPnP compatible" />
                    </ListItemButton>
                  ))}
                </List>
              </Box>
            )}

            {/* No Devices Found */}
            {airPlayDevices.length === 0 &&
              chromecastDevices.length === 0 &&
              dlnaDevices.length === 0 &&
              castingProgress === 0 && (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <WifiTethering sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No Casting Devices Found
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Make sure your device is on the same network and supports casting
                  </Typography>
                  <Button variant="outlined" startIcon={<WifiTethering />} onClick={scanForDevices}>
                    Scan Again
                  </Button>
                </Box>
              )}

            {/* Casting Instructions */}
            <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                How to Cast:
              </Typography>
              <Typography variant="body2" component="div">
                <ol style={{ margin: 0, paddingLeft: 20 }}>
                  <li>Ensure your casting device is on the same Wi-Fi network</li>
                  <li>Select a device from the list above</li>
                  <li>Video will automatically start playing on the selected device</li>
                  <li>Use your phone/computer to control playback</li>
                </ol>
              </Typography>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAirPlayMenu(false)}>Close</Button>
          <Button
            variant="outlined"
            startIcon={<WifiTethering />}
            onClick={scanForDevices}
            disabled={castingProgress > 0 && castingProgress < 100}
          >
            Scan for Devices
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
	
export default withUniversalIntegration(AcademyVideoPlayer, {
  componentId: 'academy-video-player',
  componentName: 'Academy Video Player',
  componentType: 'widget',
  componentCategory: 'academy',
  featureIds: ['video-player-academy', 'video-processing', 'annotation-editor', 'chapter-manager'],
});
