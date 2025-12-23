-- Migration: Add user journey tracking to invite_requests table
-- Date: 2025-11-28
-- Description: Add userJourneyStatus field for unified tracking of user progress

-- Add user journey status column
ALTER TABLE invite_requests 
ADD COLUMN IF NOT EXISTS user_journey_status VARCHAR(50) DEFAULT 'request_submitted';

-- Add invite tracking columns
ALTER TABLE invite_requests 
ADD COLUMN IF NOT EXISTS invite_sent_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS invite_sent_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS invite_email_opened_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS invite_link_clicked_at TIMESTAMP;

-- Add onboarding tracking columns
ALTER TABLE invite_requests 
ADD COLUMN IF NOT EXISTS onboarding_started_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 0;

-- Add index for user journey status queries
CREATE INDEX IF NOT EXISTS invite_requests_user_journey_status_idx ON invite_requests(user_journey_status);

-- Add comments
COMMENT ON COLUMN invite_requests.user_journey_status IS 'Current status in user journey: request_submitted, under_review, invite_sent, account_created, onboarding_started, onboarding_completed, active';
COMMENT ON COLUMN invite_requests.invite_sent_at IS 'When invitation email was sent';
COMMENT ON COLUMN invite_requests.invite_sent_count IS 'Number of times invite was sent';
COMMENT ON COLUMN invite_requests.invite_email_opened_at IS 'When user opened invite email (via tracking pixel)';
COMMENT ON COLUMN invite_requests.invite_link_clicked_at IS 'When user clicked invite link';
COMMENT ON COLUMN invite_requests.onboarding_started_at IS 'When user started onboarding';
COMMENT ON COLUMN invite_requests.onboarding_completed_at IS 'When user completed onboarding';
COMMENT ON COLUMN invite_requests.onboarding_step IS 'Current step in onboarding (for progress tracking)';

