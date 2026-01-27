import json
import os
import re
from typing import List, Dict, Any
from tqdm import tqdm
from vllm import LLM, SamplingParams
from difflib import SequenceMatcher

# ================= 配置区域 =================
# 模型路径 (保持你本地的配置)
MODEL_PATH = "/mnt/tenant-home_speed/shanghai/zlh/recover_biaodian/qwen3_gen/model"

# 输入输出文件
NOVEL_PATH = "novel.txt"
CHARACTERS_PATH = "characters.json"
OUTPUT_FILE = "script_lines.json"
TEMP_JSONL = "raw_script_temp.jsonl" 

# 切片配置
CHUNK_SIZE = 3000       # 每个切片处理的字符数
OVERLAP_SIZE = 500      # 上下文重叠大小
GPU_MEMORY_UTILIZATION = 0.8
TENSOR_PARALLEL_SIZE = 2

# ================= 提示词模板 (已修复 KeyError) =================
# 注意：下方的 JSON 示例使用了双花括号 {{ }} 来转义，防止 .format() 报错
SYSTEM_PROMPT_TEMPLATE = """
# Role
你是一个剧本改编专家。你的任务是将小说文本转换为结构化的剧本格式。

# Known Characters
以下是本小说的主要角色列表，请严格从这里选择 `speaker_id`：
{characters_json}

# Rules
1. 将文本拆解为【对话】(dialogue) 和【旁白】(narration)。
2. 对于【对话】：
   - **最重要的规则：必须结合【上下文】尤其是【对话后的描写】来判断说话人。**
   - 警惕：不要默认对话属于上一句的主语！如果对话后描述了“某人转头看”、“某人走了出来”，说明说话者是新出现的人。
   - 必须指明 `speaker_id`。
   - 生成 `instruction` (30字以内的自然语言声音演出提示)。
3. 对于【旁白】：
   - `speaker_id` 设为 "narrator"。
4. 遇到未知路人，`speaker_id` 设为 "unknown"。

# Few-Shot Examples (思维链示例)
为了保证准确率，请参考以下推理逻辑：

【原文】
陈默皱了皱眉，没有立刻睁眼。
“操！这他妈是哪儿？！”
陈默转头看向声音来源。角落里，一个壮汉摇摇晃晃地站了起来。

【错误示范】(只看上文)
{{"type": "dialogue", "speaker_id": "chen_mo", ...}} -> 错误！虽然前文是陈默，但这句吼叫导致陈默去“看”别人，所以不是陈默说的。

【正确示范】(结合后文推理)
{{"type": "dialogue", "speaker_id": "lei_hu", "text": "操！这他妈是哪儿？！", "instruction": "炸雷般的怒吼，语速急促，情绪处于爆发边缘"}}

# Output Format (JSON Lines)
请直接输出 JSON Lines。
{{"type": "narration", "speaker_id": "narrator", "text": "天空下起了大雨。", "instruction": "压抑的氛围"}}
{{"type": "dialogue", "speaker_id": "li_yunlong", "text": "二营长！你的炮呢？", "instruction": "极度愤怒的嘶吼"}}
"""

# ================= 辅助函数 =================

def load_text(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

def load_characters(path):
    if not os.path.exists(path):
        raise FileNotFoundError(f"找不到角色文件: {path}，请先运行 extract_characters.py")
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def create_chunks(text, chunk_size, overlap):
    """
    生成滑动窗口切片
    """
    chunks = []
    start = 0
    text_len = len(text)
    
    while start < text_len:
        end = min(start + chunk_size, text_len)
        # 上下文回溯
        context_start = max(0, start - overlap) 
        chunk_text = text[context_start:end]
        
        chunks.append({
            "global_start": start,
            "context_start": context_start,
            "text": chunk_text
        })
        
        start += chunk_size 
        
    return chunks

def clean_llm_output(text):
    """提取 JSONL 行，增加对 instruction 的兼容处理"""
    lines = text.strip().split('\n')
    valid_objs = []
    for line in lines:
        line = line.strip()
        # 移除 Markdown 标记
        line = re.sub(r"^```json", "", line)
        line = re.sub(r"^```", "", line)
        if not line: continue
        
        try:
            obj = json.loads(line)
            # 基础校验
            if "text" in obj and "type" in obj:
                # 如果模型漏写了 instruction，给个默认值防止报错
                if "instruction" not in obj:
                    obj["instruction"] = "平静自然的语气"
                
                # 截断过长的 instruction (虽然 Prompt 限制了，但为了保险)
                if len(obj["instruction"]) > 50:
                    obj["instruction"] = obj["instruction"][:50]
                
                valid_objs.append(obj)
        except:
            continue
    return valid_objs

def is_similar(s1, s2, threshold=0.8):
    """判断两个句子是否相似（用于去重）"""
    return SequenceMatcher(None, s1, s2).ratio() > threshold

def merge_results(all_chunks_results):
    """
    合并逻辑：处理重叠区域
    """
    final_lines = []
    print("🔄 正在合并切片结果并去重...")
    
    for chunk_res in all_chunks_results:
        for item in chunk_res:
            curr_text = item.get("text", "")
            if not curr_text: continue
            
            # 简单的流式去重：检查是否与上一句高度重复
            if final_lines:
                prev_text = final_lines[-1].get("text", "")
                if is_similar(curr_text, prev_text, threshold=0.9):
                    continue
            
            final_lines.append(item)
            
    return final_lines

# ================= 主程序 =================

def main():
    # 1. 加载数据
    print("📖 加载小说和角色库...")
    if not os.path.exists(NOVEL_PATH):
        print(f"❌ 错误: 找不到 {NOVEL_PATH}")
        return

    full_text = load_text(NOVEL_PATH)
    characters = load_characters(CHARACTERS_PATH)
    
    # 简化角色列表用于 Prompt (减少 token 消耗)
    char_summary = []
    for c in characters:
        char_summary.append({
            "id": c.get("id"),
            "name": c.get("name"),
            "gender": c.get("gender"),
            "personality": c.get("personality_tags", [])
        })
    char_json_str = json.dumps(char_summary, ensure_ascii=False, indent=2)

    # 2. 初始化模型
    print("🚀 加载 vLLM 模型...")
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

    # 3. 切片
    chunks = create_chunks(full_text, CHUNK_SIZE, OVERLAP_SIZE)
    print(f"🔪 文本已切分为 {len(chunks)} 个片段")

    # 4. 批量构造 Prompt
    prompts = []
    # 调整采样参数，temperature 稍微调高一点点可以让 instruction 更自然，但不要太高
    sampling_params = SamplingParams(
        temperature=0.3, 
        top_p=0.9,
        max_tokens=4096,
        stop=["<|endoftext|>", "<|im_end|>"]
    )
    
    # 这里不会再报错了
    system_prompt_filled = SYSTEM_PROMPT_TEMPLATE.format(characters_json=char_json_str)

    print("📝 构造 Prompts...")
    for chunk in chunks:
        user_content = f"【当前文本片段】:\n{chunk['text']}"
        
        messages = [
            {"role": "system", "content": system_prompt_filled},
            {"role": "user", "content": user_content}
        ]
        
        # 使用 apply_chat_template 且 tokenize=False，返回字符串
        text_prompt = tokenizer.apply_chat_template(
            messages, 
            add_generation_prompt=True, 
            tokenize=False
        )
        prompts.append(text_prompt)

    # 5. 批量推理
    print(f"🧠 开始推理 (Batch Size = {len(prompts)})...")
    outputs = llm.generate(prompts, sampling_params)

    # 6. 处理结果
    all_raw_results = []
    
    # 清空临时文件
    with open(TEMP_JSONL, 'w', encoding='utf-8') as f:
        pass

    for i, output in enumerate(tqdm(outputs, desc="解析进度")):
        generated_text = output.outputs[0].text
        
        # 解析
        parsed_objs = clean_llm_output(generated_text)
        all_raw_results.append(parsed_objs)
        
        # 备份
        with open(TEMP_JSONL, 'a', encoding='utf-8') as f:
            for obj in parsed_objs:
                f.write(json.dumps(obj, ensure_ascii=False) + "\n")

    # 7. 合并
    final_script = merge_results(all_raw_results)
    
    # 8. 保存
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(final_script, f, ensure_ascii=False, indent=2)

    print(f"\n✅ 处理完成！")
    print(f"📊 共提取台词/旁白: {len(final_script)} 条")
    print(f"💾 结果已保存至: {os.path.abspath(OUTPUT_FILE)}")
    
    # 打印预览，检查 instruction 是否符合要求
    if final_script:
        print("\n🔍 结果预览 (Instruction 检查):")
        for item in final_script[:3]:
            print(f"角色: {item.get('speaker_id')}")
            print(f"台词: {item.get('text')[:20]}...")
            print(f"提示: {item.get('instruction')}")
            print("-" * 30)

if __name__ == "__main__":
    if not os.path.exists(NOVEL_PATH):
        print(f"❌ 错误: 找不到 {NOVEL_PATH}")
    elif not os.path.exists(CHARACTERS_PATH):
        print(f"❌ 错误: 找不到 {CHARACTERS_PATH}")
    else:
        main()
