import os
import uuid
import requests
import base64
from sqlalchemy.orm import Session
from models.task import Task
from models.config import Config
from models.character import Character
from models.project import Project
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_tts_config(db: Session):
    backend = db.query(Config).filter(Config.key == "tts.backend").first()
    if not backend:
        raise ValueError("TTS backend not configured")
    backend_value = backend.value
    
    config = {"backend": backend_value}
    
    if backend_value == "local_pytorch":
        model_vd_path = db.query(Config).filter(Config.key == "tts.local.model_vd_path").first()
        device = db.query(Config).filter(Config.key == "tts.local.device").first()
        config.update({
            "model_vd_path": model_vd_path.value if model_vd_path else None,
            "device": device.value if device else "cuda"
        })
    elif backend_value == "local_vllm":
        vd_url = db.query(Config).filter(Config.key == "tts.vllm.vd_url").first()
        config.update({
            "vd_url": vd_url.value if vd_url else "http://localhost:6006"
        })
    elif backend_value == "autodl":
        vd_port = db.query(Config).filter(Config.key == "tts.autodl.vd_port").first()
        config.update({
            "vd_port": vd_port.value if vd_port else "6006"
        })
    elif backend_value == "aliyun":
        api_key = db.query(Config).filter(Config.key == "tts.aliyun.api_key").first()
        region = db.query(Config).filter(Config.key == "tts.aliyun.region").first()
        config.update({
            "api_key": api_key.value if api_key else None,
            "region": region.value if region else "beijing"
        })
    else:
        raise ValueError(f"Unsupported TTS backend: {backend_value}")
    
    return config

def call_tts_api(config, payload, save_path):
    backend = config["backend"]
    
    if backend == "autodl":
        port = config["vd_port"]
        url = f"http://localhost:{port}/v1/audio/speech"
    elif backend == "local_vllm":
        url = config["vd_url"] + "/v1/audio/speech"
    elif backend == "aliyun":
        if config.get("region") == "singapore":
            url = "https://dashscope-intl.aliyuncs.com/api/v1/services/audio/tts/customization"
        else:
            url = "https://dashscope.aliyuncs.com/api/v1/services/audio/tts/customization"
        
        headers = {
            "Authorization": f"Bearer {config['api_key']}",
            "Content-Type": "application/json"
        }

        api_payload = {
            "model": "qwen-voice-design",
            "input": {
                "action": "create",
                "target_model": "qwen3-tts-vd-realtime-2026-01-15",
                "voice_prompt": payload.get("instructions", ""),
                "preview_text": payload["input"],
                "preferred_name": f"voice_{uuid.uuid4().hex[:8]}",
                "language": "auto"
            },
            "parameters": {
                "sample_rate": 24000,
                "response_format": "wav"
            }
        }
        
        response = requests.post(url, json=api_payload, headers=headers, timeout=60)
        
        if response.status_code == 200:
            result = response.json()
            base64_audio = result["output"]["preview_audio"]["data"]
            audio_bytes = base64.b64decode(base64_audio)
            with open(save_path, "wb") as f:
                f.write(audio_bytes)
            return save_path
        else:
            raise Exception(f"Aliyun TTS API error: {response.status_code} - {response.text}")
    
    if backend != "aliyun":
        response = requests.post(url, json=payload)
    
    if response.status_code != 200:
        raise Exception(f"TTS API error: {response.status_code} - {response.text}")
    
    with open(save_path, "wb") as f:
        f.write(response.content)
    
    return save_path

def synthesis_voicedesign_handler(task: Task, db: Session):
    payload = task.payload
    character_id = payload.get("character_id")
    text = payload.get("text")
    instruct = payload.get("instruct")
    
    if not character_id or not text or not instruct:
        raise ValueError("Missing required payload fields: character_id, text, instruct")
    
    char = db.query(Character).filter(Character.id == character_id).first()
    if not char:
        raise ValueError("Character not found")
    
    project = db.query(Project).filter(Project.id == char.project_id).first()
    if not project:
        raise ValueError("Project not found")
    
    tts_config = get_tts_config(db)
    
    api_payload = {
        "model": "Qwen3-TTS-12Hz-1.7B-VoiceDesign",
        "task_type": "VoiceDesign",
        "input": text,
        "instructions": instruct,
        "language": "auto",
        "max_new_tokens": 2048
    }
    
    temp_dir = os.path.join("storage", "temp")
    os.makedirs(temp_dir, exist_ok=True)
    temp_filename = f"preview_{uuid.uuid4()}.wav"
    save_path = os.path.join(temp_dir, temp_filename)
    
    try:
        call_tts_api(tts_config, api_payload, save_path)
        
        audio_url = f"/static/temp/{temp_filename}"
        return {"audio_url": audio_url}
    except Exception as e:
        logger.error(f"VoiceDesign synthesis failed: {e}")
        raise e