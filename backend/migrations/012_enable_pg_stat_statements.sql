-- 012_enable_pg_stat_statements.sql
-- Purpose: Enable pg_stat_statements to allow slow query analysis in integrity checks.
-- This is idempotent and safe to run multiple times.

CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
