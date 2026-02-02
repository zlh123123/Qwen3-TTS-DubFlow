import os
import time
import numpy as np
import soundfile as sf
import requests
import io
import base64
from concurrent.futures import ThreadPoolExecutor, as_completed

# ================= 配置区域 =================

# 服务端地址
API_URL_DESIGN = "http://localhost:8001/v1/audio/speech"
API_URL_BASE   = "http://localhost:8002/v1/audio/speech"
OUTPUT_DIR = "./output_drama_online"

# ================= 1. 角色深度设定 =================
CHARACTERS_CONFIG = {
    "系统AI": {
        "instruct": "无机质的电子合成音。语速极快，没有任何情感波动，发音标准但冰冷。需要在这段话里精准清晰地念出英文缩写和数字。",
        "ref_text": "Warning. System error 502. 核心温度已超过 4000 摄氏度，建议立即启动 Protocol Zero。" 
    },
    "林博士": {
        "instruct": "30岁男性，极度恐慌。声音颤抖剧烈，说话上气不接下气，带有明显的哭腔和绝望感。甚至因为害怕而有些破音。",
        "ref_text": "不……不对！这数据……咳咳……完全不对！它、它要炸了！救命！"
    },
    "指挥官": {
        "instruct": "45岁女性，铁血军人。声音低沉、沙哑，带有极强的压迫感。不是大喊大叫，而是咬牙切齿的愤怒。",
        "ref_text": "啧，该死的。所有人听令，切断连接！现在！立刻！"
    },
    "神秘人": {
        "instruct": "性别不明。声音非常轻，像是在耳边的低语（Whisper），带着一种轻蔑和嘲讽的笑意。气息感很重。",
        "ref_text": "呵，呵呵呵……人类真是脆弱啊。Good night。"
    }
}

# ================= 2. 剧本内容 =================
SCRIPT = [
    ("系统AI", "Alert! Alert! 检测到未知病毒侵入。Error Code: X-99-Beta. 内存占用率 99.9%."),
    ("神秘人", "哈哈哈哈……这就是你们的防火墙？太可笑了。Access Granted."),
    ("林博士", "谁？！你是谁？我明明……明明已经把端口封锁了！为什么……为什么还是……"),
    ("系统AI", "警告：扇区A、扇区B、扇区C1至C9全部离线。冷却液泄漏速率每秒五百升。倒计时：Ten, Nine, Eight..."),
    ("指挥官", "林默！你在干什么！我让你拔掉电源！听到没有！拔掉它！！"),
    ("林博士", "不……不行！手柄卡住了！它锁死了！我动不了！啊！！！"),
    ("神秘人", "嘘……安静点。在这个频率下，没人能听到你的尖叫。再见了，Doctor."),
    ("系统AI", "正在执行格式化程序。Deleting neural link interface config and biometrics data. 完成度 100%。"),
    ("指挥官", "……该死。"),
]

# ================= 辅助函数 =================

def audio_to_data_url(file_path):
    """
    [关键修复] 读取本地音频文件并转换为标准的 Data URL 格式
    格式: data:audio/wav;base64,xxxxxx
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")
        
    with open(file_path, "rb") as audio_file:
        audio_bytes = audio_file.read()
        
    base64_str = base64.b64encode(audio_bytes).decode('utf-8')
    # 这里必须手动拼接 MIME type 头，服务端才能识别
    return f"data:audio/wav;base64,{base64_str}"

def call_tts_api(url, payload, save_path):
    """发送请求并保存音频"""
    try:
        response = requests.post(url, json=payload, timeout=300)
        
        # 如果状态码不是200，先打印报错文本再抛出异常
        if response.status_code != 200:
            print(f"⚠️ Server Error ({response.status_code}): {response.text}")
            response.raise_for_status()

        # 尝试验证音频有效性
        try:
            # 使用 io.BytesIO 包装二进制数据
            data, sr = sf.read(io.BytesIO(response.content))
        except Exception as read_err:
            print(f"⚠️ Response content is not valid audio. Content start: {response.content[:50]}")
            raise read_err

        with open(save_path, "wb") as f:
            f.write(response.content)
            
        return data, sr
    except Exception as e:
        print(f"❌ API Call Failed: {e}")
        return None, None

# ================= 主程序 =================

def main():
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)

    total_start_time = time.perf_counter()
    MAX_WORKERS = 4 

    # ==================================================================
    # Stage 1: Batch Voice Design (并行捏人)
    # ==================================================================
    print("\n" + "="*60)
    print(f"🎨 [Stage 1] Batch Voice Design (API: {API_URL_DESIGN})...")
    print("="*60)
    t1_start = time.perf_counter()

    # 存储角色名对应的本地文件路径
    ref_wav_paths = {}
    
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        future_to_role = {}
        
        for name, config in CHARACTERS_CONFIG.items():
            save_path = os.path.abspath(os.path.join(OUTPUT_DIR, f"ref_{name}.wav"))
            ref_wav_paths[name] = save_path
            
            # VoiceDesign 任务不需要 ref_audio，只需要文本描述
            payload = {
                "model": "/mnt/tenant-home_speed/shanghai/models/Qwen3-TTS/Qwen3-TTS-12Hz-1.7B-VoiceDesign", 
                "task_type": "VoiceDesign",
                "input": config["ref_text"],
                "instructions": config["instruct"],
                "language": "Auto",
                "max_new_tokens": 2048
            }
            
            print(f"   -> Designing voice for: {name}")
            future = executor.submit(call_tts_api, API_URL_DESIGN, payload, save_path)
            future_to_role[future] = name

        for future in as_completed(future_to_role):
            role = future_to_role[future]
            data, sr = future.result()
            if data is not None:
                print(f"   ✅ Designed: {role}")
            else:
                print(f"   ❌ Failed to design: {role}")

    t1_end = time.perf_counter()
    print(f"✅ Stage 1 Done ({t1_end - t1_start:.2f}s)")

    # ==================================================================
    # Stage 2: Batch Base Clone (并行合成 - 修复版)
    # ==================================================================
    print("\n" + "="*60)
    print(f"🧊 [Stage 2] Batch Synthesis (API: {API_URL_BASE})...")
    print("="*60)
    t2_start = time.perf_counter()

    results_map = {} 

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        future_to_idx = {}
        
        for i, (role, text) in enumerate(SCRIPT):
            ref_path = ref_wav_paths.get(role)
            
            # 检查参考音频是否存在
            if not ref_path or not os.path.exists(ref_path):
                print(f"⚠️ Skipping line {i} ({role}): Reference audio not found at {ref_path}")
                continue

            ref_text_content = CHARACTERS_CONFIG[role]["ref_text"]
            save_path = os.path.join(OUTPUT_DIR, f"line_{i:02d}_{role}.wav")
            
            # [修复点] 将音频转换为带 data: 头部的 Data URL
            try:
                ref_audio_data_url = audio_to_data_url(ref_path)
            except Exception as e:
                print(f"❌ Error encoding audio for {role}: {e}")
                continue

            payload = {
                "model": "/mnt/tenant-home_speed/muiltModel/Qwen3-TTS-12Hz-1.7B-Base", 
                "task_type": "Base",
                "input": text,
                "ref_audio": ref_audio_data_url,  # <--- 现在这是一个合法的 Data URL
                "ref_text": ref_text_content,
                "language": "Auto",
                "x_vector_only_mode": False
            }
            
            print(f"   -> Submitting line {i}: {role}")
            future = executor.submit(call_tts_api, API_URL_BASE, payload, save_path)
            future_to_idx[future] = i

        for future in as_completed(future_to_idx):
            idx = future_to_idx[future]
            data, sr = future.result()
            role = SCRIPT[idx][0]
            if data is not None:
                results_map[idx] = (data, sr)
                print(f"   ✅ Synthesized Line {idx}: {role}")
            else:
                print(f"   ❌ Failed Line {idx}: {role}")

    t2_end = time.perf_counter()
    print(f"✅ Stage 2 Done ({t2_end - t2_start:.2f}s)")

    # ==================================================================
    # Stage 3: Concatenation (保持不变)
    # ==================================================================
    print("\n" + "="*60)
    print("💾 [Stage 3] Concatenating Audio...")
    print("="*60)
    
    final_audio = []
    sample_rate = 0
    
    for i in range(len(SCRIPT)):
        if i in results_map:
            wav, sr = results_map[i]
            sample_rate = sr
            final_audio.append(wav)
            silence = np.zeros(int(sr * 0.5)) 
            final_audio.append(silence)
        else:
            print(f"⚠️ Warning: Line {i} is missing from final mix.")

    if final_audio and sample_rate > 0:
        full_audio_data = np.concatenate(final_audio)
        output_path = os.path.join(OUTPUT_DIR, "full_drama_online_final.wav")
        sf.write(output_path, full_audio_data, sample_rate)
        
        print("\n📊 [Performance Report]")
        print(f"Design Time:     {t1_end - t1_start:.2f}s")
        print(f"Synthesis Time:  {t2_end - t2_start:.2f}s")
        print(f"Total Workflow:  {time.perf_counter() - total_start_time:.2f}s")
        print(f"Saved to: {os.path.abspath(output_path)}")
    else:
        print("❌ No audio generated.")

if __name__ == "__main__":
    main()
