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
  requiresHelp?: boolean; // true when expert lead was triggered
  source?: string;        // 'embed-widget' | 'playground' | etc.
}

export interface Lead {
  id: string;
  name?: string;       // client name (optional)
  email?: string;      // email OR phone required (at least one)
  phone?: string;      // Malaysian local format, e.g. "012-3456789"
  firstQuery: string;
  timestamp: string;
  source: string;
  sessionId?: string;  // chat session that captured this lead
  userId?: string;     // persistent device ID
  notes?: string;
}

export interface BrandingConfig {
  primaryColor: string;
  welcomeTitle: string;
  welcomeSubtitle: string;
  logoLetter: string;
  // Company contact info (shown when clients ask about contact/location/hours)
  companyName?: string;
  companyEmail?: string;
  companyPhone?: string;
  companyAddress?: string;
  businessHours?: string;
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
  // Customizable complex-tax response message (shown instead of AI response for specialist topics)
  complexTaxResponseEn: string;
  complexTaxResponseBm: string;
}
