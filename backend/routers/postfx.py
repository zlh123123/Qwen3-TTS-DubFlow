import copy
import os
import re
import uuid
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import (
    get_db,
    Project,
    Character,
    PostFxPreset,
    CharacterPostFxDefault,
)
from schemas.postfx import (
    PostFxPresetCreate,
    PostFxPresetUpdate,
    PostFxPresetResponse,
    PostFxPreviewRequest,
    PostFxApplyRequest,
    PostFxProcessResponse,
    CharacterDefaultPresetUpdate,
    CharacterDefaultPresetResponse,
)


router = APIRouter(prefix="/api/postfx", tags=["PostFX"])


def _default_effect_config() -> Dict[str, Any]:
    return {
        "pitch_shift_semitones": 0.0,
        "gain_db": 0.0,
        "highpass_hz": 20.0,
        "lowpass_hz": 20000.0,
        "reverb": {
            "enabled": False,
            "room_size": 0.35,
            "damping": 0.45,
            "wet_level": 0.2,
            "dry_level": 0.9,
        },
        "delay": {
            "enabled": False,
            "delay_seconds": 0.25,
            "feedback": 0.2,
            "mix": 0.2,
        },
        "modulation": {
            "enabled": False,
            "mode": "chorus",  # chorus/flanger
            "rate_hz": 1.2,
            "depth": 0.25,
            "centre_delay_ms": 8.0,
            "feedback": 0.2,
            "mix": 0.25,
        },
        "compressor": {
            "enabled": False,
            "threshold_db": -18.0,
            "ratio": 3.0,
            "attack_ms": 5.0,
            "release_ms": 120.0,
        },
    }


BUILTIN_PRESETS: List[Dict[str, Any]] = [
    {
        "preset_key": "builtin_robot",
        "name": "机器人",
        "config": {
            "pitch_shift_semitones": 6.0,
            "gain_db": -2.0,
            "highpass_hz": 160.0,
            "lowpass_hz": 6500.0,
            "reverb": {"enabled": True, "room_size": 0.22, "damping": 0.65, "wet_level": 0.12, "dry_level": 0.95},
            "delay": {"enabled": False, "delay_seconds": 0.14, "feedback": 0.18, "mix": 0.12},
            "modulation": {"enabled": True, "mode": "flanger", "rate_hz": 0.7, "depth": 0.7, "centre_delay_ms": 2.2, "feedback": 0.62, "mix": 0.42},
            "compressor": {"enabled": True, "threshold_db": -22.0, "ratio": 6.0, "attack_ms": 3.0, "release_ms": 110.0},
        },
    },
    {
        "preset_key": "builtin_broadcast",
        "name": "广播",
        "config": {
            "pitch_shift_semitones": 0.0,
            "gain_db": 3.0,
            "highpass_hz": 120.0,
            "lowpass_hz": 9000.0,
            "reverb": {"enabled": False, "room_size": 0.2, "damping": 0.6, "wet_level": 0.08, "dry_level": 1.0},
            "delay": {"enabled": False, "delay_seconds": 0.18, "feedback": 0.12, "mix": 0.1},
            "modulation": {"enabled": False, "mode": "chorus", "rate_hz": 0.9, "depth": 0.16, "centre_delay_ms": 6.0, "feedback": 0.15, "mix": 0.12},
            "compressor": {"enabled": True, "threshold_db": -25.0, "ratio": 5.5, "attack_ms": 1.8, "release_ms": 90.0},
        },
    },
    {
        "preset_key": "builtin_echo_chamber",
        "name": "回声室",
        "config": {
            "pitch_shift_semitones": 0.0,
            "gain_db": 0.0,
            "highpass_hz": 70.0,
            "lowpass_hz": 14000.0,
            "reverb": {"enabled": True, "room_size": 0.72, "damping": 0.35, "wet_level": 0.38, "dry_level": 0.82},
            "delay": {"enabled": True, "delay_seconds": 0.34, "feedback": 0.36, "mix": 0.38},
            "modulation": {"enabled": False, "mode": "chorus", "rate_hz": 1.1, "depth": 0.2, "centre_delay_ms": 8.0, "feedback": 0.2, "mix": 0.18},
            "compressor": {"enabled": True, "threshold_db": -20.0, "ratio": 2.8, "attack_ms": 6.0, "release_ms": 140.0},
        },
    },
    {
        "preset_key": "builtin_deep_voice",
        "name": "低沉声音",
        "config": {
            "pitch_shift_semitones": -4.0,
            "gain_db": 1.5,
            "highpass_hz": 45.0,
            "lowpass_hz": 11500.0,
            "reverb": {"enabled": True, "room_size": 0.28, "damping": 0.55, "wet_level": 0.14, "dry_level": 0.95},
            "delay": {"enabled": False, "delay_seconds": 0.22, "feedback": 0.12, "mix": 0.1},
            "modulation": {"enabled": True, "mode": "chorus", "rate_hz": 0.42, "depth": 0.18, "centre_delay_ms": 12.0, "feedback": 0.12, "mix": 0.14},
            "compressor": {"enabled": True, "threshold_db": -20.0, "ratio": 3.5, "attack_ms": 4.0, "release_ms": 130.0},
        },
    },
]


def _deep_merge(base: Dict[str, Any], patch: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not patch:
        return copy.deepcopy(base)
    merged = copy.deepcopy(base)
    for key, value in patch.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


def _clampf(value: Any, low: float, high: float, default: float) -> float:
    try:
        num = float(value)
    except (TypeError, ValueError):
        num = default
    return max(low, min(high, num))


def _normalize_effect_config(config: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    merged = _deep_merge(_default_effect_config(), config or {})
    return {
        "pitch_shift_semitones": _clampf(merged.get("pitch_shift_semitones"), -12.0, 12.0, 0.0),
        "gain_db": _clampf(merged.get("gain_db"), -40.0, 40.0, 0.0),
        "highpass_hz": _clampf(merged.get("highpass_hz"), 20.0, 18000.0, 20.0),
        "lowpass_hz": _clampf(merged.get("lowpass_hz"), 200.0, 22000.0, 20000.0),
        "reverb": {
            "enabled": bool(merged.get("reverb", {}).get("enabled", False)),
            "room_size": _clampf(merged.get("reverb", {}).get("room_size"), 0.0, 1.0, 0.35),
            "damping": _clampf(merged.get("reverb", {}).get("damping"), 0.0, 1.0, 0.45),
            "wet_level": _clampf(merged.get("reverb", {}).get("wet_level"), 0.0, 1.0, 0.2),
            "dry_level": _clampf(merged.get("reverb", {}).get("dry_level"), 0.0, 1.0, 0.9),
        },
        "delay": {
            "enabled": bool(merged.get("delay", {}).get("enabled", False)),
            "delay_seconds": _clampf(merged.get("delay", {}).get("delay_seconds"), 0.01, 2.0, 0.25),
            "feedback": _clampf(merged.get("delay", {}).get("feedback"), 0.0, 0.95, 0.2),
            "mix": _clampf(merged.get("delay", {}).get("mix"), 0.0, 1.0, 0.2),
        },
        "modulation": {
            "enabled": bool(merged.get("modulation", {}).get("enabled", False)),
            "mode": "flanger"
            if str(merged.get("modulation", {}).get("mode", "chorus")).lower() == "flanger"
            else "chorus",
            "rate_hz": _clampf(merged.get("modulation", {}).get("rate_hz"), 0.05, 10.0, 1.2),
            "depth": _clampf(merged.get("modulation", {}).get("depth"), 0.0, 1.0, 0.25),
            "centre_delay_ms": _clampf(merged.get("modulation", {}).get("centre_delay_ms"), 0.1, 30.0, 8.0),
            "feedback": _clampf(merged.get("modulation", {}).get("feedback"), -0.95, 0.95, 0.2),
            "mix": _clampf(merged.get("modulation", {}).get("mix"), 0.0, 1.0, 0.25),
        },
        "compressor": {
            "enabled": bool(merged.get("compressor", {}).get("enabled", False)),
            "threshold_db": _clampf(merged.get("compressor", {}).get("threshold_db"), -80.0, 0.0, -18.0),
            "ratio": _clampf(merged.get("compressor", {}).get("ratio"), 1.0, 20.0, 3.0),
            "attack_ms": _clampf(merged.get("compressor", {}).get("attack_ms"), 0.1, 200.0, 5.0),
            "release_ms": _clampf(merged.get("compressor", {}).get("release_ms"), 5.0, 3000.0, 120.0),
        },
    }


def _slugify(value: str) -> str:
    text = re.sub(r"[^a-zA-Z0-9]+", "_", value.strip().lower()).strip("_")
    return text or "custom"


def _ensure_builtin_presets(db: Session):
    existing = {row.preset_key: row for row in db.query(PostFxPreset).all()}
    changed = False
    for item in BUILTIN_PRESETS:
        key = item["preset_key"]
        normalized = _normalize_effect_config(item["config"])
        row = existing.get(key)
        if row is None:
            db.add(
                PostFxPreset(
                    id=str(uuid.uuid4()),
                    preset_key=key,
                    name=item["name"],
                    is_builtin=True,
                    config=normalized,
                )
            )
            changed = True
            continue
        if (
            row.name != item["name"]
            or row.is_builtin is False
            or row.config != normalized
        ):
            row.name = item["name"]
            row.is_builtin = True
            row.config = normalized
            changed = True
    if changed:
        db.commit()


def _assert_project(project_id: str, db: Session) -> Project:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _assert_character(character_id: str, db: Session) -> Character:
    char = db.query(Character).filter(Character.id == character_id).first()
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    return char


def _resolve_source_path(source_path: str) -> str:
    raw = (source_path or "").strip()
    if not raw:
        raise HTTPException(status_code=400, detail="source_path is required")
    if raw.startswith("/static/"):
        disk_path = raw.replace("/static/", "storage/", 1)
    elif raw.startswith("file://"):
        disk_path = raw[7:]
    elif os.path.isabs(raw):
        disk_path = raw
    else:
        disk_path = os.path.abspath(raw)
    if not os.path.isfile(disk_path):
        raise HTTPException(status_code=404, detail=f"Source audio not found: {source_path}")
    return disk_path


def _require_pedalboard():
    try:
        from pedalboard import (
            Pedalboard,
            PitchShift,
            Reverb,
            Delay,
            Chorus,
            Compressor,
            Gain,
            HighpassFilter,
            LowpassFilter,
        )
        from pedalboard.io import AudioFile
    except ImportError as exc:
        raise HTTPException(
            status_code=503,
            detail="pedalboard not installed. Please run: cd backend && uv sync",
        ) from exc

    return {
        "Pedalboard": Pedalboard,
        "PitchShift": PitchShift,
        "Reverb": Reverb,
        "Delay": Delay,
        "Chorus": Chorus,
        "Compressor": Compressor,
        "Gain": Gain,
        "HighpassFilter": HighpassFilter,
        "LowpassFilter": LowpassFilter,
        "AudioFile": AudioFile,
    }


def _build_board(config: Dict[str, Any]):
    pb = _require_pedalboard()
    cfg = _normalize_effect_config(config)
    plugins = []

    if abs(cfg["pitch_shift_semitones"]) > 1e-4:
        plugins.append(pb["PitchShift"](semitones=cfg["pitch_shift_semitones"]))

    if cfg["reverb"]["enabled"]:
        plugins.append(
            pb["Reverb"](
                room_size=cfg["reverb"]["room_size"],
                damping=cfg["reverb"]["damping"],
                wet_level=cfg["reverb"]["wet_level"],
                dry_level=cfg["reverb"]["dry_level"],
            )
        )

    if cfg["delay"]["enabled"]:
        plugins.append(
            pb["Delay"](
                delay_seconds=cfg["delay"]["delay_seconds"],
                feedback=cfg["delay"]["feedback"],
                mix=cfg["delay"]["mix"],
            )
        )

    if cfg["modulation"]["enabled"]:
        # pedalboard 使用 Chorus 实现 chorus/flanger，两者通过参数区间区分
        centre_delay_ms = cfg["modulation"]["centre_delay_ms"]
        if cfg["modulation"]["mode"] == "flanger":
            centre_delay_ms = min(centre_delay_ms, 3.5)
        plugins.append(
            pb["Chorus"](
                rate_hz=cfg["modulation"]["rate_hz"],
                depth=cfg["modulation"]["depth"],
                centre_delay_ms=centre_delay_ms,
                feedback=cfg["modulation"]["feedback"],
                mix=cfg["modulation"]["mix"],
            )
        )

    if cfg["compressor"]["enabled"]:
        plugins.append(
            pb["Compressor"](
                threshold_db=cfg["compressor"]["threshold_db"],
                ratio=cfg["compressor"]["ratio"],
                attack_ms=cfg["compressor"]["attack_ms"],
                release_ms=cfg["compressor"]["release_ms"],
            )
        )

    if abs(cfg["gain_db"]) > 1e-4:
        plugins.append(pb["Gain"](gain_db=cfg["gain_db"]))

    if cfg["highpass_hz"] > 20.1:
        plugins.append(pb["HighpassFilter"](cutoff_frequency_hz=cfg["highpass_hz"]))

    if cfg["lowpass_hz"] < 19999.0:
        plugins.append(pb["LowpassFilter"](cutoff_frequency_hz=cfg["lowpass_hz"]))

    return pb["Pedalboard"](plugins), cfg


def _process_audio_with_config(source_disk: str, output_disk: str, config: Dict[str, Any]):
    pb = _require_pedalboard()
    board, _ = _build_board(config)
    os.makedirs(os.path.dirname(output_disk), exist_ok=True)

    with pb["AudioFile"](source_disk) as src:
        audio = src.read(src.frames)
        samplerate = src.samplerate
        channels = src.num_channels
    effected = board(audio, samplerate, reset=True)
    with pb["AudioFile"](output_disk, "w", samplerate, channels) as dst:
        dst.write(effected)


def _fetch_preset_config(db: Session, preset_id: Optional[str]) -> Tuple[Optional[str], Dict[str, Any]]:
    if not preset_id:
        return None, _default_effect_config()
    preset = db.query(PostFxPreset).filter(PostFxPreset.id == preset_id).first()
    if not preset:
        raise HTTPException(status_code=404, detail="Preset not found")
    return preset.id, _normalize_effect_config(preset.config)


def _serialize_char_default(character: Character, preset: Optional[PostFxPreset]) -> CharacterDefaultPresetResponse:
    return CharacterDefaultPresetResponse(
        character_id=character.id,
        character_name=character.name,
        preset_id=preset.id if preset else None,
        preset_name=preset.name if preset else None,
    )


@router.get("/presets", response_model=List[PostFxPresetResponse])
def list_presets(db: Session = Depends(get_db)):
    _ensure_builtin_presets(db)
    rows = db.query(PostFxPreset).order_by(PostFxPreset.is_builtin.desc(), PostFxPreset.name.asc()).all()
    return rows


@router.post("/presets", response_model=PostFxPresetResponse)
def create_custom_preset(payload: PostFxPresetCreate, db: Session = Depends(get_db)):
    _ensure_builtin_presets(db)
    key_base = f"custom_{_slugify(payload.name)}"
    preset_key = key_base
    index = 2
    while db.query(PostFxPreset).filter(PostFxPreset.preset_key == preset_key).first():
        preset_key = f"{key_base}_{index}"
        index += 1

    row = PostFxPreset(
        id=str(uuid.uuid4()),
        preset_key=preset_key,
        name=payload.name.strip(),
        is_builtin=False,
        config=_normalize_effect_config(payload.config),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.put("/presets/{preset_id}", response_model=PostFxPresetResponse)
def update_preset(preset_id: str, payload: PostFxPresetUpdate, db: Session = Depends(get_db)):
    _ensure_builtin_presets(db)
    row = db.query(PostFxPreset).filter(PostFxPreset.id == preset_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Preset not found")
    if row.is_builtin:
        raise HTTPException(status_code=400, detail="Builtin presets are read-only")

    updates = payload.model_dump(exclude_unset=True)
    if "name" in updates:
        row.name = (updates["name"] or "").strip() or row.name
    if "config" in updates:
        row.config = _normalize_effect_config(updates["config"])
    db.commit()
    db.refresh(row)
    return row


@router.delete("/presets/{preset_id}")
def delete_preset(preset_id: str, db: Session = Depends(get_db)):
    _ensure_builtin_presets(db)
    row = db.query(PostFxPreset).filter(PostFxPreset.id == preset_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Preset not found")
    if row.is_builtin:
        raise HTTPException(status_code=400, detail="Builtin presets cannot be deleted")
    db.delete(row)
    db.commit()
    return {"message": "Preset deleted"}


@router.get("/projects/{project_id}/character-defaults", response_model=List[CharacterDefaultPresetResponse])
def list_character_defaults(project_id: str, db: Session = Depends(get_db)):
    _ensure_builtin_presets(db)
    _assert_project(project_id, db)
    characters = db.query(Character).filter(Character.project_id == project_id).order_by(Character.name.asc()).all()
    if not characters:
        return []

    defaults = (
        db.query(CharacterPostFxDefault)
        .filter(CharacterPostFxDefault.character_id.in_([c.id for c in characters]))
        .all()
    )
    preset_ids = [d.preset_id for d in defaults if d.preset_id]
    preset_map = {}
    if preset_ids:
        rows = db.query(PostFxPreset).filter(PostFxPreset.id.in_(preset_ids)).all()
        preset_map = {row.id: row for row in rows}
    default_map = {item.character_id: item for item in defaults}

    return [
        _serialize_char_default(
            c,
            preset_map.get(default_map[c.id].preset_id) if c.id in default_map and default_map[c.id].preset_id else None,
        )
        for c in characters
    ]


@router.put("/characters/{character_id}/default", response_model=CharacterDefaultPresetResponse)
def set_character_default_preset(
    character_id: str,
    payload: CharacterDefaultPresetUpdate,
    db: Session = Depends(get_db),
):
    _ensure_builtin_presets(db)
    char = _assert_character(character_id, db)

    preset = None
    if payload.preset_id:
        preset = db.query(PostFxPreset).filter(PostFxPreset.id == payload.preset_id).first()
        if not preset:
            raise HTTPException(status_code=404, detail="Preset not found")

    current = (
        db.query(CharacterPostFxDefault)
        .filter(CharacterPostFxDefault.character_id == character_id)
        .first()
    )
    if payload.preset_id is None:
        if current:
            db.delete(current)
            db.commit()
        return _serialize_char_default(char, None)

    if current is None:
        current = CharacterPostFxDefault(
            id=str(uuid.uuid4()),
            character_id=character_id,
            preset_id=preset.id,
        )
        db.add(current)
    else:
        current.preset_id = preset.id
    db.commit()
    return _serialize_char_default(char, preset)


@router.post("/preview", response_model=PostFxProcessResponse)
def preview_postfx(payload: PostFxPreviewRequest, db: Session = Depends(get_db)):
    _ensure_builtin_presets(db)
    source_disk = _resolve_source_path(payload.source_path)
    preset_id, base_config = _fetch_preset_config(db, payload.preset_id)
    merged_config = _normalize_effect_config(_deep_merge(base_config, payload.config_override or {}))

    output_name = f"{uuid.uuid4()}.wav"
    output_disk = os.path.join("storage", "temp", "postfx", output_name)
    _process_audio_with_config(source_disk, output_disk, merged_config)

    return PostFxProcessResponse(
        output_path=output_disk,
        output_url=f"/static/temp/postfx/{output_name}",
        preset_id=preset_id,
    )


@router.post("/apply", response_model=PostFxProcessResponse)
def apply_postfx(payload: PostFxApplyRequest, db: Session = Depends(get_db)):
    _ensure_builtin_presets(db)
    _assert_project(payload.project_id, db)
    source_disk = _resolve_source_path(payload.source_path)
    preset_id, base_config = _fetch_preset_config(db, payload.preset_id)
    merged_config = _normalize_effect_config(_deep_merge(base_config, payload.config_override or {}))

    safe_name = (payload.output_name or "").strip()
    if not safe_name:
        safe_name = f"{uuid.uuid4()}.wav"
    if not safe_name.lower().endswith(".wav"):
        safe_name = f"{safe_name}.wav"
    safe_name = os.path.basename(safe_name)

    output_rel = os.path.join("projects", payload.project_id, "postfx", safe_name)
    output_disk = os.path.join("storage", output_rel)
    _process_audio_with_config(source_disk, output_disk, merged_config)

    return PostFxProcessResponse(
        output_path=output_disk,
        output_url=f"/static/{output_rel.replace(os.sep, '/')}",
        preset_id=preset_id,
    )
