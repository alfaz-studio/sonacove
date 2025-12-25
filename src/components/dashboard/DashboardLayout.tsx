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
} from 'lucide-react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/query-client';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
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
import SonacoveLogo from '../../assets/sonacove-orange.svg';
import Popup from '../Popup';
import { usePopup } from '../../hooks/usePopup';
import { useAuth } from '@/hooks/useAuth';
import { getGravatarUrl } from '../../utils/gravatar';
import LoginRequired from './LoginRequired';
import { getUserManager } from '@/utils/AuthService';
import { User as _User } from 'oidc-client-ts';

interface DashboardLayoutProps {}

type View = 'overview' | 'meetings' | 'users' | 'developer' | 'settings';

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

const DashboardLayout: React.FC<DashboardLayoutProps> = () => {
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const [activeView, setActiveView] = useState<View>('overview');
  
  // Get real auth data
  const { user: oidcUser, dbUser, logout, login } = useAuth();
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
      }
  }, []);

  useEffect(() => {
    if (dbUser && oidcUser) {
      const avatar = oidcUser.profile.picture || getGravatarUrl(dbUser.user.email);

      const realUser: User = {
        id: String(dbUser.user.id),
        name: oidcUser.profile.name || dbUser.user.email.split('@')[0],
        email: dbUser.user.email,
        role: 'owner', // Hardcode owner for now
        avatarUrl: avatar,
        joinedAt: dbUser.user.createdAt,
      };
      
      setActiveUser(realUser);
    } else {
      setActiveUser(null);
    }
  }, [dbUser, oidcUser]);

  // Navigation Items based on Role
  const getMainNavItems = (role: Role) => {
    const items = [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
      { id: 'meetings', label: 'Meetings', icon: Video },
    ];

    if (role === 'owner' || role === 'admin') {
      items.push({ id: 'users', label: 'Users', icon: Users });
    }

    return items;
  };

  const bottomNavItems = [
    { id: 'developer', label: 'Developer', icon: Code },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  // For guests, only show Overview in navigation
  const mainNavItems = activeUser ? getMainNavItems(activeUser.role) : [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  ];

  // For guests, only show Overview
  const guestNavItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  ];

  return (
    <QueryClientProvider client={queryClient}>
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
              <a href="/" className="flex items-center gap-2 overflow-hidden transition-all duration-300 hover:opacity-80">
                <img src={SonacoveLogo.src} alt="Sonacove" className="h-10 w-10 shrink-0" />
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
          )}
        </SidebarContent>

        {/* User Profile Footer or Sign In Button */}
        <SidebarFooter className="border-t border-sidebar-border">
          {activeUser ? (
            <SidebarMenu>
              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton
                      size="lg"
                      className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                    >
                      <Avatar className="h-12 w-12 rounded-lg">
                        <AvatarImage src={activeUser.avatarUrl} alt={activeUser.name} />
                        <AvatarFallback className="rounded-lg text-lg">{activeUser.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="grid flex-1 text-left text-lg leading-tight">
                        <span className="truncate font-semibold">{activeUser.name}</span>
                        <span className="truncate text-base text-muted-foreground capitalize">{activeUser.role}</span>
                      </div>
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                    side="top"
                    align="start"
                    sideOffset={4}
                  >
                    <DropdownMenuItem className="text-red-600 cursor-pointer" onClick={logout}>
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Log out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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
          {activeView === 'overview' && <OverviewView />}
          {activeView === 'meetings' && (activeUser ? <MeetingsView user={activeUser} /> : <LoginRequired />)}
          {activeView === 'users' && (activeUser ? <UsersView user={activeUser} /> : <LoginRequired />)}
          {activeView === 'developer' && <DeveloperView />}
          {activeView === 'settings' && (activeUser ? <SettingsView user={activeUser} /> : <LoginRequired />)}
        </main>
      </SidebarInset>
    </SidebarProvider>
    </QueryClientProvider>
  );
};

export default DashboardLayout;
