#!/usr/bin/env node

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { parse } from "@babel/parser";
import pg from "pg";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = path.resolve(SCRIPT_DIR, "..");
const SERVER_DIR = path.join(BACKEND_DIR, "server");
const MIGRATIONS_DIR = path.join(BACKEND_DIR, "migrations");
const LIVE = process.argv.includes("--live");

function visit(node, callback) {
  if (!node || typeof node !== "object") return;
  if (typeof node.type === "string") callback(node);
  for (const [key, value] of Object.entries(node)) {
    if (["loc", "start", "end", "leadingComments", "trailingComments", "innerComments"].includes(key)) continue;
    if (Array.isArray(value)) {
      for (const child of value) visit(child, callback);
    } else if (value && typeof value === "object") {
      visit(value, callback);
    }
  }
}

function parseTypescript(source, filename) {
  return parse(source, {
    sourceFilename: filename,
    sourceType: "unambiguous",
    errorRecovery: false,
    plugins: ["typescript", "jsx", "decorators-legacy", "importAttributes"],
  });
}

function importedSpecifiers(ast) {
  const values = [];
  visit(ast, (node) => {
    if ((node.type === "ImportDeclaration" || node.type === "ExportNamedDeclaration" || node.type === "ExportAllDeclaration") && typeof node.source?.value === "string") {
      values.push(node.source.value);
    }
    if (node.type === "CallExpression" && node.callee?.type === "Import" && node.arguments?.[0]?.type === "StringLiteral") {
      values.push(node.arguments[0].value);
    }
  });
  return values;
}

async function resolveServerImport(fromFile, specifier) {
  if (!specifier.startsWith(".")) return null;
  const raw = path.resolve(path.dirname(fromFile), specifier);
  const withoutJs = raw.replace(/\.(?:m?js|cjs)$/, "");
  const candidates = [raw, withoutJs + ".ts", withoutJs + ".tsx", path.join(withoutJs, "index.ts")];
  for (const candidate of candidates) {
    if (!candidate.startsWith(SERVER_DIR + path.sep)) continue;
    try {
      const source = await readFile(candidate, "utf8");
      return { filename: candidate, source };
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  return null;
}

async function activeRoleRoomClosure() {
  const indexFile = path.join(SERVER_DIR, "index.ts");
  const indexSource = await readFile(indexFile, "utf8");
  const indexAst = parseTypescript(indexSource, indexFile);
  const seedSpecs = importedSpecifiers(indexAst).filter((value) =>
    /(?:role-room|admin-room-role-room)/i.test(value),
  );
  const queue = [];
  for (const specifier of seedSpecs) {
    const resolved = await resolveServerImport(indexFile, specifier);
    if (resolved) queue.push(resolved);
  }

  const sources = new Map();
  const parseFailures = [];
  while (queue.length > 0) {
    const current = queue.shift();
    if (sources.has(current.filename) || current.filename.endsWith(".test.ts")) continue;
    sources.set(current.filename, current.source);
    let ast;
    try {
      ast = parseTypescript(current.source, current.filename);
    } catch (error) {
      parseFailures.push({ file: path.relative(BACKEND_DIR, current.filename), error: String(error?.message ?? error) });
      continue;
    }
    for (const specifier of importedSpecifiers(ast)) {
      const resolved = await resolveServerImport(current.filename, specifier);
      if (resolved && !sources.has(resolved.filename)) queue.push(resolved);
    }
  }
  return { sources, parseFailures, seedCount: seedSpecs.length };
}

function staticText(node) {
  if (node?.type === "StringLiteral") return node.value;
  if (node?.type !== "TemplateLiteral") return null;
  return node.quasis.map((part, index) =>
    part.value.cooked + (index < node.expressions.length ? " __DYNAMIC__ " : ""),
  ).join("");
}

function sqlLiterals(source, filename) {
  const ast = parseTypescript(source, filename);
  const sql = [];
  visit(ast, (node) => {
    if (node.type === "CallExpression") {
      const callee = node.callee;
      const isQuery = callee?.type === "MemberExpression"
        && ((callee.property?.type === "Identifier" && callee.property.name === "query")
          || (callee.property?.type === "StringLiteral" && callee.property.value === "query"));
      if (isQuery) {
        const value = staticText(node.arguments?.[0]);
        if (value) sql.push(value);
      }
    }
    if (node.type === "TaggedTemplateExpression" && node.tag?.type === "Identifier" && node.tag.name === "sql") {
      const value = staticText(node.quasi);
      if (value) sql.push(value);
    }
  });
  return sql;
}

function tableMatches(sql, pattern) {
  return [...sql.matchAll(pattern)].map((match) => match[1].toLowerCase());
}

function classifyTables(statements) {
  const reads = new Set();
  const writes = new Set();
  const creates = new Set();
  const altered = new Set();
  const physicalName = '(?:["`]?[a-z_][a-z0-9_]*["`]?\\.)?["`]?([a-z_][a-z0-9_]*)';
  for (const sql of statements) {
    const cteNames = new Set([
      ...tableMatches(sql, /\bWITH\s+([a-z_][a-z0-9_]*)\s+AS\s*\(/gi),
      ...tableMatches(sql, /,\s*([a-z_][a-z0-9_]*)\s+AS\s*\(/gi),
    ]);
    for (const table of tableMatches(sql, new RegExp(`\\b(?:FROM|JOIN)\\s+(?:ONLY\\s+)?${physicalName}`, "gi"))) {
      if (!cteNames.has(table)) reads.add(table);
    }
    for (const table of tableMatches(sql, new RegExp(`\\bINSERT\\s+INTO\\s+${physicalName}`, "gi"))) writes.add(table);
    for (const table of tableMatches(sql, new RegExp(`\\bUPDATE\\s+(?:ONLY\\s+)?${physicalName}`, "gi"))) writes.add(table);
    for (const table of tableMatches(sql, new RegExp(`\\bDELETE\\s+FROM\\s+(?:ONLY\\s+)?${physicalName}`, "gi"))) writes.add(table);
    for (const table of tableMatches(sql, new RegExp(`\\bCREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${physicalName}`, "gi"))) creates.add(table);
    for (const table of tableMatches(sql, new RegExp(`\\bCREATE\\s+(?:OR\\s+REPLACE\\s+)?(?:MATERIALIZED\\s+)?VIEW\\s+${physicalName}`, "gi"))) creates.add(table);
    for (const table of tableMatches(sql, new RegExp(`\\bALTER\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?${physicalName}`, "gi"))) altered.add(table);
  }
  creates.add("legacy_compat_store");
  reads.add("legacy_compat_store");
  writes.add("legacy_compat_store");
  for (const set of [reads, writes, creates, altered]) {
    set.delete("__dynamic__");
    set.delete("if");
    set.delete("information_schema");
    set.delete("jsonb_array_elements_text");
    set.delete("lateral");
    set.delete("set");
    set.delete("skip");
    set.delete("stuck");
    set.delete("updated_at");
    set.delete("tables");
  }
  return { reads, writes, creates, altered };
}

async function canonicalMigrationTables() {
  const filenames = (await readdir(MIGRATIONS_DIR)).filter((name) => name.endsWith(".sql"));
  const creates = new Set();
  const altered = new Set();
  for (const filename of filenames) {
    const sql = (await readFile(path.join(MIGRATIONS_DIR, filename), "utf8"))
      .replace(/--[^\n]*/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    const classified = classifyTables([sql]);
    for (const table of classified.creates) creates.add(table);
    for (const table of classified.altered) altered.add(table);
  }
  return { filenames, creates, altered };
}

async function liveSchema(tableNames) {
  if (!process.env.DATABASE_URL) throw new Error("--live requires DATABASE_URL");
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const identity = await client.query("SELECT current_database() AS database, current_user AS role");
    const result = await client.query(
      `SELECT table_name
         FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = ANY($1::text[])
        ORDER BY table_name`,
      [tableNames],
    );
    await client.query("ROLLBACK");
    return {
      database: identity.rows[0]?.database,
      role: identity.rows[0]?.role,
      tables: new Set(result.rows.map((row) => row.table_name)),
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

const closure = await activeRoleRoomClosure();
const statements = [];
for (const [filename, source] of closure.sources) {
  try {
    statements.push(...sqlLiterals(source, filename));
  } catch (error) {
    closure.parseFailures.push({ file: path.relative(BACKEND_DIR, filename), error: String(error?.message ?? error) });
  }
}
const flow = classifyTables(statements);
const migrations = await canonicalMigrationTables();
const referenced = new Set([...flow.reads, ...flow.writes]);
const readWrite = [...referenced].filter((table) => flow.reads.has(table) && flow.writes.has(table)).sort();
const runtimeCreateWithoutMigration = [...flow.creates].filter((table) => !migrations.creates.has(table)).sort();
const referencedWithCanonicalSchema = [...referenced].filter((table) => migrations.creates.has(table) || migrations.altered.has(table));
const referencedWithoutCanonicalSchema = [...referenced]
  .filter((table) => !migrations.creates.has(table) && !migrations.altered.has(table))
  .sort();

const report = {
  generatedAt: new Date().toISOString(),
  mode: LIVE ? "repository+live-read-only" : "repository",
  entryImports: closure.seedCount,
  activeModules: closure.sources.size,
  parseFailures: closure.parseFailures,
  sqlLiterals: statements.length,
  tables: {
    referenced: referenced.size,
    read: flow.reads.size,
    write: flow.writes.size,
    readAndWrite: readWrite.length,
    runtimeCreated: flow.creates.size,
    referencedWithCanonicalSchema: referencedWithCanonicalSchema.length,
  },
  runtimeCreateWithoutMigration,
  referencedWithoutCanonicalSchema,
};

if (LIVE) {
  const physical = [...new Set([...referencedWithCanonicalSchema, ...flow.creates])].sort();
  const live = await liveSchema(physical);
  report.live = {
    database: live.database,
    role: live.role,
    checkedTables: physical.length,
    presentTables: live.tables.size,
    missingTables: physical.filter((table) => !live.tables.has(table)),
  };
}

console.log(JSON.stringify(report, null, 2));
if (closure.parseFailures.length > 0 || runtimeCreateWithoutMigration.length > 0) process.exitCode = 1;
