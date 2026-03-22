from typing import Optional, Dict
import json
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from openai import OpenAI
from database import get_db
from database import Config
from schemas.config import ConfigBatchUpdate, ConfigGroupResponse, ConfigResponse

router = APIRouter(prefix="/api/settings", tags=["Settings"])


def _get_config_value(db: Session, key: str, default: Optional[str] = None) -> Optional[str]:
    item = db.query(Config).filter(Config.key == key).first()
    if not item:
        return default
    if item.value is None or item.value == "":
        return default
    return item.value


def _resolve_llm_provider_config(
    db: Session,
    provider_name: str,
    custom_id: Optional[str] = None,
) -> Dict[str, str]:
    provider = (provider_name or "").strip().lower()

    builtin_key_map = {
        "openai": ("llm.openai.api_key", "llm.openai.base_url", "llm.openai.model", "https://api.openai.com/v1"),
        "gemini": ("llm.gemini.api_key", "llm.gemini.base_url", "llm.gemini.model", "https://generativelanguage.googleapis.com/v1beta/openai"),
        "claude": ("llm.claude.api_key", "llm.claude.base_url", "llm.claude.model", "https://openrouter.ai/api/v1"),
        "deepseek": ("llm.deepseek.api_key", "llm.deepseek.base_url", "llm.deepseek.model", "https://api.deepseek.com"),
        "qwen": ("llm.qwen.api_key", "llm.qwen.base_url", "llm.qwen.model", "https://dashscope.aliyuncs.com/compatible-mode/v1"),
        "ollama": ("llm.ollama.api_key", "llm.ollama.base_url", "llm.ollama.model", "http://localhost:11434/v1"),
    }

    if provider in builtin_key_map:
        api_key_key, base_url_key, model_key, fallback_base = builtin_key_map[provider]
        return {
            "provider": provider,
            "api_key": _get_config_value(db, api_key_key, ""),
            "base_url": _get_config_value(db, base_url_key, fallback_base),
            "model": _get_config_value(db, model_key, ""),
            "is_custom": False,
        }

    if provider == "custom":
        raw_json = _get_config_value(db, "llm.custom_providers_json", "[]") or "[]"
        active_custom_id = custom_id or _get_config_value(db, "llm.custom_active_id", "")
        try:
            items = json.loads(raw_json)
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=400, detail=f"Invalid llm.custom_providers_json: {exc}")
        if not isinstance(items, list):
            raise HTTPException(status_code=400, detail="Invalid llm.custom_providers_json: must be a list")
        target = None
        if active_custom_id:
            for item in items:
                if isinstance(item, dict) and item.get("id") == active_custom_id:
                    target = item
                    break
        if target is None and items:
            target = items[0]
        if target is None:
            raise HTTPException(status_code=400, detail="No custom provider configured")

        return {
            "provider": "custom",
            "custom_id": str(target.get("id") or ""),
            "api_key": str(target.get("api_key") or ""),
            "base_url": str(target.get("base_url") or "http://localhost:11434/v1"),
            "model": str(target.get("model") or ""),
            "is_custom": True,
            "name": str(target.get("name") or "Custom"),
        }

    raise HTTPException(status_code=400, detail=f"Unsupported provider '{provider}'")

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


@router.get("/llm/models")
def fetch_llm_models(
    provider: Optional[str] = Query(default=None),
    custom_id: Optional[str] = Query(default=None),
    db: Session = Depends(get_db)
):
    provider_name = provider or _get_config_value(db, "llm.active_provider", "deepseek")
    resolved = _resolve_llm_provider_config(db, provider_name, custom_id)
    api_key = resolved.get("api_key", "")
    base_url = resolved.get("base_url", "")
    effective_provider = resolved.get("provider", provider_name)

    if effective_provider != "ollama" and not api_key:
        raise HTTPException(status_code=400, detail=f"Provider '{effective_provider}' API key is empty")

    try:
        client = OpenAI(
            api_key=api_key if api_key else "EMPTY",
            base_url=base_url,
        )
        resp = client.models.list()
        items = []
        for model in getattr(resp, "data", []):
            model_id = getattr(model, "id", None)
            if isinstance(model_id, str) and model_id:
                items.append(model_id)

        unique_items = []
        for model_id in items:
            if model_id not in unique_items:
                unique_items.append(model_id)

        return {
            "provider": effective_provider,
            "base_url": base_url,
            "items": unique_items,
            "custom_id": resolved.get("custom_id"),
            "name": resolved.get("name"),
        }
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to fetch model list from '{effective_provider}': {str(e)}",
        )
