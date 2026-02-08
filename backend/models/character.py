from sqlalchemy import Column, Integer, String, Text, Boolean, Float, ForeignKey
from database import Base

class Character(Base):
    __tablename__ = "characters"

    id = Column(String, primary_key=True)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    gender = Column(String, nullable=True)  # male/female/unknown
    age = Column(String, nullable=True)  # 可以是数字或描述
    description = Column(Text, nullable=True)  # 人设描述
    prompt = Column(Text, nullable=True)  # 音色提示词
    is_confirmed = Column(Boolean, default=False)  # 用户是否已确认音色
    ref_audio_path = Column(String, nullable=True)  # 定妆音频路径
    duration = Column(Float, nullable=True)  # 音频时长(秒)
    ref_text = Column(String, nullable=True)  # 生成定妆音频时用的文本