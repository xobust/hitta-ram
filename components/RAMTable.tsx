"use client";

import { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  createColumnHelper,
  flexRender,
  ColumnDef,
  SortingState,
  ColumnFiltersState,
} from "@tanstack/react-table";
import {
  ChevronUp,
  ChevronDown,
  Search,
  Filter,
  RefreshCw,
  Check,
} from "lucide-react";
import MultiSelect from "@/components/MultiSelect";
import RangeSlider from "@/components/RangeSlider";
import { RAMModuleWithPrice } from "@/types/ram";
import { getDieInfo, getRankInfo } from "@/lib/die-knowledge-base";

interface RAMTableProps {
  data: RAMModuleWithPrice[];
  onRefreshPrices: (module: string) => Promise<void>;
  onRefreshAllPrices: (modules: RAMModuleWithPrice[]) => Promise<void>;
  isLoading: boolean;
}

const columnHelper = createColumnHelper<RAMModuleWithPrice>();

export default function RAMTable({
  data,
  onRefreshPrices,
  onRefreshAllPrices,
  isLoading,
}: RAMTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [priceFilter, setPriceFilter] = useState<"all" | "with_price" | "without_price">("all");

  // Unique option lists for multi-select filters
  const uniqueVendors = useMemo(
    () =>
      Array.from(
        new Set((data || []).map((d) => d.vendor).filter(Boolean))
      ).sort(),
    [data]
  );
  const uniqueChips = useMemo(
    () =>
      Array.from(
        new Set((data || []).map((d) => d.chip).filter(Boolean))
      ).sort(),
    [data]
  );
  const uniqueSpeeds = useMemo(
    () =>
      Array.from(
        new Set(
          (data || [])
            .map((d) => (d.ramSpeed ?? "").toString().trim())
            .filter(Boolean)
        )
      ).sort((a, b) => Number(a) - Number(b)),
    [data]
  );
  const uniquePerSizes = useMemo(
    () =>
      Array.from(
        new Set(
          (data || [])
            .map((d) => d.perStickSizeGB)
            .filter((v) => v !== undefined)
        )
      ) as number[],
    [data]
  );
  const uniqueTotalSizes = useMemo(
    () =>
      Array.from(
        new Set(
          (data || []).map((d) => d.totalSizeGB).filter((v) => v !== undefined)
        )
      ) as number[],
    [data]
  );
  const speedNumbers = useMemo(
    () =>
      (data || [])
        .map((d) =>
          Number((d.ramSpeed ?? "").toString().replace(/[^0-9.]/g, ""))
        )
        .filter((n) => !Number.isNaN(n)),
    [data]
  );
  const minSpeed = useMemo(
    () => (speedNumbers.length ? Math.min(...speedNumbers) : 4800),
    [speedNumbers]
  );
  const maxSpeed = useMemo(
    () => (speedNumbers.length ? Math.max(...speedNumbers) : 8000),
    [speedNumbers]
  );
  const sizePerVals = useMemo(
    () => uniquePerSizes.sort((a, b) => a - b),
    [uniquePerSizes]
  );
  const sizeTotVals = useMemo(
    () => uniqueTotalSizes.sort((a, b) => a - b),
    [uniqueTotalSizes]
  );

  // Filter functions for multi-select (array) filters
  const multiStringFilter = useMemo(
    () => (row: any, columnId: string, filterValues?: string[]) => {
      if (!filterValues || filterValues.length === 0) return true;
      const value = row.getValue(columnId) as string | undefined;
      if (!value) return false;
      return filterValues.includes(value);
    },
    []
  );

  const multiNumberFilter = useMemo(
    () => (row: any, columnId: string, filterValues?: number[]) => {
      if (!filterValues || filterValues.length === 0) return true;
      const raw = row.getValue(columnId) as number | string | undefined;
      if (raw === undefined || raw === null || raw === "") return false;
      const num = typeof raw === "number" ? raw : Number(raw);
      return filterValues.includes(num);
    },
    []
  );

  const columns = useMemo<ColumnDef<RAMModuleWithPrice, any>[]>(
    () => [
      columnHelper.accessor("vendor", {
        header: "Vendor",
        cell: ({ getValue }) => (
          <span className="font-medium text-gray-900">{getValue()}</span>
        ),
        filterFn: multiStringFilter as any,
      }),
      columnHelper.accessor("module", {
        header: "Module",
        cell: ({ getValue }) => (
          <span className="font-mono text-sm text-gray-700">{getValue()}</span>
        ),
      }),
      columnHelper.accessor("perStickSizeGB", {
        header: "Per Stick (GB)",
        cell: ({ getValue }) => (
          <span className="text-gray-700">{getValue() ?? "-"}</span>
        ),
        filterFn: (row, colId, range?: [number, number]) => {
          if (!range || range.length !== 2) return true;
          const v = row.getValue(colId) as number | undefined;
          if (v === undefined) return false;
          return v >= range[0] && v <= range[1];
        },
      }),
      columnHelper.accessor("totalSizeGB", {
        header: "Total (GB)",
        cell: ({ getValue }) => (
          <span className="text-gray-700">{getValue() ?? "-"}</span>
        ),
        filterFn: (row, colId, range?: [number, number]) => {
          if (!range || range.length !== 2) return true;
          const v = row.getValue(colId) as number | undefined;
          if (v === undefined) return false;
          return v >= range[0] && v <= range[1];
        },
      }),
      columnHelper.accessor("ramSpeed", {
        header: "Speed",
        cell: ({ getValue }) => (
          <span className="text-gray-700">{getValue()}</span>
        ),
        filterFn: (row, colId, range?: [number, number]) => {
          if (!range || range.length !== 2) return true;
          const raw = row.getValue(colId) as string | number | undefined;
          if (raw === undefined) return false;
          const n =
            typeof raw === "number"
              ? raw
              : Number(String(raw).replace(/[^0-9.]/g, ""));
          if (Number.isNaN(n)) return false;
          return n >= range[0] && n <= range[1];
        },
      }),
      columnHelper.accessor("chip", {
        header: "Die Type",
        cell: ({ getValue }) => {
          const dieInfo = getDieInfo(getValue());
          return (
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-900">
                {getValue()}
              </span>
              {dieInfo && (
                <span
                  className={`text-xs px-2 py-1 rounded-full inline-block mt-1 ${
                    dieInfo.performance === "Premium"
                      ? "bg-purple-100 text-purple-800"
                      : dieInfo.performance === "High"
                      ? "bg-green-100 text-green-800"
                      : dieInfo.performance === "Medium"
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {dieInfo.performance}
                </span>
              )}
            </div>
          );
        },
        filterFn: multiStringFilter as any,
      }),
      columnHelper.accessor("rank", {
        header: "Rank",
        cell: ({ getValue, row }) => (
          <div className="flex flex-col">
            <span className="text-sm font-medium text-gray-900">
              {getValue() ?? "-"}
            </span>
            <span className="text-xs text-gray-500">{row.original.ssDs}</span>
          </div>
        ),
        filterFn: "includesString",
      }),
      columnHelper.accessor("price", {
        header: "Price",
        cell: ({ getValue, row }) => {
          const price = getValue();
          const currency = row.original.currency;
          const store = row.original.store;
          const availability = row.original.availability;

          if (!price) {
            return (
              <button
                onClick={() => onRefreshPrices(row.original.module)}
                disabled={isLoading}
                className="btn-secondary text-xs py-1 px-2"
              >
                {isLoading ? (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                ) : (
                  "Find Price"
                )}
              </button>
            );
          }

          const storeUrl = row.original.storeUrl;
          
          return (
            <div className="flex flex-col">
              {storeUrl ? (
                <a
                  href={storeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-green-600 hover:text-green-700 hover:underline"
                >
                  {price.toLocaleString()} {currency}
                </a>
              ) : (
                <span className="font-medium text-green-600">
                  {price.toLocaleString()} {currency}
                </span>
              )}
              <span className="text-xs text-gray-500">{store}</span>
              {availability && (
                <span
                  className={`text-xs ${
                    availability === 'in_stock' 
                      ? "text-green-600" 
                      : availability === 'incoming'
                      ? "text-orange-600"
                      : "text-red-600"
                  }`}
                >
                  {availability === 'in_stock' 
                    ? "In Stock" 
                    : availability === 'incoming'
                    ? "Incoming"
                    : "Not Available"}
                </span>
              )}
            </div>
          );
        },
      }),
      columnHelper.accessor(
        (row) => (row.availability === 'in_stock' ? (row.price as number | undefined) : undefined),
        {
          id: "inStockPrice",
          header: "In-stock Price",
          cell: ({ getValue, row }) => {
            const price = getValue() as number | undefined;
            const currency = row.original.currency;
            const storeUrl = row.original.storeUrl;
            if (price === undefined) {
              return <span className="text-gray-400">-</span>;
            }
            if (storeUrl) {
              return (
                <a
                  href={storeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-green-700 hover:text-green-800 hover:underline"
                >
                  {price.toLocaleString()} {currency}
                </a>
              );
            }
            return (
              <span className="font-medium text-green-700">{price.toLocaleString()} {currency}</span>
            );
          },
        }
      ),
      columnHelper.accessor("xmpBool", {
        header: "XMP",
        cell: ({ getValue }) => (
          <span className="inline-flex items-center justify-center w-5 h-5 rounded border border-gray-300 bg-white">
            {getValue() ? <Check className="h-4 w-4 text-green-600" /> : null}
          </span>
        ),
        filterFn: (row, colId, value) => {
          const v = row.getValue(colId);
          return value === "any" ? true : value === "true" ? !!v : !v;
        },
      }),
      columnHelper.accessor("expoBool", {
        header: "EXPO",
        cell: ({ getValue }) => (
          <span className="inline-flex items-center justify-center w-5 h-5 rounded border border-gray-300 bg-white">
            {getValue() ? <Check className="h-4 w-4 text-green-600" /> : null}
          </span>
        ),
        filterFn: (row, colId, value) => {
          const v = row.getValue(colId);
          return value === "any" ? true : value === "true" ? !!v : !v;
        },
      }),
      // Dynamic columns for unknown fields
      ...(() => {
        if (data.length === 0) return [];

        const firstRow = data[0];
        const unknownColumns = Object.keys(firstRow).filter(
          (key) =>
            key.startsWith("unknown_") &&
            ![
              "type",
              "vendor",
              "ramSpeed",
              "supportedSpeed",
              "size",
              "module",
              "chip",
              "ssDs",
              "xmp",
              "expo",
              "dimmSocketSupport",
              "oc",
              "bios",
              "note",
              "price",
              "currency",
              "availability",
              "store",
              "storeUrl",
              "lastUpdated",
            ].includes(key)
        );

        return unknownColumns.map((column) =>
          columnHelper.accessor(column, {
            header: column
              .replace("unknown_", "")
              .replace(/_/g, " ")
              .replace(/\b\w/g, (l) => l.toUpperCase()),
            cell: ({ getValue }) => (
              <span className="text-sm text-gray-600">{getValue()}</span>
            ),
          })
        );
      })(),
    ],
    [onRefreshPrices, isLoading, data]
  );

  // Filter data based on price filter
  const filteredData = useMemo(() => {
    if (priceFilter === "all") return data;
    if (priceFilter === "with_price") {
      return data.filter(row => row.price !== undefined && row.price > 0);
    }
    if (priceFilter === "without_price") {
      return data.filter(row => !row.price || row.price === 0);
    }
    return data;
  }, [data, priceFilter]);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 20,
      },
    },
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search all columns..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="input-field pl-10 w-64"
            />
          </div>

          <div className="flex items-center gap-4">
            {/* Price Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Price Status:</span>
              <select
                value={priceFilter}
                onChange={(e) => setPriceFilter(e.target.value as "all" | "with_price" | "without_price")}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All ({data.length})</option>
                <option value="with_price">
                  With Price ({data.filter(row => row.price !== undefined && row.price > 0).length})
                </option>
                <option value="without_price">
                  Without Price ({data.filter(row => !row.price || row.price === 0).length})
                </option>
              </select>
            </div>

            {/* Refresh Filtered Prices Button */}
            <button
              onClick={() => {
                const filteredRows = table.getFilteredRowModel().rows.map(row => row.original);
                onRefreshAllPrices(filteredRows);
              }}
              disabled={isLoading || table.getFilteredRowModel().rows.length === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-md transition-colors flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Refreshing...' : `Refresh Filtered (${table.getFilteredRowModel().rows.length})`}
            </button>

            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-600">
                {table.getFilteredRowModel().rows.length} of {filteredData.length} modules
              </span>
            </div>
          </div>
        </div>

        {/* Per-column filters (with improved multiselect) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            placeholder="Filter module"
            className="input-field"
            value={
              (table.getColumn("module")?.getFilterValue() as string) ?? ""
            }
            onChange={(e) =>
              table.getColumn("module")?.setFilterValue(e.target.value)
            }
          />
          <MultiSelect
            options={uniqueVendors.map((v) => ({ label: v, value: v }))}
            value={
              (table.getColumn("vendor")?.getFilterValue() as string[]) ?? []
            }
            onChange={(next) => table.getColumn("vendor")?.setFilterValue(next)}
            placeholder="Vendors"
          />
          <MultiSelect
            options={uniqueChips.map((c) => ({ label: c, value: c }))}
            value={
              (table.getColumn("chip")?.getFilterValue() as string[]) ?? []
            }
            onChange={(next) => table.getColumn("chip")?.setFilterValue(next)}
            placeholder="Die types"
          />
          <select
            className="input-field"
            value={(table.getColumn("rank")?.getFilterValue() as string) ?? ""}
            onChange={(e) =>
              table.getColumn("rank")?.setFilterValue(e.target.value)
            }
          >
            <option value="">Rank (any)</option>
            <option value="Single">Single</option>
            <option value="Dual">Dual</option>
          </select>
          <select
            className="input-field"
            value={
              (table.getColumn("xmpBool")?.getFilterValue() as string) ?? "any"
            }
            onChange={(e) =>
              table.getColumn("xmpBool")?.setFilterValue(e.target.value)
            }
          >
            <option value="any">XMP (any)</option>
            <option value="true">XMP (yes)</option>
            <option value="false">XMP (no)</option>
          </select>
          <select
            className="input-field"
            value={
              (table.getColumn("expoBool")?.getFilterValue() as string) ?? "any"
            }
            onChange={(e) =>
              table.getColumn("expoBool")?.setFilterValue(e.target.value)
            }
          >
            <option value="any">EXPO (any)</option>
            <option value="true">EXPO (yes)</option>
            <option value="false">EXPO (no)</option>
          </select>
        </div>

        {/* Sliders grouped below for better spacing */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <RangeSlider
            min={Math.floor(minSpeed)}
            max={Math.ceil(maxSpeed)}
            value={
              (table.getColumn("ramSpeed")?.getFilterValue() as [
                number,
                number
              ]) ?? undefined
            }
            onChange={(next) =>
              table.getColumn("ramSpeed")?.setFilterValue(next)
            }
            step={100}
            ticks={[4800, 5200, 5600, 6000, 6200, 6400, 6800, 7000, 7200]}
            snapValues={[
              4800, 5200, 5600, 6000, 6200, 6400, 6600, 6800, 7000, 7200,
            ]}
            label="Speed (MT/s)"
          />
          <RangeSlider
            min={sizePerVals[0] ?? 8}
            max={sizePerVals[sizePerVals.length - 1] ?? 64}
            value={
              (table.getColumn("perStickSizeGB")?.getFilterValue() as [
                number,
                number
              ]) ?? undefined
            }
            onChange={(next) =>
              table.getColumn("perStickSizeGB")?.setFilterValue(next)
            }
            step={8}
            snapValues={sizePerVals}
            label="Per-stick (GB)"
          />
          <RangeSlider
            min={sizeTotVals[0] ?? 16}
            max={sizeTotVals[sizeTotVals.length - 1] ?? 128}
            value={
              (table.getColumn("totalSizeGB")?.getFilterValue() as [
                number,
                number
              ]) ?? undefined
            }
            onChange={(next) =>
              table.getColumn("totalSizeGB")?.setFilterValue(next)
            }
            step={8}
            snapValues={sizeTotVals}
            label="Total (GB)"
          />
        </div>

        <div className="flex items-center space-x-2 self-end">
          <button
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            className="btn-secondary text-sm py-1 px-3 disabled:opacity-50"
          >
            First
          </button>
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="btn-secondary text-sm py-1 px-3 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount()}
          </span>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="btn-secondary text-sm py-1 px-3 disabled:opacity-50"
          >
            Next
          </button>
          <button
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
            className="btn-secondary text-sm py-1 px-3 disabled:opacity-50"
          >
            Last
          </button>
        </div>
        
        {/* Page Size Selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Show:</span>
          <select
            value={table.getState().pagination.pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
            className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {[10, 20, 50, 100, 200, 500].map((pageSize) => (
              <option key={pageSize} value={pageSize}>
                {pageSize} rows
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="table-header cursor-pointer select-none"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center space-x-1">
                      <span>
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                      </span>
                      {header.column.getCanSort() && (
                        <div className="flex flex-col">
                          <ChevronUp
                            className={`h-3 w-3 ${
                              header.column.getIsSorted() === "asc"
                                ? "text-blue-600"
                                : "text-gray-400"
                            }`}
                          />
                          <ChevronDown
                            className={`h-3 w-3 -mt-1 ${
                              header.column.getIsSorted() === "desc"
                                ? "text-blue-600"
                                : "text-gray-400"
                            }`}
                          />
                        </div>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="table-cell">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {table.getRowModel().rows.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No RAM modules found. Try adjusting your filters.
        </div>
      )}
    </div>
  );
}
