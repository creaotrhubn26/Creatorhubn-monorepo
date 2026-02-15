/**
 * Evendi One-Pager — Demo / test page for the Enhanced Visual Editor
 *
 * Route: /evendi
 *
 * Loads the EnhancedVisualEditorPage pre-populated with a complete
 * one-page landing page for Evendi (event-industry marketplace).
 * This serves as a functional smoke-test for the visual editor —
 * every element type is represented so canvas rendering, property
 * editing, code-gen, and export can all be exercised.
 */

import React, { useEffect, useCallback } from 'react';
import {
  VisualEditorProvider,
  useVisualEditor,
} from '@/components/admin/visual-editor/VisualEditorContext';
import type { EditorElement } from '@/components/admin/visual-editor/VisualEditorContext';
import { EnhancedVisualEditorContent } from '@/components/admin/visual-editor/EnhancedVisualEditorPage';

/* ------------------------------------------------------------------ */
/*  Evendi brand tokens                                                */
/* ------------------------------------------------------------------ */
const EVENDI = {
  primary: '#6C3CE1',      // vibrant purple
  primaryDark: '#4A1FB8',
  accent: '#FF6B35',       // orange CTA
  dark: '#1A1A2E',         // near-black
  light: '#F5F3FF',        // soft lavender
  white: '#FFFFFF',
  grey: '#6B7280',
  radius: '12px',
  radiusLg: '24px',
  shadow: '0 4px 24px rgba(108,60,225,0.15)',
  fontHeading: "'Inter', sans-serif",
  fontBody: "'Inter', sans-serif",
} as const;

/* ------------------------------------------------------------------ */
/*  Pre-built elements for the one-pager                               */
/* ------------------------------------------------------------------ */
const evendiElements: EditorElement[] = [
  /* ── Hero background ─────────────────────────────────────────────── */
  {
    id: 'hero-bg',
    type: 'container',
    x: 0,
    y: 0,
    width: 1200,
    height: 600,
    styles: {
      backgroundColor: EVENDI.dark,
      display: 'flex',
      gap: '0px',
    },
    props: { text: '' },
  },

  /* ── Logo / brand ────────────────────────────────────────────────── */
  {
    id: 'logo',
    type: 'text',
    x: 80,
    y: 40,
    width: 200,
    height: 48,
    styles: {
      color: EVENDI.white,
      fontSize: '32px',
      fontWeight: '800',
      fontFamily: EVENDI.fontHeading,
    },
    props: { text: 'Evendi' },
  },

  /* ── Nav links ───────────────────────────────────────────────────── */
  {
    id: 'nav-links',
    type: 'text',
    x: 600,
    y: 48,
    width: 520,
    height: 32,
    styles: {
      color: EVENDI.white,
      fontSize: '15px',
      fontWeight: '500',
      fontFamily: EVENDI.fontBody,
      opacity: 0.85,
    },
    props: { text: 'Features    Pricing    For Vendors    Blog    Log In' },
  },

  /* ── Headline ────────────────────────────────────────────────────── */
  {
    id: 'hero-headline',
    type: 'text',
    x: 80,
    y: 160,
    width: 700,
    height: 120,
    styles: {
      color: EVENDI.white,
      fontSize: '56px',
      fontWeight: '800',
      lineHeight: '1.1',
      fontFamily: EVENDI.fontHeading,
    },
    props: { text: 'The All-in-One Event Industry Marketplace' },
  },

  /* ── Sub-headline ────────────────────────────────────────────────── */
  {
    id: 'hero-sub',
    type: 'text',
    x: 80,
    y: 300,
    width: 560,
    height: 80,
    styles: {
      color: EVENDI.white,
      fontSize: '20px',
      fontWeight: '400',
      lineHeight: '1.6',
      fontFamily: EVENDI.fontBody,
      opacity: 0.8,
    },
    props: {
      text: 'Connect with top photographers, videographers, DJs, planners & more. Book, manage, and create unforgettable events — all from one place.',
    },
  },

  /* ── CTA button ──────────────────────────────────────────────────── */
  {
    id: 'hero-cta',
    type: 'button',
    x: 80,
    y: 420,
    width: 240,
    height: 56,
    styles: {
      backgroundColor: EVENDI.accent,
      color: EVENDI.white,
      fontSize: '18px',
      fontWeight: '700',
      borderRadius: EVENDI.radius,
      boxShadow: '0 4px 16px rgba(255,107,53,0.35)',
      fontFamily: EVENDI.fontBody,
    },
    props: { text: 'Get Started Free' },
  },

  /* ── Secondary CTA ───────────────────────────────────────────────── */
  {
    id: 'hero-cta2',
    type: 'button',
    x: 350,
    y: 420,
    width: 200,
    height: 56,
    styles: {
      backgroundColor: 'transparent',
      color: EVENDI.white,
      fontSize: '18px',
      fontWeight: '600',
      borderRadius: EVENDI.radius,
      border: `2px solid ${EVENDI.white}`,
      fontFamily: EVENDI.fontBody,
    },
    props: { text: 'Watch Demo' },
  },

  /* ── Hero image placeholder ──────────────────────────────────────── */
  {
    id: 'hero-image',
    type: 'image',
    x: 780,
    y: 120,
    width: 380,
    height: 380,
    styles: {
      borderRadius: EVENDI.radiusLg,
      boxShadow: EVENDI.shadow,
      backgroundColor: EVENDI.primary,
      opacity: 0.9,
    },
    props: {
      text: '🎉',
      src: '',
      alt: 'Evendi event marketplace hero',
    },
  },

  /* ── Features section background ─────────────────────────────────── */
  {
    id: 'features-bg',
    type: 'container',
    x: 0,
    y: 620,
    width: 1200,
    height: 480,
    styles: {
      backgroundColor: EVENDI.light,
    },
    props: { text: '' },
  },

  /* ── Features heading ────────────────────────────────────────────── */
  {
    id: 'features-title',
    type: 'text',
    x: 80,
    y: 660,
    width: 500,
    height: 60,
    styles: {
      color: EVENDI.dark,
      fontSize: '40px',
      fontWeight: '800',
      fontFamily: EVENDI.fontHeading,
    },
    props: { text: 'Why Evendi?' },
  },

  /* ── Feature card 1 ──────────────────────────────────────────────── */
  {
    id: 'feature-card-1',
    type: 'card',
    x: 80,
    y: 750,
    width: 320,
    height: 260,
    styles: {
      backgroundColor: EVENDI.white,
      borderRadius: EVENDI.radius,
      boxShadow: EVENDI.shadow,
      padding: '32px',
    },
    props: {
      text: '📸  Verified Vendors\n\nBrowse hundreds of vetted event professionals with real reviews, portfolios, and transparent pricing.',
    },
  },

  /* ── Feature card 2 ──────────────────────────────────────────────── */
  {
    id: 'feature-card-2',
    type: 'card',
    x: 440,
    y: 750,
    width: 320,
    height: 260,
    styles: {
      backgroundColor: EVENDI.white,
      borderRadius: EVENDI.radius,
      boxShadow: EVENDI.shadow,
      padding: '32px',
    },
    props: {
      text: '📅  Smart Booking\n\nReal-time availability, instant quotes, contracts & payments — all handled inside Evendi.',
    },
  },

  /* ── Feature card 3 ──────────────────────────────────────────────── */
  {
    id: 'feature-card-3',
    type: 'card',
    x: 800,
    y: 750,
    width: 320,
    height: 260,
    styles: {
      backgroundColor: EVENDI.white,
      borderRadius: EVENDI.radius,
      boxShadow: EVENDI.shadow,
      padding: '32px',
    },
    props: {
      text: '🛠️  Visual Editor\n\nDesign your event website, invitations, and marketing pages with our drag-and-drop builder.',
    },
  },

  /* ── Social-proof section ────────────────────────────────────────── */
  {
    id: 'proof-bg',
    type: 'container',
    x: 0,
    y: 1120,
    width: 1200,
    height: 300,
    styles: {
      backgroundColor: EVENDI.primary,
    },
    props: { text: '' },
  },

  /* ── Social-proof heading ────────────────────────────────────────── */
  {
    id: 'proof-title',
    type: 'text',
    x: 200,
    y: 1160,
    width: 800,
    height: 60,
    styles: {
      color: EVENDI.white,
      fontSize: '36px',
      fontWeight: '800',
      fontFamily: EVENDI.fontHeading,
    },
    props: { text: 'Trusted by 5 000+ Event Professionals' },
  },

  /* ── Stats row ───────────────────────────────────────────────────── */
  {
    id: 'stat-1',
    type: 'text',
    x: 120,
    y: 1250,
    width: 240,
    height: 80,
    styles: {
      color: EVENDI.white,
      fontSize: '28px',
      fontWeight: '700',
      fontFamily: EVENDI.fontHeading,
    },
    props: { text: '12K+\nBookings' },
  },
  {
    id: 'stat-2',
    type: 'text',
    x: 400,
    y: 1250,
    width: 240,
    height: 80,
    styles: {
      color: EVENDI.white,
      fontSize: '28px',
      fontWeight: '700',
      fontFamily: EVENDI.fontHeading,
    },
    props: { text: '98%\nSatisfaction' },
  },
  {
    id: 'stat-3',
    type: 'text',
    x: 680,
    y: 1250,
    width: 240,
    height: 80,
    styles: {
      color: EVENDI.white,
      fontSize: '28px',
      fontWeight: '700',
      fontFamily: EVENDI.fontHeading,
    },
    props: { text: '50+\nCategories' },
  },
  {
    id: 'stat-4',
    type: 'text',
    x: 960,
    y: 1250,
    width: 240,
    height: 80,
    styles: {
      color: EVENDI.white,
      fontSize: '28px',
      fontWeight: '700',
      fontFamily: EVENDI.fontHeading,
    },
    props: { text: '24/7\nSupport' },
  },

  /* ── CTA section ─────────────────────────────────────────────────── */
  {
    id: 'cta-bg',
    type: 'container',
    x: 0,
    y: 1440,
    width: 1200,
    height: 320,
    styles: {
      backgroundColor: EVENDI.dark,
    },
    props: { text: '' },
  },

  {
    id: 'cta-title',
    type: 'text',
    x: 200,
    y: 1490,
    width: 800,
    height: 60,
    styles: {
      color: EVENDI.white,
      fontSize: '40px',
      fontWeight: '800',
      fontFamily: EVENDI.fontHeading,
    },
    props: { text: 'Ready to Transform Your Events?' },
  },

  {
    id: 'cta-sub',
    type: 'text',
    x: 280,
    y: 1560,
    width: 640,
    height: 50,
    styles: {
      color: EVENDI.white,
      fontSize: '18px',
      fontWeight: '400',
      fontFamily: EVENDI.fontBody,
      opacity: 0.8,
    },
    props: { text: 'Join thousands of event professionals already using Evendi.' },
  },

  {
    id: 'cta-btn',
    type: 'button',
    x: 440,
    y: 1640,
    width: 320,
    height: 60,
    styles: {
      backgroundColor: EVENDI.accent,
      color: EVENDI.white,
      fontSize: '20px',
      fontWeight: '700',
      borderRadius: EVENDI.radius,
      boxShadow: '0 4px 16px rgba(255,107,53,0.4)',
      fontFamily: EVENDI.fontBody,
    },
    props: { text: 'Start Free Trial →' },
  },

  /* ── Footer ──────────────────────────────────────────────────────── */
  {
    id: 'footer-bg',
    type: 'container',
    x: 0,
    y: 1780,
    width: 1200,
    height: 100,
    styles: {
      backgroundColor: '#0F0F1A',
    },
    props: { text: '' },
  },

  {
    id: 'footer-text',
    type: 'text',
    x: 80,
    y: 1810,
    width: 400,
    height: 30,
    styles: {
      color: EVENDI.grey,
      fontSize: '14px',
      fontWeight: '400',
      fontFamily: EVENDI.fontBody,
    },
    props: { text: '© 2026 Evendi. All rights reserved.' },
  },

  {
    id: 'footer-links',
    type: 'text',
    x: 700,
    y: 1810,
    width: 420,
    height: 30,
    styles: {
      color: EVENDI.grey,
      fontSize: '14px',
      fontWeight: '400',
      fontFamily: EVENDI.fontBody,
    },
    props: { text: 'Privacy    Terms    Contact    Status' },
  },
];

/* ------------------------------------------------------------------ */
/*  Inner page that loads the project after mount                      */
/* ------------------------------------------------------------------ */
const EvendiOnePagerInner: React.FC = () => {
  const { loadProject, dispatch } = useVisualEditor();

  const loadEvendiProject = useCallback(() => {
    loadProject({
      id: 'evendi-one-pager',
      name: 'Evendi — Landing Page',
      description: 'One-page marketing site for the Evendi event-industry marketplace',
      elements: evendiElements,
      settings: {
        width: 1200,
        height: 1880,
        backgroundColor: EVENDI.dark,
        gridSize: 10,
        snapToGrid: true,
      },
      metadata: {
        createdBy: 'evendi-test',
        createdAt: new Date(),
        lastModified: new Date(),
        version: 1,
      },
      status: 'draft',
    });

    dispatch({
      type: 'ADD_NOTIFICATION',
      payload: {
        id: `notif-evendi-${Date.now()}`,
        type: 'success' as const,
        title: 'Evendi One-Pager Loaded',
        message:
          'Landing page loaded with hero, features, social proof, CTA, and footer sections. You can now edit any element on the canvas.',
        timestamp: new Date(),
        read: false,
      },
    });
  }, [loadProject, dispatch]);

  useEffect(() => {
    loadEvendiProject();
  }, [loadEvendiProject]);

  return <EnhancedVisualEditorContent />;
};

/* ------------------------------------------------------------------ */
/*  Exported page component                                            */
/* ------------------------------------------------------------------ */

/**
 * Evendi One-Pager test page.
 *
 * Renders the EnhancedVisualEditorPage pre-loaded with a complete
 * Evendi landing page project. Navigate to /evendi to test.
 */
const EvendiOnePager: React.FC = () => {
  return (
    <VisualEditorProvider>
      <EvendiOnePagerInner />
    </VisualEditorProvider>
  );
};

export default EvendiOnePager;
