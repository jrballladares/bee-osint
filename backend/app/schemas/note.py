from datetime import datetime

from pydantic import BaseModel, ConfigDict


class NoteBase(BaseModel):
    content: str
    news_id: int | None = None


class NoteCreate(NoteBase):
    pass


class NoteUpdate(BaseModel):
    content: str | None = None


class NoteRead(NoteBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
