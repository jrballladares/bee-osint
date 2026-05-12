from sqlalchemy import Boolean, Column, Integer, String
from sqlalchemy.orm import relationship

from app.infrastructure.database import Base


class OsintSource(Base):
    """OSINT source configuration model."""

    __tablename__ = "osint_sources"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    url = Column(String, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)

    news = relationship("News", back_populates="source", cascade="all, delete-orphan")
