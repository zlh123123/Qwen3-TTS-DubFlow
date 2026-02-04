from pydantic import BaseModel
from datetime import datetime
from typing import Optional

# front->back
class ProjectCreate(BaseModel):
    name: str
    content: str  

# back->front
class ProjectResponse(BaseModel):
    id: str
    name: str
    state: str
    created_at: datetime

    class Config:
        from_attributes = True 