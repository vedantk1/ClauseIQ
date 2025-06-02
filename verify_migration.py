#!/usr/bin/env python3
"""
MongoDB Migration Verification Script
This script verifies that the MongoDB migration is working correctly.
"""

import sys
import os
from pathlib import Path

# Add the backend directory to the path
backend_dir = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_dir))

def verify_configuration():
    """Verify that configuration is properly set up."""
    try:
        from config import MONGODB_URI, MONGODB_DATABASE, MONGODB_COLLECTION, STORAGE_DIR
        print("✅ Configuration loaded successfully:")
        print(f"   MongoDB URI: {MONGODB_URI}")
        print(f"   Database: {MONGODB_DATABASE}")
        print(f"   Collection: {MONGODB_COLLECTION}")
        print(f"   Storage Directory: {STORAGE_DIR}")
        return True
    except Exception as e:
        print(f"❌ Configuration error: {e}")
        return False

def verify_database_module():
    """Verify that the database module can be imported."""
    try:
        from database import MongoDBConnection, MongoDocumentStorage, get_mongo_storage
        print("✅ Database module imported successfully")
        return True
    except Exception as e:
        print(f"❌ Database module error: {e}")
        return False

def verify_main_application():
    """Verify that the main application can be imported."""
    try:
        from main import app, get_mongo_storage
        print("✅ Main application imported successfully")
        return True
    except Exception as e:
        print(f"❌ Main application error: {e}")
        return False

def verify_test_suite():
    """Verify that tests can run."""
    try:
        import subprocess
        result = subprocess.run([
            sys.executable, "-m", "pytest", "backend/tests/", "--tb=short", "-q"
        ], capture_output=True, text=True, cwd=Path(__file__).parent)
        
        if result.returncode == 0:
            print("✅ All tests passed successfully")
            return True
        else:
            print(f"❌ Some tests failed:")
            print(result.stdout)
            print(result.stderr)
            return False
    except Exception as e:
        print(f"❌ Test execution error: {e}")
        return False

def verify_existing_data():
    """Check if there's existing data to migrate."""
    try:
        from config import STORAGE_DIR
        if os.path.exists(STORAGE_DIR):
            json_files = [f for f in os.listdir(STORAGE_DIR) if f.endswith('.json')]
            if json_files:
                print(f"✅ Found {len(json_files)} JSON files ready for migration:")
                for file in json_files[:3]:  # Show first 3 files
                    print(f"   - {file}")
                if len(json_files) > 3:
                    print(f"   ... and {len(json_files) - 3} more files")
            else:
                print("ℹ️  No existing JSON files found - fresh installation")
        else:
            print("ℹ️  Storage directory doesn't exist - fresh installation")
        return True
    except Exception as e:
        print(f"❌ Data verification error: {e}")
        return False

def verify_docker_configuration():
    """Verify Docker configuration files."""
    try:
        docker_files = [
            "docker-compose.yml",
            "docker-compose.dev.yml",
            "database/init-mongo.js"
        ]
        
        missing_files = []
        for file in docker_files:
            file_path = Path(__file__).parent / file
            if not file_path.exists():
                missing_files.append(file)
        
        if missing_files:
            print(f"❌ Missing Docker files: {', '.join(missing_files)}")
            return False
        else:
            print("✅ All Docker configuration files present")
            return True
    except Exception as e:
        print(f"❌ Docker verification error: {e}")
        return False

def main():
    """Run all verification checks."""
    print("🔍 MongoDB Migration Verification")
    print("=" * 50)
    
    checks = [
        ("Configuration", verify_configuration),
        ("Database Module", verify_database_module),
        ("Main Application", verify_main_application),
        ("Test Suite", verify_test_suite),
        ("Existing Data", verify_existing_data),
        ("Docker Configuration", verify_docker_configuration)
    ]
    
    passed = 0
    total = len(checks)
    
    for check_name, check_func in checks:
        print(f"\n🔎 Checking {check_name}...")
        if check_func():
            passed += 1
        
    print("\n" + "=" * 50)
    print(f"📊 Verification Results: {passed}/{total} checks passed")
    
    if passed == total:
        print("🎉 MongoDB migration verification completed successfully!")
        print("\n✨ Your Legal AI project is ready for MongoDB!")
        print("\n📋 Next steps:")
        print("   1. Start MongoDB: docker-compose up -d mongodb")
        print("   2. Run migration: python database/migrate_to_mongodb.py")
        print("   3. Start backend: docker-compose up -d backend")
        print("   4. Start frontend: docker-compose up -d frontend")
    else:
        print("⚠️  Some verification checks failed. Please review the errors above.")
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main())
