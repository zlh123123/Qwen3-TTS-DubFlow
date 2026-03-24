from __future__ import annotations

import os
import threading
from typing import Literal

import torch
from fastapi import FastAPI, HTTPException, Response
from pydantic import BaseModel, Field
from qwen_tts import Qwen3TTSModel

from services.audio_utils import wav_bytes_to_base64, wav_to_bytes


def _parse_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


def _parse_dtype(value: str) -> torch.dtype:
    normalized = value.strip().lower()
    if normalized in {"bf16", "bfloat16"}:
        return torch.bfloat16
    if normalized in {"fp16", "float16", "half"}:
        return torch.float16
    if normalized in {"fp32", "float32"}:
        return torch.float32
    raise ValueError(f"Unsupported QWEN_DTYPE: {value}")


class VoiceDesignRequest(BaseModel):
    text: str = Field(..., min_length=1)
    instruct: str = Field(..., min_length=1)
    language: str = "Auto"
    non_streaming_mode: bool = True

    do_sample: bool | None = None
    top_k: int | None = None
    top_p: float | None = None
    temperature: float | None = None
    repetition_penalty: float | None = None
    subtalker_dosample: bool | None = None
    subtalker_top_k: int | None = None
    subtalker_top_p: float | None = None
    subtalker_temperature: float | None = None
    max_new_tokens: int | None = None

    response_format: Literal["base64", "wav"] = "base64"


class AudioResponse(BaseModel):
    sample_rate: int
    audio_base64: str
    mime_type: str = "audio/wav"


MODEL_NAME = os.getenv("QWEN_VOICE_DESIGN_MODEL", "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign")
DEVICE = os.getenv("QWEN_DEVICE", "cuda:0" if torch.cuda.is_available() else "cpu")
DEFAULT_DTYPE = "float32" if DEVICE.startswith("cpu") else "bfloat16"
DTYPE = _parse_dtype(os.getenv("QWEN_DTYPE", DEFAULT_DTYPE))
ATTN_IMPLEMENTATION = os.getenv("QWEN_ATTN_IMPLEMENTATION", "").strip()
MODEL_LOCAL_FILES_ONLY = _parse_bool(os.getenv("QWEN_MODEL_LOCAL_FILES_ONLY"), default=False)

app = FastAPI(title="Qwen3-TTS VoiceDesign API", version="1.0.0")
_model_lock = threading.Lock()
_model: Qwen3TTSModel | None = None


@app.on_event("startup")
def _startup() -> None:
    global _model

    kwargs: dict[str, object] = {
        "device_map": DEVICE,
        "dtype": DTYPE,
        "local_files_only": MODEL_LOCAL_FILES_ONLY,
    }
    if ATTN_IMPLEMENTATION:
        kwargs["attn_implementation"] = ATTN_IMPLEMENTATION

    _model = Qwen3TTSModel.from_pretrained(MODEL_NAME, **kwargs)


@app.get("/v1/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "qwen-voice-design",
        "model": MODEL_NAME,
        "device": DEVICE,
    }


@app.post("/v1/voice-design", response_model=AudioResponse)
def generate_voice_design(request: VoiceDesignRequest):
    if _model is None:
        raise HTTPException(status_code=503, detail="Model not initialized yet")

    gen_kwargs = {
        "do_sample": request.do_sample,
        "top_k": request.top_k,
        "top_p": request.top_p,
        "temperature": request.temperature,
        "repetition_penalty": request.repetition_penalty,
        "subtalker_dosample": request.subtalker_dosample,
        "subtalker_top_k": request.subtalker_top_k,
        "subtalker_top_p": request.subtalker_top_p,
        "subtalker_temperature": request.subtalker_temperature,
        "max_new_tokens": request.max_new_tokens,
    }
    gen_kwargs = {k: v for k, v in gen_kwargs.items() if v is not None}

    try:
        with _model_lock:
            wavs, sr = _model.generate_voice_design(
                text=request.text,
                instruct=request.instruct,
                language=request.language,
                non_streaming_mode=request.non_streaming_mode,
                **gen_kwargs,
            )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Voice design failed: {exc}") from exc

    audio_bytes = wav_to_bytes(wavs[0], sr)
    if request.response_format == "wav":
        return Response(content=audio_bytes, media_type="audio/wav")

    return AudioResponse(sample_rate=sr, audio_base64=wav_bytes_to_base64(audio_bytes))
