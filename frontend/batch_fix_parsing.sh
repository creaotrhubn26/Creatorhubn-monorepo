#!/bin/bash
# Batch fix common parsing errors in TypeScript/React files

cd /Users/usmanqazi/creatorhub-frontend

# Find all .tsx files with parsing errors
FILES=$(find client/src/components -name "*.tsx" -type f | while read file; do
  result=$(node_modules/.bin/eslint "$file" 2>&1 | grep -c "Parsing error" || true)
  if [ "$result" -gt 0 ]; then
    echo "$file"
  fi
done)

echo "Found $(echo "$FILES" | wc -l) files with parsing errors"
echo "Fixing common patterns..."

count=0
for file in $FILES; do
  [ ! -f "$file" ] && continue
  
  # Create backup
  cp "$file" "$file.bak"
  
  # Pattern 1: Fix semicolons after type identifiers (e.g., { type: 'FOO';, } -> { type: 'FOO'; })
  perl -i -pe 's/;\s*,\s*payload:/; payload:/g' "$file"
  
  # Pattern 2: Fix extra commas in strings (e.g., 'id, ' -> 'id')
  perl -i -pe "s/'([a-zA-Z_]+),\s*'/'\\1'/g" "$file"
  
  # Pattern 3: Fix missing commas after Omit (e.g., Omit<Type 'id'> -> Omit<Type, 'id'>)
  perl -i -pe 's/Omit<([^,>]+)\s+([^>]+)>/Omit<$1, $2>/g' "$file"
  
  # Pattern 4: Fix extra commas in logger module names
  perl -i -pe "s/logger\\.module\\('([^']+),\\s*'\\)/logger.module('\\1')/g" "$file"
  
  # Pattern 5: Fix double import names (e.g., PlayArrowArrow -> PlayArrow)
  perl -i -pe 's/(\b\w+)(\1)\b/$1/g' "$file"
  
  # Pattern 6: Fix missing closing braces in interfaces with nested objects
  perl -i -pe 's/^(\s+})\s*;\s*$/  };\n}/gm' "$file"
  
  # Pattern 7: Fix extra spaces before colons (e.g., key : value -> key: value)
  perl -i -pe 's/(\w+)\s+:/\\1:/g' "$file"
  
  # Pattern 8: Fix missing commas before sx props
  perl -i -pe 's/([}\)])\s*sx=/\\1, sx=/g' "$file"
  
  # Pattern 9: Fix duplicate sx props
  perl -i -pe 's/sx=\{[^}]*\}\s*sx=\{/sx=\{/g' "$file"
  
  # Pattern 10: Fix missing commas after spread operators
  perl -i -pe 's/(\.\.\.[a-zA-Z_$][a-zA-Z0-9_$]*)\s*([A-Z])/\\1, $2/g' "$file"
  
  count=$((count + 1))
  [ $((count % 10)) -eq 0 ] && echo "Processed $count files..."
done

echo "✅ Processed $count files"
echo "Verifying fixes..."

# Count remaining errors
REMAINING=$(node_modules/.bin/eslint client/src/components/ --ext .ts,.tsx 2>&1 | grep -o "[0-9]* errors" | grep -o "[0-9]*")
echo "Remaining parsing errors: $REMAINING"

# Clean up backups if successful
if [ "$REMAINING" -lt 600 ]; then
  echo "Significant improvement! Removing backups..."
  find client/src/components -name "*.bak" -delete
fi















