'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { RichDataTable } from '@/components/rich-data-table';
import { FilterBar, type FilterField } from '@/components/filter-bar';
import { useSession } from '@/hooks/use-session';
import { listCrmAccounts, createCustomer } from '@/lib/api';
import { crmApiError, displayName } from '@/lib/crm-utils';
import { toast } from 'sonner';
import { ColumnDef } from '@tanstack/react-table';
import { Building2, Plus, X, Eye, AlertCircle, ExternalLink } from 'lucide-react';

export default function CrmAccountsPage() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [apiMissing, setApiMissing] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    companyName: '',
    customerType: 'business' as const,
  });
  const [saving, setSaving] = useState(false);

  const orgId = session?.user?.organizationId;

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const res = await listCrmAccounts({
        organizationId: orgId,
        search: search || undefined,
        ownerUserId: filters.ownerUserId || undefined,
      });
      setItems(res.data || []);
      setApiMissing(false);
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setApiMissing(true);
        setItems([]);
      } else {
        toast.error(crmApiError(err, 'Failed to load accounts'));
      }
    } finally {
      setLoading(false);
    }
  }, [orgId, search, filters]);

  useEffect(() => {
    if (!hydrated) return;
    if (!session?.accessToken) {
      router.replace('/login');
      return;
    }
    void load();
  }, [hydrated, session?.accessToken, router, load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId) return;
    setSaving(true);
    try {
      // Accounts are ERP customers — create customer then open Account 360
      const res = await createCustomer({
        organizationId: orgId,
        firstName: form.firstName || undefined,
        lastName: form.lastName || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        companyName: form.companyName || undefined,
        customerType: form.customerType,
      });
      toast.success('Customer created — opening Account 360');
      setShowCreate(false);
      router.push(`/crm/accounts/${res.data.id}`);
    } catch (err) {
      toast.error(crmApiError(err, 'Failed to create customer'));
    } finally {
      setSaving(false);
    }
  }

  const filterFields = useMemo<FilterField[]>(() => [], []);

  const columns = useMemo<ColumnDef<any>[]>(() => [
    {
      id: 'name',
      header: 'Account',
      accessorFn: (r) => displayName(r),
      cell: (info) => (
        <Link href={`/crm/accounts/${info.row.original.id}`} className="font-semibold text-[#D4A017] hover:underline">
          {info.getValue() as string}
        </Link>
      ),
    },
    {
      accessorKey: 'companyName',
      header: 'Company',
      cell: (i) => (i.getValue() as string) || '—',
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: (i) => (i.getValue() as string) || '—',
    },
    {
      id: 'erp',
      header: 'ERP ID',
      cell: (info) => (
        <span className="font-mono text-xs text-muted-foreground">#{info.row.original.id}</span>
      ),
    },
    {
      id: 'open',
      header: 'Open',
      cell: (info) => {
        const r = info.row.original;
        return (
          <span className="text-xs text-muted-foreground">
            {r.openTicketsCount ?? 0} tix · {r.openDealsCount ?? 0} deals
          </span>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      cell: (info) => (
        <Link href={`/crm/accounts/${info.row.original.id}`} className="p-2 rounded-lg hover:bg-muted text-muted-foreground inline-flex">
          <Eye size={16} />
        </Link>
      ),
    },
  ], []);

  return (
    <div className="min-h-screen app-surface">
      <Sidebar />
      <div className="flex flex-col min-w-0 lg:ml-[280px]">
        <Header
          title="CRM Accounts"
          actions={[
            { label: 'ERP Customers', onClick: () => router.push('/orders/customers'), icon: <ExternalLink size={16} /> },
            { label: 'New Account', onClick: () => setShowCreate(true), icon: <Plus size={18} /> },
          ]}
        />
        <main className="p-6 md:p-8 space-y-4">
          {apiMissing && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-amber-700 dark:text-amber-400 text-sm">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold">Accounts API not ready</div>
                <div className="text-xs mt-0.5 opacity-80">Waiting on <code className="font-mono">GET /api/crm/accounts</code>.</div>
              </div>
            </div>
          )}

          <FilterBar
            fields={filterFields}
            values={filters}
            onChange={setFilters}
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search accounts…"
            stats={[{ label: 'Accounts', value: loading ? '…' : String(items.length) }]}
            loading={loading}
          />

          {!loading && items.length === 0 && !apiMissing ? (
            <div className="glass-panel rounded-2xl border border-border/50 p-12 text-center text-muted-foreground">
              <Building2 className="mx-auto mb-3 opacity-40" size={32} />
              <p className="font-medium text-foreground">No accounts yet</p>
              <p className="text-sm mt-1">CRM accounts are ERP customers. Create one here or import from Orders.</p>
            </div>
          ) : (
            <RichDataTable data={items} columns={columns} hideSearch />
          )}
        </main>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-border flex items-center justify-between bg-muted/30">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Plus className="text-primary" /> New ERP Customer / Account
              </h2>
              <button type="button" onClick={() => setShowCreate(false)} className="p-2 hover:bg-muted rounded-full">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <p className="text-xs text-muted-foreground">Creates an ERP customer (Account 360 id = customer id).</p>
              <div className="grid grid-cols-2 gap-4">
                <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="input" placeholder="First name" />
                <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="input" placeholder="Last name" />
              </div>
              <input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} className="input" placeholder="Company" />
              <div className="grid grid-cols-2 gap-4">
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" placeholder="Email" />
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" placeholder="Phone" />
              </div>
              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setShowCreate(false)} className="btn flex-1 bg-muted">Cancel</button>
                <button type="submit" disabled={saving} className="btn btn-primary flex-1">{saving ? 'Saving…' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
