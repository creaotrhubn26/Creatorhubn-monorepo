import { type ProBrushSettings } from './drawing/AdvancedBrushEngine';

export interface StoryboardPackSlotPatch {
  brushSettings?: Partial<ProBrushSettings>;
  cinematography?: {
    shotType?: string;
    cameraAngle?: string;
    lens?: string;
    movement?: string;
  };
  overlay?: {
    showGrid?: boolean;
    showSafeArea?: boolean;
    notes?: string;
  };
}

export interface StoryboardPackSlot {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  patch: StoryboardPackSlotPatch;
}

export interface StoryboardPack {
  id: string;
  name: string;
  description: string;
  coverImageUrl: string;
  baseBrushSettings: Partial<ProBrushSettings>;
  slots: StoryboardPackSlot[];
}

export interface StoryboardPackManifest {
  packs: StoryboardPack[];
  version: number;
  updatedAt: string;
  publishedAt?: string;
}

export interface StoryboardPackAdminState {
  draft: StoryboardPackManifest;
  published: StoryboardPackManifest;
  version: number;
  publishedAt: string | null;
  updatedAt: string | null;
}
