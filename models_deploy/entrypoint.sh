#!/bin/bash
# 启动 Qwen3-TTS VoiceDesign 和 Base 模型

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

export PYTHONPATH="$SCRIPT_DIR/vllm_omni:$PYTHONPATH"
CONFIG_PATH="$SCRIPT_DIR/vllm_omni/vllm_omni/model_executor/stage_configs/qwen3_tts.yaml"
MODEL_DIR="$SCRIPT_DIR/model"

# 1. 启动 VoiceDesign 模型 (6006 端口)
echo "Starting Qwen3-TTS VoiceDesign server on port 6006..."
vllm-omni serve "$MODEL_DIR/Qwen3-TTS-12Hz-1.7B-VoiceDesign" \
    --stage-configs-path "$CONFIG_PATH" \
    --host 0.0.0.0 \
    --port 6006 \
    --gpu-memory-utilization 0.3 \
    --trust-remote-code \
    --enforce-eager \
    --omni &

# 2. 启动 Base 模型 (6008 端口)
echo "Starting Qwen3-TTS Base server on port 6008..."
vllm-omni serve "$MODEL_DIR/Qwen3-TTS-12Hz-1.7B-Base" \
    --stage-configs-path "$CONFIG_PATH" \
    --host 0.0.0.0 \
    --port 6008 \
    --gpu-memory-utilization 0.6 \
    --trust-remote-code \
    --enforce-eager \
    --omni &

wait