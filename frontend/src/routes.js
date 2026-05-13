/**
 * Application Routes Configuration
 *
 * Defines all protected routes in the application using React lazy loading
 * for code splitting and performance optimization.
 *
 * Each route object contains:
 * - path: URL path for the route
 * - name: Human-readable name for breadcrumbs
 * - element: Lazy-loaded React component
 */

import React from "react";
import { Navigate } from "react-router-dom";

// Redirect component
const RootRedirect = () => <Navigate to="/dashboard" replace />;

// Dashboard
const Dashboard = React.lazy(() => import("./views/dashboard/Dashboard"));

// Application Modules
const News = React.lazy(() => import("./views/news/news"));
const Notes = React.lazy(() => import("./views/notes/notes"));
const Records = React.lazy(() => import("./views/records/records"));
const OsintSources = React.lazy(
  () => import("./views/osintSources/OsintSources"),
);
const WordList = React.lazy(() => import("./views/wordList/WordList"));

// Analytics
const Graph = React.lazy(() => import("./views/graph/graph"));

const routes = [
  // Root redirect
  { path: "/", name: "Inicio", element: RootRedirect },

  // Main
  { path: "/dashboard", name: "Dashboard", element: Dashboard },

  // Modules
  { path: "/news", name: "News", element: News },
  { path: "/notes", name: "Notes", element: Notes },
  { path: "/word-list", name: "Word List", element: WordList },
  { path: "/records", name: "Records", element: Records },
  { path: "/osint-sources", name: "Osint Source", element: OsintSources },

  // Graph analytics
  { path: "/graph", name: "Graph", element: Graph },
  { path: "/graph/:id", name: "Graph detail", element: Graph },
];

export default routes;
