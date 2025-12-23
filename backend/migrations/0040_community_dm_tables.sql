-- Community Direct Message (DM) Tables
-- Supports private messaging between community members
-- Note: User IDs are VARCHAR to match the users table schema

-- DM Conversations table
CREATE TABLE IF NOT EXISTS community_dm_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(20) DEFAULT 'direct' CHECK (type IN ('direct', 'group')),
  name VARCHAR(255), -- For group DMs
  created_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- DM Participants table
CREATE TABLE IF NOT EXISTS community_dm_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES community_dm_conversations(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP DEFAULT NOW(),
  left_at TIMESTAMP, -- NULL means still active
  is_admin BOOLEAN DEFAULT false, -- For group DMs
  notifications_enabled BOOLEAN DEFAULT true,
  UNIQUE(conversation_id, user_id)
);

-- DM Messages table
CREATE TABLE IF NOT EXISTS community_dm_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES community_dm_conversations(id) ON DELETE CASCADE,
  sender_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'system')),
  is_read BOOLEAN DEFAULT false,
  is_edited BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,
  reply_to_id UUID REFERENCES community_dm_messages(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- User Blocks table
CREATE TABLE IF NOT EXISTS community_user_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(blocker_id, blocked_id)
);

-- User Mutes table (hides messages without blocking)
CREATE TABLE IF NOT EXISTS community_user_mutes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  muter_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  muted_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(muter_id, muted_id)
);

-- DM Message Reactions
CREATE TABLE IF NOT EXISTS community_dm_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES community_dm_messages(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_dm_participants_user ON community_dm_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_dm_participants_conversation ON community_dm_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_dm_messages_conversation ON community_dm_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_dm_messages_sender ON community_dm_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_dm_messages_created ON community_dm_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON community_user_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON community_user_blocks(blocked_id);
CREATE INDEX IF NOT EXISTS idx_user_mutes_muter ON community_user_mutes(muter_id);

-- Trigger to update conversation updated_at on new message
CREATE OR REPLACE FUNCTION update_dm_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE community_dm_conversations
  SET updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS dm_message_update_conversation ON community_dm_messages;
CREATE TRIGGER dm_message_update_conversation
  AFTER INSERT ON community_dm_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_dm_conversation_timestamp();

