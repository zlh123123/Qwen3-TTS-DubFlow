"""SQLite 连接管理 + ORM 模型定义"""

import os
import uuid
import datetime
from sqlalchemy import (
    create_engine,
    event,
    Column,
    String,
    Text,
    DateTime,
    Boolean,
    Float,
    Integer,
    ForeignKey,
    JSON,
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from config import DATABASE_PATH, DATABASE_URL as ENV_DATABASE_URL


if ENV_DATABASE_URL:
    DATABASE_URL = ENV_DATABASE_URL
else:
    DATABASE_URL = f"sqlite:///{DATABASE_PATH}"

if DATABASE_URL.startswith("sqlite:///"):
    # sqlite:///./storage/database.db 或 sqlite:///storage/database.db
    db_rel = DATABASE_URL.replace("sqlite:///", "", 1)
    db_dir = os.path.dirname(db_rel) or "."
    os.makedirs(db_dir, exist_ok=True)

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False,
)

if DATABASE_URL.startswith("sqlite:///"):
    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """获取数据库会话"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class Project(Base):
    __tablename__ = "projects"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    language = Column(String, nullable=False)
    raw_content = Column(Text, nullable=True)
    state = Column(String, default="created")
    created_at = Column(DateTime, default=datetime.datetime.now)

    characters = relationship(
        "Character",
        back_populates="project",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    tasks = relationship(
        "Task",
        back_populates="project",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    script_lines = relationship(
        "ScriptLine",
        back_populates="project",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    character_ref_assets = relationship(
        "CharacterRefAsset",
        back_populates="project",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    effect_assets = relationship(
        "EffectAsset",
        back_populates="project",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    bgm_assets = relationship(
        "BgmAsset",
        back_populates="project",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class Character(Base):
    __tablename__ = "characters"

    id = Column(String, primary_key=True)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    gender = Column(String, nullable=True)
    age = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    prompt = Column(Text, nullable=True)
    is_confirmed = Column(Boolean, default=False)
    ref_audio_path = Column(String, nullable=True)
    duration = Column(Float, nullable=True)
    ref_text = Column(String, nullable=True)

    project = relationship("Project", back_populates="characters")
    character_ref_assets = relationship("CharacterRefAsset", back_populates="character")


class ScriptLine(Base):
    __tablename__ = "script_lines"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    character_id = Column(String, ForeignKey("characters.id", ondelete="SET NULL"), nullable=True)
    order_index = Column(Integer, nullable=False)
    text = Column(Text, nullable=False)
    speed = Column(Float, default=1.0)
    audio_path = Column(String, nullable=True)
    duration = Column(Float, nullable=True)
    status = Column(String, default="pending")

    project = relationship("Project", back_populates="script_lines")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    type = Column(String, nullable=False)
    status = Column(String, default="pending")
    payload = Column(JSON, nullable=True)
    result = Column(JSON, nullable=True)
    error_msg = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.now)

    project = relationship("Project", back_populates="tasks")


class Config(Base):
    __tablename__ = "configs"

    key = Column(String, primary_key=True)
    value = Column(Text, nullable=True)
    group = Column(String, nullable=False)
    label = Column(String, nullable=False)
    type = Column(String, nullable=False)
    options = Column(JSON, nullable=True)
    default = Column(String, nullable=True)
    is_public = Column(Boolean, default=True)


class CharacterRefAsset(Base):
    __tablename__ = "character_ref_assets"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    character_id = Column(String, ForeignKey("characters.id", ondelete="SET NULL"), nullable=True)
    source_type = Column(String, nullable=False, default="imported")  # imported/generated/voice_design
    display_name = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_format = Column(String, nullable=True)
    file_size = Column(Integer, nullable=True)
    duration = Column(Float, nullable=True)
    sample_rate = Column(Integer, nullable=True)
    channels = Column(Integer, nullable=True)
    managed_file = Column(Boolean, default=True)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.now)

    # 角色快照，保证素材回溯时不依赖角色后续编辑结果
    character_name_snapshot = Column(String, nullable=True)
    character_gender_snapshot = Column(String, nullable=True)
    character_age_snapshot = Column(String, nullable=True)
    character_description_snapshot = Column(Text, nullable=True)
    character_prompt_snapshot = Column(Text, nullable=True)
    character_ref_text_snapshot = Column(Text, nullable=True)

    project = relationship("Project", back_populates="character_ref_assets")
    character = relationship("Character", back_populates="character_ref_assets")


class EffectAsset(Base):
    __tablename__ = "effect_assets"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    source_type = Column(String, nullable=False, default="imported")
    effect_category = Column(String, nullable=False, default="ambience")  # ambience/effect
    display_name = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_format = Column(String, nullable=True)
    file_size = Column(Integer, nullable=True)
    duration = Column(Float, nullable=True)
    sample_rate = Column(Integer, nullable=True)
    channels = Column(Integer, nullable=True)
    managed_file = Column(Boolean, default=True)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.now)

    project = relationship("Project", back_populates="effect_assets")


class BgmAsset(Base):
    __tablename__ = "bgm_assets"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    source_type = Column(String, nullable=False, default="imported")
    display_name = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_format = Column(String, nullable=True)
    file_size = Column(Integer, nullable=True)
    duration = Column(Float, nullable=True)
    sample_rate = Column(Integer, nullable=True)
    channels = Column(Integer, nullable=True)
    bpm = Column(Float, nullable=True)
    mood = Column(String, nullable=True)
    managed_file = Column(Boolean, default=True)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.now)

    project = relationship("Project", back_populates="bgm_assets")
