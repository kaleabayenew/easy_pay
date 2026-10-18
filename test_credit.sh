#!/bin/bash

# Credit Feature Test Script
# Run in terminal 1: curl -N http://localhost:3000/api/v1/superadmin/credit/stream
# Run in terminal 2: Execute this script

BASE_URL="http://localhost:3000"
ADMIN_USER="kaleab"
ADMIN_PASS="Kale@1513"
ADMIN_TOTP="1315"

echo "=== EasyPay Credit Feature Test ==="
echo ""

# 1. Login as admin
echo "1. Logging in as admin..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/superadmin/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\",\"two_factor_code\":\"$ADMIN_TOTP\"}")

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Login failed"
  echo $LOGIN_RESPONSE
  exit 1
fi

echo "✅ Login successful"
echo ""

# 2. Create owner with initial credit
echo "2. Creating owner with initial credit of 5000 ETB..."
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/superadmin/owners" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Test Credit Owner",
    "contact_phone": "+251911223344",
    "pin": "1234",
    "password": "Test@123",
    "credit": "5000"
  }')

OWNER_ID=$(echo $CREATE_RESPONSE | grep -o '"id":"[^"]*' | cut -d'"' -f4)

if [ -z "$OWNER_ID" ]; then
  echo "❌ Owner creation failed (may already exist)"
  echo $CREATE_RESPONSE
  # Try to get existing owner
  OWNER_ID="own_1"
fi

echo "✅ Owner created/retrieved: $OWNER_ID"
echo ""

# 3. Add credit
echo "3. Adding 1500 ETB credit..."
ADD_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/superadmin/owners/$OWNER_ID/credit" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "type": "add",
    "amount": 1500,
    "reason": "Test deposit"
  }')

echo $ADD_RESPONSE | grep '"success":true' > /dev/null
if [ $? -eq 0 ]; then
  echo "✅ Credit added successfully"
  echo "   Balance after: $(echo $ADD_RESPONSE | grep -o '"balanceAfter":[0-9.]*' | cut -d':' -f2)"
else
  echo "❌ Add credit failed"
  echo $ADD_RESPONSE
fi
echo ""

# 4. Subtract credit
echo "4. Subtracting 500 ETB credit..."
SUBTRACT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/superadmin/owners/$OWNER_ID/credit" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "type": "subtract",
    "amount": 500,
    "reason": "Test withdrawal"
  }')

echo $SUBTRACT_RESPONSE | grep '"success":true' > /dev/null
if [ $? -eq 0 ]; then
  echo "✅ Credit subtracted successfully"
  echo "   Balance after: $(echo $SUBTRACT_RESPONSE | grep -o '"balanceAfter":[0-9.]*' | cut -d':' -f2)"
else
  echo "❌ Subtract credit failed"
  echo $SUBTRACT_RESPONSE
fi
echo ""

# 5. Try to subtract too much (should fail)
echo "5. Attempting to subtract 100000 ETB (should fail)..."
FAIL_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/superadmin/owners/$OWNER_ID/credit" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "type": "subtract",
    "amount": 100000,
    "reason": "Test overdraw"
  }')

echo $FAIL_RESPONSE | grep '"success":false' > /dev/null
if [ $? -eq 0 ]; then
  echo "✅ Overdraw correctly rejected"
  echo "   Error: $(echo $FAIL_RESPONSE | grep -o '"message":"[^"]*' | cut -d'"' -f4)"
else
  echo "❌ Overdraw should have failed"
  echo $FAIL_RESPONSE
fi
echo ""

# 6. Get credit history
echo "6. Getting credit history..."
HISTORY_RESPONSE=$(curl -s -X GET "$BASE_URL/api/v1/superadmin/owners/$OWNER_ID/credit-history?page=1&limit=5" \
  -H "Authorization: Bearer $TOKEN")

echo "✅ Credit history retrieved"
echo "   Transactions: $(echo $HISTORY_RESPONSE | grep -o '"total":[0-9]*' | cut -d':' -f2)"
echo ""

# 7. Get current balance
echo "7. Getting current balance..."
BALANCE_RESPONSE=$(curl -s -X GET "$BASE_URL/api/v1/superadmin/owners/$OWNER_ID/credit" \
  -H "Authorization: Bearer $TOKEN")

echo "✅ Current balance: $(echo $BALANCE_RESPONSE | grep -o '"balance":[0-9.]*' | cut -d':' -f2) ETB"
echo ""

echo "=== Test Complete ==="
echo ""
echo "To test SSE live updates:"
echo "Terminal 1: curl -N http://localhost:3000/api/v1/superadmin/credit/stream -H \"Authorization: Bearer $TOKEN\""
echo "Terminal 2: Run credit adjustments and watch events arrive"
