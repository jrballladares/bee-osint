/**
 * AppContent Component
 *
 * Main content area that renders routes defined in routes.js.
 * Handles lazy loading with Suspense and provides a loading spinner
 * while components are being loaded.
 *
 * Features:
 * - Dynamic route rendering from routes configuration
 * - Suspense boundary for lazy-loaded components
 * - Loading spinner fallback during component load
 *
 * @component
 * @example
 * return (
 *   <AppContent />
 * )
 */

import React, { Suspense } from "react";
import { Route, Routes } from "react-router-dom";

// routes config
import routes from "../routes";

/**
 * AppContent functional component
 *
 * Renders all application routes within a container with:
 * - Suspense for lazy-loaded route components
 * - Spinner shown during component loading
 *
 * Memoized to prevent unnecessary re-renders when parent updates.
 *
 * @returns {React.ReactElement} Content container with routed views
 */
const AppContent = () => {
  return (
    <div className="container-fluid px-4">
      <Suspense
        fallback={
          <div className="d-flex justify-content-center align-items-center py-5">
            <div
              className="spinner-border text-primary"
              role="status"
              aria-hidden="true"
            ></div>
            <span className="visually-hidden">Loading...</span>
          </div>
        }
      >
        <Routes>
          {routes.map((route, idx) => {
            const Component = route.element;

            return Component ? (
              <Route key={idx} path={route.path} element={<Component />} />
            ) : null;
          })}
        </Routes>
      </Suspense>
    </div>
  );
};

export default React.memo(AppContent);
