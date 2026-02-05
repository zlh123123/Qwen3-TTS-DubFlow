from typing import List, Dict
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.config import Config
from schemas.config import ConfigBatchUpdate, ConfigResponse
from collections import defaultdict

router = APIRouter(prefix="/api/settings", tags=["Settings"])

@router.get("", response_model=Dict[str, List[ConfigResponse]])
def get_settings(db: Session = Depends(get_db)):
    configs = db.query(Config).filter(Config.is_public == True).all()

    response_data = defaultdict(list)
    
    for cfg in configs:
        item = ConfigResponse.model_validate(cfg)

        if cfg.type == "password" and cfg.value:
            item.value = "******"
            
        response_data[cfg.group].append(item)
        
    return response_data

@router.put("")
# 使用 ConfigBatchUpdate 替换 ConfigUpdateRequest
def update_settings(body: ConfigBatchUpdate, db: Session = Depends(get_db)):
    for update in body.updates:
        # 查找配置项
        config_item = db.query(Config).filter(Config.key == update.key).first()
        
        if config_item:

            if config_item.type == "password" and update.value == "******":
                continue
                
            # 更新值
            config_item.value = update.value
            
    db.commit()
    return {"message": "Settings updated successfully"}