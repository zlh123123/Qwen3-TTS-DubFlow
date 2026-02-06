from typing import List, Dict
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.config import Config
from schemas.config import ConfigBatchUpdate, ConfigGroupResponse, ConfigResponse
from collections import defaultdict

router = APIRouter(prefix="/api/settings", tags=["Settings"])

@router.get("", response_model=ConfigGroupResponse)
def get_settings(db: Session = Depends(get_db)):
    configs = db.query(Config).filter(Config.is_public == True).all()

    response_data = ConfigGroupResponse()
    
    for cfg in configs:
        item = ConfigResponse.model_validate(cfg)
        response_data.appearance.append(item) if cfg.group == "appearance" else None
        response_data.llm_settings.append(item) if cfg.group == "llm_settings" else None
        response_data.tts_settings.append(item) if cfg.group == "tts_settings" else None
        response_data.synthesis_config.append(item) if cfg.group == "synthesis_config" else None
        
    return response_data

@router.put("")
def update_settings(body: ConfigBatchUpdate, db: Session = Depends(get_db)):
    for update in body.updates:
        config_item = db.query(Config).filter(Config.key == update.key).first()
        
        if not config_item:
            raise HTTPException(status_code=404, detail=f"Config key '{update.key}' not found")
        
        # 验证 value 类型
        if config_item.type == "number":
            try:
                float(update.value)  
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Invalid number value for '{update.key}'")
        elif config_item.type == "boolean":
            if update.value.lower() not in ["true", "false"]:
                raise HTTPException(status_code=400, detail=f"Invalid boolean value for '{update.key}'")
        
        config_item.value = update.value
            
    db.commit()
    return {"message": "Settings updated successfully"}
