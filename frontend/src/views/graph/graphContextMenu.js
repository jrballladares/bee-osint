function isNodeTarget(target) {
  return Boolean(
    target && typeof target.isNode === "function" && target.isNode(),
  );
}

function isEdgeTarget(target) {
  return Boolean(
    target && typeof target.isEdge === "function" && target.isEdge(),
  );
}

function getElementLabel(target) {
  if (!target) return "No label";

  return target.data?.("label") || target.id?.() || "No label";
}

function createActionsMenu({ openAddNodeModal, openImportRecordModal }) {
  return {
    id: "actions",
    content: "Actions",
    coreAsWell: true,
    submenu: [
      {
        id: "add-node",
        content: "Add node",
        coreAsWell: true,
        onClickFunction: () => {
          if (typeof openAddNodeModal === "function") {
            openAddNodeModal();
          }
        },
      },
      {
        id: "import-record",
        content: "Import investigation record",
        coreAsWell: true,
        onClickFunction: () => {
          if (typeof openImportRecordModal === "function") {
            openImportRecordModal();
          }
        },
      },
    ],
  };
}

function createConnectMenu({ startConnectingFrom }) {
  return {
    id: "connect",
    content: "Connect nodes",
    selector: "node",
    onClickFunction: (event) => {
      const node = event?.target;

      if (!isNodeTarget(node)) return;
      if (typeof startConnectingFrom !== "function") return;

      startConnectingFrom(node.id());
    },
  };
}

function createElementActionsMenu({
  askDeleteEntity,
  onInvestigatePerson,
  onDownloadDocument,
}) {
  const submenu = [];

  if (typeof onInvestigatePerson === "function") {
    submenu.push({
      id: "investigate",
      content: "Investigate (search news)",
      selector: 'node[type = "person"]',
      onClickFunction: async (event) => {
        const node = event?.target;

        if (!isNodeTarget(node)) return;

        await onInvestigatePerson(node.id());
      },
    });
  }

  if (typeof onDownloadDocument === "function") {
    submenu.push({
      id: "download-document",
      content: "Download document",
      selector: 'node[type = "document"]',
      onClickFunction: async (event) => {
        const node = event?.target;

        if (!isNodeTarget(node)) return;

        await onDownloadDocument(node.id());
      },
    });
  }

  submenu.push({
    id: "delete-element",
    content: "Delete selected",
    onClickFunction: (event) => {
      const target = event?.target;

      if (!target || typeof askDeleteEntity !== "function") return;

      if (isNodeTarget(target)) {
        askDeleteEntity({
          kind: "node",
          id: Number.parseInt(target.id(), 10),
          label: getElementLabel(target),
          type: target.data?.("type") || "node",
        });

        return;
      }

      if (isEdgeTarget(target)) {
        const edgeId = String(target.id?.() || "").replace(/^e/, "");

        askDeleteEntity({
          kind: "relationship",
          id: Number.parseInt(edgeId, 10),
          label: getElementLabel(target),
          type: "relationship",
        });
      }
    },
  });

  return {
    id: "element-actions",
    content: "Element actions",
    selector: "node, edge",
    submenu,
  };
}

function createLayoutsMenu({ runLayout, fitView }) {
  const executeLayout = (layout) => {
    if (typeof runLayout === "function") {
      runLayout(layout);
    }
  };

  return {
    id: "layouts",
    content: "Distribution",
    coreAsWell: true,
    submenu: [
      {
        id: "layout-circle",
        content: "Circular",
        onClickFunction: () => executeLayout("circle"),
      },
      {
        id: "layout-fcose",
        content: "fCoSE",
        onClickFunction: () => executeLayout("fcose"),
      },
      {
        id: "layout-dagre",
        content: "Dagre (hierarchy)",
        onClickFunction: () => executeLayout("dagre"),
      },
      {
        id: "layout-klay",
        content: "Klay (hierarchy)",
        onClickFunction: () => executeLayout("klay"),
      },
      {
        id: "layout-cola",
        content: "Cola (force)",
        onClickFunction: () => executeLayout("cola"),
      },
      {
        id: "layout-cise",
        content: "CiSE (cluster circle)",
        onClickFunction: () => executeLayout("cise"),
      },
      {
        id: "fit",
        content: "Fit view",
        onClickFunction: () => {
          if (typeof fitView === "function") {
            fitView();
          }
        },
      },
    ],
  };
}

function createExportMenu({
  exportPng,
  exportJpg,
  exportSvg,
  exportJson,
  exportGraphML,
}) {
  return {
    id: "export",
    content: "Export",
    coreAsWell: true,
    submenu: [
      {
        id: "export-png",
        content: "PNG image",
        onClickFunction: () => {
          if (typeof exportPng === "function") exportPng();
        },
      },
      {
        id: "export-jpg",
        content: "JPG image",
        onClickFunction: () => {
          if (typeof exportJpg === "function") exportJpg();
        },
      },
      {
        id: "export-svg",
        content: "Vector SVG",
        onClickFunction: () => {
          if (typeof exportSvg === "function") exportSvg();
        },
      },
      {
        id: "export-json",
        content: "JSON data",
        onClickFunction: () => {
          if (typeof exportJson === "function") exportJson();
        },
      },
      {
        id: "export-graphml",
        content: "GraphML file",
        onClickFunction: () => {
          if (typeof exportGraphML === "function") exportGraphML();
        },
      },
    ],
  };
}

function createImportMenu({ triggerImport }) {
  return {
    id: "import",
    content: "Import",
    coreAsWell: true,
    submenu: [
      {
        id: "import-json",
        content: "JSON data",
        onClickFunction: () => {
          if (typeof triggerImport === "function") {
            triggerImport("json");
          }
        },
      },
      {
        id: "import-graphml",
        content: "GraphML file",
        onClickFunction: () => {
          if (typeof triggerImport === "function") {
            triggerImport("graphml");
          }
        },
      },
    ],
  };
}

export function createGraphContextMenu({
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
  onInvestigatePerson,
  onDownloadDocument,
}) {
  if (!cy || typeof cy.contextMenus !== "function") {
    return null;
  }

  const menuItems = [
    createActionsMenu({
      openAddNodeModal,
      openImportRecordModal,
    }),
    createConnectMenu({
      startConnectingFrom,
    }),
    createElementActionsMenu({
      askDeleteEntity,
      onInvestigatePerson,
      onDownloadDocument,
    }),
    createLayoutsMenu({
      runLayout,
      fitView,
    }),
    createExportMenu({
      exportPng,
      exportJpg,
      exportSvg,
      exportJson,
      exportGraphML,
    }),
    createImportMenu({
      triggerImport,
    }),
  ];

  return cy.contextMenus({ menuItems });
}
