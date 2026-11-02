'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { useSession } from '@/hooks/use-session';
import { useRoleCheck } from '@/hooks/use-role-check';
import {
  createB2bNotification,
  deleteB2bNotification,
  listB2bNotifications,
  updateB2bNotification
} from '@/lib/api';
import { toast } from 'sonner';
import { Bell, Plus, Trash2 } from 'lucide-react';

type FormState = {
  title: string;
  message: string;
  type: 'promo' | 'system' | 'delivery' | 'credit';
  actionUrl: string;
  status: 'draft' | 'published';
  broadcast: boolean;
};

const emptyForm: FormState = {
  title: '',
  message: '',
  type: 'promo',
  actionUrl: '',
  status: 'published',
  broadcast: true
};

export default function B2bNotificationsPage() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const { hasAccess } = useRoleCheck(['ADMIN', 'SUPER_ADMIN', 'SALES_REP', 'B2B_M']);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const orgId = session?.user?.organizationId;

  const load = async () => {
    if (!orgId) return;
    try {
      const res = await listB2bNotifications({ organizationId: orgId });
      setRows(res.data || []);
    } catch {
      toast.error('Failed to load notifications');
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
    load();
  }, [hydrated, hasAccess, session?.accessToken, orgId]);

  const save = async () => {
    if (!orgId || !form.title.trim() || !form.message.trim()) {
      toast.error('Title and message are required');
      return;
    }
    try {
      if (editingId) {
        await updateB2bNotification(editingId, {
          organizationId: orgId,
          title: form.title.trim(),
          message: form.message.trim(),
          type: form.type,
          actionUrl: form.actionUrl.trim() || null,
          status: form.status,
          broadcast: form.broadcast
        });
        toast.success('Notification updated');
      } else {
        await createB2bNotification({
          organizationId: orgId,
          title: form.title.trim(),
          message: form.message.trim(),
          type: form.type,
          actionUrl: form.actionUrl.trim() || null,
          status: form.status,
          broadcast: form.broadcast
        });
        toast.success(form.status === 'published' ? 'Notification published' : 'Draft saved');
      }
      setForm(emptyForm);
      setEditingId(null);
      await load();
    } catch {
      toast.error('Save failed');
    }
  };

  return (
    <div className="min-h-screen app-surface">
      <Sidebar />
      <div className="flex flex-col overflow-hidden lg:ml-[280px]">
        <Header title="B2B · Alerts & Promos" />
        <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6 max-w-4xl">
          <div className="flex items-center gap-3">
            <Bell />
            <div>
              <h1 className="text-xl font-bold">Wholesale Alerts & Promos</h1>
              <p className="text-sm text-muted-foreground">
                Create and publish notifications shown on the B2B portal dashboard (feeds <code className="text-xs">GET /api/b2b/notifications</code>).
              </p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <Plus size={16} /> {editingId ? 'Edit notification' : 'New notification'}
            </h2>
            <input
              className="w-full border border-border rounded-lg px-3 py-2 bg-background text-sm"
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <textarea
              className="w-full border border-border rounded-lg px-3 py-2 bg-background text-sm min-h-[90px]"
              placeholder="Message"
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select
                className="border border-border rounded-lg px-3 py-2 bg-background text-sm"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as FormState['type'] })}
              >
                <option value="promo">Promo</option>
                <option value="system">System</option>
                <option value="delivery">Delivery</option>
                <option value="credit">Credit</option>
              </select>
              <select
                className="border border-border rounded-lg px-3 py-2 bg-background text-sm"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as FormState['status'] })}
              >
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
              <input
                className="border border-border rounded-lg px-3 py-2 bg-background text-sm"
                placeholder="Action URL (e.g. /shop?cat=drinks)"
                value={form.actionUrl}
                onChange={(e) => setForm({ ...form, actionUrl: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.broadcast}
                onChange={(e) => setForm({ ...form, broadcast: e.target.checked })}
              />
              Broadcast to all retailers
            </label>
            <div className="flex gap-2">
              <button onClick={save} className="bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-semibold">
                {editingId ? 'Update' : 'Save'}
              </button>
              {editingId && (
                <button
                  onClick={() => { setEditingId(null); setForm(emptyForm); }}
                  className="border border-border px-4 py-2 rounded-xl text-sm"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="font-semibold">Recent</h2>
            {loading ? (
              <div className="text-muted-foreground text-sm">Loading...</div>
            ) : rows.length === 0 ? (
              <div className="text-sm text-muted-foreground border border-dashed border-border rounded-xl p-4 space-y-1">
                <p>No alerts or promos yet.</p>
                <p className="text-xs">Use the form above to publish a broadcast (all retailers) or a targeted message.</p>
              </div>
            ) : (
              rows.map((row) => (
                <div key={row.id} className="bg-card border border-border rounded-xl p-4 flex flex-col sm:flex-row sm:items-start gap-3 justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{row.title}</span>
                      <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-secondary">{row.type}</span>
                      <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-secondary">{row.status || 'published'}</span>
                      {!row.customer && <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-secondary">broadcast</span>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{row.message}</p>
                    {row.actionUrl && <p className="text-xs text-muted-foreground mt-1">Link: {row.actionUrl}</p>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      className="text-xs px-2 py-1 border rounded"
                      onClick={() => {
                        setEditingId(String(row.id));
                        setForm({
                          title: row.title || '',
                          message: row.message || '',
                          type: row.type || 'promo',
                          actionUrl: row.actionUrl || '',
                          status: row.status || 'published',
                          broadcast: !row.customer
                        });
                      }}
                    >
                      Edit
                    </button>
                    {row.status !== 'published' && (
                      <button
                        className="text-xs px-2 py-1 border rounded"
                        onClick={async () => {
                          await updateB2bNotification(String(row.id), { organizationId: orgId!, status: 'published' });
                          toast.success('Published');
                          load();
                        }}
                      >
                        Publish
                      </button>
                    )}
                    <button
                      className="text-xs px-2 py-1 border rounded text-destructive inline-flex items-center gap-1"
                      onClick={async () => {
                        await deleteB2bNotification(String(row.id), orgId!);
                        toast.success('Deleted');
                        load();
                      }}
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
