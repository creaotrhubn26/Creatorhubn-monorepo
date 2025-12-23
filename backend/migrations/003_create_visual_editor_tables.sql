-- Visual Editor Tables Migration
-- Creates tables for visual editor projects and elements

-- Drop tables if they exist (for clean migration)
DROP TABLE IF EXISTS "text_effects" CASCADE;
DROP TABLE IF EXISTS "comments" CASCADE;
DROP TABLE IF EXISTS "advanced_animations" CASCADE;
DROP TABLE IF EXISTS "scroll_animations" CASCADE;
DROP TABLE IF EXISTS "particle_systems" CASCADE;
DROP TABLE IF EXISTS "parallax_effects" CASCADE;
DROP TABLE IF EXISTS "click_animations" CASCADE;
DROP TABLE IF EXISTS "hover_effects" CASCADE;
DROP TABLE IF EXISTS "animations" CASCADE;
DROP TABLE IF EXISTS "editor_elements" CASCADE;
DROP TABLE IF EXISTS "editor_projects" CASCADE;

-- Create editor_projects table
CREATE TABLE "editor_projects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar NOT NULL,
  "elements" jsonb NOT NULL DEFAULT '{}',
  "page_settings" jsonb NOT NULL DEFAULT '{}',
  "user_id" varchar NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Create editor_elements table
CREATE TABLE "editor_elements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" uuid NOT NULL REFERENCES "editor_projects"("id") ON DELETE CASCADE,
  "element_type" varchar NOT NULL,
  "x_position" integer NOT NULL,
  "y_position" integer NOT NULL,
  "width" integer NOT NULL,
  "height" integer NOT NULL,
  "styles" jsonb NOT NULL DEFAULT '{}',
  "props" jsonb NOT NULL DEFAULT '{}',
  "children" jsonb NOT NULL DEFAULT '[]',
  "parent_id" uuid REFERENCES "editor_elements"("id") ON DELETE SET NULL,
  "icon" varchar,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Create animations table
CREATE TABLE "animations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "element_id" uuid NOT NULL REFERENCES "editor_elements"("id") ON DELETE CASCADE,
  "animation_type" varchar NOT NULL,
  "duration" integer NOT NULL,
  "delay" integer DEFAULT 0,
  "easing" varchar NOT NULL,
  "direction" varchar,
  "iterations" integer,
  "fill_mode" varchar,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Create hover_effects table
CREATE TABLE "hover_effects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "element_id" uuid NOT NULL REFERENCES "editor_elements"("id") ON DELETE CASCADE,
  "effect_type" varchar NOT NULL,
  "value" varchar NOT NULL,
  "duration" integer NOT NULL,
  "easing" varchar NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Create click_animations table
CREATE TABLE "click_animations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "element_id" uuid NOT NULL REFERENCES "editor_elements"("id") ON DELETE CASCADE,
  "animation_type" varchar NOT NULL,
  "duration" integer NOT NULL,
  "intensity" integer NOT NULL,
  "easing" varchar NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Create parallax_effects table
CREATE TABLE "parallax_effects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "element_id" uuid NOT NULL REFERENCES "editor_elements"("id") ON DELETE CASCADE,
  "speed" decimal NOT NULL,
  "direction" varchar NOT NULL,
  "intensity" decimal NOT NULL,
  "enabled" boolean DEFAULT true,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Create particle_systems table
CREATE TABLE "particle_systems" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "element_id" uuid NOT NULL REFERENCES "editor_elements"("id") ON DELETE CASCADE,
  "particle_type" varchar NOT NULL,
  "count" integer NOT NULL,
  "speed" decimal NOT NULL,
  "size" decimal NOT NULL,
  "color" varchar NOT NULL,
  "enabled" boolean DEFAULT true,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Create scroll_animations table
CREATE TABLE "scroll_animations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "element_id" uuid NOT NULL REFERENCES "editor_elements"("id") ON DELETE CASCADE,
  "trigger_point" decimal NOT NULL,
  "animation_data" jsonb NOT NULL,
  "enabled" boolean DEFAULT true,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Create advanced_animations table
CREATE TABLE "advanced_animations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "element_id" uuid NOT NULL REFERENCES "editor_elements"("id") ON DELETE CASCADE,
  "animation_type" varchar NOT NULL,
  "properties" jsonb NOT NULL,
  "duration" integer NOT NULL,
  "easing" varchar NOT NULL,
  "loop" boolean DEFAULT false,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Create comments table (for collaboration)
CREATE TABLE "comments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "author" varchar NOT NULL,
  "content" text NOT NULL,
  "timestamp" timestamp DEFAULT now(),
  "element_id" uuid NOT NULL REFERENCES "editor_elements"("id") ON DELETE CASCADE,
  "resolved" boolean DEFAULT false,
  "replies" jsonb NOT NULL DEFAULT '[]',
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Create text_effects table
CREATE TABLE "text_effects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "element_id" uuid NOT NULL REFERENCES "editor_elements"("id") ON DELETE CASCADE,
  "effect_type" varchar NOT NULL,
  "value" varchar NOT NULL,
  "color" varchar,
  "intensity" integer,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX "idx_editor_projects_user_id" ON "editor_projects"("user_id");
CREATE INDEX "idx_editor_elements_project_id" ON "editor_elements"("project_id");
CREATE INDEX "idx_editor_elements_parent_id" ON "editor_elements"("parent_id");
CREATE INDEX "idx_animations_element_id" ON "animations"("element_id");
CREATE INDEX "idx_hover_effects_element_id" ON "hover_effects"("element_id");
CREATE INDEX "idx_click_animations_element_id" ON "click_animations"("element_id");
CREATE INDEX "idx_parallax_effects_element_id" ON "parallax_effects"("element_id");
CREATE INDEX "idx_particle_systems_element_id" ON "particle_systems"("element_id");
CREATE INDEX "idx_scroll_animations_element_id" ON "scroll_animations"("element_id");
CREATE INDEX "idx_advanced_animations_element_id" ON "advanced_animations"("element_id");
CREATE INDEX "idx_comments_element_id" ON "comments"("element_id");
CREATE INDEX "idx_text_effects_element_id" ON "text_effects"("element_id");

-- Add comments to tables
COMMENT ON TABLE "editor_projects" IS 'Visual editor projects - stores complete canvas projects';
COMMENT ON TABLE "editor_elements" IS 'Visual editor elements - individual canvas objects';
COMMENT ON TABLE "animations" IS 'Element animations';
COMMENT ON TABLE "hover_effects" IS 'Hover effect configurations';
COMMENT ON TABLE "click_animations" IS 'Click animation configurations';
COMMENT ON TABLE "comments" IS 'Collaboration comments on elements';
