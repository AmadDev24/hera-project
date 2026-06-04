import React, { useState, useEffect } from 'react';
import {
  Settings, Paintbrush, Code2, FileText, Globe, Shield,
  Copy, Check, Download, Send, Palette, Type, MessageSquare,
  ChevronDown, Save,
} from 'lucide-react';
import { BentoCard } from '../BentoCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { BrandingConfig, SystemPromptConfig, AuditEntry } from '../../../types';

type SettingsSection = 'prompts' | 'branding' | 'embed' | 'audit';

const SECTION_META: Record<SettingsSection, { icon: React.ReactNode; label: string; desc: string }> = {
  prompts:  { icon: <FileText size={16} />,  label: 'Chatbot', desc: 'System prompt, model selection, and AI Studio link.' },
  branding: { icon: <Paintbrush size={16} />, label: 'Branding',      desc: 'Customize widget appearance, colors, and welcome text.' },
  embed:    { icon: <Code2 size={16} />,     label: 'Embed Code',    desc: 'Deploy the chatbot widget on any website.' },
  audit:    { icon: <Shield size={16} />,    label: 'Audit Trail',   desc: 'Track all admin actions for compliance.' },
};

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
}: SettingsTabProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>('prompts');
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<SystemPromptConfig | null>(
    prompts.find((p) => p.id === activePromptId) || prompts[0] || null,
  );
  const [promptDraft, setPromptDraft] = useState(editingPrompt?.prompt || '');
  const [promptLabel, setPromptLabel] = useState(editingPrompt?.label || '');
  const [brandDraft, setBrandDraft] = useState(branding);

  // Sync local state when Firestore props update
  useEffect(() => { setBrandDraft(branding); }, [branding]);
  useEffect(() => {
    const p = prompts.find((x) => x.id === activePromptId) || prompts[0] || null;
    if (p && p.id !== editingPrompt?.id) {
      setEditingPrompt(p);
      setPromptDraft(p.prompt);
      setPromptLabel(p.label);
    }
  }, [prompts, activePromptId]);

  const embedCode = `<!-- HERA Widget -->\n<iframe\n  src="${window.location.origin}/#/embed"\n  style="width:100%;max-width:420px;height:600px;border:none;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.12)"\n  title="HERA"\n  allow="clipboard-write"\n></iframe>`;

  const scriptEmbed = `<!-- HERA Floating Widget -->\n<div id="hasiltax-widget"></div>\n<script>\n  (function() {\n    var iframe = document.createElement('iframe');\n    iframe.src = '${window.location.origin}/#/embed';\n    iframe.style.cssText = 'position:fixed;bottom:20px;right:20px;width:380px;height:580px;border:none;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.15);z-index:9999';\n    document.getElementById('hasiltax-widget').appendChild(iframe);\n  })();\n</script>`;

  const handleCopyEmbed = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedEmbed(true);
      setTimeout(() => setCopiedEmbed(false), 2000);
    });
  };

  const handleSavePrompt = () => {
    if (!editingPrompt) return;
    onSavePrompt({
      ...editingPrompt,
      prompt: promptDraft,
      label: promptLabel || editingPrompt.label,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleSaveBranding = () => {
    onBrandingChange(brandDraft);
  };

  const renderSection = () => {
    switch (activeSection) {
      case 'prompts':
        return (
          <div className="space-y-4">
            {/* Chatbot model selector + AI Studio link */}
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="text-[10px] font-semibold text-foreground/80 uppercase tracking-wider">Selected Model</p>
                <select
                  value={selectedModel || ''}
                  onChange={(e) => onModelChange && onModelChange(e.target.value)}
                  className="mt-2 bg-background border border-border/60 rounded px-3 py-1 text-sm w-full"
                >
                  {models.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="shrink-0">
                <a
                  href={aiStudioUrl || 'https://ai.google.com/studio'}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs bg-muted/20 border border-border/40 hover:bg-muted/30"
                >
                  <MessageSquare size={12} /> Open AI Studio
                </a>
              </div>
            </div>
            {/* Prompt selector */}
            <div className="flex flex-wrap items-center gap-2">
              {prompts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setEditingPrompt(p);
                    setPromptDraft(p.prompt);
                    setPromptLabel(p.label);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    editingPrompt?.id === p.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {p.label}
                  {p.id === activePromptId && (
                    <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  )}
                </button>
              ))}
            </div>

            {/* Prompt label */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-foreground/80 uppercase tracking-wider">Prompt Label</label>
              <Input
                value={promptLabel}
                onChange={(e) => setPromptLabel(e.target.value)}
                placeholder="e.g. Individual Tax Advisor"
                className="h-9 text-xs"
              />
            </div>

            {/* Prompt editor */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-foreground/80 uppercase tracking-wider">System Prompt</label>
              <textarea
                value={promptDraft}
                onChange={(e) => setPromptDraft(e.target.value)}
                rows={12}
                className="w-full px-3 py-2.5 text-xs font-mono bg-muted/30 border border-border/60 rounded-xl outline-none focus:ring-1 focus:ring-primary resize-y leading-relaxed"
                placeholder="You are a helpful tax consultant..."
              />
              <p className="text-[9px] text-muted-foreground">{promptDraft.length} characters</p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleSavePrompt} className="h-8 text-xs gap-1.5">
                <Save size={12} /> Save Prompt
              </Button>
              {editingPrompt && editingPrompt.id !== activePromptId && (
                <Button variant="outline" size="sm" onClick={() => onActivatePrompt(editingPrompt.id)} className="h-8 text-xs gap-1.5">
                  <Send size={12} /> Set as Active
                </Button>
              )}
              <Badge variant={editingPrompt?.id === activePromptId ? 'default' : 'secondary'} className="text-[9px] ml-auto">
                {editingPrompt?.id === activePromptId ? '● Active' : '○ Draft'}
              </Badge>
            </div>
          </div>
        );

      case 'branding':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-foreground/80 uppercase tracking-wider">Primary Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={brandDraft.primaryColor}
                    onChange={(e) => setBrandDraft({ ...brandDraft, primaryColor: e.target.value })}
                    className="w-10 h-9 rounded-lg border border-border cursor-pointer"
                  />
                  <Input
                    value={brandDraft.primaryColor}
                    onChange={(e) => setBrandDraft({ ...brandDraft, primaryColor: e.target.value })}
                    className="h-9 text-xs font-mono flex-1"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-foreground/80 uppercase tracking-wider">Logo Letter</label>
                <Input
                  value={brandDraft.logoLetter}
                  onChange={(e) => setBrandDraft({ ...brandDraft, logoLetter: e.target.value.slice(0, 2) })}
                  maxLength={2}
                  className="h-9 text-xs text-center text-lg font-black"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-foreground/80 uppercase tracking-wider">Welcome Title</label>
              <Input
                value={brandDraft.welcomeTitle}
                onChange={(e) => setBrandDraft({ ...brandDraft, welcomeTitle: e.target.value })}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-foreground/80 uppercase tracking-wider">Welcome Subtitle</label>
              <Input
                value={brandDraft.welcomeSubtitle}
                onChange={(e) => setBrandDraft({ ...brandDraft, welcomeSubtitle: e.target.value })}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-foreground/80 uppercase tracking-wider">Disclaimer Text</label>
              <Input
                value={brandDraft.disclaimerText}
                onChange={(e) => setBrandDraft({ ...brandDraft, disclaimerText: e.target.value })}
                className="h-9 text-xs"
              />
            </div>

            {/* Preview */}
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Live Preview</p>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm"
                  style={{ backgroundColor: brandDraft.primaryColor }}
                >
                  {brandDraft.logoLetter || 'H'}
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{brandDraft.welcomeTitle || 'HERA'}</p>
                  <p className="text-[10px] text-muted-foreground">{brandDraft.welcomeSubtitle || 'LHDN Grounded Helper'}</p>
                </div>
              </div>
            </div>

            <Button size="sm" onClick={handleSaveBranding} className="h-8 text-xs gap-1.5">
              <Save size={12} /> Save Branding
            </Button>
          </div>
        );

      case 'embed':
        return (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-semibold text-foreground/80 uppercase tracking-wider">iFrame Embed (Full Page)</label>
                <Button variant="ghost" size="sm" onClick={() => handleCopyEmbed(embedCode)} className="h-6 text-[10px] gap-1">
                  {copiedEmbed ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} />}
                  {copiedEmbed ? 'Copied!' : 'Copy'}
                </Button>
              </div>
              <pre className="bg-muted/40 border border-border/40 rounded-xl p-3 text-[10px] font-mono overflow-x-auto leading-relaxed text-muted-foreground select-all">
                {embedCode}
              </pre>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-semibold text-foreground/80 uppercase tracking-wider">Floating Widget (Bottom-Right)</label>
                <Button variant="ghost" size="sm" onClick={() => handleCopyEmbed(scriptEmbed)} className="h-6 text-[10px] gap-1">
                  <Copy size={10} /> Copy
                </Button>
              </div>
              <pre className="bg-muted/40 border border-border/40 rounded-xl p-3 text-[10px] font-mono overflow-x-auto leading-relaxed text-muted-foreground select-all">
                {scriptEmbed}
              </pre>
            </div>
          </div>
        );

      case 'audit':
        return (
          <div className="space-y-3">
            {auditLog.length === 0 ? (
              <div className="text-center py-8">
                <Shield size={24} className="mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-xs text-muted-foreground">No admin actions recorded yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {[...auditLog].reverse().slice(0, 50).map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3 rounded-xl border border-border/30 bg-muted/10 px-3 py-2.5">
                    <Shield size={12} className="text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground">{entry.action}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{entry.detail}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[9px] text-muted-foreground font-mono">{entry.adminEmail}</p>
                      <p className="text-[9px] text-muted-foreground font-mono">
                        {new Date(entry.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <div className="grid grid-cols-12 auto-rows-[80px] gap-3">

      {/* Section Navigation — 3 cols */}
      <BentoCard className="col-span-12 lg:col-span-3 row-span-12 flex flex-col p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/40 shrink-0">
          <h2 className="text-sm font-semibold text-foreground">Settings</h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">Configure your chatbot service</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {(Object.entries(SECTION_META) as [SettingsSection, typeof SECTION_META[SettingsSection]][]).map(([key, meta]) => (
            <button
              key={key}
              onClick={() => setActiveSection(key)}
              className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-all cursor-pointer ${
                activeSection === key
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <span className="shrink-0">{meta.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{meta.label}</p>
                <p className={`text-[9px] truncate ${activeSection === key ? 'text-primary-foreground/70' : 'text-muted-foreground/60'}`}>
                  {meta.desc}
                </p>
              </div>
            </button>
          ))}
        </div>
      </BentoCard>

      {/* Section Content — 9 cols */}
      <BentoCard className="col-span-12 lg:col-span-9 row-span-12 flex flex-col p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-border/40 shrink-0">
          <div className="flex items-center gap-2">
            {SECTION_META[activeSection].icon}
            <h3 className="text-sm font-semibold text-foreground">{SECTION_META[activeSection].label}</h3>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">{SECTION_META[activeSection].desc}</p>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {renderSection()}
        </div>
      </BentoCard>

    </div>
  );
}