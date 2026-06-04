export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

export interface GroundingMetadata {
  webSearchQueries?: string[];
  groundingChunks?: GroundingChunk[];
  searchEntryPoint?: {
    renderedContent?: string;
  };
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  groundingMetadata?: GroundingMetadata;
  isSearchingLogs?: string[]; // Log of searching states
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  userId?: string;
  updatedAt?: string;
  rating?: 'up' | 'down';
  ratingNote?: string;
}

export interface Lead {
  id: string;
  email?: string;      // email OR phone required (at least one)
  phone?: string;      // E.164-style, e.g. "+60123456789"
  countryCode?: string; // e.g. "+60"
  firstQuery: string;
  timestamp: string;
  source: string;
  notes?: string;
}

export interface BrandingConfig {
  primaryColor: string;
  welcomeTitle: string;
  welcomeSubtitle: string;
  disclaimerText: string;
  logoLetter: string;
}

export interface SystemPromptConfig {
  id: string;
  prompt: string;
  label: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface AuditEntry {
  id: string;
  action: string;
  detail: string;
  adminEmail: string;
  timestamp: string;
}

export interface AlertConfig {
  enabled: boolean;
  // Recipients — comma-separated email addresses
  adminEmails: string;
  // Alert toggles
  notifyOnLeads: boolean;
  notifyOnNegativeRating: boolean;
  notifyOnNewConversation: boolean;
  // Resend template IDs (from Resend dashboard)
  leadTemplateId: string;
  negativeRatingTemplateId: string;
  newConversationTemplateId: string;
  // Send welcome email to the lead directly
  sendLeadWelcomeEmail: boolean;
  leadWelcomeTemplateId: string;
}
