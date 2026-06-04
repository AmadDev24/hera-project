import React, { useMemo } from 'react';
import {
  TrendingUp, MessageSquare, Users, CalendarDays,
  Activity, Download, ThumbsUp, ThumbsDown,
  AlertTriangle, WifiOff, KeyRound, Mail,
} from 'lucide-react';
import { BentoCard } from '../BentoCard';
import { AdminLineChart } from '../LineChart';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface MonitorTabProps {
  analyticsLogs: any[];
  simulatedLogs: any[];
  isLiveFirebase: boolean;
  onSimulateTraffic: () => void;
  onResetAnalytics: () => void;
  conversations?: any[];
  leads?: any[];
}

export function MonitorTab({
  analyticsLogs,
  simulatedLogs,
  isLiveFirebase,
  conversations = [],
  leads = [],
}: MonitorTabProps) {

  const handleDownloadReport = () => {
    const allLogs = isLiveFirebase && analyticsLogs.length > 0 ? analyticsLogs : simulatedLogs;
    let csv = 'Report Type,Value\n';
    csv += `Generated At,${new Date().toISOString()}\n`;
    csv += `Total Queries,${allLogs.length}\n`;
    csv += `Total Conversations,${conversations.length}\n`;
    csv += `Total Leads,${leads.length}\n`;
    csv += `Data Source,${isLiveFirebase ? 'Firebase' : 'Sandbox'}\n`;
    csv += '\n\nQueries\n';
    csv += 'Timestamp,Query,Cited Domains,Client\n';
    allLogs.forEach((log: any) => {
      const domains = (log.citedDomains || []).join('; ');
      csv += `"${log.timestamp}","${(log.query || '').replace(/"/g, '""')}","${domains}","${log.clientEmail || ''}"\n`;
    });
    csv += '\n\nConversations\n';
    csv += 'ID,Title,Messages,Rating,Updated At\n';
    conversations.forEach((c: any) => {
      csv += `"${c.id}","${(c.title || '').replace(/"/g, '""')}",${(c.messages || []).length},"${c.rating || ''}","${c.updatedAt || ''}"\n`;
    });
    csv += '\n\nLeads\n';
    csv += 'Email,First Query,Timestamp\n';
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

  // 7-day chart data
  const last7DaysData = useMemo(() => {
    const days = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const dateISO = d.toISOString().split('T')[0];
      const queriesForDay = activeLogs.filter((log) => log.timestamp?.split('T')[0] === dateISO);
      const convosForDay = conversations.filter((c: any) => c.updatedAt?.split('T')[0] === dateISO);
      days.push({
        date: dateStr,
        Queries: queriesForDay.length,
        Conversations: convosForDay.length,
      });
    }
    return days;
  }, [activeLogs, conversations]);

  // KPI calculations
  const totalQueries = activeLogs.length;
  const totalConversations = conversations.length;
  const totalLeads = leads.length;

  // Active today (last 24h)
  const now24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const activeToday = activeLogs.filter((l) => l.timestamp > now24h).length;

  // Rating stats
  const ratedConversations = conversations.filter((c: any) => c.rating);
  const positiveRatings = ratedConversations.filter((c: any) => c.rating === 'up').length;
  const negativeRatings = ratedConversations.filter((c: any) => c.rating === 'down').length;

  // Top queries
  const queryCounters: Record<string, number> = {};
  activeLogs.forEach((log) => {
    const q = log.query?.toLowerCase().trim();
    if (q) queryCounters[q] = (queryCounters[q] || 0) + 1;
  });
  const topQueries = Object.entries(queryCounters).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const chartLabels = last7DaysData.map((d) => d.date);
  const queryValues = last7DaysData.map((d) => d.Queries);
  const convoValues = last7DaysData.map((d) => d.Conversations);

  const isGeminiConfigured = !!import.meta.env.VITE_GEMINI_API_KEY;
  const isResendConfigured  = !!import.meta.env.VITE_RESEND_API_KEY;

  const systemErrors = [
    !isLiveFirebase && {
      icon: <WifiOff size={14} className="text-red-500 shrink-0" />,
      title: 'Firebase not connected',
      desc: 'Running in Sandbox mode — data is not persisted. Configure VITE_FIREBASE_* environment variables to connect.',
      color: 'border-red-500/30 bg-red-500/5',
      titleColor: 'text-red-600 dark:text-red-400',
    },
    !isGeminiConfigured && {
      icon: <KeyRound size={14} className="text-amber-500 shrink-0" />,
      title: 'Gemini API key not configured',
      desc: 'The chatbot will fail to respond. Set VITE_GEMINI_API_KEY in your .env file. Users may see token limit or auth errors.',
      color: 'border-amber-500/30 bg-amber-500/5',
      titleColor: 'text-amber-600 dark:text-amber-400',
    },
    !isResendConfigured && {
      icon: <Mail size={14} className="text-amber-500 shrink-0" />,
      title: 'Resend API key not configured',
      desc: 'Email alerts will not be sent. Set VITE_RESEND_API_KEY in your .env file to enable lead and rating notifications.',
      color: 'border-amber-500/30 bg-amber-500/5',
      titleColor: 'text-amber-600 dark:text-amber-400',
    },
  ].filter(Boolean) as { icon: React.ReactNode; title: string; desc: string; color: string; titleColor: string }[];

  return (
    <div className="space-y-4">

      {/* ── System Health Alerts ── */}
      {systemErrors.length > 0 && (
        <div className="space-y-2">
          {systemErrors.map((err) => (
            <div
              key={err.title}
              className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${err.color}`}
            >
              <div className="mt-0.5">{err.icon}</div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-semibold ${err.titleColor}`}>{err.title}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{err.desc}</p>
              </div>
              <AlertTriangle size={12} className="text-muted-foreground/40 shrink-0 mt-0.5" />
            </div>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={15} className="text-primary" />
          <span className="text-sm font-semibold text-foreground">Dashboard</span>
          <Badge variant={isLiveFirebase ? 'default' : 'secondary'} className="text-[9px] px-1.5 rounded-full">
            {isLiveFirebase ? 'Online' : 'Offline'}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadReport} className="h-7 px-2.5 text-[11px] bg-card">
            <Download size={11} className="mr-1" />Report
          </Button>
        </div>
      </div>

      {/* ── KPI Grid ── */}
      <div className="grid grid-cols-12 auto-rows-[80px] gap-3">

        {/* KPI 1 — Total Queries */}
        <BentoCard className="col-span-6 lg:col-span-3 row-span-2 flex flex-col justify-between">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <TrendingUp size={18} className="text-primary" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Total Queries</p>
            <p className="text-4xl font-bold text-foreground tabular-nums">{totalQueries}</p>
            <p className="text-[10px] text-muted-foreground mt-1">all time</p>
          </div>
        </BentoCard>

        {/* KPI 2 — Conversations */}
        <BentoCard className="col-span-6 lg:col-span-3 row-span-2 flex flex-col justify-between">
          <div className="h-9 w-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <MessageSquare size={18} className="text-blue-500" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Conversations</p>
            <p className="text-4xl font-bold text-foreground tabular-nums">{totalConversations}</p>
            <p className="text-[10px] text-muted-foreground mt-1">recorded sessions</p>
          </div>
        </BentoCard>

        {/* KPI 3 — Leads */}
        <BentoCard className="col-span-6 lg:col-span-3 row-span-2 flex flex-col justify-between">
          <div className="h-9 w-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <Users size={18} className="text-emerald-500" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Leads Captured</p>
            <p className="text-4xl font-bold text-foreground tabular-nums">{totalLeads}</p>
            <p className="text-[10px] text-muted-foreground mt-1">email signups</p>
          </div>
        </BentoCard>

        {/* KPI 4 — Active Today */}
        <BentoCard className="col-span-6 lg:col-span-3 row-span-2 flex flex-col justify-between">
          <div className="h-9 w-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <CalendarDays size={18} className="text-amber-500" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Active Today</p>
            <p className="text-4xl font-bold text-foreground tabular-nums">{activeToday}</p>
            <p className="text-[10px] text-muted-foreground mt-1">queries in 24h</p>
          </div>
        </BentoCard>

        {/* Chart — Queries & Conversations — 8 cols × 4 rows */}
        <BentoCard className="col-span-12 lg:col-span-8 row-span-4">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold text-foreground">Activity (7 Days)</h2>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />Queries</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Conversations</span>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mb-3">Daily queries and recorded conversations</p>
          <AdminLineChart
            labels={chartLabels}
            yLabel="Count"
            series={[
              { key: 'queries', label: 'Queries', color: '#2563eb', values: queryValues, valueFormatter: (v) => `${v} queries` },
              { key: 'conversations', label: 'Conversations', color: '#10b981', values: convoValues, valueFormatter: (v) => `${v} convos` },
            ]}
          />
        </BentoCard>

        {/* Response Ratings — 4 cols × 4 rows */}
        <BentoCard className="col-span-12 lg:col-span-4 row-span-4 flex flex-col">
          <h2 className="text-sm font-semibold text-foreground mb-1">Response Ratings</h2>
          <p className="text-[10px] text-muted-foreground mb-4">User feedback on AI responses</p>
          {ratedConversations.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-xs text-muted-foreground text-center">No ratings yet.</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <ThumbsUp size={14} className="text-emerald-500" />
                  <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${ratedConversations.length > 0 ? (positiveRatings / ratedConversations.length) * 100 : 0}%` }} />
                  </div>
                  <span className="text-sm font-bold text-foreground tabular-nums w-8 text-right">{positiveRatings}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <ThumbsDown size={14} className="text-red-500" />
                  <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-red-500 rounded-full" style={{ width: `${ratedConversations.length > 0 ? (negativeRatings / ratedConversations.length) * 100 : 0}%` }} />
                  </div>
                  <span className="text-sm font-bold text-foreground tabular-nums w-8 text-right">{negativeRatings}</span>
                </div>
              </div>
              <div className="mt-auto">
                <p className="text-[10px] text-muted-foreground">
                  {ratedConversations.length} total ratings across {totalConversations} conversations
                </p>
                {ratedConversations.length > 0 && (
                  <p className="text-lg font-bold text-foreground mt-1">
                    {Math.round((positiveRatings / ratedConversations.length) * 100)}% satisfaction
                  </p>
                )}
              </div>
            </div>
          )}
        </BentoCard>

        {/* Top Queries — 6 cols × 4 rows */}
        <BentoCard className="col-span-12 lg:col-span-7 row-span-4 flex flex-col">
          <h2 className="text-sm font-semibold text-foreground mb-1">Top Queries</h2>
          <p className="text-[10px] text-muted-foreground mb-3">Most frequently asked questions</p>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {topQueries.length === 0 ? (
              <p className="text-xs text-muted-foreground">No queries logged yet.</p>
            ) : (
              topQueries.map(([query, count], idx) => (
                <div key={query} className="flex items-start gap-3 rounded-xl border border-border/40 bg-muted/20 px-3 py-2.5">
                  <span className="text-[10px] font-bold text-muted-foreground w-5 text-right shrink-0">{idx + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground line-clamp-1">{query}</p>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">{count}×</span>
                </div>
              ))
            )}
          </div>
        </BentoCard>

        {/* Recent Queries — 5 cols × 4 rows */}
        <BentoCard className="col-span-12 lg:col-span-5 row-span-4 flex flex-col">
          <h2 className="text-sm font-semibold text-foreground mb-1">Recent Activity</h2>
          <p className="text-[10px] text-muted-foreground mb-3">Latest queries</p>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {activeLogs.length === 0 ? (
              <p className="text-xs text-muted-foreground">No activity yet.</p>
            ) : (
              activeLogs.slice(0, 8).map((log) => (
                <div key={log.id} className="flex items-start gap-2 rounded-xl border border-border/40 bg-muted/20 px-3 py-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground line-clamp-1">{log.query}</p>
                  </div>
                  {log.timestamp && (
                    <span className="text-[9px] font-mono text-muted-foreground shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </BentoCard>

      </div>
    </div>
  );
}