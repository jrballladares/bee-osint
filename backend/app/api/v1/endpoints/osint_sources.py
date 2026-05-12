from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.osint_source import OsintSourceCreate, OsintSourceRead, OsintSourceUpdate
from app.services.osint_source_service import OsintSourceService

router = APIRouter()


@router.get("", response_model=list[OsintSourceRead])
def get_sources(
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> Any:
    """Retrieve all OSINT sources."""
    service = OsintSourceService(db)
    return service.list_osint_sources()


@router.post("", response_model=OsintSourceRead)
def create_source(
    *,
    db: Session = Depends(get_db),
    source_in: OsintSourceCreate,
    _current_user: User = Depends(get_current_user),
) -> Any:
    """Create a new OSINT source."""
    service = OsintSourceService(db)

    return service.create_source(
        name=source_in.name,
        url=source_in.url,
        is_active=source_in.is_active,
    )


@router.put("/{source_id}", response_model=OsintSourceRead)
def update_source(
    *,
    db: Session = Depends(get_db),
    source_id: int,
    source_in: OsintSourceUpdate,
    _current_user: User = Depends(get_current_user),
) -> Any:
    """Update an OSINT source."""
    service = OsintSourceService(db)

    source = service.update_source(
        source_id=source_id,
        name=source_in.name,
        url=source_in.url,
        is_active=source_in.is_active,
    )

    if not source:
        raise HTTPException(status_code=404, detail="Source not found")

    return source


@router.delete("/{source_id}", response_model=bool)
def delete_source(
    *,
    db: Session = Depends(get_db),
    source_id: int,
    _current_user: User = Depends(get_current_user),
) -> Any:
    """Delete an OSINT source."""
    service = OsintSourceService(db)

    success = service.delete_source(source_id)

    if not success:
        raise HTTPException(status_code=404, detail="Source not found")

    return success
