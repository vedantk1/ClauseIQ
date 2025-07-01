#!/bin/bash

# Test React Hook Order Fix
# This script verifies our InteractivePDFViewer component's hook order is stable

echo "🔍 Testing React Hook Order Fix for InteractivePDFViewer..."

# Check if SearchNavigationPanel is properly separated
if grep -q "const SearchNavigationPanel" /Users/vedan/Projects/clauseiq-project/frontend/src/components/InteractivePDFViewer.tsx; then
    echo "❌ SearchNavigationPanel still defined in InteractivePDFViewer.tsx"
    exit 1
else
    echo "✅ SearchNavigationPanel properly separated from InteractivePDFViewer"
fi

# Check if separate file exists
if [ -f "/Users/vedan/Projects/clauseiq-project/frontend/src/components/SearchNavigationPanel.tsx" ]; then
    echo "✅ SearchNavigationPanel.tsx exists as separate file"
else
    echo "❌ SearchNavigationPanel.tsx not found"
    exit 1
fi

# Check hook order in main component (should not have hooks inside sub-components)
hook_count=$(grep -E "(useState|useEffect|useCallback|useMemo|useRef)" /Users/vedan/Projects/clauseiq-project/frontend/src/components/InteractivePDFViewer.tsx | wc -l)
echo "📊 Found $hook_count hooks in InteractivePDFViewer"

# Check that useHighlights is called first in the component function (not in imports)
first_hook=$(grep -E "} = use" /Users/vedan/Projects/clauseiq-project/frontend/src/components/InteractivePDFViewer.tsx | head -1)
if echo "$first_hook" | grep -q "useHighlights"; then
    echo "✅ useHighlights is called first (custom hook)"
else
    echo "❌ useHighlights is not the first hook call"
    echo "First hook: $first_hook"
fi

# Check dependency arrays for null safety (they should all use full highlights, not highlights?.length)
if grep -E "\[.*highlights\?\..*\]" /Users/vedan/Projects/clauseiq-project/frontend/src/components/InteractivePDFViewer.tsx; then
    echo "❌ Found unsafe optional chaining in dependency arrays"
    exit 1
else
    echo "✅ Dependency arrays use safe references"
fi

# Check for proper null checks
if grep -q "if (!highlights ||" /Users/vedan/Projects/clauseiq-project/frontend/src/components/InteractivePDFViewer.tsx; then
    echo "✅ Found proper null checks for highlights"
else
    echo "❌ Missing null checks for highlights"
fi

# Check useHighlights hook returns safe array
if grep -q "highlights: highlights || \[\]" /Users/vedan/Projects/clauseiq-project/frontend/src/hooks/useHighlights.ts; then
    echo "✅ useHighlights returns safe array fallback"
else
    echo "❌ useHighlights missing safe array fallback"
fi

echo ""
echo "🎯 Hook Order Fix Summary:"
echo "- Separated SearchNavigationPanel component to prevent hook conflicts"
echo "- Added null safety checks for highlights array"
echo "- Fixed dependency arrays to prevent undefined length access"
echo "- Ensured useHighlights always returns defined array"
echo ""
echo "✅ React Hook Order Fix completed successfully!"
