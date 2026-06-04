import React from 'react';
import { BarChart3, CheckSquare, BookOpen, FlaskConical, MessageSquare, Users, Settings } from 'lucide-react';

export type AdminTab = 'monitor' | 'history' | 'faqs' | 'playground' | 'leads' | 'alerts' | 'settings';

const ITEMS: { tab: AdminTab; label: string; icon: React.ReactNode }[] = [
  {
    tab: 'monitor',
    label: 'Dashboard',
    icon: <BarChart3 size={16} />,
  },
  {
    tab: 'history',
    label: 'Conversation History',
    icon: <MessageSquare size={16} />,
  },
  {
    tab: 'leads',
    label: 'Leads Manager',
    icon: <Users size={16} />,
  },
  {
    tab: 'faqs',
    label: 'FAQs Editor',
    icon: <BookOpen size={16} />,
  },
  {
    tab: 'playground',
    label: 'Playground Tester',
    icon: <FlaskConical size={16} />,
  },
  {
    tab: 'settings',
    label: 'Settings',
    icon: <Settings size={16} />,
  },
];

interface AdminNavProps {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  conversationCount?: number;
  faqCount?: number;
  onNavigate?: () => void;
}

export function AdminNav({
  activeTab,
  onTabChange,
  conversationCount,
  faqCount,
  onNavigate,
}: AdminNavProps) {
  return (
    <nav className="space-y-1">
      {ITEMS.map((item) => {
        const active = activeTab === item.tab;
        const badge =
          item.tab === 'history' && conversationCount !== undefined
            ? conversationCount
            : item.tab === 'faqs' && faqCount !== undefined
            ? faqCount
            : undefined;

        return (
          <button
            key={item.tab}
            onClick={() => {
              onTabChange(item.tab);
              onNavigate?.();
            }}
            className={`w-full flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition text-left cursor-pointer ${
              active
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <span className="shrink-0">{item.icon}</span>
            <span className="flex-1">{item.label}</span>
            {badge !== undefined && (
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  active
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}