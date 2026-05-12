import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../../lib/axios";
import {
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormInput,
  CFormLabel,
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
import CIcon from "../../lib/Icon.js";
import {
  cilExternalLink,
  cilLink,
  cilPencil,
  cilPlus,
  cilTrash,
} from "../../lib/icons.js";

const fetchSources = async () => {
  const { data } = await api.get("/osint-sources");
  return Array.isArray(data) ? data : [];
};

const emptySourceForm = {
  name: "",
  url: "",
};

const ITEMS_PER_PAGE = 5;

const OsintSources = () => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [sourceForm, setSourceForm] = useState(emptySourceForm);
  const [editingSource, setEditingSource] = useState(null);
  const [pendingEditPayload, setPendingEditPayload] = useState(null);
  const [sourceToDelete, setSourceToDelete] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [togglingId, setTogglingId] = useState(null);

  const queryClient = useQueryClient();

  const {
    data: sources = [],
    isLoading: isLoadingSources,
    isError: isErrorSources,
  } = useQuery({
    queryKey: ["sources"],
    queryFn: fetchSources,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const createSource = useMutation({
    mutationFn: (payload) => api.post("/osint-sources", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      closeCreateModal();
    },
  });

  const updateSource = useMutation({
    mutationFn: ({ id, data }) => api.put(`/osint-sources/${id}`, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ["sources"] });

      const prev = queryClient.getQueryData(["sources"]);

      queryClient.setQueryData(["sources"], (old = []) =>
        old.map((source) =>
          source.id === id ? { ...source, ...data } : source,
        ),
      );

      return { prev };
    },
    onError: (_, __, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(["sources"], ctx.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      setTogglingId(null);
    },
    onSuccess: () => {
      setPendingEditPayload(null);
      closeEditModal();
    },
  });

  const deleteSource = useMutation({
    mutationFn: (id) => api.delete(`/osint-sources/${id}`),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["sources"] });

      const prev = queryClient.getQueryData(["sources"]);

      queryClient.setQueryData(["sources"], (old = []) =>
        old.filter((source) => source.id !== id),
      );

      return { prev };
    },
    onError: (_, __, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(["sources"], ctx.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      setIsDeleteModalOpen(false);
      setTimeout(() => setSourceToDelete(null), 180);
    },
  });

  const orderedSources = useMemo(() => {
    return [...sources].sort((a, b) => Number(a?.id || 0) - Number(b?.id || 0));
  }, [sources]);

  const filteredSources = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return orderedSources;

    return orderedSources.filter((source) => {
      const name = String(source?.name || "").toLowerCase();
      const url = String(source?.url || "").toLowerCase();
      return name.includes(query) || url.includes(query);
    });
  }, [orderedSources, search]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredSources.length / ITEMS_PER_PAGE),
  );
  const visiblePage = Math.min(currentPage, totalPages);

  const paginatedSources = useMemo(() => {
    const start = (visiblePage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return filteredSources.slice(start, end);
  }, [filteredSources, visiblePage]);

  const closeCreateModal = () => {
    setIsCreateModalOpen(false);
    setSourceForm(emptySourceForm);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditingSource(null);
    setSourceForm(emptySourceForm);
  };

  const openCreateModal = () => {
    setEditingSource(null);
    setSourceForm(emptySourceForm);
    setIsCreateModalOpen(true);
  };

  const openEditModal = (source) => {
    setEditingSource(source);
    setSourceForm({
      name: source?.name || "",
      url: source?.url || "",
    });
    setIsEditModalOpen(true);
  };

  const handleCreate = (e) => {
    e.preventDefault();

    const payload = {
      name: sourceForm.name.trim(),
      url: sourceForm.url.trim(),
      is_active: true,
    };

    if (!payload.name || !payload.url) return;

    createSource.mutate(payload);
  };

  const handlePrepareEdit = (e) => {
    e.preventDefault();

    if (!editingSource) return;

    const payload = {
      name: sourceForm.name.trim(),
      url: sourceForm.url.trim(),
      is_active: Boolean(editingSource.is_active),
    };

    if (!payload.name || !payload.url) return;

    setPendingEditPayload({
      id: editingSource.id,
      data: payload,
    });
  };

  const confirmEdit = () => {
    if (!pendingEditPayload) return;
    updateSource.mutate(pendingEditPayload);
  };

  const handleAskDelete = (source) => {
    setSourceToDelete(source);
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setTimeout(() => setSourceToDelete(null), 180);
  };

  const confirmDelete = () => {
    if (!sourceToDelete) return;
    deleteSource.mutate(sourceToDelete.id);
  };

  const handleToggleActive = (source) => {
    if (togglingId) return;

    setTogglingId(source.id);

    updateSource.mutate({
      id: source.id,
      data: {
        name: source.name,
        url: source.url,
        is_active: !source.is_active,
      },
    });
  };

  return (
    <>
      <CRow className="osint-sources-page module-header-row">
        <CCol xs={12}>
          <CCard className="osint-sources-panel">
            <CCardHeader className="osint-sources-panel__header">
              <div className="osint-sources-panel__title">
                <span>Osint Source</span>
                <small>{filteredSources.length.toLocaleString()} saved</small>
              </div>

              <CInputGroup className="osint-sources-search">
                <CInputGroupText>
                  <i className="bi bi-search"></i>
                </CInputGroupText>
                <CFormInput
                  id="search-source"
                  type="text"
                  placeholder="Search OSINT sources..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </CInputGroup>

              <CButton
                color="primary"
                size="sm"
                className="osint-sources-new-button"
                onClick={openCreateModal}
              >
                <CIcon icon={cilPlus} />
                New source
              </CButton>
            </CCardHeader>
          </CCard>
        </CCol>
      </CRow>

      <CRow className="osint-sources-page module-content-row">
        <CCol xs={12}>
          {isErrorSources ? (
            <CCard className="osint-sources-panel">
              <CCardBody className="text-danger py-4">
                Error loading sources.
              </CCardBody>
            </CCard>
          ) : isLoadingSources && sources.length === 0 ? (
            <CCard className="osint-sources-panel">
              <CCardBody className="osint-sources-empty-state">
                <CSpinner />
              </CCardBody>
            </CCard>
          ) : filteredSources.length === 0 ? (
            <CCard className="osint-sources-panel">
              <CCardBody className="osint-sources-empty-state">
                {search.trim()
                  ? "No sources match the search."
                  : "No sources registered."}
              </CCardBody>
            </CCard>
          ) : (
            <>
              <CCard className="osint-sources-panel">
                <CCardBody className="osint-sources-table-card">
                  <div className="osint-sources-table-wrap">
                    <table className="osint-sources-table">
                      <thead>
                        <tr>
                          <th>Source</th>
                          <th>URL</th>
                          <th>Status</th>
                          <th>Active</th>
                          <th aria-label="Actions"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedSources.map((source) => (
                          <tr key={source.id}>
                            <td>
                              <strong className="osint-sources-name-cell">
                                {source.name}
                              </strong>
                            </td>
                            <td>
                              <a
                                className="osint-sources-url-cell"
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <span>{source.url}</span>
                                <CIcon icon={cilExternalLink} />
                              </a>
                            </td>
                            <td>
                              <span
                                className={`osint-source-status ${source.is_active ? "is-active" : "is-inactive"}`}
                              >
                                {source.is_active ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td className="osint-sources-active-cell">
                              <button
                                type="button"
                                className={`osint-source-toggle ${
                                  source.is_active ? "is-active" : "is-inactive"
                                }`}
                                role="switch"
                                aria-checked={Boolean(source.is_active)}
                                aria-label={`${source.is_active ? "Deactivate" : "Activate"} ${source.name}`}
                                onClick={() => handleToggleActive(source)}
                                disabled={togglingId === source.id}
                              >
                                <span aria-hidden="true" />
                              </button>
                            </td>
                            <td className="osint-sources-action-cell">
                              <div className="osint-source-item__actions">
                                <CButton
                                  color="secondary"
                                  variant="outline"
                                  size="sm"
                                  className="osint-source-action-button"
                                  onClick={() => openEditModal(source)}
                                  title="Edit"
                                >
                                  <CIcon icon={cilPencil} />
                                </CButton>

                                <CButton
                                  color="danger"
                                  variant="outline"
                                  size="sm"
                                  className="osint-source-action-button osint-source-action-button--danger"
                                  onClick={() => handleAskDelete(source)}
                                  disabled={deleteSource.isPending}
                                  title="Delete"
                                >
                                  <CIcon icon={cilTrash} />
                                </CButton>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CCardBody>
              </CCard>

              {filteredSources.length > ITEMS_PER_PAGE && (
                <div className="osint-sources-pagination-wrap">
                  <CPagination aria-label="Sources pagination">
                    <CPaginationItem
                      disabled={visiblePage === 1}
                      onClick={() =>
                        setCurrentPage((prev) => Math.max(prev - 1, 1))
                      }
                    >
                      Previous
                    </CPaginationItem>

                    {Array.from({ length: totalPages }, (_, index) => {
                      const page = index + 1;
                      return (
                        <CPaginationItem
                          key={page}
                          active={page === visiblePage}
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </CPaginationItem>
                      );
                    })}

                    <CPaginationItem
                      disabled={visiblePage === totalPages}
                      onClick={() =>
                        setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                      }
                    >
                      Next
                    </CPaginationItem>
                  </CPagination>
                </div>
              )}
            </>
          )}
        </CCol>
      </CRow>

      <CModal
        visible={isCreateModalOpen}
        onClose={closeCreateModal}
        alignment="center"
        className="osint-source-modal"
      >
        <form onSubmit={handleCreate}>
          <CModalHeader closeButton={false}>
            <CModalTitle>
              <span>Osint Source</span>
              <strong>New source</strong>
            </CModalTitle>
          </CModalHeader>

          <CModalBody>
            <CRow className="g-3">
              <CCol xs={12}>
                <CFormLabel htmlFor="new-source-name">Source name</CFormLabel>
                <CInputGroup>
                  <CInputGroupText>
                    <CIcon icon={cilPlus} />
                  </CInputGroupText>
                  <CFormInput
                    id="new-source-name"
                    type="text"
                    required
                    placeholder="e.g. The Guardian"
                    value={sourceForm.name}
                    onChange={(e) =>
                      setSourceForm((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                  />
                </CInputGroup>
              </CCol>

              <CCol xs={12}>
                <CFormLabel htmlFor="new-source-url">URL</CFormLabel>
                <CInputGroup>
                  <CInputGroupText>
                    <CIcon icon={cilLink} />
                  </CInputGroupText>
                  <CFormInput
                    id="new-source-url"
                    type="url"
                    required
                    placeholder="https://..."
                    value={sourceForm.url}
                    onChange={(e) =>
                      setSourceForm((prev) => ({
                        ...prev,
                        url: e.target.value,
                      }))
                    }
                  />
                </CInputGroup>
              </CCol>
            </CRow>
          </CModalBody>

          <CModalFooter>
            <CButton
              type="button"
              color="secondary"
              variant="outline"
              onClick={closeCreateModal}
              disabled={createSource.isPending}
            >
              Cancel
            </CButton>

            <CButton
              type="submit"
              color="primary"
              disabled={createSource.isPending}
            >
              {createSource.isPending ? (
                <>
                  <CSpinner size="sm" className="me-2" />
                  Saving...
                </>
              ) : (
                <>
                  <CIcon icon={cilPlus} className="me-2" />
                  Add source
                </>
              )}
            </CButton>
          </CModalFooter>
        </form>
      </CModal>

      <CModal
        visible={isEditModalOpen}
        onClose={closeEditModal}
        alignment="center"
        className="osint-source-modal"
      >
        <form onSubmit={handlePrepareEdit}>
          <CModalHeader closeButton={false}>
            <CModalTitle>
              <span>Osint Source</span>
              <strong>Edit source</strong>
            </CModalTitle>
          </CModalHeader>

          <CModalBody>
            <div className="mb-3 small text-medium-emphasis">
              Source: <strong>{editingSource?.name}</strong>
            </div>

            <CRow className="g-3">
              <CCol xs={12}>
                <CFormLabel htmlFor="edit-source-name">Source name</CFormLabel>
                <CInputGroup>
                  <CInputGroupText>
                    <CIcon icon={cilPencil} />
                  </CInputGroupText>
                  <CFormInput
                    id="edit-source-name"
                    type="text"
                    required
                    placeholder="e.g. The Guardian"
                    value={sourceForm.name}
                    onChange={(e) =>
                      setSourceForm((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                  />
                </CInputGroup>
              </CCol>

              <CCol xs={12}>
                <CFormLabel htmlFor="edit-source-url">URL</CFormLabel>
                <CInputGroup>
                  <CInputGroupText>
                    <CIcon icon={cilLink} />
                  </CInputGroupText>
                  <CFormInput
                    id="edit-source-url"
                    type="url"
                    required
                    placeholder="https://..."
                    value={sourceForm.url}
                    onChange={(e) =>
                      setSourceForm((prev) => ({
                        ...prev,
                        url: e.target.value,
                      }))
                    }
                  />
                </CInputGroup>
              </CCol>
            </CRow>
          </CModalBody>

          <CModalFooter>
            <CButton
              type="button"
              color="secondary"
              variant="outline"
              onClick={closeEditModal}
              disabled={updateSource.isPending}
            >
              Cancel
            </CButton>

            <CButton
              type="submit"
              color="primary"
              disabled={updateSource.isPending}
            >
              {updateSource.isPending ? (
                <>
                  <CSpinner size="sm" className="me-2" />
                  Updating...
                </>
              ) : (
                <>
                  <CIcon icon={cilPencil} className="me-2" />
                  Update source
                </>
              )}
            </CButton>
          </CModalFooter>
        </form>
      </CModal>

      <CModal
        visible={Boolean(pendingEditPayload)}
        onClose={() => setPendingEditPayload(null)}
        alignment="center"
        className="osint-source-modal osint-source-confirm-modal"
      >
        <CModalHeader closeButton={false}>
          <CModalTitle>
            <span>Confirmation</span>
            <strong>Update source</strong>
          </CModalTitle>
        </CModalHeader>

        <CModalBody>
          {editingSource && pendingEditPayload ? (
            <>
              <p className="mb-3">
                You are about to update <strong>{editingSource.name}</strong>.
              </p>

              <div className="osint-source-confirm-summary">
                <div className="osint-source-confirm-summary__row">
                  <strong>Name:</strong>
                  <span>{pendingEditPayload.data.name}</span>
                </div>
                <div className="osint-source-confirm-summary__row">
                  <strong>URL:</strong>
                  <span>{pendingEditPayload.data.url}</span>
                </div>
                <div className="osint-source-confirm-summary__row">
                  <strong>Status:</strong>
                  <span>
                    {pendingEditPayload.data.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <p className="mb-0">There are no pending changes to confirm.</p>
          )}
        </CModalBody>

        <CModalFooter>
          <CButton
            color="secondary"
            variant="outline"
            onClick={() => setPendingEditPayload(null)}
            disabled={updateSource.isPending}
          >
            Cancel
          </CButton>

          <CButton
            color="primary"
            onClick={confirmEdit}
            disabled={updateSource.isPending}
          >
            {updateSource.isPending ? (
              <>
                <CSpinner size="sm" className="me-2" />
                Saving...
              </>
            ) : (
              "Confirm changes"
            )}
          </CButton>
        </CModalFooter>
      </CModal>

      <CModal
        visible={isDeleteModalOpen}
        onClose={closeDeleteModal}
        alignment="center"
        className="osint-source-modal osint-source-confirm-modal"
      >
        <CModalHeader closeButton={false}>
          <CModalTitle>
            <span>Confirmation</span>
            <strong>Delete source</strong>
          </CModalTitle>
        </CModalHeader>

        <CModalBody>
          {sourceToDelete && (
            <>
              <p className="mb-3">
                Are you sure you want to delete{" "}
                <strong>{sourceToDelete.name}</strong>?
              </p>

              <div className="osint-source-confirm-summary">
                <div className="osint-source-confirm-summary__row">
                  <strong>Name:</strong>
                  <span>{sourceToDelete.name}</span>
                </div>
                <div className="osint-source-confirm-summary__row">
                  <strong>URL:</strong>
                  <span>{sourceToDelete.url}</span>
                </div>
              </div>
            </>
          )}
        </CModalBody>

        <CModalFooter>
          <CButton
            color="secondary"
            variant="outline"
            onClick={closeDeleteModal}
            disabled={deleteSource.isPending}
          >
            Cancel
          </CButton>

          <CButton
            color="danger"
            onClick={confirmDelete}
            disabled={deleteSource.isPending}
          >
            {deleteSource.isPending ? (
              <>
                <CSpinner size="sm" className="me-2" />
                Deleting...
              </>
            ) : (
              "Delete"
            )}
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  );
};

export default OsintSources;
