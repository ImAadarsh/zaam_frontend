'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Check,
  DollarSign,
  Loader2,
  Plus,
  Save,
  Trash2,
  Upload,
  X
} from 'lucide-react';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { RichDataTable } from '@/components/rich-data-table';
import { PriceListImportModal } from '@/components/catalog/price-list-import-modal';
import { useSession } from '@/hooks/use-session';
import { useRoleCheck } from '@/hooks/use-role-check';
import { useApiAccess } from '@/hooks/use-api-access';
import {
  createPriceListItem,
  deletePriceListItem,
  getPriceList,
  listPriceListItems,
  listVariants,
  updatePriceListItem
} from '@/lib/api';

type PriceDraft = {
  price: string;
  compareAtPrice: string;
  costPrice: string;
};

type PriceListItem = {
  id: string;
  price: number | string;
  compareAtPrice?: number | string | null;
  costPrice?: number | string | null;
  minQuantity: number;
  maxQuantity?: number | null;
  createdAt: string;
  updatedAt: string;
  variant?: {
    id: string;
    variantSku: string;
    name?: string | null;
    catalogItem?: { name?: string | null } | null;
    barcodes?: { barcode: string; isPrimary?: boolean }[];
  };
};

function numStr(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : '';
}

function primaryBarcode(item: PriceListItem): string {
  const codes = item.variant?.barcodes || [];
  if (!codes.length) return '';
  const primary = codes.find((b) => b.isPrimary) || codes[0];
  return primary?.barcode || '';
}

function draftFromItem(item: PriceListItem): PriceDraft {
  return {
    price: numStr(item.price),
    compareAtPrice: numStr(item.compareAtPrice),
    costPrice: numStr(item.costPrice)
  };
}

function draftsEqual(a: PriceDraft, b: PriceDraft): boolean {
  return a.price === b.price && a.compareAtPrice === b.compareAtPrice && a.costPrice === b.costPrice;
}

function parseOptionalMoney(value: string): number {
  const n = Number(value.trim());
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

export default function PriceListDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { session, hydrated } = useSession();
  const { hasAccess } = useRoleCheck(['ADMIN', 'SUPER_ADMIN', 'SALES_REP', 'FINANCE']);
  const { can } = useApiAccess();
  const canImport = can('POST', '/api/catalog/price-lists/:id/import');
  const canCreateItem = can('POST', '/api/catalog/price-list-items');
  const canUpdateItem = can('PATCH', '/api/catalog/price-list-items/:id');
  const canDeleteItem = can('DELETE', '/api/catalog/price-list-items/:id');

  const [priceList, setPriceList] = useState<any | null>(null);
  const [items, setItems] = useState<PriceListItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, PriceDraft>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [confirmDel, setConfirmDel] = useState<PriceListItem | null>(null);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [batchSaving, setBatchSaving] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [variantQuery, setVariantQuery] = useState('');
  const [variantResults, setVariantResults] = useState<any[]>([]);
  const [variantsLoading, setVariantsLoading] = useState(false);
  const [addForm, setAddForm] = useState({ variantId: '', price: '', compareAtPrice: '', costPrice: '' });
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    if (!params?.id) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [listRes, itemsRes] = await Promise.all([
        getPriceList(params.id),
        listPriceListItems({ priceListId: params.id })
      ]);
      const nextItems = (itemsRes.data || []) as PriceListItem[];
      setPriceList(listRes.data);
      setItems(nextItems);
      const nextDrafts: Record<string, PriceDraft> = {};
      for (const item of nextItems) nextDrafts[item.id] = draftFromItem(item);
      setDrafts(nextDrafts);
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 404) {
        setPriceList(null);
        setItems([]);
        setLoadError(null);
      } else if (status === 403) {
        setLoadError('You do not have permission to view this price list.');
      } else if (status === 401) {
        toast.error('Session expired. Please login again.');
        router.replace('/login');
      } else {
        setLoadError(e?.response?.data?.error?.message || 'Failed to load price list.');
      }
    } finally {
      setLoading(false);
    }
  }, [params?.id, router]);

  useEffect(() => {
    if (!hydrated || !hasAccess) return;
    if (!session?.accessToken) {
      router.replace('/login');
      return;
    }
    void load();
  }, [hydrated, hasAccess, session?.accessToken, router, load]);

  const dirtyIds = useMemo(() => {
    return items
      .filter((item) => {
        const draft = drafts[item.id];
        if (!draft) return false;
        return !draftsEqual(draft, draftFromItem(item));
      })
      .map((item) => item.id);
  }, [items, drafts]);

  function updateDraft(id: string, patch: Partial<PriceDraft>) {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || { price: '', compareAtPrice: '', costPrice: '' }), ...patch }
    }));
  }

  function buildUpdatePayload(draft: PriceDraft): {
    price: number;
    compareAtPrice: number | null;
    costPrice: number | null;
  } | null {
    const price = Number(draft.price);
    if (!Number.isFinite(price) || price < 0) return null;
    const compareAtPrice = draft.compareAtPrice.trim() === '' ? null : parseOptionalMoney(draft.compareAtPrice);
    const costPrice = draft.costPrice.trim() === '' ? null : parseOptionalMoney(draft.costPrice);
    if (compareAtPrice !== null && Number.isNaN(compareAtPrice)) return null;
    if (costPrice !== null && Number.isNaN(costPrice)) return null;
    return { price, compareAtPrice, costPrice };
  }

  async function saveRow(id: string): Promise<boolean> {
    const draft = drafts[id];
    if (!draft) return false;
    const payload = buildUpdatePayload(draft);
    if (!payload) {
      toast.error('Enter a valid non-negative price');
      return false;
    }
    setSavingIds((prev) => new Set(prev).add(id));
    try {
      const res = await updatePriceListItem(id, payload);
      const saved = res.data as PriceListItem;
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...saved, variant: item.variant } : item)));
      setDrafts((prev) => ({ ...prev, [id]: draftFromItem({ ...saved, variant: items.find((i) => i.id === id)?.variant }) }));
      toast.success('Price saved');
      return true;
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message ?? 'Save failed');
      return false;
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function saveAllDirty() {
    if (!dirtyIds.length) return;
    setBatchSaving(true);
    let ok = 0;
    let fail = 0;
    for (const id of dirtyIds) {
      const draft = drafts[id];
      if (!draft) continue;
      const payload = buildUpdatePayload(draft);
      if (!payload) {
        fail += 1;
        continue;
      }
      try {
        const res = await updatePriceListItem(id, payload);
        const saved = res.data as PriceListItem;
        setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...saved, variant: item.variant } : item)));
        setDrafts((prev) => {
          const existing = items.find((i) => i.id === id);
          return { ...prev, [id]: draftFromItem({ ...saved, variant: existing?.variant }) };
        });
        ok += 1;
      } catch {
        fail += 1;
      }
    }
    setBatchSaving(false);
    if (fail === 0) toast.success(`Saved ${ok} price${ok === 1 ? '' : 's'}`);
    else toast.error(`Saved ${ok}, failed ${fail}. Fix invalid rows and try again.`);
    // Refresh to sync updatedAt / server values
    await load();
  }

  async function onDelete() {
    if (!confirmDel) return;
    try {
      await deletePriceListItem(confirmDel.id);
      setItems((prev) => prev.filter((i) => i.id !== confirmDel.id));
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[confirmDel.id];
        return next;
      });
      setConfirmDel(null);
      toast.success('Item removed from price list');
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message ?? 'Delete failed');
    }
  }

  useEffect(() => {
    if (!showAdd) return;
    let cancelled = false;
    const handle = setTimeout(async () => {
      setVariantsLoading(true);
      try {
        const res = await listVariants({
          status: 'active',
          search: variantQuery.trim() || undefined,
          limit: 40
        });
        if (cancelled) return;
        const existing = new Set(items.map((i) => i.variant?.id).filter(Boolean));
        setVariantResults((res.data || []).filter((v: any) => !existing.has(v.id)));
      } catch {
        if (!cancelled) toast.error('Failed to search variants');
      } finally {
        if (!cancelled) setVariantsLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [showAdd, variantQuery, items]);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!params?.id || !addForm.variantId) {
      toast.error('Select a product variant');
      return;
    }
    const price = Number(addForm.price);
    if (!Number.isFinite(price) || price < 0) {
      toast.error('Enter a valid non-negative price');
      return;
    }
    const compareAtPrice =
      addForm.compareAtPrice.trim() === '' ? null : parseOptionalMoney(addForm.compareAtPrice);
    const costPrice = addForm.costPrice.trim() === '' ? null : parseOptionalMoney(addForm.costPrice);
    if (compareAtPrice !== null && Number.isNaN(compareAtPrice)) {
      toast.error('Compare-at must be a valid amount');
      return;
    }
    if (costPrice !== null && Number.isNaN(costPrice)) {
      toast.error('Cost must be a valid amount');
      return;
    }
    setAdding(true);
    try {
      await createPriceListItem({
        priceListId: params.id,
        variantId: addForm.variantId,
        price,
        compareAtPrice,
        costPrice
      });
      toast.success('Product added to price list');
      setShowAdd(false);
      setAddForm({ variantId: '', price: '', compareAtPrice: '', costPrice: '' });
      setVariantQuery('');
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Could not add product');
    } finally {
      setAdding(false);
    }
  }

  const currency = priceList?.currency || 'GBP';
  const columns = useMemo<ColumnDef<PriceListItem>[]>(() => [
    {
      id: 'sku',
      header: 'SKU',
      accessorFn: (r) => r.variant?.variantSku ?? '',
      cell: ({ row }) => <span className="font-mono text-sm">{row.original.variant?.variantSku ?? '—'}</span>
    },
    {
      id: 'product',
      header: 'Product',
      accessorFn: (r) => r.variant?.name || r.variant?.catalogItem?.name || '',
      cell: ({ row }) => (
        <span className="text-sm">{row.original.variant?.name || row.original.variant?.catalogItem?.name || '—'}</span>
      )
    },
    {
      id: 'barcode',
      header: 'Barcode',
      accessorFn: (r) => primaryBarcode(r),
      cell: ({ row }) => {
        const code = primaryBarcode(row.original);
        return <span className="font-mono text-xs text-muted-foreground">{code || '—'}</span>;
      }
    },
    {
      id: 'price',
      header: `Price (${currency})`,
      accessorFn: (r) => Number(drafts[r.id]?.price ?? r.price),
      cell: ({ row }) => {
        const id = row.original.id;
        const draft = drafts[id] || draftFromItem(row.original);
        const dirty = !draftsEqual(draft, draftFromItem(row.original));
        if (!canUpdateItem) {
          return <span className="font-medium">{Number(row.original.price).toFixed(2)}</span>;
        }
        return (
          <input
            type="number"
            min={0}
            step="0.01"
            value={draft.price}
            onChange={(e) => updateDraft(id, { price: e.target.value })}
            className={`input h-8 w-28 font-medium ${dirty ? 'border-[#D4A017] ring-1 ring-[#D4A017]/40' : ''}`}
            aria-label={`Price for ${row.original.variant?.variantSku || id}`}
          />
        );
      }
    },
    {
      id: 'compareAtPrice',
      header: 'Compare at',
      accessorFn: (r) => Number(drafts[r.id]?.compareAtPrice || 0),
      cell: ({ row }) => {
        const id = row.original.id;
        const draft = drafts[id] || draftFromItem(row.original);
        if (!canUpdateItem) {
          const v = row.original.compareAtPrice;
          return <span className="text-sm text-muted-foreground">{v == null || v === '' ? '—' : Number(v).toFixed(2)}</span>;
        }
        return (
          <input
            type="number"
            min={0}
            step="0.01"
            value={draft.compareAtPrice}
            onChange={(e) => updateDraft(id, { compareAtPrice: e.target.value })}
            placeholder="—"
            className="input h-8 w-24 text-sm"
            aria-label={`Compare-at for ${row.original.variant?.variantSku || id}`}
          />
        );
      }
    },
    {
      id: 'costPrice',
      header: 'Cost',
      accessorFn: (r) => Number(drafts[r.id]?.costPrice || 0),
      cell: ({ row }) => {
        const id = row.original.id;
        const draft = drafts[id] || draftFromItem(row.original);
        if (!canUpdateItem) {
          const v = row.original.costPrice;
          return <span className="text-sm text-muted-foreground">{v == null || v === '' ? '—' : Number(v).toFixed(2)}</span>;
        }
        return (
          <input
            type="number"
            min={0}
            step="0.01"
            value={draft.costPrice}
            onChange={(e) => updateDraft(id, { costPrice: e.target.value })}
            placeholder="—"
            className="input h-8 w-24 text-sm"
            aria-label={`Cost for ${row.original.variant?.variantSku || id}`}
          />
        );
      }
    },
    {
      id: 'qty',
      header: 'Min / max qty',
      accessorFn: (r) => r.minQuantity,
      cell: ({ row }) => (
        <span className="text-sm">{row.original.minQuantity}{row.original.maxQuantity ? ` – ${row.original.maxQuantity}` : '+'}</span>
      )
    },
    {
      accessorKey: 'updatedAt',
      header: 'Updated',
      cell: ({ row }) => (
        <span className="text-sm whitespace-nowrap">{new Date(row.original.updatedAt).toLocaleDateString('en-GB')}</span>
      )
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => {
        const id = row.original.id;
        const draft = drafts[id] || draftFromItem(row.original);
        const dirty = !draftsEqual(draft, draftFromItem(row.original));
        const saving = savingIds.has(id);
        return (
          <div className="flex items-center gap-1 justify-end">
            {canUpdateItem && dirty && (
              <button
                onClick={() => void saveRow(id)}
                disabled={saving || batchSaving}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-[#D4A017] text-white hover:bg-[#B89015] disabled:opacity-50"
                title="Save this row"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Save
              </button>
            )}
            {canDeleteItem && (
              <button
                onClick={() => setConfirmDel(row.original)}
                className="p-1 hover:bg-gray-100 rounded text-red-600"
                title="Remove from price list"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        );
      }
    }
  ], [currency, canUpdateItem, canDeleteItem, drafts, savingIds, batchSaving]);

  if (!hydrated || !hasAccess) return null;

  return (
    <div className="min-h-screen app-surface">
      <Sidebar />
      <div className="flex flex-col overflow-hidden lg:ml-[280px]">
        <Header title="Catalog · Manage Prices" />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <Link href="/catalog/price-lists" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft size={16} /> Back to price lists
            </Link>

            {loading ? (
              <div className="space-y-4">
                <div className="h-28 rounded-2xl border border-border bg-card animate-pulse" />
                <div className="h-64 rounded-2xl border border-border bg-card animate-pulse" />
                <p className="text-center text-sm text-muted-foreground">Loading prices…</p>
              </div>
            ) : loadError ? (
              <div className="rounded-2xl border border-border bg-card p-10 text-center space-y-4">
                <p className="text-sm text-muted-foreground">{loadError}</p>
                <button onClick={() => void load()} className="btn btn-outline">
                  Try again
                </button>
              </div>
            ) : !priceList ? (
              <div className="rounded-2xl border border-border bg-card p-10 text-center space-y-3">
                <h2 className="text-lg font-semibold">Price list not found</h2>
                <p className="text-sm text-muted-foreground">It may have been deleted, or you no longer have access.</p>
                <Link href="/catalog/price-lists" className="btn btn-outline inline-flex">
                  Back to price lists
                </Link>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2 flex-wrap">
                      <DollarSign className="h-6 w-6" />
                      {priceList.name}
                      <span className="font-mono text-sm font-normal text-muted-foreground">{priceList.code}</span>
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {priceList.type?.replace(/_/g, ' ')} · {currency} · {priceList.status}
                      {priceList.isDefault ? ' · default' : ''} · {items.length} item{items.length === 1 ? '' : 's'}
                      {dirtyIds.length > 0 ? ` · ${dirtyIds.length} unsaved` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 self-start">
                    {canUpdateItem && dirtyIds.length > 0 && (
                      <button
                        onClick={() => void saveAllDirty()}
                        disabled={batchSaving}
                        className="flex items-center gap-2 px-4 py-2 bg-[#D4A017] text-white rounded hover:bg-[#B89015] disabled:opacity-50"
                      >
                        {batchSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save {dirtyIds.length} change{dirtyIds.length === 1 ? '' : 's'}
                      </button>
                    )}
                    {canCreateItem && (
                      <button
                        onClick={() => setShowAdd(true)}
                        className="flex items-center gap-2 px-4 py-2 border border-border rounded hover:bg-muted"
                      >
                        <Plus className="h-4 w-4" />
                        Add product
                      </button>
                    )}
                    {canImport && (
                      <button
                        onClick={() => setShowImport(true)}
                        className="flex items-center gap-2 px-4 py-2 border border-border rounded hover:bg-muted text-muted-foreground"
                        title="Import from CSV or Excel"
                      >
                        <Upload className="h-4 w-4" />
                        Import
                      </button>
                    )}
                  </div>
                </div>

                {items.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center space-y-4">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                      <DollarSign className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold">No products on this list yet</h2>
                      <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
                        Add variants one by one, or import a CSV / Excel file to set selling prices in bulk.
                      </p>
                    </div>
                    <div className="flex flex-wrap justify-center gap-2">
                      {canCreateItem && (
                        <button
                          onClick={() => setShowAdd(true)}
                          className="flex items-center gap-2 px-4 py-2 bg-[#D4A017] text-white rounded hover:bg-[#B89015]"
                        >
                          <Plus className="h-4 w-4" />
                          Add product
                        </button>
                      )}
                      {canImport && (
                        <button
                          onClick={() => setShowImport(true)}
                          className="flex items-center gap-2 px-4 py-2 border border-border rounded hover:bg-muted"
                        >
                          <Upload className="h-4 w-4" />
                          Import CSV / Excel
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <RichDataTable columns={columns} data={items} searchPlaceholder="Search by SKU, product, or barcode…" />
                )}
              </>
            )}

            {showAdd && priceList && (
              <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="w-full max-w-lg rounded-2xl bg-card shadow-2xl border border-border p-6 max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Add product to {priceList.name}</h3>
                    <button
                      onClick={() => {
                        setShowAdd(false);
                        setAddForm({ variantId: '', price: '', compareAtPrice: '', costPrice: '' });
                        setVariantQuery('');
                      }}
                      className="p-1 hover:bg-muted rounded-lg"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <form onSubmit={onAdd} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Search variant</label>
                      <input
                        type="search"
                        value={variantQuery}
                        onChange={(e) => setVariantQuery(e.target.value)}
                        placeholder="SKU or name…"
                        className="input"
                        autoFocus
                      />
                      <div className="mt-2 max-h-48 overflow-auto rounded-lg border border-border">
                        {variantsLoading ? (
                          <p className="p-3 text-sm text-muted-foreground">Searching…</p>
                        ) : variantResults.length === 0 ? (
                          <p className="p-3 text-sm text-muted-foreground">
                            {variantQuery.trim()
                              ? 'No matching variants left to add.'
                              : 'Type to search active variants, or browse recent ones below.'}
                          </p>
                        ) : (
                          <ul className="divide-y divide-border">
                            {variantResults.map((v) => (
                              <li key={v.id}>
                                <button
                                  type="button"
                                  onClick={() => setAddForm((prev) => ({ ...prev, variantId: v.id }))}
                                  className={`w-full text-left px-3 py-2 text-sm hover:bg-muted ${
                                    addForm.variantId === v.id ? 'bg-[#D4A017]/10' : ''
                                  }`}
                                >
                                  <span className="font-mono">{v.variantSku}</span>
                                  <span className="text-muted-foreground"> · {v.name || v.catalogItem?.name || '—'}</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      {addForm.variantId && (
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          Selected:{' '}
                          <span className="font-mono">
                            {variantResults.find((v) => v.id === addForm.variantId)?.variantSku || addForm.variantId}
                          </span>
                        </p>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Price *</label>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          required
                          value={addForm.price}
                          onChange={(e) => setAddForm((prev) => ({ ...prev, price: e.target.value }))}
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Compare at</label>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={addForm.compareAtPrice}
                          onChange={(e) => setAddForm((prev) => ({ ...prev, compareAtPrice: e.target.value }))}
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Cost</label>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={addForm.costPrice}
                          onChange={(e) => setAddForm((prev) => ({ ...prev, costPrice: e.target.value }))}
                          className="input"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t border-border">
                      <button
                        type="button"
                        onClick={() => setShowAdd(false)}
                        className="btn btn-outline"
                        disabled={adding}
                      >
                        Cancel
                      </button>
                      <button type="submit" className="btn btn-primary" disabled={adding || !addForm.variantId}>
                        {adding ? 'Adding…' : 'Add to list'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {showImport && priceList && (
              <PriceListImportModal
                priceList={priceList}
                onClose={() => setShowImport(false)}
                onImported={() => void load()}
              />
            )}

            {confirmDel && (
              <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="w-full max-w-md rounded-2xl bg-card shadow-2xl border border-border p-6">
                  <h3 className="text-lg font-semibold mb-4">Remove item</h3>
                  <p className="mb-4 text-muted-foreground">
                    Remove {confirmDel.variant?.variantSku ?? 'this item'} from {priceList?.name}? The product itself is not deleted.
                  </p>
                  <div className="flex justify-end gap-3 pt-4 border-t border-border">
                    <button onClick={() => setConfirmDel(null)} className="btn btn-outline">Cancel</button>
                    <button onClick={onDelete} className="btn bg-red-600 hover:bg-red-700 text-white">Remove</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
