-- =============================================================================
-- V4__seed_dummy_data.sql
-- MedStack Pharmacy POS — Comprehensive Stress-Test / Demo Seed Data
-- Safe to re-run: all statements use INSERT ... ON CONFLICT DO NOTHING
-- =============================================================================

-- =============================================================================
-- SECTION 1: DOCTORS (10 records)
-- =============================================================================

INSERT INTO doctors (id, name, specialization, phone, email, clinic_hospital_name, registration_number, created_by, updated_by)
VALUES
    ('d1000000-0000-0000-0000-000000000001', 'Dr. Priya Sharma',  'General Physician', '9810012301', 'priya.sharma@gmail.com',   'Sharma Family Clinic',          'MH-GP-10234', 'system', 'system'),
    ('d1000000-0000-0000-0000-000000000002', 'Dr. Rajesh Kumar',  'Cardiologist',      '9820012302', 'rajesh.kumar@yahoo.com',    'Fortis Heart Institute',        'DL-CD-20891', 'system', 'system'),
    ('d1000000-0000-0000-0000-000000000003', 'Dr. Amit Verma',    'Dermatologist',     '9830012303', 'amit.verma@hotmail.com',    'Skin Care Centre',              'KA-DM-30142', 'system', 'system'),
    ('d1000000-0000-0000-0000-000000000004', 'Dr. Sunita Patel',  'Orthopedist',       '9840012304', 'sunita.patel@gmail.com',    'Apollo Orthopedic Clinic',      'GJ-OR-40567', 'system', 'system'),
    ('d1000000-0000-0000-0000-000000000005', 'Dr. Vikram Singh',  'Pediatrician',      '9850012305', 'vikram.singh@rediffmail.com','Rainbow Children Hospital',     'UP-PD-50388', 'system', 'system'),
    ('d1000000-0000-0000-0000-000000000006', 'Dr. Meera Nair',    'Diabetologist',     '9860012306', 'meera.nair@gmail.com',      'Narayana Diabetes Centre',      'KL-DB-60721', 'system', 'system'),
    ('d1000000-0000-0000-0000-000000000007', 'Dr. Arun Gupta',    'Neurologist',       '9870012307', 'arun.gupta@gmail.com',      'Max Neuro Institute',           'HR-NR-70219', 'system', 'system'),
    ('d1000000-0000-0000-0000-000000000008', 'Dr. Kavita Rao',    'Gynecologist',      '9880012308', 'kavita.rao@yahoo.com',      'Motherhood Hospital',           'TN-GY-80034', 'system', 'system'),
    ('d1000000-0000-0000-0000-000000000009', 'Dr. Suresh Reddy',  'ENT Specialist',    '9890012309', 'suresh.reddy@gmail.com',    'KIMS ENT Clinic',               'AP-EN-90447', 'system', 'system'),
    ('d1000000-0000-0000-0000-000000000010', 'Dr. Anita Joshi',   'Pulmonologist',     '9900012310', 'anita.joshi@gmail.com',     'Lung Care Super Specialty',     'RJ-PL-10912', 'system', 'system')
ON CONFLICT (registration_number) DO NOTHING;


-- =============================================================================
-- SECTION 2: CUSTOMERS (15 records)
-- =============================================================================

INSERT INTO customers (id, name, phone, email, address, reward_points, preferred_doctor_id, created_by, updated_by)
VALUES
    ('c1000000-0000-0000-0000-000000000001', 'Ramesh Agarwal',    '9711100001', 'ramesh.agarwal@gmail.com',    '12, Lajpat Nagar, New Delhi',           450, 'd1000000-0000-0000-0000-000000000001', 'system', 'system'),
    ('c1000000-0000-0000-0000-000000000002', 'Sunita Mehta',      '9711100002', 'sunita.mehta@yahoo.com',      '45, Bandra West, Mumbai',               220, 'd1000000-0000-0000-0000-000000000002', 'system', 'system'),
    ('c1000000-0000-0000-0000-000000000003', 'Aakash Trivedi',    '9711100003', 'aakash.trivedi@gmail.com',    '7, Koramangala 4th Block, Bengaluru',   310, 'd1000000-0000-0000-0000-000000000006', 'system', 'system'),
    ('c1000000-0000-0000-0000-000000000004', 'Lakshmi Krishnan',  '9711100004', 'lakshmi.krishnan@gmail.com',  '23, T Nagar, Chennai',                   75, 'd1000000-0000-0000-0000-000000000008', 'system', 'system'),
    ('c1000000-0000-0000-0000-000000000005', 'Manish Kapoor',     '9711100005', 'manish.kapoor@outlook.com',   '89, Sector 22, Chandigarh',             500, NULL, 'system', 'system'),
    ('c1000000-0000-0000-0000-000000000006', 'Preethi Balaji',    '9711100006', 'preethi.balaji@gmail.com',    '34, Jubilee Hills, Hyderabad',          130, 'd1000000-0000-0000-0000-000000000005', 'system', 'system'),
    ('c1000000-0000-0000-0000-000000000007', 'Deepak Jaiswal',    '9711100007', 'deepak.jaiswal@gmail.com',    '56, Salt Lake, Kolkata',                  0, NULL, 'system', 'system'),
    ('c1000000-0000-0000-0000-000000000008', 'Nandini Desai',     '9711100008', 'nandini.desai@yahoo.com',     '18, Paldi, Ahmedabad',                  280, 'd1000000-0000-0000-0000-000000000003', 'system', 'system'),
    ('c1000000-0000-0000-0000-000000000009', 'Santosh Pillai',    '9711100009', 'santosh.pillai@rediffmail.com','11, Kakkanad, Kochi',                   195, 'd1000000-0000-0000-0000-000000000009', 'system', 'system'),
    ('c1000000-0000-0000-0000-000000000010', 'Rekha Pandey',      '9711100010', 'rekha.pandey@gmail.com',      '3, Gomti Nagar, Lucknow',                55, NULL, 'system', 'system'),
    ('c1000000-0000-0000-0000-000000000011', 'Arjun Nambiar',     '9711100011', 'arjun.nambiar@gmail.com',     '67, Kozhikode, Kerala',                 420, 'd1000000-0000-0000-0000-000000000007', 'system', 'system'),
    ('c1000000-0000-0000-0000-000000000012', 'Geeta Chauhan',     '9711100012', 'geeta.chauhan@gmail.com',     '90, Tilak Nagar, Jaipur',               165, NULL, 'system', 'system'),
    ('c1000000-0000-0000-0000-000000000013', 'Firoz Ahmed',       '9711100013', 'firoz.ahmed@gmail.com',       '22, Abids, Hyderabad',                  340, 'd1000000-0000-0000-0000-000000000010', 'system', 'system'),
    ('c1000000-0000-0000-0000-000000000014', 'Shweta Bhatia',     '9711100014', 'shweta.bhatia@hotmail.com',   '5, Navrangpura, Ahmedabad',              10, NULL, 'system', 'system'),
    ('c1000000-0000-0000-0000-000000000015', 'Kiran Mistry',      '9711100015', 'kiran.mistry@gmail.com',      '48, Marine Lines, Mumbai',              385, 'd1000000-0000-0000-0000-000000000004', 'system', 'system')
ON CONFLICT DO NOTHING;


-- =============================================================================
-- SECTION 3: SUPPLIERS (5 records)
-- =============================================================================

INSERT INTO suppliers (id, name, contact_person, phone, email, gstin, dl_number, address, created_by, updated_by)
VALUES
    ('a1000000-0000-0000-0000-000000000001', 'Lifeline Pharma Distributors',  'Mahesh Agarwal',  '9312200001', 'lifeline@pharma.in',    '27AAACL5055K1ZV', 'MH/MUM/DL-101234', '14, Tardeo Road, Mumbai 400034',              'system', 'system'),
    ('a1000000-0000-0000-0000-000000000002', 'MedPlus Wholesale Hub',          'Praveen Shetty',  '9844200002', 'medplus.wh@gmail.com',  '29AABCM3128Q1ZP', 'KA/BLR/DL-204501', '78, Brigade Road, Bengaluru 560025',          'system', 'system'),
    ('a1000000-0000-0000-0000-000000000003', 'Shree Balaji Medical Agency',    'Ramkumar Verma',  '9521300003', 'balaji.med@yahoo.com',  '07AAHCS1391F1ZW', 'DL/EAST/DL-300987', '35, Chandni Chowk, Delhi 110006',            'system', 'system'),
    ('a1000000-0000-0000-0000-000000000004', 'Apollo Pharma Supply Chain',     'Deepa Pillai',    '9840400004', 'apollo.supply@in.com',  '33AACCA5678H1ZT', 'TN/CHN/DL-412345', '12, Anna Salai, Chennai 600002',             'system', 'system'),
    ('a1000000-0000-0000-0000-000000000005', 'Sahyadri Drug Distribution',     'Nilesh Kulkarni', '9011500005', 'sahyadri.dd@gmail.com', '27AABFS7890M1ZR', 'MH/PNQ/DL-598761', '21, FC Road, Pune 411004',                   'system', 'system')
ON CONFLICT DO NOTHING;


-- =============================================================================
-- SECTION 4: MEDICINES (20 records)
-- =============================================================================

INSERT INTO medicines (id, name, generic_name, category, manufacturer, hsn_code, rack_location, requires_prescription, min_stock_alert_level, created_by, updated_by)
VALUES
    ('f1000000-0000-0000-0000-000000000001', 'Paracetamol 500mg',       'Acetaminophen',         'TABLET',   'Cipla Ltd',          '3004', 'A-01', FALSE, 50,  'system', 'system'),
    ('f1000000-0000-0000-0000-000000000002', 'Amoxicillin 500mg',       'Amoxicillin',           'CAPSULE',  'Sun Pharma',         '3004', 'A-02', TRUE,  30,  'system', 'system'),
    ('f1000000-0000-0000-0000-000000000003', 'Metformin 500mg',         'Metformin HCl',         'TABLET',   'Lupin Ltd',          '3004', 'A-03', TRUE,  40,  'system', 'system'),
    ('f1000000-0000-0000-0000-000000000004', 'Atorvastatin 10mg',       'Atorvastatin',          'TABLET',   'Torrent Pharma',     '3004', 'A-04', TRUE,  30,  'system', 'system'),
    ('f1000000-0000-0000-0000-000000000005', 'Cetirizine 10mg',         'Cetirizine HCl',        'TABLET',   'Cipla Ltd',          '3004', 'A-05', FALSE, 50,  'system', 'system'),
    ('f1000000-0000-0000-0000-000000000006', 'Omeprazole 20mg',         'Omeprazole',            'CAPSULE',  'Dr. Reddy''s Labs',  '3004', 'B-01', FALSE, 30,  'system', 'system'),
    ('f1000000-0000-0000-0000-000000000007', 'Azithromycin 500mg',      'Azithromycin',          'TABLET',   'Abbott India',       '3004', 'B-02', TRUE,  25,  'system', 'system'),
    ('f1000000-0000-0000-0000-000000000008', 'Pantoprazole 40mg',       'Pantoprazole Sodium',   'TABLET',   'Alkem Labs',         '3004', 'B-03', FALSE, 40,  'system', 'system'),
    ('f1000000-0000-0000-0000-000000000009', 'Dolo 650mg',              'Paracetamol',           'TABLET',   'Micro Labs',         '3004', 'B-04', FALSE, 50,  'system', 'system'),
    ('f1000000-0000-0000-0000-000000000010', 'Ibuprofen 400mg',         'Ibuprofen',             'TABLET',   'Zydus Cadila',       '3004', 'B-05', FALSE, 50,  'system', 'system'),
    ('f1000000-0000-0000-0000-000000000011', 'Benadryl Cough Syrup',    'Diphenhydramine',       'SYRUP',    'Johnson & Johnson',  '3004', 'C-01', FALSE, 20,  'system', 'system'),
    ('f1000000-0000-0000-0000-000000000012', 'Betadine Solution',       'Povidone Iodine',       'CREAM',    'Win-Medicare',       '3003', 'C-02', FALSE, 15,  'system', 'system'),
    ('f1000000-0000-0000-0000-000000000013', 'Metronidazole 400mg',     'Metronidazole',         'TABLET',   'Alkem Labs',         '3004', 'C-03', TRUE,  30,  'system', 'system'),
    ('f1000000-0000-0000-0000-000000000014', 'Ciprofloxacin 500mg',     'Ciprofloxacin',         'TABLET',   'Sun Pharma',         '3004', 'C-04', TRUE,  25,  'system', 'system'),
    ('f1000000-0000-0000-0000-000000000015', 'Vitamin D3 60000IU',      'Cholecalciferol',       'CAPSULE',  'Abbott India',       '3004', 'C-05', FALSE, 20,  'system', 'system'),
    ('f1000000-0000-0000-0000-000000000016', 'B-Complex Forte',         'Vitamin B Complex',     'TABLET',   'Pfizer India',       '3004', 'D-01', FALSE, 40,  'system', 'system'),
    ('f1000000-0000-0000-0000-000000000017', 'Insulin Regular 40IU',    'Insulin',               'INJECTION','Novo Nordisk India', '3004', 'D-02', TRUE,  10,  'system', 'system'),
    ('f1000000-0000-0000-0000-000000000018', 'Salbutamol Inhaler',      'Salbutamol',            'INHALER',  'Cipla Ltd',          '3004', 'D-03', TRUE,  10,  'system', 'system'),
    ('f1000000-0000-0000-0000-000000000019', 'Clotrimazole Cream 1%',   'Clotrimazole',          'CREAM',    'Glenmark Pharma',    '3004', 'D-09', FALSE, 15,  'system', 'system'),
    ('f1000000-0000-0000-0000-000000000020', 'ORS Sachet',              'Oral Rehydration Salts','POWDER',   'Cipla Ltd',          '3003', 'D-10', FALSE, 30,  'system', 'system')
ON CONFLICT DO NOTHING;


-- =============================================================================
-- SECTION 5: INVENTORY BATCHES (40 records — ~2 per medicine)
-- Mix: 30 future (6-24 months), 5 near-expiry (30-90 days), 3 expired, 2 retired
-- =============================================================================

INSERT INTO inventory_batches (id, item_id, batch_number, expiry_date, mrp, cost_price, selling_price, quantity, is_retired, created_by, updated_by)
VALUES
-- ── Paracetamol 500mg ────────────────────────────────────────────────────────
    ('b1000000-0000-0000-0000-000000000001',
        'f1000000-0000-0000-0000-000000000001', 'PAR2401',
        (NOW() + INTERVAL '18 months')::DATE, 35.00, 22.00, 32.00, 300, FALSE, 'system', 'system'),
    ('b1000000-0000-0000-0000-000000000002',
        'f1000000-0000-0000-0000-000000000001', 'PAR2402',
        (NOW() + INTERVAL '9 months')::DATE,  35.00, 22.00, 32.00, 450, FALSE, 'system', 'system'),

-- ── Amoxicillin 500mg ────────────────────────────────────────────────────────
    ('b1000000-0000-0000-0000-000000000003',
        'f1000000-0000-0000-0000-000000000002', 'AMX2401',
        (NOW() + INTERVAL '20 months')::DATE, 120.00, 80.00, 110.00, 200, FALSE, 'system', 'system'),
    -- NEAR-EXPIRY batch
    ('b1000000-0000-0000-0000-000000000004',
        'f1000000-0000-0000-0000-000000000002', 'AMX2301',
        (NOW() + INTERVAL '45 days')::DATE,   120.00, 80.00, 110.00, 12, FALSE, 'system', 'system'),

-- ── Metformin 500mg ──────────────────────────────────────────────────────────
    ('b1000000-0000-0000-0000-000000000005',
        'f1000000-0000-0000-0000-000000000003', 'MET2401',
        (NOW() + INTERVAL '22 months')::DATE, 95.00, 60.00, 88.00, 350, FALSE, 'system', 'system'),
    ('b1000000-0000-0000-0000-000000000006',
        'f1000000-0000-0000-0000-000000000003', 'MET2402',
        (NOW() + INTERVAL '14 months')::DATE, 95.00, 62.00, 88.00, 280, FALSE, 'system', 'system'),

-- ── Atorvastatin 10mg ────────────────────────────────────────────────────────
    ('b1000000-0000-0000-0000-000000000007',
        'f1000000-0000-0000-0000-000000000004', 'ATV2401',
        (NOW() + INTERVAL '24 months')::DATE, 210.00, 135.00, 195.00, 180, FALSE, 'system', 'system'),
    -- NEAR-EXPIRY batch
    ('b1000000-0000-0000-0000-000000000008',
        'f1000000-0000-0000-0000-000000000004', 'ATV2301',
        (NOW() + INTERVAL '60 days')::DATE,   210.00, 135.00, 195.00, 8, FALSE, 'system', 'system'),

-- ── Cetirizine 10mg ──────────────────────────────────────────────────────────
    ('b1000000-0000-0000-0000-000000000009',
        'f1000000-0000-0000-0000-000000000005', 'CET2401',
        (NOW() + INTERVAL '16 months')::DATE, 55.00, 34.00, 50.00, 500, FALSE, 'system', 'system'),
    ('b1000000-0000-0000-0000-000000000010',
        'f1000000-0000-0000-0000-000000000005', 'CET2402',
        (NOW() + INTERVAL '8 months')::DATE,  55.00, 34.00, 50.00, 200, FALSE, 'system', 'system'),

-- ── Omeprazole 20mg ──────────────────────────────────────────────────────────
    ('b1000000-0000-0000-0000-000000000011',
        'f1000000-0000-0000-0000-000000000006', 'OMP2401',
        (NOW() + INTERVAL '21 months')::DATE, 88.00, 56.00, 80.00, 240, FALSE, 'system', 'system'),
    -- EXPIRED batch
    ('b1000000-0000-0000-0000-000000000012',
        'f1000000-0000-0000-0000-000000000006', 'OMP2201',
        (NOW() - INTERVAL '3 months')::DATE,  88.00, 56.00, 80.00, 30, FALSE, 'system', 'system'),

-- ── Azithromycin 500mg ───────────────────────────────────────────────────────
    ('b1000000-0000-0000-0000-000000000013',
        'f1000000-0000-0000-0000-000000000007', 'AZI2401',
        (NOW() + INTERVAL '15 months')::DATE, 145.00, 92.00, 135.00, 120, FALSE, 'system', 'system'),
    ('b1000000-0000-0000-0000-000000000014',
        'f1000000-0000-0000-0000-000000000007', 'AZI2402',
        (NOW() + INTERVAL '10 months')::DATE, 145.00, 92.00, 135.00, 100, FALSE, 'system', 'system'),

-- ── Pantoprazole 40mg ────────────────────────────────────────────────────────
    ('b1000000-0000-0000-0000-000000000015',
        'f1000000-0000-0000-0000-000000000008', 'PAN2401',
        (NOW() + INTERVAL '19 months')::DATE, 110.00, 70.00, 100.00, 320, FALSE, 'system', 'system'),
    ('b1000000-0000-0000-0000-000000000016',
        'f1000000-0000-0000-0000-000000000008', 'PAN2402',
        (NOW() + INTERVAL '11 months')::DATE, 110.00, 72.00, 100.00, 150, FALSE, 'system', 'system'),

-- ── Dolo 650mg ───────────────────────────────────────────────────────────────
    ('b1000000-0000-0000-0000-000000000017',
        'f1000000-0000-0000-0000-000000000009', 'DOL2401',
        (NOW() + INTERVAL '17 months')::DATE, 38.00, 24.00, 35.00, 400, FALSE, 'system', 'system'),
    -- NEAR-EXPIRY batch
    ('b1000000-0000-0000-0000-000000000018',
        'f1000000-0000-0000-0000-000000000009', 'DOL2301',
        (NOW() + INTERVAL '30 days')::DATE,   38.00, 24.00, 35.00, 15, FALSE, 'system', 'system'),

-- ── Ibuprofen 400mg ──────────────────────────────────────────────────────────
    ('b1000000-0000-0000-0000-000000000019',
        'f1000000-0000-0000-0000-000000000010', 'IBU2401',
        (NOW() + INTERVAL '20 months')::DATE, 62.00, 40.00, 58.00, 380, FALSE, 'system', 'system'),
    ('b1000000-0000-0000-0000-000000000020',
        'f1000000-0000-0000-0000-000000000010', 'IBU2402',
        (NOW() + INTERVAL '7 months')::DATE,  62.00, 40.00, 58.00, 200, FALSE, 'system', 'system'),

-- ── Benadryl Cough Syrup ─────────────────────────────────────────────────────
    ('b1000000-0000-0000-0000-000000000021',
        'f1000000-0000-0000-0000-000000000011', 'BEN2401',
        (NOW() + INTERVAL '12 months')::DATE, 95.00, 60.00, 88.00, 150, FALSE, 'system', 'system'),
    -- EXPIRED batch
    ('b1000000-0000-0000-0000-000000000022',
        'f1000000-0000-0000-0000-000000000011', 'BEN2201',
        (NOW() - INTERVAL '2 months')::DATE,  95.00, 60.00, 88.00, 20, FALSE, 'system', 'system'),

-- ── Betadine Solution ────────────────────────────────────────────────────────
    ('b1000000-0000-0000-0000-000000000023',
        'f1000000-0000-0000-0000-000000000012', 'BET2401',
        (NOW() + INTERVAL '23 months')::DATE, 125.00, 80.00, 115.00, 100, FALSE, 'system', 'system'),
    ('b1000000-0000-0000-0000-000000000024',
        'f1000000-0000-0000-0000-000000000012', 'BET2402',
        (NOW() + INTERVAL '13 months')::DATE, 125.00, 82.00, 115.00, 75, FALSE, 'system', 'system'),

-- ── Metronidazole 400mg ──────────────────────────────────────────────────────
    ('b1000000-0000-0000-0000-000000000025',
        'f1000000-0000-0000-0000-000000000013', 'MNZ2401',
        (NOW() + INTERVAL '18 months')::DATE, 42.00, 26.00, 38.00, 220, FALSE, 'system', 'system'),
    -- NEAR-EXPIRY batch
    ('b1000000-0000-0000-0000-000000000026',
        'f1000000-0000-0000-0000-000000000013', 'MNZ2301',
        (NOW() + INTERVAL '75 days')::DATE,   42.00, 26.00, 38.00, 10, FALSE, 'system', 'system'),

-- ── Ciprofloxacin 500mg ──────────────────────────────────────────────────────
    ('b1000000-0000-0000-0000-000000000027',
        'f1000000-0000-0000-0000-000000000014', 'CIP2401',
        (NOW() + INTERVAL '22 months')::DATE, 130.00, 83.00, 120.00, 160, FALSE, 'system', 'system'),
    ('b1000000-0000-0000-0000-000000000028',
        'f1000000-0000-0000-0000-000000000014', 'CIP2402',
        (NOW() + INTERVAL '6 months')::DATE,  130.00, 85.00, 120.00, 90, FALSE, 'system', 'system'),

-- ── Vitamin D3 60000IU ───────────────────────────────────────────────────────
    ('b1000000-0000-0000-0000-000000000029',
        'f1000000-0000-0000-0000-000000000015', 'VD32401',
        (NOW() + INTERVAL '24 months')::DATE, 195.00, 125.00, 180.00, 200, FALSE, 'system', 'system'),
    ('b1000000-0000-0000-0000-000000000030',
        'f1000000-0000-0000-0000-000000000015', 'VD32402',
        (NOW() + INTERVAL '16 months')::DATE, 195.00, 128.00, 180.00, 120, FALSE, 'system', 'system'),

-- ── B-Complex Forte ──────────────────────────────────────────────────────────
    ('b1000000-0000-0000-0000-000000000031',
        'f1000000-0000-0000-0000-000000000016', 'BCF2401',
        (NOW() + INTERVAL '20 months')::DATE, 75.00, 48.00, 68.00, 280, FALSE, 'system', 'system'),
    ('b1000000-0000-0000-0000-000000000032',
        'f1000000-0000-0000-0000-000000000016', 'BCF2402',
        (NOW() + INTERVAL '10 months')::DATE, 75.00, 48.00, 68.00, 180, FALSE, 'system', 'system'),

-- ── Insulin Regular 40IU — RETIRED batch ────────────────────────────────────
    ('b1000000-0000-0000-0000-000000000033',
        'f1000000-0000-0000-0000-000000000017', 'INS2401',
        (NOW() + INTERVAL '14 months')::DATE, 420.00, 265.00, 395.00, 80, FALSE, 'system', 'system'),
    -- RETIRED batch (damaged stock recalled)
    ('b1000000-0000-0000-0000-000000000034',
        'f1000000-0000-0000-0000-000000000017', 'INS2301',
        (NOW() + INTERVAL '6 months')::DATE,  420.00, 265.00, 395.00, 15, TRUE,  'system', 'system'),

-- ── Salbutamol Inhaler ───────────────────────────────────────────────────────
    ('b1000000-0000-0000-0000-000000000035',
        'f1000000-0000-0000-0000-000000000018', 'SAL2401',
        (NOW() + INTERVAL '18 months')::DATE, 350.00, 220.00, 330.00, 60, FALSE, 'system', 'system'),
    -- RETIRED batch (manufacturing defect)
    ('b1000000-0000-0000-0000-000000000036',
        'f1000000-0000-0000-0000-000000000018', 'SAL2301',
        (NOW() + INTERVAL '4 months')::DATE,  350.00, 220.00, 330.00, 5, TRUE,  'system', 'system'),

-- ── Clotrimazole Cream 1% ────────────────────────────────────────────────────
    ('b1000000-0000-0000-0000-000000000037',
        'f1000000-0000-0000-0000-000000000019', 'CLO2401',
        (NOW() + INTERVAL '21 months')::DATE, 85.00, 54.00, 78.00, 130, FALSE, 'system', 'system'),
    ('b1000000-0000-0000-0000-000000000038',
        'f1000000-0000-0000-0000-000000000019', 'CLO2402',
        (NOW() + INTERVAL '12 months')::DATE, 85.00, 54.00, 78.00, 90, FALSE, 'system', 'system'),

-- ── ORS Sachet ───────────────────────────────────────────────────────────────
    ('b1000000-0000-0000-0000-000000000039',
        'f1000000-0000-0000-0000-000000000020', 'ORS2401',
        (NOW() + INTERVAL '24 months')::DATE, 22.00, 13.00, 20.00, 500, FALSE, 'system', 'system'),
    -- EXPIRED batch
    ('b1000000-0000-0000-0000-000000000040',
        'f1000000-0000-0000-0000-000000000020', 'ORS2201',
        (NOW() - INTERVAL '1 month')::DATE,   22.00, 13.00, 20.00, 50, FALSE, 'system', 'system')

ON CONFLICT (item_id, batch_number) DO NOTHING;


-- =============================================================================
-- SECTION 6 & 7: PURCHASE ORDERS (5 records — 2 PENDING, 3 RECEIVED)
-- =============================================================================

INSERT INTO purchase_orders (id, supplier_id, invoice_number, invoice_date, total_amount, tax_amount, status, created_by, updated_by)
VALUES
    ('11000000-0000-0000-0000-000000000001',
        'a1000000-0000-0000-0000-000000000001', 'INV-LPD-2024-0081',
        (NOW() - INTERVAL '25 days')::DATE,  18500.00, 1850.00, 'RECEIVED', 'system', 'system'),
    ('11000000-0000-0000-0000-000000000002',
        'a1000000-0000-0000-0000-000000000002', 'INV-MPW-2024-0193',
        (NOW() - INTERVAL '18 days')::DATE,  32400.00, 3240.00, 'RECEIVED', 'system', 'system'),
    ('11000000-0000-0000-0000-000000000003',
        'a1000000-0000-0000-0000-000000000003', 'INV-SBM-2024-0042',
        (NOW() - INTERVAL '10 days')::DATE,  22750.00, 2275.00, 'RECEIVED', 'system', 'system'),
    ('11000000-0000-0000-0000-000000000004',
        'a1000000-0000-0000-0000-000000000004', 'INV-APS-2024-0309',
        (NOW() - INTERVAL '3 days')::DATE,   15900.00, 1590.00, 'PENDING',  'system', 'system'),
    ('11000000-0000-0000-0000-000000000005',
        'a1000000-0000-0000-0000-000000000005', 'INV-SDD-2024-0077',
        (NOW() - INTERVAL '1 day')::DATE,    28600.00, 2860.00, 'PENDING',  'system', 'system')
ON CONFLICT DO NOTHING;


-- =============================================================================
-- SECTION 8: PURCHASE ORDER ITEMS (15 records — 3 per purchase order)
-- =============================================================================

INSERT INTO purchase_order_items (id, purchase_order_id, item_id, batch_number, expiry_date, quantity, cost_price, tax_percent, mrp, created_by, updated_by)
VALUES
-- PO 1
    ('12000000-0000-0000-0000-000000000001',
        '11000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001',
        'PAR2401', (NOW() + INTERVAL '18 months')::DATE, 500, 22.00, 12.00, 35.00, 'system', 'system'),
    ('12000000-0000-0000-0000-000000000002',
        '11000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000005',
        'CET2401', (NOW() + INTERVAL '16 months')::DATE, 300, 34.00, 12.00, 55.00, 'system', 'system'),
    ('12000000-0000-0000-0000-000000000003',
        '11000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000009',
        'DOL2401', (NOW() + INTERVAL '17 months')::DATE, 400, 24.00, 12.00, 38.00, 'system', 'system'),

-- PO 2
    ('12000000-0000-0000-0000-000000000004',
        '11000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000002',
        'AMX2401', (NOW() + INTERVAL '20 months')::DATE, 200, 80.00, 18.00, 120.00, 'system', 'system'),
    ('12000000-0000-0000-0000-000000000005',
        '11000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000007',
        'AZI2401', (NOW() + INTERVAL '15 months')::DATE, 150, 92.00, 18.00, 145.00, 'system', 'system'),
    ('12000000-0000-0000-0000-000000000006',
        '11000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000017',
        'INS2401', (NOW() + INTERVAL '14 months')::DATE, 80,  265.00, 5.00, 420.00, 'system', 'system'),

-- PO 3
    ('12000000-0000-0000-0000-000000000007',
        '11000000-0000-0000-0000-000000000003', 'f1000000-0000-0000-0000-000000000003',
        'MET2401', (NOW() + INTERVAL '22 months')::DATE, 350, 60.00, 12.00, 95.00, 'system', 'system'),
    ('12000000-0000-0000-0000-000000000008',
        '11000000-0000-0000-0000-000000000003', 'f1000000-0000-0000-0000-000000000004',
        'ATV2401', (NOW() + INTERVAL '24 months')::DATE, 180, 135.00, 12.00, 210.00, 'system', 'system'),
    ('12000000-0000-0000-0000-000000000009',
        '11000000-0000-0000-0000-000000000003', 'f1000000-0000-0000-0000-000000000018',
        'SAL2401', (NOW() + INTERVAL '18 months')::DATE, 60, 220.00, 12.00, 350.00, 'system', 'system'),

-- PO 4 (PENDING)
    ('12000000-0000-0000-0000-000000000010',
        '11000000-0000-0000-0000-000000000004', 'f1000000-0000-0000-0000-000000000015',
        'VD32401', (NOW() + INTERVAL '24 months')::DATE, 200, 125.00, 12.00, 195.00, 'system', 'system'),
    ('12000000-0000-0000-0000-000000000011',
        '11000000-0000-0000-0000-000000000004', 'f1000000-0000-0000-0000-000000000016',
        'BCF2401', (NOW() + INTERVAL '20 months')::DATE, 280, 48.00, 12.00, 75.00, 'system', 'system'),
    ('12000000-0000-0000-0000-000000000012',
        '11000000-0000-0000-0000-000000000004', 'f1000000-0000-0000-0000-000000000020',
        'ORS2401', (NOW() + INTERVAL '24 months')::DATE, 500, 13.00, 5.00,  22.00, 'system', 'system'),

-- PO 5 (PENDING)
    ('12000000-0000-0000-0000-000000000013',
        '11000000-0000-0000-0000-000000000005', 'f1000000-0000-0000-0000-000000000008',
        'PAN2401', (NOW() + INTERVAL '19 months')::DATE, 320, 70.00, 12.00, 110.00, 'system', 'system'),
    ('12000000-0000-0000-0000-000000000014',
        '11000000-0000-0000-0000-000000000005', 'f1000000-0000-0000-0000-000000000011',
        'BEN2401', (NOW() + INTERVAL '12 months')::DATE, 150, 60.00, 18.00, 95.00, 'system', 'system'),
    ('12000000-0000-0000-0000-000000000015',
        '11000000-0000-0000-0000-000000000005', 'f1000000-0000-0000-0000-000000000019',
        'CLO2401', (NOW() + INTERVAL '21 months')::DATE, 130, 54.00, 18.00, 85.00, 'system', 'system')
ON CONFLICT DO NOTHING;


-- =============================================================================
-- SECTION 9: EXPENSES (10 records — last 30 days)
-- logged_by references the admin user by username lookup
-- =============================================================================

INSERT INTO expenses (id, category, amount, description, expense_date, logged_by, created_by, updated_by)
VALUES
    ('e1000000-0000-0000-0000-000000000001',
        'RENT',        45000.00, 'Monthly shop rent — October 2026',
        (NOW() - INTERVAL '30 days')::DATE,
        (SELECT id FROM users WHERE username = 'admin' LIMIT 1), 'system', 'system'),
    ('e1000000-0000-0000-0000-000000000002',
        'ELECTRICITY', 8200.00,  'Electricity bill — September 2026',
        (NOW() - INTERVAL '28 days')::DATE,
        (SELECT id FROM users WHERE username = 'admin' LIMIT 1), 'system', 'system'),
    ('e1000000-0000-0000-0000-000000000003',
        'SALARY',      32000.00, 'Staff salary — October 2026 (pharmacist)',
        (NOW() - INTERVAL '25 days')::DATE,
        (SELECT id FROM users WHERE username = 'admin' LIMIT 1), 'system', 'system'),
    ('e1000000-0000-0000-0000-000000000004',
        'SALARY',      22000.00, 'Staff salary — October 2026 (counter staff)',
        (NOW() - INTERVAL '25 days')::DATE,
        (SELECT id FROM users WHERE username = 'admin' LIMIT 1), 'system', 'system'),
    ('e1000000-0000-0000-0000-000000000005',
        'SUPPLIES',    3500.00,  'Stationery, billing rolls and carry bags',
        (NOW() - INTERVAL '20 days')::DATE,
        (SELECT id FROM users WHERE username = 'owner' LIMIT 1), 'system', 'system'),
    ('e1000000-0000-0000-0000-000000000006',
        'MAINTENANCE', 4800.00,  'AC servicing and cold storage repair',
        (NOW() - INTERVAL '15 days')::DATE,
        (SELECT id FROM users WHERE username = 'owner' LIMIT 1), 'system', 'system'),
    ('e1000000-0000-0000-0000-000000000007',
        'MARKETING',   6000.00,  'Local newspaper ad and pamphlet distribution',
        (NOW() - INTERVAL '12 days')::DATE,
        (SELECT id FROM users WHERE username = 'admin' LIMIT 1), 'system', 'system'),
    ('e1000000-0000-0000-0000-000000000008',
        'ELECTRICITY', 1200.00,  'Generator fuel charges',
        (NOW() - INTERVAL '8 days')::DATE,
        (SELECT id FROM users WHERE username = 'owner' LIMIT 1), 'system', 'system'),
    ('e1000000-0000-0000-0000-000000000009',
        'SUPPLIES',    950.00,   'Hand gloves, masks and sanitiser refill',
        (NOW() - INTERVAL '5 days')::DATE,
        (SELECT id FROM users WHERE username = 'staff' LIMIT 1), 'system', 'system'),
    ('e1000000-0000-0000-0000-000000000010',
        'MAINTENANCE', 2200.00,  'CCTV camera maintenance and DVR replacement',
        (NOW() - INTERVAL '2 days')::DATE,
        (SELECT id FROM users WHERE username = 'owner' LIMIT 1), 'system', 'system')
ON CONFLICT DO NOTHING;


-- =============================================================================
-- SECTION 10: SALES ORDERS (8 complete bills)
-- Note: order_status uses CONFIRMED (not COMPLETED per schema CHECK constraint)
--       grand_total = total_amount - discount_amount + tax_amount
-- =============================================================================

INSERT INTO sales_orders (id, bill_number, customer_id, user_id, prescribing_doctor_id, total_amount, discount_amount, tax_amount, grand_total, payment_status, order_status, created_by, updated_by)
VALUES
    -- Bill 1: OTC medicines, no prescription needed, CASH payment
    ('21000000-0000-0000-0000-000000000001',
        'MS-000001',
        'c1000000-0000-0000-0000-000000000001',
        (SELECT id FROM users WHERE username = 'admin' LIMIT 1),
        NULL,
        267.00, 13.00, 32.04, 286.04, 'PAID', 'CONFIRMED', 'system', 'system'),

    -- Bill 2: Prescription medicines, doctor attached, UPI payment
    ('21000000-0000-0000-0000-000000000002',
        'MS-000002',
        'c1000000-0000-0000-0000-000000000002',
        (SELECT id FROM users WHERE username = 'admin' LIMIT 1),
        'd1000000-0000-0000-0000-000000000002',
        305.00, 0.00, 36.60, 341.60, 'PAID', 'CONFIRMED', 'system', 'system'),

    -- Bill 3: Diabetic patient, Metformin, CASH payment
    ('21000000-0000-0000-0000-000000000003',
        'MS-000003',
        'c1000000-0000-0000-0000-000000000003',
        (SELECT id FROM users WHERE username = 'admin' LIMIT 1),
        'd1000000-0000-0000-0000-000000000006',
        264.00, 26.40, 28.51, 266.11, 'PAID', 'CONFIRMED', 'system', 'system'),

    -- Bill 4: Walk-in customer (no customer record), CARD payment
    ('21000000-0000-0000-0000-000000000004',
        'MS-000004',
        NULL,
        (SELECT id FROM users WHERE username = 'staff' LIMIT 1),
        NULL,
        150.00, 0.00, 18.00, 168.00, 'PAID', 'CONFIRMED', 'system', 'system'),

    -- Bill 5: Antibiotic + OTC combo, CASH payment
    ('21000000-0000-0000-0000-000000000005',
        'MS-000005',
        'c1000000-0000-0000-0000-000000000005',
        (SELECT id FROM users WHERE username = 'staff' LIMIT 1),
        'd1000000-0000-0000-0000-000000000001',
        540.00, 54.00, 58.32, 544.32, 'PAID', 'CONFIRMED', 'system', 'system'),

    -- Bill 6: Cardiac patient, UPI payment
    ('21000000-0000-0000-0000-000000000006',
        'MS-000006',
        'c1000000-0000-0000-0000-000000000011',
        (SELECT id FROM users WHERE username = 'admin' LIMIT 1),
        'd1000000-0000-0000-0000-000000000007',
        585.00, 0.00, 70.20, 655.20, 'PAID', 'CONFIRMED', 'system', 'system'),

    -- Bill 7: Vitamins and supplements, NETBANKING payment
    ('21000000-0000-0000-0000-000000000007',
        'MS-000007',
        'c1000000-0000-0000-0000-000000000008',
        (SELECT id FROM users WHERE username = 'staff' LIMIT 1),
        NULL,
        453.00, 45.30, 48.91, 456.61, 'PAID', 'CONFIRMED', 'system', 'system'),

    -- Bill 8: Multi-medicine prescription bill, CARD payment
    ('21000000-0000-0000-0000-000000000008',
        'MS-000008',
        'c1000000-0000-0000-0000-000000000013',
        (SELECT id FROM users WHERE username = 'admin' LIMIT 1),
        'd1000000-0000-0000-0000-000000000010',
        660.00, 33.00, 75.24, 702.24, 'PAID', 'CONFIRMED', 'system', 'system')
ON CONFLICT (bill_number) DO NOTHING;


-- =============================================================================
-- SALES ORDER ITEMS (2–3 items per bill = 22 total items)
-- =============================================================================

INSERT INTO sales_order_items (id, order_id, inventory_batch_id, quantity, unit_price, tax_rate, subtotal, created_by, updated_by)
VALUES
-- ── Bill 1 items (OTC: Paracetamol + Cetirizine + ORS) ──────────────────────
    ('31000000-0000-0000-0000-000000000001',
        '21000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001',
        3, 32.00, 12.00, 96.00, 'system', 'system'),
    ('31000000-0000-0000-0000-000000000002',
        '21000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000009',
        2, 50.00, 12.00, 100.00, 'system', 'system'),
    ('31000000-0000-0000-0000-000000000003',
        '21000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000039',
        5, 20.00, 5.00, 100.00, 'system', 'system'),

-- ── Bill 2 items (Rx: Atorvastatin + Pantoprazole) ───────────────────────────
    ('31000000-0000-0000-0000-000000000004',
        '21000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000007',
        1, 195.00, 12.00, 195.00, 'system', 'system'),
    ('31000000-0000-0000-0000-000000000005',
        '21000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000015',
        1, 100.00, 12.00, 100.00, 'system', 'system'),

-- ── Bill 3 items (Metformin + Dolo + Ibuprofen) ──────────────────────────────
    ('31000000-0000-0000-0000-000000000006',
        '21000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000005',
        2, 88.00, 12.00, 176.00, 'system', 'system'),
    ('31000000-0000-0000-0000-000000000007',
        '21000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000017',
        1, 35.00, 12.00, 35.00, 'system', 'system'),
    ('31000000-0000-0000-0000-000000000008',
        '21000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000019',
        1, 58.00, 12.00, 58.00, 'system', 'system'),

-- ── Bill 4 items (Walk-in: Benadryl + Betadine) ─────────────────────────────
    ('31000000-0000-0000-0000-000000000009',
        '21000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000021',
        1, 88.00, 18.00, 88.00, 'system', 'system'),
    ('31000000-0000-0000-0000-000000000010',
        '21000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000023',
        1, 115.00, 18.00, 115.00, 'system', 'system'),

-- ── Bill 5 items (Amoxicillin + Dolo + Cetirizine) ──────────────────────────
    ('31000000-0000-0000-0000-000000000011',
        '21000000-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000003',
        3, 110.00, 18.00, 330.00, 'system', 'system'),
    ('31000000-0000-0000-0000-000000000012',
        '21000000-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000017',
        2, 35.00, 12.00, 70.00, 'system', 'system'),
    ('31000000-0000-0000-0000-000000000013',
        '21000000-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000010',
        2, 58.00, 12.00, 116.00, 'system', 'system'),

-- ── Bill 6 items (Atorvastatin + Salbutamol) ─────────────────────────────────
    ('31000000-0000-0000-0000-000000000014',
        '21000000-0000-0000-0000-000000000006', 'b1000000-0000-0000-0000-000000000007',
        2, 195.00, 12.00, 390.00, 'system', 'system'),
    ('31000000-0000-0000-0000-000000000015',
        '21000000-0000-0000-0000-000000000006', 'b1000000-0000-0000-0000-000000000035',
        1, 330.00, 18.00, 330.00, 'system', 'system'),

-- ── Bill 7 items (Vitamin D3 + B-Complex) ────────────────────────────────────
    ('31000000-0000-0000-0000-000000000016',
        '21000000-0000-0000-0000-000000000007', 'b1000000-0000-0000-0000-000000000029',
        2, 180.00, 12.00, 360.00, 'system', 'system'),
    ('31000000-0000-0000-0000-000000000017',
        '21000000-0000-0000-0000-000000000007', 'b1000000-0000-0000-0000-000000000031',
        1, 68.00, 12.00, 68.00, 'system', 'system'),

-- ── Bill 8 items (Azithromycin + Metronidazole + Clotrimazole) ───────────────
    ('31000000-0000-0000-0000-000000000018',
        '21000000-0000-0000-0000-000000000008', 'b1000000-0000-0000-0000-000000000013',
        3, 135.00, 18.00, 405.00, 'system', 'system'),
    ('31000000-0000-0000-0000-000000000019',
        '21000000-0000-0000-0000-000000000008', 'b1000000-0000-0000-0000-000000000025',
        2, 38.00, 12.00, 76.00, 'system', 'system'),
    ('31000000-0000-0000-0000-000000000020',
        '21000000-0000-0000-0000-000000000008', 'b1000000-0000-0000-0000-000000000037',
        2, 78.00, 18.00, 156.00, 'system', 'system')
ON CONFLICT DO NOTHING;


-- =============================================================================
-- PAYMENTS (1 payment per bill — mix of CASH, UPI, CARD, NETBANKING)
-- =============================================================================

INSERT INTO payments (id, order_id, payment_method, transaction_ref, amount, payment_time, created_by, updated_by)
VALUES
    ('41000000-0000-0000-0000-000000000001',
        '21000000-0000-0000-0000-000000000001', 'CASH',       NULL,              286.04,
        NOW() - INTERVAL '29 days', 'system', 'system'),
    ('41000000-0000-0000-0000-000000000002',
        '21000000-0000-0000-0000-000000000002', 'UPI',        'UPI-TXN-9A3F21B', 341.60,
        NOW() - INTERVAL '25 days', 'system', 'system'),
    ('41000000-0000-0000-0000-000000000003',
        '21000000-0000-0000-0000-000000000003', 'CASH',       NULL,              266.11,
        NOW() - INTERVAL '22 days', 'system', 'system'),
    ('41000000-0000-0000-0000-000000000004',
        '21000000-0000-0000-0000-000000000004', 'CARD',       'CARD-TXN-4D7E90C', 168.00,
        NOW() - INTERVAL '18 days', 'system', 'system'),
    ('41000000-0000-0000-0000-000000000005',
        '21000000-0000-0000-0000-000000000005', 'CASH',       NULL,              544.32,
        NOW() - INTERVAL '14 days', 'system', 'system'),
    ('41000000-0000-0000-0000-000000000006',
        '21000000-0000-0000-0000-000000000006', 'UPI',        'UPI-TXN-7C1A55D', 655.20,
        NOW() - INTERVAL '10 days', 'system', 'system'),
    ('41000000-0000-0000-0000-000000000007',
        '21000000-0000-0000-0000-000000000007', 'NETBANKING', 'NB-TXN-2F8B43E',  456.61,
        NOW() - INTERVAL '6 days', 'system', 'system'),
    ('41000000-0000-0000-0000-000000000008',
        '21000000-0000-0000-0000-000000000008', 'CARD',       'CARD-TXN-8H2K17F', 702.24,
        NOW() - INTERVAL '2 days', 'system', 'system')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- END OF V4 SEED DATA
-- Summary:
--   10 doctors | 15 customers | 5 suppliers | 20 medicines
--   40 inventory batches (30 future, 5 near-expiry, 3 expired, 2 retired)
--   5 purchase orders (3 RECEIVED, 2 PENDING) + 15 PO items
--   10 expenses
--   8 sales orders (CONFIRMED+PAID) + 20 sales items + 8 payments
-- =============================================================================
