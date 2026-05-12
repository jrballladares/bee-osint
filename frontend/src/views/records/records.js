import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../../lib/axios";
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
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
  CRow,
  CSpinner,
} from "../../lib/ui.js";
import CIcon from "../../lib/Icon.js";
import {
  cilBriefcase,
  cilCalendar,
  cilCloudDownload,
  cilCloudUpload,
  cilDescription,
  cilEnvelopeClosed,
  cilFingerprint,
  cilGlobeAlt,
  cilInfo,
  cilLocationPin,
  cilPencil,
  cilPhone,
  cilPlus,
  cilTrash,
  cilUser,
  cilWarning,
  cilZoom,
} from "../../lib/icons.js";

const emptyPhone = () => ({ phone_number: "", label: "Mobile" });
const emptyAddress = () => ({ address: "", label: "Casa" });
const emptySocial = () => ({ platform: "", username_or_url: "" });

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanNullableText(value) {
  const text = normalizeText(value);
  return text || null;
}

function formatDate(value) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  return date.toLocaleDateString();
}

function formatDateTime(value) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  return date.toLocaleString();
}

function cleanPhones(list) {
  return safeArray(list)
    .map((item) => ({
      phone_number: normalizeText(item?.phone_number),
      label: normalizeText(item?.label),
    }))
    .filter((item) => item.phone_number || item.label);
}

function cleanAddresses(list) {
  return safeArray(list)
    .map((item) => ({
      address: normalizeText(item?.address),
      label: normalizeText(item?.label),
    }))
    .filter((item) => item.address || item.label);
}

function cleanSocialMedia(list) {
  return safeArray(list)
    .map((item) => ({
      platform: normalizeText(item?.platform),
      username_or_url: normalizeText(item?.username_or_url),
    }))
    .filter((item) => item.platform || item.username_or_url);
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function getFilenameFromContentDisposition(contentDisposition, fallbackName) {
  if (!contentDisposition) return fallbackName;

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  const plainMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
  if (plainMatch?.[1]) {
    return plainMatch[1];
  }

  return fallbackName;
}

function getRecordFullName(record) {
  return (
    [normalizeText(record?.first_name), normalizeText(record?.last_name)]
      .filter(Boolean)
      .join(" ") || "No name"
  );
}

function mapRecordFormData(record) {
  return {
    firstName: record?.first_name || "",
    lastName: record?.last_name || "",
    dob: record?.date_of_birth || "",
    gender: record?.gender || "",
    nationality: record?.nationality || "",
    idNumber: record?.id_number || "",
    email: record?.email || "",
    occupation: record?.occupation || "",
    notes: record?.notes || "",
    phones: safeArray(record?.phones).map(({ id, ...rest }) => ({ ...rest })),
    addresses: safeArray(record?.addresses).map(({ id, ...rest }) => ({
      ...rest,
    })),
    socialMedia: safeArray(record?.social_media).map(({ id, ...rest }) => ({
      ...rest,
    })),
  };
}

const Records = () => {
  const [search, setSearch] = useState("");
  const [searchText, setSearchText] = useState("");

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const [editingRecord, setEditingRecord] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);

  const [isRecordDeleteModalOpen, setIsRecordDeleteModalOpen] = useState(false);
  const [isDocumentDeleteModalOpen, setIsDocumentDeleteModalOpen] =
    useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [documentToDelete, setDocumentToDelete] = useState(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [nationality, setNationality] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [email, setEmail] = useState("");
  const [occupation, setOccupation] = useState("");
  const [notes, setNotes] = useState("");

  const [phones, setPhones] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [socialMedia, setSocialMedia] = useState([]);

  const [actionError, setActionError] = useState("");

  const queryClient = useQueryClient();

  const resetForm = () => {
    setFirstName("");
    setLastName("");
    setDob("");
    setGender("");
    setNationality("");
    setIdNumber("");
    setEmail("");
    setOccupation("");
    setNotes("");
    setPhones([]);
    setAddresses([]);
    setSocialMedia([]);
  };

  const closeFormModal = () => {
    setIsFormModalOpen(false);
    setEditingRecord(null);
    setActionError("");
    resetForm();
  };

  const closeDetailModal = () => {
    setIsDetailModalOpen(false);
    setSelectedRecord(null);
  };

  const closeRecordDeleteModal = () => {
    setIsRecordDeleteModalOpen(false);
    window.setTimeout(() => setRecordToDelete(null), 180);
  };

  const closeDocumentDeleteModal = () => {
    setIsDocumentDeleteModalOpen(false);
    window.setTimeout(() => setDocumentToDelete(null), 180);
  };

  const {
    data: records = [],
    isLoading,
    isError,
    isFetching,
  } = useQuery({
    queryKey: ["records", search],
    queryFn: async () => {
      const { data } = await api.get("/records/", {
        params: { search: search || undefined },
      });
      return Array.isArray(data) ? data : [];
    },
    staleTime: 30_000,
  });

  const createRecord = useMutation({
    mutationFn: (payload) => api.post("/records/", payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["records"] });
      closeFormModal();
    },
    onError: () => {
      setActionError("Could not create the record.");
    },
  });

  const updateRecord = useMutation({
    mutationFn: ({ id, data }) => api.put(`/records/${id}`, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["records"] });
      closeFormModal();
    },
    onError: () => {
      setActionError("Could not update the record.");
    },
  });

  const deleteRecord = useMutation({
    mutationFn: (id) => api.delete(`/records/${id}`),
    onSuccess: async (_, deletedId) => {
      await queryClient.invalidateQueries({ queryKey: ["records"] });
      closeRecordDeleteModal();

      if (selectedRecord?.id === deletedId) {
        setIsDetailModalOpen(false);
        setSelectedRecord(null);
      }
    },
    onError: () => {
      setActionError("Could not delete the record.");
    },
  });

  const uploadDocument = useMutation({
    mutationFn: ({ id, file }) => {
      const formData = new FormData();
      formData.append("file", file);

      return api.post(`/records/${id}/documents`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["records"] });
      setActionError("");
    },
    onError: () => {
      setActionError("Could not attach the document.");
    },
  });

  const deleteDocument = useMutation({
    mutationFn: (docId) => api.delete(`/records/documents/${docId}`),
    onSuccess: async (_, deletedDocId) => {
      await queryClient.invalidateQueries({ queryKey: ["records"] });
      closeDocumentDeleteModal();

      if (selectedRecord) {
        setSelectedRecord((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            documents: safeArray(prev.documents).filter(
              (doc) => doc.id !== deletedDocId,
            ),
          };
        });
      }
    },
    onError: () => {
      setActionError("Could not delete the document.");
    },
  });

  const openFormModal = (record = null) => {
    setActionError("");

    if (record) {
      const formData = mapRecordFormData(record);
      setEditingRecord(record);
      setFirstName(formData.firstName);
      setLastName(formData.lastName);
      setDob(formData.dob);
      setGender(formData.gender);
      setNationality(formData.nationality);
      setIdNumber(formData.idNumber);
      setEmail(formData.email);
      setOccupation(formData.occupation);
      setNotes(formData.notes);
      setPhones(formData.phones);
      setAddresses(formData.addresses);
      setSocialMedia(formData.socialMedia);
    } else {
      setEditingRecord(null);
      resetForm();
    }

    setIsFormModalOpen(true);
  };

  const openDetailModal = (record) => {
    setSelectedRecord(record);
    setIsDetailModalOpen(true);
  };

  useEffect(() => {
    const hasOpenModal =
      isFormModalOpen ||
      isDetailModalOpen ||
      isRecordDeleteModalOpen ||
      isDocumentDeleteModalOpen;

    if (!hasOpenModal) return;

    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;

      if (isDocumentDeleteModalOpen) {
        closeDocumentDeleteModal();
        return;
      }

      if (isRecordDeleteModalOpen) {
        closeRecordDeleteModal();
        return;
      }

      if (isFormModalOpen) {
        if (!createRecord.isPending && !updateRecord.isPending) {
          closeFormModal();
        }
        return;
      }

      if (isDetailModalOpen) {
        closeDetailModal();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    isFormModalOpen,
    isDetailModalOpen,
    isRecordDeleteModalOpen,
    isDocumentDeleteModalOpen,
    createRecord.isPending,
    updateRecord.isPending,
  ]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setActionError("");

    const payload = {
      first_name: normalizeText(firstName),
      last_name: normalizeText(lastName),
      date_of_birth: dob || null,
      gender: gender || null,
      nationality: cleanNullableText(nationality),
      id_number: cleanNullableText(idNumber),
      email: cleanNullableText(email),
      occupation: cleanNullableText(occupation),
      notes: cleanNullableText(notes),
      phones: cleanPhones(phones),
      addresses: cleanAddresses(addresses),
      social_media: cleanSocialMedia(socialMedia),
    };

    if (!payload.first_name || !payload.last_name) {
      setActionError("First name and last name are required.");
      return;
    }

    if (editingRecord?.id) {
      updateRecord.mutate({ id: editingRecord.id, data: payload });
    } else {
      createRecord.mutate(payload);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSearch(normalizeText(searchText));
  };

  const askDeleteRecord = (record) => {
    setActionError("");
    setRecordToDelete(record);
    setIsRecordDeleteModalOpen(true);
  };

  const confirmDeleteRecord = () => {
    if (!recordToDelete?.id) return;
    deleteRecord.mutate(recordToDelete.id);
  };

  const askDeleteDocument = (doc) => {
    setActionError("");
    setDocumentToDelete(doc);
    setIsDocumentDeleteModalOpen(true);
  };

  const confirmDeleteDocument = () => {
    if (!documentToDelete?.id) return;
    deleteDocument.mutate(documentToDelete.id);
  };

  const handleFileUpload = (recordId, e) => {
    const file = e.target.files?.[0];
    if (file) {
      setActionError("");
      uploadDocument.mutate({ id: recordId, file });
    }
    e.currentTarget.value = "";
  };

  const downloadDocument = async (doc) => {
    if (!doc?.id) return;

    try {
      const response = await api.get(`/records/documents/${doc.id}/download`, {
        responseType: "blob",
      });

      const fallbackName = doc.file_name || `document-${doc.id}`;
      const contentDisposition = response.headers?.["content-disposition"];
      const filename = getFilenameFromContentDisposition(
        contentDisposition,
        fallbackName,
      );

      downloadBlob(filename, response.data);
    } catch (error) {
      console.error("Error downloading document:", error);
      setActionError("Could not download the document.");
    }
  };

  const addPhone = () => setPhones((prev) => [...prev, emptyPhone()]);
  const removePhone = (index) =>
    setPhones((prev) => prev.filter((_, i) => i !== index));
  const updatePhone = (index, field, value) => {
    setPhones((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  };

  const addAddress = () => setAddresses((prev) => [...prev, emptyAddress()]);
  const removeAddress = (index) =>
    setAddresses((prev) => prev.filter((_, i) => i !== index));
  const updateAddress = (index, field, value) => {
    setAddresses((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  };

  const addSocial = () => setSocialMedia((prev) => [...prev, emptySocial()]);
  const removeSocial = (index) =>
    setSocialMedia((prev) => prev.filter((_, i) => i !== index));
  const updateSocial = (index, field, value) => {
    setSocialMedia((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  };

  const isSaving = createRecord.isPending || updateRecord.isPending;
  const selectedRecordView = useMemo(() => {
    if (!selectedRecord?.id) return selectedRecord;
    return (
      records.find((item) => item.id === selectedRecord.id) || selectedRecord
    );
  }, [records, selectedRecord]);

  const selectedDocuments = useMemo(
    () => safeArray(selectedRecordView?.documents),
    [selectedRecordView?.documents],
  );

  if (isError) {
    return (
      <CCard className="mb-4">
        <CCardBody className="text-center py-5 text-danger">
          Could not load records.
        </CCardBody>
      </CCard>
    );
  }

  return (
    <>
      {(actionError || isFetching) && (
        <div className="mb-3">
          {actionError && <CAlert color="danger">{actionError}</CAlert>}
          {isFetching && !isLoading && (
            <div className="small text-medium-emphasis d-flex align-items-center gap-2">
              <CSpinner size="sm" />
              Updating...
            </div>
          )}
        </div>
      )}

      <CRow className="records-page module-header-row">
        <CCol xs={12}>
          <CCard className="records-panel">
            <CCardHeader className="records-panel__header">
              <div className="records-panel__title">
                <span>Records</span>
                <small>{records.length.toLocaleString()} saved</small>
              </div>

              <form
                onSubmit={handleSearchSubmit}
                className="records-search-form"
              >
                <CInputGroup className="records-search">
                  <CInputGroupText>
                    <i className="bi bi-search"></i>
                  </CInputGroupText>
                  <CFormInput
                    placeholder="Search records..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                  />
                </CInputGroup>
              </form>

              <CButton
                color="primary"
                size="sm"
                className="records-new-button"
                onClick={() => openFormModal()}
              >
                <CIcon icon={cilPlus} />
                New record
              </CButton>
            </CCardHeader>
          </CCard>
        </CCol>
      </CRow>

      <CRow className="g-3 records-grid module-content-row">
        {isLoading ? (
          <CCol xs={12}>
            <CCard>
              <CCardBody
                className="d-flex justify-content-center align-items-center"
                style={{ minHeight: 220 }}
              >
                <CSpinner />
              </CCardBody>
            </CCard>
          </CCol>
        ) : records.length === 0 ? (
          <CCol xs={12}>
            <CCard className="records-panel">
              <CCardBody className="records-empty-state">
                No records to show.
              </CCardBody>
            </CCard>
          </CCol>
        ) : (
          records.map((record) => (
            <CCol key={record.id} xs={12}>
              <CCard className="h-100 record-card">
                <CCardBody className="d-flex flex-column h-100">
                  <div className="record-card__header">
                    <div className="record-card__identity">
                      <strong>{getRecordFullName(record)}</strong>
                      <span>{record.occupation || "No occupation"}</span>
                    </div>

                    <div className="record-card__actions">
                      <CButton
                        color="info"
                        variant="outline"
                        size="sm"
                        className="record-action-button"
                        onClick={() => openDetailModal(record)}
                        title="Ver detalle"
                      >
                        <CIcon icon={cilZoom} />
                      </CButton>

                      <CButton
                        color="secondary"
                        variant="outline"
                        size="sm"
                        className="record-action-button"
                        onClick={() => openFormModal(record)}
                        title="Edit"
                      >
                        <CIcon icon={cilPencil} />
                      </CButton>

                      <CButton
                        color="danger"
                        variant="outline"
                        size="sm"
                        className="record-action-button record-action-button--danger"
                        onClick={() => askDeleteRecord(record)}
                        title="Delete"
                        disabled={deleteRecord.isPending}
                      >
                        <CIcon icon={cilTrash} />
                      </CButton>
                    </div>
                  </div>

                  <CRow className="g-4 mt-2">
                    <CCol xs={12} sm={6}>
                      <div className="record-section-title">Info personal</div>

                      <div className="record-info-list">
                        {record.id_number && (
                          <div className="record-info-row">
                            <CIcon icon={cilFingerprint} />
                            <span>{record.id_number}</span>
                          </div>
                        )}

                        {record.email && (
                          <div className="record-info-row">
                            <CIcon icon={cilEnvelopeClosed} />
                            <span className="text-break">{record.email}</span>
                          </div>
                        )}

                        {record.date_of_birth && (
                          <div className="record-info-row">
                            <CIcon icon={cilCalendar} />
                            <span>{formatDate(record.date_of_birth)}</span>
                          </div>
                        )}

                        {record.gender && (
                          <div className="record-info-row">
                            <CIcon icon={cilUser} />
                            <span>{record.gender}</span>
                          </div>
                        )}

                        {record.nationality && (
                          <div>
                            <span className="text-medium-emphasis">
                              Nacionalidad:
                            </span>{" "}
                            {record.nationality}
                          </div>
                        )}
                      </div>
                    </CCol>

                    <CCol xs={12} sm={6}>
                      <div className="record-section-title">Phones</div>

                      {safeArray(record.phones).length > 0 ? (
                        <div className="record-info-list">
                          {record.phones.map((phone, index) => (
                            <div
                              key={phone.id ?? index}
                              className="record-info-row"
                            >
                              <CIcon icon={cilPhone} />
                              <span>
                                {phone.phone_number}{" "}
                                <span className="text-medium-emphasis">
                                  ({phone.label || "No label"})
                                </span>
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="small text-medium-emphasis fst-italic">
                          No phones
                        </div>
                      )}
                    </CCol>

                    <CCol xs={12} sm={6}>
                      <div className="record-section-title">Direcciones</div>

                      {safeArray(record.addresses).length > 0 ? (
                        <div className="record-info-list">
                          {record.addresses
                            .slice(0, 2)
                            .map((address, index) => (
                              <div
                                key={address.id ?? index}
                                className="record-info-row record-info-row--start"
                              >
                                <CIcon icon={cilLocationPin} className="mt-1" />
                                <span>
                                  {address.address}{" "}
                                  <span className="text-medium-emphasis">
                                    ({address.label || "No label"})
                                  </span>
                                </span>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <div className="small text-medium-emphasis fst-italic">
                          No addresses
                        </div>
                      )}
                    </CCol>

                    <CCol xs={12} sm={6}>
                      <div className="record-section-title">Redes sociales</div>

                      {safeArray(record.social_media).length > 0 ? (
                        <div className="record-info-list">
                          {record.social_media
                            .slice(0, 2)
                            .map((social, index) => (
                              <div
                                key={social.id ?? index}
                                className="record-info-row"
                              >
                                <CIcon icon={cilGlobeAlt} />
                                <span className="text-break">
                                  {social.platform || "Red"}:{" "}
                                  {social.username_or_url}
                                </span>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <div className="small text-medium-emphasis fst-italic">
                          No social networks
                        </div>
                      )}
                    </CCol>
                  </CRow>

                  {record.notes && (
                    <div className="record-card__note">{record.notes}</div>
                  )}

                  <div className="record-card__documents">
                    <div className="record-section-title">Documentos</div>

                    {safeArray(record.documents).length > 0 ? (
                      <div className="d-flex flex-column gap-2">
                        {record.documents.map((doc) => (
                          <div key={doc.id} className="record-document-row">
                            <span
                              className="text-truncate pe-2"
                              style={{ maxWidth: "70%" }}
                            >
                              {doc.file_name}
                            </span>

                            <div className="record-document-actions">
                              <CButton
                                color="primary"
                                variant="ghost"
                                size="sm"
                                onClick={() => downloadDocument(doc)}
                                title="Download"
                              >
                                <CIcon icon={cilCloudDownload} />
                              </CButton>

                              <CButton
                                color="danger"
                                variant="ghost"
                                size="sm"
                                onClick={() => askDeleteDocument(doc)}
                                title="Delete"
                                disabled={deleteDocument.isPending}
                              >
                                <CIcon icon={cilTrash} />
                              </CButton>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="small text-medium-emphasis fst-italic mb-2">
                        No documents
                      </div>
                    )}

                    <div className="record-upload-row">
                      <label
                        htmlFor={`upload-doc-${record.id}`}
                        className="record-upload-link"
                      >
                        <CIcon icon={cilCloudUpload} className="me-1" />
                        Attach document
                      </label>
                      <input
                        id={`upload-doc-${record.id}`}
                        type="file"
                        style={{ display: "none" }}
                        onChange={(e) => handleFileUpload(record.id, e)}
                      />
                    </div>
                  </div>
                </CCardBody>
              </CCard>
            </CCol>
          ))
        )}
      </CRow>

      <CModal
        visible={isFormModalOpen}
        onClose={closeFormModal}
        size="xl"
        alignment="center"
        backdrop="static"
        className="record-form-modal"
      >
        <CModalHeader closeButton={false}>
          <CModalTitle>
            <span>Records</span>
            <strong>{editingRecord ? "Edit record" : "New record"}</strong>
          </CModalTitle>
        </CModalHeader>

        <form onSubmit={handleSubmit}>
          <CModalBody>
            {actionError && <CAlert color="danger">{actionError}</CAlert>}

            <CRow className="g-3">
              <CCol xs={12} md={6}>
                <CFormLabel htmlFor="first_name">First name(s)</CFormLabel>
                <CFormInput
                  id="first_name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </CCol>

              <CCol xs={12} md={6}>
                <CFormLabel htmlFor="last_name">Last name(s)</CFormLabel>
                <CFormInput
                  id="last_name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </CCol>

              <CCol xs={12} md={6}>
                <CFormLabel htmlFor="dob">Date of birth</CFormLabel>
                <CFormInput
                  id="dob"
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                />
              </CCol>

              <CCol xs={12} md={6}>
                <CFormLabel htmlFor="gender">Gender</CFormLabel>
                <CFormSelect
                  id="gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                >
                  <option value="">Select</option>
                  <option value="Masculino">Masculino</option>
                  <option value="Femenino">Femenino</option>
                  <option value="Otro">Otro</option>
                </CFormSelect>
              </CCol>

              <CCol xs={12} md={6}>
                <CFormLabel htmlFor="nationality">Nacionalidad</CFormLabel>
                <CFormInput
                  id="nationality"
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                />
              </CCol>

              <CCol xs={12} md={6}>
                <CFormLabel htmlFor="id_number">DNI / Pasaporte</CFormLabel>
                <CFormInput
                  id="id_number"
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                />
              </CCol>

              <CCol xs={12} md={6}>
                <CFormLabel htmlFor="email">Email</CFormLabel>
                <CFormInput
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </CCol>

              <CCol xs={12} md={6}>
                <CFormLabel htmlFor="occupation">Occupation</CFormLabel>
                <CFormInput
                  id="occupation"
                  value={occupation}
                  onChange={(e) => setOccupation(e.target.value)}
                />
              </CCol>

              <CCol xs={12}>
                <CFormLabel htmlFor="notes">Notes / Observations</CFormLabel>
                <CFormTextarea
                  id="notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </CCol>
            </CRow>

            <div className="mt-4">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <div className="small text-uppercase fw-semibold text-medium-emphasis">
                  Phones
                </div>
                <CButton
                  type="button"
                  color="primary"
                  variant="ghost"
                  size="sm"
                  onClick={addPhone}
                >
                  <CIcon icon={cilPlus} className="me-1" />
                  Add phone
                </CButton>
              </div>

              {phones.length === 0 ? (
                <div className="small text-medium-emphasis fst-italic">
                  No phones
                </div>
              ) : (
                <div className="d-flex flex-column gap-2">
                  {phones.map((phone, index) => (
                    <CRow key={index} className="g-2 align-items-center">
                      <CCol xs={12} md={7}>
                        <CFormInput
                          placeholder="Number"
                          value={phone.phone_number}
                          onChange={(e) =>
                            updatePhone(index, "phone_number", e.target.value)
                          }
                        />
                      </CCol>
                      <CCol xs={10} md={4}>
                        <CFormInput
                          placeholder="Label (Mobile, Home...)"
                          value={phone.label}
                          onChange={(e) =>
                            updatePhone(index, "label", e.target.value)
                          }
                        />
                      </CCol>
                      <CCol xs={2} md={1}>
                        <CButton
                          type="button"
                          color="danger"
                          variant="ghost"
                          onClick={() => removePhone(index)}
                          title="Delete"
                        >
                          <CIcon icon={cilTrash} />
                        </CButton>
                      </CCol>
                    </CRow>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <div className="small text-uppercase fw-semibold text-medium-emphasis">
                  Direcciones
                </div>
                <CButton
                  type="button"
                  color="primary"
                  variant="ghost"
                  size="sm"
                  onClick={addAddress}
                >
                  <CIcon icon={cilPlus} className="me-1" />
                  Add address
                </CButton>
              </div>

              {addresses.length === 0 ? (
                <div className="small text-medium-emphasis fst-italic">
                  No addresses
                </div>
              ) : (
                <div className="d-flex flex-column gap-2">
                  {addresses.map((address, index) => (
                    <CRow key={index} className="g-2 align-items-center">
                      <CCol xs={12} md={7}>
                        <CFormInput
                          placeholder="Full address"
                          value={address.address}
                          onChange={(e) =>
                            updateAddress(index, "address", e.target.value)
                          }
                        />
                      </CCol>
                      <CCol xs={10} md={4}>
                        <CFormInput
                          placeholder="Label"
                          value={address.label}
                          onChange={(e) =>
                            updateAddress(index, "label", e.target.value)
                          }
                        />
                      </CCol>
                      <CCol xs={2} md={1}>
                        <CButton
                          type="button"
                          color="danger"
                          variant="ghost"
                          onClick={() => removeAddress(index)}
                          title="Delete"
                        >
                          <CIcon icon={cilTrash} />
                        </CButton>
                      </CCol>
                    </CRow>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <div className="small text-uppercase fw-semibold text-medium-emphasis">
                  Redes sociales
                </div>
                <CButton
                  type="button"
                  color="primary"
                  variant="ghost"
                  size="sm"
                  onClick={addSocial}
                >
                  <CIcon icon={cilPlus} className="me-1" />
                  Add social link
                </CButton>
              </div>

              {socialMedia.length === 0 ? (
                <div className="small text-medium-emphasis fst-italic">
                  No social networks
                </div>
              ) : (
                <div className="d-flex flex-column gap-2">
                  {socialMedia.map((social, index) => (
                    <CRow key={index} className="g-2 align-items-center">
                      <CCol xs={12} md={4}>
                        <CFormInput
                          placeholder="Plataforma (Facebook, X...)"
                          value={social.platform}
                          onChange={(e) =>
                            updateSocial(index, "platform", e.target.value)
                          }
                        />
                      </CCol>
                      <CCol xs={10} md={7}>
                        <CFormInput
                          placeholder="Username or URL"
                          value={social.username_or_url}
                          onChange={(e) =>
                            updateSocial(
                              index,
                              "username_or_url",
                              e.target.value,
                            )
                          }
                        />
                      </CCol>
                      <CCol xs={2} md={1}>
                        <CButton
                          type="button"
                          color="danger"
                          variant="ghost"
                          onClick={() => removeSocial(index)}
                          title="Delete"
                        >
                          <CIcon icon={cilTrash} />
                        </CButton>
                      </CCol>
                    </CRow>
                  ))}
                </div>
              )}
            </div>
          </CModalBody>

          <CModalFooter>
            <CButton
              type="button"
              color="secondary"
              variant="outline"
              onClick={closeFormModal}
              disabled={isSaving}
            >
              Cancel
            </CButton>

            <CButton type="submit" color="primary" disabled={isSaving}>
              {isSaving ? (
                <>
                  <CSpinner size="sm" className="me-2" />
                  Saving...
                </>
              ) : editingRecord ? (
                "Save changes"
              ) : (
                "Create record"
              )}
            </CButton>
          </CModalFooter>
        </form>
      </CModal>

      <CModal
        visible={isDetailModalOpen}
        onClose={closeDetailModal}
        size="xl"
        alignment="center"
        className="record-detail-modal"
      >
        <CModalHeader closeButton={false}>
          <CModalTitle>
            <span>Records</span>
            <strong>Record detail</strong>
          </CModalTitle>
        </CModalHeader>

        <CModalBody>
          {selectedRecordView &&
            ((selectedRecord) => (
              <>
                <div className="mb-4">
                  <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
                    <div>
                      <h4 className="mb-1">
                        {getRecordFullName(selectedRecord)}
                      </h4>
                      <div className="text-medium-emphasis">
                        {selectedRecord.occupation || "No occupation"}
                      </div>
                    </div>
                  </div>
                </div>

                <CRow className="g-4">
                  <CCol xs={12} md={6}>
                    <CCard className="h-100">
                      <CCardHeader className="fw-semibold">
                        Personal information
                      </CCardHeader>
                      <CCardBody className="small">
                        <div className="d-flex flex-column gap-3">
                          <div className="d-flex align-items-center gap-2">
                            <CIcon icon={cilUser} />
                            <span>
                              <strong>Name:</strong>{" "}
                              {getRecordFullName(selectedRecord)}
                            </span>
                          </div>

                          <div className="d-flex align-items-center gap-2">
                            <CIcon icon={cilCalendar} />
                            <span>
                              <strong>Nacimiento:</strong>{" "}
                              {formatDate(selectedRecord.date_of_birth)}
                            </span>
                          </div>

                          <div className="d-flex align-items-center gap-2">
                            <CIcon icon={cilFingerprint} />
                            <span>
                              <strong>DNI / Pasaporte:</strong>{" "}
                              {selectedRecord.id_number || "Not registered"}
                            </span>
                          </div>

                          <div className="d-flex align-items-center gap-2">
                            <CIcon icon={cilEnvelopeClosed} />
                            <span>
                              <strong>Email:</strong>{" "}
                              {selectedRecord.email || "Not registered"}
                            </span>
                          </div>

                          <div className="d-flex align-items-center gap-2">
                            <CIcon icon={cilBriefcase} />
                            <span>
                              <strong>Occupation:</strong>{" "}
                              {selectedRecord.occupation || "No registrada"}
                            </span>
                          </div>

                          <div>
                            <strong>Gender:</strong>{" "}
                            {selectedRecord.gender || "Not registered"}
                          </div>

                          <div>
                            <strong>Nacionalidad:</strong>{" "}
                            {selectedRecord.nationality || "No registrada"}
                          </div>

                          <div>
                            <strong>Creado:</strong>{" "}
                            {formatDateTime(selectedRecord.created_at)}
                          </div>

                          <div>
                            <strong>Actualizado:</strong>{" "}
                            {formatDateTime(selectedRecord.updated_at)}
                          </div>
                        </div>
                      </CCardBody>
                    </CCard>
                  </CCol>

                  <CCol xs={12} md={6}>
                    <CCard className="h-100">
                      <CCardHeader className="fw-semibold">Notes</CCardHeader>
                      <CCardBody className="small">
                        {selectedRecord.notes ? (
                          <div style={{ whiteSpace: "pre-wrap" }}>
                            {selectedRecord.notes}
                          </div>
                        ) : (
                          <div className="text-medium-emphasis fst-italic">
                            No notes
                          </div>
                        )}
                      </CCardBody>
                    </CCard>
                  </CCol>

                  <CCol xs={12} md={6}>
                    <CCard className="h-100">
                      <CCardHeader className="fw-semibold">Phones</CCardHeader>
                      <CCardBody className="small">
                        {safeArray(selectedRecord.phones).length > 0 ? (
                          <div className="d-flex flex-column gap-2">
                            {selectedRecord.phones.map((phone, index) => (
                              <div
                                key={phone.id ?? index}
                                className="d-flex align-items-center gap-2"
                              >
                                <CIcon icon={cilPhone} />
                                <span>
                                  {phone.phone_number}{" "}
                                  <CBadge color="light" textColor="dark">
                                    {phone.label || "No label"}
                                  </CBadge>
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-medium-emphasis fst-italic">
                            No phones
                          </div>
                        )}
                      </CCardBody>
                    </CCard>
                  </CCol>

                  <CCol xs={12} md={6}>
                    <CCard className="h-100">
                      <CCardHeader className="fw-semibold">
                        Direcciones
                      </CCardHeader>
                      <CCardBody className="small">
                        {safeArray(selectedRecord.addresses).length > 0 ? (
                          <div className="d-flex flex-column gap-3">
                            {selectedRecord.addresses.map((address, index) => (
                              <div
                                key={address.id ?? index}
                                className="d-flex align-items-start gap-2"
                              >
                                <CIcon icon={cilLocationPin} className="mt-1" />
                                <div>
                                  <div>{address.address}</div>
                                  <div className="text-medium-emphasis">
                                    {address.label || "No label"}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-medium-emphasis fst-italic">
                            No addresses
                          </div>
                        )}
                      </CCardBody>
                    </CCard>
                  </CCol>

                  <CCol xs={12}>
                    <CCard>
                      <CCardHeader className="fw-semibold">
                        Redes sociales
                      </CCardHeader>
                      <CCardBody className="small">
                        {safeArray(selectedRecord.social_media).length > 0 ? (
                          <div className="d-flex flex-column gap-2">
                            {selectedRecord.social_media.map(
                              (social, index) => (
                                <div
                                  key={social.id ?? index}
                                  className="d-flex align-items-center gap-2"
                                >
                                  <CIcon icon={cilGlobeAlt} />
                                  <span className="text-break">
                                    <strong>{social.platform || "Red"}:</strong>{" "}
                                    {social.username_or_url}
                                  </span>
                                </div>
                              ),
                            )}
                          </div>
                        ) : (
                          <div className="text-medium-emphasis fst-italic">
                            No social networks
                          </div>
                        )}
                      </CCardBody>
                    </CCard>
                  </CCol>

                  <CCol xs={12}>
                    <CCard>
                      <CCardHeader className="fw-semibold">
                        Documentos
                      </CCardHeader>
                      <CCardBody className="small">
                        {selectedDocuments.length > 0 ? (
                          <div className="d-flex flex-column gap-2">
                            {selectedDocuments.map((doc) => (
                              <div
                                key={doc.id}
                                className="d-flex justify-content-between align-items-center border rounded px-3 py-2"
                              >
                                <div className="d-flex align-items-center gap-2">
                                  <CIcon icon={cilDescription} />
                                  <div>
                                    <div>{doc.file_name}</div>
                                    <div className="text-medium-emphasis small">
                                      {doc.file_type || "File"} ·{" "}
                                      {formatDateTime(doc.uploaded_at)}
                                    </div>
                                  </div>
                                </div>

                                <CButton
                                  color="primary"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => downloadDocument(doc)}
                                >
                                  <CIcon
                                    icon={cilCloudDownload}
                                    className="me-1"
                                  />
                                  Download
                                </CButton>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-medium-emphasis fst-italic">
                            No documents
                          </div>
                        )}
                      </CCardBody>
                    </CCard>
                  </CCol>
                </CRow>
              </>
            ))(selectedRecordView)}
        </CModalBody>

        <CModalFooter>
          <CButton
            color="secondary"
            variant="outline"
            onClick={closeDetailModal}
          >
            Close
          </CButton>
        </CModalFooter>
      </CModal>

      <CModal
        visible={isRecordDeleteModalOpen}
        onClose={closeRecordDeleteModal}
        alignment="center"
        className="record-confirm-modal"
      >
        <CModalHeader closeButton={false}>
          <CModalTitle>
            <span>Confirmation</span>
            <strong>Delete record</strong>
          </CModalTitle>
        </CModalHeader>

        <CModalBody>
          {recordToDelete ? (
            <>
              <p className="mb-3">
                Are you sure you want to delete this record?
              </p>

              <div className="record-confirm-summary">
                <div className="record-confirm-summary__row">
                  <strong>Name:</strong>
                  <span>{getRecordFullName(recordToDelete)}</span>
                </div>
                <div className="record-confirm-summary__row">
                  <strong>Occupation:</strong>
                  <span>{recordToDelete.occupation || "No occupation"}</span>
                </div>
              </div>
            </>
          ) : (
            <p className="mb-0">No record selected.</p>
          )}
        </CModalBody>

        <CModalFooter>
          <CButton
            color="secondary"
            variant="outline"
            onClick={closeRecordDeleteModal}
            disabled={deleteRecord.isPending}
          >
            Cancel
          </CButton>

          <CButton
            color="danger"
            onClick={confirmDeleteRecord}
            disabled={deleteRecord.isPending}
          >
            {deleteRecord.isPending ? (
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

      <CModal
        visible={isDocumentDeleteModalOpen}
        onClose={closeDocumentDeleteModal}
        alignment="center"
        className="record-confirm-modal"
      >
        <CModalHeader closeButton={false}>
          <CModalTitle>
            <span>Confirmation</span>
            <strong>Delete document</strong>
          </CModalTitle>
        </CModalHeader>

        <CModalBody>
          {documentToDelete ? (
            <>
              <p className="mb-3">
                Are you sure you want to delete this document?
              </p>

              <div className="record-confirm-summary">
                <div>
                  <strong>File:</strong>{" "}
                  {documentToDelete.file_name || "No name"}
                </div>
              </div>
            </>
          ) : (
            <p className="mb-0">No document selected.</p>
          )}
        </CModalBody>

        <CModalFooter>
          <CButton
            color="secondary"
            variant="outline"
            onClick={closeDocumentDeleteModal}
            disabled={deleteDocument.isPending}
          >
            Cancel
          </CButton>

          <CButton
            color="danger"
            onClick={confirmDeleteDocument}
            disabled={deleteDocument.isPending}
          >
            {deleteDocument.isPending ? (
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

export default Records;
