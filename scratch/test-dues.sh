#!/bin/bash
set -e

echo "=== 1. Login ==="
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123","authType":"PASSWORD"}' | jq -r '.data.accessToken')

echo "Got token: ${TOKEN:0:20}..."

echo ""
echo "=== 2. Get Initial Dues Summary ==="
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/v1/bills/dues/summary | jq .

echo ""
echo "=== 3. Create or Fetch a Customer for Due Testing ==="
CUST_ID=$(curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:8080/api/v1/customers?page=0&size=1" | jq -r '.data.content[0].id // empty')

if [ -z "$CUST_ID" ]; then
  echo "Creating test customer..."
  CUST_ID=$(curl -s -X POST http://localhost:8080/api/v1/customers \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"name":"Ramesh Sharma","phone":"9876543210","email":"ramesh@example.com"}' | jq -r '.data.id')
fi
echo "Using Customer ID: $CUST_ID"

echo ""
echo "=== 4. Fetch Available Medicine with Stock ==="
MED_ID=$(curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:8080/api/v1/medicines?page=0&size=5" | jq -r '.data.content[0].id')
echo "Using Medicine ID: $MED_ID"

echo ""
echo "=== 5. Create a Partial Payment Bill (e.g. ₹20 paid out of total) ==="
PARTIAL_BILL=$(curl -s -X POST http://localhost:8080/api/v1/bills \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "'"$CUST_ID"'",
    "discountAmount": 0,
    "paymentMethod": "CASH",
    "paidAmount": 20.00,
    "items": [
      {
        "medicineId": "'"$MED_ID"'",
        "quantity": 2,
        "dispenseUnit": "UNIT"
      }
    ]
  }')

echo "$PARTIAL_BILL" | jq '{billNumber: .data.billNumber, grandTotal: .data.grandTotal, paidAmount: .data.paidAmount, dueAmount: .data.dueAmount, paymentStatus: .data.paymentStatus}'

BILL_ID=$(echo "$PARTIAL_BILL" | jq -r '.data.id')
DUE_AMT=$(echo "$PARTIAL_BILL" | jq -r '.data.dueAmount')

echo ""
echo "=== 6. Verify Customer Outstanding Balance Updated ==="
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:8080/api/v1/customers/$CUST_ID" | jq '{name: .data.name, outstandingBalance: .data.outstandingBalance}'

echo ""
echo "=== 7. Check Dues Summary & Customers with Dues ==="
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/v1/bills/dues/summary | jq .
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/v1/bills/dues/customers | jq '.data.content[0]'

echo ""
echo "=== 8. Create a Pay Later Bill (₹0 paid) ==="
PAY_LATER_BILL=$(curl -s -X POST http://localhost:8080/api/v1/bills \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "'"$CUST_ID"'",
    "discountAmount": 0,
    "paymentMethod": "CASH",
    "paidAmount": 0.00,
    "items": [
      {
        "medicineId": "'"$MED_ID"'",
        "quantity": 1,
        "dispenseUnit": "UNIT"
      }
    ]
  }')
echo "$PAY_LATER_BILL" | jq '{billNumber: .data.billNumber, grandTotal: .data.grandTotal, paidAmount: .data.paidAmount, dueAmount: .data.dueAmount, paymentStatus: .data.paymentStatus}'

echo ""
echo "=== 9. Settle Customer Dues via FIFO settlement ==="
echo "Settling $DUE_AMT for customer $CUST_ID..."
SETTLE_RESP=$(curl -s -X POST "http://localhost:8080/api/v1/bills/dues/settle-customer/$CUST_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "paymentMethod": "UPI",
    "amount": '"$DUE_AMT"',
    "transactionRef": "UPI-SETTLE-123"
  }')
echo "$SETTLE_RESP" | jq .

echo ""
echo "=== 10. Verify Bill Status after Settlement ==="
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:8080/api/v1/bills/$BILL_ID" | jq '{billNumber: .data.billNumber, grandTotal: .data.grandTotal, paidAmount: .data.paidAmount, dueAmount: .data.dueAmount, paymentStatus: .data.paymentStatus}'

echo ""
echo "=== 11. Verify Customer Balance after Settlement ==="
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:8080/api/v1/customers/$CUST_ID" | jq '{name: .data.name, outstandingBalance: .data.outstandingBalance}'
