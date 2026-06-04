import React, { useState, useEffect } from 'react';
import { Bell, Save } from 'lucide-react';
import { BentoCard } from '../BentoCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { AlertConfig } from '../../../types';
import { RESEND_DASHBOARD_URL } from '../../../lib/resend';

interface AlertsTabProps {
  alertConfig: AlertConfig;
  onAlertConfigChange: (config: AlertConfig) => void;
  isLiveFirebase: boolean;
}

export function AlertsTab({ alertConfig, onAlertConfigChange, isLiveFirebase }: AlertsTabProps) {
  const [draft, setDraft] = useState<AlertConfig>(alertConfig);

  useEffect(() => {
    setDraft(alertConfig);
  }, [alertConfig]);

  const isResendConfigured = !!import.meta.env.VITE_RESEND_API_KEY;

  return (
    <div className="space-y-4 max-w-3xl">

      {/* Header info card */}
      <BentoCard className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Bell size={14} className="text-primary" />
          <p className="text-xs font-semibold text-foreground">Email Alerts via Resend</p>
          <Badge variant={draft.enabled ? 'default' : 'secondary'} className="text-[9px] ml-auto">
            {draft.enabled ? '● Enabled' : '○ Disabled'}
          </Badge>
        </div>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Receive instant email notifications when events occur on the HERA chatbot. Powered by Resend API.
        </p>

        {/* Resend API key status inline */}
        {!isResendConfigured && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
            <span className="text-[10px] text-amber-600 dark:text-amber-400">
              ⚠️ Resend API key not configured — set <code className="font-mono">VITE_RESEND_API_KEY</code> in your .env file.
            </span>
            <a
              href={RESEND_DASHBOARD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-[10px] text-primary hover:underline shrink-0"
            >
              Get Key →
            </a>
          </div>
        )}
      </BentoCard>

      {/* Master toggle */}
      <BentoCard className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-foreground">Enable Alerts</p>
            <p className="text-[10px] text-muted-foreground">Master switch for all email notifications</p>
          </div>
          <button
            onClick={() => setDraft({ ...draft, enabled: !draft.enabled })}
            className={`w-10 h-5 rounded-full transition-colors cursor-pointer relative ${draft.enabled ? 'bg-primary' : 'bg-muted'}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${draft.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
      </BentoCard>

      {/* Admin recipients */}
      <BentoCard className="p-4 space-y-1.5">
        <label className="text-[10px] font-semibold text-foreground/80 uppercase tracking-wider">
          Admin Recipients (comma-separated)
        </label>
        <Input
          type="text"
          value={draft.adminEmails}
          onChange={(e) => setDraft({ ...draft, adminEmails: e.target.value })}
          placeholder="admin@example.com, manager@example.com"
          className="h-9 text-xs"
        />
        <p className="text-[9px] text-muted-foreground">
          Multiple emails separated by commas. Alert emails will be sent to all addresses.
        </p>
      </BentoCard>

      {/* Alert triggers */}
      <BentoCard className="p-4 space-y-2">
        <label className="text-[10px] font-semibold text-foreground/80 uppercase tracking-wider">
          Alert Triggers
        </label>
        {[
          { key: 'notifyOnLeads',            label: 'New Lead Captured',  desc: 'When a user submits their email' },
          { key: 'notifyOnNegativeRating',   label: 'Negative Rating',    desc: 'When a user rates a response as unhelpful' },
          { key: 'notifyOnNewConversation',  label: 'New Conversation',   desc: 'When a new chat conversation is completed' },
        ].map((item) => (
          <div key={item.key} className="flex items-center justify-between rounded-xl border border-border/30 bg-muted/10 px-4 py-2.5">
            <div>
              <p className="text-xs text-foreground">{item.label}</p>
              <p className="text-[10px] text-muted-foreground">{item.desc}</p>
            </div>
            <button
              onClick={() => setDraft({ ...draft, [item.key]: !(draft as any)[item.key] })}
              className={`w-10 h-5 rounded-full transition-colors cursor-pointer relative ${(draft as any)[item.key] ? 'bg-primary' : 'bg-muted'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${(draft as any)[item.key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        ))}
      </BentoCard>

      {/* Lead welcome email */}
      <BentoCard className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-foreground">Send Welcome Email to Leads</p>
            <p className="text-[10px] text-muted-foreground">Automatically email the lead when they submit their address</p>
          </div>
          <button
            onClick={() => setDraft({ ...draft, sendLeadWelcomeEmail: !draft.sendLeadWelcomeEmail })}
            className={`w-10 h-5 rounded-full transition-colors cursor-pointer relative ${draft.sendLeadWelcomeEmail ? 'bg-emerald-500' : 'bg-muted'}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${draft.sendLeadWelcomeEmail ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
      </BentoCard>

      {/* Resend Template IDs */}
      <BentoCard className="p-4 space-y-3 border-primary/20 bg-primary/5">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-semibold text-foreground/80 uppercase tracking-wider">
            Resend Template IDs
          </label>
          <a
            href={RESEND_DASHBOARD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-primary hover:underline flex items-center gap-1"
          >
            Open Resend Dashboard →
          </a>
        </div>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Design email templates in the <strong>Resend Template Editor</strong> (React Email).
          Paste the template IDs below. If left empty, built-in fallback templates will be used.
        </p>

        <div className="space-y-2">
          <div className="space-y-1">
            <label className="text-[10px] text-foreground/70">Lead Alert Template ID</label>
            <Input
              value={draft.leadTemplateId}
              onChange={(e) => setDraft({ ...draft, leadTemplateId: e.target.value })}
              placeholder="e.g. 8e1f3a2b-..."
              className="h-8 text-xs font-mono"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-foreground/70">Negative Rating Template ID</label>
            <Input
              value={draft.negativeRatingTemplateId}
              onChange={(e) => setDraft({ ...draft, negativeRatingTemplateId: e.target.value })}
              placeholder="e.g. 3c9d7e1f-..."
              className="h-8 text-xs font-mono"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-foreground/70">New Conversation Template ID</label>
            <Input
              value={draft.newConversationTemplateId}
              onChange={(e) => setDraft({ ...draft, newConversationTemplateId: e.target.value })}
              placeholder="e.g. 5a8b2c4d-..."
              className="h-8 text-xs font-mono"
            />
          </div>
          {draft.sendLeadWelcomeEmail && (
            <div className="space-y-1">
              <label className="text-[10px] text-foreground/70">Lead Welcome Email Template ID</label>
              <Input
                value={draft.leadWelcomeTemplateId}
                onChange={(e) => setDraft({ ...draft, leadWelcomeTemplateId: e.target.value })}
                placeholder="e.g. 7f2e4a6b-..."
                className="h-8 text-xs font-mono"
              />
            </div>
          )}
        </div>
      </BentoCard>

      {/* Resend API key status */}
      <BentoCard className="p-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold text-foreground mb-1">Resend API Key</p>
          <p className="text-[10px] text-muted-foreground">
            {isResendConfigured
              ? '✅ Key configured (VITE_RESEND_API_KEY)'
              : '⚠️ Not configured. Set VITE_RESEND_API_KEY in .env file.'}
          </p>
        </div>
        <a
          href={RESEND_DASHBOARD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-primary hover:underline shrink-0"
        >
          Get API Key →
        </a>
      </BentoCard>

      <Button
        size="sm"
        onClick={() => onAlertConfigChange(draft)}
        className="h-8 text-xs gap-1.5"
      >
        <Save size={12} /> Save Alert Settings
      </Button>
    </div>
  );
}