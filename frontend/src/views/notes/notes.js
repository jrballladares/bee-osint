import React, { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormInput,
  CFormTextarea,
  CInputGroup,
  CInputGroupText,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
  CSpinner,
} from "../../lib/ui.js";
import {
  cilCalendar,
  cilCloudUpload,
  cilCode,
  cilDelete,
  cilPlus,
  cilSave,
  cilX,
} from "../../lib/icons.js";
import CIcon from "../../lib/Icon.js";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";

import api from "../../lib/axios";

const API_BASE_URL =
  api.defaults.baseURL?.split("/api/v1")[0] || "http://localhost:8000";

const EMPTY_NOTE_TEMPLATE = "";

const FORMAT_ACTIONS = [
  { label: "Title", icon: "bi-type-h1", before: "# ", after: "", block: true },
  {
    label: "Subtitle",
    icon: "bi-type-h2",
    before: "## ",
    after: "",
    block: true,
  },
  { label: "Negrita", icon: "bi-type-bold", before: "**", after: "**" },
  { label: "Cursiva", icon: "bi-type-italic", before: "*", after: "*" },
  { label: "Lista", icon: "bi-list-ul", before: "- ", after: "", block: true },
  {
    label: "Number",
    icon: "bi-list-ol",
    before: "1. ",
    after: "",
    block: true,
  },
  { label: "Cita", icon: "bi-quote", before: "> ", after: "", block: true },
  { label: "Code", icon: "bi-code-square", before: "`", after: "`" },
];

function normalizeText(value) {
  return String(value ?? "")
    .replace(/\r/g, "")
    .trim();
}

function normalizeSearch(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeNoteContent(value) {
  return String(value ?? "")
    .replace(/\r/g, "")
    .trim();
}

function formatDate(value) {
  if (!value) return "Date unavailable";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";

  return format(date, "d MMM yyyy • HH:mm", { locale: enUS });
}

function cleanPreviewLine(line) {
  return String(line || "")
    .replace(/^#{1,6}\s+/, "")
    .replace(/^>\s?/, "")
    .replace(/^[-*+]\s+/, "")
    .replace(/^\d+\.\s+/, "")
    .replace(/!\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .trim();
}

function firstLinePreview(content, maxLen = 160) {
  const raw = String(content || "").replace(/\r/g, "");
  const lines = raw.split("\n").map((line) => cleanPreviewLine(line.trim()));
  const first = lines.find((line) => line.length > 0);

  if (!first) return "";
  if (first.length <= maxLen) return first;

  return `${first.slice(0, maxLen).trimEnd()}...`;
}

function notePreview(content, maxLen = 260, maxLines = 3) {
  const raw = String(content || "").replace(/\r/g, "");
  const lines = raw
    .split("\n")
    .map((line) => cleanPreviewLine(line.trim()))
    .filter(Boolean)
    .slice(0, maxLines);

  const preview = lines.join(" ");
  if (preview.length <= maxLen) return preview;

  return `${preview.slice(0, maxLen).trimEnd()}...`;
}

function countWords(content) {
  const words = normalizeText(content).match(/\S+/g);
  return words?.length || 0;
}

function sortNotesByDate(notes) {
  return [...notes].sort((a, b) => {
    const aTime = new Date(a?.created_at).getTime();
    const bTime = new Date(b?.created_at).getTime();

    return (
      (Number.isFinite(bTime) ? bTime : 0) -
      (Number.isFinite(aTime) ? aTime : 0)
    );
  });
}

function getNoteId(note, index) {
  return note?.id ?? `note-${index}`;
}

function resolveMediaSrc(src) {
  const value = String(src ?? "").trim();
  if (!value) return "";

  if (value.startsWith("/static")) return `${API_BASE_URL}${value}`;
  return value;
}

function insertAroundSelection(textarea, content, setContent, action) {
  if (!textarea) return;

  const start = textarea.selectionStart ?? content.length;
  const end = textarea.selectionEnd ?? content.length;
  const selected = content.slice(start, end);
  const beforeText = content.slice(0, start);
  const afterText = content.slice(end);

  const needsNewLine = action.block && beforeText && !beforeText.endsWith("\n");
  const prefix = `${needsNewLine ? "\n" : ""}${action.before}`;
  const replacement = `${prefix}${selected || action.label}${action.after}`;
  const next = `${beforeText}${replacement}${afterText}`;

  setContent(next);

  window.requestAnimationFrame(() => {
    textarea.focus();
    const cursorStart = start + prefix.length;
    const cursorEnd = cursorStart + (selected || action.label).length;
    textarea.setSelectionRange(cursorStart, cursorEnd);
  });
}

function insertMarkdownLine(textarea, content, setContent, markdown) {
  if (!textarea) {
    setContent((prev) => `${prev}${prev ? "\n" : ""}${markdown}`);
    return;
  }

  const start = textarea.selectionStart ?? content.length;
  const beforeText = content.slice(0, start);
  const afterText = content.slice(start);
  const prefix = beforeText && !beforeText.endsWith("\n") ? "\n" : "";
  const suffix = afterText && !afterText.startsWith("\n") ? "\n" : "";
  const next = `${beforeText}${prefix}${markdown}${suffix}${afterText}`;

  setContent(next);

  window.requestAnimationFrame(() => {
    textarea.focus();
    const pos = beforeText.length + prefix.length + markdown.length;
    textarea.setSelectionRange(pos, pos);
  });
}

async function fetchNotes() {
  const { data } = await api.get("/notes/");
  return Array.isArray(data) ? data : [];
}

function Markdown({ value }) {
  return (
    <div className="note-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          img: ({ src, alt, ...props }) => {
            const fullSrc = resolveMediaSrc(src);
            if (!fullSrc) return null;

            return (
              <img
                {...props}
                src={fullSrc}
                alt={alt || ""}
                loading="lazy"
                className="note-markdown__image"
              />
            );
          },
          a: ({ children, href, ...props }) => {
            const safeHref = String(href ?? "").trim();

            return (
              <a
                {...props}
                href={safeHref || undefined}
                target="_blank"
                rel="noopener noreferrer"
              >
                {children}
              </a>
            );
          },
          code: ({ inline, className, children, ...props }) => {
            if (inline && !className) {
              return (
                <code {...props} className="note-markdown__inline-code">
                  {children}
                </code>
              );
            }

            return (
              <pre className="note-markdown__pre">
                <code {...props} className={className}>
                  {children}
                </code>
              </pre>
            );
          },
          h1: (props) => <h1 {...props} className="note-markdown__h1" />,
          h2: (props) => <h2 {...props} className="note-markdown__h2" />,
          h3: (props) => <h3 {...props} className="note-markdown__h3" />,
          p: (props) => <p {...props} className="note-markdown__p" />,
          ul: (props) => <ul {...props} className="note-markdown__list" />,
          ol: (props) => <ol {...props} className="note-markdown__list" />,
          blockquote: (props) => (
            <blockquote {...props} className="note-markdown__quote" />
          ),
          hr: (props) => <hr {...props} className="note-markdown__hr" />,
          table: (props) => (
            <table {...props} className="note-markdown__table" />
          ),
        }}
      >
        {String(value || "")}
      </ReactMarkdown>
    </div>
  );
}

function EditorToolbar({
  textareaRef,
  content,
  setContent,
  previewMode,
  onTogglePreview,
  onUploadImage,
  disabled,
}) {
  return (
    <div className="note-word-toolbar">
      <div className="note-word-toolbar__group">
        {FORMAT_ACTIONS.map((action) => (
          <CButton
            key={action.label}
            type="button"
            color="secondary"
            variant="outline"
            disabled={disabled || previewMode}
            title={action.label}
            onClick={() =>
              insertAroundSelection(
                textareaRef.current,
                content,
                setContent,
                action,
              )
            }
          >
            <i className={`bi ${action.icon}`} />
          </CButton>
        ))}
      </div>

      <div className="note-word-toolbar__group">
        <CButton
          type="button"
          color="secondary"
          variant="outline"
          disabled={disabled || previewMode}
          title="Insertar tabla"
          onClick={() =>
            insertMarkdownLine(
              textareaRef.current,
              content,
              setContent,
              "| Columna 1 | Columna 2 |\n|---|---|\n| Dato | Dato |",
            )
          }
        >
          <i className="bi bi-table" />
        </CButton>

        <CButton
          type="button"
          color="secondary"
          variant="outline"
          disabled={disabled || previewMode}
          title="Insertar separador"
          onClick={() =>
            insertMarkdownLine(textareaRef.current, content, setContent, "---")
          }
        >
          <i className="bi bi-hr" />
        </CButton>

        <label
          className={`btn btn-outline-secondary btn-sm mb-0 ${
            disabled || previewMode ? "disabled" : ""
          }`}
          title="Subir imagen"
        >
          <CIcon icon={cilCloudUpload} />
          <input
            type="file"
            hidden
            accept="image/*"
            disabled={disabled || previewMode}
            onChange={onUploadImage}
          />
        </label>
      </div>

      <div className="note-word-toolbar__spacer" />

      <CButton
        type="button"
        size="sm"
        color={previewMode ? "dark" : "secondary"}
        variant={previewMode ? undefined : "outline"}
        onClick={onTogglePreview}
        disabled={disabled}
      >
        {previewMode ? <CIcon icon={cilCode} className="me-1" /> : null}
        {previewMode ? "Edit" : "Preview"}
      </CButton>
    </div>
  );
}

function WordEditor({
  value,
  setValue,
  previewMode,
  setPreviewMode,
  onUploadImage,
  disabled,
  placeholder,
  rows = 14,
}) {
  const textareaRef = useRef(null);

  return (
    <div className="note-word-editor">
      <EditorToolbar
        textareaRef={textareaRef}
        content={value}
        setContent={setValue}
        previewMode={previewMode}
        onTogglePreview={() => setPreviewMode((prev) => !prev)}
        onUploadImage={onUploadImage}
        disabled={disabled}
      />

      <div className="note-word-page">
        {previewMode ? (
          value.trim() ? (
            <Markdown value={value} />
          ) : (
            <div className="note-word-empty">Nada para mostrar</div>
          )
        ) : (
          <CFormTextarea
            ref={textareaRef}
            rows={rows}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className="note-word-textarea"
            disabled={disabled}
          />
        )}
      </div>

      <div className="note-word-statusbar">
        <span>{countWords(value)} palabras</span>
        <span>{String(value || "").length} caracteres</span>
        <span>Markdown enriquecido</span>
      </div>
    </div>
  );
}

function NoteCard({
  note,
  expandedId,
  editingId,
  editContent,
  editPreviewMode,
  deletePending,
  onToggleExpand,
  onStartEdit,
  onAskDelete,
  onEditContentChange,
  onToggleEditPreview,
  onCancelEdit,
  onSaveEdit,
  onUploadImage,
  updatePending,
}) {
  const isExpanded = expandedId === note?.id;
  const isEditing = editingId === note?.id;
  const preview = notePreview(note?.content);
  const title = firstLinePreview(note?.content, 80) || "Untitled note";

  return (
    <CCol xs={12}>
      <CCard className={`note-card ${isExpanded ? "note-card--expanded" : ""}`}>
        <CCardBody>
          {isEditing ? (
            <div className="note-editor">
              <div className="note-card__top note-card__top--editing">
                <div>
                  <div className="note-card__title">Editing note</div>
                  <div className="note-card__date">
                    <CIcon icon={cilCalendar} />
                    {formatDate(note?.created_at)}
                  </div>
                </div>
              </div>

              <WordEditor
                value={editContent}
                setValue={onEditContentChange}
                previewMode={editPreviewMode}
                setPreviewMode={onToggleEditPreview}
                onUploadImage={(e) => onUploadImage(e, "edit")}
                disabled={updatePending}
                placeholder="Edit your note..."
                rows={12}
              />

              <div className="note-editor__footer">
                <CButton
                  size="sm"
                  variant="outline"
                  color="secondary"
                  onClick={onCancelEdit}
                  disabled={updatePending}
                >
                  <CIcon icon={cilX} className="me-1" />
                  Cancel
                </CButton>

                <CButton
                  size="sm"
                  color="success"
                  onClick={onSaveEdit}
                  disabled={updatePending || !editContent.trim()}
                >
                  {updatePending ? (
                    <>
                      <CSpinner size="sm" className="me-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CIcon icon={cilSave} className="me-1" />
                      Save
                    </>
                  )}
                </CButton>
              </div>
            </div>
          ) : (
            <>
              <div className="note-card__top">
                <div>
                  <div className="note-card__title">{title}</div>
                  <div className="note-card__date">
                    <CIcon icon={cilCalendar} />
                    {formatDate(note?.created_at)}
                  </div>
                </div>

                <div className="note-card__actions note-card__toolbar">
                  <CButton
                    size="sm"
                    variant="outline"
                    color="secondary"
                    className="note-action-button"
                    onClick={() => onToggleExpand(note?.id)}
                    title={isExpanded ? "Colapsar" : "Expandir"}
                  >
                    <i
                      className={`bi ${isExpanded ? "bi-chevron-up" : "bi-chevron-down"}`}
                    />
                  </CButton>

                  <CButton
                    size="sm"
                    variant="outline"
                    color="secondary"
                    className="note-action-button"
                    onClick={() => onStartEdit(note)}
                    title="Edit"
                  >
                    <i className="bi bi-pencil" />
                  </CButton>

                  <CButton
                    size="sm"
                    variant="outline"
                    color="danger"
                    className="note-action-button note-action-button--danger"
                    onClick={() => onAskDelete(note)}
                    disabled={deletePending}
                    title="Delete"
                  >
                    <i className="bi bi-trash" />
                  </CButton>
                </div>
              </div>

              {!isExpanded ? (
                <button
                  className="note-card__preview-button"
                  type="button"
                  onClick={() => onToggleExpand(note?.id, true)}
                >
                  {preview ? (
                    <span className="note-card__preview-text">{preview}</span>
                  ) : (
                    <span>No content</span>
                  )}
                </button>
              ) : (
                <div className="note-card__content">
                  <Markdown value={note?.content || ""} />
                </div>
              )}
            </>
          )}
        </CCardBody>
      </CCard>
    </CCol>
  );
}

const Notes = () => {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newContent, setNewContent] = useState(EMPTY_NOTE_TEMPLATE);
  const [newPreviewMode, setNewPreviewMode] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState("");
  const [editPreviewMode, setEditPreviewMode] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [actionError, setActionError] = useState("");

  const {
    data: notes = [],
    isLoading,
    isError,
    isFetching,
  } = useQuery({
    queryKey: ["notes"],
    queryFn: fetchNotes,
    staleTime: 30_000,
  });

  const filteredNotes = useMemo(() => {
    const q = normalizeSearch(search);
    const sorted = sortNotesByDate(notes);

    if (!q) return sorted;

    return sorted.filter((note) => normalizeSearch(note?.content).includes(q));
  }, [notes, search]);

  const createNote = useMutation({
    mutationFn: (payload) => api.post("/notes/", payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notes"] });
      setNewContent(EMPTY_NOTE_TEMPLATE);
      setNewPreviewMode(false);
      setIsCreateModalOpen(false);
      setActionError("");
    },
    onError: () => {
      setActionError("Could not create the note.");
    },
  });

  const updateNote = useMutation({
    mutationFn: (payload) =>
      api.put(`/notes/${payload.id}`, { content: payload.content }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notes"] });
      setEditingId(null);
      setEditContent("");
      setEditPreviewMode(false);
      setActionError("");
    },
    onError: () => {
      setActionError("Could not save the note.");
    },
  });

  const deleteNote = useMutation({
    mutationFn: (id) => api.delete(`/notes/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notes"] });
      setDeleteTarget(null);
      setExpandedId(null);
      setActionError("");
    },
    onError: () => {
      setActionError("Could not delete the note.");
    },
  });

  const openCreateModal = () => {
    setIsCreateModalOpen(true);
    setNewContent(EMPTY_NOTE_TEMPLATE);
    setNewPreviewMode(false);
    setActionError("");
  };

  const closeCreateModal = () => {
    if (createNote.isPending) return;

    setIsCreateModalOpen(false);
    setNewContent(EMPTY_NOTE_TEMPLATE);
    setNewPreviewMode(false);
  };

  const startEdit = (note) => {
    setEditingId(note?.id ?? null);
    setEditContent(String(note?.content || ""));
    setEditPreviewMode(false);
    setExpandedId(null);
    setActionError("");
  };

  const cancelEdit = () => {
    if (updateNote.isPending) return;

    setEditingId(null);
    setEditContent("");
    setEditPreviewMode(false);
  };

  const handleCreate = (event) => {
    event.preventDefault();

    const content = normalizeNoteContent(newContent);
    if (!content || createNote.isPending) return;

    createNote.mutate({ content });
  };

  const handleUpdate = () => {
    const content = normalizeNoteContent(editContent);
    if (!editingId || !content || updateNote.isPending) return;

    updateNote.mutate({ id: editingId, content });
  };

  const handleToggleExpand = (id, forceOpen = false) => {
    if (!id) return;

    setExpandedId((prev) => {
      if (forceOpen) return id;
      return prev === id ? null : id;
    });
  };

  const handleImageUpload = async (event, mode) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setActionError("Only images are allowed.");
      event.currentTarget.value = "";
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setActionError("");

      const { data } = await api.post("/notes/images", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const imageUrl = String(data?.url || data?.file_path || "").trim();
      if (!imageUrl) {
        setActionError(
          "The image was uploaded, but no valid URL was received.",
        );
        return;
      }

      const markdown = `![${file.name}](${imageUrl})`;

      if (mode === "edit") {
        setEditContent((prev) => `${prev}${prev ? "\n" : ""}${markdown}`);
      } else {
        setNewContent((prev) => `${prev}${prev ? "\n" : ""}${markdown}`);
      }
    } catch (error) {
      setActionError("Could not upload the image.");
      console.error("Error uploading image", error);
    } finally {
      event.currentTarget.value = "";
    }
  };

  if (isError) {
    return (
      <CCard>
        <CCardBody className="text-center py-5 text-danger">
          Could not load notes.
        </CCardBody>
      </CCard>
    );
  }

  return (
    <>
      <CRow className="notes-page module-header-row">
        <CCol xs={12}>
          <CCard className="notes-panel">
            <CCardHeader className="notes-panel__header">
              <div className="notes-panel__title">
                <span>Notes</span>
                <small>{filteredNotes.length.toLocaleString()} saved</small>
              </div>

              <CInputGroup className="notes-search">
                <CInputGroupText>
                  <i className="bi bi-search" />
                </CInputGroupText>
                <CFormInput
                  placeholder="Search notes..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </CInputGroup>

              <CButton
                color="primary"
                size="sm"
                className="notes-new-button"
                onClick={openCreateModal}
              >
                <CIcon icon={cilPlus} />
                New note
              </CButton>
            </CCardHeader>
          </CCard>
        </CCol>
      </CRow>

      <CRow className="notes-page module-content-row">
        <CCol xs={12}>
          <div className="notes-content-panel">
            {actionError && (
              <CAlert color="danger" className="mb-3">
                {actionError}
              </CAlert>
            )}

            {isLoading ? (
              <div className="d-flex justify-content-center align-items-center notes-loader">
                <CSpinner className="text-primary" />
              </div>
            ) : filteredNotes.length === 0 ? (
              <CCard className="records-panel">
                <CCardBody className="records-empty-state">
                  {search.trim()
                    ? "No notes match that search."
                    : "No notes to show."}
                </CCardBody>
              </CCard>
            ) : (
              <CRow className="g-2 notes-list">
                {filteredNotes.map((note, index) => (
                  <NoteCard
                    key={getNoteId(note, index)}
                    note={note}
                    expandedId={expandedId}
                    editingId={editingId}
                    editContent={editContent}
                    editPreviewMode={editPreviewMode}
                    deletePending={deleteNote.isPending}
                    onToggleExpand={handleToggleExpand}
                    onStartEdit={startEdit}
                    onAskDelete={setDeleteTarget}
                    onEditContentChange={setEditContent}
                    onToggleEditPreview={setEditPreviewMode}
                    onCancelEdit={cancelEdit}
                    onSaveEdit={handleUpdate}
                    onUploadImage={handleImageUpload}
                    updatePending={updateNote.isPending}
                  />
                ))}
              </CRow>
            )}

            {isFetching && !isLoading && (
              <div className="d-flex justify-content-center mt-3">
                <div className="small text-medium-emphasis d-flex align-items-center gap-2">
                  <CSpinner size="sm" />
                  Updating...
                </div>
              </div>
            )}
          </div>
        </CCol>
      </CRow>

      <CModal
        alignment="center"
        visible={isCreateModalOpen}
        onClose={closeCreateModal}
        size="xl"
        className="notes-modal notes-modal--word"
      >
        <CModalHeader closeButton={false}>
          <CModalTitle>
            <span>Notes</span>
            <strong>New note</strong>
          </CModalTitle>
        </CModalHeader>

        <form onSubmit={handleCreate}>
          <CModalBody>
            {actionError && (
              <CAlert color="danger" className="mb-3">
                {actionError}
              </CAlert>
            )}

            <div className="note-modal-tools">
              <CBadge color="secondary" className="note-format-badge">
                Markdown
              </CBadge>
            </div>

            <WordEditor
              value={newContent}
              setValue={setNewContent}
              previewMode={newPreviewMode}
              setPreviewMode={setNewPreviewMode}
              onUploadImage={(event) => handleImageUpload(event, "new")}
              disabled={createNote.isPending}
              placeholder="Write your note. Use the toolbar above to format it..."
              rows={16}
            />
          </CModalBody>

          <CModalFooter>
            <CButton
              size="sm"
              variant="outline"
              color="secondary"
              onClick={closeCreateModal}
              disabled={createNote.isPending}
            >
              Cancel
            </CButton>

            <CButton
              type="submit"
              size="sm"
              color="primary"
              disabled={!newContent.trim() || createNote.isPending}
            >
              {createNote.isPending ? (
                <>
                  <CSpinner size="sm" className="me-2" />
                  Saving...
                </>
              ) : (
                <>
                  <CIcon icon={cilSave} className="me-1" />
                  Save
                </>
              )}
            </CButton>
          </CModalFooter>
        </form>
      </CModal>

      <CModal
        alignment="center"
        visible={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        className="notes-modal notes-modal--confirm"
      >
        <CModalHeader closeButton={false}>
          <CModalTitle>
            <span>Confirmation</span>
            <strong>Delete note</strong>
          </CModalTitle>
        </CModalHeader>

        <CModalBody>
          <div className="mb-2">
            This action cannot be undone. Are you sure you want to delete this
            note?
          </div>

          {deleteTarget?.content && (
            <div className="note-confirm-summary">
              <div className="note-confirm-summary__row">
                <strong>Name:</strong>
                <span>
                  {firstLinePreview(deleteTarget.content, 120) || "No content"}
                </span>
              </div>
            </div>
          )}

          {actionError && (
            <CAlert color="danger" className="mt-3 mb-0">
              {actionError}
            </CAlert>
          )}
        </CModalBody>

        <CModalFooter>
          <CButton
            size="sm"
            variant="outline"
            color="secondary"
            onClick={() => setDeleteTarget(null)}
            disabled={deleteNote.isPending}
          >
            Cancel
          </CButton>

          <CButton
            size="sm"
            color="danger"
            onClick={() =>
              deleteTarget?.id && deleteNote.mutate(deleteTarget.id)
            }
            disabled={deleteNote.isPending}
          >
            {deleteNote.isPending ? (
              <>
                <CSpinner size="sm" className="me-2" />
                Deleting...
              </>
            ) : (
              <>
                <CIcon icon={cilDelete} className="me-1" />
                Delete
              </>
            )}
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  );
};

export default Notes;
