-- Auto-generated seed SQL for remaining empty tables
-- Review before executing: psql "$DATABASE_URL" -f seed_remaining.sql

-- public.page_customizations
BEGIN; SET CONSTRAINTS ALL DEFERRED; INSERT INTO public.page_customizations ("page_id", "page_type") VALUES ('Default', 'landing') ON CONFLICT DO NOTHING; COMMIT;

-- public.scheduled_course_posts
BEGIN; SET CONSTRAINTS ALL DEFERRED; INSERT INTO public.scheduled_course_posts ("course_id", "instructor_id", "channel_ids", "instructor_message", "scheduled_for") VALUES ((SELECT "id" FROM public.courses LIMIT 1), 'Default', 'Default', 'Default', CURRENT_TIMESTAMP) ON CONFLICT DO NOTHING; COMMIT;

-- public.split_sheet_calendar_events
BEGIN; SET CONSTRAINTS ALL DEFERRED; INSERT INTO public.split_sheet_calendar_events ("split_sheet_id", "event_type", "event_date", "event_title") VALUES ((SELECT "id" FROM public.split_sheets LIMIT 1), 'signature_deadline', CURRENT_DATE, 'Default') ON CONFLICT DO NOTHING; COMMIT;

-- public.split_sheet_contributor_access
-- Skipped: parent rows missing for FKs

-- public.split_sheet_contributors
BEGIN; SET CONSTRAINTS ALL DEFERRED; INSERT INTO public.split_sheet_contributors ("split_sheet_id", "name", "role", "percentage") VALUES ((SELECT "id" FROM public.split_sheets LIMIT 1), 'Default', 'producer', 1) ON CONFLICT DO NOTHING; COMMIT;

-- public.split_sheet_payments
-- Skipped: parent rows missing for FKs

-- public.split_sheet_revenue
BEGIN; SET CONSTRAINTS ALL DEFERRED; INSERT INTO public.split_sheet_revenue ("split_sheet_id", "amount", "revenue_source", "period_start", "period_end", "created_by") VALUES ((SELECT "id" FROM public.split_sheets LIMIT 1), 1, 'streaming', CURRENT_DATE, CURRENT_DATE, 'Default') ON CONFLICT DO NOTHING; COMMIT;

-- public.split_sheet_songflow_links
BEGIN; SET CONSTRAINTS ALL DEFERRED; INSERT INTO public.split_sheet_songflow_links ("split_sheet_id") VALUES ((SELECT "id" FROM public.split_sheets LIMIT 1)) ON CONFLICT DO NOTHING; COMMIT;

-- public.vendor_product_variants
BEGIN; SET CONSTRAINTS ALL DEFERRED; INSERT INTO public.vendor_product_variants ("product_id", "vendor_name", "vendor_type", "variant_name", "variant_values") VALUES (gen_random_uuid(), 'Default', 'Default', 'Default', 'Default') ON CONFLICT DO NOTHING; COMMIT;

-- public.visual_editor_connections
-- Skipped: parent rows missing for FKs

-- public.visual_editor_dependencies
-- Skipped: parent rows missing for FKs

-- public.visual_editor_nodes
-- Skipped: parent rows missing for FKs

-- public.wiremock_test_history
BEGIN; SET CONSTRAINTS ALL DEFERRED; INSERT INTO public.wiremock_test_history ("api_name", "endpoint", "method", "status", "status_code", "response_time") VALUES ('Default', 'http://localhost', 'GET', 'connected', 1, 1) ON CONFLICT DO NOTHING; COMMIT;

