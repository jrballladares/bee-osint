import React, { useMemo } from "react";
import Chart from "react-apexcharts";

const normalizeData = (arr, length = 0) => {
  const safe = Array.isArray(arr) ? arr : [];

  return Array.from({ length }, (_, i) => {
    const n = Number(safe[i]);
    return Number.isFinite(n) ? n : 0;
  });
};

const barColor = "#36bd7d";

const getNiceAxisMax = (value) => {
  if (!Number.isFinite(value) || value <= 0) return 10;

  const paddedValue = value * 1.12;
  const magnitude = 10 ** Math.floor(Math.log10(paddedValue));
  const normalized = paddedValue / magnitude;
  const step =
    normalized <= 2 ? 2 : normalized <= 3 ? 3 : normalized <= 5 ? 5 : 10;

  return step * magnitude;
};

const MainChart = ({ seriesData = [], categories = [], height = 380 }) => {
  const safeCategories = useMemo(() => {
    return Array.isArray(categories) ? categories.map(String) : [];
  }, [categories]);

  const sources = useMemo(() => {
    if (!Array.isArray(seriesData)) return [];

    return seriesData.map((item) => ({
      name: item?.name ? String(item.name) : "Source",
      data: normalizeData(item?.data, safeCategories.length),
    }));
  }, [safeCategories.length, seriesData]);

  const monthlyTotals = useMemo(() => {
    return safeCategories.map((_, index) =>
      sources.reduce((sum, serie) => sum + (Number(serie.data[index]) || 0), 0),
    );
  }, [safeCategories, sources]);

  const total = useMemo(() => {
    return monthlyTotals.reduce((sum, value) => sum + value, 0);
  }, [monthlyTotals]);

  const peakMonth = useMemo(() => {
    if (!monthlyTotals.length) return { label: "-", total: 0 };

    const peakIndex = monthlyTotals.reduce(
      (bestIndex, value, index) =>
        value > monthlyTotals[bestIndex] ? index : bestIndex,
      0,
    );

    return {
      label: safeCategories[peakIndex] || "-",
      total: monthlyTotals[peakIndex] || 0,
    };
  }, [monthlyTotals, safeCategories]);

  const dominantSource = useMemo(() => {
    const rankedSources = sources
      .map((serie) => ({
        name: serie.name,
        total: serie.data.reduce((sum, value) => sum + (Number(value) || 0), 0),
      }))
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total);

    return rankedSources[0] || { name: "-", total: 0 };
  }, [sources]);

  const labeledDateIndexes = useMemo(() => {
    return new Set(
      monthlyTotals
        .map((total, index) => ({ index, total }))
        .filter(({ index, total }) => {
          const isEdge = index === 0 || index === monthlyTotals.length - 1;
          const hasVolume = total > 0;

          return isEdge || hasVolume;
        })
        .map(({ index }) => index),
    );
  }, [monthlyTotals]);

  const yAxisMax = useMemo(() => {
    return getNiceAxisMax(Math.max(0, ...monthlyTotals));
  }, [monthlyTotals]);

  const options = useMemo(
    () => ({
      chart: {
        type: "bar",
        height,
        background: "transparent",
        foreColor: "#64748b",
        parentHeightOffset: 0,
        toolbar: {
          show: false,
        },
        zoom: {
          enabled: false,
        },
        animations: {
          enabled: true,
          easing: "easeinout",
          speed: 450,
        },
      },

      colors: [barColor],

      stroke: {
        width: 0,
      },

      plotOptions: {
        bar: {
          columnWidth: safeCategories.length <= 3 ? "28%" : "42%",
          borderRadius: 2,
          borderRadiusApplication: "end",
        },
      },

      fill: {
        opacity: 0.9,
      },

      dataLabels: {
        enabled: false,
      },

      xaxis: {
        categories: safeCategories,
        tooltip: {
          enabled: false,
        },
        labels: {
          rotate: 0,
          hideOverlappingLabels: true,
          formatter: (value) => {
            const labelIndex = safeCategories.indexOf(String(value));

            return labeledDateIndexes.has(labelIndex) ? value : "";
          },
          style: {
            colors: "#94a3b8",
            fontSize: "12px",
            fontWeight: 500,
          },
        },
        axisBorder: {
          show: false,
        },
        axisTicks: {
          show: false,
        },
        crosshairs: {
          show: false,
        },
      },

      yaxis: {
        min: 0,
        max: yAxisMax,
        tickAmount: 5,
        labels: {
          formatter: (val) => Number(val).toLocaleString(),
          style: {
            colors: "#94a3b8",
            fontSize: "12px",
            fontWeight: 500,
          },
        },
      },

      grid: {
        borderColor: "#edf2f7",
        strokeDashArray: 3,
        padding: {
          top: 0,
          right: 14,
          bottom: 0,
          left: 6,
        },
        xaxis: {
          lines: {
            show: false,
          },
        },
        yaxis: {
          lines: {
            show: true,
          },
        },
      },

      tooltip: {
        theme: "light",
        shared: false,
        intersect: false,
        y: {
          formatter: (val) => `${Number(val).toLocaleString()} news`,
        },
      },

      legend: {
        show: false,
      },
    }),
    [height, labeledDateIndexes, safeCategories, yAxisMax],
  );

  return (
    <div className="main-chart-panel">
      <div className="main-chart-header">
        <div className="main-chart-heading">
          <p className="main-chart-eyebrow">Actividad</p>
          <h2 className="main-chart-title">News volume</h2>
          <p className="main-chart-subtitle">
            Monthly news total. Grouping by month makes it easier to compare
            activity without daily noise.
          </p>
        </div>

        <div className="main-chart-header-right">
          <div className="main-chart-stats">
            <div className="main-chart-stat">
              <span>Total</span>
              <strong>{total.toLocaleString()}</strong>
              <small>news</small>
            </div>
            <div className="main-chart-stat">
              <span>Mes pico</span>
              <strong>{peakMonth.total.toLocaleString()}</strong>
              <small>{peakMonth.label}</small>
            </div>
            <div className="main-chart-stat">
              <span>Dominant source</span>
              <strong>{dominantSource.name}</strong>
              <small>{dominantSource.total.toLocaleString()} news</small>
            </div>
          </div>
        </div>
      </div>

      <div className="main-chart-body">
        <Chart
          options={options}
          series={[{ name: "News", data: monthlyTotals }]}
          type="bar"
          height={height}
        />
      </div>
    </div>
  );
};

export default MainChart;
