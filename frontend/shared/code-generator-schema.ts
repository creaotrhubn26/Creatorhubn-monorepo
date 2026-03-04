/**
 * Code Generator Schema - Complete database persistence for AI-enhanced code generation
 * Supports Extended Template Library, Advanced Code Analysis, and Live Testing System
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
  serial,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import type { z } from 'zod';

// Code Templates - Extended Template Library with 13 programming languages
export const codeTemplates = pgTable('code_templates', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  category: varchar('category').notNull(), // Google Services, Social Media, E-commerce, etc.
  language: varchar('language').notNull(), // javascript, typescript, python, php, go, csharp, java, kotlin, swift, dart, rust, react, node
  templateCode: text('template_code').notNull(),
  mockEndpoint: text('mock_endpoint'),
  documentation: text('documentation'),
  requiredDependencies: jsonb('required_dependencies').$type<string[]>().default([]),
  configurationOptions: jsonb('configuration_options')
    .$type<{
      includeErrorHandling: boolean;
      includeMockTesting: boolean;
      includeDocumentation: boolean;
      apiEndpoints?: string[];
      authType?: string;
      responseFormat?: string;
    }>()
    .notNull(),
  qualityScore: integer('quality_score').default(0), // 0-100
  isActive: boolean('is_active').default(true),
  createdBy: varchar('created_by'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Generated Code History - Track all code generation sessions
export const generatedCodeHistory = pgTable('generated_code_history', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  templateId: varchar('template_id').references(() => codeTemplates.id, {
    onDelete: 'cascade',
  }),
  userId: varchar('user_id'),
  generatedCode: text('generated_code').notNull(),
  configuration: jsonb('configuration')
    .$type<{
      api_type: string;
      language: string;
      template: string;
      includeErrorHandling: boolean;
      includeMockTesting: boolean;
      includeDocumentation: boolean;
    }>()
    .notNull(),
  qualityMetrics: jsonb('quality_metrics').$type<{
    syntaxValid: boolean;
    performanceScore: number;
    securityScore: number;
    maintainabilityScore: number;
    testCoverage?: number;
  }>(),
  isBookmarked: boolean('is_bookmarked').default(false),
  downloadCount: integer('download_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

// Code Analysis Results - Advanced Code Analysis System with OWASP security scanning
export const codeAnalysisResults = pgTable('code_analysis_results', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  generatedCodeId: varchar('generated_code_id').references(() => generatedCodeHistory.id, {
    onDelete: 'cascade',
  }),
  code: text('code').notNull(),
  language: varchar('language').notNull(),
  analysisType: varchar('analysis_type').notNull(), // 'security', 'performance', 'quality', 'full'

  // Security Analysis Results
  securityScore: integer('security_score').default(0), // 0-100
  vulnerabilityAssessment: jsonb('vulnerability_assessment').$type<{
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
    owasp_compliance: boolean;
    vulnerabilities: Array<{
      type: string;
      severity: 'critical' | 'high' | 'medium' | 'low';
      description: string;
      line?: number;
      recommendation: string;
    }>;
    recommendations: string[];
  }>(),

  // Performance Analysis Results
  performanceScore: integer('performance_score').default(0), // 0-100
  performanceAnalysis: jsonb('performance_analysis').$type<{
    cyclomaticComplexity: number;
    maintainabilityIndex: number;
    linesOfCode: number;
    bottlenecks: Array<{
      type: string;
      location: string;
      severity: string;
      description: string;
    }>;
    optimizations: Array<{
      type: string;
      description: string;
      impact: 'high' | 'medium' | 'low';
    }>;
  }>(),

  // Quality Metrics
  qualityScore: integer('quality_score').default(0), // 0-100
  qualityMetrics: jsonb('quality_metrics').$type<{
    readability: number;
    maintainability: number;
    testability: number;
    reusability: number;
    documentation: number;
  }>(),

  suggestions: jsonb('suggestions').$type<string[]>().default([]),
  analysisTimestamp: timestamp('analysis_timestamp').defaultNow(),
  processingTime: integer('processing_time'), // milliseconds
  createdAt: timestamp('created_at').defaultNow(),
});

// Live Test Results - Live Testing & Validation System
export const liveTestResults = pgTable('live_test_results', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  generatedCodeId: varchar('generated_code_id').references(() => generatedCodeHistory.id, {
    onDelete: 'cascade',
  }),
  testType: varchar('test_type').notNull(), // 'unit', 'integration', 'e2e', 'performance', 'security'
  testCode: text('test_code'),
  mockEndpoint: text('mock_endpoint'),

  // Test Execution Results
  executionStatus: varchar('execution_status').notNull(), // 'passed', 'failed', 'error', 'timeout'
  testOutput: text('test_output'),
  errorLogs: text('error_logs'),
  executionTime: integer('execution_time'), // milliseconds

  // Test Coverage & Metrics
  testCoverage: integer('test_coverage').default(0), // 0-100 percentage
  testMetrics: jsonb('test_metrics').$type<{
    assertions_passed: number;
    assertions_failed: number;
    assertions_total: number;
    lines_covered: number;
    lines_total: number;
    functions_covered: number;
    functions_total: number;
    branches_covered: number;
    branches_total: number;
  }>(),

  // Performance Test Results
  performanceMetrics: jsonb('performance_metrics').$type<{
    response_time: number;
    throughput: number;
    memory_usage: number;
    cpu_usage: number;
    error_rate: number;
  }>(),

  // Security Test Results
  securityTestResults: jsonb('security_test_results').$type<{
    sql_injection_safe: boolean;
    xss_safe: boolean;
    csrf_safe: boolean;
    input_validation: boolean;
    rate_limiting: boolean;
  }>(),

  createdAt: timestamp('created_at').defaultNow(),
});

// Automated Test Suites - Generated test suites for templates
export const automatedTestSuites = pgTable('automated_test_suites', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  templateId: varchar('template_id').references(() => codeTemplates.id, {
    onDelete: 'cascade',
  }),
  name: varchar('name', { length: 255 }).notNull(),
  language: varchar('language').notNull(),
  category: varchar('category').notNull(),

  // Generated Test Code
  unitTests: text('unit_tests'),
  integrationTests: text('integration_tests'),
  e2eTests: text('e2e_tests'),
  performanceTests: text('performance_tests'),
  securityTests: text('security_tests'),

  // Test Configuration
  testConfiguration: jsonb('test_configuration').$type<{
    framework: string; // jest, mocha, pytest, phpunit, etc.
    mockingLibrary?: string;
    testEnvironment: string;
    timeoutSettings: number;
    retrySettings: number;
  }>(),

  // Test Data Fixtures
  testFixtures: jsonb('test_fixtures').$type<{
    validInputs: any[];
    invalidInputs: any[];
    mockResponses: any[];
    testDataSets: any[];
  }>(),

  isActive: boolean('is_active').default(true),
  successRate: integer('success_rate').default(0), // 0-100
  lastExecuted: timestamp('last_executed'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Template Usage Analytics - Track template popularity and success rates
export const templateAnalytics = pgTable('template_analytics', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  templateId: varchar('template_id').references(() => codeTemplates.id, {
    onDelete: 'cascade',
  }),

  // Usage Statistics
  totalGenerations: integer('total_generations').default(0),
  successfulGenerations: integer('successful_generations').default(0),
  failedGenerations: integer('failed_generations').default(0),
  averageQualityScore: decimal('average_quality_score', {
    precision: 5,
    scale: 2,
  }).default('0'),

  // User Feedback
  averageRating: decimal('average_rating', { precision: 3, scale: 2 }).default('0'),
  totalRatings: integer('total_ratings').default(0),
  bookmarkCount: integer('bookmark_count').default(0),
  downloadCount: integer('download_count').default(0),

  // Performance Metrics
  averageGenerationTime: integer('average_generation_time').default(0), // milliseconds
  averageTestCoverage: decimal('average_test_coverage', {
    precision: 5,
    scale: 2,
  }).default('0'),

  // Monthly Statistics
  monthlyStats: jsonb('monthly_stats')
    .$type<
      Record<
        string,
        {
          generations: number;
          successes: number;
          failures: number;
          avgQuality: number;
        }
      >
    >()
    .default({}),

  lastUpdated: timestamp('last_updated').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Relations
export const codeTemplatesRelations = relations(codeTemplates, ({ many }) => ({
  generatedCodes: many(generatedCodeHistory),
  testSuites: many(automatedTestSuites),
  analytics: many(templateAnalytics),
}));

export const generatedCodeHistoryRelations = relations(generatedCodeHistory, ({ one, many }) => ({
  template: one(codeTemplates, {
    fields: [generatedCodeHistory.templateId],
    references: [codeTemplates.id],
  }),
  analysisResults: many(codeAnalysisResults),
  testResults: many(liveTestResults),
}));

export const codeAnalysisResultsRelations = relations(codeAnalysisResults, ({ one }) => ({
  generatedCode: one(generatedCodeHistory, {
    fields: [codeAnalysisResults.generatedCodeId],
    references: [generatedCodeHistory.id],
  }),
}));

export const liveTestResultsRelations = relations(liveTestResults, ({ one }) => ({
  generatedCode: one(generatedCodeHistory, {
    fields: [liveTestResults.generatedCodeId],
    references: [generatedCodeHistory.id],
  }),
}));

export const automatedTestSuitesRelations = relations(automatedTestSuites, ({ one }) => ({
  template: one(codeTemplates, {
    fields: [automatedTestSuites.templateId],
    references: [codeTemplates.id],
  }),
}));

export const templateAnalyticsRelations = relations(templateAnalytics, ({ one }) => ({
  template: one(codeTemplates, {
    fields: [templateAnalytics.templateId],
    references: [codeTemplates.id],
  }),
}));

// Zod schemas for validation
export const insertCodeTemplateSchema = createInsertSchema(codeTemplates);
export const insertGeneratedCodeHistorySchema = createInsertSchema(generatedCodeHistory);
export const insertCodeAnalysisResultsSchema = createInsertSchema(codeAnalysisResults);
export const insertLiveTestResultsSchema = createInsertSchema(liveTestResults);
export const insertAutomatedTestSuitesSchema = createInsertSchema(automatedTestSuites);
export const insertTemplateAnalyticsSchema = createInsertSchema(templateAnalytics);

// TypeScript types
export type CodeTemplate = typeof codeTemplates.$inferSelect;
export type InsertCodeTemplate = z.infer<typeof insertCodeTemplateSchema>;

export type GeneratedCodeHistory = typeof generatedCodeHistory.$inferSelect;
export type InsertGeneratedCodeHistory = z.infer<typeof insertGeneratedCodeHistorySchema>;

export type CodeAnalysisResults = typeof codeAnalysisResults.$inferSelect;
export type InsertCodeAnalysisResults = z.infer<typeof insertCodeAnalysisResultsSchema>;

export type LiveTestResults = typeof liveTestResults.$inferSelect;
export type InsertLiveTestResults = z.infer<typeof insertLiveTestResultsSchema>;

export type AutomatedTestSuites = typeof automatedTestSuites.$inferSelect;
export type InsertAutomatedTestSuites = z.infer<typeof insertAutomatedTestSuitesSchema>;

export type TemplateAnalytics = typeof templateAnalytics.$inferSelect;
export type InsertTemplateAnalytics = z.infer<typeof insertTemplateAnalyticsSchema>;
