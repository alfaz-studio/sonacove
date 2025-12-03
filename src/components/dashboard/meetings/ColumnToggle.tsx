"use client"

import type { Table } from "@tanstack/react-table"
import { Settings2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface ColumnToggleProps<TData> {
  table: Table<TData>
}

// Map column IDs to human-readable names
const columnLabels: Record<string, string> = {
  select: "Select",
  title: "Meeting Title",
  timestamp: "Date & Time",
  hostName: "Host",
  duration: "Duration",
  participantCount: "Participants",
  status: "Status",
  artifacts: "Artifacts",
  actions: "Actions",
}

export function ColumnToggle<TData>({ table }: ColumnToggleProps<TData>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-9">
          <Settings2 className="mr-2 h-4 w-4" />
          Columns
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[180px]" onCloseAutoFocus={(e) => e.preventDefault()}>
        {table
          .getAllColumns()
          .filter(
            (column) =>
              typeof column.accessorFn !== "undefined" || column.id === "artifacts"
          )
          .filter((column) => column.getCanHide())
          .map((column) => {
            return (
              <DropdownMenuCheckboxItem
                key={column.id}
                className="capitalize"
                checked={column.getIsVisible()}
                onCheckedChange={(value) => {
                  column.toggleVisibility(!!value)
                }}
                onSelect={(e) => e.preventDefault()}
              >
                {columnLabels[column.id] || column.id}
              </DropdownMenuCheckboxItem>
            )
          })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

