-- V13__allow_advance_payments.sql
-- Allow advance payments and overpayment credits on Supplier Khata and Customer Ledgers

-- 1. Make purchase_order_id nullable in purchase_payments so advance payments can be recorded directly against suppliers
ALTER TABLE purchase_payments ALTER COLUMN purchase_order_id DROP NOT NULL;

-- 2. Make order_id nullable in payments and add customer_id for customer advance payments
ALTER TABLE payments ALTER COLUMN order_id DROP NOT NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id);
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON payments(customer_id);
