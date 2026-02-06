from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models.project import Project
from models.task import Task
from schemas.project import ProjectCreate, ProjectResponse
import shutil
import os

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
    new_project = Project(
        name=item.name,
        raw_content=item.content,
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
    
    # 100字预览
    raw_content_preview = project.raw_content[:100] if project.raw_content else ""
    
    return {
        "id": project.id,
        "name": project.name,
        "state": project.state,
        "raw_content_preview": raw_content_preview
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
