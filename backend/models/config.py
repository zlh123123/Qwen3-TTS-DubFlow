from sqlalchemy import Column, String, Text, Boolean
from database import Base

class Config(Base):
    __tablename__ = "configs"

    key = Column(String, primary_key=True)  # 唯一键名
    value = Column(Text, nullable=True)  # 配置值
    group = Column(String, nullable=False)  # 分组: appearance/llm_settings/tts_settings/synthesis_config
    label = Column(String, nullable=False)  # 前端显示的中文名称
    type = Column(String, nullable=False)  # password/text/select/boolean/number/color
    options = Column(Text, nullable=True)  # JSON 格式的选项列表
    default = Column(String, nullable=True)  # 默认值
    is_public = Column(Boolean, default=True)  # 是否公开给前端