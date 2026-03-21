from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import os
import shutil
import uuid

from database import (
    get_db,
    Project,
    Character,
    CharacterRefAsset,
    EffectAsset,
    BgmAsset,
)
from schemas.character_ref_asset import (
    CharacterRefImportRequest,
    CharacterRefUpdate,
    CharacterRefResponse,
)
from schemas.effect_asset import (
    EffectAssetImportRequest,
    EffectAssetUpdate,
    EffectAssetResponse,
)
from schemas.bgm_asset import (
    BgmAssetImportRequest,
    BgmAssetUpdate,
    BgmAssetResponse,
)


router = APIRouter(prefix="/api", tags=["Assets"])


def _assert_project(project_id: str, db: Session) -> Project:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _assert_character(project_id: str, character_id: str, db: Session) -> Character:
    char = db.query(Character).filter(Character.id == character_id).first()
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    if char.project_id != project_id:
        raise HTTPException(status_code=400, detail="Character does not belong to this project")
    return char


def _prepare_asset_file(project_id: str, source_path: str, bucket: str, copy_to_project: bool):
    src = os.path.abspath(source_path)
    if not os.path.isfile(src):
        raise HTTPException(status_code=400, detail="source_path does not exist or is not a file")

    basename = os.path.basename(src)
    ext = os.path.splitext(basename)[1].lower()

    if copy_to_project:
        target_dir = os.path.join("storage", "projects", project_id, "assets", bucket)
        os.makedirs(target_dir, exist_ok=True)
        target_name = f"{uuid.uuid4()}{ext}"
        target_path = os.path.join(target_dir, target_name)
        shutil.copy2(src, target_path)
        stored_path = f"/static/projects/{project_id}/assets/{bucket}/{target_name}"
        managed_file = True
    else:
        stored_path = src
        managed_file = False

    return {
        "stored_path": stored_path,
        "managed_file": managed_file,
        "file_format": ext.lstrip(".") if ext else None,
        "file_size": os.path.getsize(src),
        "basename": basename,
    }


def _cleanup_managed_file(file_path: str, managed_file: bool):
    if not managed_file:
        return
    if isinstance(file_path, str) and file_path.startswith("/static/"):
        disk_path = file_path.replace("/static/", "storage/", 1)
        if os.path.exists(disk_path):
            os.remove(disk_path)


@router.get("/projects/{project_id}/character-refs", response_model=List[CharacterRefResponse])
def list_character_refs(project_id: str, db: Session = Depends(get_db)):
    _assert_project(project_id, db)
    return (
        db.query(CharacterRefAsset)
        .filter(CharacterRefAsset.project_id == project_id)
        .order_by(CharacterRefAsset.created_at.desc())
        .all()
    )


@router.post("/projects/{project_id}/character-refs/import", response_model=CharacterRefResponse)
def import_character_ref(project_id: str, req: CharacterRefImportRequest, db: Session = Depends(get_db)):
    _assert_project(project_id, db)
    char = _assert_character(project_id, req.character_id, db)

    file_meta = _prepare_asset_file(project_id, req.source_path, "character_refs", req.copy_to_project)
    display_name = req.display_name or os.path.splitext(file_meta["basename"])[0]

    asset = CharacterRefAsset(
        project_id=project_id,
        character_id=char.id,
        source_type=req.source_type,
        display_name=display_name,
        file_path=file_meta["stored_path"],
        file_format=file_meta["file_format"],
        file_size=file_meta["file_size"],
        managed_file=file_meta["managed_file"],
        note=req.note,
        character_name_snapshot=char.name,
        character_gender_snapshot=char.gender,
        character_age_snapshot=char.age,
        character_description_snapshot=char.description,
        character_prompt_snapshot=char.prompt,
        character_ref_text_snapshot=char.ref_text,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


@router.put("/character-refs/{asset_id}", response_model=CharacterRefResponse)
def update_character_ref(asset_id: str, update: CharacterRefUpdate, db: Session = Depends(get_db)):
    asset = db.query(CharacterRefAsset).filter(CharacterRefAsset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Character ref asset not found")

    if update.character_id:
        char = _assert_character(asset.project_id, update.character_id, db)
        asset.character_id = char.id
        asset.character_name_snapshot = char.name
        asset.character_gender_snapshot = char.gender
        asset.character_age_snapshot = char.age
        asset.character_description_snapshot = char.description
        asset.character_prompt_snapshot = char.prompt
        asset.character_ref_text_snapshot = char.ref_text

    for key, value in update.model_dump(exclude_unset=True).items():
        if key != "character_id":
            setattr(asset, key, value)
    db.commit()
    db.refresh(asset)
    return asset


@router.delete("/character-refs/{asset_id}")
def delete_character_ref(asset_id: str, db: Session = Depends(get_db)):
    asset = db.query(CharacterRefAsset).filter(CharacterRefAsset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Character ref asset not found")
    file_path = asset.file_path
    managed_file = asset.managed_file
    db.delete(asset)
    db.commit()
    _cleanup_managed_file(file_path, managed_file)
    return {"message": "Character ref asset deleted successfully"}


@router.get("/projects/{project_id}/effects", response_model=List[EffectAssetResponse])
def list_effects(project_id: str, db: Session = Depends(get_db)):
    _assert_project(project_id, db)
    return (
        db.query(EffectAsset)
        .filter(EffectAsset.project_id == project_id)
        .order_by(EffectAsset.created_at.desc())
        .all()
    )


@router.post("/projects/{project_id}/effects/import", response_model=EffectAssetResponse)
def import_effect(project_id: str, req: EffectAssetImportRequest, db: Session = Depends(get_db)):
    _assert_project(project_id, db)
    file_meta = _prepare_asset_file(project_id, req.source_path, "effects", req.copy_to_project)
    display_name = req.display_name or os.path.splitext(file_meta["basename"])[0]

    asset = EffectAsset(
        project_id=project_id,
        source_type=req.source_type,
        effect_category=req.effect_category,
        display_name=display_name,
        file_path=file_meta["stored_path"],
        file_format=file_meta["file_format"],
        file_size=file_meta["file_size"],
        managed_file=file_meta["managed_file"],
        note=req.note,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


@router.put("/effects/{asset_id}", response_model=EffectAssetResponse)
def update_effect(asset_id: str, update: EffectAssetUpdate, db: Session = Depends(get_db)):
    asset = db.query(EffectAsset).filter(EffectAsset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Effect asset not found")
    for key, value in update.model_dump(exclude_unset=True).items():
        setattr(asset, key, value)
    db.commit()
    db.refresh(asset)
    return asset


@router.delete("/effects/{asset_id}")
def delete_effect(asset_id: str, db: Session = Depends(get_db)):
    asset = db.query(EffectAsset).filter(EffectAsset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Effect asset not found")
    file_path = asset.file_path
    managed_file = asset.managed_file
    db.delete(asset)
    db.commit()
    _cleanup_managed_file(file_path, managed_file)
    return {"message": "Effect asset deleted successfully"}


@router.get("/projects/{project_id}/bgms", response_model=List[BgmAssetResponse])
def list_bgms(project_id: str, db: Session = Depends(get_db)):
    _assert_project(project_id, db)
    return (
        db.query(BgmAsset)
        .filter(BgmAsset.project_id == project_id)
        .order_by(BgmAsset.created_at.desc())
        .all()
    )


@router.post("/projects/{project_id}/bgms/import", response_model=BgmAssetResponse)
def import_bgm(project_id: str, req: BgmAssetImportRequest, db: Session = Depends(get_db)):
    _assert_project(project_id, db)
    file_meta = _prepare_asset_file(project_id, req.source_path, "bgms", req.copy_to_project)
    display_name = req.display_name or os.path.splitext(file_meta["basename"])[0]

    asset = BgmAsset(
        project_id=project_id,
        source_type=req.source_type,
        display_name=display_name,
        file_path=file_meta["stored_path"],
        file_format=file_meta["file_format"],
        file_size=file_meta["file_size"],
        managed_file=file_meta["managed_file"],
        bpm=req.bpm,
        mood=req.mood,
        note=req.note,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


@router.put("/bgms/{asset_id}", response_model=BgmAssetResponse)
def update_bgm(asset_id: str, update: BgmAssetUpdate, db: Session = Depends(get_db)):
    asset = db.query(BgmAsset).filter(BgmAsset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="BGM asset not found")
    for key, value in update.model_dump(exclude_unset=True).items():
        setattr(asset, key, value)
    db.commit()
    db.refresh(asset)
    return asset


@router.delete("/bgms/{asset_id}")
def delete_bgm(asset_id: str, db: Session = Depends(get_db)):
    asset = db.query(BgmAsset).filter(BgmAsset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="BGM asset not found")
    file_path = asset.file_path
    managed_file = asset.managed_file
    db.delete(asset)
    db.commit()
    _cleanup_managed_file(file_path, managed_file)
    return {"message": "BGM asset deleted successfully"}
