#!/usr/bin/env node
/**
 * Check SQL Migration Files
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const migrationsDir = join(process.cwd(), 'migrations');

function extractTableNamesFromSQL(content) {
  const tables = new Set();
  
  // Match CREATE TABLE statements
  const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?["']?([a-z_]+)["']?/gi;
  let match;
  while ((match = createTableRegex.exec(content)) !== null) {
    tables.add(match[1]);
  }
  
  // Match ALTER TABLE statements (to find tables being modified)
  const alterTableRegex = /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?["']?([a-z_]+)["']?/gi;
  while ((match = alterTableRegex.exec(content)) !== null) {
    tables.add(match[1]);
  }
  
  return tables;
}

async function main() {
  console.log('🔍 Checking SQL Migration Files\n');
  console.log('='.repeat(70));
  
  const files = readdirSync(migrationsDir);
  const sqlFiles = files.filter(f => f.endsWith('.sql') && !f.includes('.bak'));
  
  console.log(`\n📁 Found ${sqlFiles.length} SQL migration files\n`);
  
  const allTables = new Map();
  const fileTableCounts = new Map();
  
  for (const file of sqlFiles) {
    try {
      const content = readFileSync(join(migrationsDir, file), 'utf-8');
      const tables = extractTableNamesFromSQL(content);
      fileTableCounts.set(file, tables.size);
      
      tables.forEach(table => {
        if (!allTables.has(table)) {
          allTables.set(table, []);
        }
        allTables.get(table).push(file);
      });
    } catch (error) {
      console.log(`   ⚠️  Could not read ${file}: ${error.message}`);
    }
  }
  
  console.log(`📊 Summary:`);
  console.log(`   SQL files: ${sqlFiles.length}`);
  console.log(`   Unique tables referenced: ${allTables.size}`);
  
  console.log(`\n📋 Files by Table Count (top 20):`);
  const sorted = Array.from(fileTableCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);
  
  sorted.forEach(([file, count]) => {
    console.log(`   - ${file}: ${count} tables`);
  });
  
  console.log(`\n📋 Most Referenced Tables (top 20):`);
  const sortedTables = Array.from(allTables.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 20);
  
  sortedTables.forEach(([table, files]) => {
    console.log(`   - ${table}: referenced in ${files.length} files`);
    if (files.length <= 3) {
      files.forEach(f => console.log(`     • ${f}`));
    }
  });
}

main().catch(console.error);

