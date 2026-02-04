from pydantic import BaseModel
from typing import List, Optional, Any, Dict

# 单个配置项
class ConfigItem(BaseModel):
    key: str
    value: Optional[str]
    label: str
    type: str
    group: str
    options: Optional[List[str]] = None
    default: Optional[str] = None
    is_public: Optional[bool] = True
    class Config:
        from_attributes = True

# 单个更新项 
class ConfigUpdateItem(BaseModel):
    key: str
    value: str

# 批量更新请求
class ConfigUpdateRequest(BaseModel):
    updates: List[ConfigUpdateItem]

# GET 返回的完整结构 (字典: group_name -> list of items)
SettingsResponse = Dict[str, List[ConfigItem]]