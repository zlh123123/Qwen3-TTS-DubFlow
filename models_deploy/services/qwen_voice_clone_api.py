from __future__ import annotations

import os
import threading
from pathlib import Path
from typing import Literal

import torch
from fastapi import FastAPI, HTTPException, Response
from pydantic import BaseModel, Field, model_validator
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


class VoiceCloneRequest(BaseModel):
    text: str = Field(..., min_length=1)
    language: str = "Auto"

    ref_text: str | None = None
    ref_audio_base64: str | None = None
    ref_audio_url: str | None = None
    ref_audio_path: str | None = None

    x_vector_only_mode: bool = False
    non_streaming_mode: bool = False

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

    @model_validator(mode="after")
    def validate_inputs(self) -> "VoiceCloneRequest":
        has_ref_audio = any(
            [self.ref_audio_base64, self.ref_audio_url, self.ref_audio_path]
        )
        if not has_ref_audio:
            raise ValueError("One of ref_audio_base64 / ref_audio_url / ref_audio_path is required")

        if not self.x_vector_only_mode and not self.ref_text:
            raise ValueError("ref_text is required when x_vector_only_mode is false")

        return self


class AudioResponse(BaseModel):
    sample_rate: int
    audio_base64: str
    mime_type: str = "audio/wav"


MODEL_NAME = os.getenv("QWEN_VOICE_CLONE_MODEL", "Qwen/Qwen3-TTS-12Hz-1.7B-Base")
DEVICE = os.getenv("QWEN_DEVICE", "cuda:0" if torch.cuda.is_available() else "cpu")
DEFAULT_DTYPE = "float32" if DEVICE.startswith("cpu") else "bfloat16"
DTYPE = _parse_dtype(os.getenv("QWEN_DTYPE", DEFAULT_DTYPE))
ATTN_IMPLEMENTATION = os.getenv("QWEN_ATTN_IMPLEMENTATION", "").strip()
MODEL_LOCAL_FILES_ONLY = _parse_bool(os.getenv("QWEN_MODEL_LOCAL_FILES_ONLY"), default=False)

app = FastAPI(title="Qwen3-TTS VoiceClone API", version="1.0.0")
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
        "service": "qwen-voice-clone",
        "model": MODEL_NAME,
        "device": DEVICE,
    }


def _pick_ref_audio(request: VoiceCloneRequest) -> str:
    if request.ref_audio_base64:
        b64 = request.ref_audio_base64.strip()
        if b64.startswith("data:audio"):
            return b64
        return f"data:audio/wav;base64,{b64}"

    if request.ref_audio_url:
        return request.ref_audio_url.strip()

    assert request.ref_audio_path is not None
    ref_audio_path = Path(request.ref_audio_path).expanduser().resolve()
    if not ref_audio_path.exists():
        raise HTTPException(status_code=400, detail=f"ref_audio_path not found: {ref_audio_path}")
    return str(ref_audio_path)


@app.post("/v1/voice-clone", response_model=AudioResponse)
def generate_voice_clone(request: VoiceCloneRequest):
    if _model is None:
        raise HTTPException(status_code=503, detail="Model not initialized yet")

    ref_audio = _pick_ref_audio(request)

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
            wavs, sr = _model.generate_voice_clone(
                text=request.text,
                language=request.language,
                ref_audio=ref_audio,
                ref_text=request.ref_text,
                x_vector_only_mode=request.x_vector_only_mode,
                non_streaming_mode=request.non_streaming_mode,
                **gen_kwargs,
            )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Voice clone failed: {exc}") from exc

    audio_bytes = wav_to_bytes(wavs[0], sr)
    if request.response_format == "wav":
        return Response(content=audio_bytes, media_type="audio/wav")

    return AudioResponse(sample_rate=sr, audio_base64=wav_bytes_to_base64(audio_bytes))
