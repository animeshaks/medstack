-- =============================================================================
-- V15__seed_contraceptive_condom_medicines.sql
-- Insert demo condom records with 0% GST (exempted) for POS and testing
-- Uses non-conflicting IDs f1000000...0024 and f1000000...0025
-- =============================================================================

INSERT INTO medicines (
    id, name, generic_name, category, manufacturer, hsn_code, rack_location,
    requires_prescription, min_stock_alert_level, units_per_pack, symptoms,
    target_age_group, gst_rate, created_by, updated_by
)
VALUES
    ('f1000000-0000-0000-0000-000000000024', 'Durex Extra Thin Condoms (Pack of 3)', 'Male Latex Condom', 'OTC', 'Reckitt Benckiser', '4014', 'E-01', FALSE, 20, 3, 'Contraceptive, Family Planning', 'ADULT', 0.00, 'system', 'system'),
    ('f1000000-0000-0000-0000-000000000025', 'Manforce 3in1 Condoms (Pack of 3)',   'Male Latex Condom', 'OTC', 'Mankind Pharma',     '4014', 'E-02', FALSE, 25, 3, 'Contraceptive, Family Planning', 'ADULT', 0.00, 'system', 'system')
ON CONFLICT (id) DO NOTHING;

-- Seed initial stock batches for the demo condom medicines
INSERT INTO inventory_batches (
    id, item_id, batch_number, expiry_date, mrp, cost_price, selling_price,
    quantity, loose_quantity, is_retired, created_by, updated_by
)
VALUES
    ('b1000000-0000-0000-0000-000000000044', 'f1000000-0000-0000-0000-000000000024', 'DUR2401', (NOW() + INTERVAL '24 months')::DATE, 120.00, 75.00, 110.00, 50, 0, FALSE, 'system', 'system'),
    ('b1000000-0000-0000-0000-000000000045', 'f1000000-0000-0000-0000-000000000025', 'MAN2401', (NOW() + INTERVAL '24 months')::DATE, 90.00, 55.00, 80.00, 60, 0, FALSE, 'system', 'system')
ON CONFLICT (id) DO NOTHING;
