import os
import uuid
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.repositories.note_repository import NoteRepository
from app.schemas.note import NoteCreate, NoteUpdate

UPLOAD_DIR = Path("static/uploads/notes")


class NoteService:
    def __init__(self, db: Session):
        self.repo = NoteRepository(db)

    def get_note(self, note_id: int) -> dict | None:
        return self.repo.get_note(note_id)

    def get_notes(self) -> list[dict]:
        return self.repo.get_notes()

    def get_news_notes(self, news_id: int) -> list[dict]:
        return self.repo.get_notes_by_news(news_id)

    def create_note(self, note_in: NoteCreate) -> dict:
        note_data = note_in.model_dump()
        return self.repo.create_note(note_data)

    def update_note(self, note_id: int, note_in: NoteUpdate) -> dict | None:
        return self.repo.update_note(note_id, note_in.model_dump(exclude_unset=True))

    def delete_note(self, note_id: int) -> bool:
        return self.repo.delete_note(note_id)

    async def add_image(self, file: UploadFile):
        UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        file_ext = os.path.splitext(file.filename or "")[1]
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        file_path = UPLOAD_DIR / unique_filename

        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)

        return self.repo.create_image({"file_name": unique_filename, "file_path": str(file_path)})
