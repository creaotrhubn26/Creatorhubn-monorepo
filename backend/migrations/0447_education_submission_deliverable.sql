-- Kobling: en student-innlevering peker til den ekte leveransen i produksjonen.
ALTER TABLE role_room_education_submissions
  ADD COLUMN IF NOT EXISTS deliverable_id UUID;
