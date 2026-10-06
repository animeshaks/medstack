-- =============================================================================
-- V7__bill_store_snapshot.sql
-- Persist static store identity and contact information directly on Sales Orders
-- so historical bills remain immutable even when store settings are updated.
-- =============================================================================

ALTER TABLE sales_orders
    ADD COLUMN IF NOT EXISTS store_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS store_address TEXT,
    ADD COLUMN IF NOT EXISTS store_phone VARCHAR(50),
    ADD COLUMN IF NOT EXISTS store_email VARCHAR(100),
    ADD COLUMN IF NOT EXISTS store_gstin VARCHAR(50),
    ADD COLUMN IF NOT EXISTS store_dl_number VARCHAR(100);

-- Backfill existing sales orders with store settings if available
UPDATE sales_orders so
SET store_name = COALESCE(ss.store_name, 'MedStack Pharmacy'),
    store_address = COALESCE(ss.address || ', ' || ss.city || ', ' || ss.state || ' - ' || ss.pincode, 'Shop #12, Health Plaza, Indiranagar, Bengaluru - 560038'),
    store_phone = COALESCE(ss.phone, '+91 98765 43210'),
    store_email = COALESCE(ss.email, 'contact@medstackpharma.in'),
    store_gstin = COALESCE(ss.gstin, '29AABCS1429B1ZV'),
    store_dl_number = COALESCE(ss.dl_number, 'KA-BLR-2024-1029')
FROM (SELECT * FROM store_settings LIMIT 1) ss
WHERE so.store_name IS NULL;
