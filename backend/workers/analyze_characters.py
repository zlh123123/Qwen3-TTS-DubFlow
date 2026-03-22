import json
import os
from sqlalchemy.orm import Session
from database import Task, Project, Character, Config
from openai import OpenAI
import openai
import logging
import uuid

def load_prompt(language: str) -> str:
    """根据语言加载提示词"""
    prompt_dir = os.path.join(os.path.dirname(__file__), "prompts", "getroles")  
    if language == "English":
        prompt_file = os.path.join(prompt_dir, "en.prompt")
    elif language == "Japanese":
        prompt_file = os.path.join(prompt_dir, "ja.prompt")
    else:
        # 默认中文，包括其他语言
        prompt_file = os.path.join(prompt_dir, "zh.prompt")
        
    # print(f"Loading prompt file: {prompt_file}")
    
    if os.path.exists(prompt_file):
        with open(prompt_file, 'r', encoding='utf-8') as f:
            return f.read()
    else:
        raise FileNotFoundError(f"Prompt file not found: {prompt_file}")

def get_llm_client(db: Session):
    """根据设置表获取LLM客户端和模型名"""
    all_configs = db.query(Config).all()
    config_map = {item.key: item.value for item in all_configs}
    provider = (config_map.get("llm.active_provider") or "").strip().lower()
    if not provider:
        raise ValueError("LLM provider not configured")

    builtin_key_map = {
        "openai": ("llm.openai.api_key", "llm.openai.base_url", "llm.openai.model", "https://api.openai.com/v1", "gpt-4o-mini"),
        "gemini": ("llm.gemini.api_key", "llm.gemini.base_url", "llm.gemini.model", "https://generativelanguage.googleapis.com/v1beta/openai", "gemini-2.5-flash"),
        "claude": ("llm.claude.api_key", "llm.claude.base_url", "llm.claude.model", "https://openrouter.ai/api/v1", "anthropic/claude-3.5-sonnet"),
        "deepseek": ("llm.deepseek.api_key", "llm.deepseek.base_url", "llm.deepseek.model", "https://api.deepseek.com", "deepseek-chat"),
        "qwen": ("llm.qwen.api_key", "llm.qwen.base_url", "llm.qwen.model", "https://dashscope.aliyuncs.com/compatible-mode/v1", "qwen-plus"),
        "ollama": ("llm.ollama.api_key", "llm.ollama.base_url", "llm.ollama.model", "http://localhost:11434/v1", "qwen2.5:7b"),
    }

    api_key = ""
    base_url = ""
    model = ""
    if provider in builtin_key_map:
        api_key_key, base_url_key, model_key, fallback_base, fallback_model = builtin_key_map[provider]
        api_key = config_map.get(api_key_key) or ""
        base_url = config_map.get(base_url_key) or fallback_base
        model = config_map.get(model_key) or fallback_model
    elif provider == "custom":
        raw_json = config_map.get("llm.custom_providers_json") or "[]"
        active_custom_id = config_map.get("llm.custom_active_id") or ""
        try:
            custom_providers = json.loads(raw_json)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Invalid custom providers JSON: {exc}")
        if not isinstance(custom_providers, list) or not custom_providers:
            raise ValueError("No custom provider configured")
        current_provider = None
        if active_custom_id:
            for item in custom_providers:
                if isinstance(item, dict) and item.get("id") == active_custom_id:
                    current_provider = item
                    break
        if current_provider is None:
            current_provider = custom_providers[0]
        if not isinstance(current_provider, dict):
            raise ValueError("Invalid custom provider entry")
        api_key = str(current_provider.get("api_key") or "")
        base_url = str(current_provider.get("base_url") or "http://localhost:11434/v1")
        model = str(current_provider.get("model") or "")
    else:
        raise ValueError(f"Unsupported provider: {provider}")

    if not model:
        raise ValueError("LLM model is not configured")
    if not api_key and provider != "ollama":
        raise ValueError("API key not configured")

    client = OpenAI(api_key=(api_key or "EMPTY"), base_url=base_url)
    return client, model

def analyze_characters_handler(task: Task, db: Session):
    project_id = task.project_id
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise ValueError("Project not found")
    
    content = project.raw_content
    language = project.language


    # 加载提示词
    system_prompt = load_prompt(language)
    # print(f"Loaded prompt for {language}, prompt length: {len(system_prompt)}")

    client, model = get_llm_client(db)
    # print(f"Using model: {model}")


    # print("Calling LLM API...")

    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"【小说文本内容】:\n\n{content[:1000]}"},  
        ],
        temperature=0.1,
        max_tokens=8192,
        timeout=120.0  
    )


    generated_text = response.choices[0].message.content
    
    try:
        json_start = generated_text.find('[')
        json_end = generated_text.rfind(']')
        if json_start != -1 and json_end != -1:
            cleaned_json = generated_text[json_start:json_end+1]
        else:
            cleaned_json = generated_text
        
        characters_data = json.loads(cleaned_json)
        
        for char_data in characters_data:
            char = Character(
                id=str(uuid.uuid4()),
                project_id=project_id,
                name=char_data["name"],
                gender=char_data["gender"],
                age=char_data["age"],
                description=char_data.get("personality_tags", ""),  
                prompt=char_data["voice_prompt"], 
                is_confirmed=False,
                ref_text=char_data.get("ref_text", ""),  
            )
            db.add(char)
        db.commit()
        
        return {"message": f"Extracted {len(characters_data)} characters"}
    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to parse LLM response: {e}")
