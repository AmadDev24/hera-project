import React, { useState } from 'react';
import {
  BarChart3, MessageSquare, BookOpen, FlaskConical,
  Sparkles, LogOut, Sun, Moon, Settings, Bell,
  ChevronUp, Shield, Users,
} from 'lucide-react';
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarHeader,
  SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem,
  SidebarGroup, SidebarGroupLabel, SidebarGroupContent, SidebarRail,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { type AdminTab } from './AdminNav';
import { type Theme } from '../../hooks/useTheme';

interface AppSidebarProps {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  conversationCount: number;
  faqCount: number;
  currentUser: any;
  onLogout: () => void;
  theme: Theme;
  onToggleTheme: () => void;
}

const NAV_ITEMS: { tab: AdminTab; label: string; icon: React.ReactNode; description: string }[] = [
  { tab: 'monitor',    label: 'Dashboard',    icon: <BarChart3 size={16} />,    description: 'Analytics overview' },
  { tab: 'history',    label: 'Conversations',icon: <MessageSquare size={16} />, description: 'Chat history' },
  { tab: 'leads',      label: 'Leads',        icon: <Users size={16} />,        description: 'Captured emails' },
  { tab: 'faqs',       label: 'FAQs',         icon: <BookOpen size={16} />,     description: 'Manage FAQ cards' },
  { tab: 'playground', label: 'Playground',   icon: <FlaskConical size={16} />, description: 'Test the API' },
  { tab: 'alerts',     label: 'Email Alerts', icon: <Bell size={16} />,         description: 'Notification settings' },
  { tab: 'settings',   label: 'Settings',     icon: <Settings size={16} />,     description: 'Configure chatbot' },
];

export function AppSidebar({
  activeTab,
  onTabChange,
  conversationCount,
  faqCount,
  currentUser,
  onLogout,
  theme,
  onToggleTheme,
  leadCount = 0,
}: AppSidebarProps & { leadCount?: number }) {
  const email   = currentUser?.email ?? 'admin@hasil.gov.my';
  const name    = currentUser?.displayName ?? email.split('@')[0];
  const photo   = currentUser?.photoURL ?? '';
  const initials = name.substring(0, 2).toUpperCase();

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">

      {/* ── Brand header ─────────────────────────────────────── */}
      <SidebarHeader className="py-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="pointer-events-none select-none">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shrink-0 shadow-sm">
                <Sparkles size={15} />
              </div>
              <div className="flex flex-col leading-tight min-w-0">
                <span className="text-sm font-bold truncate">HERA</span>
                <span className="text-[10px] text-sidebar-foreground/50 tracking-wider uppercase font-mono">
                  Admin Console
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>

        {/* ── Main navigation ──────────────────────────────────── */}
        <SidebarGroup>
          <SidebarGroupLabel>Main Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const badge =
                  item.tab === 'history' ? conversationCount :
                  item.tab === 'faqs'    ? faqCount :
                  item.tab === 'leads'   ? leadCount : undefined;

                return (
                  <SidebarMenuItem key={item.tab}>
                    <SidebarMenuButton
                      isActive={activeTab === item.tab}
                      onClick={() => onTabChange(item.tab)}
                      tooltip={item.label}
                      className="cursor-pointer"
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                    {badge !== undefined && badge > 0 && (
                      <SidebarMenuBadge>{badge}</SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* ── User footer with dropdown ────────────────────────── */}
      <SidebarFooter className="border-t border-sidebar-border py-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    tooltip={email}
                    className="cursor-pointer w-full data-[popup-open]:bg-sidebar-accent data-[popup-open]:text-sidebar-accent-foreground"
                  >
                    <Avatar className="h-8 w-8 rounded-lg shrink-0 ring-2 ring-sidebar-border">
                      <AvatarImage src={photo} referrerPolicy="no-referrer" />
                      <AvatarFallback className="rounded-lg text-xs font-bold bg-primary/20 text-primary">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col leading-tight min-w-0 flex-1">
                      <span className="text-xs font-semibold truncate">{name}</span>
                      <span className="text-[10px] text-sidebar-foreground/50 truncate">{email}</span>
                    </div>
                    <ChevronUp size={14} className="ml-auto shrink-0 text-sidebar-foreground/40" />
                  </SidebarMenuButton>
                }
              />
              <DropdownMenuContent side="top" align="start" className="w-64 mb-1">
                {/* Profile info */}
                <div className="px-3 py-2.5 flex items-center gap-3 border-b border-border/40 mb-1">
                  <Avatar className="h-9 w-9 rounded-xl shrink-0">
                    <AvatarImage src={photo} referrerPolicy="no-referrer" />
                    <AvatarFallback className="rounded-xl text-sm font-bold bg-primary/20 text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{email}</p>
                    <Badge variant="secondary" className="text-[8px] mt-0.5 px-1.5 h-3.5 font-mono">ADMIN</Badge>
                  </div>
                </div>

                <DropdownMenuItem
                  onClick={onLogout}
                  className="cursor-pointer gap-2 text-destructive"
                >
                  <LogOut size={14} />
                  <span>Sign Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}