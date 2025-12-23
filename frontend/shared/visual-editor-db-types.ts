/**
 * Visual Editor Database Types
 * Bridges frontend TypeScript types with Drizzle ORM schema
 */

import { z } from 'zod';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import {
  editorProjects,
  editorElements,
  animations,
  comments,
} from './creatorhub-visual-editor-schema';

// ============================================================================
// DATABASE SCHEMAS (from Drizzle tables)
// ============================================================================

// Project schemas
export const insertProjectSchema = createInsertSchema(editorProjects);
export const selectProjectSchema = createSelectSchema(editorProjects);
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type SelectProject = z.infer<typeof selectProjectSchema>;

// Element schemas
export const insertElementSchema = createInsertSchema(editorElements);
export const selectElementSchema = createSelectSchema(editorElements);
export type InsertElement = z.infer<typeof insertElementSchema>;
export type SelectElement = z.infer<typeof selectElementSchema>;

// Animation schemas
export const insertAnimationSchema = createInsertSchema(animations);
export const selectAnimationSchema = createSelectSchema(animations);
export type InsertAnimation = z.infer<typeof insertAnimationSchema>;
export type SelectAnimation = z.infer<typeof selectAnimationSchema>;

// Comment schemas
export const insertCommentSchema = createInsertSchema(comments);
export const selectCommentSchema = createSelectSchema(comments);
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type SelectComment = z.infer<typeof selectCommentSchema>;

// ============================================================================
// FRONTEND TYPES (matches VisualEditorContext.tsx)
// ============================================================================

export const PositionSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  zIndex: z.number(),
  alignment: z.object({
    horizontal: z.enum(['left', 'center', 'right']),
    vertical: z.enum(['top', 'middle', 'bottom']),
  }),
  locked: z.boolean(),
});

export const EditorElementFrontendSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  type: z.enum(['button', 'text', 'image', 'card', 'container', 'grid', 'audio', 'video']),
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  position: PositionSchema.optional(),
  styles: z.record(z.any()),
  props: z.record(z.any()),
  children: z.array(z.string()).optional(),
  parent: z.string().optional(),
  icon: z.string().optional(),
});

export const ProjectFrontendSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  elements: z.array(EditorElementFrontendSchema),
  settings: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
    backgroundColor: z.string(),
    gridSize: z.number(),
    snapToGrid: z.boolean(),
  }),
  metadata: z.object({
    createdBy: z.string(),
    createdAt: z.date(),
    lastModified: z.date(),
    version: z.number(),
  }),
  collaborators: z.array(z.string()).optional(),
  status: z.enum(['draft', 'review', 'published', 'archived']),
});

export type EditorElementFrontend = z.infer<typeof EditorElementFrontendSchema>;
export type ProjectFrontend = z.infer<typeof ProjectFrontendSchema>;

// ============================================================================
// CONVERSION FUNCTIONS (Frontend <-> Database)
// ============================================================================

/**
 * Convert frontend element to database element
 */
export function frontendElementToDb(element: EditorElementFrontend): InsertElement {
  return {
    id: element.id,
    projectId: '', // Will be set by caller
    elementType: element.type,
    xPosition: element.x,
    yPosition: element.y,
    width: element.width,
    height: element.height,
    styles: element.styles,
    props: element.props,
    children: element.children || [],
    parentId: element.parent || null,
    icon: element.icon || null,
  };
}

/**
 * Convert database element to frontend element
 */
export function dbElementToFrontend(element: SelectElement): EditorElementFrontend {
  return {
    id: element.id,
    type: element.elementType as EditorElementFrontend['type'],
    x: element.xPosition,
    y: element.yPosition,
    width: element.width,
    height: element.height,
    styles: (element.styles as Record<string, any>) || {},
    props: (element.props as Record<string, any>) || {},
    children: (element.children as string[]) || [],
    parent: element.parentId || undefined,
    icon: element.icon || undefined,
  };
}

/**
 * Convert frontend project to database project
 */
export function frontendProjectToDb(project: ProjectFrontend): InsertProject {
  return {
    id: project.id,
    name: project.name,
    elements: project.elements, // Store as JSON
    pageSettings: project.settings, // Store as JSON
    userId: project.metadata.createdBy,
  };
}

/**
 * Convert database project to frontend project
 */
export function dbProjectToFrontend(project: SelectProject): ProjectFrontend {
  const elements = (project.elements as any) || [];
  const settings = (project.pageSettings as any) || {
    width: 1200,
    height: 800,
    backgroundColor: '#ffffff',
    gridSize: 20,
    snapToGrid: true,
  };

  return {
    id: project.id,
    name: project.name,
    description: undefined,
    elements: Array.isArray(elements) ? elements : [],
    settings,
    metadata: {
      createdBy: project.userId,
      createdAt: project.createdAt || new Date(),
      lastModified: project.updatedAt || new Date(),
      version: 1,
    },
    status: 'draft',
  };
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate and parse frontend element
 */
export function validateElement(data: unknown): EditorElementFrontend {
  return EditorElementFrontendSchema.parse(data);
}

/**
 * Validate and parse frontend project
 */
export function validateProject(data: unknown): ProjectFrontend {
  return ProjectFrontendSchema.parse(data);
}

/**
 * Safe parse with error handling
 */
export function safeParseElement(
  data: unknown,
): { success: true; data: EditorElementFrontend } | { success: false; error: z.ZodError } {
  const result = EditorElementFrontendSchema.safeParse(data);
  return result;
}

/**
 * Safe parse project with error handling
 */
export function safeParseProject(
  data: unknown,
): { success: true; data: ProjectFrontend } | { success: false; error: z.ZodError } {
  const result = ProjectFrontendSchema.safeParse(data);
  return result;
}
