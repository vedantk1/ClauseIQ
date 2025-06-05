"""
AI Model Configuration
Centralized configuration for available AI models and their descriptions.
"""
from typing import Dict, List
from dataclasses import dataclass
from pydantic import BaseModel


@dataclass
class AIModel:
    """Represents an AI model configuration."""
    id: str
    name: str
    description: str
    is_default: bool = False


class AIModelResponse(BaseModel):
    """Pydantic model for API responses."""
    id: str
    name: str
    description: str


class AIModelConfig:
    """Configuration class for AI models."""
    
    # Available AI models with their descriptions
    _models = [
        AIModel(
            id="gpt-3.5-turbo",
            name="GPT-3.5 Turbo",
            description="Fast and cost-effective for most tasks",
            is_default=True
        ),
        AIModel(
            id="gpt-4.1-mini",
            name="GPT-4.1 Mini", 
            description="Balanced performance and accuracy"
        ),
        AIModel(
            id="gpt-4.1-nano",
            name="GPT-4.1 Nano",
            description="Ultra lightweight and fast"
        ),
        AIModel(
            id="gpt-4o-mini",
            name="GPT-4o Mini",
            description="Optimized for speed and efficiency"
        ),
        AIModel(
            id="gpt-4o",
            name="GPT-4o",
            description="Most advanced model with superior accuracy"
        )
    ]
    
    @classmethod
    def get_available_models(cls) -> List[AIModel]:
        """Get list of all available AI models."""
        return cls._models.copy()
    
    @classmethod
    def get_model_ids(cls) -> List[str]:
        """Get list of available model IDs."""
        return [model.id for model in cls._models]
    
    @classmethod
    def get_default_model(cls) -> str:
        """Get the default model ID."""
        for model in cls._models:
            if model.is_default:
                return model.id
        # Fallback to first model if no default is set
        return cls._models[0].id if cls._models else ""
    
    @classmethod
    def get_model_by_id(cls, model_id: str) -> AIModel:
        """Get model configuration by ID."""
        for model in cls._models:
            if model.id == model_id:
                return model
        raise ValueError(f"Model '{model_id}' not found")
    
    @classmethod
    def is_valid_model(cls, model_id: str) -> bool:
        """Check if a model ID is valid."""
        return model_id in cls.get_model_ids()
    
    @classmethod
    def get_models_for_api(cls) -> List[Dict[str, str]]:
        """Get models formatted for API response."""
        return [
            {
                "id": model.id,
                "name": model.name,
                "description": model.description
            }
            for model in cls._models
        ]


# Convenience exports for backward compatibility
AVAILABLE_MODELS = AIModelConfig.get_model_ids()
DEFAULT_MODEL = AIModelConfig.get_default_model()
MODEL_DESCRIPTIONS = {model.id: model.description for model in AIModelConfig.get_available_models()}
