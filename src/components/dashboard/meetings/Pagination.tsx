"use client"

import type { Table } from "@tanstack/react-table"
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface PaginationProps<TData> {
  table: Table<TData>
}

export function Pagination<TData>({ table }: PaginationProps<TData>) {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
      {/* Row count and selection info */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} row(s) selected
        </span>
        <span className="hidden sm:inline">•</span>
        <span className="hidden sm:inline">
          Page {table.getState().pagination.pageIndex + 1} of{" "}
          {table.getPageCount()}
        </span>
      </div>

      {/* Page size and navigation */}
      <div className="flex items-center gap-4">
        {/* Page size selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground hidden sm:inline">
            Rows per page
          </span>
          <Select
            value={`${table.getState().pagination.pageSize}`}
            onValueChange={(value) => {
              table.setPageSize(Number(value))
            }}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={table.getState().pagination.pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              {[10, 20, 30, 50, 100].map((pageSize) => (
                <SelectItem key={pageSize} value={`${pageSize}`}>
                  {pageSize}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Page navigation */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronsLeft className="h-4 w-4" />
            <span className="sr-only">Go to first page</span>
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">Go to previous page</span>
          </Button>
          
          {/* Page numbers */}
          <div className="hidden sm:flex items-center gap-1">
            {Array.from({ length: Math.min(5, table.getPageCount()) }, (_, i) => {
              const currentPage = table.getState().pagination.pageIndex
              const pageCount = table.getPageCount()
              
              // Calculate which page numbers to show
              let pageIndex: number
              if (pageCount <= 5) {
                pageIndex = i
              } else if (currentPage < 3) {
                pageIndex = i
              } else if (currentPage > pageCount - 4) {
                pageIndex = pageCount - 5 + i
              } else {
                pageIndex = currentPage - 2 + i
              }
              
              if (pageIndex < 0 || pageIndex >= pageCount) return null
              
              return (
                <Button
                  key={pageIndex}
                  variant={currentPage === pageIndex ? "default" : "outline"}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => table.setPageIndex(pageIndex)}
                >
                  {pageIndex + 1}
                </Button>
              )
            })}
          </div>

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight className="h-4 w-4" />
            <span className="sr-only">Go to next page</span>
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <ChevronsRight className="h-4 w-4" />
            <span className="sr-only">Go to last page</span>
          </Button>
        </div>
      </div>
    </div>
  )
}

