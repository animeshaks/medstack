-- =============================================================================
-- V5__store_settings.sql
-- Store Profile & Invoice Header Configuration for Admin / Owner
-- =============================================================================

CREATE TABLE IF NOT EXISTS store_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_name VARCHAR(255) NOT NULL DEFAULT 'MedStack Pharmacy',
    tagline VARCHAR(255) DEFAULT 'Retail Chemists & Druggists',
    address TEXT DEFAULT 'Shop #12, Health Plaza, 100 Feet Road, Indiranagar',
    city VARCHAR(100) DEFAULT 'Bengaluru',
    state VARCHAR(100) DEFAULT 'Karnataka',
    pincode VARCHAR(20) DEFAULT '560038',
    phone VARCHAR(50) DEFAULT '+91 98765 43210',
    email VARCHAR(100) DEFAULT 'contact@medstackpharma.in',
    gstin VARCHAR(50) DEFAULT '29AABCS1429B1ZV',
    dl_number VARCHAR(50) DEFAULT 'KA-BLR-2024-1029',
    footer_note TEXT DEFAULT 'Medicines once sold can only be returned with original bill within 7 days. Wishing you good health!',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100) DEFAULT 'system',
    updated_by VARCHAR(100) DEFAULT 'system',
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

INSERT INTO store_settings (id, store_name, tagline, address, city, state, pincode, phone, email, gstin, dl_number, footer_note, created_by, updated_by)
VALUES (
    '51000000-0000-0000-0000-000000000001',
    'MedStack Pharmacy',
    'Retail Chemists & Druggists',
    'Shop #12, Health Plaza, 100 Feet Road, Indiranagar',
    'Bengaluru',
    'Karnataka',
    '560038',
    '+91 98765 43210',
    'contact@medstackpharma.in',
    '29AABCS1429B1ZV',
    'KA-BLR-2024-1029',
    'Medicines once sold can only be returned with original bill within 7 days. Wishing you good health!',
    'system',
    'system'
)
ON CONFLICT (id) DO NOTHING;

-- Add walk-in customer support to sales_orders
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255);
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(50);
