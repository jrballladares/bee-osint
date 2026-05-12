import asyncio
import json
import re
import unicodedata
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import parse_qsl, urlencode, urljoin, urlparse, urlunparse

from loguru import logger
from readability import Document
from scrapling.fetchers import AsyncFetcher
from scrapling.parser import Adaptor
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.osint_source import OsintSource
from app.repositories.news_repository import NewsRepository
from app.repositories.osint_source_repository import OsintSourceRepository
from app.services.word_list_service import WordListService
from app.utils.entities import extract_named_entities
from app.utils.http_utils import get_request_headers, parse_datetime


class NewsService:
    MAX_ARTICLES = 15
    MAX_TEXT_LEN = 10_000

    MIN_GOOD_WORDS = 80
    MIN_ACCEPTABLE_WORDS = 35
    SOURCE_BATCH_SIZE = 50
    SOURCE_CONCURRENCY = 4
    ARTICLE_CONCURRENCY = 12
    FAST_LANE_MAX_AGE_DAYS = 14

    PRIMARY_SOURCE_SELECTORS = [
        "article a[href]",
        "main a[href]",
        "h1 a[href]",
        "h2 a[href]",
        "h3 a[href]",
        "[role='main'] a[href]",
        ".entry-title a[href]",
        ".post-title a[href]",
        ".story-title a[href]",
        ".article-title a[href]",
        ".headline a[href]",
    ]

    CONTENT_SELECTORS = [
        "article",
        "main",
        "[role='main']",
        "[itemprop='articleBody']",
        "div[itemprop='articleBody']",
        "section[itemprop='articleBody']",
        ".article-body",
        ".article-content",
        ".article-text",
        ".entry-content",
        ".post-content",
        ".story-content",
        ".story-body",
        ".article__body",
        ".article__content",
        ".content",
        ".main-content",
        ".post-body",
        ".post__content",
        ".news-body",
        ".news-content",
        "#article-body",
        "#main-content",
        "#content",
        "#story-body",
    ]

    PARAGRAPH_SELECTORS = [
        "article p",
        "main p",
        "[role='main'] p",
        "[itemprop='articleBody'] p",
        ".article-body p",
        ".article-content p",
        ".article-text p",
        ".entry-content p",
        ".post-content p",
        ".story-content p",
        ".story-body p",
        ".article__body p",
        ".article__content p",
        ".content p",
        ".main-content p",
        ".post-body p",
        ".post__content p",
        ".news-body p",
        ".news-content p",
        "#article-body p",
        "#main-content p",
        "#content p",
        "#story-body p",
    ]

    ARTICLE_HINTS = [
        "article",
        "story",
        "post",
        "entry",
        "content",
        "body",
        "news",
        "main",
    ]

    NEGATIVE_URL_PATTERNS = [
        r"/tag/",
        r"/tags/",
        r"/author/",
        r"/page/\d+",
        r"/feed/?$",
        r"/rss/?$",
        r"/atom/?$",
        r"/search/",
        r"/sitemap",
        r"/comments?/?$",
        r"/reply/?$",
        r"/newsletter/?$",
        r"/newsletters/?$",
        r"/podcast/?$",
        r"/podcasts/?$",
        r"/video/?$",
        r"/videos/?$",
        r"/album/?$",
        r"/gallery/?$",
        r"/live/?$",
        r"/breaking-news/?$",
        r"/latest/?$",
        r"/section/",
        r"/opinion/?$",
        r"/editorial/?$",
        r"/about/?$",
        r"/contact/?$",
        r"/privacy/?$",
        r"/cookies?/?$",
        r"/terms/?$",
        r"/login/?$",
        r"/signin/?$",
        r"/signup/?$",
        r"/register/?$",
        r"/wp-json/",
        r"/xmlrpc",
        r"/cdn-cgi/",
        r"/(?:ad|ads|advert|advertisement)(?:/|$)",
        r"/track/",
        r"/tracking/",
        r"/pixel/",
        r"/analytics/",
    ]
    _COMPILED_NEGATIVE_URL_PATTERNS = [re.compile(p, re.I) for p in NEGATIVE_URL_PATTERNS]

    _SUSPICIOUS_PATTERNS = [
        r"(^|[-_\s])(ad|ads|advert|advertisement|ad-container|ad-slot)([-_\s]|$)",
        r"(^|[-_\s])(banner|sponsor|sponsored)([-_\s]|$)",
        r"(^|[-_\s])(share|social-share|social-links)([-_\s]|$)",
        r"(^|[-_\s])(sidebar|widget|related|recommended|popular|most-read)([-_\s]|$)",
        r"(^|[-_\s])(newsletter|promo|promotion)([-_\s]|$)",
        r"(^|[-_\s])(navbar|nav|comment|comments|discussion|reply)([-_\s]|$)",
        r"(^|[-_\s])(legal|copyright|terms|cookie|privacy|gdpr)([-_\s]|$)",
        r"(^|[-_\s])(outbrain|taboola)([-_\s]|$)",
    ]
    _COMPILED_SUSPICIOUS_PATTERNS = [re.compile(p, re.I) for p in _SUSPICIOUS_PATTERNS]

    PAYWALL_PATTERNS = [
        r"subscribe to continue reading",
        r"subscribe to read( the)? full article",
        r"sign in to continue reading",
        r"create a free account to continue reading",
        r"register to keep reading",
        r"continue reading with a subscription",
        r"this article is for subscribers",
        r"subscriber[- ]only content",
        r"exclusive content for subscribers",
        r"premium content",
        r"members only",
        r"you've reached your article limit",
        r"to continue reading, please subscribe",
        r"unlock unlimited access",
        r"start your subscription today",
        r"already a subscriber\? sign in",
        r"join now to continue reading",
        r"read more with subscription",
        r"access this article with a subscription",
        r"become a subscriber to access this article",
    ]
    _COMPILED_PAYWALL_PATTERNS = [re.compile(p, re.I) for p in PAYWALL_PATTERNS]

    MONTHS_PATTERN = (
        r"jan|january|feb|february|mar|march|apr|april|may|"
        r"jun|june|jul|july|aug|august|sep|sept|september|"
        r"oct|october|nov|november|dec|december"
    )

    def __init__(self, db: Session):
        self.db = db
        self.repo = NewsRepository(db)
        self.source_repo = OsintSourceRepository(db)

        self.source_semaphore = asyncio.Semaphore(self.SOURCE_CONCURRENCY)
        self.article_semaphore = asyncio.Semaphore(self.ARTICLE_CONCURRENCY)

    @staticmethod
    def _normalize_text(text: str) -> str:
        return re.sub(r"\s+", " ", (text or "")).strip()

    @staticmethod
    def _normalize_multiline_text(text: str) -> str:
        text = (text or "").replace("\r\n", "\n").replace("\r", "\n")
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

    @staticmethod
    def _word_count(text: str) -> int:
        return len((text or "").split())

    @staticmethod
    def _safe_json_loads(value: Any, default: Any) -> Any:
        if value is None:
            return default
        if isinstance(value, str):
            try:
                return json.loads(value)
            except Exception:
                return default
        return value

    @staticmethod
    def _truncate_text(text: str, max_len: int) -> str:
        if len(text) <= max_len:
            return text
        truncated = text[:max_len]
        if " " in truncated:
            truncated = truncated.rsplit(" ", 1)[0]
        return truncated.strip()

    @staticmethod
    def _dedupe_str_list(values: list[Any]) -> list[str]:
        result: list[str] = []
        seen: set[str] = set()

        for value in values:
            if not isinstance(value, str):
                continue
            cleaned = value.strip()
            if not cleaned:
                continue
            key = cleaned.casefold()
            if key in seen:
                continue
            seen.add(key)
            result.append(cleaned)

        return result

    @staticmethod
    def _clean_url(url: str) -> str:
        parsed = urlparse(url)
        filtered_query = [
            (k, v)
            for k, v in parse_qsl(parsed.query, keep_blank_values=True)
            if not k.lower().startswith("utm_")
            and k.lower()
            not in {
                "fbclid",
                "gclid",
                "mc_cid",
                "mc_eid",
                "ref",
                "ref_src",
                "output",
            }
        ]
        cleaned = parsed._replace(
            fragment="",
            query=urlencode(filtered_query, doseq=True),
        )
        return urlunparse(cleaned)

    def _is_insufficient(self, text: str, threshold: int) -> bool:
        return not text or self._word_count(text) < threshold

    def _basic_normalize(self, text: str) -> str:
        text = unicodedata.normalize("NFKC", text or "")
        text = text.replace("\r\n", "\n").replace("\r", "\n")
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

    async def _get_html_with_scrapling(
        self,
        url: str,
    ) -> tuple[str, str, int, dict[str, Any]]:
        page = await AsyncFetcher.get(
            url,
            headers=get_request_headers(url),
            follow_redirects="safe",
            timeout=30,
            retries=3,
            retry_delay=1,
            stealthy_headers=True,
            impersonate="chrome",
        )

        content_type = ""

        try:
            content_type = page.headers.get("content-type", "").lower()
        except Exception:
            pass

        body = page.body

        if isinstance(body, bytes):
            html = body.decode(
                getattr(page, "encoding", None) or "utf-8",
                errors="replace",
            )
        else:
            html = str(body or "")

        final_url = str(getattr(page, "url", url) or url)
        status = int(getattr(page, "status", 0) or 0)

        return (
            html,
            final_url,
            status,
            dict(getattr(page, "headers", {}) or {"content-type": content_type}),
        )

    async def aclose(self) -> None:
        return None

    @staticmethod
    def _parse_html(html: str) -> Any:
        return Adaptor(html or "")

    @staticmethod
    def _selector_attr(elem: Any, name: str, default: str = "") -> str:
        try:
            value = elem.attrib.get(name, default)
        except Exception:
            return default

        if value is None:
            return default
        return str(value)

    @staticmethod
    def _selector_text(elem: Any, separator: str = " ") -> str:
        try:
            text = elem.get_all_text(separator=separator)
        except TypeError:
            text = elem.get_all_text()
        except Exception:
            text = getattr(elem, "text", "") or ""

        return str(text or "").strip()

    @classmethod
    def _selector_html(cls, elem: Any) -> str:
        return str(getattr(elem, "html_content", "") or elem or "")

    def _looks_like_ui_or_legal(self, lower: str, para: str) -> bool:
        keywords = [
            "cookie",
            "cookies",
            "gdpr",
            "privacy",
            "legal",
            "terms",
            "conditions",
            "policy",
            "login",
            "log in",
            "sign in",
            "register",
            "account",
            "password",
            "newsletter",
            "subscribe",
            "subscription",
            "advertising",
            "advertisement",
        ]
        if any(k in lower for k in keywords):
            return True

        if re.search(r"(^|\W)ads?($|\W)", lower):
            return True

        if (
            para.count("|") >= 4
            or para.count("•") >= 5
            or para.count("»") >= 3
            or para.count("→") >= 3
        ):
            return True

        return False

    def _link_heavy(self, para: str) -> bool:
        lower_para = para.lower()
        link_hits = len(re.findall(r"https?://|www\.", lower_para))
        if link_hits >= 3:
            return True

        url_chars = len(re.findall(r"[/:.?=&%#_-]", para))
        if para and (url_chars / len(para)) > 0.24:
            return True

        return False

    def _low_content_density(self, para: str) -> bool:
        if not para:
            return True

        letters = sum(ch.isalpha() for ch in para)
        if len(para) > 0 and (letters / len(para)) < 0.45:
            return True

        digits = sum(ch.isdigit() for ch in para)
        if len(para) > 0 and (digits / len(para)) > 0.25:
            return True

        return False

    def _cta_patterns(self, lower: str) -> bool:
        cta = [
            "read more",
            "continue reading",
            "show more",
            "see more",
            "load more",
            "view more",
            "keep reading",
            "discover more",
            "unlock more",
        ]
        return any(x in lower for x in cta)

    def _contains_paywall_markers(self, text: str) -> bool:
        if not text:
            return False
        return any(p.search(text) for p in self._COMPILED_PAYWALL_PATTERNS)

    def _looks_like_byline_or_dateline(self, text: str) -> bool:
        if not text:
            return False

        line = self._normalize_text(text)
        if not line:
            return False

        lower = line.lower()

        if re.search(r"^(published|updated)\b", lower):
            return True

        if re.match(
            r"^by\s+[A-Z][A-Za-z'’.\-]+(?:\s+[A-Z][A-Za-z'’.\-]+){0,5}$",
            line,
            re.I,
        ):
            return True

        if re.search(
            rf"\b\d{{1,2}}\s+(?:{self.MONTHS_PATTERN})\.?,?\s+\d{{4}}\b",
            lower,
            re.I,
        ):
            return True

        if re.search(
            rf"\b(?:{self.MONTHS_PATTERN})\.?\s+\d{{1,2}},?\s+\d{{4}}\b",
            lower,
            re.I,
        ):
            return True

        if re.search(r"\b\d{1,2}:\d{2}\b", line) and re.search(
            r"\b(?:CET|CEST|UTC|GMT|AM|PM)\b", line, re.I
        ):
            return True

        if re.search(
            rf"^[A-Z][A-Za-z'’.\- ]{{2,40}}\s*[-|•]\s*\d{{1,2}}\s+(?:{self.MONTHS_PATTERN})",
            line,
            re.I,
        ):
            return True

        return False

    def _strip_leading_metadata_lines(self, text: str) -> str:
        if not text:
            return ""

        text = self._basic_normalize(text)
        paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]

        cleaned: list[str] = []
        removed_prefix = True

        for para in paragraphs:
            if removed_prefix and self._looks_like_byline_or_dateline(para):
                continue
            removed_prefix = False
            cleaned.append(para)

        result = self._normalize_multiline_text("\n\n".join(cleaned))

        result = re.sub(
            r"^By\s+[A-Z][^\n]{0,120}\n+",
            "",
            result,
            flags=re.I,
        ).strip()

        return result

    def _remove_subscription_patterns(self, text: str) -> str:
        if not text:
            return ""

        text = self._basic_normalize(text)
        paragraphs = re.split(r"\n\s*\n", text)
        clean: list[str] = []

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue

            if len(para) < 20:
                continue

            lower = para.lower()

            if len(para) < 140:
                if self._cta_patterns(lower):
                    continue
                if self._looks_like_ui_or_legal(lower, para):
                    continue

            if re.match(r"^[\W\d_]+$", para):
                continue

            if self._link_heavy(para):
                continue

            if self._low_content_density(para):
                continue

            clean.append(para)

        cleaned = self._normalize_multiline_text("\n\n".join(clean))
        cleaned = self._strip_leading_metadata_lines(cleaned)
        return cleaned

    def _element_marker(self, elem: Any) -> str:
        try:
            attrs = elem.attrib
        except Exception:
            return ""

        classes = attrs.get("class", "") if attrs else ""
        if isinstance(classes, (list, tuple, set)):
            class_value = " ".join(str(value) for value in classes if value)
        else:
            class_value = str(classes or "")

        id_value = str(attrs.get("id", "") if attrs else "")
        return f"{class_value} {id_value}".strip()

    def _is_junk_element(self, elem: Any) -> bool:
        tag_name = str(getattr(elem, "tag", "") or "").lower()
        junk_tags = [
            "script",
            "style",
            "noscript",
            "meta",
            "link",
            "iframe",
            "embed",
            "object",
            "video",
            "audio",
            "canvas",
            "map",
            "area",
            "svg",
            "math",
            "button",
            "form",
            "input",
            "select",
            "textarea",
            "nav",
            "header",
            "footer",
            "aside",
            "dialog",
            "figure",
            "figcaption",
            "picture",
            "source",
            "amp-ad",
            "amp-embed",
            "amp-social-share",
            "amp-iframe",
            "amp-analytics",
        ]

        if tag_name in junk_tags:
            return True

        marker = self._element_marker(elem)
        return bool(
            marker and any(pattern.search(marker) for pattern in self._COMPILED_SUSPICIOUS_PATTERNS)
        )

    def _element_or_ancestor_is_junk(self, elem: Any) -> bool:
        if self._is_junk_element(elem):
            return True

        try:
            ancestors = elem.iterancestors()
        except Exception:
            ancestors = []

        return any(self._is_junk_element(parent) for parent in ancestors)

    def _remove_junk_elements(self, page: Any) -> None:
        # Scrapling selectors are read-oriented. Cleanup is applied by ignoring
        # junk nodes and their ancestors during extraction instead of mutating DOM.
        return None

    def _extract_clean_text(self, html: str) -> str:
        page = self._parse_html(html)
        self._remove_junk_elements(page)

        article_candidates = page.css("article") or page.css("main") or page.css("body")
        article = article_candidates[0] if article_candidates else page

        blocks: list[str] = []
        seen: set[str] = set()
        for elem in article.css("h1, h2, h3, p, blockquote, li"):
            if self._element_or_ancestor_is_junk(elem):
                continue

            text = self._normalize_text(self._selector_text(elem))
            if not text:
                continue
            key = text.casefold()
            if key in seen:
                continue
            seen.add(key)
            blocks.append(text)

        if blocks:
            return self._normalize_multiline_text("\n\n".join(blocks))

        text = self._selector_text(article, separator="\n\n")
        return self._normalize_multiline_text(text)

    def _extract_meta_description(self, page: Any) -> str:
        selectors = [
            "meta[name='description']",
            "meta[name='twitter:description']",
            "meta[property='og:description']",
            "meta[property='article:description']",
        ]

        for selector in selectors:
            for meta in page.css(selector):
                content = self._selector_attr(meta, "content").strip()
                if content:
                    return content

        return ""

    def _extract_meta_title(self, page: Any) -> str:
        selectors = [
            "meta[property='og:title']",
            "meta[name='twitter:title']",
            "meta[name='title']",
        ]

        for selector in selectors:
            for meta in page.css(selector):
                content = self._selector_attr(meta, "content").strip()
                if content:
                    return content

        for title in page.css("title"):
            text = self._selector_text(title)
            if text:
                return text.strip()

        return ""

    def _extract_subtitle(self, page: Any) -> str:
        subtitle_selectors = [
            "h2",
            ".subtitle",
            ".subheadline",
            ".article-subtitle",
            ".entry-subtitle",
            ".deck",
            ".standfirst",
            ".article-dek",
            ".article-summary",
            ".summary",
            ".excerpt",
            ".lead",
            "[itemprop='description']",
            "meta[name='description']",
            "meta[property='og:description']",
        ]

        for selector in subtitle_selectors:
            elems = page.css(selector)
            if not elems:
                continue

            elem = elems[0]
            if self._element_or_ancestor_is_junk(elem):
                continue

            if str(getattr(elem, "tag", "") or "").lower() == "meta":
                text = self._selector_attr(elem, "content").strip()
            else:
                text = self._selector_text(elem)

            if text and len(text.split()) >= 6:
                return text.strip()

        return ""

    def _extract_featured_image_attrs(self, page: Any) -> tuple[str, str]:
        selectors = [
            "img.wp-post-image",
            "img.featured",
            "img.featured-image",
            "img.article-image",
            "img.hero-image",
            "img[class*='featured']",
            "img[class*='hero']",
            "img[class*='article']",
        ]

        img = None

        for selector in selectors:
            found = page.css(selector)
            if found:
                img = found[0]
                break

        if not img:
            article = page.css("article")
            if article:
                found = article[0].css("img")
                img = found[0] if found else None

        if not img:
            main = page.css("main")
            if main:
                found = main[0].css("img")
                img = found[0] if found else None

        if not img:
            found = page.css("img")
            img = found[0] if found else None

        if not img:
            return "", ""

        alt = self._selector_attr(img, "alt").strip()
        title = self._selector_attr(img, "title").strip()

        return alt, title

    @staticmethod
    def _extract_author_from_ld_json(data: Any) -> str | None:
        if isinstance(data, list):
            for item in data:
                author = NewsService._extract_author_from_ld_json(item)
                if author:
                    return author
            return None

        if not isinstance(data, dict):
            return None

        author = data.get("author")

        if isinstance(author, dict):
            name = author.get("name")
            if isinstance(name, str) and name.strip():
                return name.strip()

        if isinstance(author, list):
            for item in author:
                if isinstance(item, dict):
                    name = item.get("name")
                    if isinstance(name, str) and name.strip():
                        return name.strip()

                elif isinstance(item, str) and item.strip():
                    return item.strip()

        if isinstance(author, str) and author.strip():
            return author.strip()

        creator = data.get("creator")
        if isinstance(creator, dict):
            name = creator.get("name")
            if isinstance(name, str) and name.strip():
                return name.strip()

        if isinstance(creator, list):
            for item in creator:
                if isinstance(item, dict):
                    name = item.get("name")
                    if isinstance(name, str) and name.strip():
                        return name.strip()

                elif isinstance(item, str) and item.strip():
                    return item.strip()

        if isinstance(creator, str) and creator.strip():
            return creator.strip()

        graph = data.get("@graph")
        if isinstance(graph, list):
            for item in graph:
                nested_author = NewsService._extract_author_from_ld_json(item)
                if nested_author:
                    return nested_author

        return None

    def _extract_author(self, page: Any) -> str:
        for meta in page.css("meta"):
            name = self._selector_attr(meta, "name").lower()
            prop = self._selector_attr(meta, "property").lower()
            content = self._selector_attr(meta, "content").strip()
            if not content:
                continue

            if "author" in name or "article:author" in prop or "og:article:author" in prop:
                return content

            if "twitter:creator" in name:
                return content.lstrip("@")

        for script in page.css("script[type='application/ld+json']"):
            raw = self._selector_text(script, separator="")
            if not raw:
                raw_html = self._selector_html(script)
                match = re.search(r"<script\b[^>]*>(.*?)</script>", raw_html, flags=re.I | re.S)
                raw = match.group(1).strip() if match else ""
            if not raw:
                continue

            try:
                data = json.loads(raw)
                author = NewsService._extract_author_from_ld_json(data)
                if author:
                    return author
            except Exception:
                continue

        author_selectors = [
            ".author-name",
            ".author",
            ".byline",
            ".entry-author",
            ".post-author",
            ".article-author",
            ".article__author",
            ".byline__name",
            ".byline-name",
            "[itemprop='author']",
            "[rel='author']",
            "a[rel='author']",
        ]

        for selector in author_selectors:
            elems = page.css(selector)
            if elems:
                elem = elems[0]
                if self._element_or_ancestor_is_junk(elem):
                    continue
                text = self._selector_text(elem)
                if text:
                    text = re.sub(r"^(By|Written by|Author:)\s+", "", text, flags=re.I).strip()
                    if text:
                        return text

        return "Unknown"

    def _extract_publish_date(self, page: Any) -> datetime | None:
        candidates = [
            ("meta[property='article:published_time']", "content"),
            ("meta[property='article:modified_time']", "content"),
            ("meta[property='og:published_time']", "content"),
            ("meta[property='og:updated_time']", "content"),
            ("meta[name='pubdate']", "content"),
            ("meta[name='publish_date']", "content"),
            ("meta[name='publication_date']", "content"),
            ("meta[name='date']", "content"),
            ("meta[name='dc.date']", "content"),
            ("meta[name='dc.date.issued']", "content"),
            ("meta[itemprop='datePublished']", "content"),
            ("meta[itemprop='dateModified']", "content"),
            ("time[datetime]", "datetime"),
        ]

        for selector, field in candidates:
            for tag in page.css(selector):
                value = self._selector_attr(tag, field).strip()
                if not value:
                    continue

                parsed = parse_datetime(value)
                if parsed:
                    return parsed

        return None

    def _path_looks_like_article(self, path: str) -> bool:
        lower = path.lower().rstrip("/")

        if lower.endswith(".html") or lower.endswith(".htm"):
            return True

        if re.search(r"/\d{4}/\d{2}/\d{2}/", lower):
            return True

        if re.search(r"/\d{4}-\d{2}-\d{2}/", lower):
            return True

        segments = [seg for seg in lower.split("/") if seg]
        if len(segments) >= 2:
            slug = segments[-1]
            if (
                len(slug) >= 18
                and "-" in slug
                and not re.fullmatch(r"\d+", slug)
                and not re.fullmatch(r"[a-z]{1,12}", slug)
            ):
                return True

        return False

    def _is_valid_article_url(self, url: str, base_domain: str) -> bool:
        parsed = urlparse(url)

        def norm(domain: str) -> str:
            domain = (domain or "").lower()
            return domain[4:] if domain.startswith("www.") else domain

        if norm(parsed.netloc) != norm(base_domain):
            return False

        path = (parsed.path or "").strip()
        if not path or path == "/":
            return False

        lower = path.lower()

        if any(p.search(lower) for p in self._COMPILED_NEGATIVE_URL_PATTERNS):
            return False

        if re.search(r"\.(jpg|jpeg|png|webp|gif|svg|pdf|mp4|mp3|zip|xml)$", lower):
            return False

        return self._path_looks_like_article(lower)

    async def fetch_and_store_news(self) -> None:
        osint_sources = self.source_repo.list_active_osint_sources()
        if not osint_sources:
            logger.warning("No active OSINT sources found in database.")
            return

        for source in osint_sources:
            await self._process_single_source(source)

    async def fetch_one_news_now(self) -> bool:
        osint_sources = self.source_repo.list_active_osint_sources()
        if not osint_sources:
            logger.warning("No active OSINT sources found in database.")
            return False

        for source in osint_sources:
            source_name = source.name
            if not self.source_repo.is_source_active(source.id):
                continue

            try:
                items = await self._scrape_source_index(source)
                logger.info(f"Fast lane found {len(items)} candidate news from {source_name}")

                for item in items:
                    prepared = await self._prepare_news_item(
                        source,
                        item,
                    )
                    if not prepared:
                        continue

                    payload = prepared["payload"]
                    analysis_text = prepared["analysis_text"]
                    published_at = payload.get("published_at")
                    if isinstance(published_at, datetime):
                        if published_at.tzinfo is None:
                            published_at = published_at.replace(tzinfo=UTC)
                        if published_at < datetime.now(UTC) - timedelta(
                            days=self.FAST_LANE_MAX_AGE_DAYS
                        ):
                            logger.info(
                                f"Fast lane skipped old news from {source_name}: "
                                f"{payload.get('title')}"
                            )
                            continue

                    payload["named_entities"] = self._extract_entities_for_payload(analysis_text)

                    created_news = self.repo.create_news(payload)
                    if created_news is None:
                        logger.info(f"News already exists, skipping: {prepared['link']}")
                        continue

                    WordListService(self.db).match_news(news=created_news)

                    logger.info(f"Fast lane saved news {created_news.id} from {source_name}")
                    return True
            except IntegrityError as exc:
                self.db.rollback()
                logger.debug(f"Fast lane duplicate news for source {source_name}: {exc}")
            except Exception as exc:
                self.db.rollback()
                logger.warning(f"Fast lane failed for source {source_name}: {exc}")

        logger.warning("Fast lane could not save any news item.")
        return False

    async def _process_osint_sources_chunk(
        self,
        osint_sources: list[OsintSource],
    ) -> None:
        tasks = [
            asyncio.create_task(self._process_single_source(source)) for source in osint_sources
        ]
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def _process_single_source(self, source: OsintSource) -> None:
        source_id = source.id
        source_name = source.name
        if not self.source_repo.is_source_active(source.id):
            logger.info(f"Skipping inactive OSINT source: {source_name}")
            return

        try:
            items = await self._scrape_source_index(source)
            logger.info(f"Found {len(items)} news from {source_name}")

            success_count = 0
            for item in items:
                try:
                    processed = await self._process_news_item(
                        source,
                        item,
                    )
                    if processed:
                        success_count += 1
                except Exception as exc:
                    self.db.rollback()
                    link = str(item.get("link") or "").strip()
                    logger.exception(
                        f"Unexpected error processing news from {source_name}: {link} | {exc}"
                    )

            logger.info(f"Finished source {source_name}: {success_count}/{len(items)} news saved.")

        except Exception as exc:
            self.db.rollback()
            logger.error(f"Error processing source {source_name} ({source_id}): {exc}")

    async def _scrape_source_index(self, source: OsintSource) -> list[dict[str, Any]]:
        if not source.url:
            return []

        try:
            raw_html, final_url, status, headers = await self._get_html_with_scrapling(source.url)

            if status < 200 or status >= 400:
                logger.error(f"Failed to fetch {source.url}: status={status}")
                return []

        except Exception as exc:
            logger.error(f"Failed to fetch {source.url}: {exc}")
            return []

        content_type = str(headers.get("content-type", "")).lower()
        if content_type and "html" not in content_type:
            return []

        if not raw_html.strip():
            return []

        page = self._parse_html(raw_html)
        base_domain = urlparse(source.url).netloc
        discovered_links: set[str] = set()

        def normalize_href(href: str | None) -> str | None:
            if not href:
                return None

            href = href.strip()
            if not href or href in {"#", "/"}:
                return None

            lowered = href.lower()
            if lowered.startswith(("javascript:", "mailto:", "tel:", "data:")):
                return None

            url = urljoin(final_url, href)
            parsed = urlparse(url)

            if not parsed.scheme.startswith("http"):
                return None

            return self._clean_url(parsed.geturl())

        all_selectors = self.PRIMARY_SOURCE_SELECTORS + ["a[href]"]

        for selector in all_selectors:
            for anchor in page.css(selector):
                if self._element_or_ancestor_is_junk(anchor):
                    continue

                url = normalize_href(self._selector_attr(anchor, "href"))
                if not url:
                    continue

                if self._is_valid_article_url(url, base_domain):
                    discovered_links.add(url)

                if len(discovered_links) >= self.MAX_ARTICLES:
                    break

            if len(discovered_links) >= self.MAX_ARTICLES:
                break

        now = datetime.now(UTC)
        return [
            {"title": "", "link": link, "published_at": now} for link in sorted(discovered_links)
        ]

    def _extract_text_from_paragraphs(self, page: Any) -> str:
        candidates: list[str] = []
        seen: set[str] = set()

        for selector in self.PARAGRAPH_SELECTORS:
            parts: list[str] = []
            for p in page.css(selector):
                if self._element_or_ancestor_is_junk(p):
                    continue

                text = self._normalize_text(self._selector_text(p))
                if not text or len(text) < 20:
                    continue

                key = text.casefold()
                if key in seen:
                    continue

                seen.add(key)
                parts.append(text)

            if parts:
                candidates.append("\n\n".join(parts))

        if not candidates:
            return ""

        candidates.sort(key=self._word_count, reverse=True)
        return candidates[0]

    def _extract_best_container_text(self, page: Any) -> str:
        best_candidate = ""
        max_words = 0

        for selector in self.CONTENT_SELECTORS:
            for container in page.css(selector):
                if self._element_or_ancestor_is_junk(container):
                    continue

                candidate = self._extract_clean_text(self._selector_html(container))
                words = self._word_count(candidate)
                if words > max_words:
                    max_words = words
                    best_candidate = candidate

        if best_candidate:
            return best_candidate

        for tag in page.css("div, section"):
            if self._element_or_ancestor_is_junk(tag):
                continue

            class_str = self._selector_attr(tag, "class")
            id_str = self._selector_attr(tag, "id")
            ident = f"{class_str} {id_str}".lower()

            if not any(key in ident for key in self.ARTICLE_HINTS):
                continue

            candidate = self._extract_clean_text(self._selector_html(tag))
            words = self._word_count(candidate)
            if words > max_words:
                max_words = words
                best_candidate = candidate

        return best_candidate

    def _build_fallback_preview(
        self,
        title: str,
        subtitle: str,
        meta_desc: str,
        text: str,
    ) -> str:
        blocks: list[str] = []

        if title:
            blocks.append(title.strip())

        if (
            subtitle
            and subtitle.strip()
            and subtitle.strip().casefold() != title.strip().casefold()
        ):
            blocks.append(subtitle.strip())

        if meta_desc and meta_desc.strip():
            meta_clean = meta_desc.strip()
            if meta_clean.casefold() not in {b.casefold() for b in blocks}:
                blocks.append(meta_clean)

        if text and self._word_count(text) >= 20:
            short_text = self._truncate_text(text, 1200)
            if short_text.casefold() not in {b.casefold() for b in blocks}:
                blocks.append(short_text)

        preview = self._normalize_multiline_text("\n\n".join(blocks))
        preview = self._strip_leading_metadata_lines(preview)
        return preview

    async def _fetch_news_content(self, link: str) -> tuple[str, datetime, str, str, str, str]:
        try:
            raw_html, final_url, status, headers = await self._get_html_with_scrapling(link)

            if status < 200 or status >= 400:
                logger.error(f"Failed to fetch news {link}: status={status}")
                return "", datetime.now(UTC), "", "Unknown", "", ""

        except Exception as exc:
            logger.error(f"Failed to fetch news {link}: {exc}")
            return "", datetime.now(UTC), "", "Unknown", "", ""

        content_type = str(headers.get("content-type", "")).lower()
        if content_type and "html" not in content_type:
            return "", datetime.now(UTC), "", "Unknown", "", ""

        if not raw_html.strip():
            return "", datetime.now(UTC), "", "Unknown", "", ""

        page = self._parse_html(raw_html)

        title_nodes = page.css("title")
        page_title = self._selector_text(title_nodes[0]) if title_nodes else ""
        h1_nodes = page.css("h1")
        h1_node = h1_nodes[0] if h1_nodes else None
        h1_text = self._selector_text(h1_node) if h1_node else ""

        logger.debug(
            f"FETCH {link} status={status} "
            f"final_url={final_url} "
            f"page_title={page_title[:120]!r} "
            f"h1={h1_text[:120]!r}"
        )

        raw_page_text = self._normalize_text(self._selector_text(page))
        logger.debug(f"RAW PAGE SAMPLE {link}: {raw_page_text[:500]!r}")

        title = ""
        if h1_node:
            title = self._selector_text(h1_node)

        if not title:
            title = self._extract_meta_title(page)

        if not title:
            title = page_title

        author = self._extract_author(page)
        meta_desc = self._extract_meta_description(page)
        subtitle = self._extract_subtitle(page)
        alt_text, image_title = self._extract_featured_image_attrs(page)
        published_at = self._extract_publish_date(page) or datetime.now(UTC)

        has_paywall = self._contains_paywall_markers(raw_page_text)

        candidates: list[tuple[str, str]] = []

        try:
            doc = Document(raw_html)
            readability_html = doc.summary(html_partial=True)
            candidate = self._extract_clean_text(readability_html)
            if candidate:
                candidates.append(("readability", candidate))
        except Exception as exc:
            logger.debug(f"Readability failed for {link}: {exc}")

        paragraph_text = self._extract_text_from_paragraphs(page)
        if paragraph_text:
            candidates.append(("paragraphs", paragraph_text))

        container_text = self._extract_best_container_text(page)
        if container_text:
            candidates.append(("container", container_text))

        if subtitle:
            candidates.append(("subtitle", subtitle))
        if meta_desc:
            candidates.append(("meta_desc", meta_desc))
        if alt_text:
            candidates.append(("image_alt", alt_text))
        if image_title:
            candidates.append(("image_title", image_title))

        best_source = ""
        best_text = ""
        best_words = 0

        for source_name, candidate in candidates:
            cleaned = self._remove_subscription_patterns(candidate)
            cleaned = self._strip_leading_metadata_lines(cleaned)
            words = self._word_count(cleaned)

            if words > best_words:
                best_words = words
                best_text = cleaned
                best_source = source_name

        full_text = best_text

        if self._is_insufficient(full_text, self.MIN_ACCEPTABLE_WORDS):
            full_text = self._build_fallback_preview(
                title=title,
                subtitle=subtitle,
                meta_desc=meta_desc,
                text=full_text,
            )

        if has_paywall and self._word_count(full_text) < self.MIN_GOOD_WORDS:
            full_text = self._build_fallback_preview(
                title=title,
                subtitle=subtitle,
                meta_desc=meta_desc,
                text=full_text,
            )

        full_text = self._strip_leading_metadata_lines(full_text)

        if full_text:
            full_text = self._truncate_text(full_text, self.MAX_TEXT_LEN)

        logger.debug(
            f"Extraction for {link}: source={best_source or 'fallback'} "
            f"words={self._word_count(full_text)} paywall={has_paywall}"
        )

        return full_text, published_at, title, author, meta_desc, subtitle

    def _build_analysis_text(
        self,
        *,
        title: str,
        subtitle: str,
        meta_desc: str,
        full_text: str,
    ) -> str:
        analysis_parts = [
            (title or "").strip(),
            (subtitle or "").strip(),
            (meta_desc or "").strip(),
            (full_text or "").strip(),
        ]
        analysis_text = "\n\n".join(part for part in analysis_parts if part)
        return self._truncate_text(
            self._normalize_multiline_text(analysis_text),
            self.MAX_TEXT_LEN,
        )

    def _apply_analysis_result(
        self,
        payload: dict[str, Any],
        analysis_result: dict[str, Any],
    ) -> None:
        if not self._has_analysis_result(analysis_result):
            return

        extracted_entities = analysis_result.get("named_entities", {}) or {}
        payload["named_entities"] = {
            "people": self._dedupe_str_list(extracted_entities.get("people", [])),
            "organizations": self._dedupe_str_list(extracted_entities.get("organizations", [])),
            "locations": self._dedupe_str_list(extracted_entities.get("locations", [])),
        }

    @staticmethod
    def _extract_entities_for_payload(text: str) -> dict[str, list[str]]:
        extracted_entities = extract_named_entities(text)
        return {
            "people": NewsService._dedupe_str_list(extracted_entities.get("people", [])),
            "organizations": NewsService._dedupe_str_list(
                extracted_entities.get("organizations", [])
            ),
            "locations": NewsService._dedupe_str_list(extracted_entities.get("locations", [])),
        }

    @staticmethod
    def _has_analysis_result(analysis_result: dict[str, Any]) -> bool:
        entities = analysis_result.get("named_entities", {}) or {}
        return any(
            entities.get(entity_type) for entity_type in ("people", "organizations", "locations")
        )

    async def _prepare_news_item(
        self,
        source: OsintSource,
        item: dict[str, Any],
    ) -> dict[str, Any] | None:
        source_id = source.id
        async with self.article_semaphore:
            link = str(item.get("link") or "").strip()
            if not link or self.repo.news_exists(link):
                if link:
                    logger.info(f"News already exists, skipping: {link}")
                return None

            try:
                (
                    full_text,
                    published_at,
                    title,
                    author,
                    meta_desc,
                    subtitle,
                ) = await self._fetch_news_content(link)

                if not title and self._word_count(full_text) < 20:
                    logger.warning(f"Skipping weak extraction: {link}")
                    return None

                analysis_text = self._build_analysis_text(
                    title=title,
                    subtitle=subtitle,
                    meta_desc=meta_desc,
                    full_text=full_text,
                )

                safe_title = (title or "").strip()
                if not safe_title and meta_desc:
                    safe_title = meta_desc[:140].strip()
                if not safe_title:
                    safe_title = link[:200].strip()

                payload = {
                    "source_id": source_id,
                    "title": safe_title,
                    "link": link,
                    "author": (author or "Unknown").strip(),
                    "published_at": published_at,
                    "full_text": full_text,
                    "named_entities": {
                        "people": [],
                        "organizations": [],
                        "locations": [],
                    },
                }

                return {
                    "payload": payload,
                    "analysis_text": analysis_text,
                    "link": link,
                }

            except Exception as exc:
                logger.exception(f"Error preparing news {link}: {exc}")
                return None

    async def _save_prepared_news_batches(self, prepared_items: list[dict[str, Any]]) -> int:
        success_count = 0

        for prepared in prepared_items:
            payload = prepared["payload"]
            link = prepared["link"]
            analysis_text = prepared["analysis_text"]
            payload["named_entities"] = self._extract_entities_for_payload(analysis_text)

            try:
                created_news = self.repo.create_news(payload)
                if created_news is None:
                    logger.info(f"News already exists, skipping: {link}")
                    continue

                WordListService(self.db).match_news(news=created_news)
                success_count += 1
            except IntegrityError as exc:
                self.db.rollback()
                logger.info(f"News already exists, skipping: {link}")
                logger.debug(f"IntegrityError while saving news {link}: {exc}")
            except SQLAlchemyError as exc:
                self.db.rollback()
                logger.error(f"Database error saving news {link}: {exc}")
            except Exception as exc:
                self.db.rollback()
                logger.error(f"Error saving news {link}: {exc}")

        return success_count

    async def _process_news_item(self, source: OsintSource, item: dict[str, Any]) -> bool:
        link = str(item.get("link") or "").strip()

        try:
            prepared = await self._prepare_news_item(source, item)
            if not prepared:
                return False

            payload = prepared["payload"]
            link = prepared["link"]
            analysis_text = prepared["analysis_text"]

            payload["named_entities"] = self._extract_entities_for_payload(analysis_text)
            named_entities = payload.get("named_entities", {}) or {}
            logger.debug(
                f"Prepared news {link}: words={self._word_count(analysis_text)} "
                f"people={len(named_entities.get('people', []))} "
                f"orgs={len(named_entities.get('organizations', []))} "
                f"locations={len(named_entities.get('locations', []))}"
            )

            created_news = self.repo.create_news(payload)
            if created_news is None:
                logger.info(f"News already exists, skipping: {link}")
                return False

            WordListService(self.db).match_news(news=created_news)
            return True

        except IntegrityError as exc:
            self.db.rollback()
            logger.info(f"News already exists, skipping: {link}")
            logger.debug(f"IntegrityError while saving news {link}: {exc}")
            return False
        except SQLAlchemyError as exc:
            self.db.rollback()
            logger.error(f"Database error processing news {link}: {exc}")
            return False
        except Exception as exc:
            self.db.rollback()
            logger.error(f"Error processing news {link}: {exc}")
            return False

    def get_paginated_news(
        self,
        *,
        page: int = 1,
        page_size: int = 20,
        query_text: str | None = None,
    ) -> dict[str, Any]:
        page = max(1, page)
        page_size = max(1, page_size)

        results, total_count = self.repo.get_paginated_news(
            page=page,
            page_size=page_size,
            query_text=query_text,
        )

        serialized: list[dict[str, Any]] = []
        for news_item, source_name in results:
            named_entities = self._safe_json_loads(
                news_item.named_entities,
                {"people": [], "organizations": [], "locations": []},
            )
            sentiment = self.repo.classify_sentiment(
                " ".join(part for part in (news_item.title, news_item.full_text) if part)
            )
            serialized.append(
                {
                    "id": news_item.id,
                    "source_id": news_item.source_id,
                    "source_name": source_name,
                    "title": news_item.title,
                    "link": news_item.link,
                    "author": news_item.author,
                    "published_at": news_item.published_at,
                    "fetched_at": news_item.fetched_at,
                    "full_text": news_item.full_text,
                    "named_entities": named_entities,
                    "sentiment": sentiment["key"],
                    "sentiment_label": sentiment["label"],
                    "sentiment_score": sentiment["score"],
                }
            )

        total_pages = (total_count + page_size - 1) // page_size if total_count > 0 else 0

        return {
            "news": serialized,
            "page": page,
            "page_size": page_size,
            "total_count": total_count,
            "total_pages": total_pages,
        }

    def get_news(self, news_id: int) -> dict[str, Any] | None:
        result = self.repo.get_news(news_id)

        if not result:
            return None

        news_item, source_name = result

        named_entities = self._safe_json_loads(
            news_item.named_entities,
            {"people": [], "organizations": [], "locations": []},
        )
        sentiment = self.repo.classify_sentiment(
            " ".join(part for part in (news_item.title, news_item.full_text) if part)
        )

        return {
            "id": news_item.id,
            "source_id": news_item.source_id,
            "source_name": source_name,
            "title": news_item.title,
            "link": news_item.link,
            "author": news_item.author,
            "published_at": news_item.published_at,
            "fetched_at": news_item.fetched_at,
            "full_text": news_item.full_text,
            "named_entities": named_entities,
            "sentiment": sentiment["key"],
            "sentiment_label": sentiment["label"],
            "sentiment_score": sentiment["score"],
        }
