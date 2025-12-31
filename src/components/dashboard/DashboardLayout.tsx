import React, { useState, useEffect } from 'react';
import type { Role } from '../../data/dashboard-types';
import { 
  LayoutDashboard, 
  Video, 
  Users, 
  Settings, 
  Code, 
  LogOut,
  ChevronLeft,
  ChevronRight,
  CreditCard,
} from 'lucide-react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/query-client';
import Avatar from '../Avatar';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarInset,
  useSidebar,
} from '../ui/sidebar';
import OverviewView from './OverviewView';
import MeetingsView from './MeetingsView';
import UsersView from './UsersView';
import DeveloperView from './DeveloperView';
import SettingsView from './SettingsView';
import PlanView from './PlanView';
import SonacoveLogo from '../../assets/sonacove-orange.svg';
import Popup from '../Popup';
import { usePopup } from '../../hooks/usePopup';
import { useAuth } from '@/hooks/useAuth';
import { getGravatarUrl } from '../../utils/gravatar';
import LoginRequired from './LoginRequired';
import { getUserManager } from '@/utils/AuthService';
import { User as _User } from 'oidc-client-ts';

type OrgResponse = {
  organization: {
    id: number;
    kcOrgId: string;
    name: string;
    alias: string;
    role: Role;
    members: any[];
  } | null;
};

interface DashboardLayoutProps {}

type View = 'overview' | 'meetings' | 'users' | 'plan' | 'developer' | 'settings';

interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl?: string;
  joinedAt: string;
}

// Renders an arrow that flips direction based on sidebar state
const CustomSidebarTrigger = () => {
  const { toggleSidebar, state } = useSidebar();

  return (
    <button
      onClick={toggleSidebar}
      className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-gray-100 hover:text-gray-900 h-7 w-7"
      title="Toggle Sidebar"
    >
      {state === 'expanded' ? (
        <ChevronLeft className="h-5 w-5" />
      ) : (
        <ChevronRight className="h-5 w-5" />
      )}
      <span className="sr-only">Toggle Sidebar</span>
    </button>
  );
};

// Inner layout that expects to be rendered inside a QueryClientProvider
const DashboardLayoutInner: React.FC = () => {
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const [activeView, setActiveView] = useState<View>('overview');

  // Get real auth data
  const { user: oidcUser, dbUser, logout, login, isAuthReady } = useAuth();
  const { popup, hidePopup } = usePopup();

  useEffect(() => {
      // @ts-ignore
      if (window.jitsiNodeAPI) {
          // @ts-ignore
          window.jitsiNodeAPI.ipc.on('auth-token-received', async (userJson: any) => {
              console.log("🔐 Tokens received from Browser!", userJson);

              try {
                  const user = _User.fromStorageString(JSON.stringify(userJson));

                  await getUserManager().storeUser(user);

                  console.log("✅ User stored successfully. Reloading...");

                  window.location.reload();
              } catch (e) {
                  console.error("❌ Failed to store user token:", e);
              }
          });

          // @ts-ignore
          window.jitsiNodeAPI.ipc.on('auth-logout-complete', async () => {
              console.log("🔓 Logout signal received!");
              
              // 1. Clear LocalStorage
              localStorage.clear();
              sessionStorage.clear();
              
              // 2. Remove user from OIDC manager
              await getUserManager().removeUser();
              
              // 3. Reload to show Login screen
              window.location.reload();
          });
      }
  }, []);

  useEffect(() => {
    if (!isAuthReady) {
      return;
    }
    
    if (dbUser && oidcUser) {
      const avatar =
        oidcUser.profile.picture || getGravatarUrl(dbUser.user.email);

      // Fetch organization to get actual role
      const fetchUserRole = async () => {
        try {
          const userManager = getUserManager();
          const oidcUserObj = await userManager.getUser();
          const token = oidcUserObj?.access_token;
          if (!token) {
            // No token, set default role (guest)
            const realUser: User = {
              id: String(dbUser.user.id),
              name: oidcUser.profile.name || dbUser.user.email.split('@')[0],
              email: dbUser.user.email,
              role: 'owner', // Default role when not in org
              avatarUrl: avatar,
              joinedAt: dbUser.user.createdAt,
            };
            setActiveUser(realUser);
            return;
          }

          const res = await fetch('/api/orgs/me', {
            headers: { Authorization: `Bearer ${token}` },
          });

          let userRole: Role = 'owner'; // Default role
          if (res.ok) {
            const data = (await res.json()) as OrgResponse;
            if (data.organization) {
              userRole = data.organization.role;
            }
          }

          const realUser: User = {
            id: String(dbUser.user.id),
            name: oidcUser.profile.name || dbUser.user.email.split('@')[0],
            email: dbUser.user.email,
            role: userRole,
            avatarUrl: avatar,
            joinedAt: dbUser.user.createdAt,
          };

          setActiveUser(realUser);
        } catch (err) {
          console.error('Failed to fetch user role:', err);
          // Fallback to default role on error
          const realUser: User = {
            id: String(dbUser.user.id),
            name: oidcUser.profile.name || dbUser.user.email.split('@')[0],
            email: dbUser.user.email,
            role: 'owner',
            avatarUrl: avatar,
            joinedAt: dbUser.user.createdAt,
          };
          setActiveUser(realUser);
        }
      };

      fetchUserRole();
    } else {
      setActiveUser(null);
    }
  }, [dbUser, oidcUser, isAuthReady]);

  // Navigation Items based on Role
  const getMainNavItems = (role: Role) => {
    const items = [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
      { id: 'meetings', label: 'Meetings', icon: Video },
      { id: 'users', label: 'Users', icon: Users },
    ];

    return items;
  };

  const bottomNavItems = [
    { id: 'plan', label: 'Plan & Billing', icon: CreditCard },
    { id: 'developer', label: 'Developer', icon: Code },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  // For guests, only show Overview in navigation
  const mainNavItems = activeUser
    ? getMainNavItems(activeUser.role)
    : [{ id: 'overview', label: 'Overview', icon: LayoutDashboard }];

  // For guests, only show Overview
  const guestNavItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  ];

  return (
    <>
      <Popup
        message={popup.message}
        type={popup.type}
        duration={popup.duration}
        onClose={hidePopup}
      />
      <SidebarProvider defaultOpen={true}>
        <Sidebar collapsible="offcanvas" className="border-r">
          {/* Logo Header */}
          <SidebarHeader className="p-5 border-b border-sidebar-border h-20 flex justify-center">
            <div className="flex items-center justify-between w-full">
              <a
                href="/"
                className="flex items-center gap-2 overflow-hidden transition-all duration-300 hover:opacity-80"
              >
                <img
                  src={SonacoveLogo.src}
                  alt="Sonacove"
                  className="h-10 w-10 shrink-0"
                />
                <span className="text-3xl font-bold text-primary font-crimson whitespace-nowrap">
                  Sonacove
                </span>
              </a>
            </div>
          </SidebarHeader>

          {/* Main Navigation */}
          <SidebarContent className="flex flex-col h-full">
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {(activeUser ? mainNavItems : guestNavItems).map((item) => (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        isActive={activeView === item.id}
                        onClick={() => setActiveView(item.id as View)}
                        tooltip={item.label}
                      >
                        <item.icon className="h-6 w-6" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Spacer to push bottom nav to footer */}
            <div className="flex-1" />

            {/* Bottom Navigation (Developer, Settings) - Only for logged in users */}
            {activeUser && (
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {bottomNavItems.map((item) => (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          isActive={activeView === item.id}
                          onClick={() => {
                            if (item.id === 'plan' && activeUser?.role !== 'owner') {
                              // Non-owners see an informational-only Plan & Billing message
                              setActiveView('plan');
                              return;
                            }
                            setActiveView(item.id as View);
                          }}
                          tooltip={item.label}
                        >
                          <item.icon className="h-6 w-6" />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </SidebarContent>

          {/* User Profile Footer or Sign In Button */}
          <SidebarFooter className="border-t border-sidebar-border">
            {!isAuthReady ? (
              <div className="p-4 text-sm text-muted-foreground">
                Checking session…
              </div>
            ) : activeUser ? (
              <SidebarMenu>
                <SidebarMenuItem>
                  <div className="flex items-start gap-3 p-3 w-full">
                    <Avatar
                      src={activeUser.avatarUrl}
                      alt={activeUser.name}
                      className="h-12 w-12 rounded-lg flex-shrink-0"
                      editable={true}
                      email={activeUser.email}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="grid text-left text-lg leading-tight">
                        <span className="truncate font-semibold">
                          {activeUser.name}
                        </span>
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-base text-muted-foreground capitalize">
                            {activeUser.role}
                          </span>
                          <button
                            onClick={logout}
                            className="text-sm text-red-600 hover:text-red-700 hover:underline transition-colors flex-shrink-0 group-data-[collapsible=icon]:hidden"
                            title="Log out"
                          >
                            Log out
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </SidebarMenuItem>
              </SidebarMenu>
            ) : (
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    size="lg"
                    onClick={login}
                    className="w-full"
                  >
                    <span>Sign In / Register</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            )}
          </SidebarFooter>
        </Sidebar>

        {/* Main Content */}
        <SidebarInset className="flex flex-col h-screen overflow-hidden">
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-6">
            <CustomSidebarTrigger />
            {activeUser && (
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-gray-900">
                  Merhaba, {activeUser.name.split(' ')[0]}
                </h1>
                <p className="text-base text-gray-500">
                  Here's what's happening with your meetings.
                </p>
              </div>
            )}
          </header>

          <main className="flex-1 overflow-y-auto p-6 bg-gray-50/50 text-xl">
            {!isAuthReady ? (
              <div className="space-y-4 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-1/3"></div>
                <div className="h-24 bg-gray-200 rounded"></div>
                <div className="h-24 bg-gray-200 rounded"></div>
              </div>
            ) : (
              <>
                {activeView === 'overview' && <OverviewView />}
                {activeView === 'meetings' &&
                  (activeUser ? (
                    <MeetingsView user={activeUser} />
                  ) : (
                    <LoginRequired />
                  ))}
                {activeView === 'users' &&
                  (activeUser ? (
                    <UsersView user={activeUser} />
                  ) : (
                    <LoginRequired />
                  ))}
                {activeView === 'plan' &&
                  (activeUser ? (
                    activeUser.role === 'owner' ? (
                      <PlanView />
                    ) : (
                      <div className="relative">
                        {/* Disabled content backdrop */}
                        <div className="opacity-60 pointer-events-none">
                          <PlanView />
                        </div>
                        {/* Centered notice overlay */}
                        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
                          <div className="space-y-4 rounded-lg border bg-white p-6 max-w-md mx-4 shadow-lg pointer-events-auto">
                            <h2 className="text-xl font-semibold">Plan &amp; Billing</h2>
                            <p className="text-base text-muted-foreground">
                              Your access is managed by your organization owner. You have
                              full access to Sonacove under your organization&apos;s plan.
                              Billing settings are only available to organization owners.
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  ) : (
                    <LoginRequired />
                  ))}
                {activeView === 'developer' && <DeveloperView />}
                {activeView === 'settings' &&
                  (activeUser ? (
                    <SettingsView user={activeUser} />
                  ) : (
                    <LoginRequired />
                  ))}
              </>
            )}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </>
  );
};

const DashboardLayout: React.FC<DashboardLayoutProps> = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <DashboardLayoutInner />
    </QueryClientProvider>
  );
};

export default DashboardLayout;
