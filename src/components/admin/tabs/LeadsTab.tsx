import React, { useMemo } from 'react';
import {
  Users, Mail, Download, Trash2, UserPlus, TrendingUp, Clock, MessageSquare, Phone,
} from 'lucide-react';
import { BentoCard } from '../BentoCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lead, ChatSession } from '../../../types';

interface LeadsTabProps {
  leads: Lead[];
  isLiveFirebase: boolean;
  onDeleteLead: (id: string) => void;
  conversations?: ChatSession[];
}

export function LeadsTab({ leads, isLiveFirebase, onDeleteLead, conversations = [] }: LeadsTabProps) {
  const sortedLeads = useMemo(
    () => [...leads].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [leads],
  );

  const thisWeek = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return leads.filter((l) => new Date(l.timestamp).getTime() > weekAgo).length;
  }, [leads]);

  // Build userId → conversations map for stats
  const convsByUserId = useMemo(() => {
    const map: Record<string, ChatSession[]> = {};
    conversations.forEach((c) => {
      if (c.userId) {
        if (!map[c.userId]) map[c.userId] = [];
        map[c.userId].push(c);
      }
    });
    return map;
  }, [conversations]);

  const handleExportCSV = () => {
    const header = 'Name,Email,Phone,First Query,Source,Captured\n';
    const rows = sortedLeads.map((l) =>
      `"${l.name || ''}","${l.email || ''}","${l.phone || ''}","${(l.firstQuery || '').replace(/"/g, '""')}","${l.source}","${l.timestamp}"`,
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hasiltax-leads-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <BentoCard>
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Users size={17} />
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Total Leads</p>
          <p className="mt-0.5 text-3xl font-bold tracking-tight text-foreground tabular-nums">{leads.length}</p>
          {isLiveFirebase && <Badge className="mt-2 text-[10px] rounded-full">Live</Badge>}
        </BentoCard>

        <BentoCard>
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
            <UserPlus size={17} />
          </div>
          <p className="mt-4 text-xs text-muted-foreground">This Week</p>
          <p className="mt-0.5 text-3xl font-bold tracking-tight text-foreground tabular-nums">{thisWeek}</p>
          <p className="text-xs text-emerald-500 mt-1">+{thisWeek} new</p>
        </BentoCard>

        <BentoCard>
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
            <TrendingUp size={17} />
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Sources</p>
          <p className="mt-0.5 text-3xl font-bold tracking-tight text-foreground tabular-nums">
            {[...new Set(leads.map((l) => l.source))].length || '—'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">unique sources</p>
        </BentoCard>

        <BentoCard>
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
            <Clock size={17} />
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Latest Lead</p>
          <p className="mt-0.5 text-sm font-semibold text-foreground leading-snug">
            {sortedLeads[0]
              ? new Date(sortedLeads[0].timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
              : 'None yet'}
          </p>
          {sortedLeads[0] && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {new Date(sortedLeads[0].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </BentoCard>
      </div>

      {/* Leads table */}
      <BentoCard padding={false} className="overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">Captured Leads</h2>
            <Badge variant="secondary" className="text-xs">{leads.length}</Badge>
          </div>
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="h-7 px-3 text-xs gap-1.5 bg-card" disabled={leads.length === 0}>
            <Download size={11} /> Export CSV
          </Button>
        </div>

        {sortedLeads.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center px-6">
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
              <Mail size={22} className="text-muted-foreground/40" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">No leads captured yet</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                Leads appear here when chatbot users submit their name and contact.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-border/40">
                <tr className="text-left">
                  <th className="px-5 py-3 text-xs font-medium text-muted-foreground">Name / Contact</th>
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">First Query</th>
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Conversations</th>
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Last Chat</th>
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Captured</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {sortedLeads.map((lead) => {
                  const userConvs = lead.userId ? (convsByUserId[lead.userId] || []) : [];
                  const lastConv  = userConvs.sort((a, b) =>
                    new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime(),
                  )[0];
                  const requiresHelp = userConvs.some((c) => c.requiresHelp);

                  return (
                    <tr key={lead.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-start gap-2.5">
                          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                            {lead.email
                              ? <Mail size={11} className="text-primary" />
                              : <Phone size={11} className="text-primary" />
                            }
                          </div>
                          <div className="min-w-0">
                            {lead.name && (
                              <p className="text-xs font-medium text-foreground truncate">{lead.name}</p>
                            )}
                            <p className="text-[11px] text-muted-foreground truncate font-mono">
                              {lead.email || lead.phone || '—'}
                            </p>
                            {requiresHelp && (
                              <span className="inline-flex mt-0.5 rounded-full bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 text-[10px] font-medium text-red-600 dark:text-red-400">
                                Require Help
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground max-w-xs truncate hidden md:table-cell">
                        {lead.firstQuery || '—'}
                      </td>
                      <td className="px-4 py-3">
                        {userConvs.length > 0 ? (
                          <div className="flex items-center gap-1.5">
                            <MessageSquare size={12} className="text-muted-foreground" />
                            <span className="text-xs text-foreground font-medium">{userConvs.length}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[11px] font-mono text-muted-foreground">
                        {lastConv?.updatedAt
                          ? new Date(lastConv.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-[11px] font-mono text-muted-foreground">
                        {new Date(lead.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </td>
                      <td className="px-3 py-3">
                        <button
                          onClick={() => onDeleteLead(lead.id)}
                          className="p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </BentoCard>
    </div>
  );
}