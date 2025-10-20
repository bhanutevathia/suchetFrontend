import React, { useEffect, useMemo, useState } from "react";
import { api } from "../shared/api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  Brush,
} from "recharts";

export default function Performance() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [x, setX] = useState("");
  const [ys, setYs] = useState([]);
  const [seriesQuery, setSeriesQuery] = useState("");

  const [smooth, setSmooth] = useState(0); // moving avg window: 0=off
  const [normalize, setNormalize] = useState("none"); // none | index | minmax
  const [cap, setCap] = useState(500); // 200 | 500 | 0 (=All)

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const data = await api("/performance");
        if (!alive) return;
        setRows(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
        setError("Failed to load performance data.");
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, []);

  const { numericCols, allCols, timeLikeCols } = useMemo(() => {
    if (!rows.length) return { numericCols: [], allCols: [], timeLikeCols: [] };
    const keys = Object.keys(rows[0]);
    const numeric = keys.filter((k) =>
      rows.every((r) => r[k] === "" || !isNaN(Number(r[k])))
    );
    const timeLike = keys.filter((k) => /date|time|year|month/i.test(k));
    return { numericCols: numeric, allCols: keys, timeLikeCols: timeLike };
  }, [rows]);

  // Choose sensible defaults once
  useEffect(() => {
    if (!rows.length) return;
    if (!x) {
      // prefer time-like, else first column
      setX(timeLikeCols[0] || allCols[0] || "");
    }
    if (ys.length === 0 && numericCols.length) {
      setYs(numericCols.slice(0, 3));
    }
    // eslint-disable-next-line
  }, [rows, numericCols, allCols, timeLikeCols]);

  // Build chart data with transformations
  const processed = useMemo(() => {
    if (!x || ys.length === 0) return [];
    const limited = cap > 0 ? rows.slice(0, cap) : rows.slice();
    // base numeric series per key
    const seriesData = {};
    for (const key of ys) {
      seriesData[key] = limited.map((r) => toNum(r[key]));
    }
    // smoothing
    if (smooth > 0) {
      for (const key of ys) {
        seriesData[key] = movingAvg(seriesData[key], smooth);
      }
    }
    // normalization
    if (normalize === "index") {
      for (const key of ys) {
        const arr = seriesData[key];
        const base = firstFinite(arr);
        if (isFiniteNum(base))
          seriesData[key] = arr.map((v) =>
            isFiniteNum(v) ? (v / base) * 100 : NaN
          );
      }
    } else if (normalize === "minmax") {
      for (const key of ys) {
        const arr = seriesData[key];
        const mn = finiteMin(arr);
        const mx = finiteMax(arr);
        const rng = mx - mn;
        seriesData[key] = arr.map((v) =>
          isFiniteNum(v) && rng > 0 ? (v - mn) / rng : NaN
        );
      }
    }

    // attach to recharts rows
    return limited.map((r, i) => {
      const row = { __i: i, [x]: parseX(r[x]) };
      for (const key of ys) row[key] = seriesData[key][i];
      return row;
    });
  }, [rows, x, ys, smooth, normalize, cap]);

  const exportCSV = () => {
    if (!processed.length) return;
    const headers = [x, ...ys];
    const lines = [headers.join(",")];
    for (const d of processed) {
      const row = [csvSafe(d[x]), ...ys.map((k) => csvSafe(d[k]))];
      lines.push(row.join(","));
    }
    downloadText(lines.join("\n"), "performance_series.csv");
  };

  const filteredChoices = useMemo(
    () =>
      numericCols.filter((c) =>
        c.toLowerCase().includes(seriesQuery.toLowerCase())
      ),
    [numericCols, seriesQuery]
  );

  if (loading) return <Skeleton />;
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
          className="text-xl font-semibold mb-2"
          style={{ color: "var(--ss-heading)" }}
        >
          Performance Trends
        </h2>
        <p className="text-sm" style={{ color: "var(--ss-body)" }}>
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4" style={{ color: "var(--ss-body)" }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2
          className="text-xl font-semibold"
          style={{ color: "var(--ss-heading)" }}
        >
          Performance Trends
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {/* X selector */}
          <Selector
            label="X"
            value={x}
            onChange={setX}
            options={[
              ...timeLikeCols,
              ...allCols.filter((k) => !timeLikeCols.includes(k)),
            ]}
          />

          {/* Series search + chips */}
          <div className="flex items-center gap-2">
            <input
              className="rounded px-2 py-1 text-sm w-44 bg-white"
              style={{ border: "1px solid var(--ss-border)" }}
              placeholder="Find a series..."
              value={seriesQuery}
              onChange={(e) => setSeriesQuery(e.target.value)}
            />
            <div className="flex flex-wrap gap-1 max-w-[40ch]">
              {ys.map((k) => (
                <button
                  key={k}
                  onClick={() => setYs((prev) => prev.filter((s) => s !== k))}
                  className="px-2 py-1 rounded-full text-xs text-white"
                  style={{ background: "var(--ss-orange)" }}
                  title="Remove series"
                >
                  {k} ✕
                </button>
              ))}
            </div>
          </div>

          {/* Quick add list */}
          <details className="relative">
            <summary
              className="px-3 py-2 rounded text-sm cursor-pointer list-none select-none bg-white"
              style={{ border: "1px solid var(--ss-border)" }}
            >
              Add series
            </summary>
            <div
              className="absolute right-0 mt-2 w-64 rounded-xl shadow-lg p-2 z-10 max-h-72 overflow-auto"
              style={{
                background: "var(--ss-white)",
                border: "1px solid var(--ss-border)",
              }}
            >
              {filteredChoices.map((k) => (
                <label
                  key={k}
                  className="flex items-center gap-2 px-2 py-1 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={ys.includes(k)}
                    onChange={() =>
                      setYs((prev) =>
                        prev.includes(k)
                          ? prev.filter((s) => s !== k)
                          : [...prev, k]
                      )
                    }
                  />
                  <span className="truncate">{k}</span>
                </label>
              ))}
            </div>
          </details>

          {/* Smoothing */}
          <Selector
            label="SMA"
            value={String(smooth)}
            onChange={(v) => setSmooth(Number(v))}
            options={["0", "3", "5", "7", "14"]}
          />

          {/* Normalization */}
          <Selector
            label="Scale"
            value={normalize}
            onChange={setNormalize}
            options={["none", "index", "minmax"]}
          />

          {/* Cap */}
          <Selector
            label="Points"
            value={String(cap)}
            onChange={(v) => setCap(Number(v))}
            options={["200", "500", "0"]}
          />

          {/* Export */}
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

      <div
        className="h-96 rounded-2xl p-2"
        style={{
          background: "var(--ss-white)",
          border: "1px solid var(--ss-border)",
        }}
      >
        {x && ys.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={processed}
              margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
            >
              {/* chart visuals untouched */}
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={x} tickFormatter={(t) => tickFmt(t)} />
              <YAxis />
              <Tooltip
                formatter={(v, name) => [v, name]}
                labelFormatter={(l) => `${x}: ${tickFmt(l)}`}
              />
              <Legend />
              {ys.map((k, i) => (
                <Line
                  key={k}
                  type="monotone"
                  dataKey={k}
                  dot={false}
                  stroke={palette[i % palette.length]}
                />
              ))}
              <Brush dataKey={x} travellerWidth={10} height={24} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div
            className="h-full w-full flex items-center justify-center text-sm"
            style={{ color: "var(--ss-body)", opacity: 0.7 }}
          >
            Choose an X column and at least one numeric series.
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- UI bits ---------- */

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
            {prettyOpt(o)}
          </option>
        ))}
      </select>
    </label>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="h-6 w-56 rounded" style={{ background: "#F4EDE5" }} />
      <div className="h-8 w-full rounded" style={{ background: "#F4EDE5" }} />
      <div className="h-96 w-full rounded" style={{ background: "#F4EDE5" }} />
    </div>
  );
}

/* ---------- utils ---------- */

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

function toNum(v) {
  const n = Number(v);
  return isNaN(n) ? NaN : n;
}
function isFiniteNum(n) {
  return typeof n === "number" && isFinite(n);
}
function finiteMin(arr) {
  return arr.reduce((m, v) => (isFiniteNum(v) && v < m ? v : m), Infinity);
}
function finiteMax(arr) {
  return arr.reduce((m, v) => (isFiniteNum(v) && v > m ? v : m), -Infinity);
}
function firstFinite(arr) {
  for (const v of arr) if (isFiniteNum(v)) return v;
  return NaN;
}

function movingAvg(arr, win) {
  const out = new Array(arr.length).fill(NaN);
  if (win <= 1) return arr.slice();
  let sum = 0,
    q = [];
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    q.push(isFiniteNum(v) ? v : NaN);
    if (q.length > win) {
      const drop = q.shift();
      if (isFiniteNum(drop)) sum -= drop;
    }
    if (isFiniteNum(v)) sum += v;
    const valid = q.filter(isFiniteNum);
    out[i] =
      valid.length === win ? valid.reduce((a, b) => a + b, 0) / win : NaN;
  }
  return out;
}

function parseX(v) {
  // try to parse date, else keep as-is/number
  const s = String(v);
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10); // yyyy-mm-dd
  const n = Number(v);
  return isNaN(n) ? s : n;
}

function tickFmt(t) {
  // show ISO date nicely if looks like yyyy-mm-dd
  if (typeof t === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t)) {
    return t;
  }
  return String(t);
}

function csvSafe(s) {
  const v = s === null || s === undefined ? "" : String(s);
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

function prettyOpt(v) {
  return v || "—";
}
