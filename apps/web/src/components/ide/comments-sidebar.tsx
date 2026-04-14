'use client';

import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, X, CheckCircle, Loader2, Send } from 'lucide-react';
import type { Comment } from '@latex-ide/shared-types';
import type { ApiClient } from '@/lib/api';

interface CommentsSidebarProps {
  projectId: string;
  fileId: string | null;
  currentUserId: string;
  isEditor: boolean;
  api: ApiClient;
  highlightedCommentId: string | null;
  onClose: () => void;
}

export function CommentsSidebar({
  projectId,
  fileId,
  currentUserId,
  isEditor,
  api,
  highlightedCommentId,
  onClose,
}: CommentsSidebarProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);

  const loadComments = useCallback(async () => {
    if (!fileId) return;
    setLoading(true);
    try {
      const data = await api.comments.list(projectId, fileId);
      setComments(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [api, projectId, fileId]);

  useEffect(() => {
    loadComments();
    // Poll every 30s
    const interval = setInterval(loadComments, 30000);
    return () => clearInterval(interval);
  }, [loadComments]);

  async function handleResolve(commentId: string) {
    try {
      const updated = await api.comments.update(projectId, commentId, { resolved: true });
      setComments((prev) => prev.map((c) => (c.id === commentId ? updated : c)));
    } catch {
      // ignore
    }
  }

  async function handleReply(parentId: string, yjsAnchor: string) {
    const text = replyText[parentId]?.trim();
    if (!text || !fileId) return;
    setSubmitting(parentId);
    try {
      const reply = await api.comments.create(projectId, {
        fileId,
        body: text,
        yjsAnchor,
        parentId,
      });
      setComments((prev) =>
        prev.map((c) =>
          c.id === parentId ? { ...c, replies: [...(c.replies ?? []), reply] } : c,
        ),
      );
      setReplyText((prev) => ({ ...prev, [parentId]: '' }));
    } catch {
      // ignore
    } finally {
      setSubmitting(null);
    }
  }

  async function handleDelete(commentId: string, parentId?: string) {
    try {
      await api.comments.remove(projectId, commentId);
      if (parentId) {
        setComments((prev) =>
          prev.map((c) =>
            c.id === parentId
              ? { ...c, replies: (c.replies ?? []).filter((r) => r.id !== commentId) }
              : c,
          ),
        );
      } else {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
      }
    } catch {
      // ignore
    }
  }

  if (!fileId) return null;

  return (
    <div className="h-full flex flex-col bg-[#21252b] border-l border-[#3e4451]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#3e4451]">
        <div className="flex items-center gap-2">
          <MessageSquare size={14} className="text-[#5c6370]" />
          <span className="text-sm font-medium text-[#abb2bf]">Comments</span>
        </div>
        <button onClick={onClose} className="p-1 rounded text-[#5c6370] hover:text-[#abb2bf] transition-colors">
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={20} className="animate-spin text-[#5c6370]" />
          </div>
        ) : comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-[#5c6370] text-sm">
            <MessageSquare size={28} className="mb-2 opacity-40" />
            <p>No comments yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#3e4451]">
            {comments.map((comment) => (
              <div
                key={comment.id}
                id={`comment-${comment.id}`}
                className={`px-3 py-3 transition-colors ${
                  highlightedCommentId === comment.id ? 'bg-blue-900/20' : ''
                }`}
              >
                {/* Top-level comment */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-blue-300">
                        {comment.authorName ?? comment.authorId}
                      </span>
                      <span className="text-xs text-[#5c6370]">
                        {new Date(comment.createdAt).toLocaleDateString()}
                      </span>
                      {comment.resolvedAt && (
                        <span className="text-xs text-green-400 flex items-center gap-0.5">
                          <CheckCircle size={10} />
                          Resolved
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[#abb2bf] whitespace-pre-wrap break-words">{comment.body}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {isEditor && !comment.resolvedAt && (
                      <button
                        onClick={() => handleResolve(comment.id)}
                        className="p-1 text-[#5c6370] hover:text-green-400 transition-colors"
                        title="Resolve comment"
                      >
                        <CheckCircle size={12} />
                      </button>
                    )}
                    {comment.authorId === currentUserId && (
                      <button
                        onClick={() => handleDelete(comment.id)}
                        className="p-1 text-[#5c6370] hover:text-red-400 transition-colors"
                        title="Delete comment"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Replies */}
                {(comment.replies ?? []).length > 0 && (
                  <div className="mt-2 ml-3 pl-3 border-l border-[#3e4451] space-y-2">
                    {(comment.replies ?? []).map((reply) => (
                      <div key={reply.id} className="flex items-start justify-between gap-1">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-medium text-blue-300">
                              {reply.authorName ?? reply.authorId}
                            </span>
                            <span className="text-xs text-[#5c6370]">
                              {new Date(reply.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-xs text-[#abb2bf] whitespace-pre-wrap break-words">{reply.body}</p>
                        </div>
                        {reply.authorId === currentUserId && (
                          <button
                            onClick={() => handleDelete(reply.id, comment.id)}
                            className="p-1 text-[#5c6370] hover:text-red-400 transition-colors shrink-0"
                          >
                            <X size={11} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Reply input */}
                {isEditor && !comment.resolvedAt && (
                  <div className="mt-2 flex gap-1">
                    <input
                      type="text"
                      value={replyText[comment.id] ?? ''}
                      onChange={(e) => setReplyText((prev) => ({ ...prev, [comment.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleReply(comment.id, comment.yjsAnchor);
                        }
                      }}
                      placeholder="Reply..."
                      className="flex-1 px-2 py-1 text-xs rounded bg-[#282c34] border border-[#3e4451] text-[#abb2bf] placeholder-[#5c6370] focus:outline-none focus:border-blue-500 transition-colors"
                    />
                    <button
                      onClick={() => handleReply(comment.id, comment.yjsAnchor)}
                      disabled={submitting === comment.id || !replyText[comment.id]?.trim()}
                      className="p-1.5 rounded bg-[#2c313a] text-[#7f848e] hover:text-blue-400 disabled:opacity-50 transition-colors"
                    >
                      {submitting === comment.id
                        ? <Loader2 size={11} className="animate-spin" />
                        : <Send size={11} />}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
