import json
from sqlalchemy.orm import Session
from models.config import Config

# 参考 API_mini.md 构建默认配置
DEFAULT_CONFIGS = [
    # A. Appearance (外观与交互)
    {
        "key": "app.theme_mode", "group": "appearance", "label": "主题模式",
        "type": "select", "options": ["light", "dark", "system"], "default": "system", "value": "system"
    },
    {
        "key": "app.language", "group": "appearance", "label": "语言",
        "type": "select", "options": ["zh-CN", "en-US", "ja-JP"], "default": "zh-CN", "value": "zh-CN"
    },

    # B. LLM Settings (LLM设置)
    {
        "key": "llm.active_provider", "group": "llm_settings", "label": "当前 LLM 服务商",
        "type": "select", "options": ["deepseek", "qwen", "selfdef"], "default": "deepseek", "value": "deepseek"
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
        "key": "llm.selfdef.url", "group": "llm_settings", "label": "自定义 LLM 地址",
        "type": "text", "options": None, "default": "", "value": ""
    },
    {
        "key": "llm.selfdef.api_key", "group": "llm_settings", "label": "自定义 LLM API Key",
        "type": "password", "options": None, "default": "", "value": ""
    },
        {
        "key": "llm.selfdef.model_name", "group": "llm_settings", "label": "自定义 LLM 模型名称",
        "type": "text", "options": None, "default": "", "value": ""
    },

    # C. TTS Settings (语音合成设置)
    {
        "key": "tts.backend", "group": "tts_settings", "label": "TTS 后端类型",
        "type": "select", "options": ["local_pytorch", "local_vllm", "autodl", "aliyun"], "default": "aliyun", "value": "aliyun"
    },
    # C1. 本地pytorch部署
    {
        "key": "tts.local.model_base_path", "group": "tts_settings", "label": "克隆模型路径 (Base)",
        "type": "text", "options": None, "default": "", "value": ""
    },
    {
        "key": "tts.local.model_vd_path", "group": "tts_settings", "label": "设计模型路径 (VoiceDesign)",
        "type": "text", "options": None, "default": "", "value": ""
    },
    {
        "key": "tts.local.device", "group": "tts_settings", "label": "计算设备",
        "type": "select", "options": ["cuda", "cpu"], "default": "cuda", "value": "cuda"
    },
    # C2. 本地vllm部署
    {
        "key": "tts.vllm.base_url", "group": "tts_settings", "label": "vLLM Base模型服务地址",
        "type": "text", "options": None, "default": "http://localhost:6008", "value": "http://localhost:6008"
    },
    {
        "key": "tts.vllm.vd_url", "group": "tts_settings", "label": "vLLM VoiceDesign模型服务地址",
        "type": "text", "options": None, "default": "http://localhost:6006", "value": "http://localhost:6006"
    },
    # C3. Autodl穿透
    {
        "key": "tts.autodl.base_port", "group": "tts_settings", "label": "Base模型本地端口",
        "type": "text", "options": None, "default": "6008", "value": "6008"
    },
    {
        "key": "tts.autodl.vd_port", "group": "tts_settings", "label": "VoiceDesign模型本地端口",
        "type": "text", "options": None, "default": "6006", "value": "6006"
    },
    # C4. 阿里云API
    {
        "key": "tts.aliyun.api_key", "group": "tts_settings", "label": "DashScope API Key",
        "type": "password", "options": None, "default": "", "value": ""
    },
    {
        "key": "tts.aliyun.region", "group": "tts_settings", "label": "服务区域",
        "type": "select", "options": ["beijing", "singapore"], "default": "beijing", "value": "beijing"
    },

    # D. Synthesis Config (合成策略)
    {
        "key": "syn.default_speed", "group": "synthesis_config", "label": "默认语速",
        "type": "number", "options": None, "default": "1.0", "value": "1.0"
    },
    {
        "key": "syn.silence_duration", "group": "synthesis_config", "label": "句间静音时长 (秒)",
        "type": "number", "options": None, "default": "0.5", "value": "0.5"
    },
    {
        "key": "syn.export_path", "group": "synthesis_config", "label": "默认导出路径",
        "type": "text", "options": None, "default": "/data/outputs", "value": "/data/outputs"
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
        # 复制一份 item 以免修改全局变量
        config_data = item.copy()
        
        # 将 options 列表转换为 JSON 字符串存储
        # if isinstance(config_data.get("options"), list):
        #     config_data["options"] = json.dumps(config_data["options"])
            
        # exists = db.query(Config).filter(Config.key == config_data["key"]).first()
        
        exists = db.query(Config).filter(Config.key == config_data["key"]).first()

        if not exists:
            new_config = Config(**config_data)
            db.add(new_config)
    
    db.commit()
    print("System settings initialized.")
