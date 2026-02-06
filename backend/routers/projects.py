from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models.project import Project
from models.task import Task
from schemas.project import ProjectCreate, ProjectResponse
import shutil
import os
from langdetect import detect, LangDetectException  


router = APIRouter(prefix="/api/projects", tags=["Projects"])

# 获取项目列表
@router.get("", response_model=List[ProjectResponse])
def get_projects(db: Session = Depends(get_db)):
    # 按时间倒序排列
    projects = db.query(Project).order_by(Project.created_at.desc()).all()
    return projects

# 创建新项目
@router.post("", response_model=ProjectResponse)
def create_project(item: ProjectCreate, db: Session = Depends(get_db)):
    supported_languages = {
        'zh': 'Chinese',
        'en': 'English',
        'ja': 'Japanese',
        'ko': 'Korean',
        'de': 'German',
        'fr': 'French',
        'ru': 'Russian',
        'pt': 'Portuguese',
        'es': 'Spanish',
        'it': 'Italian'
    }
    try:
        detected_lang = detect(item.content)
        language = supported_languages.get(detected_lang, 'Chinese')  
    except LangDetectException:
        language = 'unknown'  # 检测失败默认未知

    new_project = Project(
        name=item.name,
        raw_content=item.content,
        language=language,  
        state="created"
    )
    db.add(new_project)
    db.commit()
    db.refresh(new_project)
    
    project_dir = f"storage/projects/{new_project.id}"
    os.makedirs(project_dir, exist_ok=True)
    
    return new_project


# 获取单个项目详情
@router.get("/{project_id}")
def get_project_detail(project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return {
        "id": project.id,
        "name": project.name,
        "state": project.state,
    }

# 删除项目
@router.delete("/{project_id}")
def delete_project(project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # 删数据库
    db.delete(project)
    db.commit()
    
    # 删文件
    dir_path = f"storage/projects/{project_id}"
    if os.path.exists(dir_path):
        shutil.rmtree(dir_path) 
        
    return {"message": "Project deleted successfully"}


# 调用LLM角色分析 (异步)
@router.post("/{project_id}/characters/analyze")
def analyze_characters(project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # 更新 Project.state 为 analyzing_characters
    project.state = "analyzing_characters"
    
    # 创建 Task
    task = Task(
        id=str(uuid.uuid4()),
        project_id=project_id,
        type="analyze_char",
        status="pending",
        payload={}
    )
    db.add(task)
    db.commit()
    
    return {"task_id": task.id}
