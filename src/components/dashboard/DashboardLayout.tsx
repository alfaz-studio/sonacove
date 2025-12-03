import React, { useState } from 'react';
import { USERS, type User, type Role } from '../../data/mock-dashboard';
import { 
  LayoutDashboard, 
  Video, 
  Users, 
  Settings, 
  Code, 
  LogOut,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
  SidebarTrigger,
} from '../ui/sidebar';
import OverviewView from './OverviewView';
import MeetingsView from './MeetingsView';
import UsersView from './UsersView';
import DeveloperView from './DeveloperView';
import SettingsView from './SettingsView';
import SonacoveLogo from '../../assets/sonacove-orange.svg';
import Popup from '../Popup';
import { usePopup } from '../../hooks/usePopup';

interface DashboardLayoutProps {}

type View = 'overview' | 'meetings' | 'users' | 'developer' | 'settings';

const DashboardLayout: React.FC<DashboardLayoutProps> = () => {
  // Demo State: Role Switcher - Select demo personas from actual users
  const owner = USERS.find(u => u.role === "owner") || USERS[0];
  const admin = USERS.find(u => u.role === "admin") || USERS[0];
  const teacher = USERS.find(u => u.role === "teacher") || USERS[0];
  const student = USERS.find(u => u.role === "student") || USERS[0];
  
  const demoPersonas = [owner, admin, teacher, student].filter(Boolean);
  
  const [activeUser, setActiveUser] = useState<User>(demoPersonas[0] || USERS[0]); // Default to Owner
  const [activeView, setActiveView] = useState<View>('overview');
  const { popup, hidePopup } = usePopup();

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

  const mainNavItems = getMainNavItems(activeUser.role);

  return (
    <>
      <Popup
        message={popup.message}
        type={popup.type}
        duration={popup.duration}
        onClose={hidePopup}
      />
      <SidebarProvider defaultOpen={true}>
      <Sidebar collapsible="none" className="border-r">
        {/* Logo Header */}
        <SidebarHeader className="p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <img src={SonacoveLogo.src} alt="Sonacove" className="h-8 w-8" />
            <span className="text-xl font-bold text-primary font-crimson">Sonacove</span>
          </div>
        </SidebarHeader>

        {/* Main Navigation */}
        <SidebarContent className="flex flex-col overflow-hidden">
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {mainNavItems.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      isActive={activeView === item.id}
                      onClick={() => setActiveView(item.id as View)}
                      tooltip={item.label}
                    >
                      <item.icon className="h-5 w-5" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Spacer to push bottom nav to footer */}
          <div className="flex-1" />

          {/* Bottom Navigation (Developer, Settings) */}
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
                      <item.icon className="h-5 w-5" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* User Profile / Role Switcher Footer */}
        <SidebarFooter className="border-t border-sidebar-border">
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarImage src={activeUser.avatarUrl} alt={activeUser.name} />
                      <AvatarFallback className="rounded-lg">{activeUser.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">{activeUser.name}</span>
                      <span className="truncate text-xs text-muted-foreground capitalize">{activeUser.role}</span>
                    </div>
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                  side="top"
                  align="start"
                  sideOffset={4}
                >
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    Switch Demo Persona
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {demoPersonas.map((u) => (
                    <DropdownMenuItem 
                      key={u.id} 
                      onClick={() => {
                        setActiveUser(u);
                        setActiveView('overview'); // Reset view on switch
                      }}
                      className={activeUser.id === u.id ? "bg-accent" : ""}
                    >
                      <Avatar className="h-6 w-6 mr-2">
                        <AvatarImage src={u.avatarUrl} />
                        <AvatarFallback>{u.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span>{u.name}</span>
                        <span className="text-xs text-muted-foreground capitalize">{u.role}</span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-red-600 cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      {/* Main Content */}
      <SidebarInset className="flex flex-col h-screen overflow-hidden">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-6">
          <SidebarTrigger className="-ml-1 md:hidden" />
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">
              Merhaba, {activeUser.name.split(' ')[0]}
            </h1>
            <p className="text-sm text-gray-500">
              Here's what's happening with your meetings.
            </p>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
          {activeView === 'overview' && <OverviewView user={activeUser} />}
          {activeView === 'meetings' && <MeetingsView user={activeUser} />}
          {activeView === 'users' && <UsersView user={activeUser} />}
          {activeView === 'developer' && <DeveloperView />}
          {activeView === 'settings' && <SettingsView user={activeUser} />}
        </main>
      </SidebarInset>
    </SidebarProvider>
    </>
  );
};

export default DashboardLayout;
