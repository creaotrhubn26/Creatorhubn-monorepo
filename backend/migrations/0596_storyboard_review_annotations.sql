-- Non-destructive visual markup attached to immutable storyboard review comments.
-- Coordinates are normalized in the API so the overlay scales across web and iPad.

ALTER TABLE storyboard_review_comments
  ADD COLUMN IF NOT EXISTS annotations JSONB NOT NULL DEFAULT '[]'::jsonb;

DO $$ BEGIN
  ALTER TABLE storyboard_review_comments
    ADD CONSTRAINT storyboard_review_comments_annotations_shape
    CHECK (
      CASE
        WHEN jsonb_typeof(annotations) = 'array'
          THEN jsonb_array_length(annotations) <= 12
        ELSE FALSE
      END
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE storyboard_review_comments
    ADD CONSTRAINT storyboard_review_comments_annotations_size
    CHECK (pg_column_size(annotations) <= 65536);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
