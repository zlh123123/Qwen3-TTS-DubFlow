from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Any, Dict

# front->back: 创建任务
class TaskCreate(BaseModel):
    type: str  # analyze_char, parse_script, synthesis
    payload: Optional[Dict[str, Any]] = None

# back->front: 任务响应
class TaskResponse(BaseModel):
    id: str
    type: str
    status: str  # pending/processing/success/failed
    result: Optional[Dict[str, Any]] = None
    error_msg: Optional[str] = None
    created_at: datetime
    # 可选的进度信息
    position: Optional[int] = None  # 排队位置
    progress: Optional[Dict[str, Any]] = None  # {"current": 15, "total": 50, "percent": 30}

    class Config:
        from_attributes = True