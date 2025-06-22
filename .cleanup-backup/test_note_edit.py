#!/usr/bin/env python3
"""
Test script to verify note editing functionality
"""
import asyncio
import sys
import os

# Add the backend directory to the path
sys.path.append('/Users/vedan/Downloads/clauseiq-project/backend')

from database.service import DocumentService

async def test_note_editing():
    """Test the note editing functionality"""
    
    service = DocumentService()
    
    # Test data
    document_id = "test_doc_id"
    clause_id = "test_clause_id"
    user_id = "test_user_id"
    test_text = "This is a test note"
    updated_text = "This is an updated test note"
    
    try:
        print("🧪 [TEST] Testing note editing functionality...")
        
        # Step 1: Add a note
        print("📝 [TEST] Adding a test note...")
        new_note = await service.add_note(document_id, clause_id, user_id, test_text)
        print(f"✅ [TEST] Note added: {new_note}")
        
        note_id = new_note["id"]
        
        # Step 2: Update the note
        print("✏️ [TEST] Updating the note...")
        updated_note = await service.update_note(document_id, clause_id, user_id, note_id, updated_text)
        print(f"✅ [TEST] Note updated: {updated_note}")
        
        # Step 3: Verify the update
        if updated_note and updated_note.get("id") == note_id and updated_note.get("text") == updated_text:
            print("🎉 [TEST] SUCCESS: Note editing functionality works correctly!")
            print(f"📋 [TEST] Updated note details:")
            print(f"   - ID: {updated_note.get('id')}")
            print(f"   - Text: {updated_note.get('text')}")
            print(f"   - Created At: {updated_note.get('created_at')}")
        else:
            print("❌ [TEST] FAILURE: Note editing functionality is broken!")
            print(f"   - Expected text: {updated_text}")
            print(f"   - Actual note: {updated_note}")
        
        # Step 4: Clean up - delete the note
        print("🧹 [TEST] Cleaning up test data...")
        deleted = await service.delete_note(document_id, clause_id, user_id, note_id)
        print(f"✅ [TEST] Note deleted: {deleted}")
        
    except Exception as e:
        print(f"❌ [TEST] ERROR: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_note_editing())
