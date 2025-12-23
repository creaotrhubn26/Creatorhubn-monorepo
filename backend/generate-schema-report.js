#!/usr/bin/env node
/**
 * Generate detailed schema report
 */

import pg from 'pg';
import { writeFileSync } from 'fs';

const { Pool } = pg;

const DB_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_cb9HrCJxwg6U@ep-broad-surf-abadxt78-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
});

async function getDatabaseTables() {
  const result = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);
  return new Set(result.rows.map(r => r.table_name));
}

async function getTableColumns(tableName) {
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
    return [];
  }
}

async function getTableRowCount(tableName) {
  try {
    const result = await pool.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
    return parseInt(result.rows[0].count, 10);
  } catch (error) {
    return 0;
  }
}

function extractTableNamesFromSchema(content) {
  const tables = new Set();
  const pgTableRegex = /pgTable\s*\(\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = pgTableRegex.exec(content)) !== null) {
    tables.add(match[1]);
  }
  return tables;
}

async function scanSchemaFiles() {
  const { readFileSync } = await import('fs');
  const schemaFiles = [
    'shared/database-persistence-schema.ts',
    'shared/schema.ts',
    'shared/schema-simple.ts',
    'shared/schema-extensions.ts',
    'shared/schema-clean.ts',
    'shared/schema-backup.ts',
    'migrations/schema.ts',
  ];
  
  const allTables = new Set();
  
  for (const file of schemaFiles) {
    try {
      const content = readFileSync(file, 'utf-8');
      const tables = extractTableNamesFromSchema(content);
      tables.forEach(t => allTables.add(t));
    } catch (error) {
      // File doesn't exist, skip
    }
  }
  
  return allTables;
}

async function main() {
  console.log('📊 Generating Schema Report...\n');
  
  const dbTables = await getDatabaseTables();
  const schemaTables = await scanSchemaFiles();
  
  const inDbNotInSchema = [...dbTables].filter(t => !schemaTables.has(t));
  
  console.log(`Found ${inDbNotInSchema.length} tables in DB but not in schemas\n`);
  console.log('Analyzing sample tables...\n');
  
  // Analyze first 20 missing tables
  const sampleTables = inDbNotInSchema.slice(0, 20);
  const report = [];
  
  for (const table of sampleTables) {
    const cols = await getTableColumns(table);
    const rowCount = await getTableRowCount(table);
    report.push({
      table,
      columns: cols.length,
      rows: rowCount,
      columnNames: cols.map(c => c.column_name).join(', '),
    });
    console.log(`  ${table}: ${cols.length} columns, ${rowCount} rows`);
  }
  
  // Write report
  const reportContent = `# Schema Analysis Report

Generated: ${new Date().toISOString()}

## Summary
- Total tables in database: ${dbTables.size}
- Tables defined in schemas: ${schemaTables.size}
- Tables in DB but NOT in schemas: ${inDbNotInSchema.length}

## Sample Tables Missing from Schemas

${report.map(r => `
### ${r.table}
- Columns: ${r.columns}
- Rows: ${r.rows}
- Column names: ${r.columnNames}
`).join('\n')}

## All Tables Missing from Schemas (${inDbNotInSchema.length})

${inDbNotInSchema.map(t => `- ${t}`).join('\n')}
`;
  
  writeFileSync('SCHEMA_ANALYSIS_REPORT.md', reportContent);
  console.log(`\n✅ Report written to SCHEMA_ANALYSIS_REPORT.md`);
  
  await pool.end();
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});

