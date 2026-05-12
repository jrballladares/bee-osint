import json
import re
import unicodedata
from datetime import UTC
from typing import Any

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.models.graph import Graph
from app.models.news import News
from app.models.word_list import (
    WordList,
    WordListAlert,
    WordListNews,
)
from app.schemas.word_list import (
    WordListCreate,
    WordListUpdate,
)


class WordListService:
    HIGH_SEVERITY_MATCH_COUNT = 3

    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def _clean_list(values: list[Any] | None) -> list[str]:
        result: list[str] = []
        seen: set[str] = set()

        for value in values or []:
            text = str(value or "").strip()
            if not text:
                continue
            key = text.casefold()
            if key in seen:
                continue
            seen.add(key)
            result.append(text)

        return result

    @staticmethod
    def _safe_json(value: Any, default: Any) -> Any:
        if value is None:
            return default
        if isinstance(value, str):
            try:
                return json.loads(value)
            except Exception:
                return default
        return value

    @staticmethod
    def _normalize_text(value: Any) -> str:
        text = unicodedata.normalize("NFKD", str(value or ""))
        text = "".join(ch for ch in text if not unicodedata.combining(ch))
        return re.sub(r"\s+", " ", text).casefold().strip()

    def _word_list_payload(self, word_list: WordList) -> dict[str, Any]:
        news_count = (
            self.db.query(func.count(WordListNews.id))
            .filter(WordListNews.word_list_id == word_list.id)
            .scalar()
            or 0
        )
        alert_count = (
            self.db.query(func.count(WordListAlert.id))
            .filter(WordListAlert.word_list_id == word_list.id)
            .scalar()
            or 0
        )
        unread_alert_count = (
            self.db.query(func.count(WordListAlert.id))
            .filter(
                WordListAlert.word_list_id == word_list.id,
                WordListAlert.is_read.is_(False),
            )
            .scalar()
            or 0
        )
        return {
            "id": word_list.id,
            "graph_id": word_list.graph_id,
            "title": word_list.title,
            "description": word_list.description,
            "status": word_list.status,
            "keywords": self._safe_json(word_list.keywords, []),
            "people": self._safe_json(word_list.people, []),
            "organizations": self._safe_json(word_list.organizations, []),
            "locations": self._safe_json(word_list.locations, []),
            "created_at": word_list.created_at,
            "updated_at": word_list.updated_at,
            "news_count": news_count,
            "alert_count": alert_count,
            "unread_alert_count": unread_alert_count,
        }

    def _news_payload(self, news: News, source_name: str | None = None) -> dict[str, Any]:
        return {
            "id": news.id,
            "source_id": news.source_id,
            "source_name": source_name or getattr(news.source, "name", ""),
            "title": news.title,
            "link": news.link,
            "author": news.author,
            "published_at": news.published_at,
            "fetched_at": news.fetched_at,
            "full_text": news.full_text,
            "named_entities": self._safe_json(
                news.named_entities,
                {"people": [], "organizations": [], "locations": []},
            ),
        }

    def _word_list_terms(self, word_list: WordList) -> list[str]:
        terms: list[str] = []
        for field in ("keywords", "people", "organizations", "locations"):
            terms.extend(self._safe_json(getattr(word_list, field), []))
        return self._clean_list(terms)

    def _news_text(self, news: News) -> str:
        entities = self._safe_json(news.named_entities, {})
        entity_values: list[str] = []

        if isinstance(entities, dict):
            for values in entities.values():
                if isinstance(values, list):
                    entity_values.extend(str(value) for value in values)

        chunks = [
            news.title,
            news.full_text,
            " ".join(entity_values),
        ]
        return self._normalize_text(" ".join(str(chunk or "") for chunk in chunks))

    def _match_terms(self, word_list: WordList, news: News) -> list[str]:
        haystack = self._news_text(news)
        matches = []

        for term in self._word_list_terms(word_list):
            needle = self._normalize_text(term)
            if needle and needle in haystack:
                matches.append(term)

        return self._clean_list(matches)

    @staticmethod
    def _as_utc(value: Any) -> Any:
        if not value:
            return None
        if getattr(value, "tzinfo", None) is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)

    def _news_is_after_word_list_start(self, word_list: WordList, news: News) -> bool:
        word_list_start = self._as_utc(word_list.created_at)
        news_seen_at = self._as_utc(news.fetched_at)

        if not word_list_start or not news_seen_at:
            return False

        return news_seen_at >= word_list_start

    def list_word_lists(self) -> list[dict[str, Any]]:
        word_lists = self.db.query(WordList).order_by(WordList.updated_at.desc()).all()
        return [self._word_list_payload(word_list) for word_list in word_lists]

    def list_alerts(self) -> list[dict[str, Any]]:
        alerts = (
            self.db.query(WordListAlert)
            .options(joinedload(WordListAlert.news).joinedload(News.source))
            .order_by(WordListAlert.is_read.asc(), WordListAlert.created_at.desc())
            .all()
        )

        return [
            {
                "id": alert.id,
                "word_list_id": alert.word_list_id,
                "news_id": alert.news_id,
                "title": alert.title,
                "message": alert.message,
                "match_terms": self._safe_json(alert.match_terms, []),
                "severity": alert.severity,
                "is_read": alert.is_read,
                "created_at": alert.created_at,
                "news": self._news_payload(alert.news) if alert.news else None,
            }
            for alert in alerts
        ]

    def get_word_list(self, word_list_id: int) -> dict[str, Any] | None:
        word_list = self.db.query(WordList).filter(WordList.id == word_list_id).first()
        if not word_list:
            return None

        payload = self._word_list_payload(word_list)

        news_links = (
            self.db.query(WordListNews)
            .options(joinedload(WordListNews.news).joinedload(News.source))
            .filter(WordListNews.word_list_id == word_list.id)
            .order_by(WordListNews.created_at.desc())
            .limit(40)
            .all()
        )
        alerts = (
            self.db.query(WordListAlert)
            .options(joinedload(WordListAlert.news).joinedload(News.source))
            .filter(WordListAlert.word_list_id == word_list.id)
            .order_by(WordListAlert.created_at.desc())
            .all()
        )
        payload["news"] = [
            {
                "id": item.id,
                "word_list_id": item.word_list_id,
                "news_id": item.news_id,
                "match_terms": self._safe_json(item.match_terms, []),
                "created_at": item.created_at,
                "news": self._news_payload(item.news),
            }
            for item in news_links
        ]
        payload["alerts"] = [
            {
                "id": alert.id,
                "word_list_id": alert.word_list_id,
                "news_id": alert.news_id,
                "title": alert.title,
                "message": alert.message,
                "match_terms": self._safe_json(alert.match_terms, []),
                "severity": alert.severity,
                "is_read": alert.is_read,
                "created_at": alert.created_at,
                "news": self._news_payload(alert.news) if alert.news else None,
            }
            for alert in alerts
        ]
        payload["graph"] = None

        if word_list.graph_id:
            graph = self.db.query(Graph).filter(Graph.id == word_list.graph_id).first()
            if graph:
                payload["graph"] = {"id": graph.id, "name": graph.name}

        return payload

    def create_word_list(self, word_list_in: WordListCreate) -> WordList:
        payload = word_list_in.model_dump()
        word_list = WordList(
            title=payload["title"].strip(),
            description=payload.get("description"),
            status=payload.get("status") or "active",
            graph_id=payload.get("graph_id"),
            keywords=self._clean_list(payload.get("keywords")),
            people=self._clean_list(payload.get("people")),
            organizations=self._clean_list(payload.get("organizations")),
            locations=self._clean_list(payload.get("locations")),
        )
        self.db.add(word_list)
        self.db.commit()
        self.db.refresh(word_list)
        return word_list

    def update_word_list(
        self,
        word_list_id: int,
        word_list_in: WordListUpdate,
    ) -> WordList | None:
        word_list = self.db.query(WordList).filter(WordList.id == word_list_id).first()
        if not word_list:
            return None

        payload = word_list_in.model_dump(exclude_unset=True)
        for field in ("title", "description", "status", "graph_id"):
            if field in payload:
                setattr(word_list, field, payload[field])
        for field in ("keywords", "people", "organizations", "locations"):
            if field in payload:
                setattr(word_list, field, self._clean_list(payload[field]))

        self.db.commit()
        self.db.refresh(word_list)
        return word_list

    def delete_word_list(self, word_list_id: int) -> bool:
        word_list = self.db.query(WordList).filter(WordList.id == word_list_id).first()
        if not word_list:
            return False
        self.db.delete(word_list)
        self.db.commit()
        return True

    def refresh_word_list(self, word_list_id: int) -> dict[str, int]:
        word_list = self.db.query(WordList).filter(WordList.id == word_list_id).first()
        if not word_list:
            return {"matched_news": 0, "new_alerts": 0}

        news_items = (
            self.db.query(News)
            .filter(
                News.fetched_at >= word_list.created_at,
            )
            .all()
        )
        matched_news = 0
        new_alerts = 0

        for news in news_items:
            matches = self._match_terms(word_list, news)
            if not matches:
                continue

            matched_news += 1
            if self._create_word_list_match(word_list=word_list, news=news, matches=matches):
                new_alerts += 1

        self.db.commit()
        return {"matched_news": matched_news, "new_alerts": new_alerts}

    def match_news(self, news: News) -> int:
        word_lists = (
            self.db.query(WordList)
            .filter(
                WordList.status == "active",
            )
            .all()
        )
        created = 0

        for word_list in word_lists:
            if not self._news_is_after_word_list_start(word_list, news):
                continue

            matches = self._match_terms(word_list, news)
            if matches and self._create_word_list_match(
                word_list=word_list,
                news=news,
                matches=matches,
            ):
                created += 1

        self.db.commit()
        return created

    def _create_word_list_match(
        self,
        *,
        word_list: WordList,
        news: News,
        matches: list[str],
    ) -> bool:
        existing_match = (
            self.db.query(WordListNews.id)
            .filter(
                WordListNews.word_list_id == word_list.id,
                WordListNews.news_id == news.id,
            )
            .first()
        )
        created_alert = False

        if not existing_match:
            self.db.add(
                WordListNews(
                    word_list_id=word_list.id,
                    news_id=news.id,
                    match_terms=matches,
                )
            )

        existing_alert = (
            self.db.query(WordListAlert.id)
            .filter(
                WordListAlert.word_list_id == word_list.id,
                WordListAlert.news_id == news.id,
            )
            .first()
        )
        if not existing_alert:
            self.db.add(
                WordListAlert(
                    word_list_id=word_list.id,
                    news_id=news.id,
                    title=f"New match in {word_list.title}",
                    message=f"Related news detected for: {', '.join(matches[:6])}.",
                    match_terms=matches,
                    severity=(
                        "high" if len(matches) >= self.HIGH_SEVERITY_MATCH_COUNT else "medium"
                    ),
                )
            )
            created_alert = True

        try:
            self.db.flush()
        except IntegrityError:
            self.db.rollback()
            return False

        return created_alert

    def set_alert_read(
        self,
        alert_id: int,
        is_read: bool,
    ) -> WordListAlert | None:
        alert = self.db.query(WordListAlert).filter(WordListAlert.id == alert_id).first()
        if not alert:
            return None
        alert.is_read = is_read
        self.db.commit()
        self.db.refresh(alert)
        return alert

    def _word_list_exists(self, word_list_id: int) -> bool:
        return self.db.query(WordList.id).filter(WordList.id == word_list_id).first() is not None
