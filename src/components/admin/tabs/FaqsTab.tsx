import React, { useState } from 'react';
import { Plus, Edit3, Trash2, BookOpen, X, Search, Eye, EyeOff, Sparkles, ChevronUp, ChevronDown } from 'lucide-react';
import { BentoCard } from '../BentoCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export interface Faq {
  id: string;
  title?: string;
  query: string;
  answer: string;
  order: number;
  enabled: boolean;
  createdAt?: string;
}

type EditorState = { mode: 'create' | 'edit'; faq: Partial<Faq> } | null;

interface FaqsTabProps {
  faqs: Faq[];
  isLiveFirebase: boolean;
  onSaveFaq: (faq: Partial<Faq>, mode: 'create' | 'edit') => Promise<void>;
  onDeleteFaq: (id: string) => Promise<void>;
  onPopulateDefaults: () => Promise<void>;
  onReorder: (reordered: Faq[]) => Promise<void>;
  onToggleEnabled: (faq: Faq) => Promise<void>;
  isInitializingFaqs: boolean;
}

export function FaqsTab({
  faqs,
  isLiveFirebase,
  onSaveFaq,
  onDeleteFaq,
  onPopulateDefaults,
  onReorder,
  onToggleEnabled,
  isInitializingFaqs,
}: FaqsTabProps) {
  const [editor, setEditor] = useState<EditorState>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const sorted   = [...faqs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const filtered = sorted.filter((f) =>
    !search || f.query.toLowerCase().includes(search.toLowerCase()) || f.answer.toLowerCase().includes(search.toLowerCase())
  );
  const enabledCount = faqs.filter((f) => f.enabled).length;

  function updateField(field: string, value: string) {
    setEditor((prev) => (prev ? { ...prev, faq: { ...prev.faq, [field]: value } } : prev));
  }

  async function handleSave() {
    if (!editor) return;
    setSaving(true);
    try {
      await onSaveFaq(editor.faq, editor.mode);
      setEditor(null);
    } finally {
      setSaving(false);
    }
  }

  async function handlePrettify(field: 'query' | 'answer') {
    if (!editor) return;
    const text = editor.faq[field] || '';
    if (!text.trim()) return;
    let prettified = text.trim().replace(/\s+/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
    if (!prettified.endsWith('.') && !prettified.endsWith('?') && !prettified.endsWith('!')) {
      prettified += field === 'query' ? '?' : '.';
    }
    updateField(field, prettified);
  }

  function moveFaq(fromIdx: number, direction: 'up' | 'down') {
    const toIdx = direction === 'up' ? fromIdx - 1 : fromIdx + 1;
    if (toIdx < 0 || toIdx >= sorted.length) return;
    const reordered = [...sorted];
    [reordered[fromIdx], reordered[toIdx]] = [reordered[toIdx], reordered[fromIdx]];
    onReorder(reordered.map((f, i) => ({ ...f, order: i })));
  }

  const canSave = editor?.faq.query?.trim() && editor?.faq.answer?.trim();

  return (
    <>
      {/* Modal editor */}
      {editor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">
                {editor.mode === 'create' ? 'Add FAQ' : 'Edit FAQ'}
              </h2>
              <button onClick={() => setEditor(null)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted cursor-pointer transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-foreground">Question</label>
                  <button type="button" onClick={() => handlePrettify('query')} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors cursor-pointer">
                    <Sparkles size={11} /> Auto-format
                  </button>
                </div>
                <textarea rows={3} value={editor.faq.query ?? ''} onChange={(e) => updateField('query', e.target.value)}
                  placeholder="The question text shown to users…"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none transition-colors" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-foreground">Answer</label>
                  <button type="button" onClick={() => handlePrettify('answer')} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors cursor-pointer">
                    <Sparkles size={11} /> Auto-format
                  </button>
                </div>
                <textarea rows={6} value={editor.faq.answer ?? ''} onChange={(e) => updateField('answer', e.target.value)}
                  placeholder="Pre-written answer shown to the user. Supports markdown…"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-mono outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none transition-colors" />
                <p className="text-xs text-muted-foreground mt-1.5">Supports markdown. Shown directly without querying the AI.</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setEditor(null)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving || !canSave}>
                {saving ? 'Saving…' : editor.mode === 'create' ? 'Create FAQ' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">

        {/* Stats + add button */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <BentoCard>
            <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BookOpen size={16} />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Total FAQs</p>
            <p className="mt-0.5 text-2xl font-bold tracking-tight text-foreground tabular-nums">{faqs.length}</p>
          </BentoCard>

          <BentoCard>
            <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
              <Eye size={16} />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Visible (Top 3)</p>
            <p className="mt-0.5 text-2xl font-bold tracking-tight text-foreground tabular-nums">{Math.min(enabledCount, 3)}</p>
          </BentoCard>

          <BentoCard>
            <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <EyeOff size={16} />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Disabled</p>
            <p className="mt-0.5 text-2xl font-bold tracking-tight text-foreground tabular-nums">{faqs.length - enabledCount}</p>
          </BentoCard>

          <BentoCard
            className="flex flex-col items-center justify-center gap-2 border-dashed hover:bg-muted/30 transition-colors"
            onClick={() => setEditor({ mode: 'create', faq: { query: '', answer: '', order: faqs.length, enabled: true } })}
          >
            <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Plus size={16} />
            </div>
            <p className="text-xs font-medium text-primary">New FAQ</p>
          </BentoCard>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search FAQs…" className="pl-8 h-8 text-xs" />
          </div>
          <span className="text-xs text-muted-foreground ml-auto">{filtered.length} FAQs</span>
          {isLiveFirebase && faqs.length === 0 && (
            <Button variant="outline" size="sm" onClick={onPopulateDefaults} disabled={isInitializingFaqs} className="text-xs h-8">
              {isInitializingFaqs ? 'Loading…' : 'Load Defaults'}
            </Button>
          )}
          <Button size="sm" onClick={() => setEditor({ mode: 'create', faq: { query: '', answer: '', order: faqs.length, enabled: true } })} className="h-8 text-xs gap-1.5">
            <Plus size={12} /> Add FAQ
          </Button>
        </div>

        {/* FAQ grid */}
        {filtered.length === 0 ? (
          <BentoCard className="flex flex-col items-center justify-center text-center gap-3 py-12">
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
              <BookOpen size={22} className="text-muted-foreground/40" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">No FAQs found</p>
              <p className="text-xs text-muted-foreground mt-1">
                {faqs.length === 0 ? 'Add your first FAQ or load the defaults.' : 'No results match your search.'}
              </p>
            </div>
          </BentoCard>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((faq, idx) => (
              <BentoCard
                key={faq.id}
                className={`flex flex-col justify-between gap-3 transition-all ${!faq.enabled ? 'opacity-50' : ''}`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => moveFaq(idx, 'up')} disabled={idx === 0}
                        className="p-0.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors cursor-pointer disabled:cursor-not-allowed">
                        <ChevronUp size={11} />
                      </button>
                      <button onClick={() => moveFaq(idx, 'down')} disabled={idx === sorted.length - 1}
                        className="p-0.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors cursor-pointer disabled:cursor-not-allowed">
                        <ChevronDown size={11} />
                      </button>
                    </div>
                    <span className="text-[11px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      #{faq.order ?? idx + 1}
                    </span>
                    {idx < 3 && faq.enabled && (
                      <Badge className="text-[10px] px-1.5 h-4">Top 3</Badge>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => onToggleEnabled(faq)}
                      className={`p-1 rounded-lg transition-colors cursor-pointer ${
                        faq.enabled ? 'text-emerald-500 hover:bg-emerald-500/10' : 'text-muted-foreground hover:bg-muted'
                      }`}
                      title={faq.enabled ? 'Disable' : 'Enable'}>
                      {faq.enabled ? <Eye size={13} /> : <EyeOff size={13} />}
                    </button>
                    <button onClick={() => setEditor({ mode: 'edit', faq: { ...faq } })}
                      className="p-1 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer">
                      <Edit3 size={13} />
                    </button>
                    <button onClick={() => onDeleteFaq(faq.id)}
                      className="p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Question */}
                <p className="text-xs font-medium text-foreground leading-snug line-clamp-2">"{faq.query}"</p>

                {/* Answer preview */}
                <div className="border-t border-border/30 pt-2.5">
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{faq.answer}</p>
                </div>
              </BentoCard>
            ))}
          </div>
        )}
      </div>
    </>
  );
}