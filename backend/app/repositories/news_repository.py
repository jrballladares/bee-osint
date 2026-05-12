import json
import re
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import urlparse

from sqlalchemy import func, or_
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.news import News
from app.models.osint_source import OsintSource
from app.models.word_list import WordList
from app.utils.entities import normalize_entity_for_type

POSITIVE_SENTIMENT_TERMS = {
    "acuerdo",
    "avance",
    "beneficio",
    "crecimiento",
    "desarrollo",
    "éxito",
    "exito",
    "fortalece",
    "ganancia",
    "logro",
    "mejora",
    "oportunidad",
    "paz",
    "positivo",
    "recuperación",
    "recuperacion",
    "respaldo",
    "seguridad",
    "victoria",
}

NEGATIVE_SENTIMENT_TERMS = {
    "acusación",
    "acusacion",
    "amenaza",
    "ataque",
    "caída",
    "caida",
    "conflicto",
    "corrupción",
    "corrupcion",
    "crisis",
    "delito",
    "denuncia",
    "desastre",
    "fraude",
    "golpe",
    "homicidio",
    "incendio",
    "muerto",
    "negativo",
    "protesta",
    "riesgo",
    "robo",
    "violencia",
}

TREND_STOPWORDS = {
    "about",
    "after",
    "ante",
    "como",
    "con",
    "contra",
    "desde",
    "dice",
    "during",
    "el",
    "en",
    "entre",
    "esta",
    "este",
    "for",
    "from",
    "hay",
    "las",
    "los",
    "más",
    "mas",
    "news",
    "noticias",
    "para",
    "pero",
    "por",
    "que",
    "sin",
    "sobre",
    "sus",
    "tras",
    "una",
    "the",
    "this",
    "with",
}
TREND_TERM_MIN_LENGTH = 4
TREND_TERM_MAX_LENGTH = 60


class NewsRepository:
    """Repository for News data access."""

    def __init__(self, db: Session):
        self.db = db

    def news_exists(self, link: str) -> bool:
        """Checks if a news article exists by its link."""
        return self.db.query(News.id).filter(News.link == link).first() is not None

    def get_news(self, news_id: int) -> Any | None:
        """Returns a news article by its ID along with source_name."""
        query = (
            self.db.query(News, OsintSource.name.label("source_name"))
            .join(OsintSource, News.source_id == OsintSource.id)
            .filter(News.id == news_id)
        )

        return query.first()

    def _serialize_json_fields(self, data: dict[str, Any]) -> None:
        """Serializes complex fields to JSON strings when required."""
        for field in ("named_entities",):
            if field in data and not isinstance(data[field], str):
                data[field] = json.dumps(data[field])

    def create_news(self, news_data: dict[str, Any]) -> News | None:
        """Stores a news article once per link.

        Returns the created row. If the row already exists, returns None and leaves
        the session usable for the rest of the scraping job.
        """
        payload = dict(news_data)
        self._serialize_json_fields(payload)

        try:
            bind = self.db.get_bind()
            if bind.dialect.name == "postgresql":
                stmt = (
                    pg_insert(News)
                    .values(**payload)
                    .on_conflict_do_nothing(
                        index_elements=["link"],
                    )
                    .returning(News.id)
                )
                inserted_id = self.db.execute(stmt).scalar_one_or_none()
                self.db.commit()

                if inserted_id is None:
                    return None

                return self.db.get(News, inserted_id)

            existing = (
                self.db.query(News)
                .filter(
                    News.link == payload["link"],
                )
                .first()
            )
            if existing is not None:
                return None

            news = News(**payload)
            self.db.add(news)
            self.db.commit()
            self.db.refresh(news)
            return news

        except IntegrityError:
            self.db.rollback()
            return None
        except SQLAlchemyError:
            self.db.rollback()
            raise

    def get_paginated_news(
        self,
        *,
        page: int = 1,
        page_size: int = 20,
        query_text: str | None = None,
    ) -> tuple[list[Any], int]:
        """Returns a page of news and the total count."""
        page = max(1, page)
        page_size = max(1, page_size)
        offset = (page - 1) * page_size

        normalized_query = query_text.strip() if query_text else None

        query = self.db.query(News, OsintSource.name.label("source_name")).join(
            OsintSource, News.source_id == OsintSource.id
        )

        if normalized_query:
            query = query.filter(
                or_(
                    News.title.ilike(f"%{normalized_query}%"),
                    News.full_text.ilike(f"%{normalized_query}%"),
                )
            )

        query = query.order_by(News.published_at.desc())

        results = query.all()

        total_count = len(results)
        news_list = results[offset : offset + page_size]

        return news_list, total_count

    def get_top_entities(
        self,
        limit: int = 10,
    ) -> dict[str, list[dict[str, Any]]]:
        """Returns the most mentioned entities."""
        query = self.db.query(News.named_entities)

        rows = query.all()

        counts: dict[str, dict[str, int]] = {
            "people": {},
            "organizations": {},
            "locations": {},
        }

        for (entities_json,) in rows:
            if not entities_json:
                continue

            try:
                data = (
                    json.loads(entities_json) if isinstance(entities_json, str) else entities_json
                )

                if not isinstance(data, dict):
                    continue

                for entity_type, entity_counts in counts.items():
                    for entity in data.get(entity_type, []):
                        if isinstance(entity, str) and entity.strip():
                            clean_entity = normalize_entity_for_type(entity_type, entity.strip())
                            if not clean_entity:
                                continue
                            entity_counts[clean_entity] = entity_counts.get(clean_entity, 0) + 1
            except Exception:
                continue

        result: dict[str, list[dict[str, Any]]] = {}

        for entity_type in counts:
            sorted_entities = sorted(
                counts[entity_type].items(),
                key=lambda x: x[1],
                reverse=True,
            )[:limit]
            result[entity_type] = [
                {"name": name, "count": count} for name, count in sorted_entities
            ]

        return result

    def get_daily_volume(self, days: int = 30) -> list[dict[str, Any]]:
        """Returns daily news volume grouped by source within the last N days."""
        end_date = datetime.now(UTC).date()
        start_date = end_date - timedelta(days=days - 1)

        query = (
            self.db.query(
                func.date(News.published_at).label("date"),
                OsintSource.name.label("source_name"),
                func.count(News.id).label("count"),
            )
            .join(OsintSource, News.source_id == OsintSource.id)
            .filter(News.published_at.isnot(None))
            .filter(func.date(News.published_at) >= start_date)
            .filter(func.date(News.published_at) <= end_date)
        )

        query = query.group_by(
            func.date(News.published_at),
            OsintSource.name,
        ).order_by(func.date(News.published_at))

        results = query.all()

        volume_by_date: dict[str, dict[str, Any]] = {}
        osint_sources: set[str] = set()

        for date_value, source_name, count in results:
            date_str = (
                date_value.isoformat() if hasattr(date_value, "isoformat") else str(date_value)
            )
            source = (source_name or "Unknown").strip()

            osint_sources.add(source)

            if date_str not in volume_by_date:
                volume_by_date[date_str] = {"date": date_str}

            volume_by_date[date_str][source] = int(count)

        current_date = start_date
        while current_date <= end_date:
            date_str = current_date.isoformat()
            volume_by_date.setdefault(date_str, {"date": date_str})
            current_date += timedelta(days=1)

        osint_sources_sorted = sorted(osint_sources)
        output: list[dict[str, Any]] = []

        for date_str in sorted(volume_by_date.keys()):
            row = volume_by_date[date_str]
            for source in osint_sources_sorted:
                row.setdefault(source, 0)
            output.append(row)

        return output

    @staticmethod
    def _safe_json(value: Any, fallback: Any) -> Any:
        if value is None:
            return fallback

        if isinstance(value, str):
            try:
                return json.loads(value)
            except Exception:
                return fallback

        return value

    @staticmethod
    def _period_bounds(days: int) -> tuple[datetime, datetime, datetime]:
        safe_days = max(1, days)
        current_end = datetime.now(UTC)
        current_start = current_end - timedelta(days=safe_days)
        previous_start = current_start - timedelta(days=safe_days)
        return previous_start, current_start, current_end

    @staticmethod
    def _aware_datetime(value: datetime | None) -> datetime | None:
        if value is None:
            return None

        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)

        return value

    def get_location_analytics(
        self,
        *,
        days: int = 7,
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        """Returns top mentioned locations with previous-period comparison."""
        previous_start, current_start, current_end = self._period_bounds(days)

        rows = (
            self.db.query(News.named_entities, News.published_at)
            .filter(News.published_at >= previous_start)
            .filter(News.published_at <= current_end)
            .all()
        )

        current_counts: dict[str, int] = {}
        previous_counts: dict[str, int] = {}

        for entities_json, published_at in rows:
            entities = self._safe_json(entities_json, {})
            if not isinstance(entities, dict):
                continue

            published = self._aware_datetime(published_at)
            if published is None:
                continue

            bucket = current_counts if published >= current_start else previous_counts

            for location in entities.get("locations", []):
                if not isinstance(location, str) or not location.strip():
                    continue

                clean_location = normalize_entity_for_type("locations", location.strip())
                if not clean_location:
                    continue

                bucket[clean_location] = bucket.get(clean_location, 0) + 1

        top_locations = sorted(
            current_counts.items(),
            key=lambda item: (item[1], item[0]),
            reverse=True,
        )[: max(1, limit)]

        return [
            {
                "name": name,
                "count": count,
                "previous_count": previous_counts.get(name, 0),
                "delta": count - previous_counts.get(name, 0),
            }
            for name, count in top_locations
        ]

    def get_term_trends(
        self,
        *,
        days: int = 7,
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        """Returns rising terms extracted from recent news content."""
        previous_start, current_start, current_end = self._period_bounds(days)

        current_counts: dict[str, int] = {}
        previous_counts: dict[str, int] = {}

        extracted_rows = (
            self.db.query(
                News.title,
                News.full_text,
                News.named_entities,
                News.published_at,
            )
            .filter(News.published_at >= previous_start)
            .filter(News.published_at <= current_end)
            .all()
        )

        for title, full_text, named_entities, published_at in extracted_rows:
            published = self._aware_datetime(published_at)
            if published is None:
                continue

            bucket = current_counts if published >= current_start else previous_counts
            for term in self._extract_trend_terms(title, full_text, named_entities):
                bucket[term] = bucket.get(term, 0) + 1

        trends: list[dict[str, Any]] = []
        for term, count in current_counts.items():
            previous_count = previous_counts.get(term, 0)
            delta = count - previous_count
            growth_pct = None if previous_count == 0 else round((delta / previous_count) * 100)

            trends.append(
                {
                    "term": term,
                    "count": count,
                    "previous_count": previous_count,
                    "delta": delta,
                    "growth_pct": growth_pct,
                }
            )

        return sorted(
            trends,
            key=lambda item: (item["delta"], item["count"], item["term"]),
            reverse=True,
        )[: max(1, limit)]

    @staticmethod
    def _clean_trend_term(term: str) -> str | None:
        clean = " ".join(str(term or "").strip().split())
        if not clean:
            return None

        clean = clean.strip(".,;:!?()[]{}\"'“”‘’")
        if len(clean) < TREND_TERM_MIN_LENGTH or len(clean) > TREND_TERM_MAX_LENGTH:
            return None

        lowered = clean.lower()
        if lowered in TREND_STOPWORDS:
            return None

        words = lowered.split()
        if len(words) > 1 and all(word in TREND_STOPWORDS for word in words):
            return None

        return clean

    def _extract_trend_terms(
        self,
        title: str | None,
        full_text: str | None,
        named_entities: Any,
    ) -> set[str]:
        terms: set[str] = set()

        entities = self._safe_json(named_entities, {})
        if isinstance(entities, dict):
            for entity_type in ("people", "organizations", "locations"):
                for entity in entities.get(entity_type, []) or []:
                    if not isinstance(entity, str):
                        continue

                    clean_entity = normalize_entity_for_type(entity_type, entity.strip())
                    clean_term = self._clean_trend_term(clean_entity)
                    if clean_term:
                        terms.add(clean_term)

        text = " ".join(part for part in (title, full_text[:500] if full_text else "") if part)
        if not text:
            return terms

        capitalized_phrases = re.findall(
            r"\b(?:[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ'-]{2,})(?:\s+(?:de|del|la|las|los|y|[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ'-]{2,})){0,3}",
            text,
        )
        uppercase_terms = re.findall(r"\b[A-ZÁÉÍÓÚÑ]{3,}\b", text)

        for term in [*capitalized_phrases, *uppercase_terms]:
            clean_term = self._clean_trend_term(term)
            if clean_term:
                terms.add(clean_term)

        return terms

    def get_source_activity(
        self,
        *,
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        """Returns recent activity by OSINT source."""
        now = datetime.now(UTC)
        day_start = now - timedelta(hours=24)
        week_start = now - timedelta(days=7)

        sources = self.db.query(OsintSource).order_by(OsintSource.name.asc()).all()
        activity: list[dict[str, Any]] = []

        for source in sources:
            news_query = self.db.query(News).filter(News.source_id == source.id)
            count_24h = int(news_query.filter(News.fetched_at >= day_start).count())
            count_7d = int(news_query.filter(News.fetched_at >= week_start).count())
            latest_news = news_query.order_by(News.fetched_at.desc()).first()

            activity.append(
                {
                    "source_id": source.id,
                    "source": source.name,
                    "url": source.url,
                    "is_active": bool(source.is_active),
                    "count_24h": count_24h,
                    "count_7d": count_7d,
                    "last_news_at": self._aware_datetime(latest_news.fetched_at)
                    if latest_news
                    else None,
                    "last_news_title": latest_news.title if latest_news else None,
                }
            )

        return sorted(
            activity,
            key=lambda item: (
                item["count_7d"],
                item["count_24h"],
                item["last_news_at"].timestamp() if item["last_news_at"] else 0,
            ),
            reverse=True,
        )[: max(1, limit)]

    @staticmethod
    def _sentiment_score(text: str) -> int:
        tokens = re.findall(r"[a-záéíóúüñ]+", text.lower())
        positive = sum(1 for token in tokens if token in POSITIVE_SENTIMENT_TERMS)
        negative = sum(1 for token in tokens if token in NEGATIVE_SENTIMENT_TERMS)
        return positive - negative

    @classmethod
    def classify_sentiment(cls, text: str) -> dict[str, Any]:
        score = cls._sentiment_score(text)

        if score > 0:
            return {"key": "positive", "label": "Positivo", "score": score}

        if score < 0:
            return {"key": "negative", "label": "Negativo", "score": score}

        return {"key": "neutral", "label": "Neutral", "score": score}

    def get_sentiment_analytics(self, *, days: int = 30) -> dict[str, Any]:
        """Returns general WEB/TEXT sentiment distribution."""
        current_end = datetime.now(UTC)
        current_start = current_end - timedelta(days=max(1, days))
        return self.get_web_sentiment_analytics(
            days=days,
            current_start=current_start,
            current_end=current_end,
        )

    @staticmethod
    def _domain_from_url(value: str | None) -> str:
        if not value:
            return "desconocido"

        parsed = urlparse(value)
        domain = parsed.netloc or parsed.path.split("/")[0]
        return domain.removeprefix("www.").lower() or "desconocido"

    @staticmethod
    def _news_matches_keywords(text: str, keywords: list[str]) -> bool:
        normalized_text = text.lower()
        return any(keyword.lower() in normalized_text for keyword in keywords if keyword.strip())

    def _sentiment_groups(self) -> list[dict[str, Any]]:
        groups = (
            self.db.query(WordList)
            .filter(WordList.status == "active")
            .order_by(WordList.title.asc())
            .all()
        )

        output = []
        for group in groups:
            keywords = self._safe_json(group.keywords, [])
            if not isinstance(keywords, list):
                keywords = []

            output.append(
                {
                    "id": group.id,
                    "name": group.title,
                    "keywords": [str(keyword) for keyword in keywords if str(keyword).strip()],
                }
            )

        return output

    def get_web_sentiment_analytics(
        self,
        *,
        days: int = 30,
        group_id: int | None = None,
        current_start: datetime | None = None,
        current_end: datetime | None = None,
    ) -> dict[str, Any]:
        """Returns WEB/TEXT-only sentiment.

        When group_id is omitted, the report is general and includes every web/text news item
        in the selected period. Passing a group_id keeps the old filtered behavior available
        for API consumers that still need it.
        """
        current_end = current_end or datetime.now(UTC)
        current_start = current_start or current_end - timedelta(days=max(1, days))
        groups = self._sentiment_groups()
        selected_group = None

        if group_id is not None:
            selected_group = next((group for group in groups if group["id"] == group_id), None)

        keywords = selected_group["keywords"] if selected_group else []

        source_rows_base = self.db.query(OsintSource.name).order_by(OsintSource.id.asc()).all()
        by_source: dict[str, dict[str, int]] = {
            (source_name or "Fuente desconocida").strip(): {
                "positive": 0,
                "neutral": 0,
                "negative": 0,
                "total": 0,
            }
            for (source_name,) in source_rows_base
        }

        rows = (
            self.db.query(
                News.title,
                News.full_text,
                News.published_at,
                News.link,
                OsintSource.name.label("source_name"),
            )
            .join(OsintSource, News.source_id == OsintSource.id)
            .filter(News.published_at >= current_start)
            .filter(News.published_at <= current_end)
            .all()
        )

        counts = {
            "positive": 0,
            "neutral": 0,
            "negative": 0,
        }
        by_domain: dict[str, int] = {}

        for title, full_text, _published_at, link, source_name in rows:
            text = " ".join(part for part in (title, full_text) if part)
            if keywords and not self._news_matches_keywords(text, keywords):
                continue

            sentiment = self.classify_sentiment(text)
            score = sentiment["score"]
            source = (source_name or "Fuente desconocida").strip()
            domain = self._domain_from_url(link)
            source_counts = by_source.setdefault(
                source,
                {"positive": 0, "neutral": 0, "negative": 0, "total": 0},
            )
            by_domain[domain] = by_domain.get(domain, 0) + 1

            if score > 0:
                counts["positive"] += 1
                source_counts["positive"] += 1
            elif score < 0:
                counts["negative"] += 1
                source_counts["negative"] += 1
            else:
                counts["neutral"] += 1
                source_counts["neutral"] += 1

            source_counts["total"] += 1

        total = sum(counts.values())
        source_rows = []

        for source, source_counts in by_source.items():
            source_total = source_counts["total"]

            source_rows.append(
                {
                    "source": source,
                    "positive": source_counts["positive"],
                    "neutral": source_counts["neutral"],
                    "negative": source_counts["negative"],
                    "total": source_total,
                    "share": round((source_total / total) * 100) if total else 0,
                }
            )

        return {
            "total": total,
            "days": max(1, days),
            "profile": "WEB/TEXT",
            "group": selected_group
            or {
                "id": None,
                "name": "General",
                "keywords": [],
            },
            "groups": groups if group_id is not None else [],
            "items": [
                {
                    "key": "positive",
                    "label": "Positivo",
                    "count": counts["positive"],
                    "share": round((counts["positive"] / total) * 100) if total else 0,
                },
                {
                    "key": "neutral",
                    "label": "Neutral",
                    "count": counts["neutral"],
                    "share": round((counts["neutral"] / total) * 100) if total else 0,
                },
                {
                    "key": "negative",
                    "label": "Negativo",
                    "count": counts["negative"],
                    "share": round((counts["negative"] / total) * 100) if total else 0,
                },
            ],
            "by_source": sorted(
                source_rows,
                key=lambda item: (item["total"], item["source"]),
                reverse=True,
            ),
            "top_domains": [
                {"domain": domain, "count": count}
                for domain, count in sorted(
                    by_domain.items(),
                    key=lambda item: (item[1], item[0]),
                    reverse=True,
                )[:5]
            ],
        }
