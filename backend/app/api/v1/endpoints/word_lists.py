import asyncio
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from loguru import logger
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.infrastructure.database import SessionLocal
from app.models.user import User
from app.schemas.word_list import (
    WordListAlertRead,
    WordListCreate,
    WordListDetail,
    WordListRead,
    WordListRefreshResult,
    WordListUpdate,
)
from app.services.news_service import NewsService
from app.services.word_list_service import WordListService

router = APIRouter()


def _run_word_list_search_task(word_list_id: int) -> None:
    db = SessionLocal()
    try:
        logger.info("Starting manual Word List search for id={}", word_list_id)
        asyncio.run(NewsService(db).fetch_and_store_news())
        WordListService(db).refresh_word_list(word_list_id=word_list_id)
        logger.info("Manual Word List search completed for id={}", word_list_id)
    except Exception:
        logger.exception("Manual Word List search failed for id={}", word_list_id)
    finally:
        db.close()


@router.get("", response_model=list[WordListRead])
def list_word_lists(
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> Any:
    service = WordListService(db)
    return service.list_word_lists()


@router.get("/alerts", response_model=list[WordListAlertRead])
def list_alerts(
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> Any:
    service = WordListService(db)
    return service.list_alerts()


@router.post("", response_model=WordListRead)
def create_word_list(
    *,
    db: Session = Depends(get_db),
    word_list_in: WordListCreate,
    _current_user: User = Depends(get_current_user),
) -> Any:
    service = WordListService(db)
    word_list = service.create_word_list(word_list_in=word_list_in)
    return service._word_list_payload(word_list)


@router.get("/{word_list_id}", response_model=WordListDetail)
def get_word_list(
    *,
    db: Session = Depends(get_db),
    word_list_id: int,
    _current_user: User = Depends(get_current_user),
) -> Any:
    service = WordListService(db)
    word_list = service.get_word_list(word_list_id=word_list_id)
    if not word_list:
        raise HTTPException(status_code=404, detail="Word list not found")
    return word_list


@router.put("/{word_list_id}", response_model=WordListRead)
def update_word_list(
    *,
    db: Session = Depends(get_db),
    word_list_id: int,
    word_list_in: WordListUpdate,
    _current_user: User = Depends(get_current_user),
) -> Any:
    service = WordListService(db)
    word_list = service.update_word_list(
        word_list_id=word_list_id,
        word_list_in=word_list_in,
    )
    if not word_list:
        raise HTTPException(status_code=404, detail="Word list not found")
    return service._word_list_payload(word_list)


@router.delete("/{word_list_id}", response_model=bool)
def delete_word_list(
    *,
    db: Session = Depends(get_db),
    word_list_id: int,
    _current_user: User = Depends(get_current_user),
) -> Any:
    service = WordListService(db)
    success = service.delete_word_list(word_list_id=word_list_id)
    if not success:
        raise HTTPException(status_code=404, detail="Word list not found")
    return success


@router.post("/{word_list_id}/refresh", response_model=WordListRefreshResult)
def refresh_word_list(
    *,
    db: Session = Depends(get_db),
    word_list_id: int,
    _current_user: User = Depends(get_current_user),
) -> Any:
    service = WordListService(db)
    if not service._word_list_exists(word_list_id=word_list_id):
        raise HTTPException(status_code=404, detail="Word list not found")
    return service.refresh_word_list(word_list_id=word_list_id)


@router.post("/{word_list_id}/run")
def run_word_list_search(
    *,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    word_list_id: int,
    _current_user: User = Depends(get_current_user),
) -> dict[str, bool]:
    service = WordListService(db)
    if not service._word_list_exists(word_list_id=word_list_id):
        raise HTTPException(status_code=404, detail="Word list not found")

    background_tasks.add_task(_run_word_list_search_task, word_list_id)
    return {"started": True}


@router.patch("/alerts/{alert_id}", response_model=WordListAlertRead)
def update_alert(
    *,
    db: Session = Depends(get_db),
    alert_id: int,
    is_read: bool,
    _current_user: User = Depends(get_current_user),
) -> Any:
    service = WordListService(db)
    alert = service.set_alert_read(alert_id=alert_id, is_read=is_read)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {
        "id": alert.id,
        "word_list_id": alert.word_list_id,
        "news_id": alert.news_id,
        "title": alert.title,
        "message": alert.message,
        "match_terms": alert.match_terms or [],
        "severity": alert.severity,
        "is_read": alert.is_read,
        "created_at": alert.created_at,
        "news": None,
    }
