from pydantic import BaseModel
from typing import Optional

# front->back: 创建角色
class CharacterCreate(BaseModel):
    project_id: str
    name: str
    gender: Optional[str] = None
    age: Optional[str] = None
    description: Optional[str] = None
    prompt: Optional[str] = None
    ref_text: Optional[str] = None

# front->back: 更新角色信息
class CharacterUpdate(BaseModel):
    name: Optional[str] = None
    gender: Optional[str] = None
    age: Optional[str] = None
    description: Optional[str] = None
    prompt: Optional[str] = None
    ref_text: Optional[str] = None

# back->front: 角色响应
class CharacterResponse(BaseModel):
    id: int
    project_id: str
    name: str
    gender: Optional[str] = None
    age: Optional[str] = None
    description: Optional[str] = None
    prompt: Optional[str] = None
    is_confirmed: bool
    ref_audio_path: Optional[str] = None
    ref_audio_url: Optional[str] = None  # 前端用的完整URL
    duration: Optional[float] = None
    ref_text: Optional[str] = None

    class Config:
        from_attributes = True