# HERA — Malaysian Tax Consultant Chatbot

A production-ready AI tax assistant for Malaysian businesses. Features a floating chat widget grounded exclusively on [hasil.gov.my](https://hasil.gov.my) (LHDN), an admin dashboard with leads, conversation history, FAQ management, and email alerts.

**Stack:** React 19 · TypeScript · Vite · Tailwind CSS v4 · Firebase (Auth + Firestore + Hosting) · Google Gemini · Resend

---

## Prerequisites

- **Node.js** 18+ — [nodejs.org](https://nodejs.org)
- **npm** 9+ (bundled with Node)
- **Firebase CLI** — `npm install -g firebase-tools`
- **Google account** (for Firebase + Gemini API)
- **Resend account** — [resend.com](https://resend.com) (free tier works)

---

## Quick Start (5 steps)

### 1. Clone & Install

```bash
git clone https://github.com/AmadDev24/hera-project.git
cd hera-project
npm install
```

### 2. Firebase Setup

#### 2a. Create a Firebase project

1. [Firebase Console](https://console.firebase.google.com) → **Add project**
2. Name it (e.g. `hernancres-chatbot`) → Create
3. **Build → Authentication → Get started** → Sign-in method → Enable **Email/Password** → Save
4. **Build → Firestore Database → Create database** → Production mode → pick a region → Enable

#### 2b. Register a web app and get config

1. Project settings → **Add app → Web** → Name it → Register
2. Copy the `firebaseConfig` object

#### 2c. Create `firebase-applet-config.json`

```bash
cp firebase-applet-config.example.json firebase-applet-config.json
```

Paste your Firebase config into the file:

```json
{
  "apiKey": "AIzaSy...",
  "authDomain": "your-project.firebaseapp.com",
  "projectId": "your-project",
  "storageBucket": "your-project.appspot.com",
  "messagingSenderId": "123456789",
  "appId": "1:123456789:web:abcdef"
}
```

> This file is gitignored — never commit it.

#### 2d. Link the CLI and deploy Firestore rules

```bash
firebase login
firebase use --add          # select your project, alias it "default"
firebase deploy --only firestore:rules
```

### 3. Get API keys

**Gemini API key:**
1. [Google AI Studio](https://aistudio.google.com/app/apikey) → Create API key
2. Select your Firebase project (or any Google Cloud project)
3. Copy the key

**Resend API key** (for email alerts — optional for local dev):
1. [resend.com](https://resend.com) → Sign up → API Keys → Create API Key
2. Copy the key

### 4. Set environment variables

```bash
cp .env.example .env
```

Edit `.env`:

```env
VITE_GEMINI_API_KEY=your_gemini_key_here
VITE_RESEND_API_KEY=your_resend_key_here   # optional, email alerts won't send without it
```

> `.env` is gitignored — never commit it.

### 5. Run locally

```bash
npm run dev
```

- **`/`** → Admin login and dashboard
- **`/embed`** → Standalone chat widget

---

## First-Time Admin Setup (after first login)

After deploying, log into the admin console and complete these steps:

### 1. Create your admin account

On the login page, click **"Need an account? Register"** and sign up with your email and password. Or click **"Generate Mock Admin Access"** to instantly access the dashboard with a temporary account.

### 2. Configure branding

Go to **Settings → Branding** and fill in:
- **Welcome Title** — shown above the chat (e.g. "HERA Tax Assistant")
- **Welcome Subtitle** — opening message typed out when the widget first opens
- **Company Name, Email, Phone, Address, Business Hours** — returned by the chatbot when clients ask "what is your email / where is your office / business hours"

Click **Save Branding** — this persists to Firestore and loads on every embed chat load.

### 3. Configure the system prompt

Go to **Settings → Chatbot** and review the default system prompt. The default is pre-configured to answer Malaysian tax questions grounded on hasil.gov.my. Edit the prompt label and content as needed, then click **Save Prompt** and **Set Active**.

### 4. Add FAQs

Go to **FAQs** and click **Load Defaults** for pre-built Malaysian tax FAQ cards, or create your own. FAQs appear as clickable chips in the chat widget before the user types anything.

### 5. Configure email alerts (optional)

Go to **Email Alerts**, enable alerts, add admin email addresses, and configure which events trigger notifications (new leads, negative ratings, unanswered queries).

---

## Deploy to Production

```bash
npm run deploy
```

This runs `vite build && firebase deploy --project hernancres-chatbot`.

Or deploy manually:

```bash
npm run build
firebase deploy --only hosting
firebase deploy --only firestore:rules
```

Your app will be live at `https://your-project.web.app`

---

## Embed Widget

Add this script tag to any website before `</body>`:

```html
<script src="https://your-project.web.app/embed.js" defer></script>
```

Or use the full-page iframe embed:

```html
<iframe
  src="https://your-project.web.app/embed"
  style="width:100%;max-width:420px;height:600px;border:none;border-radius:16px"
  title="HERA Tax Assistant"
  allow="clipboard-write"
></iframe>
```

> Both snippets are available in the admin dashboard under **Settings → Embed Code**.

### Widget JavaScript API

```js
window.heraChatWidget.open();      // open
window.heraChatWidget.minimize();  // minimize to bubble
window.heraChatWidget.toggle();    // toggle
window.heraChatWidget.maximize();  // full-screen overlay
```

---

## Blank Firestore — Safe to Run

If Firestore is empty (fresh project or data reset), the app is safe:

| Collection | Behaviour when empty |
|---|---|
| `conversations` | Empty state in admin history tab — no crash |
| `leads` | Empty leads table — no crash |
| `faqs` | No FAQ chips in embed chat — "Load Defaults" button available |
| `settings/branding` | `DEFAULT_BRANDING` used in embed chat |
| `settings/alerts` | Alerts disabled — no emails sent |
| `analytics` | Zero counts on dashboard |
| `allowedUsers` | Users tab empty — admin can add users |

The only manual step needed is to **open Settings → Branding and click Save** once. This writes all required config fields to Firestore so the embed chat loads your custom subtitle on next visit.

---

## Project Structure

```
├── public/
│   └── embed.js                   # Self-contained embeddable widget script
├── src/
│   ├── App.tsx                    # Root router: / → admin, /embed → chat
│   ├── components/
│   │   ├── EmbedChat.tsx          # Chat widget (floating + iframe modes)
│   │   ├── AdminDashboard.tsx     # Admin console shell + Firestore listeners
│   │   ├── AdminLogin.tsx         # Email/password login + mock bypass
│   │   ├── ErrorBoundary.tsx      # Top-level React error boundary
│   │   ├── SourcesViewer.tsx      # Grounding source cards in chat
│   │   └── admin/
│   │       ├── AppSidebar.tsx     # Sidebar navigation
│   │       ├── BentoCard.tsx      # Reusable card component
│   │       ├── LineChart.tsx      # SVG line chart (no recharts)
│   │       └── tabs/              # Individual dashboard tab panels
│   │           ├── MonitorTab.tsx
│   │           ├── HistoryTab.tsx
│   │           ├── LeadsTab.tsx
│   │           ├── FaqsTab.tsx
│   │           ├── PlaygroundTab.tsx
│   │           ├── AlertsTab.tsx
│   │           ├── SettingsTab.tsx
│   │           └── UsersTab.tsx
│   ├── hooks/
│   │   └── useTheme.ts            # Dark/light mode (persisted to localStorage)
│   └── lib/
│       ├── firebase.ts            # Firebase init (loads from firebase-applet-config.json)
│       ├── gemini.ts              # Gemini streaming + URL grounding
│       ├── resend.ts              # Email alert helpers
│       └── embedUtils.ts          # Persist: userId, session, messages, profile, cache
├── firebase-applet-config.json    # ⚠ Gitignored — create from .example
├── firebase-applet-config.example.json
├── .env                           # ⚠ Gitignored — create from .env.example
├── .env.example
├── firebase.json                  # Hosting + Firestore config
├── firestore.rules                # Firestore security rules
└── vite.config.ts                 # Build config with vendor chunk splitting
```

---

## Resend Email Alerts

The admin dashboard sends email alerts via [Resend](https://resend.com). Configure in **Email Alerts** tab.

**Supported alert types:**

| Event | When it fires |
|---|---|
| New Lead Captured | User submits name + contact in the engagement or expert form |
| Negative Rating | User clicks the 👎 button on a chat response |
| New Conversation | A new chat session is recorded |
| Unanswered Query | Expert lead form is submitted after chatbot couldn't fully answer |

**Template variables** (for custom Resend templates):

| Template | Variables |
|---|---|
| Lead Alert | `lead_email`, `lead_query`, `lead_time` |
| Negative Rating | `rating_query`, `rating_value`, `rating_time` |
| New Conversation | `conversation_title`, `conversation_message_count`, `conversation_time` |
| Lead Welcome | `lead_email` |

> If no Template ID is configured, HERA falls back to a built-in HTML email automatically. Templates are optional.

---

## Firestore Collections Reference

| Collection | Purpose |
|---|---|
| `conversations/{sessionId}` | Full chat history per session |
| `leads/{leadId}` | Captured client contacts with name, email/phone, sessionId |
| `faqs/{faqId}` | FAQ shortcut cards shown in the chat widget |
| `analytics/{id}` | Query logs (if analytics tracking is implemented) |
| `settings/branding` | Widget appearance + company contact info |
| `settings/prompts` | System prompt configurations |
| `settings/alerts` | Email alert config (recipients, toggles, template IDs) |
| `audit/{id}` | Admin action log |
| `allowedUsers/{id}` | Emails granted admin console access |
| `userProfiles/{userId}` | Client profiles from embed chat (device UUID-based) |

---

## Troubleshooting

**Chat widget shows "Grounded exclusively with HASiL registry." subtitle**
Your Firestore `settings/branding` doc has the old default stored. Go to **Settings → Branding**, update the Welcome Subtitle to your preferred text, and click **Save Branding**.

**Firebase not initializing / Offline Mode badge**
Ensure `firebase-applet-config.json` exists in the project root with valid credentials. The file must be in the root directory (same level as `package.json`).

**Gemini responses not working**
- Check `VITE_GEMINI_API_KEY` is set in `.env`
- Ensure the **Generative Language API** is enabled in your Google Cloud Console project
- The Monitor tab shows a warning banner when the key is missing

**Emails not sending**
- Confirm `VITE_RESEND_API_KEY` is set in `.env`
- Verify your sender domain in the Resend dashboard (or use `onboarding@resend.dev` for dev/testing)
- Check **Email Alerts** tab — it shows a warning when the key is missing

**Conversations not saving from embed widget**
Deploy the updated Firestore rules with `firebase deploy --only firestore:rules`. The rules must be redeployed after any changes to `firestore.rules`.

**`/embed` shows blank page locally**
Navigate directly to `http://localhost:5173/embed` while `npm run dev` is running. The Vite dev server handles the SPA route.

**Lead form not accepting phone number**
Use Malaysian local format: `012-3456789`, `011-87654321`, etc. The validator accepts `01x` followed by 7–8 digits (with or without dashes/spaces).

**Duplicate leads appearing**
The de-duplication only works when Firestore rules allow updates to leads. Ensure the latest `firestore.rules` is deployed. The dedup query matches by `email` or `phone` field exactly.

---

## Security Notes

- `firebase-applet-config.json` and `.env` are gitignored — never commit them
- The Gemini API key (`VITE_GEMINI_API_KEY`) is client-exposed (required for browser streaming). Restrict it to your domain in [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials → API key → Application restrictions → HTTP referrers
- The Resend API key (`VITE_RESEND_API_KEY`) is also client-exposed. In Resend dashboard, restrict the key to only allow sending from your verified domain
- Firestore rules enforce: conversations are public-read but write-protected; leads support dedup updates; settings are write-open (admin-only delete); admin operations require authentication