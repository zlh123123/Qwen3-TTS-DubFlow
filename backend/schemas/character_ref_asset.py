from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class CharacterRefImportRequest(BaseModel):
    source_path: str
    character_id: str
    display_name: Optional[str] = None
    copy_to_project: bool = True
    source_type: str = "imported"  # imported/generated/voice_design
    note: Optional[str] = None


class CharacterRefUpdate(BaseModel):
    character_id: Optional[str] = None
    display_name: Optional[str] = None
    note: Optional[str] = None


class CharacterRefResponse(BaseModel):
    id: str
    project_id: str
    character_id: Optional[str] = None
    source_type: str
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

    character_name_snapshot: Optional[str] = None
    character_gender_snapshot: Optional[str] = None
    character_age_snapshot: Optional[str] = None
    character_description_snapshot: Optional[str] = None
    character_prompt_snapshot: Optional[str] = None
    character_ref_text_snapshot: Optional[str] = None

    class Config:
        from_attributes = True
