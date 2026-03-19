import React, { type ReactElement } from "react";
import { Home as IntIcon, Landscape as ExtIcon, WbTwilight as TwilightIcon, EventNote as EventNoteIcon, PhotoCamera as PhotoCameraIcon, AccessTime as AccessTimeIcon, Pending as PendingIcon } from "@mui/icons-material";
import type { StripColorConfig } from "./stripboard.types";

// ─── Norwegian Film Standard colour codes ─────────────────────────────────────

export const STRIP_COLORS: Record<string, StripColorConfig> = {
  INT_DAY:   { bg: '#fff9c4', label: 'INT/DAG',      icon: React.createElement(IntIcon),      textColor: '#1a1a1a' }, // 7.8:1
  INT_NIGHT: { bg: '#9c27b0', label: 'INT/NATT',     icon: React.createElement(IntIcon),      textColor: '#ffffff' }, // 5.4:1
  EXT_DAY:   { bg: '#e3f2fd', label: 'EXT/DAG',      icon: React.createElement(ExtIcon),      textColor: '#1a1a1a' }, // 8.5:1
  EXT_NIGHT: { bg: '#1a237e', label: 'EXT/NATT',     icon: React.createElement(ExtIcon),      textColor: '#ffffff' }, // 10.2:1
  EXT_DAWN:  { bg: '#ffccbc', label: 'EXT/GRYNING',  icon: React.createElement(TwilightIcon), textColor: '#1a1a1a' }, // 6.1:1
  EXT_DUSK:  { bg: '#bf5530', label: 'EXT/SKUMRING', icon: React.createElement(TwilightIcon), textColor: '#ffffff' }, // 6.3:1
} as const;

/** Reverse-lookup from the hex colour stored on a strip to its key in STRIP_COLORS. */
export function getStripColorFromHex(hex: string): keyof typeof STRIP_COLORS {
  switch (hex) {
    case '#fff9c4':             return 'INT_DAY';
    case '#4a148c':
    case '#9c27b0':             return 'INT_NIGHT';
    case '#e3f2fd':             return 'EXT_DAY';
    case '#1a237e':             return 'EXT_NIGHT';
    case '#ffccbc':             return 'EXT_DAWN';
    case '#ff8a65':
    case '#bf5530':             return 'EXT_DUSK';
    default:                    return 'INT_DAY';
  }
}

// ─── Status display config ─────────────────────────────────────────────────────

export const STATUS_CONFIG: Record<
  string,
  { color: 'default' | 'primary' | 'success' | 'warning'; label: string; icon: ReactElement }
> = {
  'not-scheduled': { color: 'default',  label: 'Ikke planlagt', icon: React.createElement(PendingIcon) },
  'scheduled':     { color: 'primary',  label: 'Planlagt',      icon: React.createElement(EventNoteIcon) },
  'shot':          { color: 'success',  label: 'Skutt',         icon: React.createElement(PhotoCameraIcon) },
  'postponed':     { color: 'warning',  label: 'Utsatt',        icon: React.createElement(AccessTimeIcon) },
} as const;
