'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { StatCard } from '@/components/stat-card';
import { useSession } from '@/hooks/use-session';
import { useRoleCheck } from '@/hooks/use-role-check';
import {
  getPaymentDashboard,
  createGateway,
  updateGateway,
  testGatewayConnection,
  deleteGateway
} from '@/lib/api';
import { toast } from 'sonner';
import {
  CreditCard,
  Wallet,
  Activity,
  AlertTriangle,
  CheckCircle2,
  PlugZap,
  Plus,
  RefreshCw
} from 'lucide-react';

const PROVIDERS = [
  'worldpay',
  'stripe',
  'sumup',
  'square',
  'paypal',
  'open_banking',
  'manual',
  'other'
] as const;

const emptyForm = {
  name: '',
  provider: 'worldpay' as (typeof PROVIDERS)[number],
  mode: 'test' as 'test' | 'live',
  isActive: true,
  isDefault: false,
  username: '',
  password: '',
  apiKey: '',
  apiSecret: '',
  merchantEntity: 'default'
};

export default function PaymentDashboardPage() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const { hasAccess } = useRoleCheck(['ADMIN', 'SUPER_ADMIN', 'FINANCE']);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<any>({});
  const [gateways, setGateways] = useState<any[]>([]);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const orgId = session?.user?.organizationId;

  const load = async () => {
    if (!orgId) return;
    try {
      setLoading(true);
      const res = await getPaymentDashboard(orgId);
      setMetrics(res.data?.metrics || {});
      setGateways(res.data?.gateways || []);
      setRecentPayments(res.data?.recentPayments || []);
    } catch {
      toast.error('Failed to load payment dashboard');
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

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setShowForm(true);
  };

  const openEdit = (g: any) => {
    setEditingId(g.id);
    setForm({
      name: g.name || '',
      provider: g.provider,
      mode: g.mode || 'test',
      isActive: !!g.isActive,
      isDefault: !!g.isDefault,
      username: '',
      password: '',
      apiKey: '',
      apiSecret: '',
      merchantEntity: 'default'
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!orgId) return;
    setSaving(true);
    try {
      const payload: any = {
        organizationId: orgId,
        name: form.name,
        provider: form.provider,
        mode: form.mode,
        isActive: form.isActive,
        isDefault: form.isDefault
      };
      if (form.provider === 'worldpay') {
        if (form.username) payload.username = form.username;
        if (form.password) payload.password = form.password;
        if (form.merchantEntity) payload.merchantEntity = form.merchantEntity;
      } else {
        if (form.apiKey) payload.apiKey = form.apiKey;
        if (form.apiSecret) payload.apiSecret = form.apiSecret;
      }

      if (editingId) {
        await updateGateway(editingId, payload);
        toast.success('Gateway updated');
      } else {
        if (form.provider === 'worldpay' && (!form.username || !form.password)) {
          toast.error('Worldpay username and API password are required');
          setSaving(false);
          return;
        }
        await createGateway(payload);
        toast.success('Gateway created');
      }
      setShowForm(false);
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Failed to save gateway');
    } finally {
      setSaving(false);
    }
  };

  const testConn = async (id: string) => {
    try {
      const res = await testGatewayConnection(id);
      if (res.data?.ok) toast.success(res.data.message || 'Connection OK');
      else toast.error(res.data?.message || 'Connection failed');
    } catch (e: any) {
      toast.error(e?.response?.data?.data?.message || e?.response?.data?.error?.message || 'Connection test failed');
    }
  };

  if (!hydrated) return null;

  return (
    <div className="min-h-screen app-surface">
      <Sidebar />
      <div className="flex flex-col overflow-hidden lg:ml-[280px]">
        <Header title="Finance · Payment Dashboard" />
        <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">Payment Dashboard</h1>
              <p className="text-sm text-muted-foreground">
                Manage Worldpay and other gateways, monitor transactions, and test connections. Credentials are stored encrypted.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={load}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-sm hover:bg-muted"
              >
                <RefreshCw size={16} /> Refresh
              </button>
              <button
                onClick={openCreate}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
              >
                <Plus size={16} /> Add gateway
              </button>
              <Link
                href="/finance/gateways"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-sm hover:bg-muted"
              >
                Gateway list
              </Link>
            </div>
          </div>

          {loading ? (
            <div className="text-muted-foreground">Loading...</div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard title="Active gateways" value={String(metrics.gatewaysActive ?? 0)} hint={`${metrics.gatewaysTotal ?? 0} total`} icon={<Wallet size={18} />} />
                <StatCard title="Completed volume" value={`£${Number(metrics.completedVolume || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`} hint={`${metrics.completedCount ?? 0} settled`} icon={<CheckCircle2 size={18} />} />
                <StatCard title="Pending" value={String(metrics.pendingCount ?? 0)} hint="Awaiting confirmation" icon={<Activity size={18} />} />
                <StatCard title="Failed" value={String(metrics.failedCount ?? 0)} hint="Provider / validation errors" icon={<AlertTriangle size={18} />} />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
                  <h2 className="font-semibold flex items-center gap-2"><PlugZap size={18} /> Gateways</h2>
                  <div className="space-y-2">
                    {gateways.length === 0 && <p className="text-sm text-muted-foreground">No gateways configured yet.</p>}
                    {gateways.map((g) => (
                      <div key={g.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border">
                        <div>
                          <div className="font-medium">{g.name}</div>
                          <div className="text-xs text-muted-foreground capitalize">
                            {g.provider.replace('_', ' ')} · {g.mode} · {g.isActive ? 'active' : 'inactive'}
                            {g.isDefault ? ' · default' : ''}
                            {g.credentialHint ? ` · ${g.credentialHint}` : ''}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button className="text-xs px-2 py-1 rounded-lg border" onClick={() => testConn(g.id)}>Test</button>
                          <button className="text-xs px-2 py-1 rounded-lg border" onClick={() => openEdit(g)}>Edit</button>
                          <button
                            className="text-xs px-2 py-1 rounded-lg border text-red-600"
                            onClick={async () => {
                              if (!confirm('Delete this gateway?')) return;
                              try {
                                await deleteGateway(g.id);
                                toast.success('Deleted');
                                load();
                              } catch {
                                toast.error('Delete failed');
                              }
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
                  <h2 className="font-semibold flex items-center gap-2"><CreditCard size={18} /> Recent payments</h2>
                  <div className="space-y-2 max-h-[420px] overflow-auto">
                    {recentPayments.length === 0 && <p className="text-sm text-muted-foreground">No payments yet.</p>}
                    {recentPayments.map((p) => (
                      <div key={p.id} className="p-3 rounded-xl border border-border text-sm flex justify-between gap-3">
                        <div>
                          <div className="font-medium">{p.transactionId || p.reference || p.id}</div>
                          <div className="text-xs text-muted-foreground">
                            {p.paymentMethod} · {p.status}
                            {p.failureMessage ? ` · ${p.failureMessage}` : ''}
                          </div>
                        </div>
                        <div className="font-semibold whitespace-nowrap">
                          £{Number(p.amount || 0).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {showForm && (
            <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
              <div className="bg-card border border-border rounded-2xl w-full max-w-lg p-5 space-y-4 shadow-xl">
                <h3 className="text-lg font-bold">{editingId ? 'Edit gateway' : 'Add gateway'}</h3>
                <div className="grid gap-3">
                  <label className="text-xs font-medium">Name
                    <input className="mt-1 w-full border rounded-lg px-3 py-2 bg-background" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </label>
                  <label className="text-xs font-medium">Provider
                    <select className="mt-1 w-full border rounded-lg px-3 py-2 bg-background" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value as any })}>
                      {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-medium">Mode
                    <select className="mt-1 w-full border rounded-lg px-3 py-2 bg-background" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value as any })}>
                      <option value="test">test</option>
                      <option value="live">live</option>
                    </select>
                  </label>
                  {form.provider === 'worldpay' ? (
                    <>
                      <label className="text-xs font-medium">Worldpay username / merchant credential ID
                        <input className="mt-1 w-full border rounded-lg px-3 py-2 bg-background" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder={editingId ? 'Leave blank to keep existing' : ''} />
                      </label>
                      <label className="text-xs font-medium">Worldpay API password
                        <input type="password" className="mt-1 w-full border rounded-lg px-3 py-2 bg-background" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={editingId ? 'Leave blank to keep existing' : ''} />
                      </label>
                      <label className="text-xs font-medium">Merchant entity
                        <input className="mt-1 w-full border rounded-lg px-3 py-2 bg-background" value={form.merchantEntity} onChange={(e) => setForm({ ...form, merchantEntity: e.target.value })} />
                      </label>
                    </>
                  ) : (
                    <>
                      <label className="text-xs font-medium">API key
                        <input className="mt-1 w-full border rounded-lg px-3 py-2 bg-background" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} />
                      </label>
                      <label className="text-xs font-medium">API secret
                        <input type="password" className="mt-1 w-full border rounded-lg px-3 py-2 bg-background" value={form.apiSecret} onChange={(e) => setForm({ ...form, apiSecret: e.target.value })} />
                      </label>
                    </>
                  )}
                  <label className="text-xs flex items-center gap-2">
                    <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active
                  </label>
                  <label className="text-xs flex items-center gap-2">
                    <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} /> Default gateway
                  </label>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button className="px-3 py-2 rounded-xl border text-sm" onClick={() => setShowForm(false)}>Cancel</button>
                  <button disabled={saving} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm" onClick={save}>
                    {saving ? 'Saving…' : 'Save'}
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
