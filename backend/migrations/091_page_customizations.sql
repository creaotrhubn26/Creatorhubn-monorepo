-- Migration: 091_page_customizations.sql
-- Purpose: Create tables for visual editor page customizations and wiring connections
-- Date: 2024-12-16

-- ============================================
-- PAGE CUSTOMIZATIONS TABLE
-- Stores customizations for all editable pages
-- ============================================
CREATE TABLE IF NOT EXISTS page_customizations (
  id SERIAL PRIMARY KEY,
  page_id VARCHAR(100) NOT NULL UNIQUE,
  page_type VARCHAR(50) NOT NULL, -- 'landing', 'academy', 'community', 'company', 'legal', 'showcase', 'pricing', 'wedding', 'admin', 'analytics', 'vendor', 'orchestrator'
  
  -- Section customizations (JSONB for flexibility)
  sections JSONB NOT NULL DEFAULT '{}',
  -- Example structure:
  -- {
  --   "hero": { "title": "...", "subtitle": "...", "ctaText": "...", "backgroundImage": "..." },
  --   "features": { "title": "...", "items": [...] },
  --   "testimonials": { "title": "...", "items": [...] }
  -- }
  
  -- Style customizations
  styles JSONB DEFAULT '{}',
  -- Example structure:
  -- {
  --   "colors": { "primary": "#ff6b00", "secondary": "#..." },
  --   "typography": { "headingFont": "...", "bodyFont": "..." },
  --   "spacing": { "sectionPadding": "80px" }
  -- }
  
  -- Wiring connections for node-based editor
  wiring_connections JSONB DEFAULT '[]',
  -- Example structure:
  -- [
  --   { "id": "conn1", "from": { "nodeId": "button1", "port": "onClick" }, "to": { "nodeId": "modal1", "port": "open" }, "type": "event" },
  --   { "from": "useAuth.user", "to": "UserProfile.userData", "type": "hook" },
  --   { "from": "icons.Home", "to": "NavButton.icon", "type": "icon" }
  -- ]
  
  -- Node positions for visual editor canvas
  node_positions JSONB DEFAULT '{}',
  -- Example structure:
  -- {
  --   "node1": { "x": 100, "y": 200 },
  --   "node2": { "x": 300, "y": 200 }
  -- }
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  -- Example: { "version": 1, "lastEditor": "user@email.com", "notes": "..." }
  
  -- Publishing state
  is_published BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMP,
  published_by VARCHAR(255),
  
  -- Draft content (separate from published)
  draft_sections JSONB DEFAULT NULL,
  draft_styles JSONB DEFAULT NULL,
  draft_wiring JSONB DEFAULT NULL,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_page_type CHECK (page_type IN (
    'landing', 'academy', 'community', 'company', 'legal', 
    'showcase', 'pricing', 'wedding', 'admin', 'analytics', 
    'vendor', 'orchestrator', 'equipment', 'email', 'seo', 'prototype'
  ))
);

-- ============================================
-- NODE CONFIGURATIONS TABLE
-- Stores configurations for individual nodes
-- ============================================
CREATE TABLE IF NOT EXISTS visual_editor_nodes (
  id SERIAL PRIMARY KEY,
  node_id VARCHAR(100) NOT NULL,
  page_id VARCHAR(100) NOT NULL REFERENCES page_customizations(page_id) ON DELETE CASCADE,
  
  -- Node type and category
  node_type VARCHAR(100) NOT NULL, -- 'OnClickNode', 'SelectNode', 'ComponentDocNode', etc.
  category VARCHAR(50) NOT NULL, -- 'events', 'logic', 'database', 'docs', etc.
  
  -- Node configuration
  config JSONB NOT NULL DEFAULT '{}',
  -- Example for SelectNode:
  -- { "table": "users", "columns": ["id", "name", "email"], "where": {...} }
  
  -- Position on canvas
  position_x INTEGER DEFAULT 0,
  position_y INTEGER DEFAULT 0,
  
  -- Node dimensions (for custom sizing)
  width INTEGER DEFAULT NULL,
  height INTEGER DEFAULT NULL,
  
  -- Node state
  is_collapsed BOOLEAN DEFAULT FALSE,
  is_locked BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(page_id, node_id)
);

-- ============================================
-- NODE CONNECTIONS TABLE
-- Stores connections between nodes
-- ============================================
CREATE TABLE IF NOT EXISTS visual_editor_connections (
  id SERIAL PRIMARY KEY,
  connection_id VARCHAR(100) NOT NULL,
  page_id VARCHAR(100) NOT NULL REFERENCES page_customizations(page_id) ON DELETE CASCADE,
  
  -- Source node
  source_node_id VARCHAR(100) NOT NULL,
  source_port VARCHAR(100) NOT NULL, -- 'output', 'onClick', 'data', etc.
  
  -- Target node
  target_node_id VARCHAR(100) NOT NULL,
  target_port VARCHAR(100) NOT NULL, -- 'input', 'trigger', 'props', etc.
  
  -- Connection type
  connection_type VARCHAR(50) NOT NULL DEFAULT 'data',
  -- Types: 'data', 'event', 'hook', 'icon', 'style', 'i18n', 'validation'
  
  -- Connection configuration
  config JSONB DEFAULT '{}',
  -- Example: { "transform": "map", "condition": "isValid" }
  
  -- Visual properties
  label VARCHAR(255) DEFAULT NULL,
  color VARCHAR(20) DEFAULT NULL,
  animated BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(page_id, connection_id)
);

-- ============================================
-- SUBGRAPHS TABLE
-- Stores reusable node groups
-- ============================================
CREATE TABLE IF NOT EXISTS visual_editor_subgraphs (
  id SERIAL PRIMARY KEY,
  subgraph_id VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50),
  
  -- Subgraph content
  nodes JSONB NOT NULL DEFAULT '[]',
  connections JSONB NOT NULL DEFAULT '[]',
  
  -- Input/Output ports
  input_ports JSONB DEFAULT '[]',
  output_ports JSONB DEFAULT '[]',
  
  -- Thumbnail/preview
  thumbnail_url VARCHAR(500),
  
  -- Usage tracking
  usage_count INTEGER DEFAULT 0,
  
  -- Creator info
  created_by VARCHAR(255),
  is_public BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- AUTO-GENERATED DOCUMENTATION TABLE
-- Stores generated documentation
-- ============================================
CREATE TABLE IF NOT EXISTS visual_editor_documentation (
  id SERIAL PRIMARY KEY,
  doc_id VARCHAR(100) NOT NULL UNIQUE,
  
  -- What this documents
  target_type VARCHAR(50) NOT NULL, -- 'component', 'api', 'database', 'workflow', 'project'
  target_id VARCHAR(255) NOT NULL,
  
  -- Documentation content
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  format VARCHAR(20) DEFAULT 'markdown', -- 'markdown', 'html', 'json'
  
  -- Auto-generation metadata
  generated_from JSONB DEFAULT '{}',
  -- Example: { "nodeId": "...", "sourceFile": "...", "trigger": "component_created" }
  
  -- Version tracking
  version INTEGER DEFAULT 1,
  previous_version_id INTEGER REFERENCES visual_editor_documentation(id),
  
  -- Publishing
  is_published BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMP,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- ENVIRONMENT CONFIGURATIONS TABLE
-- Stores environment variable mappings
-- ============================================
CREATE TABLE IF NOT EXISTS visual_editor_env_configs (
  id SERIAL PRIMARY KEY,
  config_id VARCHAR(100) NOT NULL UNIQUE,
  page_id VARCHAR(100) REFERENCES page_customizations(page_id) ON DELETE CASCADE,
  
  -- Environment
  environment VARCHAR(20) NOT NULL DEFAULT 'development',
  -- Values: 'development', 'staging', 'production'
  
  -- Variable mappings (encrypted storage recommended)
  variable_mappings JSONB NOT NULL DEFAULT '{}',
  -- Example: { "DATABASE_URL": "env:DATABASE_URL", "API_KEY": "secret:openai_key" }
  
  -- Feature flags
  feature_flags JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(page_id, environment)
);

-- ============================================
-- DEPENDENCY TRACKING TABLE
-- Tracks package dependencies for nodes
-- ============================================
CREATE TABLE IF NOT EXISTS visual_editor_dependencies (
  id SERIAL PRIMARY KEY,
  page_id VARCHAR(100) NOT NULL REFERENCES page_customizations(page_id) ON DELETE CASCADE,
  
  -- Package info
  package_name VARCHAR(255) NOT NULL,
  package_type VARCHAR(20) NOT NULL, -- 'npm', 'pip'
  version VARCHAR(50),
  
  -- Dependency metadata
  is_dev_dependency BOOLEAN DEFAULT FALSE,
  license VARCHAR(100),
  bundle_size INTEGER, -- in bytes
  
  -- Node that requires this
  required_by_node VARCHAR(100),
  
  -- Status
  is_installed BOOLEAN DEFAULT FALSE,
  install_error TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(page_id, package_name, package_type)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_page_customizations_page_type ON page_customizations(page_type);
CREATE INDEX IF NOT EXISTS idx_page_customizations_is_published ON page_customizations(is_published);
CREATE INDEX IF NOT EXISTS idx_page_customizations_updated_at ON page_customizations(updated_at);

CREATE INDEX IF NOT EXISTS idx_visual_editor_nodes_page_id ON visual_editor_nodes(page_id);
CREATE INDEX IF NOT EXISTS idx_visual_editor_nodes_node_type ON visual_editor_nodes(node_type);
CREATE INDEX IF NOT EXISTS idx_visual_editor_nodes_category ON visual_editor_nodes(category);

CREATE INDEX IF NOT EXISTS idx_visual_editor_connections_page_id ON visual_editor_connections(page_id);
CREATE INDEX IF NOT EXISTS idx_visual_editor_connections_source ON visual_editor_connections(source_node_id);
CREATE INDEX IF NOT EXISTS idx_visual_editor_connections_target ON visual_editor_connections(target_node_id);

CREATE INDEX IF NOT EXISTS idx_visual_editor_subgraphs_category ON visual_editor_subgraphs(category);
CREATE INDEX IF NOT EXISTS idx_visual_editor_subgraphs_is_public ON visual_editor_subgraphs(is_public);

CREATE INDEX IF NOT EXISTS idx_visual_editor_documentation_target ON visual_editor_documentation(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_visual_editor_documentation_is_published ON visual_editor_documentation(is_published);

CREATE INDEX IF NOT EXISTS idx_visual_editor_dependencies_page_id ON visual_editor_dependencies(page_id);
CREATE INDEX IF NOT EXISTS idx_visual_editor_dependencies_package ON visual_editor_dependencies(package_name, package_type);

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_page_customizations_updated_at ON page_customizations;
CREATE TRIGGER update_page_customizations_updated_at
    BEFORE UPDATE ON page_customizations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_visual_editor_nodes_updated_at ON visual_editor_nodes;
CREATE TRIGGER update_visual_editor_nodes_updated_at
    BEFORE UPDATE ON visual_editor_nodes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_visual_editor_subgraphs_updated_at ON visual_editor_subgraphs;
CREATE TRIGGER update_visual_editor_subgraphs_updated_at
    BEFORE UPDATE ON visual_editor_subgraphs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_visual_editor_documentation_updated_at ON visual_editor_documentation;
CREATE TRIGGER update_visual_editor_documentation_updated_at
    BEFORE UPDATE ON visual_editor_documentation
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_visual_editor_env_configs_updated_at ON visual_editor_env_configs;
CREATE TRIGGER update_visual_editor_env_configs_updated_at
    BEFORE UPDATE ON visual_editor_env_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

