import React, { useMemo } from 'react';
import {
  Users, Mail, Download, Trash2, Search, Calendar,
  UserPlus, TrendingUp, Clock, ExternalLink,
} from 'lucide-react';
import { BentoCard } from '../BentoCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lead } from '../../../types';

interface LeadsTabProps {
  leads: Lead[];
  isLiveFirebase: boolean;
  onDeleteLead: (id: string) => void;
}

export function LeadsTab({ leads, isLiveFirebase, onDeleteLead }: LeadsTabProps) {
  const sortedLeads = useMemo(
    () => [...leads].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [leads],
  );

  const thisWeek = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return leads.filter((l) => new Date(l.timestamp).getTime() > weekAgo).length;
  }, [leads]);

  const handleExportCSV = () => {
    const header = 'Email,First Query,Source,Timestamp\n';
    const rows = sortedLeads.map((l) =>
      `"${l.email}","${l.firstQuery.replace(/"/g, '""')}","${l.source}","${l.timestamp}"`,
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
    <div className="grid grid-cols-12 auto-rows-[80px] gap-3">

      {/* KPI — Total Leads */}
      <BentoCard className="col-span-6 lg:col-span-3 row-span-2 flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Users size={18} className="text-primary" />
          </div>
          <Badge variant="default" className="text-[9px] px-1.5 rounded-full font-mono">LIVE</Badge>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Total Leads</p>
          <p className="text-4xl font-bold text-foreground tabular-nums">{leads.length}</p>
        </div>
      </BentoCard>

      {/* KPI — This Week */}
      <BentoCard className="col-span-6 lg:col-span-3 row-span-2 flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <div className="h-9 w-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <UserPlus size={18} className="text-emerald-500" />
          </div>
          <span className="text-[9px] font-mono text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">+{thisWeek}w</span>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">This Week</p>
          <p className="text-4xl font-bold text-foreground tabular-nums">{thisWeek}</p>
        </div>
      </BentoCard>

      {/* KPI — Conversion Rate */}
      <BentoCard className="col-span-6 lg:col-span-3 row-span-2 flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <div className="h-9 w-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <TrendingUp size={18} className="text-blue-500" />
          </div>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Sources</p>
          <p className="text-lg font-bold text-foreground">{[...new Set(leads.map((l) => l.source))].length || '—'}</p>
        </div>
      </BentoCard>

      {/* KPI — Latest Lead */}
      <BentoCard className="col-span-6 lg:col-span-3 row-span-2 flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <div className="h-9 w-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <Clock size={18} className="text-amber-500" />
          </div>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Latest Lead</p>
          <p className="text-sm font-bold text-foreground truncate">
            {sortedLeads[0]
              ? new Date(sortedLeads[0].timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
              : 'None yet'}
          </p>
        </div>
      </BentoCard>

      {/* Leads Table — Full width */}
      <BentoCard className="col-span-12 row-span-10 flex flex-col p-0 overflow-hidden">
        {/* Toolbar */}
        <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">Captured Leads</h2>
            <Badge variant="secondary" className="text-[10px]">{leads.length}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCSV} className="h-7 px-2.5 text-[11px] bg-card" disabled={leads.length === 0}>
              <Download size={11} className="mr-1" /> Export CSV
            </Button>
          </div>
        </div>

        {/* Table */}
        {sortedLeads.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-6 text-center">
            <div>
              <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                <Mail size={24} className="text-muted-foreground/40" />
              </div>
              <p className="text-sm font-semibold text-foreground">No leads captured yet</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                Leads appear here when chatbot users submit their email via the "Save consultation" banner.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card/95 backdrop-blur-sm border-b border-border/40 z-10">
                <tr className="text-left text-[10px] text-muted-foreground uppercase tracking-wider">
                  <th className="px-4 py-2.5 font-semibold">Email</th>
                  <th className="px-4 py-2.5 font-semibold hidden md:table-cell">First Query</th>
                  <th className="px-4 py-2.5 font-semibold hidden lg:table-cell">Source</th>
                  <th className="px-4 py-2.5 font-semibold">Captured</th>
                  <th className="px-4 py-2.5 font-semibold w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {sortedLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Mail size={10} className="text-primary" />
                        </div>
                        {lead.email}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground max-w-xs truncate hidden md:table-cell">
                      {lead.firstQuery || '—'}
                    </td>
                    <td className="px-4 py-2.5 hidden lg:table-cell">
                      <Badge variant="secondary" className="text-[9px] px-1.5">{lead.source}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground font-mono text-[10px]">
                      {new Date(lead.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-2">
                      <button
                        onClick={() => onDeleteLead(lead.id)}
                        className="p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all cursor-pointer"
                        title="Delete lead"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </BentoCard>

    </div>
  );
}