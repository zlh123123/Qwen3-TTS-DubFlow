from sqlalchemy.orm import Session
from models.config import Config

DEFAULT_CONFIGS = [
    # A. Appearance
    {
        "key": "app.theme_mode", "group": "appearance", "label": "主题模式",
        "type": "select", "options": ["light", "dark", "system"], "default": "system", "value": "system"
    },
    {
        "key": "app.language", "group": "appearance", "label": "语言",
        "type": "select", "options": ["zh-CN", "en-US"], "default": "zh-CN", "value": "zh-CN"
    },
    # B. LLM Settings
    {
        "key": "llm.active_provider", "group": "llm_settings", "label": "当前 LLM 服务商",
        "type": "select", "options": ["deepseek", "qwen", "local"], "default": "deepseek", "value": "deepseek"
    },
    {
        "key": "llm.deepseek.api_key", "group": "llm_settings", "label": "DeepSeek API Key",
        "type": "password", "options": None, "default": "", "value": ""
    },
    {
        "key": "llm.qwen.api_key", "group": "llm_settings", "label": "Qwen API Key",
        "type": "password", "options": None, "default": "", "value": ""
    },
    {
        "key": "llm.local.url", "group": "llm_settings", "label": "本地 LLM 地址",
        "type": "text", "options": None, "default": "http://localhost:11434", "value": "http://localhost:11434"
    },
    # C. TTS Settings
    {
        "key": "tts.active_backend", "group": "tts_settings", "label": "TTS 后端类型",
        "type": "select", "options": ["local_docker", "remote_autodl", "aliyun"], "default": "local_docker", "value": "local_docker"
    },
    {
        "key": "tts.local.url", "group": "tts_settings", "label": "本地服务地址",
        "type": "text", "options": None, "default": "http://tts-base:8000", "value": "http://tts-base:8000"
    },
    {
        "key": "tts.remote.url", "group": "tts_settings", "label": "远程服务地址 (AutoDL)",
        "type": "text", "options": None, "default": "", "value": ""
    },
    {
        "key": "tts.aliyun.app_key", "group": "tts_settings", "label": "阿里云 AppKey",
        "type": "text", "options": None, "default": "", "value": ""
    },
    {
        "key": "tts.aliyun.token", "group": "tts_settings", "label": "阿里云 Token",
        "type": "password", "options": None, "default": "", "value": ""
    },
    # D. Synthesis Config
    {
        "key": "syn.default_speed", "group": "synthesis_config", "label": "默认语速",
        "type": "number", "options": None, "default": "1.0", "value": "1.0"
    },
    {
        "key": "syn.silence_duration", "group": "synthesis_config", "label": "句间静音时长 (秒)",
        "type": "number", "options": None, "default": "0.5", "value": "0.5"
    },
    {
        "key": "syn.max_workers", "group": "synthesis_config", "label": "最大并发数",
        "type": "number", "options": None, "default": "2", "value": "2"
    }
]

def init_settings(db: Session):
    """
    检查配置是否存在，如果不存在则插入默认值。
    """
    for item in DEFAULT_CONFIGS:
        exists = db.query(Config).filter(Config.key == item["key"]).first()
        
        if not exists:
            new_config = Config(**item)
            db.add(new_config)
    
    db.commit()
    print("System settings initialized.")