import re
import uuid
import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db, Project, Character, ScriptLine, Task
from schemas.scriptline import ScriptLineResponse, ScriptLineUpdate


router = APIRouter(prefix="/api", tags=["Script"])


class AddLineRequest(BaseModel):
    prev_line_id: Optional[int] = None


class SynthesisRequest(BaseModel):
    project_id: str
    line_ids: List[int]


class ReorderRequest(BaseModel):
    line_ids: List[int]


def _assert_project(project_id: str, db: Session) -> Project:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _sentences_from_text(content: str) -> List[str]:
    if not content:
        return []
    normalized = content.replace("\r\n", "\n")
    chunks = re.split(r"[\n]+", normalized)
    lines: List[str] = []
    for chunk in chunks:
        raw = chunk.strip()
        if not raw:
            continue
        parts = re.split(r"(?<=[。！？!?；;])\s*|(?<=\.)\s+(?=[A-Z0-9\"'“])", raw)
        for part in parts:
            text = part.strip()
            if text:
                lines.append(text)
    return lines


def _estimate_duration(text: str, speed: float) -> float:
    content = (text or "").strip()
    if not content:
        return 0.8
    safe_speed = speed if speed and speed > 0 else 1.0
    # 简易估算：每秒约 6.5 字符，随 speed 线性调整
    return max(0.8, len(content) / (6.5 * safe_speed))


def _line_to_response(line: ScriptLine, char_map: dict[str, str]) -> ScriptLineResponse:
    audio_url = None
    if line.audio_path:
        if line.audio_path.startswith("/static/"):
            audio_url = line.audio_path
        else:
            audio_url = f"/static/projects/{line.project_id}/outputs/{line.audio_path}"
    return ScriptLineResponse(
        id=line.id,
        project_id=line.project_id,
        character_id=line.character_id,
        character_name=char_map.get(line.character_id or "", None),
        order_index=line.order_index,
        text=line.text,
        speed=line.speed or 1.0,
        audio_path=line.audio_path,
        audio_url=audio_url,
        duration=line.duration,
        status=line.status or "pending",
    )


def _bootstrap_script_lines(project: Project, db: Session):
    existing_count = db.query(ScriptLine).filter(ScriptLine.project_id == project.id).count()
    if existing_count > 0:
        return

    lines = _sentences_from_text(project.raw_content or "")
    if not lines:
        lines = ["..."]

    for idx, text in enumerate(lines, start=1):
        row = ScriptLine(
            project_id=project.id,
            character_id=None,
            order_index=idx,
            text=text,
            speed=1.0,
            status="pending",
        )
        db.add(row)
    db.commit()


@router.get("/projects/{project_id}/script", response_model=List[ScriptLineResponse])
def get_project_script(project_id: str, db: Session = Depends(get_db)):
    project = _assert_project(project_id, db)
    _bootstrap_script_lines(project, db)

    rows = (
        db.query(ScriptLine)
        .filter(ScriptLine.project_id == project_id)
        .order_by(ScriptLine.order_index.asc(), ScriptLine.id.asc())
        .all()
    )
    chars = db.query(Character).filter(Character.project_id == project_id).all()
    char_map = {c.id: c.name for c in chars}
    return [_line_to_response(row, char_map) for row in rows]


@router.post("/projects/{project_id}/script/lines", response_model=ScriptLineResponse)
def add_project_script_line(project_id: str, req: AddLineRequest, db: Session = Depends(get_db)):
    _assert_project(project_id, db)
    rows = (
        db.query(ScriptLine)
        .filter(ScriptLine.project_id == project_id)
        .order_by(ScriptLine.order_index.asc(), ScriptLine.id.asc())
        .all()
    )
    if not rows:
        new_order = 1
    elif req.prev_line_id is None:
        new_order = rows[-1].order_index + 1
    else:
        prev = next((x for x in rows if x.id == req.prev_line_id), None)
        if not prev:
            raise HTTPException(status_code=404, detail="Previous line not found")
        new_order = prev.order_index + 1
        for row in rows:
            if row.order_index >= new_order:
                row.order_index += 1

    line = ScriptLine(
        project_id=project_id,
        character_id=None,
        order_index=new_order,
        text="",
        speed=1.0,
        status="pending",
    )
    db.add(line)
    db.commit()
    db.refresh(line)
    return _line_to_response(line, {})


@router.put("/script/{line_id}", response_model=ScriptLineResponse)
def update_script_line(line_id: int, payload: ScriptLineUpdate, db: Session = Depends(get_db)):
    row = db.query(ScriptLine).filter(ScriptLine.id == line_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Script line not found")

    updates = payload.model_dump(exclude_unset=True)
    for k, v in updates.items():
        setattr(row, k, v)
    if any(key in updates for key in ("text", "character_id", "speed")):
        row.status = "pending"
        row.audio_path = None
        row.duration = None
    db.commit()
    db.refresh(row)

    char_name = None
    if row.character_id:
        char = db.query(Character).filter(Character.id == row.character_id).first()
        char_name = char.name if char else None
    return _line_to_response(row, {row.character_id or "": char_name} if char_name else {})


@router.delete("/script/{line_id}")
def delete_script_line(line_id: int, db: Session = Depends(get_db)):
    row = db.query(ScriptLine).filter(ScriptLine.id == line_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Script line not found")
    project_id = row.project_id
    deleted_order = row.order_index
    db.delete(row)
    db.flush()

    rest = db.query(ScriptLine).filter(ScriptLine.project_id == project_id).all()
    for item in rest:
        if item.order_index > deleted_order:
            item.order_index -= 1
    db.commit()
    return {"message": "Line deleted"}


@router.put("/projects/{project_id}/script/reorder")
def reorder_project_script(project_id: str, req: ReorderRequest, db: Session = Depends(get_db)):
    _assert_project(project_id, db)
    target_ids = req.line_ids or []
    if not target_ids:
        raise HTTPException(status_code=400, detail="line_ids is required")
    if len(target_ids) != len(set(target_ids)):
        raise HTTPException(status_code=400, detail="line_ids contains duplicates")

    rows = (
        db.query(ScriptLine)
        .filter(ScriptLine.project_id == project_id)
        .order_by(ScriptLine.order_index.asc(), ScriptLine.id.asc())
        .all()
    )
    existing_ids = [row.id for row in rows]
    if set(target_ids) != set(existing_ids):
        raise HTTPException(status_code=400, detail="line_ids must include all project script lines exactly once")

    id_to_row = {row.id: row for row in rows}
    for idx, line_id in enumerate(target_ids, start=1):
        id_to_row[line_id].order_index = idx
    db.commit()
    return {"message": "Script lines reordered"}


@router.post("/synthesis")
def synthesize_script(req: SynthesisRequest, db: Session = Depends(get_db)):
    _assert_project(req.project_id, db)
    if not req.line_ids:
        raise HTTPException(status_code=400, detail="line_ids is required")

    rows = (
        db.query(ScriptLine)
        .filter(ScriptLine.project_id == req.project_id, ScriptLine.id.in_(req.line_ids))
        .all()
    )
    if not rows:
        raise HTTPException(status_code=404, detail="No script lines found")

    for line in rows:
        line.status = "synthesized"
        line.duration = _estimate_duration(line.text, line.speed or 1.0)

    task = Task(
        id=str(uuid.uuid4()),
        project_id=req.project_id,
        type="synthesis_script",
        status="success",
        payload={"line_ids": req.line_ids},
        result={"line_ids": [line.id for line in rows], "audio_url": None},
        created_at=datetime.datetime.now(),
    )
    db.add(task)
    db.commit()
    return {"task_id": task.id}
