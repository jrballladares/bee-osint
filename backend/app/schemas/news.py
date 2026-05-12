from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class NewsBase(BaseModel):
    source_id: int
    title: str
    link: str
    author: str | None = None
    published_at: datetime
    full_text: str | None = None


class NewsCreate(NewsBase):
    pass


class NewsRead(NewsBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    source_name: str
    fetched_at: datetime

    named_entities: dict[str, list[str]] = Field(
        default_factory=lambda: {
            "people": [],
            "organizations": [],
            "locations": [],
        }
    )
    sentiment: str = "neutral"
    sentiment_label: str = "Neutral"
    sentiment_score: int = 0


class PaginatedNews(BaseModel):
    news: list[NewsRead]
    page: int
    page_size: int
    total_count: int
    total_pages: int
