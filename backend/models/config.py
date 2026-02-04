from sqlalchemy import Column, String, Text, Boolean, JSON
from database import Base

class Config(Base):
    __tablename__ = "configs"

    key = Column(String, primary_key=True, index=True) # 键值
    value = Column(Text, nullable=True)                # 配置的值
    group = Column(String, nullable=False)             # 分组
    label = Column(String, nullable=False)             # 前端显示的中文名
    type = Column(String, nullable=False)              # 控件类型
    options = Column(JSON, nullable=True)              # 选项列表（当type为select时使用）
    default = Column(Text, nullable=True)              # 默认值
    is_public = Column(Boolean, default=True)          # 是否返给前端（公开）