#!/usr/bin/env python3
"""
Utility to generate TypeScript interfaces from Python Pydantic models.
This helps keep frontend and backend type definitions in sync.
"""
import inspect
import sys
import re
from pathlib import Path
from typing import Dict, List, Any, Optional, get_origin, get_args, Union
from enum import Enum
import importlib.util

# Type mapping from Python to TypeScript
TYPE_MAPPING = {
    'str': 'string',
    'int': 'number',
    'float': 'number',
    'bool': 'boolean',
    'dict': 'Record<string, any>',
    'Dict': 'Record<string, any>',
    'list': 'any[]',
    'List': 'any[]',
    'Optional': 'optional',
    'Any': 'any',
    'datetime': 'string',
    'date': 'string',
    'UUID': 'string',
    'uuid.UUID': 'string',
}

def process_type_annotation(annotation: Any) -> str:
    """Convert a Python type annotation to TypeScript."""
    if hasattr(annotation, '__origin__'):
        origin = get_origin(annotation)
        args = get_args(annotation)
        
        if origin == list or origin == List:
            if args:
                return f"{process_type_annotation(args[0])}[]"
            return "any[]"
        elif origin == dict or origin == Dict:
            if len(args) >= 2:
                key_type = process_type_annotation(args[0])
                value_type = process_type_annotation(args[1])
                return f"Record<{key_type}, {value_type}>"
            return "Record<string, any>"
        elif origin == Union:
            # Handle Optional types (Union[X, None])
            if type(None) in args:
                # Get the non-None type
                other_types = [arg for arg in args if arg is not type(None)]
                if len(other_types) == 1:
                    return process_type_annotation(other_types[0]) + " | null"
            
            # Regular union type
            types = [process_type_annotation(arg) for arg in args]
            return " | ".join(types)
    
    # Handle simple types
    type_str = str(annotation)
    type_str = re.sub(r"<class '([^']+)'>", r"\1", type_str)
    
    # Handle specific model references
    if 'clauseiq_types.common.' in type_str:
        # Extract just the class name
        class_name = type_str.split('.')[-1]
        return class_name
    
    # Handle Enum types
    if hasattr(annotation, '__members__'):
        # It's an Enum, return the enum name
        return annotation.__name__
    
    # Handle forward references and typing constructs
    if hasattr(annotation, '__name__'):
        return annotation.__name__
    
    # Use mapping or the type name as is
    return TYPE_MAPPING.get(type_str, type_str)

def analyze_pydantic_model(model_class: Any) -> Dict[str, Dict[str, Any]]:
    """Analyze a Pydantic model and return field information."""
    fields = {}
    
    # Get field types from model annotations
    for field_name, field_annotation in getattr(model_class, '__annotations__', {}).items():
        is_optional = False
        
        # Check if field has a default value or is Optional in model_fields
        if hasattr(model_class, 'model_fields') and field_name in model_class.model_fields:
            field_def = model_class.model_fields[field_name]
            # Check if field is optional based on default value or type annotation
            is_optional = (field_def.default is not None or 
                          field_def.default_factory is not None or
                          'Optional' in str(field_annotation) or
                          'None' in str(field_annotation))
        
        # Process type annotation
        ts_type = process_type_annotation(field_annotation)
        
        # Add to fields dict
        fields[field_name] = {
            'type': ts_type,
            'optional': is_optional
        }
    
    return fields

def generate_ts_interface(model_class: Any) -> str:
    """Generate TypeScript interface from a Pydantic model."""
    class_name = model_class.__name__
    fields = analyze_pydantic_model(model_class)
    
    # Generate TypeScript interface
    lines = [f"export interface {class_name} {{"]
    
    for field_name, field_info in fields.items():
        optional_mark = "?" if field_info['optional'] else ""
        lines.append(f"  {field_name}{optional_mark}: {field_info['type']};")
    
    lines.append("}")
    
    return "\n".join(lines)

def generate_ts_enum(enum_class: Any) -> str:
    """Generate TypeScript enum from a Python Enum."""
    enum_name = enum_class.__name__
    lines = [f"export enum {enum_name} {{"]
    
    for member_name, member in enum_class.__members__.items():
        if isinstance(member.value, str):
            lines.append(f"  {member_name} = \"{member.value}\",")
        else:
            lines.append(f"  {member_name} = {member.value},")
    
    lines.append("}")
    
    return "\n".join(lines)

def generate_ts_types_from_module(module_path: str, output_path: str):
    """Generate TypeScript types from Python module."""
    # Import the module
    spec = importlib.util.spec_from_file_location("module", module_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    
    # Collect all Pydantic models and Enums
    models = []
    enums = []
    
    for name, obj in inspect.getmembers(module):
        if inspect.isclass(obj) and hasattr(obj, 'model_fields'):
            models.append(obj)
        elif inspect.isclass(obj) and hasattr(obj, '__members__') and hasattr(obj, '__enum__'):
            enums.append(obj)
    
    # Generate TypeScript code
    ts_code = [
        "/**",
        " * Generated TypeScript interfaces from Python Pydantic models",
        f" * Source: {module_path}",
        " * This file is auto-generated. Do not edit directly.",
        " */",
        ""
    ]
    
    # Add imports for enums from common.ts (since we're generating interfaces only)
    if any(field_info['type'] in ['ClauseType', 'RiskLevel', 'ContractType'] 
           for model_class in models 
           for field_info in analyze_pydantic_model(model_class).values()):
        ts_code.append('import { ClauseType, RiskLevel, ContractType } from "./common";')
        ts_code.append("")
    
    # Add interfaces (no enums in generated file, those come from common.ts)
    for model_class in models:
        ts_interface = generate_ts_interface(model_class)
        ts_code.append(ts_interface)
        ts_code.append("")
    
    # Write to file
    with open(output_path, 'w') as f:
        f.write("\n".join(ts_code))
    
    print(f"Generated TypeScript interfaces in {output_path}")
    print(f"- 0 enums")  # Enums are in common.ts
    print(f"- {len(models)} interfaces")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python generate_ts_types.py <python_module_path> <output_ts_path>")
        sys.exit(1)
    
    module_path = sys.argv[1]
    output_path = sys.argv[2]
    
    generate_ts_types_from_module(module_path, output_path)
