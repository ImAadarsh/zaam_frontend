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
  deleteProductMedia
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
import Link from 'next/link';

type CatalogItem = {
  id: string;
  sku: string;
  name: string;
  description?: string | null;
  category?: string | null;
  subCategory?: string | null;
  brand?: string | null;
  uom?: string | null;
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
  openingQuantity?: number | null;
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
  category: string;
  subCategory: string;
  brand: string;
  uom: string;
  packSize: string;
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
  category: '',
  subCategory: '',
  brand: '',
  uom: '',
  packSize: '',
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
    category: str(item.category),
    subCategory: str(item.subCategory),
    brand: str(item.brand),
    uom: str(item.uom),
    packSize: str(item.packSize),
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

function ProductFields({
  value,
  onChange,
  includeOrg,
  organizations,
  businessUnits,
  taxCodes,
  warehouses,
  onReloadTaxCodes
}: {
  value: ProductForm;
  onChange: (next: ProductForm) => void;
  includeOrg?: boolean;
  organizations: any[];
  businessUnits: any[];
  taxCodes: any[];
  warehouses: WarehouseOption[];
  onReloadTaxCodes?: () => void;
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
          {field('Category', 'category')}
          {field('Sub-Category', 'subCategory')}
          {field('Brand / Manufacturer', 'brand')}
          {field('Unit of Measure (UOM)', 'uom', { placeholder: 'SET, PCS, BOX…' })}
          {field('Pack Size', 'packSize', { placeholder: '1, 12x330ml…' })}
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
          {field('Unit Cost Price', 'costPrice', { type: 'number', step: '0.0001' })}
          {field('Unit Selling Price', 'sellingPrice', { type: 'number', step: '0.0001' })}
          {field('Currency', 'currency', { maxLength: 3 })}
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
      </section>

      <section>
        <SectionTitle>Inventory &amp; Warehouse</SectionTitle>
        <div className="grid grid-cols-2 gap-4">
          {field('Opening Quantity', 'openingQuantity', { type: 'number' })}
          {field('Reorder Level', 'reorderLevel', { type: 'number' })}
          {field('Reorder Quantity', 'reorderQuantity', { type: 'number' })}
          <label className="text-sm">
            Warehouse / Location
            <select
              className="mt-1 select w-full"
              value={value.warehouseId}
              onChange={(e) => set({ warehouseId: e.target.value })}
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
        <p className="text-xs text-muted-foreground mt-2">
          Quantity and reorder values are saved on a stock row for the selected warehouse. Select a warehouse
          before setting opening quantity or other stock fields. Missing bins and suppliers are created
          automatically.
        </p>
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
          <label className="text-sm">
            Extra attributes (JSON key/value)
            <textarea
              className="mt-1 input w-full font-mono text-xs"
              rows={3}
              placeholder='{"colour":"black","hsCode":"1234.56"}'
              value={value.attributes}
              onChange={(e) => set({ attributes: e.target.value })}
            />
          </label>
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
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [editForm, setEditForm] = useState<ProductForm>(emptyForm);
  const [confirmDel, setConfirmDel] = useState<CatalogItem | null>(null);
  const [media, setMedia] = useState<any[]>([]);
  const [editOriginal, setEditOriginal] = useState<ProductForm | null>(null);
  const [editVariants, setEditVariants] = useState<NonNullable<CatalogItem['variants']>>([]);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [createImages, setCreateImages] = useState<File[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [saving, setSaving] = useState(false);

  async function refreshItems(organizationId?: string) {
    const isSuper = session?.user?.roles?.includes('SUPER_ADMIN');
    setItems(await loadAllCatalogItems(isSuper ? organizationId : (organizationId || session?.user?.organizationId)));
  }

  useEffect(() => {
    if (!hydrated || !hasAccess) return;
    if (!session?.accessToken) {
      router.replace('/login');
      return;
    }
    (async () => {
      try {
        const isSuper = session?.user?.roles?.includes('SUPER_ADMIN');
        const [itemsRes, orgsRes, taxCodesRes, warehousesRes] = await Promise.all([
          loadAllCatalogItems(isSuper ? undefined : session?.user?.organizationId).then((data) => ({ data })),
          listOrganizations(),
          listTaxCodes({ organizationId: session?.user?.organizationId }),
          listWarehouses({ limit: 200, status: 'active' }).catch(() => ({ data: [] as WarehouseOption[] }))
        ]);
        setItems(itemsRes.data || []);
        setOrganizations(orgsRes.data || []);
        setTaxCodes(taxCodesRes.data || []);
        setWarehouses(warehousesRes.data || []);
        if (session?.user?.organizationId) {
          setForm((prev) => ({ ...prev, organizationId: session.user.organizationId }));
          const busRes = await listBusinessUnits(session.user.organizationId).catch(() => ({ data: [] }));
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

  async function loadMedia(catalogItemId: string) {
    try {
      const res = await listProductMedia({ catalogItemId, type: 'image' });
      setMedia(res.data || []);
    } catch {
      setMedia([]);
    }
  }

  function buildPayload(f: ProductForm, original?: ProductForm | null) {
    let attributes: Record<string, any> | undefined;
    if (f.attributes.trim()) attributes = JSON.parse(f.attributes);
    else if (original?.attributes.trim()) attributes = {};
    const text = (key: keyof ProductForm) => {
      const v = (f[key] as string).trim();
      if (v) return v;
      return original && (original[key] as string).trim() ? '' : undefined;
    };
    const payload: Record<string, any> = {
      sku: f.sku,
      name: f.name,
      description: text('description'),
      category: text('category'),
      subCategory: text('subCategory'),
      brand: text('brand'),
      manufacturer: text('brand'),
      uom: text('uom'),
      packSize: text('packSize'),
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
      const payload = buildPayload(editForm, editOriginal);
      const res = await updateCatalogItem(editing.id, {
        businessUnitId: editForm.businessUnitId || (editOriginal?.businessUnitId ? '' : undefined),
        ...payload
      });
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

  async function onRemoveImage(id: string) {
    try {
      await deleteProductMedia(id);
      setMedia((prev) => prev.filter((m) => m.id !== id));
      toast.success('Image removed');
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message ?? 'Failed to remove image');
    }
  }

  function closeEdit() {
    setEditing(null);
    setEditOriginal(null);
    setEditVariants([]);
    setMedia([]);
  }

  async function openEdit(item: CatalogItem) {
    setEditing(item);
    const initial = formFromItem(item);
    setEditForm(initial);
    setEditOriginal(initial);
    setEditVariants(item.variants ?? []);
    loadMedia(item.id);
    setLoadingEdit(true);
    try {
      const res = await getCatalogItem(item.id);
      const fresh = res.data as CatalogItem;
      const hydratedForm = formFromItem(fresh);
      setEditing(fresh);
      setEditForm(hydratedForm);
      setEditOriginal(hydratedForm);
      setEditVariants(fresh.variants ?? []);
    } catch {
      toast.error('Could not refresh product details; showing list values');
    } finally {
      setLoadingEdit(false);
    }
  }

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
        header: 'Opening Qty',
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
        header: 'Unit Cost Price',
        cell: ({ row }) => (row.original.costPrice != null ? Number(row.original.costPrice).toFixed(2) : '—')
      },
      {
        accessorKey: 'sellingPrice',
        header: 'Unit Selling Price',
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

            <RichDataTable columns={columns} data={items} />

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
                      includeOrg
                      organizations={organizations}
                      businessUnits={businessUnits}
                      taxCodes={taxCodes}
                      warehouses={warehouses}
                      onReloadTaxCodes={reloadTaxCodes}
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
                      organizations={organizations}
                      businessUnits={businessUnits}
                      taxCodes={taxCodes}
                      warehouses={warehouses}
                      onReloadTaxCodes={reloadTaxCodes}
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
                              <div key={v.id} className="flex items-center justify-between px-3 py-1.5">
                                <span className="font-mono">{v.variantSku}</span>
                                <span className="text-muted-foreground truncate mx-2">{opts || v.name || '—'}</span>
                                <span className="capitalize">{v.status}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">Saving this product keeps all of its variants unchanged.</p>
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
                              <MediaThumb url={m.url} alt={m.altText || ''} className="h-full w-full" />
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
                              >
                                <X size={12} />
                              </button>
                              )}
                            </div>
                          ))}
                        </div>
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
