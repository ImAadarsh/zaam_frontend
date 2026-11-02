'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  updateVariant,
  listProductMedia,
  createProductMedia,
  deleteProductMedia,
  listRacks,
  listBins,
  listVariants
} from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, Plus, X } from 'lucide-react';
import { MediaThumb } from '@/components/catalog/media-preview';
import { SearchableSelect } from '@/components/searchable-select';

export type VariantEditModel = {
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
  costCurrency?: string | null;
  sellingPrice?: number | null;
  attributes?: Record<string, any> | null;
  imageUrl?: string | null;
  position?: number;
  status: 'active' | 'inactive' | 'discontinued';
  barcodes?: Array<{ id?: string; barcode: string; type?: string | null; isPrimary?: boolean }>;
  stockQty?: number;
  reorderLevel?: number | null;
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
  catalogItem?: { id: string; sku?: string; name?: string };
};

type WarehouseOption = {
  id: string;
  code?: string | null;
  name?: string | null;
  status?: string | null;
};

type OptionRow = { name: string; values: string };

const MAX_OPTIONS = 3;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
const CURRENCY_OPTIONS = ['GBP', 'EUR', 'USD', 'AED', 'AUD', 'CAD', 'CHF', 'INR', 'NZD', 'SAR', 'ZAR'];

function optionsToPayload(rows: OptionRow[]) {
  const payload: Record<string, string> = {};
  for (let i = 0; i < MAX_OPTIONS; i++) {
    payload[`option${i + 1}Name`] = rows[i]?.name.trim() ?? '';
    payload[`option${i + 1}Value`] = rows[i]?.values.trim() ?? '';
  }
  return payload as {
    option1Name: string;
    option1Value: string;
    option2Name: string;
    option2Value: string;
    option3Name: string;
    option3Value: string;
  };
}

function optionRowsFromVariant(v: VariantEditModel): OptionRow[] {
  const rows: OptionRow[] = [];
  for (let i = 1; i <= MAX_OPTIONS; i++) {
    const name = (v[`option${i}Name` as keyof VariantEditModel] as string | null) ?? '';
    const value = (v[`option${i}Value` as keyof VariantEditModel] as string | null) ?? '';
    if (name || value) rows.push({ name, values: value });
  }
  return rows.length ? rows : [{ name: '', values: '' }];
}

function barcodePrimary(v: VariantEditModel) {
  const rows = Array.isArray(v.barcodes) ? v.barcodes : [];
  const codes = rows.map((b) => (b?.barcode || '').trim()).filter(Boolean);
  return codes[0] || '';
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
  onChange
}: {
  rows: OptionRow[];
  onChange: (rows: OptionRow[]) => void;
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
            placeholder="e.g., Large"
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
        Variant Images{' '}
        <span className="text-xs font-normal text-muted-foreground">
          (select one or more; the first becomes the main image on `variants.image_url`)
        </span>
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

function emptyFormFromVariant(item: VariantEditModel) {
  const firstStock = item.stockByWarehouse?.[0];
  const existingBarcode = barcodePrimary(item);
  return {
    variantSku: item.variantSku,
    name: item.name || '',
    barcode: existingBarcode,
    /** Default on when no barcode yet so save can allocate an EAN-13. */
    autoGenerateBarcode: !existingBarcode,
    weightValue: item.weightValue != null ? String(Number(item.weightValue)) : '',
    weightUnit: (item.weightUnit || 'kg') as 'g' | 'kg' | 'lb' | 'oz',
    lengthValue: item.lengthValue != null ? String(Number(item.lengthValue)) : '',
    widthValue: item.widthValue != null ? String(Number(item.widthValue)) : '',
    heightValue: item.heightValue != null ? String(Number(item.heightValue)) : '',
    dimensionUnit: (item.dimensionUnit || 'cm') as 'cm' | 'm' | 'in' | 'ft',
    costPrice: item.costPrice != null ? String(Number(item.costPrice)) : '',
    sellingPrice: item.sellingPrice != null ? String(Number(item.sellingPrice)) : '',
    costCurrency: item.costCurrency || 'GBP',
    warehouseId: firstStock?.warehouseId ? String(firstStock.warehouseId) : '',
    rackId: firstStock?.rackId ? String(firstStock.rackId) : '',
    binId: firstStock?.binId ? String(firstStock.binId) : '',
    openingQuantity: item.stockQty != null ? String(item.stockQty) : '',
    reorderLevel: item.reorderLevel != null ? String(item.reorderLevel) : '',
    reorderQuantity: item.reorderQuantity != null ? String(item.reorderQuantity) : '',
    position: item.position?.toString() || '0',
    status: item.status
  };
}

export function VariantEditDialog({
  variant,
  warehouses,
  canAddMedia = true,
  canDeleteMedia = true,
  onClose,
  onSaved
}: {
  variant: VariantEditModel;
  warehouses: WarehouseOption[];
  canAddMedia?: boolean;
  canDeleteMedia?: boolean;
  onClose: () => void;
  onSaved?: (saved: VariantEditModel) => void;
}) {
  const [editing, setEditing] = useState<VariantEditModel>(variant);
  const [form, setForm] = useState(() => emptyFormFromVariant(variant));
  const [optionRows, setOptionRows] = useState(() => optionRowsFromVariant(variant));
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [gallery, setGallery] = useState<{ id: string; url: string }[]>([]);
  const [racks, setRacks] = useState<Array<{ id: string; code: string; name?: string | null; status?: string }>>([]);
  const [bins, setBins] = useState<
    Array<{ id: string; code: string; name?: string | null; status?: string; rack?: { id: string } | null }>
  >([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const catalogItemId = variant.catalogItem?.id;
        let decorated = variant;
        if (catalogItemId) {
          const listRes = await listVariants({ catalogItemId, limit: 100 }).catch(() => null);
          const found = listRes?.data?.find((v: any) => String(v.id) === String(variant.id));
          if (found) decorated = found;
        }
        if (cancelled) return;
        setEditing(decorated);
        setForm(emptyFormFromVariant(decorated));
        setOptionRows(optionRowsFromVariant(decorated));
        const mediaRes = await listProductMedia({ variantId: decorated.id, type: 'image' }).catch(() => ({
          data: [] as any[]
        }));
        if (!cancelled) {
          setGallery((mediaRes.data || []).map((m: any) => ({ id: m.id, url: m.url })));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [variant.id, variant.catalogItem?.id]);

  useEffect(() => {
    if (!form.warehouseId) {
      setRacks([]);
      setBins([]);
      return;
    }
    Promise.all([
      listRacks({ warehouseId: form.warehouseId, limit: 200 }),
      listBins({ warehouseId: form.warehouseId, limit: 200 })
    ])
      .then(([racksRes, binsRes]) => {
        setRacks(racksRes.data || []);
        setBins(binsRes.data || []);
      })
      .catch(() => {
        setRacks([]);
        setBins([]);
      });
  }, [form.warehouseId]);

  const filteredBins = useMemo(() => {
    if (!form.rackId) return bins;
    return bins.filter((b) => String(b.rack?.id || '') === String(form.rackId));
  }, [bins, form.rackId]);

  async function onRemoveGalleryImage(id: string) {
    try {
      await deleteProductMedia(id);
      setGallery((prev) => prev.filter((m) => m.id !== id));
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message ?? 'Failed to remove image');
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    const rows = optionRows.filter((r) => r.name.trim() || r.values.trim());
    if (rows.some((r) => r.values.trim() && !r.name.trim())) {
      toast.error('Every option with a value needs a name');
      return;
    }
    const stockTouched =
      form.openingQuantity.trim() !== '' ||
      form.reorderLevel.trim() !== '' ||
      form.reorderQuantity.trim() !== '' ||
      !!form.rackId ||
      !!form.binId;
    if (stockTouched && !form.warehouseId) {
      toast.error('Select a warehouse before setting rack, bin, opening qty, or reorder fields');
      return;
    }
    const [mainImage, ...extraImages] = imageFiles;
    setSaving(true);
    try {
      const qty = form.openingQuantity.trim() === '' ? undefined : parseInt(form.openingQuantity, 10);
      const reorderQty =
        form.reorderQuantity.trim() !== '' ? parseInt(form.reorderQuantity, 10) : qty;
      const barcodeTrimmed = form.barcode.trim();
      const res = await updateVariant(
        editing.id,
        {
          variantSku: form.variantSku,
          name: form.name,
          ...optionsToPayload(rows),
          barcode: barcodeTrimmed || undefined,
          autoGenerateBarcode: !barcodeTrimmed && form.autoGenerateBarcode,
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
          rackId: form.rackId || undefined,
          binId: form.binId || undefined,
          openingQuantity: qty,
          reorderLevel: form.reorderLevel.trim() === '' ? undefined : parseInt(form.reorderLevel, 10),
          reorderQuantity: reorderQty,
          position: parseInt(form.position) || 0,
          status: form.status
          // attributes JSON stays in DB; Options (option1–3) are the variant UX — do not overwrite.
        },
        mainImage
      );
      const catalogItemId = editing.catalogItem?.id ?? res.data?.catalogItem?.id;
      let galleryFailures = 0;
      if (extraImages.length && catalogItemId) {
        for (const [i, file] of extraImages.entries()) {
          try {
            await createProductMedia(
              {
                catalogItemId,
                variantId: editing.id,
                type: 'image',
                position: gallery.length + 1 + i
              },
              file
            );
          } catch {
            galleryFailures += 1;
          }
        }
      }
      toast.success('Variant updated');
      if (galleryFailures) toast.error(`${galleryFailures} additional image(s) failed to upload`);
      onSaved?.(res.data);
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  const set = (patch: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...patch }));

  return (
    <div className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-card shadow-2xl border border-border p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold inline-flex items-center gap-2">
            Edit Variant {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </h3>
          <button type="button" onClick={onClose} className="p-1 hover:bg-muted rounded-lg transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Variant SKU <span className="text-destructive">*</span></label>
              <input
                type="text"
                value={form.variantSku}
                onChange={(e) => set({ variantSku: e.target.value })}
                className="select"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => set({ name: e.target.value })}
                className="select"
              />
            </div>
            <div className="col-span-2">
              <OptionRowsEditor rows={optionRows} onChange={setOptionRows} />
            </div>
            <div className="col-span-2 space-y-2">
              <div>
                <label className="block text-sm font-medium mb-1.5">Barcode</label>
                <input
                  type="text"
                  value={form.barcode}
                  onChange={(e) => set({ barcode: e.target.value })}
                  className="select"
                  placeholder="Leave empty to auto-generate"
                />
              </div>
              <label className="flex items-start gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={form.autoGenerateBarcode}
                  disabled={!!form.barcode.trim()}
                  onChange={(e) => set({ autoGenerateBarcode: e.target.checked })}
                />
                <span>
                  <span className="font-medium">Auto-generate barcode if empty</span>
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    Creates a unique internal EAN-13 from the variant SKU when no barcode is entered.
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
                onChange={(e) => set({ costPrice: e.target.value })}
                className="select"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Selling price</label>
              <input
                type="number"
                step="0.01"
                value={form.sellingPrice}
                onChange={(e) => set({ sellingPrice: e.target.value })}
                className="select"
              />
              <p className="mt-1 text-xs text-muted-foreground">Stored on price list for this variant.</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Cost currency</label>
              <select
                value={form.costCurrency}
                onChange={(e) => set({ costCurrency: e.target.value })}
                className="select"
              >
                {CURRENCY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                {form.costCurrency && !CURRENCY_OPTIONS.includes(form.costCurrency) && (
                  <option value={form.costCurrency}>{form.costCurrency}</option>
                )}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Warehouse
                {(form.openingQuantity.trim() !== '' ||
                  form.reorderLevel.trim() !== '' ||
                  form.reorderQuantity.trim() !== '' ||
                  !!form.rackId ||
                  !!form.binId) && <span className="text-destructive"> *</span>}
              </label>
              <SearchableSelect
                value={form.warehouseId}
                onChange={(warehouseId) => set({ warehouseId, rackId: '', binId: '' })}
                placeholder="Search warehouse…"
                emptyLabel="Select if updating stock…"
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
                onChange={(rackId) => {
                  // Keep bin when it already belongs to the newly selected rack; otherwise clear.
                  const keepBin =
                    !!form.binId &&
                    (!rackId ||
                      bins.some(
                        (b) =>
                          String(b.id) === String(form.binId) &&
                          String(b.rack?.id || '') === String(rackId)
                      ));
                  set({ rackId, binId: keepBin ? form.binId : '' });
                }}
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
                onChange={(binId) => set({ binId })}
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
                onChange={(e) => set({ openingQuantity: e.target.value })}
                className="select"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Reorder level</label>
              <input
                type="number"
                value={form.reorderLevel}
                onChange={(e) => set({ reorderLevel: e.target.value })}
                className="select"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Reorder quantity</label>
              <input
                type="number"
                value={form.reorderQuantity}
                onChange={(e) => set({ reorderQuantity: e.target.value })}
                className="select"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Position</label>
              <input
                type="number"
                value={form.position}
                onChange={(e) => set({ position: e.target.value })}
                className="select"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Status</label>
              <select
                value={form.status}
                onChange={(e) => set({ status: e.target.value as typeof form.status })}
                className="select"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="discontinued">Discontinued</option>
              </select>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <h4 className="text-sm font-semibold mb-3">Physical Properties</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Weight Value</label>
                <input
                  type="number"
                  step="0.0001"
                  value={form.weightValue}
                  onChange={(e) => set({ weightValue: e.target.value })}
                  className="select"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Weight Unit</label>
                <select
                  value={form.weightUnit}
                  onChange={(e) => set({ weightUnit: e.target.value as typeof form.weightUnit })}
                  className="select"
                >
                  <option value="g">g</option>
                  <option value="kg">kg</option>
                  <option value="lb">lb</option>
                  <option value="oz">oz</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Length</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.lengthValue}
                  onChange={(e) => set({ lengthValue: e.target.value })}
                  className="select"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Width</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.widthValue}
                  onChange={(e) => set({ widthValue: e.target.value })}
                  className="select"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Height</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.heightValue}
                  onChange={(e) => set({ heightValue: e.target.value })}
                  className="select"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Dimension Unit</label>
                <select
                  value={form.dimensionUnit}
                  onChange={(e) => set({ dimensionUnit: e.target.value as typeof form.dimensionUnit })}
                  className="select"
                >
                  <option value="cm">cm</option>
                  <option value="m">m</option>
                  <option value="in">in</option>
                  <option value="ft">ft</option>
                </select>
              </div>
            </div>
          </div>

          {editing.imageUrl && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">
                Current main image (choosing new images replaces it with the first one):
              </p>
              <MediaThumb url={editing.imageUrl} className="w-24 h-24" />
            </div>
          )}
          {canAddMedia && (
            <ImagePicker
              files={imageFiles}
              onChange={setImageFiles}
              existing={gallery}
              onRemoveExisting={canDeleteMedia ? onRemoveGalleryImage : undefined}
            />
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button type="button" onClick={onClose} className="btn btn-outline">
              Cancel
            </button>
            <button type="submit" disabled={saving || loading} className="btn btn-primary inline-flex items-center gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Update
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
