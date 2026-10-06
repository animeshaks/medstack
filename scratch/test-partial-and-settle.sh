#!/bin/bash
set -e

TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123","authType":"PASSWORD"}' | jq -r '.data.accessToken')

CUST_ID=$(curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:8080/api/v1/customers?page=0&size=1" | jq -r '.data.content[0].id')
MED_ID=$(curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:8080/api/v1/medicines?page=0&size=1" | jq -r '.data.content[0].id')

echo "=== Create Partial Bill (Total: ₹3.20, Paid Now: ₹1.20, Due: ₹2.00) ==="
PARTIAL_BILL=$(curl -s -X POST http://localhost:8080/api/v1/bills \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "'"$CUST_ID"'",
    "discountAmount": 0,
    "paymentMethod": "CASH",
    "paidAmount": 1.20,
    "items": [
      {
        "medicineId": "'"$MED_ID"'",
        "quantity": 1,
        "dispenseUnit": "UNIT"
      }
    ]
  }')

echo "$PARTIAL_BILL" | jq '{billNumber: .data.billNumber, grandTotal: .data.grandTotal, paidAmount: .data.paidAmount, dueAmount: .data.dueAmount, paymentStatus: .data.paymentStatus}'

echo ""
echo "=== Check Customer Balance (Should be 3.20 + 2.00 = 5.20) ==="
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:8080/api/v1/customers/$CUST_ID" | jq '{name: .data.name, outstandingBalance: .data.outstandingBalance}'

echo ""
echo "=== Check Dues Summary ==="
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/v1/bills/dues/summary | jq .

echo ""
echo "=== Settle Due for Customer: Pay ₹5.20 via UPI ==="
SETTLE_RESP=$(curl -s -X POST "http://localhost:8080/api/v1/bills/dues/settle-customer/$CUST_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "paymentMethod": "UPI",
    "amount": 5.20,
    "transactionRef": "UPI-SETTLE-FULL"
  }')
echo "$SETTLE_RESP" | jq .

echo ""
echo "=== Check Customer Balance After Settlement (Should be 0.00) ==="
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:8080/api/v1/customers/$CUST_ID" | jq '{name: .data.name, outstandingBalance: .data.outstandingBalance}'

echo ""
echo "=== Check All Bills For Customer (All should now be PAID) ==="
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:8080/api/v1/bills?customerId=$CUST_ID" | jq '.data.content[] | {billNumber, grandTotal, paidAmount, dueAmount, paymentStatus}'
