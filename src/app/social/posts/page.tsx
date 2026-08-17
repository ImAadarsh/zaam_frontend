'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import {
  listSocialPosts,
  createSocialPost,
  updateSocialPost,
  deleteSocialPost,
  listSocialAccounts,
  publishSocialPostToMeta,
  syncSocialPostInsights,
  syncAllSocialPostInsights,
  editSocialPostOnMeta
} from '@/lib/api';
import { toast } from 'sonner';
import { RichDataTable } from '@/components/rich-data-table';
import { useSession } from '@/hooks/use-session';
import { useRoleCheck } from '@/hooks/use-role-check';
import { ColumnDef } from '@tanstack/react-table';
import { Pencil, Trash2, Plus, X, Send, RefreshCw, BarChart3 } from 'lucide-react';

export default function SocialPostsPage() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const { hasAccess } = useRoleCheck(['ADMIN', 'SUPER_ADMIN', 'SOCIAL_MANAGER']);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    socialAccountId: '',
    postType: 'text',
    content: '',
    status: 'draft',
    scheduledAt: '',
    mediaUrlsText: '',
    linkUrl: '',
    hashtags: ''
  });
  const [editing, setEditing] = useState<any>(null);
  const [confirmDel, setConfirmDel] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const publishableAccounts = accounts.filter(
    (a) =>
      (a.platform === 'facebook' || a.platform === 'instagram') &&
      a.accountHandle !== 'ads' &&
      a.isActive
  );

  const loadData = async () => {
    try {
      const [posRes, accRes] = await Promise.all([listSocialPosts(), listSocialAccounts()]);
      setItems(posRes.data || []);
      setAccounts(accRes.data || []);
    } catch {
      toast.error('Failed to load posts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!hydrated || !hasAccess) return;
    if (!session?.accessToken) {
      router.replace('/login');
      return;
    }
    loadData();
  }, [hydrated, hasAccess, router, session?.accessToken]);

  const parseMediaUrls = (text: string) =>
    text
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.socialAccountId) {
      toast.error('Please select an account');
      return;
    }
    setSubmitting(true);
    try {
      const mediaUrls = parseMediaUrls(form.mediaUrlsText);
      const payload: any = {
        socialAccountId: form.socialAccountId,
        postType: form.postType,
        content: form.content,
        status: form.status,
        linkUrl: form.linkUrl || undefined,
        hashtags: form.hashtags || undefined,
        mediaUrls: mediaUrls.length ? mediaUrls : undefined,
        scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null
      };
      if (editing) {
        await updateSocialPost(editing.id, payload);
        if (editing.status === 'published' && editing.platformPostId && editing.socialAccount?.platform === 'facebook') {
          try {
            await editSocialPostOnMeta(editing.id, form.content);
            toast.success('Post updated on Facebook');
          } catch (err: any) {
            toast.success('Saved locally');
            toast.error(err.response?.data?.error?.message || 'Remote Meta edit failed');
          }
        } else {
          toast.success('Post updated');
        }
      } else {
        await createSocialPost({ ...payload, organizationId: session?.user?.organizationId });
        toast.success('Post created');
      }
      setShowCreate(false);
      setEditing(null);
      setForm({
        socialAccountId: '',
        postType: 'text',
        content: '',
        status: 'draft',
        scheduledAt: '',
        mediaUrlsText: '',
        linkUrl: '',
        hashtags: ''
      });
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Error saving post');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublish = async (id: string) => {
    setBusyId(id);
    try {
      await publishSocialPostToMeta(id);
      toast.success('Published to Meta');
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Publish failed');
      loadData();
    } finally {
      setBusyId(null);
    }
  };

  const handleSyncInsights = async (id: string) => {
    setBusyId(id);
    try {
      await syncSocialPostInsights(id);
      toast.success('Insights synced');
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Insights sync failed');
    } finally {
      setBusyId(null);
    }
  };

  const handleSyncAll = async () => {
    setSubmitting(true);
    try {
      const { data } = await syncAllSocialPostInsights();
      toast.success(`Synced ${data.synced} posts (${data.failed} failed)`);
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Bulk sync failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setSubmitting(true);
    try {
      await deleteSocialPost(confirmDel.id);
      toast.success('Post deleted');
      setConfirmDel(null);
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Error deleting post');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = useMemo<ColumnDef<any>[]>(
    () => [
      { accessorKey: 'socialAccount.accountName', header: 'Account' },
      {
        id: 'platform',
        header: 'Platform',
        cell: ({ row }) => row.original.socialAccount?.platform || '—'
      },
      { accessorKey: 'postType', header: 'Type' },
      {
        accessorKey: 'content',
        header: 'Content',
        cell: ({ row }) => <div className="max-w-[200px] truncate">{row.original.content}</div>
      },
      { accessorKey: 'status', header: 'Status' },
      {
        id: 'perf',
        header: 'Performance',
        cell: ({ row }) => {
          const p = row.original;
          if (p.status !== 'published') return '—';
          return (
            <span className="text-xs text-muted-foreground">
              👍 {p.likes || 0} · 💬 {p.comments || 0} · 👁 {p.reach || 0}
            </span>
          );
        }
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const p = row.original;
          const canPublish =
            ['draft', 'scheduled', 'failed'].includes(p.status) &&
            (p.socialAccount?.platform === 'facebook' || p.socialAccount?.platform === 'instagram');
          return (
            <div className="flex gap-1">
              {canPublish && (
                <button
                  onClick={() => handlePublish(p.id)}
                  disabled={busyId === p.id}
                  className="p-1 hover:bg-secondary rounded text-primary transition-colors"
                  title="Publish to Meta"
                >
                  <Send className="h-4 w-4" />
                </button>
              )}
              {p.status === 'published' && p.platformPostId && (
                <button
                  onClick={() => handleSyncInsights(p.id)}
                  disabled={busyId === p.id}
                  className="p-1 hover:bg-secondary rounded text-muted-foreground transition-colors"
                  title="Sync insights"
                >
                  <BarChart3 className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => {
                  setEditing(p);
                  setForm({
                    socialAccountId: p.socialAccountId,
                    postType: p.postType,
                    content: p.content,
                    status: p.status,
                    scheduledAt: p.scheduledAt ? new Date(p.scheduledAt).toISOString().slice(0, 16) : '',
                    mediaUrlsText: Array.isArray(p.mediaUrls) ? p.mediaUrls.join('\n') : '',
                    linkUrl: p.linkUrl || '',
                    hashtags: p.hashtags || ''
                  });
                  setShowCreate(true);
                }}
                className="p-1 hover:bg-secondary rounded text-primary transition-colors"
                title="Edit"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => setConfirmDel(p)}
                className="p-1 hover:bg-destructive/10 rounded text-destructive transition-colors"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        }
      }
    ],
    [busyId]
  );

  if (!hydrated || loading) {
    return (
      <div className="min-h-screen app-surface">
        <Sidebar />
        <div className="flex flex-col overflow-hidden lg:ml-[280px]">
          <Header title="Social · Posts" />
          <main className="flex-1 p-6 flex justify-center items-center">
            <div className="text-muted-foreground animate-pulse">Loading...</div>
          </main>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen app-surface">
        <Sidebar />
        <div className="flex flex-col overflow-hidden lg:ml-[280px]">
          <Header title="Social · Posts" />
          <main className="flex-1 p-6 flex justify-center items-center">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2 text-destructive">Access Denied</h2>
              <p className="text-muted-foreground">You do not have permission to view posts.</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen app-surface">
      <Sidebar />
      <div className="flex flex-col overflow-hidden lg:ml-[280px]">
        <Header title="Social · Posts" />
        <main className="flex-1 overflow-auto p-4 md:p-6 pb-24">
          <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold">Posts</h1>
              <p className="text-muted-foreground text-sm">Compose, publish to Facebook/Instagram, and sync performance</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleSyncAll}
                disabled={submitting}
                className="px-4 py-2 border border-input rounded-md text-sm font-medium hover:bg-secondary/80 transition-colors flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" /> Sync all insights
              </button>
              <button
                onClick={() => {
                  setEditing(null);
                  setForm({
                    socialAccountId: '',
                    postType: 'text',
                    content: '',
                    status: 'draft',
                    scheduledAt: '',
                    mediaUrlsText: '',
                    linkUrl: '',
                    hashtags: ''
                  });
                  setShowCreate(true);
                }}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
              >
                <Plus className="h-4 w-4" /> Create Post
              </button>
            </div>
          </div>

          <div className="bg-card rounded-lg border shadow-sm">
            <RichDataTable columns={columns} data={items} />
          </div>

          {showCreate && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-card w-full max-w-lg rounded-lg shadow-lg border border-border flex flex-col max-h-[90vh] overflow-auto">
                <div className="p-4 border-b border-border flex justify-between items-center bg-muted/50 rounded-t-lg sticky top-0">
                  <h3 className="font-semibold">{editing ? 'Edit Post' : 'Create Post'}</h3>
                  <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Select Account <span className="text-destructive">*</span></label>
                    <select
                      required
                      value={form.socialAccountId}
                      onChange={(e) => setForm({ ...form, socialAccountId: e.target.value })}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background/50 focus:ring-1 focus:ring-primary outline-none"
                    >
                      <option value="">-- Choose Account --</option>
                      {publishableAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.accountName} ({a.platform})
                        </option>
                      ))}
                      {accounts
                        .filter((a) => !publishableAccounts.find((p) => p.id === a.id))
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.accountName} ({a.platform}) — manual only
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Type</label>
                      <select
                        value={form.postType}
                        onChange={(e) => setForm({ ...form, postType: e.target.value })}
                        className="w-full h-10 px-3 rounded-md border border-input bg-background/50 focus:ring-1 focus:ring-primary outline-none"
                      >
                        <option value="text">Text Only</option>
                        <option value="image">Image</option>
                        <option value="video">Video</option>
                        <option value="carousel">Carousel</option>
                        <option value="reel">Reel</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Status</label>
                      <select
                        value={form.status}
                        onChange={(e) => setForm({ ...form, status: e.target.value })}
                        className="w-full h-10 px-3 rounded-md border border-input bg-background/50 focus:ring-1 focus:ring-primary outline-none"
                      >
                        <option value="draft">Draft</option>
                        <option value="scheduled">Scheduled</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Content / Caption <span className="text-destructive">*</span></label>
                    <textarea
                      required
                      value={form.content}
                      onChange={(e) => setForm({ ...form, content: e.target.value })}
                      className="w-full min-h-24 p-3 rounded-md border border-input bg-background/50 focus:ring-1 focus:ring-primary outline-none resize-y"
                      placeholder="Write your post..."
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Media URLs (one per line) — required for Instagram</label>
                    <textarea
                      value={form.mediaUrlsText}
                      onChange={(e) => setForm({ ...form, mediaUrlsText: e.target.value })}
                      className="w-full min-h-16 p-3 rounded-md border border-input bg-background/50 focus:ring-1 focus:ring-primary outline-none resize-y text-sm"
                      placeholder="https://...jpg"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Link URL (FB)</label>
                      <input
                        type="url"
                        value={form.linkUrl}
                        onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
                        className="w-full h-10 px-3 rounded-md border border-input bg-background/50 outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Hashtags</label>
                      <input
                        type="text"
                        value={form.hashtags}
                        onChange={(e) => setForm({ ...form, hashtags: e.target.value })}
                        className="w-full h-10 px-3 rounded-md border border-input bg-background/50 outline-none"
                        placeholder="#brand #sale"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Scheduled Time</label>
                    <input
                      type="datetime-local"
                      value={form.scheduledAt}
                      onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background/50 outline-none"
                    />
                  </div>
                  <div className="pt-4 flex justify-end gap-2 border-t border-border">
                    <button
                      type="button"
                      onClick={() => setShowCreate(false)}
                      className="px-4 py-2 rounded-md hover:bg-secondary/80 text-sm font-medium"
                      disabled={submitting}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
                    >
                      {submitting ? 'Saving...' : 'Save Post'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {confirmDel && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-card w-full max-w-sm rounded-lg shadow-lg border border-border p-6 text-center">
                <h3 className="text-lg font-bold mb-2">Confirm Delete</h3>
                <p className="text-muted-foreground text-sm mb-6">Delete this post from the ERP?</p>
                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => setConfirmDel(null)}
                    className="px-4 py-2 rounded-md border border-input text-sm"
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={submitting}
                    className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md text-sm"
                  >
                    {submitting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
