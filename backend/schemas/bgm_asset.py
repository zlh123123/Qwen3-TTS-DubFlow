from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class BgmAssetImportRequest(BaseModel):
    source_path: str
    display_name: Optional[str] = None
    copy_to_project: bool = True
    source_type: str = "imported"
    bpm: Optional[float] = None
    mood: Optional[str] = None
    note: Optional[str] = None


class BgmAssetUpdate(BaseModel):
    display_name: Optional[str] = None
    bpm: Optional[float] = None
    mood: Optional[str] = None
    note: Optional[str] = None


class BgmLinkRequest(BaseModel):
    asset_id: str


class BgmAssetResponse(BaseModel):
    id: str
    project_id: Optional[str] = None
    link_id: Optional[str] = None
    is_linked: Optional[bool] = None
    source_type: str
    display_name: str
    file_path: str
    file_format: Optional[str] = None
    file_size: Optional[int] = None
    duration: Optional[float] = None
    sample_rate: Optional[int] = None
    channels: Optional[int] = None
    bpm: Optional[float] = None
    mood: Optional[str] = None
    managed_file: bool
    note: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
