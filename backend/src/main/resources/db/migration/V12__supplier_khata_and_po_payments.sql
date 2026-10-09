-- V12__supplier_khata_and_po_payments.sql
-- Supplier Khata, Purchase Order Payment Tracking, and Payment Ledger

-- 1. Add outstanding_balance to suppliers for tracking store payables / supplier ledger
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS outstanding_balance NUMERIC(14, 2) NOT NULL DEFAULT 0.00;
CREATE INDEX IF NOT EXISTS idx_suppliers_outstanding_balance ON suppliers (outstanding_balance);

-- 2. Add payment tracking fields to purchase_orders
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS due_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) NOT NULL DEFAULT 'UNPAID';

-- Check constraint for PO payment_status
ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS chk_po_payment_status;
ALTER TABLE purchase_orders ADD CONSTRAINT chk_po_payment_status 
    CHECK (payment_status IN ('PAID', 'PARTIAL', 'UNPAID', 'PENDING'));

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_purchase_orders_payment_status ON purchase_orders (payment_status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_payment ON purchase_orders (supplier_id, payment_status);

-- 3. Backfill existing purchase orders:
-- Set due_amount = total_amount and payment_status = 'UNPAID' for purchase orders where not yet set
UPDATE purchase_orders
SET due_amount = total_amount,
    paid_amount = 0.00,
    payment_status = 'UNPAID'
WHERE due_amount = 0.00 AND paid_amount = 0.00;

-- 4. Backfill suppliers.outstanding_balance from received purchase orders
UPDATE suppliers s
SET outstanding_balance = COALESCE((
    SELECT SUM(po.due_amount)
    FROM purchase_orders po
    WHERE po.supplier_id = s.id
      AND po.is_deleted = false
      AND po.status IN ('RECEIVED', 'PARTIALLY_RECEIVED')
), 0.00);

-- 5. Create purchase_payments table for supplier vouchers and payment history
CREATE TABLE IF NOT EXISTS purchase_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id),
    supplier_id UUID NOT NULL REFERENCES suppliers(id),
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('CASH', 'UPI', 'CARD', 'NETBANKING')),
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    transaction_ref VARCHAR(100),
    payment_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    notes VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by VARCHAR(50) NOT NULL DEFAULT 'system',
    updated_by VARCHAR(50) NOT NULL DEFAULT 'system',
    is_deleted BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_purchase_payments_po ON purchase_payments (purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_payments_supplier ON purchase_payments (supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_payments_time ON purchase_payments (payment_time);
