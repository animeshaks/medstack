-- V11__purchase_receiving_discrepancy.sql
-- Support partial receiving, missing items, shortage quantities, and receiving notes

-- 1. Relax status check constraint on purchase_orders to allow PARTIALLY_RECEIVED
ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_status_check;
ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_status_check 
    CHECK (status IN ('PENDING', 'RECEIVED', 'PARTIALLY_RECEIVED'));

-- 2. Add receiving_notes to purchase_orders
ALTER TABLE purchase_orders
    ADD COLUMN IF NOT EXISTS receiving_notes VARCHAR(500);

-- 3. Add receiving verification columns to purchase_order_items
ALTER TABLE purchase_order_items
    ADD COLUMN IF NOT EXISTS received_quantity INTEGER,
    ADD COLUMN IF NOT EXISTS received_free_quantity INTEGER,
    ADD COLUMN IF NOT EXISTS item_status VARCHAR(30) DEFAULT 'PENDING',
    ADD COLUMN IF NOT EXISTS remarks VARCHAR(255);

-- 4. Backfill already received purchase order items
UPDATE purchase_order_items poi
SET 
    received_quantity = poi.quantity,
    received_free_quantity = poi.free_quantity,
    item_status = 'RECEIVED_FULL'
FROM purchase_orders po
WHERE poi.purchase_order_id = po.id AND po.status = 'RECEIVED';
