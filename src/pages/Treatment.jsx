import React, { useEffect, useMemo, useState } from "react";
import { api } from "../shared/api";
import {
  PieChart,
  Pie,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

export default function Treatment() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [cat, setCat] = useState("");
  const [metric, setMetric] = useState("count");
  const [groupBy, setGroupBy] = useState("");
  const [topN, setTopN] = useState(8);
  const [sortBy, setSortBy] = useState("value");

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const data = await api("/treatment");
        if (!alive) return;
        setRows(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
        setError("Failed to load treatment data.");
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, []);

  const { numericCols, catCols } = useMemo(() => {
    if (!rows.length) return { numericCols: [], catCols: [] };
    const keys = Object.keys(rows[0] || {});
    const numeric = keys.filter((k) =>
      rows.every((r) => r[k] === "" || !isNaN(Number(r[k])))
    );
    const categorical = keys.filter((k) => !numeric.includes(k));
    return { numericCols: numeric, catCols: categorical };
  }, [rows]);

  useEffect(() => {
    if (!rows.length) return;
    if (!cat) setCat(catCols[0] || "");
    if (metric !== "count" && !numericCols.includes(metric)) setMetric("count");
  }, [rows, catCols, numericCols]);

  const baseAgg = useMemo(() => {
    if (!cat) return [];
    const m = new Map();
    for (const r of rows) {
      const key = safeCat(r[cat]);
      const addVal = metric === "count" ? 1 : toNum(r[metric]);
      const curr = m.get(key) || 0;
      m.set(key, curr + (isFiniteNum(addVal) ? addVal : 0));
    }
    let entries = Array.from(m.entries()).map(([name, value]) => ({
      name,
      value,
    }));
    entries = entries.sort(
      sortBy === "name"
        ? (a, b) => String(a.name).localeCompare(String(b.name))
        : (a, b) => b.value - a.value
    );

    if (topN > 0 && entries.length > topN) {
      const head = entries.slice(0, topN);
      const tail = entries.slice(topN);
      const otherSum = tail.reduce((a, b) => a + b.value, 0);
      entries = [...head, { name: "Other", value: otherSum }];
    }
    return entries;
  }, [rows, cat, metric, sortBy, topN]);

  const groupedAgg = useMemo(() => {
    if (!cat || !groupBy) return [];
    const m = new Map();
    const groupsSet = new Set();
    for (const r of rows) {
      const key = safeCat(r[cat]);
      const grp = safeCat(r[groupBy]);
      groupsSet.add(grp);
      const addVal = metric === "count" ? 1 : toNum(r[metric]);
      const rowMap = m.get(key) || new Map();
      const curr = rowMap.get(grp) || 0;
      rowMap.set(grp, curr + (isFiniteNum(addVal) ? addVal : 0));
      m.set(key, rowMap);
    }
    let cats = Array.from(m.entries())
      .map(([k, mm]) => ({
        name: k,
        total: Array.from(mm.values()).reduce((a, b) => a + b, 0),
        parts: mm,
      }))
      .sort((a, b) => b.total - a.total);
    if (topN > 0 && cats.length > topN) {
      const head = cats.slice(0, topN);
      const tail = cats.slice(topN);
      const otherMap = new Map();
      for (const t of tail)
        for (const [g, val] of t.parts)
          otherMap.set(g, (otherMap.get(g) || 0) + val);
      cats = [
        ...head,
        {
          name: "Other",
          total: Array.from(otherMap.values()).reduce((a, b) => a + b, 0),
          parts: otherMap,
        },
      ];
    }
    const groups = Array.from(groupsSet.values()).sort();
    const rowsOut = cats.map((c) => {
      const row = { [cat]: c.name };
      for (const g of groups) row[g] = c.parts.get(g) || 0;
      return row;
    });
    return { data: rowsOut, groups };
  }, [rows, cat, groupBy, metric, topN]);

  const totalValue = useMemo(
    () => baseAgg.reduce((a, b) => a + b.value, 0),
    [baseAgg]
  );

  const exportCSV = () => {
    if (!cat) return;
    let csv = "";
    if (!groupBy) {
      csv += ["Category", metric.toUpperCase()].join(",") + "\n";
      for (const r of baseAgg)
        csv += [csvSafe(r.name), csvSafe(r.value)].join(",") + "\n";
    } else {
      const hdr = [cat, ...(groupedAgg.groups || [])];
      csv += hdr.join(",") + "\n";
      for (const r of groupedAgg.data || []) {
        const line = [
          csvSafe(r[cat]),
          ...groupedAgg.groups.map((g) => csvSafe(r[g])),
        ];
        csv += line.join(",") + "\n";
      }
    }
    downloadText(csv, "treatment_aggregation.csv");
  };

  if (loading) return <Skeleton />;
  if (error)
    return (
      <div
        className="rounded-2xl p-6 shadow-sm"
        style={{
          background: "var(--ss-white)",
          border: "1px solid var(--ss-border)",
        }}
      >
        <h2
          className="text-xl font-semibold mb-2"
          style={{ color: "var(--ss-heading)" }}
        >
          Treatment Overview
        </h2>
        <p className="text-sm" style={{ color: "var(--ss-body)" }}>
          {error}
        </p>
      </div>
    );

  return (
    <div className="space-y-4" style={{ color: "var(--ss-body)" }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2
          className="text-xl font-semibold"
          style={{ color: "var(--ss-heading)" }}
        >
          Treatment Overview
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Selector
            label="Category"
            value={cat}
            onChange={setCat}
            options={catCols}
          />
          <Selector
            label="Metric"
            value={metric}
            onChange={setMetric}
            options={["count", ...numericCols]}
          />
          <Selector
            label="Group by"
            value={groupBy}
            onChange={setGroupBy}
            options={["", ...catCols.filter((c) => c !== cat)]}
          />
          <Selector
            label="Top N"
            value={String(topN)}
            onChange={(v) => setTopN(Number(v))}
            options={["5", "8", "12", "0"]}
          />
          <Selector
            label="Sort"
            value={sortBy}
            onChange={setSortBy}
            options={["value", "name"]}
          />
          <button
            onClick={exportCSV}
            className="px-3 py-2 rounded text-sm text-white"
            style={{ background: "var(--ss-orange)" }}
            onMouseOver={(e) => (e.currentTarget.style.background = "#FF8A00")}
            onMouseOut={(e) =>
              (e.currentTarget.style.background = "var(--ss-orange)")
            }
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Main Visualization */}
      {!groupBy ? (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Fixed Donut */}
          <div
            className="rounded-2xl p-4"
            style={{
              background: "var(--ss-white)",
              border: "1px solid var(--ss-border)",
            }}
          >
            <div className="h-[400px] flex items-center justify-center">
              {baseAgg.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart
                    margin={{ top: 10, right: 20, bottom: 10, left: 20 }}
                  >
                    <Pie
                      data={baseAgg}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="48%"
                      innerRadius="55%"
                      outerRadius="80%"
                      startAngle={90}
                      endAngle={-270}
                      paddingAngle={3}
                      labelLine={false}
                      label={({ name, value }) =>
                        `${truncate(name, 20)} • ${pct(value, totalValue)}`
                      }
                    >
                      {baseAgg.map((_, i) => (
                        <Cell key={i} fill={palette[i % palette.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v, n]} />
                    <Legend
                      verticalAlign="bottom"
                      align="center"
                      wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Empty message="No categories found." />
              )}
            </div>
            <div
              className="px-3 pb-3 text-sm"
              style={{ color: "var(--ss-body)" }}
            >
              {metric === "count"
                ? "Showing category counts."
                : `Summing by: ${metric}`}
            </div>
          </div>

          {/* Summary Table */}
          <div
            className="rounded-2xl p-4"
            style={{
              background: "var(--ss-white)",
              border: "1px solid var(--ss-border)",
            }}
          >
            <h3
              className="font-medium mb-2"
              style={{ color: "var(--ss-heading)" }}
            >
              Breakdown
            </h3>
            <div className="max-h-96 overflow-auto">
              <table className="min-w-full text-sm">
                <thead style={{ background: "var(--ss-cream-1)" }}>
                  <tr>
                    <th
                      className="text-left px-3 py-2 border-b"
                      style={{ borderColor: "var(--ss-border)" }}
                    >
                      Category
                    </th>
                    <th
                      className="text-right px-3 py-2 border-b"
                      style={{ borderColor: "var(--ss-border)" }}
                    >
                      Value
                    </th>
                    <th
                      className="text-right px-3 py-2 border-b"
                      style={{ borderColor: "var(--ss-border)" }}
                    >
                      %
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {baseAgg.map((r, i) => (
                    <tr key={r.name}>
                      <td
                        className="px-3 py-2 border-b"
                        style={{ borderColor: "var(--ss-border)" }}
                      >
                        <span
                          className="inline-block w-2 h-2 rounded-full mr-2"
                          style={{ background: palette[i % palette.length] }}
                        />
                        {truncate(r.name, 32)}
                      </td>
                      <td
                        className="px-3 py-2 border-b text-right"
                        style={{ borderColor: "var(--ss-border)" }}
                      >
                        {formatNum(r.value)}
                      </td>
                      <td
                        className="px-3 py-2 border-b text-right"
                        style={{ borderColor: "var(--ss-border)" }}
                      >
                        {pct(r.value, totalValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="text-xs mt-2" style={{ color: "var(--ss-body)" }}>
              Total: {formatNum(totalValue)}
            </div>
          </div>
        </div>
      ) : (
        <div
          className="rounded-2xl p-2"
          style={{
            background: "var(--ss-white)",
            border: "1px solid var(--ss-border)",
          }}
        >
          <div className="h-96">
            {(groupedAgg.data?.length ?? 0) > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={groupedAgg.data}
                  margin={{ top: 8, right: 16, bottom: 24, left: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--ss-grid)"
                  />
                  <XAxis
                    dataKey={cat}
                    tickFormatter={(t) => truncate(t, 12)}
                    angle={-15}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {groupedAgg.groups.map((g, i) => (
                    <Bar
                      key={g}
                      dataKey={g}
                      stackId="s"
                      fill={palette[i % palette.length]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Empty message="No grouped data to display." />
            )}
          </div>
          <div
            className="px-3 pb-3 text-sm"
            style={{ color: "var(--ss-body)" }}
          >
            Stacked by{" "}
            <strong style={{ color: "var(--ss-heading)" }}>{groupBy}</strong>.{" "}
            {metric === "count" ? "Using counts." : `Summing: ${metric}`}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- UI Bits ---------- */
function Selector({ label, value, onChange, options }) {
  return (
    <label className="text-sm flex items-center gap-2">
      <span style={{ color: "var(--ss-body)" }}>{label}</span>
      <select
        className="rounded px-2 py-1 bg-white"
        style={{ border: "1px solid var(--ss-border)" }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o || "—"}
          </option>
        ))}
      </select>
    </label>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="h-6 w-64 rounded" style={{ background: "#F4EDE5" }} />
      <div className="h-8 w-full rounded" style={{ background: "#F4EDE5" }} />
      <div className="h-96 w-full rounded" style={{ background: "#F4EDE5" }} />
    </div>
  );
}

function Empty({ message }) {
  return (
    <div
      className="h-full w-full flex items-center justify-center text-sm"
      style={{ color: "var(--ss-body)", opacity: 0.7 }}
    >
      {message}
    </div>
  );
}

/* ---------- Utils ---------- */
const palette = [
  "#0ea5e9",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#14b8a6",
  "#f97316",
  "#64748b",
  "#06b6d4",
  "#84cc16",
];

function pct(value, total) {
  if (!isFinite(total) || total === 0) return "0%";
  const ratio = (Number(value) / total) * 100;
  return `${ratio.toFixed(1)}%`;
}
function toNum(v) {
  const n = Number(v);
  return isNaN(n) ? NaN : n;
}
function isFiniteNum(n) {
  return typeof n === "number" && isFinite(n);
}
function formatNum(n) {
  const num = Number(n);
  return isNaN(num) ? String(n) : num.toLocaleString();
}
function truncate(s, len = 14) {
  const t = String(s || "");
  return t.length > len ? t.slice(0, len - 1) + "…" : t;
}
function csvSafe(s) {
  const v = s == null ? "" : String(s);
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
function downloadText(text, filename) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
function safeCat(v) {
  return v == null || v === "" ? "Unknown" : String(v);
}
