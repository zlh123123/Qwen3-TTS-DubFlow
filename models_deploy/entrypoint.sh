#!/bin/bash
# 启动 Qwen3-TTS VoiceDesign 和 Base 模型

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

export PYTHONPATH="$SCRIPT_DIR/vllm_omni:$PYTHONPATH"
CONFIG_PATH="$SCRIPT_DIR/vllm_omni/vllm_omni/model_executor/stage_configs/qwen3_tts.yaml"
MODEL_DIR="$SCRIPT_DIR/model"


echo "Starting Qwen3-TTS VoiceDesign server on port 8000..."
vllm-omni serve "$MODEL_DIR/Qwen3-TTS-VoiceDesign" \
    --stage-configs-path "$CONFIG_PATH" \
    --host 0.0.0.0 \
    --port 8000 \
    --gpu-memory-utilization 0.3 \
    --trust-remote-code \
    --enforce-eager \
    --omni &

echo "Starting Qwen3-TTS Base server on port 8001..."
vllm-omni serve "$MODEL_DIR/Qwen3-TTS-Base" \
    --stage-configs-path "$CONFIG_PATH" \
    --host 0.0.0.0 \
    --port 8001 \
    --gpu-memory-utilization 0.6 \
    --trust-remote-code \
    --enforce-eager \
    --omni &

wait