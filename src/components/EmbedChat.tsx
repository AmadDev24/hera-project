import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  Sparkles,
  Send,
  Copy,
  Check,
  ArrowDown,
  X,
  Mail,
  Bookmark,
  ThumbsUp,
  ThumbsDown,
  Maximize2,
  Minimize2,
  RefreshCw,
  MessageSquare,
  Loader2,
  RotateCcw,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, isFirebaseAvailable } from '../lib/firebase';
import { collection, getDocs, getDoc, setDoc, doc } from 'firebase/firestore';
import { streamGroundedResponse } from '../lib/gemini';
import { sendEmail, sendTemplate, parseEmails, adminLeadAlertHtml, leadWelcomeHtml, negativeRatingAlertHtml } from '../lib/resend';
import Markdown from 'react-markdown';
import SourcesViewer from './SourcesViewer';
import SearchLogs from './SearchLogs';
import { Message, GroundingMetadata } from '../types';

// ── Lightweight client-side query classifier ──
const GREETING_PATTERNS = /^(hi|hello|hey|yo|hiya|howdy|greetings|sup|what'?s\s*up|selamat\s*(pagi|tengah\s*hari|petang|malam)|hai|assalam|salam|apa\s*kabar|how\s*are\s*you|good\s*(morning|afternoon|evening|night)|thanks|thank\s*you|terima\s*kasih|bye|goodbye|see\s*ya|jumpa\s*lagi)[\s!.]*$/i;

const OFF_TOPIC_KEYWORDS = [
  'weather', 'cuaca', 'recipe', 'resep', 'cook', 'football', 'soccer', 'bola',
  'music', 'lagu', 'movie', 'film', 'game', 'makanan', 'food', 'pizza', 'travel',
  'shopping', 'beli', 'joke', 'lawak', 'sports', 'sukan', 'score', 'anime', 'manga',
  'spotify', 'netflix', 'tiktok', 'instagram', 'crypto', 'bitcoin', 'stock', 'saham',
  'programming', 'coding', 'javascript', 'python',
];

function classifyQuery(text: string): 'greeting' | 'off-topic' | 'tax' {
  const trimmed = text.trim();
  if (GREETING_PATTERNS.test(trimmed)) return 'greeting';
  const lower = trimmed.toLowerCase();
  const hasOffTopic = OFF_TOPIC_KEYWORDS.some((kw) => lower.includes(kw));
  const hasTaxKeyword = /tax|cukai|lhdn|hasil|relief|pelepasan|filing|e-filing|borang|form\s*(be|b|m|t)|income|pendapatan|deduction|claim|ya\s*\d{4}|assessment|rebate|exemption|pcb|epf|kwsp|socso|sst|gst|corporate|sme|deadline|tarikh|due\s*date|refund|bayaran|bayar\s*balik/i.test(lower);
  if (hasOffTopic && !hasTaxKeyword) return 'off-topic';
  return 'tax';
}

const GREETING_RESPONSES = [
  "Hi there! 👋 I'm **HERA**, your virtual tax consultant assistant.\n\nFeel free to ask me about Malaysian tax reliefs, filing deadlines, corporate rates, or any LHDN-related question. How can I help you today?",
  "Hello! 🇲🇾 Welcome to **HERA**.\n\nI can help you with individual tax reliefs, e-filing deadlines, SME corporate tax, and more — all sourced from **hasil.gov.my**. What would you like to know?",
  "Selamat datang! 👋 I'm **HERA**, your Virtual Tax Consultant Assistant.\n\nAsk me anything about Malaysian taxation — personal reliefs, Form BE/B filing, corporate rates, or deadline reminders. All answers are grounded on official LHDN sources.",
];

const OFF_TOPIC_RESPONSE = "I appreciate the question, but I'm specialized in **Malaysian taxation** and can only provide information grounded from **hasil.gov.my** (LHDN).\n\nHere are some things I can help with:\n- 📋 Personal tax reliefs & deductions\n- 📅 e-Filing deadlines (Form BE, B, M, T)\n- 🏢 Corporate & SME tax rates\n- 💰 Tax rebates & exemptions\n- 📊 YA 2025/2026 tax brackets\n\nTry asking one of these! 😊";

interface FaqItem {
  id: string;
  title: string;
  query: string;
  answer: string;
  order: number;
  enabled: boolean;
}

const CONSTANT_PRESETS: FaqItem[] = [
  {
    id: 'faq_val_1', title: 'Individual Tax Reliefs for YA 2025',
    query: 'What are the individual personal tax reliefs and maximum claim limits allowed under LHDN for YA 2025?',
    answer: '**Key Personal Tax Reliefs for YA 2025:**\n\n- **Lifestyle Relief**: RM2,500 (books, gadgets, internet)\n- **Sports Equipment**: RM1,000 (additional)\n- **Medical Expenses**: RM10,000 (serious diseases, dental, mental health)\n- **Parents Relief**: RM8,000 (medical treatment for parents)\n- **EV Charging**: RM2,500 (new from YA 2025)\n\nKeep all receipts for 7 years.',
    order: 0, enabled: true,
  },
  {
    id: 'faq_val_2', title: 'e-Filing Deadlines 2026',
    query: 'What are the official filing due dates and deadlines for submitting LHDN Form BE and Form B in 2026?',
    answer: '**e-Filing Deadlines for YA 2025:**\n\n- **Form BE** (salaried): 30 April 2026\n- **Form B** (business): 30 June 2026\n- **Form M** (non-resident): 30 April 2026\n\n*e-Filing extension* is typically granted to 15 May (BE) and 15 July (B). Check hasil.gov.my for official announcements.',
    order: 1, enabled: true,
  },
  {
    id: 'faq_val_3', title: 'SME Corporate Tax Rates 2025',
    query: 'What are corporate income tax rates for SMEs in Malaysia for YA 2025?',
    answer: '**SME Corporate Tax Rates (YA 2025):**\n\n- **First RM150,000**: 15%\n- **RM150,001 – RM600,000**: 17%\n- **Above RM600,000**: 24%\n\nQualifying criteria: Paid-up capital ≤ RM2.5M, not controlled by another company.',
    order: 2, enabled: true,
  },
];

export default function EmbedChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [currentSearchQuery, setCurrentSearchQuery] = useState('');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [ratings, setRatings] = useState<Record<string, 'up' | 'down'>>({});
  const [sessionId, setSessionId] = useState(() => `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

  const readStored = () => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('hera-embed-window-state') : null;
      if (raw) {
        const p = JSON.parse(raw);
        return {
          isMax: !!p.isMaximized,
          isMin: p.isMinimized === undefined ? true : !!p.isMinimized,
          isVis: p.isVisible === undefined ? true : !!p.isVisible,
        };
      }
    } catch {}
    return { isMax: false, isMin: true, isVis: true };
  };

  const _stored = readStored();
  const [isMaximized, setIsMaximized] = useState<boolean>(_stored.isMax);
  const [isMinimized, setIsMinimized] = useState<boolean>(_stored.isMin);
  const [isVisible, setIsVisible] = useState<boolean>(_stored.isVis);

  const STORAGE_KEY = 'hera-embed-window-state';

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ isMaximized, isMinimized, isVisible }));
    } catch {}
  }, [isMaximized, isMinimized, isVisible]);

  const [alertConfig, setAlertConfig] = useState({ enabled: false, adminEmails: '', notifyOnLeads: true, notifyOnNegativeRating: true, notifyOnNewConversation: false, leadTemplateId: '', negativeRatingTemplateId: '', newConversationTemplateId: '', sendLeadWelcomeEmail: false, leadWelcomeTemplateId: '' });
  const [branding, setBranding] = useState({
    primaryColor: '#2563eb',
    welcomeTitle: 'Ask a taxation question!',
    welcomeSubtitle: "Hello, I'm Hera. I can help answer tax-related questions in Malaysia based on official LHDN guidance. What would you like to know?",
    disclaimerText: 'Conversations may be used to evaluate and improve performance.',
    logoLetter: 'H',
  });

  const [leadEmail, setLeadEmail] = useState('');
  const [leadState, setLeadState] = useState<'hidden' | 'visible' | 'submitted' | 'dismissed'>('hidden');
  const [isSavingLead, setIsSavingLead] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      if (!isFirebaseAvailable || !db) return;
      try {
        const snap = await getDocs(collection(db, 'faqs'));
        const list: FaqItem[] = [];
        snap.forEach((docSnap) => list.push({ id: docSnap.id, ...docSnap.data() } as FaqItem));
        if (active && list.length > 0) setFaqs(list);

        const brandingSnap = await getDoc(doc(db, 'settings', 'branding'));
        if (active && brandingSnap.exists()) setBranding((prev) => ({ ...prev, ...brandingSnap.data() }));

        const alertSnap = await getDoc(doc(db, 'settings', 'alerts'));
        if (active && alertSnap.exists()) setAlertConfig((prev) => ({ ...prev, ...alertSnap.data() }));
      } catch (err) {}
    };
    fetchData();
    return () => { active = false; };
  }, []);

  const displayedPresets = (faqs.length > 0 ? faqs : CONSTANT_PRESETS)
    .filter((f) => f.enabled !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .slice(0, 3);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 100);
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, isSearching, scrollToBottom, errorText]);

  useEffect(() => {
    const aiResponseCount = messages.filter((m) => m.role === 'model' && m.groundingMetadata).length;
    if (aiResponseCount < 2) return;
    const submitted = localStorage.getItem('hasiltax-lead-submitted');
    const dismissed = localStorage.getItem('hasiltax-lead-dismissed');
    if (submitted) return;
    if (dismissed && Date.now() - parseInt(dismissed, 10) < 7 * 24 * 60 * 60 * 1000) return;
    setLeadState('visible');
  }, [messages]);

  const handleDismissLead = () => {
    setLeadState('dismissed');
    localStorage.setItem('hasiltax-lead-dismissed', String(Date.now()));
  };

  const handleSubmitLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadEmail.trim() || isSavingLead) return;
    setIsSavingLead(true);
    try {
      if (isFirebaseAvailable && db) {
        const leadId = `lead_${Date.now()}`;
        const firstQuery = messages.find((m) => m.role === 'user')?.text || '';
        await setDoc(doc(db, 'leads', leadId), { id: leadId, email: leadEmail.trim(), firstQuery, timestamp: new Date().toISOString(), source: 'embed-chat' });
      }
      localStorage.setItem('hasiltax-lead-submitted', 'true');
      setLeadState('submitted');
      setTimeout(() => setLeadState('hidden'), 4000);
    } catch (err) {
      localStorage.setItem('hasiltax-lead-submitted', 'true');
      setLeadState('submitted');
      setTimeout(() => setLeadState('hidden'), 4000);
    } finally {
      setIsSavingLead(false);
    }
  };

  const handleRate = async (messageId: string, rating: 'up' | 'down') => {
    setRatings((prev) => ({ ...prev, [messageId]: rating }));
    if (isFirebaseAvailable && db) {
      try {
        await setDoc(doc(db, 'conversations', sessionId), { id: sessionId, rating, ratingMessageId: messageId, updatedAt: new Date().toISOString() }, { merge: true });
      } catch (err) {}
    }
  };

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {}
  };

  const triggerGroundedCall = async (queryText: string) => {
    if (!queryText.trim() || isSearching) return;
    setErrorText(null);
    const userMessageText = queryText.trim();
    setInputValue('');

    const userMsg: Message = { id: `embed_msg_user_${Date.now()}`, role: 'user', text: userMessageText, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    const classification = classifyQuery(userMessageText);

    if (classification === 'greeting' || classification === 'off-topic') {
      const textResponse = classification === 'greeting' 
        ? GREETING_RESPONSES[Math.floor(Math.random() * GREETING_RESPONSES.length)] 
        : OFF_TOPIC_RESPONSE;
      
      setMessages((prev) => [...prev, userMsg, {
        id: `embed_msg_local_${Date.now()}`, role: 'model', text: textResponse, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
      return;
    }

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setIsSearching(true);
    setCurrentSearchQuery(userMessageText);

    const placeholderId = `embed_msg_model_${Date.now()}`;
    const placeholderTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [...prev, { id: placeholderId, role: 'model', text: '', timestamp: placeholderTimestamp }]);

    try {
      let streamedText = '';
      let groundingMeta: GroundingMetadata | undefined;

      await streamGroundedResponse(nextMessages.slice(-12), {
        onChunk: (text: string) => {
          streamedText += text;
          setIsSearching(false);
          setCurrentSearchQuery('');
          setMessages((prev) => prev.map((m) => m.id === placeholderId ? { ...m, text: streamedText } : m));
        },
        onMetadata: (meta: GroundingMetadata | null) => {
          groundingMeta = meta || undefined;
          setMessages((prev) => prev.map((m) => m.id === placeholderId ? { ...m, groundingMetadata: groundingMeta } : m));
        },
        onError: (err: string) => { throw new Error(err); },
        onDone: () => {},
      });

      if (isFirebaseAvailable && db && streamedText) {
        try {
          await setDoc(doc(db, 'conversations', sessionId), {
            id: sessionId, title: userMessageText.substring(0, 80), messages: [...nextMessages, { id: placeholderId, role: 'model', text: streamedText, timestamp: placeholderTimestamp, groundingMetadata: groundingMeta }], createdAt: nextMessages[0]?.timestamp || new Date().toISOString(), updatedAt: new Date().toISOString(), userId: 'embed-widget',
          });
        } catch (convErr) {}
      }
    } catch (e: any) {
      setMessages((prev) => prev.map((m) => m.id === placeholderId ? { ...m, text: `⚠️ **LHDN Search Error:** ${e.message || 'Server did not respond.'}` } : m));
      setErrorText(e.message || "Unable to reach Hera right now.");
    } finally {
      setIsSearching(false);
      setCurrentSearchQuery('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); triggerGroundedCall(inputValue); };

  const handleReloadChat = () => {
    setMessages([]); setErrorText(null);
    setSessionId(`conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    setIsMinimized(false); setIsMaximized(false); setIsVisible(true);
  };

  const handleToggleMinMax = () => setIsMaximized(!isMaximized);
  
  const handleCloseWidget = () => {
    setIsMinimized(true);
    setIsMaximized(false);
    setIsVisible(true);
  };

  useEffect(() => {
    if (isMaximized) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [isMaximized]);

  // Global Portal for the actual Chat Window
  const renderChatWindow = () => {
    if (isMinimized || !isVisible) return null;

    const windowElement = (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={isMaximized ? 'fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/40 pointer-events-auto' : 'fixed bottom-24 right-6 z-[999999] pointer-events-none'}
      >
        <motion.div
          layout
          initial={isMaximized ? { scale: 0.9, opacity: 0 } : { y: 20, opacity: 0, scale: 0.95 }}
          animate={isMaximized ? { scale: 1, opacity: 1 } : { y: 0, opacity: 1, scale: 1 }}
          exit={isMaximized ? { opacity: 0, scale: 0.9 } : { opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
          className={`pointer-events-auto relative flex flex-col bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans shadow-2xl border border-slate-200 dark:border-slate-800 ${
            isMaximized
              ? 'h-[90vh] w-[90vw] md:w-4/5 md:h-4/5 rounded-2xl'
              : 'h-[600px] max-h-[75vh] w-[380px] max-w-[calc(100vw-3rem)] rounded-2xl'
          }`}
        >
          {/* Header Layout adapted from snippet */}
          <header className="shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur z-10">
            <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-blue-600 text-white shadow-sm">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-slate-500 dark:text-slate-400">
                    HernanCres
                  </p>
                  <p className="truncate text-sm font-semibold leading-5 text-slate-900 dark:text-slate-100">
                    Hera Virtual Consultant
                  </p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    Embedded support panel for Malaysian tax questions.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleReloadChat}
                  className="hidden sm:inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-100 h-8 px-3"
                >
                  <RotateCcw className="h-4 w-4" />
                  New chat
                </button>
                <button
                  type="button"
                  onClick={handleReloadChat}
                  className="sm:hidden inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-100 h-8 w-8"
                  aria-label="Start a new chat"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleToggleMinMax}
                  title={isMaximized ? "Restore" : "Maximize"}
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-100 h-8 w-8"
                >
                  {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={handleCloseWidget}
                  title="Close"
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-100 h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </header>

          {/* Chat Area */}
          <div className="flex min-h-0 flex-1 flex-col bg-slate-50/50 dark:bg-slate-900/20">
            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
              <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-4 sm:px-5 sm:py-5">
                
                {/* Empty State / Start Here */}
                {messages.length === 0 && !isSearching && !errorText && (
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-5 shadow-sm sm:p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-blue-600 text-white shadow-sm">
                        <MessageSquare className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                          Start here
                        </p>
                        <p className="mt-2 text-sm leading-7 text-slate-900 dark:text-slate-100">
                          {branding.welcomeSubtitle}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {displayedPresets.map((preset, idx) => (
                            <button
                              key={preset.id || idx}
                              type="button"
                              onClick={() => {
                                if (preset.answer && preset.answer.trim()) {
                                  setMessages((prev) => [
                                    ...prev,
                                    { id: `embed_user_${Date.now()}`, role: 'user', text: preset.query, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
                                    { id: `embed_faq_${Date.now()}`, role: 'model', text: preset.answer, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
                                  ]);
                                } else { triggerGroundedCall(preset.query); }
                              }}
                              className="inline-flex h-auto min-h-9 items-start justify-start whitespace-normal rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-2 text-left text-xs font-medium leading-5 text-blue-600 dark:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-sm"
                            >
                              {preset.title}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Error Banner */}
                {errorText && (
                  <div className="flex gap-3 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>{errorText}</p>
                  </div>
                )}

                {/* Messages Mapping */}
                {messages.map((message) => {
                  const isUser = message.role === 'user';
                  return (
                    <div
                      key={message.id}
                      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[92%] sm:max-w-[86%] rounded-lg px-4 py-3 text-sm shadow-sm ${
                          isUser
                            ? 'bg-blue-600 text-white'
                            : 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        <Markdown className={`prose prose-sm max-w-none text-[13px] leading-relaxed break-words ${!isUser ? 'dark:prose-invert' : 'prose-invert'}`}>
                          {message.text}
                        </Markdown>

                        {/* Copy button underneath assistant message */}
                        {!isUser && (
                           <div className="flex items-center gap-2 mt-2 pl-1 opacity-70">
                            <button onClick={() => handleCopy(message.id, message.text)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors" title="Copy">
                              <Copy size={12}/>
                            </button>
                           </div>
                        )}

                        {/* Grounding Metadata / Sources */}
                        {!isUser && message.groundingMetadata?.groundingChunks && (
                          <div className="w-full pl-1 mt-2">
                            <SourcesViewer chunks={message.groundingMetadata.groundingChunks} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Thinking / Loading State */}
                {isSearching && (
                  <div className="flex justify-start">
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 shadow-sm">
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                        Thinking...
                      </span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Footer Input */}
            <footer className="shrink-0 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-4 sm:px-5">
              <form onSubmit={handleSubmit} className="mx-auto max-w-3xl">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Ask about Malaysian tax..."
                    disabled={isSearching}
                    className="flex h-11 w-full rounded-md border border-slate-200 dark:border-slate-800 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={isSearching || !inputValue.trim()}
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 bg-blue-600 text-white hover:bg-blue-700 shadow-sm h-11 w-11 shrink-0"
                    aria-label="Send message"
                  >
                    {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-2 text-center text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                  {branding.disclaimerText}
                </p>
              </form>
            </footer>
          </div>

          {/* Lead Capture Banner (Overlay) */}
          <AnimatePresence>
            {leadState === 'visible' && (
              <motion.div
                initial={{ y: 80, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 80, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="absolute bottom-[5.5rem] left-3 right-3 z-50"
              >
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-2xl px-4 py-3.5">
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 mt-0.5">
                      <div className="w-8 h-8 rounded-md bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <Bookmark size={15} className="text-blue-600 dark:text-blue-400" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                        Save your consultation?
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-normal">
                        Get notified when LHDN updates deadlines or relief limits. No spam, ever.
                      </p>
                      <form onSubmit={handleSubmitLead} className="flex items-center gap-2 mt-2.5">
                        <div className="relative flex-1">
                          <Mail size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="email"
                            value={leadEmail}
                            onChange={(e) => setLeadEmail(e.target.value)}
                            placeholder="you@email.com"
                            className="w-full h-8 pl-8 pr-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md outline-hidden focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-white placeholder-slate-400"
                            required
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={isSavingLead || !leadEmail.trim()}
                          className="shrink-0 h-8 px-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white text-xs font-bold rounded-md transition-colors cursor-pointer disabled:cursor-not-allowed"
                        >
                          {isSavingLead ? '...' : 'Save'}
                        </button>
                      </form>
                    </div>
                    <button
                      onClick={handleDismissLead}
                      className="shrink-0 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors cursor-pointer"
                      title="Dismiss"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    );

    if (typeof document !== 'undefined') return createPortal(windowElement, document.body);
    return windowElement;
  };

  // Global Portal for the Bubble Button
  const renderBubble = () => {
    if (!isVisible || !isMinimized) return null;

    const bubbleElement = (
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        onClick={() => { setIsMinimized(false); setIsMaximized(false); }}
        className="pointer-events-auto fixed bottom-6 right-6 z-[999999] w-14 h-14 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xl hover:shadow-2xl hover:scale-105 transition-all group border-2 border-white/20"
        title="Open Tax Assistant"
      >
        <div className="absolute inset-0 bg-blue-500/30 rounded-full filter blur-md animate-ping" />
        <MessageSquare className="w-6 h-6 relative z-10" />
      </motion.button>
    );

    if (typeof document !== 'undefined') return createPortal(bubbleElement, document.body);
    return bubbleElement;
  };

  return (
    <>
      <AnimatePresence>{renderChatWindow()}</AnimatePresence>
      <AnimatePresence>{renderBubble()}</AnimatePresence>
    </>
  );
}