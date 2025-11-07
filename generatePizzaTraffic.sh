#!/bin/bash

# Exit if no host provided
if [ -z "$1" ]; then
  echo "Usage: $0 <host>"
  echo "Example: $0 https://pizza-service.devin-williams.click"
  exit 1
fi

host=$1

# Function to cleanup background processes on exit
cleanup() {
  echo "Cleaning up background processes..."
  kill $(jobs -p) 2>/dev/null
  exit 0
}

trap cleanup SIGINT SIGTERM

echo "Starting traffic simulation for $host"
echo "Press Ctrl+C to stop"
echo ""

# Hit the menu every 3 seconds
(
  while true; do
    response=$(curl -s -o /dev/null -w "%{http_code}" $host/api/order/menu)
    echo "Requesting menu... $response"
    sleep 3
  done
) &

# Invalid login every 25 seconds
(
  while true; do
    response=$(curl -s -o /dev/null -w "%{http_code}" -X PUT $host/api/auth -d '{"email":"unknown@jwt.com", "password":"bad"}' -H 'Content-Type: application/json')
    echo "Logging in with invalid credentials... $response"
    sleep 25
  done
) &

# Login and logout 2 minutes later
(
  while true; do
    response=$(curl -s -X PUT $host/api/auth -d '{"email":"f@jwt.com", "password":"franchisee"}' -H 'Content-Type: application/json')
    token=$(echo $response | jq -r '.token')
    echo "Login franchisee... $(echo $response | jq -r 'if .token then "true" else "false" end')"
    sleep 110
    curl -s -X DELETE $host/api/auth -H "Authorization: Bearer $token" > /dev/null
    echo "Logout franchisee..."
    sleep 10
  done
) &

# Login, buy a pizza, wait 20 seconds, logout, wait 30 seconds
(
  while true; do
    response=$(curl -s -X PUT $host/api/auth -d '{"email":"d@jwt.com", "password":"diner"}' -H 'Content-Type: application/json')
    token=$(echo $response | jq -r '.token')
    echo "Login diner... $(echo $response | jq -r 'if .token then "true" else "false" end')"

    order_response=$(curl -s -o /dev/null -w "%{http_code}" -X POST $host/api/order -H 'Content-Type: application/json' -d '{"franchiseId": 1, "storeId":1, "items":[{ "menuId": 1, "description": "Veggie", "price": 0.05 }]}'  -H "Authorization: Bearer $token")
    echo "Bought a pizza... $order_response"

    sleep 20
    curl -s -X DELETE $host/api/auth -H "Authorization: Bearer $token" > /dev/null
    echo "Logout diner..."
    sleep 30
  done
) &

# Login, buy "too many pizzas" to cause an order to fail, wait 5 seconds, logout, wait 295 seconds
(
  while true; do
    response=$(curl -s -X PUT $host/api/auth -d '{"email":"d@jwt.com", "password":"diner"}' -H 'Content-Type: application/json')
    token=$(echo $response | jq -r '.token')
    echo "Login hungry diner... $(echo $response | jq -r 'if .token then "true" else "false" end')"

    items='{ "menuId": 1, "description": "Veggie", "price": 0.05 }'
    for (( i=0; i < 21; i++ ))
    do items+=', { "menuId": 1, "description": "Veggie", "price": 0.05 }'
    done

    order_response=$(curl -s -o /dev/null -w "%{http_code}" -X POST $host/api/order -H 'Content-Type: application/json' -d "{\"franchiseId\": 1, \"storeId\":1, \"items\":[$items]}"  -H "Authorization: Bearer $token")
    echo "Bought too many pizzas... $order_response"

    sleep 5
    curl -s -X DELETE $host/api/auth -H "Authorization: Bearer $token" > /dev/null
    echo "Logging out hungry diner..."
    sleep 295
  done
) &

# Wait for all background processes
wait
