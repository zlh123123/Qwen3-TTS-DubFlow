from pydantic import BaseModel
from typing import Optional, Any, Dict

# 通用成功响应
class SuccessResponse(BaseModel):
    message: str = "success"
    data: Optional[Any] = None

# 通用错误响应
class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None

# 任务提交响应 (返回task_id)
class TaskSubmitResponse(BaseModel):
    task_id: str
    message: str = "Task submitted successfully"