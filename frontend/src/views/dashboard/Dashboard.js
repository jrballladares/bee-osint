import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Chart from "react-apexcharts";
import api from "../../lib/axios";

const formatNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number)
    ? new Intl.NumberFormat("en-US").format(number)
    : "0";
};

const formatDateTime = (value) => {
  if (!value) return "No news";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";

  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const getDeltaClass = (delta) => {
  const value = Number(delta) || 0;
  if (value > 0) return "is-up";
  if (value < 0) return "is-down";
  return "is-flat";
};

const sentimentLabels = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
};

const KpiCard = ({ icon, label, value }) => (
  <article className="dashboard-kpi-card">
    <div className="dashboard-kpi-card__icon">
      <i className={`bi ${icon}`}></i>
    </div>
    <div className="dashboard-kpi-card__body">
      <span>{label}</span>
      <strong>{formatNumber(value)}</strong>
    </div>
  </article>
);

const LocationAnalytics = ({ items = [], isLoading }) => (
  <section className="dashboard-insight-card dashboard-analytics-card">
    <div className="dashboard-insight-header">
      <i className="bi bi-geo-alt"></i>
      <h3>Places with most activity</h3>
    </div>

    {isLoading ? (
      <div className="dashboard-insight-loading">Loading places...</div>
    ) : items.length ? (
      <div className="dashboard-location-list">
        {items.map((item, index) => (
          <div className="dashboard-location-row" key={item.name}>
            <span className="dashboard-mention-rank">{index + 1}</span>
            <div className="dashboard-location-main">
              <strong title={item.name}>{item.name}</strong>
              <span>
                {formatNumber(item.count)} mentions · previous{" "}
                {formatNumber(item.previous_count)}
              </span>
            </div>
            <span className={`dashboard-delta ${getDeltaClass(item.delta)}`}>
              {Number(item.delta) > 0 ? "+" : ""}
              {formatNumber(item.delta)}
            </span>
          </div>
        ))}
      </div>
    ) : (
      <div className="dashboard-insight-empty">
        No places detected in this period.
      </div>
    )}
  </section>
);

const TermTrends = ({ items = [], isLoading }) => {
  const maxCount = items.reduce(
    (max, item) => Math.max(max, Number(item?.count) || 0),
    0,
  );

  return (
    <section className="dashboard-insight-card dashboard-analytics-card">
      <div className="dashboard-insight-header">
        <i className="bi bi-activity"></i>
        <h3>Trending terms</h3>
      </div>

      {isLoading ? (
        <div className="dashboard-insight-loading">Loading trends...</div>
      ) : items.length ? (
        <div className="dashboard-trend-list">
          {items.map((item) => {
            const count = Number(item?.count) || 0;
            const width =
              maxCount > 0
                ? Math.max(8, Math.round((count / maxCount) * 100))
                : 0;

            return (
              <div className="dashboard-trend-row" key={item.term}>
                <div className="dashboard-trend-topline">
                  <strong title={item.term}>{item.term}</strong>
                  <span
                    className={`dashboard-delta ${getDeltaClass(item.delta)}`}
                  >
                    {Number(item.delta) > 0 ? "+" : ""}
                    {formatNumber(item.delta)}
                  </span>
                </div>
                <div className="dashboard-trend-track">
                  <span style={{ width: `${width}%` }}></span>
                </div>
                <div className="dashboard-trend-meta">
                  <span>{formatNumber(count)} matches</span>
                  <span>
                    {item.growth_pct === null
                      ? "new in period"
                      : `${formatNumber(item.growth_pct)}% vs previous period`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="dashboard-insight-empty">
          No Word List matches in this period.
        </div>
      )}
    </section>
  );
};

const SourceActivity = ({ items = [], isLoading }) => (
  <section className="dashboard-insight-card dashboard-analytics-card dashboard-source-card">
    <div className="dashboard-insight-header">
      <i className="bi bi-broadcast"></i>
      <h3>Most active OSINT sources</h3>
    </div>

    {isLoading ? (
      <div className="dashboard-insight-loading">Loading sources...</div>
    ) : items.length ? (
      <div className="dashboard-source-list">
        {items.map((item) => (
          <div className="dashboard-source-row" key={item.source_id}>
            <div className="dashboard-source-main">
              <div className="dashboard-source-name">
                <strong title={item.source}>{item.source}</strong>
                <span className={item.is_active ? "is-active" : "is-inactive"}>
                  {item.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              <p title={item.last_news_title || ""}>
                {item.last_news_title || "No news recorded"}
              </p>
              <small>Latest: {formatDateTime(item.last_news_at)}</small>
            </div>
            <div className="dashboard-source-counts">
              <span>
                <strong>{formatNumber(item.count_24h)}</strong>
                24h
              </span>
              <span>
                <strong>{formatNumber(item.count_7d)}</strong>7d
              </span>
            </div>
          </div>
        ))}
      </div>
    ) : (
      <div className="dashboard-insight-empty">
        No OSINT sources registered.
      </div>
    )}
  </section>
);

const SentimentDonut = ({ data, isLoading }) => {
  const items = Array.isArray(data?.items) ? data.items : [];
  const sourceRows = Array.isArray(data?.by_source) ? data.by_source : [];
  const total = Number(data?.total) || 0;
  const days = Number(data?.days) || 30;
  const profile = data?.profile || "News OSINT";
  const series = items.map((item) => Number(item?.count) || 0);
  const labels = items.map(
    (item) => sentimentLabels[item?.key] || item?.label || "",
  );
  const hasData = total > 0 && series.some((value) => value > 0);

  const options = useMemo(
    () => ({
      chart: {
        type: "donut",
        toolbar: { show: false },
        parentHeightOffset: 0,
      },
      colors: ["#36bd7d", "#94a3b8", "#e04758"],
      labels,
      dataLabels: {
        enabled: false,
      },
      legend: {
        show: false,
      },
      stroke: {
        width: 3,
        colors: ["#fff"],
      },
      plotOptions: {
        pie: {
          donut: {
            size: "72%",
            labels: {
              show: true,
              name: {
                show: true,
                color: "#64748b",
                fontSize: "12px",
                fontWeight: 500,
              },
              value: {
                show: true,
                color: "#203958",
                fontSize: "22px",
                fontWeight: 600,
                formatter: (value) => formatNumber(value),
              },
              total: {
                show: true,
                label: "News",
                color: "#64748b",
                fontSize: "12px",
                formatter: () => formatNumber(total),
              },
            },
          },
        },
      },
      tooltip: {
        y: {
          formatter: (value) => `${formatNumber(value)} news`,
        },
      },
    }),
    [labels, total],
  );

  return (
    <section className="dashboard-insight-card dashboard-analytics-card dashboard-sentiment-card">
      <div className="dashboard-report-head">
        <div>
          <strong>Sentiment Breakdown</strong>
          <span>
            Date: {days} days · Profile: {profile} · General
          </span>
        </div>
        <div className="dashboard-report-tools">
          <i className="bi bi-pie-chart"></i>
        </div>
      </div>

      {isLoading ? (
        <div className="dashboard-insight-loading">Loading sentiment...</div>
      ) : hasData ? (
        <>
          <div className="dashboard-sentiment-layout">
            <div className="dashboard-sentiment-donut">
              <Chart
                options={options}
                series={series}
                type="donut"
                height={320}
              />
            </div>
            <div className="dashboard-sentiment-list">
              {items.map((item) => (
                <div
                  className={`dashboard-sentiment-row is-${item.key}`}
                  key={item.key}
                >
                  <span></span>
                  <strong>{sentimentLabels[item.key] || item.label}</strong>
                  <em>{formatNumber(item.share)}%</em>
                </div>
              ))}
            </div>
          </div>

          <div className="dashboard-sentiment-table-wrap">
            <div className="dashboard-sentiment-table-title">
              Topic Mention Details
            </div>
            <table className="dashboard-sentiment-table">
              <thead>
                <tr>
                  <th colSpan={3}>
                    <span className="dashboard-table-profile">
                      Profile: Todas las mentions WEB/TEXT
                    </span>
                  </th>
                  <th colSpan={2}>Web Text</th>
                </tr>
                <tr>
                  <th>Domain / Source</th>
                  <th>Total</th>
                  <th>Pos.</th>
                  <th>Neu.</th>
                  <th>Neg.</th>
                </tr>
              </thead>
              <tbody>
                {sourceRows.map((row) => (
                  <tr key={row.source}>
                    <td title={row.source}>{row.source}</td>
                    <td>{formatNumber(row.total)}</td>
                    <td>{formatNumber(row.positive)}</td>
                    <td>{formatNumber(row.neutral)}</td>
                    <td>{formatNumber(row.negative)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="dashboard-insight-empty">
          No recent news to analyze.
        </div>
      )}
    </section>
  );
};

const Dashboard = () => {
  const { data: kpis = {}, isLoading: isKpisLoading } = useQuery({
    queryKey: ["dashboard", "kpis"],
    queryFn: async () => {
      const response = await api.get("/dashboard/kpis");
      return response?.data ?? {};
    },
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: false,
  });

  const { data: locations = [], isLoading: isLocationsLoading } = useQuery({
    queryKey: ["dashboard", "locations"],
    queryFn: async () => {
      const response = await api.get("/dashboard/locations", {
        params: { days: 7, limit: 9 },
      });
      return Array.isArray(response?.data) ? response.data : [];
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  const { data: termTrends = [], isLoading: isTermTrendsLoading } = useQuery({
    queryKey: ["dashboard", "term-trends"],
    queryFn: async () => {
      const response = await api.get("/dashboard/term-trends", {
        params: { days: 7, limit: 5 },
      });
      return Array.isArray(response?.data) ? response.data : [];
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  const { data: sourceActivity = [], isLoading: isSourceActivityLoading } =
    useQuery({
      queryKey: ["dashboard", "source-activity"],
      queryFn: async () => {
        const response = await api.get("/dashboard/source-activity", {
          params: { limit: 5 },
        });
        return Array.isArray(response?.data) ? response.data : [];
      },
      staleTime: 1000 * 60 * 2,
      refetchOnWindowFocus: false,
    });

  const { data: sentiment, isLoading: isSentimentLoading } = useQuery({
    queryKey: ["dashboard", "sentiment"],
    queryFn: async () => {
      const response = await api.get("/dashboard/sentiment", {
        params: { days: 30 },
      });
      return response?.data ?? { total: 0, items: [] };
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  return (
    <section className="dashboard-page dashboard-page--full">
      <div className="dashboard-kpi-grid" aria-busy={isKpisLoading}>
        <KpiCard icon="bi-newspaper" label="News" value={kpis.news_total} />
        <KpiCard
          icon="bi-journal-text"
          label="Notes"
          value={kpis.notes_total}
        />
        <KpiCard
          icon="bi-folder2-open"
          label="Records"
          value={kpis.records_total}
        />
        <KpiCard
          icon="bi-globe2"
          label="Osint Source"
          value={kpis.osint_sources_total}
        />
        <KpiCard
          icon="bi-tags"
          label="Word List"
          value={kpis.word_lists_active}
        />
        <KpiCard icon="bi-diagram-3" label="Graphs" value={kpis.graphs_total} />
      </div>

      <div className="dashboard-page__sentiment-report">
        <SentimentDonut data={sentiment} isLoading={isSentimentLoading} />
      </div>

      <div className="dashboard-section">
        <div className="dashboard-section-header">
          <div>
            <span>Monitoreo OSINT</span>
            <small>
              Recent signals calculated from news, sources and Word Lists
            </small>
          </div>
        </div>

        <div className="dashboard-analytics-grid">
          <LocationAnalytics items={locations} isLoading={isLocationsLoading} />
          <TermTrends items={termTrends} isLoading={isTermTrendsLoading} />
          <SourceActivity
            items={sourceActivity}
            isLoading={isSourceActivityLoading}
          />
        </div>
      </div>
    </section>
  );
};

export default Dashboard;
