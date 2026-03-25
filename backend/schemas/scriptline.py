from pydantic import BaseModel
from typing import Optional

# front->back: 创建台词
class ScriptLineCreate(BaseModel):
    project_id: str
    character_id: Optional[str] = None
    order_index: int
    text: str
    speed: float = 1.0

# front->back: 更新台词
class ScriptLineUpdate(BaseModel):
    character_id: Optional[str] = None
    text: Optional[str] = None
    speed: Optional[float] = None
    audio_path: Optional[str] = None
    status: Optional[str] = None
    duration: Optional[float] = None
    last_synth_voice_revision: Optional[int] = None

# back->front: 台词响应
class ScriptLineResponse(BaseModel):
    id: int
    project_id: str
    character_id: Optional[str] = None
    character_name: Optional[str] = None  # 冗余字段方便前端展示
    order_index: int
    text: str
    speed: float
    audio_path: Optional[str] = None
    audio_url: Optional[str] = None  # 前端用的完整URL
    duration: Optional[float] = None
    status: str  # pending/synthesized/failed
    last_synth_voice_revision: Optional[int] = None
    is_stale: bool = False
    stale_reason: Optional[str] = None

    class Config:
        from_attributes = True
