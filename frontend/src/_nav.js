import React from "react";

const navIcon = (iconClass, tooltip) => (
  <span
    className="d-inline-flex align-items-center"
    title={tooltip}
    data-bs-toggle="tooltip"
    data-bs-placement="right"
  >
    <i className={`${iconClass} nav-icon`}></i>
  </span>
);

const _nav = [
  {
    to: "/dashboard",
    name: "Dashboard",
    icon: navIcon("bi bi-bar-chart", "Dashboard"),
  },
  {
    to: "/news",
    name: "News",
    icon: navIcon("bi bi-rss", "News"),
  },
  {
    to: "/notes",
    name: "Notes",
    icon: navIcon("bi bi-journal-text", "Notes"),
  },
  {
    to: "/word-list",
    name: "Word List",
    icon: navIcon("bi bi-card-text", "Word List"),
  },
  {
    to: "/records",
    name: "Records",
    icon: navIcon("bi bi-folder", "Records"),
  },
  {
    to: "/osint-sources",
    name: "Osint Source",
    icon: navIcon("bi bi-globe", "Osint Source"),
  },

  {
    href: "/graph",
    name: "Graph",
    target: "_blank",
    rel: "noopener noreferrer",
    icon: navIcon("bi bi-diagram-3", "Graph"),
  },
];

export default _nav;
