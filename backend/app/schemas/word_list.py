from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.news import NewsRead


class WordListBase(BaseModel):
    title: str = Field(min_length=1, max_length=220)
    description: str | None = None
    status: str = "active"
    graph_id: int | None = None
    keywords: list[str] = Field(default_factory=list)
    people: list[str] = Field(default_factory=list)
    organizations: list[str] = Field(default_factory=list)
    locations: list[str] = Field(default_factory=list)


class WordListCreate(WordListBase):
    pass


class WordListUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=220)
    description: str | None = None
    status: str | None = None
    graph_id: int | None = None
    keywords: list[str] | None = None
    people: list[str] | None = None
    organizations: list[str] | None = None
    locations: list[str] | None = None


class WordListRead(WordListBase):
    id: int
    created_at: datetime
    updated_at: datetime
    news_count: int = 0
    alert_count: int = 0
    unread_alert_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class WordListAlertRead(BaseModel):
    id: int
    word_list_id: int
    news_id: int
    title: str
    message: str
    match_terms: list[str] = Field(default_factory=list)
    severity: str
    is_read: bool
    created_at: datetime
    news: NewsRead | None = None

    model_config = ConfigDict(from_attributes=True)


class WordListNewsRead(BaseModel):
    id: int
    word_list_id: int
    news_id: int
    match_terms: list[str] = Field(default_factory=list)
    created_at: datetime
    news: NewsRead

    model_config = ConfigDict(from_attributes=True)


class WordListDetail(WordListRead):
    alerts: list[WordListAlertRead] = Field(default_factory=list)
    news: list[WordListNewsRead] = Field(default_factory=list)
    graph: dict[str, Any] | None = None


class WordListRefreshResult(BaseModel):
    matched_news: int
    new_alerts: int
