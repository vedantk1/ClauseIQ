#!/usr/bin/env python3
"""
Type synchronization script for ClauseIQ.
This script ensures that the TypeScript and Python type definitions are in sync.
"""
import json
import re
from pathlib import Path
import sys

# Constants
TS_TYPE_FILE = Path(__file__).parent.parent / "shared" / "types" / "common.ts"
PY_TYPE_FILE = Path(__file__).parent.parent / "shared" / "types" / "common.py"

def extract_python_enums():
    """Extract enum definitions from the Python file."""
    with open(PY_TYPE_FILE, "r") as f:
        content = f.read()
    
    # Regular expression to find enum classes
    enum_pattern = r"class\s+(\w+)\(str,\s*Enum\):\s*(?:\"\"\".*?\"\"\"\s*)?([^class]*?)(?=\n\n|\n\s*class|\Z)"
    matches = re.finditer(enum_pattern, content, re.DOTALL)
    
    enums = {}
    for match in matches:
        enum_name = match.group(1)
        enum_body = match.group(2)
        
        # Extract enum values
        value_pattern = r"(\w+)\s*=\s*[\"']([^\"']+)[\"']"
        values = re.findall(value_pattern, enum_body)
        
        enum_values = {key: value for key, value in values}
        enums[enum_name] = enum_values
    
    return enums

def extract_ts_enums():
    """Extract enum definitions from the TypeScript file."""
    with open(TS_TYPE_FILE, "r") as f:
        content = f.read()
    
    # Regular expression to find enum declarations
    enum_pattern = r"export\s+enum\s+(\w+)\s*\{([^}]*)\}"
    matches = re.finditer(enum_pattern, content, re.DOTALL)
    
    enums = {}
    for match in matches:
        enum_name = match.group(1)
        enum_body = match.group(2)
        
        # Extract enum values
        value_pattern = r"(\w+)\s*=\s*[\"']([^\"']+)[\"']"
        values = re.findall(value_pattern, enum_body)
        
        enum_values = {key: value for key, value in values}
        enums[enum_name] = enum_values
    
    return enums

def check_sync():
    """Check if TypeScript and Python enums are in sync."""
    py_enums = extract_python_enums()
    ts_enums = extract_ts_enums()
    
    all_synced = True
    
    # Check Python enums exist in TypeScript
    for enum_name, enum_values in py_enums.items():
        if enum_name not in ts_enums:
            print(f"❌ Enum {enum_name} exists in Python but not in TypeScript")
            all_synced = False
            continue
            
        ts_enum_values = ts_enums[enum_name]
        
        # Check all Python enum values exist in TypeScript
        for key, value in enum_values.items():
            if key not in ts_enum_values:
                print(f"❌ Enum value {enum_name}.{key} exists in Python but not in TypeScript")
                all_synced = False
            elif ts_enum_values[key] != value:
                print(f"❌ Enum value {enum_name}.{key} has different values: Python='{value}', TypeScript='{ts_enum_values[key]}'")
                all_synced = False
    
    # Check TypeScript enums exist in Python
    for enum_name, enum_values in ts_enums.items():
        if enum_name not in py_enums:
            print(f"❌ Enum {enum_name} exists in TypeScript but not in Python")
            all_synced = False
            continue
            
        py_enum_values = py_enums[enum_name]
        
        # Check all TypeScript enum values exist in Python
        for key, value in enum_values.items():
            if key not in py_enum_values:
                print(f"❌ Enum value {enum_name}.{key} exists in TypeScript but not in Python")
                all_synced = False
            # We already checked values match above
    
    if all_synced:
        print("✅ All enums are in sync between Python and TypeScript")
        return True
    return False

if __name__ == "__main__":
    if not check_sync():
        print("❌ Type definitions are not in sync!")
        sys.exit(1)
    print("✅ Type definitions are in sync!")
    sys.exit(0)
