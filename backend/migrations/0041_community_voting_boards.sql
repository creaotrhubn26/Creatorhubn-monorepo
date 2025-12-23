-- Community Voting Board Tables
-- Allows admins and promoted users to create voting boards for feature requests

-- Voting Boards table
CREATE TABLE IF NOT EXISTS community_voting_boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  board_type VARCHAR(50) DEFAULT 'feature_request' CHECK (board_type IN ('feature_request', 'poll', 'priority', 'feedback', 'general')),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'closed', 'archived')),
  created_by VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Settings
  allow_new_items BOOLEAN DEFAULT true,
  allow_comments BOOLEAN DEFAULT true,
  anonymous_voting BOOLEAN DEFAULT false,
  max_votes_per_user INTEGER DEFAULT NULL, -- NULL = unlimited
  voting_deadline TIMESTAMP,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  closed_at TIMESTAMP
);

-- Voting Items (individual votable items/feature requests)
CREATE TABLE IF NOT EXISTS community_voting_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES community_voting_boards(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  status VARCHAR(30) DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'planned', 'in_progress', 'completed', 'declined', 'duplicate')),
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  
  -- Author
  created_by VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_anonymous BOOLEAN DEFAULT false,
  
  -- Vote counts (denormalized for performance)
  upvotes INTEGER DEFAULT 0,
  downvotes INTEGER DEFAULT 0,
  score INTEGER DEFAULT 0, -- upvotes - downvotes
  
  -- Admin response
  admin_response TEXT,
  admin_response_by VARCHAR(255) REFERENCES users(id),
  admin_response_at TIMESTAMP,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- User Votes on Items
CREATE TABLE IF NOT EXISTS community_voting_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES community_voting_items(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote_type VARCHAR(10) NOT NULL CHECK (vote_type IN ('up', 'down')),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(item_id, user_id) -- One vote per user per item
);

-- Comments on Voting Items
CREATE TABLE IF NOT EXISTS community_voting_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES community_voting_items(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_admin_comment BOOLEAN DEFAULT false,
  parent_comment_id UUID REFERENCES community_voting_comments(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Board Permissions (which roles can create boards)
CREATE TABLE IF NOT EXISTS community_voting_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
  role_id UUID REFERENCES community_roles(id) ON DELETE CASCADE,
  permission_type VARCHAR(50) NOT NULL CHECK (permission_type IN ('create_board', 'create_item', 'moderate', 'admin')),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(group_id, role_id, permission_type)
);

-- Voting Item Tags for categorization
CREATE TABLE IF NOT EXISTS community_voting_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES community_voting_boards(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(20) DEFAULT '#2196f3',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(board_id, name)
);

-- Item-Tag associations
CREATE TABLE IF NOT EXISTS community_voting_item_tags (
  item_id UUID NOT NULL REFERENCES community_voting_items(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES community_voting_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (item_id, tag_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_voting_boards_group ON community_voting_boards(group_id);
CREATE INDEX IF NOT EXISTS idx_voting_boards_status ON community_voting_boards(status);
CREATE INDEX IF NOT EXISTS idx_voting_items_board ON community_voting_items(board_id);
CREATE INDEX IF NOT EXISTS idx_voting_items_status ON community_voting_items(status);
CREATE INDEX IF NOT EXISTS idx_voting_items_score ON community_voting_items(score DESC);
CREATE INDEX IF NOT EXISTS idx_voting_votes_item ON community_voting_votes(item_id);
CREATE INDEX IF NOT EXISTS idx_voting_votes_user ON community_voting_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_voting_comments_item ON community_voting_comments(item_id);
CREATE INDEX IF NOT EXISTS idx_voting_permissions_group ON community_voting_permissions(group_id);

-- Function to update item vote counts
CREATE OR REPLACE FUNCTION update_voting_item_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE community_voting_items SET
      upvotes = (SELECT COUNT(*) FROM community_voting_votes WHERE item_id = NEW.item_id AND vote_type = 'up'),
      downvotes = (SELECT COUNT(*) FROM community_voting_votes WHERE item_id = NEW.item_id AND vote_type = 'down'),
      score = (SELECT COUNT(*) FILTER (WHERE vote_type = 'up') - COUNT(*) FILTER (WHERE vote_type = 'down') FROM community_voting_votes WHERE item_id = NEW.item_id),
      updated_at = NOW()
    WHERE id = NEW.item_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE community_voting_items SET
      upvotes = (SELECT COUNT(*) FROM community_voting_votes WHERE item_id = OLD.item_id AND vote_type = 'up'),
      downvotes = (SELECT COUNT(*) FROM community_voting_votes WHERE item_id = OLD.item_id AND vote_type = 'down'),
      score = (SELECT COUNT(*) FILTER (WHERE vote_type = 'up') - COUNT(*) FILTER (WHERE vote_type = 'down') FROM community_voting_votes WHERE item_id = OLD.item_id),
      updated_at = NOW()
    WHERE id = OLD.item_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE community_voting_items SET
      upvotes = (SELECT COUNT(*) FROM community_voting_votes WHERE item_id = NEW.item_id AND vote_type = 'up'),
      downvotes = (SELECT COUNT(*) FROM community_voting_votes WHERE item_id = NEW.item_id AND vote_type = 'down'),
      score = (SELECT COUNT(*) FILTER (WHERE vote_type = 'up') - COUNT(*) FILTER (WHERE vote_type = 'down') FROM community_voting_votes WHERE item_id = NEW.item_id),
      updated_at = NOW()
    WHERE id = NEW.item_id;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS voting_vote_count_trigger ON community_voting_votes;
CREATE TRIGGER voting_vote_count_trigger
  AFTER INSERT OR UPDATE OR DELETE ON community_voting_votes
  FOR EACH ROW
  EXECUTE FUNCTION update_voting_item_counts();

