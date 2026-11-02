'use client';
import { Suspense, useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { 
  listVariants, createVariant, deleteVariant,
  listCatalogItems, createProductMedia,
  listWarehouses, listRacks, listBins
} from '@/lib/api';
import { toast } from 'sonner';
import { RichDataTable } from '@/components/rich-data-table';
import { useSession } from '@/hooks/use-session';
import { useRoleCheck } from '@/hooks/use-role-check';
import { useApiAccess } from '@/hooks/use-api-access';
import { ColumnDef } from '@tanstack/react-table';
import { Pencil, Trash2, Plus, X, Tag, Loader2 } from 'lucide-react';
import { MediaThumb } from '@/components/catalog/media-preview';
import { SearchableSelect } from '@/components/searchable-select';
import { VariantEditDialog } from '@/components/catalog/variant-edit-dialog';

type VariantBarcode = {
  id?: string;
  barcode: string;
  type?: string | null;
  isPrimary?: boolean;
};

type Variant = {
  id: string;
  variantSku: string;
  name?: string | null;
  option1Name?: string | null;
  option1Value?: string | null;
  option2Name?: string | null;
  option2Value?: string | null;
  option3Name?: string | null;
  option3Value?: string | null;
  weightValue?: number | null;
  weightUnit?: 'g' | 'kg' | 'lb' | 'oz' | null;
  lengthValue?: number | null;
  widthValue?: number | null;
  heightValue?: number | null;
  dimensionUnit?: 'cm' | 'm' | 'in' | 'ft' | null;
  costPrice?: number | null;
  costCurrency: string;
  /** Sell price from active price_list_items (retail preferred). */
  sellingPrice?: number | null;
  /** Variant-level tags / sheet extras (post-023). */
  attributes?: Record<string, any> | null;
  imageUrl?: string | null;
  position?: number;
  status: 'active' | 'inactive' | 'discontinued';
  barcodes?: VariantBarcode[];
  /** Sum of quantity_on_hand across warehouses for this variant. */
  stockQty?: number;
  /** MAX(stock_items.reorder_point) across warehouses — UI "Reorder level". */
  reorderLevel?: number | null;
  /** MAX(stock_items.reorder_quantity) across warehouses. */
  reorderQuantity?: number | null;
  stockByWarehouse?: Array<{
    warehouseId: string;
    warehouseName?: string | null;
    binId?: string | null;
    rackId?: string | null;
    quantityOnHand: number;
    reorderPoint?: number;
    reorderQuantity?: number;
  }>;
  catalogItem?: {
    id: string;
    sku: string;
    name: string;
  };
  [key: string]: any;
};

type OptionRow = { name: string; values: string };

/** The variants table stores options in option1..option3 columns (also the Shopify/WooCommerce limit). */
const MAX_OPTIONS = 3;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];

const emptyCreateForm = {
  catalogItemId: '',
  variantSku: '',
  name: '',
  barcode: '',
  autoGenerateBarcode: true,
  weightValue: '',
  weightUnit: 'kg' as 'g' | 'kg' | 'lb' | 'oz',
  lengthValue: '',
  widthValue: '',
  heightValue: '',
  dimensionUnit: 'cm' as 'cm' | 'm' | 'in' | 'ft',
  costPrice: '',
  sellingPrice: '',
  costCurrency: 'GBP',
  warehouseId: '',
  rackId: '',
  binId: '',
  openingQuantity: '',
  reorderLevel: '1',
  reorderQuantity: '',
  position: '0',
  status: 'active' as 'active' | 'inactive' | 'discontinued'
};

function splitValues(raw: string) {
  return Array.from(new Set(raw.split(',').map((v) => v.trim()).filter(Boolean)));
}

/** Every combination of option values, e.g. Size[S,M] x Colour[Red] -> [[S,Red],[M,Red]]. */
function cartesian(options: { name: string; values: string[] }[]): string[][] {
  return options.reduce<string[][]>(
    (acc, opt) => acc.flatMap((combo) => opt.values.map((v) => [...combo, v])),
    [[]]
  );
}

function skuPart(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function optionsToPayload(rows: OptionRow[], values: string[]) {
  const payload: Record<string, string> = {};
  for (let i = 0; i < MAX_OPTIONS; i++) {
    payload[`option${i + 1}Name`] = rows[i]?.name.trim() ?? '';
    payload[`option${i + 1}Value`] = values[i] ?? '';
  }
  return payload as {
    option1Name: string; option1Value: string;
    option2Name: string; option2Value: string;
    option3Name: string; option3Value: string;
  };
}

/** Structured option1–3 pairs; empty when DB columns are null. */
function structuredOptionLabels(v: Variant): string[] {
  const labels: string[] = [];
  for (let i = 1; i <= MAX_OPTIONS; i++) {
    const name = (v[`option${i}Name`] as string | null | undefined)?.trim();
    const value = (v[`option${i}Value`] as string | null | undefined)?.trim();
    if (!value) continue;
    labels.push(name ? `${name}: ${value}` : value);
  }
  return labels;
}

/** Flatten attributes JSON into "key: value" labels (skip empty / nested blobs). */
function attributeLabels(attrs: Record<string, any> | null | undefined): string[] {
  if (!attrs || typeof attrs !== 'object' || Array.isArray(attrs)) return [];
  return Object.entries(attrs)
    .filter(([, val]) => val != null && val !== '' && typeof val !== 'object')
    .map(([key, val]) => `${key}: ${String(val)}`);
}

/**
 * Options column: prefer option1–3; if those are empty but attributes JSON has keys
 * (common after inventory import / migration 023), surface attributes instead.
 */
function optionsDisplayLabels(v: Variant): string[] {
  const structured = structuredOptionLabels(v);
  if (structured.length) return structured;
  return attributeLabels(v.attributes);
}

function formatWeight(v: Variant): string | null {
  if (v.weightValue == null || v.weightValue === ('' as any)) return null;
  const n = Number(v.weightValue);
  if (Number.isNaN(n)) return null;
  return `${n} ${v.weightUnit || 'kg'}`;
}

function formatDimensions(v: Variant): string | null {
  const parts = [v.lengthValue, v.widthValue, v.heightValue]
    .map((x) => (x == null ? null : Number(x)))
    .filter((x): x is number => x != null && !Number.isNaN(x));
  if (!parts.length) return null;
  const unit = v.dimensionUnit || 'cm';
  const [l, w, h] = [v.lengthValue, v.widthValue, v.heightValue].map((x) =>
    x == null || Number.isNaN(Number(x)) ? '—' : String(Number(x))
  );
  return `${l} × ${w} × ${h} ${unit}`;
}

function barcodeLabels(v: Variant): string[] {
  const rows = Array.isArray(v.barcodes) ? v.barcodes : [];
  return rows
    .map((b) => (b?.barcode || '').trim())
    .filter(Boolean);
}

function pickImages(e: React.ChangeEvent<HTMLInputElement>): File[] {
  const files = Array.from(e.target.files ?? []);
  e.target.value = '';
  return files.filter((file) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error(`${file.name}: please upload an image (JPEG, PNG, WebP, GIF, or SVG)`);
      return false;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(`${file.name}: file size must be less than 5MB`);
      return false;
    }
    return true;
  });
}

function OptionRowsEditor({
  rows,
  onChange,
  multiValue
}: {
  rows: OptionRow[];
  onChange: (rows: OptionRow[]) => void;
  multiValue: boolean;
}) {
  const update = (i: number, patch: Partial<OptionRow>) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium">Options</label>
        <button
          type="button"
          className="btn btn-outline text-xs inline-flex items-center gap-1"
          disabled={rows.length >= MAX_OPTIONS}
          onClick={() => onChange([...rows, { name: '', values: '' }])}
          title={rows.length >= MAX_OPTIONS ? `Up to ${MAX_OPTIONS} option types per variant` : undefined}
        >
          <Plus className="h-3 w-3" /> Add option
        </button>
      </div>
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-[1fr_2fr_auto] gap-2 items-center">
          <input
            type="text"
            value={row.name}
            onChange={(e) => update(i, { name: e.target.value })}
            className="input"
            placeholder={i === 0 ? 'e.g., Size' : i === 1 ? 'e.g., Colour' : 'e.g., Material'}
          />
          <input
            type="text"
            value={row.values}
            onChange={(e) => update(i, { values: e.target.value })}
            className="input"
            placeholder={multiValue ? 'Comma-separated, e.g., Small, Medium, Large' : 'e.g., Large'}
          />
          <button
            type="button"
            onClick={() => onChange(rows.length > 1 ? rows.filter((_, idx) => idx !== i) : [{ name: '', values: '' }])}
            className="p-1 hover:bg-muted rounded text-red-600"
            title="Remove option"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">
        {multiValue
          ? `Enter several values separated by commas to generate one variant per combination (up to ${MAX_OPTIONS} option types).`
          : `Up to ${MAX_OPTIONS} option types per variant.`}
      </p>
    </div>
  );
}

function ImagePicker({
  files,
  onChange,
  existing,
  onRemoveExisting
}: {
  files: File[];
  onChange: (files: File[]) => void;
  existing?: { id: string; url: string }[];
  onRemoveExisting?: (id: string) => void;
}) {
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p)), [previews]);
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">
        Variant Images <span className="text-xs font-normal text-muted-foreground">(select one or more; the first becomes the main image)</span>
      </label>
      <input
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => onChange([...files, ...pickImages(e)])}
        className="input"
      />
      {((existing?.length ?? 0) > 0 || files.length > 0) && (
        <div className="mt-2 grid grid-cols-5 gap-2">
          {existing?.map((m) => (
            <div key={m.id} className="relative">
              <MediaThumb url={m.url} className="w-full aspect-square" />
              {onRemoveExisting && (
                <button
                  type="button"
                  onClick={() => onRemoveExisting(m.id)}
                  className="absolute top-1 right-1 rounded bg-black/70 text-white p-0.5 hover:bg-red-600"
                  title="Remove image"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
          {previews.map((src, i) => (
            <div key={src} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`New image ${i + 1}`} className="w-full aspect-square object-cover rounded border" />
              <button
                type="button"
                onClick={() => onChange(files.filter((_, idx) => idx !== i))}
                className="absolute top-1 right-1 rounded bg-black/70 text-white p-0.5 hover:bg-red-600"
                title="Remove"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VariantsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deepLinkQ = (searchParams.get('q') || '').trim();
  const { session, hydrated } = useSession();
  const { hasAccess } = useRoleCheck(['ADMIN', 'SUPER_ADMIN', 'WAREHOUSE_MANAGER', 'SALES_REP']);
  const { can } = useApiAccess();
  const canCreate = can('POST', '/api/catalog/variants');
  const canUpdate = can('PATCH', '/api/catalog/variants/:id');
  const canDelete = can('DELETE', '/api/catalog/variants/:id');
  const canAddMedia = can('POST', '/api/catalog/media');
  const canDeleteMedia = can('DELETE', '/api/catalog/media/:id');
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Variant[]>([]);
  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<Array<{ id: string; code?: string | null; name?: string | null; status?: string | null }>>([]);
  const [racks, setRacks] = useState<Array<{ id: string; code: string; name?: string | null; status?: string }>>([]);
  const [bins, setBins] = useState<Array<{ id: string; code: string; name?: string | null; status?: string; rack?: { id: string } | null }>>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyCreateForm);
  const [optionRows, setOptionRows] = useState<OptionRow[]>([{ name: '', values: '' }]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [editing, setEditing] = useState<Variant | null>(null);
  const [confirmDel, setConfirmDel] = useState<Variant | null>(null);

  async function loadLocationOptions(warehouseId: string) {
    if (!warehouseId) {
      setRacks([]);
      setBins([]);
      return;
    }
    try {
      const [racksRes, binsRes] = await Promise.all([
        listRacks({ warehouseId, limit: 200 }),
        listBins({ warehouseId, limit: 200 })
      ]);
      setRacks(racksRes.data || []);
      setBins(binsRes.data || []);
    } catch {
      setRacks([]);
      setBins([]);
    }
  }

  useEffect(() => {
    loadLocationOptions(form.warehouseId);
  }, [form.warehouseId]);

  const filteredBins = useMemo(() => {
    if (!form.rackId) return bins;
    return bins.filter((b) => String(b.rack?.id || '') === String(form.rackId));
  }, [bins, form.rackId]);

  useEffect(() => {
    if (!hydrated || !hasAccess) return;
    if (!session?.accessToken) {
      router.replace('/login');
      return;
    }
    (async () => {
      setLoading(true);
      try {
        // Deep-link ?q= must hit the API search — the list endpoint caps at 40 by
        // default, so client-only filtering of that page misses most SKUs.
        const [variantsRes, catalogItemsRes, warehousesRes] = await Promise.all([
          listVariants(
            deepLinkQ
              ? { search: deepLinkQ, limit: 100 }
              : { limit: 100 }
          ),
          listCatalogItems({ organizationId: session?.user?.organizationId }),
          listWarehouses({ organizationId: session?.user?.organizationId }).catch(() => ({ data: [] }))
        ]);
        setItems(variantsRes.data || []);
        setCatalogItems(catalogItemsRes.data || []);
        setWarehouses((warehousesRes.data || []).filter((w: any) => w.status !== 'inactive'));
      } catch (e: any) {
        const status = e?.response?.status;
        if (status === 403) {
          toast.error('You do not have permission to view variants.');
        } else if (status === 401) {
          toast.error('Session expired. Please login again.');
          router.replace('/login');
        } else {
          toast.error('Failed to load variants');
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [hydrated, hasAccess, router, session?.accessToken, session?.user?.organizationId, deepLinkQ]);

  const parsedOptions = useMemo(
    () => optionRows.map((r) => ({ name: r.name.trim(), values: splitValues(r.values) })).filter((o) => o.values.length > 0),
    [optionRows]
  );

  const plannedVariants = useMemo(() => {
    const combos = cartesian(parsedOptions);
    const base = form.variantSku.trim();
    return combos.map((values) => ({
      values,
      sku: combos.length > 1 && values.length ? [base, ...values.map(skuPart)].filter(Boolean).join('-') : base,
      name:
        combos.length > 1 && values.length
          ? [form.name.trim(), values.join(' / ')].filter(Boolean).join(' - ')
          : form.name.trim()
    }));
  }, [parsedOptions, form.variantSku, form.name]);

  function openCreate() {
    setForm(emptyCreateForm);
    setOptionRows([{ name: '', values: '' }]);
    setImageFiles([]);
    setShowCreate(true);
  }

  async function uploadGallery(variant: Variant, catalogItemId: string, files: File[], startPosition: number) {
    let failed = 0;
    for (const [i, file] of files.entries()) {
      try {
        await createProductMedia({ catalogItemId, variantId: variant.id, type: 'image', position: startPosition + i }, file);
      } catch {
        failed += 1;
      }
    }
    return failed;
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.catalogItemId || !form.variantSku) {
      toast.error('Please fill in required fields (Catalog Item, Variant SKU)');
      return;
    }
    if (parsedOptions.some((o) => !o.name)) {
      toast.error('Every option with values needs a name (e.g., Size)');
      return;
    }
    const stockTouched =
      form.openingQuantity.trim() !== '' ||
      form.reorderLevel.trim() !== '' ||
      form.reorderQuantity.trim() !== '';
    if (stockTouched && !form.warehouseId) {
      toast.error('Select a warehouse before setting opening qty or reorder fields');
      return;
    }
    const rowsForPayload = optionRows.filter((r) => splitValues(r.values).length > 0);
    const [mainImage, ...extraImages] = imageFiles;
    setSaving(true);
    const created: Variant[] = [];
    const errors: string[] = [];
    let galleryFailures = 0;
    for (const [idx, plan] of plannedVariants.entries()) {
      try {
        const qty = form.openingQuantity.trim() === '' ? undefined : parseInt(form.openingQuantity, 10);
        const reorderQty =
          form.reorderQuantity.trim() !== ''
            ? parseInt(form.reorderQuantity, 10)
            : qty;
        // One shared barcode only for a single create; multi-create uses per-SKU auto-gen when enabled.
        const barcodeTrimmed = form.barcode.trim();
        const useSharedBarcode = plannedVariants.length === 1 && !!barcodeTrimmed;
        const res = await createVariant({
          catalogItemId: form.catalogItemId,
          variantSku: plan.sku,
          name: plan.name || undefined,
          ...optionsToPayload(rowsForPayload, plan.values),
          barcode: useSharedBarcode ? barcodeTrimmed : undefined,
          autoGenerateBarcode: !useSharedBarcode && form.autoGenerateBarcode,
          weightValue: form.weightValue ? parseFloat(form.weightValue) : undefined,
          weightUnit: form.weightUnit,
          lengthValue: form.lengthValue ? parseFloat(form.lengthValue) : undefined,
          widthValue: form.widthValue ? parseFloat(form.widthValue) : undefined,
          heightValue: form.heightValue ? parseFloat(form.heightValue) : undefined,
          dimensionUnit: form.dimensionUnit,
          costPrice: form.costPrice ? parseFloat(form.costPrice) : undefined,
          sellingPrice: form.sellingPrice ? parseFloat(form.sellingPrice) : undefined,
          costCurrency: form.costCurrency,
          warehouseId: form.warehouseId || undefined,
          binId: form.binId || undefined,
          openingQuantity: qty,
          reorderLevel: form.reorderLevel.trim() === '' ? undefined : parseInt(form.reorderLevel, 10),
          reorderQuantity: reorderQty,
          position: (parseInt(form.position) || 0) + idx,
          status: form.status
        }, mainImage);
        created.push(res.data);
        if (extraImages.length) {
          galleryFailures += await uploadGallery(res.data, form.catalogItemId, extraImages, 1);
        }
      } catch (err: any) {
        errors.push(`${plan.sku}: ${err?.response?.data?.error?.message ?? 'create failed'}`);
      }
    }
    setSaving(false);
    if (created.length) {
      setItems(prev => [...created, ...prev]);
      toast.success(created.length === 1 ? 'Variant created' : `${created.length} variants created`);
    }
    if (galleryFailures) toast.error(`${galleryFailures} additional image(s) failed to upload`);
    if (errors.length) {
      toast.error(errors.join('\n'));
      return;
    }
    setShowCreate(false);
    setForm(emptyCreateForm);
    setOptionRows([{ name: '', values: '' }]);
    setImageFiles([]);
  }

  function openEdit(item: Variant) {
    setEditing(item);
  }

  function closeEdit() {
    setEditing(null);
  }

  async function onDelete() {
    if (!confirmDel) return;
    try {
      await deleteVariant(confirmDel.id);
      setItems(items.filter(item => item.id !== confirmDel.id));
      setConfirmDel(null);
      toast.success('Variant deleted');
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message ?? 'Delete failed');
    }
  }

  const columns = useMemo<ColumnDef<Variant>[]>(() => [
    {
      id: 'image',
      header: 'Image',
      cell: ({ row }) => <MediaThumb url={row.original.imageUrl} className="w-10 h-10" />
    },
    {
      id: 'variantSku',
      accessorKey: 'variantSku',
      header: 'Variant SKU',
      cell: ({ row }) => <span className="font-mono text-sm">{row.original.variantSku}</span>
    },
    {
      id: 'barcodes',
      accessorFn: (r) => barcodeLabels(r).join(' '),
      header: 'Barcode',
      cell: ({ row }) => {
        const codes = barcodeLabels(row.original);
        if (!codes.length) {
          return <span className="text-muted-foreground">—</span>;
        }
        return (
          <div className="font-mono text-xs space-y-0.5">
            {codes.map((code) => (
              <div key={code}>{code}</div>
            ))}
          </div>
        );
      }
    },
    {
      id: 'catalogItem',
      accessorFn: (r) => `${r.catalogItem?.name ?? ''} ${r.catalogItem?.sku ?? ''}`,
      header: 'Product',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.catalogItem?.name || '-'}</div>
          <div className="text-xs text-muted-foreground">{row.original.catalogItem?.sku || '-'}</div>
        </div>
      )
    },
    {
      id: 'options',
      accessorFn: (r) => optionsDisplayLabels(r).join(' '),
      header: 'Options',
      cell: ({ row }) => {
        const labels = optionsDisplayLabels(row.original);
        const fromAttrs = !structuredOptionLabels(row.original).length && labels.length > 0;
        if (!labels.length) {
          return <span className="text-muted-foreground">—</span>;
        }
        return (
          <div className="text-sm max-w-[16rem]">
            <div className="flex flex-wrap gap-1">
              {labels.map((label) => (
                <span
                  key={label}
                  className="inline-block rounded bg-muted px-1.5 py-0.5 text-xs"
                  title={label}
                >
                  {label}
                </span>
              ))}
            </div>
            {fromAttrs && (
              <div className="text-[10px] text-muted-foreground mt-0.5">from attributes</div>
            )}
          </div>
        );
      }
    },
    {
      id: 'sellingPrice',
      accessorKey: 'sellingPrice',
      header: 'Selling price',
      cell: ({ row }) => {
        const price = row.original.sellingPrice;
        const numPrice = typeof price === 'number' ? price : (price != null ? parseFloat(String(price)) : NaN);
        return price != null && !isNaN(numPrice) ? (
          <span className="tabular-nums">{row.original.costCurrency || 'GBP'} {numPrice.toFixed(2)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      }
    },
    {
      // Explicit id must match visibility key — accessorKey alone previously mismatched
      // persisted View-toggle state after label renames ("Cost price" vs "Variant cost").
      id: 'costPrice',
      accessorKey: 'costPrice',
      header: 'Cost price',
      cell: ({ row }) => {
        const price = row.original.costPrice;
        const numPrice = typeof price === 'number' ? price : (price != null ? parseFloat(String(price)) : NaN);
        return price != null && !isNaN(numPrice) ? (
          <span className="tabular-nums">{row.original.costCurrency} {numPrice.toFixed(2)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      }
    },
    {
      id: 'stockByWarehouse',
      header: 'Stock by warehouse',
      accessorFn: (r) => r.stockQty ?? 0,
      cell: ({ row }) => {
        const rows = row.original.stockByWarehouse ?? [];
        if (!rows.length) {
          return <span className="text-muted-foreground">—</span>;
        }
        return (
          <div className="text-xs space-y-0.5">
            {rows.map((s) => (
              <div key={s.warehouseId} className="min-w-[10rem]">
                <div className="flex gap-2 justify-between">
                  <span className="text-muted-foreground truncate">{s.warehouseName || 'Warehouse'}</span>
                  <span className="tabular-nums font-medium">{s.quantityOnHand}</span>
                </div>
                {((s.reorderPoint ?? 0) > 0 || (s.reorderQuantity ?? 0) > 0) && (
                  <div className="text-[10px] text-muted-foreground tabular-nums">
                    RL {s.reorderPoint ?? 0} · RQ {s.reorderQuantity ?? 0}
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      }
    },
    {
      id: 'stockAvailable',
      header: 'Stock available',
      accessorFn: (r) => r.stockQty ?? 0,
      cell: ({ row }) => (
        <span className="tabular-nums font-medium">{row.original.stockQty ?? 0}</span>
      )
    },
    {
      id: 'reorderLevel',
      header: 'Reorder level',
      accessorFn: (r) => r.reorderLevel ?? null,
      cell: ({ row }) => {
        const val = row.original.reorderLevel;
        return val != null ? (
          <span className="tabular-nums">{val}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      }
    },
    {
      id: 'reorderQuantity',
      header: 'Reorder quantity',
      accessorFn: (r) => r.reorderQuantity ?? null,
      cell: ({ row }) => {
        const val = row.original.reorderQuantity;
        return val != null ? (
          <span className="tabular-nums">{val}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      }
    },
    {
      id: 'status',
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.original.status;
        const colors = {
          active: 'bg-green-100 text-green-800',
          inactive: 'bg-gray-100 text-gray-800',
          discontinued: 'bg-red-100 text-red-800'
        };
        return (
          <span className={`px-2 py-1 rounded text-xs font-medium ${colors[status]}`}>
            {status}
          </span>
        );
      }
    },
    {
      id: 'name',
      accessorKey: 'name',
      header: 'Variant name',
      cell: ({ row }) => (
        <span className="text-sm">{row.original.name || <span className="text-muted-foreground">—</span>}</span>
      )
    },
    {
      id: 'attributes',
      accessorFn: (r) => attributeLabels(r.attributes).join(' '),
      header: 'Attributes',
      cell: ({ row }) => {
        const labels = attributeLabels(row.original.attributes);
        if (!labels.length) {
          return <span className="text-muted-foreground">—</span>;
        }
        return (
          <div className="text-xs space-y-0.5 max-w-[14rem]">
            {labels.map((label) => (
              <div key={label} className="truncate" title={label}>{label}</div>
            ))}
          </div>
        );
      }
    },
    {
      id: 'weight',
      accessorFn: (r) => formatWeight(r) ?? '',
      header: 'Weight',
      cell: ({ row }) => {
        const text = formatWeight(row.original);
        return text ? <span className="text-sm tabular-nums">{text}</span> : <span className="text-muted-foreground">—</span>;
      }
    },
    {
      id: 'dimensions',
      accessorFn: (r) => formatDimensions(r) ?? '',
      header: 'Dimensions',
      cell: ({ row }) => {
        const text = formatDimensions(row.original);
        return text ? <span className="text-sm tabular-nums whitespace-nowrap">{text}</span> : <span className="text-muted-foreground">—</span>;
      }
    },
    {
      id: 'position',
      accessorKey: 'position',
      header: 'Position',
      cell: ({ row }) => (
        <span className="tabular-nums text-sm">{row.original.position ?? 0}</span>
      )
    },
    {
      id: 'actions',
      header: 'Actions',
      enableHiding: false,
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex items-center gap-2">
            {canUpdate && (
            <button
              onClick={() => openEdit(item)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <Pencil className="h-4 w-4" />
            </button>
            )}
            {canDelete && (
            <button
              onClick={() => setConfirmDel(item)}
              className="p-1 hover:bg-gray-100 rounded text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            )}
          </div>
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [canUpdate, canDelete]);

  // Defaults match the requested catalog view; Reorder + Attributes stay toggle-only.
  const defaultColumnVisibility = useMemo(
    () => ({
      image: true,
      variantSku: true,
      barcodes: true,
      catalogItem: true,
      options: true,
      sellingPrice: true,
      costPrice: true,
      stockByWarehouse: true,
      stockAvailable: true,
      status: true,
      actions: true,
      // Hidden by default — available in View → Toggle columns
      reorderLevel: false,
      reorderQuantity: false,
      name: false,
      attributes: false,
      weight: false,
      dimensions: false,
      position: false
    }),
    []
  );

  const physicalFields = (
    f: typeof form,
    set: (patch: Partial<typeof emptyCreateForm>) => void
  ) => (
    <div className="border-t border-border pt-4 mt-4">
      <h4 className="text-sm font-semibold mb-3">Physical Properties</h4>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">Weight Value</label>
          <input type="number" step="0.0001" value={f.weightValue} onChange={e => set({ weightValue: e.target.value })} className="select" placeholder="0.0000" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Weight Unit</label>
          <select value={f.weightUnit} onChange={e => set({ weightUnit: e.target.value as any })} className="select">
            <option value="g">g</option>
            <option value="kg">kg</option>
            <option value="lb">lb</option>
            <option value="oz">oz</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Length</label>
          <input type="number" step="0.01" value={f.lengthValue} onChange={e => set({ lengthValue: e.target.value })} className="select" placeholder="0.00" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Width</label>
          <input type="number" step="0.01" value={f.widthValue} onChange={e => set({ widthValue: e.target.value })} className="select" placeholder="0.00" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Height</label>
          <input type="number" step="0.01" value={f.heightValue} onChange={e => set({ heightValue: e.target.value })} className="select" placeholder="0.00" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Dimension Unit</label>
          <select value={f.dimensionUnit} onChange={e => set({ dimensionUnit: e.target.value as any })} className="select">
            <option value="cm">cm</option>
            <option value="m">m</option>
            <option value="in">in</option>
            <option value="ft">ft</option>
          </select>
        </div>
      </div>
    </div>
  );

  if (!hydrated || loading) {
    return (
      <div className="min-h-screen app-surface">
        <Sidebar />
        <div className="flex flex-col overflow-hidden lg:ml-[280px]">
          <Header title="Catalog · Variants" />
          <main className="flex-1 overflow-auto p-4 md:p-6">
            <div className="flex items-center justify-center h-full">
              <div className="text-muted-foreground">Loading...</div>
            </div>
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
          <Header title="Catalog · Variants" />
          <main className="flex-1 overflow-auto p-4 md:p-6">
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
                <p className="text-muted-foreground">You do not have permission to view this page.</p>
              </div>
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
        <Header title="Catalog · Variants" />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                  <Tag className="h-8 w-8" />
                  Variants
                </h1>
                <p className="text-muted-foreground mt-1">Manage product variants</p>
              </div>
              {canCreate && (
              <button
                onClick={openCreate}
                className="flex items-center gap-2 px-4 py-2 bg-[#D4A017] text-white rounded hover:bg-[#B89015]"
              >
                <Plus className="h-4 w-4" />
                Add Variant
              </button>
              )}
            </div>

            {deepLinkQ && (
              <div className="mb-3 flex flex-wrap items-center gap-2 text-sm rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200 px-3 py-2">
                Showing variants matching <span className="font-mono font-medium">{deepLinkQ}</span>
                <button type="button" className="btn btn-outline text-xs ml-auto" onClick={() => router.push('/catalog/variants')}>
                  Clear
                </button>
              </div>
            )}
            <RichDataTable
              columns={columns}
              data={
                deepLinkQ
                  ? items.filter((v) => {
                      const q = deepLinkQ.toLowerCase();
                      return (
                        v.variantSku?.toLowerCase().includes(q) ||
                        v.name?.toLowerCase().includes(q) ||
                        v.catalogItem?.sku?.toLowerCase().includes(q) ||
                        v.catalogItem?.name?.toLowerCase().includes(q) ||
                        barcodeLabels(v).some((c) => c.toLowerCase().includes(q)) ||
                        optionsDisplayLabels(v).some((l) => l.toLowerCase().includes(q)) ||
                        String(v.id) === deepLinkQ
                      );
                    })
                  : items
              }
              tableId="variants-cols-v4"
              initialColumnVisibility={defaultColumnVisibility}
              searchPlaceholder="Search variants by SKU, product, barcode, options…"
              emptyMessage={
                deepLinkQ
                  ? `No variants match “${deepLinkQ}”. Try the product SKU, variant SKU, or clear the search.`
                  : 'No variants yet. Open a catalog item and add variants, or create one here.'
              }
            />

            {showCreate && (
              <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="w-full max-w-2xl rounded-2xl bg-card shadow-2xl border border-border p-6 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Create Variant</h3>
                    <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-muted rounded-lg transition-colors">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <form onSubmit={onCreate} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Catalog Item *</label>
                        <SearchableSelect
                          value={form.catalogItemId}
                          onChange={(v) => setForm((prev) => ({ ...prev, catalogItemId: v }))}
                          required
                          placeholder="Search product by SKU or name…"
                          options={catalogItems.map((item) => ({
                            value: String(item.id),
                            label: `${item.sku} — ${item.name}`,
                            searchText: `${item.sku} ${item.name}`
                          }))}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Variant SKU *</label>
                        <input
                          type="text"
                          value={form.variantSku}
                          onChange={e => setForm(prev => ({ ...prev, variantSku: e.target.value }))}
                          className="select"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Name</label>
                        <input
                          type="text"
                          value={form.name}
                          onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                          className="select"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Status</label>
                        <select
                          value={form.status}
                          onChange={e => setForm(prev => ({ ...prev, status: e.target.value as any }))}
                          className="select"
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                          <option value="discontinued">Discontinued</option>
                        </select>
                      </div>
                      <div className="col-span-2">
                        <OptionRowsEditor rows={optionRows} onChange={setOptionRows} multiValue />
                        {plannedVariants.length > 1 && (
                          <div className="mt-2 rounded-lg border border-border bg-muted/30 p-2 text-xs">
                            <div className="font-medium mb-1">{plannedVariants.length} variants will be created:</div>
                            <ul className="max-h-28 overflow-y-auto font-mono space-y-0.5">
                              {plannedVariants.map(p => (
                                <li key={p.sku}>{p.sku} — {p.values.join(' / ')}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                      <div className="col-span-2 space-y-2">
                        <div>
                          <label className="block text-sm font-medium mb-1.5">Barcode</label>
                          <input
                            type="text"
                            value={form.barcode}
                            onChange={e => setForm(prev => ({ ...prev, barcode: e.target.value }))}
                            className="select"
                            placeholder="Optional — leave empty to auto-generate"
                          />
                        </div>
                        <label className="flex items-start gap-2 text-sm cursor-pointer select-none">
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={form.autoGenerateBarcode}
                            disabled={!!form.barcode.trim() && plannedVariants.length === 1}
                            onChange={e => setForm(prev => ({ ...prev, autoGenerateBarcode: e.target.checked }))}
                          />
                          <span>
                            <span className="font-medium">Auto-generate barcode if empty</span>
                            <span className="block text-xs text-muted-foreground mt-0.5">
                              {plannedVariants.length > 1
                                ? `Creates a unique internal EAN-13 per variant SKU (${plannedVariants.length} variants).`
                                : 'Creates a unique internal EAN-13 from the variant SKU when no barcode is entered.'}
                            </span>
                          </span>
                        </label>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Cost price</label>
                        <input
                          type="number"
                          step="0.01"
                          value={form.costPrice}
                          onChange={e => setForm(prev => ({ ...prev, costPrice: e.target.value }))}
                          className="select"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Selling price</label>
                        <input
                          type="number"
                          step="0.01"
                          value={form.sellingPrice}
                          onChange={e => setForm(prev => ({ ...prev, sellingPrice: e.target.value }))}
                          className="select"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Currency</label>
                        <select
                          value={form.costCurrency}
                          onChange={e => setForm(prev => ({ ...prev, costCurrency: e.target.value }))}
                          className="select"
                        >
                          <option value="GBP">GBP</option>
                          <option value="USD">USD</option>
                          <option value="EUR">EUR</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Warehouse</label>
                        <SearchableSelect
                          value={form.warehouseId}
                          onChange={(warehouseId) =>
                            setForm((prev) => ({ ...prev, warehouseId, rackId: '', binId: '' }))
                          }
                          placeholder="Search warehouse…"
                          emptyLabel="Select if setting stock…"
                          options={warehouses.map((w) => ({
                            value: String(w.id),
                            label: w.code && w.name ? `${w.code} — ${w.name}` : w.name || w.code || String(w.id),
                            searchText: `${w.code || ''} ${w.name || ''}`
                          }))}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Rack</label>
                        <SearchableSelect
                          value={form.rackId}
                          onChange={(rackId) => setForm((prev) => ({ ...prev, rackId, binId: '' }))}
                          disabled={!form.warehouseId}
                          placeholder="Search rack…"
                          emptyLabel="All racks"
                          options={racks
                            .filter((r) => r.status !== 'inactive' || r.id === form.rackId)
                            .map((r) => ({
                              value: String(r.id),
                              label: r.name && r.name !== r.code ? `${r.code} — ${r.name}` : r.code,
                              searchText: `${r.code || ''} ${r.name || ''}`
                            }))}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Bin</label>
                        <SearchableSelect
                          value={form.binId}
                          onChange={(binId) => setForm((prev) => ({ ...prev, binId }))}
                          disabled={!form.warehouseId}
                          placeholder="Search bin…"
                          emptyLabel="No bin"
                          options={filteredBins
                            .filter((b) => b.status !== 'inactive' || b.id === form.binId)
                            .map((b) => ({
                              value: String(b.id),
                              label: b.name && b.name !== b.code ? `${b.code} — ${b.name}` : b.code,
                              searchText: `${b.code || ''} ${b.name || ''}`
                            }))}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Opening qty</label>
                        <input
                          type="number"
                          value={form.openingQuantity}
                          onChange={e => setForm(prev => ({ ...prev, openingQuantity: e.target.value }))}
                          className="select"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Reorder level</label>
                        <input
                          type="number"
                          value={form.reorderLevel}
                          onChange={e => setForm(prev => ({ ...prev, reorderLevel: e.target.value }))}
                          className="select"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Reorder quantity</label>
                        <input
                          type="number"
                          value={form.reorderQuantity}
                          onChange={e => setForm(prev => ({ ...prev, reorderQuantity: e.target.value }))}
                          className="select"
                          placeholder="Defaults to opening qty"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Position</label>
                        <input
                          type="number"
                          value={form.position}
                          onChange={e => setForm(prev => ({ ...prev, position: e.target.value }))}
                          className="select"
                          placeholder="0"
                        />
                      </div>
                    </div>
                    {physicalFields(form, (patch) => setForm(prev => ({ ...prev, ...patch })))}
                    {canAddMedia && <ImagePicker files={imageFiles} onChange={setImageFiles} />}
                    <div className="flex justify-end gap-3 pt-4 border-t border-border">
                      <button
                        type="button"
                        onClick={() => setShowCreate(false)}
                        className="btn btn-outline"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={saving}
                        className="btn btn-primary inline-flex items-center gap-2"
                      >
                        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                        {plannedVariants.length > 1 ? `Create ${plannedVariants.length} variants` : 'Create'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {editing && (
              <VariantEditDialog
                variant={editing}
                warehouses={warehouses}
                canAddMedia={canAddMedia}
                canDeleteMedia={canDeleteMedia}
                onClose={closeEdit}
                onSaved={(saved) => {
                  setItems((prev) =>
                    prev.map((item) =>
                      item.id === saved.id ? ({ ...item, ...saved } as Variant) : item
                    )
                  );
                }}
              />
            )}

            {confirmDel && (
              <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="w-full max-w-md rounded-2xl bg-card shadow-2xl border border-border p-6 animate-in zoom-in-95 duration-200">
                  <h3 className="text-lg font-semibold mb-4">Confirm Delete</h3>
                  <p className="mb-4 text-muted-foreground">Are you sure you want to delete variant "{confirmDel.variantSku}"? This action cannot be undone.</p>
                  <div className="flex justify-end gap-3 pt-4 border-t border-border">
                    <button
                      onClick={() => setConfirmDel(null)}
                      className="btn btn-outline"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={onDelete}
                      className="btn bg-red-600 hover:bg-red-700 text-white"
                    >
                      Delete
                    </button>
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

export default function VariantsPageSuspense() {
  return (
    <Suspense fallback={<div className="min-h-screen app-surface" />}>
      <VariantsPage />
    </Suspense>
  );
}
