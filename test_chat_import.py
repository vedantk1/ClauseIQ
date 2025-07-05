#!/usr/bin/env python3
"""
Quick test to verify which chat service file is being imported.
"""
import sys
import os

# Add the backend directory to Python path
backend_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend')
sys.path.append(backend_path)
os.chdir(backend_path)

try:
    from services.chat_service import ChatService
    import inspect
    
    # Get the file path of the imported module
    chat_service_file = inspect.getfile(ChatService)
    print(f"ChatService is being imported from: {chat_service_file}")
    
    # Check if our debug code is in the file
    with open(chat_service_file, 'r') as f:
        content = f.read()
        if "URGENT DEBUG" in content:
            print("✅ Our debug code is present in the imported file")
        else:
            print("❌ Our debug code is NOT present in the imported file")
    
    # Try to instantiate the service and see if debug prints appear
    print("Creating ChatService instance...")
    service = ChatService()
    print("ChatService instance created successfully")
    
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
