-- V10__purchase_schemes_and_discounts.sql
-- Scheme handling (free quantities like 10+2) and Discount handling on Purchase Orders

-- Add subtotal and PO-level discount fields to purchase_orders
ALTER TABLE purchase_orders 
    ADD COLUMN IF NOT EXISTS subtotal NUMERIC(14,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(14,2) DEFAULT 0;

-- Backfill subtotal for existing purchase orders
UPDATE purchase_orders 
SET subtotal = GREATEST(0, COALESCE(total_amount, 0) - COALESCE(tax_amount, 0))
WHERE subtotal IS NULL OR subtotal = 0;

-- Add scheme and line discount fields to purchase_order_items
ALTER TABLE purchase_order_items 
    ADD COLUMN IF NOT EXISTS free_quantity INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS scheme VARCHAR(50),
    ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS scheme_discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS taxable_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12,2) NOT NULL DEFAULT 0;

-- Backfill calculations for existing items
UPDATE purchase_order_items
SET 
    taxable_amount = ROUND(cost_price * quantity, 2),
    tax_amount = ROUND((cost_price * quantity) * (COALESCE(tax_percent, 0) / 100.0), 2),
    total_amount = ROUND((cost_price * quantity) + ((cost_price * quantity) * (COALESCE(tax_percent, 0) / 100.0)), 2)
WHERE taxable_amount = 0;
