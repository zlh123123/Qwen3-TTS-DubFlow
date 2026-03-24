# 模型服务部署方法

本目录提供 4 个可独立启动的 REST 模型服务（按需启动）：

- `qwen-voice-design`：Qwen3-TTS 音色设计
- `qwen-voice-clone`：Qwen3-TTS 音频克隆
- `fish-speech`：Fish-Speech TTS
- `meanaudio`：MeanAudio 环境音生成

各服务建议显存：

| 服务 | 建议显存 |
|---|---|
| `qwen-voice-design` | `至少12GB` |
| `qwen-voice-clone` | `至少12GB` | 
| `fish-speech` | `至少24GB` | 
| `meanaudio` | `至少8GB`（`meanaudio_s`）/ `至少12GB`（`meanaudio_l`） | 

## 1. 快速开始

1. 准备运行环境：Docker Engine + Docker Compose。
2. 准备目录并复制配置：

```bash
cd models_deploy
cp .env.example .env
mkdir -p volumes/hf-home volumes/qwen-models
mkdir -p fish-speech/checkpoints fish-speech/references
mkdir -p MeanAudio/weights
```

3. 仅启动你需要的服务（示例）：

```bash
# Qwen 音色设计
docker compose build qwen-voice-design
docker compose up -d qwen-voice-design

# Fish-Speech
docker compose build fish-speech
docker compose up -d fish-speech
```

4. 健康检查：

```bash
curl http://127.0.0.1:8001/v1/health  # qwen-voice-design
curl http://127.0.0.1:8002/v1/health  # qwen-voice-clone
curl http://127.0.0.1:8080/v1/health  # fish-speech
curl http://127.0.0.1:8003/v1/health  # meanaudio
```

## 2. 模型权重下载

默认不要求手动下载，容器启动时会自动拉取模型权重：

- Qwen3-TTS：按 `QWEN_VOICE_DESIGN_MODEL` / `QWEN_VOICE_CLONE_MODEL` 自动下载。
- Fish-Speech：`FISH_AUTO_DOWNLOAD=1` 时自动下载 `fishaudio/s2-pro`。
- MeanAudio：`MEANAUDIO_AUTO_DOWNLOAD=1` 时自动下载必需权重。

仅在离线部署、固定版本或私有模型场景下，建议手动预下载。


> 若您是中国用户，请在 `.env` 中配置：
>```env
>HF_ENDPOINT=https://hf-mirror.com
>```




## 3. 服务启动方式

### 3.1 按服务名启动（推荐）

```bash
docker compose build qwen-voice-design
docker compose up -d qwen-voice-design

docker compose build qwen-voice-clone
docker compose up -d qwen-voice-clone

docker compose build fish-speech
docker compose up -d fish-speech

docker compose build meanaudio
docker compose up -d meanaudio
```

### 3.2 按 profile 启动

```bash
docker compose --profile qwen-design up -d
docker compose --profile qwen-clone up -d
docker compose --profile fish up -d
docker compose --profile meanaudio up -d
```

### 3.3 全部启动（可选）

```bash
docker compose --profile qwen-design --profile qwen-clone --profile fish --profile meanaudio up -d
```

## 4. 常用运维命令

```bash
docker compose ps
docker compose logs -f qwen-voice-design
docker compose logs -f qwen-voice-clone
docker compose logs -f fish-speech
docker compose logs -f meanaudio

docker compose stop qwen-voice-design
docker compose restart qwen-voice-design
docker compose down
```

## 5. API 示例

### Qwen 音色设计

```bash
curl -X POST 'http://127.0.0.1:8001/v1/voice-design' \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "哥哥，你回来啦，人家等了你好久好久了，要抱抱！",
    "instruct": "体现撒娇稚嫩的萝莉女声，音调偏高且起伏明显。",
    "language": "Chinese",
    "response_format": "wav"
  }' \
  --output qwen_voice_design.wav
```

### Qwen 音频克隆

```bash
REF_B64=$(base64 < ./ref.wav | tr -d '\n')

curl -X POST 'http://127.0.0.1:8002/v1/voice-clone' \
  -H 'Content-Type: application/json' \
  -d "{
    \"text\": \"Good one. Okay, fine, I'm just gonna leave this sock monkey here. Goodbye.\",
    \"language\": \"Auto\",
    \"ref_text\": \"Okay. Yeah. I resent you. I love you.\",
    \"ref_audio_base64\": \"${REF_B64}\",
    \"x_vector_only_mode\": false,
    \"response_format\": \"wav\"
  }" \
  --output qwen_voice_clone.wav
```

### Fish-Speech TTS

```bash
curl -X POST 'http://127.0.0.1:8080/v1/tts' \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "Hello from Fish Speech",
    "format": "wav",
    "streaming": false
  }' \
  --output fish_tts.wav
```

### MeanAudio 环境音

```bash
curl -X POST 'http://127.0.0.1:8003/v1/sound' \
  -H 'Content-Type: application/json' \
  -d '{
    "prompt": "Heavy rain with distant thunder and passing cars",
    "negative_prompt": "human speech",
    "num_steps": 1,
    "duration": 10,
    "response_format": "wav"
  }' \
  --output meanaudio.wav
```

## 6. CPU 模式

默认 compose 使用 `gpus: all`。若使用 CPU：

1. `.env` 中设置：`QWEN_DEVICE=cpu`、`MEANAUDIO_DEVICE=cpu`。
2. `TORCH_INDEX_URL` 改为 `https://download.pytorch.org/whl/cpu`。
3. 在 `docker-compose.yml` 中移除对应服务的 `gpus` 字段。

