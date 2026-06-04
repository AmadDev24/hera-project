import React from 'react';
import { Trash2, MessageSquare, X, Clock, User, Download } from 'lucide-react';
import { BentoCard } from '../BentoCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChatSession } from '../../../types';
import Markdown from 'react-markdown';

interface HistoryTabProps {
  conversations: ChatSession[];
  selectedConversation: ChatSession | null;
  onSelectConversation: (c: ChatSession) => void;
  onCloseConversation: () => void;
  onDeleteConversation: (id: string) => void;
  isLiveFirebase: boolean;
  onContinueConversation?: (c: ChatSession) => void;
}

export function HistoryTab({
  conversations,
  selectedConversation,
  onSelectConversation,
  onCloseConversation,
  onDeleteConversation,
  isLiveFirebase,
  onContinueConversation,
}: HistoryTabProps) {

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

  if (!isLiveFirebase) {
    return (
      <div className="grid grid-cols-12 auto-rows-[80px] gap-3">
        <BentoCard className="col-span-12 row-span-3 flex flex-col items-center justify-center text-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center">
            <MessageSquare size={24} className="text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Firebase Required</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Connect a Firebase project to stream real conversation history from Firestore.
            </p>
          </div>
        </BentoCard>
      </div>
    );
  }

  const totalMessages = conversations.reduce((s, c) => s + (c.messages?.length ?? 0), 0);

  return (
    <div className="grid grid-cols-12 auto-rows-[80px] gap-3">

      {/* Stats strip — 4 cards × 1 row each */}
      <BentoCard className="col-span-6 lg:col-span-3 row-span-2 flex flex-col justify-between">
        <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
          <MessageSquare size={16} className="text-primary" />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Conversations</p>
          <p className="text-3xl font-bold text-foreground tabular-nums">{conversations.length}</p>
        </div>
      </BentoCard>

      <BentoCard className="col-span-6 lg:col-span-3 row-span-2 flex flex-col justify-between">
        <div className="h-8 w-8 rounded-xl bg-blue-500/10 flex items-center justify-center">
          <User size={16} className="text-blue-500" />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Total Messages</p>
          <p className="text-3xl font-bold text-foreground tabular-nums">{totalMessages}</p>
        </div>
      </BentoCard>

      <BentoCard className="col-span-6 lg:col-span-3 row-span-2 flex flex-col justify-between">
        <div className="h-8 w-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
          <Clock size={16} className="text-emerald-500" />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Avg Messages</p>
          <p className="text-3xl font-bold text-foreground tabular-nums">
            {conversations.length > 0 ? (totalMessages / conversations.length).toFixed(1) : '0'}
          </p>
        </div>
      </BentoCard>

      <BentoCard className="col-span-6 lg:col-span-3 row-span-2 flex flex-col justify-between">
        <div className="h-8 w-8 rounded-xl bg-amber-500/10 flex items-center justify-center">
          <MessageSquare size={16} className="text-amber-500" />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Selected</p>
          <p className="text-3xl font-bold text-foreground tabular-nums">
            {selectedConversation ? (selectedConversation.messages?.length ?? 0) : '—'}
          </p>
        </div>
      </BentoCard>

      {/* Conversation list — 4 cols × 8 rows */}
      <BentoCard className="col-span-12 lg:col-span-4 row-span-8 flex flex-col p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between shrink-0">
          <h2 className="text-sm font-semibold text-foreground">All Conversations</h2>
          <Badge variant="secondary" className="text-[10px]">{conversations.length}</Badge>
        </div>
        {conversations.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-6 text-center">
            <p className="text-xs text-muted-foreground">No conversations in Firestore yet.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto divide-y divide-border/30">
            {conversations.map((conv) => {
              const isActive = selectedConversation?.id === conv.id;
              return (
                <div
                  key={conv.id}
                  onClick={() => onSelectConversation(conv)}
                  className={`group flex items-start justify-between p-3 gap-2 cursor-pointer transition-colors ${
                    isActive ? 'bg-primary/8 border-l-2 border-primary' : 'hover:bg-muted/40'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{conv.title || 'Untitled'}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                      <span>{conv.messages?.length ?? 0} msgs</span>
                      {conv.updatedAt && (
                        <span>{new Date(conv.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteConversation(conv.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all cursor-pointer"
                  >
                    <Trash2 size={12} />
                  </button>
                  {onContinueConversation && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onContinueConversation(conv); }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-muted-foreground hover:bg-muted/20 ml-2 transition-all cursor-pointer"
                      title="Continue in Playground"
                    >
                      <MessageSquare size={12} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </BentoCard>

      {/* Conversation detail — 8 cols × 8 rows */}
      {selectedConversation ? (
        <BentoCard className="col-span-12 lg:col-span-8 row-span-8 flex flex-col p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between shrink-0">
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-foreground truncate">
                {selectedConversation.title || 'Untitled Conversation'}
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {selectedConversation.messages?.length ?? 0} messages
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="sm" onClick={handleExportCSV} className="h-7 px-2 text-[10px] gap-1" title="Export as CSV">
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
                  <div className={`px-3 py-2.5 rounded-xl max-w-[85%] text-xs border ${
                    isUser ? 'bg-muted border-border/40' : 'bg-card border-border/60'
                  }`}>
                    <span className="text-[8px] font-mono font-bold tracking-widest text-muted-foreground block mb-1">
                      {isUser ? 'USER' : 'ASSISTANT'} &bull; {msg.timestamp}
                    </span>
                    <div className="prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed">
                      <Markdown>{msg.text}</Markdown>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </BentoCard>
      ) : (
        <BentoCard className="col-span-12 lg:col-span-8 row-span-8 flex flex-col items-center justify-center text-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center">
            <MessageSquare size={24} className="text-muted-foreground/40" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">No conversation selected</p>
            <p className="text-xs text-muted-foreground mt-1">Click any conversation on the left to inspect its messages.</p>
          </div>
        </BentoCard>
      )}

    </div>
  );
}