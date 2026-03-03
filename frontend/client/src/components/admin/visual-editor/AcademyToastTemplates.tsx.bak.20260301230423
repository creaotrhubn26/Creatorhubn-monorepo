/**
 * CreatorHub Academy Toast Templates
 * Pre-configured toast notifications for the Academy system
 * Includes utility functions for rendering toasts with themed icons
 */

import React from 'react';
import { useTheming } from '../../../utils/theming-helper';
import {
  CheckCircle,
  Error,
  Warning,
  Info,
  School,
  PlayArrow,
  Pause,
  Download,
  Bookmark,
  Note,
  Star,
  Person,
  VideoLibrary,
  Assignment,
  Quiz,
  Verified,
} from '@mui/icons-material';

// Icon mapping for academy features and status types
export const getAcademyIcon = (iconType: string, size: number = 24) => {
  const iconProps = { sx: { fontSize: size } };
  switch (iconType) {
    case 'success':
    case 'course-created':
    case 'course-published':
      return <CheckCircle {...iconProps} />;
    case 'error':
    case 'course-failed':
      return <Error {...iconProps} />;
    case 'warning':
    case 'lesson-warning':
      return <Warning {...iconProps} />;
    case 'info':
    case 'lesson-added':
    case 'enrollment-info':
      return <Info {...iconProps} />;
    case 'school':
    case 'course':
      return <School {...iconProps} />;
    case 'play':
    case 'lesson-playing':
    case 'video-play':
      return <PlayArrow {...iconProps} />;
    case 'pause':
    case 'lesson-paused':
      return <Pause {...iconProps} />;
    case 'download':
    case 'resource-download':
      return <Download {...iconProps} />;
    case 'bookmark':
    case 'bookmark-added':
      return <Bookmark {...iconProps} />;
    case 'note':
    case 'notes-added':
      return <Note {...iconProps} />;
    case 'star':
    case 'rating':
    case 'favorite-course':
      return <Star {...iconProps} />;
    case 'person':
    case 'user':
    case 'student':
    case 'instructor':
      return <Person {...iconProps} />;
    case 'video':
    case 'video-library':
    case 'video-lesson':
      return <VideoLibrary {...iconProps} />;
    case 'assignment':
    case 'assignment-submitted':
      return <Assignment {...iconProps} />;
    case 'quiz':
    case 'quiz-completed':
      return <Quiz {...iconProps} />;
    case 'certificate':
    case 'certificate-earned':
      return <Verified {...iconProps} />;
    default:
      return <Info {...iconProps} />;
  }
};

// Hook to use academy theming with toasts
export const useAcademyToastTheming = (templateId: string) => {
  const theming = useTheming('academy');
  
  // Find the template configuration for this templateId
  const template = academyToastTemplates.find((t: { id: string }) => t.id === templateId);
  
  // Memoize template-specific theming
  const templateSpecificStyle = React.useMemo(() => {
    if (!template) {
      return {
        backgroundColor: theming.colors.primary,
        color: '#ffffff'
      };
    }
    return {
      backgroundColor: template.config.style.backgroundColor || theming.colors.primary,
      color: template.config.style.textColor || '#ffffff',
      borderRadius: template.config.style.borderRadius,
      boxShadow: template.config.style.boxShadow,
      borderColor: template.config.style.borderColor,
      fontSize: template.config.style.fontSize,
      fontWeight: template.config.style.fontWeight,
      padding: template.config.style.padding
    };
  }, [templateId, template, theming.colors.primary]);
  
  return {
    getThemedStyle: (baseStyle: Record<string, unknown>) => ({
      ...baseStyle,
      ...templateSpecificStyle
    }),
    getThemedIcon: (iconType: string) => {
      const iconFromTemplate = template?.config.icon.customIcon || getAcademyIcon(template?.config.icon.type || iconType, template?.config.icon.size);
      return iconFromTemplate || getAcademyIcon(iconType);
    },
    colors: theming.colors,
    theming,
    template,
    templateId
  };
};

// Function to render a toast with themed styling and icon
export const renderAcademyToast = (template: Record<string, unknown>) => {
  const theming = useTheming('academy');
  const icon = template.config.icon.customIcon || getAcademyIcon(template.config.icon.type, template.config.icon.size);
  
  return {
    message: template.config.message,
    icon,
    style: {
      ...template.config.style,
      backgroundColor: theming.colors.primary || template.config.style.backgroundColor
    },
    actions: template.config.actions,
    type: template.config.type
  };
};

// Course status helpers using icons
export const getCourseStatusIcon = (status: 'created' | 'published' | 'archived' | 'failed') => {
  const size = 20;
  switch (status) {
    case 'created': return <School sx={{ fontSize: size }} />;
    case 'published': return <CheckCircle sx={{ fontSize: size }} />;
    case 'archived': return <Note sx={{ fontSize: size }} />;
    case 'failed': return <Error sx={{ fontSize: size }} />;
    default: return <Info sx={{ fontSize: size }} />;
  }
};

// Lesson actions helpers using icons
export const getLessonActionIcon = (action: 'play' | 'pause' | 'download' | 'bookmark' | 'note') => {
  const size = 18;
  switch (action) {
    case 'play': return <PlayArrow sx={{ fontSize: size }} />;
    case 'pause': return <Pause sx={{ fontSize: size }} />;
    case 'download': return <Download sx={{ fontSize: size }} />;
    case 'bookmark': return <Bookmark sx={{ fontSize: size }} />;
    case 'note': return <Note sx={{ fontSize: size }} />;
    default: return <Info sx={{ fontSize: size }} />;
  }
};

// Student progress indicators using icons
export const getStudentBadgeIcon = (badge: 'assignment' | 'quiz' | 'star' | 'verified') => {
  const size = 22;
  switch (badge) {
    case 'assignment': return <Assignment sx={{ fontSize: size }} />;
    case 'quiz': return <Quiz sx={{ fontSize: size }} />;
    case 'star': return <Star sx={{ fontSize: size }} />;
    case 'verified': return <Verified sx={{ fontSize: size }} />;
    default: return <CheckCircle sx={{ fontSize: size }} />;
  }
};

// User role icons for academy
export const getUserRoleIcon = (role: 'instructor' | 'student' | 'admin') => {
  const size = 20;
  switch (role) {
    case 'instructor': return <School sx={{ fontSize: size }} />;
    case 'student': return <Person sx={{ fontSize: size }} />;
    case 'admin': return <Star sx={{ fontSize: size }} />;
    default: return <Person sx={{ fontSize: size }} />;
  }
};

// Video library helpers
export const getVideoLibraryIcon = (type: 'library' | 'lesson' | 'playlist') => {
  const size = 24;
  switch (type) {
    case 'library': return <VideoLibrary sx={{ fontSize: size }} />;
    case 'lesson': return <PlayArrow sx={{ fontSize: size }} />;
    case 'playlist': return <Assignment sx={{ fontSize: size }} />;
    default: return <VideoLibrary sx={{ fontSize: size }} />;
  }
};

export const academyToastTemplates = [
  // Course Management Templates
  {
    id: 'academy-course-created',
    name: 'Course Created Success',
    description: 'New course created successfully',
    config: {
      message: 'Course created successfully! Ready to add lessons.',
      type: 'success',
      style: {
        backgroundColor: '#4caf50',
        textColor: '#ffffff',
        borderRadius:  12,
        boxShadow: '0 8px 24px rgba(6,175,80,0.3)',
        padding:  16,
        fontSize:  14,
        fontWeight: 'normal',
        border: 'none',
        borderColor: 'transparent',
        borderWidth:  0,
        borderStyle: 'solid'
  },
      icon: {
        enabled: true,
        type: 'success',
        customIcon: '',
        size:  24,
        color: '#ffffff'
  },
      actions: {
        enabled: true,
        buttons: [
          {
            id: 'add-lessons',
            label: 'Add Lessons',
            action: 'add-lessons',
            style: 'primary',
            color: '#ffffff'
      },
          {
            id: 'preview-course',
            label: 'Preview',
            action: 'preview-course',
            style: 'secondary',
            color: '#ffffff'
      }
        ]
    },
      progress: {
        enabled: false,
        color: '#ffffff',
        height: 4
  }
  }
},
  {
    id: 'academy-course-published',
    name: 'Course Published',
    description: 'Course published and available to students',
    config: {
      message: 'Course published! Students can now enroll and start learning.',
      type: 'success',
      style: {
        backgroundColor: '#8bc340',
        textColor: '#ffffff',
        borderRadius:  12,
        boxShadow: '0 8px 24px rgba(19,195,74,0.3)',
        padding:  16,
        fontSize:  14,
        fontWeight: 'normal',
        border: 'none',
        borderColor: 'transparent',
        borderWidth:  0,
        borderStyle: 'solid'
  },
      icon: {
        enabled: true,
        type: 'success',
        customIcon: '',
        size:  24,
        color: '#ffffff'
  },
      actions: {
        enabled: true,
        buttons: [
          {
            id: 'view-course',
            label: 'View Course',
            action: 'view-course',
            style: 'primary',
            color: '#ffffff'
      },
          {
            id: 'share-course',
            label: 'Share',
            action: 'share-course',
            style: 'secondary',
            color: '#ffffff'
      }
        ]
    },
      progress: {
        enabled: false,
        color: '#ffffff',
        height: 4
  }
  }
},
  {
    id: 'academy-lesson-added',
    name: 'Lesson Added',
    description: 'New lesson added to course',
    config: {
      message: 'Lesson added successfully! Students can now access this content.',
      type: 'info',
      style: {
        backgroundColor: '#2196f3',
        textColor: '#ffffff',
        borderRadius:  10,
        boxShadow: '0 6px 20px rgba(3,150,243,0.3)',
        padding:  14,
        fontSize:  14,
        fontWeight: 'normal',
        border: 'none',
        borderColor: 'transparent',
        borderWidth:  0,
        borderStyle: 'solid'
  },
      icon: {
        enabled: true,
        type: 'info',
        customIcon: '',
        size:  22,
        color: '#ffffff'
  },
      actions: {
        enabled: true,
        buttons: [
          {
            id: 'edit-lesson',
            label: 'Edit Lesson',
            action: 'edit-lesson',
            style: 'secondary',
            color: '#ffffff'
      }
        ]
    },
      progress: {
        enabled: false,
        color: '#ffffff',
        height: 3
  }
  }
},
  {
    id: 'academy-course-updated',
    name: 'Course Updated',
    description: 'Course information updated',
    config: {
      message: 'Course updated successfully! Changes are now live.',
      type: 'info',
      style: {
        backgroundColor: '#00bcd4',
        textColor: '#ffffff',
        borderRadius:  10,
        boxShadow: '0 6px 20px rgba(0,188,212,0.3)',
        padding:  14,
        fontSize:  14,
        fontWeight: 'normal',
        border: 'none',
        borderColor: 'transparent',
        borderWidth:  0,
        borderStyle: 'solid'
  },
      icon: {
        enabled: true,
        type: 'info',
        customIcon: '',
        size:  22,
        color: '#ffffff'
  },
      actions: {
        enabled: false,
        buttons: []
  },
      progress: {
        enabled: false,
        color: '#ffffff',
        height: 3
  }
  }
},

  // Student Experience Templates
  {
    id: 'academy-enrollment-success',
    name: 'Enrollment Success',
    description: 'Successfully enrolled in course',
    config: {
      message: 'Welcome to the course! Start your learning journey now.',
      type: 'success',
      style: {
        backgroundColor: '#4caf50',
        textColor: '#ffffff',
        borderRadius:  12,
        boxShadow: '0 8px 24px rgba(6,175,80,0.3)',
        padding:  16,
        fontSize:  14,
        fontWeight: 'normal',
        border: 'none',
        borderColor: 'transparent',
        borderWidth:  0,
        borderStyle: 'solid'
  },
      icon: {
        enabled: true,
        type: 'success',
        customIcon: '',
        size:  24,
        color: '#ffffff'
  },
      actions: {
        enabled: true,
        buttons: [
          {
            id: 'start-learning',
            label: 'Start Learning',
            action: 'start-learning',
            style: 'primary',
            color: '#ffffff'
      },
          {
            id: 'view-syllabus',
            label: 'View Syllabus',
            action: 'view-syllabus',
            style: 'secondary',
            color: '#ffffff'
      }
        ]
    },
      progress: {
        enabled: false,
        color: '#ffffff',
        height: 4
  }
  }
},
  {
    id: 'academy-lesson-completed',
    name: 'Lesson Completed',
    description: 'Lesson marked as completed',
    config: {
      message: 'Great job! Lesson completed. Keep up the excellent work!',
      type: 'success',
      style: {
        backgroundColor: '#8bc340',
        textColor: '#ffffff',
        borderRadius:  12,
        boxShadow: '0 8px 24px rgba(19,195,74,0.3)',
        padding:  16,
        fontSize:  14,
        fontWeight: 'normal',
        border: 'none',
        borderColor: 'transparent',
        borderWidth:  0,
        borderStyle: 'solid'
  },
      icon: {
        enabled: true,
        type: 'success',
        customIcon: '',
        size:  24,
        color: '#ffffff'
  },
      actions: {
        enabled: true,
        buttons: [
          {
            id: 'next-lesson',
            label: 'Next Lesson',
            action: 'next-lesson',
            style: 'primary',
            color: '#ffffff'
      },
          {
            id: 'review-lesson',
            label: 'Review',
            action: 'review-lesson',
            style: 'secondary',
            color: '#ffffff'
      }
        ]
    },
      progress: {
        enabled: true,
        color: '#ffffff',
        height: 4
  }
  }
},
  {
    id: 'academy-course-completed',
    name: 'Course Completed',
    description: 'Entire course completed',
    config: {
      message: '🎉 Congratulations! You\'ve completed the course. Certificate is ready!',
      type: 'success',
      style: {
        backgroundColor: '#ffd700',
        textColor: '#000000',
        borderRadius:  16,
        boxShadow: '0 12px 32px rgba(25,215,0,0.4)',
        padding:  20,
        fontSize:  16,
        fontWeight: 'bold',
        border: '2px solid #ffb300',
        borderColor: '#ffb300',
        borderWidth:  2,
        borderStyle: 'solid'
  },
      icon: {
        enabled: true,
        type: 'success',
        customIcon: '',
        size:  28,
        color: '#000000'
  },
      actions: {
        enabled: true,
        buttons: [
          {
            id: 'download-certificate',
            label: 'Download Certificate',
            action: 'download-certificate',
            style: 'primary',
            color: '#000000'
      },
          {
            id: 'share-achievement',
            label: 'Share Achievement',
            action: 'share-achievement',
            style: 'secondary',
            color: '#000000'
      }
        ]
    },
      progress: {
        enabled: false,
        color: '#000000',
        height: 4
  }
  }
},
  {
    id: 'academy-bookmark-added',
    name: 'Bookmark Added',
    description: 'Video bookmark created',
    config: {
      message: 'Bookmark added! You can return to this moment anytime.',
      type: 'info',
      style: {
        backgroundColor: '#673ab7',
        textColor: '#ffffff',
        borderRadius:  8,
        boxShadow: '0 4px 12px rgba(13,58,183,0.2)',
        padding:  12,
        fontSize:  13,
        fontWeight: 'normal',
        border: 'none',
        borderColor: 'transparent',
        borderWidth:  0,
        borderStyle: 'solid'
  },
      icon: {
        enabled: true,
        type: 'info',
        customIcon: '',
        size:  20,
        color: '#ffffff'
  },
      actions: {
        enabled: false,
        buttons: []
  },
      progress: {
        enabled: false,
        color: '#ffffff',
        height: 3
  }
  }
},
  {
    id: 'academy-note-saved',
    name: 'Note Saved',
    description: 'Learning note saved',
    config: {
      message: 'Note saved! Your thoughts are safely stored.',
      type: 'info',
      style: {
        backgroundColor: '#607d8b',
        textColor: '#ffffff',
        borderRadius:  8,
        boxShadow: '0 4px 12px rgba(6,125,139,0.2)',
        padding:  12,
        fontSize:  13,
        fontWeight: 'normal',
        border: 'none',
        borderColor: 'transparent',
        borderWidth:  0,
        borderStyle: 'solid'
  },
      icon: {
        enabled: true,
        type: 'info',
        customIcon: '',
        size:  20,
        color: '#ffffff'
  },
      actions: {
        enabled: false,
        buttons: []
  },
      progress: {
        enabled: false,
        color: '#ffffff',
        height: 3
  }
  }
},

  // Video Player Templates
  {
    id: 'academy-video-loading',
    name: 'Video Loading',
    description: 'Video is loading',
    config: {
      message: 'Loading video... Please wait.',
      type: 'info',
      style: {
        backgroundColor: '#2196f3',
        textColor: '#ffffff',
        borderRadius:  8,
        boxShadow: '0 4px 12px rgba(3,150,243,0.2)',
        padding:  12,
        fontSize:  13,
        fontWeight: 'normal',
        border: 'none',
        borderColor: 'transparent',
        borderWidth:  0,
        borderStyle: 'solid'
  },
      icon: {
        enabled: true,
        type: 'info',
        customIcon: '',
        size:  20,
        color: '#ffffff'
  },
      actions: {
        enabled: false,
        buttons: []
  },
      progress: {
        enabled: true,
        color: '#ffffff',
        height: 3
  }
  }
},
  {
    id: 'academy-video-quality-changed',
    name: 'Video Quality Changed',
    description: 'Video quality setting updated',
    config: {
      message: 'Video quality changed to 1080',
      type: 'info',
      style: {
        backgroundColor: '#00bcd4',
        textColor: '#ffffff',
        borderRadius:  8,
        boxShadow: '0 4px 12px rgba(0,188,212,0.2)',
        padding:  12,
        fontSize:  13,
        fontWeight: 'normal',
        border: 'none',
        borderColor: 'transparent',
        borderWidth:  0,
        borderStyle: 'solid'
  },
      icon: {
        enabled: true,
        type: 'info',
        customIcon: '',
        size:  20,
        color: '#ffffff'
  },
      actions: {
        enabled: false,
        buttons: []
  },
      progress: {
        enabled: false,
        color: '#ffffff',
        height: 3
  }
  }
},
  {
    id: 'academy-subtitles-enabled',
    name: 'Subtitles Enabled',
    description: 'Subtitles turned on',
    config: {
      message: 'Subtitles enabled for better learning experience',
      type: 'info',
      style: {
        backgroundColor: '#9c27b0',
        textColor: '#ffffff',
        borderRadius:  8,
        boxShadow: '0 4px 12px rgba(16,39,176,0.2)',
        padding:  12,
        fontSize:  13,
        fontWeight: 'normal',
        border: 'none',
        borderColor: 'transparent',
        borderWidth:  0,
        borderStyle: 'solid'
  },
      icon: {
        enabled: true,
        type: 'info',
        customIcon: '',
        size:  20,
        color: '#ffffff'
  },
      actions: {
        enabled: false,
        buttons: []
  },
      progress: {
        enabled: false,
        color: '#ffffff',
        height: 3
  }
  }
},

  // Error Templates
  {
    id: 'academy-video-error',
    name: 'Video Error',
    description: 'Video playback error',
    config: {
      message: 'Unable to load video. Please check your connection and try again.',
      type: 'error',
      style: {
        backgroundColor: '#f44336',
        textColor: '#ffffff',
        borderRadius:  8,
        boxShadow: '0 4px 12px rgba(24,67,54,0.3)',
        padding:  14,
        fontSize:  14,
        fontWeight: 'normal',
        border: 'none',
        borderColor: 'transparent',
        borderWidth:  0,
        borderStyle: 'solid'
  },
      icon: {
        enabled: true,
        type: 'error',
        customIcon: '',
        size:  22,
        color: '#ffffff'
  },
      actions: {
        enabled: true,
        buttons: [
          {
            id: 'retry-video',
            label: 'Retry',
            action: 'retry-video',
            style: 'primary',
            color: '#ffffff'
      },
          {
            id: 'contact-support',
            label: 'Contact Support',
            action: 'contact-support',
            style: 'secondary',
            color: '#ffffff'
      }
        ]
    },
      progress: {
        enabled: false,
        color: '#ffffff',
        height: 3
  }
  }
},
  {
    id: 'academy-enrollment-failed',
    name: 'Enrollment Failed',
    description: 'Failed to enroll in course',
    config: {
      message: 'Unable to enroll in course. Please try again or contact support.',
      type: 'error',
      style: {
        backgroundColor: '#f44336',
        textColor: '#ffffff',
        borderRadius:  8,
        boxShadow: '0 4px 12px rgba(24,67,54,0.3)',
        padding:  14,
        fontSize:  14,
        fontWeight: 'normal',
        border: 'none',
        borderColor: 'transparent',
        borderWidth:  0,
        borderStyle: 'solid'
  },
      icon: {
        enabled: true,
        type: 'error',
        customIcon: '',
        size:  22,
        color: '#ffffff'
  },
      actions: {
        enabled: true,
        buttons: [
          {
            id: 'retry-enrollment',
            label: 'Try Again',
            action: 'retry-enrollment',
            style: 'primary',
            color: '#ffffff'
      },
          {
            id: 'contact-support',
            label: 'Contact Support',
            action: 'contact-support',
            style: 'secondary',
            color: '#ffffff'
      }
        ]
    },
      progress: {
        enabled: false,
        color: '#ffffff',
        height: 3
  }
  }
},
  {
    id: 'academy-progress-save-failed',
    name: 'Progress Save Failed',
    description: 'Failed to save learning progress',
    config: {
      message: 'Unable to save progress. Your progress will be saved when connection is restored.',
      type: 'warning',
      style: {
        backgroundColor: '#ff9800',
        textColor: '#ffffff',
        borderRadius:  8,
        boxShadow: '0 4px 12px rgba(25,152,0,0.3)',
        padding:  14,
        fontSize:  14,
        fontWeight: 'normal',
        border: 'none',
        borderColor: 'transparent',
        borderWidth:  0,
        borderStyle: 'solid'
  },
      icon: {
        enabled: true,
        type: 'warning',
        customIcon: '',
        size:  22,
        color: '#ffffff'
  },
      actions: {
        enabled: true,
        buttons: [
          {
            id: 'retry-save',
            label: 'Retry Save',
            action: 'retry-save',
            style: 'primary',
            color: '#ffffff'
      }
        ]
    },
      progress: {
        enabled: false,
        color: '#ffffff',
        height: 3
  }
  }
},

  // Achievement Templates
  {
    id: 'academy-first-lesson',
    name: 'First Lesson Achievement',
    description: 'Completed first lesson',
    config: {
      message: '🌟 First lesson completed! You\'re on your way to mastering new skills.',
      type: 'success',
      style: {
        backgroundColor: '#ffd700',
        textColor: '#000000',
        borderRadius:  12,
        boxShadow: '0 8px 24px rgba(25,215,0,0.4)',
        padding:  16,
        fontSize:  14,
        fontWeight: 'bold',
        border: '2px solid #ffb30',
        borderColor: '#ffb30',
        borderWidth:  2,
        borderStyle: 'solid'
  },
      icon: {
        enabled: true,
        type: 'success',
        customIcon: '',
        size:  24,
        color: '#000000'
  },
      actions: {
        enabled: false,
        buttons: []
  },
      progress: {
        enabled: false,
        color: '#000000',
        height: 4
  }
  }
},
  {
    id: 'academy-streak-achievement',
    name: 'Learning Streak Achievement',
    description: 'Learning streak milestone',
    config: {
      message: '🔥 7-day learning streak! You\'re building an amazing habit.',
      type: 'success',
      style: {
        backgroundColor: '#ff5722',
        textColor: '#ffffff',
        borderRadius:  12,
        boxShadow: '0 8px 24px rgba(25,87,34,0.4)',
        padding:  16,
        fontSize:  14,
        fontWeight: 'bold',
        border: 'none',
        borderColor: 'transparent',
        borderWidth:  0,
        borderStyle: 'solid'
  },
      icon: {
        enabled: true,
        type: 'success',
        customIcon: '',
        size:  24,
        color: '#ffffff'
  },
      actions: {
        enabled: false,
        buttons: []
  },
      progress: {
        enabled: false,
        color: '#ffffff',
        height: 4
  }
  }
},
  {
    id: 'academy-quiz-perfect',
    name: 'Perfect Quiz Score',
    description: 'Achieved perfect score on quiz',
    config: {
      message: '🎯 Perfect score! You\'ve mastered this lesson completely.',
      type: 'success',
      style: {
        backgroundColor: '#4caf50',
        textColor: '#ffffff',
        borderRadius:  12,
        boxShadow: '0 8px 24px rgba(6,175,80,0.4)',
        padding:  16,
        fontSize:  14,
        fontWeight: 'bold',
        border: 'none',
        borderColor: 'transparent',
        borderWidth:  0,
        borderStyle: 'solid'
  },
      icon: {
        enabled: true,
        type: 'success',
        customIcon: '',
        size:  24,
        color: '#ffffff'
  },
      actions: {
        enabled: false,
        buttons: []
  },
      progress: {
        enabled: false,
        color: '#ffffff',
        height: 4
  }
  }
},

  // System Templates
  {
    id: 'academy-offline-mode',
    name: 'Offline Mode',
    description: 'Switched to offline mode',
    config: {
      message: 'Offline mode enabled. Downloaded content is available.',
      type: 'info',
      style: {
        backgroundColor: '#607d8b',
        textColor: '#ffffff',
        borderRadius:  8,
        boxShadow: '0 4px 12px rgba(6,125,139,0.2)',
        padding:  12,
        fontSize:  13,
        fontWeight: 'normal',
        border: 'none',
        borderColor: 'transparent',
        borderWidth:  0,
        borderStyle: 'solid'
  },
      icon: {
        enabled: true,
        type: 'info',
        customIcon: '',
        size:  20,
        color: '#ffffff'
  },
      actions: {
        enabled: false,
        buttons: []
  },
      progress: {
        enabled: false,
        color: '#ffffff',
        height: 3
  }
  }
},
  {
    id: 'academy-sync-complete',
    name: 'Sync Complete',
    description: 'Data synchronization completed',
    config: {
      message: 'All progress synced! Your learning data is up to date.',
      type: 'success',
      style: {
        backgroundColor: '#4caf50',
        textColor: '#ffffff',
        borderRadius:  8,
        boxShadow: '0 4px 12px rgba(6,175,80,0.2)',
        padding:  12,
        fontSize:  13,
        fontWeight: 'normal',
        border: 'none',
        borderColor: 'transparent',
        borderWidth:  0,
        borderStyle: 'solid'
  },
      icon: {
        enabled: true,
        type: 'success',
        customIcon: '',
        size:  20,
        color: '#ffffff'
  },
      actions: {
        enabled: false,
        buttons: []
  },
      progress: {
        enabled: false,
        color: '#ffffff',
        height: 3
  }
  }
}
];

export default academyToastTemplates;

















