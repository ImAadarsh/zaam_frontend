'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import {
  listSocialAccounts,
  createSocialAccount,
  updateSocialAccount,
  deleteSocialAccount,
  getMetaConnectUrl,
  getMetaStatus
} from '@/lib/api';
import { toast } from 'sonner';
import { RichDataTable } from '@/components/rich-data-table';
import { useSession } from '@/hooks/use-session';
import { useRoleCheck } from '@/hooks/use-role-check';
import { ColumnDef } from '@tanstack/react-table';
import { Pencil, Trash2, Plus, X, Globe, Facebook } from 'lucide-react';

export default function SocialAccountsPage() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const { hasAccess } = useRoleCheck(['ADMIN', 'SUPER_ADMIN', 'SOCIAL_MANAGER']);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ platform: 'instagram', accountName: '', accountHandle: '', isVerified: false, isActive: true });
  const [editing, setEditing] = useState<any>(null);
  const [confirmDel, setConfirmDel] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [metaConnecting, setMetaConnecting] = useState(false);
  const [metaStatus, setMetaStatus] = useState<any>(null);

  const loadData = async () => {
    try {
      const [{ data }, statusRes] = await Promise.all([
        listSocialAccounts(),
        getMetaStatus().catch(() => ({ data: null }))
      ]);
      setItems(data || []);
      setMetaStatus(statusRes.data);
    } catch {
      toast.error('Failed to load social accounts');
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const meta = params.get('meta');
    if (!meta) return;
    if (meta === 'connected') {
      toast.success(
        `Meta connected — FB: ${params.get('facebook') || 0}, IG: ${params.get('instagram') || 0}, Ads: ${params.get('ads') || 0}`
      );
      const declined = (params.get('declined') || '').split(',').filter(Boolean);
      if (declined.length) {
        toast.warning(`Some permissions were not granted: ${declined.join(', ')}. Reconnect and enable them for full features.`);
      }
      loadData();
    } else if (meta === 'error') {
      toast.error(params.get('message') || 'Meta connect failed', { duration: 8000 });
    }
    router.replace('/social/accounts');
  }, [router]);

  const handleConnectMeta = async () => {
    setMetaConnecting(true);
    try {
      const { data } = await getMetaConnectUrl();
      if (!data?.authUrl) {
        toast.error('Meta connect URL not available. Check API env credentials.');
        return;
      }
      window.location.href = data.authUrl;
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to start Meta connect');
      setMetaConnecting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload: any = { ...form };
      if (editing) {
        await updateSocialAccount(editing.id, payload);
        toast.success('Account updated');
      } else {
        await createSocialAccount({ ...payload, organizationId: session?.user?.organizationId });
        toast.success('Account created');
      }
      setShowCreate(false);
      setEditing(null);
      setForm({ platform: 'instagram', accountName: '', accountHandle: '', isVerified: false, isActive: true });
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Error saving account');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setSubmitting(true);
    try {
      await deleteSocialAccount(confirmDel.id);
      toast.success('Account deleted');
      setConfirmDel(null);
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Error deleting account');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = useMemo<ColumnDef<any>[]>(() => [
    { accessorKey: 'platform', header: 'Platform' },
    { accessorKey: 'accountName', header: 'Account Name' },
    { accessorKey: 'accountHandle', header: 'Handle' },
    {
      id: 'synced',
      header: 'Meta Sync',
      cell: ({ row }) =>
        row.original.accountId && (row.original.platform === 'facebook' || row.original.platform === 'instagram')
          ? 'Synced'
          : 'Manual'
    },
    { accessorKey: 'followerCount', header: 'Followers' },
    { accessorKey: 'isActive', header: 'Active', cell: ({ row }) => (row.original.isActive ? 'Yes' : 'No') },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-2">
          {row.original.profileUrl && (
            <a href={row.original.profileUrl} target="_blank" rel="noreferrer" className="p-1 hover:bg-secondary rounded text-muted-foreground transition-colors" title="View Profile">
              <Globe className="h-4 w-4" />
            </a>
          )}
          <button
            onClick={() => {
              setEditing(row.original);
              setForm({
                platform: row.original.platform,
                accountName: row.original.accountName,
                accountHandle: row.original.accountHandle || '',
                isVerified: row.original.isVerified,
                isActive: row.original.isActive
              });
              setShowCreate(true);
            }}
            className="p-1 hover:bg-secondary rounded text-primary transition-colors"
            title="Edit"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => setConfirmDel(row.original)}
            className="p-1 hover:bg-destructive/10 rounded text-destructive transition-colors"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )
    }
  ], []);

  if (!hydrated || loading) {
    return (
      <div className="min-h-screen app-surface">
        <Sidebar />
        <div className="flex flex-col overflow-hidden lg:ml-[280px]">
          <Header title="Social · Accounts" />
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
          <Header title="Social · Accounts" />
          <main className="flex-1 p-6 flex justify-center items-center">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2 text-destructive">Access Denied</h2>
              <p className="text-muted-foreground">You do not have permission to view social accounts.</p>
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
        <Header title="Social · Accounts" />
        <main className="flex-1 overflow-auto p-4 md:p-6 pb-24">
          <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold">Accounts</h1>
              <p className="text-muted-foreground text-sm">
                Connect Meta (Facebook + Instagram + Ads) or add accounts manually
                {metaStatus?.configured === false && (
                  <span className="block text-amber-600 mt-1">Meta env not fully configured yet — see docs/META_SOCIAL_SETUP.md</span>
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleConnectMeta}
                disabled={metaConnecting}
                className="px-4 py-2 bg-[#1877F2] text-white rounded-md text-sm font-medium hover:bg-[#166FE5] transition-colors flex items-center gap-2 disabled:opacity-60"
              >
                <Facebook className="h-4 w-4" />
                {metaConnecting ? 'Redirecting…' : 'Connect Meta'}
              </button>
              <button
                onClick={() => {
                  setEditing(null);
                  setForm({ platform: 'instagram', accountName: '', accountHandle: '', isVerified: false, isActive: true });
                  setShowCreate(true);
                }}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
              >
                <Plus className="h-4 w-4" /> Manual Account
              </button>
            </div>
          </div>

          <div className="bg-card rounded-lg border shadow-sm">
            <RichDataTable columns={columns} data={items} />
          </div>

          {showCreate && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-card w-full max-w-md rounded-lg shadow-lg border border-border flex flex-col">
                <div className="p-4 border-b border-border flex justify-between items-center bg-muted/50 rounded-t-lg">
                  <h3 className="font-semibold">{editing ? 'Edit Account' : 'Manual Account'}</h3>
                  <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Platform</label>
                    <select
                      value={form.platform}
                      onChange={e => setForm({ ...form, platform: e.target.value })}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background/50 focus:ring-1 focus:ring-primary outline-none"
                    >
                      <option value="facebook">Facebook</option>
                      <option value="instagram">Instagram</option>
                      <option value="tiktok">TikTok</option>
                      <option value="twitter">Twitter</option>
                      <option value="linkedin">LinkedIn</option>
                      <option value="youtube">YouTube</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Account Name <span className="text-destructive">*</span></label>
                    <input
                      type="text"
                      required
                      value={form.accountName}
                      onChange={e => setForm({ ...form, accountName: e.target.value })}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background/50 focus:ring-1 focus:ring-primary outline-none"
                      placeholder="e.g. My Brand Official"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Username / Handle</label>
                    <input
                      type="text"
                      value={form.accountHandle}
                      onChange={e => setForm({ ...form, accountHandle: e.target.value })}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background/50 focus:ring-1 focus:ring-primary outline-none"
                      placeholder="@handle"
                    />
                  </div>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.isVerified}
                        onChange={e => setForm({ ...form, isVerified: e.target.checked })}
                        className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                      />
                      Verified Badge
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.isActive}
                        onChange={e => setForm({ ...form, isActive: e.target.checked })}
                        className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                      />
                      Active Sync
                    </label>
                  </div>

                  <div className="pt-4 flex justify-end gap-2 border-t border-border">
                    <button
                      type="button"
                      onClick={() => setShowCreate(false)}
                      className="px-4 py-2 rounded-md hover:bg-secondary/80 text-sm font-medium transition-colors"
                      disabled={submitting}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
                    >
                      {submitting ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {confirmDel && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-card w-full max-w-sm rounded-lg shadow-lg border border-border flex flex-col p-6 text-center">
                <h3 className="text-lg font-bold mb-2">Confirm Disconnect</h3>
                <p className="text-muted-foreground text-sm mb-6">
                  Are you sure you want to disconnect this account? All scheduled posts may fail.
                </p>
                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => setConfirmDel(null)}
                    className="px-4 py-2 rounded-md border border-input hover:bg-secondary/50 text-sm font-medium transition-colors"
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={submitting}
                    className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md text-sm font-medium hover:bg-destructive/90 transition-colors"
                  >
                    {submitting ? 'Disconnecting...' : 'Disconnect'}
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
