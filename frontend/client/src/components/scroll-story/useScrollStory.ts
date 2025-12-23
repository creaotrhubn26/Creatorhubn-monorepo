/**
 * Custom hook for Scroll Stories functionality
 * Manages scroll story creation, editing, and animation
 */

import { useState, useCallback } from 'react';

export interface ScrollStory {
  id: string;
  name: string;
  description: string;
  pages: ScrollStoryPage[];
  scrollTriggers: ScrollTrigger[];
  animations: ScrollAnimation[];
  settings: ScrollStorySettings;
  createdAt: string;
  updatedAt: string
}

export interface ScrollStoryPage {
  id: string;
  title: string;
  content: string;
  media: {
    type: 'image' | 'video' | 'audio';
    url: string;
    thumbnail?: string;
}[];
  animations: ScrollAnimation[];
  triggers: ScrollTrigger[];
  order: number
}

export interface ScrollTrigger {
  id: string;
  elementId: string;
  triggerPoint: number;
  action: string;
  threshold: number;
  delay?: number
}

export interface ScrollAnimation {
  id: string;
  elementId: string;
  type: string;
  from: Record<string, any>;
  to: Record<string, any>;
  duration: number;
  delay?: number;
  easing?: string;
  triggerPoint?: number
}

export interface ScrollStorySettings {
  theme: 'light' | 'dark' | 'auto';
  autoplay: boolean;
  loop: boolean;
  showProgress: boolean;
  showControls: boolean;
  transitionDuration: number;
  easing: string
}

export const useScrollStory = () => {
  const [scrollStories, setScrollStories] = useState<ScrollStory[]>([]);
  const [currentStory, setCurrentStory] = useState<ScrollStory | null>(null);
  const [scrollTriggers, setScrollTriggers] = useState<Record<string, ScrollTrigger>>({});
  const [scrollAnimations, setScrollAnimations] = useState<Record<string, ScrollAnimation>>({});
  const [scrollTimeline, setScrollTimeline] = useState<any[]>([]);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isScrollPreview, setIsScrollPreview] = useState(false);

  // Story management functions
  const createStory = useCallback((name: string, description?: string) => {
    const newStory: ScrollStory = {
      id: `story_${Date.now()}`,
      name,
      description: description || '',
      pages: [],
      scrollTriggers: [],
      animations: [],
      settings: {
        theme: 'light',
        autoplay: false,
        loop: false,
        showProgress: true,
        showControls: true,
        transitionDuration: 100,
        easing: 'ease-in-out'
  },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
};

    setScrollStories(prev => [...prev, newStory]);
    setCurrentStory(newStory);
    return newStory;
}, []);

  const updateStory = useCallback((storyId: string, updates: Partial<ScrollStory>) => {
    setScrollStories(prev => prev.map(story => 
      story.id === storyId 
        ? { ...story, ...updates, updatedAt: new Date().toISOString() }
        : story
    ));
    
    if (currentStory?.id === storyId) {
      setCurrentStory(prev => prev ? { ...prev, ...updates, updatedAt: new Date().toISOString() } : null);
  }
}, [currentStory]);

  const deleteStory = useCallback((storyId: string) => {
    setScrollStories(prev => prev.filter(story => story.id !== storyId));
    if (currentStory?.id === storyId) {
      setCurrentStory(null);
}
}, [currentStory]);

  const selectStory = useCallback((storyId: string) => {
    const story = scrollStories.find(s => s.id === storyId);
    if (story) {
      setCurrentStory(story);
}
}, [scrollStories]);

  // Trigger functions
  const addScrollTrigger = useCallback((elementId: string, trigger: Omit<ScrollTrigger, 'id'>) => {
    const newTrigger: ScrollTrigger = {
      ...trigger,
      id: `trigger_${Date.now()}`
  };
    
    setScrollTriggers(prev => ({
      ...prev,
      [elementId]: newTrigger
  }));
    
    setScrollTimeline(prev => [...prev, newTrigger].sort((a, b) => a.triggerPoint - b.triggerPoint));
}, []);

  const updateScrollTrigger = useCallback((triggerId: string, updates: Partial<ScrollTrigger>) => {
    setScrollTriggers(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(key => {
        if (updated[key].id === triggerId) {
          updated[key] = { ...updated[key], ...updates };
      }
    });
      return updated;
  });
}, []);

  const deleteScrollTrigger = useCallback((triggerId: string) => {
    setScrollTriggers(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(key => {
        if (updated[key].id === triggerId) {
          delete updated[key];
      }
    });
      return updated;
  });
}, []);

  // Animation functions
  const addScrollAnimation = useCallback((elementId: string, animation: Omit<ScrollAnimation, 'id'>) => {
    const newAnimation: ScrollAnimation = {
      ...animation,
      id: `anim_${Date.now()}`
  };
    
    setScrollAnimations(prev => ({
      ...prev,
      [elementId]: newAnimation
  }));
}, []);

  const updateScrollAnimation = useCallback((animationId: string, updates: Partial<ScrollAnimation>) => {
    setScrollAnimations(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(key => {
        if (updated[key].id === animationId) {
          updated[key] = { ...updated[key], ...updates };
      }
    });
      return updated;
  });
}, []);

  const deleteScrollAnimation = useCallback((animationId: string) => {
    setScrollAnimations(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(key => {
        if (updated[key].id === animationId) {
          delete updated[key];
      }
    });
      return updated;
  });
}, []);

  // Preview functions
  const previewStory = useCallback((storyId: string) => {
    const story = scrollStories.find(s => s.id === storyId);
    if (story) {
      setCurrentStory(story);
      setIsScrollPreview(true);
}
}, [scrollStories]);

  const stopPreview = useCallback(() => {
    setIsScrollPreview(false);
    setCurrentStory(null);
}, []);

  return {
    // State
    scrollStories,
    currentStory,
    scrollTriggers,
    scrollAnimations,
    scrollTimeline,
    scrollProgress,
    isScrollPreview,

    // Story operations
    createStory,
    updateStory,
    deleteStory,
    selectStory,

    // Trigger operations
    addScrollTrigger,
    updateScrollTrigger,
    deleteScrollTrigger,

    // Animation operations
    addScrollAnimation,
    updateScrollAnimation,
    deleteScrollAnimation,

    // Preview operations
    previewStory,
    stopPreview,

    // Setters
    setScrollProgress,
    setCurrentStory,
    setIsScrollPreview
};
};













