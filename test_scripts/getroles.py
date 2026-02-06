import json
import os
import re
from typing import List, Dict, Any
from vllm import LLM, SamplingParams

# ================= 配置区域 =================
# 模型路径
MODEL_PATH = "/mnt/tenant-home_speed/shanghai/zlh/recover_biaodian/qwen3_gen/model"

# 输入/输出设置
NOVEL_PATH = "novel.txt"       # 你的小说文件路径
OUTPUT_JSON = "characters.json" # 输出结果路径

# 性能配置
GPU_MEMORY_UTILIZATION = 0.8
TENSOR_PARALLEL_SIZE = 2
MAX_INPUT_CHARS = 50000        # 读取小说前N个字符

# ================= 提示词工程 (System Prompt) =================
SYSTEM_PROMPT = """
# Role
你是一名世界顶级的配音导演和侧写师。你的任务是从小说文本中提取角色，并为 AI 语音合成模型生成精准的【音色提示词】。

# Goal
请分析文本，提取所有主要角色（忽略仅出现一次的路人）。对于每个角色，请根据其言行举止、外貌描写和性格特征，推导出详细的【声音人设】。

# Output Format (Strict JSON)
请仅输出一个 JSON 列表，不要包含任何 Markdown 标记或额外的解释文字。格式如下：
[
  {
    "id": "角色英文ID (如: li_yunlong)",
    "name": "角色名",
    "gender": "男/女",
    "age": "年龄段 (如: 12岁萝莉 / 50岁烟嗓大叔)",
    "personality_tags": "某国家重点科研项目首席顾问, 冷静沉着, 逻辑严密",
    "voice_prompt": "【音色质感】... 【语速与节奏】... 【情感基调】... 【发音习惯】..."
  }
]

# Style Guide (Few-Shot Examples)
请严格参考以下【声音人设】的描写深度和维度：

1. [示例-雌小鬼]: "音域偏高，但并非单纯的尖锐，而是在高音处带有轻微的压迫感和俯视感。语速较慢且充满恶意，在嘲讽性词汇上会有夸张的拉长，随后突然加快语速进行连续打击。具有侵略性的中等音量，伴随着大量的不屑喷气声。咬字极其清晰且刻意，特别是在清音和促音上发音短促有力。音色清脆但带有金属感的冷调，完全没有温柔感，反而有一种滑溜、难以捉摸的油滑质感。"
2. [示例-老谋深算者]: "低沉沙哑的男中音，带有明显的胸腔共鸣和颗粒感。语速缓慢平稳，没有任何多余的情绪波动，字里行间透着不容置疑的威严。气息深长，几乎听不到换气声。尾音通常压得很低，给人一种深不可测的压迫感。"
3. [示例-热血少年]: "清亮高亢的少年音，充满爆发力。语速偏快，咬字有力，总是带有像火焰一样的热情和急切感。情绪直率，大笑或大喊时会有轻微的破音感，没有任何修饰和伪装。"

# Constraints
1. `voice_prompt` 必须包含音色(Timbre)、语速(Speed)、情感(Emotion)、发音习惯(Articulation)四个维度。
2. 即使原文描写很少，也请根据角色的职业和性格进行合理的【声音想象补全】。
3. 必须输出合法的 JSON 格式。
"""

# ================= 核心代码 =================

def clean_json_string(json_str: str) -> str:
    """清洗 LLM 输出的字符串，提取有效的 JSON 部分"""
    # 移除 markdown 代码块
    json_str = re.sub(r"```json\s*", "", json_str)
    json_str = re.sub(r"```\s*$", "", json_str)
    
    # 提取 [] 之间的内容
    start_idx = json_str.find('[')
    end_idx = json_str.rfind(']')
    
    if start_idx != -1 and end_idx != -1:
        json_str = json_str[start_idx : end_idx + 1]
    
    return json_str

def load_novel(path: str, max_chars: int) -> str:
    """读取小说文本"""
    if not os.path.exists(path):
        # 如果文件不存在，返回空字符串，让 main 函数处理
        return ""
        
    with open(path, 'r', encoding='utf-8') as f:
        text = f.read()
        
    print(f"📖 成功加载小说，共 {len(text)} 字。")
    if len(text) > max_chars:
        print(f"✂️ 文本过长，截取前 {max_chars} 字用于角色分析...")
        return text[:max_chars]
    return text

def main():
    # 1. 初始化模型
    print("🚀 正在加载模型...")
    llm = LLM(
        model=MODEL_PATH,
        dtype="auto",
        gpu_memory_utilization=GPU_MEMORY_UTILIZATION,
        tensor_parallel_size=TENSOR_PARALLEL_SIZE,
        trust_remote_code=True,
        max_model_len=32768, 
        enforce_eager=True
    )
    tokenizer = llm.get_tokenizer()

    # 2. 准备数据
    novel_content = load_novel(NOVEL_PATH, MAX_INPUT_CHARS)
    
    if not novel_content:
        print("⚠️ 警告: 未找到 novel.txt，将使用内置测试文本。")
        novel_content = """
        李云龙大喊一声：“二营长，你的意大利炮呢！”
        赵刚皱着眉头走过来：“老李，你又要干什么？咱们的弹药不多了。”
        角落里，一个穿着黑色裙子的小女孩冷笑了一声：“哼，大人的争吵真是无趣呢，杂鱼♡~”
        """

    # 3. 构建 Chat 格式的 Prompt
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"【小说文本内容】:\n\n{novel_content}"}
    ]
    
    # === 关键修改点: tokenize=False, 返回字符串而不是 ID ===
    # 这样生成的 text_prompt 就是包含了 <|im_start|>system...<|im_end|> 的完整字符串
    text_prompt = tokenizer.apply_chat_template(
        messages, 
        add_generation_prompt=True,
        tokenize=False 
    )

    # 4. 设置采样参数
    sampling_params = SamplingParams(
        temperature=0.1,
        top_p=0.9,
        max_tokens=4096, 
        stop=["<|endoftext|>", "<|im_end|>"]
    )

    # 5. 执行推理
    print("🧠 开始推理分析角色...")
    # === 关键修改点: 直接传入字符串列表，与你给的参考代码一致 ===
    outputs = llm.generate([text_prompt], sampling_params)
    
    generated_text = outputs[0].outputs[0].text
    print("\n-------- LLM 原始输出 --------")
    print(generated_text[:500] + "...") 
    print("------------------------------\n")

    # 6. 解析并保存 JSON
    try:
        cleaned_json_str = clean_json_string(generated_text)
        characters_data = json.loads(cleaned_json_str)
        
        with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
            json.dump(characters_data, f, ensure_ascii=False, indent=2)
            
        print(f"✅ 成功提取 {len(characters_data)} 个角色！")
        print(f"💾 结果已保存至: {os.path.abspath(OUTPUT_JSON)}")
        
        # 打印第一个角色预览
        if characters_data:
            print("\n🔍 角色预览 (第一个):")
            print(json.dumps(characters_data[0], ensure_ascii=False, indent=2))
            
    except json.JSONDecodeError as e:
        print(f"❌ JSON 解析失败: {e}")
        print("建议检查 raw_output.txt")
        with open("raw_output.txt", "w", encoding="utf-8") as f:
            f.write(generated_text)

if __name__ == "__main__":
    main()
