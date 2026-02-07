import json
import os
from sqlalchemy.orm import Session
from models.task import Task
from models.project import Project
from models.character import Character
from models.config import Config  
from openai import OpenAI
import openai
import logging

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
        
    print(f"Loading prompt file: {prompt_file}")
    
    if os.path.exists(prompt_file):
        with open(prompt_file, 'r', encoding='utf-8') as f:
            return f.read()
    else:
        raise FileNotFoundError(f"Prompt file not found: {prompt_file}")

def get_llm_client(db: Session):
    """根据设置表获取LLM客户端和模型名"""
    active_provider = db.query(Config).filter(Config.key == "llm.active_provider").first()
    if not active_provider:
        raise ValueError("LLM provider not configured")
    provider = active_provider.value
    
    api_key = None
    base_url = None
    model = None
    if provider == "deepseek":
        api_key_config = db.query(Config).filter(Config.key == "llm.deepseek.api_key").first()
        api_key = api_key_config.value if api_key_config else None
        base_url = "https://api.deepseek.com"
        model = "deepseek-chat"
        # print(f"DeepSeek config - API Key: {api_key[:10] if api_key else 'None'}..., Base URL: {base_url}, Model: {model}")

    elif provider == "qwen":
        api_key_config = db.query(Config).filter(Config.key == "llm.qwen.api_key").first()
        api_key = api_key_config.value if api_key_config else None
        base_url = "https://dashscope.aliyuncs.com/compatible-mode/v1"
        model = "qwen-plus"
    elif provider == "selfdef":
        url_config = db.query(Config).filter(Config.key == "llm.selfdef.url").first()
        api_key_config = db.query(Config).filter(Config.key == "llm.selfdef.api_key").first()
        model_config = db.query(Config).filter(Config.key == "llm.selfdef.model_name").first()
        base_url = url_config.value if url_config else "http://localhost:11434"
        api_key = api_key_config.value if api_key_config else None
        model = model_config.value if model_config else "None"
    else:
        raise ValueError(f"Unsupported provider: {provider}")
    
    if not api_key and provider != "selfdef":  
        raise ValueError("API key not configured")
    
    client = OpenAI(api_key=api_key, base_url=base_url)
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
            {"role": "user", "content": f"【小说文本内容】:\n\n{content[:100]}"},  
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