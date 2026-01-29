import os
import time
import numpy as np
import soundfile as sf
import torch
import gc
from typing import List, Dict

# 设置 vLLM 环境变量
os.environ["VLLM_WORKER_MULTIPROC_METHOD"] = "spawn"

from vllm import SamplingParams
from vllm_omni import Omni

# ================= 配置区域 =================

# 模型路径
MODEL_PATH_DESIGN = "/root/autodl-tmp/Qwen3-TTS-DubFlow/model/Qwen3-TTS-VoiceDesign"
MODEL_PATH_BASE = "/root/autodl-tmp/Qwen3-TTS-DubFlow/model/Qwen3-TTS-Base"

# ================= 1. 角色设定 (Daily Life / Slice of Life Version) =================
# CHARACTERS_CONFIG = {
#     "旁白": {
#         # 优化点：不再是情绪高昂的JK，而是温柔治愈的日剧旁白。
#         "instruct": "20代の女性の声。穏やかで、包容力のある優しい語り口。落ち着いたトーンで、日常の幸せを噛みしめるように話す。読み聞かせのような、柔らかい質感。",
#         # (中文：20多岁女性声音。温和、有包容力的温柔语调。沉稳的声线，仿佛在细细品味日常的幸福。像读绘本一样，质感柔软。)
#         "ref_text": "窓から差し込む午後の日差しが、図書館の埃をキラキラと照らしていました。" 
#     },
#     "健司": {
#         # 优化点：强调少年的青涩和慌乱时的语速变化。
#         "instruct": "17歳の男子高校生。真面目だが、女性慣れしていないウブな性格。声はやや高めで、緊張すると早口になったり、声が裏返ったりする。純朴で、一生懸命な感じ。",
#         # (中文：17岁男高中生。认真但对女性毫无经验的纯情性格。声线稍高，紧张时语速变快或破音。给人纯朴、拼命努力的感觉。)
#         "ref_text": "あ、あの、僕、この本を探してて……えっと、その……"
#     },
#     "玲奈": {
#         # 优化点：强调“湿润感”和“距离感”，不是单纯的S，而是带点小恶魔属性的温柔学姐。
#         "instruct": "19歳の女子大生。大人びているが、いたずら好きな先輩。声には艶と湿り気があり、耳元で囁くようなウィスパーボイスを多用する。ゆったりとしたリズムで話す。",
#         # (中文：19岁女大学生。虽然成熟但喜欢恶作剧的学姐。声音带有光泽和湿润感，多用耳边低语的气声。说话节奏缓慢慵懒。)
#         "ref_text": "ん〜？そんなに顔を赤くして、どうしたの？可愛い。"
#     }
# }

# # ================= 2. 剧本内容 (Scenario: The Library Whisper) =================
# SCRIPT = [
#     ("旁白", "放課後の図書館。静寂に包まれた本棚の隙間で、健司は必死に背伸びをしていた。"),
#     # (旁白：放学后的图书馆。在被寂静包围的书架缝隙间，健司正拼命踮着脚。)

#     ("健司", "うぅ……あと少しなのに……届かない……。踏み台、どこだっけ……？"),
#     # (健司：唔……明明就差一点了……够不到……梯子在哪来着……？)

#     ("玲奈", "（小声で）だーれだ？"),
#     # (玲奈：(小声) 猜—猜—我—是—谁？)

#     ("健司", "うわっ！？……あ、痛っ！"),
#     # (健司：哇！？……啊，好痛！)

#     ("旁白", "驚いて振り返った拍子に、健司は本棚に背中をぶつけてしまった。"),
#     # (旁白：因为受惊猛地回头，健司的背撞到了书架上。)

#     ("玲奈", "ふふっ、ごめんごめん。そんなに驚くと思わなかったから。……大丈夫？"),
#     # (玲奈：呵呵，抱歉抱歉。没想你会吓成这样。……没事吧？)

#     ("健司", "れ、玲奈先輩！？……び、びっくりさせないでくださいよぉ……心臓止まるかと思いました……"),
#     # (健司：玲、玲奈学姐！？……请、请不要吓我啊……我以为心脏要停了……)

#     ("玲奈", "だって、健司くんが無防備な背中を見せてるんだもん。つい、いじりたくなっちゃって。"),
#     # (玲奈：因为嘛，健司君露出了毫无防备的后背。一不小心就想捉弄一下。)

#     ("健司", "む、無防備って……本を探してただけです！……それに、ここは図書館ですから、静かに……"),
#     # (健司：毫、毫无防备什么的……我只是在找书！……而且，这里是图书馆，请安静……)

#     ("玲奈", "（耳元で囁く）あら？……私の声、そんなに大きい？……ねえ、健司くん。"),
#     # (玲奈：(耳边低语) 哎呀？……我的声音，有那么大吗？……呐，健司君。)

#     ("健司", "ひっ……！ち、近いです！先輩、顔が近いです！！"),
#     # (健司：噫……！太、太近了！学姐，脸太近了！！)

#     ("玲奈", "ふふ、顔真っ赤。……健司くんって、本当にわかりやすいわね。……ほら、これ。"),
#     # (玲奈：呵呵，脸红透了。……健司君真是太好懂了呢。……诺，给。)

#     ("旁白", "彼女は軽く手を伸ばすと、健司が取れなかった本をいとも簡単に取り出し、彼の手元に押し付けた。"),
#     # (旁白：她轻轻伸出手，轻而易举地拿下了健司够不到的那本书，塞到了他手里。)

#     ("健司", "あ……ありがとうございます……。先輩には、敵わないなぁ……"),
#     # (健司：啊……谢、谢谢……。真的赢不了学姐啊……)

#     ("玲奈", "お礼は？……まあ、今度ジュース一本で許してあげる。……またね、健司くん。"),
#     # (玲奈：谢礼呢？……算了，下次请我喝瓶果汁就原谅你。……回见啦，健司君。)

#     ("旁白", "彼女の残り香と、微かな笑い声。健司はしばらくの間、その場から動くことができなかった。"),
#     # (旁白：她留下的余香，和微弱的笑声。健司在原地愣了许久，一步也动弹不得。)
# ]

OUTPUT_DIR = "./output_drama"

# ================= 1. 角色设定 (Chinese Daily Life Version) =================
CHARACTERS_CONFIG = {
    "旁白": {
        # 设定：温暖治愈的叙述者，像是在午后电台里读散文
        "instruct": "30岁左右的女性声音。语调温柔、知性，带有很强的包容力。语速舒缓，像是在讲一个温暖的睡前故事，没有任何攻击性，让人感到放松。",
        "ref_text": "午后的阳光透过百叶窗，懒洋洋地洒在咖啡机的金属外壳上，空气中弥漫着焦糖的香气。" 
    },
    "阿泽": {
        # 设定：职场新人，有点憨，紧张时语速会变快，带有明显的吞音
        "instruct": "22岁的职场新人，男性。声音清亮、干净，带有明显的少年感。性格比较拘谨，说话时经常会有“那个”、“呃”之类的语气词，紧张时语速会不自觉加快，显得有些笨拙可爱。",
        "ref_text": "那个……静姐，这份文件的格式，我、我好像弄错了……能不能帮我看一眼？"
    },
    "静姐": {
        # 设定：御姐音，但不是那种凶的，而是慵懒、成熟、带点烟嗓或气泡音
        "instruct": "28岁的成熟女性。声音低沉、有磁性，带有微微的慵懒感和颗粒感（气泡音）。说话节奏较慢，尾音习惯性拖长，带着一种漫不经心的优雅和一点点调笑的意味。",
        "ref_text": "嗯？这么简单的事情都要问我呀？……拿过来吧，姐姐教你。"
    }
}

# ================= 2. 剧本内容 (Scenario: The Pantry Break) =================
SCRIPT = [
    ("旁白", "下午三点，公司的茶水间。阿泽正对着那台复杂的咖啡机发愁，手指在按钮前悬停了半天。"),
    
    ("阿泽", "哎……这个到底是先按‘磨豆’还是先按‘萃取’啊？说明书去哪了……"),
    
    ("静姐", "左边那个是清洗键，按了可是会喷水的哦。"),
    
    ("阿泽", "哇啊？！……咳咳咳！"),
    
    ("旁白", "阿泽被吓得猛一哆嗦，手里的纸杯差点捏扁。回头一看，静姐正靠在门框上，手里端着个马克杯，似笑非笑地看着他。"),
    
    ("阿泽", "静、静姐！你走路怎么没声音啊……吓死我了……"),
    
    ("静姐", "是你太专注了吧？……怎么，入职一个月了，还搞不定这台机器？"),
    
    ("阿泽", "呃，那个……我平时都喝白开水的。今天实在是太困了，想弄杯咖啡提提神……"),
    
    ("静姐", "呵，昨晚又熬夜改方案了？"),
    
    ("旁白", "静姐走上前，轻轻拨开阿泽的手。她身上淡淡的香水味瞬间包围了阿泽，让他不由自主地屏住了呼吸。"),
    
    ("静姐", "让开点，笨手笨脚的。……看着啊，先按这里，再选浓度。"),
    
    ("阿泽", "哦、哦！原来是这样……谢谢静姐。"),
    
    ("静姐", "……说起来，你最近好像一直躲着我？"),
    
    ("阿泽", "啊？没、没有啊！绝对没有！我就是……就是最近工作太忙了！"),
    
    ("静姐", "是吗？……我还以为，你是怕我吃了你呢。"),
    
    ("旁白", "机器“滴”的一声停了。静姐把刚做好的热拿铁递给阿泽，指尖若有若无地触碰到了他的手背。"),
    
    ("静姐", "拿好了。……小心烫。"),
    
    ("阿泽", "谢、谢谢……那个，静姐，我先回去干活了！"),
    
    ("旁白", "看着阿泽落荒而逃的背影，静姐抿了一口自己杯子里的黑咖啡，嘴角勾起一抹好看的弧度。"),
    
    ("静姐", "真是个……不经逗的小孩。"),
]

# ================= 辅助函数 =================

def cleanup_vllm(omni_instance):
    """强制清理 vLLM 实例以释放显存"""
    if omni_instance:
        del omni_instance
    gc.collect()
    torch.cuda.empty_cache()
    print("🧹 VRAM Cleaned.")

def construct_design_inputs(chars_config):
    """构建 VoiceDesign 批量请求"""
    inputs = []
    metadata = [] 
    
    for name, config in chars_config.items():
        text = config["ref_text"]
        instruct = config["instruct"]
        prompt = f"<|im_start|>assistant\n{text}<|im_end|>\n<|im_start|>assistant\n"
        
        inputs.append({
            "prompt": prompt,
            "additional_information": {
                "task_type": ["VoiceDesign"],
                "text": [text],
                "language": ["Auto"],
                "instruct": [instruct],
                "max_new_tokens": [2048],
                "non_streaming_mode": [True],
            },
        })
        metadata.append(name)
    return inputs, metadata

def construct_base_inputs(script, ref_wav_paths, chars_config):
    """构建 Base Clone 批量请求"""
    inputs = []
    
    for role, text in script:
        if role not in ref_wav_paths:
            raise KeyError(f"❌ 错误：角色 '{role}' 的参考音频未生成！Stage 1 可能失败。")

        ref_audio_path = ref_wav_paths[role]
        ref_text = chars_config[role]["ref_text"]
        
        prompt = f"<|im_start|>assistant\n{text}<|im_end|>\n<|im_start|>assistant\n"
        
        inputs.append({
            "prompt": prompt,
            "additional_information": {
                "task_type": ["Base"],
                "ref_audio": [ref_audio_path], 
                "ref_text": [ref_text],
                "text": [text],
                "language": ["Auto"],
                "x_vector_only_mode": [False], 
                "max_new_tokens": [2048],
            },
        })
    return inputs

# ================= 主程序 =================

def main():
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)

    total_start_time = time.perf_counter()

    # ------------------------------------------------------------------
    # Stage 1: 批量捏人 (Voice Design)
    # ------------------------------------------------------------------
    print("\n" + "="*50)
    print("🎨 [Stage 1] Batch Voice Design (Baking Voices)...")
    print("="*50)
    
    t1_start = time.perf_counter()
    
    omni_design = Omni(
        model=MODEL_PATH_DESIGN,
        log_stats=False
    )
    
    design_inputs, design_meta = construct_design_inputs(CHARACTERS_CONFIG)
    sampling_params = SamplingParams(temperature=0.9, top_p=1.0, max_tokens=2048)
    
    print(f"🔥 Designing {len(design_inputs)} voices...")
    
    generator = omni_design.generate(design_inputs, [sampling_params])
    
    ref_wav_paths = {} 
    
    for stage_outputs in generator:
        results = stage_outputs.request_output
        for res in results:
            # === 修复点 1：解析 request_id ===
            # request_id 格式可能是 "0_abcd...", 我们只需要前面的数字索引
            try:
                req_id_str = str(res.request_id)
                if '_' in req_id_str:
                    req_id = int(req_id_str.split('_')[0])
                else:
                    req_id = int(req_id_str)
            except ValueError:
                print(f"⚠️ Warning: Could not parse request_id: {res.request_id}")
                continue
            
            if req_id < len(design_meta):
                role_name = design_meta[req_id]
                
                audio_tensor = res.multimodal_output["audio"]
                sr = res.multimodal_output["sr"].item()
                
                audio_numpy = audio_tensor.float().detach().cpu().numpy()
                if audio_numpy.ndim > 1: audio_numpy = audio_numpy.flatten()
                
                save_path = os.path.join(OUTPUT_DIR, f"ref_{role_name}.wav")
                sf.write(save_path, audio_numpy, samplerate=sr, format="WAV")
                
                ref_wav_paths[role_name] = os.path.abspath(save_path)
                print(f"   -> [ID:{req_id}] Saving Ref Audio for: {role_name}")

    print("\n") 
    t1_end = time.perf_counter()
    
    if len(ref_wav_paths) != len(CHARACTERS_CONFIG):
        print(f"❌ 严重错误: 预期生成 {len(CHARACTERS_CONFIG)} 个角色，实际只有 {len(ref_wav_paths)} 个。")
        return

    print(f"✅ Stage 1 Completed in {t1_end - t1_start:.2f}s")
    cleanup_vllm(omni_design)
    
    # ------------------------------------------------------------------
    # Stage 2: 批量克隆合成 (Base Model)
    # ------------------------------------------------------------------
    print("\n" + "="*50)
    print("🧊 [Stage 2] Batch Synthesis (Base Clone)...")
    print("="*50)
    
    t2_start = time.perf_counter()
    
    omni_base = Omni(
        model=MODEL_PATH_BASE,
        log_stats=False
    )
    
    base_inputs = construct_base_inputs(SCRIPT, ref_wav_paths, CHARACTERS_CONFIG)
    
    print(f"🎬 Synthesizing {len(base_inputs)} lines...")
    
    generator = omni_base.generate(base_inputs, [sampling_params])
    
    temp_results = {}
    
    for stage_outputs in generator:
        results = stage_outputs.request_output
        for res in results:
            # === 修复点 2：解析 request_id ===
            try:
                req_id_str = str(res.request_id)
                if '_' in req_id_str:
                    req_id = int(req_id_str.split('_')[0])
                else:
                    req_id = int(req_id_str)
            except ValueError:
                print(f"⚠️ Warning: Could not parse request_id: {res.request_id}")
                continue
            
            if req_id < len(SCRIPT):
                audio_tensor = res.multimodal_output["audio"]
                sr = res.multimodal_output["sr"].item()
                audio_numpy = audio_tensor.float().detach().cpu().numpy()
                if audio_numpy.ndim > 1: audio_numpy = audio_numpy.flatten()
                
                temp_results[req_id] = (audio_numpy, sr)
                
                role_name = SCRIPT[req_id][0]
                save_name = f"{req_id:02d}_{role_name}.wav"
                sf.write(os.path.join(OUTPUT_DIR, save_name), audio_numpy, sr)
                print(f"   -> [ID:{req_id}] Synthesized line for {role_name}   ", end="\r")

    print("\n")
    t2_end = time.perf_counter()
    print(f"✅ Stage 2 Completed in {t2_end - t2_start:.2f}s")
    
    cleanup_vllm(omni_base)

    # ------------------------------------------------------------------
    # Stage 3: 拼接音频
    # ------------------------------------------------------------------
    print("\n" + "="*50)
    print("💾 [Stage 3] Concatenating Audio...")
    print("="*50)
    
    final_audio = []
    sample_rate = 0
    
    for i in range(len(SCRIPT)):
        if i in temp_results:
            wav, sr = temp_results[i]
            sample_rate = sr
            final_audio.append(wav)
            silence = np.zeros(int(sr * 0.3))
            final_audio.append(silence)
        else:
            print(f"⚠️ Warning: Line {i} failed to generate.")
        
    if final_audio and sample_rate > 0:
        full_audio_data = np.concatenate(final_audio)
        output_path = os.path.join(OUTPUT_DIR, "full_drama_vllm.wav")
        sf.write(output_path, full_audio_data, sample_rate)
        print(f"🎉 Full Audio Saved: {output_path}")
    
    total_end_time = time.perf_counter()
    
    print("\n" + "="*50)
    print("📊 Performance Report")
    print("="*50)
    print(f"Ref Audio Gen (VoiceDesign): {t1_end - t1_start:.2f}s")
    print(f"Script Syn (Base Clone):     {t2_end - t2_start:.2f}s")
    print(f"Total Workflow Time:         {total_end_time - total_start_time:.2f}s")
    print(f"Lines of Dialogue:           {len(SCRIPT)}")
    print("="*50)

if __name__ == "__main__":
    main()