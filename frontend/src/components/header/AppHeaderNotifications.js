import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../../lib/axios";

const WORD_LIST_ALERT_REFRESH_MS = 5000;

const formatDate = (value) => {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

const getAlertTitle = (alert) =>
  String(alert?.title || "")
    .replace(/^Nueva coincidencia en\s+/i, "New match in ")
    .trim();

const getAlertMessage = (alert) =>
  String(alert?.message || "")
    .replace(
      /^Se detectó una noticia relacionada con:\s*/i,
      "Related news detected for: ",
    )
    .trim();

const fetchAlerts = async () => {
  const { data } = await api.get("/word-lists/alerts");
  return Array.isArray(data) ? data : [];
};

const updateAlertReadState = (alerts, alertIds, isRead) => {
  const ids = new Set(alertIds);
  return (alerts || []).map((alert) =>
    ids.has(alert.id) ? { ...alert, is_read: isRead } : alert,
  );
};

const AppHeaderNotifications = () => {
  const queryClient = useQueryClient();

  const { data: alerts = [] } = useQuery({
    queryKey: ["word-list-alerts"],
    queryFn: fetchAlerts,
    staleTime: 0,
    refetchInterval: WORD_LIST_ALERT_REFRESH_MS,
    refetchIntervalInBackground: true,
    refetchOnMount: "always",
    refetchOnReconnect: "always",
    refetchOnWindowFocus: "always",
  });

  const visibleAlerts = alerts.filter((alert) => !alert.is_read);
  const unreadCount = visibleAlerts.length;

  const markAlert = useMutation({
    mutationFn: ({ alertId, isRead }) =>
      api.patch(`/word-lists/alerts/${alertId}`, null, {
        params: { is_read: isRead },
      }),
    onMutate: async ({ alertId, isRead }) => {
      await queryClient.cancelQueries({ queryKey: ["word-list-alerts"] });
      const previousAlerts = queryClient.getQueryData(["word-list-alerts"]);
      queryClient.setQueryData(["word-list-alerts"], (current) =>
        updateAlertReadState(current, [alertId], isRead),
      );
      return { previousAlerts };
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(
        ["word-list-alerts"],
        context?.previousAlerts || [],
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["word-list-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["word-lists"] });
      queryClient.invalidateQueries({ queryKey: ["word-list"] });
    },
  });

  const clearAlerts = useMutation({
    mutationFn: (alertIds) =>
      Promise.all(
        alertIds.map((alertId) =>
          api.patch(`/word-lists/alerts/${alertId}`, null, {
            params: { is_read: true },
          }),
        ),
      ),
    onMutate: async (alertIds) => {
      await queryClient.cancelQueries({ queryKey: ["word-list-alerts"] });
      const previousAlerts = queryClient.getQueryData(["word-list-alerts"]);
      queryClient.setQueryData(["word-list-alerts"], (current) =>
        updateAlertReadState(current, alertIds, true),
      );
      return { previousAlerts };
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(
        ["word-list-alerts"],
        context?.previousAlerts || [],
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["word-list-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["word-lists"] });
      queryClient.invalidateQueries({ queryKey: ["word-list"] });
    },
  });

  return (
    <div className="dropdown header-notifications">
      <button
        className="btn header-notifications-toggle"
        type="button"
        data-bs-toggle="dropdown"
        aria-expanded="false"
        aria-label="Notifications"
      >
        <i className="bi bi-bell"></i>
        {unreadCount > 0 && (
          <span>{unreadCount > 99 ? "99+" : unreadCount}</span>
        )}
      </button>

      <div className="dropdown-menu dropdown-menu-end header-notifications-menu">
        <div className="header-notifications-head">
          <div>
            <strong>Notifications</strong>
            <small>
              {unreadCount} unread {unreadCount === 1 ? "alert" : "alerts"}
            </small>
          </div>
          {unreadCount > 0 && (
            <button
              className="header-notifications-clear"
              type="button"
              disabled={clearAlerts.isPending}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                clearAlerts.mutate(visibleAlerts.map((alert) => alert.id));
              }}
            >
              Clear
            </button>
          )}
        </div>

        <div className="header-notifications-list">
          {visibleAlerts.length ? (
            visibleAlerts.map((alert) => (
              <article className="header-notification-item" key={alert.id}>
                <div className="header-notification-body">
                  <div className="header-notification-meta">
                    <strong>{getAlertTitle(alert)}</strong>
                    <small>{formatDate(alert.created_at)}</small>
                  </div>
                  <p>{getAlertMessage(alert)}</p>
                  <div className="header-notification-footer">
                    {alert.news?.link ? (
                      <a
                        href={alert.news.link}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open source
                      </a>
                    ) : (
                      <span></span>
                    )}
                    <button
                      className="header-notification-action"
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        markAlert.mutate({ alertId: alert.id, isRead: true });
                      }}
                    >
                      Read
                    </button>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="header-notifications-empty">No alerts.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AppHeaderNotifications;
