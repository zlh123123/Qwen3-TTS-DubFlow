from __future__ import annotations

import os
import threading
from copy import deepcopy
from pathlib import Path
from typing import Literal

import torch
from fastapi import FastAPI, HTTPException, Response
from huggingface_hub import snapshot_download
from pydantic import BaseModel, Field

from meanaudio.eval_utils import all_model_cfg
from meanaudio.eval_utils import generate_fm, generate_mf
from meanaudio.model.flow_matching import FlowMatching
from meanaudio.model.mean_flow import MeanFlow
from meanaudio.model.networks import get_mean_audio
from meanaudio.model.utils.features_utils import FeaturesUtils
from services.audio_utils import wav_bytes_to_base64, wav_to_bytes

PROJECT_ROOT = (Path(__file__).resolve().parents[1] / "MeanAudio").resolve()
os.chdir(PROJECT_ROOT)


def _parse_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


class MeanAudioRequest(BaseModel):
    prompt: str = Field(..., min_length=1)
    negative_prompt: str = ""
    duration: float = Field(default=10.0, gt=0, le=30)
    num_steps: int = Field(default=1, ge=1, le=100)
    seed: int = 42
    cfg_strength: float = Field(default=4.5, ge=0)
    use_meanflow: bool | None = None
    response_format: Literal["base64", "wav"] = "base64"


class AudioResponse(BaseModel):
    sample_rate: int
    audio_base64: str
    mime_type: str = "audio/wav"


class MeanAudioService:
    def __init__(self) -> None:
        self.variant = os.getenv("MEANAUDIO_VARIANT", "meanaudio_s")
        self.encoder_name = os.getenv("MEANAUDIO_ENCODER", "t5_clap")
        self.use_rope = _parse_bool(os.getenv("MEANAUDIO_USE_ROPE"), default=True)
        self.text_c_dim = int(os.getenv("MEANAUDIO_TEXT_C_DIM", "512"))
        self.auto_download = _parse_bool(os.getenv("MEANAUDIO_AUTO_DOWNLOAD"), default=True)
        self.hf_repo = os.getenv("MEANAUDIO_HF_REPO", "AndreasXi/MeanAudio")

        device_from_env = os.getenv("MEANAUDIO_DEVICE")
        if device_from_env:
            self.device = device_from_env
        else:
            self.device = "cuda" if torch.cuda.is_available() else "cpu"

        self.full_precision = _parse_bool(os.getenv("MEANAUDIO_FULL_PRECISION"), default=False)
        self.dtype = torch.float32 if self.full_precision or self.device == "cpu" else torch.bfloat16

        if self.variant not in all_model_cfg:
            raise ValueError(f"Unsupported variant: {self.variant}. Available: {list(all_model_cfg.keys())}")
        self.model_cfg = all_model_cfg[self.variant]

        self._ensure_weights()
        self._load_model()

    def _ensure_weights(self) -> None:
        required = [
            PROJECT_ROOT / self.model_cfg.model_path,
            PROJECT_ROOT / self.model_cfg.vae_path,
            PROJECT_ROOT / self.model_cfg.bigvgan_16k_path,
            PROJECT_ROOT / "weights/music_speech_audioset_epoch_15_esc_89.98.pt",
        ]
        missing = [p for p in required if not p.exists()]

        if not missing:
            return

        if not self.auto_download:
            missing_msg = "\n".join(str(p) for p in missing)
            raise FileNotFoundError(
                "MeanAudio required weights are missing and auto download is disabled:\n"
                + missing_msg
            )

        weights_dir = PROJECT_ROOT / "weights"
        weights_dir.mkdir(parents=True, exist_ok=True)
        snapshot_download(repo_id=self.hf_repo, local_dir=str(weights_dir))

        missing_after = [p for p in required if not p.exists()]
        if missing_after:
            missing_msg = "\n".join(str(p) for p in missing_after)
            raise FileNotFoundError(f"Failed to prepare MeanAudio weights:\n{missing_msg}")

    def _load_model(self) -> None:
        self.net = get_mean_audio(
            self.model_cfg.model_name,
            use_rope=self.use_rope,
            text_c_dim=self.text_c_dim,
        ).to(self.device, self.dtype).eval()

        weights_path = PROJECT_ROOT / self.model_cfg.model_path
        self.net.load_weights(torch.load(weights_path, map_location=self.device, weights_only=True))

        self.feature_utils = FeaturesUtils(
            tod_vae_ckpt=str(PROJECT_ROOT / self.model_cfg.vae_path),
            enable_conditions=True,
            encoder_name=self.encoder_name,
            mode=self.model_cfg.mode,
            bigvgan_vocoder_ckpt=str(PROJECT_ROOT / self.model_cfg.bigvgan_16k_path),
            need_vae_encoder=False,
        ).to(self.device, self.dtype).eval()

    @torch.inference_mode()
    def synthesize(self, request: MeanAudioRequest) -> tuple[bytes, int]:
        seq_cfg = deepcopy(self.model_cfg.seq_cfg)
        seq_cfg.duration = request.duration
        self.net.update_seq_lengths(seq_cfg.latent_seq_len)

        rng = torch.Generator(device=self.device)
        rng.manual_seed(request.seed)

        use_meanflow = request.use_meanflow
        if use_meanflow is None:
            use_meanflow = self.variant in {"meanaudio_s", "meanaudio_l"}

        if use_meanflow:
            solver = MeanFlow(steps=request.num_steps)
            audio_tensor = generate_mf(
                [request.prompt],
                negative_text=[request.negative_prompt],
                feature_utils=self.feature_utils,
                net=self.net,
                mf=solver,
                rng=rng,
                cfg_strength=0.0,
            )
        else:
            solver = FlowMatching(min_sigma=0, inference_mode="euler", num_steps=request.num_steps)
            audio_tensor = generate_fm(
                [request.prompt],
                negative_text=[request.negative_prompt],
                feature_utils=self.feature_utils,
                net=self.net,
                fm=solver,
                rng=rng,
                cfg_strength=request.cfg_strength,
            )

        audio = audio_tensor.float().cpu()[0].numpy()
        audio_bytes = wav_to_bytes(audio, seq_cfg.sampling_rate)
        return audio_bytes, seq_cfg.sampling_rate


app = FastAPI(title="MeanAudio API", version="1.0.0")
_service_lock = threading.Lock()
_service: MeanAudioService | None = None


@app.on_event("startup")
def _startup() -> None:
    global _service
    _service = MeanAudioService()


@app.get("/v1/health")
def health() -> dict[str, str]:
    if _service is None:
        raise HTTPException(status_code=503, detail="Service not initialized yet")
    return {
        "status": "ok",
        "service": "meanaudio",
        "variant": _service.variant,
        "device": _service.device,
    }


@app.post("/v1/sound", response_model=AudioResponse)
def generate_sound(request: MeanAudioRequest):
    if _service is None:
        raise HTTPException(status_code=503, detail="Service not initialized yet")

    try:
        with _service_lock:
            audio_bytes, sample_rate = _service.synthesize(request)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"MeanAudio generation failed: {exc}") from exc

    if request.response_format == "wav":
        return Response(content=audio_bytes, media_type="audio/wav")

    return AudioResponse(sample_rate=sample_rate, audio_base64=wav_bytes_to_base64(audio_bytes))
