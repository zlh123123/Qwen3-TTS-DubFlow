from sqlalchemy.orm import Session
from database import Config

# 参考 API_mini.md 构建默认配置
DEFAULT_CONFIGS = [
    # A. Appearance (外观与交互)
    {
        "key": "app.theme_mode", "group": "appearance", "label": "主题模式",
        "type": "select", "options": ["light", "dark", "system"], "default": "system", "value": "system"
    },
    {
        "key": "app.language", "group": "appearance", "label": "语言",
        "type": "select",
        "options": ["en-US", "zh-CN", "ja-JP", "ko-KR", "es-ES", "fr-FR", "de-DE"],
        "default": "en-US",
        "value": "en-US",
    },
    {
        "key": "app.font_size", "group": "appearance", "label": "字体大小",
        "type": "select",
        "options": ["small", "medium", "large"],
        "default": "medium",
        "value": "medium",
    },

    # B. LLM Settings (LLM设置)
    {
        "key": "llm.active_provider", "group": "llm_settings", "label": "当前 LLM 服务商",
        "type": "select",
        "options": ["openai", "gemini", "claude", "deepseek", "qwen", "ollama", "custom"],
        "default": "deepseek",
        "value": "deepseek"
    },
    {
        "key": "llm.custom_active_id", "group": "llm_settings", "label": "当前自定义提供方",
        "type": "text", "options": None, "default": "", "value": ""
    },
    {
        "key": "llm.custom_providers_json", "group": "llm_settings", "label": "自定义提供方列表",
        "type": "text", "options": None, "default": "[]", "value": "[]"
    },
    {
        "key": "llm.openai.api_key", "group": "llm_settings", "label": "OpenAI API Key",
        "type": "password", "options": None, "default": "", "value": ""
    },
    {
        "key": "llm.openai.base_url", "group": "llm_settings", "label": "OpenAI Base URL",
        "type": "text", "options": None, "default": "https://api.openai.com/v1", "value": "https://api.openai.com/v1"
    },
    {
        "key": "llm.openai.model", "group": "llm_settings", "label": "OpenAI Model",
        "type": "text", "options": None, "default": "gpt-4o-mini", "value": "gpt-4o-mini"
    },
    {
        "key": "llm.gemini.api_key", "group": "llm_settings", "label": "Gemini API Key",
        "type": "password", "options": None, "default": "", "value": ""
    },
    {
        "key": "llm.gemini.base_url", "group": "llm_settings", "label": "Gemini Base URL",
        "type": "text", "options": None, "default": "https://generativelanguage.googleapis.com/v1beta/openai", "value": "https://generativelanguage.googleapis.com/v1beta/openai"
    },
    {
        "key": "llm.gemini.model", "group": "llm_settings", "label": "Gemini Model",
        "type": "text", "options": None, "default": "gemini-2.5-flash", "value": "gemini-2.5-flash"
    },
    {
        "key": "llm.claude.api_key", "group": "llm_settings", "label": "Claude API Key",
        "type": "password", "options": None, "default": "", "value": ""
    },
    {
        "key": "llm.claude.base_url", "group": "llm_settings", "label": "Claude Base URL",
        "type": "text", "options": None, "default": "https://openrouter.ai/api/v1", "value": "https://openrouter.ai/api/v1"
    },
    {
        "key": "llm.claude.model", "group": "llm_settings", "label": "Claude Model",
        "type": "text", "options": None, "default": "anthropic/claude-3.5-sonnet", "value": "anthropic/claude-3.5-sonnet"
    },
    {
        "key": "llm.ollama.api_key", "group": "llm_settings", "label": "Ollama API Key",
        "type": "password", "options": None, "default": "", "value": ""
    },
    {
        "key": "llm.ollama.base_url", "group": "llm_settings", "label": "Ollama Base URL",
        "type": "text", "options": None, "default": "http://localhost:11434/v1", "value": "http://localhost:11434/v1"
    },
    {
        "key": "llm.ollama.model", "group": "llm_settings", "label": "Ollama Model",
        "type": "text", "options": None, "default": "qwen2.5:7b", "value": "qwen2.5:7b"
    },
    {
        "key": "llm.deepseek.api_key", "group": "llm_settings", "label": "DeepSeek API Key",
        "type": "password", "options": None, "default": "", "value": ""
    },
    {
        "key": "llm.deepseek.base_url", "group": "llm_settings", "label": "DeepSeek Base URL",
        "type": "text", "options": None, "default": "https://api.deepseek.com", "value": "https://api.deepseek.com"
    },
    {
        "key": "llm.deepseek.model", "group": "llm_settings", "label": "DeepSeek Model",
        "type": "text", "options": None, "default": "deepseek-chat", "value": "deepseek-chat"
    },
    {
        "key": "llm.qwen.api_key", "group": "llm_settings", "label": "Qwen API Key",
        "type": "password", "options": None, "default": "", "value": ""
    },
    {
        "key": "llm.qwen.base_url", "group": "llm_settings", "label": "Qwen Base URL",
        "type": "text", "options": None, "default": "https://dashscope.aliyuncs.com/compatible-mode/v1", "value": "https://dashscope.aliyuncs.com/compatible-mode/v1"
    },
    {
        "key": "llm.qwen.model", "group": "llm_settings", "label": "Qwen Model",
        "type": "text", "options": None, "default": "qwen-plus", "value": "qwen-plus"
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

        exists = db.query(Config).filter(Config.key == config_data["key"]).first()

        if exists:
            # 同步配置元数据，避免旧库中的 options/label/type 长期漂移
            exists.group = config_data.get("group", exists.group)
            exists.label = config_data.get("label", exists.label)
            exists.type = config_data.get("type", exists.type)
            exists.options = config_data.get("options", exists.options)
            exists.default = config_data.get("default", exists.default)
            exists.is_public = config_data.get("is_public", exists.is_public)
            if exists.value in (None, ""):
                exists.value = config_data.get("value", exists.value)
            continue

        new_config = Config(**config_data)
        db.add(new_config)
    
    db.commit()
    print("System settings initialized.")
