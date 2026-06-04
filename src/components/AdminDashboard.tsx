import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db, isFirebaseAvailable } from '../lib/firebase';
import {
  onSnapshot, collection, query, orderBy, limit,
  setDoc, deleteDoc, doc,
} from 'firebase/firestore';
import { ChatSession, Message, GroundingMetadata, Lead, BrandingConfig, SystemPromptConfig, AuditEntry, AlertConfig } from '../types';
import { Sun, Moon, Code2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator, BreadcrumbLink,
} from '@/components/ui/breadcrumb';
import { Separator } from '@/components/ui/separator';
import { AppSidebar } from './admin/AppSidebar';
import { type AdminTab } from './admin/AdminNav';
import { streamGroundedResponse, DEFAULT_SYSTEM_PROMPT, DEFAULT_MODELS } from '../lib/gemini';
import { sendEmail, sendTemplate, parseEmails, adminLeadAlertHtml, negativeRatingAlertHtml, newConversationAlertHtml } from '../lib/resend';
import { MonitorTab } from './admin/tabs/MonitorTab';
import { HistoryTab } from './admin/tabs/HistoryTab';
import { FaqsTab, type Faq } from './admin/tabs/FaqsTab';
import { PlaygroundTab } from './admin/tabs/PlaygroundTab';
import { LeadsTab } from './admin/tabs/LeadsTab';
import { SettingsTab } from './admin/tabs/SettingsTab';
import { AlertsTab } from './admin/tabs/AlertsTab';
import { useTheme } from '../hooks/useTheme';

interface AdminDashboardProps {
  onLogout: () => void;
  currentUser: any;
  onNavigateToEmbed: () => void;
}

const PAGE_META: Record<AdminTab, { title: string; description: string }> = {
  monitor:    { title: 'Dashboard',          description: 'Live analytics, traffic trends and compliance metrics.' },
  history:    { title: 'Conversations',      description: 'Inspect and manage stored user conversations.' },
  leads:      { title: 'Leads Manager',      description: 'View and export captured email leads from the chatbot.' },
  faqs:       { title: 'FAQs',              description: 'Create and organise FAQ shortcuts in the chatbot.' },
  playground: { title: 'Playground',        description: 'Test queries against the live grounded API.' },
  alerts:     { title: 'Email Alerts',       description: 'Configure email notifications for leads, ratings, and conversations.' },
  settings:   { title: 'Settings',          description: 'Configure chatbot prompts, branding, embed code, and more.' },
};

export default function AdminDashboard({ onLogout, currentUser, onNavigateToEmbed }: AdminDashboardProps) {
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<AdminTab>('monitor');
  const [showEmbedPreview, setShowEmbedPreview] = useState(false);

  const [analyticsLogs, setAnalyticsLogs]           = useState<any[]>([]);
  const [conversations, setConversations]           = useState<ChatSession[]>([]);
  const [faqs, setFaqs]                             = useState<any[]>([]);
  const [isLiveFirebase, setIsLiveFirebase]         = useState(false);
  const [isInitializingFaqs, setIsInitializingFaqs] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<ChatSession | null>(null);

  // Leads state
  const [leads, setLeads] = useState<Lead[]>([]);

  // Settings state
  const [branding, setBranding] = useState<BrandingConfig>({
    primaryColor: '#2563eb',
    welcomeTitle: 'Ask a taxation question!',
    welcomeSubtitle: 'Grounded exclusively with HASiL registry.',
    disclaimerText: '⛔ Cites official LHDN sources. Keep receipts 7 years.',
    logoLetter: 'H',
  });
  const [prompts, setPrompts] = useState<SystemPromptConfig[]>([
    {
      id: 'prompt_default',
      label: 'Individual Tax Advisor',
      prompt: "You are 'HERA', an exceptionally friendly, professional, and reasonable virtual Tax Consultant Assistant specializing in Malaysian Taxation. Your target audience consists of standard individual taxpayers, expatriates, and business owners looking for compliant answers from LHDN (Lembaga Hasil Dalam Negeri).\n\nABSOLUTE GROUNDING RULE — NON-NEGOTIABLE:\n• EVERY search query you issue MUST begin with 'site:hasil.gov.my' as the first term. No exceptions.\n• You may ONLY cite, reference, and use information from the domain 'hasil.gov.my' and its subpages.\n• NEVER search or cite any other website, even if hasil.gov.my doesn't have the information.\n• NEVER include results from .gov.my domains other than hasil.gov.my.\n\nIMPORTANT — ALWAYS TRY TO ANSWER:\n• For ANY question about Malaysian taxation, income, reliefs, deductions, corporate tax, personal tax, filing, deadlines, GST, SST, withholding tax, foreign income, dividends, capital gains — you MUST attempt to search hasil.gov.my and provide an answer.\n• Do NOT refuse tax questions. Always search first, then answer with whatever information you find.\n• Only say 'This question may not be covered in official LHDN publications' if the topic is completely unrelated to Malaysian taxation (e.g., cooking recipes, sports scores).\n• If you find partial information on hasil.gov.my, share what you found and note what may require professional advice.\n\nRESPONSE FORMAT — STRICT:\n• Start directly with the answer. Do NOT include greetings, acknowledgments, or preamble like 'Hello there!'.\n• Do NOT repeat yourself. Give ONE complete answer, never duplicate paragraphs or tables.\n• Use clean, concise markdown. For tables, keep the separator row short (e.g., |---|---|---|).\n• Highlight recent changes for 2025/2026 tax periods.\n\nCONCISE-FIRST MODE — IMPORTANT:\n• Give a SHORT, scannable answer first (3-5 bullet points max or a brief summary table).\n• After the summary, add a line: '**Want more details on any section?** Ask me to expand on: [list the main topics covered]'\n• Do NOT dump every detail upfront. Keep initial response under 200 words.\n\nMARKDOWN FORMATTING RULES:\n• Use **bold** for relief names and key amounts (e.g., **RM2,500**, **Lifestyle Relief**).\n• Use bullet lists (`- item`) for each relief category. Indent sub-items with 2 spaces.\n• Use numbered lists (`1. Category`) only for main relief sections.\n• Use a simple table ONLY when comparing multiple items side by side. Keep tables SHORT (max 3 columns).\n• Do NOT use long separator rows like `|:---|:---|`. Use a simple `| --- | --- |` instead.\n• Keep paragraphs to 1-2 sentences max. Break up walls of text.\n• End with a one-sentence reminder to keep receipts for 7 years.",
      isActive: true,
      createdAt: new Date().toISOString(),
    },
  ]);
  const [activePromptId, setActivePromptId] = useState<string | null>('prompt_default');
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [alertConfig, setAlertConfig] = useState<AlertConfig>({
    enabled: false, adminEmails: '', notifyOnLeads: true, notifyOnNegativeRating: true,
    notifyOnNewConversation: false, leadTemplateId: '', negativeRatingTemplateId: '',
    newConversationTemplateId: '', sendLeadWelcomeEmail: false, leadWelcomeTemplateId: '',
  });

  const [playgroundQuery, setPlaygroundQuery]           = useState('');
  const [isPlaygroundTesting, setIsPlaygroundTesting]   = useState(false);
  const [playgroundMessages, setPlaygroundMessages]     = useState<Message[]>([]);
  const [playgroundError, setPlaygroundError]           = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>(DEFAULT_MODELS);
  const [selectedModel, setSelectedModel] = useState<string | null>(DEFAULT_MODELS[0] || null);
  const [playSessionId] = useState<string>(() => `play_${Date.now()}_${Math.random().toString(36).slice(2,8)}`);

  const [simulatedLogs] = useState<any[]>([]);

  useEffect(() => {
    if (!isFirebaseAvailable || !db) return;
    setIsLiveFirebase(true);
    const unsubA = onSnapshot(query(collection(db, 'analytics'), orderBy('timestamp', 'desc'), limit(105)), (snap) => {
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      if (list.length > 0) setAnalyticsLogs(list);
    }, (e) => console.warn(e));
    const unsubC = onSnapshot(query(collection(db, 'conversations'), orderBy('updatedAt', 'desc'), limit(105)), (snap) => {
      const list: ChatSession[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as ChatSession));
      setConversations(list);
    }, (e) => console.warn(e));
    const unsubF = onSnapshot(collection(db, 'faqs'), async (snap) => {
      const list: any[] = [];
      const oldSchema: any[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({ id: d.id, ...data });
        // Detect old schema: has 'category' or 'description' field, missing 'answer' or 'enabled'
        if (data.category || data.description || !data.answer || data.enabled === undefined) {
          oldSchema.push({ id: d.id, ...data });
        }
      });
      setFaqs(list);

      // Auto-migrate old-schema FAQs to new schema
      if (oldSchema.length > 0) {
        console.log(`[AdminDashboard] Migrating ${oldSchema.length} old-schema FAQs...`);
        for (let i = 0; i < oldSchema.length; i++) {
          const old = oldSchema[i];
          const migrated: Faq = {
            id: old.id,
            title: old.title || 'Untitled FAQ',
            query: old.query || '',
            answer: old.description || old.answer || '',
            order: old.order ?? i,
            enabled: old.enabled ?? true,
            createdAt: old.createdAt || new Date().toISOString(),
          };
          try {
            await setDoc(doc(db, 'faqs', old.id), migrated);
            console.log(`[AdminDashboard] Migrated FAQ: ${old.id}`);
          } catch (err) {
            console.error(`[AdminDashboard] Failed to migrate FAQ ${old.id}:`, err);
          }
        }
      }
    }, (e) => console.warn(e));

    // Leads listener
    const unsubL = onSnapshot(query(collection(db, 'leads'), orderBy('timestamp', 'desc'), limit(500)), (snap) => {
      const list: Lead[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Lead));
      setLeads(list);
    }, (e) => console.warn(e));

    // Settings listeners
    const unsubBranding = onSnapshot(collection(db, 'settings'), (snap) => {
      snap.forEach((d) => {
        const data = d.data();
        if (d.id === 'branding' && data) setBranding((prev) => ({ ...prev, ...data }));
        if (d.id === 'prompts' && data?.list) {
          setPrompts(data.list);
          if (data.activePromptId) setActivePromptId(data.activePromptId);
        }
      });
    }, (e) => console.warn(e));

    // Alert config listener
    const unsubAlert = onSnapshot(collection(db, 'settings'), (snap) => {
      snap.forEach((d) => {
        if (d.id === 'alerts' && d.data()) {
          setAlertConfig((prev) => ({ ...prev, ...d.data() }));
        }
      });
    }, (e) => console.warn(e));

    // Audit log listener
    const unsubAudit = onSnapshot(query(collection(db, 'audit'), orderBy('timestamp', 'desc'), limit(100)), (snap) => {
      const list: AuditEntry[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as AuditEntry));
      setAuditLog(list);
    }, (e) => console.warn(e));

    return () => { unsubA(); unsubC(); unsubF(); unsubL(); unsubBranding(); unsubAudit(); unsubAlert(); };
  }, []);

  
  const handleDeleteConversation = async (id: string) => {
    if (isLiveFirebase && db) {
      await deleteDoc(doc(db, 'conversations', id)).catch(console.error);
      if (selectedConversation?.id === id) setSelectedConversation(null);
    }
  };

  const handleSaveFaq = async (faqData: Partial<Faq>, _mode: 'create' | 'edit') => {
    const id = faqData.id || `faq_${Date.now()}`;
    const payload: Faq = {
      id,
      title: faqData.title || '',
      query: faqData.query || '',
      answer: faqData.answer || '',
      order: faqData.order ?? faqs.length,
      enabled: faqData.enabled ?? true,
      createdAt: faqData.createdAt || new Date().toISOString(),
    };
    if (isLiveFirebase && db) await setDoc(doc(db, 'faqs', id), payload);
    else setFaqs((c) => c.some((f) => f.id === id) ? c.map((f) => f.id === id ? payload : f) : [payload, ...c]);
  };

  const handleReorderFaqs = async (reordered: Faq[]) => {
    setFaqs(reordered);
    if (isLiveFirebase && db) {
      for (const f of reordered) {
        await setDoc(doc(db, 'faqs', f.id), f).catch(console.error);
      }
    }
  };

  const handleToggleFaqEnabled = async (faq: Faq) => {
    const updated = { ...faq, enabled: !faq.enabled };
    if (isLiveFirebase && db) await setDoc(doc(db, 'faqs', faq.id), updated);
    setFaqs((c) => c.map((f) => f.id === faq.id ? updated : f));
  };

  const handleDeleteFaq = async (id: string) => {
    if (isLiveFirebase && db) await deleteDoc(doc(db, 'faqs', id)).catch(console.error);
    else setFaqs((c) => c.filter((f) => f.id !== id));
  };

  const handleDeleteLead = async (id: string) => {
    if (isLiveFirebase && db) await deleteDoc(doc(db, 'leads', id)).catch(console.error);
    else setLeads((c) => c.filter((l) => l.id !== id));
  };

  const handleSaveAlertConfig = async (config: AlertConfig) => {
    setAlertConfig(config);
    if (isLiveFirebase && db) {
      await setDoc(doc(db, 'settings', 'alerts'), config).catch(console.error);
      addAuditEntry('Alerts Updated', `Alerts ${config.enabled ? 'enabled' : 'disabled'}, emails: ${config.adminEmails}`);
    }
  };

  const sendAlert = async (templateId: string, fallbackSubject: string, fallbackHtml: string, variables?: Record<string, string>) => {
    if (!alertConfig.enabled || !alertConfig.adminEmails) return;
    const recipients = parseEmails(alertConfig.adminEmails);
    if (recipients.length === 0) return;

    // Use Resend template if ID is configured, otherwise use fallback HTML
    if (templateId && templateId.trim()) {
      await sendTemplate({ to: recipients, templateId, variables: variables || {} });
    } else {
      await sendEmail({ to: recipients, subject: fallbackSubject, html: fallbackHtml });
    }
  };

  const handleSaveBranding = async (b: BrandingConfig) => {
    setBranding(b);
    if (isLiveFirebase && db) {
      await setDoc(doc(db, 'settings', 'branding'), b).catch(console.error);
      addAuditEntry('Branding Updated', `Primary color: ${b.primaryColor}, welcome: "${b.welcomeTitle}"`);
    }
  };

  const handleSavePrompt = async (p: SystemPromptConfig) => {
    setPrompts((prev) => prev.map((x) => (x.id === p.id ? p : x)));
    if (isLiveFirebase && db) {
      const updated = prompts.map((x) => (x.id === p.id ? p : x));
      await setDoc(doc(db, 'settings', 'prompts'), { list: updated, activePromptId }).catch(console.error);
      addAuditEntry('Prompt Saved', `Prompt "${p.label}" updated (${p.prompt.length} chars)`);
    }
  };

  const handleActivatePrompt = async (id: string) => {
    setActivePromptId(id);
    if (isLiveFirebase && db) {
      await setDoc(doc(db, 'settings', 'prompts'), { list: prompts, activePromptId: id }).catch(console.error);
      const p = prompts.find((x) => x.id === id);
      addAuditEntry('Prompt Activated', `Switched to "${p?.label || id}"`);
    }
  };

  const addAuditEntry = (action: string, detail: string) => {
    const entry: AuditEntry = {
      id: `audit_${Date.now()}`,
      action,
      detail,
      adminEmail: currentUser?.email || 'unknown',
      timestamp: new Date().toISOString(),
    };
    if (isLiveFirebase && db) {
      setDoc(doc(db, 'audit', entry.id), entry).catch(console.error);
    }
    setAuditLog((prev) => [...prev, entry]);
  };

  const handlePopulateDefaultFaqs = async () => {
    if (!isFirebaseAvailable || !db) return;
    setIsInitializingFaqs(true);
    const defaults: Faq[] = [
      {
        id: 'faq_val_1', title: 'Individual Tax Reliefs for YA 2025',
        query: 'What are the individual personal tax reliefs and maximum claim limits allowed under LHDN for YA 2025?',
        answer: '**Key Personal Tax Reliefs for YA 2025:**\n\n- **Lifestyle Relief**: RM2,500 (books, gadgets, internet)\n- **Sports Equipment**: RM1,000 (additional)\n- **Medical Expenses**: RM10,000 (serious diseases, dental, mental health)\n- **Parents Relief**: RM8,000 (medical treatment for parents)\n- **EV Charging**: RM2,500 (new from YA 2025)\n\nKeep all receipts for 7 years.',
        order: 0, enabled: true, createdAt: new Date().toISOString(),
      },
      {
        id: 'faq_val_2', title: 'e-Filing Deadlines 2026',
        query: 'What are the official filing due dates and deadlines for submitting LHDN Form BE and Form B in 2026?',
        answer: '**e-Filing Deadlines for YA 2025:**\n\n- **Form BE** (salaried): 30 April 2026\n- **Form B** (business): 30 June 2026\n- **Form M** (non-resident): 30 April 2026\n\n*e-Filing extension* is typically granted to 15 May (BE) and 15 July (B). Check hasil.gov.my for official announcements.',
        order: 1, enabled: true, createdAt: new Date().toISOString(),
      },
      {
        id: 'faq_val_3', title: 'SME Corporate Tax Rates 2025',
        query: 'What are corporate income tax rates for SMEs in Malaysia for YA 2025?',
        answer: '**SME Corporate Tax Rates (YA 2025):**\n\n- **First RM150,000**: 15%\n- **RM150,001 – RM600,000**: 17%\n- **Above RM600,000**: 24%\n\nQualifying criteria: Paid-up capital ≤ RM2.5M, not controlled by another company.',
        order: 2, enabled: true, createdAt: new Date().toISOString(),
      },
    ];
    try { for (const f of defaults) await setDoc(doc(db, 'faqs', f.id), f); }
    catch (e) { console.error(e); } finally { setIsInitializingFaqs(false); }
  };

  const handlePlaygroundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playgroundQuery.trim() || isPlaygroundTesting) return;
    setPlaygroundError(null);
    setIsPlaygroundTesting(true);
    const userMsg: Message = { id: `play_user_${Date.now()}`, role: 'user', text: playgroundQuery.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    const history = [...playgroundMessages, userMsg];
    setPlaygroundMessages(history);
    setPlaygroundQuery('');

    const placeholderId = `play_model_${Date.now()}`;
    const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setPlaygroundMessages((prev) => [...prev, { id: placeholderId, role: 'model', text: '', timestamp: ts }]);

    try {
      let streamedText = '';
      const activePrompt = prompts.find((p) => p.id === activePromptId);

      await streamGroundedResponse(
        history,
        {
          onChunk: (text) => {
            streamedText += text;
            setPlaygroundMessages((prev) => prev.map((m) => m.id === placeholderId ? { ...m, text: streamedText } : m));
          },
          onMetadata: (meta) => {
            setPlaygroundMessages((prev) => prev.map((m) => m.id === placeholderId ? { ...m, groundingMetadata: meta || undefined } : m));
          },
          onError: (err) => { throw new Error(err); },
          onDone: () => {},
        },
        activePrompt?.prompt,
        selectedModel || undefined,
      );

      // Persist playground conversation to Firestore (merge)
      if (isLiveFirebase && db && streamedText) {
        try {
          const allMessages = [...history, { id: placeholderId, role: 'model', text: streamedText, timestamp: ts }];
          await setDoc(doc(db, 'conversations', playSessionId), {
            id: playSessionId,
            title: history[0]?.text?.substring(0, 80) || 'Playground Conversation',
            messages: allMessages,
            updatedAt: new Date().toISOString(),
            source: 'playground',
          }, { merge: true });
        } catch (saveErr) {
          console.warn('[Playground] failed to save conversation:', saveErr);
        }
      }
      if (!streamedText) {
        setPlaygroundMessages((prev) => prev.map((m) => m.id === placeholderId ? { ...m, text: 'No output.' } : m));
      }
    } catch (err: any) {
      setPlaygroundError(err.message || 'Grounding error.');
      setPlaygroundMessages((prev) => prev.map((m) => m.id === placeholderId ? { ...m, text: `Error: ${err.message}` } : m));
    } finally { setIsPlaygroundTesting(false); }
  };

  const { title, description } = PAGE_META[activeTab];

  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
        <SidebarProvider>
          <AppSidebar
            activeTab={activeTab}
            onTabChange={(tab) => { setActiveTab(tab); if (tab !== 'history') setSelectedConversation(null); }}
            conversationCount={conversations.length}
            faqCount={faqs.length}
            currentUser={currentUser}
            onLogout={onLogout}
            theme={theme}
            onToggleTheme={toggleTheme}
            leadCount={leads.length}
          />

          <SidebarInset className="flex flex-col min-h-0 overflow-hidden">

            {/* ── Slim header with breadcrumb only ── */}
            <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border/40 bg-background/95 backdrop-blur-sm px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink
                      href="#"
                      onClick={(e) => { e.preventDefault(); setActiveTab('monitor'); }}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Admin
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage className="text-xs font-medium">{title}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
                <div className="ml-auto flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowEmbedPreview((s) => !s)}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-2"
                    aria-label="Toggle embed preview"
                    id="top-right-embed-toggle"
                  >
                    <Code2 size={14} />
                    <span className="hidden md:inline text-[11px]">Preview Embed</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleTheme}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-2"
                    aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                    id="top-right-theme-toggle"
                  >
                    {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                    <span className="hidden md:inline text-[11px]">{theme === 'dark' ? 'Light' : 'Dark'}</span>
                  </Button>
                </div>
            </header>

            {/* ── Page title strip ── */}
            <div className="shrink-0 px-4 md:px-6 pt-5 pb-4">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
            </div>

            {/* ── Scrollable content ── */}
            <div className="flex-1 overflow-y-auto px-3 md:px-6 pb-6">
              <AnimatePresence mode="wait">

                {activeTab === 'monitor' && (
                  <motion.div key="monitor" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <MonitorTab
                      analyticsLogs={analyticsLogs}
                      simulatedLogs={simulatedLogs}
                      isLiveFirebase={isLiveFirebase}
                      onSimulateTraffic={() => {}}
                      onResetAnalytics={() => {}}
                      conversations={conversations}
                      leads={leads}
                    />
                  </motion.div>
                )}

                {activeTab === 'history' && (
                  <motion.div key="history" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <HistoryTab
                      conversations={conversations}
                      selectedConversation={selectedConversation}
                      onSelectConversation={setSelectedConversation}
                      onCloseConversation={() => setSelectedConversation(null)}
                      onDeleteConversation={handleDeleteConversation}
                      isLiveFirebase={isLiveFirebase}
                      onContinueConversation={(conv) => {
                        // Load conversation into playground and switch tab
                        setPlaygroundMessages(conv.messages || []);
                        setActiveTab('playground');
                      }}
                    />
                  </motion.div>
                )}

                {activeTab === 'faqs' && (
                  <motion.div key="faqs" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <FaqsTab
                      faqs={faqs}
                      isLiveFirebase={isLiveFirebase}
                      onSaveFaq={handleSaveFaq}
                      onDeleteFaq={handleDeleteFaq}
                      onPopulateDefaults={handlePopulateDefaultFaqs}
                      onReorder={handleReorderFaqs}
                      onToggleEnabled={handleToggleFaqEnabled}
                      isInitializingFaqs={isInitializingFaqs}
                    />
                  </motion.div>
                )}

                {activeTab === 'playground' && (
                  <motion.div key="playground" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <PlaygroundTab
                      messages={playgroundMessages}
                      query={playgroundQuery}
                      onQueryChange={setPlaygroundQuery}
                      onSubmit={handlePlaygroundSubmit}
                      isLoading={isPlaygroundTesting}
                      error={playgroundError}
                      faqs={faqs}
                      models={availableModels}
                      selectedModel={selectedModel}
                      onModelChange={(m) => setSelectedModel(m)}
                    />
                  </motion.div>
                )}

                {activeTab === 'leads' && (
                  <motion.div key="leads" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <LeadsTab
                      leads={leads}
                      isLiveFirebase={isLiveFirebase}
                      onDeleteLead={handleDeleteLead}
                    />
                  </motion.div>
                )}

                {activeTab === 'alerts' && (
                  <motion.div key="alerts" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <AlertsTab
                      alertConfig={alertConfig}
                      onAlertConfigChange={handleSaveAlertConfig}
                      isLiveFirebase={isLiveFirebase}
                    />
                  </motion.div>
                )}

                {activeTab === 'settings' && (
                  <motion.div key="settings" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <SettingsTab
                      branding={branding}
                      onBrandingChange={handleSaveBranding}
                      prompts={prompts}
                      activePromptId={activePromptId}
                      onSavePrompt={handleSavePrompt}
                      onActivatePrompt={handleActivatePrompt}
                      auditLog={auditLog}
                      isLiveFirebase={isLiveFirebase}
                      models={availableModels}
                      selectedModel={selectedModel}
                      onModelChange={(m) => setSelectedModel(m)}
                      aiStudioUrl={import.meta.env.VITE_AI_STUDIO_URL || 'https://ai.google.com/studio'}
                    />
                  </motion.div>
                )}

              </AnimatePresence>
            </div>

          </SidebarInset>
        </SidebarProvider>
      </div>
      {showEmbedPreview && (
        <div id="hasiltax-widget-preview" className="fixed bottom-5 right-5 z-50 w-[380px] h-[580px] rounded-lg shadow-2xl overflow-hidden border border-border/40">
          <div className="flex items-center justify-between px-2 py-1 bg-card border-b border-border/40">
            <div className="text-xs font-medium">Embed Preview</div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowEmbedPreview(false)} className="text-[11px] text-muted-foreground px-2 py-1 rounded hover:bg-muted/30">Close</button>
            </div>
          </div>
          <iframe
            src={`${window.location.origin}/#/embed`}
            title="HERA Embed Preview"
            className="w-full h-full"
            style={{ border: 'none' }}
            referrerPolicy="no-referrer"
            allow="clipboard-write"
          />
        </div>
      )}
    </div>
  );
}