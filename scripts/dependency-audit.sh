#!/bin/bash

# ClauseIQ Dependency Audit Script
# Checks for outdated and vulnerable dependencies

set -e

echo "🔍 ClauseIQ Dependency Audit Report"
echo "======================================"
echo "Date: $(date)"
echo ""

# Backend Dependencies
echo "🐍 Backend Dependencies (Python)"
echo "--------------------------------"
cd backend
source clauseiq_env/bin/activate

echo "📦 Outdated packages:"
pip list --outdated || echo "All packages are up to date!"

echo ""
echo "🔒 Security vulnerabilities:"
pip-audit --desc || echo "⚠️  pip-audit not installed. Install with: pip install pip-audit"

echo ""

# Frontend Dependencies  
echo "📦 Frontend Dependencies (Node.js)"
echo "----------------------------------"
cd ../frontend

echo "📦 Outdated packages:"
npm outdated || echo "All packages are up to date!"

echo ""
echo "🔒 Security vulnerabilities:"
npm audit

echo ""
echo "✅ Audit Complete!"
echo ""
echo "🔧 To update dependencies:"
echo "Backend: pip install --upgrade <package>"
echo "Frontend: npm update <package>"
echo ""
echo "⚠️  Always test after updates!"
