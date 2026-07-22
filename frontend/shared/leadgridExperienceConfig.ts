/**
 * leadgridExperienceConfig.ts — form + default for mockup-media-overstyringer.
 *
 * Kanonisk kilde for typen. Importeres av:
 *   • frontend/client/src/components/leadgrid/LeadgridExperience.tsx (leser + anvender)
 *   • frontend/client/src/components/admin/LeadgridExperienceMediaPanel.tsx (editor)
 *
 * ⚠️ SPEIL: backend/server/leadgrid-experience-config-routes.ts (runtime-kilde).
 *
 * Configen holder KUN overstyringer per scene-id; scenene har innebygde
 * defaults. Tom scene-oppføring = bruk default.
 */

export interface ExperienceSceneMedia {
  image?: string;
  video?: string;
}

export interface LeadgridExperienceConfig {
  scenes: Record<string, ExperienceSceneMedia>;
}

export const DEFAULT_EXPERIENCE_CONFIG: LeadgridExperienceConfig = { scenes: {} };

/** Lett manifest over scenene i scrollfilmen — så media-editoren vet hva som
 *  finnes uten å importere hele landing-komponenten. MÅ holdes i sync med
 *  SCENES i LeadgridExperience.tsx (samme id-er, default-media og kind). */
export type ExperienceSceneKind = 'cinematic' | 'device' | 'framed';
export interface ExperienceSceneInfo {
  id: string;
  title: string;
  kind: ExperienceSceneKind;
  /** Liggende iPad (bredere ramme) — kun for 'device'. */
  landscape?: boolean;
  defaultImage: string;
  defaultVideo?: string;
  /** Transparent enhets-ramme for 'framed' (watch). */
  bezel?: string;
}

export const EXPERIENCE_SCENE_MANIFEST: ExperienceSceneInfo[] = [
  { id: 'intro', title: 'Intro (feltet)', kind: 'cinematic', defaultImage: '/leadgrid/scenes/field-intro-1.webp' },
  { id: 'kart', title: 'Kartet', kind: 'device', landscape: true, defaultImage: '/leadgrid/app/tour-kart-poster.webp', defaultVideo: '/leadgrid/app/tour-kart.mp4' },
  { id: 'leads', title: 'Leads', kind: 'device', defaultImage: '/leadgrid/app/leads.webp' },
  { id: 'moter', title: 'Møter', kind: 'device', defaultImage: '/leadgrid/app/moter.webp' },
  { id: 'watch', title: 'Apple Watch', kind: 'framed', defaultImage: '/leadgrid/scenes/watch-screen-default.webp', bezel: '/leadgrid/scenes/watch-frame-fal.webp' },
  { id: 'dorsalg', title: 'Dørsalg', kind: 'device', landscape: true, defaultImage: '/leadgrid/app/tour-dorsalg-poster.webp', defaultVideo: '/leadgrid/app/tour-dorsalg.mp4' },
  { id: 'kvalitet', title: 'Kvalitet', kind: 'device', landscape: true, defaultImage: '/leadgrid/app/tour-kvalitet-poster.webp', defaultVideo: '/leadgrid/app/tour-kvalitet.mp4' },
  { id: 'go', title: 'Leadgrid Go', kind: 'device', defaultImage: '/leadgrid/app/tour-kjorebok-poster.webp', defaultVideo: '/leadgrid/app/tour-kjorebok.mp4' },
  { id: 'team', title: 'Team', kind: 'device', defaultImage: '/leadgrid/app/team.webp' },
  { id: 'leadbook', title: 'Leadbook', kind: 'device', defaultImage: '/leadgrid/app/leadbook.webp' },
  { id: 'oversikt', title: 'Oversikt', kind: 'device', defaultImage: '/leadgrid/app/oversikt.webp' },
];

/** Skjerm-rektangel (%) for watch-slot — matcher watch-bezel.webp (560×880). */
export const WATCH_SCREEN_RECT = { left: '11%', top: '23%', width: '76.5%', height: '53.5%' } as const;
