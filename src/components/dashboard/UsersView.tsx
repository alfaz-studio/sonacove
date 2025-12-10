"use client"

import React, { useState } from 'react';
import type { User, Role } from '@/data/dashboard-types';
import { USERS } from '@/data/dashboard-types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Plus, Shield, Search, X, Settings2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { UserDataTable } from './users/user-datatable';
import { createColumns } from './users/columns';
import { showPopup } from '../../utils/popupService';
import type { VisibilityState } from '@tanstack/react-table';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { useReactTable, getCoreRowModel } from '@tanstack/react-table';
import { useAuth } from '@/hooks/useAuth';
import LoginRequired from './LoginRequired';

interface UsersViewProps {
  user: User;
}

const UsersView: React.FC<UsersViewProps> = ({ user }) => {
  const { isLoggedIn } = useAuth();

  if (!isLoggedIn) {
    return (
      <LoginRequired 
        message="User Management" 
        description="You must be logged in to manage organization members and permissions." 
      />
    );
  }

  const [users, setUsers] = useState<User[]>(USERS);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<Role>('teacher');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  // Mock permission check
  if (user.role !== 'owner' && user.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center">
        <Shield className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold">Access Denied</h2>
        <p className="text-muted-foreground mt-2 max-w-md">
          You do not have permission to view this page. Only Organization Owners and Admins can manage users.
        </p>
      </div>
    );
  }

  const handleRoleChange = (userId: string, newRole: Role) => {
    setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
    showPopup('User role updated successfully', 'success');
  };

  const handleDeleteClick = (userId: string) => {
    setUserToDelete(userId);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (userToDelete) {
      setUsers(users.filter(u => u.id !== userToDelete));
      showPopup('User removed successfully', 'success');
      setUserToDelete(null);
      setIsDeleteDialogOpen(false);
    }
  };

  const handleAddUser = () => {
    // Validate email
    if (!newUserEmail || !newUserEmail.includes('@')) {
      setEmailError('Please enter a valid email address');
      return;
    }

    // Check if user already exists
    const existingUser = users.find(u => u.email.toLowerCase() === newUserEmail.toLowerCase());
    if (existingUser) {
      setEmailError('This user is already part of the organization');
      return;
    }

    // Add new user (in real app, this would send an invitation)
    const newUser: User = {
      id: `u${Date.now()}`,
      name: newUserEmail.split('@')[0], // Temporary name
      email: newUserEmail,
      role: newUserRole,
      joinedAt: new Date().toISOString().split('T')[0],
    };

    setUsers([...users, newUser]);
    showPopup(`Invitation sent to ${newUserEmail}`, 'success');
    
    // Reset form
    setNewUserEmail('');
    setNewUserRole('teacher');
    setEmailError(null);
    setIsAddUserOpen(false);
  };

  const columns = createColumns({
    onRoleChange: handleRoleChange,
    onDelete: handleDeleteClick,
  });

  // Create table instance for ColumnToggle
  const table = useReactTable({
    data: users,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const columnLabels: Record<string, string> = {
    select: "Select",
    name: "User",
    role: "Role",
    joinedAt: "Joined Date",
    actions: "Actions",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold">Organization Members</h2>
          <p className="text-sm text-muted-foreground">
            Manage users, roles, and access permissions.
          </p>
        </div>
        <Button className="gap-2 bg-primary-500 text-white hover:bg-primary-600" onClick={() => setIsAddUserOpen(true)}>
          <Plus className="h-4 w-4" /> Add User
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users, emails, roles..."
            className="pl-9 pr-9"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
          />
          {globalFilter && (
            <button 
              onClick={() => setGlobalFilter('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
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
      </div>

      {/* Data Table */}
      <UserDataTable
        columns={columns}
        data={users}
        globalFilter={globalFilter}
        onGlobalFilterChange={setGlobalFilter}
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={setColumnVisibility}
      />

      {/* Add User Dialog */}
      <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Invite a new member to your organization. They will receive an email to set up their account.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                placeholder="colleague@school.org"
                value={newUserEmail}
                onChange={(e) => {
                  setNewUserEmail(e.target.value);
                  setEmailError(null);
                }}
                className={emailError ? 'border-red-500' : ''}
              />
              {emailError && (
                <p className="text-sm text-red-500">{emailError}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Role</Label>
              <Select value={newUserRole} onValueChange={(value: Role) => setNewUserRole(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="student">Student</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button className="bg-gray-100 text-black border border-gray-200 hover:bg-gray-200" variant="outline" onClick={() => {
              setIsAddUserOpen(false);
              setNewUserEmail('');
              setEmailError(null);
            }}>
              Cancel
            </Button>
            <Button className="bg-primary-500 text-white hover:bg-primary-600" onClick={handleAddUser}>Send Invitation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this user from the organization? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setUserToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UsersView;

