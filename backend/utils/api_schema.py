"""
API Schema utility for FastAPI endpoints based on shared types.
This utility makes it easy to create API endpoints that use our shared types.
"""
from typing import Type, TypeVar, List, Dict, Any, Optional, Generic, get_origin, get_args, get_type_hints
from pydantic import BaseModel, create_model
from fastapi import APIRouter, Depends, HTTPException, Query, Path, Body
import inspect
from enum import Enum
import sys
import os
from pathlib import Path

# Add the shared directory to the Python path
shared_path = Path(__file__).parent.parent.parent / "shared"
sys.path.insert(0, str(shared_path))

# Import shared types
from shared.types.common import *

T = TypeVar('T', bound=BaseModel)

class ApiSchema:
    """
    Utility for automatically generating API schemas from shared types.
    """
    
    @staticmethod
    def create_request_model(
        model_type: Type[BaseModel],
        name: str,
        exclude_fields: List[str] = None,
        optional_fields: List[str] = None
    ) -> Type[BaseModel]:
        """
        Create a Pydantic model for request validation based on a shared type.
        
        Args:
            model_type: The shared type to base the request model on
            name: Name for the new model
            exclude_fields: Fields to exclude from the model
            optional_fields: Fields to make optional
            
        Returns:
            A new Pydantic model for request validation
        """
        exclude_fields = exclude_fields or []
        optional_fields = optional_fields or []
        
        # Get the fields from the original model
        fields = {}
        for field_name, field in model_type.model_fields.items():
            if field_name in exclude_fields:
                continue
            
            # Make selected fields optional
            if field_name in optional_fields:
                field.default = None
                field.annotation = Optional[field.annotation] if not hasattr(field.annotation, "__origin__") else field.annotation
            
            fields[field_name] = (field.annotation, field.get_default())
        
        # Create the new model
        return create_model(name, **fields)
    
    @staticmethod
    def create_response_model(
        model_type: Type[BaseModel],
        name: str,
        include_fields: List[str] = None
    ) -> Type[BaseModel]:
        """
        Create a Pydantic model for response based on a shared type.
        
        Args:
            model_type: The shared type to base the response model on
            name: Name for the new model
            include_fields: Fields to include (if None, include all)
            
        Returns:
            A new Pydantic model for response
        """
        # Get the fields from the original model
        fields = {}
        for field_name, field in model_type.model_fields.items():
            if include_fields and field_name not in include_fields:
                continue
            fields[field_name] = (field.annotation, field.get_default())
        
        # Create the new model
        return create_model(name, **fields)
    
    @staticmethod
    def create_list_response_model(item_type: Type[BaseModel], name: str) -> Type[BaseModel]:
        """
        Create a Pydantic model for list responses.
        
        Args:
            item_type: The type of items in the list
            name: Name for the new model
            
        Returns:
            A new Pydantic model for list responses
        """
        return create_model(
            name,
            items=(List[item_type], ...),
            total=(int, ...),
            page=(int, ...),
            page_size=(int, ...)
        )


class CrudRouter(Generic[T]):
    """
    Generic CRUD router for FastAPI based on shared types.
    """
    
    def __init__(
        self,
        model: Type[T],
        router: APIRouter,
        prefix: str,
        tags: List[str] = None,
        get_db=None
    ):
        """
        Initialize the CRUD router.
        
        Args:
            model: The shared type model to use
            router: The FastAPI router to add routes to
            prefix: URL prefix for all routes
            tags: OpenAPI tags for all routes
            get_db: Function to get database connection dependency
        """
        self.model = model
        self.router = router
        self.prefix = prefix
        self.tags = tags or [model.__name__]
        self.get_db = get_db
        
        # Register routes
        self._register_routes()
    
    def _register_routes(self):
        """Register CRUD routes on the router."""
        model_name = self.model.__name__
        
        # Create request/response models
        CreateSchema = ApiSchema.create_request_model(
            self.model, f"Create{model_name}Request", exclude_fields=["id"])
        UpdateSchema = ApiSchema.create_request_model(
            self.model, f"Update{model_name}Request", optional_fields=list(self.model.model_fields.keys()))
        ResponseSchema = ApiSchema.create_response_model(
            self.model, f"{model_name}Response")
        ListResponseSchema = ApiSchema.create_list_response_model(
            ResponseSchema, f"{model_name}ListResponse")
        
        # Register the routes with appropriate schemas
        @self.router.post(f"{self.prefix}", tags=self.tags, response_model=ResponseSchema)
        async def create_item(item: CreateSchema):
            """Create a new item."""
            db = self.get_db() if self.get_db else None
            # Implementation would go here
            return {"id": "new-id", **item.model_dump()}
        
        @self.router.get(f"{self.prefix}", tags=self.tags, response_model=ListResponseSchema)
        async def list_items(
            page: int = Query(1, ge=1, description="Page number"),
            page_size: int = Query(10, ge=1, le=100, description="Items per page")
        ):
            """List all items with pagination."""
            db = self.get_db() if self.get_db else None
            # Implementation would go here
            return {
                "items": [],
                "total": 0,
                "page": page,
                "page_size": page_size
            }
        
        @self.router.get(f"{self.prefix}/{{item_id}}", tags=self.tags, response_model=ResponseSchema)
        async def get_item(item_id: str = Path(..., description=f"{model_name} ID")):
            """Get a single item by ID."""
            db = self.get_db() if self.get_db else None
            # Implementation would go here
            raise HTTPException(status_code=404, detail=f"{model_name} not found")
        
        @self.router.put(f"{self.prefix}/{{item_id}}", tags=self.tags, response_model=ResponseSchema)
        async def update_item(
            item: UpdateSchema,
            item_id: str = Path(..., description=f"{model_name} ID")
        ):
            """Update an item."""
            db = self.get_db() if self.get_db else None
            # Implementation would go here
            raise HTTPException(status_code=404, detail=f"{model_name} not found")
        
        @self.router.delete(f"{self.prefix}/{{item_id}}", tags=self.tags)
        async def delete_item(item_id: str = Path(..., description=f"{model_name} ID")):
            """Delete an item."""
            db = self.get_db() if self.get_db else None
            # Implementation would go here
            return {"success": True}
