from pydantic import BaseModel
from typing import Optional, List, Any

# front->back: 更新配置
class ConfigUpdate(BaseModel):
    key: str
    value: str

class ConfigBatchUpdate(BaseModel):
    updates: List[ConfigUpdate]

# back->front: 配置响应
class ConfigResponse(BaseModel):
    key: str
    value: Optional[str] = None
    group: str
    label: str
    type: str  # password/text/select/boolean/number/color
    options: Optional[List[str]] = None
    default: Optional[str] = None
    is_public: bool

    class Config:
        from_attributes = True

# back->front: 按分组返回配置
class ConfigGroupResponse(BaseModel):
    appearance: List[ConfigResponse] = []
    llm_settings: List[ConfigResponse] = []
    tts_settings: List[ConfigResponse] = []
    synthesis_config: List[ConfigResponse] = []