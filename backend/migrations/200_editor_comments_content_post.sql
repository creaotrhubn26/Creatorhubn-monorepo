-- Utvid anchor_type-CHECK på role_room_editor_comments slik at vi kan
-- forankre kommentarer til content production-posts også.
--
-- Bakgrunn: Bjarne hadde allerede et content production-modus i Role
-- Room hvor klienter åpner UI og ser feed-posts. Vi vil at klienter
-- kan kommentere DIREKTE på hver post i samme UI, og at Bjarne ser
-- klient-kommentarer i CollaborationSidebar i Post Agent — alt
-- gjennom samme tabell.

-- Drop eksisterende constraint og legg til nye anchor-typer
ALTER TABLE role_room_editor_comments
  DROP CONSTRAINT IF EXISTS role_room_editor_comments_anchor_type_check;

ALTER TABLE role_room_editor_comments
  ADD CONSTRAINT role_room_editor_comments_anchor_type_check
  CHECK (anchor_type IN (
    -- Post Agent editor-anchors (eksisterende):
    'timestamp', 'pick', 'cut', 'lower_third',
    'caption', 'broll', 'music', 'general',
    -- Nye: Role Room content production-anchors:
    'content_post',          -- generell post i content production
    'marketing_plan_post',   -- post i 3-slice marketing-plan
    'feed_plan_post',        -- post i feed planner (IG/TikTok/LinkedIn)
    'gallery_image',         -- bilde i klient-galleri
    'storyboard_frame'       -- frame i storyboard
  ));

COMMENT ON CONSTRAINT role_room_editor_comments_anchor_type_check
  ON role_room_editor_comments IS
  'Inkluderer både Post Agent-editor-anchors og Role Room content '
  'production-anchors. Klient + Bjarne ser samme kommentar-stream '
  'gjennom forskjellige UI-er (web for klient, Tauri for Bjarne).';
