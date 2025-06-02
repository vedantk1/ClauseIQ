#!/bin/bash

# GitHub Repository Setup Script for Legal AI Project
# Run this script after creating your GitHub repository

echo "🚀 Setting up GitHub repository for Legal AI Project..."

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo "❌ Error: Not in a git repository. Please run this from the project root."
    exit 1
fi

# Get the GitHub repository URL from user
read -p "Enter your GitHub repository URL (e.g., https://github.com/username/legal-ai.git): " REPO_URL

if [ -z "$REPO_URL" ]; then
    echo "❌ Error: No repository URL provided."
    exit 1
fi

# Add the remote origin
echo "📡 Adding remote origin..."
git remote add origin "$REPO_URL"

# Push to GitHub
echo "⬆️ Pushing to GitHub..."
git branch -M main
git push -u origin main

echo "✅ Repository successfully pushed to GitHub!"
echo ""
echo "🔗 Your repository is now available at: $REPO_URL"
echo ""
echo "📝 Next steps:"
echo "   1. Go to your GitHub repository"
echo "   2. Add a description and topics"
echo "   3. Enable Issues and Wiki if desired"
echo "   4. Consider adding branch protection rules"
echo "   5. Set up GitHub Actions for CI/CD (optional)"
echo ""
echo "🛡️ Security reminder:"
echo "   - Make sure your .env files are not committed"
echo "   - Review the .gitignore file"
echo "   - Consider using GitHub Secrets for sensitive data"
