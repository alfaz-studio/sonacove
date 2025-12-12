"use client"

import type { ColumnDef } from "@tanstack/react-table"
import type { User } from "@/data/dashboard-types"
import { ArrowUpDown, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Mail } from "lucide-react"
import { Badge } from "@/components/ui/badge"
interface ColumnsProps {
  onRoleChange: (userId: string, newRole: User["role"]) => void
  onDelete: (userId: string) => void
  canManage?: boolean
}

export const createColumns = ({ onDelete, canManage = false }: ColumnsProps): ColumnDef<User>[] => [
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
  
  // User column
  {
    accessorKey: "name",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4"
        >
          User
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const user = row.original
      return (
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarImage src={user.avatarUrl} />
            <AvatarFallback>{(user.name || user.email).charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="font-medium">{user.name}</span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Mail className="h-3 w-3" /> {user.email}
            </span>
          </div>
        </div>
      )
    },
  },
  
  // Role column (read-only for now)
  {
    accessorKey: "role",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4"
        >
          Role
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const role = row.getValue("role") as User["role"]
      return <div className="capitalize">{role}</div>
    },
  },
  
  // Status column
  {
    accessorKey: "status",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4"
        >
          Status
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const status = (row.getValue("status") as "pending" | "active" | undefined) ?? "active"
      return (
        <Badge
          variant={status === "active" ? "default" : "secondary"}
          className={
            status === "pending"
              ? "bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-100"
              : ""
          }
        >
          {status === "pending" ? "Pending" : "Active"}
        </Badge>
      )
    },
  },
  
  // Joined Date column
  {
    accessorKey: "joinedAt",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4"
        >
          Joined Date
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const date = row.getValue("joinedAt") as string
      return <div>{date}</div>
    },
  },
  
  // Delete action column
  {
    id: "actions",
    header: () => <div className="text-right">Actions</div>,
    cell: ({ row }) => {
      const user = row.original
      if (!canManage) {
        return <div className="text-right text-muted-foreground text-sm">—</div>
      }
      return (
        <div className="text-right">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(user.id)
            }}
          >
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      )
    },
    enableSorting: false,
  },
]
