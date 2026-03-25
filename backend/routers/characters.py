from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from database import Character, Task
from schemas.character import CharacterResponse, CharacterUpdate, CharacterCreate
import uuid


router = APIRouter(prefix="/api/characters", tags=["Characters"])

VOICE_IMPACT_FIELDS = {"gender", "age", "description", "prompt", "ref_text", "ref_audio_path"}

@router.post("/", response_model=CharacterResponse)
def create_character(character: CharacterCreate, db: Session = Depends(get_db)):
    new_char = Character(
        id=str(uuid.uuid4()),
        project_id=character.project_id,
        name=character.name,
        gender=character.gender,
        age=character.age,
        description=character.description,
        prompt=character.prompt,
        ref_text=character.ref_text,
        ref_audio_path=None,
        voice_revision=1,
    )
    db.add(new_char)
    db.commit()
    db.refresh(new_char)
    if new_char.ref_audio_path:
        new_char.ref_audio_url = f"/static/projects/{new_char.project_id}/voices/{new_char.ref_audio_path}"
    else:
        new_char.ref_audio_url = None
    return new_char

@router.put("/{character_id}", response_model=CharacterResponse)
def update_character(character_id: str, update: CharacterUpdate, db: Session = Depends(get_db)):
    char = db.query(Character).filter(Character.id == character_id).first()
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    payload = update.model_dump(exclude_unset=True)
    voice_changed = False
    for key, value in payload.items():
        if key in VOICE_IMPACT_FIELDS and getattr(char, key) != value:
            voice_changed = True
        setattr(char, key, value)
    if voice_changed:
        char.voice_revision = int(char.voice_revision or 1) + 1
        char.is_confirmed = False
    db.commit()
    db.refresh(char)
    if char.ref_audio_path:
        char.ref_audio_url = f"/static/projects/{char.project_id}/voices/{char.ref_audio_path}"
    else:
        char.ref_audio_url = None
    return char

@router.delete("/{character_id}")
def delete_character(character_id: str, db: Session = Depends(get_db)):
    char = db.query(Character).filter(Character.id == character_id).first()
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    db.delete(char)
    db.commit()
    return {"message": "Character deleted successfully"}

@router.post("/{character_id}/voice")
def preview_voice(character_id: str, db: Session = Depends(get_db)):
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
