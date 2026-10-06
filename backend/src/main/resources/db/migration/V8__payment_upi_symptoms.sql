-- =============================================================================
-- V8__payment_upi_symptoms.sql
-- Relax payments check constraint to allow zero amounts (e.g. 100% points/discount)
-- Add upi_id to store_settings
-- Add symptoms and target_age_group to medicines
-- =============================================================================

-- 1. Relax payment amount check constraint
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_amount_check;
ALTER TABLE payments ADD CONSTRAINT payments_amount_check CHECK (amount >= 0);

-- 2. Add upi_id to store_settings
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS upi_id VARCHAR(100) DEFAULT 'medstack@okaxis';
UPDATE store_settings SET upi_id = 'medstack@okaxis' WHERE upi_id IS NULL;

-- 3. Add symptoms and target_age_group to medicines
ALTER TABLE medicines ADD COLUMN IF NOT EXISTS symptoms TEXT;
ALTER TABLE medicines ADD COLUMN IF NOT EXISTS target_age_group VARCHAR(50) DEFAULT 'ALL';

-- Create index for symptom text searches & age group
CREATE INDEX IF NOT EXISTS idx_medicines_age ON medicines(target_age_group);

-- 4. Backfill symptoms and age groups for existing medicines
UPDATE medicines SET symptoms = 'fever, mild to moderate body pain, headache, high temperature', target_age_group = 'ALL' WHERE id = 'f1000000-0000-0000-0000-000000000001';
UPDATE medicines SET symptoms = 'bacterial infection, ear infection, throat infection, dental abscess', target_age_group = 'ADULT' WHERE id = 'f1000000-0000-0000-0000-000000000002';
UPDATE medicines SET symptoms = 'type 2 diabetes, high blood sugar, glycemic control', target_age_group = 'ADULT' WHERE id = 'f1000000-0000-0000-0000-000000000003';
UPDATE medicines SET symptoms = 'high cholesterol, lipid management, cardiovascular protection', target_age_group = 'ADULT' WHERE id = 'f1000000-0000-0000-0000-000000000004';
UPDATE medicines SET symptoms = 'cold, allergy, runny nose, sneezing, itchy eyes, skin allergy', target_age_group = 'ALL' WHERE id = 'f1000000-0000-0000-0000-000000000005';
UPDATE medicines SET symptoms = 'acidity, heartburn, acid reflux, stomach ulcer, gastric burning', target_age_group = 'ADULT' WHERE id = 'f1000000-0000-0000-0000-000000000006';
UPDATE medicines SET symptoms = 'throat infection, chest infection, severe bacterial cough, sinusitis', target_age_group = 'ADULT' WHERE id = 'f1000000-0000-0000-0000-000000000007';
UPDATE medicines SET symptoms = 'acidity, gas, bloating, GERD, heartburn, stomach pain', target_age_group = 'ADULT' WHERE id = 'f1000000-0000-0000-0000-000000000008';
UPDATE medicines SET symptoms = 'viral fever, severe headache, dengue fever, joint pain, toothache', target_age_group = 'ADULT' WHERE id = 'f1000000-0000-0000-0000-000000000009';
UPDATE medicines SET symptoms = 'severe pain, inflammation, swelling, migraine, muscle pain', target_age_group = 'ADULT' WHERE id = 'f1000000-0000-0000-0000-000000000010';
UPDATE medicines SET symptoms = 'dry cough, throat irritation, allergic cough, nighttime coughing', target_age_group = 'ALL' WHERE id = 'f1000000-0000-0000-0000-000000000011';
UPDATE medicines SET symptoms = 'wound antiseptic, cuts, burns, skin infection prevention', target_age_group = 'ALL' WHERE id = 'f1000000-0000-0000-0000-000000000012';
UPDATE medicines SET symptoms = 'diarrhea, stomach infection, dysentery, loose motion, anaerobic infection', target_age_group = 'ADULT' WHERE id = 'f1000000-0000-0000-0000-000000000013';
UPDATE medicines SET symptoms = 'urinary tract infection, UTI, typhoid, bacterial diarrhea', target_age_group = 'ADULT' WHERE id = 'f1000000-0000-0000-0000-000000000014';
UPDATE medicines SET symptoms = 'vitamin D deficiency, bone weakness, joint fatigue, muscle pain', target_age_group = 'ALL' WHERE id = 'f1000000-0000-0000-0000-000000000015';
UPDATE medicines SET symptoms = 'general fatigue, weakness, mouth ulcers, neuropathy, vitamin deficiency', target_age_group = 'ALL' WHERE id = 'f1000000-0000-0000-0000-000000000016';
UPDATE medicines SET symptoms = 'type 1 diabetes, insulin-dependent hyperglycemia', target_age_group = 'ALL' WHERE id = 'f1000000-0000-0000-0000-000000000017';
UPDATE medicines SET symptoms = 'asthma attack, wheezing, shortness of breath, bronchospasm, COPD', target_age_group = 'ALL' WHERE id = 'f1000000-0000-0000-0000-000000000018';
UPDATE medicines SET symptoms = 'fungal skin infection, ringworm, athlete foot, skin itching, rash', target_age_group = 'ALL' WHERE id = 'f1000000-0000-0000-0000-000000000019';
UPDATE medicines SET symptoms = 'dehydration, vomiting, diarrhea, heat stroke, electrolyte imbalance', target_age_group = 'ALL' WHERE id = 'f1000000-0000-0000-0000-000000000020';

-- 5. Add Pediatric Medicines & Batches
INSERT INTO medicines (id, name, generic_name, category, manufacturer, hsn_code, rack_location, requires_prescription, min_stock_alert_level, units_per_pack, symptoms, target_age_group, created_by, updated_by)
VALUES
    ('f1000000-0000-0000-0000-000000000021', 'Calpol 120mg Pediatric Suspension', 'Paracetamol Paediatric 120mg/5ml', 'SYRUP', 'GlaxoSmithKline', '3004', 'P-01', FALSE, 25, 1, 'pediatric fever, child temperature, teething pain, post-vaccine fever', 'PEDIATRIC', 'system', 'system'),
    ('f1000000-0000-0000-0000-000000000022', 'Maxtra Pediatric Syrup 60ml', 'Phenylephrine + Chlorpheniramine', 'SYRUP', 'Zuventus Healthcare', '3004', 'P-02', FALSE, 20, 1, 'child cold, runny nose, pediatric cough, sneezing, blocked nose in kids', 'PEDIATRIC', 'system', 'system'),
    ('f1000000-0000-0000-0000-000000000023', 'Zincovit Pediatric Drops 15ml', 'Multivitamin & Zinc Drops', 'DROPS', 'Apex Laboratories', '3004', 'P-03', FALSE, 20, 1, 'infant vitamins, immunity, appetite loss in child, growth supplement', 'PEDIATRIC', 'system', 'system')
ON CONFLICT (id) DO UPDATE SET symptoms = EXCLUDED.symptoms, target_age_group = EXCLUDED.target_age_group;

-- Batches for pediatric medicines
INSERT INTO inventory_batches (id, item_id, batch_number, expiry_date, mrp, cost_price, selling_price, quantity, is_retired, created_by, updated_by)
VALUES
    ('b1000000-0000-0000-0000-000000000041', 'f1000000-0000-0000-0000-000000000021', 'CALP2401', (NOW() + INTERVAL '18 months')::DATE, 48.00, 30.00, 45.00, 120, FALSE, 'system', 'system'),
    ('b1000000-0000-0000-0000-000000000042', 'f1000000-0000-0000-0000-000000000022', 'MAX2401',  (NOW() + INTERVAL '16 months')::DATE, 75.00, 48.00, 70.00, 80,  FALSE, 'system', 'system'),
    ('b1000000-0000-0000-0000-000000000043', 'f1000000-0000-0000-0000-000000000023', 'ZINC2401', (NOW() + INTERVAL '20 months')::DATE, 62.00, 40.00, 58.00, 95,  FALSE, 'system', 'system')
ON CONFLICT (id) DO NOTHING;
