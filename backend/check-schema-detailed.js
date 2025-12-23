#!/usr/bin/env node
/**
 * Detailed Schema Checker - Analyzes database-persistence-schema.ts
 */

import pg from 'pg';
import { readFileSync } from 'fs';

const { Pool } = pg;

const DB_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_cb9HrCJxwg6U@ep-broad-surf-abadxt78-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
});

function extractTableNames(content) {
  const tables = new Map();
  // Match pgTable('table_name', ...) or pgTable("table_name", ...)
  const pgTableRegex = /pgTable\s*\(\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = pgTableRegex.exec(content)) !== null) {
    const tableName = match[1];
    const lineNumber = content.substring(0, match.index).split('\n').length;
    tables.set(tableName, { name: tableName, line: lineNumber });
  }
  return tables;
}

function extractColumnDefinitions(content, tableName) {
  // Find the table definition
  const tableRegex = new RegExp(`pgTable\\s*\\(\\s*['"]${tableName}['"]\\s*,\\s*\\{([^}]+)\\}`); // Simplified
  // Better approach: extract all columns from the table definition
  const columns = [];
  const lines = content.split('\n');
  let inTable = false;
  let braceCount = 0;
  let tableStartLine = -1;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes(`pgTable('${tableName}'`) || line.includes(`pgTable("${tableName}"`)) {
      inTable = true;
      tableStartLine = i;
      braceCount = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
      continue;
    }
    
    if (inTable) {
      braceCount += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
      
      // Extract column definitions
      const columnMatch = line.match(/(\w+):\s*(\w+)\(['"]([^'"]+)['"]/);
      if (columnMatch) {
        columns.push({
          name: columnMatch[3],
          type: columnMatch[2],
          line: i + 1,
        });
      }
      
      if (braceCount <= 0 && inTable) {
        break;
      }
    }
  }
  
  return columns;
}

async function getDatabaseTableInfo(tableName) {
  try {
    const cols = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = $1
      ORDER BY ordinal_position;
    `, [tableName]);
    
    const rowCount = await pool.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
    
    return {
      exists: true,
      columns: cols.rows,
      columnCount: cols.rows.length,
      rowCount: parseInt(rowCount.rows[0].count, 10),
    };
  } catch (error) {
    return { exists: false, error: error.message };
  }
}

async function main() {
  console.log('🔍 Detailed Schema Analysis: database-persistence-schema.ts\n');
  console.log('='.repeat(70));
  
  // Read schema file
  const schemaFile = 'shared/database-persistence-schema.ts';
  console.log(`\n📄 Reading: ${schemaFile}`);
  const content = readFileSync(schemaFile, 'utf-8');
  const fileSize = (content.length / 1024).toFixed(2);
  console.log(`   File size: ${fileSize} KB`);
  console.log(`   Lines: ${content.split('\n').length}`);
  
  // Extract tables
  console.log(`\n📋 Extracting table definitions...`);
  const schemaTables = extractTableNames(content);
  console.log(`   Found ${schemaTables.size} table definitions`);
  
  // Get database tables
  console.log(`\n📊 Checking database...`);
  const dbResult = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);
  const dbTables = new Set(dbResult.rows.map(r => r.table_name));
  console.log(`   Found ${dbTables.size} tables in database`);
  
  // Compare
  console.log(`\n🔍 Comparing schema vs database...\n`);
  
  const schemaTableList = Array.from(schemaTables.keys()).sort();
  const inSchemaNotInDb = [];
  const inDbAndInSchema = [];
  const missingColumns = [];
  
  let checked = 0;
  const sampleSize = Math.min(50, schemaTableList.length);
  
  for (const tableName of schemaTableList.slice(0, sampleSize)) {
    checked++;
    const tableInfo = schemaTables.get(tableName);
    const dbInfo = await getDatabaseTableInfo(tableName);
    
    if (!dbInfo.exists) {
      inSchemaNotInDb.push({ table: tableName, line: tableInfo.line });
    } else {
      inDbAndInSchema.push({
        table: tableName,
        schemaLine: tableInfo.line,
        dbColumns: dbInfo.columnCount,
        dbRows: dbInfo.rowCount,
      });
    }
    
    if (checked % 10 === 0) {
      process.stdout.write(`   Checked ${checked}/${sampleSize} tables...\r`);
    }
  }
  
  console.log(`\n   Checked ${checked} tables\n`);
  
  // Report
  console.log(`✅ Tables in schema AND database: ${inDbAndInSchema.length}`);
  if (inDbAndInSchema.length > 0) {
    console.log(`\n   Sample tables:`);
    inDbAndInSchema.slice(0, 10).forEach(t => {
      console.log(`   - ${t.table} (line ${t.schemaLine}): ${t.dbColumns} columns, ${t.dbRows} rows`);
    });
  }
  
  console.log(`\n❌ Tables in schema but NOT in database: ${inSchemaNotInDb.length}`);
  if (inSchemaNotInDb.length > 0) {
    console.log(`\n   Missing tables:`);
    inSchemaNotInDb.forEach(t => {
      console.log(`   - ${t.table} (defined at line ${t.line})`);
    });
  }
  
  // Check critical tables
  console.log(`\n📋 Checking critical tables from schema...`);
  const criticalTables = ['users', 'projects', 'profession_types', 'notes', 'clients', 'contracts', 'sessions', 'images'];
  
  for (const table of criticalTables) {
    if (schemaTables.has(table)) {
      const dbInfo = await getDatabaseTableInfo(table);
      if (dbInfo.exists) {
        console.log(`   ✅ ${table}: ${dbInfo.columnCount} columns, ${dbInfo.rowCount} rows`);
      } else {
        console.log(`   ❌ ${table}: NOT IN DATABASE`);
      }
    } else {
      console.log(`   ⚠️  ${table}: NOT IN SCHEMA`);
    }
  }
  
  // Summary
  console.log(`\n📊 Summary:`);
  console.log(`   Schema file: ${schemaFile}`);
  console.log(`   Tables defined in schema: ${schemaTables.size}`);
  console.log(`   Tables in database: ${dbTables.size}`);
  console.log(`   Checked: ${checked} tables`);
  console.log(`   In schema AND database: ${inDbAndInSchema.length}`);
  console.log(`   In schema but NOT in database: ${inSchemaNotInDb.length}`);
  
  await pool.end();
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});

