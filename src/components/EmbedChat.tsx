import React, {
  useState, useEffect, useRef, useCallback, memo, useMemo,
} from 'react';
import { createPortal } from 'react-dom';
import {
  Send, Copy, Check, X, Maximize2, Minimize2, MessageSquare,
  Loader2, RotateCcw, ThumbsUp, ThumbsDown, AlertCircle, PhoneCall,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, isFirebaseAvailable } from '../lib/firebase';
import { collection, getDocs, getDoc, setDoc, doc, query, where } from 'firebase/firestore';
import { streamGroundedResponse, DEFAULT_SYSTEM_PROMPT } from '../lib/gemini';
import { sendEmail, parseEmails } from '../lib/resend';
import Markdown from 'react-markdown';
import SourcesViewer from './SourcesViewer';
import { Message, GroundingMetadata } from '../types';
import {
  getOrCreateUserId, getOrCreateSessionId, updateSessionActivity, isExistingSession,
  loadStoredMessages, saveMessagesToStorage, clearStoredMessages,
  loadUserProfile, buildProfileContext, detectLanguage,
  getClarificationQuestion, getFromCache, saveToCache,
  type UserProfile,
} from '../lib/embedUtils';

// ── Environment detection ─────────────────────────────────────────────────

const IS_EMBEDDED = typeof window !== 'undefined' && window.self !== window.top;
const IS_STANDALONE_EMBED = !IS_EMBEDDED && typeof window !== 'undefined' && (
  window.location.pathname === '/embed' ||
  window.location.search.includes('view=embed') ||
  window.location.search.includes('embed=true')
);

// ── Canned responses & classifiers ───────────────────────────────────────

const GREETING_RE    = /^(hi|hello|hey|yo|hiya|howdy|greetings|sup|what'?s\s*up|selamat\s*(pagi|tengah\s*hari|petang|malam)|hai|assalam|salam|apa\s*kabar|how\s*are\s*you|good\s*(morning|afternoon|evening|night))[\s!.]*$/i;
const THANK_YOU_RE   = /^(thanks|thank\s*you|terima\s*kasih|tq|ty|ok\s*(thanks|tq)|bagus|helpful|great\s*help|sangat\s*membantu|noted|understood|faham|tahu\s*dah)[\s!.]*$/i;
const HELP_RE        = /^(talk\s*to\s*(someone|agent|expert|consultant|human|person)|speak\s*to|contact\s*(agent|expert|us)|nak\s*(jumpa|cakap)|bagi\s*contact|ada\s*(agent|consultant)|refer\s*me|call\s*me|hubungi\s*saya|whatsapp)[\s!.?]*$/i;
const TAX_RE         = /tax|cukai|lhdn|hasil|relief|pelepasan|filing|e-filing|borang|form\s*(be|b|m|t|c)|income|pendapatan|deduction|claim|ya\s*\d{4}|ta\s*\d{4}|assessment|rebate|exemption|pcb|epf|kwsp|socso|sst|gst|corporate|sme|deadline|tarikh|due\s*date|refund|bayaran|bayar\s*balik|pengecualian|potongan/i;

const OFF_TOPIC_WORDS = [
  'weather', 'cuaca', 'recipe', 'resep', 'cook', 'football', 'soccer', 'bola',
  'music', 'lagu', 'movie', 'film', 'game', 'makanan', 'food', 'pizza', 'travel',
  'shopping', 'joke', 'lawak', 'sports', 'sukan', 'score', 'anime', 'manga',
  'spotify', 'netflix', 'tiktok', 'instagram', 'crypto', 'bitcoin', 'stock', 'saham',
  'programming', 'coding', 'javascript', 'python',
];

type QueryType = 'greeting' | 'thank-you' | 'help-request' | 'off-topic-tax' | 'off-topic' | 'tax';

function classifyQuery(text: string): QueryType {
  const trimmed = text.trim();
  if (GREETING_RE.test(trimmed))  return 'greeting';
  if (THANK_YOU_RE.test(trimmed)) return 'thank-you';
  if (HELP_RE.test(trimmed))      return 'help-request';
  const lower = trimmed.toLowerCase();
  const isOff = OFF_TOPIC_WORDS.some((w) => lower.includes(w)) && !TAX_RE.test(lower);
  if (isOff) {
    // Genuine tax question that happens to be outside LHDN scope
    if (TAX_RE.test(lower)) return 'off-topic-tax';
    return 'off-topic';
  }
  return 'tax';
}

const GREETING_RESPONSES = [
  "Hi there! 👋 I'm **HERA**, your virtual Malaysian tax consultant.\n\nAsk me about tax reliefs, e-filing deadlines, corporate rates, or anything LHDN-related. How can I help?",
  "Hello! 🇲🇾 Welcome to **HERA**.\n\nI can help with individual reliefs, e-filing deadlines, SME rates, and more — all sourced from **hasil.gov.my**.",
  "Selamat datang! 👋 Saya **HERA**, pembantu perundingan cukai maya anda.\n\nTanya saya apa-apa tentang cukai Malaysia — pelepasan peribadi, penghantaran Borang BE/B, kadar korporat, atau peringatan tarikh akhir.",
];

const OFF_TOPIC_RESPONSE =
  "I'm specialised in **Malaysian taxation** only, with answers grounded on **hasil.gov.my**.\n\n" +
  "Here's what I can help with:\n" +
  "- 📋 Personal tax reliefs & deductions\n" +
  "- 📅 e-Filing deadlines (Form BE, B, M, T)\n" +
  "- 🏢 Corporate & SME tax rates\n" +
  "- 💰 Tax rebates & exemptions\n\n" +
  "Try one of these! 😊";

const THANK_YOU_RESPONSES = [
  "Glad I could help! 😊 If you have more tax questions, I'm here.\n\n*If you'd like to stay updated on the latest LHDN announcements and budget changes, leave your contact below.*",
  "Happy to assist! Feel free to ask anything else about Malaysian tax.\n\n*Want to receive updates on new reliefs and filing deadlines? Drop your contact below.*",
];

// Used when the user has already submitted a lead — no form hint needed
const THANK_YOU_RESPONSES_NO_HINT = [
  "Glad I could help! 😊 Feel free to ask if you have more tax questions.",
  "Happy to assist! If you need anything else about Malaysian tax, just ask.",
];

// Detects queries about contacting the company / location / business hours
const CONTACT_RE = /\b(your\s+(email|phone|number|contact|address|location|office|whatsapp)|contact\s+(us|you|company|office)|reach\s+(you|us)|business\s+hours?|opening\s+hours?|operating\s+hours?|working\s+hours?|office\s+hours?|where\s+is\s+(your|the)\s+office|hubungi\s+(anda|kami)|emel\s+syarikat|telefon\s+(syarikat|anda|kami)|alamat\s+pejabat|waktu\s+(operasi|perniagaan)|jam\s+operasi)\b/i;

// ── Types ─────────────────────────────────────────────────────────────────

interface FaqItem { id: string; title?: string; query: string; answer: string; order: number; enabled: boolean; }
interface Branding {
  primaryColor: string;
  welcomeTitle: string;
  welcomeSubtitle: string;
  logoLetter: string;
  companyName?: string;
  companyEmail?: string;
  companyPhone?: string;
  companyAddress?: string;
  businessHours?: string;
}

const DEFAULT_BRANDING: Branding = {
  primaryColor: '#2563eb',
  welcomeTitle: 'HERA Tax Assistant',
  welcomeSubtitle: "Hello! I'm Hera, your virtual Malaysian tax consultant. I can answer tax questions based on official LHDN guidance. What would you like to know?",
  logoLetter: 'H',
};

function buildCompanyResponse(b: Branding, lang: 'en' | 'bm'): string {
  const hasInfo = b.companyName || b.companyEmail || b.companyPhone || b.companyAddress || b.businessHours;
  if (!hasInfo) {
    return lang === 'bm'
      ? "Untuk pertanyaan langsung, sila tinggalkan kenalan anda di bawah dan kami akan menghubungi anda. 😊"
      : "For direct enquiries, leave your contact below and we'll reach out to you! 😊";
  }
  const intro = lang === 'bm' ? "Berikut adalah maklumat hubungan kami:\n\n" : "Here are our contact details:\n\n";
  const lines: string[] = [];
  if (b.companyName) lines.push(`**${b.companyName}**`);
  if (b.companyEmail) lines.push(`📧 **Email:** ${b.companyEmail}`);
  if (b.companyPhone) lines.push(`📞 **Phone/WhatsApp:** ${b.companyPhone}`);
  if (b.companyAddress) lines.push(`📍 **Address:** ${b.companyAddress}`);
  if (b.businessHours) lines.push(`🕐 **Business Hours:** ${b.businessHours}`);
  const outro = lang === 'bm'
    ? "\n\nBoleh juga tinggalkan kenalan anda di bawah dan kami akan hubungi anda!"
    : "\n\nOr leave your contact below and we'll get in touch!";
  return intro + lines.join('\n') + outro;
}

// ── Sub-components ────────────────────────────────────────────────────────

const HeraBubble = memo(function HeraBubble({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const sz = size === 'sm' ? 'h-6 w-6 text-[11px]' : 'h-8 w-8 text-sm';
  return (
    <div className={`${sz} rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold shrink-0 select-none`}>
      H
    </div>
  );
});

interface ChatMessageProps {
  message: Message;
  feedback?: 'good' | 'bad';
  isCopied: boolean;
  onCopy: (id: string, text: string) => void;
  onFeedback: (id: string, value: 'good' | 'bad') => void;
  compact?: boolean;
}

const ChatMessage = memo(function ChatMessage({
  message, feedback, isCopied, onCopy, onFeedback, compact,
}: ChatMessageProps) {
  const isUser  = message.role === 'user';
  const pad     = compact ? 'px-3.5 py-2.5' : 'px-4 py-3';
  const proseSize = compact ? 'text-[13px]' : 'text-sm';
  const glowClass = !isUser && feedback === 'good' ? 'ring-1 ring-emerald-400/50'
    : !isUser && feedback === 'bad'   ? 'ring-1 ring-destructive/40' : '';

  return (
    <div className={`group flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {!isUser && <HeraBubble size="sm" />}

      <div className="flex flex-col flex-1 min-w-0 gap-1">
        <div className={`max-w-[85%] ${isUser ? 'ml-auto' : ''} ${glowClass} rounded-2xl ${isUser ? 'rounded-br-sm' : 'rounded-bl-sm'} shadow-sm ${pad} ${
          isUser ? 'bg-primary text-primary-foreground' : 'bg-card border border-border/50 text-foreground'
        }`}>
          <div className={`prose prose-sm max-w-none leading-relaxed break-words ${proseSize} ${isUser ? 'prose-invert' : 'dark:prose-invert'}`}>
            <Markdown>{message.text}</Markdown>
          </div>
          {!isUser && message.groundingMetadata?.groundingChunks && (
            <SourcesViewer chunks={message.groundingMetadata.groundingChunks} />
          )}
        </div>

        {!isUser && (
          <div className="flex items-center gap-0.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <button onClick={() => onCopy(message.id, message.text)} title={isCopied ? 'Copied!' : 'Copy'}
              className={`flex items-center gap-1 h-6 px-1.5 rounded-md text-xs transition-colors ${isCopied ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
              {isCopied ? <Check size={10} /> : <Copy size={10} />}
              {isCopied && <span className="text-[10px] font-medium">Copied</span>}
            </button>
            <button onClick={() => !feedback && onFeedback(message.id, 'good')} disabled={!!feedback} title="Helpful"
              className={`flex items-center justify-center w-6 h-6 rounded-md transition-colors ${feedback === 'good' ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'text-muted-foreground hover:text-emerald-500 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40'}`}>
              <ThumbsUp size={10} className={feedback === 'good' ? 'fill-current' : ''} />
            </button>
            <button onClick={() => !feedback && onFeedback(message.id, 'bad')} disabled={!!feedback} title="Not helpful"
              className={`flex items-center justify-center w-6 h-6 rounded-md transition-colors ${feedback === 'bad' ? 'text-destructive bg-destructive/10' : 'text-muted-foreground hover:text-destructive hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40'}`}>
              <ThumbsDown size={10} className={feedback === 'bad' ? 'fill-current' : ''} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

// ── Main Component ────────────────────────────────────────────────────────

export default function EmbedChat() {
  // Persistent identity — computed once
  const userId  = useMemo(() => getOrCreateUserId(), []);
  const wasExistingSession = useMemo(() => isExistingSession(), []);

  const [sessionId, setSessionId] = useState(() => getOrCreateSessionId());

  // Messages — restore from localStorage if returning user
  const [messages, setMessages] = useState<Message[]>(() => {
    if (!wasExistingSession) return [];
    const stored = loadStoredMessages(getOrCreateSessionId());
    return stored as Message[];
  });

  const [faqs, setFaqs]                 = useState<FaqItem[]>([]);
  const [inputValue, setInputValue]     = useState('');
  const [isSearching, setIsSearching]   = useState(false);
  const [errorText, setErrorText]       = useState<string | null>(null);
  const [copiedId, setCopiedId]         = useState<string | null>(null);
  const [feedbackMap, setFeedbackMap]   = useState<Record<string, 'good' | 'bad'>>({});
  const [branding, setBranding]         = useState<Branding>(DEFAULT_BRANDING);
  const [isEmbedMaximized, setIsEmbedMaximized] = useState(false);
  const [detectedLang, setDetectedLang] = useState<'en' | 'bm'>('en');

  // Pending vague query (for clarification flow)
  const [pendingVague, setPendingVague] = useState<string | null>(null);

  // User profile — loaded from localStorage only (no onboarding UI)
  const [userProfile] = useState<UserProfile | null>(() => loadUserProfile());

  // Alert config for email notifications
  const [alertConfig, setAlertConfig] = useState<{ enabled?: boolean; adminEmails?: string; notifyOnLeads?: boolean } | null>(null);

  // Lead forms
  const [engLeadName, setEngLeadName]           = useState('');
  const [engLeadContact, setEngLeadContact]     = useState('');
  const [engLeadState, setEngLeadState]         = useState<'hidden' | 'visible' | 'submitted' | 'dismissed'>('hidden');
  const [expLeadName, setExpLeadName]           = useState('');
  const [expLeadContact, setExpLeadContact]     = useState('');
  const [expLeadState, setExpLeadState]         = useState<'hidden' | 'visible' | 'submitted'>('hidden');
  const [isSavingLead, setIsSavingLead]         = useState(false);

  // Window state (floating widget)
  const [isMaximized, setIsMaximized] = useState(false);
  const [isMinimized, setIsMinimized] = useState(() => {
    if (IS_EMBEDDED || IS_STANDALONE_EMBED) return false;
    try {
      const raw = localStorage.getItem('hera-embed-window-state');
      if (raw) return JSON.parse(raw).isMinimized ?? true;
    } catch {}
    return true;
  });
  const [isVisible, setIsVisible] = useState(true);

  // Welcome typing animation
  const [typedWelcome, setTypedWelcome] = useState('');
  const [welcomeDone, setWelcomeDone]   = useState(() => wasExistingSession);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatWindowRef  = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);
  const typingTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Persist window state ──
  useEffect(() => {
    if (IS_EMBEDDED || IS_STANDALONE_EMBED) return;
    try { localStorage.setItem('hera-embed-window-state', JSON.stringify({ isMinimized, isMaximized, isVisible })); } catch {}
  }, [isMaximized, isMinimized, isVisible]);

  // ── Update session activity on any new message ──
  useEffect(() => {
    if (messages.length > 0) {
      updateSessionActivity(sessionId);
      saveMessagesToStorage(sessionId, messages);
    }
  }, [messages, sessionId]);

  // ── postMessage from embed.js host ──
  useEffect(() => {
    if (!IS_EMBEDDED) return;
    const onMsg = (e: MessageEvent) => {
      const d = e.data;
      if (d?.source !== 'hera-host') return;
      if (d.action === 'reset') handleReloadChat();
      if (d.action === 'state') setIsEmbedMaximized(!!d.maximized);
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  // ── Welcome typing animation ──
  useEffect(() => {
    if (wasExistingSession || messages.length > 0) {
      setWelcomeDone(true);
      setTypedWelcome(branding.welcomeSubtitle);
      return;
    }
    const text = branding.welcomeSubtitle;
    setTypedWelcome('');
    setWelcomeDone(false);
    if (typingTimer.current) clearTimeout(typingTimer.current);

    let idx = 0;
    const tick = () => {
      idx++;
      setTypedWelcome(text.slice(0, idx));
      if (idx < text.length) { typingTimer.current = setTimeout(tick, 14); }
      else { setWelcomeDone(true); }
    };
    typingTimer.current = setTimeout(tick, 300);
    return () => { if (typingTimer.current) clearTimeout(typingTimer.current); };
  }, [sessionId, branding.welcomeSubtitle]);

  // ── Click-outside to minimize ──
  useEffect(() => {
    if (IS_EMBEDDED || IS_STANDALONE_EMBED || isMinimized || isMaximized) return;
    const onMouseDown = (e: MouseEvent) => {
      if (chatWindowRef.current && !chatWindowRef.current.contains(e.target as Node)) setIsMinimized(true);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [isMinimized, isMaximized]);

  // ── Fetch FAQs + branding ──
  useEffect(() => {
    let active = true;
    (async () => {
      if (!isFirebaseAvailable || !db) return;
      try {
        const faqSnap = await getDocs(collection(db, 'faqs'));
        const list: FaqItem[] = [];
        faqSnap.forEach((d) => list.push({ id: d.id, ...d.data() } as FaqItem));
        if (active && list.length > 0) setFaqs(list);

        const brandingSnap = await getDoc(doc(db, 'settings', 'branding'));
        if (active && brandingSnap.exists()) setBranding((p) => ({ ...p, ...brandingSnap.data() }));

        const alertSnap = await getDoc(doc(db, 'settings', 'alerts'));
        if (active && alertSnap.exists()) setAlertConfig(alertSnap.data() as any);
      } catch {}
    })();
    return () => { active = false; };
  }, []);

  // ── Scroll to bottom ──
  const scrollToBottom = useCallback(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 80);
  }, []);
  useEffect(() => { scrollToBottom(); }, [messages, isSearching]);

  // ── Lock scroll when maximized ──
  useEffect(() => {
    if (!isMaximized) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isMaximized]);

  const displayedFaqs = useMemo(
    () => faqs.filter((f) => f.enabled !== false).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [faqs],
  );

  // ── Helpers ──────────────────────────────────────────────────────────────

  const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
  const isMalaysianPhone = (v: string) => {
    const cleaned = v.trim().replace(/[\s\-().+]/g, '');
    // Malaysian mobiles: 01x + 7-8 digits (local or with country code 60)
    return /^(?:60|0)1[0-9]\d{7,8}$/.test(cleaned);
  };
  const isContact = (v: string) => isEmail(v) || isMalaysianPhone(v);

  // Mark conversation as requiring expert help in Firestore
  useEffect(() => {
    if (expLeadState === 'visible' && isFirebaseAvailable && db) {
      setDoc(doc(db, 'conversations', sessionId), {
        requiresHelp: true,
        requiresHelpAt: new Date().toISOString(),
      }, { merge: true }).catch(() => {});
    }
  }, [expLeadState, sessionId]);

  const saveLead = useCallback(async (contact: string, name: string, type: 'engagement' | 'expert') => {
    const leadKey = type === 'engagement' ? 'hasiltax-lead-submitted' : 'hasiltax-expert-contacted';
    try {
      if (isFirebaseAvailable && db) {
        const normalizedContact = contact.trim();
        const isEmailContact = isEmail(normalizedContact);
        const contactField = isEmailContact ? 'email' : 'phone';

        // De-duplication: find existing lead with same contact
        const q = query(collection(db, 'leads'), where(contactField, '==', normalizedContact));
        const existingSnap = await getDocs(q);

        let leadId: string;
        let existingData: Record<string, any> = {};

        if (!existingSnap.empty) {
          leadId = existingSnap.docs[0].id;
          existingData = existingSnap.docs[0].data();
        } else {
          leadId = `lead_${Date.now()}`;
        }

        const payload: Record<string, any> = {
          ...existingData,
          id: leadId,
          userId,
          sessionId,
          [contactField]: normalizedContact,
          firstQuery: existingData.firstQuery || messages.find((m) => m.role === 'user')?.text || '',
          timestamp: existingData.timestamp || new Date().toISOString(),
          lastSeen: new Date().toISOString(),
          source: existingData.source || `embed-${type}`,
        };
        if (name.trim()) payload.name = name.trim();

        await setDoc(doc(db, 'leads', leadId), payload);
      }
    } catch (err) {
      console.warn('[Lead] save error:', err);
    }
    localStorage.setItem(leadKey, 'true');
  }, [messages, userId, sessionId]);

  const handleSubmitEngLead = async (e: React.FormEvent) => {
    e.preventDefault();
    const contact = engLeadContact.trim();
    if (!contact || isSavingLead || !isContact(contact)) return;
    setIsSavingLead(true);
    await saveLead(contact, engLeadName, 'engagement');
    setEngLeadState('submitted');
    setIsSavingLead(false);
  };

  const handleSubmitExpLead = async (e: React.FormEvent) => {
    e.preventDefault();
    const contact = expLeadContact.trim();
    if (!contact || isSavingLead || !isContact(contact)) return;
    setIsSavingLead(true);
    await saveLead(contact, expLeadName, 'expert');

    // Notify admin via email when a "can't answer" lead submits contact
    if (alertConfig?.enabled && alertConfig.notifyOnLeads && alertConfig.adminEmails) {
      const recipients = parseEmails(alertConfig.adminEmails);
      if (recipients.length > 0) {
        const lastQuery = messages.filter(m => m.role === 'user').slice(-1)[0]?.text || '—';
        sendEmail({
          to: recipients,
          subject: 'HERA: Unanswered Query — Lead Contact Submitted',
          html: `<p>A chatbot visitor submitted their contact after the bot could not fully answer their question.</p>
<p><strong>Name:</strong> ${expLeadName.trim() || '—'}</p>
<p><strong>Contact:</strong> ${contact}</p>
<p><strong>Last query:</strong> ${lastQuery}</p>
<p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
<p><em>Please follow up within 1 business day.</em></p>`,
        }).catch(() => {});
      }
    }

    setExpLeadState('submitted');
    setIsSavingLead(false);
  };

  const handleCopy = useCallback(async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {}
  }, []);

  const handleFeedback = useCallback(async (messageId: string, value: 'good' | 'bad') => {
    if (feedbackMap[messageId]) return;
    setFeedbackMap((p) => ({ ...p, [messageId]: value }));
    if (isFirebaseAvailable && db) {
      try {
        await setDoc(doc(db, 'conversations', sessionId), {
          rating: value === 'good' ? 'up' : 'down',
          ratedAt: new Date().toISOString(),
        }, { merge: true });
      } catch {}
    }
  }, [feedbackMap, sessionId]);

  const handleReloadChat = useCallback(() => {
    const newSessionId = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    clearStoredMessages(sessionId);
    setSessionId(newSessionId);
    setMessages([]);
    setErrorText(null);
    setFeedbackMap({});
    setEngLeadState('hidden');
    setExpLeadState('hidden');
    setInputValue('');
    setPendingVague(null);
    updateSessionActivity(newSessionId);
    setWelcomeDone(false);
    if (!IS_EMBEDDED && !IS_STANDALONE_EMBED) { setIsMinimized(false); setIsMaximized(false); }
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [sessionId]);

  // ── Grounded API call ─────────────────────────────────────────────────

  const triggerGroundedCall = useCallback(async (queryText: string) => {
    if (!queryText.trim() || isSearching) return;
    setErrorText(null);
    setInputValue('');

    const lang = detectLanguage(queryText);
    if (lang !== detectedLang) setDetectedLang(lang);

    const userMsg: Message = {
      id: `embed_user_${Date.now()}`,
      role: 'user',
      text: queryText.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const type = classifyQuery(queryText);

    // ── Thank-you → engagement lead ──
    if (type === 'thank-you') {
      const alreadySubmitted = engLeadState === 'submitted';
      const pool = alreadySubmitted ? THANK_YOU_RESPONSES_NO_HINT : THANK_YOU_RESPONSES;
      const reply = pool[Math.floor(Math.random() * pool.length)];
      setMessages((prev) => [...prev, userMsg, { id: `embed_local_${Date.now()}`, role: 'model', text: reply, timestamp: userMsg.timestamp }]);
      if (!alreadySubmitted) setEngLeadState('visible');
      return;
    }

    // ── Company contact / location / hours query ──
    if (CONTACT_RE.test(queryText)) {
      const reply = buildCompanyResponse(branding, lang);
      setMessages((prev) => [...prev, userMsg, { id: `embed_local_${Date.now()}`, role: 'model', text: reply, timestamp: userMsg.timestamp }]);
      // Show expert lead form so user can get in touch
      if (expLeadState !== 'submitted') setExpLeadState('visible');
      return;
    }

    // ── Help request → expert lead ──
    if (type === 'help-request') {
      const reply = lang === 'bm'
        ? "Tentu! Tinggalkan nombor telefon atau e-mel anda dan konsultan cukai kami akan menghubungi anda tidak lama lagi. 📞"
        : "Of course! Leave your phone number or email and one of our tax consultants will get in touch shortly. 📞";
      setMessages((prev) => [...prev, userMsg, { id: `embed_local_${Date.now()}`, role: 'model', text: reply, timestamp: userMsg.timestamp }]);
      if (!localStorage.getItem('hasiltax-expert-contacted')) setExpLeadState('visible');
      return;
    }

    // ── Greeting ──
    if (type === 'greeting') {
      const reply = GREETING_RESPONSES[Math.floor(Math.random() * GREETING_RESPONSES.length)];
      setMessages((prev) => [...prev, userMsg, { id: `embed_local_${Date.now()}`, role: 'model', text: reply, timestamp: userMsg.timestamp }]);
      return;
    }

    // ── Off-topic (no tax keywords) ──
    if (type === 'off-topic') {
      setMessages((prev) => [...prev, userMsg, { id: `embed_local_${Date.now()}`, role: 'model', text: OFF_TOPIC_RESPONSE, timestamp: userMsg.timestamp }]);
      return;
    }

    // ── Off-topic but has tax keywords → expert lead ──
    if (type === 'off-topic-tax') {
      const reply = lang === 'bm'
        ? "Soalan ini mungkin melibatkan situasi yang lebih kompleks di luar skop hasil.gov.my. Konsultan cukai kami boleh membantu anda dengan lebih lanjut.\n\n*Tinggalkan kenalan anda di bawah — kami akan hubungi anda.*"
        : "This might involve a complex situation that goes beyond what's published on hasil.gov.my. Our tax consultants can help.\n\n*Leave your contact below — we'll reach out to you.*";
      setMessages((prev) => [...prev, userMsg, { id: `embed_local_${Date.now()}`, role: 'model', text: reply, timestamp: userMsg.timestamp }]);
      if (!localStorage.getItem('hasiltax-expert-contacted')) setExpLeadState('visible');
      return;
    }

    // ── Check for vague query → clarification ──
    if (!pendingVague) {
      const clarification = getClarificationQuestion(queryText, lang);
      if (clarification) {
        setPendingVague(queryText);
        setMessages((prev) => [...prev, userMsg, {
          id: `embed_clarify_${Date.now()}`,
          role: 'model',
          text: clarification,
          timestamp: userMsg.timestamp,
        }]);
        return;
      }
    }

    // ── If this is a clarification reply, combine with pending vague query ──
    let effectiveQuery = queryText;
    if (pendingVague) {
      effectiveQuery = `${pendingVague} — specifically: ${queryText}`;
      setPendingVague(null);
    }

    // ── Check cache ──
    const cached = getFromCache(effectiveQuery, userProfile);
    if (cached) {
      setMessages((prev) => [...prev, userMsg, {
        id: `embed_cached_${Date.now()}`,
        role: 'model',
        text: cached,
        timestamp: userMsg.timestamp,
      }]);
      checkEngagementLead();
      return;
    }

    // ── Call Gemini API ──
    const history = [...messages, userMsg];
    setMessages(history);
    setIsSearching(true);

    const placeholderId = `embed_model_${Date.now()}`;
    const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [...prev, { id: placeholderId, role: 'model', text: '', timestamp: ts }]);

    try {
      let streamedText = '';
      let groundingMeta: GroundingMetadata | undefined;

      // Build full system prompt: default base + profile/language context
      const profileContext = userProfile
        ? buildProfileContext(userProfile)
        : lang === 'bm' ? '\n\nLANGUAGE RULE: Respond in Bahasa Malaysia.' : '';
      const fullSystemPrompt = DEFAULT_SYSTEM_PROMPT + profileContext;

      await streamGroundedResponse(history.slice(-12), {
        onChunk: (chunk: string) => {
          streamedText += chunk;
          setIsSearching(false);
          setMessages((prev) => prev.map((m) => m.id === placeholderId ? { ...m, text: streamedText } : m));
        },
        onMetadata: (meta: GroundingMetadata | null) => {
          groundingMeta = meta ?? undefined;
          setMessages((prev) => prev.map((m) => m.id === placeholderId ? { ...m, groundingMetadata: groundingMeta } : m));
        },
        onError: (err: string) => { throw new Error(err); },
        onDone: () => {},
      }, fullSystemPrompt);

      if (isFirebaseAvailable && db && streamedText) {
        try {
          const allMsgs = [...history, { id: placeholderId, role: 'model', text: streamedText, timestamp: ts, groundingMetadata: groundingMeta }];
          await setDoc(doc(db, 'conversations', sessionId), {
            id: sessionId, userId,
            title: effectiveQuery.substring(0, 80),
            messages: allMsgs,
            createdAt: history[0]?.timestamp || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        } catch {}
      }

      if (streamedText) {
        // Cache the response
        saveToCache(effectiveQuery, streamedText, userProfile);
        checkEngagementLead();
      } else {
        setMessages((prev) => prev.map((m) => m.id === placeholderId ? { ...m, text: 'No response received.' } : m));
      }
    } catch (e: any) {
      setMessages((prev) => prev.map((m) =>
        m.id === placeholderId ? { ...m, text: `⚠️ **Error:** ${e.message || 'Server did not respond.'}` } : m,
      ));
      setErrorText(e.message || 'Unable to reach Hera right now.');
    } finally {
      setIsSearching(false);
    }
  }, [messages, isSearching, sessionId, userProfile, detectedLang, pendingVague, engLeadState, expLeadState, branding]);

  const checkEngagementLead = () => {
    if (localStorage.getItem('hasiltax-lead-submitted')) return;
    const dismissed = localStorage.getItem('hasiltax-lead-dismissed');
    if (dismissed && Date.now() - Number(dismissed) < 7 * 24 * 60 * 60 * 1000) return;
    const groundedCount = messages.filter((m) => m.role === 'model' && m.groundingMetadata).length;
    if (groundedCount >= 1) setEngLeadState('visible');
  };

  const handleFaqClick = useCallback((faq: FaqItem) => {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (faq.answer?.trim()) {
      setMessages((prev) => [...prev,
        { id: `embed_user_${Date.now()}`, role: 'user', text: faq.query, timestamp: now },
        { id: `embed_faq_${Date.now()}`, role: 'model', text: faq.answer, timestamp: now },
      ]);
    } else {
      triggerGroundedCall(faq.query);
    }
  }, [triggerGroundedCall]);

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); triggerGroundedCall(inputValue); };
  const compact = IS_EMBEDDED && !isEmbedMaximized;
  const pad     = compact ? 'px-3.5 py-2.5' : 'px-4 py-3';

  // ── Lead form helper renderer ─────────────────────────────────────────

  const renderLeadForm = (
    type: 'engagement' | 'expert',
    state: typeof engLeadState | typeof expLeadState,
    name: string, setName: (v: string) => void,
    contact: string, setContact: (v: string) => void,
    onSubmit: (e: React.FormEvent) => void,
    onDismiss?: () => void,
  ) => {
    if (state === 'hidden') return null;
    const isEng = type === 'engagement';
    const title = isEng ? 'Stay updated on tax changes 📬' : 'Talk to a tax consultant 👤';
    const desc  = isEng
      ? "Leave your name and email/mobile — we'll notify you when LHDN updates deadlines or reliefs."
      : "Leave your name and contact — a licensed tax agent will reach out within 1 business day.";
    const h = compact ? 'h-8 text-xs' : 'h-9 text-sm';
    const inputClass = `min-w-0 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground px-3 outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors ${h}`;

    return (
      <div className="flex gap-2.5">
        <HeraBubble size="sm" />
        <div className={`w-[82%] rounded-2xl rounded-bl-sm bg-card border ${isEng ? 'border-border/50' : 'border-primary/20'} shadow-sm ${pad}`}>
          {state === 'submitted' ? (
            <p className={`text-foreground leading-relaxed ${compact ? 'text-xs' : 'text-sm'}`}>
              {isEng ? '✅ Thanks! We\'ll be in touch.' : '✅ Thanks! A consultant will contact you shortly.'}
            </p>
          ) : (
            <>
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  {isEng ? null : <PhoneCall size={13} className="text-primary shrink-0 mt-0.5" />}
                  <p className={`font-semibold text-foreground ${compact ? 'text-xs' : 'text-sm'}`}>{title}</p>
                </div>
                {onDismiss && (
                  <button onClick={onDismiss} className="shrink-0 p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors mt-0.5">
                    <X size={12} />
                  </button>
                )}
              </div>
              <p className={`text-muted-foreground mb-3 ${compact ? 'text-[11px]' : 'text-xs'}`}>{desc}</p>
              <form onSubmit={onSubmit} className="space-y-2">
                <input
                  type="text" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="Your name (optional)"
                  className={`w-full ${inputClass}`}
                />
                <div className="flex gap-2">
                  <input
                    type="text" value={contact} onChange={(e) => setContact(e.target.value)}
                    placeholder="Email or mobile (e.g. 012-3456789)"
                    className={`flex-1 ${inputClass}`}
                  />
                  <button type="submit"
                    disabled={isSavingLead || !contact.trim() || !isContact(contact)}
                    className={`shrink-0 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-medium rounded-lg transition-colors px-3 ${h}`}>
                    {isSavingLead ? '…' : 'Send'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    );
  };

  // ── Chat content ──────────────────────────────────────────────────────

  const chatContent = (
    <div className="flex flex-col h-full bg-background text-foreground overflow-hidden font-sans">

      {/* Header */}
      {!IS_EMBEDDED && (
        <header className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-background/95 backdrop-blur-sm z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <div className="h-9 w-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shadow-sm">H</div>
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-background" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground leading-tight">Hera</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="relative inline-flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>
                <span className="text-[11px] text-emerald-500 font-medium">Online</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {!IS_STANDALONE_EMBED && (
              <button onClick={() => setIsMaximized(!isMaximized)} title={isMaximized ? 'Restore' : 'Maximize'}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
            )}
            <button onClick={handleReloadChat} title="New chat" aria-label="Start a new chat"
              className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <RotateCcw size={14} />
            </button>
            {!IS_STANDALONE_EMBED && (
              <button onClick={() => { setIsMinimized(true); setIsMaximized(false); }} title="Close"
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <X size={14} />
              </button>
            )}
          </div>
        </header>
      )}

      {/* Message area */}
      <div className="flex-1 min-h-0 overflow-y-auto bg-muted/10">
        <div className={`mx-auto flex flex-col max-w-2xl px-4 py-4 ${compact ? 'gap-2' : 'gap-3'}`}>

          {/* Welcome bubble */}
          <div className="flex gap-2.5">
            <HeraBubble size="sm" />
            <div className={`max-w-[85%] rounded-2xl rounded-bl-sm bg-card border border-border/50 shadow-sm ${pad}`}>
              <p className={`text-foreground leading-relaxed ${compact ? 'text-[13px]' : 'text-sm'}`}>
                {typedWelcome}
                {!welcomeDone && <span className="inline-block w-px h-[0.9em] bg-muted-foreground align-middle ml-0.5 animate-pulse" />}
              </p>
            </div>
          </div>

          {/* FAQ chips */}
          {messages.length === 0 && welcomeDone && displayedFaqs.length > 0 && (
            <div className="flex flex-col gap-1.5 ml-8">
              {displayedFaqs.map((faq, idx) => (
                <button key={faq.id} type="button" onClick={() => handleFaqClick(faq)}
                  style={{ animation: 'heraFadeUp 0.3s ease both', animationDelay: `${idx * 70}ms` }}
                  className={`w-fit max-w-[85%] text-left border border-border/50 bg-background/80 text-muted-foreground hover:bg-primary/5 hover:text-primary hover:border-primary/25 rounded-xl transition-colors opacity-0 ${compact ? 'px-3.5 py-2 text-xs' : 'px-4 py-2.5 text-sm'}`}>
                  {faq.query}
                </button>
              ))}
            </div>
          )}

          {/* Error banner */}
          {errorText && (
            <div className="flex gap-2.5 rounded-xl border border-destructive/20 bg-destructive/5 px-3.5 py-3 text-destructive">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <p className="text-xs">{errorText}</p>
            </div>
          )}

          {/* Messages — skip empty placeholders (streaming not yet started) */}
          {messages.filter((msg) => msg.text !== '').map((msg) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              feedback={feedbackMap[msg.id]}
              isCopied={copiedId === msg.id}
              onCopy={handleCopy}
              onFeedback={handleFeedback}
              compact={compact}
            />
          ))}

          {/* Expert lead form */}
          {expLeadState !== 'hidden' && renderLeadForm(
            'expert', expLeadState,
            expLeadName, setExpLeadName,
            expLeadContact, setExpLeadContact,
            handleSubmitExpLead,
          )}

          {/* Engagement lead form */}
          {engLeadState !== 'hidden' && engLeadState !== 'dismissed' && renderLeadForm(
            'engagement', engLeadState,
            engLeadName, setEngLeadName,
            engLeadContact, setEngLeadContact,
            handleSubmitEngLead,
            () => {
              setEngLeadState('dismissed');
              localStorage.setItem('hasiltax-lead-dismissed', String(Date.now()));
            },
          )}

          {/* Thinking indicator */}
          {isSearching && (
            <div className="flex gap-2.5">
              <HeraBubble size="sm" />
              <div className={`rounded-2xl rounded-bl-sm bg-card border border-border/50 shadow-sm flex items-center gap-2 ${pad}`}>
                <Loader2 size={compact ? 13 : 15} className="animate-spin text-primary" />
                <span className={`text-muted-foreground ${compact ? 'text-xs' : 'text-sm'}`}>Thinking…</span>
              </div>
            </div>
          )}

          {/* Clarification indicator */}
          {pendingVague && !isSearching && (
            <p className="text-[11px] text-muted-foreground ml-8">
              {detectedLang === 'bm' ? '↩ Menjawab berdasarkan soalan: ' : '↩ Answering based on: '}
              <span className="italic">{pendingVague}</span>
            </p>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input footer */}
      <footer className="shrink-0 border-t border-border bg-background px-4 py-3">
        <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-2">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={detectedLang === 'bm' ? 'Tanya tentang cukai Malaysia…' : 'Ask about Malaysian tax…'}
              disabled={isSearching}
              autoFocus={!IS_EMBEDDED}
              className={`flex-1 min-w-0 rounded-xl border border-border bg-muted/20 text-foreground placeholder:text-muted-foreground px-3 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 transition-colors ${compact ? 'h-9 text-sm' : 'h-10 text-sm'}`}
            />
            <button type="submit"
              disabled={isSearching || !inputValue.trim()}
              aria-label="Send message"
              className={`inline-flex items-center justify-center rounded-xl font-medium transition-colors disabled:pointer-events-none disabled:opacity-40 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shrink-0 ${compact ? 'h-9 w-9' : 'h-10 w-10'}`}>
              {isSearching ? <Loader2 size={compact ? 14 : 15} className="animate-spin" /> : <Send size={compact ? 14 : 15} />}
            </button>
          </div>
        </form>
      </footer>
    </div>
  );

  // ── Render paths ──────────────────────────────────────────────────────

  if (IS_EMBEDDED || IS_STANDALONE_EMBED) {
    return <div className="w-full h-full">{chatContent}</div>;
  }

  const renderWindow = () => {
    if (isMinimized || !isVisible) return null;
    const windowEl = (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className={isMaximized ? 'fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/40 pointer-events-auto' : 'fixed bottom-24 right-6 z-[999999] pointer-events-none'}>
        <motion.div layout ref={chatWindowRef}
          initial={isMaximized ? { scale: 0.95, opacity: 0 } : { y: 16, opacity: 0, scale: 0.96 }}
          animate={isMaximized ? { scale: 1, opacity: 1 } : { y: 0, opacity: 1, scale: 1 }}
          exit={isMaximized ? { opacity: 0, scale: 0.95 } : { opacity: 0, y: 16, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          className={`pointer-events-auto overflow-hidden shadow-2xl border border-border rounded-2xl ${isMaximized ? 'h-[90vh] w-[90vw] md:w-4/5 md:h-4/5' : 'h-[620px] max-h-[80vh] w-[390px] max-w-[calc(100vw-3rem)]'}`}>
          {chatContent}
        </motion.div>
      </motion.div>
    );
    return createPortal(windowEl, document.body);
  };

  const renderBubble = () => {
    if (!isVisible || !isMinimized) return null;
    const bubble = (
      <motion.button initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        onClick={() => { setIsMinimized(false); setIsMaximized(false); }}
        title="Open HERA Tax Assistant"
        className="pointer-events-auto fixed bottom-6 right-6 z-[999999] h-14 w-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xl hover:shadow-2xl hover:scale-105 transition-all border-2 border-primary-foreground/10">
        <div className="absolute inset-0 rounded-full bg-primary/30 blur-md animate-ping" />
        <MessageSquare size={22} className="relative z-10" />
      </motion.button>
    );
    return createPortal(bubble, document.body);
  };

  return (
    <>
      <AnimatePresence>{renderWindow()}</AnimatePresence>
      <AnimatePresence>{renderBubble()}</AnimatePresence>
    </>
  );
}