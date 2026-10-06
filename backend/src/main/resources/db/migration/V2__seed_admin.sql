-- DEV SEED DATA ONLY - DO NOT USE IN PRODUCTION

-- USERS
-- admin: Admin@123
INSERT INTO users (id, username, password_hash, full_name, role, status, created_by, updated_by)
VALUES (gen_random_uuid(), 'admin', '$2a$10$lst6aN5KnyWF4yxTKcfL6uTvf4swVrxltWcHx3xoT1GH0rwwBD4Rm', 'System Admin', 'ADMIN', 'ACTIVE', 'system', 'system');

-- owner: Owner@123
INSERT INTO users (id, username, password_hash, full_name, role, status, created_by, updated_by)
VALUES (gen_random_uuid(), 'owner', '$2a$10$7fgxqqTkjqjma9RDUvbBAeVU4Po1nOikYX5YF7OWqmyygwBFKe1K.', 'Store Owner', 'OWNER', 'ACTIVE', 'system', 'system');

-- staff: Staff@123
INSERT INTO users (id, username, password_hash, full_name, role, status, created_by, updated_by)
VALUES (gen_random_uuid(), 'staff', '$2a$10$LWUk6e1FR82Eke5L7Ux5Kem8CnSbD7SlLDkosUzdyOa//6HKffZgm', 'Sales Staff', 'STAFF', 'ACTIVE', 'system', 'system');

-- DOCTORS
INSERT INTO doctors (id, name, specialization, phone, clinic_hospital_name, created_by, updated_by)
VALUES 
    (gen_random_uuid(), 'Dr. Smith', 'General Physician', '1234567890', 'City Clinic', 'system', 'system'),
    (gen_random_uuid(), 'Dr. Jones', 'Cardiologist', '0987654321', 'Heart Hospital', 'system', 'system');

-- SUPPLIERS
INSERT INTO suppliers (id, name, contact_person, phone, created_by, updated_by)
VALUES 
    (gen_random_uuid(), 'Pharma Distributors Inc.', 'John Doe', '1112223334', 'system', 'system'),
    (gen_random_uuid(), 'MediSupply Co.', 'Jane Smith', '4445556667', 'system', 'system');

-- MEDICINES
INSERT INTO medicines (id, name, generic_name, category, manufacturer, requires_prescription, created_by, updated_by)
VALUES 
    (gen_random_uuid(), 'Paracetamol 500mg', 'Paracetamol', 'Analgesic', 'ABC Pharma', false, 'system', 'system'),
    (gen_random_uuid(), 'Amoxicillin 250mg', 'Amoxicillin', 'Antibiotic', 'XYZ Labs', true, 'system', 'system'),
    (gen_random_uuid(), 'Cetirizine 10mg', 'Cetirizine', 'Antihistamine', 'DEF Health', false, 'system', 'system');

-- CUSTOMERS
INSERT INTO customers (id, name, phone, address, created_by, updated_by)
VALUES 
    (gen_random_uuid(), 'Alice Brown', '9998887776', '123 Main St', 'system', 'system'),
    (gen_random_uuid(), 'Bob Green', '6667778889', '456 Elm St', 'system', 'system');
