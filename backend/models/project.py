from sqlalchemy import Column, String, Text, DateTime
from database import Base
import datetime
import uuid

class Project(Base):
    __tablename__ = "projects"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    language = Column(String, nullable=False)  # 语言代码，如 'en', 'zh' 等
    raw_content = Column(Text, nullable=True) # 全文
    state = Column(String, default="created") # created, analyzing, etc.
    created_at = Column(DateTime, default=datetime.datetime.now)