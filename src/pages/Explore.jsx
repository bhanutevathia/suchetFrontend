import React, { useEffect, useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
} from "@tanstack/react-table";
import { api } from "../shared/api";

export default function Explore() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // table controls
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState([]);
  const [columnVisibility, setColumnVisibility] = useState({});
  const [dense, setDense] = useState(false);
  const [pageSize, setPageSize] = useState(20);

  // debounce global filter
  const [pendingFilter, setPendingFilter] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setGlobalFilter(pendingFilter), 300);
    return () => clearTimeout(id);
  }, [pendingFilter]);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const data = await api("/conditions");
        if (!alive) return;
        setRows(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
        setError("Failed to load conditions.");
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, []);

  const columns = useMemo(() => {
    const keys = rows[0] ? Object.keys(rows[0]) : [];
    return keys.map((k) => {
      const isNumeric = rows.every((r) => r[k] === "" || !isNaN(Number(r[k])));
      return {
        header: k,
        accessorKey: k,
        enableSorting: true,
        sortingFn: isNumeric ? "alphanumeric" : "text",
        cell: (info) => {
          const v = info.getValue();
          if (v === "" || v === null || v === undefined) {
            return (
              <span style={{ color: "var(--ss-body)", opacity: 0.55 }}>—</span>
            );
          }
          return String(v);
        },
      };
    });
  }, [rows]);

  const table = useReactTable({
    data: rows,
    columns,
    state: {
      sorting,
      globalFilter,
      columnVisibility,
      pagination: { pageSize },
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageIndex: 0, pageSize } },
  });

  const exportCSV = () => {
    const visibleCols = table
      .getAllLeafColumns()
      .filter((c) => c.getIsVisible());
    const headers = visibleCols.map((c) => c.id);
    const data = table.getRowModel().rows.map((r) =>
      visibleCols
        .map((c) => {
          const v = r.getValue(c.id);
          const s = v === null || v === undefined ? "" : String(v);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(",")
    );
    const csv = [headers.join(","), ...data].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "conditions_filtered.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="space-y-4" style={{ color: "var(--ss-body)" }}>
        <h2
          className="text-xl font-semibold"
          style={{ color: "var(--ss-heading)" }}
        >
          Conditions Explorer
        </h2>
        <SkeletonToolbar />
        <SkeletonTable />
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
          className="text-xl font-semibold mb-2"
          style={{ color: "var(--ss-heading)" }}
        >
          Conditions Explorer
        </h2>
        <p className="text-sm" style={{ color: "var(--ss-body)" }}>
          {error}
        </p>
      </div>
    );
  }

  const rowPad = dense ? "py-1.5" : "py-2.5";

  return (
    <div className="space-y-4" style={{ color: "var(--ss-body)" }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2
          className="text-xl font-semibold"
          style={{ color: "var(--ss-heading)" }}
        >
          Conditions Explorer
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {/* Global Search */}
          <input
            className="rounded px-3 py-2 text-sm bg-white"
            style={{ border: "1px solid var(--ss-border)" }}
            value={pendingFilter}
            onChange={(e) => setPendingFilter(e.target.value)}
            placeholder="Search all columns..."
          />
          {/* Page size */}
          <select
            className="rounded px-2 py-2 text-sm bg-white"
            style={{ border: "1px solid var(--ss-border)" }}
            value={pageSize}
            onChange={(e) => {
              const n = Number(e.target.value);
              setPageSize(n);
              table.setPageSize(n);
            }}
            title="Rows per page"
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}/page
              </option>
            ))}
          </select>
          {/* Density */}
          <button
            onClick={() => setDense((d) => !d)}
            className="px-3 py-2 rounded text-sm"
            style={{
              border: "1px solid var(--ss-border)",
              background: "var(--ss-white)",
            }}
            title="Toggle density"
          >
            {dense ? "Comfort" : "Dense"}
          </button>
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

          {/* Columns menu */}
          <div className="relative">
            <details className="group">
              <summary
                className="px-3 py-2 rounded text-sm cursor-pointer list-none select-none"
                style={{
                  border: "1px solid var(--ss-border)",
                  background: "var(--ss-white)",
                }}
              >
                Columns
              </summary>
              <div
                className="absolute right-0 mt-2 w-56 rounded-xl shadow-lg p-2 z-10 max-h-80 overflow-auto"
                style={{
                  background: "var(--ss-white)",
                  border: "1px solid var(--ss-border)",
                }}
              >
                {table.getAllLeafColumns().map((col) => (
                  <label
                    key={col.id}
                    className="flex items-center gap-2 px-2 py-1 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={col.getIsVisible()}
                      onChange={col.getToggleVisibilityHandler()}
                    />
                    <span className="truncate">{col.columnDef.header}</span>
                  </label>
                ))}
              </div>
            </details>
          </div>
        </div>
      </div>

      <div
        className="rounded-2xl overflow-auto"
        style={{
          background: "var(--ss-white)",
          border: "1px solid var(--ss-border)",
        }}
      >
        <table
          className="min-w-full text-sm"
          style={{ color: "var(--ss-body)" }}
        >
          <thead
            className="sticky top-0 z-10"
            style={{ background: "var(--ss-cream-1)" }}
          >
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    className="px-3 py-2 text-left font-medium whitespace-nowrap select-none border-b"
                    style={{
                      borderColor: "var(--ss-border)",
                      color: "var(--ss-heading)",
                    }}
                  >
                    {h.isPlaceholder ? null : (
                      <button
                        className="inline-flex items-center gap-1"
                        style={{ color: "var(--ss-heading)" }}
                        onClick={h.column.getToggleSortingHandler()}
                        title="Click to sort"
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        <SortIcon dir={h.column.getIsSorted()} />
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={table.getAllLeafColumns().length}
                  className="px-3 py-6 text-center"
                  style={{ color: "var(--ss-body)", opacity: 0.7 }}
                >
                  No rows match your filters.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((r) => (
                <tr
                  key={r.id}
                  className="odd:bg-white"
                  style={{ background: "transparent" }}
                >
                  {r.getVisibleCells().map((c) => (
                    <td
                      key={c.id}
                      className={`px-3 ${rowPad} border-b whitespace-nowrap`}
                      style={{ borderColor: "var(--ss-border)" }}
                      title={String(c.getValue() ?? "")}
                    >
                      {flexRender(c.column.columnDef.cell, c.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          className="px-3 py-1 rounded"
          style={{
            border: "1px solid var(--ss-border)",
            background: "var(--ss-white)",
          }}
          onClick={() => table.firstPage()}
          disabled={!table.getCanPreviousPage()}
        >
          ⏮ First
        </button>
        <button
          className="px-3 py-1 rounded"
          style={{
            border: "1px solid var(--ss-border)",
            background: "var(--ss-white)",
          }}
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          ◀ Prev
        </button>
        <span className="text-sm" style={{ color: "var(--ss-body)" }}>
          Page <strong>{table.getState().pagination.pageIndex + 1}</strong> of{" "}
          <strong>{table.getPageCount()}</strong>
        </span>
        <button
          className="px-3 py-1 rounded"
          style={{
            border: "1px solid var(--ss-border)",
            background: "var(--ss-white)",
          }}
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next ▶
        </button>
        <button
          className="px-3 py-1 rounded"
          style={{
            border: "1px solid var(--ss-border)",
            background: "var(--ss-white)",
          }}
          onClick={() => table.lastPage?.()}
          disabled={!table.getCanNextPage()}
        >
          Last ⏭
        </button>
      </div>
    </div>
  );
}

/* ----------------- Helpers ----------------- */

function SortIcon({ dir }) {
  if (!dir)
    return <span style={{ color: "var(--ss-body)", opacity: 0.4 }}>↕</span>;
  if (dir === "asc")
    return (
      <span aria-label="ascending" style={{ color: "var(--ss-heading)" }}>
        ↑
      </span>
    );
  return (
    <span aria-label="descending" style={{ color: "var(--ss-heading)" }}>
      ↓
    </span>
  );
}

function SkeletonToolbar() {
  return (
    <div className="flex items-center gap-2">
      <div className="h-9 w-48 rounded" style={{ background: "#F4EDE5" }} />
      <div className="h-9 w-24 rounded" style={{ background: "#F4EDE5" }} />
      <div className="h-9 w-20 rounded" style={{ background: "#F4EDE5" }} />
      <div className="h-9 w-28 rounded" style={{ background: "#F4EDE5" }} />
    </div>
  );
}

function SkeletonTable() {
  return (
    <div
      className="rounded-2xl overflow-hidden animate-pulse"
      style={{
        background: "var(--ss-white)",
        border: "1px solid var(--ss-border)",
      }}
    >
      <div className="h-10" style={{ background: "var(--ss-cream-1)" }} />
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="h-10 border-t"
          style={{
            background: i % 2 ? "#FFFDF8" : "#FFFFFF",
            borderColor: "var(--ss-border)",
          }}
        />
      ))}
    </div>
  );
}
