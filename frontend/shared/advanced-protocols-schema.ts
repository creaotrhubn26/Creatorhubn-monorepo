/**
 * CreatorHub Norge - Advanced Protocol Management Schema
 * Comprehensive schema for modern data exchange, AI, creative media, and vendor protocols
 * Følger alle replit.md protokoller og integrerer med eksisterende systemer
 */

import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  integer,
  boolean,
  decimal,
  uuid,
  index,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import type { z } from 'zod';

// ⚠️ DATAUTVEKSLING OG API PROTOKOLLER
export const apiProtocolConfigurations = pgTable('api_protocol_configurations', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  protocol_type: varchar('protocol_type', { length: 50 }).notNull(), // REST, GraphQL, WebSocket, gRPC, ACME
  endpoint_url: text('endpoint_url').notNull(),
  authentication_method: varchar('authentication_method').notNull(), // OAuth2, API_KEY, JWT, mTLS
  configuration: jsonb('configuration')
    .$type<{
      headers?: Record<string, string>;
      timeout?: number;
      retries?: number;
      rate_limit?: number;
      cors_origins?: string[];
      ssl_verify?: boolean;
      acme_directory?: string; // For ACME protocol
      graphql_schema?: string; // For GraphQL
      websocket_reconnect?: boolean; // For WebSocket
      grpc_options?: Record<string, any>; // For gRPC
    }>()
    .notNull(),
  status: varchar('status').notNull().default('active'), // active, inactive, deprecated
  version: varchar('version').notNull().default('1.0'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  userId: varchar('user_id').notNull(),
  profession: varchar('profession').notNull(),
});

export type ApiProtocolConfiguration = typeof apiProtocolConfigurations.$inferSelect;
export type InsertApiProtocolConfiguration = typeof apiProtocolConfigurations.$inferInsert;

// ⚠️ KREATIV MEDIE- OG FILHÅNDTERING PROTOKOLLER
export const mediaProtocolHandlers = pgTable('media_protocol_handlers', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  protocol_name: varchar('protocol_name').notNull(), // HTTPS_RANGE, RTMP, HLS, MPEG_DASH, WebDAV
  media_type: varchar('media_type').notNull(), // photo, video, audio, document
  handler_config: jsonb('handler_config')
    .$type<{
      range_requests?: boolean;
      chunk_size?: number;
      streaming_quality?: string[];
      rtmp_url?: string;
      hls_segments?: number;
      dash_profile?: string;
      webdav_endpoint?: string;
      exif_metadata?: boolean;
      iptc_metadata?: boolean;
      xmp_metadata?: boolean;
    }>()
    .notNull(),
  processing_options: jsonb('processing_options')
    .$type<{
      auto_transcode?: boolean;
      quality_levels?: string[];
      thumbnail_generation?: boolean;
      metadata_extraction?: boolean;
      watermark_overlay?: boolean;
      compression_settings?: Record<string, any>;
    }>()
    .notNull(),
  status: varchar('status').notNull().default('enabled'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  userId: varchar('user_id').notNull(),
  profession: varchar('profession').notNull(),
});

export type MediaProtocolHandler = typeof mediaProtocolHandlers.$inferSelect;
export type InsertMediaProtocolHandler = typeof mediaProtocolHandlers.$inferInsert;

// ⚠️ SAMARBEID OG DELING PROTOKOLLER
export const collaborationProtocols = pgTable('collaboration_protocols', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  protocol_type: varchar('protocol_type').notNull(), // ActivityPub, WebRTC, CalDAV, CardDAV
  configuration: jsonb('configuration')
    .$type<{
      activitypub_instance?: string;
      webrtc_ice_servers?: Array<{
        urls: string[];
        username?: string;
        credential?: string;
      }>;
      caldav_server?: string;
      carddav_server?: string;
      sync_interval?: number;
      encryption_enabled?: boolean;
      p2p_enabled?: boolean;
    }>()
    .notNull(),
  integration_settings: jsonb('integration_settings')
    .$type<{
      google_calendar?: boolean;
      outlook_calendar?: boolean;
      apple_contacts?: boolean;
      social_media_sharing?: string[];
      real_time_collaboration?: boolean;
      permission_levels?: string[];
    }>()
    .notNull(),
  status: varchar('status').notNull().default('active'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  userId: varchar('user_id').notNull(),
  profession: varchar('profession').notNull(),
});

export type CollaborationProtocol = typeof collaborationProtocols.$inferSelect;
export type InsertCollaborationProtocol = typeof collaborationProtocols.$inferInsert;

// ⚠️ SIKKERHETSPROTOKOLLER
export const securityProtocolConfigurations = pgTable('security_protocol_configurations', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  protocol_type: varchar('protocol_type').notNull(), // PCI_DSS, 3D_SECURE, SCIM, PKI, ZERO_TRUST
  security_level: varchar('security_level').notNull(), // low, medium, high, critical
  configuration: jsonb('configuration')
    .$type<{
      pci_compliance_level?: string; // Level 1-4
      secure_3d_version?: string; // 2.0, 2.1, 2.2
      scim_endpoint?: string;
      pki_certificate_path?: string;
      zero_trust_policies?: Array<{
        resource: string;
        access_level: string;
        conditions: string[];
      }>;
      encryption_algorithm?: string;
      key_rotation_interval?: number;
      audit_logging?: boolean;
    }>()
    .notNull(),
  compliance_status: jsonb('compliance_status')
    .$type<{
      last_audit?: string;
      compliance_score?: number;
      violations?: string[];
      remediation_actions?: string[];
    }>()
    .notNull(),
  status: varchar('status').notNull().default('active'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  userId: varchar('user_id').notNull(),
  profession: varchar('profession').notNull(),
});

export type SecurityProtocolConfiguration = typeof securityProtocolConfigurations.$inferSelect;
export type InsertSecurityProtocolConfiguration =
  typeof securityProtocolConfigurations.$inferInsert;

// ⚠️ CHAT PROTOKOLLER: XMPP og Matrix implementasjon
export const chatProtocolConnections = pgTable('chat_protocol_connections', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  protocol_type: varchar('protocol_type').notNull(), // xmpp, matrix, websocket
  user_email: varchar('user_email').notNull(),
  connection_config: jsonb('connection_config')
    .$type<{
      // XMPP specific
      jid?: string;
      xmpp_server?: string;
      resource?: string;
      sasl_mechanism?: string;

      // Matrix specific
      homeserver?: string;
      user_id?: string;
      device_id?: string;
      access_token?: string;
      encryption_enabled?: boolean;

      // Common settings
      auto_reconnect?: boolean;
      connection_timeout?: number;
      keepalive_interval?: number;
      ssl_enabled?: boolean;
    }>()
    .notNull(),
  status: varchar('status').notNull().default('disconnected'), // connected, disconnected, connecting, error
  last_activity: timestamp('last_activity'),
  capabilities: jsonb('capabilities').$type<string[]>().notNull().default([]),
  metadata: jsonb('metadata').$type<{
    client_version?: string;
    supported_extensions?: string[];
    presence_status?: string;
    joined_rooms?: string[];
    contact_roster?: string[];
  }>(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

export type ChatProtocolConnection = typeof chatProtocolConnections.$inferSelect;
export type InsertChatProtocolConnection = typeof chatProtocolConnections.$inferInsert;

// ⚠️ ADVANCED CHAT MESSAGES med protokoll-spesifikk metadata
export const advancedChatMessages = pgTable('advanced_chat_messages', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  protocol: varchar('protocol').notNull(), // xmpp, matrix, websocket, activitypub
  from_address: text('from_address').notNull(), // JID, Matrix user ID, eller WebSocket user
  to_address: text('to_address').notNull(),
  message_content: text('message_content').notNull(),
  message_type: varchar('message_type').notNull().default('text'), // text, file, image, audio, video
  encryption_status: varchar('encryption_status').notNull().default('none'), // none, transport, e2e
  protocol_metadata: jsonb('protocol_metadata').$type<{
    // XMPP metadata
    xmpp_stanza_id?: string;
    xmpp_thread_id?: string;

    // Matrix metadata
    matrix_event_id?: string;
    matrix_room_id?: string;
    matrix_relates_to?: string;

    // Common metadata
    delivery_receipt?: boolean;
    read_receipt?: boolean;
    carbon_copy?: boolean;
    priority?: 'low' | 'normal' | 'high';
  }>(),
  delivery_status: varchar('delivery_status').notNull().default('pending'), // pending, sent, delivered, read, failed
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  user_email: varchar('user_email').notNull(),
  conversation_id: varchar('conversation_id'),
  attachments: jsonb('attachments')
    .$type<
      Array<{
        filename: string;
        content_type: string;
        size: number;
        url: string;
        encryption_key?: string;
      }>
    >()
    .default([]),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

export type AdvancedChatMessage = typeof advancedChatMessages.$inferSelect;
export type InsertAdvancedChatMessage = typeof advancedChatMessages.$inferInsert;

// ⚠️ AI PROTOKOLLER FOR FOTO, VIDEO, LYD
export const aiProtocolConfigurations = pgTable('ai_protocol_configurations', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  ai_type: varchar('ai_type').notNull(), // PHOTO_AI, VIDEO_AI, AUDIO_AI, GENERAL_AI
  protocol_standard: varchar('protocol_standard').notNull(), // ONNX, DNG_XMP, MPEG7, MLflow, OpenAI
  model_configuration: jsonb('model_configuration')
    .$type<{
      model_path?: string;
      model_version?: string;
      input_format?: string[];
      output_format?: string[];
      batch_size?: number;
      inference_device?: string; // cpu, gpu, edge
      onnx_runtime?: string;
      dng_metadata?: boolean;
      xmp_sidecar?: boolean;
      mpeg7_descriptors?: string[];
      mlflow_tracking?: boolean;
    }>()
    .notNull(),
  processing_pipeline: jsonb('processing_pipeline')
    .$type<{
      preprocessing?: string[];
      enhancement_steps?: string[];
      postprocessing?: string[];
      quality_metrics?: string[];
      output_validation?: boolean;
    }>()
    .notNull(),
  performance_metrics: jsonb('performance_metrics')
    .$type<{
      inference_time?: number;
      memory_usage?: number;
      accuracy_score?: number;
      throughput?: number;
      last_benchmark?: string;
    }>()
    .notNull(),
  status: varchar('status').notNull().default('active'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  userId: varchar('user_id').notNull(),
  profession: varchar('profession').notNull(),
});

export type AiProtocolConfiguration = typeof aiProtocolConfigurations.$inferSelect;
export type InsertAiProtocolConfiguration = typeof aiProtocolConfigurations.$inferInsert;

// ⚠️ VENDOR OG BUSINESS PROTOKOLLER
export const vendorBusinessProtocols = pgTable('vendor_business_protocols', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  protocol_type: varchar('protocol_type').notNull(), // EDI, OPEN_BANKING, JSON_LD, SCHEMA_ORG
  business_type: varchar('business_type').notNull(), // vendor, supplier, partner, customer
  configuration: jsonb('configuration')
    .$type<{
      edi_standard?: string; // X12, EDIFACT, XML
      edi_version?: string;
      banking_api_version?: string; // PSD2, Open Banking
      json_ld_context?: string;
      schema_org_types?: string[];
      business_identifiers?: {
        org_number?: string;
        vat_number?: string;
        duns_number?: string;
      };
      integration_endpoints?: Record<string, string>;
    }>()
    .notNull(),
  seo_metadata: jsonb('seo_metadata')
    .$type<{
      structured_data?: Record<string, any>;
      meta_tags?: Record<string, string>;
      open_graph?: Record<string, string>;
      twitter_cards?: Record<string, string>;
      json_ld_schemas?: Array<Record<string, any>>;
    }>()
    .notNull(),
  status: varchar('status').notNull().default('active'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  userId: varchar('user_id').notNull(),
  profession: varchar('profession').notNull(),
});

export type VendorBusinessProtocol = typeof vendorBusinessProtocols.$inferSelect;
export type InsertVendorBusinessProtocol = typeof vendorBusinessProtocols.$inferInsert;

// ⚠️ AVANSERT CHAT PROTOKOLLER (XMPP, Matrix)
export const advancedChatProtocols = pgTable('advanced_chat_protocols', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  protocol_type: varchar('protocol_type').notNull(), // XMPP, MATRIX, WebSocket_Enhanced
  server_configuration: jsonb('server_configuration')
    .$type<{
      server_address?: string;
      port?: number;
      use_tls?: boolean;
      authentication_method?: string;
      xmpp_domain?: string;
      matrix_homeserver?: string;
      federation_enabled?: boolean;
      e2e_encryption?: boolean;
    }>()
    .notNull(),
  features: jsonb('features')
    .$type<{
      file_transfer?: boolean;
      video_calls?: boolean;
      screen_sharing?: boolean;
      group_chat?: boolean;
      message_history?: boolean;
      push_notifications?: boolean;
      offline_messages?: boolean;
      read_receipts?: boolean;
    }>()
    .notNull(),
  integration_settings: jsonb('integration_settings')
    .$type<{
      google_workspace?: boolean;
      microsoft_teams?: boolean;
      slack_bridge?: boolean;
      webhook_notifications?: string[];
      custom_bots?: boolean;
    }>()
    .notNull(),
  status: varchar('status').notNull().default('active'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  userId: varchar('user_id').notNull(),
  profession: varchar('profession').notNull(),
});

export type AdvancedChatProtocol = typeof advancedChatProtocols.$inferSelect;
export type InsertAdvancedChatProtocol = typeof advancedChatProtocols.$inferInsert;

// ⚠️ OPENAPI DOKUMENTASJON PROTOKOLLER
export const openApiDocumentationProtocols = pgTable('open_api_documentation_protocols', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  api_name: varchar('api_name').notNull(),
  openapi_version: varchar('openapi_version').notNull().default('3.0.3'),
  specification: jsonb('specification')
    .$type<{
      openapi: string;
      info: {
        title: string;
        version: string;
        description?: string;
        contact?: Record<string, string>;
        license?: Record<string, string>;
      };
      servers: Array<{
        url: string;
        description?: string;
      }>;
      paths: Record<string, any>;
      components?: Record<string, any>;
      security?: Array<Record<string, any>>;
    }>()
    .notNull(),
  documentation_config: jsonb('documentation_config')
    .$type<{
      swagger_ui_enabled?: boolean;
      redoc_enabled?: boolean;
      postman_collection?: boolean;
      code_samples?: boolean;
      interactive_examples?: boolean;
      version_history?: boolean;
    }>()
    .notNull(),
  access_control: jsonb('access_control')
    .$type<{
      public_access?: boolean;
      api_key_required?: boolean;
      oauth_required?: boolean;
      ip_whitelist?: string[];
      rate_limiting?: Record<string, number>;
    }>()
    .notNull(),
  status: varchar('status').notNull().default('active'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  userId: varchar('user_id').notNull(),
  profession: varchar('profession').notNull(),
});

export type OpenApiDocumentationProtocol = typeof openApiDocumentationProtocols.$inferSelect;
export type InsertOpenApiDocumentationProtocol = typeof openApiDocumentationProtocols.$inferInsert;

// Validation schemas using drizzle-zod
export const insertApiProtocolConfigurationSchema = createInsertSchema(apiProtocolConfigurations);
export const insertMediaProtocolHandlerSchema = createInsertSchema(mediaProtocolHandlers);
export const insertCollaborationProtocolSchema = createInsertSchema(collaborationProtocols);
export const insertSecurityProtocolConfigurationSchema = createInsertSchema(
  securityProtocolConfigurations,
);
export const insertAiProtocolConfigurationSchema = createInsertSchema(aiProtocolConfigurations);
export const insertVendorBusinessProtocolSchema = createInsertSchema(vendorBusinessProtocols);
export const insertAdvancedChatProtocolSchema = createInsertSchema(advancedChatProtocols);
export const insertOpenApiDocumentationProtocolSchema = createInsertSchema(
  openApiDocumentationProtocols,
);

// Export types for TypeScript
export type InsertApiProtocolConfigurationType = z.infer<
  typeof insertApiProtocolConfigurationSchema
>;
export type InsertMediaProtocolHandlerType = z.infer<typeof insertMediaProtocolHandlerSchema>;
export type InsertCollaborationProtocolType = z.infer<typeof insertCollaborationProtocolSchema>;
export type InsertSecurityProtocolConfigurationType = z.infer<
  typeof insertSecurityProtocolConfigurationSchema
>;
export type InsertAiProtocolConfigurationType = z.infer<typeof insertAiProtocolConfigurationSchema>;
export type InsertVendorBusinessProtocolType = z.infer<typeof insertVendorBusinessProtocolSchema>;
export type InsertAdvancedChatProtocolType = z.infer<typeof insertAdvancedChatProtocolSchema>;
export type InsertOpenApiDocumentationProtocolType = z.infer<
  typeof insertOpenApiDocumentationProtocolSchema
>;
