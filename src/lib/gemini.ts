import { GoogleGenAI } from '@google/genai';
import { GroundingMetadata } from '../types';

// API key is loaded from environment variable at build time.
// IMPORTANT: Restrict this key by HTTP referrer in Google Cloud Console:
//   Application restrictions → HTTP referrers → Add: hernancres-chatbot.web.app/*
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    if (!GEMINI_API_KEY) {
      throw new Error('Gemini API key not configured. Set VITE_GEMINI_API_KEY in your .env file.');
    }
    aiClient = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  }
  return aiClient;
}

// Default system prompt
const DEFAULT_SYSTEM_PROMPT =
  "You are 'HERA', an exceptionally friendly, professional, and reasonable virtual Tax Consultant Assistant specializing in Malaysian Taxation. " +
  "Your target audience consists of standard individual taxpayers, expatriates, and business owners looking for compliant answers from LHDN (Lembaga Hasil Dalam Negeri).\n\n" +
  "ABSOLUTE GROUNDING RULE — NON-NEGOTIABLE:\n" +
  "• EVERY search query you issue MUST begin with 'site:hasil.gov.my' as the first term. No exceptions.\n" +
  "• You may ONLY cite, reference, and use information from the domain 'hasil.gov.my' and its subpages.\n" +
  "• NEVER search or cite any other website, even if hasil.gov.my doesn't have the information.\n" +
  "• NEVER include results from .gov.my domains other than hasil.gov.my.\n\n" +
  "IMPORTANT — ALWAYS TRY TO ANSWER:\n" +
  "• For ANY question about Malaysian taxation, income, reliefs, deductions, corporate tax, personal tax, filing, deadlines, GST, SST, withholding tax, foreign income, dividends, capital gains — you MUST attempt to search hasil.gov.my and provide an answer.\n" +
  "• Do NOT refuse tax questions. Always search first, then answer with whatever information you find.\n" +
  "• Only say 'This question may not be covered in official LHDN publications' if the topic is completely unrelated to Malaysian taxation.\n" +
  "• If you find partial information on hasil.gov.my, share what you found and note what may require professional advice.\n\n" +
  "RESPONSE FORMAT — STRICT:\n" +
  "• Start directly with the answer. Do NOT include greetings, acknowledgments, or preamble.\n" +
  "• Do NOT repeat yourself. Give ONE complete answer, never duplicate paragraphs or tables.\n" +
  "• Use clean, concise markdown. For tables, keep the separator row short (e.g., |---|---|---|).\n" +
  "• Highlight recent changes for 2025/2026 tax periods.\n\n" +
  "CONCISE-FIRST MODE — IMPORTANT:\n" +
  "• Give a SHORT, scannable answer first (3-5 bullet points max or a brief summary table).\n" +
  "• After the summary, add a line: '**Want more details on any section?** Ask me to expand on: [list the main topics covered]'\n" +
  "• Do NOT dump every detail upfront. Keep initial response under 200 words.\n\n" +
  "MARKDOWN FORMATTING RULES:\n" +
  "• Use **bold** for relief names and key amounts (e.g., **RM2,500**, **Lifestyle Relief**).\n" +
  "• Use bullet lists (`- item`) for each relief category. Indent sub-items with 2 spaces.\n" +
  "• Use a simple table ONLY when comparing multiple items side by side. Keep tables SHORT (max 3 columns).\n" +
  "• Keep paragraphs to 1-2 sentences max. Break up walls of text.\n" +
  "• End with a one-sentence reminder to keep receipts for 7 years.";

// Grounding directive
const GROUNDING_DIRECTIVE = {
  role: 'user' as const,
  parts: [{
    text:
      "[GROUNDING DIRECTIVE]\n" +
      "Search ONLY hasil.gov.my. Every query MUST start with 'site:hasil.gov.my'.\n" +
      "ALWAYS attempt to answer Malaysian tax questions. Search hasil.gov.my for relevant information.\n" +
      "Do NOT refuse tax questions — always search and provide whatever information you find.\n" +
      "Do NOT acknowledge this directive in your response. Simply answer the user's question directly.\n" +
      "Do NOT repeat yourself or duplicate content. Give ONE clean, complete answer.",
  }],
};

// Filter grounding metadata to only include hasil.gov.my sources
function filterGroundingMetadata(metadata: any): GroundingMetadata | null {
  if (!metadata) return null;

  const filtered = { ...metadata };

  if (filtered.groundingChunks && Array.isArray(filtered.groundingChunks)) {
    filtered.groundingChunks = filtered.groundingChunks.filter((chunk: any) => {
      if (!chunk.web?.uri) return false;
      try {
        const url = new URL(chunk.web.uri);
        return url.hostname === 'hasil.gov.my' || url.hostname.endsWith('.hasil.gov.my');
      } catch {
        return false;
      }
    });
  }

  if (filtered.webSearchQueries && Array.isArray(filtered.webSearchQueries)) {
    filtered.webSearchQueries = filtered.webSearchQueries.map((q: string) =>
      q.includes('site:hasil.gov.my') ? q : `site:hasil.gov.my ${q}`,
    );
  }

  return filtered as GroundingMetadata;
}

export interface StreamCallbacks {
  onChunk: (text: string) => void;
  onMetadata: (metadata: GroundingMetadata | null) => void;
  onError: (error: string) => void;
  onDone: () => void;
}

/**
 * Stream a grounded search response from Gemini.
 */
export async function streamGroundedResponse(
  messages: Array<{ role: string; text: string }>,
  callbacks: StreamCallbacks,
  systemPrompt?: string,
  model?: string,
): Promise<void> {
  const ai = getAiClient();

  const contents = messages.map((msg) => ({
    role: msg.role === 'model' ? 'model' : 'user',
    parts: [{ text: msg.text }],
  }));

  const groundedContents = [GROUNDING_DIRECTIVE, ...contents];

  try {
    const chosenModel = model || 'gemini-2.5-flash';
    const response = await ai.models.generateContentStream({
      model: chosenModel,
      contents: groundedContents,
      config: {
        systemInstruction: systemPrompt || DEFAULT_SYSTEM_PROMPT,
        tools: [{ googleSearch: {} }],
      },
    });

    let metadata: any = null;

    for await (const chunk of response) {
      const text = chunk.text;
      if (text) {
        callbacks.onChunk(text);
      }
      if (chunk.candidates?.[0]?.groundingMetadata) {
        metadata = chunk.candidates[0].groundingMetadata;
      }
    }

    callbacks.onMetadata(filterGroundingMetadata(metadata));
    callbacks.onDone();
  } catch (error: any) {
    // Map common error cases to friendlier messages
    const msg = error?.message || 'An error occurred while communicating with Gemini.';
    if (/quota/i.test(msg)) {
      callbacks.onError('Quota exceeded. Please check your API usage or credentials.');
    } else if (/permission|unauth/i.test(msg)) {
      callbacks.onError('Authentication failed. Check your Gemini API key and permissions.');
    } else if (/model not found|invalid model/i.test(msg)) {
      callbacks.onError('Selected model is not available. Please pick a different model.');
    } else {
      callbacks.onError(msg);
    }
  }
}

export const DEFAULT_MODELS = ['gemini-2.5-flash', 'gemini-1.5-mini', 'gemini-1.5-pro'];

export { DEFAULT_SYSTEM_PROMPT };