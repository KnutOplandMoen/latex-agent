'use client';

import { useState, useEffect, useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Share2, X, Loader2, Copy, Check, Trash2 } from 'lucide-react';
import type { ProjectMemberWithUser, Invite } from '@latex-ide/shared-types';
import type { ApiClient } from '@/lib/api';

interface ShareDialogProps {
  projectId: string;
  currentUserId: string;
  api: ApiClient;
}

export function ShareDialog({ projectId, currentUserId, api }: ShareDialogProps) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<ProjectMemberWithUser[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('editor');
  const [inviting, setInviting] = useState(false);
  const [newInviteLink, setNewInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const isOwner = members.find((m) => m.userId === currentUserId)?.role === 'owner';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, i] = await Promise.all([
        api.members.list(projectId),
        api.members.list(projectId).then(() => api.invites.list(projectId)).catch(() => [] as Invite[]),
      ]);
      setMembers(m);
      // invites only visible to owner; non-owners get empty array
      if (m.find((mem) => mem.userId === currentUserId)?.role === 'owner') {
        const inv = await api.invites.list(projectId);
        setInvites(inv.filter((i) => !i.acceptedAt));
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [api, projectId, currentUserId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setInviting(true);
    setError('');
    setNewInviteLink(null);
    try {
      const invite = await api.invites.create(projectId, { email: email.trim(), role });
      const link = `${window.location.origin}/invites/${invite.token}/accept`;
      setNewInviteLink(link);
      setEmail('');
      setInvites((prev) => [invite, ...prev]);
    } catch {
      setError('Failed to create invite. Check the email and try again.');
    } finally {
      setInviting(false);
    }
  }

  async function handleCopyLink() {
    if (!newInviteLink) return;
    await navigator.clipboard.writeText(newInviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleChangeRole(userId: string, newRole: 'editor' | 'viewer') {
    try {
      const updated = await api.members.updateRole(projectId, userId, newRole);
      setMembers((prev) => prev.map((m) => (m.userId === userId ? updated : m)));
    } catch {
      setError('Failed to update role.');
    }
  }

  async function handleRemoveMember(userId: string) {
    try {
      await api.members.remove(projectId, userId);
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
    } catch {
      setError('Failed to remove member.');
    }
  }

  async function handleCancelInvite(inviteId: string) {
    try {
      await api.invites.cancel(projectId, inviteId);
      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
    } catch {
      setError('Failed to cancel invite.');
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          className="flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-[#2c313a] text-[#7f848e] hover:text-[#abb2bf] transition-colors"
          title="Share project"
        >
          <Share2 size={13} />
          Share
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg rounded-xl bg-[#21252b] border border-[#3e4451] p-6 shadow-2xl z-50 max-h-[80vh] overflow-y-auto">
          <Dialog.Title className="text-lg font-semibold text-[#abb2bf]">Share Project</Dialog.Title>
          <Dialog.Close asChild>
            <button className="absolute top-3 right-3 p-1 rounded text-[#5c6370] hover:text-[#abb2bf] hover:bg-[#2c313a] transition-colors" aria-label="Close">
              <X size={16} />
            </button>
          </Dialog.Close>

          {loading ? (
            <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-[#5c6370]" /></div>
          ) : (
            <>
              {/* Members list */}
              <div className="mt-4">
                <h3 className="text-sm font-medium text-[#7f848e] uppercase tracking-wider mb-2">Members</h3>
                <div className="space-y-1">
                  {members.map((m) => (
                    <div key={m.userId} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-[#2c313a]">
                      <div>
                        <span className="text-sm text-[#abb2bf]">{m.name ?? m.email ?? m.userId}</span>
                        {m.email && m.name && <span className="text-xs text-[#5c6370] ml-1">{m.email}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        {isOwner && m.userId !== currentUserId && m.role !== 'owner' ? (
                          <select
                            value={m.role}
                            onChange={(e) => handleChangeRole(m.userId, e.target.value as 'editor' | 'viewer')}
                            className="text-xs bg-[#282c34] border border-[#3e4451] text-[#abb2bf] rounded px-1 py-0.5 focus:outline-none focus:border-blue-500"
                          >
                            <option value="editor">Editor</option>
                            <option value="viewer">Viewer</option>
                          </select>
                        ) : (
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            m.role === 'owner' ? 'bg-blue-900/40 text-blue-300' :
                            m.role === 'editor' ? 'bg-green-900/40 text-green-300' :
                            'bg-[#2c313a] text-[#5c6370]'
                          }`}>{m.role}</span>
                        )}
                        {isOwner && m.userId !== currentUserId && m.role !== 'owner' && (
                          <button
                            onClick={() => handleRemoveMember(m.userId)}
                            className="p-1 text-[#5c6370] hover:text-red-400 transition-colors"
                            title="Remove member"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Invite form (owner only) */}
              {isOwner && (
                <div className="mt-5">
                  <h3 className="text-sm font-medium text-[#7f848e] uppercase tracking-wider mb-2">Invite by Email</h3>
                  <form onSubmit={handleInvite} className="flex gap-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="colleague@example.com"
                      className="flex-1 px-3 py-1.5 text-sm rounded-lg bg-[#282c34] border border-[#3e4451] text-[#abb2bf] placeholder-[#5c6370] focus:outline-none focus:border-blue-500 transition-colors"
                    />
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}
                      className="text-sm bg-[#282c34] border border-[#3e4451] text-[#abb2bf] rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-500"
                    >
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <button
                      type="submit"
                      disabled={inviting || !email.trim()}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {inviting ? <Loader2 size={13} className="animate-spin" /> : 'Invite'}
                    </button>
                  </form>

                  {newInviteLink && (
                    <div className="mt-3 p-3 rounded-lg bg-[#282c34] border border-[#3e4451]">
                      <p className="text-xs text-[#5c6370] mb-1">Share this link with the invitee:</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs text-blue-300 truncate">{newInviteLink}</code>
                        <button
                          onClick={handleCopyLink}
                          className="p-1.5 rounded bg-[#2c313a] text-[#7f848e] hover:text-[#abb2bf] transition-colors"
                          title="Copy link"
                        >
                          {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Pending invites */}
                  {invites.length > 0 && (
                    <div className="mt-4">
                      <h3 className="text-sm font-medium text-[#7f848e] uppercase tracking-wider mb-2">Pending Invites</h3>
                      <div className="space-y-1">
                        {invites.map((inv) => (
                          <div key={inv.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-[#2c313a]">
                            <div>
                              <span className="text-sm text-[#abb2bf]">{inv.email}</span>
                              <span className="text-xs text-[#5c6370] ml-2">{inv.role}</span>
                              <span className="text-xs text-[#5c6370] ml-2">
                                Expires {new Date(inv.expiresAt).toLocaleDateString()}
                              </span>
                            </div>
                            <button
                              onClick={() => handleCancelInvite(inv.id)}
                              className="text-xs text-[#5c6370] hover:text-red-400 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
