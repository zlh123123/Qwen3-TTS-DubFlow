from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class EffectAssetImportRequest(BaseModel):
    source_path: str
    effect_category: str = "ambience"  # ambience/effect
    display_name: Optional[str] = None
    copy_to_project: bool = True
    source_type: str = "imported"
    note: Optional[str] = None


class EffectAssetUpdate(BaseModel):
    effect_category: Optional[str] = None
    display_name: Optional[str] = None
    note: Optional[str] = None


class EffectLinkRequest(BaseModel):
    asset_id: str


class EffectAssetResponse(BaseModel):
    id: str
    project_id: Optional[str] = None
    link_id: Optional[str] = None
    is_linked: Optional[bool] = None
    source_type: str
    effect_category: str
    display_name: str
    file_path: str
    file_format: Optional[str] = None
    file_size: Optional[int] = None
    duration: Optional[float] = None
    sample_rate: Optional[int] = None
    channels: Optional[int] = None
    managed_file: bool
    note: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
