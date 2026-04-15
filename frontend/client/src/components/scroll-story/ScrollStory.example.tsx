// @ts-nocheck
/**
 * ScrollStory Component - Usage Example
 * Demonstrates how to use the enhanced ScrollStory component with all features
 */

import React from 'react';
import ScrollStory from './ScrollStory.enhanced';
import type { ScrollStory as ScrollStoryType } from './useScrollStory';

export default function ScrollStoryExample() {
  // Sample story data
  const sampleStory: ScrollStoryType = {
    id: 'wedding-2024',
    name: 'Emma & John Wedding',
    pages: [
      {
        id: 'page-1',
        title: 'The Beginning',
        content: 'Every love story has a beginning...',
        media: [
          {
            type: 'image',
            url: '/images/wedding/couple-1.jpg',
            thumbnail: '/images/wedding/couple-1-thumb.jpg',
          },
        ],
      },
      {
        id: 'page-2',
        title: 'The Ceremony',
        content: 'A beautiful ceremony by the lake',
        media: [
          {
            type: 'video',
            url: '/videos/wedding/ceremony.mp4',
            thumbnail: '/videos/wedding/ceremony-thumb.jpg',
          },
        ],
      },
      {
        id: 'page-3',
        title: 'The Celebration',
        content: 'Dancing the night away',
        media: [
          {
            type: 'image',
            url: '/images/wedding/dance.jpg',
            thumbnail: '/images/wedding/dance-thumb.jpg',
          },
        ],
      },
    ],
    animations: [
      {
        id: 'fade-in-title',
        elementId: 'page-1',
        triggerPoint: 0,
        duration: 800,
        easing: 'cubic-bezier(0.4 0.0 0.2 1)',
        to: {
          opacity: '1',
          translateY: '0px',
        },
      },
    ],
    scrollTriggers: [
      {
        id: 'show-ceremony',
        elementId: 'page-2',
        threshold: 0.5,
        delay: 200,
      },
    ],
    settings: {
      backgroundColor: '#ffffff',
      textColor: '#222222',
      transitionDuration: 800,
      easing: 'cubic-bezier(0.4 0.0 0.2 1)',
      showProgress: true,
    },
  };

  return (
    <ScrollStory
      story={sampleStory}
      onScrollProgress={(progress) => {
        console.log('Scroll progress: ', progress);
      }}
      onAnimationEnter={(elementId) => {
        console.log('Animation entered:', elementId);
      }}
      onAnimationExit={(elementId) => {
        console.log('Animation exited:', elementId);
      }}
      onTriggerActivate={(triggerId) => {
        console.log('Trigger activated:', triggerId);
      }}
      enableParallax={true}
      enableKeyboardNav={true}
      preloadMedia={true}
      autoPlayVideos={true}
    />
  );
}

/**
 * USAGE INSTRUCTIONS: *
 * 1. Import the component: *    import ScrollStory from'@/components/scroll-story/ScrollStory.enhanced';
 *
 * 2. Create your story data following the ScrollStoryType interface
 *
 * 3. Add to your page/component: *    <ScrollStory story={yourStory} />
 *
 * 4. Marketplace Features: *    - Basic: scroll-story (149 NOK/month)
 *    - Add-ons: *      * scroll-story-animations (49 NOK/month)
 *      * scroll-story-parallax (39 NOK/month)
 *      * scroll-story-media-preload (29 NOK/month)
 *
 * 5. Analytics Events Tracked: *    - scroll_story_mounted
 *    - scroll_story_unmounted
 *    - scroll_story_page_change
 *    - scroll_story_animation_enter
 *    - scroll_story_animation_exit
 *    - scroll_story_trigger_activate
 *    - scroll_story_pause_toggle
 *    - scroll_story_media_preload_complete
 *
 * 6. Master Integration Features: *    ✅ Component registration with lifecycle management
 *    ✅ Automatic GA4 analytics tracking
 *    ✅ Performance monitoring (60fps throttled)
 *    ✅ Feature usage tracking
 *    ✅ Health monitoring
 *
 * 7. Keyboard Shortcuts: *    - Arrow Up: Previous page
 *    - Arrow Down: Next page
 *    - Spacebar: Pause/Resume
 */
