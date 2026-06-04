import React, { useState } from 'react';
import { Plus, Trash2, UserCircle2, X, Shield, Mail, Clock } from 'lucide-react';
import { BentoCard } from '../BentoCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export interface AllowedUser {
  id: string;
  email: string;
  addedAt: string;
  addedBy?: string;
}

interface UsersTabProps {
  users: AllowedUser[];
  isLiveFirebase: boolean;
  currentUser: any;
  onAddUser: (email: string) => Promise<void>;
  onRemoveUser: (id: string) => Promise<void>;
}

export function UsersTab({ users, isLiveFirebase, currentUser, onAddUser, onRemoveUser }: UsersTabProps) {
  const [showModal, setShowModal] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [removingId, setRemovingId] = useState<string | null>(null);

  const currentEmail = currentUser?.email ?? '';
  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const email = emailInput.trim().toLowerCase();
    if (!isValidEmail(email)) { setError('Enter a valid email address.'); return; }
    if (users.some((u) => u.email.toLowerCase() === email)) { setError('This email is already in the access list.'); return; }
    setSaving(true);
    setError('');
    try {
      await onAddUser(email);
      setEmailInput('');
      setShowModal(false);
    } catch {
      setError('Failed to add user. Try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(user: AllowedUser) {
    if (user.email.toLowerCase() === currentEmail.toLowerCase()) return;
    setRemovingId(user.id);
    try { await onRemoveUser(user.id); } finally { setRemovingId(null); }
  }

  return (
    <>
      {/* Add user modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Add User Access</h2>
              <button onClick={() => { setShowModal(false); setEmailInput(''); setError(''); }}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted cursor-pointer transition-colors">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Email Address</label>
                <div className="relative">
                  <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    type="email"
                    value={emailInput}
                    onChange={(e) => { setEmailInput(e.target.value); setError(''); }}
                    placeholder="user@example.com"
                    className="pl-8 h-9 text-sm"
                    autoFocus
                  />
                </div>
                {error && <p className="text-xs text-destructive">{error}</p>}
                <p className="text-xs text-muted-foreground">
                  This user will be able to log in to the admin console with this email.
                </p>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" type="button" onClick={() => { setShowModal(false); setEmailInput(''); setError(''); }}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving || !emailInput.trim()}>
                  {saving ? 'Adding…' : 'Add User'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="space-y-4">

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          <BentoCard>
            <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UserCircle2 size={16} />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Total Users</p>
            <p className="mt-0.5 text-2xl font-bold tracking-tight text-foreground tabular-nums">{users.length}</p>
          </BentoCard>

          <BentoCard>
            <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
              <Shield size={16} />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Access Level</p>
            <p className="mt-0.5 text-sm font-semibold text-foreground">Full Access</p>
          </BentoCard>

          <BentoCard
            className="flex flex-col items-center justify-center gap-2 border-dashed hover:bg-muted/30 transition-colors"
            onClick={() => setShowModal(true)}
          >
            <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Plus size={16} />
            </div>
            <p className="text-xs font-medium text-primary">Add User</p>
          </BentoCard>
        </div>

        {/* Users table */}
        <BentoCard padding={false} className="overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">Access List</h2>
              <Badge variant="secondary" className="text-xs">{users.length}</Badge>
            </div>
            <div className="flex items-center gap-3">
              {!isLiveFirebase && (
                <span className="text-xs text-amber-500">Firebase offline — changes won't persist</span>
              )}
              <Button size="sm" onClick={() => setShowModal(true)} className="h-7 text-xs gap-1.5">
                <Plus size={12} /> Add User
              </Button>
            </div>
          </div>

          {users.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center px-6">
              <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
                <UserCircle2 size={22} className="text-muted-foreground/40" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">No users yet</p>
                <p className="text-xs text-muted-foreground mt-1">Add the first user to grant admin console access.</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {users.map((user) => {
                const isSelf = user.email.toLowerCase() === currentEmail.toLowerCase();
                const addedDate = user.addedAt
                  ? new Date(user.addedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
                  : '—';
                return (
                  <div key={user.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/20 transition-colors">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <UserCircle2 size={15} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{user.email}</p>
                        {isSelf && <Badge variant="secondary" className="text-[10px] h-4 px-1.5">You</Badge>}
                      </div>
                      {user.addedBy && (
                        <p className="text-xs text-muted-foreground mt-0.5">Added by {user.addedBy}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap shrink-0">
                      <Clock size={11} />
                      {addedDate}
                    </div>
                    <button
                      onClick={() => handleRemove(user)}
                      disabled={isSelf || removingId === user.id}
                      title={isSelf ? "Can't remove yourself" : 'Remove user'}
                      className="flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shrink-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </BentoCard>
      </div>
    </>
  );
}