import os
import time
import numpy as np
import soundfile as sf
import torch
import gc
from typing import List, Dict

# 设置 vLLM 环境变量 (必须)
os.environ["VLLM_WORKER_MULTIPROC_METHOD"] = "spawn"

from vllm import SamplingParams
from vllm_omni import Omni

# ================= 配置区域 =================

# 模型路径 (请确认路径正确)
MODEL_PATH_DESIGN = "/root/autodl-tmp/Qwen3-TTS-DubFlow/model/Qwen3-TTS-VoiceDesign"
MODEL_PATH_BASE = "/root/autodl-tmp/Qwen3-TTS-DubFlow/model/Qwen3-TTS-Base"

# 输出目录
OUTPUT_DIR = "./output_drama_vllm_batch_serve"

# 1. 角色设定
# CHARACTERS_CONFIG = {
#     "Narrator": {
#         "instruct": "Male, energetic podcast host. Casual, engaging, and expressive. Speaks with dynamic pacing, varying pitch to keep the listener hooked. Not robotic at all, sounds like a friend telling a crazy story.",
#         "ref_text": "Welcome back to the show! You are not gonna believe what happened next. It was absolute chaos!" 
#     },
#     "Leo": {
#         "instruct": "Male, British accent (RP). Deep, smooth baritone voice. Sophisticated, calm, and slightly arrogant. Sounds like a villain in a spy movie.",
#         "ref_text": "My dear lady, I'm afraid you have miscalculated the situation entirely."
#     },
#     "Sarah": {
#         "instruct": "Female, American accent. Slightly raspy and husky voice. Confident, sarcastic, and sharp. She has a 'don't mess with me' attitude.",
#         "ref_text": "Cut the crap, Leo. We both know you're bluffing."
#     }
# }

# # 2. 剧本内容
# SCRIPT = [
#     ("Narrator", "So, picture this. It's midnight in a smoky underground casino in London. The tension? You could cut it with a knife."),
#     ("Leo", "All in. I believe... the Ace of Spades belongs to me."),
#     ("Narrator", "Leo pushes a mountain of chips into the center. He looks cool as a cucumber."),
#     ("Sarah", "You really think you can scare me with that posh accent? Cute."),
#     ("Leo", "It is not about the accent, darling. It is about the cards."),
#     ("Narrator", "Ooh, shots fired! Sarah leans forward, staring right into his soul."),
#     ("Sarah", "Alright then. I call. But if I win, I'm taking that fancy watch of yours too."),
#     ("Leo", "Ha! You are welcome to try. But I must warn you, I never lose."),
#     ("Narrator", "The room goes silent. The dealer flips the final card... It's a Queen of Hearts!"),
#     ("Sarah", "Boom! Full house! Read 'em and weep, Leo!"),
#     ("Leo", "Impossible... How... how did you...?"),
#     ("Sarah", "Like I said. Don't mess with me."),
#     ("Narrator", "And just like that, Leo was broke! Can you believe it? That is why you never play poker with Sarah!"),
# ]

# ================= 1. 角色深度设定 (Stress Test: Cyberpunk Crisis) =================
CHARACTERS_CONFIG = {
    "系统AI": {
        # 测试点：机械感、中英混合、数字/代码朗读、极快语速
        "instruct": "无机质的电子合成音。语速极快，没有任何情感波动，发音标准但冰冷。需要在这段话里精准清晰地念出英文缩写和数字。",
        "ref_text": "Warning. System error 502. 核心温度已超过 4000 摄氏度，建议立即启动 Protocol Zero。" 
    },
    "林博士": {
        # 测试点：极端恐惧、结巴、换气声、濒死感的颤抖
        "instruct": "30岁男性，极度恐慌。声音颤抖剧烈，说话上气不接下气，带有明显的哭腔和绝望感。甚至因为害怕而有些破音。",
        "ref_text": "不……不对！这数据……咳咳……完全不对！它、它要炸了！救命！"
    },
    "指挥官": {
        # 测试点：压抑的愤怒、低沉嘶哑、命令口吻、语气词
        "instruct": "45岁女性，铁血军人。声音低沉、沙哑，带有极强的压迫感。不是大喊大叫，而是咬牙切齿的愤怒。",
        "ref_text": "啧，该死的。所有人听令，切断连接！现在！立刻！"
    },
    "神秘人": {
        # 测试点：气声（Whisper）、轻蔑笑声、阴阳怪气
        "instruct": "性别不明。声音非常轻，像是在耳边的低语（Whisper），带着一种轻蔑和嘲讽的笑意。气息感很重。",
        "ref_text": "呵，呵呵呵……人类真是脆弱啊。Good night。"
    }
}

# ================= 2. 剧本内容 (Scenario: The System Collapse) =================
SCRIPT = [
    # --- 测试点1：中英混合 + 数字代码 ---
    ("系统AI", "Alert! Alert! 检测到未知病毒侵入。Error Code: X-99-Beta. 内存占用率 99.9%."),
    
    # --- 测试点2：拟声词处理 (是读出"哈"字，还是真的笑出声) ---
    ("神秘人", "哈哈哈哈……这就是你们的防火墙？太可笑了。Access Granted."),
    
    # --- 测试点3：极端恐惧 + 结巴 + 语气停顿 ---
    ("林博士", "谁？！你是谁？我明明……明明已经把端口封锁了！为什么……为什么还是……"),
    
    # --- 测试点4：极快语速播报 (Tongue Twister style) ---
    ("系统AI", "警告：扇区A、扇区B、扇区C1至C9全部离线。冷却液泄漏速率每秒五百升。倒计时：Ten, Nine, Eight..."),
    
    # --- 测试点5：愤怒的咆哮 (检测爆音和情感张力) ---
    ("指挥官", "林默！你在干什么！我让你拔掉电源！听到没有！拔掉它！！"),
    
    # --- 测试点6：特定的发音歧义 (比如 '行' 是 xing 还是 hang) ---
    ("林博士", "不……不行！手柄卡住了！它锁死了！我动不了！啊！！！"),
    
    # --- 测试点7：低语/气声 (Whisper) ---
    ("神秘人", "嘘……安静点。在这个频率下，没人能听到你的尖叫。再见了，Doctor."),
    
    # --- 测试点8：长难句 + 专业术语 ---
    ("系统AI", "正在执行格式化程序。Deleting neural link interface config and biometrics data. 完成度 100%。"),
    
    ("指挥官", "……该死。"),
]

# ================= 辅助函数 =================

def cleanup_vllm(omni_instance):
    """强制销毁 vLLM 实例并释放显存"""
    if omni_instance:
        del omni_instance
    gc.collect()
    torch.cuda.empty_cache()
    print("🧹 VRAM Cleaned.")

def parse_req_id(request_id_str):
    """解析 vLLM 返回的复杂 request_id，提取数字索引"""
    try:
        req_str = str(request_id_str)
        if '_' in req_str:
            return int(req_str.split('_')[0])
        return int(req_str)
    except:
        return -1

# ================= 主程序 =================

def main():
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)

    total_start_time = time.perf_counter()

    # ==================================================================
    # Stage 1: Batch Voice Design (并行捏人)
    # ==================================================================
    print("\n" + "="*60)
    print("🎨 [Stage 1] Batch Voice Design (Baking Voices)...")
    print("="*60)
    t1_start = time.perf_counter()

    # 1. 构造 Batch Inputs (严格遵循官方 Demo 格式)
    design_inputs = []
    design_meta = [] # 用来记录 request_id 对应的角色名

    # 遍历字典构造列表
    for name, config in CHARACTERS_CONFIG.items():
        text = config["ref_text"]
        instruct = config["instruct"]
        
        # 官方推荐 Prompt 格式
        prompt = f"<|im_start|>assistant\n{text}<|im_end|>\n<|im_start|>assistant\n"
        
        design_inputs.append({
            "prompt": prompt,
            "additional_information": {
                "task_type": ["VoiceDesign"], # 必须是列表
                "text": [text],
                "language": ["Auto"], # 或者 "English"
                "instruct": [instruct],
                "max_new_tokens": [2048],
                "non_streaming_mode": [True],
            },
        })
        design_meta.append(name)

    # 2. 初始化模型 & 推理
    omni_design = Omni(model=MODEL_PATH_DESIGN, log_stats=False)
    # 采样参数建议：Temperature 0.9 保证多样性，Top-P 1.0
    sampling_params = SamplingParams(temperature=0.9, top_p=1.0, max_tokens=2048)
    
    print(f"🔥 Designing {len(design_inputs)} voices in parallel...")
    generator = omni_design.generate(design_inputs, [sampling_params])

    ref_wav_paths = {}

    # 3. 处理结果
    for stage_outputs in generator:
        for res in stage_outputs.request_output:
            req_id = parse_req_id(res.request_id)
            
            if 0 <= req_id < len(design_meta):
                role_name = design_meta[req_id]
                audio_tensor = res.multimodal_output["audio"]
                sr = res.multimodal_output["sr"].item()
                
                # 转 Numpy
                audio_numpy = audio_tensor.float().detach().cpu().numpy()
                if audio_numpy.ndim > 1: audio_numpy = audio_numpy.flatten()
                
                # 保存
                save_path = os.path.join(OUTPUT_DIR, f"ref_{role_name}.wav")
                sf.write(save_path, audio_numpy, samplerate=sr, format="WAV")
                
                ref_wav_paths[role_name] = os.path.abspath(save_path)
                print(f"   -> [ReqID:{req_id}] Generated: {role_name}")

    t1_end = time.perf_counter()
    print(f"✅ Stage 1 Done ({t1_end - t1_start:.2f}s)")
    
    # 必须清理，否则 Stage 2 爆显存
    cleanup_vllm(omni_design)

    # ==================================================================
    # Stage 2: Batch Base Clone (并行合成剧本)
    # ==================================================================
    print("\n" + "="*60)
    print("🧊 [Stage 2] Batch Synthesis (Base Clone)...")
    print("="*60)
    t2_start = time.perf_counter()

    # 1. 构造 Batch Inputs
    base_inputs = []
    
    for i, (role, text) in enumerate(SCRIPT):
        # 校验是否有参考音频
        if role not in ref_wav_paths:
            print(f"❌ Error: Missing ref audio for {role}, skipping line {i}")
            continue
            
        ref_audio_path = ref_wav_paths[role]
        ref_text = CHARACTERS_CONFIG[role]["ref_text"]
        
        prompt = f"<|im_start|>assistant\n{text}<|im_end|>\n<|im_start|>assistant\n"
        
        base_inputs.append({
            "prompt": prompt,
            "additional_information": {
                "task_type": ["Base"],
                "ref_audio": [ref_audio_path], # 传入绝对路径
                "ref_text": [ref_text],
                "text": [text],
                "language": ["Auto"],
                "x_vector_only_mode": [False], # False = ICL模式 (效果更好)
                "max_new_tokens": [2048],
            },
        })

    # 2. 初始化模型 & 推理
    omni_base = Omni(model=MODEL_PATH_BASE, log_stats=False)
    
    print(f"🎬 Synthesizing {len(base_inputs)} lines in parallel...")
    generator = omni_base.generate(base_inputs, [sampling_params])

    # 使用字典暂存结果，以支持乱序返回
    results_map = {} # {req_id: (wav, sr)}

    for stage_outputs in generator:
        for res in stage_outputs.request_output:
            req_id = parse_req_id(res.request_id)
            
            if 0 <= req_id < len(SCRIPT):
                audio_tensor = res.multimodal_output["audio"]
                sr = res.multimodal_output["sr"].item()
                audio_numpy = audio_tensor.float().detach().cpu().numpy()
                if audio_numpy.ndim > 1: audio_numpy = audio_numpy.flatten()
                
                results_map[req_id] = (audio_numpy, sr)
                
                # 实时显示进度
                role = SCRIPT[req_id][0]
                print(f"   -> [ReqID:{req_id}] Synthesized: {role} ", end="\r")

    print("\n")
    t2_end = time.perf_counter()
    print(f"✅ Stage 2 Done ({t2_end - t2_start:.2f}s)")
    
    cleanup_vllm(omni_base)

    # ==================================================================
    # Stage 3: Concatenation (拼接)
    # ==================================================================
    print("\n" + "="*60)
    print("💾 [Stage 3] Concatenating Audio...")
    print("="*60)
    
    final_audio = []
    sample_rate = 0
    
    # 按照剧本顺序拼接
    for i in range(len(base_inputs)):
        if i in results_map:
            wav, sr = results_map[i]
            sample_rate = sr
            
            # 保存单句 (Debug 用)
            role = SCRIPT[i][0]
            sf.write(os.path.join(OUTPUT_DIR, f"{i:02d}_{role}.wav"), wav, sr)
            
            final_audio.append(wav)
            # 添加 0.5s 静音，让对话更有呼吸感
            silence = np.zeros(int(sr * 0.5)) 
            final_audio.append(silence)
        else:
            print(f"⚠️ Warning: Line {i} failed generation.")

    if final_audio and sample_rate > 0:
        full_audio_data = np.concatenate(final_audio)
        output_path = os.path.join(OUTPUT_DIR, "full_drama_batch.wav")
        sf.write(output_path, full_audio_data, sample_rate)
        
        # 打印性能报告 
        print("\n📊 [Performance Report]")
        print(f"Design Time (3 voices):  {t1_end - t1_start:.2f}s")
        print(f"Clone Time ({len(SCRIPT)} lines):   {t2_end - t2_start:.2f}s")
        print(f"Total Time:              {time.perf_counter() - total_start_time:.2f}s")
        print(f"Saved to: {output_path}")

if __name__ == "__main__":
    main()