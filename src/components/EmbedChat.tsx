import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  Sparkles,
  Send,
  ChevronRight,
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
// Avoids calling the expensive Gemini grounded-search API for greetings
// and off-topic questions, saving API costs and LHDN bandwidth.

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
  // Off-topic: short messages with off-topic keywords and no tax keywords
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

// Default FAQ schema with hardcoded answers
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
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [sessionId, setSessionId] = useState(() => `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  // Initialize window state from localStorage synchronously to avoid visual flash
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
    } catch {
      // ignore
    }
    return { isMax: false, isMin: true, isVis: true };
  };

  const _stored = readStored();
  const [isMaximized, setIsMaximized] = useState<boolean>(_stored.isMax);
  const [isMinimized, setIsMinimized] = useState<boolean>(_stored.isMin);
  const [isVisible, setIsVisible] = useState<boolean>(_stored.isVis);

  // Persisted keys
  const STORAGE_KEY = 'hera-embed-window-state';

  // Load persisted state on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.isMaximized === 'boolean') setIsMaximized(parsed.isMaximized);
        if (typeof parsed.isMinimized === 'boolean') setIsMinimized(parsed.isMinimized);
        if (typeof parsed.isVisible === 'boolean') setIsVisible(parsed.isVisible);
      }
    } catch (e) {
      // ignore malformed state
    }
  }, []);

  // Save state whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ isMaximized, isMinimized, isVisible }));
    } catch (e) {
      // ignore storage errors
    }
  }, [isMaximized, isMinimized, isVisible]);
  // Branding config from Firestore (with defaults)
  const [alertConfig, setAlertConfig] = useState({ enabled: false, adminEmails: '', notifyOnLeads: true, notifyOnNegativeRating: true, notifyOnNewConversation: false, leadTemplateId: '', negativeRatingTemplateId: '', newConversationTemplateId: '', sendLeadWelcomeEmail: false, leadWelcomeTemplateId: '' });
  const [branding, setBranding] = useState({
    primaryColor: '#2563eb',
    welcomeTitle: 'Ask a taxation question!',
    welcomeSubtitle: 'Query individual relief, SME corporate scales, e-filing instructions, or tax assessment years. Grounded exclusively with HASiL registry.',
    disclaimerText: '⛔ Cites official LHDN sources. Keep receipts 7 years.',
    logoLetter: 'H',
  });

  const [leadEmail, setLeadEmail] = useState('');
  const [leadState, setLeadState] = useState<'hidden' | 'visible' | 'submitted' | 'dismissed'>('hidden');
  const [isSavingLead, setIsSavingLead] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 1. Fetch dynamic FAQs and branding from Firestore
  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      if (!isFirebaseAvailable || !db) return;
      try {
        // Fetch FAQs
        const snap = await getDocs(collection(db, 'faqs'));
        const list: FaqItem[] = [];
        snap.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as FaqItem);
        });
        if (active && list.length > 0) setFaqs(list);

        // Fetch branding config
        const brandingSnap = await getDoc(doc(db, 'settings', 'branding'));
        if (active && brandingSnap.exists()) {
          setBranding((prev) => ({ ...prev, ...brandingSnap.data() }));
        }

        // Fetch alert config
        const alertSnap = await getDoc(doc(db, 'settings', 'alerts'));
        if (active && alertSnap.exists()) {
          setAlertConfig((prev) => ({ ...prev, ...alertSnap.data() }));
        }
      } catch (err) {
        console.warn('Unable to load Firestore data, using defaults:', err);
      }
    };
    fetchData();
    return () => { active = false; };
  }, []);

  // Persist conversation to Firestore (merge) when available
  const saveConversation = async (sessionIdLocal: string, msgs: Message[]) => {
    if (!isFirebaseAvailable || !db) return;
    try {
      const convRef = doc(db, 'conversations', sessionIdLocal);
      await setDoc(convRef, {
        id: sessionIdLocal,
        messages: msgs,
        updatedAt: new Date().toISOString(),
        source: 'embed-chat',
      }, { merge: true });
    } catch (err) {
      console.warn('Failed to save conversation:', err);
    }
  };

  // Show top 3 enabled FAQs sorted by order
  const displayedPresets = (faqs.length > 0 ? faqs : CONSTANT_PRESETS)
    .filter((f) => f.enabled !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .slice(0, 3);

  // Auto-scroll to bottom of conversation
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSearching, scrollToBottom]);

  // Track scroll position for "scroll to bottom" button
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 200);
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Lead capture: show banner after 2nd real tax API response (not greetings/off-topic)
  useEffect(() => {
    const aiResponseCount = messages.filter(
      (m) => m.role === 'model' && m.groundingMetadata
    ).length;
    if (aiResponseCount < 2) return;
    // Check if user already submitted or dismissed recently
    const submitted = localStorage.getItem('hasiltax-lead-submitted');
    const dismissed = localStorage.getItem('hasiltax-lead-dismissed');
    if (submitted) return;
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10);
      // Re-show after 7 days
      if (Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) return;
    }
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
      // Store in Firestore if available
      if (isFirebaseAvailable && db) {
        const leadId = `lead_${Date.now()}`;
        const firstQuery = messages.find((m) => m.role === 'user')?.text || '';
        await setDoc(doc(db, 'leads', leadId), {
          id: leadId,
          email: leadEmail.trim(),
          firstQuery,
          timestamp: new Date().toISOString(),
          source: 'embed-chat',
        });
      }
      localStorage.setItem('hasiltax-lead-submitted', 'true');
      setLeadState('submitted');
      setTimeout(() => setLeadState('hidden'), 4000);
      // Send lead alert email to admin(s)
      if (alertConfig.enabled && alertConfig.notifyOnLeads && alertConfig.adminEmails) {
        const recipients = parseEmails(alertConfig.adminEmails);
        const firstQuery = messages.find((m) => m.role === 'user')?.text || '';
        if (recipients.length > 0) {
          if (alertConfig.leadTemplateId?.trim()) {
            sendTemplate({ to: recipients, templateId: alertConfig.leadTemplateId, variables: { lead_email: leadEmail.trim(), lead_query: firstQuery, lead_time: new Date().toLocaleString() } });
          } else {
            sendEmail({ to: recipients, subject: '🔔 New Lead Captured — HERA', html: adminLeadAlertHtml(leadEmail.trim(), firstQuery) });
          }
        }
      }
      // Send welcome email to the lead directly
      if (alertConfig.enabled && alertConfig.sendLeadWelcomeEmail) {
        if (alertConfig.leadWelcomeTemplateId?.trim()) {
          sendTemplate({ to: leadEmail.trim(), templateId: alertConfig.leadWelcomeTemplateId, variables: { lead_email: leadEmail.trim() } });
        } else {
          sendEmail({ to: leadEmail.trim(), subject: 'Welcome to HERA — Your Virtual Tax Consultant', html: leadWelcomeHtml(leadEmail.trim()) });
        }
      }
    } catch (err) {
      console.error('Lead save failed:', err);
      localStorage.setItem('hasiltax-lead-submitted', 'true');
      setLeadState('submitted');
      setTimeout(() => setLeadState('hidden'), 4000);
    } finally {
      setIsSavingLead(false);
    }
  };

  // Rate an AI response
  const handleRate = async (messageId: string, rating: 'up' | 'down') => {
    setRatings((prev) => ({ ...prev, [messageId]: rating }));
    // Send negative rating alert
    if (rating === 'down' && alertConfig.enabled && alertConfig.notifyOnNegativeRating && alertConfig.adminEmails) {
      const recipients = parseEmails(alertConfig.adminEmails);
      const query = messages.find((m) => m.role === 'user')?.text || 'Unknown query';
      if (recipients.length > 0) {
        if (alertConfig.negativeRatingTemplateId?.trim()) {
          sendTemplate({ to: recipients, templateId: alertConfig.negativeRatingTemplateId, variables: { rating_query: query, rating_value: rating, rating_time: new Date().toLocaleString() } });
        } else {
          sendEmail({ to: recipients, subject: '👎 Negative Rating Flagged — HERA', html: negativeRatingAlertHtml(query, rating) });
        }
      }
    }
    // Save rating to Firestore conversation
    if (isFirebaseAvailable && db) {
      try {
        await setDoc(doc(db, 'conversations', sessionId), {
          id: sessionId,
          rating,
          ratingMessageId: messageId,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      } catch (err) {
        console.warn('Failed to save rating:', err);
      }
    }
  };

  // Copy AI response text to clipboard
  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      console.warn('Clipboard write failed');
    }
  };

  // Execute chatbot query — with client-side classification to skip API calls for greetings/off-topic
  const triggerGroundedCall = async (queryText: string) => {
    if (!queryText.trim() || isSearching) return;

    setErrorText(null);
    const userMessageText = queryText.trim();
    setInputValue('');

    const userMsg: Message = {
      id: `embed_msg_user_${Date.now()}`,
      role: 'user',
      text: userMessageText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const classification = classifyQuery(userMessageText);

    // ── Handle greetings locally (no API call) ──
    if (classification === 'greeting') {
      const greetingReply = GREETING_RESPONSES[Math.floor(Math.random() * GREETING_RESPONSES.length)];
      setMessages((prev) => [
        ...prev,
        userMsg,
        {
          id: `embed_msg_greeting_${Date.now()}`,
          role: 'model',
          text: greetingReply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      return;
    }

    // ── Handle off-topic locally (no API call) ──
    if (classification === 'off-topic') {
      setMessages((prev) => [
        ...prev,
        userMsg,
        {
          id: `embed_msg_redirect_${Date.now()}`,
          role: 'model',
          text: OFF_TOPIC_RESPONSE,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      return;
    }

    // ── Tax-related: call the streaming grounded search API ──
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setIsSearching(true);
    setCurrentSearchQuery(userMessageText);

    // Create a placeholder message that will be updated as chunks arrive
    const placeholderId = `embed_msg_model_${Date.now()}`;
    const placeholderTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [
      ...prev,
      {
        id: placeholderId,
        role: 'model',
        text: '',
        timestamp: placeholderTimestamp,
      },
    ]);

    try {
      let streamedText = '';
      let groundingMeta: GroundingMetadata | undefined;
      let streamError: string | null = null;

      // Trim history to last N turns to avoid token overrun
      const prepareHistory = (msgs: Message[], maxTurns = 12) => msgs.slice(-maxTurns);
      const trimmed = prepareHistory(nextMessages, 12);

      await streamGroundedResponse(
        trimmed,
        {
          onChunk: (text: string) => {
            streamedText += text;
            // Hide loading indicator once first chunk arrives
            setIsSearching(false);
            setCurrentSearchQuery('');
            setMessages((prev) =>
              prev.map((m) =>
                m.id === placeholderId ? { ...m, text: streamedText } : m,
              ),
            );
          },
          onMetadata: (meta: GroundingMetadata | null) => {
            groundingMeta = meta || undefined;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === placeholderId ? { ...m, groundingMetadata: groundingMeta } : m,
              ),
            );
          },
          onError: (err: string) => {
            streamError = err;
          },
          onDone: () => {},
        },
      );

      if (streamError) throw new Error(streamError);

      // Save conversation to Firestore
      console.log('[EmbedChat] Stream complete. Firebase:', isFirebaseAvailable, 'DB:', !!db, 'Text length:', streamedText.length);
      if (isFirebaseAvailable && db && streamedText) {
        try {
          const allMessages = [...nextMessages, {
            id: placeholderId,
            role: 'model',
            text: streamedText,
            timestamp: placeholderTimestamp,
            groundingMetadata: groundingMeta,
          }];
          console.log('[EmbedChat] Saving conversation to Firestore:', sessionId, 'Messages:', allMessages.length);
          await setDoc(doc(db, 'conversations', sessionId), {
            id: sessionId,
            title: userMessageText.substring(0, 80),
            messages: allMessages,
            createdAt: allMessages[0]?.timestamp || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            userId: 'embed-widget',
          });
          console.log('[EmbedChat] Conversation saved successfully!');
        } catch (convErr) {
          console.error('[EmbedChat] Failed to save conversation:', convErr);
        }
      } else {
        console.warn('[EmbedChat] Skipping conversation save — Firebase:', isFirebaseAvailable, 'DB:', !!db, 'Text:', !!streamedText);
      }

      // Report analytic metrics to Firestore securely in background
      if (isFirebaseAvailable && db) {
        try {
          const domains: string[] = [];
          if (groundingMeta?.groundingChunks) {
            groundingMeta.groundingChunks.forEach((chunk: any) => {
              if (chunk.web?.uri) {
                try {
                  const url = new URL(chunk.web.uri);
                  const short = url.pathname && url.pathname !== '/'
                    ? `${url.hostname}${url.pathname.substring(0, 30)}`
                    : url.hostname;
                  if (!domains.includes(short)) domains.push(short);
                } catch {
                  if (!domains.includes('hasil.gov.my')) domains.push('hasil.gov.my');
                }
              }
            });
          }
          if (domains.length === 0) domains.push('hasil.gov.my');

          const analId = `embed_anal_${Date.now()}`;
          await setDoc(doc(db, 'analytics', analId), {
            id: analId,
            query: userMessageText,
            timestamp: new Date().toISOString(),
            domainCount: domains.length,
            citedDomains: domains,
            clientEmail: 'Embed Widget Caller',
          });
        } catch (innerErr) {
          console.error('Failed to log embed analytics:', innerErr);
        }
      }

      // If no text was streamed, show fallback
      if (!streamedText) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === placeholderId ? { ...m, text: 'No response returned from Search Grounds.' } : m,
          ),
        );
      }
    } catch (e: any) {
      console.error('Embed network query error:', e);
      setErrorText(e.message || 'Unable to consult Tax AI.');

      // Update placeholder with error or add error message
      setMessages((prev) => {
        const hasPlaceholder = prev.some((m) => m.id === placeholderId && !m.text);
        if (hasPlaceholder) {
          return prev.map((m) =>
            m.id === placeholderId
              ? {
                  ...m,
                  text: `⚠️ **LHDN Search Consult Error:** ${e.message || 'Server did not respond.'}\n\nPlease check that your Gemini API Key is configured properly.`,
                }
              : m,
          );
        }
        return [
          ...prev,
          {
            id: `embed_msg_err_${Date.now()}`,
            role: 'model',
            text: `⚠️ **LHDN Search Consult Error:** ${e.message || 'Server did not respond.'}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ];
      });
    } finally {
      setIsSearching(false);
      setCurrentSearchQuery('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    triggerGroundedCall(inputValue);
  };

  const handleResetChat = () => {
    setMessages([]);
    setErrorText(null);
  };

  const handleReloadChat = () => {
    // Reset conversation and regenerate a session id
    setMessages([]);
    setErrorText(null);
    setSessionId(`conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    // ensure widget is visible when reloading
    setIsVisible(true);
    setIsMinimized(false);
    setIsMaximized(false);
  };

  const handleToggleMinMax = () => {
    // Single toggle: when not maximized -> maximize; when maximized -> minimize to bubble
    if (!isMaximized) {
      setIsMaximized(true);
      setIsMinimized(false);
      setIsVisible(true);
    } else {
      // currently maximized -> minimize into bubble
      setIsMaximized(false);
      setIsMinimized(true);
      setIsVisible(true);
    }
  };

  const handleCloseWidget = () => {
    setIsVisible(false);
    setIsMinimized(false);
    setIsMaximized(false);
  };

  // Prevent background scroll while maximized
  useEffect(() => {
    if (isMaximized) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
    return;
  }, [isMaximized]);

  // helper to wrap the entire widget with overlay/portal when maximized
  const wrapWithOverlay = (children: React.ReactNode) => {
    const wrapper = (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={isMaximized ? 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40' : ''}
      >
        <motion.div
          layout
          initial={isMaximized ? { scale: 0.9, opacity: 0 } : { scale: 1, opacity: 1 }}
          animate={isMaximized ? { scale: 1, opacity: 1 } : { scale: 1, opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          className={`relative flex flex-col ${isMaximized ? 'h-[80vh] w-[80vw] md:w-4/5 md:h-4/5 rounded-xl overflow-hidden' : 'h-screen w-full'} bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 overflow-hidden font-sans`}
          id="embed-widget-container"
        >
          {children}
        </motion.div>
      </motion.div>
    );
    if (isMaximized && typeof document !== 'undefined') return createPortal(wrapper, document.body as any);
    return wrapper;
  };

  return (
    <>
      <AnimatePresence>
        {isVisible && !isMinimized && wrapWithOverlay(
          <>
            {/* Branded Widget Header (Highly streamlined, eye-safe, and compact) */}
            <header className="flex items-center justify-between px-4 py-3 border-b border-slate-200/60 dark:border-slate-850/80 bg-white/95 dark:bg-slate-900/95 shadow-xs shrink-0 select-none">
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 bg-blue-500/10 rounded-lg filter blur-xs animate-ping" />
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black text-xs">
              H
            </div>
          </div>
          <div>
            <h2 className="text-xs font-display font-bold text-slate-900 dark:text-white leading-tight">
              HERA
            </h2>
          </div>
        </div>

            <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <button
              onClick={handleToggleMinMax}
              title={isMaximized ? 'Minimize' : 'Maximize'}
              className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
            <button
              onClick={handleReloadChat}
              title="Reload"
              className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <RefreshCw size={14} />
            </button>
            <button
              onClick={handleCloseWidget}
              title="Close"
              className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-bold text-slate-400 font-mono">
            hasil.gov.my
          </span>
        </div>
      </header>

      {/* Primary Message Stream view container */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin relative">
        <AnimatePresence mode="wait">
          {messages.length === 0 ? (
            // Welcoming layout with FAQs selection grid
            <motion.div
              key="welcome-embed"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-6 text-center max-w-lg mx-auto"
            >
              <div className="relative mb-3 flex items-center justify-center">
                <div className="absolute w-12 h-12 bg-radial from-blue-500/10 to-transparent rounded-full filter blur-md animate-pulse" />
                <Sparkles className="w-8 h-8 text-blue-600/80 dark:text-blue-400/80" />
              </div>

              <h1 className="text-base font-display font-extrabold text-slate-900 dark:text-white leading-snug">
                Ask a taxation question!
              </h1>
              
              <p className="text-[11px] text-slate-450 dark:text-slate-400 max-w-xs mt-1 leading-normal">
                Query individual relief, SME corporate scales, e-filing instructions, or tax assessment years. Grounded exclusively with HASiL registry.
              </p>

              {/* Dynamic FAQ List */}
              <div className="w-full mt-6 space-y-2 text-left">
                <span className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest block pl-1">
                  Frequently Asked Questions
                </span>
                
                <div className="grid grid-cols-1 gap-2">
                  {displayedPresets.map((preset, idx) => (
                    <button
                      key={preset.id || idx}
                      onClick={() => {
                        // If FAQ has a hardcoded answer, show it directly (no API call)
                        if (preset.answer && preset.answer.trim()) {
                          setMessages((prev) => [
                            ...prev,
                            {
                              id: `embed_msg_user_${Date.now()}`,
                              role: 'user',
                              text: preset.query,
                              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                            },
                            {
                              id: `embed_msg_faq_${Date.now()}`,
                              role: 'model',
                              text: preset.answer,
                              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                            },
                          ]);
                        } else {
                          triggerGroundedCall(preset.query);
                        }
                      }}
                      className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-805/80 hover:border-blue-400 dark:hover:border-blue-800 rounded-xl text-left cursor-pointer transition-all hover:shadow-xs group"
                      id={`embed-faq-item-${idx}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                      </div>
                      <h4 className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                        {preset.title}
                      </h4>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            // Chat messages sequence
            <motion.div
              key="chat-messages-embed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4 pb-20"
            >
              {messages.map((message) => {
                const isUser = message.role === 'user';
                const hasQueries = message.groundingMetadata?.webSearchQueries && message.groundingMetadata.webSearchQueries.length > 0;
                const hasChunks = message.groundingMetadata?.groundingChunks && message.groundingMetadata.groundingChunks.length > 0;

                return (
                  <div
                    key={message.id}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[90%] rounded-2xl px-4 py-3 shadow-xs ${
                        isUser
                          ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-tr-xs'
                          : 'bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-805 text-slate-800 dark:text-slate-200 rounded-tl-xs'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1.5 opacity-60">
                        <span className="text-[8px] font-mono font-bold uppercase tracking-wider">
                          {isUser ? 'YOU' : 'AI CONSULTANT'}
                        </span>
                        <span className="text-[8px] font-mono">&bull; {message.timestamp}</span>
                      </div>

                      {/* Msg markdown block */}
                      <div className="prose prose-sm dark:prose-invert max-w-none text-[12.5px] sm:text-[13px] leading-relaxed break-words space-y-2.5 prose-p:leading-relaxed prose-pre:bg-slate-100 dark:prose-pre:bg-slate-950 prose-pre:p-2.5 prose-pre:rounded-lg prose-code:font-mono prose-code:text-[11px] prose-strong:font-bold">
                        <Markdown>{message.text}</Markdown>
                      </div>

                      {/* Sources are shown via SourcesViewer below — raw search queries hidden */}
                    </div>

                    {/* Copy + Rate buttons */}
                    {!isUser && (
                      <div className="flex items-center gap-1.5 mt-1 pl-1">
                        <button
                          onClick={() => handleRate(message.id, 'up')}
                          className={`p-1 rounded-md transition-colors cursor-pointer ${
                            ratings[message.id] === 'up'
                              ? 'text-emerald-500 bg-emerald-500/10'
                              : 'text-slate-400 hover:text-emerald-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                          title="Helpful"
                        >
                          <ThumbsUp size={11} />
                        </button>
                        <button
                          onClick={() => handleRate(message.id, 'down')}
                          className={`p-1 rounded-md transition-colors cursor-pointer ${
                            ratings[message.id] === 'down'
                              ? 'text-red-500 bg-red-500/10'
                              : 'text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                          title="Not helpful"
                        >
                          <ThumbsDown size={11} />
                        </button>
                        <button
                          onClick={() => handleCopy(message.id, message.text)}
                          className="inline-flex items-center gap-1 text-[9px] font-mono text-slate-400 hover:text-blue-500 dark:text-slate-500 dark:hover:text-blue-400 transition-colors cursor-pointer px-1.5 py-0.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Copy response to clipboard"
                        >
                          {copiedId === message.id ? (
                            <>
                              <Check size={10} className="text-emerald-500" />
                              <span className="text-emerald-500">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy size={10} />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {/* Grounded Web Sources Grid compact representation */}
                    {!isUser && hasChunks && (
                      <div className="w-full pl-1 mt-1">
                        <SourcesViewer chunks={message.groundingMetadata?.groundingChunks} />
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Simple loading indicator while connecting to LHDN */}
              {isSearching && (
                <SearchLogs query={currentSearchQuery} isSearching={isSearching} />
              )}
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Lead Capture Banner — non-blocking slide-up */}
      <AnimatePresence>
        {leadState === 'visible' && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="absolute bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] left-3 right-3 z-50"
          >
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl px-4 py-3.5 backdrop-blur-sm">
              <div className="flex items-start gap-3">
                <div className="shrink-0 mt-0.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 flex items-center justify-center">
                    <Bookmark size={15} className="text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-slate-900 dark:text-white leading-snug">
                    Save your consultation?
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-normal">
                    Get notified when LHDN updates deadlines or relief limits. No spam, ever.
                  </p>
                  <form onSubmit={handleSubmitLead} className="flex items-center gap-2 mt-2.5">
                    <div className="relative flex-1">
                      <Mail size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="email"
                        value={leadEmail}
                        onChange={(e) => setLeadEmail(e.target.value)}
                        placeholder="you@email.com"
                        className="w-full h-8 pl-7 pr-2.5 text-[11px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-hidden focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-white placeholder-slate-400"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isSavingLead || !leadEmail.trim()}
                      className="shrink-0 h-8 px-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white text-[10px] font-bold rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
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
        {leadState === 'submitted' && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="absolute bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] left-3 right-3 z-50"
          >
            <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl shadow-lg px-4 py-3 flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center shrink-0">
                <Check size={14} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                Saved! We'll notify you of LHDN deadline changes.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scroll-to-bottom floating button */}
      <AnimatePresence>
        {showScrollBtn && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            onClick={scrollToBottom}
            className="absolute bottom-28 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full text-[10px] font-bold shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
            title="Jump to latest messages"
          >
            <ArrowDown size={11} />
            <span>New messages</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Floating Bottom Input Panel */}
      <div className="p-3 bg-white/95 dark:bg-slate-900/95 border-t border-slate-200/60 dark:border-slate-805 shrink-0">
        <form onSubmit={handleSubmit} className="relative flex items-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-1 focus-within:ring-1 focus-within:ring-blue-500 mt-1">
          <div className="pl-2.5 text-slate-400 shrink-0">
            <Search size={14} className="text-blue-500" />
          </div>
          
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="e.g. resident individual rates 2025..."
            disabled={isSearching}
            className="w-full py-2.5 px-2 bg-transparent text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-hidden focus:ring-0"
            id="embed-search-input"
          />

          <button
            type="submit"
            disabled={isSearching || !inputValue.trim()}
            className={`p-2 rounded-xl text-white select-none transition-all cursor-pointer ${
              inputValue.trim() && !isSearching
                ? 'bg-blue-600 hover:bg-blue-500'
                : 'bg-slate-200 dark:bg-slate-805 text-slate-400 cursor-not-allowed'
            }`}
            id="embed-submit-button"
            title="Submit Consultation Query"
          >
            <Send size={12} />
          </button>
        </form>

        <p className="text-[9px] text-center text-slate-400 dark:text-slate-500 mt-1.5">
          <span className="opacity-70">⏎ Press Enter to send</span>
          <span className="mx-1 opacity-40">·</span>
          ⛔ Cites official LHDN sources. Keep receipts 7 years.
        </p>
      </div>

        
      </>) }

        {isMinimized && isVisible && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            onClick={() => {
              // restore to normal (non-maximized) view
              setIsMinimized(false);
              setIsMaximized(false);
              setIsVisible(true);
            }}
            className="fixed bottom-4 right-4 z-60 w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
            title="Restore chat"
          >
            <span className="font-black">H</span>
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}
