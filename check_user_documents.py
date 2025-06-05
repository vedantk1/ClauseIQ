#!/usr/bin/env python3
"""
Script to check documents for a specific user in the cloud MongoDB database.
"""
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from database import get_mongo_storage

def main():
    email = "clauseiq@gmail.com"
    
    try:
        # Get database storage instance
        storage = get_mongo_storage()
        
        # First, get the user by email to find their user_id
        print(f"Looking up user with email: {email}")
        user = storage.get_user_by_email(email)
        
        if not user:
            print(f"❌ User with email {email} not found in database")
            return
        
        user_id = user.get('id')
        print(f"✅ Found user: {user.get('email')} (ID: {user_id})")
        print(f"   Created: {user.get('created_at', 'Unknown')}")
        print(f"   Preferred Model: {user.get('preferred_model', 'Not set')}")
        print()
        
        # Get all documents for this user
        print(f"Fetching documents for user {user_id}...")
        documents = storage.get_documents_for_user(user_id)
        
        if not documents:
            print(f"📄 No documents found for user {email}")
            return
        
        print(f"📚 Found {len(documents)} document(s) for user {email}:")
        print("=" * 80)
        
        for i, doc in enumerate(documents, 1):
            print(f"{i}. Document ID: {doc.get('id', 'N/A')}")
            print(f"   Filename: {doc.get('filename', 'Unknown')}")
            print(f"   Upload Date: {doc.get('upload_date', 'Unknown')}")
            print(f"   Sections: {len(doc.get('sections', []))} sections")
            
            # Check if document has AI analysis
            if doc.get('ai_full_summary'):
                print(f"   ✅ Has AI Summary")
            if doc.get('clauses'):
                print(f"   ✅ Has Clauses Analysis ({len(doc.get('clauses', []))} clauses)")
            if doc.get('risk_summary'):
                risk = doc.get('risk_summary', {})
                print(f"   ⚠️  Risk Summary: High({risk.get('high', 0)}) Medium({risk.get('medium', 0)}) Low({risk.get('low', 0)})")
            
            print("-" * 80)
        
        print(f"\n📊 Summary:")
        print(f"   Total documents: {len(documents)}")
        print(f"   User email: {email}")
        print(f"   User ID: {user_id}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
