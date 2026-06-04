import React, { useState, useEffect } from 'react';
import { Bell, Save, Copy, Check } from 'lucide-react';
import { BentoCard } from '../BentoCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { AlertConfig } from '../../../types';
import { RESEND_DASHBOARD_URL, RESEND_FIXED_VARIABLES } from '../../../lib/resend';

interface AlertsTabProps {
  alertConfig: AlertConfig;
  onAlertConfigChange: (config: AlertConfig) => void;
  isLiveFirebase: boolean;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${checked ? 'bg-primary' : 'bg-muted'}`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 mt-0.5 ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  );
}

export function AlertsTab({ alertConfig, onAlertConfigChange, isLiveFirebase }: AlertsTabProps) {
  const [draft, setDraft] = useState<AlertConfig>(alertConfig);
  const [copiedVar, setCopiedVar] = useState<string | null>(null);

  useEffect(() => { setDraft(alertConfig); }, [alertConfig]);

  const isResendConfigured = !!import.meta.env.VITE_RESEND_API_KEY;

  const handleCopy = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedVar(key);
      window.setTimeout(() => setCopiedVar(null), 1500);
    } catch {}
  };

  return (
    <div className="space-y-4 max-w-2xl">

      {/* Status card */}
      <BentoCard>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Bell size={16} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Email Alerts via Resend</p>
              <p className="text-xs text-muted-foreground mt-0.5">Receive notifications when events occur on the chatbot.</p>
            </div>
          </div>
          <Badge variant={draft.enabled ? 'default' : 'secondary'} className="text-xs shrink-0">
            {draft.enabled ? 'Active' : 'Disabled'}
          </Badge>
        </div>

        {!isResendConfigured && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Set <code className="font-mono">VITE_RESEND_API_KEY</code> in your .env file to enable email alerts.
            </p>
            <a href={RESEND_DASHBOARD_URL} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline shrink-0">
              Get Key →
            </a>
          </div>
        )}
      </BentoCard>

      {/* Enable + recipients */}
      <BentoCard className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Enable Alerts</p>
            <p className="text-xs text-muted-foreground mt-0.5">Master switch for all email notifications</p>
          </div>
          <Toggle checked={draft.enabled} onChange={() => setDraft({ ...draft, enabled: !draft.enabled })} />
        </div>

        <div className="border-t border-border/30 pt-4 space-y-1.5">
          <label className="text-xs font-medium text-foreground">Admin Recipients</label>
          <Input
            type="text"
            value={draft.adminEmails}
            onChange={(e) => setDraft({ ...draft, adminEmails: e.target.value })}
            placeholder="admin@example.com, manager@example.com"
            className="h-9 text-xs"
          />
          <p className="text-xs text-muted-foreground">Comma-separated email addresses</p>
        </div>
      </BentoCard>

      {/* Alert triggers */}
      <BentoCard className="space-y-1">
        <p className="text-sm font-medium text-foreground mb-3">Alert Triggers</p>
        {[
          { key: 'notifyOnLeads',           label: 'New Lead Captured',  desc: 'When a user submits their email' },
          { key: 'notifyOnNegativeRating',  label: 'Negative Rating',    desc: 'When a user rates a response as unhelpful' },
          { key: 'notifyOnNewConversation', label: 'New Conversation',   desc: 'When a new chat session is completed' },
        ].map((item) => (
          <div key={item.key} className="flex items-center justify-between rounded-lg border border-border/30 bg-muted/10 px-4 py-3">
            <div>
              <p className="text-xs font-medium text-foreground">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
            <Toggle
              checked={(draft as any)[item.key]}
              onChange={() => setDraft({ ...draft, [item.key]: !(draft as any)[item.key] })}
            />
          </div>
        ))}
      </BentoCard>

      {/* Lead welcome email */}
      <BentoCard>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-foreground">Send Welcome Email to Leads</p>
            <p className="text-xs text-muted-foreground mt-0.5">Automatically email new leads when they submit their address</p>
          </div>
          <Toggle
            checked={draft.sendLeadWelcomeEmail}
            onChange={() => setDraft({ ...draft, sendLeadWelcomeEmail: !draft.sendLeadWelcomeEmail })}
          />
        </div>
      </BentoCard>

      {/* Template IDs */}
      <BentoCard className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Resend Template IDs</p>
            <p className="text-xs text-muted-foreground mt-0.5">Optional — leave empty to use built-in templates.</p>
          </div>
          <a href={RESEND_DASHBOARD_URL} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
            Open Dashboard →
          </a>
        </div>

        <div className="space-y-3">
          {[
            { key: 'leadTemplateId', label: 'Lead Alert Template ID', placeholder: 'e.g. 8e1f3a2b-…' },
            { key: 'negativeRatingTemplateId', label: 'Negative Rating Template ID', placeholder: 'e.g. 3c9d7e1f-…' },
            { key: 'newConversationTemplateId', label: 'New Conversation Template ID', placeholder: 'e.g. 5a8b2c4d-…' },
            ...(draft.sendLeadWelcomeEmail ? [{ key: 'leadWelcomeTemplateId', label: 'Lead Welcome Email Template ID', placeholder: 'e.g. 7f2e4a6b-…' }] : []),
          ].map((field) => (
            <div key={field.key} className="space-y-1.5">
              <label className="text-xs text-muted-foreground">{field.label}</label>
              <Input
                value={(draft as any)[field.key]}
                onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })}
                placeholder={field.placeholder}
                className="h-8 text-xs font-mono"
              />
            </div>
          ))}
        </div>
      </BentoCard>

      {/* Variable reference */}
      <BentoCard className="space-y-4">
        <div>
          <p className="text-sm font-medium text-foreground">Template Variable Reference</p>
          <p className="text-xs text-muted-foreground mt-0.5">Use these exact variable names in your Resend template editor.</p>
        </div>
        <div className="space-y-3">
          {[
            { title: 'Lead Alert', vars: RESEND_FIXED_VARIABLES.leadAlert },
            { title: 'Negative Rating', vars: RESEND_FIXED_VARIABLES.negativeRating },
            { title: 'New Conversation', vars: RESEND_FIXED_VARIABLES.newConversation },
            { title: 'Lead Welcome', vars: RESEND_FIXED_VARIABLES.leadWelcome },
          ].map((group) => (
            <div key={group.title} className="rounded-lg border border-border/40 bg-muted/10 p-3 space-y-2">
              <p className="text-xs font-medium text-foreground">{group.title}</p>
              {Object.entries(group.vars).map(([name, desc]) => (
                <div key={name} className="flex items-center justify-between gap-3 rounded-md bg-background/60 px-3 py-2">
                  <div className="min-w-0">
                    <code className="text-xs font-mono text-primary">{name}</code>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{desc as string}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(name, `${group.title}-${name}`)}
                    className="shrink-0 inline-flex items-center gap-1 rounded border border-border/40 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {copiedVar === `${group.title}-${name}` ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} />}
                    {copiedVar === `${group.title}-${name}` ? 'Copied' : 'Copy'}
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      </BentoCard>

      <Button size="sm" onClick={() => onAlertConfigChange(draft)} className="h-9 text-xs gap-1.5 px-4">
        <Save size={12} /> Save Alert Settings
      </Button>
    </div>
  );
}