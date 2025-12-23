-- Business Intelligence Database Migration
-- Creates tables for SWOT analysis, customer personas, surveys, and marketing campaigns

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== SWOT ANALYSIS TABLES ====================

-- SWOT Items Table
CREATE TABLE IF NOT EXISTS swot_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  profession VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('strength', 'weakness', 'opportunity', 'threat')),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL CHECK (category IN ('brand', 'product', 'distribution', 'promotion')),
  impact VARCHAR(50) NOT NULL CHECK (impact IN ('low', 'medium', 'high', 'critical')),
  probability VARCHAR(50) CHECK (probability IN ('low', 'medium', 'high')),
  status VARCHAR(50) NOT NULL DEFAULT 'identified' CHECK (status IN ('identified', 'analyzing', 'in_progress', 'resolved', 'archived')),
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_swot_items_user_profession ON swot_items(user_id, profession);
CREATE INDEX idx_swot_items_type ON swot_items(type);
CREATE INDEX idx_swot_items_status ON swot_items(status);

-- SWOT History Table
CREATE TABLE IF NOT EXISTS swot_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  swot_item_id UUID NOT NULL REFERENCES swot_items(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  change_type VARCHAR(50) NOT NULL CHECK (change_type IN ('create', 'update', 'delete', 'status_change')),
  old_value JSONB,
  new_value JSONB,
  changed_by VARCHAR(255) NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_swot_history_item ON swot_history(swot_item_id);
CREATE INDEX idx_swot_history_timestamp ON swot_history(timestamp);

-- ==================== CUSTOMER PERSONAS TABLES ====================

-- Customer Personas Table
CREATE TABLE IF NOT EXISTS customer_personas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  profession VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  avatar TEXT,
  age_range VARCHAR(50),
  location VARCHAR(255),
  income VARCHAR(100),
  customer_type VARCHAR(100) NOT NULL CHECK (customer_type IN ('individual', 'small_business', 'enterprise', 'agency', 'freelancer')),
  budget_tier VARCHAR(50) NOT NULL CHECK (budget_tier IN ('budget', 'mid_range', 'premium', 'luxury')),
  goals TEXT[] DEFAULT '{}',
  pain_points TEXT[] DEFAULT '{}',
  preferred_channels TEXT[] DEFAULT '{}',
  preferred_brands TEXT[] DEFAULT '{}',
  personality JSONB DEFAULT '{}',
  social_traits JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_customer_personas_user_profession ON customer_personas(user_id, profession);

-- ==================== SURVEY TABLES ====================

-- Surveys Table
CREATE TABLE IF NOT EXISTS surveys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  profession VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  purpose VARCHAR(100) NOT NULL CHECK (purpose IN ('swot_analysis', 'customer_satisfaction', 'market_research', 'product_feedback')),
  questions JSONB NOT NULL DEFAULT '[]',
  status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'closed')),
  target_audience JSONB DEFAULT '{}',
  response_count INTEGER DEFAULT 0,
  completion_rate DECIMAL(5,2) DEFAULT 0,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_surveys_user_profession ON surveys(user_id, profession);
CREATE INDEX idx_surveys_status ON surveys(status);

-- Survey Responses Table
CREATE TABLE IF NOT EXISTS survey_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  respondent_id VARCHAR(255),
  respondent_email VARCHAR(255),
  answers JSONB NOT NULL DEFAULT '{}',
  sentiment VARCHAR(50) CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  key_insights TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  submitted_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_survey_responses_survey ON survey_responses(survey_id);
CREATE INDEX idx_survey_responses_sentiment ON survey_responses(sentiment);

-- ==================== MARKETING TABLES ====================

-- Marketing Campaigns Table
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  profession VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL CHECK (type IN ('social_media', 'email', 'content', 'seo', 'paid_ads', 'influencer')),
  status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),
  budget DECIMAL(10,2),
  start_date DATE,
  end_date DATE,
  target_audience JSONB DEFAULT '{}',
  metrics JSONB DEFAULT '{}',
  content JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_marketing_campaigns_user_profession ON marketing_campaigns(user_id, profession);
CREATE INDEX idx_marketing_campaigns_status ON marketing_campaigns(status);

-- Newsletter Campaigns Table
CREATE TABLE IF NOT EXISTS newsletter_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  audience_segment VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sent', 'failed')),
  scheduled_date TIMESTAMP,
  sent_date TIMESTAMP,
  stats JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_newsletter_campaigns_user ON newsletter_campaigns(user_id);
CREATE INDEX idx_newsletter_campaigns_status ON newsletter_campaigns(status);

