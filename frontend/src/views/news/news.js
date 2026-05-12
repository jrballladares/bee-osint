import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CPagination,
  CPaginationItem,
  CRow,
  CSpinner,
} from "../../lib/ui.js";
import { cilCalendar } from "../../lib/icons.js";
import CIcon from "../../lib/Icon.js";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import api from "../../lib/axios";

const PAGE_SIZE = 12;
const TAG_MAX_WIDTH = 360;

function normalizeText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeKey(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeStringList(values) {
  if (!Array.isArray(values)) return [];

  return values.map((item) => normalizeText(item)).filter(Boolean);
}

function normalizeEntityList(values) {
  return normalizeStringList(values);
}

function normalizeUrl(value) {
  const text = normalizeText(value);
  if (!text) return "";

  try {
    const url = new URL(text);
    return url.href;
  } catch {
    return "";
  }
}

function getNewsEntities(item) {
  return {
    people: normalizeEntityList(item?.named_entities?.people),
    organizations: normalizeEntityList(item?.named_entities?.organizations),
    locations: normalizeEntityList(item?.named_entities?.locations),
  };
}

function getItemKey(item, index) {
  return item?.id ?? item?.link ?? `${item?.title || "news"}-${index}`;
}

async function fetchNews(page) {
  const { data } = await api.get("/news/", {
    params: {
      page,
      page_size: PAGE_SIZE,
    },
  });

  return {
    news: Array.isArray(data?.news) ? data.news : [],
    total_count: Number(data?.total_count) || 0,
    total_pages: Number(data?.total_pages) || 0,
  };
}

async function fetchNewsById(id) {
  if (!id) return null;

  const { data } = await api.get(`/news/${id}`);
  return data ?? null;
}

function formatDate(value) {
  if (!value) return "Date unavailable";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";

  return format(date, "d MMM, HH:mm", { locale: enUS });
}

function summarize(text, max = 180) {
  if (!text) return "No preview available.";

  const clean = String(text).replace(/\s+/g, " ").trim();
  if (!clean) return "No preview available.";
  if (clean.length <= max) return clean;

  return `${clean.slice(0, max).trim()}...`;
}

function buildPaginationPages(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "end-ellipsis", totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [
      1,
      "start-ellipsis",
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }

  return [
    1,
    "start-ellipsis",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "end-ellipsis",
    totalPages,
  ];
}

function getTagColor(type) {
  if (type === "person") return "info";
  if (type === "organization") return "warning";
  if (type === "location") return "success";
  return "secondary";
}

function getSentiment(item) {
  const key = normalizeKey(item?.sentiment) || "neutral";

  if (key === "positive") return { key, label: "Positive" };
  if (key === "negative") return { key, label: "Negative" };

  return { key: "neutral", label: "Neutral" };
}

const tagClass =
  "news-tag small d-inline-flex align-items-center px-2 py-1 text-truncate";

function Tag({ type = "secondary", children, title }) {
  const text = title || String(children || "");

  return (
    <CBadge
      color={getTagColor(type)}
      className={`${tagClass} news-tag--${type}`}
      style={{ maxWidth: TAG_MAX_WIDTH }}
      title={text}
    >
      {children}
    </CBadge>
  );
}

function NewsCard({ item, index, onOpenDetail }) {
  const itemKey = getItemKey(item, index);
  const { people, organizations, locations } = getNewsEntities(item);
  const articleLink = normalizeUrl(item?.link);
  const author = normalizeText(item?.author);
  const source = normalizeText(item?.source_name) || "Unknown source";
  const sentiment = getSentiment(item);
  const tags = [
    ...people.slice(0, 2).map((value) => ({ value, type: "person" })),
    ...organizations
      .slice(0, 2)
      .map((value) => ({ value, type: "organization" })),
    ...locations.slice(0, 2).map((value) => ({ value, type: "location" })),
  ];

  return (
    <CCol xs={12}>
      <article className="news-item">
        <div className="news-item__rail">
          <div>
            <div className="news-item__source" title={source}>
              {source}
            </div>
            <span className="news-item__date">
              <CIcon icon={cilCalendar} size="sm" />
              {formatDate(item?.published_at)}
            </span>
          </div>
        </div>

        <div className="news-item__body">
          <div className="news-item__headline">
            <button
              type="button"
              onClick={() => onOpenDetail(item?.id)}
              disabled={!item?.id}
            >
              {normalizeText(item?.title) || "Untitled"}
            </button>
          </div>

          <div className="news-item__summary">
            {summarize(item?.full_text, 180)}
          </div>

          <div className="news-item__footer">
            <div className="news-item__tags">
              {tags.map((tag) => (
                <Tag
                  key={`${tag.type}-${itemKey}-${tag.value}`}
                  type={tag.type}
                  title={tag.value}
                >
                  {tag.value}
                </Tag>
              ))}
            </div>
          </div>
        </div>

        <div className="news-item__aside">
          <span className={`news-sentiment news-sentiment--${sentiment.key}`}>
            {sentiment.label}
          </span>

          {author && normalizeKey(author) !== "unknown" && (
            <span className="news-item__author" title={author}>
              {author}
            </span>
          )}

          <div className="news-item__actions">
            <CButton
              color="primary"
              variant="outline"
              size="sm"
              onClick={() => onOpenDetail(item?.id)}
              disabled={!item?.id}
            >
              Detail
            </CButton>

            <CButton
              color="secondary"
              variant="outline"
              size="sm"
              as={articleLink ? "a" : "button"}
              title="Open source"
              {...(articleLink
                ? {
                    href: articleLink,
                    target: "_blank",
                    rel: "noopener noreferrer",
                  }
                : { disabled: true })}
            >
              <i className="bi bi-box-arrow-up-right"></i>
            </CButton>
          </div>
        </div>
      </article>
    </CCol>
  );
}

function NewsDetailModal({ visible, newsId, onClose }) {
  const {
    data: selectedNews,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["news-detail", newsId],
    queryFn: () => fetchNewsById(newsId),
    enabled: Boolean(newsId && visible),
    staleTime: 60_000,
  });

  const selectedNewsLink = normalizeUrl(selectedNews?.link);
  const detailEntities = useMemo(() => {
    const entities = getNewsEntities(selectedNews);

    return {
      people: entities.people.slice(0, 2),
      organizations: entities.organizations.slice(0, 2),
      locations: entities.locations.slice(0, 2),
    };
  }, [selectedNews]);
  const selectedSource =
    normalizeText(selectedNews?.source_name) || "Unknown source";
  const selectedAuthor = normalizeText(selectedNews?.author);

  const paragraphs = useMemo(() => {
    const text = normalizeText(selectedNews?.full_text);

    if (!text) return [];

    return text
      .split(/\n\s*\n/g)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);
  }, [selectedNews?.full_text]);

  return (
    <CModal
      alignment="center"
      visible={visible}
      onClose={onClose}
      size="lg"
      className="news-detail-modal"
    >
      <CModalHeader closeButton={false}>
        <CModalTitle>
          <span>News detail</span>
          <strong>{normalizeText(selectedNews?.title) || "Detail"}</strong>
        </CModalTitle>
      </CModalHeader>

      <CModalBody>
        {isLoading ? (
          <div className="d-flex justify-content-center py-4">
            <CSpinner className="text-primary" />
          </div>
        ) : isError ? (
          <div className="text-center text-danger py-4">
            Could not load the detail.
          </div>
        ) : selectedNews ? (
          <>
            <div className="news-detail-meta">
              <div className="news-detail-source">
                <span>{selectedSource}</span>
                {selectedAuthor &&
                  normalizeKey(selectedAuthor) !== "unknown" && (
                    <small>{selectedAuthor}</small>
                  )}
              </div>

              <div className="news-detail-facts">
                <span className="news-item__date">
                  <CIcon icon={cilCalendar} size="sm" />
                  {formatDate(selectedNews?.published_at)}
                </span>
              </div>
            </div>

            <div className="news-detail-actions">
              <CButton
                color="primary"
                variant="outline"
                size="sm"
                as={selectedNewsLink ? "a" : "button"}
                {...(selectedNewsLink
                  ? {
                      href: selectedNewsLink,
                      target: "_blank",
                      rel: "noopener noreferrer",
                    }
                  : { disabled: true })}
              >
                Open source <i className="bi bi-box-arrow-up-right ms-1"></i>
              </CButton>
            </div>

            <div className="news-detail-tags">
              {detailEntities.people.map((person) => (
                <Tag
                  key={`modal-person-${person}`}
                  type="person"
                  title={person}
                >
                  {person}
                </Tag>
              ))}

              {detailEntities.organizations.map((organization) => (
                <Tag
                  key={`modal-organization-${organization}`}
                  type="organization"
                  title={organization}
                >
                  {organization}
                </Tag>
              ))}

              {detailEntities.locations.map((location) => (
                <Tag
                  key={`modal-location-${location}`}
                  type="location"
                  title={location}
                >
                  {location}
                </Tag>
              ))}
            </div>

            <div className="news-detail-content">
              {paragraphs.length > 0 ? (
                paragraphs.map((paragraph, index) => (
                  <p
                    key={`${index}-${paragraph.slice(0, 20)}`}
                    className="mb-3"
                  >
                    {paragraph}
                  </p>
                ))
              ) : (
                <p className="mb-0">No content.</p>
              )}
            </div>
          </>
        ) : (
          <div className="text-center text-medium-emphasis py-4">
            Could not load the detail.
          </div>
        )}
      </CModalBody>

      <CModalFooter>
        <CButton
          color="secondary"
          variant="outline"
          size="sm"
          onClick={onClose}
        >
          Close
        </CButton>
      </CModalFooter>
    </CModal>
  );
}

const News = () => {
  const [page, setPage] = useState(1);
  const [selectedNewsId, setSelectedNewsId] = useState(null);

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ["news", page],
    queryFn: () => fetchNews(page),
    staleTime: 60_000,
    placeholderData: (previousData) => previousData,
  });

  const newsItems = data?.news ?? [];
  const totalCount = Number(data?.total_count) || 0;
  const totalPagesFromApi = Number(data?.total_pages) || 0;
  const totalPages =
    totalPagesFromApi > 0
      ? totalPagesFromApi
      : totalCount > 0
        ? Math.ceil(totalCount / PAGE_SIZE)
        : 0;
  const paginationPages = buildPaginationPages(page, totalPages);

  if (isError) {
    return (
      <CCard className="mb-4">
        <CCardBody className="text-center py-5 text-danger">
          Could not load news.
        </CCardBody>
      </CCard>
    );
  }

  return (
    <>
      <CRow className="news-page module-content-row">
        <CCol xs={12}>
          <CCard className="news-results-panel">
            <CCardHeader className="d-flex align-items-center justify-content-between">
              <div>
                <span>Recent news</span>
                <small>{totalCount.toLocaleString()} news sorted by date</small>
              </div>

              {isFetching && (
                <span className="d-flex align-items-center gap-2 text-medium-emphasis">
                  <CSpinner size="sm" className="text-primary" />
                  Updating...
                </span>
              )}
            </CCardHeader>

            <CCardBody>
              {isLoading ? (
                <div
                  className="d-flex justify-content-center align-items-center"
                  style={{ minHeight: 260 }}
                >
                  <CSpinner className="text-primary" />
                </div>
              ) : newsItems.length === 0 ? (
                <div className="text-center text-medium-emphasis py-5">
                  No news yet
                </div>
              ) : (
                <CRow className="g-2">
                  {newsItems.map((item, index) => (
                    <NewsCard
                      key={getItemKey(item, index)}
                      item={item}
                      index={index}
                      onOpenDetail={setSelectedNewsId}
                    />
                  ))}
                </CRow>
              )}
            </CCardBody>
          </CCard>

          {totalPages > 1 && !isLoading && (
            <div className="osint-sources-pagination-wrap">
              <CPagination aria-label="News pagination">
                <CPaginationItem
                  disabled={page === 1 || isFetching}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                >
                  Previous
                </CPaginationItem>

                {paginationPages.map((p) =>
                  typeof p === "number" ? (
                    <CPaginationItem
                      key={p}
                      active={p === page}
                      disabled={isFetching}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </CPaginationItem>
                  ) : (
                    <CPaginationItem
                      key={p}
                      className="page-item-ellipsis"
                      disabled
                    >
                      ...
                    </CPaginationItem>
                  ),
                )}

                <CPaginationItem
                  disabled={page === totalPages || isFetching}
                  onClick={() =>
                    setPage((prev) => Math.min(totalPages, prev + 1))
                  }
                >
                  Next
                </CPaginationItem>
              </CPagination>
            </div>
          )}
        </CCol>
      </CRow>

      <NewsDetailModal
        visible={Boolean(selectedNewsId)}
        newsId={selectedNewsId}
        onClose={() => setSelectedNewsId(null)}
      />
    </>
  );
};

export default News;
