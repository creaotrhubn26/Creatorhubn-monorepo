import { pgTable, varchar, text, jsonb, timestamp, boolean } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import type { z } from 'zod';

// Software and their keyboard shortcuts
export const editingSoftware = pgTable('editing_software', {
  id: varchar('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  category: varchar('category', { length: 50 }).notNull(), // photo, video, audio
  version: varchar('version', { length: 20 }),

  // Official sources for shortcut updates
  officialApiUrl: text('official_api_url'),
  documentationUrl: text('documentation_url'),
  lastShortcutUpdate: timestamp('last_shortcut_update'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Keyboard shortcuts for different software and platforms
export const keyboardShortcuts = pgTable('keyboard_shortcuts', {
  id: varchar('id').primaryKey(),
  softwareId: varchar('software_id').references(() => editingSoftware.id),

  // Shortcut details
  action: varchar('action', { length: 200 }).notNull(),
  category: varchar('category', { length: 100 }).notNull(), // File, Edit, View, etc.
  description: text('description'),

  // Platform-specific shortcuts
  macShortcut: varchar('mac_shortcut', { length: 100 }),
  windowsShortcut: varchar('windows_shortcut', { length: 100 }),
  linuxShortcut: varchar('linux_shortcut', { length: 100 }),

  // Metadata
  isEssential: boolean('is_essential').default(false),
  frequency: varchar('frequency', { length: 20 }), // daily, weekly, occasional
  difficulty: varchar('difficulty', { length: 20 }), // beginner, intermediate, advanced

  // Tags for searching
  tags: jsonb('tags').$type<string[]>().default([]),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// User's personalized shortcuts and preferences
export const userShortcutPreferences = pgTable('user_shortcut_preferences', {
  id: varchar('id').primaryKey(),
  userId: varchar('user_id').notNull(),
  softwareId: varchar('software_id').references(() => editingSoftware.id),

  // User preferences
  preferredPlatform: varchar('preferred_platform', { length: 20 }).notNull(), // mac, windows, linux
  showOnlyEssential: boolean('show_only_essential').default(false),
  favoriteShortcuts: jsonb('favorite_shortcuts').$type<string[]>().default([]),
  hiddenShortcuts: jsonb('hidden_shortcuts').$type<string[]>().default([]),

  // Custom shortcuts user has created
  customShortcuts: jsonb('custom_shortcuts')
    .$type<
      {
        action: string;
        shortcut: string;
        notes?: string;
      }[]
    >()
    .default([]),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Insert schemas
export const insertEditingSoftwareSchema = createInsertSchema(editingSoftware).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertKeyboardShortcutSchema = createInsertSchema(keyboardShortcuts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserShortcutPreferencesSchema = createInsertSchema(userShortcutPreferences).omit(
  {
    id: true,
    createdAt: true,
    updatedAt: true,
  },
);

// Types
export type EditingSoftware = typeof editingSoftware.$inferSelect;
export type KeyboardShortcut = typeof keyboardShortcuts.$inferSelect;
export type UserShortcutPreferences = typeof userShortcutPreferences.$inferSelect;

export type InsertEditingSoftware = z.infer<typeof insertEditingSoftwareSchema>;
export type InsertKeyboardShortcut = z.infer<typeof insertKeyboardShortcutSchema>;
export type InsertUserShortcutPreferences = z.infer<typeof insertUserShortcutPreferencesSchema>;

// Shortcut category definitions
export const SHORTCUT_CATEGORIES = {
  // Photo editing (Lightroom, Photoshop, Capture One)
  PHOTO: {
    'File Management': 'Åpne, lagre, importer, eksporter',
    'Basic Adjustments': 'Eksponering, kontrast, høylys, skygger',
    'Color Correction': 'Hvitbalanse, fargekorrigering, HSL',
    'Local Adjustments': 'Masking, børster, gradients',
    Navigation: 'Zoom, panorer, sammenlign',
    Library: 'Organiser, søk, filtrer, samlinger',
    Develop: 'Tone kurve, split toning, detaljer',
    Export: 'Eksportinnstillinger, batch prosessering',
  },

  // Video editing (DaVinci Resolve, Premiere Pro, Final Cut Pro)
  VIDEO: {
    Timeline: 'Klipp, flytt, trim, split',
    Playback: 'Play, pause, scrub, ramefremgang',
    'Color Grading': 'Nodes, curves, wheels, scopes',
    Audio: 'Sync, mix, keyframes, effects',
    Effects: 'Overganger, titler, generatorer',
    'Media Pool': 'Import, organiser, metadata',
    Render: 'Eksport, render køer, innstillinger',
    Multicam: 'Sync, cut, angle switching',
  },

  // Audio editing (Pro Tools, Logic Pro, Cubase)
  AUDIO: {
    Transport: 'Play, stop, record, loop',
    Editing: 'Klipp, copy, paste, quantize',
    Mixing: 'Faders, mute, solo, automation',
    Plugins: 'Inserts, sends, bypass',
    MIDI: 'Note editing, velocity, timing',
    Navigation: 'Zoom, scroll, markers',
    File: 'Save, bounce, export',
    Windows: 'Mixer, editor, browser',
  },
} as const;

// Platform-specific modifier keys
export const MODIFIER_KEYS = {
  mac: {
    cmd: '⌘',
    opt: '⌥',
    ctrl: '⌃',
    shift: '⇧',
    fn: 'fn',
  },
  windows: {
    ctrl: 'Ctrl',
    alt: 'Alt',
    shift: 'Shift',
    win: 'Win',
  },
  linux: {
    ctrl: 'Ctrl',
    alt: 'Alt',
    shift: 'Shift',
    super: 'Super',
  },
} as const;
