from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models.character import Character
from models.task import Task
from schemas.character import CharacterResponse, CharacterUpdate
import uuid


router = APIRouter(prefix="/api/characters", tags=["Characters"])

@router.put("/{character_id}", response_model=CharacterResponse)
def update_character(character_id: int, update: CharacterUpdate, db: Session = Depends(get_db)):
    char = db.query(Character).filter(Character.id == character_id).first()
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    for key, value in update.model_dump(exclude_unset=True).items():
        setattr(char, key, value)
    db.commit()
    db.refresh(char)
    if char.ref_audio_path:
        char.ref_audio_url = f"/static/projects/{char.project_id}/voices/{char.ref_audio_path}"
    else:
        char.ref_audio_url = None
    return char

@router.post("/{character_id}/voice")
def preview_voice(character_id: int, db: Session = Depends(get_db)):
    char = db.query(Character).filter(Character.id == character_id).first()
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    
    gender = char.gender 
    age = char.age 
    personality = char.description 
    voice_details = char.prompt 

    instruct = f"{gender}，{age}。{personality}。声音特征为：{voice_details}"
    text = char.ref_text
    
    task = Task(
        id=str(uuid.uuid4()),
        project_id=char.project_id,
        type="synthesis_voicedesign",
        status="pending",
        payload={"character_id": character_id, "text": text, "instruct": instruct}
    )
    db.add(task)
    db.commit()
    
    return {"task_id": task.id}