import re
import uuid
import datetime
from typing import List, Optional, Dict, Literal

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


class ResolveStaleAudioRequest(BaseModel):
    action: Literal["keep", "clear", "resynthesize"]
    line_ids: Optional[List[int]] = None


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


def _line_to_response(
    line: ScriptLine,
    char_map: dict[str, str],
    char_revision_map: Optional[Dict[str, int]] = None,
) -> ScriptLineResponse:
    audio_url = None
    if line.audio_path:
        if line.audio_path.startswith("/static/"):
            audio_url = line.audio_path
        else:
            audio_url = f"/static/projects/{line.project_id}/outputs/{line.audio_path}"

    is_stale = False
    stale_reason = None
    if line.status == "synthesized" and line.character_id:
        current_rev = (char_revision_map or {}).get(line.character_id)
        if current_rev is None:
            is_stale = True
            stale_reason = "character_missing"
        elif int(line.last_synth_voice_revision or 0) != int(current_rev):
            is_stale = True
            stale_reason = "voice_changed"

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
        last_synth_voice_revision=line.last_synth_voice_revision,
        is_stale=is_stale,
        stale_reason=stale_reason,
    )


def _line_is_stale(line: ScriptLine, char_revision_map: Dict[str, int]) -> bool:
    if line.status != "synthesized" or not line.character_id:
        return False
    current_rev = char_revision_map.get(line.character_id)
    if current_rev is None:
        return True
    return int(line.last_synth_voice_revision or 0) != int(current_rev)


def _build_timeline_segments(lines: List[ScriptLine], max_lines: int = 90, max_duration_sec: float = 180.0):
    ordered = sorted(lines, key=lambda x: (x.order_index or 0, x.id or 0))
    if not ordered:
        return []

    segments = []
    current = []
    current_duration = 0.0

    def flush():
        if not current:
            return
        segment_duration = 0.0
        for row in current:
            segment_duration += row.duration or _estimate_duration(row.text, row.speed or 1.0)
        segments.append(
            {
                "index": len(segments),
                "start_line_id": current[0].id,
                "end_line_id": current[-1].id,
                "start_order_index": current[0].order_index,
                "end_order_index": current[-1].order_index,
                "line_count": len(current),
                "duration_sec": round(segment_duration, 2),
            }
        )

    for row in ordered:
        line_duration = row.duration or _estimate_duration(row.text, row.speed or 1.0)
        should_split = (
            len(current) >= max_lines
            or (current and current_duration + line_duration > max_duration_sec)
        )
        if should_split:
            flush()
            current = []
            current_duration = 0.0
        current.append(row)
        current_duration += line_duration
    flush()
    return segments


def _build_pipeline_status(project_id: str, db: Session, ensure_script: bool = False):
    project = _assert_project(project_id, db)
    if ensure_script:
        _bootstrap_script_lines(project, db)

    chars = db.query(Character).filter(Character.project_id == project_id).all()
    rows = (
        db.query(ScriptLine)
        .filter(ScriptLine.project_id == project_id)
        .order_by(ScriptLine.order_index.asc(), ScriptLine.id.asc())
        .all()
    )

    character_total = len(chars)
    character_confirmed = len([c for c in chars if c.is_confirmed])
    can_enter_studio = character_total > 0 and character_total == character_confirmed

    char_map = {c.id: c.name for c in chars}
    char_revision_map = {c.id: int(c.voice_revision or 1) for c in chars}
    stale_rows = [line for line in rows if _line_is_stale(line, char_revision_map)]
    stale_ids = [line.id for line in stale_rows]

    stale_group = {}
    for line in stale_rows:
        key = line.character_id or "unknown"
        stale_group[key] = stale_group.get(key, 0) + 1
    stale_characters = []
    for cid, count in stale_group.items():
        stale_characters.append(
            {
                "character_id": cid if cid != "unknown" else None,
                "character_name": char_map.get(cid, "Unknown"),
                "line_count": count,
            }
        )
    stale_characters.sort(key=lambda item: item["line_count"], reverse=True)
    stale_lines_preview = [
        {
            "line_id": line.id,
            "order_index": line.order_index,
            "character_id": line.character_id,
            "character_name": char_map.get(line.character_id or "", "Unknown"),
            "text_preview": (line.text or "")[:72],
        }
        for line in stale_rows[:24]
    ]

    script_total = len(rows)
    synthesized_total = len([line for line in rows if line.status == "synthesized"])
    stale_total = len(stale_rows)
    fresh_synthesized_total = synthesized_total - stale_total
    can_enter_timeline = (
        can_enter_studio
        and script_total > 0
        and fresh_synthesized_total == script_total
    )

    return {
        "project_id": project_id,
        "character_total": character_total,
        "character_confirmed": character_confirmed,
        "unconfirmed_characters": [
            {"id": c.id, "name": c.name}
            for c in chars
            if not c.is_confirmed
        ],
        "script_total": script_total,
        "synthesized_total": synthesized_total,
        "stale_total": stale_total,
        "fresh_synthesized_total": fresh_synthesized_total,
        "stale_line_ids": stale_ids,
        "stale_characters": stale_characters,
        "stale_lines_preview": stale_lines_preview,
        "can_enter_studio": can_enter_studio,
        "can_enter_timeline": can_enter_timeline,
        "timeline_segments": _build_timeline_segments(rows),
    }


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
    char_revision_map = {c.id: int(c.voice_revision or 1) for c in chars}
    return [_line_to_response(row, char_map, char_revision_map) for row in rows]


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
        last_synth_voice_revision=None,
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
        row.last_synth_voice_revision = None
    db.commit()
    db.refresh(row)

    char_name = None
    if row.character_id:
        char = db.query(Character).filter(Character.id == row.character_id).first()
        char_name = char.name if char else None
    char_revision_map = {}
    if row.character_id:
        char_obj = db.query(Character).filter(Character.id == row.character_id).first()
        if char_obj:
            char_revision_map[row.character_id] = int(char_obj.voice_revision or 1)
    return _line_to_response(row, {row.character_id or "": char_name} if char_name else {}, char_revision_map)


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
    project = _assert_project(req.project_id, db)
    if not req.line_ids:
        raise HTTPException(status_code=400, detail="line_ids is required")

    characters = db.query(Character).filter(Character.project_id == req.project_id).all()
    if not characters:
        raise HTTPException(status_code=400, detail="No characters found. Confirm characters first.")
    if any(not c.is_confirmed for c in characters):
        raise HTTPException(status_code=400, detail="Some characters are not confirmed")
    char_revision_map = {c.id: int(c.voice_revision or 1) for c in characters}

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
        if line.character_id:
            line.last_synth_voice_revision = char_revision_map.get(line.character_id)
        else:
            line.last_synth_voice_revision = None

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
    project.state = "synthesizing"
    db.flush()
    summary = _build_pipeline_status(req.project_id, db, ensure_script=False)
    project.state = "completed" if summary["can_enter_timeline"] else "script_ready"
    db.commit()
    return {"task_id": task.id}


@router.get("/projects/{project_id}/pipeline-status")
def get_project_pipeline_status(project_id: str, db: Session = Depends(get_db)):
    return _build_pipeline_status(project_id, db, ensure_script=True)


@router.post("/projects/{project_id}/synthesis/stale-audio/resolve")
def resolve_stale_audio(project_id: str, req: ResolveStaleAudioRequest, db: Session = Depends(get_db)):
    _assert_project(project_id, db)
    characters = db.query(Character).filter(Character.project_id == project_id).all()
    char_revision_map = {c.id: int(c.voice_revision or 1) for c in characters}

    rows = (
        db.query(ScriptLine)
        .filter(ScriptLine.project_id == project_id)
        .order_by(ScriptLine.order_index.asc(), ScriptLine.id.asc())
        .all()
    )
    stale_rows = [line for line in rows if _line_is_stale(line, char_revision_map)]
    if req.line_ids:
        target_ids = set(req.line_ids)
        stale_rows = [line for line in stale_rows if line.id in target_ids]
    if not stale_rows:
        return {"message": "No stale lines to resolve", "affected": 0}

    affected = 0
    for line in stale_rows:
        if req.action == "keep":
            line.last_synth_voice_revision = char_revision_map.get(line.character_id) if line.character_id else None
        elif req.action == "clear":
            line.status = "pending"
            line.audio_path = None
            line.duration = None
            line.last_synth_voice_revision = None
        elif req.action == "resynthesize":
            line.status = "synthesized"
            line.duration = _estimate_duration(line.text, line.speed or 1.0)
            line.last_synth_voice_revision = char_revision_map.get(line.character_id) if line.character_id else None
        affected += 1

    project = db.query(Project).filter(Project.id == project_id).first()
    db.flush()
    summary_preview = _build_pipeline_status(project_id, db, ensure_script=False)
    if project:
        project.state = "completed" if summary_preview["can_enter_timeline"] else "script_ready"
    db.commit()
    return {"message": "Stale audio resolved", "affected": affected, "action": req.action}
