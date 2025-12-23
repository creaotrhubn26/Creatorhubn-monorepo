-- Migration: Create AI Chat Tables
-- Created: 2025-01-25
-- Description: Tables for OpenAI chat history persistence

-- AI Chat Conversations Table
CREATE TABLE IF NOT EXISTS ai_chat_conversations (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  title VARCHAR(255),
  model VARCHAR(50) DEFAULT 'gpt-4',
  system_prompt TEXT,
  total_tokens INTEGER DEFAULT 0,
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for user queries
CREATE INDEX IF NOT EXISTS ai_chat_conversations_user_id_idx ON ai_chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS ai_chat_conversations_last_message_at_idx ON ai_chat_conversations(last_message_at DESC);

-- AI Chat Messages Table
CREATE TABLE IF NOT EXISTS ai_chat_messages (
  id VARCHAR(255) PRIMARY KEY,
  conversation_id VARCHAR(255) NOT NULL REFERENCES ai_chat_conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('system', 'user', 'assistant')),
  content TEXT NOT NULL,
  tokens INTEGER,
  attached_files JSONB,
  model VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for conversation queries
CREATE INDEX IF NOT EXISTS ai_chat_messages_conversation_id_idx ON ai_chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS ai_chat_messages_created_at_idx ON ai_chat_messages(created_at);

-- Add comment for documentation
COMMENT ON TABLE ai_chat_conversations IS 'Stores AI chat conversation metadata for OpenAI and other AI chats';
COMMENT ON TABLE ai_chat_messages IS 'Stores individual messages in AI chat conversations';
