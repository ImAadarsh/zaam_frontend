'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { RichDataTable } from '@/components/rich-data-table';
import { useSession } from '@/hooks/use-session';
import { useRoleCheck } from '@/hooks/use-role-check';
import { listB2bProducts, publishB2bProducts, unpublishB2bProducts, getB2bSettings, updateB2bSettings } from '@/lib/api';
import { toast } from 'sonner';
import { ColumnDef } from '@tanstack/react-table';
import { Package2, Plus, X } from 'lucide-react';

type Visibility = 'all' | 'published' | 'hidden';

async function fetchAllProducts(organizationId: string, extra?: { search?: string; published?: string }) {
  const out: any[] = [];
  for (let page = 1; page <= 50; page++) {
    const res = await listB2bProducts({ organizationId, limit: 200, page, ...extra } as any);
    out.push(...(res.data || []));
    const totalPages = res.pagination?.totalPages ?? 1;
    if (page >= totalPages) break;
  }
  return out;
}

export default function B2bProductsPage() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const { hasAccess } = useRoleCheck(['ADMIN', 'SUPER_ADMIN', 'SALES_REP']);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [publishMode, setPublishMode] = useState<'all_active' | 'mapped_only'>('all_active');
  const [visibility, setVisibility] = useState<Visibility>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const orgId = session?.user?.organizationId;

  const load = async () => {
    if (!orgId) return;
    const [prod, settings] = await Promise.all([fetchAllProducts(orgId), getB2bSettings(orgId)]);
    setItems(prod);
    setPublishMode(settings.data?.publishMode || 'all_active');
  };

  useEffect(() => {
    if (!hydrated || !hasAccess) return;
    if (!session?.accessToken) {
      router.replace('/login');
      return;
    }
    load().catch(() => toast.error('Failed to load B2B products')).finally(() => setLoading(false));
  }, [hydrated, hasAccess, session?.accessToken, orgId]);

  const setPublished = async (ids: string[], publish: boolean) => {
    if (!orgId || ids.length === 0) return;
    setBusy(true);
    try {
      if (publish) await publishB2bProducts({ organizationId: orgId, catalogItemIds: ids });
      else await unpublishB2bProducts({ organizationId: orgId, catalogItemIds: ids });
      const idSet = new Set(ids.map(String));
      setItems((prev) => prev.map((p) => (idSet.has(String(p.id)) ? { ...p, published: publish } : p)));
      toast.success(
        publish
          ? `${ids.length} product${ids.length === 1 ? '' : 's'} added to the B2B portal`
          : `${ids.length} product${ids.length === 1 ? '' : 's'} removed from the B2B portal`
      );
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  const switchMode = async (mode: 'all_active' | 'mapped_only') => {
    if (!orgId) return;
    const publishedCount = items.filter((p) => p.published).length;
    const message = mode === 'mapped_only'
      ? `Retailers will only see products you add here. ${publishedCount} product(s) are currently added. Continue?`
      : 'Every active catalog product will become visible to retailers. Continue?';
    if (!window.confirm(message)) return;
    try {
      await updateB2bSettings({ organizationId: orgId, publishMode: mode });
      setPublishMode(mode);
      toast.success(mode === 'mapped_only' ? 'Only selected products are now shown on the portal' : 'All active products are now shown on the portal');
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Failed to update publish mode');
    }
  };

  const isVisible = (p: any) => (publishMode === 'all_active' ? p.status === 'active' : Boolean(p.published) && p.status === 'active');

  const tableRows = useMemo(() => {
    if (visibility === 'all') return items;
    return items.filter((p) => (visibility === 'published' ? isVisible(p) : !isVisible(p)));
  }, [items, visibility, publishMode]);

  const addCandidates = useMemo(() => {
    const q = addSearch.trim().toLowerCase();
    return items
      .filter((p) => !p.published && p.status === 'active')
      .filter((p) => !q || [p.sku, p.name, p.brand, p.category].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [items, addSearch]);

  const columns = useMemo<ColumnDef<any>[]>(() => [
    { accessorKey: 'sku', header: 'SKU' },
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'brand', header: 'Brand' },
    { accessorKey: 'category', header: 'Category' },
    {
      accessorKey: 'sellingPrice',
      header: 'Selling',
      cell: ({ row }) => row.original.sellingPrice != null ? `£${Number(row.original.sellingPrice).toFixed(2)}` : '—'
    },
    {
      id: 'onPortal',
      accessorFn: (r) => (isVisible(r) ? 'Visible' : 'Hidden'),
      header: 'On portal',
      cell: ({ row }) => {
        const visible = isVisible(row.original);
        const label = publishMode === 'all_active'
          ? (visible ? 'Visible (all active)' : 'Hidden (inactive)')
          : (visible ? 'Visible' : row.original.published ? 'Added (inactive item)' : 'Not added');
        return (
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${visible ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
            {label}
          </span>
        );
      }
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <button
          disabled={busy}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-border hover:border-primary disabled:opacity-50"
          onClick={() => setPublished([String(row.original.id)], !row.original.published)}
        >
          {row.original.published ? 'Remove' : 'Add'}
        </button>
      )
    }
  ], [publishMode, busy, orgId]);

  return (
    <div className="min-h-screen app-surface">
      <Sidebar />
      <div className="flex flex-col overflow-hidden lg:ml-[280px]">
        <Header title="B2B · Products" />
        <main className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Package2 />
              <div>
                <h1 className="text-xl font-bold">ERP products on B2B</h1>
                <p className="text-sm text-muted-foreground">
                  {publishMode === 'all_active'
                    ? 'All active catalog items are visible on the wholesale site.'
                    : 'Only the products you add here are visible on the wholesale site.'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="border border-border rounded-lg px-3 py-2 bg-background text-sm"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as Visibility)}
              >
                <option value="all">All products</option>
                <option value="published">Visible on portal</option>
                <option value="hidden">Not visible</option>
              </select>
              <button
                onClick={() => { setSelected(new Set()); setAddSearch(''); setShowAdd(true); }}
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-semibold"
              >
                <Plus size={16} /> Add products
              </button>
            </div>
          </div>

          <div className="p-4 rounded-2xl border border-border bg-card flex flex-wrap items-center justify-between gap-3 text-sm">
            {publishMode === 'all_active' ? (
              <>
                <span>
                  Publish mode: <b>All active products</b>. Products you add/remove here are saved, but only take effect once you switch to selected products.
                </span>
                <button className="px-3 py-1.5 rounded-lg border border-border hover:border-primary font-semibold" onClick={() => switchMode('mapped_only')}>
                  Show only selected products
                </button>
              </>
            ) : (
              <>
                <span>
                  Publish mode: <b>Selected products only</b> · {items.filter((p) => p.published && p.status === 'active').length} visible to retailers.
                </span>
                <button className="px-3 py-1.5 rounded-lg border border-border hover:border-primary font-semibold" onClick={() => switchMode('all_active')}>
                  Show all active products
                </button>
              </>
            )}
          </div>

          {loading ? <div className="text-muted-foreground">Loading...</div> : (
            <RichDataTable data={tableRows} columns={columns} searchPlaceholder="Search SKU, name, brand..." />
          )}
        </main>
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-3xl p-6 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center">
              <h2 className="font-bold">Add products to the B2B portal</h2>
              <button onClick={() => setShowAdd(false)}><X size={18} /></button>
            </div>
            <div className="flex items-center gap-2">
              <input
                className="flex-1 border border-border rounded-lg px-3 py-2 bg-background text-sm"
                placeholder="Search by SKU, name, brand or category"
                value={addSearch}
                onChange={(e) => setAddSearch(e.target.value)}
              />
              <button
                className="text-xs font-semibold px-3 py-2 rounded-lg border border-border"
                onClick={() => setSelected(new Set(addCandidates.map((p) => String(p.id))))}
              >
                Select all ({addCandidates.length})
              </button>
              <button className="text-xs font-semibold px-3 py-2 rounded-lg border border-border" onClick={() => setSelected(new Set())}>
                Clear
              </button>
            </div>
            <div className="flex-1 overflow-auto border border-border rounded-xl divide-y divide-border">
              {addCandidates.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground text-center">All active products are already added.</div>
              ) : addCandidates.slice(0, 500).map((p) => {
                const id = String(p.id);
                return (
                  <label key={id} className="flex items-center gap-3 px-4 py-2 text-sm cursor-pointer hover:bg-muted/40">
                    <input
                      type="checkbox"
                      checked={selected.has(id)}
                      onChange={(e) => {
                        const next = new Set(selected);
                        if (e.target.checked) next.add(id); else next.delete(id);
                        setSelected(next);
                      }}
                    />
                    <span className="font-mono text-xs w-32 shrink-0">{p.sku}</span>
                    <span className="flex-1">{p.name}</span>
                    <span className="text-muted-foreground text-xs">{p.category || ''}</span>
                  </label>
                );
              })}
            </div>
            {addCandidates.length > 500 && (
              <p className="text-xs text-muted-foreground">Showing the first 500 matches — refine the search to find more.</p>
            )}
            <div className="flex justify-end gap-2">
              <button className="px-4 py-2 rounded-xl border border-border text-sm" onClick={() => setShowAdd(false)}>Cancel</button>
              <button
                disabled={busy || selected.size === 0}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
                onClick={async () => {
                  await setPublished(Array.from(selected), true);
                  setShowAdd(false);
                }}
              >
                Add {selected.size || ''} product{selected.size === 1 ? '' : 's'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
