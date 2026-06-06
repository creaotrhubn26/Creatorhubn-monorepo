-- Self-Tape Studio demo-data — Northern Lights-prosjektet fra mockup
--
-- Mål: /talents/self-tapes?demo=1 viser nøyaktig samme state som
-- mockup #15 (Daniels Self-Tape Studio screenshot).
--
-- Fixture: Ingrid Nilsen (demo-talent fra Phase 2) får et prosjekt med
-- 5 takes, AI-feedback for take 3, og 3 submission-targets.

DO $$
DECLARE
  v_talent_id       UUID := '11111111-1111-1111-1111-111111111111';
  v_project_id      UUID := 'c1111111-1111-1111-1111-111111111111';
  v_take1_id        UUID := 'c2222222-1111-1111-1111-111111111111';
  v_take2_id        UUID := 'c2222222-2222-2222-2222-222222222222';
  v_take3_id        UUID := 'c2222222-3333-3333-3333-333333333333';
  v_take4_id        UUID := 'c2222222-4444-4444-4444-444444444444';
  v_take5_id        UUID := 'c2222222-5555-5555-5555-555555555555';
  v_feedback_id     UUID := 'c3333333-3333-3333-3333-333333333333';
  v_stella_id       UUID := 'a2222222-2222-2222-2222-2222222222a2';
BEGIN
  -- 1. Prosjekt: Northern Lights
  INSERT INTO talent_selftape_projects
    (id, talent_id, name, poster_color, status, role_name, role_type,
     scene_label, sides_pages, sides_content, is_demo)
  VALUES (
    v_project_id, v_talent_id, 'Northern Lights', '#1e1b4b', 'active',
    'Sara', 'Supporting', 'Scene 3', 2,
    E'**SARA**\nI didn''t think you''d actually come.\n\n**ALEX**\nI said I would.\n\n**SARA**\nYou said a lot of things. Not all of them true.\n\n**ALEX**\nI know.\n\n**SARA**\nDo you?\n',
    TRUE
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    role_name = EXCLUDED.role_name,
    sides_content = EXCLUDED.sides_content,
    updated_at = now();

  -- 2. 5 takes FØRST (uten ai_feedback_id ennå)
  INSERT INTO talent_selftape_takes
    (id, project_id, take_number, duration_ms, status, recorded_at, is_demo)
  VALUES
    (v_take1_id, v_project_id, 1, 58000,  'ready', now() - interval '5 hours', TRUE),
    (v_take2_id, v_project_id, 2, 65000,  'ready', now() - interval '4 hours', TRUE),
    (v_take3_id, v_project_id, 3, 72000,  'ready', now() - interval '3 hours', TRUE),
    (v_take4_id, v_project_id, 4, 47000,  'ready', now() - interval '2 hours', TRUE),
    (v_take5_id, v_project_id, 5, 61000,  'ready', now() - interval '1 hour',  TRUE)
  ON CONFLICT (id) DO UPDATE SET
    duration_ms = EXCLUDED.duration_ms,
    status = 'ready';

  -- 3. AI-feedback for take 3 (kan nå referere v_take3_id)
  INSERT INTO talent_selftape_ai_feedback
    (id, take_id, model_version, eye_line, pacing, sound, lighting, performance,
     camera_check, audio_check, framing_check, overall_grade, detailed_md,
     status, generated_at)
  VALUES (
    v_feedback_id, v_take3_id, 'demo-fixture',
    '{"grade":"Great","note":"Great eye contact and presence."}'::jsonb,
    '{"grade":"Good","note":"Nice rhythm, consider a slight pause after \"Not all of them true.\""}'::jsonb,
    '{"grade":"Great","note":"Audio is clear with minimal background noise."}'::jsonb,
    '{"grade":"Great","note":"Well balanced lighting, keep it up."}'::jsonb,
    '{"grade":"Good","note":"Emotional intent is clear and authentic."}'::jsonb,
    '{"status":"all_good","resolution":"1080p","frame_rate":"24 fps","stability":"Good"}'::jsonb,
    '{"status":"all_good","input_level":"Good","background_noise":"Low","clarity":"Clear"}'::jsonb,
    '{"status":"all_good","headroom":"Good","eye_line":"On Mark","lighting":"Well Lit"}'::jsonb,
    'Good',
    E'## Overall: Strong audition with room for nuance\n\n**Eye line — Great**\nDirect, present, and connected. The camera trust is solid throughout.\n\n**Pacing — Good**\nThe rhythm flows well, but the line "Not all of them true" lands harder with a half-beat pause before "true." Try giving Alex more space to register.\n\n**Sound — Great**\nClean signal, no clipping, ambient floor is quiet.\n\n**Lighting — Great**\nKey light is soft and warm, fill is balanced.\n\n**Performance — Good**\nThe emotional truth lands. Consider playing the subtext on "Do you?" — let the question carry more weight than the words.\n',
    'ready',
    now() - interval '2 hours'
  )
  ON CONFLICT (id) DO UPDATE SET
    eye_line = EXCLUDED.eye_line,
    overall_grade = EXCLUDED.overall_grade,
    status = 'ready';

  -- 4. Koble take 3 til feedback
  UPDATE talent_selftape_takes
     SET ai_feedback_id = v_feedback_id
   WHERE id = v_take3_id;

  -- 5. Marker take 3 som current
  UPDATE talent_selftape_projects
     SET current_take_id = v_take3_id
   WHERE id = v_project_id;

  -- 6. Submission-targets (3 stk fra mockup)
  INSERT INTO talent_selftape_submissions
    (id, project_id, take_id, target_type, enabled, status, deadline_at,
     agency_org_id, agency_preferred, is_demo)
  VALUES
    ('c4444444-1111-1111-1111-111111111111', v_project_id, v_take3_id,
     'agency_direct', TRUE, 'ready', '2024-05-31 23:59:00+00',
     v_stella_id, TRUE, TRUE),
    ('c4444444-2222-2222-2222-222222222222', v_project_id, v_take3_id,
     'private_link', TRUE, 'ready', NULL, NULL, FALSE, TRUE),
    ('c4444444-3333-3333-3333-333333333333', v_project_id, v_take3_id,
     'role_specific', TRUE, 'draft', NULL, NULL, FALSE, TRUE)
  ON CONFLICT (project_id, target_type, agency_org_id, casting_role_id)
  DO UPDATE SET enabled = TRUE, status = EXCLUDED.status;

  -- Sett private_token på private_link
  UPDATE talent_selftape_submissions
     SET private_token = 'demo-stella-northern-lights-' || substring(md5(random()::text), 1, 16),
         private_expires_at = now() + interval '60 days'
   WHERE id = 'c4444444-2222-2222-2222-222222222222'
     AND private_token IS NULL;

  -- 7. Submission-history (Echoes Within + Silent Echo fra mockup)
  INSERT INTO talent_selftape_projects
    (id, talent_id, name, status, role_name, role_type, scene_label, is_demo)
  VALUES
    ('c5555555-1111-1111-1111-111111111111', v_talent_id, 'The Silent Echo',
     'submitted', 'Ada', 'Lead', 'Final scene', TRUE),
    ('c5555555-2222-2222-2222-222222222222', v_talent_id, 'Echoes Within',
     'submitted', 'Livia', 'Supporting', 'Opening', TRUE)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO talent_selftape_takes
    (id, project_id, take_number, duration_ms, status, recorded_at, is_demo)
  VALUES
    ('c6666666-1111-1111-1111-111111111111', 'c5555555-1111-1111-1111-111111111111',
     1, 90000, 'ready', '2024-05-10 14:00:00+00', TRUE),
    ('c6666666-2222-2222-2222-222222222222', 'c5555555-2222-2222-2222-222222222222',
     1, 75000, 'ready', '2024-04-28 11:00:00+00', TRUE)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO talent_selftape_submissions
    (id, project_id, take_id, target_type, enabled, status,
     agency_org_id, agency_preferred, submitted_at, viewed_at, status_updated_at, is_demo)
  VALUES
    ('c7777777-1111-1111-1111-111111111111', 'c5555555-1111-1111-1111-111111111111',
     'c6666666-1111-1111-1111-111111111111', 'agency_direct', TRUE, 'viewed',
     v_stella_id, FALSE, '2024-05-10 14:30:00+00', '2024-05-11 09:00:00+00',
     '2024-05-11 09:00:00+00', TRUE),
    ('c7777777-2222-2222-2222-222222222222', 'c5555555-2222-2222-2222-222222222222',
     'c6666666-2222-2222-2222-222222222222', 'agency_direct', TRUE, 'shortlisted',
     v_stella_id, FALSE, '2024-04-28 11:30:00+00', '2024-04-29 10:00:00+00',
     '2024-04-30 14:00:00+00', TRUE)
  ON CONFLICT (project_id, target_type, agency_org_id, casting_role_id)
  DO UPDATE SET status = EXCLUDED.status;

  INSERT INTO talent_selftape_submission_events
    (submission_id, event_type, actor_label, created_at)
  VALUES
    ('c7777777-1111-1111-1111-111111111111', 'viewed',
     'Casting director — Stella', '2024-05-11 09:00:00+00'),
    ('c7777777-2222-2222-2222-222222222222', 'viewed',
     'Casting director — Stella', '2024-04-29 10:00:00+00'),
    ('c7777777-2222-2222-2222-222222222222', 'shortlisted',
     'Casting director — Stella', '2024-04-30 14:00:00+00')
  ON CONFLICT DO NOTHING;
END $$;
