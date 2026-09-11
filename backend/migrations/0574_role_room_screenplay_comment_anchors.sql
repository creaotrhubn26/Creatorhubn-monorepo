-- Script annotations in Story Writer use the shared editor-comments table.
-- Migration 200 replaced the original constraint before screenplay anchors
-- existed, so the route accepted these values while Postgres rejected them.

ALTER TABLE role_room_editor_comments
  DROP CONSTRAINT IF EXISTS role_room_editor_comments_anchor_type_check;

ALTER TABLE role_room_editor_comments
  ADD CONSTRAINT role_room_editor_comments_anchor_type_check
  CHECK (anchor_type IN (
    'timestamp', 'pick', 'cut', 'lower_third',
    'caption', 'broll', 'music', 'general',
    'content_post', 'marketing_plan_post', 'feed_plan_post',
    'gallery_image', 'storyboard_frame',
    'manuscript', 'manuscript_scene', 'screenplay_line', 'beat'
  ));

COMMENT ON CONSTRAINT role_room_editor_comments_anchor_type_check
  ON role_room_editor_comments IS
  'Shared editor anchors, including manuscript and selected screenplay text.';
