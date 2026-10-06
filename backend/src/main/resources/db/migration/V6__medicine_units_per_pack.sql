-- V6: Medicine pack sizes, loose tablets dispensing, and reward points
-- Supports dispensing individual tablets (any count) and strip breaking.

-- 1. units_per_pack on medicines (e.g. 10 tablets per strip)
ALTER TABLE medicines
    ADD COLUMN IF NOT EXISTS units_per_pack INT NOT NULL DEFAULT 1;

-- 2. loose_quantity on inventory_batches (tablets remaining from opened strips)
ALTER TABLE inventory_batches
    ADD COLUMN IF NOT EXISTS loose_quantity INT NOT NULL DEFAULT 0;

-- 3. dispense details on sales_order_items (shows whether sold as TABLET or STRIP)
ALTER TABLE sales_order_items
    ADD COLUMN IF NOT EXISTS dispense_unit VARCHAR(30) NOT NULL DEFAULT 'UNIT',
    ADD COLUMN IF NOT EXISTS pack_size INT NOT NULL DEFAULT 1;

-- 4. reward points on sales_orders
ALTER TABLE sales_orders
    ADD COLUMN IF NOT EXISTS earned_points INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS redeemed_points INT NOT NULL DEFAULT 0;

-- Seed realistic units_per_pack for standard medicines
UPDATE medicines SET units_per_pack = 10  WHERE category ILIKE 'TABLET' OR category ILIKE 'CAPSULE';
UPDATE medicines SET units_per_pack = 10  WHERE name ILIKE '%paracetamol%';
UPDATE medicines SET units_per_pack = 10  WHERE name ILIKE '%amoxicillin%';
UPDATE medicines SET units_per_pack = 10  WHERE name ILIKE '%metformin%';
UPDATE medicines SET units_per_pack = 10  WHERE name ILIKE '%atorvastatin%';
UPDATE medicines SET units_per_pack = 10  WHERE name ILIKE '%omeprazole%';
UPDATE medicines SET units_per_pack = 10  WHERE name ILIKE '%cetirizine%';
UPDATE medicines SET units_per_pack = 14  WHERE name ILIKE '%pantoprazole%';
UPDATE medicines SET units_per_pack = 30  WHERE name ILIKE '%aspirin%';
UPDATE medicines SET units_per_pack = 1   WHERE category ILIKE 'SYRUP' OR category ILIKE 'INJECTION' OR category ILIKE 'CREAM' OR category ILIKE 'DROPS';
UPDATE medicines SET units_per_pack = 1   WHERE name ILIKE '%syrup%' OR name ILIKE '%injection%' OR name ILIKE '%drops%';
