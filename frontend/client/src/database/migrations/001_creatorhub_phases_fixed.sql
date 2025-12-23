-- CreatorHub Norge Database Migration
-- Migration: 001_creatorhub_phases
-- Description: Create tables for the new CreatorHub phases and components
-- Date: 2024-01-15
-- FIXED: Removed user_activity table with non-existent user_id reference

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create phases table
CREATE TABLE IF NOT EXISTS phases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phase_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    icon_name VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    features JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create components table
CREATE TABLE IF NOT EXISTS components (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    component_id VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    phase_id VARCHAR(50) REFERENCES phases(phase_id),
    component_type VARCHAR(50) NOT NULL,
    file_path VARCHAR(500),
    props JSONB DEFAULT '{}',
    dependencies JSONB DEFAULT '[]',
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deprecated')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create icons table
CREATE TABLE IF NOT EXISTS icons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    icon_name VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    icon_type VARCHAR(50) NOT NULL CHECK (icon_type IN ('custom', 'material-ui')),
    svg_path TEXT,
    material_ui_name VARCHAR(100),
    category VARCHAR(50),
    tags JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create documentation_sections table
CREATE TABLE IF NOT EXISTS documentation_sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    section_id VARCHAR(100) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    content JSONB NOT NULL,
    category VARCHAR(50) NOT NULL,
    level VARCHAR(20) NOT NULL CHECK (level IN ('beginner', 'intermediate', 'advanced')),
    estimated_time VARCHAR(20),
    tags JSONB DEFAULT '[]',
    icon_name VARCHAR(100),
    order_index INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create system_stats table
CREATE TABLE IF NOT EXISTS system_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stat_name VARCHAR(100) UNIQUE NOT NULL,
    stat_value INTEGER NOT NULL,
    stat_type VARCHAR(50) NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert phases data
INSERT INTO phases (phase_id, name, description, icon_name, status, progress, features) VALUES
('phase0', 'Admin Notes System', 'Original CreatorHub Notes with AI utilities and Google Docs integration', 'notes', 'completed', 100, '["Rich Text Editor", "AI Utilities", "Google Docs Integration", "Note Management", "Search & Categories", "Auto-save"]'),
('phase1', 'Core Interactive Documentation', 'Foundation interactive documentation system with advanced features', 'interactiveDocs', 'completed', 100, '["Interactive Documents", "AI Integration", "Real-time Collaboration", "Advanced Analytics", "Gamification", "Mobile Design"]'),
('phase2', 'Advanced Features & Intelligence', 'AI-powered content enhancement and intelligent features', 'ai', 'completed', 100, '["AI Content Enhancement", "Real-time Collaboration", "Advanced Analytics", "Gamification System", "Mobile-First Design"]'),
('phase3', 'Advanced Visual Features & Customization', 'Advanced visual customization and theme management', 'themeEngine', 'completed', 100, '["Theme Engine", "Animation System", "Visual Effects", "Advanced Customization"]'),
('phase4', 'Security & Privacy Features', 'Comprehensive security and privacy management', 'security', 'completed', 100, '["Access Control", "Data Encryption", "Privacy Controls"]'),
('phase5', 'Integration & Testing Features', 'API integration and comprehensive testing framework', 'apiIntegration', 'completed', 100, '["API Integration", "Testing Framework", "Performance Monitoring"]'),
('phase6', 'CreatorHub Norge Documentation', 'Complete platform documentation and guides', 'documentation', 'completed', 100, '["Platform Overview", "Feature Documentation", "API Guides", "Deployment Guide", "Support Resources"]')
ON CONFLICT (phase_id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon_name = EXCLUDED.icon_name,
    status = EXCLUDED.status,
    progress = EXCLUDED.progress,
    features = EXCLUDED.features,
    updated_at = CURRENT_TIMESTAMP;

-- Insert components data
INSERT INTO components (component_id, name, description, phase_id, component_type, file_path, props, dependencies) VALUES
-- Phase 0 Components
('admin-notes', 'Admin CreatorHub Notes', 'Original CreatorHub Notes with AI utilities', 'phase0', 'admin', 'client/src/components/admin/CreatorHubNotes.tsx', '{"className": "string"}', '["react", "material-ui", "quill"]'),

-- Phase 1 Components
('interactive-docs', 'Interactive Document System', 'Core interactive documentation system', 'phase1', 'documentation', 'client/src/components/notes/InteractiveDocumentSystem.tsx', '{"className": "string"}', '["react", "material-ui"]'),
('ai-content', 'AI Content Enhancement', 'AI-powered content enhancement', 'phase1', 'ai', 'client/src/components/notes/AIContentEnhancement.tsx', '{"className": "string"}', '["react", "material-ui", "ai"]'),
('real-time-collab', 'Real-time Collaboration', 'Real-time collaboration features', 'phase1', 'collaboration', 'client/src/components/notes/RealTimeCollaboration.tsx', '{"className": "string"}', '["react", "material-ui", "socket.io"]'),
('advanced-analytics', 'Advanced Analytics', 'Advanced analytics and tracking', 'phase1', 'analytics', 'client/src/components/notes/AdvancedAnalytics.tsx', '{"className": "string"}', '["react", "material-ui", "charts"]'),
('gamification', 'Gamification System', 'Gamification and engagement', 'phase1', 'gamification', 'client/src/components/notes/GamificationSystem.tsx', '{"className": "string"}', '["react", "material-ui"]'),
('mobile-design', 'Mobile First Design', 'Mobile-first responsive design', 'phase1', 'mobile', 'client/src/components/notes/MobileFirstDesign.tsx', '{"className": "string"}', '["react", "material-ui"]'),

-- Phase 2 Components
('theme-engine', 'Theme Engine', 'Advanced theme management', 'phase2', 'theme', 'client/src/components/notes/ThemeEngine.tsx', '{"className": "string"}', '["react", "material-ui"]'),
('animation-system', 'Animation System', 'Animation and transitions', 'phase2', 'animation', 'client/src/components/notes/AnimationSystem.tsx', '{"className": "string"}', '["react", "material-ui", "framer-motion"]'),
('visual-effects', 'Visual Effects', 'Visual effects and enhancements', 'phase2', 'visual', 'client/src/components/notes/VisualEffects.tsx', '{"className": "string"}', '["react", "material-ui"]'),

-- Phase 3 Components
('access-control', 'Access Control', 'Role-based access control', 'phase3', 'security', 'client/src/components/notes/AccessControl.tsx', '{"className": "string"}', '["react", "material-ui"]'),
('data-encryption', 'Data Encryption', 'Data encryption management', 'phase3', 'security', 'client/src/components/notes/DataEncryption.tsx', '{"className": "string"}', '["react", "material-ui"]'),
('privacy-controls', 'Privacy Controls', 'Privacy and compliance controls', 'phase3', 'privacy', 'client/src/components/notes/PrivacyControls.tsx', '{"className": "string"}', '["react", "material-ui"]'),

-- Phase 4 Components
('api-integration', 'API Integration', 'API integration management', 'phase4', 'api', 'client/src/components/notes/APIIntegration.tsx', '{"className": "string"}', '["react", "material-ui"]'),
('testing-framework', 'Testing Framework', 'Comprehensive testing suite', 'phase4', 'testing', 'client/src/components/notes/TestingFramework.tsx', '{"className": "string"}', '["react", "material-ui", "jest"]'),
('performance-monitoring', 'Performance Monitoring', 'Performance monitoring', 'phase4', 'monitoring', 'client/src/components/notes/PerformanceMonitoring.tsx', '{"className": "string"}', '["react", "material-ui"]'),

-- Phase 5 Components
('creatorhub-docs', 'CreatorHub Norge Documentation', 'Complete platform documentation', 'phase5', 'documentation', 'client/src/components/notes/CreatorHubNorgeDocumentation.tsx', '{"className": "string"}', '["react", "material-ui"]'),
('main-integration', 'CreatorHub Notes Integration', 'Main integration component', 'phase5', 'integration', 'client/src/components/notes/CreatorHubNotes.tsx', '{"className": "string"}', '["react", "material-ui"]')
ON CONFLICT (component_id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    phase_id = EXCLUDED.phase_id,
    component_type = EXCLUDED.component_type,
    file_path = EXCLUDED.file_path,
    props = EXCLUDED.props,
    dependencies = EXCLUDED.dependencies,
    updated_at = CURRENT_TIMESTAMP;

-- Insert icons data
INSERT INTO icons (icon_name, display_name, icon_type, category, tags) VALUES
-- Custom Icons
('interactiveDocs', 'Interactive Documentation', 'custom', 'documentation', '["docs", "interactive", "content"]'),
('ai', 'Artificial Intelligence', 'custom', 'ai', '["ai", "intelligence", "smart"]'),
('collaboration', 'Collaboration', 'custom', 'collaboration', '["team", "collaboration", "work"]'),
('analyticsCustom', 'Analytics', 'custom', 'analytics', '["data", "analytics", "metrics"]'),
('gamification', 'Gamification', 'custom', 'engagement', '["game", "engagement", "motivation"]'),
('mobile', 'Mobile', 'custom', 'mobile', '["mobile", "responsive", "device"]'),
('themeEngine', 'Theme Engine', 'custom', 'theme', '["theme", "customization", "design"]'),
('animation', 'Animation', 'custom', 'animation', '["animation", "motion", "transition"]'),
('visualEffects', 'Visual Effects', 'custom', 'visual', '["effects", "visual", "enhancement"]'),
('accessControl', 'Access Control', 'custom', 'security', '["security", "access", "permissions"]'),
('dataEncryption', 'Data Encryption', 'custom', 'security', '["encryption", "security", "data"]'),
('privacyControls', 'Privacy Controls', 'custom', 'privacy', '["privacy", "compliance", "gdpr"]'),
('apiIntegration', 'API Integration', 'custom', 'integration', '["api", "integration", "connect"]'),
('testingFramework', 'Testing Framework', 'custom', 'testing', '["testing", "quality", "automation"]'),
('performanceMonitoring', 'Performance Monitoring', 'custom', 'monitoring', '["performance", "monitoring", "metrics"]'),
('webhook', 'Webhook', 'custom', 'integration', '["webhook", "integration", "real-time"]'),
('photography', 'Photography', 'custom', 'project', '["photo", "camera", "image"]'),
('videography', 'Videography', 'custom', 'project', '["video", "camera", "recording"]'),
('music', 'Music Production', 'custom', 'project', '["music", "audio", "sound"]'),
('corporate', 'Corporate', 'custom', 'project', '["business", "corporate", "professional"]'),
('ring', 'Wedding', 'custom', 'project', '["wedding", "ring", "marriage"]'),
('notes', 'Notes', 'material-ui', 'admin', '["notes", "text", "document"]'),
('architecture', 'Architecture', 'material-ui', 'technical', '["architecture", "system", "design"]'),
('documentation', 'Documentation', 'material-ui', 'documentation', '["docs", "documentation", "help"]'),
('support', 'Support', 'material-ui', 'support', '["help", "support", "assistance"]'),
('community', 'Community', 'material-ui', 'social', '["community", "group", "social"]'),
('video', 'Video', 'material-ui', 'media', '["video", "play", "media"]'),
('timer', 'Timer', 'material-ui', 'time', '["time", "timer", "duration"]'),
('category', 'Category', 'material-ui', 'organization', '["category", "group", "classify"]'),
('level', 'Level', 'material-ui', 'difficulty', '["level", "difficulty", "skill"]')
ON CONFLICT (icon_name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    icon_type = EXCLUDED.icon_type,
    category = EXCLUDED.category,
    tags = EXCLUDED.tags;

-- Insert documentation sections data
INSERT INTO documentation_sections (section_id, title, description, content, category, level, estimated_time, tags, icon_name, order_index) VALUES
('overview', 'CreatorHub Norge Overview', 'Complete overview of the CreatorHub Norge platform and its capabilities', '{"type": "overview", "content": "Platform overview content"}', 'overview', 'beginner', '5 min', '["overview", "introduction", "platform"]', 'business', 1),
('features', 'Core Features & Capabilities', 'Detailed overview of all platform features and capabilities', '{"type": "features", "content": "Features content"}', 'features', 'beginner', '15 min', '["features", "capabilities", "functionality"]', 'star', 2),
('architecture', 'System Architecture', 'Technical architecture and system design overview', '{"type": "architecture", "content": "Architecture content"}', 'architecture', 'advanced', '20 min', '["architecture", "technical", "system-design"]', 'architecture', 3),
('components', 'Component Library', 'Reusable components and their usage', '{"type": "components", "content": "Components content"}', 'components', 'intermediate', '25 min', '["components", "ui", "reusable"]', 'code', 4),
('api', 'API Documentation', 'REST API endpoints and integration guide', '{"type": "api", "content": "API content"}', 'api', 'intermediate', '30 min', '["api", "rest", "integration"]', 'api', 5),
('deployment', 'Deployment Guide', 'Production deployment and configuration', '{"type": "deployment", "content": "Deployment content"}', 'deployment', 'advanced', '45 min', '["deployment", "production", "configuration"]', 'cloudUpload', 6),
('support', 'Support & Resources', 'Support resources and community guidelines', '{"type": "support", "content": "Support content"}', 'support', 'beginner', '10 min', '["support", "help", "resources"]', 'support', 7)
ON CONFLICT (section_id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    content = EXCLUDED.content,
    category = EXCLUDED.category,
    level = EXCLUDED.level,
    estimated_time = EXCLUDED.estimated_time,
    tags = EXCLUDED.tags,
    icon_name = EXCLUDED.icon_name,
    order_index = EXCLUDED.order_index,
    updated_at = CURRENT_TIMESTAMP;

-- Insert system stats data
INSERT INTO system_stats (stat_name, stat_value, stat_type, description) VALUES
('total_phases', 7, 'count', 'Total number of development phases'),
('total_components', 19, 'count', 'Total number of components'),
('total_icons', 30, 'count', 'Total number of icons'),
('total_docs', 7, 'count', 'Total number of documentation sections')
ON CONFLICT (stat_name) DO UPDATE SET
    stat_value = EXCLUDED.stat_value,
    stat_type = EXCLUDED.stat_type,
    description = EXCLUDED.description,
    updated_at = CURRENT_TIMESTAMP;

-- Migration complete
SELECT 'Migration 001: CreatorHub Phases - Completed' AS status;
