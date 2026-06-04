import React, { useState, useMemo } from 'react';
import { Trash2, MessageSquare, X, Clock, User, Download, Search, Calendar, AlertCircle, UserCheck } from 'lucide-react';
import { BentoCard } from '../BentoCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ChatSession, Lead } from '../../../types';
import Markdown from 'react-markdown';

interface HistoryTabProps {
  conversations: ChatSession[];
  selectedConversation: ChatSession | null;
  onSelectConversation: (c: ChatSession) => void;
  onCloseConversation: () => void;
  onDeleteConversation: (id: string) => void;
  isLiveFirebase: boolean;
  onContinueConversation?: (c: ChatSession) => void;
  leads?: Lead[];
}

export function HistoryTab({
  conversations,
  selectedConversation,
  onSelectConversation,
  onCloseConversation,
  onDeleteConversation,
  isLiveFirebase,
  onContinueConversation,
  leads = [],
}: HistoryTabProps) {
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const handleExportCSV = () => {
    if (!selectedConversation) return;
    const header = 'Role,Message,Timestamp\n';
    const rows = (selectedConversation.messages ?? []).map((m) =>
      `"${m.role}","${m.text.replace(/"/g, '""').replace(/\n/g, ' ')}","${m.timestamp}"`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation-${selectedConversation.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Build userId → lead map for badge lookups
  const leadByUserId = useMemo(() => {
    const map: Record<string, Lead> = {};
    leads.forEach((l) => { if (l.userId) map[l.userId] = l; });
    return map;
  }, [leads]);

  // Client-side filtering
  const filteredConversations = useMemo(() => {
    const lowerSearch = search.toLowerCase().trim();
    return conversations.filter((conv) => {
      // Text search: title or linked lead name
      if (lowerSearch) {
        const lead = conv.userId ? leadByUserId[conv.userId] : null;
        const matchTitle = conv.title?.toLowerCase().includes(lowerSearch);
        const matchName  = lead?.name?.toLowerCase().includes(lowerSearch);
        if (!matchTitle && !matchName) return false;
      }
      // Date from filter
      if (dateFrom && conv.updatedAt) {
        if (new Date(conv.updatedAt) < new Date(dateFrom)) return false;
      }
      // Date to filter
      if (dateTo && conv.updatedAt) {
        const toEnd = new Date(dateTo);
        toEnd.setHours(23, 59, 59, 999);
        if (new Date(conv.updatedAt) > toEnd) return false;
      }
      return true;
    });
  }, [conversations, search, dateFrom, dateTo, leadByUserId]);

  if (!isLiveFirebase) {
    return (
      <BentoCard className="flex flex-col items-center justify-center text-center gap-4 py-16">
        <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
          <MessageSquare size={22} className="text-muted-foreground/50" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Firebase required</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            Connect a Firebase project to stream real conversation history from Firestore.
          </p>
        </div>
      </BentoCard>
    );
  }

  const totalMessages = conversations.reduce((s, c) => s + (c.messages?.length ?? 0), 0);

  return (
    <div className="space-y-4">

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: <MessageSquare size={16} />, label: 'Conversations', value: conversations.length, color: 'bg-primary/10 text-primary' },
          { icon: <User size={16} />, label: 'Total Messages', value: totalMessages, color: 'bg-blue-500/10 text-blue-500' },
          { icon: <Clock size={16} />, label: 'Avg per Session', value: conversations.length > 0 ? (totalMessages / conversations.length).toFixed(1) : '0', color: 'bg-emerald-500/10 text-emerald-500' },
          { icon: <AlertCircle size={16} />, label: 'Require Help', value: conversations.filter(c => c.requiresHelp).length, color: 'bg-red-500/10 text-red-500' },
        ].map((s) => (
          <BentoCard key={s.label}>
            <div className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${s.color}`}>
              {s.icon}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{s.label}</p>
            <p className="mt-0.5 text-2xl font-bold tracking-tight text-foreground tabular-nums">{s.value}</p>
          </BentoCard>
        ))}
      </div>

      {/* Search & filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or client name…"
            className="pl-8 h-8 text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <Calendar size={13} className="text-muted-foreground shrink-0" />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-8 bg-background border border-border rounded-lg px-2 text-xs text-foreground"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-8 bg-background border border-border rounded-lg px-2 text-xs text-foreground"
          />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="h-8 px-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              Clear
            </button>
          )}
        </div>
        <span className="text-xs text-muted-foreground shrink-0">{filteredConversations.length} results</span>
      </div>

      {/* Split panel */}
      <div className="grid lg:grid-cols-[1fr_2fr] gap-4 min-h-[520px]">

        {/* Conversation list */}
        <BentoCard padding={false} className="flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between shrink-0">
            <h2 className="text-sm font-semibold text-foreground">All Conversations</h2>
            <Badge variant="secondary" className="text-xs">{filteredConversations.length}</Badge>
          </div>
          {filteredConversations.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-6 text-center">
              <p className="text-xs text-muted-foreground">
                {conversations.length === 0 ? 'No conversations yet.' : 'No results match your search.'}
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto divide-y divide-border/30">
              {filteredConversations.map((conv) => {
                const isActive = selectedConversation?.id === conv.id;
                const lead     = conv.userId ? leadByUserId[conv.userId] : null;

                return (
                  <div
                    key={conv.id}
                    onClick={() => onSelectConversation(conv)}
                    className={`group flex items-start justify-between px-4 py-3 gap-2 cursor-pointer transition-colors ${
                      isActive ? 'bg-primary/8 border-l-2 border-primary' : 'hover:bg-muted/30'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{conv.title || 'Untitled'}</p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className="text-[11px] text-muted-foreground">{conv.messages?.length ?? 0} msg</span>
                        {conv.updatedAt && (
                          <span className="text-[11px] text-muted-foreground">
                            · {new Date(conv.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                        {/* Red badge: requires help */}
                        {conv.requiresHelp && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 text-[10px] font-medium text-red-600 dark:text-red-400">
                            Require Help
                          </span>
                        )}
                        {/* Green badge: known client name */}
                        {lead?.name && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 max-w-[80px] truncate">
                            {lead.name}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {onContinueConversation && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onContinueConversation(conv); }}
                          className="p-1 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                          title="Continue in Playground"
                        >
                          <MessageSquare size={12} />
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeleteConversation(conv.id); }}
                        className="p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </BentoCard>

        {/* Conversation detail */}
        {selectedConversation ? (
          <BentoCard padding={false} className="flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between shrink-0">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-foreground truncate">
                    {selectedConversation.title || 'Untitled'}
                  </h3>
                  {selectedConversation.requiresHelp && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 text-[10px] font-medium text-red-600 dark:text-red-400 shrink-0">
                      <AlertCircle size={9} /> Require Help
                    </span>
                  )}
                  {selectedConversation.userId && leadByUserId[selectedConversation.userId]?.name && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 shrink-0">
                      <UserCheck size={9} /> {leadByUserId[selectedConversation.userId].name}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selectedConversation.messages?.length ?? 0} messages
                  {selectedConversation.updatedAt && (
                    <> · {new Date(selectedConversation.updatedAt).toLocaleString()}</>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="sm" onClick={handleExportCSV} className="h-7 px-2 text-xs gap-1.5">
                  <Download size={12} /> CSV
                </Button>
                <Button variant="ghost" size="sm" onClick={onCloseConversation} className="h-7 w-7 p-0">
                  <X size={14} />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {(selectedConversation.messages ?? []).map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div key={msg.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                    <div className={`px-3.5 py-2.5 rounded-xl max-w-[85%] text-xs ${
                      isUser
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground border border-border/30'
                    }`}>
                      <span className="text-[10px] font-medium opacity-60 block mb-1">
                        {isUser ? 'User' : 'Assistant'} · {msg.timestamp}
                      </span>
                      <div className={`prose prose-sm max-w-none text-xs leading-relaxed ${isUser ? 'prose-invert' : 'dark:prose-invert'}`}>
                        <Markdown>{msg.text}</Markdown>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </BentoCard>
        ) : (
          <BentoCard className="flex flex-col items-center justify-center text-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
              <MessageSquare size={22} className="text-muted-foreground/40" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">No conversation selected</p>
              <p className="text-xs text-muted-foreground mt-1">Select a conversation from the list to inspect its messages.</p>
            </div>
          </BentoCard>
        )}
      </div>
    </div>
  );
}