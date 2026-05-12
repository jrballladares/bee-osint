from sqlalchemy.orm import Session

from app.models.osint_source import OsintSource


class OsintSourceRepository:
    """Repository for OSINT source configuration."""

    def __init__(self, db: Session):
        self.db = db

    def list_osint_sources(self) -> list[OsintSource]:
        """Return all OSINT sources in a stable UI order."""
        return self.db.query(OsintSource).order_by(OsintSource.id.asc()).all()

    def list_active_osint_sources(self) -> list[OsintSource]:
        """Return only OSINT sources that are currently enabled for scraping."""
        return (
            self.db.query(OsintSource)
            .filter(OsintSource.is_active.is_(True))
            .order_by(OsintSource.id.asc())
            .all()
        )

    def is_source_active(self, source_id: int) -> bool:
        """Check the latest persisted active state without relying on stale ORM objects."""
        query = self.db.query(OsintSource.id).filter(
            OsintSource.id == source_id,
            OsintSource.is_active.is_(True),
        )
        return query.first() is not None

    def get_source(self, source_id: int) -> OsintSource | None:
        """Return an OSINT source by its ID."""
        source = self.db.get(OsintSource, source_id)
        if not source:
            return None
        return source

    def create_source(
        self,
        name: str,
        url: str,
        is_active: bool = True,
    ) -> OsintSource:
        """Create a new OSINT source."""
        source = OsintSource(
            name=name,
            url=url,
            is_active=is_active,
        )
        self.db.add(source)
        self.db.commit()
        self.db.refresh(source)
        return source

    def update_source(
        self,
        source_id: int,
        name: str,
        url: str,
        is_active: bool,
    ) -> OsintSource | None:
        """Update an OSINT source."""
        source = self.get_source(source_id)
        if not source:
            return None

        source.name = name
        source.url = url
        source.is_active = is_active

        self.db.commit()
        self.db.refresh(source)
        return source

    def delete_source(self, source_id: int) -> bool:
        """Delete an OSINT source."""
        source = self.get_source(source_id)
        if not source:
            return False

        self.db.delete(source)
        self.db.commit()
        return True
