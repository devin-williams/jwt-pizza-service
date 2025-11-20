#!/bin/bash

# Script to test that all log types are being generated

if [ -z "$1" ]; then
  echo "Usage: $0 <host>"
  echo "Example: $0 https://pizza-service.devin-williams.click"
  exit 1
fi

host=$1

echo "=========================================="
echo "Testing All Log Types for $host"
echo "=========================================="
echo ""

# Test 1: HTTP + Database logs (GET menu)
echo "1. Testing HTTP request + Database query (GET /api/order/menu)"
echo "   Expected logs: type='general' (HTTP) + type='database' (SQL query)"
response=$(curl -s -w "\n%{http_code}" $host/api/order/menu)
status=$(echo "$response" | tail -n 1)
echo "   Status: $status"
echo "   ✅ Should generate: HTTP log + Database log (SELECT * FROM menu)"
echo ""
sleep 2

# Test 2: HTTP + Database logs (Login)
echo "2. Testing login (PUT /api/auth)"
echo "   Expected logs: type='general' (HTTP) + type='database' (user lookup)"
login_response=$(curl -s -X PUT $host/api/auth -d '{"email":"d@jwt.com", "password":"diner"}' -H 'Content-Type: application/json')
token=$(echo $login_response | jq -r '.token // empty')
if [ -z "$token" ]; then
  echo "   ❌ Login failed - check credentials or user existence"
  echo "   Response: $login_response"
  exit 1
else
  echo "   Status: Login successful"
  echo "   ✅ Should generate: HTTP log + Database log (SELECT * FROM user WHERE email=?)"
fi
echo ""
sleep 2

# Test 3: HTTP + Database + Factory logs (Create order)
echo "3. Testing pizza order (POST /api/order)"
echo "   Expected logs: type='general' (HTTP) + type='database' (INSERT order) + type='factory' (pizza-factory.cs329.click)"
order_response=$(curl -s -w "\n%{http_code}" -X POST $host/api/order \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $token" \
  -d '{"franchiseId": 1, "storeId": 1, "items": [{"menuId": 1, "description": "Veggie", "price": 0.05}]}')
order_status=$(echo "$order_response" | tail -n 1)
echo "   Status: $order_status"
if [ "$order_status" = "200" ]; then
  echo "   ✅ Should generate:"
  echo "      - HTTP log (method=POST, path=/api/order, hasAuth=true)"
  echo "      - Database log (INSERT INTO dinerOrder...)"
  echo "      - Factory log (operation=createOrder, requestBody with diner+order, responseBody from factory)"
else
  echo "   ⚠️  Order may have failed (status $order_status)"
  echo "   Response: $(echo "$order_response" | head -n -1)"
fi
echo ""
sleep 2

# Test 4: Logout
echo "4. Testing logout (DELETE /api/auth)"
echo "   Expected logs: type='general' (HTTP) + type='database'"
logout_response=$(curl -s -w "\n%{http_code}" -X DELETE $host/api/auth -H "Authorization: Bearer $token")
logout_status=$(echo "$logout_response" | tail -n 1)
echo "   Status: $logout_status"
echo "   ✅ Should generate: HTTP log + Database log"
echo ""

echo "=========================================="
echo "Test Complete!"
echo "=========================================="
echo ""
echo "Now check Grafana with these queries:"
echo ""
echo "1. HTTP Requests:"
echo "   {app=\"jwt-pizza-service\"} | json | type=\"general\""
echo "   Should show 4 logs (menu, login, order, logout)"
echo ""
echo "2. Database Queries:"
echo "   {app=\"jwt-pizza-service\"} | json | type=\"database\""
echo "   Should show multiple SQL queries"
echo ""
echo "3. Factory Service Calls:"
echo "   {app=\"jwt-pizza-service\"} | json | type=\"factory\""
echo "   Should show 1 log with operation='createOrder'"
echo ""
echo "Time range: Last 5 minutes"
