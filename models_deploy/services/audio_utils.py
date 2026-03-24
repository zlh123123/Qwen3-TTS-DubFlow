from __future__ import annotations

import base64
import io

import numpy as np
import soundfile as sf


def wav_to_bytes(wav: np.ndarray, sample_rate: int) -> bytes:
    audio = np.asarray(wav, dtype=np.float32)
    if audio.ndim > 1:
        audio = np.squeeze(audio)

    with io.BytesIO() as buffer:
        sf.write(buffer, audio, sample_rate, format="WAV")
        return buffer.getvalue()


def wav_bytes_to_base64(audio_bytes: bytes) -> str:
    return base64.b64encode(audio_bytes).decode("ascii")
