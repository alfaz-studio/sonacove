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
  status?: "pending" | "active";
  invitedEmail?: string;
  invitedAt?: string;
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
  user?: User;
}

const UsersView: React.FC<UsersViewProps> = () => {
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
  const [newUserFirstName, setNewUserFirstName] = useState('');
  const [newUserLastName, setNewUserLastName] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [orgName, setOrgName] = useState('');
  const [orgDomain, setOrgDomain] = useState('');
  const [seatsUsed, setSeatsUsed] = useState<number | null>(null);
  const [seatsTotal, setSeatsTotal] = useState<number | null>(null);
  const [seatsAvailable, setSeatsAvailable] = useState<number | null>(null);
  const [hasOrgSubscription, setHasOrgSubscription] = useState<boolean | null>(null);

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
          status: m.status ?? 'active',
          joinedAt: m.joinedAt?.split('T')[0] ?? '',
        }));
        setOrgMembers(members);

        const subscription = (data.organization as any).subscription;
        if (subscription) {
          setSeatsUsed(subscription.seatsUsed ?? null);
          setSeatsTotal(subscription.seatsTotal ?? null);
          setSeatsAvailable(subscription.seatsAvailable ?? null);
        } else {
          setSeatsUsed(null);
          setSeatsTotal(null);
          setSeatsAvailable(null);
        }
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

  // Fetch subscription summary once to know if the user has an org-tier subscription
  useEffect(() => {
    const fetchSummary = async () => {
      const token = getAccessToken?.();
      if (!token) return;
      try {
        const res = await fetch('/api/subscriptions/summary', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          return;
        }
        const data = (await res.json()) as {
          orgSubscription: { status: string } | null;
        };
        setHasOrgSubscription(
          !!data.orgSubscription && data.orgSubscription.status === 'active',
        );
      } catch (e) {
        console.error('Failed to load subscription summary for org creation', e);
      }
    };
    fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRoleChange = (_userId: string, _newRole: Role) => {
    // Role edits are not supported yet; keep placeholder for future roles.
    showPopup('Role updates are not available yet', 'info');
  };

  const handleDeleteClick = (userId: string) => {
    const user = orgMembers.find((u) => u.id === userId);
    if (user) {
      setUserToDelete(user.email);
      setIsDeleteDialogOpen(true);
    }
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
        const data = (await res.json().catch(() => ({ error: 'Failed to remove user' }))) as { error?: string };
        const errorMsg = data.error || 'Failed to remove user';
        throw new Error(errorMsg);
      }
      showPopup('User removed successfully', 'success');
      await fetchOrg();
    } catch (e) {
      console.error(e);
      const errorMsg = e instanceof Error ? e.message : 'Failed to remove user';
      showPopup(errorMsg, 'error');
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
      const res = await fetch('/api/orgs/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: newUserEmail,
          firstName: newUserFirstName || undefined,
          lastName: newUserLastName || undefined,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({ error: 'Failed to invite user' }))) as { error?: string };
        const errorMsg = data.error || 'Failed to invite user';
        throw new Error(errorMsg);
      }
      showPopup(`Invitation sent to ${newUserEmail}`, 'success');
      await fetchOrg();
    } catch (e) {
      console.error(e);
      const errorMsg = e instanceof Error ? e.message : 'Failed to invite user';
      showPopup(errorMsg, 'error');
      setEmailError(errorMsg);
    }
    
    // Reset form
    setNewUserEmail('');
    setNewUserFirstName('');
    setNewUserLastName('');
    setEmailError(null);
    setIsAddUserOpen(false);
  };

  const columns = createColumns({
    onRoleChange: handleRoleChange,
    onDelete: handleDeleteClick,
    canManage: orgMeta?.role === 'owner',
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
    status: "Status",
    joinedAt: "Joined Date",
    actions: "Actions",
  };

  return (
    <div className="space-y-6">
      {isLoading && (
        <div className="text-base text-muted-foreground">Loading organization...</div>
      )}
      {loadError && (
        <div className="text-base text-red-600">{loadError}</div>
      )}

      {!orgMeta && !isLoading && (
        <div className="space-y-4 rounded-lg border p-6">
          <h2 className="text-xl font-semibold">No organization yet</h2>
          <p className="text-muted-foreground text-base">
            Create an organization to start adding members.
          </p>
          {hasOrgSubscription === false && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              Creating an organization requires an active Organization plan. Upgrade
              from the Plan &amp; Billing tab first, then return here to create your org.
            </p>
          )}
          <div className="flex flex-col gap-4 max-w-md">
            <div className="grid gap-2">
              <Label htmlFor="orgName">Organization name *</Label>
              <Input
                id="orgName"
                placeholder="My Organization"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="orgDomain">Domain name *</Label>
              <Input
                id="orgDomain"
                placeholder="example.com"
                value={orgDomain}
                onChange={(e) => setOrgDomain(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                The domain name must be unique and will be used to identify your organization.
              </p>
            </div>
            <Button
              onClick={async () => {
                const token = getAccessToken?.();
                if (!token) return;
                if (hasOrgSubscription === false) {
                  showPopup(
                    'Creating an organization requires the Organization plan. Please upgrade in the Plan & Billing tab first.',
                    'info',
                  );
                  return;
                }
                if (!orgName.trim()) {
                  showPopup('Please enter an organization name', 'error');
                  return;
                }
                if (!orgDomain.trim()) {
                  showPopup('Please enter a domain name', 'error');
                  return;
                }
                // Basic domain validation
                const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
                if (!domainRegex.test(orgDomain.trim())) {
                  showPopup('Please enter a valid domain name (e.g., example.com)', 'error');
                  return;
                }
                try {
                  const res = await fetch('/api/orgs', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ 
                      name: orgName.trim(),
                      domain: orgDomain.trim(),
                    }),
                  });
                  if (!res.ok) {
                    const errorData = (await res.json().catch(() => ({ error: 'Failed to create organization' }))) as { error?: string } | { error: string };
                    const errorMsg = errorData.error || 'Failed to create organization';
                    throw new Error(errorMsg);
                  }
                  showPopup('Organization created', 'success');
                  setOrgName('');
                  setOrgDomain('');
                  await fetchOrg();
                } catch (e) {
                  console.error(e);
                  const errorMsg = e instanceof Error ? e.message : 'Failed to create organization';
                  showPopup(errorMsg, 'error');
                }
              }}
              className="bg-primary-500 text-white hover:bg-primary-600 w-fit"
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
          <p className="text-base text-muted-foreground">
            Manage users in your organization. Invited users will appear as "Pending" until they accept.
          </p>
        </div>
        {orgMeta.role === 'owner' && (
          <Button
            className="gap-2 bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50"
            onClick={() => setIsAddUserOpen(true)}
            disabled={seatsAvailable !== null && seatsAvailable <= 0}
          >
            <Plus className="h-4 w-4" /> Invite User
          </Button>
        )}
      </div>
      )}

      {orgMeta && (
      <>
        {/* Seat usage & search */}
        <div className="flex flex-col gap-4">
          {seatsTotal !== null && (
            <div className="space-y-3">
              {seatsUsed !== null && seatsTotal !== null && seatsUsed > seatsTotal && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Your organization is using more seats than your current plan
                  includes. Remove members or increase seats from the Plan &amp;
                  Billing tab.
                </div>
              )}
              <div className="rounded-lg border bg-white px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Organization seats</p>
                  <p className="text-sm text-muted-foreground">
                    {seatsUsed ?? 0} of {seatsTotal} seats used
                    {seatsAvailable !== null && ` (${seatsAvailable} available)`}
                  </p>
                </div>
              </div>
            </div>
          )}

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
            <DialogTitle>Invite User</DialogTitle>
            <DialogDescription>
              Invite a new member to your organization. They will receive an email invitation to join.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email address *</Label>
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
                <p className="text-base text-red-500">{emailError}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="firstName">First name (optional)</Label>
              <Input
                id="firstName"
                placeholder="John"
                value={newUserFirstName}
                onChange={(e) => setNewUserFirstName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lastName">Last name (optional)</Label>
              <Input
                id="lastName"
                placeholder="Doe"
                value={newUserLastName}
                onChange={(e) => setNewUserLastName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button className="bg-gray-100 text-black border border-gray-200 hover:bg-gray-200" variant="outline" onClick={() => {
              setIsAddUserOpen(false);
              setNewUserEmail('');
              setNewUserFirstName('');
              setNewUserLastName('');
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

