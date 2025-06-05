#!/usr/bin/env python3
"""
Verification script for the shared types system.
This script checks that:
1. The shared types package is installed correctly
2. The backend can import and use shared types
3. The types are synchronized between Python and TypeScript
"""
import sys
import os
from pathlib import Path
import importlib.util
import json
import subprocess
import re

# ANSI color codes for prettier output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
BOLD = '\033[1m'
RESET = '\033[0m'

def print_header(text):
    print(f"\n{BLUE}{BOLD}{'=' * 60}{RESET}")
    print(f"{BLUE}{BOLD}{text.center(60)}{RESET}")
    print(f"{BLUE}{BOLD}{'=' * 60}{RESET}\n")

def print_success(text):
    print(f"{GREEN}✓ {text}{RESET}")

def print_error(text):
    print(f"{RED}✗ {text}{RESET}")

def print_warning(text):
    print(f"{YELLOW}! {text}{RESET}")

def print_info(text):
    print(f"{BLUE}→ {text}{RESET}")

def check_import(module_name):
    """Check if a module can be imported."""
    try:
        importlib.import_module(module_name)
        return True
    except ImportError:
        return False

def run_command(command, cwd=None):
    """Run a shell command and capture output."""
    try:
        result = subprocess.run(
            command, 
            shell=True, 
            check=True, 
            cwd=cwd, 
            stdout=subprocess.PIPE, 
            stderr=subprocess.PIPE,
            text=True
        )
        return True, result.stdout
    except subprocess.CalledProcessError as e:
        return False, e.stderr

def check_type_sync():
    """Check if types are in sync between TypeScript and Python."""
    script_path = Path(__file__).parent / "sync_types.py"
    
    if not script_path.exists():
        print_error(f"Type sync script not found at {script_path}")
        return False
    
    success, output = run_command(f"python {script_path}")
    return success

def check_typescript_validation():
    """Check if TypeScript validation utilities are working."""
    ts_file = Path(__file__).parent.parent / "shared" / "types" / "validation.ts"
    
    if not ts_file.exists():
        print_error(f"TypeScript validation file not found at {ts_file}")
        return False
    
    with open(ts_file, "r") as f:
        content = f.read()
    
    # Check for essential validation functions
    required_exports = [
        "clauseSchema", 
        "riskLevelSchema", 
        "validateSection", 
        "validateClause"
    ]
    
    missing = []
    for export in required_exports:
        if export not in content:
            missing.append(export)
    
    if missing:
        print_error(f"Missing validation exports: {', '.join(missing)}")
        return False
    
    return True

def check_api_schema_utils():
    """Check if API schema utilities are working."""
    api_schema_file = Path(__file__).parent.parent / "backend" / "utils" / "api_schema.py"
    
    if not api_schema_file.exists():
        print_error(f"API schema utility file not found at {api_schema_file}")
        return False
    
    # Add the backend directory to the Python path
    backend_dir = Path(__file__).parent.parent / "backend"
    sys.path.insert(0, str(backend_dir))
    
    try:
        from utils.api_schema import ApiSchema, CrudRouter
        print_success("Successfully imported API schema utilities")
        return True
    except ImportError as e:
        print_error(f"Failed to import API schema utilities: {e}")
        return False

def check_example_endpoints():
    """Check if example endpoints using shared types exist."""
    example_router = Path(__file__).parent.parent / "backend" / "routers" / "example.py"
    
    if not example_router.exists():
        print_error(f"Example router not found at {example_router}")
        return False
    
    with open(example_router, "r") as f:
        content = f.read()
    
    if "from shared.types.common import" not in content:
        print_error("Example router does not import shared types")
        return False
    
    print_success("Example router correctly imports shared types")
    return True

def check_frontend_component():
    """Check if example frontend component using shared types exists."""
    example_component = Path(__file__).parent.parent / "frontend" / "src" / "components" / "example" / "ExampleClauseForm.tsx"
    
    if not example_component.exists():
        print_error(f"Example component not found at {example_component}")
        return False
    
    with open(example_component, "r") as f:
        content = f.read()
    
    if "from '../../../shared/types/common'" not in content:
        print_error("Example component does not import shared types")
        return False
    
    print_success("Example component correctly imports shared types")
    return True

def main():
    print_header("SHARED TYPES VERIFICATION")
    
    # Check if we're in the right directory
    script_dir = Path(__file__).parent
    project_dir = script_dir.parent
    
    print_info(f"Project directory: {project_dir}")
    
    # 1. Check if shared types package is installed correctly
    print_header("Checking Shared Types Package")
    
    # Add the shared directory to the Python path
    shared_dir = project_dir / "shared"
    sys.path.insert(0, str(shared_dir))
    
    import_success = check_import("shared.types.common")
    if import_success:
        print_success("Successfully imported shared types package")
        
        # Test importing specific types
        from shared.types.common import ClauseType, RiskLevel, Clause, Section
        print_success("Successfully imported specific types")
    else:
        print_error("Failed to import shared types package")
        print_info("Try running: pip install -e ../shared")
        return
    
    # 2. Check type synchronization
    print_header("Checking Type Synchronization")
    if check_type_sync():
        print_success("Types are synchronized between TypeScript and Python")
    else:
        print_error("Types are not synchronized between TypeScript and Python")
    
    # 3. Check TypeScript validation utilities
    print_header("Checking TypeScript Validation")
    if check_typescript_validation():
        print_success("TypeScript validation utilities are configured correctly")
    else:
        print_warning("TypeScript validation utilities may have issues")
    
    # 4. Check API schema utilities
    print_header("Checking API Schema Utilities")
    check_api_schema_utils()
    
    # 5. Check example implementations
    print_header("Checking Example Implementations")
    backend_ok = check_example_endpoints()
    frontend_ok = check_frontend_component()
    
    # 6. Final summary
    print_header("VERIFICATION SUMMARY")
    if import_success and backend_ok and frontend_ok:
        print_success("Shared types system is correctly set up and ready to use!")
        print_info("Documentation available at: docs/SHARED_TYPES_GUIDE.md")
    else:
        print_warning("Some issues were found with the shared types system.")
        print_info("Review the detailed messages above and fix any issues.")
        print_info("For guidance, see: docs/SHARED_TYPES_GUIDE.md")

if __name__ == "__main__":
    main()
