import React, { useEffect, useMemo, useReducer } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

import routes from "../routes";

const STORAGE_KEY = "bee-open-tabs";

const normalizePath = (pathname) => {
  if (!pathname || pathname === "/") {
    return "/dashboard";
  }

  return pathname.replace(/\/+$/, "") || "/dashboard";
};

const getRouteForPath = (pathname) => {
  const normalizedPath = normalizePath(pathname);

  return routes.find((route) => {
    if (!route.path || route.path === "/") {
      return false;
    }

    if (route.path.includes(":")) {
      const basePath = route.path.split("/:")[0];
      return (
        normalizedPath === basePath || normalizedPath.startsWith(`${basePath}/`)
      );
    }

    return route.path === normalizedPath;
  });
};

const getRouteLabel = (route, pathname) => {
  if (pathname === "/dashboard") {
    return "Dashboard";
  }

  return route?.name || pathname.replace("/", "");
};

const readStoredTabs = () => {
  try {
    const parsedTabs = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY));

    if (Array.isArray(parsedTabs)) {
      return parsedTabs.filter((tab) => tab?.path && tab?.label);
    }
  } catch {
    return [];
  }

  return [];
};

const tabsReducer = (state, action) => {
  switch (action.type) {
    case "open": {
      const exists = state.some((tab) => tab.path === action.tab.path);

      return exists ? state : [...state, action.tab];
    }

    case "close":
      return state.length <= 1
        ? state
        : state.filter((tab) => tab.path !== action.path);

    default:
      return state;
  }
};

const getInitialTabs = () => {
  const storedTabs = readStoredTabs();

  return storedTabs.length
    ? storedTabs
    : [{ path: "/dashboard", label: "Dashboard" }];
};

const AppOpenTabs = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const activePath = normalizePath(location.pathname);
  const [tabs, dispatchTabs] = useReducer(
    tabsReducer,
    undefined,
    getInitialTabs,
  );

  const currentTab = useMemo(() => {
    const route = getRouteForPath(activePath);

    if (!route) {
      return null;
    }

    return {
      path: activePath,
      label: getRouteLabel(route, activePath),
    };
  }, [activePath]);

  useEffect(() => {
    if (!currentTab) {
      return;
    }

    dispatchTabs({ type: "open", tab: currentTab });
  }, [currentTab]);

  useEffect(() => {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
  }, [tabs]);

  const closeTab = (event, tabPath) => {
    event.preventDefault();
    event.stopPropagation();

    if (tabs.length <= 1) {
      return;
    }

    const closedTabIndex = tabs.findIndex((tab) => tab.path === tabPath);
    const nextTabs = tabs.filter((tab) => tab.path !== tabPath);

    dispatchTabs({ type: "close", path: tabPath });

    if (tabPath === activePath) {
      const fallbackTab =
        nextTabs[Math.max(0, closedTabIndex - 1)] || nextTabs[0];
      navigate(fallbackTab.path);
    }
  };

  if (!tabs.length) {
    return null;
  }

  return (
    <nav className="open-tabs" aria-label="Open tabs">
      <div className="open-tabs-scroll">
        {tabs.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            className={({ isActive }) => `open-tab ${isActive ? "active" : ""}`}
            title=""
          >
            <span className="open-tab-dot" aria-hidden="true"></span>
            <span className="open-tab-label">{tab.label}</span>
            {tabs.length > 1 && (
              <button
                type="button"
                className="open-tab-close"
                aria-label="Close tab"
                title=""
                onClick={(event) => closeTab(event, tab.path)}
              >
                <i className="bi bi-x-lg" aria-hidden="true"></i>
              </button>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default React.memo(AppOpenTabs);
