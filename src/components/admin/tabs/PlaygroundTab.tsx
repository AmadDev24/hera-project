import React, { useRef, useEffect } from 'react';
import { Play, Search, MessageSquare, FlaskConical, Code2 } from 'lucide-react';
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

const EXAMPLE_QUERIES = [
  'What are the YA 2025 individual income tax brackets?',
  'Maximum lifestyle relief claim for YA 2025?',
  'e-Filing deadline for Form BE in 2026?',
  'SME corporate tax rates Malaysia 2025?',
];

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

  const userCount      = messages.filter((m) => m.role === 'user').length;
  const assistantCount = messages.filter((m) => m.role === 'model').length;

  return (
    <div className="grid grid-cols-12 auto-rows-[80px] gap-3">

      {/* Main chat area will occupy left and center; right column shows active FAQs */}

      {/* Main chat area — 8 cols × 8 rows */}
      <BentoCard className="col-span-12 lg:col-span-8 row-span-8 flex flex-col p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/40 shrink-0 flex items-center gap-3">
          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <FlaskConical size={14} className="text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-foreground">Playground Sandbox</h2>
            <p className="text-[10px] text-muted-foreground">Live queries against the grounded chat API</p>
          </div>
          {messages.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">{messages.length} msgs</Badge>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12 text-muted-foreground">
              <MessageSquare size={32} className="text-muted-foreground/30 mb-3" />
              <p className="text-sm font-semibold text-foreground">Sandbox is empty</p>
              <p className="text-xs mt-1 max-w-xs">Pick an example query above or type one below to test the grounded API.</p>
            </div>
          ) : (
            messages.map((message) => {
              const isUser = message.role === 'user';
              return (
                <div key={message.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                  <div className={`px-3 py-2.5 rounded-xl max-w-[85%] text-xs border ${
                    isUser ? 'bg-muted border-border/40' : 'bg-card border-border/60'
                  }`}>
                    <span className="text-[8px] font-mono font-bold tracking-widest text-muted-foreground block mb-1">
                      {isUser ? 'SANDBOX USER' : 'GROUNDED RESPONSE'} &bull; {message.timestamp}
                    </span>
                    <div className="prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed">
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
              <div className="bg-card border border-border/60 rounded-xl px-4 py-3 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                  <span className="text-[9px] font-mono text-muted-foreground">Compiling citations...</span>
                </div>
                <div className="h-1.5 w-40 bg-muted rounded animate-pulse" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 p-3 border-t border-border/40 bg-card">
          {error && (
            <div className="mb-2 p-2.5 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive">
              {error}
            </div>
          )}
          <form onSubmit={onSubmit} className="flex items-center gap-2 bg-background border border-input rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-ring transition-all">
            <Search size={13} className="text-muted-foreground shrink-0" />
            {models.length > 0 && (
              <select
                value={selectedModel || ''}
                onChange={(e) => onModelChange && onModelChange(e.target.value)}
                className="hidden sm:inline-block bg-background border border-border/60 rounded px-2 py-1 text-xs mr-2"
                aria-label="Select model"
              >
                {models.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            )}
            <Input
              type="text"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="e.g. YA 2025 relief limits for dental fees..."
              disabled={isLoading}
              className="border-0 focus-visible:ring-0 bg-transparent h-8 text-xs shadow-none p-0"
            />
            <Button type="submit" size="sm" disabled={isLoading || !query.trim()} className="h-7 px-3 text-xs shrink-0">
              <Play size={10} fill="currentColor" className="mr-1" />Run
            </Button>
          </form>
        </div>
      </BentoCard>

      {/* Active FAQs panel — right column */}
      <BentoCard className="col-span-12 lg:col-span-4 row-span-8 flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <Code2 size={15} className="text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Active FAQs</h2>
        </div>
        <div className="space-y-3 flex-1 overflow-auto">
          {faqs.filter((f: any) => f.enabled).length === 0 ? (
            <p className="text-xs text-muted-foreground">No active FAQs available.</p>
          ) : (
            faqs.filter((f: any) => f.enabled).map((f: any) => (
              <div key={f.id} className="rounded-md border border-border/40 p-3 bg-muted/30">
                <p className="text-sm font-semibold text-foreground">{f.title || f.query}</p>
                <p className="text-xs text-muted-foreground mt-1">{(f.answer || '').slice(0, 180)}{(f.answer || '').length > 180 ? '...' : ''}</p>
              </div>
            ))
          )}
        </div>
      </BentoCard>

    </div>
  );
}