import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../../lib/axios";
import {
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCol,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CInputGroup,
  CInputGroupText,
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
import { cilCalendar, cilTrash } from "../../lib/icons.js";
import CIcon from "../../lib/Icon.js";

const emptyWordListForm = {
  title: "",
  description: "",
  terms: "",
};

const WORD_LIST_REFRESH_MS = 5000;
const WORD_LIST_NEWS_PAGE_SIZE = 10;
const WORD_LIST_SEARCH_FEEDBACK_MS = 30000;
const tabs = ["Summary", "Results"];

const splitTerms = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const formatDate = (value) => {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

const normalizeText = (value) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

const normalizeUrl = (value) => {
  const text = normalizeText(value);
  if (!text) return "";

  try {
    return new URL(text).href;
  } catch {
    return "";
  }
};

const summarize = (text, max = 180) => {
  const clean = normalizeText(text);
  if (!clean) return "No preview available.";
  if (clean.length <= max) return clean;

  return `${clean.slice(0, max).trim()}...`;
};

const fetchWordLists = async () => {
  const { data } = await api.get("/word-lists");
  return Array.isArray(data) ? data : [];
};

const fetchWordList = async (id) => {
  if (!id) return null;
  const { data } = await api.get(`/word-lists/${id}`);
  return data;
};

const buildPayload = (form) => ({
  title: form.title.trim(),
  description: form.description.trim() || null,
  status: "active",
  keywords: splitTerms(form.terms),
  people: [],
  organizations: [],
  locations: [],
});

const buildPaginationPages = (currentPage, totalPages) => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 4) return [1, 2, 3, 4, 5, "end-ellipsis", totalPages];

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
};

const getAllTerms = (wordList) => wordList?.keywords || [];

const countBy = (items, getKey) => {
  const counts = new Map();
  items.forEach((item) => {
    const key = normalizeText(getKey(item));
    if (!key) return;
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
};

const WordListNewsItem = ({ item }) => {
  const news = item?.news || {};
  const source = normalizeText(news.source_name) || "Unknown source";
  const title = normalizeText(news.title) || "Untitled";
  const articleLink = normalizeUrl(news.link);
  const matchTerms = Array.isArray(item?.match_terms) ? item.match_terms : [];

  return (
    <article className="news-item word-list-news-item">
      <div className="news-item__rail">
        <div>
          <div className="news-item__source" title={source}>
            {source}
          </div>
          <span className="news-item__date">
            <CIcon icon={cilCalendar} size="sm" />
            {formatDate(news.published_at)}
          </span>
        </div>
      </div>

      <div className="news-item__body">
        <div className="news-item__headline">
          {articleLink ? (
            <a href={articleLink} target="_blank" rel="noreferrer">
              {title}
            </a>
          ) : (
            <span>{title}</span>
          )}
        </div>
        <div className="news-item__summary">
          {summarize(news.full_text || news.summary, 180)}
        </div>
        <div className="news-item__footer">
          <div className="news-item__tags">
            {matchTerms.slice(0, 6).map((term) => (
              <CBadge
                color="secondary"
                className="news-tag small d-inline-flex align-items-center px-2 py-1 text-truncate"
                key={term}
                title={term}
              >
                {term}
              </CBadge>
            ))}
          </div>
        </div>
      </div>

      <div className="news-item__aside">
        <div className="news-item__actions">
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
  );
};

const WordList = () => {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState(null);
  const [activeTab, setActiveTab] = useState("Summary");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [wordListForm, setWordListForm] = useState(emptyWordListForm);
  const [newsPage, setNewsPage] = useState(1);
  const [runningWordListId, setRunningWordListId] = useState(null);
  const searchFeedbackTimerRef = useRef(null);

  const { data: wordLists = [], isLoading: isLoadingWordLists } = useQuery({
    queryKey: ["word-lists"],
    queryFn: fetchWordLists,
    staleTime: 0,
    refetchInterval: WORD_LIST_REFRESH_MS,
    refetchIntervalInBackground: true,
    refetchOnReconnect: "always",
    refetchOnWindowFocus: "always",
  });

  const activeWordListId = selectedId || wordLists[0]?.id || null;

  const { data: selectedWordList, isLoading: isLoadingWordList } = useQuery({
    queryKey: ["word-list", activeWordListId],
    queryFn: () => fetchWordList(activeWordListId),
    enabled: Boolean(activeWordListId),
    staleTime: 0,
    refetchInterval: WORD_LIST_REFRESH_MS,
    refetchIntervalInBackground: true,
    refetchOnReconnect: "always",
    refetchOnWindowFocus: "always",
  });

  const createWordList = useMutation({
    mutationFn: (payload) => api.post("/word-lists", payload),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["word-lists"] });
      setSelectedId(response?.data?.id || null);
      setActiveTab("Summary");
      setNewsPage(1);
      setIsCreateOpen(false);
      setWordListForm(emptyWordListForm);
    },
  });

  const runWordListSearch = useMutation({
    mutationFn: (id) => api.post(`/word-lists/${id}/run`),
    onMutate: (id) => {
      if (searchFeedbackTimerRef.current) {
        clearTimeout(searchFeedbackTimerRef.current);
      }
      setRunningWordListId(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["word-lists"] });
      queryClient.invalidateQueries({
        queryKey: ["word-list", activeWordListId],
      });
      searchFeedbackTimerRef.current = setTimeout(() => {
        setRunningWordListId(null);
      }, WORD_LIST_SEARCH_FEEDBACK_MS);
    },
    onError: () => {
      setRunningWordListId(null);
    },
  });

  useEffect(
    () => () => {
      if (searchFeedbackTimerRef.current) {
        clearTimeout(searchFeedbackTimerRef.current);
      }
    },
    [],
  );

  const deleteWordList = useMutation({
    mutationFn: (id) => api.delete(`/word-lists/${id}`),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["word-lists"] });
      queryClient.removeQueries({ queryKey: ["word-list", deletedId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "kpis"] });
      queryClient.invalidateQueries({ queryKey: ["word-list-alerts"] });
      setSelectedId((currentId) =>
        currentId === deletedId ? null : currentId,
      );
      setActiveTab("Summary");
      setNewsPage(1);
      setDeleteTarget(null);
    },
  });

  const handleCreateWordList = (event) => {
    event.preventDefault();
    const payload = buildPayload(wordListForm);
    if (!payload.title) return;
    createWordList.mutate(payload);
  };

  const wordListNews = useMemo(
    () => selectedWordList?.news || [],
    [selectedWordList?.news],
  );
  const allTerms = getAllTerms(selectedWordList);
  const topSources = useMemo(
    () =>
      countBy(
        wordListNews,
        (item) => item?.news?.source_name || "Unknown source",
      ).slice(0, 8),
    [wordListNews],
  );

  const totalNewsPages = Math.ceil(
    wordListNews.length / WORD_LIST_NEWS_PAGE_SIZE,
  );
  const isSearchRunning =
    Boolean(activeWordListId) &&
    String(runningWordListId) === String(activeWordListId);
  const currentNewsPage = Math.min(newsPage, totalNewsPages || 1);
  const paginatedWordListNews = wordListNews.slice(
    (currentNewsPage - 1) * WORD_LIST_NEWS_PAGE_SIZE,
    currentNewsPage * WORD_LIST_NEWS_PAGE_SIZE,
  );
  const paginationPages = buildPaginationPages(currentNewsPage, totalNewsPages);

  return (
    <section className="word-list-page">
      <CRow className="module-header-row">
        <CCol xs={12}>
          <CCard className="records-panel">
            <div className="word-list-monitor-header">
              <div>
                <strong>Word List</strong>
                <small>{wordLists.length} configured lists</small>
              </div>
              <CButton
                color="primary"
                size="sm"
                className="records-new-button"
                onClick={() => setIsCreateOpen(true)}
              >
                <i className="bi bi-plus-lg me-2"></i>
                New list
              </CButton>
            </div>
          </CCard>
        </CCol>
      </CRow>

      {isLoadingWordLists ? (
        <CCard className="records-panel">
          <CCardBody className="records-empty-state">
            <CSpinner />
          </CCardBody>
        </CCard>
      ) : wordLists.length ? (
        <div className="word-list-monitor-layout">
          <div className="word-list-monitor-selector">
            <CFormSelect
              value={activeWordListId || ""}
              onChange={(event) => {
                setSelectedId(event.target.value);
                setActiveTab("Summary");
                setNewsPage(1);
              }}
              aria-label="Select Word List"
            >
              {wordLists.map((wordList) => (
                <option key={wordList.id} value={wordList.id}>
                  {wordList.title}
                </option>
              ))}
            </CFormSelect>
          </div>

          <CCard
            className={`news-results-panel word-list-monitor-panel ${
              isSearchRunning ? "is-processing" : ""
            }`}
            aria-busy={isSearchRunning}
          >
            {isLoadingWordList || !selectedWordList ? (
              <div className="word-list-loading word-list-loading--panel">
                <CSpinner />
              </div>
            ) : (
              <>
                <div className="word-list-monitor-detail-head">
                  <div>
                    <span className="modal-eyebrow">Monitor</span>
                    <h2>{selectedWordList.title}</h2>
                    {selectedWordList.description && (
                      <p>{selectedWordList.description}</p>
                    )}
                    <small>
                      Desde {formatDate(selectedWordList.created_at)} ·
                      Actualizado {formatDate(selectedWordList.updated_at)}
                    </small>
                  </div>
                  <div className="word-list-panel-actions">
                    {selectedWordList.graph ? (
                      <a
                        className="btn btn-outline-secondary"
                        href={`/graph/${selectedWordList.graph.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Graph
                      </a>
                    ) : null}
                    <div
                      className="word-list-action-group"
                      aria-label="Word List actions"
                    >
                      <CButton
                        color="success"
                        size="sm"
                        className="word-list-action-button word-list-action-button--play"
                        onClick={() =>
                          runWordListSearch.mutate(selectedWordList.id)
                        }
                        disabled={
                          runWordListSearch.isPending || isSearchRunning
                        }
                        title={
                          isSearchRunning
                            ? "Search in progress"
                            : "Start search"
                        }
                      >
                        <i
                          className={
                            runWordListSearch.isPending || isSearchRunning
                              ? "bi bi-arrow-clockwise"
                              : "bi bi-play-fill"
                          }
                        ></i>
                      </CButton>
                      <CButton
                        color="danger"
                        variant="outline"
                        size="sm"
                        className="word-list-action-button word-list-action-button--danger"
                        onClick={() => setDeleteTarget(selectedWordList)}
                        disabled={deleteWordList.isPending}
                        title="Delete Word List"
                      >
                        <CIcon icon={cilTrash} />
                      </CButton>
                    </div>
                  </div>
                </div>

                <div className="word-list-monitor-tabs">
                  {tabs.map((tab) => (
                    <button
                      className={activeTab === tab ? "is-active" : ""}
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                <CCardBody className="word-list-monitor-body">
                  {activeTab === "Summary" && (
                    <div className="word-list-summary">
                      <div className="word-list-metrics">
                        <div>
                          <span>News</span>
                          <strong>{selectedWordList.news_count}</strong>
                        </div>
                        <div>
                          <span>New alerts</span>
                          <strong>{selectedWordList.unread_alert_count}</strong>
                        </div>
                        <div>
                          <span>Terms</span>
                          <strong>{allTerms.length}</strong>
                        </div>
                      </div>

                      <div className="word-list-summary-grid word-list-summary-grid--single">
                        <section className="word-list-card">
                          <h3>Top sources</h3>
                          <div className="word-list-ranking">
                            {topSources.length ? (
                              topSources.map((source, index) => (
                                <div key={source.name}>
                                  <span>{index + 1}</span>
                                  <strong>{source.name}</strong>
                                  <em>{source.count}</em>
                                </div>
                              ))
                            ) : (
                              <p className="word-list-empty">No sources yet.</p>
                            )}
                          </div>
                        </section>
                      </div>
                    </div>
                  )}

                  {activeTab === "Results" && (
                    <>
                      <CRow className="g-2 word-list-news-list">
                        {wordListNews.length ? (
                          paginatedWordListNews.map((item) => (
                            <CCol xs={12} key={item.id}>
                              <WordListNewsItem item={item} />
                            </CCol>
                          ))
                        ) : (
                          <div className="word-list-empty">
                            No new news since this list was created.
                          </div>
                        )}
                      </CRow>

                      {totalNewsPages > 1 && (
                        <div className="osint-sources-pagination-wrap">
                          <CPagination aria-label="Word List news pagination">
                            <CPaginationItem
                              disabled={
                                currentNewsPage === 1 || isLoadingWordList
                              }
                              onClick={() =>
                                setNewsPage((prev) => Math.max(1, prev - 1))
                              }
                            >
                              Previous
                            </CPaginationItem>
                            {paginationPages.map((page) =>
                              typeof page === "number" ? (
                                <CPaginationItem
                                  active={page === currentNewsPage}
                                  disabled={isLoadingWordList}
                                  key={page}
                                  onClick={() => setNewsPage(page)}
                                >
                                  {page}
                                </CPaginationItem>
                              ) : (
                                <CPaginationItem
                                  key={page}
                                  className="page-item-ellipsis"
                                  disabled
                                >
                                  ...
                                </CPaginationItem>
                              ),
                            )}
                            <CPaginationItem
                              disabled={
                                currentNewsPage === totalNewsPages ||
                                isLoadingWordList
                              }
                              onClick={() =>
                                setNewsPage((prev) =>
                                  Math.min(totalNewsPages, prev + 1),
                                )
                              }
                            >
                              Next
                            </CPaginationItem>
                          </CPagination>
                        </div>
                      )}
                    </>
                  )}
                </CCardBody>
              </>
            )}
          </CCard>
        </div>
      ) : (
        <CCard className="records-panel">
          <CCardBody className="records-empty-state">
            No lists to show.
          </CCardBody>
        </CCard>
      )}

      <CModal
        visible={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        size="lg"
        alignment="center"
        className="word-list-modal"
      >
        <CModalHeader closeButton={false}>
          <CModalTitle>
            <span>Word List</span>
            <strong>New list</strong>
          </CModalTitle>
        </CModalHeader>
        <CModalBody>
          <form className="word-list-form" onSubmit={handleCreateWordList}>
            <div className="word-list-form-grid">
              <div>
                <CFormLabel>List name</CFormLabel>
                <CFormInput
                  value={wordListForm.title}
                  onChange={(event) =>
                    setWordListForm((prev) => ({
                      ...prev,
                      title: event.target.value,
                    }))
                  }
                  placeholder="Migration, corruption, security..."
                />
              </div>
            </div>
            <div>
              <CFormLabel>Description</CFormLabel>
              <CFormTextarea
                rows={3}
                value={wordListForm.description}
                onChange={(event) =>
                  setWordListForm((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
              />
            </div>
            <WordListField
              label="Group terms"
              field="terms"
              form={wordListForm}
              setForm={setWordListForm}
            />
          </form>
        </CModalBody>
        <CModalFooter>
          <CButton
            color="secondary"
            variant="outline"
            onClick={() => setIsCreateOpen(false)}
          >
            Cancel
          </CButton>
          <CButton
            color="primary"
            onClick={handleCreateWordList}
            disabled={createWordList.isPending}
          >
            {createWordList.isPending ? "Creating..." : "Create list"}
          </CButton>
        </CModalFooter>
      </CModal>

      <CModal
        visible={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        alignment="center"
        className="word-list-modal"
      >
        <CModalHeader closeButton={false}>
          <CModalTitle>
            <span>Word List</span>
            <strong>Delete list</strong>
          </CModalTitle>
        </CModalHeader>
        <CModalBody>
          <p className="mb-0">
            This will delete <strong>{deleteTarget?.title}</strong> along with
            its matches and alerts.
          </p>
        </CModalBody>
        <CModalFooter>
          <CButton
            color="secondary"
            variant="outline"
            onClick={() => setDeleteTarget(null)}
            disabled={deleteWordList.isPending}
          >
            Cancel
          </CButton>
          <CButton
            color="danger"
            onClick={() =>
              deleteTarget?.id && deleteWordList.mutate(deleteTarget.id)
            }
            disabled={deleteWordList.isPending}
          >
            {deleteWordList.isPending ? "Deleting..." : "Delete"}
          </CButton>
        </CModalFooter>
      </CModal>
    </section>
  );
};

const WordListField = ({ label, field, form, setForm }) => (
  <div>
    <CFormLabel>{label}</CFormLabel>
    <CInputGroup>
      <CInputGroupText>
        <i className="bi bi-search"></i>
      </CInputGroupText>
      <CFormInput
        value={form[field]}
        onChange={(event) =>
          setForm((prev) => ({ ...prev, [field]: event.target.value }))
        }
        placeholder="comma separated"
      />
    </CInputGroup>
  </div>
);

export default WordList;
