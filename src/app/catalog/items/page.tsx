'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import {
  listCatalogItems,
  createCatalogItem,
  updateCatalogItem,
  deleteCatalogItem,
  getCatalogItem,
  listOrganizations,
  listBusinessUnits,
  listTaxCodes,
  listWarehouses,
  listProductMedia,
  createProductMedia,
  deleteProductMedia,
  listClassifications,
  createClassification,
  type CatalogClassification,
  type CatalogClassificationType
} from '@/lib/api';
import { toast } from 'sonner';
import { RichDataTable } from '@/components/rich-data-table';
import { useSession } from '@/hooks/use-session';
import { useRoleCheck } from '@/hooks/use-role-check';
import { useApiAccess } from '@/hooks/use-api-access';
import { ColumnDef } from '@tanstack/react-table';
import { Pencil, Trash2, Plus, X, Upload, Loader2, ImageIcon, Star, RefreshCw, Settings2, Tag, Download } from 'lucide-react';
import { MediaThumb } from '@/components/catalog/media-preview';
import { activeWarehouses } from '@/components/inventory/location-status-badge';
import { KeyValueEditor } from '@/components/key-value-editor';
import Link from 'next/link';

const CURRENCY_OPTIONS = ['GBP', 'EUR', 'USD', 'AED', 'AUD', 'CAD', 'CHF', 'INR', 'NZD', 'SAR', 'ZAR'];

type CatalogItem = {
  id: string;
  sku: string;
  name: string;
  description?: string | null;
  categoryId?: string | null;
  category?: string | null;
  subCategoryId?: string | null;
  subCategory?: string | null;
  brandId?: string | null;
  brand?: string | null;
  uomId?: string | null;
  uom?: string | null;
  packSizeId?: string | null;
  packSize?: string | null;
  costPrice?: number | null;
  sellingPrice?: number | null;
  currency?: string | null;
  supplierSku?: string | null;
  leadTimeDays?: number | null;
  remarks?: string | null;
  attributes?: Record<string, any> | null;
  status: 'active' | 'inactive' | 'discontinued';
  createdAt?: string;
  taxCode?: { id: string; code: string; name: string; rate: number } | null;
  organization?: { id: string; name: string };
  businessUnit?: { id: string; name: string } | null;
  barcode?: string | null;
  variants?: Array<{
    id: string;
    variantSku: string;
    name?: string | null;
    status?: string;
    option1Name?: string | null;
    option1Value?: string | null;
    option2Name?: string | null;
    option2Value?: string | null;
    option3Name?: string | null;
    option3Value?: string | null;
    attributes?: Record<string, any> | null;
  }>;
  /** Sum across variants — display only; real stock is per variant in stock_items. */
  openingQuantity?: number | null;
  variantCount?: number;
  variantStock?: Array<{
    variantId: string;
    variantSku: string;
    variantName?: string | null;
    warehouseId: string;
    warehouseName?: string | null;
    quantityOnHand: number;
    quantityReserved?: number;
  }>;
  reorderLevel?: number | null;
  reorderQuantity?: number | null;
  warehouseId?: string | null;
  warehouseName?: string | null;
  binCode?: string | null;
  supplierName?: string | null;
  lotNumber?: string | null;
  expiryDate?: string | null;
};

type ProductForm = {
  organizationId: string;
  businessUnitId: string;
  sku: string;
  barcode: string;
  name: string;
  description: string;
  /** Classification master ids (not display names). */
  categoryId: string;
  subCategoryId: string;
  brandId: string;
  uomId: string;
  packSizeId: string;
  openingQuantity: string;
  reorderLevel: string;
  reorderQuantity: string;
  costPrice: string;
  sellingPrice: string;
  currency: string;
  taxCodeId: string;
  warehouseId: string;
  binCode: string;
  supplierName: string;
  supplierSku: string;
  leadTimeDays: string;
  lotNumber: string;
  expiryDate: string;
  status: 'active' | 'inactive' | 'discontinued';
  remarks: string;
  attributes: string;
};

const emptyForm: ProductForm = {
  organizationId: '',
  businessUnitId: '',
  sku: '',
  barcode: '',
  name: '',
  description: '',
  categoryId: '',
  subCategoryId: '',
  brandId: '',
  uomId: '',
  packSizeId: '',
  openingQuantity: '',
  reorderLevel: '',
  reorderQuantity: '',
  costPrice: '',
  sellingPrice: '',
  currency: 'GBP',
  taxCodeId: '',
  warehouseId: '',
  binCode: '',
  supplierName: '',
  supplierSku: '',
  leadTimeDays: '',
  lotNumber: '',
  expiryDate: '',
  status: 'active',
  remarks: '',
  attributes: ''
};

/** Attribute keys that have dedicated inputs, so they stay out of the JSON box. */
const MANAGED_ATTRIBUTE_KEYS = ['supplierName', 'warehouseName', 'binCode', 'lotNumber'];

/** Stock/barcode fields are aggregated across variants in list responses, so only send them when edited. */
const STOCK_SHEET_KEYS = ['barcode', 'openingQuantity', 'reorderLevel', 'reorderQuantity', 'expiryDate'] as const;

/** Matches API WAREHOUSE_REQUIRED_FOR_QTY_MESSAGE — show before submit when qty/stock set without warehouse. */
const WAREHOUSE_REQUIRED_FOR_QTY_MESSAGE =
  'Select or update Warehouse / Location first, then set Opening Quantity (or other stock fields). Quantity was not saved.';

const STOCK_VALUE_KEYS = [
  'openingQuantity',
  'reorderLevel',
  'reorderQuantity',
  'binCode',
  'lotNumber',
  'expiryDate'
] as const;

type WarehouseOption = {
  id: string;
  code?: string | null;
  name?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  postalCode?: string | null;
  status?: string | null;
};

function warehouseOptionLabel(w: WarehouseOption): string {
  const title = w.code && w.name ? `${w.code} — ${w.name}` : w.name || w.code || `Warehouse ${w.id}`;
  const addr = [w.addressLine1, w.city, w.postalCode].filter(Boolean).join(', ');
  return addr ? `${title} · ${addr}` : title;
}

/** True when stock/qty fields need a warehouse id and none is selected (create, or stock fields changed on edit). */
function stockNeedsWarehouse(f: ProductForm, original?: ProductForm | null): boolean {
  if (f.warehouseId.trim()) return false;
  const hasStockValue = STOCK_VALUE_KEYS.some((k) => f[k].trim() !== '');
  if (!hasStockValue) return false;
  if (!original) return true;
  return STOCK_VALUE_KEYS.some((k) => f[k].trim() !== original[k].trim());
}

function formFromItem(item: CatalogItem): ProductForm {
  const shown = { ...(item.attributes ?? {}) } as Record<string, any>;
  MANAGED_ATTRIBUTE_KEYS.forEach((k) => delete shown[k]);
  const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
  const numStr = (v: unknown) => (v === null || v === undefined || v === '' ? '' : String(Number(v)));
  return {
    organizationId: item.organization?.id || '',
    businessUnitId: item.businessUnit?.id || '',
    sku: item.sku,
    barcode: str(item.barcode),
    name: item.name,
    description: str(item.description),
    categoryId: str(item.categoryId),
    subCategoryId: str(item.subCategoryId),
    brandId: str(item.brandId),
    uomId: str(item.uomId),
    packSizeId: str(item.packSizeId),
    openingQuantity: numStr(item.openingQuantity),
    reorderLevel: numStr(item.reorderLevel),
    reorderQuantity: numStr(item.reorderQuantity),
    costPrice: numStr(item.costPrice),
    sellingPrice: numStr(item.sellingPrice),
    currency: item.currency || 'GBP',
    taxCodeId: item.taxCode?.id || '',
    warehouseId: str(item.warehouseId),
    binCode: str(item.binCode),
    supplierName: str(item.supplierName),
    supplierSku: str(item.supplierSku),
    leadTimeDays: numStr(item.leadTimeDays),
    lotNumber: str(item.lotNumber),
    expiryDate: item.expiryDate ? String(item.expiryDate).slice(0, 10) : '',
    status: item.status,
    remarks: str(item.remarks),
    attributes: Object.keys(shown).length ? JSON.stringify(shown, null, 2) : ''
  };
}

function num(v: string) {
  return v.trim() === '' ? undefined : Number(v);
}

function int(v: string) {
  return v.trim() === '' ? undefined : parseInt(v, 10);
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{children}</h4>
  );
}

type ClassificationOption = { id: string; name: string };

type ClassificationBuckets = {
  category: ClassificationOption[];
  sub_category: ClassificationOption[];
  brand: ClassificationOption[];
  uom: ClassificationOption[];
  pack_size: ClassificationOption[];
};

const emptyClassificationBuckets = (): ClassificationBuckets => ({
  category: [],
  sub_category: [],
  brand: [],
  uom: [],
  pack_size: []
});

function groupClassificationOptions(rows: CatalogClassification[]): ClassificationBuckets {
  const out = emptyClassificationBuckets();
  for (const row of rows) {
    if (row.status && row.status !== 'active') continue;
    const bucket = out[row.type];
    if (!bucket) continue;
    if (!bucket.some((o) => o.id === String(row.id))) {
      bucket.push({ id: String(row.id), name: row.name });
    }
  }
  for (const key of Object.keys(out) as (keyof ClassificationBuckets)[]) {
    out[key].sort((a, b) => a.name.localeCompare(b.name));
  }
  return out;
}

function ClassificationSelect({
  label,
  value,
  options,
  onChange,
  emptyHint,
  placeholder,
  allowClear = true,
  orphanLabel
}: {
  label: string;
  /** Classification master id */
  value: string;
  options: ClassificationOption[];
  onChange: (nextId: string) => void;
  emptyHint?: React.ReactNode;
  placeholder?: string;
  allowClear?: boolean;
  /** Display name when value id is not in options (legacy / archived). */
  orphanLabel?: string;
}) {
  const hasOrphan = !!value && !options.some((o) => o.id === value);
  return (
    <label className="text-sm">
      {label}
      <select
        className="mt-1 select w-full"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {allowClear && <option value="">{placeholder || '—'}</option>}
        {hasOrphan && (
          <option value={value}>{orphanLabel || value} (current)</option>
        )}
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
      {options.length === 0 && emptyHint ? (
        <p className="mt-1 text-xs text-muted-foreground">{emptyHint}</p>
      ) : null}
    </label>
  );
}

function ProductFields({
  value,
  onChange,
  includeOrg,
  organizations,
  businessUnits,
  taxCodes,
  warehouses,
  onReloadTaxCodes,
  classifications,
  orphanLabels,
  onQuickCreateClassification,
  variantCount = 0,
  variantStock,
  lockMultiVariantStock
}: {
  value: ProductForm;
  onChange: (next: ProductForm) => void;
  includeOrg?: boolean;
  organizations: any[];
  businessUnits: any[];
  taxCodes: any[];
  warehouses: WarehouseOption[];
  onReloadTaxCodes?: () => void;
  classifications: ClassificationBuckets;
  /** Optional display names for orphan ids (edit form). */
  orphanLabels?: Partial<Record<'category' | 'subCategory' | 'brand' | 'uom' | 'packSize', string>>;
  onQuickCreateClassification?: (type: CatalogClassificationType, name: string) => Promise<string | null>;
  /** Number of variants on this product (edit). */
  variantCount?: number;
  /** Per-variant stock rows from API (edit). */
  variantStock?: CatalogItem['variantStock'];
  /** When true, opening qty is read-only total — multi-variant products. */
  lockMultiVariantStock?: boolean;
}) {
  const set = (patch: Partial<ProductForm>) => onChange({ ...value, ...patch });
  const warehouseChoices = useMemo(() => {
    const active = activeWarehouses(warehouses);
    if (value.warehouseId && !active.some((w) => String(w.id) === String(value.warehouseId))) {
      const current = warehouses.find((w) => String(w.id) === String(value.warehouseId));
      return current ? [...active, current] : active;
    }
    return active;
  }, [warehouses, value.warehouseId]);

  const field = (
    label: string,
    key: keyof ProductForm,
    opts: { type?: string; step?: string; placeholder?: string; maxLength?: number } = {}
  ) => (
    <label className="text-sm">
      {label}
      <input
        type={opts.type ?? 'text'}
        step={opts.step}
        maxLength={opts.maxLength}
        placeholder={opts.placeholder}
        className="mt-1 input w-full"
        value={value[key] as string}
        onChange={(e) => set({ [key]: e.target.value } as Partial<ProductForm>)}
      />
    </label>
  );

  return (
    <div className="space-y-5">
      {includeOrg && (
        <div className="grid grid-cols-2 gap-4">
          <label className="text-sm">
            Organization *
            <select
              className="mt-1 select w-full"
              value={value.organizationId}
              onChange={(e) => set({ organizationId: e.target.value })}
              required
            >
              <option value="">Select…</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Business Unit
            <select
              className="mt-1 select w-full"
              value={value.businessUnitId}
              onChange={(e) => set({ businessUnitId: e.target.value })}
            >
              <option value="">None</option>
              {businessUnits.map((bu) => (
                <option key={bu.id} value={bu.id}>
                  {bu.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <section>
        <SectionTitle>Identity</SectionTitle>
        <div className="grid grid-cols-2 gap-4">
          <label className="text-sm">
            SKU / Item Code *
            <input
              className="mt-1 input w-full"
              value={value.sku}
              onChange={(e) => set({ sku: e.target.value })}
              required
            />
          </label>
          {field('Barcode / UPC', 'barcode', { placeholder: 'Optional — any barcode, EAN-13 or UPC-A' })}
          <label className="text-sm col-span-2">
            Product Name *
            <input
              className="mt-1 input w-full"
              value={value.name}
              onChange={(e) => set({ name: e.target.value })}
              required
            />
          </label>
          <label className="text-sm col-span-2">
            Description
            <textarea
              className="mt-1 input w-full"
              rows={2}
              value={value.description}
              onChange={(e) => set({ description: e.target.value })}
            />
          </label>
        </div>
      </section>

      <section>
        <SectionTitle>Classification</SectionTitle>
        <div className="grid grid-cols-2 gap-4">
          <ClassificationSelect
            label="Category"
            value={value.categoryId}
            options={classifications.category}
            orphanLabel={orphanLabels?.category}
            onChange={(categoryId) => set({ categoryId })}
            placeholder="Select category…"
            emptyHint={
              <>
                No categories yet — add in{' '}
                <Link href="/catalog/classifications" className="text-primary hover:underline">Manage Classifications</Link>
                {onQuickCreateClassification ? (
                  <>
                    {' '}or{' '}
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={async () => {
                        const raw = window.prompt('New category name');
                        if (!raw?.trim()) return;
                        const created = await onQuickCreateClassification('category', raw.trim());
                        if (created) set({ categoryId: created });
                      }}
                    >
                      add new
                    </button>
                  </>
                ) : null}
              </>
            }
          />
          <ClassificationSelect
            label="Sub-Category"
            value={value.subCategoryId}
            options={classifications.sub_category}
            orphanLabel={orphanLabels?.subCategory}
            onChange={(subCategoryId) => set({ subCategoryId })}
            placeholder="Optional"
            emptyHint={
              <>
                No sub-categories yet — add in{' '}
                <Link href="/catalog/classifications" className="text-primary hover:underline">Manage Classifications</Link>
              </>
            }
          />
          <ClassificationSelect
            label="Brand / Manufacturer"
            value={value.brandId}
            options={classifications.brand}
            orphanLabel={orphanLabels?.brand}
            onChange={(brandId) => set({ brandId })}
            placeholder="Select brand…"
            emptyHint={
              <>
                No brands yet — add in{' '}
                <Link href="/catalog/classifications" className="text-primary hover:underline">Manage Classifications</Link>
              </>
            }
          />
          <ClassificationSelect
            label="Unit of Measure (UOM)"
            value={value.uomId}
            options={classifications.uom}
            orphanLabel={orphanLabels?.uom}
            onChange={(uomId) => set({ uomId })}
            placeholder="SET, PCS, BOX…"
            emptyHint={
              <>
                No UOMs yet — add in{' '}
                <Link href="/catalog/classifications" className="text-primary hover:underline">Manage Classifications</Link>
              </>
            }
          />
          <ClassificationSelect
            label="Pack Size"
            value={value.packSizeId}
            options={classifications.pack_size}
            orphanLabel={orphanLabels?.packSize}
            onChange={(packSizeId) => set({ packSizeId })}
            placeholder="1, 12x330ml…"
            emptyHint={
              <>
                No pack sizes yet — add in{' '}
                <Link href="/catalog/classifications" className="text-primary hover:underline">Manage Classifications</Link>
              </>
            }
          />
          <label className="text-sm">
            Status
            <select
              className="mt-1 select w-full"
              value={value.status}
              onChange={(e) => set({ status: e.target.value as ProductForm['status'] })}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="discontinued">Discontinued</option>
            </select>
          </label>
        </div>
      </section>

      <section>
        <SectionTitle>Pricing &amp; Tax</SectionTitle>
        <div className="grid grid-cols-2 gap-4">
          {field('Default unit cost (catalogue)', 'costPrice', { type: 'number', step: '0.0001' })}
          {field('Default sell price (catalogue)', 'sellingPrice', { type: 'number', step: '0.0001' })}
          <label className="text-sm">
            Currency
            <select
              className="mt-1 select w-full"
              value={value.currency || 'GBP'}
              onChange={(e) => set({ currency: e.target.value })}
            >
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              {value.currency && !CURRENCY_OPTIONS.includes(value.currency) && (
                <option value={value.currency}>{value.currency}</option>
              )}
            </select>
          </label>
          <div className="text-sm">
            <div className="flex items-center justify-between">
              <span>Tax / VAT</span>
              <span className="flex items-center gap-2 text-xs">
                {onReloadTaxCodes && (
                  <button type="button" onClick={onReloadTaxCodes} className="text-muted-foreground hover:text-foreground" title="Reload tax codes">
                    <RefreshCw size={12} />
                  </button>
                )}
                <a href="/catalog/tax-codes" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                  <Settings2 size={12} /> Manage tax codes
                </a>
              </span>
            </div>
            <select
              className="mt-1 select w-full"
              value={value.taxCodeId}
              onChange={(e) => set({ taxCodeId: e.target.value })}
            >
              <option value="">None</option>
              {taxCodes
                .filter((tc) => tc.status !== 'inactive' || tc.id === value.taxCodeId)
                .map((tc) => (
                  <option key={tc.id} value={tc.id}>
                    {tc.code} — {tc.name} ({Number((Number(tc.rate) * 100).toFixed(2))}%)
                  </option>
                ))}
            </select>
            {taxCodes.length === 0 && (
              <p className="mt-1 text-xs text-muted-foreground">No tax codes yet — add VAT/GST rates on the Tax Codes page.</p>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Catalogue cost/sell are defaults. POS and B2B sell prices come from Price Lists (per variant);
          variant-level cost on Variants overrides catalogue cost when set. Images can also be per variant.
        </p>
      </section>

      <section>
        <SectionTitle>Inventory &amp; Warehouse</SectionTitle>
        <div className="grid grid-cols-2 gap-4">
          {lockMultiVariantStock ? (
            <label className="text-sm">
              Total stock (all variants)
              <input
                className="mt-1 input w-full bg-muted/40"
                type="number"
                value={value.openingQuantity}
                readOnly
                title="Sum of per-variant stock — not editable here"
              />
            </label>
          ) : (
            field('Opening quantity (default variant)', 'openingQuantity', { type: 'number' })
          )}
          {field('Reorder Level', 'reorderLevel', { type: 'number' })}
          {field('Reorder Quantity', 'reorderQuantity', { type: 'number' })}
          <label className="text-sm">
            Warehouse / Location
            <select
              className="mt-1 select w-full"
              value={value.warehouseId}
              onChange={(e) => set({ warehouseId: e.target.value })}
              disabled={lockMultiVariantStock}
            >
              <option value="">Select warehouse…</option>
              {warehouseChoices.map((w) => (
                <option key={w.id} value={w.id}>
                  {warehouseOptionLabel(w)}
                </option>
              ))}
            </select>
          </label>
          {field('Bin / Rack No.', 'binCode')}
          {field('Batch / Lot No.', 'lotNumber')}
          {field('Expiry Date', 'expiryDate', { type: 'date' })}
        </div>
        {lockMultiVariantStock ? (
          <p className="text-xs text-muted-foreground mt-2">
            This product has {variantCount} variants. Stock is stored per variant × warehouse — the total above is
            a sum only. Set or change qty on{' '}
            <Link href="/inventory/stock-items" className="text-primary hover:underline">
              Inventory → Stock Items
            </Link>{' '}
            or open each variant below.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground mt-2">
            Opening quantity is saved on a stock row for the default (first) variant and selected warehouse — not
            on the catalogue master. Select a warehouse before setting quantity. Missing bins and suppliers are
            created automatically.
          </p>
        )}
        {variantStock && variantStock.length > 0 && (
          <div className="mt-3 rounded-lg border overflow-hidden">
            <div className="px-3 py-1.5 text-xs font-medium bg-muted/40 border-b">Stock by variant</div>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="px-3 py-1.5 font-medium">Variant SKU</th>
                  <th className="px-3 py-1.5 font-medium">Warehouse</th>
                  <th className="px-3 py-1.5 font-medium text-right">Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {variantStock.map((row) => (
                  <tr key={`${row.variantId}-${row.warehouseId}`}>
                    <td className="px-3 py-1.5 font-mono">
                      <Link
                        href={`/catalog/variants?q=${encodeURIComponent(row.variantSku)}`}
                        className="text-primary hover:underline"
                      >
                        {row.variantSku}
                      </Link>
                    </td>
                    <td className="px-3 py-1.5">{row.warehouseName || '—'}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{row.quantityOnHand}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {lockMultiVariantStock && (!variantStock || variantStock.length === 0) && (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
            No stock rows yet for these variants. Add quantity per variant on Stock Items.
          </p>
        )}
      </section>

      <section>
        <SectionTitle>Supplier</SectionTitle>
        <div className="grid grid-cols-2 gap-4">
          {field('Supplier Name', 'supplierName')}
          {field('Supplier SKU', 'supplierSku')}
          {field('Lead Time (Days)', 'leadTimeDays', { type: 'number' })}
        </div>
      </section>

      <section>
        <SectionTitle>Notes</SectionTitle>
        <div className="grid grid-cols-1 gap-4">
          <label className="text-sm">
            Remarks
            <textarea
              className="mt-1 input w-full"
              rows={2}
              value={value.remarks}
              onChange={(e) => set({ remarks: e.target.value })}
            />
          </label>
          <div className="text-sm space-y-1.5">
            <span>Extra attributes</span>
            <p className="text-xs text-muted-foreground">Add key/value pairs (saved as JSON). Example: colour → black</p>
            <KeyValueEditor
              value={value.attributes}
              onChange={(json) => set({ attributes: json })}
              placeholderKey="e.g. colour"
              placeholderValue="e.g. black"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

const CATALOG_PAGE_SIZE = 500;

/** Every catalogue item: first page, then the remaining pages in parallel. */
async function loadAllCatalogItems(organizationId?: string) {
  const first = await listCatalogItems({ organizationId, page: 1, limit: CATALOG_PAGE_SIZE });
  const totalPages = first.pagination?.totalPages ?? 1;
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, totalPages - 1) }, (_, i) =>
      listCatalogItems({ organizationId, page: i + 2, limit: CATALOG_PAGE_SIZE })
    )
  );
  return [...(first.data || []), ...rest.flatMap((r) => r.data || [])];
}

export default function CatalogItemsPage() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const { hasAccess } = useRoleCheck(['ADMIN', 'SUPER_ADMIN', 'WAREHOUSE_MANAGER', 'SALES_REP']);
  const { can } = useApiAccess();
  const canCreate = can('POST', '/api/catalog/items');
  const canUpdate = can('PATCH', '/api/catalog/items/:id');
  const canDelete = can('DELETE', '/api/catalog/items/:id');
  const canImport = can('POST', '/api/catalog/inventory-import/execute');
  const canAddMedia = can('POST', '/api/catalog/media');
  const canDeleteMedia = can('DELETE', '/api/catalog/media/:id');
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [businessUnits, setBusinessUnits] = useState<any[]>([]);
  const [taxCodes, setTaxCodes] = useState<any[]>([]);
  const [classifications, setClassifications] = useState<ClassificationBuckets>(emptyClassificationBuckets());
  const [editOrphanLabels, setEditOrphanLabels] = useState<
    Partial<Record<'category' | 'subCategory' | 'brand' | 'uom' | 'packSize', string>>
  >({});
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [editForm, setEditForm] = useState<ProductForm>(emptyForm);
  const [confirmDel, setConfirmDel] = useState<CatalogItem | null>(null);
  const [media, setMedia] = useState<any[]>([]);
  const [editOriginal, setEditOriginal] = useState<ProductForm | null>(null);
  const [editVariants, setEditVariants] = useState<NonNullable<CatalogItem['variants']>>([]);
  const [editVariantStock, setEditVariantStock] = useState<NonNullable<CatalogItem['variantStock']>>([]);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [createImages, setCreateImages] = useState<File[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingMediaDeletes, setPendingMediaDeletes] = useState<string[]>([]);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [listFilter, setListFilter] = useState<{
    warehouseId: string;
    barcode: 'all' | 'with' | 'without';
    price: 'all' | 'with' | 'without';
  }>({ warehouseId: '', barcode: 'all', price: 'all' });

  async function refreshItems(organizationId?: string) {
    // Always scope to an org — never load every tenant's catalogue into this page.
    setItems(await loadAllCatalogItems(organizationId || session?.user?.organizationId));
  }

  useEffect(() => {
    if (!hydrated || !hasAccess) return;
    if (!session?.accessToken) {
      router.replace('/login');
      return;
    }
    (async () => {
      try {
        const orgId = session?.user?.organizationId;
        const [itemsRes, orgsRes, taxCodesRes, warehousesRes, classRes] = await Promise.all([
          loadAllCatalogItems(orgId).then((data) => ({ data })),
          listOrganizations(),
          listTaxCodes({ organizationId: orgId }),
          listWarehouses({
            organizationId: orgId,
            limit: 200,
            status: 'active'
          }).catch(() => ({ data: [] as WarehouseOption[] })),
          listClassifications({ organizationId: orgId, status: 'active' }).catch(() => ({ data: [] as CatalogClassification[] }))
        ]);
        setItems(itemsRes.data || []);
        setOrganizations(orgsRes.data || []);
        setTaxCodes(taxCodesRes.data || []);
        setWarehouses(warehousesRes.data || []);
        setClassifications(groupClassificationOptions(classRes.data || []));
        if (orgId) {
          setForm((prev) => ({ ...prev, organizationId: orgId }));
          const busRes = await listBusinessUnits(orgId).catch(() => ({ data: [] }));
          setBusinessUnits(busRes.data || []);
        }
      } catch (e: any) {
        if (e?.response?.status === 401) {
          toast.error('Session expired. Please login again.');
          router.replace('/login');
        } else {
          toast.error('Failed to load catalog items');
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [hydrated, hasAccess, router, session?.accessToken, session?.user?.organizationId]);

  useEffect(() => {
    if (!form.organizationId) {
      setBusinessUnits([]);
      return;
    }
    listBusinessUnits(form.organizationId)
      .then((res) => setBusinessUnits(res.data || []))
      .catch(() => setBusinessUnits([]));
    listTaxCodes({ organizationId: form.organizationId })
      .then((res) => {
        const codes = res.data || [];
        setTaxCodes(codes);
        setForm((prev) => {
          if (prev.taxCodeId && !codes.some((tc: any) => String(tc.id) === String(prev.taxCodeId))) {
            return { ...prev, taxCodeId: '' };
          }
          return prev;
        });
      })
      .catch(() => setTaxCodes([]));
    listClassifications({ organizationId: form.organizationId, status: 'active' })
      .then((res) => setClassifications(groupClassificationOptions(res.data || [])))
      .catch(() => setClassifications(emptyClassificationBuckets()));
  }, [form.organizationId]);

  async function reloadTaxCodes(organizationId?: string) {
    try {
      const orgId = organizationId || form.organizationId || session?.user?.organizationId;
      const res = await listTaxCodes({ organizationId: orgId });
      setTaxCodes(res.data || []);
    } catch {
      toast.error('Failed to load tax codes');
    }
  }

  async function reloadClassifications(organizationId?: string) {
    try {
      const orgId = organizationId || form.organizationId || session?.user?.organizationId;
      const res = await listClassifications({ organizationId: orgId, status: 'active' });
      setClassifications(groupClassificationOptions(res.data || []));
    } catch {
      toast.error('Failed to load classifications');
    }
  }

  async function quickCreateClassification(type: CatalogClassificationType, name: string): Promise<string | null> {
    try {
      const orgId = form.organizationId || editing?.organization?.id || session?.user?.organizationId;
      const res = await createClassification({ organizationId: orgId, type, name });
      await reloadClassifications(orgId);
      toast.success(`${name} added`);
      return String(res.data.id);
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message ?? 'Could not add classification');
      return null;
    }
  }

  async function loadMedia(catalogItemId: string) {
    try {
      const res = await listProductMedia({ catalogItemId, type: 'image' });
      setMedia(res.data || []);
    } catch {
      setMedia([]);
    }
  }

  function buildPayload(
    f: ProductForm,
    original?: ProductForm | null,
    opts?: { multiVariant?: boolean }
  ) {
    let attributes: Record<string, any> | undefined;
    if (f.attributes.trim()) attributes = JSON.parse(f.attributes);
    else if (original?.attributes.trim()) attributes = {};
    const text = (key: keyof ProductForm) => {
      const v = (f[key] as string).trim();
      if (v) return v;
      return original && (original[key] as string).trim() ? '' : undefined;
    };
    const idField = (key: 'categoryId' | 'subCategoryId' | 'brandId' | 'uomId' | 'packSizeId') => {
      const v = f[key].trim();
      if (v) return v;
      return original && original[key].trim() ? '' : undefined;
    };
    const payload: Record<string, any> = {
      sku: f.sku,
      name: f.name,
      description: text('description'),
      categoryId: idField('categoryId'),
      subCategoryId: idField('subCategoryId'),
      brandId: idField('brandId'),
      uomId: idField('uomId'),
      packSizeId: idField('packSizeId'),
      costPrice: num(f.costPrice),
      sellingPrice: num(f.sellingPrice),
      currency: f.currency || undefined,
      taxCodeId: text('taxCodeId'),
      supplierSku: text('supplierSku'),
      leadTimeDays: int(f.leadTimeDays),
      remarks: text('remarks'),
      status: f.status,
      attributes,
      barcode: f.barcode,
      openingQuantity: num(f.openingQuantity),
      reorderLevel: num(f.reorderLevel),
      reorderQuantity: num(f.reorderQuantity),
      warehouseId: f.warehouseId.trim() || undefined,
      binCode: text('binCode'),
      supplierName: text('supplierName'),
      lotNumber: text('lotNumber'),
      expiryDate: f.expiryDate || undefined
    };
    if (original) {
      for (const key of STOCK_SHEET_KEYS) {
        if (f[key].trim() === original[key].trim()) delete payload[key];
      }
      // Keep warehouseId whenever any stock field is being saved so the API can attach the stock row.
      const sendingStock = STOCK_VALUE_KEYS.some(
        (k) => payload[k] !== undefined && String(payload[k] ?? '').trim() !== ''
      );
      if (!sendingStock && f.warehouseId.trim() === original.warehouseId.trim()) {
        delete payload.warehouseId;
      }
    }
    // Never send aggregated opening qty back when the product has multiple variants.
    if (opts?.multiVariant) {
      delete payload.openingQuantity;
    }
    return payload;
  }

  function saveErrorMessage(e: any, fallback: string) {
    if (e?.message?.includes('JSON')) return 'Invalid attributes JSON';
    return e?.response?.data?.error?.message ?? fallback;
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!session || !form.organizationId || !form.sku || !form.name) {
      toast.error('Organization, SKU and Name are required');
      return;
    }
    if (stockNeedsWarehouse(form)) {
      toast.error(WAREHOUSE_REQUIRED_FOR_QTY_MESSAGE);
      return;
    }
    setSaving(true);
    try {
      const created = await createCatalogItem({
        organizationId: form.organizationId,
        businessUnitId: form.businessUnitId || undefined,
        sku: form.sku,
        name: form.name,
        ...buildPayload(form)
      });
      let failedImages = 0;
      for (const [i, file] of createImages.entries()) {
        try {
          await createProductMedia({ catalogItemId: created.data.id, type: 'image', position: i, isPrimary: i === 0 }, file);
        } catch {
          failedImages += 1;
        }
      }
      await refreshItems(form.organizationId);
      setShowCreate(false);
      setForm({ ...emptyForm, organizationId: session.user.organizationId || '' });
      setCreateImages([]);
      toast.success('Catalog item created');
      if (failedImages) toast.error(`${failedImages} image(s) failed to upload — add them from Edit`);
    } catch (e: any) {
      toast.error(saveErrorMessage(e, 'Create failed'));
    } finally {
      setSaving(false);
    }
  }

  async function onUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    if (stockNeedsWarehouse(editForm, editOriginal)) {
      toast.error(WAREHOUSE_REQUIRED_FOR_QTY_MESSAGE);
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload(editForm, editOriginal, {
        multiVariant: editVariants.length > 1
      });
      const res = await updateCatalogItem(editing.id, {
        businessUnitId: editForm.businessUnitId || (editOriginal?.businessUnitId ? '' : undefined),
        ...payload
      });
      // Apply queued image removals only when Update is clicked (X alone does not persist).
      for (const mediaId of pendingMediaDeletes) {
        try {
          await deleteProductMedia(mediaId);
        } catch {
          /* continue; toast below if any remain */
        }
      }
      const saved = res?.data as CatalogItem | undefined;
      if (saved?.id) {
        setItems((prev) => prev.map((it) => (it.id === saved.id ? { ...it, ...saved } : it)));
      }
      await refreshItems();
      closeEdit();
      toast.success('Catalog item updated');
    } catch (e: any) {
      toast.error(saveErrorMessage(e, 'Update failed'));
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!confirmDel) return;
    try {
      await deleteCatalogItem(confirmDel.id);
      setItems(items.filter((item) => item.id !== confirmDel.id));
      setConfirmDel(null);
      toast.success('Catalog item deleted');
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message ?? 'Delete failed');
    }
  }

  async function onUploadImages(files: FileList | null) {
    if (!editing || !files?.length) return;
    setUploadingMedia(true);
    try {
      let position = media.length;
      for (const file of Array.from(files)) {
        await createProductMedia(
          {
            catalogItemId: editing.id,
            type: 'image',
            position,
            isPrimary: position === 0 && media.length === 0
          },
          file
        );
        position += 1;
      }
      await loadMedia(editing.id);
      toast.success('Image(s) uploaded');
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message ?? 'Image upload failed');
    } finally {
      setUploadingMedia(false);
    }
  }

  function onRemoveImage(id: string) {
    setPendingMediaDeletes((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setMedia((prev) => prev.filter((m) => m.id !== id));
  }

  function closeEdit() {
    setEditing(null);
    setEditOriginal(null);
    setEditVariants([]);
    setEditVariantStock([]);
    setMedia([]);
    setPendingMediaDeletes([]);
  }

  function orphanLabelsFromItem(item: CatalogItem) {
    return {
      category: item.category || undefined,
      subCategory: item.subCategory || undefined,
      brand: item.brand || undefined,
      uom: item.uom || undefined,
      packSize: item.packSize || undefined
    };
  }

  async function openEdit(item: CatalogItem) {
    setPendingMediaDeletes([]);
    setEditing(item);
    setEditOrphanLabels(orphanLabelsFromItem(item));
    const initial = formFromItem(item);
    setEditForm(initial);
    setEditOriginal(initial);
    setEditVariants(item.variants ?? []);
    setEditVariantStock(item.variantStock ?? []);
    loadMedia(item.id);
    setLoadingEdit(true);
    try {
      const res = await getCatalogItem(item.id);
      const fresh = res.data as CatalogItem;
      const hydratedForm = formFromItem(fresh);
      setEditing(fresh);
      setEditOrphanLabels(orphanLabelsFromItem(fresh));
      setEditForm(hydratedForm);
      setEditOriginal(hydratedForm);
      setEditVariants(fresh.variants ?? []);
      setEditVariantStock(fresh.variantStock ?? []);
    } catch {
      toast.error('Could not refresh product details; showing list values');
    } finally {
      setLoadingEdit(false);
    }
  }

  const isSuperAdmin = !!session?.user?.roles?.includes('SUPER_ADMIN');

  const columns = useMemo<ColumnDef<CatalogItem>[]>(
    () => [
      {
        accessorKey: 'sku',
        header: 'SKU / Item Code',
        cell: ({ row }) => <span className="font-mono text-xs whitespace-nowrap">{row.original.sku}</span>
      },
      {
        accessorKey: 'barcode',
        header: 'Barcode / UPC',
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.barcode || '—'}</span>
      },
      {
        accessorKey: 'name',
        header: 'Product Name',
        cell: ({ row }) => (
          <span className="font-medium block max-w-[240px] truncate" title={row.original.name}>
            {row.original.name}
          </span>
        )
      },
      {
        accessorKey: 'description',
        header: 'Description',
        cell: ({ row }) => (
          <span
            className="block max-w-[200px] truncate text-xs text-muted-foreground"
            title={row.original.description || ''}
          >
            {row.original.description || '—'}
          </span>
        )
      },
      { accessorKey: 'category', header: 'Category', cell: ({ row }) => row.original.category || '—' },
      { accessorKey: 'subCategory', header: 'Sub-Category', cell: ({ row }) => row.original.subCategory || '—' },
      { accessorKey: 'brand', header: 'Brand / Manufacturer', cell: ({ row }) => row.original.brand || '—' },
      { accessorKey: 'uom', header: 'UOM', cell: ({ row }) => row.original.uom || '—' },
      { accessorKey: 'packSize', header: 'Pack Size', cell: ({ row }) => row.original.packSize || '—' },
      {
        accessorKey: 'openingQuantity',
        header: 'Total stock',
        cell: ({ row }) => row.original.openingQuantity ?? '—'
      },
      { accessorKey: 'reorderLevel', header: 'Reorder Level', cell: ({ row }) => row.original.reorderLevel ?? '—' },
      {
        accessorKey: 'reorderQuantity',
        header: 'Reorder Qty',
        cell: ({ row }) => row.original.reorderQuantity ?? '—'
      },
      {
        accessorKey: 'costPrice',
        header: 'Default cost',
        cell: ({ row }) => (row.original.costPrice != null ? Number(row.original.costPrice).toFixed(2) : '—')
      },
      {
        accessorKey: 'sellingPrice',
        header: 'Default sell',
        cell: ({ row }) => (row.original.sellingPrice != null ? Number(row.original.sellingPrice).toFixed(2) : '—')
      },
      {
        id: 'tax',
        header: 'Tax / GST %',
        cell: ({ row }) =>
          row.original.taxCode ? `${Math.round(Number(row.original.taxCode.rate) * 100)}%` : '—'
      },
      {
        accessorKey: 'warehouseName',
        header: 'Warehouse / Location',
        cell: ({ row }) => (
          <span className="block max-w-[180px] truncate" title={row.original.warehouseName || ''}>
            {row.original.warehouseName || '—'}
          </span>
        )
      },
      { accessorKey: 'binCode', header: 'Bin / Rack No.', cell: ({ row }) => row.original.binCode || '—' },
      {
        accessorKey: 'supplierName',
        header: 'Supplier Name',
        cell: ({ row }) => (
          <span className="block max-w-[180px] truncate" title={row.original.supplierName || ''}>
            {row.original.supplierName || '—'}
          </span>
        )
      },
      { accessorKey: 'supplierSku', header: 'Supplier SKU', cell: ({ row }) => row.original.supplierSku || '—' },
      {
        accessorKey: 'leadTimeDays',
        header: 'Lead Time (Days)',
        cell: ({ row }) => row.original.leadTimeDays ?? '—'
      },
      { accessorKey: 'lotNumber', header: 'Batch / Lot No.', cell: ({ row }) => row.original.lotNumber || '—' },
      { accessorKey: 'expiryDate', header: 'Expiry Date', cell: ({ row }) => row.original.expiryDate || '—' },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const status = row.original.status;
          const colors = {
            active: 'bg-green-100 text-green-800',
            inactive: 'bg-gray-100 text-gray-800',
            discontinued: 'bg-red-100 text-red-800'
          };
          return <span className={`px-2 py-1 rounded text-xs font-medium ${colors[status]}`}>{status}</span>;
        }
      },
      {
        id: 'dateAdded',
        header: 'Date Added',
        cell: ({ row }) =>
          row.original.createdAt ? new Date(row.original.createdAt).toISOString().slice(0, 10) : '—'
      },
      {
        accessorKey: 'remarks',
        header: 'Remarks',
        cell: ({ row }) => (
          <span
            className="block max-w-[220px] truncate text-xs text-muted-foreground"
            title={row.original.remarks || ''}
          >
            {row.original.remarks || '—'}
          </span>
        )
      },
      {
        id: 'actions',
        header: '',
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            {canUpdate && (
            <button
              onClick={() => openEdit(row.original)}
              className="p-1 hover:bg-gray-100 rounded"
              type="button"
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </button>
            )}
            {canDelete && (
            <button
              onClick={() => setConfirmDel(row.original)}
              className="p-1 hover:bg-gray-100 rounded text-red-600"
              type="button"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            )}
          </div>
        )
      }
    ],
    [canUpdate, canDelete]
  );

  // Default View → Toggle Columns: SKU, Name, Category, SubCategory, Brand, Opening Qty, Price.
  // Barcode / Description and all other fields stay available to toggle on manually.
  const defaultColumnVisibility = useMemo(
    () => ({
      sku: true,
      name: true,
      category: true,
      subCategory: true,
      brand: true,
      openingQuantity: true,
      sellingPrice: true,
      barcode: false,
      description: false,
      uom: false,
      packSize: false,
      reorderLevel: false,
      reorderQuantity: false,
      costPrice: false,
      tax: false,
      warehouseName: false,
      binCode: false,
      supplierName: false,
      supplierSku: false,
      leadTimeDays: false,
      lotNumber: false,
      expiryDate: false,
      status: false,
      dateAdded: false,
      remarks: false,
    }),
    []
  );

  if (!hydrated || loading) {
    return (
      <div className="min-h-screen app-surface flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen app-surface">
        <Sidebar />
        <div className="lg:ml-[280px] p-8">Access denied</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen app-surface">
      <Sidebar />
      <div className="flex flex-col overflow-hidden lg:ml-[280px]">
        <Header title="Catalog · Items" />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="max-w-[1800px] mx-auto">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <div>
                <h1 className="text-3xl font-bold">Catalog Items</h1>
                <p className="text-muted-foreground mt-1">
                  Every inventory sheet column, plus images and JSON attributes
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-outline inline-flex items-center gap-2"
                  onClick={() => {
                    const cols = ['SKU', 'Name', 'Barcode', 'Category', 'Brand', 'UOM', 'Selling Price', 'Tax', 'Status'];
                    const rows = items.map((it) => [
                      it.sku, it.name, it.barcode || '', it.category || '', it.brand || '', it.uom || '',
                      it.sellingPrice ?? '', it.taxCode ? `${Math.round(Number(it.taxCode.rate) * 100)}%` : '', it.status
                    ]);
                    const csv = [cols, ...rows]
                      .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
                      .join('\n');
                    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = `zaam-catalog-${new Date().toISOString().slice(0, 10)}.csv`;
                    a.click();
                    URL.revokeObjectURL(a.href);
                  }}
                >
                  <Download className="h-4 w-4" /> Export
                </button>
                {canImport && (
                <Link href="/catalog/inventory-import" className="btn btn-outline inline-flex items-center gap-2">
                  <Upload className="h-4 w-4" /> Import Excel
                </Link>
                )}
                {canCreate && (
                <button
                  type="button"
                  onClick={() => {
                    setForm({ ...emptyForm, organizationId: session?.user?.organizationId || '' });
                    setCreateImages([]);
                    setShowCreate(true);
                  }}
                  className="btn btn-primary inline-flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" /> Add Item
                </button>
                )}
              </div>
            </div>

            <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card/50 p-3">
              <label className="text-sm">
                Warehouse
                <select
                  className="mt-1 select min-w-[180px]"
                  value={listFilter.warehouseId}
                  onChange={(e) => setListFilter((f) => ({ ...f, warehouseId: e.target.value }))}
                >
                  <option value="">All warehouses</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={String(w.id)}>
                      {w.name || w.code}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                Barcode
                <select
                  className="mt-1 select min-w-[140px]"
                  value={listFilter.barcode}
                  onChange={(e) => setListFilter((f) => ({ ...f, barcode: e.target.value as typeof f.barcode }))}
                >
                  <option value="all">All</option>
                  <option value="with">Has barcode</option>
                  <option value="without">No barcode</option>
                </select>
              </label>
              <label className="text-sm">
                Selling price
                <select
                  className="mt-1 select min-w-[140px]"
                  value={listFilter.price}
                  onChange={(e) => setListFilter((f) => ({ ...f, price: e.target.value as typeof f.price }))}
                >
                  <option value="all">All</option>
                  <option value="with">Has price</option>
                  <option value="without">No selling price</option>
                </select>
              </label>
              {(listFilter.warehouseId || listFilter.barcode !== 'all' || listFilter.price !== 'all') && (
                <button
                  type="button"
                  className="btn btn-outline text-xs"
                  onClick={() => setListFilter({ warehouseId: '', barcode: 'all', price: 'all' })}
                >
                  Clear filters
                </button>
              )}
            </div>

            <RichDataTable
              columns={columns}
              tableId="catalog-items-v2"
              initialColumnVisibility={defaultColumnVisibility}
              emptyMessage="No catalog items in this organisation yet. Add an item or import from Excel to get started."
              data={items.filter((it) => {
                if (listFilter.warehouseId && String(it.warehouseId || '') !== listFilter.warehouseId) return false;
                if (listFilter.barcode === 'with' && !String(it.barcode || '').trim()) return false;
                if (listFilter.barcode === 'without' && String(it.barcode || '').trim()) return false;
                const hasPrice = it.sellingPrice != null && Number(it.sellingPrice) > 0;
                if (listFilter.price === 'with' && !hasPrice) return false;
                if (listFilter.price === 'without' && hasPrice) return false;
                return true;
              })}
            />

            {previewImageUrl && (
              <div
                className="fixed inset-0 z-[110] bg-black/70 flex items-center justify-center p-4"
                onClick={() => setPreviewImageUrl(null)}
              >
                <button
                  type="button"
                  className="absolute top-4 right-4 rounded-full bg-black/60 text-white p-2"
                  onClick={() => setPreviewImageUrl(null)}
                >
                  <X className="h-5 w-5" />
                </button>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewImageUrl}
                  alt="Product preview"
                  className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}

            {showCreate && (
              <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="w-full max-w-3xl rounded-2xl bg-card border shadow-2xl p-6 max-h-[92vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Create Catalog Item</h3>
                    <button
                      type="button"
                      onClick={() => setShowCreate(false)}
                      className="p-1 hover:bg-muted rounded-lg"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <form onSubmit={onCreate} className="space-y-4">
                    <ProductFields
                      value={form}
                      onChange={setForm}
                      includeOrg={isSuperAdmin}
                      organizations={organizations}
                      businessUnits={businessUnits}
                      taxCodes={taxCodes}
                      warehouses={warehouses}
                      onReloadTaxCodes={reloadTaxCodes}
                      classifications={classifications}
                      onQuickCreateClassification={quickCreateClassification}
                    />
                    <div className="border-t pt-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold inline-flex items-center gap-2">
                          <ImageIcon size={16} /> Product images
                        </h4>
                        {canAddMedia && (
                        <label className="btn btn-outline text-xs inline-flex items-center gap-1 cursor-pointer">
                          <Upload size={14} /> Add images
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                              const files = Array.from(e.target.files ?? []);
                              setCreateImages((prev) => [...prev, ...files]);
                              e.target.value = '';
                            }}
                          />
                        </label>
                        )}
                      </div>
                      {createImages.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Optional — select one or more images; the first becomes the primary image. Click a thumbnail to view it.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {createImages.map((f, i) => {
                            const url = URL.createObjectURL(f);
                            return (
                              <div key={`${f.name}-${i}`} className="relative w-20 h-20 rounded-lg overflow-hidden border">
                                {i === 0 && (
                                  <span className="absolute left-1 top-1 z-10 rounded bg-black/70 px-1 text-[10px] text-white">Primary</span>
                                )}
                                <button type="button" className="absolute right-0 top-0 z-10 bg-black/60 text-white p-0.5" onClick={() => setCreateImages((prev) => prev.filter((_, idx) => idx !== i))}>
                                  <X size={12} />
                                </button>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={url} alt={f.name} className="h-full w-full object-cover cursor-zoom-in" onClick={() => window.open(url, '_blank')} />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t">
                      <button type="button" onClick={() => setShowCreate(false)} className="btn btn-outline">
                        Cancel
                      </button>
                      <button type="submit" disabled={saving} className="btn btn-primary inline-flex items-center gap-2">
                        {saving && <Loader2 size={14} className="animate-spin" />} Create
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {editing && (
              <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="w-full max-w-3xl rounded-2xl bg-card border shadow-2xl p-6 max-h-[92vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold inline-flex items-center gap-2">
                      Edit Catalog Item {loadingEdit && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
                    </h3>
                    <button
                      type="button"
                      onClick={closeEdit}
                      className="p-1 hover:bg-muted rounded-lg"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <form onSubmit={onUpdate} className="space-y-4">
                    <ProductFields
                      value={editForm}
                      onChange={setEditForm}
                      orphanLabels={editOrphanLabels}
                      organizations={organizations}
                      businessUnits={businessUnits}
                      taxCodes={taxCodes}
                      warehouses={warehouses}
                      onReloadTaxCodes={reloadTaxCodes}
                      classifications={classifications}
                      onQuickCreateClassification={quickCreateClassification}
                      variantCount={editVariants.length}
                      variantStock={editVariantStock}
                      lockMultiVariantStock={editVariants.length > 1}
                    />

                    <div className="border-t pt-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold inline-flex items-center gap-2">
                          <Tag size={16} /> Variants ({editVariants.length})
                        </h4>
                        <Link href="/catalog/variants" className="text-xs text-primary hover:underline">
                          Manage variants
                        </Link>
                      </div>
                      {editVariants.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No variants for this product yet.</p>
                      ) : (
                        <div className="rounded-lg border divide-y text-xs max-h-40 overflow-y-auto">
                          {editVariants.map((v) => {
                            const opts = [1, 2, 3]
                              .map((i) => {
                                const n = (v as any)[`option${i}Name`];
                                const val = (v as any)[`option${i}Value`];
                                return val ? `${n || `Option ${i}`}: ${val}` : null;
                              })
                              .filter(Boolean)
                              .join(', ');
                            return (
                              <Link
                                key={v.id}
                                href={`/catalog/variants?q=${encodeURIComponent(v.variantSku)}`}
                                className="flex items-center justify-between px-3 py-1.5 hover:bg-muted/50"
                                title="Open this variant"
                              >
                                <span className="font-mono text-primary underline-offset-2 hover:underline">{v.variantSku}</span>
                                <span className="text-muted-foreground truncate mx-2">{opts || v.name || '—'}</span>
                                <span className="capitalize">{v.status}</span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">Saving this product keeps all of its variants unchanged. Click a variant SKU to open it on the Variants screen.</p>
                    </div>

                    <div className="border-t pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold inline-flex items-center gap-2">
                          <ImageIcon size={16} /> Product images
                        </h4>
                        {canAddMedia && (
                        <label className="btn btn-outline text-xs inline-flex items-center gap-1 cursor-pointer">
                          {uploadingMedia ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                          Add images
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            disabled={uploadingMedia}
                            onChange={(e) => {
                              onUploadImages(e.target.files);
                              e.target.value = '';
                            }}
                          />
                        </label>
                        )}
                      </div>
                      {media.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          No images yet. Upload one or more images for this product.
                        </p>
                      ) : (
                        <div className="grid grid-cols-4 gap-2">
                          {media.map((m) => (
                            <div
                              key={m.id}
                              className="relative rounded-lg border overflow-hidden bg-muted/30 aspect-square"
                            >
                              <button
                                type="button"
                                className="h-full w-full"
                                onClick={() => setPreviewImageUrl(m.url)}
                                title="Preview image"
                              >
                                <MediaThumb url={m.url} alt={m.altText || ''} className="h-full w-full" />
                              </button>
                              {m.isPrimary && (
                                <span className="absolute top-1 left-1 rounded bg-black/70 text-white text-[10px] px-1.5 py-0.5 inline-flex items-center gap-0.5">
                                  <Star size={10} /> Primary
                                </span>
                              )}
                              {canDeleteMedia && (
                              <button
                                type="button"
                                onClick={() => onRemoveImage(m.id)}
                                className="absolute top-1 right-1 rounded bg-black/70 text-white p-1 hover:bg-red-600"
                                title="Mark for removal (saved on Update)"
                              >
                                <X size={12} />
                              </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {pendingMediaDeletes.length > 0 && (
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                          {pendingMediaDeletes.length} image(s) marked for removal — click Update to apply, or Cancel to keep them.
                        </p>
                      )}
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                      <button
                        type="button"
                        onClick={closeEdit}
                        className="btn btn-outline"
                      >
                        Cancel
                      </button>
                      <button type="submit" disabled={saving} className="btn btn-primary inline-flex items-center gap-2">
                        {saving && <Loader2 size={14} className="animate-spin" />} Update
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {confirmDel && (
              <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="w-full max-w-md rounded-2xl bg-card border shadow-2xl p-6">
                  <h3 className="text-lg font-semibold mb-2">Confirm Delete</h3>
                  <p className="text-sm text-muted-foreground mb-4">Delete “{confirmDel.name}”?</p>
                  <div className="flex justify-end gap-3">
                    <button type="button" onClick={() => setConfirmDel(null)} className="btn btn-outline">
                      Cancel
                    </button>
                    <button
                      type="button"
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
