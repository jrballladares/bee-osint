from datetime import UTC, datetime

from sqlalchemy import (
    JSON,
    Boolean,
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


class WordList(Base):
    __tablename__ = "word_lists"

    __table_args__ = (
        Index("ix_word_lists_status", "status"),
        Index("ix_word_lists_updated", "updated_at"),
    )

    id = Column(Integer, primary_key=True, index=True)
    graph_id = Column(Integer, ForeignKey("graphs.id"), nullable=True, index=True)

    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String, nullable=False, default="active", index=True)

    keywords = Column(JSON, nullable=True)
    people = Column(JSON, nullable=True)
    organizations = Column(JSON, nullable=True)
    locations = Column(JSON, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    graph = relationship("Graph")

    news_links = relationship(
        "WordListNews",
        back_populates="word_list",
        cascade="all, delete-orphan",
    )
    alerts = relationship(
        "WordListAlert",
        back_populates="word_list",
        cascade="all, delete-orphan",
    )


class WordListNews(Base):
    __tablename__ = "word_list_news"

    __table_args__ = (
        UniqueConstraint("word_list_id", "news_id", name="uq_word_list_news"),
        Index("ix_word_list_news_created", "word_list_id", "created_at"),
    )

    id = Column(Integer, primary_key=True, index=True)
    word_list_id = Column(
        Integer,
        ForeignKey("word_lists.id"),
        nullable=False,
        index=True,
    )
    news_id = Column(
        Integer,
        ForeignKey("news.id"),
        nullable=False,
        index=True,
    )

    match_terms = Column(JSON, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

    word_list = relationship("WordList", back_populates="news_links")
    news = relationship("News")


class WordListAlert(Base):
    __tablename__ = "word_list_alerts"

    __table_args__ = (
        UniqueConstraint("word_list_id", "news_id", name="uq_word_list_alert_news"),
        Index("ix_word_list_alerts_list_read", "word_list_id", "is_read"),
        Index("ix_word_list_alerts_created", "created_at"),
    )

    id = Column(Integer, primary_key=True, index=True)
    word_list_id = Column(
        Integer,
        ForeignKey("word_lists.id"),
        nullable=False,
        index=True,
    )
    news_id = Column(
        Integer,
        ForeignKey("news.id"),
        nullable=False,
        index=True,
    )
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    match_terms = Column(JSON, nullable=True)
    severity = Column(String, nullable=False, default="medium")
    is_read = Column(Boolean, nullable=False, default=False)

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

    word_list = relationship("WordList", back_populates="alerts")
    news = relationship("News")
