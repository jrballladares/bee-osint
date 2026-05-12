from sqlalchemy.orm import Session

from app.models.note import Note, NoteImage


class NoteRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_note(self, note_id: int) -> Note | None:
        return self.db.query(Note).filter(Note.id == note_id).first()

    def get_notes(self) -> list[Note]:
        return self.db.query(Note).order_by(Note.created_at.desc()).all()

    def get_notes_by_news(self, news_id: int) -> list[Note]:
        return self.db.query(Note).filter(Note.news_id == news_id).all()

    def create_note(self, note_data: dict) -> Note:
        note = Note(**note_data)
        self.db.add(note)
        self.db.commit()
        self.db.refresh(note)
        return note

    def update_note(self, note_id: int, note_data: dict) -> Note | None:
        note = self.get_note(note_id)
        if not note:
            return None
        for key, value in note_data.items():
            setattr(note, key, value)
        self.db.commit()
        self.db.refresh(note)
        return note

    def delete_note(self, note_id: int) -> bool:
        note = self.get_note(note_id)
        if not note:
            return False
        self.db.delete(note)
        self.db.commit()
        return True

    def create_image(self, image_data: dict) -> NoteImage:
        image = NoteImage(**image_data)
        self.db.add(image)
        self.db.commit()
        self.db.refresh(image)
        return image
