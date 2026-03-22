from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
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
    ProjectCharacterRefAssetLink,
    ProjectEffectAssetLink,
    ProjectBgmAssetLink,
)
from schemas.character_ref_asset import (
    CharacterRefImportRequest,
    CharacterRefUpdate,
    CharacterRefResponse,
    CharacterRefLinkRequest,
    CharacterRefLinkUpdate,
)
from schemas.effect_asset import (
    EffectAssetImportRequest,
    EffectAssetUpdate,
    EffectAssetResponse,
    EffectLinkRequest,
)
from schemas.bgm_asset import (
    BgmAssetImportRequest,
    BgmAssetUpdate,
    BgmAssetResponse,
    BgmLinkRequest,
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


def _prepare_asset_file(source_path: str, bucket: str, copy_to_library: bool):
    src = os.path.abspath(source_path)
    if not os.path.isfile(src):
        raise HTTPException(status_code=400, detail="source_path does not exist or is not a file")

    basename = os.path.basename(src)
    ext = os.path.splitext(basename)[1].lower()

    if copy_to_library:
        target_dir = os.path.join("storage", "assets", bucket)
        os.makedirs(target_dir, exist_ok=True)
        target_name = f"{uuid.uuid4()}{ext}"
        target_path = os.path.join(target_dir, target_name)
        shutil.copy2(src, target_path)
        stored_path = f"/static/assets/{bucket}/{target_name}"
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


def _serialize_character_ref(
    asset: CharacterRefAsset,
    link: Optional[ProjectCharacterRefAssetLink] = None,
) -> CharacterRefResponse:
    return CharacterRefResponse(
        id=asset.id,
        project_id=link.project_id if link else None,
        link_id=link.id if link else None,
        is_linked=bool(link),
        character_id=link.character_id if link else None,
        source_type=asset.source_type,
        display_name=asset.display_name,
        file_path=asset.file_path,
        file_format=asset.file_format,
        file_size=asset.file_size,
        duration=asset.duration,
        sample_rate=asset.sample_rate,
        channels=asset.channels,
        managed_file=asset.managed_file,
        note=asset.note,
        created_at=asset.created_at,
        character_name_snapshot=asset.character_name_snapshot,
        character_gender_snapshot=asset.character_gender_snapshot,
        character_age_snapshot=asset.character_age_snapshot,
        character_description_snapshot=asset.character_description_snapshot,
        character_prompt_snapshot=asset.character_prompt_snapshot,
        character_ref_text_snapshot=asset.character_ref_text_snapshot,
    )


def _serialize_effect(asset: EffectAsset, link: Optional[ProjectEffectAssetLink] = None) -> EffectAssetResponse:
    return EffectAssetResponse(
        id=asset.id,
        project_id=link.project_id if link else None,
        link_id=link.id if link else None,
        is_linked=bool(link),
        source_type=asset.source_type,
        effect_category=asset.effect_category,
        display_name=asset.display_name,
        file_path=asset.file_path,
        file_format=asset.file_format,
        file_size=asset.file_size,
        duration=asset.duration,
        sample_rate=asset.sample_rate,
        channels=asset.channels,
        managed_file=asset.managed_file,
        note=asset.note,
        created_at=asset.created_at,
    )


def _serialize_bgm(asset: BgmAsset, link: Optional[ProjectBgmAssetLink] = None) -> BgmAssetResponse:
    return BgmAssetResponse(
        id=asset.id,
        project_id=link.project_id if link else None,
        link_id=link.id if link else None,
        is_linked=bool(link),
        source_type=asset.source_type,
        display_name=asset.display_name,
        file_path=asset.file_path,
        file_format=asset.file_format,
        file_size=asset.file_size,
        duration=asset.duration,
        sample_rate=asset.sample_rate,
        channels=asset.channels,
        bpm=asset.bpm,
        mood=asset.mood,
        managed_file=asset.managed_file,
        note=asset.note,
        created_at=asset.created_at,
    )


def _link_character_ref_asset(
    project_id: str,
    asset_id: str,
    db: Session,
    character_id: Optional[str] = None,
) -> ProjectCharacterRefAssetLink:
    link = (
        db.query(ProjectCharacterRefAssetLink)
        .filter(
            ProjectCharacterRefAssetLink.project_id == project_id,
            ProjectCharacterRefAssetLink.asset_id == asset_id,
        )
        .first()
    )
    if not link:
        link = ProjectCharacterRefAssetLink(
            id=str(uuid.uuid4()),
            project_id=project_id,
            asset_id=asset_id,
        )
        db.add(link)
    if character_id:
        char = _assert_character(project_id, character_id, db)
        link.character_id = char.id
    return link


def _link_effect_asset(project_id: str, asset_id: str, db: Session) -> ProjectEffectAssetLink:
    link = (
        db.query(ProjectEffectAssetLink)
        .filter(
            ProjectEffectAssetLink.project_id == project_id,
            ProjectEffectAssetLink.asset_id == asset_id,
        )
        .first()
    )
    if not link:
        link = ProjectEffectAssetLink(
            id=str(uuid.uuid4()),
            project_id=project_id,
            asset_id=asset_id,
        )
        db.add(link)
    return link


def _link_bgm_asset(project_id: str, asset_id: str, db: Session) -> ProjectBgmAssetLink:
    link = (
        db.query(ProjectBgmAssetLink)
        .filter(
            ProjectBgmAssetLink.project_id == project_id,
            ProjectBgmAssetLink.asset_id == asset_id,
        )
        .first()
    )
    if not link:
        link = ProjectBgmAssetLink(
            id=str(uuid.uuid4()),
            project_id=project_id,
            asset_id=asset_id,
        )
        db.add(link)
    return link


@router.get("/projects/{project_id}/character-refs", response_model=List[CharacterRefResponse])
def list_project_character_refs(project_id: str, db: Session = Depends(get_db)):
    _assert_project(project_id, db)
    rows = (
        db.query(ProjectCharacterRefAssetLink, CharacterRefAsset)
        .join(CharacterRefAsset, CharacterRefAsset.id == ProjectCharacterRefAssetLink.asset_id)
        .filter(ProjectCharacterRefAssetLink.project_id == project_id)
        .order_by(ProjectCharacterRefAssetLink.created_at.desc())
        .all()
    )
    return [_serialize_character_ref(asset, link) for link, asset in rows]


@router.get("/assets/character-refs", response_model=List[CharacterRefResponse])
def list_global_character_refs(
    project_id: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    if project_id:
        _assert_project(project_id, db)
    assets = db.query(CharacterRefAsset).order_by(CharacterRefAsset.created_at.desc()).all()
    link_map = {}
    if project_id:
        links = (
            db.query(ProjectCharacterRefAssetLink)
            .filter(ProjectCharacterRefAssetLink.project_id == project_id)
            .all()
        )
        link_map = {link.asset_id: link for link in links}
    return [_serialize_character_ref(asset, link_map.get(asset.id)) for asset in assets]


@router.post("/projects/{project_id}/character-refs/import", response_model=CharacterRefResponse)
def import_character_ref(project_id: str, req: CharacterRefImportRequest, db: Session = Depends(get_db)):
    _assert_project(project_id, db)
    char = _assert_character(project_id, req.character_id, db) if req.character_id else None

    file_meta = _prepare_asset_file(req.source_path, "character_refs", req.copy_to_project)
    display_name = req.display_name or os.path.splitext(file_meta["basename"])[0]

    asset = CharacterRefAsset(
        id=str(uuid.uuid4()),
        project_id=project_id,
        character_id=char.id if char else None,
        source_type=req.source_type,
        display_name=display_name,
        file_path=file_meta["stored_path"],
        file_format=file_meta["file_format"],
        file_size=file_meta["file_size"],
        managed_file=file_meta["managed_file"],
        note=req.note,
        character_name_snapshot=char.name if char else None,
        character_gender_snapshot=char.gender if char else None,
        character_age_snapshot=char.age if char else None,
        character_description_snapshot=char.description if char else None,
        character_prompt_snapshot=char.prompt if char else None,
        character_ref_text_snapshot=char.ref_text if char else None,
    )
    db.add(asset)
    db.flush()

    link = _link_character_ref_asset(
        project_id=project_id,
        asset_id=asset.id,
        db=db,
        character_id=req.character_id,
    )
    db.commit()
    db.refresh(asset)
    db.refresh(link)
    return _serialize_character_ref(asset, link)


@router.post("/projects/{project_id}/character-refs/link", response_model=CharacterRefResponse)
def link_character_ref(project_id: str, req: CharacterRefLinkRequest, db: Session = Depends(get_db)):
    _assert_project(project_id, db)
    asset = db.query(CharacterRefAsset).filter(CharacterRefAsset.id == req.asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Character ref asset not found")
    link = _link_character_ref_asset(project_id, req.asset_id, db, req.character_id)
    db.commit()
    db.refresh(link)
    return _serialize_character_ref(asset, link)


@router.put("/projects/{project_id}/character-refs/{asset_id}/link", response_model=CharacterRefResponse)
def update_character_ref_link(
    project_id: str,
    asset_id: str,
    update: CharacterRefLinkUpdate,
    db: Session = Depends(get_db),
):
    _assert_project(project_id, db)
    asset = db.query(CharacterRefAsset).filter(CharacterRefAsset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Character ref asset not found")
    link = (
        db.query(ProjectCharacterRefAssetLink)
        .filter(
            ProjectCharacterRefAssetLink.project_id == project_id,
            ProjectCharacterRefAssetLink.asset_id == asset_id,
        )
        .first()
    )
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")

    payload = update.model_dump(exclude_unset=True)
    if "character_id" in payload:
        if payload["character_id"] is None:
            link.character_id = None
        else:
            char = _assert_character(project_id, payload["character_id"], db)
            link.character_id = char.id

    db.commit()
    db.refresh(link)
    return _serialize_character_ref(asset, link)


@router.delete("/projects/{project_id}/character-refs/{asset_id}/link")
def unlink_character_ref(project_id: str, asset_id: str, db: Session = Depends(get_db)):
    _assert_project(project_id, db)
    link = (
        db.query(ProjectCharacterRefAssetLink)
        .filter(
            ProjectCharacterRefAssetLink.project_id == project_id,
            ProjectCharacterRefAssetLink.asset_id == asset_id,
        )
        .first()
    )
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
    db.delete(link)
    db.commit()
    return {"message": "Character ref unlinked successfully"}


@router.put("/character-refs/{asset_id}", response_model=CharacterRefResponse)
def update_character_ref(asset_id: str, update: CharacterRefUpdate, db: Session = Depends(get_db)):
    asset = db.query(CharacterRefAsset).filter(CharacterRefAsset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Character ref asset not found")

    if "character_id" in update.model_dump(exclude_unset=True):
        raise HTTPException(status_code=400, detail="Use project link API to update character binding")

    for key, value in update.model_dump(exclude_unset=True).items():
        setattr(asset, key, value)
    db.commit()
    db.refresh(asset)
    return _serialize_character_ref(asset, None)


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
def list_project_effects(project_id: str, db: Session = Depends(get_db)):
    _assert_project(project_id, db)
    rows = (
        db.query(ProjectEffectAssetLink, EffectAsset)
        .join(EffectAsset, EffectAsset.id == ProjectEffectAssetLink.asset_id)
        .filter(ProjectEffectAssetLink.project_id == project_id)
        .order_by(ProjectEffectAssetLink.created_at.desc())
        .all()
    )
    return [_serialize_effect(asset, link) for link, asset in rows]


@router.get("/assets/effects", response_model=List[EffectAssetResponse])
def list_global_effects(
    project_id: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    if project_id:
        _assert_project(project_id, db)
    assets = db.query(EffectAsset).order_by(EffectAsset.created_at.desc()).all()
    link_map = {}
    if project_id:
        links = db.query(ProjectEffectAssetLink).filter(ProjectEffectAssetLink.project_id == project_id).all()
        link_map = {link.asset_id: link for link in links}
    return [_serialize_effect(asset, link_map.get(asset.id)) for asset in assets]


@router.post("/projects/{project_id}/effects/import", response_model=EffectAssetResponse)
def import_effect(project_id: str, req: EffectAssetImportRequest, db: Session = Depends(get_db)):
    _assert_project(project_id, db)
    file_meta = _prepare_asset_file(req.source_path, "effects", req.copy_to_project)
    display_name = req.display_name or os.path.splitext(file_meta["basename"])[0]

    asset = EffectAsset(
        id=str(uuid.uuid4()),
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
    db.flush()
    link = _link_effect_asset(project_id, asset.id, db)
    db.commit()
    db.refresh(asset)
    db.refresh(link)
    return _serialize_effect(asset, link)


@router.post("/projects/{project_id}/effects/link", response_model=EffectAssetResponse)
def link_effect(project_id: str, req: EffectLinkRequest, db: Session = Depends(get_db)):
    _assert_project(project_id, db)
    asset = db.query(EffectAsset).filter(EffectAsset.id == req.asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Effect asset not found")
    link = _link_effect_asset(project_id, req.asset_id, db)
    db.commit()
    db.refresh(link)
    return _serialize_effect(asset, link)


@router.delete("/projects/{project_id}/effects/{asset_id}/link")
def unlink_effect(project_id: str, asset_id: str, db: Session = Depends(get_db)):
    _assert_project(project_id, db)
    link = (
        db.query(ProjectEffectAssetLink)
        .filter(
            ProjectEffectAssetLink.project_id == project_id,
            ProjectEffectAssetLink.asset_id == asset_id,
        )
        .first()
    )
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
    db.delete(link)
    db.commit()
    return {"message": "Effect asset unlinked successfully"}


@router.put("/effects/{asset_id}", response_model=EffectAssetResponse)
def update_effect(asset_id: str, update: EffectAssetUpdate, db: Session = Depends(get_db)):
    asset = db.query(EffectAsset).filter(EffectAsset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Effect asset not found")
    for key, value in update.model_dump(exclude_unset=True).items():
        setattr(asset, key, value)
    db.commit()
    db.refresh(asset)
    return _serialize_effect(asset, None)


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
def list_project_bgms(project_id: str, db: Session = Depends(get_db)):
    _assert_project(project_id, db)
    rows = (
        db.query(ProjectBgmAssetLink, BgmAsset)
        .join(BgmAsset, BgmAsset.id == ProjectBgmAssetLink.asset_id)
        .filter(ProjectBgmAssetLink.project_id == project_id)
        .order_by(ProjectBgmAssetLink.created_at.desc())
        .all()
    )
    return [_serialize_bgm(asset, link) for link, asset in rows]


@router.get("/assets/bgms", response_model=List[BgmAssetResponse])
def list_global_bgms(
    project_id: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    if project_id:
        _assert_project(project_id, db)
    assets = db.query(BgmAsset).order_by(BgmAsset.created_at.desc()).all()
    link_map = {}
    if project_id:
        links = db.query(ProjectBgmAssetLink).filter(ProjectBgmAssetLink.project_id == project_id).all()
        link_map = {link.asset_id: link for link in links}
    return [_serialize_bgm(asset, link_map.get(asset.id)) for asset in assets]


@router.post("/projects/{project_id}/bgms/import", response_model=BgmAssetResponse)
def import_bgm(project_id: str, req: BgmAssetImportRequest, db: Session = Depends(get_db)):
    _assert_project(project_id, db)
    file_meta = _prepare_asset_file(req.source_path, "bgms", req.copy_to_project)
    display_name = req.display_name or os.path.splitext(file_meta["basename"])[0]

    asset = BgmAsset(
        id=str(uuid.uuid4()),
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
    db.flush()
    link = _link_bgm_asset(project_id, asset.id, db)
    db.commit()
    db.refresh(asset)
    db.refresh(link)
    return _serialize_bgm(asset, link)


@router.post("/projects/{project_id}/bgms/link", response_model=BgmAssetResponse)
def link_bgm(project_id: str, req: BgmLinkRequest, db: Session = Depends(get_db)):
    _assert_project(project_id, db)
    asset = db.query(BgmAsset).filter(BgmAsset.id == req.asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="BGM asset not found")
    link = _link_bgm_asset(project_id, req.asset_id, db)
    db.commit()
    db.refresh(link)
    return _serialize_bgm(asset, link)


@router.delete("/projects/{project_id}/bgms/{asset_id}/link")
def unlink_bgm(project_id: str, asset_id: str, db: Session = Depends(get_db)):
    _assert_project(project_id, db)
    link = (
        db.query(ProjectBgmAssetLink)
        .filter(
            ProjectBgmAssetLink.project_id == project_id,
            ProjectBgmAssetLink.asset_id == asset_id,
        )
        .first()
    )
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
    db.delete(link)
    db.commit()
    return {"message": "BGM asset unlinked successfully"}


@router.put("/bgms/{asset_id}", response_model=BgmAssetResponse)
def update_bgm(asset_id: str, update: BgmAssetUpdate, db: Session = Depends(get_db)):
    asset = db.query(BgmAsset).filter(BgmAsset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="BGM asset not found")
    for key, value in update.model_dump(exclude_unset=True).items():
        setattr(asset, key, value)
    db.commit()
    db.refresh(asset)
    return _serialize_bgm(asset, None)


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
