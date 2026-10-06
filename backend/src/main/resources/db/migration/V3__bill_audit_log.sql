-- V3: Ensure bill_audit_log indexes are present (idempotent additions)
-- The bill_audit_logs table was created in V1__initial_schema.sql
-- This migration is intentionally minimal as the table already exists.
CREATE INDEX IF NOT EXISTS idx_bill_audit_changed_at ON bill_audit_logs(changed_at);
