-- =============================================================================
-- V16__add_round_off_to_sales_orders.sql
-- Add round_off column to sales_orders for floor round figure accounting
-- =============================================================================

ALTER TABLE sales_orders
    ADD COLUMN IF NOT EXISTS round_off NUMERIC(5, 2) NOT NULL DEFAULT 0.00;
