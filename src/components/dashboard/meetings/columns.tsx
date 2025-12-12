"use client"

import type { ColumnDef } from "@tanstack/react-table"
import type { MeetingMetaData } from "@/data/meeting-types"
import { format } from "date-fns"
import { ArrowUpDown, Video, FileText, MessageSquare, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// Helper to format duration
function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`
  }
  const hours = Math.floor(minutes / 60)
  const remainingMins = minutes % 60
  return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`
}


export const columns: ColumnDef<MeetingMetaData>[] = [
  // Selection checkbox column
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
        className="data-[state=checked]:bg-primary-500 data-[state=checked]:border-primary-500 data-[state=checked]:text-white border-accent-300 focus-visible:ring-primary-500"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
        onClick={(e) => e.stopPropagation()}
        className="data-[state=checked]:bg-primary-500 data-[state=checked]:border-primary-500 data-[state=checked]:text-white border-accent-300 focus-visible:ring-primary-500"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  
  // Title column
  {
    accessorKey: "title",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4"
        >
          Meeting Title
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const title = row.getValue("title") as string
      return (
        <div className="font-medium">{title}</div>
      )
    },
  },
  
  // Date & Time column
  {
    accessorKey: "timestamp",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4"
        >
          Date & Time
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const timestamp = row.getValue("timestamp") as number
      return (
        <div className="flex flex-col">
          <span className="font-medium">{format(new Date(timestamp), "MMM d, yyyy")}</span>
          <span className="text-xs text-muted-foreground">{format(new Date(timestamp), "h:mm a")}</span>
        </div>
      )
    },
    filterFn: (row, columnId, filterValue) => {
      if (!filterValue?.from && !filterValue?.to) return true
      const timestamp = row.getValue(columnId) as number
      const date = new Date(timestamp)
      if (filterValue.from && date < filterValue.from) return false
      if (filterValue.to && date > filterValue.to) return false
      return true
    },
  },
  
  // Host column
  {
    accessorKey: "hostName",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4"
        >
          Host
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const meeting = row.original
      // Use hosts array if available, otherwise fall back to email field
      const hosts = meeting.hosts || (meeting.email ? [meeting.email] : [])
      const hostNames = meeting.hostNames || (meeting.hostName ? [meeting.hostName] : [])
      
      // Extract names from email addresses if hostNames not available
      let displayNames: string[] = []
      if (hostNames.length > 0) {
        displayNames = hostNames
      } else if (hosts.length > 0) {
        displayNames = hosts.map(email => {
          if (!email) return "Guest"
          const namePart = email.split("@")[0]
          return namePart.split(".").map(part => 
            part.charAt(0).toUpperCase() + part.slice(1)
          ).join(" ")
        })
      } else if (meeting.hostName) {
        // Fallback to hostName field when arrays are empty
        displayNames = [meeting.hostName]
      } else if (meeting.email) {
        // Final fallback to email field
        const namePart = meeting.email.split("@")[0]
        displayNames = [namePart.split(".").map(part => 
          part.charAt(0).toUpperCase() + part.slice(1)
        ).join(" ")]
      }
      
      // Show first 2 names, then "and X more"
      const maxVisible = 2
      const visibleNames = displayNames.slice(0, maxVisible)
      const remainingCount = displayNames.length - maxVisible
      
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex flex-col gap-1 cursor-help">
                <div className="text-sm">
                  {visibleNames.join(", ")}
                  {remainingCount > 0 && ` and ${remainingCount} more`}
                </div>
                {hosts.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {hosts.slice(0, maxVisible).join(", ")}
                    {remainingCount > 0 && ` and ${remainingCount} more`}
                  </div>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <div className="text-sm">
                <p className="font-medium mb-1">All Hosts ({hosts.length}):</p>
                <ul className="list-disc list-inside">
                  {displayNames.map((name, i) => (
                    <li key={i} className="text-xs">
                      {name}
                      {hosts[i] && <span className="text-muted-foreground"> ({hosts[i]})</span>}
                    </li>
                  ))}
                </ul>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    },
  },
  
  // Duration column
  {
    accessorKey: "duration",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4"
        >
          Duration
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const duration = row.getValue("duration") as number
      const status = row.original.status
      const isOngoing = status === "in_progress"
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2">
                <span>{formatDuration(duration)}</span>
                {isOngoing && (
                  <div className="h-2 w-2 rounded-full bg-red-500" />
                )}
              </div>
            </TooltipTrigger>
            {isOngoing && (
              <TooltipContent>
                <p>Meeting in progress</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      )
    },
  },
  
  // Participants column
  {
    accessorKey: "participantCount",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4"
        >
          Participants
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const count = row.getValue("participantCount") as number
      const participants = row.original.participants
      
      // Extract names from email addresses or use identifier as-is (guests are already named "Guest 1", etc.)
      const participantNames = participants.map(identifier => {
        // Check if it's an email address
        if (identifier.includes("@") && !identifier.startsWith("Guest")) {
          const namePart = identifier.split("@")[0]
          return namePart.split(".").map(part => 
            part.charAt(0).toUpperCase() + part.slice(1)
          ).join(" ")
        }
        // For guests or other identifiers, use as-is (guests are already "Guest 1", "Guest 2", etc.)
        return identifier
      })
      
      // Show first 3 names, then "and X more"
      const maxVisible = 3
      const visibleNames = participantNames.slice(0, maxVisible)
      const remainingCount = participantNames.length - maxVisible
      
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex flex-col gap-1 cursor-help">
                <div className="flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{count}</span>
                </div>
                {participantNames.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {visibleNames.join(", ")}
                    {remainingCount > 0 && ` and ${remainingCount} more`}
                  </div>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <div className="text-sm">
                <p className="font-medium mb-1">All Participants ({count}):</p>
                <ul className="list-disc list-inside">
                  {participantNames.map((name, i) => (
                    <li key={i} className="text-xs">{name}</li>
                  ))}
                </ul>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    },
  },
  
  // Artifacts indicator column
  {
    id: "artifacts",
    header: "Artifacts",
    cell: ({ row }) => {
      const { isRecorded, hasTranscript, chatLog } = row.original
      const hasChatMessages = chatLog && chatLog.length > 0
      
      return (
        <div className="flex items-center gap-1">
          {isRecorded && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Video className="h-4 w-4 text-blue-500" />
                </TooltipTrigger>
                <TooltipContent>Recording available</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {hasTranscript && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <FileText className="h-4 w-4 text-green-500" />
                </TooltipTrigger>
                <TooltipContent>Transcript available</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {hasChatMessages && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <MessageSquare className="h-4 w-4 text-purple-500" />
                </TooltipTrigger>
                <TooltipContent>{chatLog.length} chat messages</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )
    },
    enableSorting: false,
  },
  
]
