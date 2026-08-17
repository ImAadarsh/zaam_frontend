'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import {
  listSocialMessages,
  updateSocialMessage,
  deleteSocialMessage,
  listSocialAccounts,
  replySocialMessageViaMeta
} from '@/lib/api';
import { toast } from 'sonner';
import { RichDataTable } from '@/components/rich-data-table';
import { useSession } from '@/hooks/use-session';
import { useRoleCheck } from '@/hooks/use-role-check';
import { ColumnDef } from '@tanstack/react-table';
import { Trash2, X, Reply } from 'lucide-react';

export default function SocialMessagesPage() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const { hasAccess } = useRoleCheck(['ADMIN', 'SUPER_ADMIN', 'SOCIAL_MANAGER', 'CS_AGENT']);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [showReply, setShowReply] = useState(false);
  const [form, setForm] = useState({ socialAccountId: '', recipientId: '', messageText: '' });
  const [confirmDel, setConfirmDel] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      const [msgRes, accRes] = await Promise.all([listSocialMessages(), listSocialAccounts()]);
      setItems(msgRes.data || []);
      setAccounts(accRes.data || []);
    } catch {
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

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.socialAccountId || !form.recipientId) {
      toast.error('Account and recipient are required');
      return;
    }
    setSubmitting(true);
    try {
      await replySocialMessageViaMeta({
        socialAccountId: form.socialAccountId,
        recipientId: form.recipientId,
        messageText: form.messageText
      });
      toast.success('Reply sent via Meta');
      setShowReply(false);
      setForm({ socialAccountId: '', recipientId: '', messageText: '' });
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to send reply');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkRead = async (id: string, isRead: boolean) => {
    try {
      await updateSocialMessage(id, { isRead });
      toast.success(isRead ? 'Marked as read' : 'Marked as unread');
      loadData();
    } catch {
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

  const columns = useMemo<ColumnDef<any>[]>(
    () => [
      { accessorKey: 'socialAccount.accountName', header: 'Account' },
      {
        accessorKey: 'direction',
        header: 'Direction',
        cell: ({ row }) => (
          <span
            className={`px-2 py-1 rounded text-xs font-medium ${
              row.original.direction === 'inbound'
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
            }`}
          >
            {String(row.original.direction).toUpperCase()}
          </span>
        )
      },
      {
        accessorKey: 'senderName',
        header: 'Sender',
        cell: ({ row }) => row.original.senderName || row.original.senderHandle || row.original.senderId || 'Unknown'
      },
      {
        accessorKey: 'messageText',
        header: 'Message',
        cell: ({ row }) => (
          <div className="max-w-[300px] truncate" title={row.original.messageText}>
            {row.original.messageText}
          </div>
        )
      },
      {
        accessorKey: 'isRead',
        header: 'Status',
        cell: ({ row }) => (
          <button
            onClick={() => handleMarkRead(row.original.id, !row.original.isRead)}
            className={`px-2 py-1 rounded text-xs ${
              row.original.isRead ? 'bg-secondary text-muted-foreground' : 'bg-primary/20 text-primary font-bold'
            }`}
          >
            {row.original.isRead ? 'Read' : 'Unread'}
          </button>
        )
      },
      {
        accessorKey: 'createdAt',
        header: 'Date',
        cell: ({ row }) => new Date(row.original.createdAt).toLocaleString()
      },
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
                    recipientId: row.original.senderId || row.original.platformConversationId,
                    messageText: ''
                  });
                  setShowReply(true);
                }}
                className="p-1 hover:bg-secondary rounded text-primary transition-colors"
                title="Reply via Meta"
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
    ],
    []
  );

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
              <p className="text-muted-foreground text-sm">
                Messenger & Instagram DMs (via Meta webhooks) — reply sends through Graph API
              </p>
            </div>
          </div>

          <div className="bg-card rounded-lg border shadow-sm">
            <RichDataTable columns={columns} data={items} />
          </div>

          {showReply && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-card w-full max-w-lg rounded-lg shadow-lg border border-border flex flex-col">
                <div className="p-4 border-b border-border flex justify-between items-center bg-muted/50 rounded-t-lg">
                  <h3 className="font-semibold">Reply via Meta</h3>
                  <button onClick={() => setShowReply(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <form onSubmit={handleReply} className="p-4 space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">From account</label>
                    <select
                      required
                      value={form.socialAccountId}
                      onChange={(e) => setForm({ ...form, socialAccountId: e.target.value })}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background/50 outline-none"
                    >
                      <option value="">-- Choose --</option>
                      {accounts
                        .filter((a) => a.platform === 'facebook' || a.platform === 'instagram')
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.accountName} ({a.platform})
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Recipient PSID / IG scoped ID</label>
                    <input
                      required
                      value={form.recipientId}
                      onChange={(e) => setForm({ ...form, recipientId: e.target.value })}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background/50 outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Message</label>
                    <textarea
                      required
                      value={form.messageText}
                      onChange={(e) => setForm({ ...form, messageText: e.target.value })}
                      className="w-full min-h-24 p-3 rounded-md border border-input bg-background/50 outline-none resize-y"
                    />
                  </div>
                  <div className="pt-4 flex justify-end gap-2 border-t border-border">
                    <button type="button" onClick={() => setShowReply(false)} className="px-4 py-2 text-sm" disabled={submitting}>
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium"
                    >
                      {submitting ? 'Sending...' : 'Send'}
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
                <p className="text-muted-foreground text-sm mb-6">Delete this message record?</p>
                <div className="flex justify-center gap-3">
                  <button onClick={() => setConfirmDel(null)} className="px-4 py-2 rounded-md border text-sm" disabled={submitting}>
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
