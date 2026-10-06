-- V9__customer_dues_and_credit.sql
-- Add outstanding balance to customers for credit / partial payment / khata tracking

ALTER TABLE customers ADD COLUMN IF NOT EXISTS outstanding_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00;

-- Backfill outstanding balance for customers with existing pending/partial bills
UPDATE customers c
SET outstanding_balance = GREATEST(0.00, COALESCE(sub.total_due, 0.00))
FROM (
    SELECT s.customer_id,
           SUM(s.grand_total - COALESCE(p.paid, 0.00)) AS total_due
    FROM sales_orders s
    LEFT JOIN (
        SELECT order_id, SUM(amount) AS paid
        FROM payments
        GROUP BY order_id
    ) p ON p.order_id = s.id
    WHERE s.is_deleted = false
      AND s.customer_id IS NOT NULL
      AND s.payment_status IN ('PENDING', 'PARTIAL')
    GROUP BY s.customer_id
) sub
WHERE c.id = sub.customer_id;

-- Helpful performance indexes for dues and credit ledger
CREATE INDEX IF NOT EXISTS idx_sales_orders_payment_status ON sales_orders (payment_status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_customer_payment ON sales_orders (customer_id, payment_status);
CREATE INDEX IF NOT EXISTS idx_customers_outstanding_balance ON customers (outstanding_balance);
