"use client"

import * as React from "react"
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  type ExpandedState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getExpandedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { ChevronDown, ChevronUp } from "lucide-react"
import type { DateRange } from "react-day-picker"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/components/lib/utils"
import type { MeetingMetaData } from "@/data/sample-meetings"
import { MeetingDetails } from "./MeetingDetails"
import { Pagination } from "./Pagination"

interface DataTableProps {
  columns: ColumnDef<MeetingMetaData, unknown>[]
  data: MeetingMetaData[]
  globalFilter: string
  onGlobalFilterChange: (value: string) => void
  dateRange: DateRange | undefined
  columnVisibility: VisibilityState
  onColumnVisibilityChange: (visibility: VisibilityState) => void
  columnFilters: ColumnFiltersState
  user: { email: string }
}

export function DataTable({
  columns,
  data,
  globalFilter,
  onGlobalFilterChange,
  dateRange,
  columnVisibility,
  onColumnVisibilityChange,
  columnFilters: externalColumnFilters,
  user,
}: DataTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "timestamp", desc: true } // Default sort by date descending
  ])
  const [rowSelection, setRowSelection] = React.useState({})
  const [expanded, setExpanded] = React.useState<ExpandedState>({})

  // Extract custom filter values to avoid dependency on full array
  const customFilters = React.useMemo(() => {
    const isHostFilter = externalColumnFilters.find(f => f.id === "isHost")
    const participantSizeFilter = externalColumnFilters.find(f => f.id === "participantSize")
    const ongoingFilter = externalColumnFilters.find(f => f.id === "ongoing")
    
    return {
      isHost: isHostFilter?.value === true,
      participantSize: participantSizeFilter?.value,
      ongoing: ongoingFilter?.value === true,
    }
  }, [externalColumnFilters])

  // Merge external filters with date range filter (for table's column filters)
  const columnFilters = React.useMemo(() => {
    let mergedFilters = externalColumnFilters.filter(f => 
      f.id !== "isHost" && f.id !== "participantSize" && f.id !== "ongoing" && f.id !== "timestamp"
    )
    
    // Handle date range filter
    if (dateRange?.from || dateRange?.to) {
      mergedFilters.push({ id: "timestamp", value: dateRange })
    }
    
    return mergedFilters
  }, [externalColumnFilters, dateRange])

  // Apply custom filters to data before it reaches the table
  const filteredData = React.useMemo(() => {
    let result = data

    // Apply isHost filter
    if (customFilters.isHost) {
      result = result.filter(row => row.email === user.email)
    }

    // Apply participantSize filter
    if (customFilters.participantSize) {
      if (customFilters.participantSize === '6+') {
        result = result.filter(row => row.participantCount >= 6)
      } else {
        const size = typeof customFilters.participantSize === 'number' 
          ? customFilters.participantSize 
          : parseInt(String(customFilters.participantSize), 10)
        if (!isNaN(size)) {
          result = result.filter(row => row.participantCount === size)
        }
      }
    }

    // Apply ongoing filter
    if (customFilters.ongoing) {
      result = result.filter(row => row.status === "in_progress")
    }

    return result
  }, [data, customFilters.isHost, customFilters.participantSize, customFilters.ongoing, user.email])

  const table = useReactTable({
    data: filteredData,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: () => {
      // Filters are managed by parent component via externalColumnFilters
      // This is a no-op since we filter data before it reaches the table
    },
    onColumnVisibilityChange: (updater) => {
      const newVisibility = typeof updater === "function" 
        ? updater(columnVisibility) 
        : updater
      onColumnVisibilityChange(newVisibility)
    },
    onRowSelectionChange: setRowSelection,
    onExpandedChange: setExpanded,
    onGlobalFilterChange,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: () => true,
    filterFns: {
      isHost: (row, columnId, filterValue) => {
        if (!filterValue) return true
        return row.original.email === user.email
      },
      participantSize: (row, columnId, filterValue) => {
        if (!filterValue) return true
        if (filterValue === '6+') {
          return row.original.participantCount >= 6
        }
        const size = typeof filterValue === 'number' ? filterValue : parseInt(String(filterValue), 10)
        return row.original.participantCount === size
      },
      ongoing: (row, columnId, filterValue) => {
        if (!filterValue) return true
        return row.original.status === "in_progress"
      },
    },
    state: {
      sorting,
      columnFilters, // Already excludes custom filters
      columnVisibility,
      rowSelection,
      expanded,
      globalFilter,
    },
    globalFilterFn: (row, columnId, filterValue) => {
      const searchValue = String(filterValue).toLowerCase()
      
      // Search in title
      const title = String(row.getValue("title") || "").toLowerCase()
      if (title.includes(searchValue)) return true
      
      // Search in host name
      const hostName = String(row.getValue("hostName") || "").toLowerCase()
      if (hostName.includes(searchValue)) return true
      
      // Search in email
      const email = String(row.original.email || "").toLowerCase()
      if (email.includes(searchValue)) return true
      
      // Search in participants
      const participants = row.original.participants || []
      if (participants.some(p => p.toLowerCase().includes(searchValue))) return true
      
      return false
    },
  })

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-accent-200 shadow-sm bg-white">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent border-accent-200">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
                {/* Expand toggle column header */}
                <TableHead className="w-[40px]"></TableHead>
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <React.Fragment key={row.id}>
                  <TableRow
                    data-state={row.getIsSelected() && "selected"}
                    className={cn(
                      "cursor-pointer transition-colors border-accent-100",
                      "hover:bg-accent-50",
                      "data-[state=selected]:bg-primary-50",
                      row.getIsExpanded() && "bg-accent-50/50 border-b-0"
                    )}
                    onClick={() => row.toggleExpanded()}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                    {/* Expand toggle cell */}
                    <TableCell className="w-[40px]">
                      {row.getIsExpanded() ? (
                        <ChevronUp className="h-4 w-4 text-primary-500" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                  </TableRow>
                  
                  {/* Expanded row details */}
                  {row.getIsExpanded() && (
                    <TableRow className="hover:bg-transparent border-0 bg-accent-50/30">
                      <TableCell 
                        colSpan={columns.length + 1} 
                        className="p-0 border-0"
                      >
                        <div className="border-t border-accent-200 mx-4">
                          <MeetingDetails meeting={row.original} />
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length + 1}
                  className="h-24 text-center"
                >
                  No meetings found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      
      {/* Pagination */}
      <Pagination table={table} />
    </div>
  )
}

// Re-export table hook for use in parent components
export { useReactTable }
