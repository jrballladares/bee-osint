import mimetypes
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.record import (
    PersonRecordCreate,
    PersonRecordRead,
    PersonRecordUpdate,
    RecordDocumentRead,
)
from app.services.record_service import RecordService

router = APIRouter()


@router.get("/", response_model=list[PersonRecordRead])
def read_records(
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
    search: str | None = Query(None),
) -> Any:
    service = RecordService(db)
    return service.list_records(search=search)


@router.post("/", response_model=PersonRecordRead)
def create_record(
    *,
    db: Session = Depends(get_db),
    record_in: PersonRecordCreate,
    _current_user: User = Depends(get_current_user),
) -> Any:
    service = RecordService(db)
    return service.create_record(record_in)


@router.get("/{id}", response_model=PersonRecordRead)
def read_record(
    *,
    db: Session = Depends(get_db),
    id: int,
    _current_user: User = Depends(get_current_user),
) -> Any:
    service = RecordService(db)
    record = service.get_record(record_id=id)
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    return record


@router.put("/{id}", response_model=PersonRecordRead)
def update_record(
    *,
    db: Session = Depends(get_db),
    id: int,
    record_in: PersonRecordUpdate,
    _current_user: User = Depends(get_current_user),
) -> Any:
    service = RecordService(db)
    record = service.update_record(record_id=id, record_in=record_in)
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    return record


@router.delete("/{id}", response_model=bool)
def delete_record(
    *,
    db: Session = Depends(get_db),
    id: int,
    _current_user: User = Depends(get_current_user),
) -> Any:
    service = RecordService(db)
    success = service.delete_record(record_id=id)
    if not success:
        raise HTTPException(status_code=404, detail="Record not found")
    return success


@router.post("/{id}/documents", response_model=RecordDocumentRead)
async def upload_document(
    *,
    db: Session = Depends(get_db),
    id: int,
    file: UploadFile = File(...),
    _current_user: User = Depends(get_current_user),
) -> Any:
    service = RecordService(db)
    doc = await service.add_document(record_id=id, file=file)
    if not doc:
        raise HTTPException(status_code=404, detail="Record not found")
    return doc


@router.get("/documents/{doc_id}/download")
def download_document(
    *,
    db: Session = Depends(get_db),
    doc_id: int,
    _current_user: User = Depends(get_current_user),
):
    service = RecordService(db)
    doc = service.get_document(doc_id=doc_id)

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    file_path = getattr(doc, "file_path", None) or getattr(doc, "path", None)
    if not file_path:
        raise HTTPException(status_code=404, detail="Document file path not found")

    path = Path(file_path)
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="Document file does not exist")

    filename = getattr(doc, "file_name", None) or path.name
    media_type = (
        getattr(doc, "file_type", None)
        or mimetypes.guess_type(str(path))[0]
        or "application/octet-stream"
    )

    return FileResponse(
        path=str(path),
        filename=filename,
        media_type=media_type,
    )


@router.delete("/documents/{doc_id}", response_model=bool)
def delete_document(
    *,
    db: Session = Depends(get_db),
    doc_id: int,
    _current_user: User = Depends(get_current_user),
) -> Any:
    service = RecordService(db)
    success = service.delete_document(doc_id=doc_id)
    if not success:
        raise HTTPException(status_code=404, detail="Document not found")
    return success
