#!/bin/bash
# Test runner for ClauseIQ backend tests

echo "🧪 Running ClauseIQ Backend Tests"
echo "=================================="

# Change to backend directory
cd "$(dirname "$0")"

# Activate virtual environment
source venv/bin/activate

# Run tests with coverage and nice formatting
echo "📊 Running test suite..."
python -m pytest tests/ -v --tb=short --color=yes

# Check exit code
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ All tests passed!"
    echo "📈 Total tests: $(python -m pytest tests/ --collect-only -q | grep -c 'test session starts')"
else
    echo ""
    echo "❌ Some tests failed. Check output above."
    exit 1
fi
