/**
 * embedUtils — persistent state helpers for the HERA chat widget
 * Handles: user ID, session persistence, user profile, language detection,
 *           vague query clarification, and response caching.
 */

import type { Message } from '../types';

// ── Keys ─────────────────────────────────────────────────────────────────

const KEYS = {
  userId:        'hera-user-id',
  sessionId:     'hera-session-id',
  sessionTs:     'hera-session-ts',
  userProfile:   'hera-user-profile',
  cachePrefix:   'hera-rc-',
  leadSubmitted: 'hasiltax-lead-submitted',
  expertContacted:'hasiltax-expert-contacted',
  leadDismissed: 'hasiltax-lead-dismissed',
};

const SESSION_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours of inactivity
const CACHE_TTL       = 4 * 60 * 60 * 1000; // 4 hours

// ── User Identity ─────────────────────────────────────────────────────────

export function getOrCreateUserId(): string {
  try {
    const stored = localStorage.getItem(KEYS.userId);
    if (stored) return stored;
    const id = `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    localStorage.setItem(KEYS.userId, id);
    return id;
  } catch {
    return 'anonymous';
  }
}

// ── Session Persistence ───────────────────────────────────────────────────

export function getOrCreateSessionId(): string {
  try {
    const stored    = localStorage.getItem(KEYS.sessionId);
    const lastTs    = localStorage.getItem(KEYS.sessionTs);
    const isActive  = stored && lastTs && (Date.now() - Number(lastTs)) < SESSION_TIMEOUT;
    if (isActive) return stored!;

    const id = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(KEYS.sessionId, id);
    localStorage.setItem(KEYS.sessionTs, String(Date.now()));
    return id;
  } catch {
    return `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
}

export function updateSessionActivity(sessionId: string) {
  try {
    localStorage.setItem(KEYS.sessionId, sessionId);
    localStorage.setItem(KEYS.sessionTs, String(Date.now()));
  } catch {}
}

export function isExistingSession(): boolean {
  try {
    const stored = localStorage.getItem(KEYS.sessionId);
    const lastTs = localStorage.getItem(KEYS.sessionTs);
    return !!(stored && lastTs && (Date.now() - Number(lastTs)) < SESSION_TIMEOUT);
  } catch { return false; }
}

// ── Message Persistence ───────────────────────────────────────────────────

type StoredMessage = Omit<Message, 'groundingMetadata'>; // strip heavy metadata before storage

export function loadStoredMessages(sessionId: string): StoredMessage[] {
  try {
    const raw = localStorage.getItem(`hera-msgs-${sessionId}`);
    return raw ? (JSON.parse(raw) as StoredMessage[]) : [];
  } catch { return []; }
}

export function saveMessagesToStorage(sessionId: string, messages: Message[]) {
  try {
    // Keep last 30 messages, strip groundingMetadata (can be large)
    const stripped: StoredMessage[] = messages.slice(-30).map(
      ({ groundingMetadata: _g, ...rest }) => rest,
    );
    localStorage.setItem(`hera-msgs-${sessionId}`, JSON.stringify(stripped));
  } catch {}
}

export function clearStoredMessages(sessionId: string) {
  try { localStorage.removeItem(`hera-msgs-${sessionId}`); } catch {}
}

// ── User Profile ──────────────────────────────────────────────────────────

export type Employment  = 'salaried' | 'self-employed' | 'business' | 'unsure';
export type Dependants  = 'spouse' | 'children' | 'both' | 'none';
export type IncomeRange = 'under50k' | '50k-100k' | '100k-200k' | 'above200k' | 'prefer-not';

export interface UserProfile {
  userId:      string;
  employment:  Employment;
  dependants:  Dependants;
  incomeRange: IncomeRange;
  language:    'en' | 'bm';
  savedAt:     string;
}

export function loadUserProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(KEYS.userProfile);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch { return null; }
}

export function saveUserProfile(profile: UserProfile) {
  try { localStorage.setItem(KEYS.userProfile, JSON.stringify(profile)); } catch {}
}

/** Build the profile injection string for the system prompt */
export function buildProfileContext(profile: UserProfile): string {
  const empMap: Record<Employment, string> = {
    salaried:      'salaried employee',
    'self-employed': 'self-employed individual',
    business:      'business owner',
    unsure:        'individual',
  };
  const depMap: Record<Dependants, string> = {
    spouse:   'married',
    children: 'has children',
    both:     'married with children',
    none:     'single with no dependants',
  };
  const incMap: Record<IncomeRange, string> = {
    'under50k':   'below RM50,000',
    '50k-100k':   'RM50,000–100,000',
    '100k-200k':  'RM100,000–200,000',
    'above200k':  'above RM200,000',
    'prefer-not': '',
  };

  const inc = incMap[profile.incomeRange];
  const langInstr = profile.language === 'bm'
    ? 'The user communicates in Bahasa Malaysia. Always respond in Bahasa Malaysia.'
    : 'The user communicates in English. Respond in English.';

  return (
    `\n\nUSER PROFILE: The user is a ${empMap[profile.employment]}, ${depMap[profile.dependants]}` +
    (inc ? `, with approximate annual income of ${inc}` : '') +
    '. Personalise all answers to this profile when relevant.' +
    `\n\nLANGUAGE RULE: ${langInstr}`
  );
}

/** Build a cache key that includes the profile so different profiles get different cached responses */
function getProfileHash(profile: UserProfile | null): string {
  if (!profile) return 'anon';
  return `${profile.employment[0]}${profile.dependants[0]}${profile.incomeRange[0]}`;
}

// ── Language Detection ────────────────────────────────────────────────────

const BM_WORDS = new Set([
  'saya', 'anda', 'awak', 'cukai', 'pendapatan', 'pelepasan', 'borang', 'tarikh',
  'hantar', 'bayar', 'berapa', 'bagaimana', 'boleh', 'tidak', 'untuk', 'yang',
  'dan', 'atau', 'dengan', 'kepada', 'dalam', 'pada', 'perlu', 'mahu', 'ingin',
  'tolong', 'mohon', 'syarikat', 'pekerja', 'gaji', 'hasil', 'polis', 'denda',
  'resit', 'invois', 'potongan', 'kadar', 'pengecualian', 'taksiran', 'lhdn',
  'adakah', 'kenapa', 'macam', 'mana', 'ada', 'tak', 'nak', 'bagi',
]);

export function detectLanguage(text: string): 'en' | 'bm' {
  const words = text.toLowerCase().split(/\s+/);
  const bmCount = words.filter((w) => BM_WORDS.has(w)).length;
  return bmCount >= 2 ? 'bm' : 'en';
}

// ── Vague Query Clarification ─────────────────────────────────────────────

interface ClarificationItem {
  pattern: RegExp;
  q: { en: string; bm: string };
}

export const CLARIFICATION_ITEMS: ClarificationItem[] = [
  {
    pattern: /^(what|apa)\s*(is|are|itu)?\s*(tax\s*relief|pelepasan\s*cukai|relief|pelepasan)\s*\??$/i,
    q: {
      en: "Which type of tax relief are you asking about?\n\n- **Personal reliefs** (medical, education, lifestyle)\n- **Investment reliefs** (EPF, insurance, SSPN)\n- **Business deductions** (expenses, depreciation)\n\nOr tell me your situation — I'll help narrow it down!",
      bm: "Pelepasan cukai jenis mana yang anda tanyakan?\n\n- **Pelepasan peribadi** (perubatan, pendidikan, gaya hidup)\n- **Pelepasan pelaburan** (KWSP, insurans, SSPN)\n- **Potongan perniagaan** (perbelanjaan, susut nilai)\n\nAtau ceritakan situasi anda — saya akan bantu!"
    }
  },
  {
    pattern: /^(tax\s*rate|kadar\s*cukai|rate|kadar)\s*\??$/i,
    q: {
      en: "Which tax rate are you asking about?\n\n- **Personal income tax** rates\n- **Corporate tax** rates\n- **SME preferential rates**\n\nAlso, for which Year of Assessment? e.g., **YA 2025**",
      bm: "Kadar cukai mana yang anda tanyakan?\n\n- Kadar **cukai pendapatan peribadi**\n- Kadar **cukai korporat**\n- Kadar **keutamaan PKS**\n\nJuga, untuk Tahun Taksiran mana? cth. **TA 2025**"
    }
  },
  {
    pattern: /^(deadline|tarikh\s*(akhir|hantar|kemukakan)|due\s*date|when\s*(to\s*submit|file)|bila)\s*\??$/i,
    q: {
      en: "Which filing deadline?\n\n- **Form BE** — salaried employees (April 30)\n- **Form B** — self-employed / business (June 30)\n- **Form C** — companies (varies)\n- **Form M** — non-residents\n\nWhich applies to you?",
      bm: "Tarikh akhir penghantaran mana?\n\n- **Borang BE** — pekerja bergaji (30 April)\n- **Borang B** — bekerja sendiri / perniagaan (30 Jun)\n- **Borang C** — syarikat (berbeza)\n- **Borang M** — bukan pemastautin\n\nMana yang berkenaan?"
    }
  },
  {
    pattern: /^(how|bagaimana|cara)\s*(to|nak|untuk)?\s*(file|hantar|e[-\s]?filing|declare|lapor)?\s*\??$/i,
    q: {
      en: "Are you filing as:\n\n- **Salaried employee** (Form BE)\n- **Self-employed or freelancer** (Form B)\n- **Company** (Form C)\n\nIs this your first time filing? I'll give you step-by-step guidance!",
      bm: "Adakah anda menghantar sebagai:\n\n- **Pekerja bergaji** (Borang BE)\n- **Bekerja sendiri atau freelancer** (Borang B)\n- **Syarikat** (Borang C)\n\nAdakah ini kali pertama anda menghantar? Saya akan beri panduan langkah demi langkah!"
    }
  },
  {
    pattern: /^(exemption|pengecualian|rebate|rebat|deduction|potongan)\s*\??$/i,
    q: {
      en: "Could you share a bit more context?\n\n- **Income exemptions** (dividends, foreign income)?\n- **Tax rebates** (zakat, tax paid abroad)?\n- **Business deductions** (operating expenses, capital allowance)?\n\nMore detail helps me give a precise answer!",
      bm: "Boleh anda kongsikan sedikit latar belakang?\n\n- **Pengecualian pendapatan** (dividen, pendapatan luar negara)?\n- **Rebat cukai** (zakat, cukai dibayar di luar negara)?\n- **Potongan perniagaan** (perbelanjaan operasi, elaun modal)?\n\nMaklumat lanjut membantu saya beri jawapan tepat!"
    }
  },
];

export function getClarificationQuestion(text: string, lang: 'en' | 'bm'): string | null {
  const trimmed = text.trim();
  // Only trigger for short, generic queries (≤ 6 words)
  if (trimmed.split(/\s+/).length > 6) return null;

  for (const item of CLARIFICATION_ITEMS) {
    if (item.pattern.test(trimmed)) {
      return lang === 'bm' ? item.q.bm : item.q.en;
    }
  }
  return null;
}

// ── Response Cache ────────────────────────────────────────────────────────

interface CacheEntry {
  response: string;
  cachedAt: number;
}

function normalizeCacheKey(query: string): string {
  return query.toLowerCase().trim().replace(/\s+/g, ' ').substring(0, 140);
}

function makeCacheKey(query: string, profile: UserProfile | null): string {
  const normalized = normalizeCacheKey(query);
  const profileHash = getProfileHash(profile);
  const raw = `${normalized}::${profileHash}`;
  // Base64 encode and truncate to safe localStorage key
  try {
    return KEYS.cachePrefix + btoa(raw).replace(/[+/=]/g, '').substring(0, 40);
  } catch {
    return KEYS.cachePrefix + normalized.replace(/\W/g, '').substring(0, 40);
  }
}

export function getFromCache(query: string, profile: UserProfile | null): string | null {
  try {
    const key = makeCacheKey(query, profile);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.cachedAt > CACHE_TTL) {
      localStorage.removeItem(key);
      return null;
    }
    return entry.response;
  } catch { return null; }
}

export function saveToCache(query: string, response: string, profile: UserProfile | null) {
  try {
    const key = makeCacheKey(query, profile);
    const entry: CacheEntry = { response, cachedAt: Date.now() };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {}
}