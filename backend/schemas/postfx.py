from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class PostFxPresetCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    config: Dict[str, Any]


class PostFxPresetUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=80)
    config: Optional[Dict[str, Any]] = None


class PostFxPresetResponse(BaseModel):
    id: str
    preset_key: str
    name: str
    is_builtin: bool
    config: Dict[str, Any]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PostFxPreviewRequest(BaseModel):
    source_path: str
    preset_id: Optional[str] = None
    config_override: Optional[Dict[str, Any]] = None


class PostFxApplyRequest(BaseModel):
    source_path: str
    project_id: str
    preset_id: Optional[str] = None
    config_override: Optional[Dict[str, Any]] = None
    output_name: Optional[str] = None


class PostFxProcessResponse(BaseModel):
    output_path: str
    output_url: str
    preset_id: Optional[str] = None


class CharacterDefaultPresetUpdate(BaseModel):
    preset_id: Optional[str] = None


class CharacterDefaultPresetResponse(BaseModel):
    character_id: str
    character_name: str
    preset_id: Optional[str] = None
    preset_name: Optional[str] = None
