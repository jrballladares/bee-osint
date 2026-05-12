from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class GraphBase(BaseModel):
    name: str


class GraphCreate(GraphBase):
    pass


class GraphRead(GraphBase):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class NodeBase(BaseModel):
    graph_id: int
    label: str
    type: str
    data: dict[str, Any] | None = None


class NodeCreate(NodeBase):
    pass


class NodeUpdate(BaseModel):
    label: str | None = None
    type: str | None = None
    data: dict[str, Any] | None = None


class NodeRead(NodeBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


class RelationshipBase(BaseModel):
    graph_id: int
    source_id: int
    target_id: int
    type: str


class RelationshipCreate(RelationshipBase):
    pass


class RelationshipRead(RelationshipBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


class GraphDataRead(BaseModel):
    nodes: list[NodeRead]
    relationships: list[RelationshipRead]
