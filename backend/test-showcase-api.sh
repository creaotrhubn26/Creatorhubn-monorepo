#!/bin/bash
# ============================================================
# SHOWCASE API — Comprehensive Test Suite
# Tests UniversalShowcase + UniversalVendorShowcase + CoupleView
# ============================================================

BASE="http://localhost:3001"
VENDOR_USER_ID="43724096-0b81-4f0b-b819-a52c24e1bfeb"
COUPLE_USER_ID="20a5c024-b917-4dcb-9c98-5771a2907014"
VENDOR_ID="9a66f202-6f55-4021-aaa3-c90a923f99bf"
PASS=0
FAIL=0
TOTAL=0

test_endpoint() {
  local method=$1 url=$2 body=$3 expect=$4 desc=$5
  TOTAL=$((TOTAL + 1))
  
  if [ "$method" = "GET" ]; then
    RESP=$(curl -s -w "\n%{http_code}" "$url")
  else
    RESP=$(curl -s -w "\n%{http_code}" -X "$method" -H "Content-Type: application/json" -d "$body" "$url")
  fi
  
  CODE=$(echo "$RESP" | tail -1)
  BODY=$(echo "$RESP" | sed '$d')
  
  if [ "$CODE" = "$expect" ]; then
    PASS=$((PASS + 1))
    echo "  ✅ $TOTAL. $desc (HTTP $CODE)"
  else
    FAIL=$((FAIL + 1))
    echo "  ❌ $TOTAL. $desc (expected $expect, got $CODE)"
    echo "     Response: $(echo "$BODY" | head -c 200)"
  fi
}

echo "============================================================"
echo "SHOWCASE API TEST SUITE"
echo "============================================================"

echo ""
echo "--- SECTION 1: Showcase Categories ---"
test_endpoint GET "$BASE/api/showcase/categories" "" "200" "GET all categories"
test_endpoint GET "$BASE/api/showcase/categories?profession=photographer" "" "200" "GET photographer categories"
test_endpoint GET "$BASE/api/showcase/categories?profession=videographer" "" "200" "GET videographer categories"
test_endpoint GET "$BASE/api/showcase/categories?profession=music_producer" "" "200" "GET music_producer categories"
test_endpoint POST "$BASE/api/showcase/categories" '{"name":"Test Kategori","profession":"photographer","description":"Testkategori"}' "201" "POST create category"

echo ""
echo "--- SECTION 2: Showcase Items (Profession-based) ---"
test_endpoint GET "$BASE/api/showcase/profession/photographer" "" "200" "GET photographer showcase items"
test_endpoint GET "$BASE/api/showcase/profession/videographer" "" "200" "GET videographer showcase items"
test_endpoint GET "$BASE/api/showcase/profession/music_producer" "" "200" "GET music producer showcase items"
test_endpoint GET "$BASE/api/showcase/profession/photographer?userId=$VENDOR_USER_ID" "" "200" "GET photographer items for specific user"

echo ""
echo "--- Verify item counts ---"
PHOTO_COUNT=$(curl -s "$BASE/api/showcase/profession/photographer?userId=$VENDOR_USER_ID" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null)
VIDEO_COUNT=$(curl -s "$BASE/api/showcase/profession/videographer?userId=$VENDOR_USER_ID" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null)
MUSIC_COUNT=$(curl -s "$BASE/api/showcase/profession/music_producer?userId=$VENDOR_USER_ID" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null)
echo "  📊 Photographer items: $PHOTO_COUNT (expected 6)"
echo "  📊 Videographer items: $VIDEO_COUNT (expected 4)"
echo "  📊 Music Producer items: $MUSIC_COUNT (expected 4)"

echo ""
echo "--- SECTION 3: Showcase Item CRUD ---"
test_endpoint POST "$BASE/api/showcase/items" '{"title":"Test Øyeblikk","description":"Et testbilde","imageUrl":"https://example.com/test.jpg","thumbnailUrl":"https://example.com/test-thumb.jpg","category":"Bryllup","profession":"photographer","userId":"'"$VENDOR_USER_ID"'","tags":["test","bryllup"],"clientName":"Test Kunde"}' "201" "POST create showcase item"

# Get the created item ID
CREATED_ID=$(curl -s "$BASE/api/showcase/profession/photographer?userId=$VENDOR_USER_ID" | python3 -c "import sys,json; items=json.load(sys.stdin); print([i['id'] for i in items if i['title']=='Test Øyeblikk'][0])" 2>/dev/null)
echo "  📎 Created item ID: $CREATED_ID"

if [ -n "$CREATED_ID" ] && [ "$CREATED_ID" != "" ]; then
  test_endpoint PATCH "$BASE/api/showcase/items/$CREATED_ID" '{"title":"Oppdatert Øyeblikk","description":"Oppdatert beskrivelse"}' "200" "PATCH update showcase item"
  test_endpoint DELETE "$BASE/api/showcase/items/$CREATED_ID" "" "200" "DELETE showcase item"
else
  echo "  ⚠️  Skipping update/delete — no item ID"
  TOTAL=$((TOTAL + 2))
  FAIL=$((FAIL + 2))
fi

echo ""
echo "--- SECTION 4: Showcase Sets & Collections ---"
test_endpoint POST "$BASE/api/showcase/sets" '{"name":"Beste Bryllupsbilder","description":"Topp utvalg","items":["sc-photo-001","sc-photo-002"],"userId":"'"$VENDOR_USER_ID"'"}' "201" "POST create showcase set"
test_endpoint POST "$BASE/api/showcase/collections" '{"name":"Sommersamling 2025","description":"Alle sommerprosjekter","items":["sc-photo-001","sc-video-001"],"visibility":"public","tags":["sommer","2025"],"userId":"'"$VENDOR_USER_ID"'"}' "201" "POST create showcase collection"

echo ""
echo "--- SECTION 5: Showcase Email & Notifications ---"
test_endpoint POST "$BASE/api/showcase/email" '{"to":"danielqazi89@gmail.com","subject":"Se vårt showcase!","showcaseUrl":"https://creatorhubn.com/showcase/qazifotoreel","message":"Hei! Sjekk ut vårt showcase.","userId":"'"$VENDOR_USER_ID"'"}' "200" "POST send showcase email"
test_endpoint POST "$BASE/api/showcase/send-overage-email" '{"to":"danielqazi89@gmail.com","showcaseId":"test-123","overageCount":5}' "200" "POST send overage email"

echo ""
echo "--- SECTION 6: Client/Couple Session & Proofing ---"
test_endpoint GET "$BASE/api/showcase/client-session/session-001?clientEmail=danielqazi89@gmail.com" "" "200" "GET client session (couple view)"
test_endpoint GET "$BASE/api/showcase/client-selections/session-001?clientEmail=danielqazi89@gmail.com" "" "200" "GET client selections"
test_endpoint GET "$BASE/api/proofing/sessions/session-001" "" "200" "GET proofing session"

echo ""
echo "--- SECTION 7: Showcase Analytics ---"
test_endpoint POST "$BASE/api/showcase/analytics" '{"showcaseItemId":"sc-photo-001","type":"view","referrer":"test","deviceType":"desktop","browser":"chrome","country":"NO"}' "200" "POST track showcase view"
test_endpoint POST "$BASE/api/showcase/analytics" '{"showcaseItemId":"sc-video-001","type":"like"}' "200" "POST track showcase like"

echo ""
echo "--- SECTION 8: Public Showcase (Couple View) ---"
test_endpoint GET "$BASE/api/showcase/public/$VENDOR_USER_ID" "" "200" "GET public showcase for couple"
test_endpoint GET "$BASE/api/showcase/public/$VENDOR_USER_ID?profession=photographer" "" "200" "GET public showcase photographer only"
test_endpoint GET "$BASE/api/showcase/public/$VENDOR_USER_ID?profession=videographer" "" "200" "GET public showcase videographer only"

echo ""
echo "--- SECTION 9: Universal Vendor Showcase (Products) ---"
test_endpoint GET "$BASE/api/universal-vendor-showcase/print/QAZI%20FOTOREEL" "" "200" "GET vendor products (print)"
test_endpoint GET "$BASE/api/universal-vendor-showcase/audio/QAZI%20FOTOREEL" "" "200" "GET vendor products (audio)"
test_endpoint GET "$BASE/api/universal-vendor-showcase/design/QAZI%20FOTOREEL" "" "200" "GET vendor products (design)"
test_endpoint GET "$BASE/api/universal-vendor-showcase/print/QAZI%20FOTOREEL?sort=newest" "" "200" "GET vendor products sorted by newest"

echo ""
echo "--- SECTION 10: Vendor Showcase Stats ---"
test_endpoint GET "$BASE/api/universal-vendor-showcase-stats/print/QAZI%20FOTOREEL" "" "200" "GET vendor showcase stats"

echo ""
echo "--- SECTION 11: Vendor Product CRUD ---"
test_endpoint POST "$BASE/api/universal-vendor-showcase/product" '{"vendorId":"'"$VENDOR_ID"'","vendorName":"QAZI FOTOREEL","productType":"print","name":"Test Preset Pack","category":"Presets","price":399,"currency":"NOK","description":"Test presets","tags":["test"]}' "201" "POST create vendor product"

# Get the newly created product ID
NEW_PROD_ID=$(curl -s "$BASE/api/universal-vendor-showcase/print/QAZI%20FOTOREEL?sort=newest" | python3 -c "import sys,json; items=json.load(sys.stdin); print([i['id'] for i in items if i.get('name')=='Test Preset Pack'][0])" 2>/dev/null)
echo "  📎 Created product ID: $NEW_PROD_ID"

if [ -n "$NEW_PROD_ID" ] && [ "$NEW_PROD_ID" != "" ]; then
  test_endpoint PUT "$BASE/api/universal-vendor-showcase/product/$NEW_PROD_ID" '{"name":"Updated Test Pack","price":499}' "200" "PUT update vendor product"
  test_endpoint PATCH "$BASE/api/universal-vendor-showcase/product/$NEW_PROD_ID/featured" "" "200" "PATCH toggle featured"
  test_endpoint POST "$BASE/api/universal-vendor-showcase/product/$NEW_PROD_ID/download" '{"userId":"'"$COUPLE_USER_ID"'","userAgent":"TestBot/1.0"}' "200" "POST track product download"
  test_endpoint DELETE "$BASE/api/universal-vendor-showcase/product/$NEW_PROD_ID" "" "200" "DELETE vendor product"
else
  echo "  ⚠️  Skipping product CRUD ops — no product ID found"
  TOTAL=$((TOTAL + 4))
  FAIL=$((FAIL + 4))
fi

echo ""
echo "============================================================"
echo "RESULTS: $PASS/$TOTAL passed, $FAIL failed"
echo "============================================================"

if [ $FAIL -eq 0 ]; then
  echo "🎉 ALL TESTS PASSED!"
else
  echo "⚠️  Some tests failed. Check output above."
fi
