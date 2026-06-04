# HERA Google AI Studio and Firebase Deployment Manual

Document version: 0.1  
Project: HERA / HasilTax Buddy  
Repository path: `c:\Users\Amad\Documents\GitHub\hernancres-ai`  
Prepared date: 2026-06-04  
Document type: Architecture, configuration, deployment, and certification guide

## 1. Document Control

### 1.1 Purpose

This document explains why the HERA chatbot project standardizes on Google AI Studio, Gemini, and Firebase as its primary platform, while adding Resend for transactional email notifications. It also provides setup, configuration, deployment, verification, and operations guidance for the current codebase.

The format follows the same general discipline as formal certification or QA guideline documents: numbered sections, explicit scope, clear configuration steps, expected controls, test cases, references, and a change log.

### 1.2 Scope

This guide covers:

- Vite + React frontend application.
- HERA public embed chatbot.
- HERA administrator console.
- Google Gemini grounded search integration.
- Firebase web app configuration.
- Firebase Authentication.
- Cloud Firestore data storage and rules.
- Firebase Hosting deployment.
- Resend email alert add-on.
- Configuration, release, and certification checklist.

This guide does not cover:

- A full backend rewrite.
- Paid plan cost modelling.
- Legal review of Malaysian tax advice.
- Detailed Google Cloud IAM organization policies beyond what is needed for this app.

### 1.3 Primary Project Files

| File | Purpose |
|---|---|
| `package.json` | App scripts and dependency inventory. |
| `.env.example` | Local environment variable template. |
| `firebase.json` | Firebase Hosting and Firestore rules deployment config. |
| `firebase-applet-config.json` | Firebase web app configuration consumed by the app. |
| `firestore.rules` | Firestore security rules. |
| `firebase-blueprint.json` | Intended Firestore entity model. |
| `src/lib/gemini.ts` | Gemini client, grounded search, and HERA system prompt. |
| `src/lib/firebase.ts` | Firebase initialization, Auth helpers, Firestore handle. |
| `src/lib/resend.ts` | Resend email sending helpers. |
| `src/components/EmbedChat.tsx` | Public chatbot widget. |
| `src/components/AdminDashboard.tsx` | Administrator dashboard shell and data subscriptions. |
| `src/components/admin/tabs/AlertsTab.tsx` | Resend alert configuration UI. |
| `security_spec.md` | Target security specification and negative test payloads. |

## 2. Executive Summary

HERA is a browser-based Malaysian taxation chatbot. The public widget answers tax questions using Gemini with Google Search grounding, and the admin console manages conversations, FAQs, leads, prompt configuration, alerts, and reports.

The current technical direction is:

- Use Google AI Studio to create and manage Gemini API keys and AI Studio project linkage.
- Use Gemini through `@google/genai` for streaming grounded answers.
- Use Firebase for Authentication, Firestore, real-time admin dashboard data, security rules, and static SPA hosting.
- Use Resend for transactional emails such as lead alerts, negative rating alerts, and optional lead welcome emails.

The main reason for the Google-first stack is platform cohesion. Gemini, Firebase, Firebase Hosting, Firestore, Authentication, App Check, and Google Cloud API key restriction controls all live under one Google Cloud project boundary. That reduces integration overhead for this project because the app is already an AI Studio-generated Vite app and its main runtime need is a static frontend plus managed client SDKs.

Supabase and Vercel remain valid alternatives. Supabase is stronger when the product needs relational PostgreSQL, SQL analytics, RLS-first backend design, and self-hosting options. Vercel is stronger when the product is a Next.js or full-stack app that needs serverless functions, preview deployments, SSR, and Vercel-native analytics. For this project's current shape, Firebase is the simpler primary platform because it directly matches the current app architecture.

## 3. Current Application Overview

### 3.1 Application Name and Use Case

Working product names in the repository:

- HERA Admin Console.
- HERA Virtual Tax Consultant Assistant.
- HasilTax Buddy.

Primary user groups:

- Public users asking Malaysian taxation questions.
- Internal administrators managing prompts, FAQs, leads, conversations, and email alerts.
- Reviewers testing the console and embed experience.

### 3.2 Main User Flows

1. Public user opens `/embed` or `#/embed`.
2. User asks a Malaysian tax question.
3. Client-side classifier handles greetings and off-topic prompts locally.
4. Tax-related prompts are sent to Gemini using `gemini-2.5-flash` and Google Search grounding.
5. The system prompt forces search queries and citations to `hasil.gov.my`.
6. The answer streams back into the widget.
7. Conversation and analytics records are saved to Firestore when Firebase is available.
8. After enough grounded responses, the widget can prompt for an email lead.
9. If alerts are enabled, Resend sends lead or rating notifications.
10. Admin users sign into the dashboard and monitor activity in real time.

### 3.3 Runtime Stack

| Layer | Current choice | Notes |
|---|---|---|
| Frontend framework | React 19 with Vite | SPA build output goes to `dist`. |
| Styling/UI | Tailwind CSS, shadcn-style components, lucide icons, motion | Dashboard and widget UI. |
| AI SDK | `@google/genai` | Used in `src/lib/gemini.ts`. |
| AI model | `gemini-2.5-flash` | Current source setting; review before changing. |
| Search grounding | Gemini Google Search tool | Prompt and metadata filtering restrict expected sources to `hasil.gov.my`. |
| Auth | Firebase Authentication | Admin login currently uses email/password. |
| Database | Cloud Firestore | Uses named database ID from AI Studio project config. |
| Hosting | Firebase Hosting | Static SPA hosting from `dist`, with rewrite to `/index.html`. |
| Email | Resend REST API | Current implementation uses client-side `VITE_RESEND_API_KEY`; production hardening is required. |

## 4. Why Use Google AI Studio and Firebase

### 4.1 Decision

Use Google AI Studio, Gemini, Firebase, and Google Cloud controls as the core platform for the current HERA application. Add Resend only for email delivery.

### 4.2 Rationale

1. The app was generated from or linked to Google AI Studio.
   The repository README points to an AI Studio app and the runtime uses `@google/genai`. Keeping AI Studio in the platform path avoids unnecessary migration work.

2. Gemini is the core product capability.
   HERA depends on grounded responses, streaming output, and Google Search tool support. The current code already implements those features in `src/lib/gemini.ts`.

3. Firebase matches the application shape.
   This is a Vite SPA. Firebase Hosting is well suited to static web apps and SPAs. Firestore and Authentication work through browser SDKs without maintaining a separate Node API for the first production stage.

4. Real-time admin monitoring is built into Firestore.
   The dashboard uses Firestore listeners through `onSnapshot` for analytics, conversations, leads, settings, and audit records.

5. One Google Cloud project can own the app boundary.
   Firebase project, Auth, Firestore, Hosting, AI Studio API keys, API restrictions, App Check, and billing/quota controls can be managed together.

6. Firebase Security Rules allow direct client access with validation.
   For a client-heavy app, Firestore rules provide schema and access checks near the data layer. This reduces the need for a separate API in early stages, although the current rules must still be hardened before production.

7. The current product does not require relational joins.
   Conversations, analytics events, FAQs, leads, settings, and audit entries fit a document-store model.

### 4.3 What Resend Adds

Firebase can support email through extensions or custom Cloud Functions, but Resend is a focused transactional email service with:

- Domain verification.
- Sender reputation management.
- Email logs.
- API-based sending.
- Templates and variables.
- A simple REST/SDK model.

HERA uses Resend for:

- New lead captured alerts.
- Negative rating alerts.
- Optional new conversation alerts.
- Optional welcome emails to leads.

### 4.4 Why Not Supabase as the Primary Backend

Supabase is a strong alternative when the app needs:

- PostgreSQL as the primary data model.
- SQL reporting.
- Row-level security policies.
- Postgres functions/triggers.
- Self-hosting or open-source platform portability.
- Edge Functions around a Postgres backend.

For HERA's current version, Supabase would add migration work without clear immediate benefit:

- Firestore already stores the document-like data model.
- Firebase Authentication already integrates with Firestore rules.
- Real-time listeners already power the admin dashboard.
- Firebase Hosting already matches the SPA deployment target.
- The AI path is already Google AI Studio and Gemini.

Supabase should be reconsidered if HERA needs relational billing records, structured CRM workflows, multi-tenant organization tables, advanced SQL analytics, or strong SQL-based reporting.

### 4.5 Why Not Vercel as the Primary Host

Vercel is a strong alternative when the app needs:

- Next.js App Router.
- SSR or ISR.
- Serverless API routes.
- Preview deployments from Git.
- Vercel Analytics and Speed Insights.
- Vercel Marketplace integrations.

For this repository, Firebase Hosting is a better default because:

- The active build is Vite, not Next.js.
- The current deploy target is a static SPA.
- Firebase config, Auth domain, Firestore, and Hosting live in the same project.
- The app can deploy with one Firebase command after build.

Vercel should be reconsidered if the project adds server-rendered pages, needs backend API routes for secrets, or chooses Next.js as the main app framework.

### 4.6 Final Platform Boundary

| Capability | Selected service | Reason |
|---|---|---|
| AI prototyping and Gemini API keys | Google AI Studio | Native to Gemini and current project origin. |
| AI inference | Gemini API | Current source uses `@google/genai`. |
| Auth | Firebase Authentication | Works with Firebase client SDK and Firestore rules. |
| Database | Cloud Firestore | Real-time document store for chat, analytics, settings, leads. |
| Static hosting | Firebase Hosting | Direct SPA hosting and Firebase project cohesion. |
| Abuse protection | Firebase App Check plus API restrictions | Needed for client-facing app protection. |
| Email | Resend | Better transactional email tooling and logs. |
| Future server-side secrets | Firebase Cloud Functions or Cloud Run | Keeps Google platform boundary while hiding secrets. |

## 5. Repository and Build Setup

### 5.1 Prerequisites

Install:

- Node.js 20 or newer recommended.
- npm.
- Firebase CLI through `npx -y firebase-tools@latest`.
- Access to the Firebase project.
- Access to Google AI Studio.
- Access to the Resend account.

### 5.2 Install Dependencies

From the repository root:

```powershell
npm install
```

### 5.3 Local Environment File

Create a local environment file. Vite supports `.env` and `.env.local`; use `.env.local` for local-only secrets:

```powershell
Copy-Item .env.example .env.local
```

Set:

```text
VITE_GEMINI_API_KEY=<gemini-api-key>
VITE_RESEND_API_KEY=<resend-api-key>
```

Important:

- `.env*` is ignored by `.gitignore`, except `.env.example`.
- Any `VITE_*` variable is embedded into the browser build.
- Do not treat `VITE_GEMINI_API_KEY` or `VITE_RESEND_API_KEY` as server-only secrets.
- For production, move Resend sending and ideally Gemini calls behind server-side functions, or use Firebase AI Logic with App Check where appropriate.

### 5.4 Development Server

```powershell
npm run dev
```

Default Vite URL is usually:

```text
http://localhost:5173
```

### 5.5 Static Build

```powershell
npm run build
```

Expected output:

```text
dist/
```

### 5.6 Preview Build

```powershell
npm run preview
```

## 6. Google AI Studio and Gemini Configuration

### 6.1 Create or Select Google Cloud Project

Use the same Google Cloud project that backs Firebase where possible:

```text
Project ID: hernancres-chatbot
```

Using one project keeps billing, API permissions, quota, and security restrictions easier to manage.

### 6.2 Create Gemini API Key

1. Open Google AI Studio.
2. Go to the API keys page.
3. Create or select a key under the same Google Cloud project.
4. Put the key in `.env.local`:

```text
VITE_GEMINI_API_KEY=<gemini-api-key>
```

### 6.3 Restrict Gemini API Key

In Google Cloud Console:

1. Go to APIs and Services > Credentials.
2. Select the Gemini API key.
3. Add API restriction:
   - Generative Language API / Gemini API only.
4. Add application restriction for web:
   - HTTP referrers.
5. Add allowed referrers:

```text
http://localhost:5173/*
https://hernancres-chatbot.web.app/*
https://hernancres-chatbot.firebaseapp.com/*
https://<custom-domain>/*
```

Notes:

- Google documents that unrestricted API keys are insecure and should have API and application restrictions.
- Gemini documentation says API keys exposed in client-side web apps can be extracted; for production, server-side calls are safest.
- This repository currently calls Gemini from the browser, so restrictions and monitoring are mandatory.

### 6.4 Current Gemini Implementation

Source file:

```text
src/lib/gemini.ts
```

Current behavior:

- Uses `GoogleGenAI`.
- Reads `import.meta.env.VITE_GEMINI_API_KEY`.
- Uses streaming generation.
- Model is currently `gemini-2.5-flash`.
- Adds a grounding tool:

```ts
tools: [{ googleSearch: {} }]
```

- Applies a system prompt that forces Malaysian tax answers to official LHDN sources.
- Filters grounding metadata so only `hasil.gov.my` and subdomains remain visible.

### 6.5 Prompt and Grounding Policy

The HERA prompt requires:

- Every search query to begin with `site:hasil.gov.my`.
- Citations only from `hasil.gov.my`.
- No unrelated `.gov.my` sources.
- Concise answers under 200 words by default.
- Recent 2025/2026 changes highlighted where relevant.
- Receipts reminder.

Operational rule:

- Any prompt edit must be tested with at least 10 known tax questions and 5 off-topic questions.
- Prompt changes must not expose internal instructions or raw retrieval details.

### 6.6 Recommended Future Improvement: Firebase AI Logic

Firebase AI Logic provides an App Check-aware proxy path for Gemini calls from app clients. If HERA remains browser-first, this should be evaluated because it aligns with the Google/Firebase platform decision and can reduce direct API key exposure risk.

## 7. Firebase Configuration

### 7.1 Firebase Project

Current repository config points to:

```text
projectId: hernancres-chatbot
authDomain: hernancres-chatbot.firebaseapp.com
storageBucket: hernancres-chatbot.firebasestorage.app
firestoreDatabaseId: ai-studio-c9668319-7568-4192-bd22-b18ccf709ab4
```

Do not publish real private credentials in documentation. Firebase web config is not equivalent to an admin credential, but API keys should still be restricted.

### 7.2 Firebase Web App Config File

The app dynamically imports:

```text
firebase-applet-config.json
```

Expected shape:

```json
{
  "projectId": "hernancres-chatbot",
  "appId": "<firebase-web-app-id>",
  "apiKey": "<firebase-web-api-key>",
  "authDomain": "hernancres-chatbot.firebaseapp.com",
  "firestoreDatabaseId": "ai-studio-c9668319-7568-4192-bd22-b18ccf709ab4",
  "storageBucket": "hernancres-chatbot.firebasestorage.app",
  "messagingSenderId": "<sender-id>",
  "measurementId": ""
}
```

This file is ignored by git. Each deployment environment must provide it.

### 7.3 Firebase CLI Login

Use the Firebase CLI through `npx`:

```powershell
npx -y firebase-tools@latest login
```

For remote shells:

```powershell
npx -y firebase-tools@latest login --no-localhost
```

### 7.4 Select Project

```powershell
npx -y firebase-tools@latest use hernancres-chatbot
```

Verify:

```powershell
npx -y firebase-tools@latest projects:list
```

### 7.5 Firebase Authentication

Current UI:

- `src/components/AdminLogin.tsx` uses email/password authentication.
- `src/lib/firebase.ts` includes a Google sign-in helper, but the admin login UI currently uses email/password.

Required setup:

1. Open Firebase Console.
2. Go to Authentication.
3. Enable Email/Password provider.
4. Optionally enable Google provider if the UI is updated to use Google sign-in.
5. Add authorized domains:

```text
localhost
hernancres-chatbot.web.app
hernancres-chatbot.firebaseapp.com
<custom-domain>
```

Important:

- Authorized domains should not include protocol or port.
- If Google Sign-In is used, Firebase docs recommend enabling Google as a provider and using the Firebase JavaScript SDK for browser sign-in.

### 7.6 Admin Account Provisioning

Target production approach:

1. Create admin user in Firebase Authentication.
2. Create a Firestore document:

```text
admins/{uid}
```

Example document:

```json
{
  "email": "admin@example.com",
  "role": "admin",
  "createdAt": "2026-06-04T00:00:00.000Z"
}
```

3. Update Firestore rules so admin-only collections require `isAdmin()`.
4. Disable open self-registration for production unless explicitly required.

Current implementation warning:

- The admin login page has a registration mode and a reviewer mock bypass.
- Those are useful for development and demos, but should be removed or restricted before public production.

### 7.7 Firestore Database

Current Firestore database ID:

```text
ai-studio-c9668319-7568-4192-bd22-b18ccf709ab4
```

Current `firebase.json`:

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "database": "ai-studio-c9668319-7568-4192-bd22-b18ccf709ab4"
  }
}
```

Deploy rules:

```powershell
npx -y firebase-tools@latest deploy --only firestore --project hernancres-chatbot
```

### 7.8 Firestore Collections

| Collection | Purpose | Source usage |
|---|---|---|
| `admins` | Admin allow-list. | Checked by `isAdmin()` in rules. |
| `conversations` | Chat sessions, messages, ratings. | Widget writes, dashboard reads. |
| `analytics` | Query analytics and cited domains. | Widget writes, dashboard charts. |
| `faqs` | FAQ shortcuts and hardcoded answers. | Admin manages, widget displays. |
| `leads` | Captured email leads. | Widget writes, admin exports/deletes. |
| `settings` | Branding, prompts, alert config. | Admin writes, widget reads. |
| `audit` | Admin action log. | Admin writes, settings audit tab reads. |

### 7.9 Firestore Security Rules Current State

Current rules include:

- Default deny catch-all.
- `isSignedIn()`.
- `isAdmin()`.
- ID validation.
- Schema validation helpers for conversations, analytics, and FAQs.

However, the current rules also allow broad public access in several places:

- `conversations`: `allow get/list: if true`.
- `analytics`: `allow get/list: if true`.
- `faqs`: read/list true, create/update with schema only, delete true.
- `leads`: read/list true.
- `settings`: read true, create/update true.
- `audit`: read/list true, create with minimal validation.

This conflicts with the stricter intent in `security_spec.md`, which says global logs and conversations should be protected by authentication and admin controls.

Production action:

- Treat the current rules as staging or demo rules.
- Before public launch, update rules so:
  - Admin dashboard data is admin-only.
  - Leads are admin-only after creation.
  - Settings writes are admin-only.
  - Audit read/list is admin-only.
  - FAQ writes and deletes are admin-only.
  - Conversations are not publicly listable.
  - Anonymous widget writes are narrowly validated and rate-limited through App Check or a server function.

### 7.10 Firebase Hosting

Current `firebase.json`:

```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      { "source": "**", "destination": "/index.html" }
    ]
  }
}
```

The rewrite is required because the app uses static-friendly client routing such as `/embed`, `#/embed`, and query flags.

Deploy hosting:

```powershell
npm run build
npx -y firebase-tools@latest deploy --only hosting --project hernancres-chatbot
```

Deploy hosting and rules together:

```powershell
npm run build
npx -y firebase-tools@latest deploy --only hosting,firestore --project hernancres-chatbot
```

Note:

- `package.json` currently contains `firebase deploy --project hernancres-chatbot`.
- Prefer `npx -y firebase-tools@latest` in operator documentation to avoid depending on a globally installed CLI.

## 8. Resend Email Service Configuration

### 8.1 Decision

Use Resend as an add-on transactional email provider for notifications. Do not use it as the primary auth or data layer.

### 8.2 Current Source Integration

Source files:

```text
src/lib/resend.ts
src/components/admin/tabs/AlertsTab.tsx
src/components/EmbedChat.tsx
```

Current behavior:

- Reads `import.meta.env.VITE_RESEND_API_KEY`.
- Sends to Resend REST endpoint:

```text
POST https://api.resend.com/emails
```

- Uses `Authorization: Bearer <key>`.
- Supports fallback inline HTML.
- Exposes configurable admin recipients and template IDs through the Alerts tab.

### 8.3 Resend Account Setup

1. Create or sign into Resend.
2. Add a sending domain.
3. Add DNS records from Resend:
   - SPF.
   - DKIM.
   - Optional DMARC configuration.
4. Wait until the domain status is verified.
5. Create an API key.
6. Set `.env.local`:

```text
VITE_RESEND_API_KEY=<resend-api-key>
```

7. Configure Alert settings in the admin console:
   - Enable alerts.
   - Add admin recipient emails.
   - Select alert triggers.
   - Optionally add template IDs.

### 8.4 Recommended Sender Addresses

Use a verified subdomain for transactional mail:

```text
notifications.example.com
```

Example sender:

```text
HERA Tax Assistant <alerts@notifications.example.com>
```

Avoid production use of:

```text
onboarding@resend.dev
```

That address is fine for early testing only.

### 8.5 Template Configuration

Current alert config fields:

| Field | Purpose |
|---|---|
| `leadTemplateId` | Admin alert when a lead is captured. |
| `negativeRatingTemplateId` | Admin alert when response is rated down. |
| `newConversationTemplateId` | Admin alert for completed conversation. |
| `leadWelcomeTemplateId` | Welcome email sent directly to a lead. |

Important API compatibility note:

- Current code sends template payloads as `template_id` and `variables`.
- Current Resend API documentation describes template sending through a `template` object with `id` and `variables`.
- Before relying on Resend templates in production, verify the current API shape and update `sendTemplate()` if required.
- Fallback HTML sends use the standard `from`, `to`, `subject`, and `html` fields.

### 8.6 Production Hardening for Resend

The current implementation sends Resend requests from the browser. That means the Resend API key can be extracted from the built JavaScript.

Production requirement:

- Move Resend calls to a server-side function before public launch.

Preferred Google-first options:

- Firebase Cloud Functions HTTPS endpoint.
- Firebase callable function.
- Cloud Run service.
- Firebase Extension if the email workflow can fit a Firestore-trigger model.

Server-side function should:

- Store `RESEND_API_KEY` as a server-only secret.
- Validate the request body.
- Verify Firebase Auth token for admin-triggered actions.
- Validate App Check token for public widget actions.
- Rate-limit lead submission and rating alerts.
- Add an idempotency key for event-triggered emails.
- Never accept arbitrary recipient lists from unauthenticated public clients.

## 9. Data Model

### 9.1 Conversation

Current intended schema:

```json
{
  "id": "conv_...",
  "userId": "embed-widget",
  "title": "Question summary",
  "createdAt": "timestamp or ISO string",
  "updatedAt": "timestamp or ISO string",
  "messages": []
}
```

Optional fields used by the app:

```json
{
  "rating": "up",
  "ratingMessageId": "embed_msg_model_..."
}
```

### 9.2 Message

```json
{
  "id": "embed_msg_user_...",
  "role": "user",
  "text": "Question text",
  "timestamp": "10:30 AM",
  "groundingMetadata": {}
}
```

### 9.3 Analytics

```json
{
  "id": "anal_...",
  "query": "tax question",
  "timestamp": "2026-06-04T00:00:00.000Z",
  "domainCount": 1,
  "citedDomains": ["hasil.gov.my"],
  "clientEmail": "embed-widget"
}
```

### 9.4 FAQ

```json
{
  "id": "faq_val_1",
  "title": "Individual Tax Reliefs for YA 2025",
  "query": "What are the individual personal tax reliefs...",
  "answer": "Markdown answer",
  "order": 0,
  "enabled": true,
  "createdAt": "2026-06-04T00:00:00.000Z"
}
```

### 9.5 Lead

```json
{
  "id": "lead_...",
  "email": "user@example.com",
  "firstQuery": "first user query",
  "timestamp": "2026-06-04T00:00:00.000Z",
  "source": "embed-chat"
}
```

### 9.6 Settings

Known setting documents:

```text
settings/branding
settings/prompts
settings/alerts
```

### 9.7 Audit

```json
{
  "id": "audit_...",
  "action": "Prompt Saved",
  "detail": "Prompt updated",
  "adminEmail": "admin@example.com",
  "timestamp": "2026-06-04T00:00:00.000Z"
}
```

## 10. Admin Console Operations

### 10.1 Login

Path:

```text
/
```

Current login options:

- Email/password sign-in.
- Registration mode.
- Mock reviewer bypass.

Production rule:

- Disable mock bypass and open registration.
- Use admin allow-list documents in Firestore.
- Prefer Google sign-in or managed email/password accounts with MFA where available.

### 10.2 Dashboard

Dashboard shows:

- Total queries.
- Total conversations.
- Leads captured.
- Active today.
- 7-day activity chart.
- Ratings summary.
- Top queries.
- Recent activity.
- System health warnings.

### 10.3 Conversations

Administrators can:

- Review stored conversations.
- Inspect messages and citations.
- Delete conversations if rules allow.

Production rule:

- Conversations can contain user questions and possibly personal data. Restrict list/read to admins.

### 10.4 FAQs

Administrators can:

- Create FAQ shortcuts.
- Edit answer text.
- Reorder FAQs.
- Enable or disable FAQs.
- Populate defaults.

Widget behavior:

- Top three enabled FAQs appear on the empty-state screen.
- If FAQ has a hardcoded answer, the widget returns it without calling Gemini.

### 10.5 Playground

The playground tests grounded Gemini behavior with the active system prompt.

Use it for:

- Prompt regression testing.
- Citation checks.
- Response length checks.
- Off-topic refusal checks.

### 10.6 Leads

Administrators can:

- View captured leads.
- Export CSV.
- Delete leads if rules allow.

Production rule:

- Leads must not be publicly listable.
- CSV exports should be handled carefully because they contain personal data.

### 10.7 Email Alerts

Administrators can configure:

- Master alert toggle.
- Admin recipient list.
- Lead alerts.
- Negative rating alerts.
- New conversation alerts.
- Optional welcome email to leads.
- Template IDs.

### 10.8 Settings

Administrators can configure:

- System prompts.
- Active prompt.
- Branding colors and copy.
- Embed code.
- Audit trail review.

## 11. Public Embed Operations

### 11.1 Embed Routes

The app recognizes:

```text
/embed
#/embed
#embed
?view=embed
?embed=true
```

### 11.2 Iframe Embed

Admin settings generate code similar to:

```html
<iframe
  src="https://<hosting-domain>/#/embed"
  style="width:100%;max-width:420px;height:600px;border:none;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.12)"
  title="HERA"
  allow="clipboard-write"
></iframe>
```

### 11.3 Floating Widget Embed

The settings tab also provides a floating widget snippet that injects an iframe.

Production guidance:

- Add `sandbox` attribute if the embedding site does not need broad iframe capabilities.
- Restrict allowed origins if moving to server-side APIs.
- Add clear privacy copy near the widget if user inputs are stored.

## 12. Security and Compliance Notes

### 12.1 Current Strengths

- Firestore rules use default-deny catch-all.
- IDs are validated.
- Several schemas are type and size checked.
- Gemini prompt restricts sources to LHDN domain.
- Grounding metadata is filtered to `hasil.gov.my`.
- Off-topic and greeting prompts can be handled locally to reduce AI cost.
- Environment files and Firebase applet config are git-ignored.

### 12.2 Current Production Risks

| Risk | Current state | Required action |
|---|---|---|
| Gemini key exposure | Browser uses `VITE_GEMINI_API_KEY`. | Restrict key, monitor usage, consider Firebase AI Logic or server-side proxy. |
| Resend key exposure | Browser uses `VITE_RESEND_API_KEY`. | Move all Resend sends server-side. |
| Firestore public reads | Several collections are public list/read. | Harden rules before production. |
| Open settings writes | `settings` create/update currently true. | Restrict to admin only. |
| FAQ deletion | Current rules allow delete true. | Restrict to admin only. |
| Lead privacy | Leads are publicly listable in current rules. | Admin-only read/list/delete. |
| Mock admin bypass | Login UI includes reviewer bypass. | Remove or feature-flag for production. |
| Open registration | Login UI can create accounts. | Disable or gate account creation. |
| Prompt injection | User can attempt to bypass source rules. | Keep source filtering, add regression tests, consider server-side prompt enforcement. |

### 12.3 App Check

For production:

1. Register the web app in Firebase App Check.
2. Use reCAPTCHA Enterprise provider for web.
3. Add local debug provider for development.
4. Deploy client initialization before enabling enforcement.
5. Monitor metrics.
6. Enable enforcement for Firestore and any server functions.

### 12.4 Personal Data Handling

Potential personal data:

- Email leads.
- Chat questions.
- Query analytics.
- Admin emails in audit log.

Minimum policy:

- Tell users that conversations and emails may be stored.
- Do not export CSV unless needed.
- Limit admin access.
- Define retention for leads and conversations.
- Delete lead data on request.
- Avoid storing sensitive tax identifiers unless explicitly required.

### 12.5 Tax Advice Boundary

HERA should remain an assistant, not the final authority. Responses should:

- Cite official LHDN sources.
- Mention uncertainty when source coverage is partial.
- Encourage professional consultation for complex cases.
- Avoid making guarantees about eligibility without user-specific verification.

## 13. Deployment Procedure

### 13.1 Pre-Deployment Checklist

| Check | Command or location | Expected result |
|---|---|---|
| Dependencies installed | `npm install` | No install errors. |
| Env configured | `.env.local` | Gemini and Resend values present if required. |
| Firebase config exists | `firebase-applet-config.json` | Project values present. |
| Firebase login | `npx -y firebase-tools@latest login` | Correct account authenticated. |
| Firebase project selected | `npx -y firebase-tools@latest use hernancres-chatbot` | Active project confirmed. |
| Type check | `npm run lint` | TypeScript passes. |
| Production build | `npm run build` | `dist` generated. |
| Manual preview | `npm run preview` | App loads locally. |

### 13.2 Deploy Hosting Only

```powershell
npm run build
npx -y firebase-tools@latest deploy --only hosting --project hernancres-chatbot
```

### 13.3 Deploy Firestore Rules Only

```powershell
npx -y firebase-tools@latest deploy --only firestore --project hernancres-chatbot
```

### 13.4 Deploy Hosting and Rules

```powershell
npm run build
npx -y firebase-tools@latest deploy --only hosting,firestore --project hernancres-chatbot
```

### 13.5 Post-Deployment Checks

Open:

```text
https://hernancres-chatbot.web.app/
https://hernancres-chatbot.web.app/#/embed
```

Verify:

- Admin page loads.
- Embed page loads.
- Firebase status shows online.
- Gemini question returns a streamed answer.
- Sources only show `hasil.gov.my`.
- Conversation writes to Firestore.
- Analytics writes to Firestore.
- Lead capture writes to Firestore after trigger condition.
- Resend alert sends only if configured.

## 14. Certification and Test Guidelines

### 14.1 Test Result Statuses

Use:

- Pass.
- Fail.
- Blocked.
- Not applicable.

### 14.2 Test Case Template

| Field | Value |
|---|---|
| Test ID | TC-XX |
| Objective | What behavior is certified. |
| Preconditions | Required project state. |
| Steps | Actions to perform. |
| Expected result | Observable pass condition. |
| Evidence | Screenshot, console log, Firestore record, email ID, or command output. |
| Status | Pass, Fail, Blocked, Not applicable. |

### 14.3 Build and Runtime Tests

| ID | Objective | Steps | Expected result |
|---|---|---|---|
| TC-01 | TypeScript validation | Run `npm run lint`. | No TypeScript errors. |
| TC-02 | Production build | Run `npm run build`. | `dist` generated successfully. |
| TC-03 | Local preview | Run `npm run preview`. | App loads from preview URL. |
| TC-04 | Firebase config fallback | Temporarily remove local Firebase config. | App enters offline/sandbox mode without crashing. |
| TC-05 | Firebase config active | Restore config and reload. | App shows Firebase online. |

### 14.4 Chatbot Functional Tests

| ID | Objective | Test input | Expected result |
|---|---|---|---|
| TC-10 | Greeting local response | `hello` | No Gemini call required; greeting response appears. |
| TC-11 | Off-topic local response | `what is the weather today` | Tax-only redirection appears. |
| TC-12 | Tax response streaming | `What are individual tax reliefs for YA 2025?` | Streaming answer appears. |
| TC-13 | Source restriction | Any tax query | Sources only include `hasil.gov.my` or subdomains. |
| TC-14 | FAQ direct answer | Click FAQ with answer. | Hardcoded answer appears without search. |
| TC-15 | Reset chat | Click reset. | Current message list clears. |

### 14.5 Firestore Data Tests

| ID | Objective | Steps | Expected result |
|---|---|---|---|
| TC-20 | Conversation write | Ask a tax question. | `conversations/{sessionId}` created. |
| TC-21 | Analytics write | Ask a tax question. | `analytics/{analId}` created. |
| TC-22 | Lead write | Submit email after lead prompt appears. | `leads/{leadId}` created. |
| TC-23 | Settings update | Change branding and save. | `settings/branding` updated. |
| TC-24 | Audit write | Save prompt or branding. | `audit/{auditId}` created. |

### 14.6 Admin Tests

| ID | Objective | Steps | Expected result |
|---|---|---|---|
| TC-30 | Admin login | Sign in with valid account. | Dashboard appears. |
| TC-31 | Dashboard metrics | Load dashboard after activity. | KPIs reflect Firestore data. |
| TC-32 | FAQ management | Create, reorder, disable FAQ. | Widget reflects enabled sorted FAQs. |
| TC-33 | Lead export | Export CSV from Leads tab. | CSV downloads with lead rows. |
| TC-34 | Prompt activation | Activate another prompt. | Playground uses active prompt. |
| TC-35 | Logout | Click logout. | Session ends and login screen appears. |

### 14.7 Email Tests

| ID | Objective | Steps | Expected result |
|---|---|---|---|
| TC-40 | Resend key missing state | Remove `VITE_RESEND_API_KEY`, reload. | Alerts tab warns key is not configured. |
| TC-41 | Lead alert fallback | Enable lead alerts, submit lead. | Admin receives fallback HTML email. |
| TC-42 | Welcome email fallback | Enable welcome email, submit lead. | Lead receives welcome email. |
| TC-43 | Negative rating alert | Rate AI answer down. | Admin receives negative rating email. |
| TC-44 | Template send | Configure valid published template. | Email sends through template path. |

Important:

- TC-44 requires verifying and possibly updating `sendTemplate()` to match the current Resend API before certification.

### 14.8 Security Negative Tests

Use the `security_spec.md` "Dirty Dozen" payloads as the base negative suite. Add the following production-specific checks:

| ID | Objective | Expected result after hardening |
|---|---|---|
| TC-50 | Anonymous list conversations | Denied. |
| TC-51 | Anonymous list analytics | Denied. |
| TC-52 | Anonymous list leads | Denied. |
| TC-53 | Non-admin update settings | Denied. |
| TC-54 | Non-admin create FAQ | Denied. |
| TC-55 | Non-admin delete FAQ | Denied. |
| TC-56 | Non-admin read audit log | Denied. |
| TC-57 | Oversized query payload | Denied by rules or server validation. |
| TC-58 | Invalid document ID | Denied. |
| TC-59 | Resend arbitrary recipient abuse | Denied by server-side function. |

### 14.9 Acceptance Criteria

The project can be certified for production only when:

- Build passes.
- Firebase deploy succeeds.
- Auth works without mock bypass.
- Firestore rules pass positive and negative tests.
- Gemini answers are grounded to LHDN sources.
- Resend API key is no longer exposed client-side.
- App Check is deployed and enforcement plan is approved.
- Privacy copy and retention policy are approved.
- Admin access is restricted to known accounts.

## 15. Troubleshooting

### 15.1 App Shows Firebase Offline or Sandbox

Likely causes:

- Missing `firebase-applet-config.json`.
- Invalid Firebase config.
- Firestore database ID mismatch.
- Firebase app blocked by authorized domain setting.

Checks:

```powershell
Test-Path firebase-applet-config.json
Get-Content firebase-applet-config.json
npm run dev
```

### 15.2 Gemini Returns API Key Error

Likely causes:

- Missing `VITE_GEMINI_API_KEY`.
- Key not included at build time.
- API key restricted to wrong referrer.
- Gemini API not enabled.
- Key blocked or unrestricted policy issue.

Fix:

1. Update `.env.local`.
2. Restart Vite dev server.
3. Rebuild before deployment.
4. Check Google Cloud API restrictions.

### 15.3 Auth Popup or Login Fails

Likely causes:

- Provider not enabled.
- Domain not authorized.
- User does not exist.
- Weak password.
- Firebase config loading failed.

Fix:

- Enable Email/Password or Google provider.
- Add authorized domain without protocol or port.
- Create admin account.

### 15.4 Firestore Permission Denied

Likely causes:

- Rules deny operation.
- Missing required fields.
- Invalid ID.
- Wrong database ID.
- User is not admin.

Fix:

- Check browser console error.
- Check `firestore.rules`.
- Use Firebase Rules Simulator.
- Confirm document shape matches schema.

### 15.5 Resend Email Does Not Send

Likely causes:

- Missing `VITE_RESEND_API_KEY`.
- Domain not verified.
- Sender address not allowed.
- API payload shape changed.
- Browser CORS or key exposure restrictions.
- Template ID invalid or unpublished.

Fix:

- Test fallback HTML send first.
- Verify domain status in Resend.
- Check email logs.
- Move send path server-side.
- Update template payload to current Resend API if needed.

### 15.6 Deploy Command Fails

Use:

```powershell
npx -y firebase-tools@latest --version
npx -y firebase-tools@latest login
npx -y firebase-tools@latest use hernancres-chatbot
npm run build
npx -y firebase-tools@latest deploy --only hosting --project hernancres-chatbot
```

## 16. Operations Runbook

### 16.1 Daily Checks

- Check Firebase Hosting status.
- Check Firestore read/write errors.
- Check Gemini usage and quota.
- Check Resend delivery logs.
- Review negative ratings.
- Review lead exports only if needed.

### 16.2 Weekly Checks

- Review top queries and unanswered topics.
- Review prompt quality.
- Check API key usage.
- Confirm Firestore rules have not drifted.
- Export operational report if required.

### 16.3 Monthly Checks

- Rotate or audit API keys.
- Review Firebase billing.
- Review Resend sending domain status.
- Review admin accounts.
- Delete old leads and conversations based on retention policy.
- Run security negative tests.

### 16.4 Incident Response

If Gemini key is abused:

1. Disable or restrict the key immediately.
2. Create a replacement key.
3. Update `.env.local` or deployment env.
4. Rebuild and redeploy.
5. Review usage and billing.
6. Move calls server-side if not already done.

If Resend key is abused:

1. Revoke the Resend API key.
2. Create a new server-only key.
3. Disable browser-side sending.
4. Review Resend logs and suppressions.
5. Check unauthorized recipient activity.

If Firestore data is exposed:

1. Deploy emergency deny/list restrictions.
2. Review access logs where available.
3. Export affected record IDs for assessment.
4. Notify stakeholders according to privacy policy.
5. Patch rules and run negative tests.

## 17. Future Architecture Roadmap

### 17.1 Short Term

- Harden Firestore rules.
- Remove mock admin bypass from production.
- Disable open registration.
- Move Resend sending server-side.
- Add Firebase App Check.
- Add Firestore rules tests.

### 17.2 Medium Term

- Move Gemini calls to Firebase AI Logic or a server-side function.
- Add Cloud Functions for email, rate limits, and sensitive writes.
- Add structured audit events.
- Add retention automation for leads and conversations.
- Add CI build and deploy checks.

### 17.3 Long Term

- Evaluate BigQuery export for analytics.
- Evaluate Supabase or SQL Connect only if relational reporting becomes a primary requirement.
- Add organization/team roles.
- Add formal document retention and deletion workflow.
- Add human handoff workflow for complex tax questions.

## 18. External References

| Topic | Reference |
|---|---|
| CERN QA/SQAP layout inspiration | https://twiki.cern.ch/twiki/bin/view/EMI/SQAP |
| Referenced CERN certification guideline PDF | https://twiki.cern.ch/twiki/pub/EMI/EmiSa2CertTestGuidelines/741968.pdf |
| Google AI Studio | https://ai.google.dev/aistudio |
| Gemini API keys | https://ai.google.dev/gemini-api/docs/api-key |
| Google Cloud API key restrictions | https://cloud.google.com/docs/authentication/api-keys |
| Firebase web setup | https://firebase.google.com/docs/web/setup |
| Firebase Authentication Google sign-in | https://firebase.google.com/docs/auth/web/google-signin |
| Firebase Hosting quickstart | https://firebase.google.com/docs/hosting/quickstart |
| Firestore security rules | https://firebase.google.com/docs/firestore/security/get-started |
| Firebase App Check for web | https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider |
| Firebase AI Logic App Check | https://firebase.google.com/docs/ai-logic/app-check |
| Firebase products overview | https://firebase.google.com/products-build |
| Resend send email API | https://resend.com/docs/api-reference/emails/send-email |
| Resend domain management | https://resend.com/docs/dashboard/domains/introduction |
| Supabase architecture | https://supabase.com/docs/guides/getting-started/architecture |
| Vercel deployments | https://vercel.com/docs/deployments |

## 19. Change Log

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-06-04 | Codex | Initial project-specific architecture, configuration, deployment, and certification guide. |

