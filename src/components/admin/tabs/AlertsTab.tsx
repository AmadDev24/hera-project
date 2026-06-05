import React, { useState, useEffect } from 'react';
import { Bell, Save, Send, Loader2 } from 'lucide-react';
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

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${checked ? 'bg-primary' : 'bg-muted'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 mt-0.5 ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  );
}

export function AlertsTab({ alertConfig, onAlertConfigChange, isLiveFirebase }: AlertsTabProps) {
  const [draft, setDraft] = useState<AlertConfig>(alertConfig);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => { setDraft(alertConfig); }, [alertConfig]);

  const hasLeadTemplateId = !!(draft.leadTemplateId && draft.leadTemplateId.trim());

  const handleSendTest = async () => {
    if (!hasLeadTemplateId || !draft.adminEmails?.trim()) return;

    setIsSendingTest(true);
    setTestResult(null);

    try {
      const recipients = draft.adminEmails
        .split(/[,;]+/)
        .map((e) => e.trim())
        .filter((e) => e.includes('@'));

      if (recipients.length === 0) {
        setTestResult({ success: false, message: 'No valid admin email recipients configured.' });
        return;
      }

      const apiKey = import.meta.env.VITE_RESEND_API_KEY || '';
      if (!apiKey) {
        setTestResult({ success: false, message: 'VITE_RESEND_API_KEY is not set in your .env file.' });
        return;
      }

      const body = {
        from: 'HERA Tax Assistant <onboarding@resend.dev>',
        to: recipients,
        template: {
          id: draft.leadTemplateId.trim(),
          variables: {
            lead_email: 'test@example.com',
            lead_query: 'This is a test lead alert from the admin dashboard.',
            lead_time: new Date().toLocaleString(),
          },
        },
      };

      const response = await fetch('/api/resend/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMsg = data?.message || data?.error?.message || data?.name || `HTTP ${response.status}: ${response.statusText}`;
        setTestResult({ success: false, message: `Resend API error: ${errorMsg}` });
      } else {
        setTestResult({ success: true, message: `Test email sent to ${recipients.join(', ')}` });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: `Network error: ${err.message || 'Could not reach the Resend API.'}` });
    } finally {
      setIsSendingTest(false);
      // Clear result after 8 seconds
      window.setTimeout(() => setTestResult(null), 8000);
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">

      {/* Header card */}
      <BentoCard>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Bell size={16} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Lead Alert Email</p>
              <p className="text-xs text-muted-foreground mt-0.5">Send email notifications when new leads are captured.</p>
            </div>
          </div>
          <Badge variant={hasLeadTemplateId && draft.notifyOnLeads ? 'default' : 'secondary'} className="text-xs shrink-0">
            {hasLeadTemplateId && draft.notifyOnLeads ? 'Active' : 'Disabled'}
          </Badge>
        </div>
      </BentoCard>

      {/* Lead Alert Template ID */}
      <BentoCard className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Lead Alert Template ID</p>
            <p className="text-xs text-muted-foreground mt-0.5">Enter the Resend template ID for lead alert emails.</p>
          </div>
          <a href={RESEND_DASHBOARD_URL} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
            Open Dashboard →
          </a>
        </div>

        <div className="space-y-1.5">
          <Input
            value={draft.leadTemplateId}
            onChange={(e) => setDraft({ ...draft, leadTemplateId: e.target.value })}
            placeholder="e.g. 8e1f3a2b-4c5d-6e7f-8a9b-0c1d2e3f4a5b"
            className="h-8 text-xs font-mono"
          />
        </div>

        {/* Admin Recipients — only shown when template ID is filled */}
        {hasLeadTemplateId && (
          <div className="border-t border-border/30 pt-4 space-y-1.5">
            <label className="text-xs font-medium text-foreground">Admin Recipients</label>
            <Input
              type="text"
              value={draft.adminEmails}
              onChange={(e) => setDraft({ ...draft, adminEmails: e.target.value })}
              placeholder="admin@example.com, manager@example.com"
              className="h-9 text-xs"
            />
            <p className="text-xs text-muted-foreground">Comma-separated email addresses that will receive lead alerts.</p>
          </div>
        )}
      </BentoCard>

      {/* Enable/disable toggle + Test button — only shown when template ID is filled */}
      {hasLeadTemplateId && (
        <BentoCard className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Enable Lead Alert Email</p>
              <p className="text-xs text-muted-foreground mt-0.5">Send an email alert to admin recipients when a new lead is captured.</p>
            </div>
            <Toggle
              checked={draft.notifyOnLeads}
              onChange={() => setDraft({ ...draft, notifyOnLeads: !draft.notifyOnLeads })}
            />
          </div>

          {/* Test button */}
          <div className="border-t border-border/30 pt-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-foreground">Send Test Email</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Send a test lead alert email using the configured template to verify your setup.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSendTest}
                disabled={isSendingTest || !draft.adminEmails?.trim()}
                className="h-8 text-xs gap-1.5 px-3 shrink-0"
              >
                {isSendingTest ? (
                  <>
                    <Loader2 size={12} className="animate-spin" /> Sending…
                  </>
                ) : (
                  <>
                    <Send size={12} /> Test
                  </>
                )}
              </Button>
            </div>

            {/* Test result feedback */}
            {testResult && (
              <div className={`mt-3 rounded-lg border px-3 py-2.5 text-xs ${
                testResult.success
                  ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400'
                  : 'border-red-500/20 bg-red-500/5 text-red-600 dark:text-red-400'
              }`}>
                {testResult.message}
              </div>
            )}
          </div>
        </BentoCard>
      )}

      {/* Complex-tax response customization */}
      <BentoCard className="space-y-4">
        <div>
          <p className="text-sm font-medium text-foreground">Specialist Tax Response</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Customize the message shown when the chatbot detects a complex tax query (e.g. transfer pricing, tax audit, mergers). The lead form will appear below this message.
          </p>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">English Response</label>
            <textarea
              value={draft.complexTaxResponseEn}
              onChange={(e) => setDraft({ ...draft, complexTaxResponseEn: e.target.value })}
              placeholder="This involves a specialist tax area that requires professional expertise..."
              rows={4}
              className="w-full min-w-0 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground px-3 py-2 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors resize-y"
            />
            <p className="text-[11px] text-muted-foreground">Supports markdown: **bold**, *italic*, line breaks.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Bahasa Malaysia Response</label>
            <textarea
              value={draft.complexTaxResponseBm}
              onChange={(e) => setDraft({ ...draft, complexTaxResponseBm: e.target.value })}
              placeholder="Soalan ini melibatkan topik cukai khusus yang memerlukan kepakaran profesional..."
              rows={4}
              className="w-full min-w-0 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground px-3 py-2 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors resize-y"
            />
            <p className="text-[11px] text-muted-foreground">Shown when the user's query is in Bahasa Malaysia.</p>
          </div>
        </div>
      </BentoCard>

      <Button size="sm" onClick={() => onAlertConfigChange(draft)} className="h-9 text-xs gap-1.5 px-4">
        <Save size={12} /> Save Alert Settings
      </Button>
    </div>
  );
}