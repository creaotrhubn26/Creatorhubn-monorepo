/**
 * ScrollStory React component - ENHANCED VERSION
 * Scroll-driven story rendering with media preloading, keyboard navigation,
 * trigger callbacks, intersection callbacks and autoplay for in-view videos.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import { KeyboardArrowDown, KeyboardArrowUp, Pause, PlayArrow } from '@mui/icons-material';
import { useTheming } from '../../utils/theming-helper';
import { useScrollStory } from './useScrollStory';
import type { ScrollStory as ScrollStoryType } from './useScrollStory';

interface ScrollStoryProps {
  story: ScrollStoryType;
  onScrollProgress?: (progress: number) => void;
  onAnimationEnter?: (elementId: string) => void;
  onAnimationExit?: (elementId: string) => void;
  onTriggerActivate?: (triggerId: string) => void;
  enableParallax?: boolean;
  enableKeyboardNav?: boolean;
  preloadMedia?: boolean;
  autoPlayVideos?: boolean;
  children?: React.ReactNode;
}

interface MediaEntry {
  id: string;
  type: 'image' | 'video' | 'audio';
  url: string;
  thumbnail?: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isElementInPlaybackViewport(element: HTMLVideoElement): boolean {
  const rect = element.getBoundingClientRect();
  const mid = window.innerHeight / 2;
  return rect.top <= mid && rect.bottom >= mid;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function ScrollStory({
  story,
  onScrollProgress,
  onAnimationEnter,
  onAnimationExit,
  onTriggerActivate,
  enableParallax = true,
  enableKeyboardNav = true,
  preloadMedia = true,
  autoPlayVideos = true,
  children,
}: ScrollStoryProps): JSX.Element {
  const theming = useTheming('photographer');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const activeAnimationIds = useRef<Set<string>>(new Set());
  const activatedTriggerIds = useRef<Set<string>>(new Set());

  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [loadedMediaIds, setLoadedMediaIds] = useState<Set<string>>(new Set());

  const { scrollProgress, setScrollProgress } = useScrollStory();

  const pageCount = story.pages.length;

  const storyMedia = useMemo<MediaEntry[]>(() => {
    return story.pages.flatMap((page) =>
      page.media.map((media, mediaIndex) => ({
        id: `${page.id}-${mediaIndex}`,
        type: media.type,
        url: media.url,
        thumbnail: media.thumbnail,
      }))
    );
  }, [story.pages]);

  const scrollToPage = useCallback(
    (pageIndex: number) => {
      if (!containerRef.current || pageCount === 0) {
        return;
      }

      const bounded = clamp(pageIndex, 0, pageCount - 1);
      const target = containerRef.current.querySelector<HTMLElement>(`#page-${story.pages[bounded].id}`);
      if (target) {
        target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
      }
    },
    [pageCount, story.pages]
  );

  const handleScroll = useCallback(() => {
    if (isPaused || !containerRef.current || pageCount === 0) {
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const contentHeight = containerRef.current.offsetHeight;
    const maxScrollable = Math.max(1, contentHeight - window.innerHeight);
    const scrolledInContainer = clamp(-rect.top, 0, maxScrollable);
    const progress = clamp(scrolledInContainer / maxScrollable, 0, 1);

    setScrollProgress(progress);
    onScrollProgress?.(progress);

    const computedPageIndex = clamp(Math.floor(progress * pageCount), 0, Math.max(0, pageCount - 1));
    if (computedPageIndex !== currentPageIndex) {
      setCurrentPageIndex(computedPageIndex);
    }
  }, [currentPageIndex, isPaused, onScrollProgress, pageCount, setScrollProgress]);

  useEffect(() => {
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [handleScroll]);

  useEffect(() => {
    if (!enableKeyboardNav || pageCount === 0) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown' || event.key === 'PageDown') {
        event.preventDefault();
        scrollToPage(currentPageIndex + 1);
        return;
      }

      if (event.key === 'ArrowUp' || event.key === 'PageUp') {
        event.preventDefault();
        scrollToPage(currentPageIndex - 1);
        return;
      }

      if (event.key === ' ' || event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsPaused((previous) => !previous);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPageIndex, enableKeyboardNav, pageCount, scrollToPage]);

  useEffect(() => {
    if (!preloadMedia || storyMedia.length === 0) {
      return;
    }

    let cancelled = false;

    const markLoaded = (id: string) => {
      if (cancelled) {
        return;
      }
      setLoadedMediaIds((previous) => {
        const updated = new Set(previous);
        updated.add(id);
        return updated;
      });
    };

    storyMedia.forEach((media) => {
      if (media.type === 'image') {
        const image = new Image();
        image.onload = () => markLoaded(media.id);
        image.onerror = () => markLoaded(media.id);
        image.src = media.url;
        return;
      }

      const element = document.createElement(media.type === 'video' ? 'video' : 'audio');
      element.preload = 'metadata';
      element.onloadedmetadata = () => markLoaded(media.id);
      element.onerror = () => markLoaded(media.id);
      element.src = media.url;
    });

    return () => {
      cancelled = true;
    };
  }, [preloadMedia, storyMedia]);

  useEffect(() => {
    if (!autoPlayVideos || isPaused) {
      return;
    }

    videoRefs.current.forEach((video, videoId) => {
      if (isElementInPlaybackViewport(video)) {
        if (video.paused) {
          void video.play().catch(() => {
            // Autoplay may be blocked by browser policy.
          });
        }
      } else if (!video.paused) {
        video.pause();
      }

      if (!videoRefs.current.has(videoId)) {
        video.pause();
      }
    });
  }, [autoPlayVideos, isPaused, scrollProgress]);

  useEffect(() => {
    const triggerThresholds = story.scrollTriggers;
    if (triggerThresholds.length === 0) {
      return;
    }

    triggerThresholds.forEach((trigger) => {
      if (scrollProgress < trigger.threshold) {
        return;
      }

      if (activatedTriggerIds.current.has(trigger.id)) {
        return;
      }

      activatedTriggerIds.current.add(trigger.id);
      if (trigger.delay && trigger.delay > 0) {
        window.setTimeout(() => onTriggerActivate?.(trigger.id), trigger.delay);
      } else {
        onTriggerActivate?.(trigger.id);
      }
    });
  }, [onTriggerActivate, scrollProgress, story.scrollTriggers]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    observerRef.current?.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = entry.target.id;
          if (!id) {
            return;
          }

          if (entry.isIntersecting) {
            if (!activeAnimationIds.current.has(id)) {
              activeAnimationIds.current.add(id);
              onAnimationEnter?.(id);
            }
          } else if (activeAnimationIds.current.has(id)) {
            activeAnimationIds.current.delete(id);
            onAnimationExit?.(id);
          }
        });
      },
      {
        threshold: [0.25, 0.5, 0.75],
        rootMargin: '0px',
      }
    );

    const animationElementIds = new Set<string>();
    story.animations.forEach((animation) => animationElementIds.add(animation.elementId));
    story.pages.forEach((page) => {
      animationElementIds.add(`page-${page.id}`);
      animationElementIds.add(`page-title-${page.id}`);
      animationElementIds.add(`page-content-${page.id}`);
    });

    animationElementIds.forEach((id) => {
      const element = containerRef.current?.querySelector<HTMLElement>(`#${id}`) ?? document.getElementById(id);
      if (element) {
        observerRef.current?.observe(element);
      }
    });

    return () => {
      observerRef.current?.disconnect();
    };
  }, [onAnimationEnter, onAnimationExit, story.animations, story.pages]);

  useEffect(() => {
    story.animations.forEach((animation) => {
      const element = document.getElementById(animation.elementId);
      if (!element) {
        return;
      }

      const triggerPoint = animation.triggerPoint ?? 0;
      const durationPortion = 0.2;
      const localProgress = clamp((scrollProgress - triggerPoint) / durationPortion, 0, 1);

      const transition = `${animation.duration}ms ${animation.easing || 'cubic-bezier(0.4, 0, 0.2, 1)'}`;
      element.style.transition = `transform ${transition}, opacity ${transition}`;
      element.style.willChange = 'transform, opacity';

      const toOpacity = typeof animation.to.opacity === 'number' ? animation.to.opacity : typeof animation.to.opacity === 'string' ? Number.parseFloat(animation.to.opacity) : 1;
      if (Number.isFinite(toOpacity)) {
        element.style.opacity = String(clamp(localProgress * toOpacity, 0, 1));
      }

      const translateX = typeof animation.to.translateX === 'string' ? animation.to.translateX : '0px';
      const translateY = typeof animation.to.translateY === 'string' ? animation.to.translateY : '0px';
      const scale = typeof animation.to.scale === 'string' ? animation.to.scale : '1';

      if (localProgress > 0) {
        element.style.transform = `translateX(${translateX}) translateY(${translateY}) scale(${scale})`;
      }
    });
  }, [scrollProgress, story.animations]);

  const getPageProgress = useCallback(
    (pageIndex: number): number => {
      if (pageCount <= 1) {
        return 1;
      }
      const start = pageIndex / pageCount;
      const end = (pageIndex + 1) / pageCount;
      return clamp((scrollProgress - start) / Math.max(0.0001, end - start), 0, 1);
    },
    [pageCount, scrollProgress]
  );

  return (
    <Box
      ref={containerRef}
      id={`scroll-story-${story.id}`}
      role="article"
      aria-label={story.name}
      sx={{
        position: 'relative',
        minHeight: `${Math.max(1, pageCount) * 100}vh`,
        color: story.settings?.theme === 'dark' ? '#f5f5f5' : '#1f1f1f',
        backgroundColor: story.settings?.theme === 'dark' ? '#0f1115' : '#ffffff',
      }}
    >
      {story.pages.map((page, pageIndex) => {
        const pageProgress = getPageProgress(pageIndex);
        const active = pageIndex === currentPageIndex;
        const translateOffset = enableParallax ? (0.5 - pageProgress) * 60 : 0;

        return (
          <Box
            key={page.id}
            id={`page-${page.id}`}
            role="region"
            aria-label={`Page ${pageIndex + 1}: ${page.title}`}
            sx={{
              minHeight: '100vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              p: { xs: 2, md: 4 },
              position: 'relative',
              opacity: active ? 1 : 0.72,
              transform: `translateY(${translateOffset}px)`,
              transition: 'opacity 280ms ease, transform 320ms ease',
            }}
          >
            <Box sx={{ width: '100%', maxWidth: 980, textAlign: 'center' }}>
              <Box
                id={`page-title-${page.id}`}
                component="h1"
                sx={{
                  fontSize: { xs: '2rem', md: '3rem' },
                  fontWeight: 800,
                  lineHeight: 1.1,
                  mb: 1.5,
                }}
              >
                {page.title}
              </Box>

              <Box
                id={`page-content-${page.id}`}
                component="p"
                sx={{
                  fontSize: { xs: '1rem', md: '1.2rem' },
                  lineHeight: 1.7,
                  mb: 3,
                  maxWidth: 820,
                  mx: 'auto',
                  opacity: 0.95,
                }}
              >
                {page.content}
              </Box>

              <Box sx={{ display: 'grid', gap: 2 }}>
                {page.media.map((media, mediaIndex) => {
                  const mediaId = `${page.id}-${mediaIndex}`;
                  const isLoaded = loadedMediaIds.has(mediaId);

                  if (media.type === 'video') {
                    return (
                      <Box
                        key={mediaId}
                        id={`anim-${mediaId}`}
                        component="video"
                        ref={(element: HTMLVideoElement | null) => {
                          if (!element) {
                            videoRefs.current.delete(mediaId);
                            return;
                          }
                          videoRefs.current.set(mediaId, element);
                        }}
                        src={media.url}
                        poster={media.thumbnail}
                        controls
                        playsInline
                        muted
                        preload={preloadMedia ? 'metadata' : 'none'}
                        sx={{
                          width: '100%',
                          maxHeight: '70vh',
                          borderRadius: 2,
                          boxShadow: 3,
                          opacity: isLoaded ? 1 : 0.6,
                          transition: 'opacity 220ms ease',
                        }}
                        onLoadedMetadata={() => {
                          setLoadedMediaIds((previous) => {
                            const updated = new Set(previous);
                            updated.add(mediaId);
                            return updated;
                          });
                        }}
                      />
                    );
                  }

                  if (media.type === 'audio') {
                    return (
                      <Box
                        key={mediaId}
                        id={`anim-${mediaId}`}
                        component="audio"
                        src={media.url}
                        controls
                        preload={preloadMedia ? 'metadata' : 'none'}
                        sx={{ width: '100%' }}
                        onLoadedMetadata={() => {
                          setLoadedMediaIds((previous) => {
                            const updated = new Set(previous);
                            updated.add(mediaId);
                            return updated;
                          });
                        }}
                      />
                    );
                  }

                  return (
                    <Box
                      key={mediaId}
                      id={`anim-${mediaId}`}
                      component="img"
                      src={media.url}
                      alt={`${page.title} media ${mediaIndex + 1}`}
                      loading="lazy"
                      sx={{
                        width: '100%',
                        maxHeight: '62vh',
                        objectFit: 'cover',
                        borderRadius: 2,
                        boxShadow: 3,
                        opacity: isLoaded ? 1 : 0.55,
                        transition: 'opacity 220ms ease',
                      }}
                      onLoad={() => {
                        setLoadedMediaIds((previous) => {
                          const updated = new Set(previous);
                          updated.add(mediaId);
                          return updated;
                        });
                      }}
                    />
                  );
                })}
              </Box>
            </Box>
          </Box>
        );
      })}

      {children}

      {story.settings?.showProgress ? (
        <Box
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(scrollProgress * 100)}
          aria-label="Story progress"
          sx={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'min(420px, 88vw)',
            height: 8,
            borderRadius: 99,
            bgcolor: 'rgba(0,0,0,0.18)',
            overflow: 'hidden',
            zIndex: 20,
            backdropFilter: 'blur(8px)',
          }}
        >
          <Box
            sx={{
              width: `${scrollProgress * 100}%`,
              height: '100%',
              bgcolor: theming.colors.primary,
              transition: 'width 120ms linear',
            }}
          />
        </Box>
      ) : null}

      {enableKeyboardNav && pageCount > 0 ? (
        <Box
          sx={{
            position: 'fixed',
            right: 24,
            bottom: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            zIndex: 21,
          }}
        >
          <Tooltip title="Previous page (Arrow Up)">
            <span>
              <IconButton
                onClick={() => scrollToPage(currentPageIndex - 1)}
                disabled={currentPageIndex <= 0}
                aria-label="Previous page"
                sx={{ bgcolor: 'rgba(0,0,0,0.65)', color: '#fff' }}
              >
                <KeyboardArrowUp />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title={isPaused ? 'Resume (K or Space)' : 'Pause (K or Space)'}>
            <IconButton
              onClick={() => setIsPaused((previous) => !previous)}
              aria-label={isPaused ? 'Resume story' : 'Pause story'}
              sx={{ bgcolor: 'rgba(0,0,0,0.65)', color: '#fff' }}
            >
              {isPaused ? <PlayArrow /> : <Pause />}
            </IconButton>
          </Tooltip>

          <Tooltip title="Next page (Arrow Down)">
            <span>
              <IconButton
                onClick={() => scrollToPage(currentPageIndex + 1)}
                disabled={currentPageIndex >= pageCount - 1}
                aria-label="Next page"
                sx={{ bgcolor: 'rgba(0,0,0,0.65)', color: '#fff' }}
              >
                <KeyboardArrowDown />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      ) : null}
    </Box>
  );
}
