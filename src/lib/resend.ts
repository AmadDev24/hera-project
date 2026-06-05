// Client-side Resend email integration via REST API
// API key should be restricted by domain in Resend dashboard

const RESEND_API_KEY = import.meta.env.VITE_RESEND_API_KEY || '';

interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}

interface SendTemplateParams {
  to: string | string[];
  templateId: string;
  variables: Record<string, string>;
  from?: string;
  replyTo?: string;
}

export const RESEND_FIXED_VARIABLES = {
  leadAlert: {
    lead_email: 'Lead email address',
    lead_query: 'First user query that generated the lead',
    lead_time: 'Lead capture time',
  },
  negativeRating: {
    rating_query: 'User query that received the negative rating',
    rating_value: 'Rating value (up/down)',
    rating_time: 'Rating timestamp',
  },
  newConversation: {
    conversation_title: 'Conversation title',
    conversation_message_count: 'Conversation message count',
    conversation_time: 'Conversation timestamp',
  },
  leadWelcome: {
    lead_email: 'Lead email address',
  },
} as const;

/**
 * Send an email via Resend REST API
 */
export async function sendEmail({ to, subject, html, from, replyTo }: SendEmailParams): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn('[Resend] API key not configured. Set VITE_RESEND_API_KEY in .env');
    return false;
  }

  const recipients = Array.isArray(to) ? to : [to];

  try {
    const body: Record<string, any> = {
      from: from || 'HERA Tax Assistant <onboarding@resend.dev>',
      to: recipients,
      subject,
      html,
    };
    if (replyTo) body.reply_to = replyTo;

    const response = await fetch('/api/resend/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error('[Resend] Failed to send email:', err);
      return false;
    }

    console.log('[Resend] Email sent to', recipients.join(', '));
    return true;
  } catch (error) {
    console.error('[Resend] Network error:', error);
    return false;
  }
}

/**
 * Send an email using a Resend template ID (designed in React Email / Resend dashboard)
 */
export async function sendTemplate({ to, templateId, variables, from, replyTo }: SendTemplateParams): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn('[Resend] API key not configured.');
    return false;
  }

  const recipients = Array.isArray(to) ? to : [to];

  try {
    const body: Record<string, any> = {
      from: from || 'HERA Tax Assistant <onboarding@resend.dev>',
      to: recipients,
      template: {
        id: templateId,
        variables: variables || {},
      },
    };
    if (replyTo) body.reply_to = replyTo;

    const response = await fetch('/api/resend/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error('[Resend] Template send failed:', err);
      return false;
    }

    console.log('[Resend] Template email sent to', recipients.join(', '));
    return true;
  } catch (error) {
    console.error('[Resend] Network error:', error);
    return false;
  }
}

/**
 * Send a fallback inline HTML email (when no template ID is configured)
 */

// ── Built-in fallback templates ──────────────────────────────────

export function adminLeadAlertHtml(leadEmail: string, firstQuery: string): string {
  return `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <h2 style="color:#2563eb;margin:0 0 12px;">🔔 New Lead Captured</h2>
      <p style="color:#334155;font-size:14px;">A new email lead was captured by the HERA chatbot.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:8px;background:#f1f5f9;font-weight:600;font-size:13px;">Email</td><td style="padding:8px;font-size:13px;">${leadEmail}</td></tr>
        <tr><td style="padding:8px;background:#f1f5f9;font-weight:600;font-size:13px;">First Query</td><td style="padding:8px;font-size:13px;">${firstQuery}</td></tr>
        <tr><td style="padding:8px;background:#f1f5f9;font-weight:600;font-size:13px;">Time</td><td style="padding:8px;font-size:13px;">${new Date().toLocaleString()}</td></tr>
      </table>
      <p style="color:#94a3b8;font-size:11px;margin-top:24px;">HERA Admin Alert System</p>
    </div>
  `;
}

export function leadWelcomeHtml(leadEmail: string): string {
  return `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f8fafc;">
      <div style="text-align:center;margin-bottom:24px;">
        <div style="display:inline-block;width:48px;height:48px;background:#2563eb;border-radius:12px;color:white;font-weight:bold;font-size:20px;line-height:48px;">H</div>
        <h1 style="color:#0f172a;font-size:20px;margin:12px 0 4px;">Welcome to HERA</h1>
        <p style="color:#64748b;font-size:13px;">Your Virtual Tax Consultant Assistant</p>
      </div>
      <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:24px;">
        <p style="color:#334155;font-size:14px;line-height:1.6;">Thank you for signing up! You'll receive updates when LHDN publishes new tax reliefs, deadline changes, or important announcements.</p>
        <p style="color:#334155;font-size:14px;line-height:1.6;">In the meantime, feel free to ask HERA any Malaysian tax questions at any time.</p>
      </div>
      <p style="color:#94a3b8;font-size:11px;text-align:center;margin-top:24px;">Powered by HERA • Grounded by hasil.gov.my</p>
    </div>
  `;
}

export function negativeRatingAlertHtml(query: string, rating: string): string {
  return `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <h2 style="color:#dc2626;margin:0 0 12px;">👎 Negative Rating Flagged</h2>
      <p style="color:#334155;font-size:14px;">A user flagged an AI response as unhelpful.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:8px;background:#fef2f2;font-weight:600;font-size:13px;">Query</td><td style="padding:8px;font-size:13px;">${query}</td></tr>
        <tr><td style="padding:8px;background:#fef2f2;font-weight:600;font-size:13px;">Rating</td><td style="padding:8px;font-size:13px;">${rating}</td></tr>
        <tr><td style="padding:8px;background:#fef2f2;font-weight:600;font-size:13px;">Time</td><td style="padding:8px;font-size:13px;">${new Date().toLocaleString()}</td></tr>
      </table>
      <p style="color:#94a3b8;font-size:11px;margin-top:24px;">HERA Admin Alert System</p>
    </div>
  `;
}

export function newConversationAlertHtml(title: string, messageCount: number): string {
  return `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <h2 style="color:#2563eb;margin:0 0 12px;">💬 New Conversation</h2>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:8px;background:#f1f5f9;font-weight:600;font-size:13px;">Topic</td><td style="padding:8px;font-size:13px;">${title}</td></tr>
        <tr><td style="padding:8px;background:#f1f5f9;font-weight:600;font-size:13px;">Messages</td><td style="padding:8px;font-size:13px;">${messageCount}</td></tr>
      </table>
      <p style="color:#94a3b8;font-size:11px;margin-top:24px;">HERA Admin Alert System</p>
    </div>
  `;
}

// ── Helper: parse comma-separated emails ──
export function parseEmails(emailStr: string): string[] {
  return emailStr
    .split(/[,;]+/)
    .map((e) => e.trim())
    .filter((e) => e.includes('@'));
}

// ── Helper: Resend dashboard URL ──
export const RESEND_DASHBOARD_URL = 'https://resend.com/emails';