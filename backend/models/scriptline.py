from sqlalchemy import Column, Integer, String, Text, Float, ForeignKey
from database import Base

class ScriptLine(Base):
    __tablename__ = "script_lines"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    character_id = Column(Integer, ForeignKey("characters.id", ondelete="SET NULL"), nullable=True)
    order_index = Column(Integer, nullable=False)  # 台词顺序
    text = Column(Text, nullable=False)  # 台词内容
    speed = Column(Float, default=1.0)  # 语速
    audio_path = Column(String, nullable=True)  # 合成后的音频路径
    duration = Column(Float, nullable=True)  # 音频时长(秒)
    status = Column(String, default="pending")  # pending/synthesized/failed