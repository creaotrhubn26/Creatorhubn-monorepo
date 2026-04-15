// @ts-nocheck
/**
 * ScrollStory React component
 * Renders scroll-based story animations and scroll triggers
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';
import { useScrollStory } from './useScrollStory';
import type { ScrollStory as ScrollStoryType } from './useScrollStory';

interface ScrollStoryProps {
  story: ScrollStoryType;
  onScrollProgress?: (progress: number) => void;
  onAnimationEnter?: (elementId: string) => void;
  onAnimationExit?: (elementId: string) => void;
  onTriggerActivate?: (triggerId: string) => void;
  children?: React.ReactNode
}

export default function ScrollStory({
  story,
  onScrollProgress,
  onAnimationEnter,
  onAnimationExit,
  onTriggerActivate,
  children
}: ScrollStoryProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollProgress, setScrollProgress } = useScrollStory();
  
  // Theming system
  const theming = useTheming('photographer');
  const [seenElements, setSeenElements] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!containerRef.current) return;

    const handleScroll = () => {
      const rect = containerRef.current!.getBoundingClientRect();
      const scrolled = Math.min(1, Math.max(0,
        (window.innerHeight - rect.top) / (window.innerHeight + rect.height)
      ));
      setScrollProgress(scrolled);
      onScrollProgress?.(scrolled);
  };

    window.addEventListener('scroll', handleScroll, { passive: true });

    // Trigger on initial scroll
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
}, [onScrollProgress, setScrollProgress]);

  // Animation and trigger handlers
  useEffect(() => {
    story.animations.forEach(anim => {
      const element = document.getElementById(anim.elementId);
      if (!element) return;

      const shouldAnimate = (
        scrollProgress >= (anim.triggerPoint || 0)
        && scrollProgress < 1
      );

      if (shouldAnimate) {
        element.style.transition = `all ${anim.duration}ms ${anim.easing || 'ease-in-out'}`;
        
        Object.entries(anim.to).forEach(([prop, value]) => {
          (element.style as any)[prop] = value;
      });

        // Track animation
        if (!seenElements.has(anim.elementId)) {
          setSeenElements(prev => new Set([...prev, anim.elementId]));
          onAnimationEnter?.(anim.elementId);
      }
    }
  });
}, [scrollProgress, story.animations, onAnimationEnter, seenElements]);

  useEffect(() => {
    story.scrollTriggers.forEach(trigger => {
      const element = document.getElementById(trigger.elementId);
      if (!element) return;

      const entryRatio = trigger.threshold;
      if (
        scrollProgress >= entryRatio 
        && !seenElements.has(`trigger_${trigger.id}`)
      ) {
        setSeenElements(prev => new Set([...prev, `trigger_${trigger.id}`]));
        onTriggerActivate?.(trigger.id);
    }
  });
}, [scrollProgress, story.scrollTriggers, onTriggerActivate, seenElements]);

  return (
    <Box
      ref={containerRef}
      sx={{
        position: 'relative',
        height: '100vh',
        minHeight: '80vh',
        padding: '4rem 2rem',
        backgroundColor: story.settings?.backgroundColor || '#ffffff',
        color: story.settings?.textColor || '#22',
        overflow: 'hidden'
  }}
      id={`scroll-story-${story.id}`}
    >
      {/* Story Pages */}
      {story.pages.map((page, index) => (
        <Box
          key={page.id}
          sx={{
            position: 'absolute',
            top: index * 100 + 'vh',
            left: 0,
            right: 0,
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: scrollProgress >= index * 0.25 && scrollProgress < (index + 1) * 0.25 ? 1 : 0,
            transition: `opacity ${story.settings.transitionDuration || 100}ms ${(story.settings.easing || 'ease-in-out')}`}}
          id={`page-${page.id}`}
        >
          <Box sx={{ textAlign: 'center' }}>
            <Box component="h1" sx={{ fontSize: '3rem', marginBottom: '1rem' }}>
              {page.title}
            </Box>
            <Box component="div" sx={{ lineHeight: 1.6 }}>
              {page.content}
            </Box>
            {page.media.map((media, idx) => (
              <Box
                key={idx}
                component={
                  media.type === 'video' ? 'video' : 
                  media.type === 'audio' ? 'audio' : 'img'
              }
                src={media.url}
                sx={{
                  maxWidth: media.type !== 'audio' ? '100%' : undefined,
                  maxHeight: media.type === 'image' ? '50vh' : media.type === 'video' ? '80vh' : undefined}}
                {...(media.type === 'video' && { controls: true })}
              />
            ))}
          </Box>
        </Box>
      ))}

      {/* Child content */}
      {children}

      {/* Story progress indicator */}
      {story.settings.showProgress && (
        <Box
          sx={{
            position: 'fixed',
            bottom: '1rem',
            left: '1rem',
            width: '100%',
            maxWidth: '200px',
            height: '4px',
            backgroundColor: 'rgba(20,200,200,0.4)',
            borderRadius: '2px',
            overflow: 'hidden'
      }}
        >
          <Box
            sx={{
              height: '100%',
              backgroundColor: 'primary.main',
              transition: 'width 250ms ease-out',
              width: `${scrollProgress * 100}%`,
              borderRadius: '2px'
        }}
          />
        </Box>
      )}

      {/* Article container */}
      <Box
        sx={{
          height: story.pages.length * window.innerHeight * 0.9,
          paddingTop: '50vh',
          paddingBottom: '50vh'
    }}
      />
    </Box>
  );
}













