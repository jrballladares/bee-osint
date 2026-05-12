from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.note import NoteCreate, NoteRead, NoteUpdate
from app.services.note_service import NoteService

router = APIRouter()


@router.get("/", response_model=list[NoteRead])
def read_user_notes(
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> Any:
    service = NoteService(db)
    return service.get_notes()


@router.post("/", response_model=NoteRead)
def create_note(
    *,
    db: Session = Depends(get_db),
    note_in: NoteCreate,
    _current_user: User = Depends(get_current_user),
) -> Any:
    service = NoteService(db)
    return service.create_note(note_in)


@router.post("/images", response_model=dict)
async def upload_note_image(
    *,
    db: Session = Depends(get_db),
    file: UploadFile = File(...),
    _current_user: User = Depends(get_current_user),
) -> Any:
    service = NoteService(db)
    image = await service.add_image(file=file)
    return {"url": f"/static/uploads/notes/{image.file_name}"}


@router.get("/{id}", response_model=NoteRead)
def read_note(
    *,
    db: Session = Depends(get_db),
    id: int,
    _current_user: User = Depends(get_current_user),
) -> Any:
    service = NoteService(db)
    note = service.get_note(note_id=id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return note


@router.put("/{id}", response_model=NoteRead)
def update_note(
    *,
    db: Session = Depends(get_db),
    id: int,
    note_in: NoteUpdate,
    _current_user: User = Depends(get_current_user),
) -> Any:
    service = NoteService(db)
    note = service.update_note(note_id=id, note_in=note_in)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return note


@router.delete("/{id}", response_model=bool)
def delete_note(
    *,
    db: Session = Depends(get_db),
    id: int,
    _current_user: User = Depends(get_current_user),
) -> Any:
    service = NoteService(db)
    success = service.delete_note(note_id=id)
    if not success:
        raise HTTPException(status_code=404, detail="Note not found")
    return success
