CREATE TABLE IF NOT EXISTS "action_usage_stats" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action_type" varchar NOT NULL,
	"user_id" varchar,
	"metadata" jsonb,
	"execution_time_ms" integer,
	"success" boolean DEFAULT true,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admin_notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"type" varchar NOT NULL,
	"title" varchar NOT NULL,
	"message" text NOT NULL,
	"severity" varchar DEFAULT 'info',
	"category" varchar,
	"is_read" boolean DEFAULT false,
	"action_required" boolean DEFAULT false,
	"action_url" varchar,
	"metadata" jsonb,
	"read_at" timestamp,
	"expires_at" timestamp,
	"priority" varchar DEFAULT 'normal',
	"status" varchar DEFAULT 'active',
	"dismissed_at" timestamp,
	"resolved_at" timestamp,
	"target_audience" varchar DEFAULT 'admin',
	"is_active" boolean DEFAULT true,
	"scheduled_for" timestamp,
	"action_button" varchar,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "advanced_email_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"subject" varchar NOT NULL,
	"template_type" varchar NOT NULL,
	"html_content" text NOT NULL,
	"text_content" text,
	"variables" jsonb,
	"is_active" boolean DEFAULT true,
	"is_default" boolean DEFAULT false,
	"usage_count" integer DEFAULT 0,
	"last_used" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "analytics_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"report_type" varchar NOT NULL,
	"report_period" varchar NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"report_data" jsonb NOT NULL,
	"generated_at" timestamp DEFAULT now(),
	"is_automated" boolean DEFAULT false,
	"scheduled_for" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "api_integration_health_checks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service" varchar NOT NULL,
	"endpoint" varchar NOT NULL,
	"status" varchar NOT NULL,
	"response_time" integer,
	"status_code" integer,
	"error_message" text,
	"last_checked" timestamp DEFAULT now() NOT NULL,
	"next_check" timestamp,
	"check_interval" integer DEFAULT 300,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "api_integration_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"process_id" varchar NOT NULL,
	"step_number" integer NOT NULL,
	"log_level" varchar NOT NULL,
	"message" text NOT NULL,
	"details" jsonb,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "api_integration_processes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service" varchar NOT NULL,
	"total_steps" integer DEFAULT 10 NOT NULL,
	"current_step" integer DEFAULT 0 NOT NULL,
	"status" varchar DEFAULT 'initializing' NOT NULL,
	"start_time" timestamp DEFAULT now() NOT NULL,
	"completed_time" timestamp,
	"error_message" text,
	"step_details" jsonb,
	"dev_steps_enabled" boolean DEFAULT false,
	"dev_step_details" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "api_keys" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"service" varchar(100) NOT NULL,
	"key_type" varchar(50) NOT NULL,
	"masked_key" varchar(255) NOT NULL,
	"encrypted_key" text,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb,
	"monthly_quota" integer DEFAULT 0,
	"usage_count" integer DEFAULT 0,
	"last_used" timestamp,
	"rotation_due" timestamp,
	"created_by" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audio_enhancements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"audio_project_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"job_name" varchar NOT NULL,
	"description" text,
	"enhancement_type" varchar NOT NULL,
	"model_used" varchar NOT NULL,
	"model_version" varchar,
	"model_parameters" jsonb,
	"input_file_path" varchar NOT NULL,
	"output_file_path" varchar,
	"stem_output_paths" jsonb,
	"input_format" varchar,
	"output_format" varchar,
	"sample_rate" integer,
	"bit_depth" integer,
	"channels" integer,
	"duration" integer,
	"processing_settings" jsonb,
	"status" varchar DEFAULT 'queued',
	"progress" integer DEFAULT 0,
	"stage" varchar,
	"estimated_time_remaining" integer,
	"input_quality_score" numeric(5, 2),
	"output_quality_score" numeric(5, 2),
	"improvement_score" numeric(5, 2),
	"input_analysis" jsonb,
	"output_analysis" jsonb,
	"processing_time" integer,
	"cpu_usage" numeric(5, 2),
	"memory_usage" integer,
	"gpu_usage" numeric(5, 2),
	"error_message" text,
	"error_code" varchar,
	"retry_count" integer DEFAULT 0,
	"max_retries" integer DEFAULT 3,
	"user_rating" integer,
	"user_feedback" text,
	"was_useful_flag" boolean,
	"improvement_suggestions" text,
	"is_ab_test" boolean DEFAULT false,
	"comparison_jobs" text[],
	"preferred_result" varchar,
	"is_batch_job" boolean DEFAULT false,
	"batch_id" varchar,
	"batch_position" integer,
	"batch_total" integer,
	"version" integer DEFAULT 1,
	"parent_job_id" varchar,
	"is_latest_version" boolean DEFAULT true,
	"requires_client_approval" boolean DEFAULT false,
	"client_approval_status" varchar,
	"client_feedback" text,
	"client_listen_count" integer DEFAULT 0,
	"is_delivered" boolean DEFAULT false,
	"delivered_at" timestamp,
	"delivery_format" varchar,
	"download_count" integer DEFAULT 0,
	"is_archived" boolean DEFAULT false,
	"archived_at" timestamp,
	"auto_cleanup_date" timestamp,
	"notifications_enabled" boolean DEFAULT true,
	"notifications_sent" jsonb,
	"processing_cost" numeric(8, 4),
	"compute_credits_used" integer,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audio_projects" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"title" varchar NOT NULL,
	"artist_name" varchar NOT NULL,
	"album_name" varchar,
	"genre" varchar,
	"subgenre" varchar,
	"project_type" varchar NOT NULL,
	"category" varchar NOT NULL,
	"sample_rate" integer DEFAULT 44100,
	"bit_depth" integer DEFAULT 24,
	"number_of_channels" integer DEFAULT 2,
	"project_length" integer,
	"tempo" numeric(6, 2),
	"key_signature" varchar,
	"time_signature" varchar DEFAULT '4/4',
	"daw" varchar NOT NULL,
	"daw_version" varchar,
	"plugins" text[],
	"templates_used" text[],
	"session_file_path" varchar,
	"project_folder_path" varchar,
	"audio_files_path" varchar,
	"stems_folder_path" varchar,
	"mixdowns_path" varchar,
	"total_tracks" integer DEFAULT 0,
	"track_list" jsonb,
	"recording_studio" varchar,
	"recording_dates" jsonb,
	"recording_notes" text,
	"producer" varchar,
	"recording_engineer" varchar,
	"mixing_engineer" varchar,
	"mastering_engineer" varchar,
	"additional_personnel" jsonb,
	"microphones" text[],
	"preamps" text[],
	"interfaces" text[],
	"monitors" text[],
	"instruments" text[],
	"outboard_gear" text[],
	"status" varchar DEFAULT 'planning',
	"progress" integer DEFAULT 0,
	"current_stage" varchar,
	"versions" jsonb,
	"client_id" varchar,
	"client_contact" jsonb,
	"record_label" varchar,
	"publisher" varchar,
	"distributor" varchar,
	"copyright_owner" varchar,
	"publishing_rights" varchar,
	"master_rights" varchar,
	"isrc_code" varchar,
	"catalog_number" varchar,
	"tono_registered" boolean DEFAULT false,
	"tono_registration_number" varchar,
	"gramo_registered" boolean DEFAULT false,
	"gramo_registration_number" varchar,
	"royalty_info" jsonb,
	"deliverables" jsonb,
	"quality_check_passed" boolean DEFAULT false,
	"quality_notes" text,
	"mastering" jsonb,
	"ai_enhancement_applied" boolean DEFAULT false,
	"enhancement_details" jsonb,
	"project_budget" numeric(10, 2),
	"hourly_rate" numeric(6, 2),
	"total_hours" numeric(6, 2) DEFAULT '0',
	"total_cost" numeric(10, 2),
	"start_date" date,
	"end_date" date,
	"delivery_deadline" date,
	"milestones" jsonb,
	"is_archived" boolean DEFAULT false,
	"archived_at" timestamp,
	"backup_status" varchar DEFAULT 'none',
	"backup_location" varchar,
	"collaborators" jsonb,
	"project_notes" text,
	"client_notes" text,
	"technical_notes" text,
	"creative_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_type" varchar NOT NULL,
	"resource_id" varchar NOT NULL,
	"action" varchar NOT NULL,
	"actor_id" varchar,
	"actor_type" varchar NOT NULL,
	"ip_address" varchar,
	"user_agent" text,
	"consent_given" boolean,
	"data_processing_legal" varchar,
	"metadata" jsonb,
	"timestamp" timestamp DEFAULT now(),
	"session_id" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "automation_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"trigger_type" varchar NOT NULL,
	"conditions" jsonb,
	"actions" jsonb NOT NULL,
	"is_active" boolean DEFAULT true,
	"run_count" integer DEFAULT 0,
	"last_run" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "backup_restore_jobs" (
	"id" varchar PRIMARY KEY NOT NULL,
	"project_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"job_type" varchar NOT NULL,
	"status" varchar DEFAULT 'pending',
	"source_version_id" varchar,
	"target_version_id" varchar,
	"changelog_id" varchar,
	"progress" integer DEFAULT 0,
	"error_message" text,
	"backup_paths" jsonb,
	"restored_paths" jsonb,
	"metadata" jsonb,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "backups" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"backup_type" varchar NOT NULL,
	"status" varchar DEFAULT 'queued',
	"backup_size" bigint,
	"backup_location" varchar NOT NULL,
	"is_scheduled" boolean DEFAULT false,
	"schedule_expression" varchar,
	"metadata" jsonb,
	"error_message" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "brand_image_discoveries" (
	"id" varchar PRIMARY KEY NOT NULL,
	"brand" varchar NOT NULL,
	"model" varchar,
	"category" varchar NOT NULL,
	"logo_url" text,
	"product_image_url" text,
	"official_website_url" text,
	"brand_colors" jsonb,
	"image_format" varchar,
	"resolution" varchar,
	"discovery_method" varchar NOT NULL,
	"verified" boolean DEFAULT false,
	"source" text,
	"last_verified" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "brreg_data" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"org_number" varchar NOT NULL,
	"name" varchar NOT NULL,
	"organization_form" varchar,
	"address" jsonb,
	"business_code" varchar,
	"business_description" text,
	"registered_date" date,
	"is_active" boolean DEFAULT true,
	"last_updated" timestamp,
	"last_checked" timestamp DEFAULT now(),
	"raw_data" jsonb,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "brreg_data_org_number_unique" UNIQUE("org_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "calendar_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"project_id" varchar,
	"title" varchar NOT NULL,
	"description" text,
	"start_date_time" timestamp NOT NULL,
	"end_date_time" timestamp NOT NULL,
	"is_all_day" boolean DEFAULT false,
	"event_type" varchar NOT NULL,
	"location" varchar,
	"google_calendar_event_id" varchar,
	"google_meet_url" varchar,
	"attendees" jsonb,
	"reminders" jsonb,
	"recurrence" jsonb,
	"is_private" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "client_communications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"project_id" varchar,
	"communication_type" varchar NOT NULL,
	"direction" varchar NOT NULL,
	"subject" varchar,
	"content" text NOT NULL,
	"from_email" varchar,
	"to_email" varchar,
	"cc_emails" text[],
	"bcc_emails" text[],
	"phone_number" varchar,
	"call_duration" integer,
	"call_recording_url" varchar,
	"meeting_url" varchar,
	"universal_thread_id" varchar,
	"is_universal_chat" boolean DEFAULT false,
	"attachments" jsonb,
	"requires_response" boolean DEFAULT false,
	"response_deadline" timestamp,
	"responded_at" timestamp,
	"follow_up_scheduled" timestamp,
	"category" varchar,
	"priority" varchar DEFAULT 'normal',
	"sentiment" varchar,
	"status" varchar DEFAULT 'unread',
	"is_archived" boolean DEFAULT false,
	"is_flagged" boolean DEFAULT false,
	"flag_reason" varchar,
	"internal_notes" text,
	"tags" text[],
	"google_email_id" varchar,
	"google_thread_id" varchar,
	"google_label_ids" text[],
	"client_device" varchar,
	"client_location" varchar,
	"client_timezone" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"scheduled_for" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "client_feedbacks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"project_id" varchar,
	"client_id" varchar NOT NULL,
	"feedback_type" varchar NOT NULL,
	"rating" integer,
	"title" varchar,
	"content" text NOT NULL,
	"aspect_ratings" jsonb,
	"is_public" boolean DEFAULT false,
	"is_testimonial" boolean DEFAULT false,
	"show_on_website" boolean DEFAULT false,
	"client_name" varchar NOT NULL,
	"client_email" varchar,
	"client_company" varchar,
	"client_photo" varchar,
	"response_from_professional" text,
	"responded_at" timestamp,
	"status" varchar DEFAULT 'pending',
	"moderation_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "client_galleries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"project_id" varchar NOT NULL,
	"gallery_name" varchar NOT NULL,
	"gallery_url" varchar NOT NULL,
	"password" varchar,
	"gallery_type" varchar NOT NULL,
	"access_settings" jsonb NOT NULL,
	"images" jsonb,
	"watermark_settings" jsonb,
	"delivery_settings" jsonb,
	"analytics" jsonb DEFAULT '{"totalViews":0,"uniqueVisitors":0,"downloadCount":0,"averageTimeSpent":0,"topImages":[],"deviceBreakdown":{}}'::jsonb,
	"client_feedback" jsonb,
	"status" varchar DEFAULT 'draft',
	"shared_at" timestamp,
	"last_viewed" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "client_galleries_gallery_url_unique" UNIQUE("gallery_url")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "client_onboarding" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"onboarding_stage" varchar DEFAULT 'initial_contact',
	"welcome_package_sent" boolean DEFAULT false,
	"contract_signed" boolean DEFAULT false,
	"deposit_received" boolean DEFAULT false,
	"project_setup" boolean DEFAULT false,
	"kickoff_meeting_scheduled" boolean DEFAULT false,
	"client_portal_access" boolean DEFAULT false,
	"completed_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "client_submissions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"email" varchar NOT NULL,
	"phone" varchar,
	"company" varchar,
	"project_type" varchar NOT NULL,
	"event_date" date,
	"location" varchar,
	"budget" numeric(10, 2),
	"description" text NOT NULL,
	"special_requests" text,
	"contact_preference" varchar DEFAULT 'email',
	"timeframe" varchar,
	"referral_source" varchar,
	"attachments" jsonb,
	"status" varchar DEFAULT 'new',
	"assigned_photographer" varchar,
	"priority" varchar DEFAULT 'medium',
	"internal_notes" text,
	"client_notes" text,
	"follow_up_date" timestamp,
	"quote_sent" boolean DEFAULT false,
	"quote_amount" numeric(10, 2),
	"contract_sent" boolean DEFAULT false,
	"deposit_received" boolean DEFAULT false,
	"submitted_at" timestamp DEFAULT now(),
	"last_contacted_at" timestamp,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cms_components" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"name" varchar NOT NULL,
	"display_name" varchar NOT NULL,
	"description" text,
	"component_type" varchar NOT NULL,
	"category" varchar NOT NULL,
	"subcategory" varchar,
	"tags" text[],
	"profession" varchar,
	"target_use_case" varchar,
	"component_schema" jsonb NOT NULL,
	"template" text NOT NULL,
	"styles" text,
	"script" text,
	"component_code" text,
	"dependencies" text[],
	"preview_image" varchar,
	"preview_url" varchar,
	"demo_data" jsonb,
	"documentation" text,
	"usage_instructions" text,
	"responsive_config" jsonb,
	"is_lazy_loaded" boolean DEFAULT false,
	"cacheability" varchar DEFAULT 'medium',
	"performance_impact" varchar DEFAULT 'low',
	"load_priority" varchar DEFAULT 'normal',
	"seo_friendly" boolean DEFAULT true,
	"accessibility_compliant" boolean DEFAULT true,
	"semantic_html" boolean DEFAULT true,
	"keyboard_navigable" boolean DEFAULT true,
	"screen_reader_friendly" boolean DEFAULT true,
	"integrations" jsonb,
	"form_config" jsonb,
	"portfolio_config" jsonb,
	"ecommerce_config" jsonb,
	"usage_count" integer DEFAULT 0,
	"last_used" timestamp,
	"average_rating" numeric(3, 2),
	"total_ratings" integer DEFAULT 0,
	"popularity_score" numeric(5, 2) DEFAULT '0',
	"performance_score" numeric(5, 2) DEFAULT '100',
	"load_time" integer,
	"error_rate" numeric(5) DEFAULT '0',
	"version" varchar DEFAULT '1.0.0',
	"is_latest" boolean DEFAULT true,
	"parent_component_id" varchar,
	"child_components" text[],
	"update_history" jsonb,
	"status" varchar DEFAULT 'draft',
	"is_public" boolean DEFAULT false,
	"is_official" boolean DEFAULT false,
	"is_shared" boolean DEFAULT false,
	"shared_with" text[],
	"is_marketplace" boolean DEFAULT false,
	"price" numeric(8, 2),
	"currency" varchar DEFAULT 'NOK',
	"is_test_passed" boolean DEFAULT false,
	"test_results" jsonb,
	"is_safe" boolean DEFAULT true,
	"security_checked" boolean DEFAULT false,
	"allows_user_input" boolean DEFAULT false,
	"sanitizes_input" boolean DEFAULT true,
	"supported_languages" text[] DEFAULT '{"no"}',
	"translations" jsonb,
	"is_rtl_supported" boolean DEFAULT false,
	"norwegian_features" jsonb,
	"custom_fields" jsonb,
	"advanced_settings" jsonb,
	"created_by" varchar NOT NULL,
	"maintained_by" text[],
	"contributors" jsonb,
	"support_level" varchar DEFAULT 'community',
	"documentation_url" varchar,
	"support_email" varchar,
	"changelog_url" varchar,
	"is_deprecated" boolean DEFAULT false,
	"deprecated_at" timestamp,
	"deprecation_reason" text,
	"migration_path" text,
	"replacement_component_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"published_at" timestamp,
	"last_tested_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cms_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"version" integer NOT NULL,
	"version_name" varchar,
	"is_minor_edit" boolean DEFAULT false,
	"change_type" varchar NOT NULL,
	"change_description" text,
	"change_reason" text,
	"change_summary" varchar,
	"content_snapshot" jsonb NOT NULL,
	"metadata_snapshot" jsonb,
	"changed_fields" text[],
	"field_changes" jsonb,
	"block_changes" jsonb,
	"publishing_action" varchar,
	"was_published" boolean DEFAULT false,
	"published_from" varchar,
	"published_to" varchar,
	"session_id" varchar,
	"ip_address" varchar,
	"user_agent" text,
	"platform" varchar,
	"edit_mode" varchar,
	"collaborative_session" varchar,
	"conflict_resolution" jsonb,
	"review_workflow" jsonb,
	"validation_results" jsonb,
	"performance_impact" jsonb,
	"is_restore_point" boolean DEFAULT false,
	"can_restore_to" boolean DEFAULT true,
	"restored_from" varchar,
	"backup_location" varchar,
	"is_auto_save" boolean DEFAULT false,
	"auto_save_interval" integer,
	"is_draft_save" boolean DEFAULT false,
	"draft_expires_at" timestamp,
	"is_bulk_operation" boolean DEFAULT false,
	"bulk_operation_id" varchar,
	"bulk_operation_type" varchar,
	"affected_pages" text[],
	"import_source" varchar,
	"export_format" varchar,
	"integration_sync" jsonb,
	"is_experiment" boolean DEFAULT false,
	"experiment_id" varchar,
	"variant_name" varchar,
	"test_results" jsonb,
	"editor_comments" jsonb,
	"internal_notes" text,
	"changelog_entry" text,
	"migrated_from" varchar,
	"migration_notes" text,
	"legacy_data" jsonb,
	"gdpr_compliant" boolean DEFAULT true,
	"audit_required" boolean DEFAULT false,
	"compliance_checks" jsonb,
	"media_changes" jsonb,
	"seo_changes" jsonb,
	"dependent_pages" text[],
	"related_changes" text[],
	"triggered_updates" text[],
	"created_at" timestamp DEFAULT now(),
	"archived_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cms_pages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"title" varchar NOT NULL,
	"slug" varchar NOT NULL,
	"path" varchar NOT NULL,
	"page_type" varchar NOT NULL,
	"content" jsonb NOT NULL,
	"meta_title" varchar,
	"meta_description" text,
	"meta_keywords" text[],
	"og_title" varchar,
	"og_description" text,
	"og_image" varchar,
	"canonical_url" varchar,
	"profession" varchar,
	"target_audience" varchar,
	"service_category" varchar,
	"status" varchar DEFAULT 'draft',
	"is_published" boolean DEFAULT false,
	"published_at" timestamp,
	"scheduled_publish_at" timestamp,
	"visibility" varchar DEFAULT 'public',
	"password" varchar,
	"allowed_user_roles" text[],
	"language" varchar DEFAULT 'no',
	"translation_of" varchar,
	"available_languages" text[],
	"theme" varchar DEFAULT 'modern',
	"color_scheme" varchar DEFAULT 'light',
	"custom_colors" jsonb,
	"typography" jsonb,
	"layout" varchar DEFAULT 'default',
	"sidebar" jsonb,
	"header" jsonb,
	"footer" jsonb,
	"load_time" integer,
	"seo_score" integer,
	"performance_score" integer,
	"mobile_optimized" boolean DEFAULT true,
	"view_count" integer DEFAULT 0,
	"unique_views" integer DEFAULT 0,
	"bounce_rate" numeric(5, 2),
	"average_time_on_page" integer,
	"conversion_rate" numeric(5),
	"google_analytics_id" varchar,
	"tracking_enabled" boolean DEFAULT true,
	"custom_tracking_code" text,
	"contact_form_enabled" boolean DEFAULT false,
	"contact_form_id" varchar,
	"quote_form_enabled" boolean DEFAULT false,
	"booking_form_enabled" boolean DEFAULT false,
	"social_share_enabled" boolean DEFAULT true,
	"social_platforms" text[],
	"instagram_feed" jsonb,
	"portfolio_enabled" boolean DEFAULT false,
	"showcase_categories" text[],
	"showcase_layout" varchar,
	"showcase_items_per_page" integer DEFAULT 12,
	"has_backup" boolean DEFAULT true,
	"last_backup_at" timestamp,
	"backup_frequency" varchar DEFAULT 'daily',
	"comments_enabled" boolean DEFAULT false,
	"moderation_required" boolean DEFAULT true,
	"allow_guest_comments" boolean DEFAULT false,
	"ecommerce_enabled" boolean DEFAULT false,
	"stripe_integration" jsonb,
	"norwegian_features" jsonb,
	"version" integer DEFAULT 1,
	"parent_page_id" varchar,
	"child_pages" text[],
	"is_template" boolean DEFAULT false,
	"template_category" varchar,
	"created_by" varchar NOT NULL,
	"last_edited_by" varchar,
	"collaborators" jsonb,
	"review_status" varchar,
	"review_notes" text,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"gdpr_compliant" boolean DEFAULT true,
	"privacy_policy_linked" boolean DEFAULT false,
	"cookie_consent_enabled" boolean DEFAULT true,
	"accessibility_compliant" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"last_published" timestamp,
	CONSTRAINT "cms_pages_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "code_generations" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"component_type" varchar,
	"generated_code" text,
	"intelligence_level" varchar DEFAULT 'advanced',
	"profession" varchar DEFAULT 'photographer',
	"google_docs_id" varchar,
	"requirements" text,
	"framework" varchar DEFAULT 'react',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "comment_suggestions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profession" varchar NOT NULL,
	"media_type" varchar NOT NULL,
	"context_type" varchar NOT NULL,
	"suggestion_text" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"language" varchar DEFAULT 'no',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "competitor_analysis" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"competitor_name" varchar NOT NULL,
	"competitor_website" varchar,
	"service_offering" text[],
	"pricing" jsonb,
	"strengths" text[],
	"weaknesses" text[],
	"market_position" varchar,
	"threat_level" varchar DEFAULT 'medium',
	"last_analyzed" timestamp DEFAULT now(),
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contract_archive" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"original_contract_id" varchar NOT NULL,
	"archived_content" text NOT NULL,
	"archived_at" timestamp DEFAULT now(),
	"retention_period" integer DEFAULT 2555,
	"gdpr_compliant" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contract_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"profession" varchar NOT NULL,
	"contract_type" varchar NOT NULL,
	"template" text NOT NULL,
	"variables" jsonb,
	"legal_compliance" jsonb,
	"is_default" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contracts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"client_name" varchar NOT NULL,
	"client_email" varchar NOT NULL,
	"client_phone" varchar,
	"client_address" text,
	"client_orgnr" varchar,
	"contract_number" varchar NOT NULL,
	"project_type" varchar NOT NULL,
	"project_description" text,
	"event_date" date,
	"event_location" varchar,
	"total_amount" numeric(10, 2) NOT NULL,
	"deposit_amount" numeric(10, 2),
	"vat_included" boolean DEFAULT true,
	"payment_schedule" text,
	"delivery_timeline" text,
	"usage_rights" text,
	"cancellation_policy" text,
	"additional_services" jsonb,
	"photographer_notes" text,
	"digital_signing_required" boolean DEFAULT true,
	"drive_backup_enabled" boolean DEFAULT true,
	"signature_url" varchar,
	"drive_backup_url" varchar,
	"digital_signature" text,
	"signed_date" timestamp,
	"signature_ip_address" varchar,
	"signer_name" varchar,
	"signer_email" varchar,
	"status" varchar DEFAULT 'draft',
	"profession" varchar NOT NULL,
	"template_used" varchar,
	"sections" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "contracts_contract_number_unique" UNIQUE("contract_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "currency_rates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"base_currency" varchar DEFAULT 'NOK',
	"target_currency" varchar NOT NULL,
	"rate" numeric(10, 6) NOT NULL,
	"date" date NOT NULL,
	"source" varchar DEFAULT 'norges_bank',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "custom_roles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"description" text,
	"color" varchar(7) DEFAULT '#1976d2',
	"is_system_role" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"priority" integer DEFAULT 0,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "custom_roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_signatures" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" varchar NOT NULL,
	"signer_person_id" varchar NOT NULL,
	"signer_name" varchar NOT NULL,
	"signer_email" varchar NOT NULL,
	"auth_method" varchar NOT NULL,
	"signature_level" varchar DEFAULT 'AES',
	"document_hash" varchar NOT NULL,
	"signature_data" text NOT NULL,
	"timestamp_token" text,
	"ocsp_response" text,
	"crl_data" text,
	"certificate_chain" jsonb,
	"signed_at" timestamp DEFAULT now(),
	"valid_until" timestamp,
	"ip_address" varchar,
	"user_agent" text,
	"status" varchar DEFAULT 'valid',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"project_id" varchar,
	"file_name" varchar NOT NULL,
	"original_file_name" varchar NOT NULL,
	"file_type" varchar NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" varchar NOT NULL,
	"document_type" varchar NOT NULL,
	"url" varchar NOT NULL,
	"thumbnail_url" varchar,
	"is_encrypted" boolean DEFAULT false,
	"access_level" varchar DEFAULT 'private',
	"tags" text[],
	"notes" text,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "drone_flight_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"project_id" varchar,
	"flight_date" date NOT NULL,
	"pilot_name" varchar NOT NULL,
	"pilot_license" varchar,
	"drone_model" varchar NOT NULL,
	"drone_serial" varchar NOT NULL,
	"battery_used" text[],
	"flight_location" varchar NOT NULL,
	"coordinates" jsonb,
	"flight_purpose" varchar NOT NULL,
	"permission_status" jsonb,
	"flight_details" jsonb,
	"safety_checklist" jsonb,
	"incidents" jsonb,
	"media_recorded" jsonb,
	"compliance_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "editing_workflows" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"project_id" varchar NOT NULL,
	"workflow_name" varchar NOT NULL,
	"workflow_type" varchar NOT NULL,
	"steps" jsonb NOT NULL,
	"total_files" integer NOT NULL,
	"processed_files" integer DEFAULT 0,
	"batch_settings" jsonb,
	"quality_control" jsonb,
	"status" varchar DEFAULT 'planned',
	"started_at" timestamp,
	"completed_at" timestamp,
	"estimated_completion" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_project_associations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"email_id" varchar NOT NULL,
	"subject" varchar NOT NULL,
	"from" varchar NOT NULL,
	"to" varchar NOT NULL,
	"cc" varchar,
	"bcc" varchar,
	"body" text NOT NULL,
	"attachments" jsonb,
	"template_used" varchar,
	"direction" varchar NOT NULL,
	"status" varchar DEFAULT 'sent',
	"profession" varchar NOT NULL,
	"sent_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"photographer_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"subject" text NOT NULL,
	"html_content" text,
	"text_content" text NOT NULL,
	"template_type" varchar NOT NULL,
	"client_type" varchar,
	"variables" jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "equipment_maintenance" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"equipment_id" varchar NOT NULL,
	"maintenance_type" varchar NOT NULL,
	"scheduled_date" date,
	"completed_date" date,
	"cost" numeric(8, 2),
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "equipment_rentals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"project_id" varchar,
	"equipment_type" varchar NOT NULL,
	"equipment_name" varchar NOT NULL,
	"brand" varchar,
	"model" varchar,
	"rental_company" varchar NOT NULL,
	"rental_contact" jsonb,
	"rental_start_date" date NOT NULL,
	"rental_end_date" date NOT NULL,
	"actual_return_date" date,
	"daily_rate" numeric(8, 2),
	"total_cost" numeric(8, 2) NOT NULL,
	"deposit" numeric(8, 2),
	"insurance" numeric(8, 2),
	"rental_agreement_url" varchar,
	"receipt_url" varchar,
	"condition" jsonb,
	"status" varchar DEFAULT 'booked',
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "expenses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"project_id" varchar,
	"expense_type" varchar NOT NULL,
	"category" varchar NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar DEFAULT 'NOK',
	"expense_date" date NOT NULL,
	"vendor" varchar,
	"is_business_expense" boolean DEFAULT true,
	"is_deductible" boolean DEFAULT true,
	"vat_amount" numeric(10, 2),
	"receipt_url" varchar,
	"receipt_number" varchar,
	"status" varchar DEFAULT 'pending',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "file_sync_jobs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"status" varchar DEFAULT 'pending',
	"sync_type" varchar NOT NULL,
	"last_sync" timestamp,
	"files_processed" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "firmware_updates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand" varchar NOT NULL,
	"model" varchar NOT NULL,
	"version" varchar NOT NULL,
	"release_date" date,
	"description" text,
	"importance" varchar DEFAULT 'normal',
	"download_url" text,
	"release_notes" text,
	"is_latest" boolean DEFAULT false,
	"source_url" text,
	"last_checked" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "firmware_versions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"equipment_type" varchar NOT NULL,
	"brand" varchar NOT NULL,
	"model" varchar NOT NULL,
	"model_year" integer,
	"current_version" varchar NOT NULL,
	"latest_version" varchar NOT NULL,
	"release_date" date,
	"announcement_date" date,
	"update_type" varchar NOT NULL,
	"update_size" integer,
	"download_url" text,
	"direct_download_available" boolean DEFAULT false,
	"release_notes" text,
	"new_features" text[],
	"bug_fixes" text[],
	"known_issues" text[],
	"update_importance" varchar DEFAULT 'normal',
	"security_update" boolean DEFAULT false,
	"performance_improvement" boolean DEFAULT false,
	"compatible_with" text[],
	"incompatible_with" text[],
	"requires_additional_software" text[],
	"installation_complexity" varchar DEFAULT 'simple',
	"estimated_install_time" integer,
	"requires_computer_connection" boolean DEFAULT true,
	"can_update_in_field" boolean DEFAULT false,
	"source_type" varchar DEFAULT 'official',
	"source_url" text,
	"manufacturer_website" text,
	"support_forum_url" text,
	"user_impact" varchar DEFAULT 'minimal',
	"affects_user_interface" boolean DEFAULT false,
	"affects_performance" boolean DEFAULT false,
	"affects_image_quality" boolean DEFAULT false,
	"affects_video_quality" boolean DEFAULT false,
	"affects_audio_quality" boolean DEFAULT false,
	"can_rollback" boolean DEFAULT true,
	"rollback_complexity" varchar,
	"backup_required" boolean DEFAULT true,
	"risk_level" varchar DEFAULT 'low',
	"verification_status" varchar DEFAULT 'unverified',
	"last_verified" timestamp,
	"verified_by" varchar,
	"notification_sent" boolean DEFAULT false,
	"notification_sent_at" timestamp,
	"users_notified" integer DEFAULT 0,
	"available_regions" text[],
	"restricted_regions" text[],
	"community_rating" numeric(3, 2),
	"install_reports" integer DEFAULT 0,
	"successful_installs" integer DEFAULT 0,
	"reported_issues" integer DEFAULT 0,
	"is_superseded" boolean DEFAULT false,
	"superseded_by" varchar,
	"superseded_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"last_checked" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "folder_change_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"project_id" varchar(255),
	"action" varchar(50) NOT NULL,
	"original_name" varchar(255),
	"new_name" varchar(255),
	"folder_path" varchar(500),
	"google_drive_id" varchar(255),
	"change_data" jsonb,
	"can_undo" boolean DEFAULT true,
	"can_redo" boolean DEFAULT false,
	"undo_data" jsonb,
	"created_at" timestamp DEFAULT now(),
	"processed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "folder_validations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"project_id" varchar(255),
	"expected_structure" text[],
	"actual_structure" text[],
	"deviations" jsonb,
	"is_valid" boolean DEFAULT true,
	"allow_flexibility" boolean DEFAULT true,
	"auto_correct" boolean DEFAULT false,
	"validated_at" timestamp DEFAULT now(),
	"corrected_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gear_announcements" (
	"id" varchar PRIMARY KEY NOT NULL,
	"brand" varchar NOT NULL,
	"model" varchar NOT NULL,
	"category" varchar NOT NULL,
	"announcement_date" varchar NOT NULL,
	"expected_release_date" varchar,
	"key_features" text,
	"source_url" text,
	"confidence" integer DEFAULT 5 NOT NULL,
	"status" varchar DEFAULT 'announced' NOT NULL,
	"actual_release_date" varchar,
	"price_estimate" varchar,
	"availability" varchar,
	"additional_info" text,
	"last_checked" timestamp,
	"verified" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "generated_contracts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"project_id" varchar NOT NULL,
	"template_id" varchar NOT NULL,
	"contract_number" varchar NOT NULL,
	"client_name" varchar NOT NULL,
	"client_email" varchar,
	"variables" jsonb NOT NULL,
	"generated_content" text NOT NULL,
	"status" varchar DEFAULT 'draft',
	"sent_at" timestamp,
	"signed_at" timestamp,
	"expires_at" timestamp,
	"digital_signature_url" varchar,
	"pdf_url" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "generated_contracts_contract_number_unique" UNIQUE("contract_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "google_drive_files" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"project_id" varchar,
	"google_file_id" varchar NOT NULL,
	"google_folder_id" varchar,
	"google_parent_ids" text[],
	"file_name" varchar NOT NULL,
	"file_type" varchar NOT NULL,
	"mime_type" varchar NOT NULL,
	"file_size" bigint,
	"folder_path" varchar,
	"folder_category" varchar,
	"subcategory" varchar,
	"is_project_file" boolean DEFAULT false,
	"project_stage" varchar,
	"status" varchar DEFAULT 'uploaded',
	"processing_status" varchar,
	"media_metadata" jsonb,
	"thumbnail_url" varchar,
	"preview_url" varchar,
	"web_view_link" varchar,
	"download_url" varchar,
	"is_public" boolean DEFAULT false,
	"shareable_link" varchar,
	"client_access" boolean DEFAULT false,
	"access_level" varchar DEFAULT 'private',
	"version" integer DEFAULT 1,
	"is_latest_version" boolean DEFAULT true,
	"previous_version_id" varchar,
	"version_notes" text,
	"is_backed_up" boolean DEFAULT false,
	"backup_location" varchar,
	"backup_date" timestamp,
	"sync_status" varchar DEFAULT 'synced',
	"last_synced_at" timestamp,
	"processed" boolean DEFAULT false,
	"processed_at" timestamp,
	"processing_notes" text,
	"enhancement_applied" boolean DEFAULT false,
	"enhancement_type" varchar,
	"client_viewed" boolean DEFAULT false,
	"client_viewed_at" timestamp,
	"client_downloaded" boolean DEFAULT false,
	"client_downloaded_at" timestamp,
	"client_favorited" boolean DEFAULT false,
	"client_rating" integer,
	"client_comments" text,
	"is_delivered" boolean DEFAULT false,
	"delivered_at" timestamp,
	"delivery_method" varchar,
	"delivery_confirmed" boolean DEFAULT false,
	"is_encrypted" boolean DEFAULT false,
	"encryption_type" varchar,
	"gdpr_compliant" boolean DEFAULT true,
	"retention_period" integer,
	"scheduled_deletion" timestamp,
	"view_count" integer DEFAULT 0,
	"download_count" integer DEFAULT 0,
	"share_count" integer DEFAULT 0,
	"last_accessed" timestamp,
	"tags" text[],
	"custom_categories" text[],
	"is_starred" boolean DEFAULT false,
	"internal_notes" text,
	"google_created_time" timestamp,
	"google_modified_time" timestamp,
	"google_owners" jsonb,
	"google_permissions" jsonb,
	"google_capabilities" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "google_drive_files_google_file_id_unique" UNIQUE("google_file_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invitations" (
	"id" varchar PRIMARY KEY NOT NULL,
	"business_name" varchar NOT NULL,
	"org_number" varchar NOT NULL,
	"contact_name" varchar NOT NULL,
	"contact_email" varchar NOT NULL,
	"contact_phone" varchar NOT NULL,
	"profession" varchar NOT NULL,
	"business_description" text NOT NULL,
	"website_url" varchar,
	"social_media_links" jsonb,
	"specialization" varchar,
	"team_size" integer NOT NULL,
	"annual_revenue" varchar,
	"current_challenges" text NOT NULL,
	"why_creator_hub" text NOT NULL,
	"google_workspace_email" varchar,
	"has_google_workspace" boolean DEFAULT false,
	"brreg_data" jsonb,
	"red_flag_analysis" jsonb,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"admin_notes" text,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"invite_token" varchar,
	"invite_sent_at" timestamp,
	"registered_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "invitations_invite_token_unique" UNIQUE("invite_token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invite_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar NOT NULL,
	"first_name" varchar NOT NULL,
	"last_name" varchar NOT NULL,
	"profession" varchar NOT NULL,
	"company_name" varchar NOT NULL,
	"organization_number" varchar NOT NULL,
	"business_address" text,
	"phone_number" varchar,
	"website" varchar,
	"message" text,
	"status" varchar DEFAULT 'pending',
	"admin_notes" text,
	"processed_by" varchar,
	"processed_at" timestamp,
	"registered_user_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "invite_requests_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "keep_sync_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"sync_enabled" boolean DEFAULT false,
	"auto_sync" boolean DEFAULT true,
	"sync_category" varchar DEFAULT 'worklog',
	"last_sync_at" timestamp,
	"sync_count" integer DEFAULT 0,
	"error_count" integer DEFAULT 0,
	"last_error" text,
	"settings" jsonb DEFAULT '{"syncPrivateEntries":false,"createCollaborationNotes":true,"includeProjectLinks":true,"notificationLevel":"errors"}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "keep_sync_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lead_import_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"lead_id" varchar NOT NULL,
	"lead_title" varchar NOT NULL,
	"lead_source" varchar,
	"extracted_data" jsonb NOT NULL,
	"import_count" integer DEFAULT 0,
	"last_imported" timestamp,
	"is_available" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "leads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"lead_source" varchar NOT NULL,
	"contact_name" varchar NOT NULL,
	"contact_email" varchar NOT NULL,
	"contact_phone" varchar,
	"lead_score" integer DEFAULT 0,
	"status" varchar DEFAULT 'new',
	"estimated_value" numeric(10, 2),
	"expected_close_date" date,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lighting_equipment" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"brand" varchar NOT NULL,
	"model" varchar NOT NULL,
	"light_type" varchar NOT NULL,
	"power_watts" integer,
	"color_temperature" integer,
	"beam_angle" integer,
	"max_lumens" integer,
	"position" jsonb DEFAULT '{"x":0,"y":2,"z":5}'::jsonb,
	"rotation" jsonb DEFAULT '{"x":0,"y":0,"z":0}'::jsonb,
	"intensity" numeric(3, 2) DEFAULT '1.0',
	"color" varchar DEFAULT '#ffffff',
	"shadow_enabled" boolean DEFAULT true,
	"is_active" boolean DEFAULT true,
	"purchase_date" date,
	"purchase_price" numeric(10, 2),
	"warranty_expiry" date,
	"maintenance_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lighting_models" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"category" varchar NOT NULL,
	"model_type" varchar NOT NULL,
	"file_path" text NOT NULL,
	"thumbnail_path" text,
	"poly_count" integer,
	"texture_count" integer,
	"file_size" integer,
	"dimensions" jsonb,
	"is_premium" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lighting_setups" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"project_id" varchar,
	"name" varchar NOT NULL,
	"description" text,
	"setup_type" varchar DEFAULT 'portrait',
	"scene_config" jsonb DEFAULT '{}'::jsonb,
	"environment_settings" jsonb DEFAULT '{}'::jsonb,
	"light_configuration" jsonb NOT NULL,
	"thumbnail_path" text,
	"is_public" boolean DEFAULT false,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "location_scouts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"project_id" varchar,
	"location_name" varchar NOT NULL,
	"address" varchar NOT NULL,
	"coordinates" jsonb,
	"location_type" varchar NOT NULL,
	"scouting_date" date,
	"shooting_window" jsonb,
	"accessibility" jsonb,
	"permissions" jsonb,
	"lighting_conditions" jsonb,
	"photos" text[],
	"notes" text,
	"pros" text[],
	"cons" text[],
	"rating" integer,
	"recommended" boolean DEFAULT false,
	"cost" numeric(8, 2),
	"cost_notes" text,
	"backup" boolean DEFAULT false,
	"weather_backup" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "marketing_campaigns" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"campaign_name" varchar NOT NULL,
	"campaign_type" varchar NOT NULL,
	"budget" numeric(10, 2),
	"start_date" date,
	"end_date" date,
	"target_audience" jsonb,
	"metrics" jsonb,
	"roi" numeric(8, 4),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "meeting_activities" (
	"id" varchar PRIMARY KEY NOT NULL,
	"workspace_id" varchar NOT NULL,
	"user_email" varchar NOT NULL,
	"user_name" varchar NOT NULL,
	"activity_type" varchar NOT NULL,
	"description" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "meeting_attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"meeting_notes_id" integer,
	"file_name" varchar NOT NULL,
	"file_type" varchar NOT NULL,
	"file_url" varchar NOT NULL,
	"google_drive_file_id" varchar,
	"uploaded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "meeting_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"meeting_id" varchar NOT NULL,
	"project_id" varchar,
	"wedding_timeline_id" integer,
	"client_id" varchar,
	"creator_id" varchar NOT NULL,
	"profession" varchar NOT NULL,
	"meeting_title" varchar NOT NULL,
	"meeting_date" timestamp NOT NULL,
	"meeting_duration" integer,
	"meeting_type" varchar NOT NULL,
	"meeting_location" varchar,
	"personal_notes" jsonb,
	"client_notes" jsonb,
	"action_items" jsonb,
	"decisions" jsonb,
	"next_steps" jsonb,
	"ai_summary" text,
	"ai_tags" jsonb,
	"ai_sentiment" varchar,
	"ai_key_topics" jsonb,
	"timeline_updates" jsonb,
	"practical_info" jsonb,
	"vendor_info" jsonb,
	"equipment_needs" jsonb,
	"google_doc_id" varchar,
	"google_drive_folder_id" varchar,
	"google_calendar_event_id" varchar,
	"google_meet_recording_url" varchar,
	"is_client_visible" boolean DEFAULT false,
	"client_access_level" varchar DEFAULT 'none',
	"is_archived" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"last_synced_to_google" timestamp,
	CONSTRAINT "meeting_notes_meeting_id_unique" UNIQUE("meeting_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "meeting_participants" (
	"id" varchar PRIMARY KEY NOT NULL,
	"workspace_id" varchar NOT NULL,
	"user_email" varchar NOT NULL,
	"user_name" varchar NOT NULL,
	"role" varchar NOT NULL,
	"status" varchar DEFAULT 'offline',
	"last_active_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "meeting_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"project_id" varchar,
	"meeting_title" varchar NOT NULL,
	"meeting_type" varchar NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp,
	"duration" integer,
	"participants" jsonb,
	"google_meet_url" varchar,
	"recording_url" varchar,
	"recording_enabled" boolean DEFAULT false,
	"transcription" text,
	"ai_summary" text,
	"key_topics" text[],
	"action_items" jsonb,
	"sentiment" varchar,
	"client_satisfaction" integer,
	"notes" text,
	"internal_notes" text,
	"follow_up_required" boolean DEFAULT false,
	"follow_up_scheduled" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "meeting_workspaces" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"project_type" varchar NOT NULL,
	"status" varchar DEFAULT 'scheduled',
	"google_drive_id" varchar,
	"google_meet_url" varchar,
	"google_calendar_event_id" varchar,
	"features" jsonb NOT NULL,
	"progress" integer DEFAULT 0,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "norwegian_holidays" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"year" integer NOT NULL,
	"date" date NOT NULL,
	"name" varchar NOT NULL,
	"name_en" varchar,
	"holiday_type" varchar NOT NULL,
	"is_nationwide" boolean DEFAULT true,
	"affected_regions" text[],
	"business_impact" varchar DEFAULT 'closed',
	"description" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notes" (
	"id" varchar PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"category" varchar DEFAULT 'personlig' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"is_shared" boolean DEFAULT false NOT NULL,
	"google_docs_id" varchar,
	"user_id" varchar,
	"profession" varchar DEFAULT 'photographer',
	"ai_insights" jsonb,
	"search_vector" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"type" varchar NOT NULL,
	"title" varchar NOT NULL,
	"message" text NOT NULL,
	"priority" varchar DEFAULT 'normal',
	"is_read" boolean DEFAULT false,
	"read_at" timestamp,
	"action_url" varchar,
	"action_text" varchar,
	"metadata" jsonb,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"invoice_id" varchar,
	"project_id" varchar,
	"payment_type" varchar NOT NULL,
	"payment_method" varchar NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar DEFAULT 'NOK',
	"status" varchar DEFAULT 'pending',
	"transaction_id" varchar,
	"external_payment_id" varchar,
	"payment_date" timestamp NOT NULL,
	"processed_at" timestamp,
	"description" text,
	"internal_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "performance_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"metric_type" varchar NOT NULL,
	"metric_value" numeric(15, 4) NOT NULL,
	"target_value" numeric(15, 4),
	"period" date NOT NULL,
	"is_kpi" boolean DEFAULT false,
	"trend_direction" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "photo_enhancement_changelog" (
	"id" varchar PRIMARY KEY NOT NULL,
	"project_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"image_id" varchar NOT NULL,
	"change_type" varchar NOT NULL,
	"description" text NOT NULL,
	"preset_used" varchar,
	"before_state" jsonb,
	"after_state" jsonb,
	"original_image_path" varchar NOT NULL,
	"enhanced_image_path" varchar,
	"backup_image_path" varchar,
	"metadata" jsonb,
	"can_revert" boolean DEFAULT true,
	"processing_time" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "photo_flash" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"brand" varchar NOT NULL,
	"model" varchar NOT NULL,
	"year" integer NOT NULL,
	"guide_number" integer NOT NULL,
	"flash_type" varchar NOT NULL,
	"category" varchar NOT NULL,
	"features" jsonb,
	"ttl_support" jsonb,
	"purchase_price" numeric(10, 2),
	"purchase_date" date,
	"serial_number" varchar,
	"warranty_info" text,
	"firmware_version" varchar,
	"notes" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "portfolio_projects" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"category" varchar,
	"subcategory" varchar,
	"profession" varchar NOT NULL,
	"cover_image" varchar,
	"images" text[],
	"videos" text[],
	"audio_files" text[],
	"client_name" varchar,
	"project_date" date,
	"location" varchar,
	"equipment" text[],
	"techniques" text[],
	"tags" text[],
	"is_public" boolean DEFAULT false,
	"is_featured" boolean DEFAULT false,
	"sort_order" integer DEFAULT 0,
	"seo_title" varchar,
	"seo_description" text,
	"slug" varchar,
	"view_count" integer DEFAULT 0,
	"like_count" integer DEFAULT 0,
	"share_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "portfolio_projects_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "preset_suggestions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"profession" varchar NOT NULL,
	"project_type" varchar NOT NULL,
	"culture" varchar,
	"suggested_preset_id" varchar,
	"based_on_project_ids" jsonb,
	"confidence" integer NOT NULL,
	"reasons" jsonb,
	"times_shown" integer DEFAULT 0,
	"times_accepted" integer DEFAULT 0,
	"last_shown" timestamp,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "preset_usage_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"preset_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"project_id" varchar,
	"rating" integer,
	"feedback" text,
	"modifications" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "print_orders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"project_id" varchar,
	"gallery_id" varchar,
	"order_number" varchar NOT NULL,
	"client_name" varchar NOT NULL,
	"client_email" varchar NOT NULL,
	"shipping_address" jsonb NOT NULL,
	"items" jsonb NOT NULL,
	"order_total" numeric(10, 2) NOT NULL,
	"shipping_cost" numeric(8, 2) DEFAULT '0',
	"tax" numeric(8, 2) DEFAULT '0',
	"grand_total" numeric(10, 2) NOT NULL,
	"print_vendor" varchar NOT NULL,
	"vendor_order_id" varchar,
	"status" varchar DEFAULT 'pending',
	"order_date" timestamp DEFAULT now(),
	"confirmed_at" timestamp,
	"shipped_at" timestamp,
	"delivered_at" timestamp,
	"tracking_number" varchar,
	"estimated_delivery" date,
	"special_requests" text,
	"internal_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "print_orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "profession_types" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(50) NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"description" text,
	"icon_color" varchar(7) DEFAULT '#ff8c00',
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "profession_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_draft_autosave" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"session_id" varchar NOT NULL,
	"profession" varchar NOT NULL,
	"draft_data" jsonb NOT NULL,
	"is_completed" boolean DEFAULT false,
	"project_id" varchar,
	"last_modified" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_draft_versions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"draft_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"version_number" integer NOT NULL,
	"version_name" varchar,
	"snapshot_data" jsonb NOT NULL,
	"change_description" text,
	"can_restore" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_emails" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar,
	"project_type" varchar NOT NULL,
	"message_id" varchar,
	"thread_id" varchar,
	"from_email" varchar NOT NULL,
	"to_email" varchar NOT NULL,
	"cc_emails" jsonb,
	"bcc_emails" jsonb,
	"subject" text NOT NULL,
	"html_content" text,
	"text_content" text,
	"attachments" jsonb,
	"direction" varchar NOT NULL,
	"status" varchar DEFAULT 'sent',
	"is_important" boolean DEFAULT false,
	"tags" jsonb,
	"client_type" varchar,
	"photographer_id" varchar,
	"sent_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_financials" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"total_quoted_amount" numeric(10, 2) NOT NULL,
	"total_paid_amount" numeric(10, 2) DEFAULT '0',
	"outstanding_amount" numeric(10, 2) DEFAULT '0',
	"cost_breakdown" jsonb,
	"profit_margin" numeric(5, 2),
	"profit_amount" numeric(10, 2),
	"payment_schedule" jsonb,
	"vat_calculation" jsonb,
	"discounts" jsonb,
	"revision_costs" jsonb,
	"actual_costs" jsonb,
	"financial_status" varchar DEFAULT 'quoted',
	"last_updated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_milestones" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"category" varchar NOT NULL,
	"type" varchar NOT NULL,
	"due_date" timestamp,
	"scheduled_date" timestamp,
	"estimated_duration" integer,
	"actual_duration" integer,
	"depends_on" text[],
	"blocked_by" text[],
	"status" varchar DEFAULT 'not_started',
	"progress" integer DEFAULT 0,
	"priority" varchar DEFAULT 'normal',
	"assigned_to" varchar,
	"assigned_team" text[],
	"client_involvement" boolean DEFAULT false,
	"deliverables" jsonb,
	"time_spent" integer DEFAULT 0,
	"time_entries" jsonb,
	"client_visible" boolean DEFAULT false,
	"requires_client_approval" boolean DEFAULT false,
	"client_approval_status" varchar,
	"client_feedback" text,
	"location" varchar,
	"equipment_needed" text[],
	"preparation_required" text[],
	"quality_standards" text,
	"acceptance_criteria" text[],
	"quality_check_status" varchar,
	"budget_allocated" numeric(10, 2),
	"actual_cost" numeric(10, 2),
	"invoiceable_amount" numeric(10, 2),
	"automated_reminders" boolean DEFAULT true,
	"google_calendar_event_id" varchar,
	"slack_channel_id" varchar,
	"notifications_sent" integer DEFAULT 0,
	"version" integer DEFAULT 1,
	"change_history" jsonb,
	"internal_notes" text,
	"client_notes" text,
	"attachments" jsonb,
	"completed_at" timestamp,
	"completed_by" varchar,
	"completion_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_presets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"profession" varchar NOT NULL,
	"project_type" varchar NOT NULL,
	"culture" varchar DEFAULT 'norsk',
	"is_default" boolean DEFAULT false,
	"user_id" varchar NOT NULL,
	"config" jsonb NOT NULL,
	"usage" jsonb DEFAULT '{"timesUsed":0}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_showcases" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"showcase_type" varchar NOT NULL,
	"images" jsonb,
	"video_url" varchar,
	"youtube_video_id" varchar,
	"youtube_video_url" varchar,
	"youtube_playlist_id" varchar,
	"client_testimonial" text,
	"tags" jsonb,
	"is_public" boolean DEFAULT false,
	"is_featured" boolean DEFAULT false,
	"published_at" timestamp,
	"seo_title" varchar,
	"seo_description" text,
	"view_count" integer DEFAULT 0,
	"like_count" integer DEFAULT 0,
	"social_shares" integer DEFAULT 0,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_similarity_analysis" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"project_id_1" varchar NOT NULL,
	"project_id_2" varchar NOT NULL,
	"similarity_score" integer NOT NULL,
	"matching_factors" jsonb,
	"recommendation" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_timelines" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"event_date" timestamp NOT NULL,
	"event_time" varchar,
	"location" varchar,
	"type" varchar NOT NULL,
	"status" varchar DEFAULT 'planned',
	"priority" varchar DEFAULT 'medium',
	"assigned_to" varchar,
	"notes" text,
	"attachments" jsonb,
	"reminder_set" boolean DEFAULT false,
	"reminder_date" timestamp,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_version_history" (
	"id" varchar PRIMARY KEY NOT NULL,
	"project_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"project_type" varchar NOT NULL,
	"version_name" varchar NOT NULL,
	"description" text,
	"snapshot_data" jsonb,
	"file_manifest" jsonb,
	"is_active" boolean DEFAULT false,
	"can_restore_to" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "prototype_feedback" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"user_email" varchar(255),
	"user_name" varchar(255),
	"profession" varchar(50) NOT NULL,
	"dashboard_type" varchar(50) NOT NULL,
	"feedback_type" varchar(20) NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text NOT NULL,
	"rating" integer DEFAULT 5 NOT NULL,
	"priority" varchar(20) DEFAULT 'medium' NOT NULL,
	"component" varchar(255),
	"tags" jsonb DEFAULT '[]'::jsonb,
	"screenshot_url" text,
	"is_anonymous" boolean DEFAULT false NOT NULL,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"admin_notes" text,
	"admin_updated_by" varchar(255),
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rbac_audit_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" varchar(50) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" varchar NOT NULL,
	"target_user_id" varchar,
	"performed_by" varchar NOT NULL,
	"previous_state" jsonb,
	"new_state" jsonb,
	"reason" text,
	"ip_address" varchar,
	"user_agent" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "referral_program" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"referral_code" varchar NOT NULL,
	"referred_user_id" varchar,
	"referral_reward" numeric(8, 2),
	"status" varchar DEFAULT 'pending',
	"completed_at" timestamp,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "referral_program_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "role_features" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_id" varchar NOT NULL,
	"feature_id" varchar NOT NULL,
	"access_level" varchar(20) DEFAULT 'read',
	"is_enabled" boolean DEFAULT true,
	"granted_by" varchar,
	"granted_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "role_hierarchy" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_role_id" varchar NOT NULL,
	"child_role_id" varchar NOT NULL,
	"inheritance_type" varchar(20) DEFAULT 'full',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shot_lists" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"project_id" varchar NOT NULL,
	"list_name" varchar NOT NULL,
	"event_type" varchar NOT NULL,
	"shots" jsonb NOT NULL,
	"categories" text[],
	"total_shots" integer DEFAULT 0,
	"completed_shots" integer DEFAULT 0,
	"must_have_shots" integer DEFAULT 0,
	"completed_must_have" integer DEFAULT 0,
	"client_approval_required" boolean DEFAULT false,
	"client_approved" boolean DEFAULT false,
	"client_feedback" text,
	"printed_version" boolean DEFAULT false,
	"digital_version" boolean DEFAULT true,
	"template" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "showcase_categories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"color" varchar DEFAULT '#FF6B35',
	"icon" varchar,
	"is_active" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "showcase_collections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"cover_image" text,
	"is_public" boolean DEFAULT false,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "showcase_comments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"showcase_item_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"user_name" varchar NOT NULL,
	"user_email" varchar,
	"comment_text" text NOT NULL,
	"timestamp_seconds" numeric(10, 3),
	"parent_comment_id" varchar,
	"status" varchar DEFAULT 'pending',
	"photographer_response" text,
	"is_resolved" boolean DEFAULT false,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "showcase_content_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"showcase_drive_sync_id" integer,
	"user_id" varchar NOT NULL,
	"drive_file_id" varchar NOT NULL,
	"file_name" varchar NOT NULL,
	"file_type" varchar NOT NULL,
	"mime_type" varchar NOT NULL,
	"file_size" integer,
	"is_visible" boolean DEFAULT true,
	"display_order" integer DEFAULT 0,
	"title" varchar,
	"description" text,
	"thumbnail_url" varchar,
	"crop_settings" jsonb,
	"focal_point" jsonb,
	"video_thumbnail_time" integer,
	"drive_metadata" jsonb,
	"last_modified_in_drive" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "showcase_content_items_drive_file_id_unique" UNIQUE("drive_file_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "showcase_drive_sync" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"profession" varchar NOT NULL,
	"drive_folder_id" varchar NOT NULL,
	"folder_name" varchar NOT NULL,
	"folder_path" varchar NOT NULL,
	"showcase_category_id" varchar,
	"category_name" varchar NOT NULL,
	"display_name" varchar,
	"is_visible" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"grid_layout" varchar DEFAULT 'grid',
	"auto_sync" boolean DEFAULT true,
	"last_sync_at" timestamp,
	"sync_status" varchar DEFAULT 'pending',
	"allowed_file_types" jsonb DEFAULT '["jpg","jpeg","png","gif","mp4","mov"]'::jsonb,
	"max_file_size" integer DEFAULT 50,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "showcase_interactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"showcase_item_id" varchar NOT NULL,
	"interaction_type" varchar NOT NULL,
	"user_identifier" varchar,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "showcase_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"project_id" varchar,
	"title" varchar NOT NULL,
	"description" text,
	"media_type" varchar NOT NULL,
	"media_url" text NOT NULL,
	"thumbnail_url" text,
	"category" varchar,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"is_public" boolean DEFAULT false,
	"is_featured" boolean DEFAULT false,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "showcase_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"project_id" varchar,
	"allow_download" boolean DEFAULT false,
	"allow_right_click" boolean DEFAULT false,
	"allow_save" boolean DEFAULT false,
	"require_approval" boolean DEFAULT true,
	"client_access_enabled" boolean DEFAULT false,
	"watermark_enabled" boolean DEFAULT false,
	"watermark_type" varchar DEFAULT 'text',
	"watermark_text" varchar DEFAULT 'VANNMERKE',
	"watermark_logo" text,
	"watermark_size" integer DEFAULT 16,
	"watermark_opacity" integer DEFAULT 70,
	"watermark_position" varchar DEFAULT 'bottom-right',
	"watermark_rotation" integer DEFAULT 0,
	"watermark_x" numeric(5, 2),
	"watermark_y" numeric(5, 2),
	"preview_format" varchar DEFAULT '16:9',
	"preview_background" varchar DEFAULT 'light',
	"show_grid" boolean DEFAULT true,
	"show_rulers" boolean DEFAULT false,
	"show_pixel_distance" boolean DEFAULT false,
	"watermark_font" varchar DEFAULT 'Arial',
	"watermark_bold" boolean DEFAULT false,
	"watermark_italic" boolean DEFAULT false,
	"watermark_color" varchar DEFAULT '#333333',
	"watermark_shadow" boolean DEFAULT false,
	"watermark_blur" integer DEFAULT 0,
	"watermark_blend_mode" varchar DEFAULT 'normal',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "showcase_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"name" varchar NOT NULL,
	"profession" varchar NOT NULL,
	"description" text,
	"layout_config" jsonb NOT NULL,
	"design_settings" jsonb NOT NULL,
	"is_default" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sign_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" varchar NOT NULL,
	"requester_id" varchar NOT NULL,
	"recipient_email" varchar NOT NULL,
	"recipient_phone" varchar,
	"document_url" varchar NOT NULL,
	"signing_url" varchar NOT NULL,
	"expires_at" timestamp NOT NULL,
	"reminders_sent" integer DEFAULT 0,
	"status" varchar DEFAULT 'pending',
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "smart_templates" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"profession" varchar NOT NULL,
	"category" varchar NOT NULL,
	"template_code" text NOT NULL,
	"ai_enhancements" jsonb,
	"usage_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "social_media_posts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"project_id" varchar,
	"platform" varchar NOT NULL,
	"post_content" text NOT NULL,
	"media_urls" text[],
	"scheduled_at" timestamp,
	"published_at" timestamp,
	"status" varchar DEFAULT 'draft',
	"engagement_metrics" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "standard_folder_structures" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"name" varchar NOT NULL,
	"description" text,
	"profession" varchar NOT NULL,
	"project_type" varchar,
	"structure" jsonb NOT NULL,
	"is_default" boolean DEFAULT false,
	"default_structure" jsonb,
	"allow_renaming" boolean DEFAULT true,
	"allow_addition" boolean DEFAULT true,
	"allow_deletion" boolean DEFAULT false,
	"allow_reordering" boolean DEFAULT true,
	"track_changes" boolean DEFAULT true,
	"change_history" jsonb,
	"undo_stack" jsonb,
	"redo_stack" jsonb,
	"google_drive_enabled" boolean DEFAULT true,
	"google_drive_template_id" varchar,
	"auto_create_in_drive" boolean DEFAULT true,
	"drive_permission_template" jsonb,
	"times_used" integer DEFAULT 0,
	"last_used" timestamp,
	"average_setup_time" integer,
	"user_satisfaction_rating" numeric(3, 2),
	"is_public_template" boolean DEFAULT false,
	"shared_with" text[],
	"template_category" varchar,
	"has_backup" boolean DEFAULT true,
	"backup_location" varchar,
	"can_restore_to_default" boolean DEFAULT true,
	"last_backup_at" timestamp,
	"is_valid" boolean DEFAULT true,
	"validation_errors" text[],
	"last_validated" timestamp,
	"auto_repair" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subcontractor_projects" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"project_id" varchar NOT NULL,
	"vendor_id" varchar NOT NULL,
	"role" varchar NOT NULL,
	"contract_details" jsonb,
	"work_schedule" jsonb,
	"delivered_work" jsonb,
	"performance" jsonb,
	"payment" jsonb,
	"status" varchar DEFAULT 'planned',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "submission_follow_ups" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" varchar NOT NULL,
	"type" varchar NOT NULL,
	"description" text NOT NULL,
	"scheduled_for" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscriptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"plan_type" varchar NOT NULL,
	"status" varchar NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"amount" numeric(8, 2) NOT NULL,
	"currency" varchar DEFAULT 'NOK',
	"billing_cycle" varchar NOT NULL,
	"stripe_subscription_id" varchar,
	"auto_renew" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "system_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"severity" varchar(50) NOT NULL,
	"category" varchar(50) NOT NULL,
	"source" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"details" jsonb,
	"resolved" boolean DEFAULT false NOT NULL,
	"alerts_sent" jsonb DEFAULT '[]' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "system_features" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"description" text,
	"category" varchar(50) NOT NULL,
	"is_system_feature" boolean DEFAULT false,
	"requires_license" boolean DEFAULT false,
	"license_type" varchar(50),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "system_features_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "system_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"log_type" varchar NOT NULL,
	"log_level" varchar DEFAULT 'info' NOT NULL,
	"message" text NOT NULL,
	"metadata" jsonb,
	"user_id" varchar,
	"session_id" varchar,
	"ip_address" varchar,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"project_id" varchar,
	"title" varchar NOT NULL,
	"description" text,
	"status" varchar DEFAULT 'todo',
	"priority" varchar DEFAULT 'medium',
	"due_date" timestamp,
	"estimated_minutes" integer,
	"actual_minutes" integer,
	"assigned_to" varchar,
	"tags" text[],
	"parent_task_id" varchar,
	"order_index" integer DEFAULT 0,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tax_calculations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"invoice_id" varchar,
	"tax_year" integer NOT NULL,
	"tax_period" varchar,
	"total_revenue" numeric(12, 2) NOT NULL,
	"total_expenses" numeric(12, 2) NOT NULL,
	"mva_calculation" jsonb,
	"deductions" jsonb,
	"estimated_tax" numeric(10, 2),
	"status" varchar DEFAULT 'draft',
	"submitted_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "text_enhancement_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"original_text" text NOT NULL,
	"enhanced_text" text NOT NULL,
	"enhancement_type" varchar NOT NULL,
	"profession" varchar NOT NULL,
	"user_id" varchar,
	"words_changed" integer,
	"quality_score" numeric(3, 2),
	"processing_time_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "time_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"project_id" varchar,
	"task_id" varchar,
	"description" text,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp,
	"duration" integer,
	"is_manual" boolean DEFAULT false,
	"is_running" boolean DEFAULT false,
	"hourly_rate" numeric(6, 2),
	"billable_amount" numeric(10, 2),
	"is_billable" boolean DEFAULT true,
	"category" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "travel_expenses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"project_id" varchar,
	"travel_date" date NOT NULL,
	"purpose" text NOT NULL,
	"from_location" varchar NOT NULL,
	"to_location" varchar NOT NULL,
	"distance" numeric(8, 2),
	"transportation_type" varchar NOT NULL,
	"amount" numeric(8, 2) NOT NULL,
	"is_deductible" boolean DEFAULT true,
	"deduction_rate" numeric(5, 2),
	"toll_fees" numeric(8, 2) DEFAULT '0',
	"parking_fees" numeric(8, 2) DEFAULT '0',
	"receipt_url" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_activity_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"activity_type" varchar NOT NULL,
	"category" varchar NOT NULL,
	"action" varchar NOT NULL,
	"description" text,
	"target_type" varchar,
	"target_id" varchar,
	"target_name" varchar,
	"session_id" varchar,
	"ip_address" varchar,
	"user_agent" text,
	"platform" varchar,
	"device" varchar,
	"browser" varchar,
	"operating_system" varchar,
	"country" varchar,
	"region" varchar,
	"city" varchar,
	"timezone" varchar,
	"metadata" jsonb,
	"is_successful" boolean DEFAULT true,
	"error_message" text,
	"error_code" varchar,
	"error_category" varchar,
	"duration" integer,
	"response_time" integer,
	"resources_used" jsonb,
	"business_value" numeric(10, 2),
	"impact_level" varchar DEFAULT 'low',
	"affected_users" integer DEFAULT 1,
	"feature_path" varchar,
	"feature_flag" varchar,
	"is_new_feature" boolean DEFAULT false,
	"is_experimental_feature" boolean DEFAULT false,
	"experiment_id" varchar,
	"variant_id" varchar,
	"experiment_stage" varchar,
	"referrer" text,
	"utm_source" varchar,
	"utm_medium" varchar,
	"utm_campaign" varchar,
	"utm_content" varchar,
	"utm_term" varchar,
	"is_anonymized" boolean DEFAULT false,
	"gdpr_compliant" boolean DEFAULT true,
	"retention_period" integer DEFAULT 730,
	"scheduled_deletion" timestamp,
	"data_version" varchar DEFAULT '1.0',
	"data_source" varchar,
	"is_verified" boolean DEFAULT true,
	"day_of_week" integer,
	"hour_of_day" integer,
	"is_weekend" boolean,
	"is_business_hours" boolean,
	"parent_activity_id" varchar,
	"child_activities" text[],
	"correlation_id" varchar,
	"profession" varchar,
	"business_context" varchar,
	"client_visible" boolean DEFAULT false,
	"security_level" varchar DEFAULT 'low',
	"requires_audit" boolean DEFAULT false,
	"audit_category" varchar,
	"compliance_flags" text[],
	"triggered_alerts" text[],
	"notifications_sent" boolean DEFAULT false,
	"alert_level" varchar,
	"anomaly_score" numeric(5, 4),
	"is_anomalous" boolean DEFAULT false,
	"risk_score" numeric(5, 4),
	"predicted_outcome" varchar,
	"created_at" timestamp DEFAULT now(),
	"processed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_permission_overrides" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"feature_id" varchar NOT NULL,
	"access_level" varchar(20) NOT NULL,
	"reason" text,
	"overridden_by" varchar,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_preferences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"profession" varchar NOT NULL,
	"theme" varchar,
	"language" varchar,
	"notifications_enabled" boolean,
	"dashboard_layout" varchar,
	"timezone" varchar,
	"currency" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_roles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"role_id" varchar NOT NULL,
	"is_primary" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"assigned_by" varchar,
	"assigned_at" timestamp DEFAULT now(),
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendors" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"vendor_name" varchar NOT NULL,
	"vendor_type" varchar NOT NULL,
	"contact_info" jsonb NOT NULL,
	"services" text[],
	"specializations" text[],
	"pricing" jsonb,
	"business_info" jsonb,
	"rating" numeric(3, 2),
	"total_projects" integer DEFAULT 0,
	"reliability" jsonb,
	"portfolio" text[],
	"availability" jsonb,
	"payment_terms" varchar DEFAULT '30 days',
	"notes" text,
	"private_notes" text,
	"status" varchar DEFAULT 'active',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "video_edit_changelog" (
	"id" varchar PRIMARY KEY NOT NULL,
	"project_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"change_type" varchar NOT NULL,
	"description" text NOT NULL,
	"before_state" jsonb,
	"after_state" jsonb,
	"timecode" varchar,
	"version" varchar,
	"round" varchar,
	"metadata" jsonb,
	"can_revert" boolean DEFAULT true,
	"backup_path" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "video_lights" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"brand" varchar NOT NULL,
	"model" varchar NOT NULL,
	"year" integer NOT NULL,
	"wattage" integer NOT NULL,
	"light_type" varchar NOT NULL,
	"color_temperature" varchar NOT NULL,
	"category" varchar NOT NULL,
	"features" jsonb,
	"purchase_price" numeric(10, 2),
	"purchase_date" date,
	"serial_number" varchar,
	"warranty_info" text,
	"firmware_version" varchar,
	"notes" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "weather_data" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"location" varchar NOT NULL,
	"coordinates" jsonb,
	"forecast_date" date NOT NULL,
	"actual_date" date,
	"forecast" jsonb,
	"actual_weather" jsonb,
	"photography_impact" jsonb,
	"backup_plan" jsonb,
	"weather_source" varchar DEFAULT 'yr.no',
	"last_updated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wedding_details" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"partner_one_name" varchar NOT NULL,
	"partner_two_name" varchar NOT NULL,
	"partner_one_email" varchar,
	"partner_two_email" varchar,
	"partner_one_phone" varchar,
	"partner_two_phone" varchar,
	"wedding_date" date NOT NULL,
	"ceremony_time" varchar,
	"reception_time" varchar,
	"ceremony_venue" jsonb,
	"reception_venue" jsonb,
	"culture" varchar NOT NULL,
	"religion" varchar,
	"traditions" text[],
	"special_customs" text[],
	"language_preferences" text[],
	"guest_count" integer,
	"children_count" integer,
	"international_guests" integer,
	"guest_list_categories" jsonb,
	"bridesmaids" jsonb,
	"groomsmen" jsonb,
	"flowergirls" jsonb,
	"ringbearers" jsonb,
	"accessibility_needs" text[],
	"dietary_restrictions" text[],
	"musical_preferences" text[],
	"photo_restrictions" text[],
	"has_detailed_timeline" boolean DEFAULT false,
	"timeline_id" varchar,
	"buffer_time_needed" integer DEFAULT 15,
	"weather_backup_plan" text,
	"seasonal_considerations" text[],
	"wedding_planner" jsonb,
	"other_vendors" jsonb,
	"transportation_needed" boolean DEFAULT false,
	"transportation_details" jsonb,
	"emergency_contacts" jsonb,
	"total_budget" numeric(10, 2),
	"photography_budget" numeric(10, 2),
	"payment_schedule" jsonb,
	"delivery_method" varchar DEFAULT 'digital',
	"delivery_timeline" varchar,
	"social_media_permissions" boolean DEFAULT false,
	"marketing_permissions" boolean DEFAULT false,
	"special_instructions" text,
	"photographer_notes" text,
	"client_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wedding_timeline_client_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"project_id" varchar,
	"wedding_id" varchar NOT NULL,
	"client_access_enabled" boolean DEFAULT false,
	"allow_download" boolean DEFAULT false,
	"allow_right_click" boolean DEFAULT false,
	"allow_save" boolean DEFAULT false,
	"require_approval" boolean DEFAULT true,
	"share_url" varchar,
	"share_token" varchar,
	"expires_at" timestamp,
	"access_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "wedding_timeline_client_settings_share_url_unique" UNIQUE("share_url"),
	CONSTRAINT "wedding_timeline_client_settings_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "worklog_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"project_id" varchar,
	"day" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"time_spent" integer NOT NULL,
	"category" varchar(100) NOT NULL,
	"mood" varchar(50),
	"next_steps" text,
	"is_private" boolean DEFAULT false,
	"google_keep_note_id" varchar,
	"keep_sync_status" varchar DEFAULT 'disabled',
	"keep_synced_at" timestamp,
	"tags" text[],
	"attachments" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "data_retention_policies" (
	"id" serial PRIMARY KEY NOT NULL,
	"policy_name" varchar(255) NOT NULL,
	"data_category" "data_category" NOT NULL,
	"resource_type" varchar(100) NOT NULL,
	"retention_period_days" integer NOT NULL,
	"grace_period_days" integer DEFAULT 30,
	"auto_delete_enabled" boolean DEFAULT true NOT NULL,
	"legal_basis" text NOT NULL,
	"description" text,
	"exceptions" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" varchar(255) NOT NULL,
	"approved_by" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gdpr_audit_trails" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(100) NOT NULL,
	"user_email" varchar(255),
	"action" "audit_action" NOT NULL,
	"data_category" "data_category",
	"resource_type" varchar(100),
	"resource_id" varchar(100),
	"old_values" jsonb,
	"new_values" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"session_id" varchar(100),
	"legal_basis" text,
	"purpose" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "privacy_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_number" varchar(20) NOT NULL,
	"user_id" varchar(100) NOT NULL,
	"user_email" varchar(255) NOT NULL,
	"request_type" "gdpr_request_type" NOT NULL,
	"status" "gdpr_request_status" DEFAULT 'pending' NOT NULL,
	"description" text,
	"data_categories" "data_category"[],
	"requested_data" jsonb,
	"response_data" jsonb,
	"processing_notes" text,
	"completion_date" timestamp,
	"due_date" timestamp NOT NULL,
	"processed_by" varchar(255),
	"verification_method" varchar(100),
	"rejection_reason" text,
	"attachments" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "privacy_requests_request_number_unique" UNIQUE("request_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "security_incidents" (
	"id" serial PRIMARY KEY NOT NULL,
	"incident_number" varchar(20) NOT NULL,
	"severity" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"affected_users" integer DEFAULT 0,
	"affected_data_categories" "data_category"[],
	"breach_type" varchar(100),
	"incident_date" timestamp NOT NULL,
	"discovery_date" timestamp NOT NULL,
	"containment_date" timestamp,
	"resolution_date" timestamp,
	"reported_to_authority" boolean DEFAULT false,
	"authority_report_date" timestamp,
	"data_subjects_notified" boolean DEFAULT false,
	"notification_date" timestamp,
	"root_cause" text,
	"remediation_actions" text,
	"preventive_actions" text,
	"status" varchar(50) DEFAULT 'open' NOT NULL,
	"assigned_to" varchar(255),
	"reported_by" varchar(255) NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "security_incidents_incident_number_unique" UNIQUE("incident_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_consents" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(100) NOT NULL,
	"consent_type" "consent_type" NOT NULL,
	"is_granted" boolean DEFAULT false NOT NULL,
	"consent_version" varchar(20) NOT NULL,
	"consent_text" text,
	"granted_at" timestamp,
	"withdrawn_at" timestamp,
	"expires_at" timestamp,
	"ip_address" varchar(45),
	"user_agent" text,
	"consent_method" varchar(100),
	"parent_consent_id" integer,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "backup_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"log_id" varchar NOT NULL,
	"session_id" integer,
	"card_id" integer,
	"action" varchar NOT NULL,
	"status" varchar NOT NULL,
	"message" text NOT NULL,
	"details" jsonb,
	"files_transferred" integer,
	"bytes_transferred" bigint,
	"transfer_duration" integer,
	"transfer_speed" numeric(10, 2),
	"error_code" varchar,
	"error_details" jsonb,
	"timestamp" timestamp DEFAULT now(),
	"user_id" varchar NOT NULL,
	CONSTRAINT "backup_logs_log_id_unique" UNIQUE("log_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "backup_tips" (
	"id" serial PRIMARY KEY NOT NULL,
	"tip_id" varchar NOT NULL,
	"category" varchar NOT NULL,
	"event_type" varchar NOT NULL,
	"profession" varchar NOT NULL,
	"title" varchar NOT NULL,
	"description" text NOT NULL,
	"action_items" jsonb,
	"importance" varchar DEFAULT 'medium' NOT NULL,
	"show_on_activation" boolean DEFAULT false,
	"show_during_backup" boolean DEFAULT false,
	"show_on_completion" boolean DEFAULT false,
	"title_norwegian" varchar,
	"description_norwegian" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "backup_tips_tip_id_unique" UNIQUE("tip_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "memory_card_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" varchar NOT NULL,
	"project_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"profession" varchar NOT NULL,
	"project_phase" varchar DEFAULT 'post_production' NOT NULL,
	"event_date" timestamp,
	"execution_date" timestamp,
	"post_production_start_date" timestamp,
	"activated_at" timestamp DEFAULT now(),
	"event_type" varchar NOT NULL,
	"wedding_culture" varchar,
	"total_days" integer DEFAULT 1,
	"active_days" jsonb,
	"card_labeling_scheme" varchar NOT NULL,
	"drive_folder_id" varchar,
	"day_folders" jsonb,
	"upload_progress" jsonb,
	"status" varchar DEFAULT 'active' NOT NULL,
	"is_auto_activated" boolean DEFAULT true,
	"total_cards" integer DEFAULT 0,
	"backed_up_cards" integer DEFAULT 0,
	"last_backup_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	CONSTRAINT "memory_card_sessions_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "equipment_brands" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"category" varchar NOT NULL,
	"country" varchar,
	"website" varchar,
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "equipment_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"brand" varchar NOT NULL,
	"model" varchar NOT NULL,
	"category" varchar,
	"image_url" varchar NOT NULL,
	"title" varchar,
	"source" varchar,
	"width" integer DEFAULT 800,
	"height" integer DEFAULT 600,
	"search_engine" varchar NOT NULL,
	"search_engine_id" varchar,
	"verified" boolean DEFAULT false,
	"is_primary" boolean DEFAULT false,
	"is_official" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "equipment_models" (
	"id" varchar PRIMARY KEY NOT NULL,
	"brand_id" varchar,
	"name" varchar NOT NULL,
	"category" varchar NOT NULL,
	"release_year" integer,
	"description" text,
	"specifications" jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lens_database" (
	"id" varchar PRIMARY KEY NOT NULL,
	"brand" varchar,
	"model" varchar,
	"mount" varchar,
	"focal_length" varchar,
	"aperture" varchar,
	"lens_type" varchar,
	"weight" varchar,
	"dimensions" varchar,
	"image_stabilization" boolean DEFAULT false,
	"weather_sealing" boolean DEFAULT false,
	"autofocus" boolean DEFAULT true,
	"release_year" integer,
	"msrp_price" numeric(10, 2),
	"current_price" numeric(10, 2),
	"availability" varchar DEFAULT 'available',
	"description" text,
	"specifications" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "market_equipment" (
	"id" serial PRIMARY KEY NOT NULL,
	"brand" varchar NOT NULL,
	"model" varchar NOT NULL,
	"category" varchar NOT NULL,
	"subcategory" varchar,
	"msrp" numeric(10, 2),
	"current_market_price" numeric(10, 2),
	"used_market_price" numeric(10, 2),
	"release_date" timestamp,
	"discontinued_date" timestamp,
	"specifications" jsonb,
	"features" jsonb,
	"dimensions" jsonb,
	"photographer_rating" numeric(3, 2),
	"videographer_rating" numeric(3, 2),
	"music_producer_rating" numeric(3, 2),
	"overall_rating" numeric(3, 2),
	"is_available" boolean DEFAULT true,
	"norwegian_suppliers" jsonb,
	"estimated_delivery" varchar,
	"search_keywords" jsonb,
	"popularity_score" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "software_database" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"vendor" varchar NOT NULL,
	"category" varchar NOT NULL,
	"subcategory" varchar,
	"current_version" varchar,
	"release_date" timestamp,
	"platform" jsonb,
	"professional_features" jsonb,
	"workflow_benefits" jsonb,
	"integrations" jsonb,
	"pricing_model" varchar,
	"price" numeric(10, 2),
	"currency" varchar DEFAULT 'NOK',
	"system_requirements" jsonb,
	"supported_formats" jsonb,
	"photographer_rating" numeric(3, 2),
	"videographer_rating" numeric(3, 2),
	"overall_rating" numeric(3, 2),
	"is_active" boolean DEFAULT true,
	"is_recommended" boolean DEFAULT false,
	"description" text,
	"website" varchar,
	"download_url" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "software_updates" (
	"id" varchar PRIMARY KEY NOT NULL,
	"software" varchar NOT NULL,
	"vendor" varchar NOT NULL,
	"category" varchar NOT NULL,
	"version" varchar NOT NULL,
	"previous_version" varchar,
	"release_date" timestamp NOT NULL,
	"update_type" varchar NOT NULL,
	"is_latest" boolean DEFAULT true,
	"photographer_benefits" jsonb,
	"new_features" jsonb,
	"performance_improvements" jsonb,
	"bug_fixes" jsonb,
	"pricing_changes" text,
	"system_requirements" jsonb,
	"download_size" varchar,
	"installation_notes" text,
	"priority" varchar DEFAULT 'optional',
	"photographer_recommendation" varchar,
	"source_url" varchar,
	"last_verified" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_equipment" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"user_type" varchar,
	"category" varchar,
	"brand" varchar NOT NULL,
	"model" varchar NOT NULL,
	"serial_number" varchar,
	"purchase_date" varchar,
	"purchase_price" numeric(10, 2),
	"current_value" numeric(10, 2),
	"condition" varchar,
	"warranty_expiry" varchar,
	"last_maintenance" varchar,
	"next_maintenance" varchar,
	"maintenance_interval" integer,
	"firmware_version" varchar,
	"notes" text,
	"image_url" varchar,
	"settings" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tutorial_analytics" (
	"id" serial PRIMARY KEY NOT NULL,
	"tutorial_id" varchar NOT NULL,
	"profession" varchar,
	"total_started" integer DEFAULT 0,
	"total_completed" integer DEFAULT 0,
	"average_time_spent" integer,
	"completion_rate" integer,
	"average_rating" integer,
	"step_dropoff_data" jsonb,
	"common_issues" jsonb,
	"last_updated" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tutorial_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"tutorial_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"profession" varchar NOT NULL,
	"current_step" integer DEFAULT 0,
	"total_steps" integer,
	"completed" boolean DEFAULT false,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"time_spent" integer,
	"last_accessed_at" timestamp DEFAULT now(),
	"feedback" jsonb,
	"progress_data" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tutorials" (
	"id" serial PRIMARY KEY NOT NULL,
	"tutorial_id" varchar NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"category" varchar NOT NULL,
	"difficulty" varchar NOT NULL,
	"duration" varchar,
	"profession" jsonb,
	"component" varchar,
	"scenario" text,
	"key_features" jsonb,
	"implementation_status" varchar DEFAULT 'planned',
	"steps" jsonb,
	"resources" jsonb,
	"prerequisites" jsonb,
	"is_active" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "tutorials_tutorial_id_unique" UNIQUE("tutorial_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "editing_software" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"category" varchar(50) NOT NULL,
	"version" varchar(20),
	"official_api_url" text,
	"documentation_url" text,
	"last_shortcut_update" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "keyboard_shortcuts" (
	"id" varchar PRIMARY KEY NOT NULL,
	"software_id" varchar,
	"action" varchar(200) NOT NULL,
	"category" varchar(100) NOT NULL,
	"description" text,
	"mac_shortcut" varchar(100),
	"windows_shortcut" varchar(100),
	"linux_shortcut" varchar(100),
	"is_essential" boolean DEFAULT false,
	"frequency" varchar(20),
	"difficulty" varchar(20),
	"tags" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_shortcut_preferences" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"software_id" varchar,
	"preferred_platform" varchar(20) NOT NULL,
	"show_only_essential" boolean DEFAULT false,
	"favorite_shortcuts" jsonb DEFAULT '[]'::jsonb,
	"hidden_shortcuts" jsonb DEFAULT '[]'::jsonb,
	"custom_shortcuts" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "client_gallery_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gallery_id" uuid NOT NULL,
	"photographer_id" varchar NOT NULL,
	"image_title" varchar NOT NULL,
	"image_description" text,
	"thumbnail_url" varchar NOT NULL,
	"full_size_url" varchar NOT NULL,
	"watermarked_url" varchar,
	"image_metadata" jsonb,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"sort_order" integer DEFAULT 0,
	"is_visible" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "client_image_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gallery_id" uuid NOT NULL,
	"image_id" uuid NOT NULL,
	"client_name" varchar NOT NULL,
	"client_email" varchar NOT NULL,
	"comment" text NOT NULL,
	"comment_type" varchar DEFAULT 'general',
	"status" varchar DEFAULT 'open',
	"photographer_response" text,
	"responded_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "client_image_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gallery_id" uuid NOT NULL,
	"client_email" varchar NOT NULL,
	"photographer_id" varchar NOT NULL,
	"stripe_payment_intent_id" varchar,
	"total_amount" numeric(10, 2) NOT NULL,
	"currency" varchar DEFAULT 'NOK',
	"additional_images" integer DEFAULT 0,
	"selected_image_ids" jsonb NOT NULL,
	"payment_status" varchar DEFAULT 'pending',
	"payment_date" timestamp,
	"download_token" varchar,
	"download_expires_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "client_image_selections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gallery_id" uuid NOT NULL,
	"image_id" uuid NOT NULL,
	"client_email" varchar NOT NULL,
	"selection_type" varchar NOT NULL,
	"priority" integer DEFAULT 0,
	"client_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "photographer_client_galleries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"photographer_id" varchar NOT NULL,
	"client_name" varchar NOT NULL,
	"client_email" varchar NOT NULL,
	"project_title" varchar NOT NULL,
	"access_token" varchar NOT NULL,
	"gallery_settings" jsonb NOT NULL,
	"status" varchar DEFAULT 'active',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	CONSTRAINT "photographer_client_galleries_access_token_unique" UNIQUE("access_token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "photographer_pricing_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"photographer_id" varchar NOT NULL,
	"default_price_per_image" numeric(8, 2) DEFAULT '150.00',
	"currency" varchar DEFAULT 'NOK',
	"contract_settings" jsonb DEFAULT '{"defaultIncludedImages":50,"bulkDiscounts":[]}'::jsonb,
	"payment_terms" jsonb DEFAULT '{"acceptsCreditCard":true,"acceptsVipps":true,"acceptsBankTransfer":false,"requiresUpfrontPayment":true,"refundPolicy":"No refunds after download"}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "photographer_pricing_settings_photographer_id_unique" UNIQUE("photographer_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "photography_tips" (
	"id" varchar PRIMARY KEY NOT NULL,
	"category" varchar(100) NOT NULL,
	"scenario" varchar(255) NOT NULL,
	"title" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"recommended_settings" jsonb,
	"recommended_equipment" jsonb,
	"conditions" jsonb,
	"example_images" jsonb,
	"interactive" jsonb,
	"priority" integer DEFAULT 1,
	"is_active" boolean DEFAULT true,
	"language" varchar(5) DEFAULT 'no' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"author_id" varchar,
	"source" varchar(100) DEFAULT 'CreatorHub Norge'
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tip_triggers" (
	"id" varchar PRIMARY KEY NOT NULL,
	"tip_id" varchar NOT NULL,
	"trigger_type" varchar(50) NOT NULL,
	"trigger_value" varchar(255) NOT NULL,
	"condition" varchar(50) DEFAULT 'equals',
	"priority" integer DEFAULT 1,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_tip_interactions" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"tip_id" varchar NOT NULL,
	"viewed" boolean DEFAULT false,
	"bookmarked" boolean DEFAULT false,
	"helpful" boolean,
	"view_count" integer DEFAULT 0,
	"last_viewed_at" timestamp,
	"context" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "communication_channels" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"type" varchar NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "communication_integrations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" varchar NOT NULL,
	"integration_type" varchar NOT NULL,
	"external_id" varchar,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"is_active" boolean DEFAULT true,
	"sync_status" varchar DEFAULT 'active',
	"last_sync_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "communication_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" varchar NOT NULL,
	"sender_id" varchar NOT NULL,
	"recipient_id" varchar,
	"message_type" varchar NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"is_read" boolean DEFAULT false,
	"is_priority" boolean DEFAULT false,
	"is_system_generated" boolean DEFAULT false,
	"parent_message_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"read_at" timestamp,
	"delivered_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "communication_participants" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"role" varchar DEFAULT 'member',
	"permissions" jsonb DEFAULT '{"canSend":true,"canRead":true,"canInvite":false,"canModerate":false}'::jsonb,
	"joined_at" timestamp DEFAULT now(),
	"last_seen_at" timestamp,
	"notification_settings" jsonb DEFAULT '{"email":true,"inApp":true,"push":false}'::jsonb,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "communication_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"type" varchar NOT NULL,
	"subject" varchar,
	"content" text NOT NULL,
	"variables" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true,
	"profession" varchar DEFAULT 'all',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "message_attachments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" varchar NOT NULL,
	"file_name" varchar NOT NULL,
	"file_type" varchar NOT NULL,
	"file_size" integer,
	"file_path" varchar NOT NULL,
	"thumbnail_path" varchar,
	"uploaded_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "message_reactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"reaction_type" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "music_producer_plugins" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"plugin_id" varchar NOT NULL,
	"category" varchar NOT NULL,
	"is_primary" boolean DEFAULT false,
	"usage" varchar,
	"rating" integer,
	"notes" text,
	"added_date" varchar NOT NULL,
	"last_used" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "plugin_licenses" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"plugin_id" varchar NOT NULL,
	"license_key" text,
	"purchase_date" varchar NOT NULL,
	"expiry_date" varchar,
	"license_type" varchar NOT NULL,
	"status" varchar DEFAULT 'active' NOT NULL,
	"installed_version" varchar,
	"last_update_check" varchar,
	"auto_update" boolean DEFAULT true,
	"purchase_price" integer,
	"vendor" varchar NOT NULL,
	"plugin_name" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "plugin_notifications" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"plugin_id" varchar,
	"vendor" varchar,
	"type" varchar NOT NULL,
	"title" varchar NOT NULL,
	"message" text NOT NULL,
	"severity" varchar DEFAULT 'info',
	"is_read" boolean DEFAULT false,
	"action_url" text,
	"expires_at" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "plugin_updates" (
	"id" varchar PRIMARY KEY NOT NULL,
	"plugin_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"from_version" varchar,
	"to_version" varchar NOT NULL,
	"update_date" varchar NOT NULL,
	"status" varchar DEFAULT 'available' NOT NULL,
	"download_url" text,
	"release_notes" text,
	"is_security_update" boolean DEFAULT false,
	"is_major_update" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "plugin_vendor_accounts" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"vendor" varchar NOT NULL,
	"username" varchar,
	"email" varchar,
	"is_connected" boolean DEFAULT false,
	"last_login" varchar,
	"access_token" text,
	"refresh_token" text,
	"token_expiry" varchar,
	"account_type" varchar,
	"sync_enabled" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendor_product_downloads" (
	"id" varchar PRIMARY KEY NOT NULL,
	"product_id" varchar NOT NULL,
	"user_id" varchar,
	"ip_address" varchar,
	"user_agent" text,
	"download_date" timestamp DEFAULT now(),
	"file_size" integer,
	"download_duration" integer,
	"completed" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendor_product_reviews" (
	"id" varchar PRIMARY KEY NOT NULL,
	"product_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"user_name" varchar NOT NULL,
	"rating" integer NOT NULL,
	"title" varchar,
	"comment" text,
	"verified" boolean DEFAULT false,
	"helpful" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendor_showcase_products" (
	"id" integer PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY (sequence name "vendor_showcase_products_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"vendor_id" varchar NOT NULL,
	"vendor_name" varchar,
	"product_name" varchar NOT NULL,
	"product_type" varchar NOT NULL,
	"price" integer DEFAULT 0,
	"description" text,
	"image_url" varchar,
	"audio_samples" text[] DEFAULT '{}',
	"video_samples" text[] DEFAULT '{}',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendor_showcase_stats" (
	"id" varchar PRIMARY KEY NOT NULL,
	"vendor_id" varchar NOT NULL,
	"total_products" integer DEFAULT 0,
	"total_downloads" integer DEFAULT 0,
	"total_revenue" integer DEFAULT 0,
	"average_rating" integer DEFAULT 0,
	"featured_products" integer DEFAULT 0,
	"active_products" integer DEFAULT 0,
	"popularity_score" integer DEFAULT 0,
	"last_calculated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hour_overages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"contract_id" varchar NOT NULL,
	"original_hours" numeric NOT NULL,
	"actual_hours" numeric NOT NULL,
	"overage_hours" numeric NOT NULL,
	"overage_rate" numeric NOT NULL,
	"overage_amount" numeric NOT NULL,
	"status" varchar DEFAULT 'detected',
	"client_notified_at" timestamp,
	"client_response" text,
	"client_decision" varchar,
	"new_contract_generated" boolean DEFAULT false,
	"new_contract_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "integrated_projects" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"project_type" varchar NOT NULL,
	"wedding_tradition" varchar,
	"client_name" varchar NOT NULL,
	"client_email" varchar,
	"client_phone" varchar,
	"estimated_hours" numeric NOT NULL,
	"hourly_rate" numeric NOT NULL,
	"total_estimated_price" numeric NOT NULL,
	"wedding_timeline_id" varchar,
	"contract_id" varchar,
	"showcase_id" varchar,
	"status" varchar DEFAULT 'draft',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_contracts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"contract_template" varchar NOT NULL,
	"original_hours" numeric NOT NULL,
	"original_price" numeric NOT NULL,
	"current_hours" numeric NOT NULL,
	"current_price" numeric NOT NULL,
	"version" integer DEFAULT 1,
	"status" varchar DEFAULT 'draft',
	"client_signed_at" timestamp,
	"photographer_signed_at" timestamp,
	"contract_file_url" varchar,
	"revision_reason" text,
	"previous_version" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_time_tracking" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"task_description" text NOT NULL,
	"hours_spent" numeric NOT NULL,
	"date_worked" date NOT NULL,
	"timeline_event_id" varchar,
	"billable_hours" numeric NOT NULL,
	"rate" numeric NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wedding_timeline_integration" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"timeline_id" varchar NOT NULL,
	"event_hour_allocations" jsonb,
	"automatic_time_tracking" boolean DEFAULT true,
	"showcase_auto_update" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sales_activities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"type" varchar NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"status" varchar DEFAULT 'pending',
	"due_date" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sales_analytics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"period" varchar NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"total_leads" integer DEFAULT 0,
	"active_deals" integer DEFAULT 0,
	"closed_deals" integer DEFAULT 0,
	"conversion_rate" numeric(5, 2) DEFAULT '0.00',
	"total_value" numeric(10, 2) DEFAULT '0.00',
	"average_deal_size" numeric(10, 2) DEFAULT '0.00',
	"sales_cycle" integer DEFAULT 30,
	"top_sources" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sales_conversations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"type" varchar NOT NULL,
	"duration" integer,
	"summary" text NOT NULL,
	"outcome" varchar NOT NULL,
	"key_points" jsonb DEFAULT '[]'::jsonb,
	"next_steps" jsonb DEFAULT '[]'::jsonb,
	"attachments" jsonb,
	"scheduled_follow" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sales_leads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"email" varchar NOT NULL,
	"phone" varchar,
	"company" varchar,
	"project_type" varchar NOT NULL,
	"status" varchar DEFAULT 'cold',
	"source" varchar NOT NULL,
	"value" numeric(10, 2) NOT NULL,
	"probability" integer DEFAULT 50,
	"last_contact" timestamp DEFAULT now(),
	"next_follow" timestamp,
	"timeline" varchar,
	"location" varchar,
	"special_requests" text,
	"customer_type" varchar,
	"budget_tier" varchar DEFAULT 'standard',
	"urgency" varchar DEFAULT 'medium',
	"sales_approach" text,
	"recommended_actions" jsonb,
	"closing_probability" integer DEFAULT 50,
	"submission_id" varchar,
	"contract_id" varchar,
	"project_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sales_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"description" text NOT NULL,
	"category" varchar NOT NULL,
	"template" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sales_voice_notes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"audio_url" varchar NOT NULL,
	"transcript" text,
	"duration" integer,
	"summary" text,
	"key_insights" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "additional_costs" (
	"id" varchar PRIMARY KEY DEFAULT 'gen_random_uuid()' NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" varchar NOT NULL,
	"cost_structure" jsonb NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "custom_packages" (
	"id" varchar PRIMARY KEY DEFAULT 'gen_random_uuid()' NOT NULL,
	"client_id" varchar,
	"submission_id" varchar,
	"name" varchar(255) NOT NULL,
	"configuration" jsonb NOT NULL,
	"total_price" numeric(10, 2) NOT NULL,
	"currency" varchar DEFAULT 'NOK',
	"status" varchar DEFAULT 'draft',
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "discounts" (
	"id" varchar PRIMARY KEY DEFAULT 'gen_random_uuid()' NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" varchar NOT NULL,
	"discount_value" numeric(10, 2) NOT NULL,
	"is_percentage" boolean DEFAULT true,
	"conditions" jsonb,
	"discount_code" varchar(50),
	"is_active" boolean DEFAULT true,
	"usage_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "price_history" (
	"id" varchar PRIMARY KEY DEFAULT 'gen_random_uuid()' NOT NULL,
	"entity_type" varchar NOT NULL,
	"entity_id" varchar NOT NULL,
	"old_price" numeric(10, 2),
	"new_price" numeric(10, 2),
	"change_reason" text,
	"changed_by" varchar NOT NULL,
	"changed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pricing_structure" (
	"id" varchar PRIMARY KEY DEFAULT 'gen_random_uuid()' NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" varchar NOT NULL,
	"rates" jsonb NOT NULL,
	"license_types" jsonb,
	"service_category" varchar NOT NULL,
	"payment_terms" text,
	"extra_image_packages" jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quotes" (
	"id" varchar PRIMARY KEY DEFAULT 'gen_random_uuid()' NOT NULL,
	"quote_number" varchar(50) NOT NULL,
	"client_id" varchar NOT NULL,
	"submission_id" varchar,
	"services" jsonb NOT NULL,
	"additional_costs" jsonb,
	"discounts" jsonb,
	"subtotal" numeric(10, 2) NOT NULL,
	"mva" numeric(10, 2) NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"currency" varchar DEFAULT 'NOK',
	"status" varchar DEFAULT 'draft',
	"valid_until" timestamp,
	"contract_id" varchar,
	"invoice_id" varchar,
	"notes" text,
	"internal_notes" text,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"sent_at" timestamp,
	"viewed_at" timestamp,
	"responded_at" timestamp,
	CONSTRAINT "quotes_quote_number_unique" UNIQUE("quote_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "standard_packages" (
	"id" varchar PRIMARY KEY DEFAULT 'gen_random_uuid()' NOT NULL,
	"name" varchar(255) NOT NULL,
	"category" varchar NOT NULL,
	"description" text,
	"base_price" numeric(10, 2) NOT NULL,
	"currency" varchar DEFAULT 'NOK',
	"inclusions" jsonb NOT NULL,
	"service_types" jsonb NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admin_action_usage_stats" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"action_name" varchar NOT NULL,
	"usage_count" integer DEFAULT 1,
	"last_used" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admin_smart_preferences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"sorting_preference" varchar DEFAULT 'smart',
	"learning_mode" boolean DEFAULT true,
	"total_actions" integer DEFAULT 0,
	"speed_dial_order" jsonb,
	"hidden_actions" jsonb,
	"last_optimization" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "admin_smart_preferences_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_compatibility" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"compatible_with_product_id" uuid,
	"min_focal_mm" integer,
	"max_focal_mm" integer,
	"aperture_min" numeric(3, 1),
	"aperture_max" numeric(3, 1),
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_firmware" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"version" varchar(50) NOT NULL,
	"released_at" timestamp,
	"download_url" text,
	"release_notes" text,
	"checksum_sha256" varchar(64),
	"region" varchar(10),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"angle" varchar(50) NOT NULL,
	"role" varchar(50) NOT NULL,
	"format" varchar(10) NOT NULL,
	"url_original" text NOT NULL,
	"url_webp_2k" text,
	"url_webp_1k" text,
	"url_thumb" text,
	"width" integer,
	"height" integer,
	"filesize" integer,
	"color_profile" varchar(50),
	"hash_perceptual" varchar(64),
	"license" varchar(50),
	"attribution" text,
	"source_url" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"retailer" varchar(100) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"url" text,
	"last_seen_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar(50) NOT NULL,
	"brand" varchar(100) NOT NULL,
	"series" varchar(100),
	"model" varchar(200) NOT NULL,
	"mount" varchar(50),
	"sensor_format" varchar(50),
	"announced_at" timestamp,
	"released_at" timestamp,
	"discontinued_at" timestamp,
	"technical_specs" jsonb,
	"source_url" text,
	"license" varchar(50),
	"attribution" text,
	"slug" varchar(300) NOT NULL,
	"meta_title" varchar(200),
	"meta_description" text,
	"version" integer DEFAULT 1,
	"last_scraped_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "products_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(50) NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "tags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "service_activations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"subscription_id" integer,
	"service_name" varchar NOT NULL,
	"service_type" varchar NOT NULL,
	"activated_features" jsonb,
	"activated_by" varchar,
	"activation_method" varchar,
	"chat_notification_sent" boolean DEFAULT false,
	"email_notification_sent" boolean DEFAULT false,
	"notification_message" text,
	"activated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscription_change_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"subscription_id" integer NOT NULL,
	"change_type" varchar NOT NULL,
	"previous_package_id" varchar,
	"new_package_id" varchar,
	"previous_status" varchar,
	"new_status" varchar,
	"reason" text,
	"changed_by" varchar,
	"change_source" varchar,
	"pricing_change" numeric(10, 2),
	"proration_amount" numeric(10, 2),
	"effective_date" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trial_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"subscription_id" integer NOT NULL,
	"notification_type" varchar NOT NULL,
	"notification_channel" varchar NOT NULL,
	"title" varchar NOT NULL,
	"message" text NOT NULL,
	"action_required" boolean DEFAULT false,
	"action_url" varchar,
	"scheduled" boolean DEFAULT false,
	"scheduled_for" timestamp,
	"sent" boolean DEFAULT false,
	"sent_at" timestamp,
	"delivered" boolean DEFAULT false,
	"delivered_at" timestamp,
	"opened" boolean DEFAULT false,
	"opened_at" timestamp,
	"user_responded" boolean DEFAULT false,
	"user_response" text,
	"response_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trial_usage_tracking" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"subscription_id" integer NOT NULL,
	"projects_created" integer DEFAULT 0,
	"storage_used_mb" integer DEFAULT 0,
	"showcase_items_created" integer DEFAULT 0,
	"client_communications_sent" integer DEFAULT 0,
	"exports_completed" integer DEFAULT 0,
	"login_count" integer DEFAULT 0,
	"session_time_minutes" integer DEFAULT 0,
	"features_used" jsonb,
	"last_active_date" timestamp,
	"days_since_activation" integer DEFAULT 0,
	"onboarding_completed" boolean DEFAULT false,
	"first_project_created" boolean DEFAULT false,
	"first_showcase_created" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"profession" varchar NOT NULL,
	"package_id" varchar NOT NULL,
	"package_tier" varchar NOT NULL,
	"status" varchar DEFAULT 'active' NOT NULL,
	"is_trial_account" boolean DEFAULT false,
	"trial_start_date" timestamp,
	"trial_end_date" timestamp,
	"trial_days_remaining" integer,
	"trial_activated_by" varchar,
	"max_projects" integer,
	"max_storage" integer,
	"max_showcase_items" integer,
	"max_client_communications" integer,
	"max_exports" integer,
	"restricted_features" jsonb,
	"monthly_price" numeric(10, 2),
	"annual_price" numeric(10, 2),
	"billing_cycle" varchar,
	"next_billing_date" timestamp,
	"converted_from_trial" boolean DEFAULT false,
	"conversion_date" timestamp,
	"conversion_reason" text,
	"activated_at" timestamp DEFAULT now(),
	"last_modified" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "google_pay_billing_issues" (
	"id" serial PRIMARY KEY NOT NULL,
	"google_pay_subscription_id" integer,
	"user_id" varchar NOT NULL,
	"issue_type" varchar NOT NULL,
	"google_pay_notification_data" jsonb,
	"status" varchar DEFAULT 'unresolved' NOT NULL,
	"resolution_notes" text,
	"resolved_at" timestamp,
	"resolved_by" varchar,
	"user_notified" boolean DEFAULT false,
	"notifications_sent" integer DEFAULT 0,
	"last_notification_at" timestamp,
	"grace_period_end_time_millis" bigint,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "google_pay_products" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" varchar NOT NULL,
	"profession" varchar NOT NULL,
	"tier" varchar NOT NULL,
	"billing_period" varchar NOT NULL,
	"price_amount_micros" bigint NOT NULL,
	"currency_code" varchar DEFAULT 'NOK' NOT NULL,
	"trial_period_days" integer DEFAULT 7,
	"active" boolean DEFAULT true,
	"features" jsonb,
	"display_name" varchar NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "google_pay_products_product_id_unique" UNIQUE("product_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "google_pay_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_subscription_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"google_pay_product_id" varchar NOT NULL,
	"google_pay_subscription_id" varchar,
	"google_pay_purchase_token" varchar,
	"google_pay_order_id" varchar,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"subscription_type" varchar NOT NULL,
	"price_amount_micros" bigint NOT NULL,
	"price_currency_code" varchar DEFAULT 'NOK' NOT NULL,
	"start_time_millis" bigint,
	"expiry_time_millis" bigint,
	"trial_info" jsonb,
	"auto_renewing" boolean DEFAULT true,
	"cancel_reason" varchar,
	"cancelled_time_millis" bigint,
	"acknowledged_at" timestamp,
	"grace_period_end_time_millis" bigint,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "google_pay_subscriptions_google_pay_subscription_id_unique" UNIQUE("google_pay_subscription_id"),
	CONSTRAINT "google_pay_subscriptions_google_pay_purchase_token_unique" UNIQUE("google_pay_purchase_token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "google_pay_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"google_pay_subscription_id" integer,
	"user_id" varchar NOT NULL,
	"transaction_type" varchar NOT NULL,
	"google_pay_transaction_id" varchar,
	"google_pay_purchase_token" varchar NOT NULL,
	"amount_micros" bigint NOT NULL,
	"currency_code" varchar DEFAULT 'NOK' NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"transaction_time_millis" bigint,
	"acknowledged_at" timestamp,
	"receipt_data" jsonb,
	"signature_data" varchar,
	"error_details" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "client_gallery_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"photographer_id" varchar NOT NULL,
	"client_email" varchar NOT NULL,
	"client_name" varchar NOT NULL,
	"project_id" varchar,
	"session_name" varchar NOT NULL,
	"description" text,
	"access_pin" varchar,
	"access_password" varchar,
	"max_selections" integer,
	"min_selections" integer DEFAULT 0,
	"selection_deadline" timestamp,
	"allow_comments" boolean DEFAULT true,
	"allow_downloads" boolean DEFAULT false,
	"proofing_round" integer DEFAULT 1,
	"status" varchar DEFAULT 'setup',
	"watermark_enabled" boolean DEFAULT true,
	"low_res_preview" boolean DEFAULT true,
	"requires_password" boolean DEFAULT false,
	"password_hash" varchar,
	"allowed_ip_addresses" text[],
	"max_login_attempts" integer DEFAULT 3,
	"login_attempts" integer DEFAULT 0,
	"last_login_attempt" timestamp,
	"is_locked" boolean DEFAULT false,
	"lockout_until" timestamp,
	"requires_approval" boolean DEFAULT false,
	"download_protection_level" varchar DEFAULT 'watermark',
	"right_click_disabled" boolean DEFAULT true,
	"screenshot_protection" boolean DEFAULT false,
	"session_timeout_minutes" integer DEFAULT 60,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"expires_at" timestamp,
	"last_accessed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "client_selections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"showcase_item_id" varchar NOT NULL,
	"client_email" varchar NOT NULL,
	"is_selected" boolean DEFAULT true,
	"priority" integer,
	"client_comment" text,
	"photographer_approved" boolean,
	"photographer_comment" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "proofing_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"showcase_id" varchar NOT NULL,
	"client_name" varchar NOT NULL,
	"client_email" varchar NOT NULL,
	"max_selections" integer DEFAULT 60 NOT NULL,
	"min_selections" integer DEFAULT 1,
	"current_selections" integer DEFAULT 0,
	"deadline" timestamp NOT NULL,
	"status" varchar DEFAULT 'pending',
	"round" integer DEFAULT 1,
	"access_pin" varchar(6),
	"access_token" varchar NOT NULL,
	"instructions" text,
	"photographer_notes" text,
	"client_notes" text,
	"last_activity" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "session_activity_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"client_email" varchar NOT NULL,
	"action" varchar NOT NULL,
	"item_id" varchar,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "session_notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"client_email" varchar NOT NULL,
	"type" varchar NOT NULL,
	"subject" varchar NOT NULL,
	"content" text NOT NULL,
	"status" varchar DEFAULT 'pending',
	"scheduled_for" timestamp,
	"sent_at" timestamp,
	"opened_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "showcase_analytics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"showcase_item_id" varchar,
	"configuration_id" varchar,
	"views" integer DEFAULT 0,
	"unique_views" integer DEFAULT 0,
	"likes" integer DEFAULT 0,
	"shares" integer DEFAULT 0,
	"downloads" integer DEFAULT 0,
	"time_spent" integer DEFAULT 0,
	"referrer" varchar,
	"device_type" varchar,
	"browser" varchar,
	"country" varchar,
	"date" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "showcase_configurations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profession" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"config_name" varchar NOT NULL,
	"is_active" boolean DEFAULT true,
	"layout_type" varchar DEFAULT 'grid',
	"columns_desktop" integer DEFAULT 3,
	"columns_mobile" integer DEFAULT 1,
	"grid_spacing" integer DEFAULT 16,
	"aspect_ratio" varchar DEFAULT 'auto',
	"show_titles" boolean DEFAULT true,
	"show_descriptions" boolean DEFAULT false,
	"show_client_names" boolean DEFAULT true,
	"show_dates" boolean DEFAULT false,
	"show_tags" boolean DEFAULT true,
	"show_view_counts" boolean DEFAULT false,
	"show_like_counts" boolean DEFAULT false,
	"enable_hover" boolean DEFAULT true,
	"hover_effect" varchar DEFAULT 'zoom',
	"enable_lightbox" boolean DEFAULT true,
	"enable_fullscreen" boolean DEFAULT true,
	"enable_share" boolean DEFAULT true,
	"enable_download" boolean DEFAULT false,
	"enable_comments" boolean DEFAULT false,
	"enable_filtering" boolean DEFAULT true,
	"enable_sorting" boolean DEFAULT true,
	"enable_search" boolean DEFAULT true,
	"default_sort_by" varchar DEFAULT 'newest',
	"available_filters" jsonb DEFAULT '["all","featured","recent"]'::jsonb,
	"primary_color" varchar DEFAULT '#FF6B35',
	"secondary_color" varchar DEFAULT '#F7931E',
	"background_color" varchar DEFAULT '#ffffff',
	"text_color" varchar DEFAULT '#333333',
	"border_radius" integer DEFAULT 8,
	"shadow_level" varchar DEFAULT 'medium',
	"enable_animations" boolean DEFAULT true,
	"animation_type" varchar DEFAULT 'fade',
	"animation_duration" integer DEFAULT 300,
	"lazy_loading" boolean DEFAULT true,
	"enable_seo" boolean DEFAULT true,
	"enable_analytics" boolean DEFAULT true,
	"custom_css" text,
	"logo_url" varchar,
	"watermark_url" varchar,
	"watermark_position" varchar DEFAULT 'bottom-right',
	"watermark_opacity" numeric(3, 2) DEFAULT '0.7',
	"mobile_layout_type" varchar DEFAULT 'stack',
	"enable_mobile_gestures" boolean DEFAULT true,
	"mobile_menu_style" varchar DEFAULT 'dropdown',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "smart_album_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"album_id" varchar NOT NULL,
	"showcase_item_id" varchar NOT NULL,
	"sort_order" integer DEFAULT 0,
	"was_auto_assigned" boolean DEFAULT false,
	"assignment_reason" varchar,
	"added_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "smart_albums" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"profession" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"album_type" varchar DEFAULT 'smart_rule',
	"smart_rules" jsonb DEFAULT '{}'::jsonb,
	"cover_image_id" varchar,
	"layout_style" varchar DEFAULT 'grid',
	"sort_by" varchar DEFAULT 'date',
	"sort_order" varchar DEFAULT 'desc',
	"is_public" boolean DEFAULT false,
	"share_url" varchar,
	"access_password" varchar,
	"item_count" integer DEFAULT 0,
	"last_auto_update" timestamp,
	"status" varchar DEFAULT 'active',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_content_generations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"step_id" varchar,
	"profession" varchar,
	"package_type" varchar,
	"generation_type" varchar,
	"prompt" text,
	"ai_provider" varchar,
	"generated_content" jsonb,
	"cost" numeric(8, 4),
	"processing_time_ms" integer,
	"quality" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_journey_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"profession" varchar NOT NULL,
	"package_type" varchar NOT NULL,
	"status" varchar DEFAULT 'draft',
	"ai_context_prompt" text,
	"brand_colors" jsonb,
	"style_guide" jsonb,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "interactive_components" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"component_type" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"profession" varchar,
	"config_schema" jsonb,
	"preview_image" varchar,
	"openai_prompt_template" text,
	"animation_template" jsonb,
	"category" varchar,
	"is_system_component" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "journey_analytics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" varchar,
	"step_id" varchar,
	"user_id" varchar,
	"profession" varchar,
	"package_type" varchar,
	"step_name" varchar,
	"completion_rate" numeric(5, 2),
	"engagement_time_seconds" integer,
	"conversion_rate" numeric(5, 2),
	"feedback_score" numeric(3, 1),
	"session_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "journey_steps" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" varchar,
	"step_order" integer NOT NULL,
	"step_type" varchar NOT NULL,
	"title" varchar NOT NULL,
	"content" text,
	"ai_generated_content" jsonb,
	"component_config" jsonb,
	"animation_data" jsonb,
	"video_url" varchar,
	"interactive_config" jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "profession_component_mappings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profession" varchar NOT NULL,
	"component_id" varchar,
	"priority" integer DEFAULT 1,
	"custom_config" jsonb,
	"is_enabled" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "google_chat_invitations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" varchar NOT NULL,
	"project_id" varchar NOT NULL,
	"client_email" varchar NOT NULL,
	"client_name" varchar,
	"personal_message" text,
	"google_invite_id" varchar,
	"invite_url" varchar NOT NULL,
	"invite_token" varchar,
	"status" varchar DEFAULT 'sent',
	"expires_at" timestamp NOT NULL,
	"sent_at" timestamp DEFAULT now(),
	"opened_at" timestamp,
	"accepted_at" timestamp,
	"declined_at" timestamp,
	"sent_by" varchar NOT NULL,
	"reminders_sent" integer DEFAULT 0,
	"last_reminder_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "google_chat_invitations_invite_token_unique" UNIQUE("invite_token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "google_chat_notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" varchar NOT NULL,
	"project_id" varchar NOT NULL,
	"notification_type" varchar NOT NULL,
	"title" varchar NOT NULL,
	"message" text NOT NULL,
	"details" text,
	"google_message_id" varchar,
	"thread_key" varchar,
	"priority" varchar DEFAULT 'normal',
	"is_actionable" boolean DEFAULT false,
	"action_url" varchar,
	"action_text" varchar,
	"status" varchar DEFAULT 'sent',
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"read_at" timestamp,
	"recipients" jsonb,
	"mentioned_users" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "google_chat_space_members" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" varchar NOT NULL,
	"member_email" varchar NOT NULL,
	"member_name" varchar,
	"member_type" varchar NOT NULL,
	"google_user_id" varchar,
	"google_membership_id" varchar,
	"status" varchar DEFAULT 'active',
	"invited_at" timestamp DEFAULT now(),
	"joined_at" timestamp,
	"last_seen_at" timestamp,
	"can_send_messages" boolean DEFAULT true,
	"can_share_files" boolean DEFAULT true,
	"can_add_members" boolean DEFAULT false,
	"can_manage_space" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "google_chat_spaces" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"project_type" varchar NOT NULL,
	"project_name" varchar NOT NULL,
	"client_name" varchar NOT NULL,
	"google_space_id" varchar NOT NULL,
	"space_name" varchar NOT NULL,
	"space_url" varchar NOT NULL,
	"display_name" varchar NOT NULL,
	"description" text,
	"space_type" varchar DEFAULT 'SPACE',
	"access_type" varchar DEFAULT 'PRIVATE',
	"history_state" varchar DEFAULT 'HISTORY_ON',
	"threaded_replies" boolean DEFAULT true,
	"allow_external_members" boolean DEFAULT true,
	"google_drive_enabled" boolean DEFAULT true,
	"google_meet_enabled" boolean DEFAULT true,
	"calendar_enabled" boolean DEFAULT true,
	"notifications_enabled" boolean DEFAULT true,
	"member_count" integer DEFAULT 1,
	"last_activity" timestamp DEFAULT now(),
	"unread_count" integer DEFAULT 0,
	"status" varchar DEFAULT 'active',
	"is_client_invited" boolean DEFAULT false,
	"client_joined_at" timestamp,
	"created_by" varchar NOT NULL,
	"profession" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "google_chat_spaces_google_space_id_unique" UNIQUE("google_space_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "business_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"business_name" varchar NOT NULL,
	"organization_number" varchar,
	"logo_url" varchar,
	"description" text,
	"industry" varchar,
	"website" varchar,
	"phone" varchar,
	"email" varchar,
	"address" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_files" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"file_name" varchar NOT NULL,
	"file_path" varchar NOT NULL,
	"file_url" varchar NOT NULL,
	"file_type" varchar NOT NULL,
	"file_size" varchar,
	"mime_type" varchar,
	"is_active" boolean DEFAULT true,
	"uploaded_at" timestamp DEFAULT now(),
	"metadata" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "profession_configurations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar NOT NULL,
	"name" varchar NOT NULL,
	"name_english" varchar,
	"description" text,
	"color" varchar DEFAULT '#2196F3' NOT NULL,
	"icon" varchar DEFAULT '💼',
	"status" varchar DEFAULT 'active' NOT NULL,
	"tabs" jsonb DEFAULT '["Oversikt","Prosjekter","Kunder","Utstyr","Filer","Innstillinger"]'::jsonb NOT NULL,
	"features" jsonb DEFAULT '[]'::jsonb,
	"integrations" jsonb DEFAULT '[]'::jsonb,
	"priority" integer DEFAULT 1 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "profession_configurations_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "profession_dashboard_layouts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profession_key" varchar NOT NULL,
	"layout_name" varchar NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"configuration" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "profession_feature_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profession_key" varchar NOT NULL,
	"feature_name" varchar NOT NULL,
	"display_name" varchar NOT NULL,
	"description" text,
	"category" varchar NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"configuration" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "profession_usage_analytics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profession_key" varchar NOT NULL,
	"user_id" varchar,
	"event_type" varchar NOT NULL,
	"event_data" jsonb DEFAULT '{}'::jsonb,
	"timestamp" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "advanced_chat_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"protocol" varchar NOT NULL,
	"from_address" text NOT NULL,
	"to_address" text NOT NULL,
	"message_content" text NOT NULL,
	"message_type" varchar DEFAULT 'text' NOT NULL,
	"encryption_status" varchar DEFAULT 'none' NOT NULL,
	"protocol_metadata" jsonb,
	"delivery_status" varchar DEFAULT 'pending' NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"user_email" varchar NOT NULL,
	"conversation_id" varchar,
	"attachments" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "advanced_chat_protocols" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"protocol_type" varchar NOT NULL,
	"server_configuration" jsonb NOT NULL,
	"features" jsonb NOT NULL,
	"integration_settings" jsonb NOT NULL,
	"status" varchar DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" varchar NOT NULL,
	"profession" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_protocol_configurations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ai_type" varchar NOT NULL,
	"protocol_standard" varchar NOT NULL,
	"model_configuration" jsonb NOT NULL,
	"processing_pipeline" jsonb NOT NULL,
	"performance_metrics" jsonb NOT NULL,
	"status" varchar DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" varchar NOT NULL,
	"profession" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "api_protocol_configurations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"protocol_type" varchar(50) NOT NULL,
	"endpoint_url" text NOT NULL,
	"authentication_method" varchar NOT NULL,
	"configuration" jsonb NOT NULL,
	"status" varchar DEFAULT 'active' NOT NULL,
	"version" varchar DEFAULT '1.0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" varchar NOT NULL,
	"profession" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_protocol_connections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"protocol_type" varchar NOT NULL,
	"user_email" varchar NOT NULL,
	"connection_config" jsonb NOT NULL,
	"status" varchar DEFAULT 'disconnected' NOT NULL,
	"last_activity" timestamp,
	"capabilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "collaboration_protocols" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"protocol_type" varchar NOT NULL,
	"configuration" jsonb NOT NULL,
	"integration_settings" jsonb NOT NULL,
	"status" varchar DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" varchar NOT NULL,
	"profession" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "media_protocol_handlers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"protocol_name" varchar NOT NULL,
	"media_type" varchar NOT NULL,
	"handler_config" jsonb NOT NULL,
	"processing_options" jsonb NOT NULL,
	"status" varchar DEFAULT 'enabled' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" varchar NOT NULL,
	"profession" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "openapi_documentation_protocols" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"api_name" varchar NOT NULL,
	"openapi_version" varchar DEFAULT '3.0.3' NOT NULL,
	"specification" jsonb NOT NULL,
	"documentation_config" jsonb NOT NULL,
	"access_control" jsonb NOT NULL,
	"status" varchar DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" varchar NOT NULL,
	"profession" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "security_protocol_configurations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"protocol_type" varchar NOT NULL,
	"security_level" varchar NOT NULL,
	"configuration" jsonb NOT NULL,
	"compliance_status" jsonb NOT NULL,
	"status" varchar DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" varchar NOT NULL,
	"profession" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendor_business_protocols" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"protocol_type" varchar NOT NULL,
	"business_type" varchar NOT NULL,
	"configuration" jsonb NOT NULL,
	"seo_metadata" jsonb NOT NULL,
	"status" varchar DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" varchar NOT NULL,
	"profession" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cms_change_tracking" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" varchar NOT NULL,
	"session_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"change_sequence" integer NOT NULL,
	"change_timestamp" timestamp DEFAULT now(),
	"component_id" varchar,
	"change_operation" varchar NOT NULL,
	"property_path" varchar,
	"old_value" jsonb,
	"new_value" jsonb,
	"cursor_position" jsonb,
	"selected_elements" jsonb DEFAULT '[]'::jsonb,
	"is_undoable" boolean DEFAULT true,
	"undo_complexity" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cms_collaboration_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" varchar NOT NULL,
	"session_name" varchar NOT NULL,
	"active_users" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true,
	"lock_level" varchar DEFAULT 'component',
	"conflict_resolution" varchar DEFAULT 'last_wins',
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"last_activity" timestamp DEFAULT now(),
	"ended_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cms_component_library" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"component_name" varchar NOT NULL,
	"display_name" varchar NOT NULL,
	"category" varchar NOT NULL,
	"profession" varchar DEFAULT 'all',
	"component_definition" jsonb NOT NULL,
	"version" varchar DEFAULT '1.0.0' NOT NULL,
	"is_built_in" boolean DEFAULT false,
	"is_custom" boolean DEFAULT true,
	"is_enabled" boolean DEFAULT true,
	"usage_count" integer DEFAULT 0,
	"last_used" timestamp,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cms_rollback_points" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" varchar NOT NULL,
	"rollback_point_name" varchar NOT NULL,
	"rollback_point_type" varchar NOT NULL,
	"complete_snapshot" jsonb NOT NULL,
	"version_number" integer NOT NULL,
	"previous_version_id" varchar,
	"next_version_id" varchar,
	"description" text,
	"is_stable" boolean DEFAULT true,
	"can_restore" boolean DEFAULT true,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cms_version_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" varchar NOT NULL,
	"version_number" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"change_type" varchar NOT NULL,
	"change_description" text NOT NULL,
	"before_snapshot" jsonb,
	"after_snapshot" jsonb,
	"changed_components" jsonb DEFAULT '{}'::jsonb,
	"is_autosave" boolean DEFAULT false,
	"is_major_version" boolean DEFAULT false,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"user_agent" text,
	"ip_address" varchar,
	"session_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cms_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"filename" varchar(255) NOT NULL,
	"original_name" varchar(255) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"size" integer NOT NULL,
	"url" text NOT NULL,
	"cdn_url" text,
	"thumbnail_url" text,
	"alt_text" text,
	"tags" json DEFAULT '[]',
	"uploaded_by" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cms_themes" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"variables" json NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "cms_themes_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "component_definitions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" varchar(100) NOT NULL,
	"category" varchar(100) NOT NULL,
	"icon" varchar(50),
	"description" text,
	"props_schema" json NOT NULL,
	"default_props" json NOT NULL,
	"style_schema" json NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "design_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" varchar(50) NOT NULL,
	"value" json NOT NULL,
	"category" varchar(100) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "draft_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"draft_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"content" json NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "page_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"page_id" uuid,
	"title" varchar(255) NOT NULL,
	"slug" varchar(255),
	"content" json NOT NULL,
	"template" varchar(100),
	"is_draft" boolean DEFAULT true NOT NULL,
	"is_auto_saved" boolean DEFAULT false NOT NULL,
	"last_saved_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "page_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"schema" json NOT NULL,
	"thumbnail" text,
	"category" varchar(100) DEFAULT 'general' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "page_templates_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "page_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"components" json NOT NULL,
	"metadata" json NOT NULL,
	"change_description" text,
	"created_by" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workflow_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" uuid NOT NULL,
	"status" varchar(20) NOT NULL,
	"assigned_to" varchar(255),
	"comment" text,
	"created_by" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "google_integration_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"price_admin_folder_id" varchar(255),
	"receipts_folder_id" varchar(255),
	"price_admin_spreadsheet_id" varchar(255),
	"auto_sync_enabled" boolean DEFAULT true,
	"last_sync_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "google_integration_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ocr_receipts" (
	"id" serial PRIMARY KEY NOT NULL,
	"receipt_id" varchar(255) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"merchant" varchar(255),
	"amount" numeric(10, 2),
	"currency" varchar(3) DEFAULT 'NOK',
	"receipt_date" date,
	"category" varchar(100),
	"original_text" text,
	"confidence" varchar(10),
	"source" varchar(20),
	"file_type" varchar(10),
	"google_drive_url" text,
	"google_drive_file_id" varchar(255),
	"manually_verified" boolean DEFAULT false,
	"verified" boolean DEFAULT false,
	"notes" text,
	"archive_folder" varchar(255),
	"month_year" varchar(20),
	"scanned_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "ocr_receipts_receipt_id_unique" UNIQUE("receipt_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "packages" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"category" varchar(100) NOT NULL,
	"profession" varchar(50) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"base_price" numeric(10, 2) NOT NULL,
	"description" text,
	"inclusions" jsonb,
	"popular" boolean DEFAULT false,
	"status" varchar(20) DEFAULT 'active',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pricing_structures" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" varchar(50) NOT NULL,
	"category" varchar(100) NOT NULL,
	"profession" varchar(50) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"hourly_rate" numeric(10, 2),
	"full_day_rate" numeric(10, 2),
	"base_price" numeric(10, 2),
	"minimum_price" numeric(10, 2),
	"maximum_price" numeric(10, 2),
	"season_factor" numeric(3, 2) DEFAULT '1.00',
	"description" text,
	"included_services" jsonb,
	"extra_costs" jsonb,
	"status" varchar(20) DEFAULT 'active',
	"is_default" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "travel_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"date" date NOT NULL,
	"from_location" varchar(255) NOT NULL,
	"to_location" varchar(255) NOT NULL,
	"distance" numeric(8, 2) NOT NULL,
	"purpose" varchar(255) NOT NULL,
	"project_id" varchar(255),
	"vehicle" varchar(255) NOT NULL,
	"vehicle_type" varchar(50) NOT NULL,
	"rate_per_km" numeric(5, 2) NOT NULL,
	"travel_amount" numeric(10, 2) NOT NULL,
	"fuel_liters" numeric(6, 2),
	"fuel_cost" numeric(10, 2),
	"toll_cost" numeric(10, 2),
	"parking_cost" numeric(10, 2),
	"other_costs" numeric(10, 2),
	"total_cost" numeric(10, 2) NOT NULL,
	"is_deductible" boolean DEFAULT false,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auto_monitor_configs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"monitor_folder_name" varchar NOT NULL,
	"is_active" boolean DEFAULT true,
	"check_interval_minutes" integer DEFAULT 5,
	"last_checked_at" timestamp,
	"auto_generate_enabled" boolean DEFAULT true,
	"default_template_type" varchar DEFAULT 'wedding',
	"default_emotional_curve" varchar DEFAULT 'rising',
	"default_target_duration" integer DEFAULT 480,
	"confidence_threshold" real DEFAULT 0.3,
	"move_processed_files" boolean DEFAULT true,
	"notification_settings" jsonb,
	"total_files_processed" integer DEFAULT 0,
	"successful_generations" integer DEFAULT 0,
	"failed_generations" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "content_analysis_cache" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" varchar NOT NULL,
	"file_name" varchar NOT NULL,
	"file_hash" varchar,
	"content_type" varchar NOT NULL,
	"confidence" real NOT NULL,
	"detected_elements" jsonb,
	"suggested_settings" jsonb,
	"analysis_details" jsonb,
	"analysis_version" varchar DEFAULT '1.0',
	"created_at" timestamp DEFAULT now(),
	"last_used_at" timestamp DEFAULT now(),
	"expires_at" timestamp,
	CONSTRAINT "content_analysis_cache_file_id_unique" UNIQUE("file_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "processed_files" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"config_id" varchar NOT NULL,
	"file_id" varchar NOT NULL,
	"file_name" varchar NOT NULL,
	"mime_type" varchar,
	"file_size" integer,
	"original_path" varchar,
	"processed_path" varchar,
	"processed" boolean DEFAULT false,
	"processing_error" text,
	"processing_started_at" timestamp,
	"processing_completed_at" timestamp,
	"story_arc_project_id" varchar,
	"content_analysis" jsonb,
	"intelligent_settings" jsonb,
	"uploaded_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "story_arc_projects" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"story_arc_name" varchar(255) NOT NULL,
	"status" varchar DEFAULT 'initialized' NOT NULL,
	"template_type" varchar NOT NULL,
	"emotional_curve" varchar NOT NULL,
	"target_duration" integer NOT NULL,
	"source_video_id" varchar,
	"source_video_name" varchar,
	"trigger_folder" varchar,
	"auto_generated" boolean DEFAULT false,
	"drive_folder" jsonb,
	"content_analysis" jsonb,
	"story_arc_data" jsonb,
	"exported_files" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "story_arc_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"content_type" varchar NOT NULL,
	"emotional_curve" varchar NOT NULL,
	"default_duration" integer NOT NULL,
	"is_default" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"story_structure" jsonb,
	"times_used" integer DEFAULT 0,
	"last_used_at" timestamp,
	"description" text,
	"tags" jsonb,
	"cultural_context" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "automated_test_suites" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" varchar,
	"name" varchar(255) NOT NULL,
	"language" varchar NOT NULL,
	"category" varchar NOT NULL,
	"unit_tests" text,
	"integration_tests" text,
	"e2e_tests" text,
	"performance_tests" text,
	"security_tests" text,
	"test_configuration" jsonb,
	"test_fixtures" jsonb,
	"is_active" boolean DEFAULT true,
	"success_rate" integer DEFAULT 0,
	"last_executed" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "code_analysis_results" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"generated_code_id" varchar,
	"code" text NOT NULL,
	"language" varchar NOT NULL,
	"analysis_type" varchar NOT NULL,
	"security_score" integer DEFAULT 0,
	"vulnerability_assessment" jsonb,
	"performance_score" integer DEFAULT 0,
	"performance_analysis" jsonb,
	"quality_score" integer DEFAULT 0,
	"quality_metrics" jsonb,
	"suggestions" jsonb DEFAULT '[]'::jsonb,
	"analysis_timestamp" timestamp DEFAULT now(),
	"processing_time" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "code_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"category" varchar NOT NULL,
	"language" varchar NOT NULL,
	"template_code" text NOT NULL,
	"mock_endpoint" text,
	"documentation" text,
	"required_dependencies" jsonb DEFAULT '[]'::jsonb,
	"configuration_options" jsonb NOT NULL,
	"quality_score" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "generated_code_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" varchar,
	"user_id" varchar,
	"generated_code" text NOT NULL,
	"configuration" jsonb NOT NULL,
	"quality_metrics" jsonb,
	"is_bookmarked" boolean DEFAULT false,
	"download_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "live_test_results" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"generated_code_id" varchar,
	"test_type" varchar NOT NULL,
	"test_code" text,
	"mock_endpoint" text,
	"execution_status" varchar NOT NULL,
	"test_output" text,
	"error_logs" text,
	"execution_time" integer,
	"test_coverage" integer DEFAULT 0,
	"test_metrics" jsonb,
	"performance_metrics" jsonb,
	"security_test_results" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "template_analytics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" varchar,
	"total_generations" integer DEFAULT 0,
	"successful_generations" integer DEFAULT 0,
	"failed_generations" integer DEFAULT 0,
	"average_quality_score" numeric(5, 2) DEFAULT '0',
	"average_rating" numeric(3, 2) DEFAULT '0',
	"total_ratings" integer DEFAULT 0,
	"bookmark_count" integer DEFAULT 0,
	"download_count" integer DEFAULT 0,
	"average_generation_time" integer DEFAULT 0,
	"average_test_coverage" numeric(5, 2) DEFAULT '0',
	"monthly_stats" jsonb DEFAULT '{}'::jsonb,
	"last_updated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "improvement_tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"task_type" varchar(50) NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text NOT NULL,
	"priority" varchar(20) DEFAULT 'medium',
	"status" varchar(20) DEFAULT 'pending',
	"auto_fix_ready" boolean DEFAULT false,
	"magic_creator_script" varchar(100),
	"execution_id" varchar,
	"source_type" varchar(50),
	"source_id" varchar,
	"estimated_time" varchar(50),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "magic_creator_features" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feature_name" varchar(100) NOT NULL,
	"script_path" varchar(200),
	"description" text,
	"category" varchar(50),
	"profession" varchar(50),
	"usage_count" integer DEFAULT 0,
	"success_rate" numeric(5, 2) DEFAULT 0,
	"avg_execution_time_ms" integer,
	"enabled" boolean DEFAULT true,
	"requires_confirmation" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "magic_creator_features_feature_name_unique" UNIQUE("feature_name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "smart_notes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"title" varchar(200) NOT NULL,
	"content" text NOT NULL,
	"category" varchar(50) DEFAULT 'general',
	"priority" varchar(20) DEFAULT 'medium',
	"tags" jsonb DEFAULT '[]'::jsonb,
	"status" varchar(20) DEFAULT 'active',
	"ai_suggestions" jsonb DEFAULT '[]'::jsonb,
	"feedback_data" jsonb,
	"project_id" varchar,
	"source" varchar(50) DEFAULT 'manual',
	"source_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"last_modified" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendor_onboarding_profiles" (
	"id" varchar PRIMARY KEY DEFAULT 'gen_random_uuid()' NOT NULL,
	"user_id" varchar NOT NULL,
	"vendor_type" varchar NOT NULL,
	"vendor_name" varchar NOT NULL,
	"business_info" jsonb NOT NULL,
	"vendor_specific_data" jsonb,
	"preferences" jsonb DEFAULT '{"notifications":true,"marketingEmails":true,"analytics":true}'::jsonb,
	"is_complete" boolean DEFAULT false,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendor_onboarding_steps" (
	"id" varchar PRIMARY KEY DEFAULT 'gen_random_uuid()' NOT NULL,
	"profile_id" varchar NOT NULL,
	"step_name" varchar NOT NULL,
	"step_index" varchar NOT NULL,
	"is_completed" boolean DEFAULT false,
	"step_data" jsonb,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "custom_profiles" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "images" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "photo_sessions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "project_backups" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sessions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "timeline_events" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "gdpr_access_requests" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "gdpr_consents" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "gdpr_data_processing" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "privacy_policy_acceptance" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "project_completions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- DROP TABLE "custom_profiles" CASCADE;--> statement-breakpoint
-- DROP TABLE "images" CASCADE;--> statement-breakpoint
-- DROP TABLE "photo_sessions" CASCADE;--> statement-breakpoint
-- DROP TABLE "project_backups" CASCADE;--> statement-breakpoint
-- DROP TABLE "sessions" CASCADE;--> statement-breakpoint
-- DROP TABLE "timeline_events" CASCADE;--> statement-breakpoint
-- DROP TABLE "gdpr_access_requests" CASCADE;--> statement-breakpoint
-- DROP TABLE "gdpr_consents" CASCADE;--> statement-breakpoint
-- DROP TABLE "gdpr_data_processing" CASCADE;--> statement-breakpoint
-- DROP TABLE "privacy_policy_acceptance" CASCADE;--> statement-breakpoint
-- DROP TABLE "project_completions" CASCADE;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "name" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "status" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "status" SET DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "status" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "created_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "updated_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "admin_level" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "wedding_timelines" ALTER COLUMN "wedding_date" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "onboarding_profiles" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "onboarding_profiles" ALTER COLUMN "completed_steps" SET DATA TYPE text[] USING "completed_steps"::text[];--> statement-breakpoint
ALTER TABLE "onboarding_profiles" ALTER COLUMN "completed_steps" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "business_metrics" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "business_metrics" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "business_metrics" ALTER COLUMN "value" SET DATA TYPE numeric(15, 4) USING NULLIF(regexp_replace(("value")::text, '[^0-9.-]' , '' , 'g'), '' )::numeric(15,4);--> statement-breakpoint
ALTER TABLE "business_metrics" ALTER COLUMN "currency" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "business_metrics" ALTER COLUMN "currency" SET DEFAULT 'NOK';--> statement-breakpoint
ALTER TABLE "business_metrics" ALTER COLUMN "category" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "business_metrics" ALTER COLUMN "category" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "email_campaigns" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "email_campaigns" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "email_campaigns" ALTER COLUMN "name" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "email_campaigns" ALTER COLUMN "subject" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "email_campaigns" ALTER COLUMN "stats" SET DEFAULT '{"totalSent":0,"delivered":0,"opened":0,"clicked":0,"bounced":0,"unsubscribed":0}'::jsonb;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "client_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "project_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "invoice_number" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "currency" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "currency" SET DEFAULT 'NOK';--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "payment_terms" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "payment_terms" SET DEFAULT '30 dager';--> statement-breakpoint

--     "ALTER TABLE "memory_cards" ALTER COLUMN "id" TYPE integer USING "id"::integer; ".
  --> statement-breakpoint
ALTER TABLE "memory_cards" ALTER COLUMN "capacity" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "memory_cards" ALTER COLUMN "capacity" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "memory_cards" ALTER COLUMN "serial_number" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "memory_cards" ALTER COLUMN "backup_location" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "profession" varchar;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "original_filename" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profession" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "company_name" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "organization_number" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "business_address" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "website" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "vat_number" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" varchar DEFAULT 'user';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_login_at" timestamp;--> statement-breakpoint
ALTER TABLE "wedding_timelines" ADD COLUMN IF NOT EXISTS "project_id" varchar;--> statement-breakpoint
ALTER TABLE "wedding_timelines" ADD COLUMN IF NOT EXISTS "groom_name" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "wedding_timelines" ADD COLUMN IF NOT EXISTS "bride_name" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "onboarding_profiles" ADD COLUMN IF NOT EXISTS "profession" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "onboarding_profiles" ADD COLUMN IF NOT EXISTS "business_name" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "onboarding_profiles" ADD COLUMN IF NOT EXISTS "org_number" varchar;--> statement-breakpoint
ALTER TABLE "onboarding_profiles" ADD COLUMN IF NOT EXISTS "business_type" varchar;--> statement-breakpoint
ALTER TABLE "onboarding_profiles" ADD COLUMN IF NOT EXISTS "business_address" jsonb;--> statement-breakpoint
ALTER TABLE "onboarding_profiles" ADD COLUMN IF NOT EXISTS "primary_email" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "onboarding_profiles" ADD COLUMN IF NOT EXISTS "business_phone" varchar;--> statement-breakpoint
ALTER TABLE "onboarding_profiles" ADD COLUMN IF NOT EXISTS "website" varchar;--> statement-breakpoint
ALTER TABLE "onboarding_profiles" ADD COLUMN IF NOT EXISTS "social_media_links" jsonb;--> statement-breakpoint
ALTER TABLE "onboarding_profiles" ADD COLUMN IF NOT EXISTS "years_of_experience" integer;--> statement-breakpoint
ALTER TABLE "onboarding_profiles" ADD COLUMN IF NOT EXISTS "specialization" text[];--> statement-breakpoint
ALTER TABLE "onboarding_profiles" ADD COLUMN IF NOT EXISTS "team_size" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "onboarding_profiles" ADD COLUMN IF NOT EXISTS "average_projects_per_month" integer;--> statement-breakpoint
ALTER TABLE "onboarding_profiles" ADD COLUMN IF NOT EXISTS "annual_revenue" varchar;--> statement-breakpoint
ALTER TABLE "onboarding_profiles" ADD COLUMN IF NOT EXISTS "service_areas" text[];--> statement-breakpoint
ALTER TABLE "onboarding_profiles" ADD COLUMN IF NOT EXISTS "travel_radius" integer;--> statement-breakpoint
ALTER TABLE "onboarding_profiles" ADD COLUMN IF NOT EXISTS "home_studio_available" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "onboarding_profiles" ADD COLUMN IF NOT EXISTS "mobile_service_available" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "onboarding_profiles" ADD COLUMN IF NOT EXISTS "primary_equipment" jsonb;--> statement-breakpoint
ALTER TABLE "onboarding_profiles" ADD COLUMN IF NOT EXISTS "editing_software" text[];--> statement-breakpoint
ALTER TABLE "onboarding_profiles" ADD COLUMN IF NOT EXISTS "cloud_storage_providers" text[];--> statement-breakpoint
ALTER TABLE "onboarding_profiles" ADD COLUMN IF NOT EXISTS "backup_solutions" text[];--> statement-breakpoint
ALTER TABLE "onboarding_profiles" ADD COLUMN IF NOT EXISTS "current_challenges" text[];--> statement-breakpoint
ALTER TABLE "onboarding_profiles" ADD COLUMN IF NOT EXISTS "business_goals" text[];--> statement-breakpoint
ALTER TABLE "onboarding_profiles" ADD COLUMN IF NOT EXISTS "why_creator_hub" text;--> statement-breakpoint
ALTER TABLE "onboarding_profiles" ADD COLUMN IF NOT EXISTS "expected_benefits" text[];--> statement-breakpoint
ALTER TABLE "onboarding_profiles" ADD COLUMN IF NOT EXISTS "has_google_workspace" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "onboarding_profiles" ADD COLUMN IF NOT EXISTS "google_workspace_email" varchar;--> statement-breakpoint
ALTER TABLE "onboarding_profiles" ADD COLUMN IF NOT EXISTS "google_drive_usage" varchar;--> statement-breakpoint
ALTER TABLE "onboarding_profiles" ADD COLUMN IF NOT EXISTS "brreg_verified" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "onboarding_profiles" ADD COLUMN IF NOT EXISTS "brreg_data" jsonb;--> statement-breakpoint
ALTER TABLE "onboarding_profiles" ADD COLUMN IF NOT EXISTS "brreg_last_checked" timestamp;--> statement-breakpoint
ALTER TABLE "onboarding_profiles" ADD COLUMN IF NOT EXISTS "completion_status" varchar DEFAULT 'started';--> statement-breakpoint
ALTER TABLE "onboarding_profiles" ADD COLUMN IF NOT EXISTS "current_step" varchar;--> statement-breakpoint
ALTER TABLE "onboarding_profiles" ADD COLUMN IF NOT EXISTS "onboarding_notes" text;--> statement-breakpoint
ALTER TABLE "onboarding_profiles" ADD COLUMN IF NOT EXISTS "dashboard_configured" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "onboarding_profiles" ADD COLUMN IF NOT EXISTS "integrations_setup" jsonb DEFAULT '{"googleDrive":false,"googlePhotos":false,"googleCalendar":false,"youtube":false,"stripe":false}'::jsonb;--> statement-breakpoint
ALTER TABLE "onboarding_profiles" ADD COLUMN IF NOT EXISTS "demo_mode" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "onboarding_profiles" ADD COLUMN IF NOT EXISTS "completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "metric_name" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "period_type" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "period_start" timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "period_end" timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "fiscal_year" integer;--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "fiscal_quarter" integer;--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "previous_value" numeric(15, 4);--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "target_value" numeric(15, 4);--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "benchmark_value" numeric(15, 4);--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "unit" varchar;--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "is_percentage" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "is_ratio" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "change_from_previous" numeric(15, 4);--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "change_percentage" numeric(8, 4);--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "trend_direction" varchar;--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "performance_rating" varchar;--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "profession" varchar;--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "business_segment" varchar;--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "service_type" varchar;--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "client_type" varchar;--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "revenue_breakdown" jsonb;--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "cost_breakdown" jsonb;--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "customer_metrics" jsonb;--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "project_metrics" jsonb;--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "time_metrics" jsonb;--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "marketing_metrics" jsonb;--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "quality_metrics" jsonb;--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "resource_metrics" jsonb;--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "geographic_data" jsonb;--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "risk_metrics" jsonb;--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "growth_metrics" jsonb;--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "data_sources" text[];--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "calculation_method" text;--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "calculation_formula" text;--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "data_quality" varchar DEFAULT 'high';--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "confidence_level" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "is_automated" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "update_frequency" varchar;--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "last_calculated" timestamp;--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "next_calculation" timestamp;--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "has_thresholds" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "thresholds" jsonb;--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "alerts_triggered" text[];--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "chart_type" varchar;--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "is_public" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "included_in_reports" text[];--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "dashboard_position" integer;--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "norwegian_specific" jsonb;--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "industry_benchmark" numeric(15, 4);--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "peer_comparison" varchar;--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "industry_percentile" integer;--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "analysis_notes" text;--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "action_items" text[];--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "improvement_opportunities" text[];--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "is_latest" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "calculated_by" varchar;--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "verified_by" varchar;--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "business_metrics" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "email_campaigns" ADD COLUMN IF NOT EXISTS "template_id" varchar;--> statement-breakpoint
ALTER TABLE "email_campaigns" ADD COLUMN IF NOT EXISTS "campaign_type" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "email_campaigns" ADD COLUMN IF NOT EXISTS "recipient_list" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "invoice_date" date NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "total_amount" numeric(10, 2) NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "payment_method" varchar;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "client_notes" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "paid_at" timestamp;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "reminder_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "last_reminder_sent" timestamp;--> statement-breakpoint
ALTER TABLE "memory_cards" ADD COLUMN IF NOT EXISTS "card_id" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "memory_cards" ADD COLUMN IF NOT EXISTS "session_id" integer;--> statement-breakpoint
ALTER TABLE "memory_cards" ADD COLUMN IF NOT EXISTS "card_label" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "memory_cards" ADD COLUMN IF NOT EXISTS "day_number" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "memory_cards" ADD COLUMN IF NOT EXISTS "card_type" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "memory_cards" ADD COLUMN IF NOT EXISTS "file_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "memory_cards" ADD COLUMN IF NOT EXISTS "total_size" bigint DEFAULT 0;--> statement-breakpoint
ALTER TABLE "memory_cards" ADD COLUMN IF NOT EXISTS "file_types" jsonb;--> statement-breakpoint
ALTER TABLE "memory_cards" ADD COLUMN IF NOT EXISTS "drive_folder_id" varchar;--> statement-breakpoint
ALTER TABLE "memory_cards" ADD COLUMN IF NOT EXISTS "uploaded_files" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "memory_cards" ADD COLUMN IF NOT EXISTS "upload_progress" numeric(5, 2) DEFAULT 0;--> statement-breakpoint
ALTER TABLE "memory_cards" ADD COLUMN IF NOT EXISTS "backup_status" varchar DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "memory_cards" ADD COLUMN IF NOT EXISTS "backup_verified" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "memory_cards" ADD COLUMN IF NOT EXISTS "is_formatted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "memory_cards" ADD COLUMN IF NOT EXISTS "format_time" timestamp;--> statement-breakpoint
ALTER TABLE "memory_cards" ADD COLUMN IF NOT EXISTS "last_used_date" timestamp;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'admin_notifications_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "admin_notifications" ADD CONSTRAINT "admin_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'advanced_email_templates_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "advanced_email_templates" ADD CONSTRAINT "advanced_email_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'analytics_reports_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "analytics_reports" ADD CONSTRAINT "analytics_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'api_integration_logs_process_id_api_integration_processes_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "api_integration_logs" ADD CONSTRAINT "api_integration_logs_process_id_api_integration_processes_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."api_integration_processes"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'audio_enhancements_audio_project_id_audio_projects_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "audio_enhancements" ADD CONSTRAINT "audio_enhancements_audio_project_id_audio_projects_id_fk" FOREIGN KEY ("audio_project_id") REFERENCES "public"."audio_projects"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'audio_enhancements_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "audio_enhancements" ADD CONSTRAINT "audio_enhancements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'audio_projects_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "audio_projects" ADD CONSTRAINT "audio_projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'automation_rules_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'backups_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "backups" ADD CONSTRAINT "backups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'brreg_data_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "brreg_data" ADD CONSTRAINT "brreg_data_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'calendar_events_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'calendar_events_project_id_projects_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'client_communications_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "client_communications" ADD CONSTRAINT "client_communications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'client_feedbacks_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "client_feedbacks" ADD CONSTRAINT "client_feedbacks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'client_feedbacks_project_id_projects_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "client_feedbacks" ADD CONSTRAINT "client_feedbacks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'client_galleries_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "client_galleries" ADD CONSTRAINT "client_galleries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'client_galleries_project_id_projects_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "client_galleries" ADD CONSTRAINT "client_galleries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'client_onboarding_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "client_onboarding" ADD CONSTRAINT "client_onboarding_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'cms_components_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "cms_components" ADD CONSTRAINT "cms_components_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'cms_history_page_id_cms_pages_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "cms_history" ADD CONSTRAINT "cms_history_page_id_cms_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."cms_pages"("id") ON DELETE cascade ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'cms_history_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "cms_history" ADD CONSTRAINT "cms_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'cms_pages_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "cms_pages" ADD CONSTRAINT "cms_pages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'competitor_analysis_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "competitor_analysis" ADD CONSTRAINT "competitor_analysis_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'contract_archive_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "contract_archive" ADD CONSTRAINT "contract_archive_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'contract_templates_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "contract_templates" ADD CONSTRAINT "contract_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'contracts_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "contracts" ADD CONSTRAINT "contracts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'custom_roles_created_by_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "custom_roles" ADD CONSTRAINT "custom_roles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'customer_signatures_contract_id_contracts_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "customer_signatures" ADD CONSTRAINT "customer_signatures_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'documents_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'documents_project_id_projects_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "documents" ADD CONSTRAINT "documents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'drone_flight_logs_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "drone_flight_logs" ADD CONSTRAINT "drone_flight_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'drone_flight_logs_project_id_projects_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "drone_flight_logs" ADD CONSTRAINT "drone_flight_logs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'editing_workflows_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "editing_workflows" ADD CONSTRAINT "editing_workflows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'editing_workflows_project_id_projects_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "editing_workflows" ADD CONSTRAINT "editing_workflows_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'email_project_associations_project_id_client_submissions_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "email_project_associations" ADD CONSTRAINT "email_project_associations_project_id_client_submissions_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."client_submissions"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'email_templates_photographer_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_photographer_id_users_id_fk" FOREIGN KEY ("photographer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'equipment_maintenance_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "equipment_maintenance" ADD CONSTRAINT "equipment_maintenance_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'equipment_rentals_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "equipment_rentals" ADD CONSTRAINT "equipment_rentals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'equipment_rentals_project_id_projects_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "equipment_rentals" ADD CONSTRAINT "equipment_rentals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'expenses_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "expenses" ADD CONSTRAINT "expenses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'expenses_project_id_projects_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "expenses" ADD CONSTRAINT "expenses_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'file_sync_jobs_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "file_sync_jobs" ADD CONSTRAINT "file_sync_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'generated_contracts_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "generated_contracts" ADD CONSTRAINT "generated_contracts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'generated_contracts_project_id_projects_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "generated_contracts" ADD CONSTRAINT "generated_contracts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'generated_contracts_template_id_contract_templates_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "generated_contracts" ADD CONSTRAINT "generated_contracts_template_id_contract_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."contract_templates"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'google_drive_files_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "google_drive_files" ADD CONSTRAINT "google_drive_files_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'invite_requests_processed_by_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "invite_requests" ADD CONSTRAINT "invite_requests_processed_by_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'invite_requests_registered_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "invite_requests" ADD CONSTRAINT "invite_requests_registered_user_id_users_id_fk" FOREIGN KEY ("registered_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'leads_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "leads" ADD CONSTRAINT "leads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'lighting_setups_project_id_projects_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "lighting_setups" ADD CONSTRAINT "lighting_setups_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'location_scouts_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "location_scouts" ADD CONSTRAINT "location_scouts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'location_scouts_project_id_projects_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "location_scouts" ADD CONSTRAINT "location_scouts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'marketing_campaigns_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'meeting_activities_workspace_id_meeting_workspaces_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "meeting_activities" ADD CONSTRAINT "meeting_activities_workspace_id_meeting_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."meeting_workspaces"("id") ON DELETE cascade ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'meeting_attachments_meeting_notes_id_meeting_notes_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "meeting_attachments" ADD CONSTRAINT "meeting_attachments_meeting_notes_id_meeting_notes_id_fk" FOREIGN KEY ("meeting_notes_id") REFERENCES "public"."meeting_notes"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'meeting_notes_wedding_timeline_id_wedding_timelines_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "meeting_notes" ADD CONSTRAINT "meeting_notes_wedding_timeline_id_wedding_timelines_id_fk" FOREIGN KEY ("wedding_timeline_id") REFERENCES "public"."wedding_timelines"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'meeting_participants_workspace_id_meeting_workspaces_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "meeting_participants" ADD CONSTRAINT "meeting_participants_workspace_id_meeting_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."meeting_workspaces"("id") ON DELETE cascade ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'meeting_sessions_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "meeting_sessions" ADD CONSTRAINT "meeting_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'meeting_sessions_project_id_projects_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "meeting_sessions" ADD CONSTRAINT "meeting_sessions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'notifications_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'payments_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'payments_invoice_id_invoices_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'payments_project_id_projects_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "payments" ADD CONSTRAINT "payments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'performance_metrics_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "performance_metrics" ADD CONSTRAINT "performance_metrics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'photo_flash_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "photo_flash" ADD CONSTRAINT "photo_flash_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'portfolio_projects_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "portfolio_projects" ADD CONSTRAINT "portfolio_projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'preset_suggestions_suggested_preset_id_project_presets_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "preset_suggestions" ADD CONSTRAINT "preset_suggestions_suggested_preset_id_project_presets_id_fk" FOREIGN KEY ("suggested_preset_id") REFERENCES "public"."project_presets"("id") ON DELETE cascade ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'preset_usage_history_preset_id_project_presets_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "preset_usage_history" ADD CONSTRAINT "preset_usage_history_preset_id_project_presets_id_fk" FOREIGN KEY ("preset_id") REFERENCES "public"."project_presets"("id") ON DELETE cascade ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'print_orders_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "print_orders" ADD CONSTRAINT "print_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'print_orders_project_id_projects_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "print_orders" ADD CONSTRAINT "print_orders_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'print_orders_gallery_id_client_galleries_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "print_orders" ADD CONSTRAINT "print_orders_gallery_id_client_galleries_id_fk" FOREIGN KEY ("gallery_id") REFERENCES "public"."client_galleries"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'project_draft_versions_draft_id_project_draft_autosave_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "project_draft_versions" ADD CONSTRAINT "project_draft_versions_draft_id_project_draft_autosave_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."project_draft_autosave"("id") ON DELETE cascade ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'project_emails_photographer_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "project_emails" ADD CONSTRAINT "project_emails_photographer_id_users_id_fk" FOREIGN KEY ("photographer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'project_financials_project_id_projects_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "project_financials" ADD CONSTRAINT "project_financials_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'project_financials_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "project_financials" ADD CONSTRAINT "project_financials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'project_milestones_project_id_projects_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'project_milestones_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'project_showcases_project_id_client_submissions_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "project_showcases" ADD CONSTRAINT "project_showcases_project_id_client_submissions_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."client_submissions"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'project_showcases_created_by_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "project_showcases" ADD CONSTRAINT "project_showcases_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'project_timelines_project_id_client_submissions_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "project_timelines" ADD CONSTRAINT "project_timelines_project_id_client_submissions_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."client_submissions"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'project_timelines_assigned_to_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "project_timelines" ADD CONSTRAINT "project_timelines_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'project_timelines_created_by_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "project_timelines" ADD CONSTRAINT "project_timelines_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'rbac_audit_log_target_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "rbac_audit_log" ADD CONSTRAINT "rbac_audit_log_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'rbac_audit_log_performed_by_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "rbac_audit_log" ADD CONSTRAINT "rbac_audit_log_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'referral_program_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "referral_program" ADD CONSTRAINT "referral_program_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'referral_program_referred_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "referral_program" ADD CONSTRAINT "referral_program_referred_user_id_users_id_fk" FOREIGN KEY ("referred_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'role_features_role_id_custom_roles_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "role_features" ADD CONSTRAINT "role_features_role_id_custom_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."custom_roles"("id") ON DELETE cascade ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'role_features_feature_id_system_features_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "role_features" ADD CONSTRAINT "role_features_feature_id_system_features_id_fk" FOREIGN KEY ("feature_id") REFERENCES "public"."system_features"("id") ON DELETE cascade ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'role_features_granted_by_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "role_features" ADD CONSTRAINT "role_features_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'role_hierarchy_parent_role_id_custom_roles_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "role_hierarchy" ADD CONSTRAINT "role_hierarchy_parent_role_id_custom_roles_id_fk" FOREIGN KEY ("parent_role_id") REFERENCES "public"."custom_roles"("id") ON DELETE cascade ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'role_hierarchy_child_role_id_custom_roles_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "role_hierarchy" ADD CONSTRAINT "role_hierarchy_child_role_id_custom_roles_id_fk" FOREIGN KEY ("child_role_id") REFERENCES "public"."custom_roles"("id") ON DELETE cascade ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'shot_lists_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "shot_lists" ADD CONSTRAINT "shot_lists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'shot_lists_project_id_projects_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "shot_lists" ADD CONSTRAINT "shot_lists_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'showcase_categories_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "showcase_categories" ADD CONSTRAINT "showcase_categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'showcase_collections_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "showcase_collections" ADD CONSTRAINT "showcase_collections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'showcase_comments_showcase_item_id_showcase_items_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "showcase_comments" ADD CONSTRAINT "showcase_comments_showcase_item_id_showcase_items_id_fk" FOREIGN KEY ("showcase_item_id") REFERENCES "public"."showcase_items"("id") ON DELETE cascade ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'showcase_comments_parent_comment_id_showcase_comments_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "showcase_comments" ADD CONSTRAINT "showcase_comments_parent_comment_id_showcase_comments_id_fk" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."showcase_comments"("id") ON DELETE set null ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'showcase_content_items_showcase_drive_sync_id_showcase_drive_sync_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "showcase_content_items" ADD CONSTRAINT "showcase_content_items_showcase_drive_sync_id_showcase_drive_sync_id_fk" FOREIGN KEY ("showcase_drive_sync_id") REFERENCES "public"."showcase_drive_sync"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'showcase_content_items_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "showcase_content_items" ADD CONSTRAINT "showcase_content_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'showcase_drive_sync_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "showcase_drive_sync" ADD CONSTRAINT "showcase_drive_sync_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'showcase_interactions_showcase_item_id_showcase_items_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "showcase_interactions" ADD CONSTRAINT "showcase_interactions_showcase_item_id_showcase_items_id_fk" FOREIGN KEY ("showcase_item_id") REFERENCES "public"."showcase_items"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'showcase_items_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "showcase_items" ADD CONSTRAINT "showcase_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'showcase_items_project_id_projects_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "showcase_items" ADD CONSTRAINT "showcase_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'showcase_settings_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "showcase_settings" ADD CONSTRAINT "showcase_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'showcase_templates_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "showcase_templates" ADD CONSTRAINT "showcase_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'sign_requests_contract_id_contracts_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "sign_requests" ADD CONSTRAINT "sign_requests_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'social_media_posts_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "social_media_posts" ADD CONSTRAINT "social_media_posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'social_media_posts_project_id_projects_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "social_media_posts" ADD CONSTRAINT "social_media_posts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'standard_folder_structures_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "standard_folder_structures" ADD CONSTRAINT "standard_folder_structures_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'subcontractor_projects_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "subcontractor_projects" ADD CONSTRAINT "subcontractor_projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'subcontractor_projects_project_id_projects_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "subcontractor_projects" ADD CONSTRAINT "subcontractor_projects_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'subcontractor_projects_vendor_id_vendors_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "subcontractor_projects" ADD CONSTRAINT "subcontractor_projects_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'submission_follow_ups_submission_id_client_submissions_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "submission_follow_ups" ADD CONSTRAINT "submission_follow_ups_submission_id_client_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."client_submissions"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'subscriptions_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'tasks_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'tasks_project_id_projects_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'tasks_parent_task_id_tasks_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_task_id_tasks_id_fk" FOREIGN KEY ("parent_task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'tax_calculations_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "tax_calculations" ADD CONSTRAINT "tax_calculations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'tax_calculations_invoice_id_invoices_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "tax_calculations" ADD CONSTRAINT "tax_calculations_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'time_entries_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'time_entries_project_id_projects_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'time_entries_task_id_tasks_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'travel_expenses_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "travel_expenses" ADD CONSTRAINT "travel_expenses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'travel_expenses_project_id_projects_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "travel_expenses" ADD CONSTRAINT "travel_expenses_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'user_activity_logs_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "user_activity_logs" ADD CONSTRAINT "user_activity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'user_permission_overrides_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "user_permission_overrides_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'user_permission_overrides_feature_id_system_features_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "user_permission_overrides_feature_id_system_features_id_fk" FOREIGN KEY ("feature_id") REFERENCES "public"."system_features"("id") ON DELETE cascade ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'user_permission_overrides_overridden_by_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "user_permission_overrides_overridden_by_users_id_fk" FOREIGN KEY ("overridden_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'user_roles_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'user_roles_role_id_custom_roles_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_custom_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."custom_roles"("id") ON DELETE cascade ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'user_roles_assigned_by_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'vendors_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "vendors" ADD CONSTRAINT "vendors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'video_lights_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "video_lights" ADD CONSTRAINT "video_lights_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'weather_data_project_id_projects_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "weather_data" ADD CONSTRAINT "weather_data_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'weather_data_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "weather_data" ADD CONSTRAINT "weather_data_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'wedding_details_project_id_projects_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "wedding_details" ADD CONSTRAINT "wedding_details_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'wedding_details_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "wedding_details" ADD CONSTRAINT "wedding_details_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'wedding_timeline_client_settings_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "wedding_timeline_client_settings" ADD CONSTRAINT "wedding_timeline_client_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'wedding_timeline_client_settings_project_id_projects_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "wedding_timeline_client_settings" ADD CONSTRAINT "wedding_timeline_client_settings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'backup_logs_session_id_memory_card_sessions_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "backup_logs" ADD CONSTRAINT "backup_logs_session_id_memory_card_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."memory_card_sessions"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'backup_logs_card_id_memory_cards_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "backup_logs" ADD CONSTRAINT "backup_logs_card_id_memory_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."memory_cards"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'equipment_models_brand_id_equipment_brands_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "equipment_models" ADD CONSTRAINT "equipment_models_brand_id_equipment_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."equipment_brands"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'keyboard_shortcuts_software_id_editing_software_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "keyboard_shortcuts" ADD CONSTRAINT "keyboard_shortcuts_software_id_editing_software_id_fk" FOREIGN KEY ("software_id") REFERENCES "public"."editing_software"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'user_shortcut_preferences_software_id_editing_software_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "user_shortcut_preferences" ADD CONSTRAINT "user_shortcut_preferences_software_id_editing_software_id_fk" FOREIGN KEY ("software_id") REFERENCES "public"."editing_software"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'communication_integrations_channel_id_communication_channels_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "communication_integrations" ADD CONSTRAINT "communication_integrations_channel_id_communication_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."communication_channels"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'communication_messages_channel_id_communication_channels_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "communication_messages" ADD CONSTRAINT "communication_messages_channel_id_communication_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."communication_channels"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'communication_messages_parent_message_id_communication_messages_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "communication_messages" ADD CONSTRAINT "communication_messages_parent_message_id_communication_messages_id_fk" FOREIGN KEY ("parent_message_id") REFERENCES "public"."communication_messages"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'communication_participants_channel_id_communication_channels_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "communication_participants" ADD CONSTRAINT "communication_participants_channel_id_communication_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."communication_channels"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'message_attachments_message_id_communication_messages_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_message_id_communication_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."communication_messages"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'message_reactions_message_id_communication_messages_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_message_id_communication_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."communication_messages"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'hour_overages_project_id_integrated_projects_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "hour_overages" ADD CONSTRAINT "hour_overages_project_id_integrated_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."integrated_projects"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'hour_overages_contract_id_project_contracts_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "hour_overages" ADD CONSTRAINT "hour_overages_contract_id_project_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."project_contracts"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'project_contracts_project_id_integrated_projects_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "project_contracts" ADD CONSTRAINT "project_contracts_project_id_integrated_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."integrated_projects"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'project_time_tracking_project_id_integrated_projects_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "project_time_tracking" ADD CONSTRAINT "project_time_tracking_project_id_integrated_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."integrated_projects"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'wedding_timeline_integration_project_id_integrated_projects_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "wedding_timeline_integration" ADD CONSTRAINT "wedding_timeline_integration_project_id_integrated_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."integrated_projects"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'sales_activities_lead_id_sales_leads_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "sales_activities" ADD CONSTRAINT "sales_activities_lead_id_sales_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."sales_leads"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'sales_activities_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "sales_activities" ADD CONSTRAINT "sales_activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'sales_analytics_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "sales_analytics" ADD CONSTRAINT "sales_analytics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'sales_conversations_lead_id_sales_leads_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "sales_conversations" ADD CONSTRAINT "sales_conversations_lead_id_sales_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."sales_leads"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'sales_conversations_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "sales_conversations" ADD CONSTRAINT "sales_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'sales_leads_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "sales_leads" ADD CONSTRAINT "sales_leads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'sales_voice_notes_lead_id_sales_leads_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "sales_voice_notes" ADD CONSTRAINT "sales_voice_notes_lead_id_sales_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."sales_leads"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'sales_voice_notes_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "sales_voice_notes" ADD CONSTRAINT "sales_voice_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'product_compatibility_product_id_products_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "product_compatibility" ADD CONSTRAINT "product_compatibility_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'product_compatibility_compatible_with_product_id_products_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "product_compatibility" ADD CONSTRAINT "product_compatibility_compatible_with_product_id_products_id_fk" FOREIGN KEY ("compatible_with_product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'product_firmware_product_id_products_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "product_firmware" ADD CONSTRAINT "product_firmware_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'product_images_product_id_products_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'product_prices_product_id_products_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'product_tags_product_id_products_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "product_tags" ADD CONSTRAINT "product_tags_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'product_tags_tag_id_tags_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "product_tags" ADD CONSTRAINT "product_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'service_activations_subscription_id_user_subscriptions_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "service_activations" ADD CONSTRAINT "service_activations_subscription_id_user_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."user_subscriptions"("id") ON DELETE set null ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'subscription_change_history_subscription_id_user_subscriptions_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "subscription_change_history" ADD CONSTRAINT "subscription_change_history_subscription_id_user_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."user_subscriptions"("id") ON DELETE cascade ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'trial_notifications_subscription_id_user_subscriptions_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "trial_notifications" ADD CONSTRAINT "trial_notifications_subscription_id_user_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."user_subscriptions"("id") ON DELETE cascade ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'trial_usage_tracking_subscription_id_user_subscriptions_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "trial_usage_tracking" ADD CONSTRAINT "trial_usage_tracking_subscription_id_user_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."user_subscriptions"("id") ON DELETE cascade ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'google_pay_billing_issues_google_pay_subscription_id_google_pay_subscriptions_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "google_pay_billing_issues" ADD CONSTRAINT "google_pay_billing_issues_google_pay_subscription_id_google_pay_subscriptions_id_fk" FOREIGN KEY ("google_pay_subscription_id") REFERENCES "public"."google_pay_subscriptions"("id") ON DELETE cascade ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'google_pay_transactions_google_pay_subscription_id_google_pay_subscriptions_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "google_pay_transactions" ADD CONSTRAINT "google_pay_transactions_google_pay_subscription_id_google_pay_subscriptions_id_fk" FOREIGN KEY ("google_pay_subscription_id") REFERENCES "public"."google_pay_subscriptions"("id") ON DELETE cascade ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'client_selections_session_id_client_gallery_sessions_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "client_selections" ADD CONSTRAINT "client_selections_session_id_client_gallery_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."client_gallery_sessions"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'client_selections_showcase_item_id_showcase_items_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "client_selections" ADD CONSTRAINT "client_selections_showcase_item_id_showcase_items_id_fk" FOREIGN KEY ("showcase_item_id") REFERENCES "public"."showcase_items"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'session_activity_log_session_id_client_gallery_sessions_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "session_activity_log" ADD CONSTRAINT "session_activity_log_session_id_client_gallery_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."client_gallery_sessions"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'session_notifications_session_id_client_gallery_sessions_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "session_notifications" ADD CONSTRAINT "session_notifications_session_id_client_gallery_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."client_gallery_sessions"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'showcase_analytics_showcase_item_id_showcase_items_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "showcase_analytics" ADD CONSTRAINT "showcase_analytics_showcase_item_id_showcase_items_id_fk" FOREIGN KEY ("showcase_item_id") REFERENCES "public"."showcase_items"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'showcase_analytics_configuration_id_showcase_configurations_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "showcase_analytics" ADD CONSTRAINT "showcase_analytics_configuration_id_showcase_configurations_id_fk" FOREIGN KEY ("configuration_id") REFERENCES "public"."showcase_configurations"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'smart_album_items_album_id_smart_albums_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "smart_album_items" ADD CONSTRAINT "smart_album_items_album_id_smart_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."smart_albums"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'smart_album_items_showcase_item_id_showcase_items_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "smart_album_items" ADD CONSTRAINT "smart_album_items_showcase_item_id_showcase_items_id_fk" FOREIGN KEY ("showcase_item_id") REFERENCES "public"."showcase_items"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'ai_content_generations_step_id_journey_steps_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "ai_content_generations" ADD CONSTRAINT "ai_content_generations_step_id_journey_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."journey_steps"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'journey_analytics_template_id_customer_journey_templates_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "journey_analytics" ADD CONSTRAINT "journey_analytics_template_id_customer_journey_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."customer_journey_templates"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'journey_analytics_step_id_journey_steps_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "journey_analytics" ADD CONSTRAINT "journey_analytics_step_id_journey_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."journey_steps"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'journey_steps_template_id_customer_journey_templates_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "journey_steps" ADD CONSTRAINT "journey_steps_template_id_customer_journey_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."customer_journey_templates"("id") ON DELETE cascade ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'profession_component_mappings_component_id_interactive_components_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "profession_component_mappings" ADD CONSTRAINT "profession_component_mappings_component_id_interactive_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."interactive_components"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'google_chat_invitations_space_id_google_chat_spaces_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "google_chat_invitations" ADD CONSTRAINT "google_chat_invitations_space_id_google_chat_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."google_chat_spaces"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'google_chat_notifications_space_id_google_chat_spaces_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "google_chat_notifications" ADD CONSTRAINT "google_chat_notifications_space_id_google_chat_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."google_chat_spaces"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'google_chat_space_members_space_id_google_chat_spaces_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "google_chat_space_members" ADD CONSTRAINT "google_chat_space_members_space_id_google_chat_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."google_chat_spaces"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'draft_versions_draft_id_page_drafts_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "draft_versions" ADD CONSTRAINT "draft_versions_draft_id_page_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."page_drafts"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'page_drafts_page_id_cms_pages_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "page_drafts" ADD CONSTRAINT "page_drafts_page_id_cms_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."cms_pages"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'page_versions_page_id_cms_pages_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "page_versions" ADD CONSTRAINT "page_versions_page_id_cms_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."cms_pages"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'workflow_states_page_id_cms_pages_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "workflow_states" ADD CONSTRAINT "workflow_states_page_id_cms_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."cms_pages"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'processed_files_config_id_auto_monitor_configs_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "processed_files" ADD CONSTRAINT "processed_files_config_id_auto_monitor_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."auto_monitor_configs"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'processed_files_story_arc_project_id_story_arc_projects_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "processed_files" ADD CONSTRAINT "processed_files_story_arc_project_id_story_arc_projects_id_fk" FOREIGN KEY ("story_arc_project_id") REFERENCES "public"."story_arc_projects"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'automated_test_suites_template_id_code_templates_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "automated_test_suites" ADD CONSTRAINT "automated_test_suites_template_id_code_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."code_templates"("id") ON DELETE cascade ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'code_analysis_results_generated_code_id_generated_code_history_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "code_analysis_results" ADD CONSTRAINT "code_analysis_results_generated_code_id_generated_code_history_id_fk" FOREIGN KEY ("generated_code_id") REFERENCES "public"."generated_code_history"("id") ON DELETE cascade ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'generated_code_history_template_id_code_templates_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "generated_code_history" ADD CONSTRAINT "generated_code_history_template_id_code_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."code_templates"("id") ON DELETE cascade ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'live_test_results_generated_code_id_generated_code_history_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "live_test_results" ADD CONSTRAINT "live_test_results_generated_code_id_generated_code_history_id_fk" FOREIGN KEY ("generated_code_id") REFERENCES "public"."generated_code_history"("id") ON DELETE cascade ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'template_analytics_template_id_code_templates_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "template_analytics" ADD CONSTRAINT "template_analytics_template_id_code_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."code_templates"("id") ON DELETE cascade ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'prototype_feedback_user_id_idx' AND n.nspname = 'public') THEN CREATE INDEX "prototype_feedback_user_id_idx" ON "prototype_feedback" USING btree ("user_id"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'prototype_feedback_status_idx' AND n.nspname = 'public') THEN CREATE INDEX "prototype_feedback_status_idx" ON "prototype_feedback" USING btree ("status"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'prototype_feedback_priority_idx' AND n.nspname = 'public') THEN CREATE INDEX "prototype_feedback_priority_idx" ON "prototype_feedback" USING btree ("priority"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'prototype_feedback_created_at_idx' AND n.nspname = 'public') THEN CREATE INDEX "prototype_feedback_created_at_idx" ON "prototype_feedback" USING btree ("created_at"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_music_producer_plugins_user_id' AND n.nspname = 'public') THEN CREATE INDEX "idx_music_producer_plugins_user_id" ON "music_producer_plugins" USING btree ("user_id"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_music_producer_plugins_category' AND n.nspname = 'public') THEN CREATE INDEX "idx_music_producer_plugins_category" ON "music_producer_plugins" USING btree ("category"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_music_producer_plugins_primary' AND n.nspname = 'public') THEN CREATE INDEX "idx_music_producer_plugins_primary" ON "music_producer_plugins" USING btree ("is_primary"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_plugin_licenses_user_id' AND n.nspname = 'public') THEN CREATE INDEX "idx_plugin_licenses_user_id" ON "plugin_licenses" USING btree ("user_id"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_plugin_licenses_plugin_id' AND n.nspname = 'public') THEN CREATE INDEX "idx_plugin_licenses_plugin_id" ON "plugin_licenses" USING btree ("plugin_id"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_plugin_licenses_expiry' AND n.nspname = 'public') THEN CREATE INDEX "idx_plugin_licenses_expiry" ON "plugin_licenses" USING btree ("expiry_date"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_plugin_licenses_vendor' AND n.nspname = 'public') THEN CREATE INDEX "idx_plugin_licenses_vendor" ON "plugin_licenses" USING btree ("vendor"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_plugin_notifications_user_id' AND n.nspname = 'public') THEN CREATE INDEX "idx_plugin_notifications_user_id" ON "plugin_notifications" USING btree ("user_id"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_plugin_notifications_type' AND n.nspname = 'public') THEN CREATE INDEX "idx_plugin_notifications_type" ON "plugin_notifications" USING btree ("type"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_plugin_notifications_read' AND n.nspname = 'public') THEN CREATE INDEX "idx_plugin_notifications_read" ON "plugin_notifications" USING btree ("is_read"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_plugin_notifications_severity' AND n.nspname = 'public') THEN CREATE INDEX "idx_plugin_notifications_severity" ON "plugin_notifications" USING btree ("severity"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_plugin_updates_user_id' AND n.nspname = 'public') THEN CREATE INDEX "idx_plugin_updates_user_id" ON "plugin_updates" USING btree ("user_id"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_plugin_updates_plugin_id' AND n.nspname = 'public') THEN CREATE INDEX "idx_plugin_updates_plugin_id" ON "plugin_updates" USING btree ("plugin_id"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_plugin_updates_status' AND n.nspname = 'public') THEN CREATE INDEX "idx_plugin_updates_status" ON "plugin_updates" USING btree ("status"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_plugin_updates_date' AND n.nspname = 'public') THEN CREATE INDEX "idx_plugin_updates_date" ON "plugin_updates" USING btree ("update_date"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_plugin_vendor_accounts_user_id' AND n.nspname = 'public') THEN CREATE INDEX "idx_plugin_vendor_accounts_user_id" ON "plugin_vendor_accounts" USING btree ("user_id"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_plugin_vendor_accounts_vendor' AND n.nspname = 'public') THEN CREATE INDEX "idx_plugin_vendor_accounts_vendor" ON "plugin_vendor_accounts" USING btree ("vendor"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_plugin_vendor_accounts_connected' AND n.nspname = 'public') THEN CREATE INDEX "idx_plugin_vendor_accounts_connected" ON "plugin_vendor_accounts" USING btree ("is_connected"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_vendor_downloads_product_id' AND n.nspname = 'public') THEN CREATE INDEX "idx_vendor_downloads_product_id" ON "vendor_product_downloads" USING btree ("product_id"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_vendor_downloads_user_id' AND n.nspname = 'public') THEN CREATE INDEX "idx_vendor_downloads_user_id" ON "vendor_product_downloads" USING btree ("user_id"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_vendor_downloads_date' AND n.nspname = 'public') THEN CREATE INDEX "idx_vendor_downloads_date" ON "vendor_product_downloads" USING btree ("download_date"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_vendor_downloads_completed' AND n.nspname = 'public') THEN CREATE INDEX "idx_vendor_downloads_completed" ON "vendor_product_downloads" USING btree ("completed"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_vendor_reviews_product_id' AND n.nspname = 'public') THEN CREATE INDEX "idx_vendor_reviews_product_id" ON "vendor_product_reviews" USING btree ("product_id"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_vendor_reviews_user_id' AND n.nspname = 'public') THEN CREATE INDEX "idx_vendor_reviews_user_id" ON "vendor_product_reviews" USING btree ("user_id"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_vendor_reviews_rating' AND n.nspname = 'public') THEN CREATE INDEX "idx_vendor_reviews_rating" ON "vendor_product_reviews" USING btree ("rating"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_vendor_reviews_verified' AND n.nspname = 'public') THEN CREATE INDEX "idx_vendor_reviews_verified" ON "vendor_product_reviews" USING btree ("verified"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_vendor_showcase_vendor_id' AND n.nspname = 'public') THEN CREATE INDEX "idx_vendor_showcase_vendor_id" ON "vendor_showcase_products" USING btree ("vendor_id"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_vendor_showcase_product_type' AND n.nspname = 'public') THEN CREATE INDEX "idx_vendor_showcase_product_type" ON "vendor_showcase_products" USING btree ("product_type"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_vendor_showcase_stats_vendor_id' AND n.nspname = 'public') THEN CREATE INDEX "idx_vendor_showcase_stats_vendor_id" ON "vendor_showcase_stats" USING btree ("vendor_id"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_vendor_showcase_stats_score' AND n.nspname = 'public') THEN CREATE INDEX "idx_vendor_showcase_stats_score" ON "vendor_showcase_stats" USING btree ("popularity_score"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_vendor_showcase_stats_revenue' AND n.nspname = 'public') THEN CREATE INDEX "idx_vendor_showcase_stats_revenue" ON "vendor_showcase_stats" USING btree ("total_revenue"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'google_integration_user_id_idx' AND n.nspname = 'public') THEN CREATE INDEX "google_integration_user_id_idx" ON "google_integration_settings" USING btree ("user_id"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'ocr_receipts_user_id_idx' AND n.nspname = 'public') THEN CREATE INDEX "ocr_receipts_user_id_idx" ON "ocr_receipts" USING btree ("user_id"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'ocr_receipts_receipt_id_idx' AND n.nspname = 'public') THEN CREATE INDEX "ocr_receipts_receipt_id_idx" ON "ocr_receipts" USING btree ("receipt_id"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'ocr_receipts_category_idx' AND n.nspname = 'public') THEN CREATE INDEX "ocr_receipts_category_idx" ON "ocr_receipts" USING btree ("category"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'ocr_receipts_month_year_idx' AND n.nspname = 'public') THEN CREATE INDEX "ocr_receipts_month_year_idx" ON "ocr_receipts" USING btree ("month_year"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'ocr_receipts_scanned_at_idx' AND n.nspname = 'public') THEN CREATE INDEX "ocr_receipts_scanned_at_idx" ON "ocr_receipts" USING btree ("scanned_at"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'packages_user_id_idx' AND n.nspname = 'public') THEN CREATE INDEX "packages_user_id_idx" ON "packages" USING btree ("user_id"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'packages_category_idx' AND n.nspname = 'public') THEN CREATE INDEX "packages_category_idx" ON "packages" USING btree ("category"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'packages_profession_idx' AND n.nspname = 'public') THEN CREATE INDEX "packages_profession_idx" ON "packages" USING btree ("profession"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'pricing_structures_user_id_idx' AND n.nspname = 'public') THEN CREATE INDEX "pricing_structures_user_id_idx" ON "pricing_structures" USING btree ("user_id"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'pricing_structures_category_idx' AND n.nspname = 'public') THEN CREATE INDEX "pricing_structures_category_idx" ON "pricing_structures" USING btree ("category"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'pricing_structures_profession_idx' AND n.nspname = 'public') THEN CREATE INDEX "pricing_structures_profession_idx" ON "pricing_structures" USING btree ("profession"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'travel_log_user_id_idx' AND n.nspname = 'public') THEN CREATE INDEX "travel_log_user_id_idx" ON "travel_log" USING btree ("user_id"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'travel_log_date_idx' AND n.nspname = 'public') THEN CREATE INDEX "travel_log_date_idx" ON "travel_log" USING btree ("date"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'travel_log_project_id_idx' AND n.nspname = 'public') THEN CREATE INDEX "travel_log_project_id_idx" ON "travel_log" USING btree ("project_id"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'auto_monitor_configs_user_id_idx' AND n.nspname = 'public') THEN CREATE INDEX "auto_monitor_configs_user_id_idx" ON "auto_monitor_configs" USING btree ("user_id"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'auto_monitor_configs_is_active_idx' AND n.nspname = 'public') THEN CREATE INDEX "auto_monitor_configs_is_active_idx" ON "auto_monitor_configs" USING btree ("is_active"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'auto_monitor_configs_monitor_folder_idx' AND n.nspname = 'public') THEN CREATE INDEX "auto_monitor_configs_monitor_folder_idx" ON "auto_monitor_configs" USING btree ("monitor_folder_name"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'content_analysis_cache_file_id_idx' AND n.nspname = 'public') THEN CREATE INDEX "content_analysis_cache_file_id_idx" ON "content_analysis_cache" USING btree ("file_id"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'content_analysis_cache_content_type_idx' AND n.nspname = 'public') THEN CREATE INDEX "content_analysis_cache_content_type_idx" ON "content_analysis_cache" USING btree ("content_type"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'content_analysis_cache_created_at_idx' AND n.nspname = 'public') THEN CREATE INDEX "content_analysis_cache_created_at_idx" ON "content_analysis_cache" USING btree ("created_at"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'content_analysis_cache_expires_at_idx' AND n.nspname = 'public') THEN CREATE INDEX "content_analysis_cache_expires_at_idx" ON "content_analysis_cache" USING btree ("expires_at"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'processed_files_user_id_idx' AND n.nspname = 'public') THEN CREATE INDEX "processed_files_user_id_idx" ON "processed_files" USING btree ("user_id"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'processed_files_config_id_idx' AND n.nspname = 'public') THEN CREATE INDEX "processed_files_config_id_idx" ON "processed_files" USING btree ("config_id"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'processed_files_file_id_idx' AND n.nspname = 'public') THEN CREATE INDEX "processed_files_file_id_idx" ON "processed_files" USING btree ("file_id"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'processed_files_processed_idx' AND n.nspname = 'public') THEN CREATE INDEX "processed_files_processed_idx" ON "processed_files" USING btree ("processed"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'processed_files_story_arc_project_id_idx' AND n.nspname = 'public') THEN CREATE INDEX "processed_files_story_arc_project_id_idx" ON "processed_files" USING btree ("story_arc_project_id"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'processed_files_uploaded_at_idx' AND n.nspname = 'public') THEN CREATE INDEX "processed_files_uploaded_at_idx" ON "processed_files" USING btree ("uploaded_at"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'story_arc_projects_user_id_idx' AND n.nspname = 'public') THEN CREATE INDEX "story_arc_projects_user_id_idx" ON "story_arc_projects" USING btree ("user_id"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'story_arc_projects_status_idx' AND n.nspname = 'public') THEN CREATE INDEX "story_arc_projects_status_idx" ON "story_arc_projects" USING btree ("status"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'story_arc_projects_template_type_idx' AND n.nspname = 'public') THEN CREATE INDEX "story_arc_projects_template_type_idx" ON "story_arc_projects" USING btree ("template_type"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'story_arc_projects_created_at_idx' AND n.nspname = 'public') THEN CREATE INDEX "story_arc_projects_created_at_idx" ON "story_arc_projects" USING btree ("created_at"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'story_arc_templates_content_type_idx' AND n.nspname = 'public') THEN CREATE INDEX "story_arc_templates_content_type_idx" ON "story_arc_templates" USING btree ("content_type"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'story_arc_templates_is_default_idx' AND n.nspname = 'public') THEN CREATE INDEX "story_arc_templates_is_default_idx" ON "story_arc_templates" USING btree ("is_default"); END IF; END \$;--> statement-breakpoint
DO \$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'story_arc_templates_is_active_idx' AND n.nspname = 'public') THEN CREATE INDEX "story_arc_templates_is_active_idx" ON "story_arc_templates" USING btree ("is_active"); END IF; END \$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'projects_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'wedding_timelines_project_id_projects_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "wedding_timelines" ADD CONSTRAINT "wedding_timelines_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'onboarding_profiles_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "onboarding_profiles" ADD CONSTRAINT "onboarding_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'business_metrics_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "business_metrics" ADD CONSTRAINT "business_metrics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'email_campaigns_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'email_campaigns_template_id_email_templates_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_template_id_email_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."email_templates"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'invoices_user_id_users_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'invoices_project_id_projects_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "invoices" ADD CONSTRAINT "invoices_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'memory_cards_session_id_memory_card_sessions_id_fk' AND n.nspname = 'public') THEN ALTER TABLE "memory_cards" ADD CONSTRAINT "memory_cards_session_id_memory_card_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."memory_card_sessions"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "client_name";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "google_drive_folder_id";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "google_drive_url";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "drive_backup_enabled";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "last_drive_sync";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "drive_backup_frequency";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "settings";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "metadata";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "user_type";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "seo_specialization";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "seo_permissions";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "business_name";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "norwegian_org_number";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "address";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "city";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "postal_code";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "country";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "dam_integration";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "onedrive_connected";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "norwegian_compliance";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "tono_gramo_tracking";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "gdpr_consent";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "microsoft_id";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "google_id";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "auth_provider";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "last_login";--> statement-breakpoint
ALTER TABLE "wedding_timelines" DROP COLUMN "client_email";--> statement-breakpoint
ALTER TABLE "wedding_timelines" DROP COLUMN "photographer_email";--> statement-breakpoint
ALTER TABLE "wedding_timelines" DROP COLUMN "bride_names";--> statement-breakpoint
ALTER TABLE "wedding_timelines" DROP COLUMN "groom_names";--> statement-breakpoint
ALTER TABLE "wedding_timelines" DROP COLUMN "bridesmaids";--> statement-breakpoint
ALTER TABLE "wedding_timelines" DROP COLUMN "groomsmen";--> statement-breakpoint
ALTER TABLE "wedding_timelines" DROP COLUMN "locations";--> statement-breakpoint
ALTER TABLE "wedding_timelines" DROP COLUMN "timeline_items";--> statement-breakpoint
ALTER TABLE "wedding_timelines" DROP COLUMN "is_locked";--> statement-breakpoint
ALTER TABLE "onboarding_profiles" DROP COLUMN "user_type";--> statement-breakpoint
ALTER TABLE "onboarding_profiles" DROP COLUMN "experience_level";--> statement-breakpoint
ALTER TABLE "onboarding_profiles" DROP COLUMN "learning_style";--> statement-breakpoint
ALTER TABLE "onboarding_profiles" DROP COLUMN "preferred_language";--> statement-breakpoint
ALTER TABLE "onboarding_profiles" DROP COLUMN "goals";--> statement-breakpoint
ALTER TABLE "onboarding_profiles" DROP COLUMN "current_path";--> statement-breakpoint
ALTER TABLE "onboarding_profiles" DROP COLUMN "personalized_recommendations";--> statement-breakpoint
ALTER TABLE "onboarding_profiles" DROP COLUMN "progress_data";--> statement-breakpoint
ALTER TABLE "business_metrics" DROP COLUMN "date";--> statement-breakpoint
ALTER TABLE "business_metrics" DROP COLUMN "metadata";--> statement-breakpoint
ALTER TABLE "email_campaigns" DROP COLUMN "content";--> statement-breakpoint
ALTER TABLE "email_campaigns" DROP COLUMN "template_type";--> statement-breakpoint
ALTER TABLE "email_campaigns" DROP COLUMN "recipients";--> statement-breakpoint
ALTER TABLE "email_campaigns" DROP COLUMN "open_rate";--> statement-breakpoint
ALTER TABLE "email_campaigns" DROP COLUMN "click_rate";--> statement-breakpoint
ALTER TABLE "invoices" DROP COLUMN "issue_date";--> statement-breakpoint
ALTER TABLE "invoices" DROP COLUMN "paid_date";--> statement-breakpoint
ALTER TABLE "invoices" DROP COLUMN "total";--> statement-breakpoint
-- ALTER TABLE "memory_cards" DROP COLUMN IF EXISTS "user_id";--> statement-breakpoint
-- ALTER TABLE "memory_cards" DROP COLUMN IF EXISTS "name";--> statement-breakpoint
-- ALTER TABLE "memory_cards" DROP COLUMN IF EXISTS "brand";--> statement-breakpoint
-- ALTER TABLE "memory_cards" DROP COLUMN IF EXISTS "type";--> statement-breakpoint
-- ALTER TABLE "memory_cards" DROP COLUMN IF EXISTS "speed";--> statement-breakpoint
-- ALTER TABLE "memory_cards" DROP COLUMN IF EXISTS "camera_manufacturer";--> statement-breakpoint
-- ALTER TABLE "memory_cards" DROP COLUMN IF EXISTS "camera_model";--> statement-breakpoint
-- ALTER TABLE "memory_cards" DROP COLUMN IF EXISTS "status";--> statement-breakpoint
-- ALTER TABLE "memory_cards" DROP COLUMN IF EXISTS "last_backup";--> statement-breakpoint
-- ALTER TABLE "memory_cards" DROP COLUMN IF EXISTS "health_status";--> statement-breakpoint
-- ALTER TABLE "memory_cards" DROP COLUMN IF EXISTS "usage_count";--> statement-breakpoint
-- ALTER TABLE "memory_cards" DROP COLUMN IF EXISTS "notes";--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'wedding_timelines_wedding_id_unique' AND n.nspname = 'public') THEN ALTER TABLE "wedding_timelines" ADD CONSTRAINT "wedding_timelines_wedding_id_unique" UNIQUE("wedding_id"); END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'invoices_invoice_number_unique' AND n.nspname = 'public') THEN ALTER TABLE "invoices" ADD CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number"); END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.conname = 'memory_cards_card_id_unique' AND n.nspname = 'public') THEN ALTER TABLE "memory_cards" ADD CONSTRAINT "memory_cards_card_id_unique" UNIQUE("card_id"); END IF; END $$;

-- ==== Safe normalizer for memory_cards.id (idempotent) ====
DO $$
DECLARE coltype text;
DECLARE is_identity bool;
BEGIN
  -- Only proceed if the column exists
  IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='memory_cards' AND column_name='id'
  ) THEN
    -- Drop identity (if any) and any default so we can change type cleanly
    EXECUTE 'ALTER TABLE public.memory_cards ALTER COLUMN id DROP IDENTITY IF EXISTS';
    EXECUTE 'ALTER TABLE public.memory_cards ALTER COLUMN id DROP DEFAULT';

    -- What is the current data type?
    SELECT data_type INTO coltype
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='memory_cards' AND column_name='id';

    -- Ensure type is integer (cast is safe for empty stub; adjust if real data is non-numeric)
    IF coltype IS DISTINCT FROM 'integer' THEN
      EXECUTE 'ALTER TABLE public.memory_cards ALTER COLUMN id TYPE integer USING id::integer';
    END IF;

    -- Is it already identity?
    SELECT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_attribute a
      JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'memory_cards'
        AND a.attname = 'id'
        AND a.attidentity IN (''a'',''d'')
    ) INTO is_identity;

    -- If not, add identity
    IF NOT is_identity THEN
      EXECUTE 'ALTER TABLE public.memory_cards ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY';
    END IF;
  END IF;
END$$;
-- ==== end normalizer ====
