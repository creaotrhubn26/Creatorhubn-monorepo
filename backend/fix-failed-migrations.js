#!/usr/bin/env node
/**
 * Fix Failed Migrations Script
 * Attempts to migrate tables that failed during initial migration
 */

import pg from 'pg';

const { Pool } = pg;

// Database URLs
const OLD_DB_URL = 'postgresql://neondb_owner:npg_RIFOSAo81mLc@ep-divine-rice-a6k2cock.us-west-2.aws.neon.tech/neondb?sslmode=require';
const NEW_DB_URL = 'postgresql://neondb_owner:npg_cb9HrCJxwg6U@ep-broad-surf-abadxt78-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require';

// Tables that failed to migrate
const FAILED_TABLES = [
  'norwegian_market_insights',
  'notes',
  'onboarding_profiles',
  'page_templates',
  'page_versions',
  'parallax_effects',
  'particle_systems',
  'performance_alerts',
  'performance_analytics',
  'photo_edit_sessions',
  'photo_edit_snapshots',
  'photo_enhancement_jobs',
  'photo_sessions',
  'photo_suite_user_preferences',
  'preset_suggestions',
  'preset_usage_history',
  'price_tiers',
  'pricing_categories',
  'pricing_packages',
  'pricing_rules',
  'pricing_structures',
  'products',
  'profession_configurations',
  'profession_feature_overrides',
  'profession_types',
  'project_backups',
  'project_draft_autosave',
  'project_draft_versions',
  'project_emails',
  'project_presets',
  'project_showcases',
  'project_similarity_analysis',
  'project_timelines',
  'projects',
  'proposal_templates',
  'prototype_feedback',
  'provisioning_metrics',
  'provisioning_workflow_steps',
  'provisioning_workflows',
  'rbac_audit_log',
  'rbac_roles',
  'rbac_user_roles',
  'referral_program',
  'role_features',
  'role_hierarchy',
  'sales_activities',
  'sales_analytics',
  'sales_conversations',
  'sales_leads',
  'scroll_animations',
  'scroll_story_media',
  'security_protocol_configurations',
  'seo_alerts',
  'seo_analytics_data',
  'seo_backlinks',
  'seo_campaigns',
  'seo_content_analysis',
  'seo_keywords',
  'seo_local_business',
  'seo_pages',
  'seo_projects',
  'service_activations',
  'service_items',
  'session_activity_log',
  'session_coverage_tracking',
  'shot_lists',
  'showcase_categories',
  'showcase_collections',
  'showcase_comments',
  'showcase_configurations',
  'showcase_content_items',
  'showcase_drive_sync',
  'showcase_galleries',
  'showcase_interactions',
  'showcase_items',
  'showcase_settings',
  'showcase_templates',
  'sign_requests',
  'smart_albums',
  'smart_notes',
  'smart_templates',
  'software_database',
  'software_updates',
  'split_sheet_templates',
  'standard_packages',
  'story_arc_projects',
  'story_arc_sessions',
  'story_arc_templates',
  'subscription_change_history',
  'subscriptions',
  'system_events',
  'system_features',
  'system_performance_metrics',
  'tax_calculations',
  'team_members',
  'template_analytics',
  'text_effects',
  'text_enhancement_history',
  'time_entries',
  'time_entry_templates',
  'time_tracking_archives',
  'travel_expenses',
  'travel_log',
  'trial_usage_tracking',
  'user_activity_logs',
  'user_channel_access',
  'user_community_roles',
  'user_equipment',
  'user_feature_overrides',
  'user_interaction_performance',
  'user_music_library',
  'user_permission_overrides',
  'user_permissions',
  'user_preferences',
  'user_provisioning_requests',
  'user_provisioning_status',
  'user_soundstripe_connections',
  'users',
  'vendor_business_protocols',
  'vendor_engagement_metrics',
  'vendor_inventory',
  'vendor_journey_milestones',
  'vendor_journey_steps',
  'vendor_orders',
  'vendor_tasks',
  'vendor_user_achievements',
  'vendor_user_skill_badges',
  'virtual_studio_light_patterns',
  'virtual_studio_pattern_usage',
  'virtual_studio_ratings',
  'wedding_timeline_client_settings',
  'wedding_timelines',
  'wiremock_config',
  'workflow_states',
];

const oldPool = new Pool({
  connectionString: OLD_DB_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
});

const newPool = new Pool({
  connectionString: NEW_DB_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
});

async function getTableColumns(pool, tableName) {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = $1
      ORDER BY ordinal_position;
    `, [tableName]);
    return result.rows;
  } catch (error) {
    console.error(`Error getting columns for ${tableName}:`, error.message);
    return [];
  }
}

async function getTableRowCount(pool, tableName) {
  try {
    const result = await pool.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
    return parseInt(result.rows[0].count, 10);
  } catch (error) {
    return 0;
  }
}

async function diagnoseTable(oldPool, newPool, tableName) {
  console.log(`\n🔍 Diagnosing: ${tableName}`);
  
  try {
    // Check if table exists in both databases
    const oldExists = await oldPool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      );
    `, [tableName]);
    
    const newExists = await newPool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      );
    `, [tableName]);
    
    if (!oldExists.rows[0].exists) {
      console.log(`   ❌ Table doesn't exist in old database`);
      return { exists: false, reason: 'not_in_old_db' };
    }
    
    if (!newExists.rows[0].exists) {
      console.log(`   ❌ Table doesn't exist in new database`);
      return { exists: false, reason: 'not_in_new_db' };
    }
    
    // Get columns from both
    const oldColumns = await getTableColumns(oldPool, tableName);
    const newColumns = await getTableColumns(newPool, tableName);
    
    const oldColumnNames = oldColumns.map(c => c.column_name);
    const newColumnNames = newColumns.map(c => c.column_name);
    
    console.log(`   Old DB columns: ${oldColumnNames.length}`);
    console.log(`   New DB columns: ${newColumnNames.length}`);
    
    // Find differences
    const onlyInOld = oldColumnNames.filter(c => !newColumnNames.includes(c));
    const onlyInNew = newColumnNames.filter(c => !oldColumnNames.includes(c));
    const common = oldColumnNames.filter(c => newColumnNames.includes(c));
    
    if (onlyInOld.length > 0) {
      console.log(`   ⚠️  Columns only in old: ${onlyInOld.join(', ')}`);
    }
    if (onlyInNew.length > 0) {
      console.log(`   ⚠️  Columns only in new: ${onlyInNew.join(', ')}`);
    }
    console.log(`   ✅ Common columns: ${common.length}`);
    
    // Check row counts
    const oldCount = await getTableRowCount(oldPool, tableName);
    const newCount = await getTableRowCount(newPool, tableName);
    
    console.log(`   Old DB rows: ${oldCount}`);
    console.log(`   New DB rows: ${newCount}`);
    
    // Try a test query
    if (common.length > 0 && oldCount > 0) {
      try {
        const testQuery = `SELECT ${common.slice(0, 3).map(c => `"${c}"`).join(', ')} FROM "${tableName}" LIMIT 1`;
        await oldPool.query(testQuery);
        console.log(`   ✅ Test query successful`);
      } catch (error) {
        console.log(`   ❌ Test query failed: ${error.message}`);
        return { exists: true, reason: 'query_error', error: error.message };
      }
    }
    
    return { 
      exists: true, 
      reason: 'schema_mismatch',
      oldColumns: oldColumnNames.length,
      newColumns: newColumnNames.length,
      commonColumns: common.length,
      onlyInOld,
      onlyInNew,
      oldCount,
      newCount
    };
  } catch (error) {
    console.error(`   ❌ Error diagnosing: ${error.message}`);
    return { exists: false, reason: 'error', error: error.message };
  }
}

async function migrateTableWithErrorHandling(oldPool, newPool, tableName, batchSize = 100) {
  console.log(`\n📦 Retrying migration: ${tableName}`);
  
  try {
    const diagnosis = await diagnoseTable(oldPool, newPool, tableName);
    
    if (!diagnosis.exists) {
      console.log(`   ⏭️  Skipping: ${diagnosis.reason}`);
      return { migrated: 0, skipped: 0, errors: 0, reason: diagnosis.reason };
    }
    
    if (diagnosis.reason === 'query_error') {
      console.log(`   ❌ Cannot migrate due to query error`);
      return { migrated: 0, skipped: 0, errors: 1, reason: diagnosis.reason };
    }
    
    const oldColumns = await getTableColumns(oldPool, tableName);
    const newColumns = await getTableColumns(newPool, tableName);
    
    const oldColumnNames = oldColumns.map(c => c.column_name);
    const newColumnNames = newColumns.map(c => c.column_name);
    const commonColumns = oldColumnNames.filter(col => newColumnNames.includes(col));
    
    if (commonColumns.length === 0) {
      console.log(`   ⚠️  No common columns, skipping`);
      return { migrated: 0, skipped: 0, errors: 0, reason: 'no_common_columns' };
    }
    
    const oldCount = await getTableRowCount(oldPool, tableName);
    if (oldCount === 0) {
      console.log(`   ⏭️  No data to migrate`);
      return { migrated: 0, skipped: 0, errors: 0, reason: 'no_data' };
    }
    
    // Try smaller batches for problematic tables
    let offset = 0;
    let totalMigrated = 0;
    let totalErrors = 0;
    const smallBatchSize = Math.min(batchSize, 100);
    
    while (offset < oldCount) {
      try {
        const selectQuery = `SELECT ${commonColumns.map(c => `"${c}"`).join(', ')} FROM "${tableName}" ORDER BY (SELECT NULL) LIMIT $1 OFFSET $2`;
        const oldData = await oldPool.query(selectQuery, [smallBatchSize, offset]);
        
        if (oldData.rows.length === 0) break;
        
        // Build insert query with proper handling of nulls and special values
        const insertColumns = commonColumns.map(c => `"${c}"`).join(', ');
        const values = oldData.rows.flatMap(row => commonColumns.map(col => row[col]));
        
        // Use parameterized query with proper escaping
        const placeholders = oldData.rows.map((_, i) => {
          return `(${commonColumns.map((_, j) => `$${i * commonColumns.length + j + 1}`).join(', ')})`;
        }).join(', ');
        
        const insertQuery = `INSERT INTO "${tableName}" (${insertColumns}) VALUES ${placeholders} ON CONFLICT DO NOTHING`;
        
        await newPool.query(insertQuery, values);
        
        totalMigrated += oldData.rows.length;
        offset += smallBatchSize;
        
        process.stdout.write(`   Progress: ${Math.min(offset, oldCount)}/${oldCount}\r`);
      } catch (error) {
        console.error(`\n   ❌ Batch error at offset ${offset}: ${error.message}`);
        totalErrors++;
        // Try to continue with next batch
        offset += smallBatchSize;
        
        // If too many errors, stop
        if (totalErrors > 10) {
          console.log(`\n   ⚠️  Too many errors, stopping`);
          break;
        }
      }
    }
    
    const finalCount = await getTableRowCount(newPool, tableName);
    console.log(`\n   ${totalMigrated > 0 ? '✅' : '⚠️'} Migrated: ${totalMigrated} rows → ${finalCount} in new DB`);
    
    return { migrated: totalMigrated, skipped: oldCount - totalMigrated, errors: totalErrors };
  } catch (error) {
    console.error(`   ❌ Migration failed: ${error.message}`);
    return { migrated: 0, skipped: 0, errors: 1, reason: error.message };
  }
}

async function main() {
  console.log('🔧 Fix Failed Migrations');
  console.log('========================\n');
  console.log(`Found ${FAILED_TABLES.length} tables that failed to migrate\n`);
  
  try {
    await oldPool.query('SELECT NOW()');
    console.log('✅ Old DB: Connected');
    await newPool.query('SELECT NOW()');
    console.log('✅ New DB: Connected\n');
    
    const results = {};
    
    for (const table of FAILED_TABLES) {
      results[table] = await migrateTableWithErrorHandling(oldPool, newPool, table);
    }
    
    // Summary
    console.log('\n📊 Retry Summary');
    console.log('================');
    let totalMigrated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    const stillFailed = [];
    
    for (const [table, result] of Object.entries(results)) {
      if (result.migrated > 0) {
        console.log(`✅ ${table}: ${result.migrated} rows migrated`);
        totalMigrated += result.migrated;
      } else if (result.errors > 0 || result.reason) {
        stillFailed.push({ table, reason: result.reason || 'unknown', errors: result.errors });
        totalErrors += result.errors;
      } else {
        totalSkipped += result.skipped;
      }
    }
    
    console.log(`\n🎉 Retry Complete!`);
    console.log(`   Successfully migrated: ${totalMigrated} rows`);
    console.log(`   Still failed: ${stillFailed.length} tables`);
    
    if (stillFailed.length > 0) {
      console.log(`\n❌ Tables still failing:`);
      for (const { table, reason, errors } of stillFailed) {
        console.log(`   ${table}: ${reason} (${errors} errors)`);
      }
    }
    
  } catch (error) {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  } finally {
    await oldPool.end();
    await newPool.end();
  }
}

main().catch(console.error);

