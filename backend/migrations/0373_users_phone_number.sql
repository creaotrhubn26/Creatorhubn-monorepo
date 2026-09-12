-- Legg til phone_number på users-tabellen (mangler fra tidlig skjema-drift)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone_number" text;
