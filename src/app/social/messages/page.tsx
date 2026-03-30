'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { listSocialMessages, createSocialMessage, updateSocialMessage, deleteSocialMessage, listSocialAccounts } from '@/lib/api';
import { toast } from 'sonner';
import { RichDataTable } from '@/components/rich-data-table';
import { useSession } from '@/hooks/use-session';
import { useRoleCheck } from '@/hooks/use-role-check';
import { ColumnDef } from '@tanstack/react-table';
import { Trash2, Plus, X, Reply } from 'lucide-react';

export default function SocialMessagesPage() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const { hasAccess } = useRoleCheck(['ADMIN', 'SUPER_ADMIN', 'SOCIAL_MANAGER']);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ socialAccountId: '', platformConversationId: '', messageText: '', direction: 'outbound' });
  const [confirmDel, setConfirmDel] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      const [msgRes, accRes] = await Promise.all([listSocialMessages(), listSocialAccounts()]);
      setItems(msgRes.data || []);
      setAccounts(accRes.data || []);
    } catch (e: any) {
      toast.error('Failed to load messages');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.socialAccountId) {
      toast.error('Please select an account');
      return;
    }
    setSubmitting(true);
    try {
      await createSocialMessage({ 
        ...form, 
        isRead: form.direction === 'outbound' ? true : false,
        organizationId: session?.user?.organizationId 
      });
      toast.success('Message sent / logged');
      setShowCreate(false);
      setForm({ socialAccountId: '', platformConversationId: '', messageText: '', direction: 'outbound' });
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Error saving message');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkRead = async (id: string, isRead: boolean) => {
    try {
      await updateSocialMessage(id, { isRead });
      toast.success(isRead ? 'Marked as read' : 'Marked as unread');
      loadData();
    } catch (error: any) {
      toast.error('Failed to update status');
    }
  };

  const handleDelete = async () => {
    setSubmitting(true);
    try {
      await deleteSocialMessage(confirmDel.id);
      toast.success('Message deleted');
      setConfirmDel(null);
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Error deleting message');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = useMemo<ColumnDef<any>[]>(() => [
    { accessorKey: 'socialAccount.accountName', header: 'Account' },
    { accessorKey: 'direction', header: 'Direction', cell: ({ row }) => (
      <span className={`px-2 py-1 rounded text-xs font-medium ${row.original.direction === 'inbound' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'}`}>
        {row.original.direction.toUpperCase()}
      </span>
    ) },
    { accessorKey: 'senderName', header: 'Sender', cell: ({ row }) => row.original.senderName || row.original.senderHandle || 'Unknown' },
    { accessorKey: 'messageText', header: 'Message', cell: ({ row }) => (
      <div className="max-w-[300px] truncate" title={row.original.messageText}>{row.original.messageText}</div>
    ) },
    { accessorKey: 'isRead', header: 'Status', cell: ({ row }) => (
      <button 
        onClick={() => handleMarkRead(row.original.id, !row.original.isRead)}
        className={`px-2 py-1 rounded text-xs ${row.original.isRead ? 'bg-secondary text-muted-foreground' : 'bg-primary/20 text-primary font-bold'}`}
      >
        {row.original.isRead ? 'Read' : 'Unread'}
      </button>
    ) },
    { accessorKey: 'createdAt', header: 'Date', cell: ({ row }) => new Date(row.original.createdAt).toLocaleString() },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-2">
          {row.original.direction === 'inbound' && (
            <button
              onClick={() => {
                setForm({
                  socialAccountId: row.original.socialAccountId,
                  platformConversationId: row.original.platformConversationId,
                  messageText: '',
                  direction: 'outbound'
                });
                setShowCreate(true);
              }}
              className="p-1 hover:bg-secondary rounded text-primary transition-colors"
              title="Reply"
            >
              <Reply className="h-4 w-4" />
            </button>
          )}
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
          <Header title="Social · Messages" />
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
          <Header title="Social · Messages" />
          <main className="flex-1 p-6 flex justify-center items-center">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2 text-destructive">Access Denied</h2>
              <p className="text-muted-foreground">You do not have permission to view social messages.</p>
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
        <Header title="Social · Messages" />
        <main className="flex-1 overflow-auto p-4 md:p-6 pb-24">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold">Social Inbox</h1>
              <p className="text-muted-foreground text-sm">Monitor and respond to direct messages and comments</p>
            </div>
            <button
              onClick={() => {
                setForm({ socialAccountId: '', platformConversationId: '', messageText: '', direction: 'outbound' });
                setShowCreate(true);
              }}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
            >
              <Plus className="h-4 w-4" /> New Message
            </button>
          </div>

          <div className="bg-card rounded-lg border shadow-sm">
            <RichDataTable columns={columns} data={items} />
          </div>

          {showCreate && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-card w-full max-w-lg rounded-lg shadow-lg border border-border flex flex-col">
                <div className="p-4 border-b border-border flex justify-between items-center bg-muted/50 rounded-t-lg">
                  <h3 className="font-semibold">Compose Message</h3>
                  <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Send From Account <span className="text-destructive">*</span></label>
                    <select
                      required
                      value={form.socialAccountId}
                      onChange={e => setForm({ ...form, socialAccountId: e.target.value })}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background/50 focus:ring-1 focus:ring-primary outline-none"
                    >
                      <option value="">-- Choose Account --</option>
                      {accounts.map(a => (
                        <option key={a.id} value={a.id}>{a.accountName} ({a.platform})</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Conversation ID <span className="text-destructive">*</span></label>
                      <input
                        type="text"
                        required
                        value={form.platformConversationId}
                        onChange={e => setForm({ ...form, platformConversationId: e.target.value })}
                        className="w-full h-10 px-3 rounded-md border border-input bg-background/50 focus:ring-1 focus:ring-primary outline-none"
                        placeholder="Thread or User ID"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Direction</label>
                      <select
                        value={form.direction}
                        onChange={e => setForm({ ...form, direction: e.target.value })}
                        className="w-full h-10 px-3 rounded-md border border-input bg-background/50 focus:ring-1 focus:ring-primary outline-none"
                      >
                        <option value="outbound">Outbound (Send)</option>
                        <option value="inbound">Inbound (Log Received)</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Message Content <span className="text-destructive">*</span></label>
                    <textarea
                      required
                      value={form.messageText}
                      onChange={e => setForm({ ...form, messageText: e.target.value })}
                      className="w-full min-h-24 p-3 rounded-md border border-input bg-background/50 focus:ring-1 focus:ring-primary outline-none resize-y"
                      placeholder="Type your message..."
                    />
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
                      {submitting ? 'Sending...' : 'Send Message'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {confirmDel && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-card w-full max-w-sm rounded-lg shadow-lg border border-border flex flex-col p-6 text-center">
                <h3 className="text-lg font-bold mb-2">Confirm Delete</h3>
                <p className="text-muted-foreground text-sm mb-6">
                  Are you sure you want to delete this message record?
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
