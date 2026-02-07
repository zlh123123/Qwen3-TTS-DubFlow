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

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_tts_config(db: Session):
    """从配置表获取TTS设置"""
    backend = db.query(Config).filter(Config.key == "tts.backend").first()
    if not backend:
        raise ValueError("TTS backend not configured")
    backend_value = backend.value
    
    config = {"backend": backend_value}
    
    if backend_value == "local_pytorch":
        model_base_path = db.query(Config).filter(Config.key == "tts.local.model_base_path").first()
        model_vd_path = db.query(Config).filter(Config.key == "tts.local.model_vd_path").first()
        device = db.query(Config).filter(Config.key == "tts.local.device").first()
        config.update({
            "model_base_path": model_base_path.value if model_base_path else None,
            "model_vd_path": model_vd_path.value if model_vd_path else None,
            "device": device.value if device else "cuda"
        })
    elif backend_value == "local_vllm":
        url = db.query(Config).filter(Config.key == "tts.vllm.url").first()
        config["url"] = url.value if url else "http://localhost:8000"
    elif backend_value == "autodl":
        base_port = db.query(Config).filter(Config.key == "tts.autodl.base_port").first()
        vd_port = db.query(Config).filter(Config.key == "tts.autodl.vd_port").first()
        config.update({
            "base_port": vd_port.value if vd_port else "6007"  # VoiceDesign使用vd_port
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
    """根据配置调用TTS API"""
    backend = config["backend"]
    
    if backend == "autodl":
        # Autodl使用本地端口穿透
        port = config["base_port"]
        url = f"http://localhost:{port}/v1/audio/speech"
    elif backend == "local_vllm":
        url = config["url"] + "/v1/audio/speech"
    elif backend == "aliyun":
        # 阿里云DashScope API
        url = "https://dashscope.aliyuncs.com/api/v1/services/aigc/text2speech/synthesis"
        headers = {
            "Authorization": f"Bearer {config['api_key']}",
            "Content-Type": "application/json"
        }
        # 阿里云payload可能不同，需要调整
        payload = {
            "model": "sambert-zhichu-voice-en-us",  # 示例，需要根据实际调整
            "input": {"text": payload["input"]},
            "parameters": {"voice": "zhichu", "format": "wav"}  # 示例
        }
        response = requests.post(url, json=payload, headers=headers)
    else:
        # local_pytorch或其他，假设使用相同API格式
        url = "http://localhost:8001/v1/audio/speech"  # 示例，需要根据实际调整
    
    if backend != "aliyun":
        response = requests.post(url, json=payload)
    
    if response.status_code != 200:
        raise Exception(f"TTS API error: {response.status_code} - {response.text}")
    
    # 保存音频
    with open(save_path, "wb") as f:
        f.write(response.content)
    
    return save_path

def synthesis_voicedesign_handler(task: Task, db: Session):
    """处理VoiceDesign合成任务"""
    payload = task.payload
    character_id = payload.get("character_id")
    text = payload.get("text")
    instruct = payload.get("instruct")
    
    if not character_id or not text or not instruct:
        raise ValueError("Missing required payload fields: character_id, text, instruct")
    
    # 获取角色和项目信息
    char = db.query(Character).filter(Character.id == character_id).first()
    if not char:
        raise ValueError("Character not found")
    
    project = db.query(Project).filter(Project.id == char.project_id).first()
    if not project:
        raise ValueError("Project not found")
    
    # 获取TTS配置
    tts_config = get_tts_config(db)
    
    # 构建API payload
    api_payload = {
        "model": "/mnt/tenant-home_speed/shanghai/models/Qwen3-TTS/Qwen3-TTS-12Hz-1.7B-VoiceDesign",  # 示例路径
        "task_type": "VoiceDesign",
        "input": text,
        "instructions": instruct,
        "language": project.language or "Auto",
        "max_new_tokens": 2048
    }
    
    # 生成临时文件路径
    temp_dir = os.path.join("storage", "temp")  # 假设storage目录
    os.makedirs(temp_dir, exist_ok=True)
    temp_filename = f"preview_{uuid.uuid4()}.wav"
    save_path = os.path.join(temp_dir, temp_filename)
    
    try:
        # 调用TTS API
        call_tts_api(tts_config, api_payload, save_path)
        
        # 返回结果
        audio_url = f"/static/temp/{temp_filename}"
        return {"audio_url": audio_url}
    except Exception as e:
        logger.error(f"VoiceDesign synthesis failed: {e}")
        raise e