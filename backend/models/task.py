from sqlalchemy import Column, String, Text, DateTime, ForeignKey, JSON
from database import Base
import datetime
import uuid

class Task(Base):
    __tablename__ = "tasks"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    type = Column(String, nullable=False)  # analyze_char, parse_script, synthesis
    status = Column(String, default="pending")  # pending/processing/success/failed
    payload = Column(JSON, nullable=True)  # 改为 JSON 类型
    result = Column(JSON, nullable=True)  # 改为 JSON 类型
    error_msg = Column(Text, nullable=True)  # 报错信息
    created_at = Column(DateTime, default=datetime.datetime.now)