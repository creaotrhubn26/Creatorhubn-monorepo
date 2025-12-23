/**
 * ScrollStory SVG Graphic Component
 * Renders SVG graphics with automatic PNG conversion for better performance
 * Uses Resvg WASM for 40x faster rendering than native browser SVG
 */

import React, { useEffect, useState } from 'react';
import { Box, CircularProgress, Alert } from '@mui/material';
import { svgRenderer } from '../../services/svg-renderer';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';

interface ScrollStorySVGGraphicProps {
  svgContent?: string; // Inline SVG content
  svgUrl?: string; // URL to SVG file
  width?: number;
  height?: number;
  alt?: string;
  className?: string;
  animate?: boolean; // Whether to animate on scroll
  parallax?: boolean; // Enable parallax effect
  style?: React.CSSProperties;
}

export default function ScrollStorySVGGraphic({
  svgContent,
  svgUrl,
  width = 800,
  height = 600,
  alt = 'SVG Graphic',
  className,
  animate = true,
  parallax = false,
  style,
}: ScrollStorySVGGraphicProps) {
  const [renderedImage, setRenderedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { analytics, performance: perfTracking } = useEnhancedMasterIntegration();

  useEffect(() => {
    const renderSVG = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch SVG content if URL is provided
        let svg = svgContent;
        if (!svg && svgUrl) {
          const response = await fetch(svgUrl);
          if (!response.ok) {
            throw new Error('Failed to fetch SVG ');
          }
          svg = await response.text();
        }

        if (!svg) {
          throw new Error('No SVG content provided');
        }

        // Track rendering start
        const endTiming = perfTracking.startTiming('scroll_story_svg_graphic_render');

        // Render SVG to PNG using Resvg WASM
        const result = await svgRenderer.renderSVGToPNG(svg, {
          width,
          height,
          format: 'png',
          cache: true,
        });

        setRenderedImage(result.dataUrl);
        endTiming();

        // Track successful render
        analytics.trackEvent('scroll_story_svg_graphic_rendered', {
          width: result.width,
          height: result.height,
          renderTime: result.renderTime,
          cached: result.cached,
          hasUrl: !!svgUrl,
          hasInlineContent: !!svgContent,
        });

        console.log(
          `✅ SVG graphic rendered in ${result.renderTime.toFixed(2)}ms (${result.width}x${result.height})`,
        );
      } catch (err) {
        console.error('Error rendering SVG graphic: ', err);
        setError(err instanceof Error ? err.message : 'Failed to render SVG');

        analytics.trackEvent('scroll_story_svg_graphic_error', {
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      } finally {
        setLoading(false);
      }
    };

    renderSVG();
  }, [svgContent, svgUrl, width, height, analytics, perfTracking]);

  if (loading) {
    return (
      <Box
        display="flex"
        alignItems="center"
        justifyContent="center"
        width={width}
        height={height}
        sx={{
          backgroundColor: 'grey.100',
          borderRadius: 1}}>
        <CircularProgress size={40} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ width, maxWidth: '100%' }}>
        {error}
      </Alert>
    );
  }

  if (!renderedImage) {
    return null;
  }

  return (
    <Box
      component="img"
      src={renderedImage}
      alt={alt}
      className={className}
      sx={{
        maxWidth: '100%',
        height: 'auto',
        transition: animate ? 'transform 0.3s ease-out, opacity 0.3s ease-out' : 'none',
        ...style,
        ...(parallax && {
          transform: 'translateZ(0)', // Enable GPU acceleration
          willChange:'transform',
        }),
      }
    />
  );
}

/**
 * USAGE EXAMPLES: *
 * 1. Inline SVG content: * <ScrollStorySVGGraphic
 *   svgContent={`<svg>...</svg>`}
 *   width={800}
 *   height={600}
 * />
 *
 * 2. SVG from URL: * <ScrollStorySVGGraphic
 *   svgUrl="/images/graphic.svg"
 *   width={1200}
 *   height={800}
 * />
 *
 * 3. With animations and parallax: * <ScrollStorySVGGraphic
 *   svgUrl="/images/animated-graphic.svg"
 *   animate={true}
 *   parallax={true}
 *   width={1000}
 *   height={700}
 * />
 */
