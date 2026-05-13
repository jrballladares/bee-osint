import React, { useEffect, useMemo, useRef, useState } from "react";
import CytoscapeComponent from "react-cytoscapejs";
import cytoscape from "cytoscape";
import contextMenus from "cytoscape-context-menus";
import "cytoscape-context-menus/cytoscape-context-menus.css";

import popper from "cytoscape-popper";
import $ from "jquery";

import dagre from "cytoscape-dagre";
import klay from "cytoscape-klay";
import cola from "cytoscape-cola";
import cise from "cytoscape-cise";
import fcose from "cytoscape-fcose";

import cytoscapeSvg from "cytoscape-svg";
import graphml from "cytoscape-graphml";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../lib/axios";

import {
  CBadge,
  CButton,
  CCard,
  CCardBody,
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
  COffcanvas,
  COffcanvasBody,
  COffcanvasHeader,
  COffcanvasTitle,
  CSpinner,
} from "../../lib/ui.js";

import CIcon from "../../lib/Icon.js";
import {
  cilDescription,
  cilExternalLink,
  cilFolderOpen,
  cilMagnifyingGlass,
  cilPlus,
  cilTrash,
} from "../../lib/icons.js";

import personIcon from "../../assets/graph/person.svg";
import organizationIcon from "../../assets/graph/organization.svg";
import domainIcon from "../../assets/graph/domain.svg";
import newsIcon from "../../assets/graph/news.svg";
import phoneIcon from "../../assets/graph/phone.svg";
import emailIcon from "../../assets/graph/email.svg";
import addressIcon from "../../assets/graph/address.svg";
import documentIcon from "../../assets/graph/document.svg";

import { createGraphContextMenu } from "./graphContextMenu";

const registerPlugin = (name, plugin) => {
  try {
    cytoscape.use(plugin);
  } catch (error) {
    console.error(`Could not register plugin ${name}`, error);
  }
};

registerPlugin("contextMenus", contextMenus);
registerPlugin("popper", popper);
registerPlugin("dagre", dagre);
registerPlugin("klay", klay);
registerPlugin("cola", cola);
registerPlugin("cise", cise);
registerPlugin("fcose", fcose);
registerPlugin("cytoscapeSvg", cytoscapeSvg);

try {
  graphml(cytoscape, $);
} catch (error) {
  console.error("Failed to register graphml extension", error);
}

function downloadText(filename, text, mime = "text/plain") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function downloadDataUrl(filename, dataUrl) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function normalizeExternalUrl(value) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return "";

  try {
    return new URL(text).href;
  } catch {
    try {
      return new URL(`https://${text}`).href;
    } catch {
      return "";
    }
  }
}

function getGraphNewsSourceUrl(data = {}) {
  const candidates = [
    data.link,
    data.url,
    data.source_url,
    data.sourceUrl,
    data.article_url,
    data.articleUrl,
    data.original_url,
    data.originalUrl,
    data.external_url,
    data.externalUrl,
  ];

  for (const candidate of candidates) {
    const url = normalizeExternalUrl(candidate);
    if (url) return url;
  }

  return "";
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

const NODE_TYPES = [
  "person",
  "organization",
  "domain",
  "news",
  "phone",
  "email",
  "address",
  "document",
];

const pageStyle = {
  width: "100vw",
  height: "100vh",
  minHeight: "100vh",
  backgroundColor: "#ffffff",
  overflow: "hidden",
  position: "fixed",
  inset: 0,
};

const graphStageStyle = {
  position: "absolute",
  inset: 0,
  backgroundColor: "#f8fafc",
  overflow: "hidden",
};

const getGraphRoute = (graphId) => {
  return graphId ? `/graph/${graphId}` : "/graph";
};

const Graph = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [cy, setCy] = useState(null);
  const [selectedGraphId, setSelectedGraphId] = useState(
    id ? Number(id) : null,
  );
  const [selectedElement, setSelectedElement] = useState(null);

  const [isGraphsModalOpen, setIsGraphsModalOpen] = useState(false);
  const [isImportRecordModalOpen, setIsImportRecordModalOpen] = useState(false);
  const [isCreateGraphModalOpen, setIsCreateGraphModalOpen] = useState(false);
  const [newGraphName, setNewGraphName] = useState("");

  const [isAddNodeModalOpen, setIsAddNodeModalOpen] = useState(false);
  const [newNodeLabel, setNewNodeLabel] = useState("");
  const [newNodeType, setNewNodeType] = useState("person");

  const [isConnecting, setIsConnecting] = useState(false);
  const [sourceNodeId, setSourceNodeId] = useState(null);

  const [notesSaved, setNotesSaved] = useState("");
  const [notesDraft, setNotesDraft] = useState("");
  const [editingNotes, setEditingNotes] = useState(false);

  const [recordSearch, setRecordSearch] = useState("");
  const [graphSearch, setGraphSearch] = useState("");

  const [graphToDelete, setGraphToDelete] = useState(null);
  const [isGraphDeleteModalOpen, setIsGraphDeleteModalOpen] = useState(false);
  const [entityToDelete, setEntityToDelete] = useState(null);
  const [isEntityDeleteModalOpen, setIsEntityDeleteModalOpen] = useState(false);

  const fileInputRef = useRef(null);
  const importModeRef = useRef("json");

  const resetNotesState = () => {
    setNotesSaved("");
    setNotesDraft("");
    setEditingNotes(false);
  };

  const clearSelection = () => {
    if (cy) {
      cy.elements().unselect();
    }
    setSelectedElement(null);
    resetNotesState();
  };

  const stopConnecting = () => {
    if (cy) {
      cy.nodes(".source-selection").removeClass("source-selection");
    }
    setIsConnecting(false);
    setSourceNodeId(null);
  };

  const goToGraph = (graphId, replace = false) => {
    const normalizedId = graphId ? Number(graphId) : null;
    setSelectedGraphId(normalizedId);
    navigate(getGraphRoute(normalizedId), { replace });
  };

  useEffect(() => {
    if (!id) {
      setSelectedGraphId(null);
      clearSelection();
      stopConnecting();
      return;
    }

    const numericId = Number(id);
    const nextId = Number.isNaN(numericId) ? null : numericId;

    setSelectedGraphId(nextId);
    clearSelection();
    stopConnecting();
    setGraphToDelete(null);
    setIsGraphDeleteModalOpen(false);
    setEntityToDelete(null);
    setIsEntityDeleteModalOpen(false);
    setRecordSearch("");
  }, [id]);

  const openAddNodeModal = () => {
    setNewNodeLabel("");
    setNewNodeType("person");
    setIsAddNodeModalOpen(true);
  };

  const openImportRecordModal = () => {
    setRecordSearch("");
    setIsImportRecordModalOpen(true);
  };

  const startConnectingFrom = (nodeId) => {
    if (!cy) return;

    const normalizedNodeId = String(nodeId);

    cy.nodes(".source-selection").removeClass("source-selection");
    setIsConnecting(true);
    setSourceNodeId(normalizedNodeId);
    cy.getElementById(normalizedNodeId).addClass("source-selection");
  };

  const askDeleteEntity = (payload) => {
    setEntityToDelete(payload);
    setIsEntityDeleteModalOpen(true);
  };

  const askDeleteGraph = (graph) => {
    setGraphToDelete(graph);
    setIsGraphDeleteModalOpen(true);
  };

  const closeEntityDeleteModal = () => {
    setIsEntityDeleteModalOpen(false);
    setTimeout(() => setEntityToDelete(null), 180);
  };

  const closeGraphDeleteModal = () => {
    setIsGraphDeleteModalOpen(false);
    setTimeout(() => setGraphToDelete(null), 180);
  };

  const fitView = () => {
    if (!cy) return;
    cy.fit(undefined, 80);
    cy.center();
  };

  const { data: graphs = [] } = useQuery({
    queryKey: ["graphs"],
    queryFn: async () => {
      const response = await api.get("/graph/");
      return Array.isArray(response.data) ? response.data : [];
    },
  });

  const { data: graphData } = useQuery({
    queryKey: ["graph-data", selectedGraphId],
    queryFn: async () => {
      const response = await api.get(`/graph/${selectedGraphId}/data`);
      return response.data;
    },
    enabled: Number.isInteger(selectedGraphId),
  });

  const { data: records = [] } = useQuery({
    queryKey: ["records"],
    queryFn: async () => {
      const response = await api.get("/records/");
      return Array.isArray(response.data) ? response.data : [];
    },
    enabled: isImportRecordModalOpen,
  });

  const createGraphMutation = useMutation({
    mutationFn: async (name) => {
      const response = await api.post("/graph/", { name });
      return response.data;
    },
    onSuccess: async (newGraph) => {
      const newGraphId = Number(newGraph?.id);

      if (!newGraphId) {
        alert("The graph was created, but no valid ID was received");
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ["graphs"] });

      setIsCreateGraphModalOpen(false);
      setIsGraphsModalOpen(false);
      setNewGraphName("");
      clearSelection();
      stopConnecting();

      goToGraph(newGraphId, true);
    },
    onError: (error) => {
      console.error("Error creating graph:", error);
      alert("Could not create the graph");
    },
  });

  const deleteGraphMutation = useMutation({
    mutationFn: async (graphId) => {
      const response = await api.delete(`/graph/${graphId}`);
      return response.data;
    },
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["graphs"] });
      queryClient.removeQueries({ queryKey: ["graph-data", deletedId] });
      setIsGraphDeleteModalOpen(false);
      setTimeout(() => setGraphToDelete(null), 180);

      if (Number(selectedGraphId) === Number(deletedId)) {
        setSelectedGraphId(null);
        clearSelection();
        stopConnecting();
        navigate("/graph", { replace: true });
      }
    },
    onError: (error) => {
      console.error("Error deleting graph:", error);
      alert("Could not delete the graph");
    },
  });

  const createNodeMutation = useMutation({
    mutationFn: async (node) => {
      const response = await api.post("/graph/nodes", {
        ...node,
        graph_id: selectedGraphId,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["graph-data", selectedGraphId],
      });
      setIsAddNodeModalOpen(false);
      setNewNodeLabel("");
      setNewNodeType("person");
    },
    onError: (error) => {
      console.error("Error creating node:", error);
      alert("Could not create the node");
    },
  });

  const updateNodeMutation = useMutation({
    mutationFn: async ({ id: nodeId, payload }) => {
      const response = await api.put(`/graph/nodes/${nodeId}`, payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["graph-data", selectedGraphId],
      });
    },
    onError: (error) => {
      console.error("Error updating node:", error);
      alert("Could not update the node");
    },
  });

  const createRelationshipMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await api.post("/graph/relationships", {
        graph_id: selectedGraphId,
        source_id: parseInt(payload.sourceId, 10),
        target_id: parseInt(payload.targetId, 10),
        type: payload.type,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["graph-data", selectedGraphId],
      });
      stopConnecting();
    },
    onError: (error) => {
      console.error("Error creating relationship:", error);
      alert("Could not create the relation");
      stopConnecting();
    },
  });

  const importRecordMutation = useMutation({
    mutationFn: async (recordId) => {
      const response = await api.post(
        `/graph/${selectedGraphId}/import-record/${recordId}`,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["graph-data", selectedGraphId],
      });
      setIsImportRecordModalOpen(false);
      setRecordSearch("");
    },
    onError: (error) => {
      console.error("Error importing record:", error);
      alert("Could not import the record");
    },
  });

  const deleteNodeMutation = useMutation({
    mutationFn: async (nodeId) => {
      const response = await api.delete(`/graph/nodes/${nodeId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["graph-data", selectedGraphId],
      });
      clearSelection();
      setIsEntityDeleteModalOpen(false);
      setTimeout(() => setEntityToDelete(null), 180);
      stopConnecting();
    },
    onError: (error) => {
      console.error("Error deleting node:", error);
      alert("Could not delete the node");
    },
  });

  const deleteRelationshipMutation = useMutation({
    mutationFn: async (relId) => {
      const response = await api.delete(`/graph/relationships/${relId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["graph-data", selectedGraphId],
      });
      clearSelection();
      setIsEntityDeleteModalOpen(false);
      setTimeout(() => setEntityToDelete(null), 180);
    },
    onError: (error) => {
      console.error("Error deleting relationship:", error);
      alert("Could not delete the relation");
    },
  });

  const iconByType = useMemo(
    () => ({
      person: personIcon,
      organization: organizationIcon,
      domain: domainIcon,
      news: newsIcon,
      phone: phoneIcon,
      email: emailIcon,
      address: addressIcon,
      document: documentIcon,
    }),
    [],
  );

  const nodes = Array.isArray(graphData?.nodes) ? graphData.nodes : [];
  const relationships = Array.isArray(graphData?.relationships)
    ? graphData.relationships
    : [];

  const elements = useMemo(() => {
    return [
      ...nodes.map((node) => ({
        data: {
          id: String(node.id),
          label: node.label,
          type: node.type,
          data: node.data || {},
          icon: iconByType[node.type] || null,
        },
      })),
      ...relationships.map((rel) => ({
        data: {
          id: `e${rel.id}`,
          source: String(rel.source_id),
          target: String(rel.target_id),
          label: rel.type,
        },
      })),
    ];
  }, [nodes, relationships, iconByType]);

  const defaultLayout = useMemo(
    () => ({
      name: "fcose",
      animate: true,
      fit: true,
      padding: 80,
      randomize: true,
      quality: "proof",
      nodeSeparation: 170,
      idealEdgeLength: 190,
      gravity: 0.28,
      nestingFactor: 0.8,
    }),
    [],
  );

  useEffect(() => {
    if (!cy || !selectedGraphId) return;

    let cancelled = false;

    const timer = setTimeout(() => {
      try {
        cy.resize();

        if (elements.length > 0) {
          const layoutInstance = cy.layout(defaultLayout);
          layoutInstance.run();

          setTimeout(() => {
            if (cancelled) return;
            fitView();
          }, 500);
        }
      } catch (error) {
        console.error("Error applying layout:", error);
      }
    }, 120);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [cy, elements, defaultLayout, selectedGraphId]);

  useEffect(() => {
    if (!cy) return;

    const handleResize = () => {
      cy.resize();
      fitView();
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [cy]);

  useEffect(() => {
    if (!selectedGraphId) return;
    if (!graphs.length) return;

    const exists = graphs.some(
      (graph) => Number(graph.id) === Number(selectedGraphId),
    );

    if (!exists) {
      setSelectedGraphId(null);
      clearSelection();
      stopConnecting();
      navigate("/graph", { replace: true });
    }
  }, [graphs, selectedGraphId, navigate]);

  const cyStyle = [
    {
      selector: "node",
      style: {
        label: "data(label)",
        "background-color": "transparent",
        "background-opacity": 0,
        "background-image": "data(icon)",
        "background-image-opacity": 1,
        "background-image-containment": "over",
        "background-repeat": "no-repeat",
        "background-fit": "contain",
        "background-clip": "none",
        "background-width": "46%",
        "background-height": "46%",
        "background-position-x": "50%",
        "background-position-y": "42%",
        "border-width": 0,
        "border-opacity": 0,
        color: "#31455f",
        "font-size": "9px",
        width: 48,
        height: 48,
        shape: "ellipse",
        "text-valign": "bottom",
        "text-margin-y": 7,
        "text-wrap": "wrap",
        "text-max-width": "128px",
        "text-justification": "center",
        "text-halign": "center",
        "text-background-color": "#ffffff",
        "text-background-opacity": 0.96,
        "text-background-padding": "3px",
        "text-background-shape": "rectangle",
      },
    },
    {
      selector: "node[!icon]",
      style: {
        "background-color": "#f8fafc",
        "background-opacity": 1,
        shape: "ellipse",
        "border-width": 1,
        "border-color": "#dfe7f1",
      },
    },
    {
      selector: "edge",
      style: {
        width: 1.05,
        "line-color": "#dbe4ef",
        "target-arrow-color": "#dbe4ef",
        "target-arrow-shape": "triangle",
        label: "data(label)",
        color: "#7b8aa3",
        "font-size": "7.5px",
        "curve-style": "bezier",
        "text-background-color": "#ffffff",
        "text-background-opacity": 0.92,
        "text-background-padding": "2px",
      },
    },
    {
      selector: "node:selected",
      style: {
        "border-width": 2,
        "border-color": "#36bd7d",
        "border-opacity": 1,
      },
    },
    {
      selector: "edge:selected",
      style: {
        width: 2,
        "line-color": "#36bd7d",
        "target-arrow-color": "#36bd7d",
      },
    },
    {
      selector: ".source-selection",
      style: {
        "border-width": 3,
        "border-color": "#36bd7d",
        "border-style": "double",
        "border-opacity": 1,
      },
    },
  ];

  const exportPng = () => {
    if (!cy || !selectedGraphId) return;
    const dataUrl = cy.png({ full: true, scale: 2, bg: "#ffffff" });
    downloadDataUrl(`graph-${selectedGraphId}.png`, dataUrl);
  };

  const exportJpg = () => {
    if (!cy || !selectedGraphId) return;
    const dataUrl = cy.jpg({ full: true, quality: 0.95, bg: "#ffffff" });
    downloadDataUrl(`graph-${selectedGraphId}.jpg`, dataUrl);
  };

  const exportSvg = () => {
    if (!cy || !selectedGraphId || typeof cy.svg !== "function") {
      alert("SVG export is not available");
      return;
    }

    try {
      const svg = cy.svg({ scale: 1, full: true, bg: "#ffffff" });
      downloadText(`graph-${selectedGraphId}.svg`, svg, "image/svg+xml");
    } catch (error) {
      console.error("SVG Export failed:", error);
      alert("Could not export SVG");
    }
  };

  const exportJson = () => {
    if (!cy || !selectedGraphId) return;

    const payload = {
      elements: cy.elements().jsons(),
      zoom: cy.zoom(),
      pan: cy.pan(),
    };

    downloadText(
      `graph-${selectedGraphId}.json`,
      JSON.stringify(payload, null, 2),
      "application/json",
    );
  };

  const exportGraphML = () => {
    if (!cy || !selectedGraphId || typeof cy.graphml !== "function") {
      alert("GraphML export is not available");
      return;
    }

    try {
      const xml = cy.graphml();
      if (!xml) throw new Error("GraphML export returned empty result");
      downloadText(`graph-${selectedGraphId}.graphml`, xml, "application/xml");
    } catch (error) {
      console.error("GraphML Export failed:", error);
      alert(`GraphML Export failed: ${error.message}`);
    }
  };

  const downloadSelectedDocument = async (nodeId) => {
    if (!selectedGraphId || !nodeId) return;

    try {
      const response = await api.get(
        `/graph/${selectedGraphId}/documents/${parseInt(nodeId, 10)}/download`,
        {
          responseType: "blob",
        },
      );

      const node = nodes.find((item) => Number(item.id) === Number(nodeId));
      const fallbackName = node?.label || `document-${nodeId}`;
      const contentDisposition = response.headers?.["content-disposition"];
      const filename = getFilenameFromContentDisposition(
        contentDisposition,
        fallbackName,
      );

      downloadBlob(filename, response.data);
    } catch (error) {
      console.error("Error downloading document:", error);
      alert("Could not download the document");
    }
  };

  const triggerImport = (mode) => {
    importModeRef.current = mode;
    fileInputRef.current?.click();
  };

  const runLayout = (name) => {
    if (!cy) return;

    let opts;

    switch (name) {
      case "dagre":
        opts = {
          name: "dagre",
          animate: true,
          padding: 80,
          rankDir: "LR",
          nodeSep: 100,
          rankSep: 150,
          edgeSep: 30,
        };
        break;
      case "klay":
        opts = {
          name: "klay",
          animate: true,
          padding: 80,
          klay: { direction: "RIGHT", spacing: 70 },
        };
        break;
      case "cola":
        opts = {
          name: "cola",
          animate: true,
          padding: 80,
          maxSimulationTime: 3000,
          nodeSpacing: 70,
          edgeLength: 160,
          randomize: true,
          infinite: false,
        };
        break;
      case "cise":
        opts = {
          name: "cise",
          animate: true,
          padding: 80,
          fit: true,
        };
        break;
      case "fcose":
        opts = {
          name: "fcose",
          animate: true,
          padding: 80,
          randomize: true,
          quality: "proof",
          nodeSeparation: 170,
          idealEdgeLength: 190,
          gravity: 0.28,
          nestingFactor: 0.8,
        };
        break;
      case "circle":
      default:
        opts = {
          name: "circle",
          animate: true,
          padding: 80,
        };
        break;
    }

    try {
      cy.layout(opts).run();

      setTimeout(() => {
        fitView();
      }, 350);
    } catch (error) {
      console.error(`Error running layout "${name}":`, error);
      alert(`Could not run layout ${name}`);
    }
  };

  const onImportFile = async (file) => {
    if (!cy) return;

    let text = "";

    try {
      text = await file.text();
    } catch (error) {
      console.error("Error reading file:", error);
      alert("Could not read the file");
      return;
    }

    if (importModeRef.current === "json") {
      let parsed;

      try {
        parsed = JSON.parse(text);
      } catch {
        alert("Invalid JSON");
        return;
      }

      const importedElements = Array.isArray(parsed) ? parsed : parsed.elements;

      if (!Array.isArray(importedElements)) {
        alert("JSON must be an array of elements or { elements: [...] }");
        return;
      }

      try {
        clearSelection();
        stopConnecting();
        cy.elements().remove();
        cy.add(importedElements);
        cy.layout({ name: "circle", animate: true, padding: 80 }).run();

        if (typeof parsed?.zoom === "number") cy.zoom(parsed.zoom);
        if (parsed?.pan && typeof parsed.pan === "object") cy.pan(parsed.pan);

        fitView();
      } catch (error) {
        console.error("JSON import failed:", error);
        alert("Could not import JSON");
      }

      return;
    }

    if (typeof cy.graphml !== "function") {
      alert("GraphML import is not available");
      return;
    }

    try {
      clearSelection();
      stopConnecting();
      cy.elements().remove();
      const cleanText = text.trim();

      try {
        cy.graphml(cleanText);
      } catch {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(cleanText, "text/xml");
        const parserError = xmlDoc.getElementsByTagName("parsererror");

        if (parserError.length > 0) {
          throw new Error(`XML Parsing Error: ${parserError[0].textContent}`);
        }

        cy.graphml(xmlDoc);
      }

      setTimeout(() => {
        runLayout("fcose");
      }, 120);
    } catch (error) {
      console.error("GraphML import failed completely:", error);
      alert(`Invalid GraphML: ${error.message || "Unknown error"}`);
    }
  };

  const loadNotesFromSelection = (selection) => {
    if (!selection || !selection.isNode) {
      resetNotesState();
      return;
    }

    const saved = selection.data?.notes || "";
    setNotesSaved(saved);
    setNotesDraft(saved);
    setEditingNotes(false);
  };

  const saveNotes = async () => {
    if (!selectedElement?.isNode) return;

    try {
      const nodeId = parseInt(selectedElement.id, 10);
      const label = selectedElement.label;
      const type = selectedElement.type;
      const originalData = selectedElement.data || {};

      await updateNodeMutation.mutateAsync({
        id: nodeId,
        payload: {
          label,
          type,
          data: {
            ...originalData,
            notes: notesDraft,
          },
        },
      });

      setNotesSaved(notesDraft);
      setEditingNotes(false);
      setSelectedElement((prev) =>
        prev
          ? {
              ...prev,
              data: {
                ...(prev.data || {}),
                notes: notesDraft,
              },
            }
          : prev,
      );
    } catch (error) {
      console.error("Error saving notes:", error);
    }
  };

  const deleteNotes = async () => {
    if (!selectedElement?.isNode) return;

    try {
      const nodeId = parseInt(selectedElement.id, 10);
      const label = selectedElement.label;
      const type = selectedElement.type;
      const originalData = selectedElement.data || {};

      await updateNodeMutation.mutateAsync({
        id: nodeId,
        payload: {
          label,
          type,
          data: {
            ...originalData,
            notes: "",
          },
        },
      });

      setNotesSaved("");
      setNotesDraft("");
      setEditingNotes(false);
      setSelectedElement((prev) =>
        prev
          ? {
              ...prev,
              data: {
                ...(prev.data || {}),
                notes: "",
              },
            }
          : prev,
      );
    } catch (error) {
      console.error("Error deleting notes:", error);
    }
  };

  const confirmDeleteEntity = () => {
    if (!entityToDelete) return;

    if (entityToDelete.kind === "node") {
      deleteNodeMutation.mutate(entityToDelete.id);
      return;
    }

    if (entityToDelete.kind === "relationship") {
      deleteRelationshipMutation.mutate(entityToDelete.id);
    }
  };

  const investigatePerson = async (nodeId) => {
    if (!selectedGraphId) return;

    try {
      await api.post(
        `/graph/${selectedGraphId}/investigate/${parseInt(nodeId, 10)}`,
      );
      queryClient.invalidateQueries({
        queryKey: ["graph-data", selectedGraphId],
      });
    } catch (error) {
      console.error("WordList failed:", error);
      alert("Could not run the investigation");
    }
  };

  useEffect(() => {
    if (!cy) return;

    const onBgTap = (event) => {
      if (event.target !== cy) return;
      clearSelection();
      stopConnecting();
    };

    const onElTap = (event) => {
      const target = event.target;
      if (!target || target === cy) return;

      if (isConnecting && target.isNode()) {
        const targetId = target.id();

        if (!sourceNodeId) {
          startConnectingFrom(targetId);
          return;
        }

        if (sourceNodeId === targetId) {
          stopConnecting();
          return;
        }

        const relationType = window.prompt("Relationship type:", "related_to");

        if (relationType?.trim()) {
          createRelationshipMutation.mutate({
            sourceId: sourceNodeId,
            targetId,
            type: relationType.trim(),
          });
        } else {
          stopConnecting();
        }

        return;
      }

      cy.elements().unselect();
      target.select();

      const selection = {
        id: target.id(),
        label: target.data("label") || target.id(),
        type: target.isNode() ? target.data("type") : "relationship",
        data: target.data("data") || {},
        isNode: target.isNode(),
      };

      setSelectedElement(selection);
      loadNotesFromSelection(selection);
    };

    cy.on("tap", onBgTap);
    cy.on("tap", "node, edge", onElTap);

    return () => {
      cy.off("tap", onBgTap);
      cy.off("tap", "node, edge", onElTap);
    };
  }, [cy, isConnecting, sourceNodeId, createRelationshipMutation]);

  useEffect(() => {
    if (!cy) return;

    const menu = createGraphContextMenu({
      cy,
      openAddNodeModal,
      openImportRecordModal,
      startConnectingFrom,
      askDeleteEntity,
      runLayout,
      exportPng,
      exportJpg,
      exportSvg,
      exportJson,
      exportGraphML,
      triggerImport,
      fitView,
      onInvestigatePerson: investigatePerson,
      onDownloadDocument: downloadSelectedDocument,
    });

    return () => {
      try {
        menu?.destroy?.();
      } catch (error) {
        console.error("Error destroying context menu:", error);
      }
    };
  }, [cy, selectedGraphId, nodes]);

  const filteredRecords = useMemo(() => {
    const term = recordSearch.trim().toLowerCase();
    if (!term) return records;

    return records.filter((record) => {
      const fullName =
        `${record.first_name || ""} ${record.last_name || ""}`.toLowerCase();
      const idNumber = String(record.id_number || "").toLowerCase();
      return fullName.includes(term) || idNumber.includes(term);
    });
  }, [records, recordSearch]);

  const filteredGraphs = useMemo(() => {
    const term = graphSearch.trim().toLowerCase();
    if (!term) return graphs;

    return graphs.filter((graph) => {
      const name = String(graph.name || "").toLowerCase();
      const graphId = String(graph.id || "").toLowerCase();
      return name.includes(term) || graphId.includes(term);
    });
  }, [graphs, graphSearch]);

  const selectedElementSourceUrl =
    selectedElement?.isNode && selectedElement.type === "news"
      ? getGraphNewsSourceUrl(selectedElement.data)
      : "";

  return (
    <div className="graph-workspace" style={pageStyle}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.graphml,.xml"
        className="d-none"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          await onImportFile(file);
          e.currentTarget.value = "";
        }}
      />

      {selectedGraphId && (
        <div className="graph-toolbar">
          <CCard className="graph-toolbar__card">
            <CCardBody>
              <div className="graph-toolbar__actions">
                <CButton
                  color="secondary"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setGraphSearch("");
                    setIsGraphsModalOpen(true);
                  }}
                >
                  Switch graph
                </CButton>

                <CButton
                  color="primary"
                  size="sm"
                  onClick={() => {
                    setIsCreateGraphModalOpen(true);
                    setNewGraphName("");
                  }}
                >
                  New graph
                </CButton>
              </div>
            </CCardBody>
          </CCard>
        </div>
      )}

      <div
        className="graph-stage"
        style={{ ...graphStageStyle, position: "absolute" }}
      >
        {selectedGraphId ? (
          <CytoscapeComponent
            elements={elements}
            style={{ width: "100%", height: "100%" }}
            stylesheet={cyStyle}
            cy={(cyInstance) => {
              setCy((prev) => (prev === cyInstance ? prev : cyInstance));
            }}
            layout={defaultLayout}
          />
        ) : (
          <div className="graph-empty-state">
            <div className="graph-empty-state__panel">
              <h2>Relationship graphs</h2>
              <p>
                Select a graph to analyze entities, connections and records.
              </p>

              <div className="graph-empty-state__actions">
                <CButton
                  color="primary"
                  size="sm"
                  onClick={() => {
                    setGraphSearch("");
                    setIsGraphsModalOpen(true);
                  }}
                >
                  <CIcon icon={cilFolderOpen} className="me-2" />
                  Open graph
                </CButton>
                <CButton
                  color="secondary"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsCreateGraphModalOpen(true);
                    setNewGraphName("");
                  }}
                >
                  <CIcon icon={cilPlus} className="me-2" />
                  New graph
                </CButton>
              </div>
            </div>
          </div>
        )}
      </div>

      <COffcanvas
        placement="end"
        visible={Boolean(selectedElement)}
        onHide={clearSelection}
        backdrop={false}
        scroll
        className="graph-side-panel"
        style={{ width: "360px", maxWidth: "100vw" }}
      >
        <COffcanvasHeader className="graph-side-panel__header">
          <div className="graph-side-panel__heading">
            <span>Graph</span>
            <COffcanvasTitle>Element detail</COffcanvasTitle>
          </div>
        </COffcanvasHeader>

        <COffcanvasBody>
          {selectedElement && (
            <div className="graph-detail">
              <section className="graph-detail__summary">
                <span className="graph-detail__label">Label</span>
                <h3>{selectedElement.label || "No label"}</h3>

                <div className="graph-detail__meta">
                  <div>
                    <span>ID</span>
                    <strong>{selectedElement.id}</strong>
                  </div>

                  <div>
                    <span>Type</span>
                    <CBadge className="graph-detail__badge">
                      {selectedElement.type || "sin tipo"}
                    </CBadge>
                  </div>
                </div>

                {selectedElementSourceUrl && (
                  <CButton
                    className="graph-detail__source-button"
                    color="secondary"
                    variant="outline"
                    size="sm"
                    component="a"
                    href={selectedElementSourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open source
                    <CIcon icon={cilExternalLink} />
                  </CButton>
                )}
              </section>

              {selectedElement.isNode && (
                <section className="graph-detail__notes">
                  <div className="graph-detail__section-title">
                    <span>Notes</span>
                  </div>

                  {editingNotes ? (
                    <>
                      <CFormTextarea
                        rows={7}
                        value={notesDraft}
                        onChange={(e) => setNotesDraft(e.target.value)}
                        placeholder="Write notes about this node..."
                      />

                      <div className="graph-detail__actions">
                        <CButton
                          color="primary"
                          size="sm"
                          onClick={saveNotes}
                          disabled={updateNodeMutation.isPending}
                        >
                          {updateNodeMutation.isPending
                            ? "Saving..."
                            : "Save"}
                        </CButton>

                        <CButton
                          color="secondary"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setNotesDraft(notesSaved);
                            setEditingNotes(false);
                          }}
                        >
                          Cancel
                        </CButton>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="graph-detail__notes-body">
                        {notesSaved?.trim() ? (
                          notesSaved
                        ) : (
                          <span>No notes yet.</span>
                        )}
                      </div>

                      <div className="graph-detail__actions">
                        <CButton
                          color="secondary"
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingNotes(true)}
                        >
                          {notesSaved?.trim() ? "Edit" : "Add"}
                        </CButton>

                        {notesSaved.trim().length > 0 && (
                          <CButton
                            color="danger"
                            variant="outline"
                            size="sm"
                            onClick={deleteNotes}
                            disabled={updateNodeMutation.isPending}
                          >
                            Delete notes
                          </CButton>
                        )}
                      </div>
                    </>
                  )}
                </section>
              )}
            </div>
          )}
        </COffcanvasBody>
      </COffcanvas>

      <CModal
        visible={isGraphsModalOpen}
        onClose={() => {
          setIsGraphsModalOpen(false);
          setGraphSearch("");
        }}
        alignment="center"
        className="graph-modal graph-picker-modal"
      >
        <CModalHeader closeButton={false}>
          <CModalTitle>
            <span>Graphs</span>
            <strong>Select graph</strong>
          </CModalTitle>
        </CModalHeader>

        <CModalBody>
          <div className="graph-modal-search">
            <CInputGroup>
              <CInputGroupText>
                <CIcon icon={cilMagnifyingGlass} />
              </CInputGroupText>
              <CFormInput
                placeholder="Search by name or ID..."
                value={graphSearch}
                onChange={(e) => setGraphSearch(e.target.value)}
              />
            </CInputGroup>
          </div>

          <div className="graph-picker-list">
            {filteredGraphs.length > 0 ? (
              <div className="graph-picker-items">
                {filteredGraphs.map((graph) => {
                  const isActive = Number(selectedGraphId) === Number(graph.id);

                  return (
                    <CCard
                      key={graph.id}
                      className={`graph-picker-item ${isActive ? "is-active" : ""}`}
                    >
                      <CCardBody>
                        <div className="graph-picker-item__main">
                          <div className="graph-picker-item__text">
                            <strong title={graph.name}>{graph.name}</strong>
                            <span>ID: {graph.id}</span>
                          </div>

                          <div className="graph-picker-item__actions">
                            {isActive ? (
                              <span className="graph-current-badge">
                                Actual
                              </span>
                            ) : (
                              <CButton
                                color="primary"
                                size="sm"
                                className="graph-icon-button graph-icon-button--primary"
                                onClick={() => {
                                  goToGraph(graph.id);
                                  setIsGraphsModalOpen(false);
                                  setGraphSearch("");
                                }}
                                title="Open graph"
                              >
                                <CIcon icon={cilExternalLink} />
                              </CButton>
                            )}

                            <CButton
                              color="danger"
                              variant="outline"
                              size="sm"
                              className="graph-icon-button graph-icon-button--danger"
                              onClick={() => askDeleteGraph(graph)}
                              disabled={deleteGraphMutation.isPending}
                              title="Delete graph"
                            >
                              <CIcon icon={cilTrash} />
                            </CButton>
                          </div>
                        </div>
                      </CCardBody>
                    </CCard>
                  );
                })}
              </div>
            ) : (
              <div className="graph-picker-empty">No graphs found.</div>
            )}
          </div>
        </CModalBody>

        <CModalFooter>
          <CButton
            color="secondary"
            variant="outline"
            size="sm"
            onClick={() => {
              setIsGraphsModalOpen(false);
              setGraphSearch("");
            }}
          >
            Close
          </CButton>
        </CModalFooter>
      </CModal>

      <CModal
        visible={isAddNodeModalOpen}
        onClose={() => {
          setIsAddNodeModalOpen(false);
          setNewNodeLabel("");
          setNewNodeType("person");
        }}
        alignment="center"
        className="graph-modal"
      >
        <CModalHeader>
          <CModalTitle>Add node</CModalTitle>
        </CModalHeader>

        <CModalBody>
          <div className="mb-3">
            <CFormLabel>Label</CFormLabel>
            <CFormInput
              autoFocus
              placeholder="Node label (e.g. John Doe)"
              value={newNodeLabel}
              onChange={(e) => setNewNodeLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newNodeLabel.trim()) {
                  createNodeMutation.mutate({
                    label: newNodeLabel.trim(),
                    type: newNodeType,
                  });
                }
              }}
            />
          </div>

          <div>
            <CFormLabel>Type</CFormLabel>
            <CFormSelect
              value={newNodeType}
              onChange={(e) => setNewNodeType(e.target.value)}
            >
              {NODE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </CFormSelect>
          </div>
        </CModalBody>

        <CModalFooter>
          <CButton
            color="secondary"
            variant="outline"
            onClick={() => {
              setIsAddNodeModalOpen(false);
              setNewNodeLabel("");
              setNewNodeType("person");
            }}
          >
            Cancel
          </CButton>

          <CButton
            color="primary"
            onClick={() => {
              if (!newNodeLabel.trim()) return;
              createNodeMutation.mutate({
                label: newNodeLabel.trim(),
                type: newNodeType,
              });
            }}
            disabled={!newNodeLabel.trim() || createNodeMutation.isPending}
          >
            {createNodeMutation.isPending ? "Creating..." : "Create"}
          </CButton>
        </CModalFooter>
      </CModal>

      <CModal
        visible={isCreateGraphModalOpen}
        onClose={() => {
          setIsCreateGraphModalOpen(false);
          setNewGraphName("");
        }}
        alignment="center"
        className="graph-modal"
      >
        <CModalHeader>
          <CModalTitle>New investigation graph</CModalTitle>
        </CModalHeader>

        <CModalBody>
          <CFormLabel>Graph name</CFormLabel>
          <CFormInput
            autoFocus
            placeholder="Graph name (ej. Caso 2024-A)"
            value={newGraphName}
            onChange={(e) => setNewGraphName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newGraphName.trim()) {
                createGraphMutation.mutate(newGraphName.trim());
              }
            }}
          />
        </CModalBody>

        <CModalFooter>
          <CButton
            color="secondary"
            variant="outline"
            onClick={() => {
              setIsCreateGraphModalOpen(false);
              setNewGraphName("");
            }}
          >
            Cancel
          </CButton>

          <CButton
            color="primary"
            onClick={() => {
              if (newGraphName.trim()) {
                createGraphMutation.mutate(newGraphName.trim());
              }
            }}
            disabled={!newGraphName.trim() || createGraphMutation.isPending}
          >
            {createGraphMutation.isPending ? "Creating..." : "Create"}
          </CButton>
        </CModalFooter>
      </CModal>

      <CModal
        visible={isImportRecordModalOpen}
        onClose={() => setIsImportRecordModalOpen(false)}
        size="lg"
        alignment="center"
        className="graph-modal"
      >
        <CModalHeader>
          <CModalTitle>Import investigation record</CModalTitle>
        </CModalHeader>

        <CModalBody>
          <div className="mb-4">
            <CInputGroup>
              <CInputGroupText>
                <CIcon icon={cilMagnifyingGlass} />
              </CInputGroupText>
              <CFormInput
                placeholder="Search records..."
                value={recordSearch}
                onChange={(e) => setRecordSearch(e.target.value)}
              />
            </CInputGroup>
          </div>

          <div
            style={{
              maxHeight: "50vh",
              overflowY: "auto",
              position: "relative",
            }}
          >
            {filteredRecords.length > 0 ? (
              <div className="d-flex flex-column gap-2">
                {filteredRecords.map((record) => (
                  <CCard key={record.id} className="border">
                    <CCardBody className="d-flex justify-content-between align-items-center gap-3">
                      <div>
                        <div className="fw-semibold">
                          {record.first_name} {record.last_name}
                        </div>

                        <div className="small text-medium-emphasis d-flex gap-3 flex-wrap mt-1">
                          {record.id_number && (
                            <span>ID: {record.id_number}</span>
                          )}
                          <span className="d-flex align-items-center gap-1">
                            <CIcon icon={cilDescription} size="sm" />
                            {record.documents?.length || 0} docs
                          </span>
                        </div>
                      </div>

                      <CButton
                        color="primary"
                        size="sm"
                        onClick={() => importRecordMutation.mutate(record.id)}
                        disabled={importRecordMutation.isPending}
                      >
                        Import
                      </CButton>
                    </CCardBody>
                  </CCard>
                ))}
              </div>
            ) : (
              <div className="text-center text-medium-emphasis py-5">
                No records found
              </div>
            )}
          </div>
        </CModalBody>

        <CModalFooter>
          <CButton
            color="secondary"
            variant="outline"
            onClick={() => setIsImportRecordModalOpen(false)}
          >
            Close
          </CButton>
        </CModalFooter>
      </CModal>

      <CModal
        visible={isEntityDeleteModalOpen}
        onClose={closeEntityDeleteModal}
        alignment="center"
        className="graph-modal graph-confirm-modal"
      >
        <CModalHeader closeButton={false}>
          <CModalTitle>
            <span>Confirmation</span>
            <strong>
              Delete {entityToDelete?.kind === "node" ? "entity" : "relation"}
            </strong>
          </CModalTitle>
        </CModalHeader>

        <CModalBody>
          {entityToDelete ? (
            <>
              <p>
                Are you sure you want to delete this{" "}
                {entityToDelete.kind === "node" ? "entity" : "relation"}?
              </p>

              <div className="graph-confirm-summary">
                <div className="graph-confirm-summary__row">
                  <strong>Type:</strong>
                  <span>{entityToDelete.type}</span>
                </div>
                <div className="graph-confirm-summary__row">
                  <strong>Label:</strong>
                  <span>{entityToDelete.label || "No label"}</span>
                </div>
              </div>
            </>
          ) : (
            <p className="mb-0">No element selected.</p>
          )}
        </CModalBody>

        <CModalFooter>
          <CButton
            color="secondary"
            variant="outline"
            onClick={closeEntityDeleteModal}
            disabled={
              deleteNodeMutation.isPending ||
              deleteRelationshipMutation.isPending
            }
          >
            Cancel
          </CButton>

          <CButton
            color="danger"
            onClick={confirmDeleteEntity}
            disabled={
              deleteNodeMutation.isPending ||
              deleteRelationshipMutation.isPending
            }
          >
            {deleteNodeMutation.isPending ||
            deleteRelationshipMutation.isPending ? (
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
        visible={isGraphDeleteModalOpen}
        onClose={closeGraphDeleteModal}
        alignment="center"
        className="graph-modal graph-confirm-modal"
      >
        <CModalHeader closeButton={false}>
          <CModalTitle>
            <span>Confirmation</span>
            <strong>Delete graph</strong>
          </CModalTitle>
        </CModalHeader>

        <CModalBody>
          {graphToDelete ? (
            <>
              <p>Are you sure you want to delete this graph?</p>

              <div className="graph-confirm-summary">
                <div className="graph-confirm-summary__row">
                  <strong>Name:</strong>
                  <span>{graphToDelete.name}</span>
                </div>
                <div className="graph-confirm-summary__row">
                  <strong>ID:</strong>
                  <span>{graphToDelete.id}</span>
                </div>
              </div>
            </>
          ) : (
            <p className="mb-0">No graph selected.</p>
          )}
        </CModalBody>

        <CModalFooter>
          <CButton
            color="secondary"
            variant="outline"
            onClick={closeGraphDeleteModal}
            disabled={deleteGraphMutation.isPending}
          >
            Cancel
          </CButton>

          <CButton
            color="danger"
            onClick={() => {
              if (!graphToDelete) return;
              deleteGraphMutation.mutate(graphToDelete.id);
            }}
            disabled={deleteGraphMutation.isPending}
          >
            {deleteGraphMutation.isPending ? (
              <>
                <CSpinner size="sm" className="me-2" />
                Deleting...
              </>
            ) : (
              "Delete graph"
            )}
          </CButton>
        </CModalFooter>
      </CModal>
    </div>
  );
};

export default Graph;
