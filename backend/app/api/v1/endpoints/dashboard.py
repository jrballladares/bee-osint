from datetime import UTC, datetime, time

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.models.graph import Graph
from app.models.news import News
from app.models.note import Note
from app.models.osint_source import OsintSource
from app.models.record import PersonRecord
from app.models.user import User
from app.models.word_list import WordList, WordListAlert
from app.repositories.news_repository import NewsRepository

router = APIRouter()


def _count(db: Session, model: type) -> int:
    return int(db.query(func.count(model.id)).scalar() or 0)


@router.get("/kpis")
async def get_dashboard_kpis(
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """
    Returns global dashboard KPIs for the single-user workspace.
    """
    today_start = datetime.combine(datetime.now(UTC).date(), time.min, tzinfo=UTC)

    total_sources = _count(db, OsintSource)
    active_sources = int(
        db.query(func.count(OsintSource.id)).filter(OsintSource.is_active.is_(True)).scalar() or 0
    )
    total_word_lists = _count(db, WordList)
    active_word_lists = int(
        db.query(func.count(WordList.id)).filter(WordList.status == "active").scalar() or 0
    )
    total_alerts = _count(db, WordListAlert)
    unread_alerts = int(
        db.query(func.count(WordListAlert.id)).filter(WordListAlert.is_read.is_(False)).scalar()
        or 0
    )
    total_news = _count(db, News)
    news_today = int(
        db.query(func.count(News.id)).filter(News.fetched_at >= today_start).scalar() or 0
    )

    return {
        "news_total": total_news,
        "news_today": news_today,
        "notes_total": _count(db, Note),
        "records_total": _count(db, PersonRecord),
        "osint_sources_total": total_sources,
        "osint_sources_active": active_sources,
        "word_lists_total": total_word_lists,
        "word_lists_active": active_word_lists,
        "alerts_total": total_alerts,
        "alerts_unread": unread_alerts,
        "graphs_total": _count(db, Graph),
    }


@router.get("/entities")
async def get_entity_analytics(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """
    Returns top entities mentioned in the global news dataset.
    """
    repo = NewsRepository(db)
    return repo.get_top_entities(limit=limit)


@router.get("/volume")
async def get_volume_analytics(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """
    Returns daily volume of the global news dataset.
    """
    repo = NewsRepository(db)
    return repo.get_daily_volume(days=days)


@router.get("/locations")
async def get_location_analytics(
    days: int = Query(7, ge=1, le=90),
    limit: int = Query(10, ge=1, le=30),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """
    Returns top mentioned locations with comparison against the previous period.
    """
    repo = NewsRepository(db)
    return repo.get_location_analytics(days=days, limit=limit)


@router.get("/term-trends")
async def get_term_trends(
    days: int = Query(7, ge=1, le=90),
    limit: int = Query(10, ge=1, le=30),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """
    Returns rising Word List match terms from real news matches.
    """
    repo = NewsRepository(db)
    return repo.get_term_trends(days=days, limit=limit)


@router.get("/source-activity")
async def get_source_activity(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """
    Returns recent activity by OSINT source.
    """
    repo = NewsRepository(db)
    return repo.get_source_activity(limit=limit)


@router.get("/sentiment")
async def get_sentiment_analytics(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """
    Returns sentiment distribution calculated from stored news text.
    """
    repo = NewsRepository(db)
    return repo.get_web_sentiment_analytics(days=days)
