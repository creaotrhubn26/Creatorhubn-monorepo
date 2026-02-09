/**
 * PropertyPanel Automation Hooks
 * Zero-work automation for element editing
 */

import { useState, useCallback } from 'react';
import { svgRenderer } from '@/services/svg-renderer';
import { apiRequest } from '@/lib/queryClient';

interface EditorElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  styles: Record<string, any>;
  props: Record<string, any>;
}

interface StyleHistory {
  element: EditorElement;
  timestamp: number;
}

export function usePropertyPanelAutomation() {
  const [history, setHistory] = useState<StyleHistory[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [clipboard, setClipboard] = useState<Record<string, any> | null>(null);

  // 1. Export - One click PNG/WebP download
  const exportElement = useCallback(
    async (element: EditorElement, svgString: string, format: 'png' | 'webp' = 'png') => {
      try {
        const result = await svgRenderer.renderSVGToPNG(svgString, {
          width: element.width * 3, // 3x for high quality
          height: element.height * 3,
          format,
          cache: false,
        });

        // Download
        const link = document.createElement('a');
        link.href = result.dataUrl;
        link.download = `${element.type}-${element.id}.${format}`;
        link.click();

        return { success: true, renderTime: result.renderTime };
      } catch (error) {
        console.error('Export failed: ', error);
        return { success: false, error };
      }
    },
    [],
  );

  // 2. Preset Styles - Apply full themes
  const presetStyles = {
    modern: {
      fontFamily: "'Inter', sans-serif",
      fontSize: '16px',
      fontWeight: 400,
      borderRadius: '12px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
    },
    minimal: {
      fontFamily: "'Roboto', sans-serif",
      fontSize: '14px',
      fontWeight: 300,
      borderRadius: '4px',
      boxShadow: 'none',
      border: '1px solid #e0e0e0',
    },
    bold: {
      fontFamily: "'Montserrat', sans-serif",
      fontSize: '18px',
      fontWeight: 700,
      borderRadius: '8px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
      textTransform: 'uppercase',
    },
    elegant: {
      fontFamily: "'Playfair Display', serif",
      fontSize: '16px',
      fontWeight: 400,
      borderRadius: '0px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    },
  };

  const applyPreset = useCallback(
    (element: EditorElement, presetName: keyof typeof presetStyles): Partial<EditorElement> => {
      const preset = presetStyles[presetName];

      return {
        ...element,
        styles: {
          ...element.styles,
          ...preset,
        },
      };
    },
    [],
  );

  // 3. Undo/Redo
  const pushHistory = useCallback(
    (element: EditorElement) => {
      setHistory((prev) => {
        const newHistory = prev.slice(0, historyIndex + 1);
        return [
          ...newHistory,
          { element: JSON.parse(JSON.stringify(element)), timestamp: Date.now() },
        ];
      });
      setHistoryIndex((prev) => prev + 1);
    },
    [historyIndex],
  );

  const undo = useCallback((): EditorElement | null => {
    if (historyIndex > 0) {
      setHistoryIndex((prev) => prev - 1);
      return history[historyIndex - 1].element;
    }
    return null;
  }, [history, historyIndex]);

  const redo = useCallback((): EditorElement | null => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex((prev) => prev + 1);
      return history[historyIndex + 1].element;
    }
    return null;
  }, [history, historyIndex]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  // 4. Copy/Paste Styles
  const copyStyles = useCallback((element: EditorElement) => {
    setClipboard(element.styles);
    return true;
  }, []);

  const pasteStyles = useCallback(
    (element: EditorElement): Partial<EditorElement> => {
      if (!clipboard) return element;

      return {
        ...element,
        styles: {
          ...element.styles,
          ...clipboard,
        },
      };
    },
    [clipboard],
  );

  // 5. AI Color Palette Generator
  const generateColorPalette = useCallback(
    async (
      description: string,
    ): Promise<{
      primary: string;
      accent: string;
      background: string;
      text: string;
      gradient: string[];
    } | null> => {
      try {
        const response = await apiRequest<any>('/api/ai/generate-palette', {
          method: 'POST',
          body: { description },
        });

        return response;
      } catch (error) {
        console.error('AI palette generation failed:', error);
        return null;
      }
    },
    [],
  );

  // 6. Smart Resize - Responsive dimensions
  const smartResize = useCallback(
    (
      element: EditorElement,
      breakpoint: 'mobile' | 'tablet' | 'desktop',
    ): Partial<EditorElement> => {
      const breakpoints = {
        mobile: { widthMultiplier: 0.9, fontSize: 0.875 },
        tablet: { widthMultiplier: 0.95, fontSize: 0.9375 },
        desktop: { widthMultiplier: 1, fontSize: 1 },
      };

      const config = breakpoints[breakpoint];
      const baseFontSize = parseInt(element.styles.fontSize || '16px');

      return {
        ...element,
        width: Math.round(element.width * config.widthMultiplier),
        styles: {
          ...element.styles,
          fontSize: `${Math.round(baseFontSize * config.fontSize)}px`,
        },
      };
    },
    [],
  );

  // 7. Accessibility Check
  const checkAccessibility = useCallback((element: EditorElement) => {
    const textColor = element.styles.color || '#000000';
    const bgColor = element.styles.backgroundColor || '#ffffff';

    // Calculate contrast ratio
    const getLuminance = (hex: string) => {
      const rgb = parseInt(hex.slice(1), 16);
      const r = (rgb >> 16) & 0xff;
      const g = (rgb >> 8) & 0xff;
      const b = (rgb >> 0) & 0xff;

      const [rs, gs, bs] = [r, g, b].map((c) => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });

      return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    };

    const l1 = getLuminance(textColor);
    const l2 = getLuminance(bgColor);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

    const wcagAA = ratio >= 4.5;
    const wcagAAA = ratio >= 7;

    // Check font size
    const fontSize = parseInt(element.styles.fontSize || '16px');
    const isLargeText = fontSize >= 18;

    // Readability score
    const textLength = element.props.text?.length || 0;
    const readabilityIssues = [];

    if (textLength > 100 && fontSize < 14) {
      readabilityIssues.push('Text is too small for long content');
    }

    if (!wcagAA) {
      readabilityIssues.push('Insufficient color contrast');
    }

    return {
      contrastRatio: ratio.toFixed(2),
      wcagAA,
      wcagAAA,
      isLargeText,
      readabilityIssues,
      recommendation: wcagAAA
        ? 'Excellent accessibility'
        : wcagAA
          ? 'Good accessibility, consider AAA for critical text' : 'Improve contrast for better accessibility',
    };
  }, []);

  // 8. AI Style Suggestions
  const getAISuggestions = useCallback(
    async (
      element: EditorElement,
    ): Promise<{
      suggestions: Array<{ property: string; value: string; reason: string }>;
    } | null> => {
      try {
        const response = await apiRequest<any>('/api/ai/style-suggestions', {
          method:'POST',
          body: { element },
        });

        return response;
      } catch (error) {
        console.error('AI suggestions failed:', error);
        return null;
      }
    },
    [],
  );

  return {
    // Export
    exportElement,

    // Presets
    presetStyles: Object.keys(presetStyles),
    applyPreset,

    // History
    pushHistory,
    undo,
    redo,
    canUndo,
    canRedo,

    // Clipboard
    copyStyles,
    pasteStyles,
    hasClipboard: !!clipboard,

    // AI
    generateColorPalette,
    getAISuggestions,

    // Smart features
    smartResize,
    checkAccessibility,
  };
}
