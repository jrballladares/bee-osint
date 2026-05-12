from datetime import UTC, datetime

from sqlalchemy import JSON, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.infrastructure.database import Base


class Graph(Base):
    __tablename__ = "graphs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    nodes = relationship("Node", back_populates="graph", cascade="all, delete-orphan")
    relationships = relationship(
        "Relationship", back_populates="graph", cascade="all, delete-orphan"
    )


class Node(Base):
    __tablename__ = "nodes"

    id = Column(Integer, primary_key=True, index=True)
    graph_id = Column(Integer, ForeignKey("graphs.id"), nullable=False)
    label = Column(String, nullable=False)
    type = Column(
        String, nullable=False
    )  # person, organization, domain, news, phone, email, address, document
    data = Column(JSON, nullable=True)

    graph = relationship("Graph", back_populates="nodes")


class Relationship(Base):
    __tablename__ = "relationships"

    id = Column(Integer, primary_key=True, index=True)
    graph_id = Column(Integer, ForeignKey("graphs.id"), nullable=False)
    source_id = Column(Integer, ForeignKey("nodes.id"), nullable=False)
    target_id = Column(Integer, ForeignKey("nodes.id"), nullable=False)
    type = Column(String, nullable=False)  # e.g., "mentions", "related_to", "author_of"

    source = relationship("Node", foreign_keys=[source_id])
    target = relationship("Node", foreign_keys=[target_id])
    graph = relationship("Graph", back_populates="relationships")
