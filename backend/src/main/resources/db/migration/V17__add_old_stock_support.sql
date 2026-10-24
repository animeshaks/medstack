-- =============================================================================
-- V17__add_old_stock_support.sql
-- Add opening / old stock tracking columns and index to inventory_batches
-- =============================================================================

ALTER TABLE inventory_batches
    ADD COLUMN IF NOT EXISTS is_old_stock BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE inventory_batches
    ADD COLUMN IF NOT EXISTS stock_source VARCHAR(50) NOT NULL DEFAULT 'PURCHASE';

ALTER TABLE inventory_batches
    ADD COLUMN IF NOT EXISTS stock_notes VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_inventory_batches_old_stock ON inventory_batches(is_old_stock);
CREATE INDEX IF NOT EXISTS idx_inventory_batches_old_stock_active ON inventory_batches(is_old_stock, is_retired, is_deleted, quantity, loose_quantity);
