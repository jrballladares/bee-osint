from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.news import NewsRead, PaginatedNews
from app.services.news_service import NewsService

router = APIRouter()


@router.get("/", response_model=PaginatedNews)
def read_news(
    *,
    db: Session = Depends(get_db),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200),
    _current_user: User = Depends(get_current_user),
) -> Any:
    service = NewsService(db)

    return service.get_paginated_news(
        page=page,
        page_size=page_size,
    )


@router.get("/{id}", response_model=NewsRead)
def read_news_item(
    id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> Any:
    service = NewsService(db)
    news = service.get_news(news_id=id)

    if news is None:
        raise HTTPException(status_code=404, detail="News not found")

    return news
