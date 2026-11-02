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

type Tri = 'any' | 'yes' | 'no';
type ScoreBand = 'any' | 'low' | 'med' | 'high';

type ProductFilters = {
  visibleOnB2bShop: Tri;
  hasCoupon: Tri;
  hasB2bPrice: Tri;
  inStock: Tri;
  missingBarcode: Tri;
  missingImage: Tri;
  scoreBand: ScoreBand;
};

const DEFAULT_FILTERS: ProductFilters = {
  visibleOnB2bShop: 'any',
  hasCoupon: 'any',
  hasB2bPrice: 'any',
  inStock: 'any',
  missingBarcode: 'any',
  missingImage: 'any',
  scoreBand: 'any'
};

async function fetchAllProducts(organizationId: string) {
  const out: any[] = [];
  for (let page = 1; page <= 50; page++) {
    const res = await listB2bProducts({ organizationId, limit: 200, page });
    out.push(...(res.data || []));
    const totalPages = res.pagination?.totalPages ?? 1;
    if (page >= totalPages) break;
  }
  return out;
}

function triMatch(tri: Tri, value: boolean): boolean {
  if (tri === 'any') return true;
  return tri === 'yes' ? value : !value;
}

function scoreTone(band: string) {
  if (band === 'high') return 'bg-emerald-500/10 text-emerald-700';
  if (band === 'med') return 'bg-amber-500/10 text-amber-700';
  return 'bg-rose-500/10 text-rose-700';
}

function FilterChip({
  active,
  label,
  onClick
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
        active
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border bg-background text-muted-foreground hover:border-primary/50'
      }`}
    >
      {label}
    </button>
  );
}

function cycleTri(current: Tri): Tri {
  if (current === 'any') return 'yes';
  if (current === 'yes') return 'no';
  return 'any';
}

function triLabel(base: string, tri: Tri): string {
  if (tri === 'yes') return base;
  if (tri === 'no') return `Not ${base.charAt(0).toLowerCase()}${base.slice(1)}`;
  return base;
}

export default function B2bProductsPage() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const { hasAccess } = useRoleCheck(['ADMIN', 'SUPER_ADMIN', 'SALES_REP', 'B2B_M']);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [publishMode, setPublishMode] = useState<'all_active' | 'mapped_only'>('all_active');
  const [filters, setFilters] = useState<ProductFilters>(DEFAULT_FILTERS);
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
      setItems((prev) =>
        prev.map((p) => {
          if (!idSet.has(String(p.id))) return p;
          const published = publish;
          const active = p.status === 'active';
          const visibleOnB2bShop = publishMode === 'all_active' ? active : published && active;
          const checks = {
            visibleOnB2bShop,
            hasB2bPrice: Boolean(p.hasB2bPrice),
            hasStock: Boolean(p.hasStock),
            hasImage: Boolean(p.hasImage),
            hasBarcode: Boolean(p.hasBarcode)
          };
          const passed = Object.values(checks).filter(Boolean).length;
          const readinessScore = Math.round((passed / 5) * 100);
          const readinessBand = readinessScore >= 70 ? 'high' : readinessScore >= 40 ? 'med' : 'low';
          return {
            ...p,
            published,
            visibleOnB2bShop,
            readinessChecks: checks,
            readinessScore,
            readinessBand
          };
        })
      );
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
      // Recompute visibility / score for current rows
      setItems((prev) =>
        prev.map((p) => {
          const published = Boolean(p.published);
          const active = p.status === 'active';
          const visibleOnB2bShop = mode === 'all_active' ? active : published && active;
          const checks = {
            visibleOnB2bShop,
            hasB2bPrice: Boolean(p.hasB2bPrice),
            hasStock: Boolean(p.hasStock),
            hasImage: Boolean(p.hasImage),
            hasBarcode: Boolean(p.hasBarcode)
          };
          const passed = Object.values(checks).filter(Boolean).length;
          const readinessScore = Math.round((passed / 5) * 100);
          const readinessBand = readinessScore >= 70 ? 'high' : readinessScore >= 40 ? 'med' : 'low';
          return { ...p, visibleOnB2bShop, readinessChecks: checks, readinessScore, readinessBand };
        })
      );
      toast.success(mode === 'mapped_only' ? 'Only selected products are now shown on the portal' : 'All active products are now shown on the portal');
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Failed to update publish mode');
    }
  };

  const filtersActive = useMemo(
    () => Object.values(filters).some((v) => v !== 'any'),
    [filters]
  );

  const tableRows = useMemo(() => {
    return items.filter((p) => {
      const visibleOnB2bShop = p.visibleOnB2bShop ?? (publishMode === 'all_active' ? p.status === 'active' : Boolean(p.published) && p.status === 'active');
      const hasOffer = Boolean(p.hasCoupon || p.hasPromo);
      if (!triMatch(filters.visibleOnB2bShop, visibleOnB2bShop)) return false;
      if (!triMatch(filters.hasCoupon, hasOffer)) return false;
      if (!triMatch(filters.hasB2bPrice, Boolean(p.hasB2bPrice))) return false;
      if (!triMatch(filters.inStock, Boolean(p.hasStock))) return false;
      if (filters.missingBarcode === 'yes' && p.hasBarcode) return false;
      if (filters.missingBarcode === 'no' && !p.hasBarcode) return false;
      if (filters.missingImage === 'yes' && p.hasImage) return false;
      if (filters.missingImage === 'no' && !p.hasImage) return false;
      if (filters.scoreBand !== 'any' && (p.readinessBand || 'low') !== filters.scoreBand) return false;
      return true;
    });
  }, [items, filters, publishMode]);

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
      id: 'readinessScore',
      accessorFn: (r) => Number(r.readinessScore ?? 0),
      header: 'Ready',
      cell: ({ row }) => {
        const score = Number(row.original.readinessScore ?? 0);
        const band = String(row.original.readinessBand || 'low');
        const checks = row.original.readinessChecks || {};
        const tips = [
          checks.visibleOnB2bShop ? 'On B2B Shop' : 'Not on B2B Shop',
          checks.hasB2bPrice ? 'Has price' : 'No B2B price',
          checks.hasStock ? 'In stock' : 'No stock',
          checks.hasImage ? 'Has image' : 'No image',
          checks.hasBarcode ? 'Has barcode' : 'No barcode'
        ].join(' · ');
        return (
          <span
            title={tips}
            className={`text-xs font-semibold px-2 py-1 rounded-full tabular-nums ${scoreTone(band)}`}
          >
            {score} · {band === 'med' ? 'Med' : band.charAt(0).toUpperCase() + band.slice(1)}
          </span>
        );
      }
    },
    {
      id: 'onPortal',
      accessorFn: (r) => (r.visibleOnB2bShop ? 'Visible' : 'Hidden'),
      header: 'B2B Shop',
      cell: ({ row }) => {
        const visible = Boolean(row.original.visibleOnB2bShop);
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
      id: 'hasCoupon',
      accessorFn: (r) => (r.hasCoupon || r.hasPromo ? 'Yes' : 'No'),
      header: 'Offer',
      cell: ({ row }) => {
        const on = Boolean(row.original.hasCoupon || row.original.hasPromo);
        return (
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${on ? 'bg-sky-500/10 text-sky-700' : 'bg-muted text-muted-foreground'}`}>
            {on ? (row.original.hasCoupon ? 'Coupon' : 'Promo') : '—'}
          </span>
        );
      }
    },
    {
      id: 'hasB2bPrice',
      accessorFn: (r) => (r.hasB2bPrice ? 'Yes' : 'No'),
      header: 'B2B price',
      cell: ({ row }) => (row.original.hasB2bPrice ? 'Yes' : '—')
    },
    {
      id: 'hasStock',
      accessorFn: (r) => (r.hasStock ? 'Yes' : 'No'),
      header: 'Stock',
      cell: ({ row }) => (row.original.hasStock ? 'In stock' : 'Out')
    },
    {
      accessorKey: 'sellingPrice',
      header: 'Selling',
      cell: ({ row }) => row.original.sellingPrice != null ? `£${Number(row.original.sellingPrice).toFixed(2)}` : '—'
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
  ], [publishMode, busy]);

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
                  Filter by B2B Shop visibility, offers, and catalog readiness — not a KPI score.
                </p>
              </div>
            </div>
            <button
              onClick={() => { setSelected(new Set()); setAddSearch(''); setShowAdd(true); }}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-semibold"
            >
              <Plus size={16} /> Add products
            </button>
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

          <div className="p-3 rounded-2xl border border-border bg-card space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Catalog readiness filters</p>
              {filtersActive && (
                <button
                  type="button"
                  className="text-xs font-semibold text-primary hover:underline"
                  onClick={() => setFilters(DEFAULT_FILTERS)}
                >
                  Clear filters
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <FilterChip
                active={filters.visibleOnB2bShop !== 'any'}
                label={
                  filters.visibleOnB2bShop === 'any'
                    ? 'B2B Shop: all'
                    : filters.visibleOnB2bShop === 'yes'
                      ? 'Visible on B2B Shop'
                      : 'Not visible on B2B Shop'
                }
                onClick={() => setFilters((f) => ({ ...f, visibleOnB2bShop: cycleTri(f.visibleOnB2bShop) }))}
              />
              <FilterChip
                active={filters.hasCoupon !== 'any'}
                label={
                  filters.hasCoupon === 'any'
                    ? 'Coupon / promo'
                    : filters.hasCoupon === 'yes'
                      ? 'Has coupon / promo'
                      : 'No coupon / promo'
                }
                onClick={() => setFilters((f) => ({ ...f, hasCoupon: cycleTri(f.hasCoupon) }))}
              />
              <FilterChip
                active={filters.hasB2bPrice !== 'any'}
                label={triLabel('Has B2B price', filters.hasB2bPrice)}
                onClick={() => setFilters((f) => ({ ...f, hasB2bPrice: cycleTri(f.hasB2bPrice) }))}
              />
              <FilterChip
                active={filters.inStock !== 'any'}
                label={
                  filters.inStock === 'any'
                    ? 'Stock'
                    : filters.inStock === 'yes'
                      ? 'In stock'
                      : 'Out of stock'
                }
                onClick={() => setFilters((f) => ({ ...f, inStock: cycleTri(f.inStock) }))}
              />
              <FilterChip
                active={filters.missingImage !== 'any'}
                label={filters.missingImage === 'yes' ? 'Missing image' : filters.missingImage === 'no' ? 'Has image' : 'Image'}
                onClick={() => setFilters((f) => ({ ...f, missingImage: cycleTri(f.missingImage) }))}
              />
              <FilterChip
                active={filters.missingBarcode !== 'any'}
                label={filters.missingBarcode === 'yes' ? 'Missing barcode' : filters.missingBarcode === 'no' ? 'Has barcode' : 'Barcode'}
                onClick={() => setFilters((f) => ({ ...f, missingBarcode: cycleTri(f.missingBarcode) }))}
              />
              <FilterChip
                active={filters.scoreBand === 'high'}
                label="Ready: High"
                onClick={() => setFilters((f) => ({ ...f, scoreBand: f.scoreBand === 'high' ? 'any' : 'high' }))}
              />
              <FilterChip
                active={filters.scoreBand === 'med'}
                label="Ready: Med"
                onClick={() => setFilters((f) => ({ ...f, scoreBand: f.scoreBand === 'med' ? 'any' : 'med' }))}
              />
              <FilterChip
                active={filters.scoreBand === 'low'}
                label="Ready: Low"
                onClick={() => setFilters((f) => ({ ...f, scoreBand: f.scoreBand === 'low' ? 'any' : 'low' }))}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Ready score = checklist of B2B Shop visible, B2B price, stock, image, barcode (20 pts each). Hover a score for the checklist.
            </p>
          </div>

          {loading ? <div className="text-muted-foreground">Loading...</div> : (
            <RichDataTable
              data={tableRows}
              columns={columns}
              tableId="b2b-products-readiness-v1"
              defaultSort={false}
              searchPlaceholder="Search SKU, name, brand..."
              initialColumnVisibility={{
                brand: false,
                category: false,
                sellingPrice: false,
                hasB2bPrice: true,
                hasStock: true
              }}
              emptyMessage={
                filtersActive
                  ? 'No products match — clear filters'
                  : 'No catalog products to publish yet. Add items in Catalog, then return here to show them on the B2B portal.'
              }
            />
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
