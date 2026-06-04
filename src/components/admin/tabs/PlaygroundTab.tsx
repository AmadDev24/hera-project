import React, { useRef, useEffect } from 'react';
import { Play, Search, MessageSquare, FlaskConical, Loader2 } from 'lucide-react';
import { BentoCard } from '../BentoCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Message, GroundingMetadata } from '../../../types';
import SourcesViewer from '../../SourcesViewer';
import Markdown from 'react-markdown';

interface PlaygroundTabProps {
  messages: Message[];
  query: string;
  onQueryChange: (q: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  error: string | null;
  faqs?: any[];
  models?: string[];
  selectedModel?: string | null;
  onModelChange?: (model: string) => void;
}

export function PlaygroundTab({
  messages,
  query,
  onQueryChange,
  onSubmit,
  isLoading,
  error,
  faqs = [],
  models = [],
  selectedModel = null,
  onModelChange,
}: PlaygroundTabProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const activeFaqs = faqs.filter((f: any) => f.enabled);

  return (
    <div className="grid lg:grid-cols-[1fr_280px] gap-4 min-h-[600px]">

      {/* Chat area */}
      <BentoCard padding={false} className="flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border/40 shrink-0 flex items-center gap-3">
          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <FlaskConical size={14} className="text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-foreground">Playground</h2>
            <p className="text-xs text-muted-foreground">Live test against the grounded API</p>
          </div>
          {messages.length > 0 && (
            <Badge variant="secondary" className="text-xs">{messages.length} messages</Badge>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/10">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12">
              <MessageSquare size={28} className="text-muted-foreground/30 mb-3" />
              <p className="text-sm font-semibold text-foreground">Playground is empty</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                Type a query below or click an FAQ on the right to test the grounded API.
              </p>
            </div>
          ) : (
            messages.map((message) => {
              const isUser = message.role === 'user';
              return (
                <div key={message.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                  <div className={`px-3.5 py-2.5 rounded-xl max-w-[85%] text-xs ${
                    isUser
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card border border-border/50 text-foreground'
                  }`}>
                    <span className="text-[10px] font-medium opacity-60 block mb-1">
                      {isUser ? 'You' : 'HERA'} · {message.timestamp}
                    </span>
                    <div className={`prose prose-sm max-w-none text-xs leading-relaxed ${isUser ? 'prose-invert' : 'dark:prose-invert'}`}>
                      <Markdown>{message.text}</Markdown>
                    </div>
                  </div>
                  {!isUser && (message.groundingMetadata as GroundingMetadata)?.groundingChunks && (
                    <div className="w-full mt-1.5 pl-1 max-w-[85%]">
                      <SourcesViewer chunks={(message.groundingMetadata as GroundingMetadata).groundingChunks!} />
                    </div>
                  )}
                </div>
              );
            })
          )}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-card border border-border/50 rounded-xl px-4 py-3 flex items-center gap-2">
                <Loader2 size={13} className="text-primary animate-spin" />
                <span className="text-xs text-muted-foreground">Querying grounded API…</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 p-4 border-t border-border/40">
          {error && (
            <div className="mb-3 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}
          <form onSubmit={onSubmit} className="flex items-center gap-2">
            {models.length > 0 && (
              <select
                value={selectedModel || ''}
                onChange={(e) => onModelChange && onModelChange(e.target.value)}
                className="hidden sm:block h-9 bg-background border border-border rounded-lg px-2 text-xs text-foreground shrink-0 max-w-[140px]"
                aria-label="Select model"
              >
                {models.map((m) => (
                  <option key={m} value={m}>{m.split('/').pop()}</option>
                ))}
              </select>
            )}
            <div className="relative flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                type="text"
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder="e.g. YA 2025 lifestyle relief limit…"
                disabled={isLoading}
                className="pl-8 h-9 text-xs"
              />
            </div>
            <Button type="submit" size="sm" disabled={isLoading || !query.trim()} className="h-9 px-4 text-xs shrink-0 gap-1.5">
              {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Play size={10} fill="currentColor" />}
              Run
            </Button>
          </form>
        </div>
      </BentoCard>

      {/* Active FAQs sidebar */}
      <BentoCard className="flex flex-col overflow-hidden">
        <h2 className="text-sm font-semibold text-foreground mb-1">Active FAQs</h2>
        <p className="text-xs text-muted-foreground mb-4">Click to load into sandbox</p>
        <div className="flex-1 overflow-y-auto space-y-2">
          {activeFaqs.length === 0 ? (
            <p className="text-xs text-muted-foreground">No active FAQs. Add FAQs in the FAQs tab.</p>
          ) : (
            activeFaqs.map((f: any) => (
              <button
                key={f.id}
                type="button"
                onClick={() => onQueryChange(f.query)}
                className="w-full text-left rounded-lg border border-border/40 bg-muted/20 hover:bg-primary/5 hover:border-primary/20 hover:text-primary px-3 py-2.5 transition-colors group"
              >
                <p className="text-xs font-medium text-foreground group-hover:text-primary line-clamp-2 leading-snug">{f.title || f.query}</p>
                {f.answer && (
                  <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">{f.answer.slice(0, 60)}…</p>
                )}
              </button>
            ))
          )}
        </div>
      </BentoCard>
    </div>
  );
}