from sqlalchemy.orm import Session

from app.repositories.osint_source_repository import OsintSourceRepository


class OsintSourceService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = OsintSourceRepository(db)

    def list_osint_sources(self) -> list[dict]:
        osint_sources = self.repo.list_osint_sources()
        return [
            {
                "id": w.id,
                "name": w.name,
                "url": w.url,
                "is_active": w.is_active,
            }
            for w in osint_sources
        ]

    def create_source(
        self,
        name: str,
        url: str,
        is_active: bool = True,
    ) -> dict:
        w = self.repo.create_source(
            name=name,
            url=url,
            is_active=is_active,
        )

        return {
            "id": w.id,
            "name": w.name,
            "url": w.url,
            "is_active": w.is_active,
        }

    def update_source(
        self,
        source_id: int,
        name: str,
        url: str,
        is_active: bool,
    ) -> dict | None:
        source = self.repo.get_source(source_id)
        if not source:
            return None

        updated = self.repo.update_source(
            source_id=source_id,
            name=name,
            url=url,
            is_active=is_active,
        )

        if not updated:
            return None

        return {
            "id": updated.id,
            "name": updated.name,
            "url": updated.url,
            "is_active": updated.is_active,
        }

    def delete_source(self, source_id: int) -> bool:
        return self.repo.delete_source(source_id)
