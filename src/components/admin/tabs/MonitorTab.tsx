import React, { useMemo } from 'react';
import {
  TrendingUp, MessageSquare, Users, CalendarDays,
  Activity, Download, ThumbsUp, ThumbsDown,
  AlertTriangle, WifiOff, KeyRound, Mail, DollarSign,
} from 'lucide-react';
import { BentoCard } from '../BentoCard';
import { AdminLineChart } from '../LineChart';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { type ModelInfo } from '../../../lib/gemini';

interface MonitorTabProps {
  analyticsLogs: any[];
  simulatedLogs: any[];
  isLiveFirebase: boolean;
  onSimulateTraffic: () => void;
  onResetAnalytics: () => void;
  conversations?: any[];
  leads?: any[];
  modelInfos?: ModelInfo[];
  modelsLoading?: boolean;
  selectedModel?: string | null;
}

function KpiCard({ icon, label, value, sub, color = 'bg-primary/10 text-primary' }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <BentoCard>
      <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${color}`}>
        {icon}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-3xl font-bold tracking-tight text-foreground tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </BentoCard>
  );
}

export function MonitorTab({
  analyticsLogs,
  simulatedLogs,
  isLiveFirebase,
  conversations = [],
  leads = [],
  modelInfos = [],
  modelsLoading = false,
  selectedModel = null,
}: MonitorTabProps) {

  const handleDownloadReport = () => {
    const allLogs = isLiveFirebase && analyticsLogs.length > 0 ? analyticsLogs : simulatedLogs;
    let csv = 'Report Type,Value\n';
    csv += `Generated At,${new Date().toISOString()}\n`;
    csv += `Total Queries,${allLogs.length}\n`;
    csv += `Total Conversations,${conversations.length}\n`;
    csv += `Total Leads,${leads.length}\n`;
    csv += `Data Source,${isLiveFirebase ? 'Firebase' : 'Sandbox'}\n\n\nQueries\n`;
    csv += 'Timestamp,Query,Cited Domains,Client\n';
    allLogs.forEach((log: any) => {
      csv += `"${log.timestamp}","${(log.query || '').replace(/"/g, '""')}","${(log.citedDomains || []).join('; ')}","${log.clientEmail || ''}"\n`;
    });
    csv += '\n\nConversations\nID,Title,Messages,Rating,Updated At\n';
    conversations.forEach((c: any) => {
      csv += `"${c.id}","${(c.title || '').replace(/"/g, '""')}",${(c.messages || []).length},"${c.rating || ''}","${c.updatedAt || ''}"\n`;
    });
    csv += '\n\nLeads\nEmail,First Query,Timestamp\n';
    leads.forEach((l: any) => {
      csv += `"${l.email}","${(l.firstQuery || '').replace(/"/g, '""')}","${l.timestamp || ''}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hera-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const activeLogs = isLiveFirebase && analyticsLogs.length > 0 ? analyticsLogs : simulatedLogs;

  const last7DaysData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getTime() - (6 - i) * 86400000);
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const dateISO = d.toISOString().split('T')[0];
      return {
        date: dateStr,
        Queries: activeLogs.filter((l) => l.timestamp?.split('T')[0] === dateISO).length,
        Conversations: conversations.filter((c: any) => c.updatedAt?.split('T')[0] === dateISO).length,
      };
    });
  }, [activeLogs, conversations]);

  const totalQueries = activeLogs.length;
  const totalConversations = conversations.length;
  const totalLeads = leads.length;
  const now24h = new Date(Date.now() - 86400000).toISOString();
  const activeToday = activeLogs.filter((l) => l.timestamp > now24h).length;

  const ratedConversations = conversations.filter((c: any) => c.rating);
  const positiveRatings = ratedConversations.filter((c: any) => c.rating === 'up').length;
  const negativeRatings = ratedConversations.filter((c: any) => c.rating === 'down').length;

  const queryCounters: Record<string, number> = {};
  activeLogs.forEach((log) => {
    const q = log.query?.toLowerCase().trim();
    if (q) queryCounters[q] = (queryCounters[q] || 0) + 1;
  });
  const topQueries = Object.entries(queryCounters).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const isGeminiConfigured = !!import.meta.env.VITE_GEMINI_API_KEY;
  const isResendConfigured  = !!import.meta.env.VITE_RESEND_API_KEY;

  const systemAlerts = [
    !isLiveFirebase && {
      icon: <WifiOff size={14} className="text-destructive shrink-0" />,
      title: 'Firebase not connected',
      desc: 'Running in Sandbox mode — data is not persisted. Configure VITE_FIREBASE_* environment variables.',
      variant: 'border-destructive/20 bg-destructive/5',
    },
    !isGeminiConfigured && {
      icon: <KeyRound size={14} className="text-amber-500 shrink-0" />,
      title: 'Gemini API key missing',
      desc: 'Set VITE_GEMINI_API_KEY in your .env file. The chatbot will fail to respond without it.',
      variant: 'border-amber-500/20 bg-amber-500/5',
    },
    !isResendConfigured && {
      icon: <Mail size={14} className="text-amber-500 shrink-0" />,
      title: 'Resend API key missing',
      desc: 'Set VITE_RESEND_API_KEY to enable email alerts for leads and ratings.',
      variant: 'border-amber-500/20 bg-amber-500/5',
    },
  ].filter(Boolean) as { icon: React.ReactNode; title: string; desc: string; variant: string }[];

  // Usage & cost section
  const activeModel = modelInfos.find((m) => m.name === selectedModel) ?? modelInfos[0] ?? null;
  let estimatedInputTokens = 0;
  let estimatedOutputTokens = 0;
  conversations.forEach((conv: any) => {
    (conv.messages || []).forEach((msg: any) => {
      const tokens = Math.round((msg.text || '').length / 4);
      if (msg.role === 'user') estimatedInputTokens += tokens;
      else estimatedOutputTokens += tokens;
    });
  });
  const inputCost  = activeModel?.inputPricePerMillion  != null ? (estimatedInputTokens  / 1_000_000) * activeModel.inputPricePerMillion  : null;
  const outputCost = activeModel?.outputPricePerMillion != null ? (estimatedOutputTokens / 1_000_000) * activeModel.outputPricePerMillion : null;
  const totalCost  = inputCost != null && outputCost != null ? inputCost + outputCost : null;
  const fmt      = (n: number) => n >= 1_000_000 ? `${(n/1_000_000).toFixed(2)}M` : n >= 1_000 ? `${Math.round(n/1_000)}K` : String(n);
  const fmtCost  = (c: number | null) => c == null ? '—' : c < 0.001 ? '<$0.001' : `$${c.toFixed(3)}`;

  return (
    <div className="space-y-5">

      {/* System health alerts */}
      {systemAlerts.length > 0 && (
        <div className="space-y-2">
          {systemAlerts.map((alert) => (
            <div key={alert.title} className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${alert.variant}`}>
              <div className="mt-0.5">{alert.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground">{alert.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{alert.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={15} className="text-primary" />
          <span className="text-sm font-semibold text-foreground">Overview</span>
          <Badge variant={isLiveFirebase ? 'default' : 'secondary'} className="text-[10px] rounded-full">
            {isLiveFirebase ? 'Live' : 'Sandbox'}
          </Badge>
        </div>
        <Button variant="outline" size="sm" onClick={handleDownloadReport} className="h-7 px-3 text-xs gap-1.5 bg-card">
          <Download size={11} /> Export Report
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={<TrendingUp size={17} />} label="Total Queries" value={totalQueries} sub="all time" />
        <KpiCard icon={<MessageSquare size={17} />} label="Conversations" value={totalConversations} sub="recorded" color="bg-blue-500/10 text-blue-500" />
        <KpiCard icon={<Users size={17} />} label="Leads Captured" value={totalLeads} sub="email signups" color="bg-emerald-500/10 text-emerald-500" />
        <KpiCard icon={<CalendarDays size={17} />} label="Active Today" value={activeToday} sub="queries in 24h" color="bg-amber-500/10 text-amber-500" />
      </div>

      {/* Chart + ratings */}
      <div className="grid lg:grid-cols-[3fr_2fr] gap-4">
        {/* Activity chart */}
        <BentoCard>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold text-foreground">Activity — Last 7 Days</h2>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary inline-block" />Queries</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Conversations</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mb-4">Daily query and conversation volume</p>
          <AdminLineChart
            labels={last7DaysData.map((d) => d.date)}
            yLabel="Count"
            series={[
              { key: 'queries', label: 'Queries', color: 'var(--color-primary, #dc2626)', values: last7DaysData.map((d) => d.Queries), valueFormatter: (v) => `${v} queries` },
              { key: 'conversations', label: 'Conversations', color: '#10b981', values: last7DaysData.map((d) => d.Conversations), valueFormatter: (v) => `${v} convos` },
            ]}
          />
        </BentoCard>

        {/* Response ratings */}
        <BentoCard className="flex flex-col">
          <h2 className="text-sm font-semibold text-foreground">Response Ratings</h2>
          <p className="text-xs text-muted-foreground mt-0.5 mb-5">User feedback on AI responses</p>
          {ratedConversations.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-xs text-muted-foreground">No ratings recorded yet.</p>
            </div>
          ) : (
            <div className="flex-1 space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-muted-foreground"><ThumbsUp size={12} className="text-emerald-500" /> Positive</span>
                  <span className="font-semibold text-foreground">{positiveRatings}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${ratedConversations.length > 0 ? (positiveRatings / ratedConversations.length) * 100 : 0}%` }} />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-muted-foreground"><ThumbsDown size={12} className="text-destructive" /> Negative</span>
                  <span className="font-semibold text-foreground">{negativeRatings}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-destructive rounded-full transition-all" style={{ width: `${ratedConversations.length > 0 ? (negativeRatings / ratedConversations.length) * 100 : 0}%` }} />
                </div>
              </div>
              <div className="pt-2 border-t border-border/30">
                <p className="text-xs text-muted-foreground">{ratedConversations.length} total ratings</p>
                {ratedConversations.length > 0 && (
                  <p className="text-xl font-bold text-foreground mt-1">
                    {Math.round((positiveRatings / ratedConversations.length) * 100)}% satisfaction
                  </p>
                )}
              </div>
            </div>
          )}
        </BentoCard>
      </div>

      {/* Top queries + recent activity */}
      <div className="grid lg:grid-cols-[3fr_2fr] gap-4">

        {/* Top queries */}
        <BentoCard className="flex flex-col">
          <h2 className="text-sm font-semibold text-foreground">Top Queries</h2>
          <p className="text-xs text-muted-foreground mt-0.5 mb-4">Most frequently asked questions</p>
          <div className="space-y-2">
            {topQueries.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No queries logged yet.</p>
            ) : (
              topQueries.map(([query, count], idx) => (
                <div key={query} className="flex items-center gap-3 rounded-lg border border-border/30 bg-muted/20 px-3 py-2.5">
                  <span className="text-xs font-mono font-bold text-muted-foreground w-5 shrink-0">{idx + 1}</span>
                  <p className="text-xs text-foreground flex-1 truncate">{query}</p>
                  <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground shrink-0">{count}×</span>
                </div>
              ))
            )}
          </div>
        </BentoCard>

        {/* Recent activity */}
        <BentoCard className="flex flex-col">
          <h2 className="text-sm font-semibold text-foreground">Recent Activity</h2>
          <p className="text-xs text-muted-foreground mt-0.5 mb-4">Latest queries</p>
          <div className="space-y-2">
            {activeLogs.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No activity yet.</p>
            ) : (
              activeLogs.slice(0, 8).map((log) => (
                <div key={log.id} className="flex items-start gap-2.5 rounded-lg border border-border/30 bg-muted/20 px-3 py-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                  <p className="text-xs text-foreground flex-1 line-clamp-1">{log.query}</p>
                  {log.timestamp && (
                    <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </BentoCard>
      </div>

      {/* Usage & cost */}
      {activeModel && (
        <BentoCard>
          <div className="flex items-center gap-2 mb-1">
            <DollarSign size={15} className="text-emerald-500" />
            <h2 className="text-sm font-semibold text-foreground">Estimated Usage & Spend</h2>
            <Badge variant="secondary" className="text-[10px] ml-auto font-mono">{activeModel.name}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mb-5">
            Based on {conversations.length} conversations · ~4 chars/token ·{' '}
            <a href="https://ai.google.dev/pricing" target="_blank" rel="noreferrer" className="underline hover:text-foreground">verify pricing</a>
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6">
            {/* Cost breakdown */}
            <div className="space-y-3">
              {[
                { label: 'Input tokens', tokens: estimatedInputTokens, cost: inputCost, color: 'bg-primary' },
                { label: 'Output tokens', tokens: estimatedOutputTokens, cost: outputCost, color: 'bg-violet-500' },
              ].map((row) => (
                <div key={row.label} className="rounded-lg border border-border/40 bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">{row.label}</p>
                  <p className="text-xl font-bold text-foreground tabular-nums mt-0.5">{fmt(row.tokens)}</p>
                  <p className="text-xs text-muted-foreground">Est. <span className="font-mono text-foreground">{fmtCost(row.cost)}</span></p>
                </div>
              ))}
              <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3">
                <p className="text-xs text-muted-foreground">Total estimated spend</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5">{fmtCost(totalCost)}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {activeModel.inputPricePerMillion != null
                    ? `$${activeModel.inputPricePerMillion}/M in · $${activeModel.outputPricePerMillion}/M out`
                    : 'Pricing unavailable'}
                </p>
              </div>
            </div>

            {/* Progress bars */}
            <div className="space-y-5 pt-1">
              {[
                { label: 'Input Token Usage', used: estimatedInputTokens, max: 1_000_000, color: 'bg-primary', barColor: 'bg-primary' },
                { label: 'Output Token Usage', used: estimatedOutputTokens, max: 500_000, color: 'bg-violet-500', barColor: 'bg-violet-500' },
              ].map((bar) => {
                const pct = Math.min((bar.used / bar.max) * 100, 100);
                return (
                  <div key={bar.label}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium text-foreground">{bar.label}</p>
                      <p className="text-[11px] font-mono text-muted-foreground">{fmt(bar.used)} / {fmt(bar.max)}</p>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div className={`h-full rounded-full ${bar.barColor} transition-all duration-700`} style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">{pct.toFixed(1)}% of reference baseline</p>
                  </div>
                );
              })}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-foreground">Estimated Spend</p>
                  <p className="text-[11px] font-mono text-muted-foreground">{fmtCost(totalCost)} / $1.00 ref</p>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${totalCost != null && totalCost > 0.8 ? 'bg-destructive' : totalCost != null && totalCost > 0.4 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(((totalCost ?? 0) / 1) * 100, 100)}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {totalCost != null ? `${((totalCost / 1) * 100).toFixed(2)}% of $1.00 reference` : 'Configure pricing to track spend'}
                </p>
              </div>
            </div>
          </div>
        </BentoCard>
      )}

    </div>
  );
}