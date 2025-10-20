import React, { useEffect, useMemo, useState } from "react";
import { api } from "../shared/api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [perf, setPerf] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [trendCol, setTrendCol] = useState("");
  const [trendPoints, setTrendPoints] = useState(40);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const [s, p] = await Promise.all([
          api("/summary"),
          api("/performance"),
        ]);
        if (!alive) return;
        setSummary(s || {});
        setPerf(p || []);
        const firstNum = s?.performance?.numeric_columns?.[0] || "";
        setTrendCol(firstNum);
      } catch (e) {
        console.error(e);
        setError("Failed to load dashboard data.");
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, []);

  const kpis = useMemo(() => {
    if (!summary) return [];
    return [
      { label: "Rows (Conditions)", value: summary.conditions?.rows ?? 0 },
      { label: "Rows (Factors)", value: summary.factors?.rows ?? 0 },
      { label: "Rows (Performance)", value: summary.performance?.rows ?? 0 },
      { label: "Rows (Treatment)", value: summary.treatment?.rows ?? 0 },
    ];
  }, [summary]);

  const trendData = useMemo(() => {
    if (!(trendCol && perf?.length)) return [];
    return perf.slice(0, trendPoints).map((r, i) => ({
      idx: i + 1,
      value: Number(r[trendCol]) || 0,
    }));
  }, [perf, trendCol, trendPoints]);

  const numericPerfCols = summary?.performance?.numeric_columns || [];

  if (loading) {
    return (
      <div className="space-y-8">
        <SkeletonKPIs />
        <div className="grid md:grid-cols-2 gap-6">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-2xl p-6 shadow-sm"
        style={{
          background: "var(--ss-white)",
          border: "1px solid var(--ss-border)",
        }}
      >
        <h2
          className="text-lg font-semibold mb-2"
          style={{ color: "var(--ss-heading)" }}
        >
          Something went wrong
        </h2>
        <p className="text-sm" style={{ color: "var(--ss-body)" }}>
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8" style={{ color: "var(--ss-body)" }}>
      {/* KPI Cards */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((k, i) => (
          <KpiCard key={i} label={k.label} value={k.value} />
        ))}
      </section>

      {/* Charts Row */}
      <section className="grid md:grid-cols-2 gap-6">
        {/* Performance Trend */}
        <div
          className="rounded-2xl p-4 shadow-sm"
          style={{
            background: "var(--ss-white)",
            border: "1px solid var(--ss-border)",
          }}
        >
          <div className="flex items-center justify-between">
            <h2
              className="text-lg font-semibold"
              style={{ color: "var(--ss-heading)" }}
            >
              Performance Trend
            </h2>
            <div className="flex items-center gap-2">
              <label className="text-sm" style={{ color: "var(--ss-body)" }}>
                Metric
              </label>
              <select
                className="rounded px-2 py-1 bg-white"
                style={{ border: "1px solid var(--ss-border)" }}
                value={trendCol}
                onChange={(e) => setTrendCol(e.target.value)}
              >
                <option value="">Select</option>
                {numericPerfCols.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <label className="text-sm" style={{ color: "var(--ss-body)" }}>
                Points
              </label>
              <select
                className="rounded px-2 py-1 bg-white"
                style={{ border: "1px solid var(--ss-border)" }}
                value={trendPoints}
                onChange={(e) => setTrendPoints(Number(e.target.value))}
              >
                {[20, 40, 80, 120].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="text-xs mb-2" style={{ color: "var(--ss-body)" }}>
            Showing first <strong>{trendPoints}</strong> rows of{" "}
            <strong>{trendCol || "N/A"}</strong>.
          </p>

          <div className="h-72">
            {trendCol && trendData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--ss-grid)"
                  />
                  <XAxis dataKey="idx" />
                  <YAxis />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="value"
                    dot={false}
                    stroke="var(--ss-orange)"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="Pick a numeric performance metric to see its trend." />
            )}
          </div>
        </div>

        {/* Top Groups */}
        <div
          className="rounded-2xl p-4 shadow-sm"
          style={{
            background: "var(--ss-white)",
            border: "1px solid var(--ss-border)",
          }}
        >
          <h2
            className="text-lg font-semibold mb-2"
            style={{ color: "var(--ss-heading)" }}
          >
            Top Groups (Factors)
          </h2>
          <TopGroups />
        </div>
      </section>
    </div>
  );
}

/* ---------- Components ---------- */

function KpiCard({ label, value }) {
  return (
    <div
      className="rounded-2xl p-4 shadow-sm hover:shadow transition"
      style={{
        background: "var(--ss-white)",
        border: "1px solid var(--ss-border)",
      }}
    >
      <div className="text-sm" style={{ color: "var(--ss-body)" }}>
        {label}
      </div>
      <div
        className="text-3xl font-bold mt-1"
        style={{ color: "var(--ss-heading)" }}
      >
        {formatNumber(value)}
      </div>
      <div className="mt-3 inline-flex items-center gap-2">
        <span
          className="px-2 py-1 rounded-full text-xs"
          style={{ background: "#FFE8CC", color: "var(--ss-heading)" }}
        >
          Updated
        </span>
        <span
          className="w-2 h-2 rounded-full"
          style={{ background: "var(--ss-orange)" }}
        />
      </div>
    </div>
  );
}

function SkeletonKPIs() {
  return (
    <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </section>
  );
}

function SkeletonCard() {
  return (
    <div
      className="rounded-2xl p-4 shadow-sm animate-pulse"
      style={{
        background: "var(--ss-white)",
        border: "1px solid var(--ss-border)",
      }}
    >
      <div
        className="h-3 w-24 rounded mb-3"
        style={{ background: "#F4EDE5" }}
      />
      <div className="h-6 w-32 rounded" style={{ background: "#F4EDE5" }} />
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="h-full w-full flex items-center justify-center">
      <div className="text-sm" style={{ color: "var(--ss-body)" }}>
        {message}
      </div>
    </div>
  );
}

function TopGroups() {
  const [rows, setRows] = useState([]);
  const [field, setField] = useState("");
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const frows = await api("/factors");
        if (!alive) return;
        setRows(frows || []);
        const keys = Object.keys(frows?.[0] || {});
        const guess =
          keys.find((k) =>
            frows.every((r) => r[k] === "" || isNaN(Number(r[k])))
          ) ||
          keys[0] ||
          "";
        setField(guess);
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    async function loadGroups() {
      if (!field) {
        setGroups([]);
        return;
      }
      const data = await api(
        `/group?ds=factors&by=${encodeURIComponent(field)}`
      );
      if (!alive) return;
      const sorted = [...data].sort((a, b) => b.count - a.count).slice(0, 12);
      setGroups(sorted);
    }
    loadGroups();
    return () => {
      alive = false;
    };
  }, [field]);

  const factorKeys = useMemo(() => Object.keys(rows?.[0] || {}), [rows]);

  if (loading) return <SkeletonCard />;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm" style={{ color: "var(--ss-body)" }}>
          Group by
        </label>
        <select
          className="rounded px-2 py-1 bg-white"
          style={{ border: "1px solid var(--ss-border)" }}
          value={field}
          onChange={(e) => setField(e.target.value)}
        >
          {factorKeys.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>

      <div className="h-72">
        {groups.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={groups}
              margin={{ top: 8, right: 8, left: 8, bottom: 24 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--ss-grid)" />
              <XAxis
                dataKey="key"
                tickFormatter={(t) => truncate(t, 12)}
                interval={0}
                angle={-20}
                textAnchor="end"
                height={60}
              />
              <YAxis />
              <Tooltip formatter={(v, n, p) => [v, p?.payload?.key]} />
              <Bar dataKey="count" fill="var(--ss-orange)" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState message="No groups to display for this field." />
        )}
      </div>
    </div>
  );
}

/* ---------- Utils ---------- */

function formatNumber(n) {
  if (n === null || n === undefined) return "—";
  const num = Number(n);
  if (isNaN(num)) return String(n);
  return num.toLocaleString();
}

function truncate(str, len = 12) {
  if (!str) return "";
  return String(str).length > len
    ? String(str).slice(0, len - 1) + "…"
    : String(str);
}
