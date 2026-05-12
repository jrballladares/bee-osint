import uuid
from pathlib import Path
from typing import Final

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.models.graph import Node
from app.repositories.graph_repository import GraphRepository
from app.repositories.record_repository import RecordRepository
from app.schemas.record import PersonRecordCreate, PersonRecordUpdate

UPLOAD_DIR: Final[Path] = Path("static/uploads/records")
MAX_UPLOAD_BYTES: Final[int] = 25 * 1024 * 1024
CHUNK_SIZE: Final[int] = 1024 * 1024

ALLOWED_EXTENSIONS: Final[set[str]] = {
    ".pdf",
    ".txt",
    ".md",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".ppt",
    ".pptx",
    ".odt",
    ".ods",
    ".odp",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".gif",
    ".bmp",
    ".tiff",
    ".svg",
    ".mp4",
    ".mov",
    ".avi",
    ".mkv",
    ".webm",
}


class RecordService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = RecordRepository(db)
        self.graph_repo = GraphRepository(db)
        UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    def get_record(self, record_id: int):
        return self.repo.get_record(record_id)

    def list_records(self, search: str | None = None):
        return self.repo.list_records(search)

    def get_document(self, doc_id: int):
        return self.repo.get_document(doc_id)

    def create_record(
        self,
        record_in: PersonRecordCreate,
    ):
        record_data = record_in.model_dump()

        record = self.repo.create_record(record_data)
        self._sync_node(record)
        return record

    def update_record(
        self,
        record_id: int,
        record_in: PersonRecordUpdate,
    ):
        current_record = self.repo.get_record(record_id)
        if not current_record:
            return None

        update_data = record_in.model_dump(exclude_unset=True)

        record = self.repo.update_record(
            record_id,
            update_data,
        )

        if record:
            self._sync_node(record)

        return record

    def delete_record(
        self,
        record_id: int,
    ):
        node = self.graph_repo.get_node_by_record_id(record_id)
        if node:
            self.graph_repo.delete_node(node.id)

        return self.repo.delete_record(record_id)

    def _sync_node(self, record):
        label = f"{record.first_name} {record.last_name}".strip()

        nodes = self.db.query(Node).filter(Node.type == "person").all()
        for node in nodes:
            if node.data and node.data.get("record_id") == record.id:
                node_data = {
                    "label": label,
                    "type": "person",
                    "data": {**node.data, "record_id": record.id},
                }
                self.graph_repo.update_node(node.id, node_data)

    async def add_document(
        self,
        record_id: int,
        file: UploadFile,
    ):
        record = self.repo.get_record(record_id)
        if not record:
            return None

        original_name = file.filename or ""
        safe_name = Path(original_name).name
        file_ext = Path(safe_name).suffix.lower()

        if not file_ext:
            raise ValueError("File has no extension.")

        if file_ext not in ALLOWED_EXTENSIONS:
            raise ValueError(f"File extension '{file_ext}' is not allowed.")

        unique_filename = f"{uuid.uuid4()}{file_ext}"
        file_path = UPLOAD_DIR / unique_filename

        total_bytes = 0

        try:
            with open(file_path, "wb") as f:
                while True:
                    chunk = await file.read(CHUNK_SIZE)
                    if not chunk:
                        break

                    total_bytes += len(chunk)
                    if total_bytes > MAX_UPLOAD_BYTES:
                        raise ValueError(
                            f"File exceeds maximum allowed size ({MAX_UPLOAD_BYTES} bytes)."
                        )

                    f.write(chunk)

        except Exception:
            if file_path.exists():
                try:
                    file_path.unlink()
                except OSError:
                    pass
            raise

        finally:
            try:
                await file.close()
            except Exception:
                pass

        doc_data = {
            "file_name": safe_name,
            "file_path": str(file_path),
            "file_type": file.content_type or "application/octet-stream",
        }

        return self.repo.add_document(record_id, doc_data)

    def delete_document(
        self,
        doc_id: int,
    ):
        doc = self.repo.get_document(doc_id)
        if not doc:
            return None

        try:
            file_path = Path(doc.file_path)
            if file_path.exists():
                file_path.unlink()
        except FileNotFoundError:
            pass
        except OSError as e:
            raise RuntimeError(f"Failed to delete file '{doc.file_path}': {e}") from e

        return self.repo.delete_document(doc_id)
