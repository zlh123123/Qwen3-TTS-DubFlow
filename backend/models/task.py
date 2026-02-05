from sqlalchemy import Column, String, Text, DateTime
from database import Base
import datetime
import uuid

class Task(Base):
    __tablename__ = "tasks"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    type = Column(String, nullable=False)  # analyze_char, parse_script, synthesis
    status = Column(String, default="pending")  # pending/processing/success/failed
    payload = Column(Text, nullable=True)  # JSON 格式的任务参数
    result = Column(Text, nullable=True)  # JSON 格式的任务结果
    error_msg = Column(Text, nullable=True)  # 报错信息
    created_at = Column(DateTime, default=datetime.datetime.now)