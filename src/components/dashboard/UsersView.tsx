"use client"

import React, { useEffect, useState } from 'react';
import type { User, Role } from '@/data/dashboard-types';
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
import { Plus, Search, X, Settings2 } from 'lucide-react';
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

type OrgMemberResponse = {
  id: number;
  userId: number;
  email: string;
  role: Role;
  joinedAt: string;
};

type OrgResponse = {
  organization: {
    id: number;
    kcOrgId: string;
    name: string;
    alias: string;
    role: Role;
    members: OrgMemberResponse[];
  } | null;
};

interface UsersViewProps {
  user: User;
}

const UsersView: React.FC<UsersViewProps> = ({ user }) => {
  const { isLoggedIn, getAccessToken } = useAuth();

  if (!isLoggedIn) {
    return (
      <LoginRequired 
        message="User Management" 
        description="You must be logged in to manage organization members and permissions." 
      />
    );
  }

  const [orgMembers, setOrgMembers] = useState<User[]>([]);
  const [orgMeta, setOrgMeta] = useState<{ id: number; name: string; role: Role } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<Role>('teacher');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [orgName, setOrgName] = useState('');

  const fetchOrg = async () => {
    const token = getAccessToken?.();
    if (!token) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/orgs/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || 'Failed to load organization');
      }
      const data = (await res.json()) as OrgResponse;
      if (!data.organization) {
        setOrgMeta(null);
        setOrgMembers([]);
      } else {
        setOrgMeta({
          id: data.organization.id,
          name: data.organization.name,
          role: data.organization.role,
        });
        const members = data.organization.members.map((m) => ({
          id: String(m.userId),
          name: m.email.split('@')[0],
          email: m.email,
          role: m.role,
          joinedAt: m.joinedAt?.split('T')[0] ?? '',
        }));
        setOrgMembers(members);
      }
    } catch (err) {
      console.error(err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load organization');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrg();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRoleChange = (userId: string, newRole: Role) => {
    // Role edits are not supported yet; keep placeholder for future roles.
    showPopup('Role updates are not available yet', 'info');
  };

  const handleDeleteClick = (userId: string) => {
    setUserToDelete(userId);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;
    const token = getAccessToken?.();
    if (!token) return;
    try {
      const res = await fetch('/api/orgs/members', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: userToDelete }),
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || 'Failed to remove user');
      }
      showPopup('User removed successfully', 'success');
      await fetchOrg();
    } catch (e) {
      console.error(e);
      showPopup('Failed to remove user', 'error');
    } finally {
      setUserToDelete(null);
      setIsDeleteDialogOpen(false);
    }
  };

  const handleAddUser = async () => {
    const token = getAccessToken?.();
    if (!token) {
      setEmailError('You must be logged in');
      return;
    }

    // Validate email
    if (!newUserEmail || !newUserEmail.includes('@')) {
      setEmailError('Please enter a valid email address');
      return;
    }

    try {
      const res = await fetch('/api/orgs/members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: newUserEmail,
          role: newUserRole,
        }),
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || 'Failed to add user');
      }
      showPopup(`Added ${newUserEmail} to the organization`, 'success');
      await fetchOrg();
    } catch (e) {
      console.error(e);
      showPopup('Failed to add user', 'error');
    }
    
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
    data: orgMembers,
    columns,
    state: {
      columnVisibility,
    },
    onColumnVisibilityChange: setColumnVisibility,
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
      {isLoading && (
        <div className="text-sm text-muted-foreground">Loading organization...</div>
      )}
      {loadError && (
        <div className="text-sm text-red-600">{loadError}</div>
      )}

      {!orgMeta && !isLoading && (
        <div className="space-y-4 rounded-lg border p-6">
          <h2 className="text-xl font-semibold">No organization yet</h2>
          <p className="text-muted-foreground text-sm">
            Create an organization to start adding members.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <Input
              placeholder="Organization name"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="max-w-sm"
            />
            <Button
              onClick={async () => {
                const token = getAccessToken?.();
                if (!token) return;
                if (!orgName.trim()) {
                  showPopup('Please enter an organization name', 'error');
                  return;
                }
                try {
                  const res = await fetch('/api/orgs', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ name: orgName.trim() }),
                  });
                  if (!res.ok) {
                    const msg = await res.text();
                    throw new Error(msg || 'Failed to create organization');
                  }
                  showPopup('Organization created', 'success');
                  setOrgName('');
                  await fetchOrg();
                } catch (e) {
                  console.error(e);
                  showPopup('Failed to create organization', 'error');
                }
              }}
              className="bg-primary-500 text-white hover:bg-primary-600"
            >
              Create Organization
            </Button>
          </div>
        </div>
      )}

      {orgMeta && (
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold">{orgMeta.name} Members</h2>
          <p className="text-sm text-muted-foreground">
            Manage users in your organization. Everyone is a teacher for now.
          </p>
        </div>
        {orgMeta.role === 'owner' && (
          <Button className="gap-2 bg-primary-500 text-white hover:bg-primary-600" onClick={() => setIsAddUserOpen(true)}>
            <Plus className="h-4 w-4" /> Add User
          </Button>
        )}
      </div>
      )}

      {orgMeta && (
      <>
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
          data={orgMembers}
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
      </>
      )}
    </div>
  );
};

export default UsersView;

