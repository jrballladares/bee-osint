from datetime import UTC, datetime

from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.infrastructure.database import Base


class News(Base):
    """Extracted news model."""

    __tablename__ = "news"

    __table_args__ = (
        UniqueConstraint("link", name="uq_news_link"),
        Index("ix_news_source_published_at", "source_id", "published_at"),
    )

    id = Column(Integer, primary_key=True, index=True)
    source_id = Column(Integer, ForeignKey("osint_sources.id"), nullable=False, index=True)

    title = Column(String, nullable=False)
    author = Column(String, nullable=True)
    full_text = Column(Text, nullable=True)

    published_at = Column(DateTime(timezone=True), nullable=False, index=True)
    link = Column(String, nullable=False, index=True)

    fetched_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
        index=True,
    )

    named_entities = Column(JSON, nullable=True)

    source = relationship("OsintSource", back_populates="news")
