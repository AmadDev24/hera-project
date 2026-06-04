import React, { useState, useEffect } from 'react';
import {
  Paintbrush, Code2, FileText, Shield,
  Copy, Check, Send, MessageSquare,
  Save, Cpu, Loader2,
} from 'lucide-react';
import { BentoCard } from '../BentoCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { BrandingConfig, SystemPromptConfig, AuditEntry } from '../../../types';
import { type ModelInfo } from '../../../lib/gemini';

type SettingsSection = 'prompts' | 'branding' | 'embed' | 'audit';

const SECTIONS: { key: SettingsSection; icon: React.ReactNode; label: string; desc: string }[] = [
  { key: 'prompts',  icon: <FileText size={15} />,   label: 'Chatbot',     desc: 'System prompt & model' },
  { key: 'branding', icon: <Paintbrush size={15} />, label: 'Branding',    desc: 'Widget appearance' },
  { key: 'embed',    icon: <Code2 size={15} />,      label: 'Embed Code',  desc: 'Deploy the widget' },
  { key: 'audit',    icon: <Shield size={15} />,     label: 'Audit Trail', desc: 'Admin action log' },
];

interface SettingsTabProps {
  branding: BrandingConfig;
  onBrandingChange: (b: BrandingConfig) => void;
  prompts: SystemPromptConfig[];
  activePromptId: string | null;
  onSavePrompt: (p: SystemPromptConfig) => void;
  onActivatePrompt: (id: string) => void;
  auditLog: AuditEntry[];
  isLiveFirebase: boolean;
  models?: string[];
  selectedModel?: string | null;
  onModelChange?: (m: string) => void;
  aiStudioUrl?: string;
  modelInfos?: ModelInfo[];
  modelsLoading?: boolean;
}

function fmtTokens(n: number): string {
  if (n === 0) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

function fmtPrice(p: number | null): string {
  if (p === null) return '—';
  if (p === 0) return 'Free';
  return `$${p < 0.1 ? p.toFixed(4) : p.toFixed(2)}`;
}

export function SettingsTab({
  branding,
  onBrandingChange,
  prompts,
  activePromptId,
  onSavePrompt,
  onActivatePrompt,
  auditLog,
  isLiveFirebase,
  models = [],
  selectedModel = null,
  onModelChange,
  aiStudioUrl,
  modelInfos = [],
  modelsLoading = false,
}: SettingsTabProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>('prompts');
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<SystemPromptConfig | null>(
    prompts.find((p) => p.id === activePromptId) || prompts[0] || null,
  );
  const [promptDraft, setPromptDraft] = useState(editingPrompt?.prompt || '');
  const [promptLabel, setPromptLabel] = useState(editingPrompt?.label || '');
  const [brandDraft, setBrandDraft] = useState(branding);

  useEffect(() => { setBrandDraft(branding); }, [branding]);
  useEffect(() => {
    const p = prompts.find((x) => x.id === activePromptId) || prompts[0] || null;
    if (p && p.id !== editingPrompt?.id) {
      setEditingPrompt(p);
      setPromptDraft(p.prompt);
      setPromptLabel(p.label);
    }
  }, [prompts, activePromptId]);

  const embedCode = `<!-- HERA Widget -->\n<iframe\n  src="${window.location.origin}/embed"\n  style="width:100%;max-width:420px;height:600px;border:none;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.12)"\n  title="HERA"\n  allow="clipboard-write"\n></iframe>`;
  const scriptEmbed = `<!-- HERA Floating Widget -->\n<script src="${window.location.origin}/embed.js" defer><\/script>`;

  const handleCopyEmbed = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedEmbed(true);
      setTimeout(() => setCopiedEmbed(false), 2000);
    });
  };

  const handleSavePrompt = () => {
    if (!editingPrompt) return;
    onSavePrompt({ ...editingPrompt, prompt: promptDraft, label: promptLabel || editingPrompt.label, updatedAt: new Date().toISOString() });
  };

  const renderSection = () => {
    switch (activeSection) {
      case 'prompts':
        return (
          <div className="space-y-5">

            {/* Model table */}
            <div className="rounded-xl border border-border/50 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 bg-muted/20">
                <Cpu size={13} className="text-primary" />
                <p className="text-xs font-medium text-foreground">Available Models</p>
                {modelsLoading && <Loader2 size={11} className="text-muted-foreground animate-spin ml-1" />}
                {!modelsLoading && modelInfos.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] ml-auto">{modelInfos.length} models</Badge>
                )}
              </div>
              {modelsLoading ? (
                <div className="px-4 py-6 text-center">
                  <p className="text-xs text-muted-foreground">Loading models…</p>
                </div>
              ) : modelInfos.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <p className="text-xs text-muted-foreground">No models loaded — check VITE_GEMINI_API_KEY.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/30">
                        <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Model</th>
                        <th className="text-right text-xs font-medium text-muted-foreground px-3 py-2.5">Context</th>
                        <th className="text-right text-xs font-medium text-muted-foreground px-3 py-2.5">Output</th>
                        <th className="text-right text-xs font-medium text-muted-foreground px-3 py-2.5">In/1M</th>
                        <th className="text-right text-xs font-medium text-muted-foreground px-3 py-2.5">Out/1M</th>
                        <th className="px-3 py-2.5 w-16" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                      {modelInfos.map((m) => {
                        const isActive = selectedModel === m.name;
                        return (
                          <tr
                            key={m.name}
                            className={`transition-colors cursor-pointer ${isActive ? 'bg-primary/5' : 'hover:bg-muted/20'}`}
                            onClick={() => onModelChange && onModelChange(m.name)}
                          >
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                {isActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />}
                                <div>
                                  <p className={`text-xs font-medium truncate max-w-[160px] ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>{m.displayName}</p>
                                  <p className="text-[11px] font-mono text-muted-foreground/60 truncate max-w-[160px]">{m.name}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono text-xs text-muted-foreground">{fmtTokens(m.inputTokenLimit)}</td>
                            <td className="px-3 py-2.5 text-right font-mono text-xs text-muted-foreground">{fmtTokens(m.outputTokenLimit)}</td>
                            <td className="px-3 py-2.5 text-right font-mono text-xs text-muted-foreground">{fmtPrice(m.inputPricePerMillion)}</td>
                            <td className="px-3 py-2.5 text-right font-mono text-xs text-muted-foreground">{fmtPrice(m.outputPricePerMillion)}</td>
                            <td className="px-3 py-2.5 text-right">
                              {isActive ? (
                                <Badge className="text-[10px] px-1.5 h-5">Active</Badge>
                              ) : (
                                <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]"
                                  onClick={(e) => { e.stopPropagation(); onModelChange && onModelChange(m.name); }}>
                                  Use
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Model selector + AI Studio */}
            <div className="flex items-center gap-3">
              <div className="flex-1 space-y-1.5">
                <label className="text-xs font-medium text-foreground">Active Model</label>
                <select
                  value={selectedModel || ''}
                  onChange={(e) => onModelChange && onModelChange(e.target.value)}
                  className="h-9 w-full bg-background border border-border rounded-lg px-3 text-sm text-foreground"
                >
                  {models.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <a
                href={aiStudioUrl || 'https://ai.google.com/studio'}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 mt-5 inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <MessageSquare size={12} /> AI Studio
              </a>
            </div>

            {/* Prompt selector */}
            <div className="flex flex-wrap gap-2">
              {prompts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setEditingPrompt(p); setPromptDraft(p.prompt); setPromptLabel(p.label); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    editingPrompt?.id === p.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {p.label}
                  {p.id === activePromptId && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                </button>
              ))}
            </div>

            {/* Prompt label */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Prompt Label</label>
              <Input value={promptLabel} onChange={(e) => setPromptLabel(e.target.value)} placeholder="e.g. Individual Tax Advisor" className="h-9 text-xs" />
            </div>

            {/* Prompt editor */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">System Prompt</label>
              <textarea
                value={promptDraft}
                onChange={(e) => setPromptDraft(e.target.value)}
                rows={12}
                className="w-full px-3 py-2.5 text-xs font-mono bg-muted/20 border border-border/50 rounded-xl outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y leading-relaxed transition-colors"
                placeholder="You are a helpful tax consultant…"
              />
              <p className="text-xs text-muted-foreground">{promptDraft.length.toLocaleString()} characters</p>
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleSavePrompt} className="h-8 text-xs gap-1.5">
                <Save size={12} /> Save Prompt
              </Button>
              {editingPrompt && editingPrompt.id !== activePromptId && (
                <Button variant="outline" size="sm" onClick={() => onActivatePrompt(editingPrompt.id)} className="h-8 text-xs gap-1.5">
                  <Send size={12} /> Set Active
                </Button>
              )}
              <Badge variant={editingPrompt?.id === activePromptId ? 'default' : 'secondary'} className="text-[10px] ml-auto">
                {editingPrompt?.id === activePromptId ? 'Active' : 'Draft'}
              </Badge>
            </div>
          </div>
        );

      case 'branding':
        return (
          <div className="space-y-5">
            {/* Widget appearance */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Widget Appearance</p>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Primary Color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={brandDraft.primaryColor}
                      onChange={(e) => setBrandDraft({ ...brandDraft, primaryColor: e.target.value })}
                      className="h-9 w-10 rounded-lg border border-border cursor-pointer shrink-0" />
                    <Input value={brandDraft.primaryColor}
                      onChange={(e) => setBrandDraft({ ...brandDraft, primaryColor: e.target.value })}
                      className="h-9 text-xs font-mono flex-1" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Logo Letter</label>
                  <Input value={brandDraft.logoLetter}
                    onChange={(e) => setBrandDraft({ ...brandDraft, logoLetter: e.target.value.slice(0, 2) })}
                    maxLength={2} className="h-9 text-center text-lg font-black" />
                </div>
              </div>

              <div className="space-y-1.5 mb-3">
                <label className="text-xs font-medium text-foreground">Welcome Title</label>
                <Input
                  value={brandDraft.welcomeTitle ?? ''}
                  onChange={(e) => setBrandDraft({ ...brandDraft, welcomeTitle: e.target.value })}
                  placeholder="e.g. HERA Tax Assistant"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5 mb-3">
                <label className="text-xs font-medium text-foreground">Welcome Subtitle</label>
                <p className="text-[11px] text-muted-foreground mb-1.5">
                  Opening message shown in the chat widget before the user sends any message.
                </p>
                <textarea
                  value={brandDraft.welcomeSubtitle ?? ''}
                  onChange={(e) => setBrandDraft({ ...brandDraft, welcomeSubtitle: e.target.value })}
                  rows={3}
                  placeholder="e.g. Hello! I'm Hera, your virtual Malaysian tax consultant…"
                  className="w-full px-3 py-2.5 text-xs bg-background border border-border/50 rounded-xl outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none transition-colors"
                />
              </div>
            </div>

            {/* Company contact info */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Company Contact Info</p>
              <p className="text-xs text-muted-foreground mb-3">
                Shown when clients ask "what is your email / phone / address / business hours" in the chatbot.
              </p>
              {[
                { key: 'companyName',    label: 'Company Name',    placeholder: 'e.g. HernanCres Tax Advisory Sdn Bhd' },
                { key: 'companyEmail',   label: 'Email Address',   placeholder: 'e.g. info@hernancres.com' },
                { key: 'companyPhone',   label: 'Phone / WhatsApp', placeholder: 'e.g. +60 12-345 6789' },
                { key: 'companyAddress', label: 'Office Address',   placeholder: 'e.g. Suite 12A, Menara KLCC, Kuala Lumpur' },
                { key: 'businessHours',  label: 'Business Hours',   placeholder: 'e.g. Mon–Fri 9am–6pm, Sat 9am–1pm' },
              ].map((field) => (
                <div key={field.key} className="space-y-1.5 mb-3">
                  <label className="text-xs font-medium text-foreground">{field.label}</label>
                  <Input
                    value={(brandDraft as any)[field.key] ?? ''}
                    onChange={(e) => setBrandDraft({ ...brandDraft, [field.key]: e.target.value })}
                    placeholder={field.placeholder}
                    className="h-9 text-xs"
                  />
                </div>
              ))}
            </div>

            {/* Preview */}
            <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
              <p className="text-xs text-muted-foreground mb-3">Widget Preview</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0"
                  style={{ backgroundColor: brandDraft.primaryColor }}>
                  {brandDraft.logoLetter || 'H'}
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{brandDraft.welcomeTitle || 'HERA'}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{brandDraft.welcomeSubtitle || 'LHDN Grounded Helper'}</p>
                </div>
              </div>
            </div>

            <Button size="sm" onClick={() => onBrandingChange(brandDraft)} className="h-8 text-xs gap-1.5">
              <Save size={12} /> Save Branding
            </Button>
          </div>
        );

      case 'embed':
        return (
          <div className="space-y-5">
            {[
              { label: 'iFrame Embed (Full Page)', code: embedCode },
              { label: 'Floating Widget Script', code: scriptEmbed },
            ].map((item) => (
              <div key={item.label} className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-foreground">{item.label}</label>
                  <Button variant="ghost" size="sm" onClick={() => handleCopyEmbed(item.code)} className="h-6 text-xs gap-1.5">
                    {copiedEmbed ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                    {copiedEmbed ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
                <pre className="bg-muted/30 border border-border/40 rounded-xl p-4 text-xs font-mono overflow-x-auto leading-relaxed text-muted-foreground select-all">
                  {item.code}
                </pre>
              </div>
            ))}
          </div>
        );

      case 'audit':
        return (
          <div className="space-y-2">
            {auditLog.length === 0 ? (
              <div className="text-center py-12">
                <Shield size={24} className="mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-xs text-muted-foreground">No admin actions recorded yet.</p>
              </div>
            ) : (
              [...auditLog].reverse().slice(0, 50).map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 rounded-lg border border-border/30 bg-muted/10 px-4 py-3">
                  <Shield size={12} className="text-muted-foreground mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground">{entry.action}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{entry.detail}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[11px] font-mono text-muted-foreground">{entry.adminEmail}</p>
                    <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                      {new Date(entry.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        );
    }
  };

  return (
    <div className="grid lg:grid-cols-[200px_1fr] gap-4 min-h-[600px]">

      {/* Section navigation */}
      <div className="space-y-1">
        {SECTIONS.map((section) => (
          <button
            key={section.key}
            onClick={() => setActiveSection(section.key)}
            className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors cursor-pointer ${
              activeSection === section.key
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <span className="shrink-0">{section.icon}</span>
            <div className="min-w-0">
              <p className="text-xs font-medium truncate">{section.label}</p>
              <p className={`text-[11px] truncate ${activeSection === section.key ? 'text-primary-foreground/70' : 'text-muted-foreground/60'}`}>
                {section.desc}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* Section content */}
      <BentoCard padding={false} className="flex flex-col overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border/40 shrink-0">
          <h3 className="text-sm font-semibold text-foreground">
            {SECTIONS.find((s) => s.key === activeSection)?.label}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {SECTIONS.find((s) => s.key === activeSection)?.desc}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {renderSection()}
        </div>
      </BentoCard>
    </div>
  );
}