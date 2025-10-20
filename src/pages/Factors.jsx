import React, { useEffect, useMemo, useState } from "react";
import { api } from "../shared/api";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ZAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";

export default function Factors() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [x, setX] = useState("");
  const [y, setY] = useState("");
  const [z, setZ] = useState("");
  const [colorBy, setColorBy] = useState("");

  const [sizeMin, setSizeMin] = useState(60);
  const [sizeMax, setSizeMax] = useState(400);
  const [pointOpacity, setPointOpacity] = useState(0.85);

  // numeric range filters
  const [xMin, setXMin] = useState("");
  const [xMax, setXMax] = useState("");
  const [yMin, setYMin] = useState("");
  const [yMax, setYMax] = useState("");

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const data = await api("/factors");
        if (!alive) return;
        setRows(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
        setError("Failed to load factors.");
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, []);

  // column detection
  const { numericCols, catCols } = useMemo(() => {
    if (!rows.length) return { numericCols: [], catCols: [] };
    const keys = Object.keys(rows[0]);
    const numeric = keys.filter((k) =>
      rows.every((r) => r[k] === "" || !isNaN(Number(r[k])))
    );
    const categorical = keys.filter((k) => !numeric.includes(k));
    return { numericCols: numeric, catCols: categorical };
  }, [rows]);

  // choose friendly defaults once rows load
  useEffect(() => {
    if (!rows.length) return;
    if (!x && numericCols[0]) setX(numericCols[0]);
    if (!y && numericCols[1]) setY(numericCols[1] || numericCols[0]);
    if (!colorBy && catCols[0]) setColorBy(catCols[0]);
    // eslint-disable-next-line
  }, [rows, numericCols, catCols]);

  // base numeric pairs
  const basePoints = useMemo(() => {
    if (!(x && y)) return [];
    return rows
      .map((r) => ({
        x: toNum(r[x]),
        y: toNum(r[y]),
        z: z ? toNum(r[z]) || 1 : 1,
        c: colorBy ? safeStr(r[colorBy]) : "All",
        raw: r,
      }))
      .filter((p) => isFiniteNum(p.x) && isFiniteNum(p.y));
  }, [rows, x, y, z, colorBy]);

  // compute domain and apply range filters
  const domains = useMemo(() => {
    const xs = basePoints.map((p) => p.x);
    const ys = basePoints.map((p) => p.y);
    return {
      xMin: finiteMin(xs),
      xMax: finiteMax(xs),
      yMin: finiteMin(ys),
      yMax: finiteMax(ys),
    };
  }, [basePoints]);

  useEffect(() => {
    // initialize inputs when columns change
    if (domains.xMin !== Infinity && domains.xMax !== -Infinity) {
      setXMin(String(domains.xMin));
      setXMax(String(domains.xMax));
    }
    if (domains.yMin !== Infinity && domains.yMax !== -Infinity) {
      setYMin(String(domains.yMin));
      setYMax(String(domains.yMax));
    }
    // eslint-disable-next-line
  }, [x, y]);

  const filtered = useMemo(() => {
    const xmin = Number(xMin);
    const xmax = Number(xMax);
    const ymin = Number(yMin);
    const ymax = Number(yMax);
    return basePoints.filter(
      (p) =>
        (isNaN(xmin) || p.x >= xmin) &&
        (isNaN(xmax) || p.x <= xmax) &&
        (isNaN(ymin) || p.y >= ymin) &&
        (isNaN(ymax) || p.y <= ymax)
    );
  }, [basePoints, xMin, xMax, yMin, yMax]);

  // group by category (limit palette to top 8, bucket the rest)
  const groups = useMemo(() => {
    const counts = {};
    for (const p of filtered) counts[p.c] = (counts[p.c] || 0) + 1;
    const top = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([k]) => k);
    const buckets = {};
    for (const p of filtered) {
      const key = colorBy ? (top.includes(p.c) ? p.c : "Other") : "All";
      (buckets[key] ||= []).push(p);
    }
    return Object.entries(buckets).map(([name, pts]) => ({ name, pts }));
  }, [filtered, colorBy]);

  // stats (correlation + regression)
  const { r, slope, intercept } = useMemo(
    () => linearStats(filtered.map((p) => [p.x, p.y])),
    [filtered]
  );
  const trendline = useMemo(() => {
    if (!isFiniteNum(slope) || !isFiniteNum(intercept)) return [];
    const xmin = Number(xMin);
    const xmax = Number(xMax);
    if (isNaN(xmin) || isNaN(xmax)) return [];
    return [
      { x: xmin, y: slope * xmin + intercept },
      { x: xmax, y: slope * xmax + intercept },
    ];
  }, [slope, intercept, xMin, xMax]);

  const exportCSV = () => {
    const headers = [x, y, ...(z ? [z] : []), ...(colorBy ? [colorBy] : [])];
    const lines = [headers.join(",")];
    for (const p of filtered) {
      const row = [p.raw[x], p.raw[y]];
      if (z) row.push(p.raw[z]);
      if (colorBy) row.push(p.raw[colorBy]);
      lines.push(row.map(csvSafe).join(","));
    }
    downloadText(lines.join("\n"), "factors_points.csv");
  };

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
          Factors Explorer
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
          Factors Explorer
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Selector label="X" value={x} onChange={setX} options={numericCols} />
          <Selector label="Y" value={y} onChange={setY} options={numericCols} />
          <Selector
            label="Size"
            value={z}
            onChange={setZ}
            options={["", ...numericCols]}
          />
          <Selector
            label="Color"
            value={colorBy}
            onChange={setColorBy}
            options={["", ...catCols]}
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

      {/* Numeric range filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <RangeInput
          label={`${x || "X"} min`}
          value={xMin}
          onChange={setXMin}
          placeholder={String(domains.xMin ?? "")}
        />
        <RangeInput
          label={`${x || "X"} max`}
          value={xMax}
          onChange={setXMax}
          placeholder={String(domains.xMax ?? "")}
        />
        <RangeInput
          label={`${y || "Y"} min`}
          value={yMin}
          onChange={setYMin}
          placeholder={String(domains.yMin ?? "")}
        />
        <RangeInput
          label={`${y || "Y"} max`}
          value={yMax}
          onChange={setYMax}
          placeholder={String(domains.yMax ?? "")}
        />
        <Slider
          label="Opacity"
          value={pointOpacity}
          onChange={setPointOpacity}
          min={0.2}
          max={1}
          step={0.05}
          format={(v) => v.toFixed(2)}
        />
        <Slider
          label="Bubble min"
          value={sizeMin}
          onChange={setSizeMin}
          min={20}
          max={200}
          step={5}
        />
        <Slider
          label="Bubble max"
          value={sizeMax}
          onChange={setSizeMax}
          min={200}
          max={600}
          step={10}
        />
      </div>

      {/* Stats badges */}
      <div className="flex flex-wrap gap-3 text-sm">
        <Badge label="Points" value={filtered.length} />
        <Badge
          label="r (Pearson)"
          value={isFiniteNum(r) ? r.toFixed(3) : "—"}
        />
        <Badge
          label="Slope"
          value={isFiniteNum(slope) ? slope.toFixed(3) : "—"}
        />
        <Badge
          label="Intercept"
          value={isFiniteNum(intercept) ? intercept.toFixed(3) : "—"}
        />
      </div>

      <div
        className="h-96 rounded-2xl p-2"
        style={{
          background: "var(--ss-white)",
          border: "1px solid var(--ss-border)",
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 12, right: 20, bottom: 12, left: 20 }}>
            <CartesianGrid stroke="var(--ss-grid)" strokeDasharray="3 3" />
            <XAxis
              dataKey="x"
              name={x}
              type="number"
              tickMargin={8}
              domain={[
                isNaN(Number(xMin)) ? "auto" : Number(xMin),
                isNaN(Number(xMax)) ? "auto" : Number(xMax),
              ]}
            />
            <YAxis
              dataKey="y"
              name={y}
              type="number"
              tickMargin={8}
              domain={[
                isNaN(Number(yMin)) ? "auto" : Number(yMin),
                isNaN(Number(yMax)) ? "auto" : Number(yMax),
              ]}
            />
            <ZAxis dataKey="z" range={[sizeMin, sizeMax]} name={z || "Size"} />
            <Tooltip
              formatter={(value, name) => [value, name]}
              labelFormatter={() => `${x} vs ${y}`}
            />
            <Legend
              verticalAlign="bottom"
              align="center"
              wrapperStyle={{ paddingTop: 6 }}
              formatter={(v) => truncate(v, 16)}
            />
            {groups.map((g, i) => (
              <Scatter
                key={g.name}
                name={g.name}
                data={g.pts}
                fill={brandPalette[i % brandPalette.length]}
                fillOpacity={pointOpacity}
                stroke="rgba(255,255,255,0.7)"
                strokeWidth={0.6}
                style={{ mixBlendMode: "multiply" }}
              />
            ))}
            {trendline.length === 2 && (
              <ReferenceLine
                segment={trendline}
                stroke="var(--ss-heading)"
                strokeDasharray="6 6"
              />
            )}
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {!x || !y ? (
        <div
          className="text-sm"
          style={{ color: "var(--ss-body)", opacity: 0.7 }}
        >
          Pick X and Y numeric columns to render the scatter plot.
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="text-sm"
          style={{ color: "var(--ss-body)", opacity: 0.7 }}
        >
          No points within your current filters.
        </div>
      ) : null}
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
        <option value="">Select</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o || "—"}
          </option>
        ))}
      </select>
    </label>
  );
}

function RangeInput({ label, value, onChange, placeholder }) {
  return (
    <label className="text-sm flex flex-col">
      <span className="mb-1" style={{ color: "var(--ss-body)" }}>
        {label}
      </span>
      <input
        className="rounded px-2 py-1 w-40 bg-white"
        style={{ border: "1px solid var(--ss-border)" }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode="decimal"
      />
    </label>
  );
}

function Slider({ label, value, onChange, min, max, step, format }) {
  return (
    <label className="text-sm flex items-center gap-2">
      <span style={{ color: "var(--ss-body)" }}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="tabular-nums" style={{ color: "var(--ss-heading)" }}>
        {format ? format(value) : Math.round(value)}
      </span>
    </label>
  );
}

function Badge({ label, value }) {
  return (
    <div
      className="rounded-full px-3 py-1 shadow-sm"
      style={{
        background: "var(--ss-white)",
        border: "1px solid var(--ss-border)",
      }}
    >
      <span style={{ color: "var(--ss-body)" }}>{label}:</span>{" "}
      <span className="font-medium" style={{ color: "var(--ss-heading)" }}>
        {value}
      </span>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="h-6 w-48 rounded" style={{ background: "#F4EDE5" }} />
      <div className="h-8 w-full rounded" style={{ background: "#F4EDE5" }} />
      <div className="h-96 w-full rounded" style={{ background: "#F4EDE5" }} />
    </div>
  );
}

/* ---------- utils ---------- */

// Brand-first, readable category palette.
// (Orange first to match site, then complementary hues)
const brandPalette = [
  "#FF9F29", // brand orange
  "#0ea5e9",
  "#22c55e",
  "#8b5cf6",
  "#ef4444",
  "#14b8a6",
  "#f97316",
  "#64748b",
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
function safeStr(v) {
  return v === null || v === undefined ? "Unknown" : String(v);
}
function truncate(s, len = 16) {
  const t = String(s || "");
  return t.length > len ? t.slice(0, len - 1) + "…" : t;
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

// returns { r, slope, intercept }
function linearStats(points /* [ [x,y], ... ] */) {
  const pts = points.filter(([x, y]) => isFiniteNum(x) && isFiniteNum(y));
  const n = pts.length;
  if (n < 2) return { r: NaN, slope: NaN, intercept: NaN };
  const sx = pts.reduce((a, [x]) => a + x, 0);
  const sy = pts.reduce((a, [, y]) => a + y, 0);
  const sxx = pts.reduce((a, [x]) => a + x * x, 0);
  const syy = pts.reduce((a, [, y]) => a + y * y, 0);
  const sxy = pts.reduce((a, [x, y]) => a + x * y, 0);
  const numR = n * sxy - sx * sy;
  const denR = Math.sqrt((n * sxx - sx * sx) * (n * syy - sy * sy));
  const r = denR === 0 ? NaN : numR / denR;
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx || NaN);
  const intercept = (sy - slope * sx) / n;
  return { r, slope, intercept };
}
