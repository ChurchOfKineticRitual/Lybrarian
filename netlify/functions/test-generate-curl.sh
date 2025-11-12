#!/bin/bash

# Quick test script for the generate endpoint
# Usage: ./test-generate-curl.sh [local|prod]

# Determine endpoint URL
if [ "$1" == "prod" ]; then
  ENDPOINT="https://lybrarian.app/.netlify/functions/generate"
  echo "Testing PRODUCTION endpoint: $ENDPOINT"
else
  ENDPOINT="http://localhost:8888/.netlify/functions/generate"
  echo "Testing LOCAL endpoint: $ENDPOINT"
  echo "Make sure 'netlify dev' is running!"
fi

echo ""
echo "=== Test 1: Basic Generation ==="
curl -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Walking through the city at night\nStreetlights guide my way\nMemories of you still burning bright\nWishing you would stay",
    "settings": {
      "religiosity": "ish",
      "rhythm": "yes",
      "rhyming": "ish",
      "meaning": "yes",
      "theme": "urban nostalgia"
    },
    "iteration": 1
  }' | jq '.'

echo ""
echo "=== Test 2: Invalid Request (missing input) ==="
curl -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{
    "settings": {
      "rhythm": "yes"
    }
  }' | jq '.'

echo ""
echo "=== Test 3: Invalid Method (GET) ==="
curl -X GET "$ENDPOINT" | jq '.'

echo ""
echo "=== Test 4: Invalid Setting Value ==="
curl -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{
    "input": "test verse",
    "settings": {
      "rhythm": "invalid"
    }
  }' | jq '.'

echo ""
echo "=== Tests Complete ==="
echo ""
echo "Note: Tests 2-4 should return error responses."
echo "Test 1 should succeed if environment variables are set:"
echo "  - OPENROUTER_API_KEY"
echo "  - DATABASE_URL"
echo "  - UPSTASH_VECTOR_URL"
echo "  - UPSTASH_VECTOR_TOKEN"
