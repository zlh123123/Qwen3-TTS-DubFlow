import time
import threading
from sqlalchemy.orm import Session
from database import SessionLocal  
from models.task import Task
from models.project import Project
from .analyze_characters import analyze_characters_handler
# from parse_script import parse_script_handler
# from synthesis import synthesis_handler


HANDLERS = {
    "analyze_char": analyze_characters_handler,
    # "parse_script": parse_script_handler,
    # "synthesis": synthesis_handler,
}

def process_task(task: Task, db: Session):
    try:
        handler = HANDLERS[task.type]
        result = handler(task, db)
        
        task.status = "success"
        task.result = result  # JSON结果
        if task.type == "analyze_char":
            project = db.query(Project).filter(Project.id == task.project_id).first()
            if project:
                project.state = "characters_ready"

        db.commit()
    except Exception as e:
        task.status = "failed"
        task.error_msg = str(e)
        project = db.query(Project).filter(Project.id == task.project_id).first()
        if project:
            project.state = "failed"
        db.commit()

def worker_loop():
    while True:
        db = SessionLocal()
        try:
            task = db.query(Task).filter(Task.status == "pending").order_by(Task.created_at).first()
            if task:
                task.status = "processing"
                db.commit()
                process_task(task, db)
        except Exception as e:
            print(f"Worker error: {e}")
        finally:
            db.close()
        time.sleep(2)  
        
def start_worker():
    thread = threading.Thread(target=worker_loop, daemon=True)
    thread.start()