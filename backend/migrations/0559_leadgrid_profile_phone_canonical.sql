-- Leadgrid profile phone canonicalization.
--
-- Historical production databases can contain users.phone while the canonical
-- CreatorHub profile column is users.phone_number. Backfill safely when the
-- legacy column exists; clean databases only need phone_number from migration
-- 0373. We intentionally keep users.phone for rollback compatibility.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone_number TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'users'
       AND column_name = 'phone'
  ) THEN
    EXECUTE $sql$
      UPDATE users
         SET phone_number = NULLIF(BTRIM(phone), '')
       WHERE NULLIF(BTRIM(phone_number), '') IS NULL
         AND NULLIF(BTRIM(phone), '') IS NOT NULL
    $sql$;
  END IF;
END $$;

COMMENT ON COLUMN users.phone_number IS
  'Canonical user phone field shared by CreatorHub and Leadgrid profiles.';
