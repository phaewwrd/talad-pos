"use client";

import {
  type ColumnDef,
  FlexRender,
  type PaginationState,
  type RowData,
  rowPaginationFeature,
  rowSortingFeature,
  type SortingState,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Fragment, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

// Server-side pagination and sorting: the table only renders the current page
// and reports page / sort changes; the caller refetches.

export const serverTableFeatures = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  columnMeta: {} as { align?: "left" | "right" | "center"; className?: string },
});

export type ServerColumn<T extends RowData> = ColumnDef<
  typeof serverTableFeatures,
  T,
  // biome-ignore lint/suspicious/noExplicitAny: column value types vary per column
  any
>;

export type ServerTableState = {
  pagination: PaginationState;
  sorting: SortingState;
};

export const PAGE_SIZES = [20, 50, 100] as const;

export function ServerDataTable<T extends RowData>({
  columns,
  rows,
  total,
  loading,
  state,
  onStateChange,
  empty,
  getRowId,
  renderExpanded,
  onRowClick,
}: {
  columns: ServerColumn<T>[];
  rows: T[] | undefined;
  total: number;
  loading?: boolean;
  state: ServerTableState;
  onStateChange: (next: ServerTableState) => void;
  empty?: React.ReactNode;
  getRowId: (row: T) => string;
  /** When set, rows get an expand toggle that shows this content below them. */
  renderExpanded?: (row: T) => React.ReactNode;
  onRowClick?: (row: T) => void;
}) {
  const t = useTranslations("common");
  const tb = useTranslations("backoffice.table");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const allColumns: ServerColumn<T>[] = renderExpanded
    ? [
        {
          id: "_expand",
          header: "",
          enableSorting: false,
          meta: { className: "w-10" },
          cell: ({ row }) => {
            const id = getRowId(row.original);
            const open = expanded.has(id);
            return (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 rounded-full"
                aria-expanded={open}
                aria-label={open ? tb("collapse") : tb("expand")}
                onClick={() =>
                  setExpanded((prev) => {
                    const next = new Set(prev);
                    if (open) next.delete(id);
                    else next.add(id);
                    return next;
                  })
                }
              >
                <ChevronDown
                  className={cn(
                    "size-4 transition-transform",
                    open && "rotate-180",
                  )}
                />
              </Button>
            );
          },
        },
        ...columns,
      ]
    : columns;

  const table = useTable({
    features: serverTableFeatures,
    columns: allColumns,
    data: rows ?? [],
    getRowId: (row) => getRowId(row),
    manualPagination: true,
    manualSorting: true,
    rowCount: total,
    state,
    onPaginationChange: (updater) => {
      const pagination =
        typeof updater === "function" ? updater(state.pagination) : updater;
      onStateChange({ ...state, pagination });
    },
    onSortingChange: (updater) => {
      const sorting =
        typeof updater === "function" ? updater(state.sorting) : updater;
      onStateChange({
        sorting,
        pagination: { ...state.pagination, pageIndex: 0 },
      });
    },
  });

  const pageCount = Math.max(1, Math.ceil(total / state.pagination.pageSize));
  const from =
    total === 0
      ? 0
      : state.pagination.pageIndex * state.pagination.pageSize + 1;
  const to = Math.min(total, from + (rows?.length ?? 0) - 1);

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="hover:bg-transparent">
                {group.headers.map((header) => {
                  const meta = header.column.columnDef.meta;
                  const sorted = header.column.getIsSorted();
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        "h-10 whitespace-nowrap text-muted-foreground text-xs",
                        meta?.align === "right" && "text-right",
                        meta?.className,
                      )}
                      aria-sort={
                        sorted === "asc"
                          ? "ascending"
                          : sorted === "desc"
                            ? "descending"
                            : undefined
                      }
                    >
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn(
                            "inline-flex items-center gap-1 hover:text-foreground",
                            meta?.align === "right" && "flex-row-reverse",
                          )}
                        >
                          <FlexRender header={header} />
                          {sorted === "asc" && (
                            <ArrowUp className="size-3" aria-hidden />
                          )}
                          {sorted === "desc" && (
                            <ArrowDown className="size-3" aria-hidden />
                          )}
                        </button>
                      ) : (
                        <FlexRender header={header} />
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading && !rows ? (
              Array.from({ length: 6 }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: skeleton rows
                <TableRow key={i}>
                  {allColumns.map((_, j) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: skeleton cells
                    <TableCell key={j} className="h-12">
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={allColumns.length} className="p-0">
                  {empty ?? (
                    <p className="py-12 text-center text-muted-foreground text-sm">
                      {t("empty")}
                    </p>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => {
                const open = renderExpanded && expanded.has(row.id);
                return (
                  <Fragment key={row.id}>
                    <TableRow
                      onClick={
                        onRowClick
                          ? (e) => {
                              const el = e.target as HTMLElement;
                              if (!e.currentTarget.contains(el)) return;
                              if (el.closest("button,a,[role=menuitem]"))
                                return;
                              onRowClick(row.original);
                            }
                          : undefined
                      }
                      className={cn(
                        onRowClick && "cursor-pointer",
                        loading && "opacity-60",
                      )}
                    >
                      {row.getAllCells().map((cell) => {
                        const meta = cell.column.columnDef.meta;
                        return (
                          <TableCell
                            key={cell.id}
                            className={cn(
                              "h-12 py-2",
                              meta?.align === "right" &&
                                "text-right tabular-nums",
                              meta?.className,
                            )}
                          >
                            <FlexRender cell={cell} />
                          </TableCell>
                        );
                      })}
                    </TableRow>
                    {open && (
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableCell colSpan={allColumns.length} className="p-4">
                          {renderExpanded(row.original)}
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2 text-sm">
        <span className="text-muted-foreground tabular-nums">
          {tb("range", { from, to, total })}
        </span>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-muted-foreground">
            <span className="sr-only sm:not-sr-only">{tb("perPage")}</span>
            <select
              className="h-9 rounded-full border bg-card px-2 text-foreground"
              value={state.pagination.pageSize}
              onChange={(e) =>
                onStateChange({
                  ...state,
                  pagination: {
                    pageIndex: 0,
                    pageSize: Number(e.target.value),
                  },
                })
              }
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <span className="text-muted-foreground tabular-nums">
            {state.pagination.pageIndex + 1} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="size-9 rounded-full"
            onClick={() => table.previousPage()}
            disabled={state.pagination.pageIndex === 0}
            aria-label={t("previous")}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-9 rounded-full"
            onClick={() => table.nextPage()}
            disabled={state.pagination.pageIndex + 1 >= pageCount}
            aria-label={t("next")}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Serialize table state into query params for a list route handler. */
export function tableQuery(state: ServerTableState) {
  const sort = state.sorting[0];
  return {
    page: state.pagination.pageIndex + 1,
    pageSize: state.pagination.pageSize,
    sort: sort?.id,
    dir: sort ? (sort.desc ? "desc" : "asc") : undefined,
  };
}
