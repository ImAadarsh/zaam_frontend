'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import {
  previewInventoryExcelImport,
  executeInventoryExcelImport,
  listOrganizations,
  listBusinessUnits
} from '@/lib/api';
import { toast } from 'sonner';
import { useSession } from '@/hooks/use-session';
import { useRoleCheck } from '@/hooks/use-role-check';
import { SearchableSelect } from '@/components/searchable-select';
import {
  Upload,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Package2,
  Layers,
  Warehouse,
  Users,
  X,
  Download
} from 'lucide-react';

const TEMPLATE_URL = '/templates/Inventory_Import_Template.xlsx';

/** Turn API / network errors into short, actionable toast copy. */
function friendlyImportError(e: any, fallback: string): string {
  const status = e?.response?.status as number | undefined;
  const raw = String(e?.response?.data?.error?.message || e?.message || '').trim();
  if (status === 413 || /too large|payload/i.test(raw)) {
    return 'File is too large. Split the sheet or upload a smaller Excel file.';
  }
  if (status === 415 || /mime|content-type|not.*excel|spreadsheet/i.test(raw)) {
    return 'That file type is not supported. Upload an .xlsx or .xls Excel workbook.';
  }
  if (status === 400 && raw) {
    return raw.split('\n')[0].slice(0, 280);
  }
  if (status === 401 || status === 403) {
    return 'You do not have permission to import for this organisation.';
  }
  if (!e?.response) {
    return 'Could not reach the server. Check your connection and try again.';
  }
  return raw || fallback;
}

type PreviewRow = Record<string, unknown>;

type PreviewData = {
  mode?: 'legacy' | 'catalog_variant';
  rowCount: number;
  catalogCount?: number;
  variantCount?: number;
  catalogSample?: PreviewRow[];
  variantSample?: PreviewRow[];
  sample: PreviewRow[];
  categories: string[];
  warehouses: string[];
  suppliers: string[];
  warnings: string[];
  warningCount?: number;
};

function cell(row: PreviewRow, key: string, fallback = '-'): string {
  const v = row[key];
  if (v == null || v === '') return fallback;
  return String(v);
}

function formatOptions(row: PreviewRow): string {
  const parts = [
    row.option1Value,
    row.option2Value,
    row.option3Value
  ].filter((v) => v != null && String(v).trim());
  return parts.length ? parts.map(String).join(' / ') : '-';
}

type ImportResult = {
  productsCreated: number;
  productsUpdated: number;
  productsSkipped: number;
  variantsCreated: number;
  barcodesCreated: number;
  warehousesCreated: number;
  binsCreated: number;
  racksCreated?: number;
  suppliersCreated: number;
  stockItemsCreated: number;
  stockItemsUpdated: number;
  taxCodesCreated: number;
  errors: Array<{ sku: string; rowNumber: number; message: string }>;
};

function previewSummaryToast(data: PreviewData): string {
  const mode = data.mode || 'legacy';
  const catalog = data.catalogCount ?? data.rowCount;
  const variants = data.variantCount ?? 0;
  if (mode === 'catalog_variant') {
    return `Preview ready · ${catalog} catalog · ${variants} variant${variants === 1 ? '' : 's'}`;
  }
  return `Preview ready · ${catalog} product row(s)`;
}

export default function InventoryImportPage() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const { hasAccess } = useRoleCheck(['ADMIN', 'SUPER_ADMIN']);
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [businessUnits, setBusinessUnits] = useState<any[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [businessUnitId, setBusinessUnitId] = useState('');
  const [duplicateMode, setDuplicateMode] = useState<'skip' | 'update'>('skip');
  const [importInventory, setImportInventory] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const orgOptions = useMemo(
    () => organizations.map((o) => ({ value: String(o.id), label: o.name, searchText: o.name })),
    [organizations]
  );
  const buOptions = useMemo(
    () => [
      { value: '', label: 'None', searchText: 'none' },
      ...businessUnits.map((bu) => ({
        value: String(bu.id),
        label: bu.name,
        searchText: bu.name
      }))
    ],
    [businessUnits]
  );

  useEffect(() => {
    if (!hydrated) return;
    if (!session?.accessToken) {
      router.replace('/login');
      return;
    }
    if (!hasAccess) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const orgRes = await listOrganizations();
        setOrganizations(orgRes.data ?? []);
        const defaultOrg = session.user?.organizationId ?? orgRes.data?.[0]?.id ?? '';
        setOrganizationId(defaultOrg);
        if (defaultOrg) {
          const buRes = await listBusinessUnits(defaultOrg, { activeOnly: true }).catch(() => ({ data: [] }));
          setBusinessUnits(buRes.data ?? []);
          if (buRes.data?.[0]?.id) setBusinessUnitId(buRes.data[0].id);
        }
      } catch {
        toast.error('Failed to load organizations');
      } finally {
        setLoading(false);
      }
    })();
  }, [hydrated, session, hasAccess, router]);

  useEffect(() => {
    if (!organizationId) {
      setBusinessUnits([]);
      return;
    }
    listBusinessUnits(organizationId, { activeOnly: true })
      .then((res) => {
        setBusinessUnits(res.data ?? []);
        setBusinessUnitId((prev) => prev || res.data?.[0]?.id || '');
      })
      .catch(() => setBusinessUnits([]));
  }, [organizationId]);

  async function onPreview() {
    if (!file) {
      toast.error('Choose an Excel file first');
      return;
    }
    setPreviewing(true);
    setResult(null);
    try {
      const res = await previewInventoryExcelImport(file);
      setPreview(res.data);
      toast.success(previewSummaryToast(res.data));
    } catch (e: any) {
      toast.error(friendlyImportError(e, 'Could not read that Excel file. Check it is .xlsx/.xls and try again.'));
      setPreview(null);
    } finally {
      setPreviewing(false);
    }
  }

  async function onImport() {
    if (!file || !organizationId) {
      toast.error('File and organization are required');
      return;
    }
    setImporting(true);
    try {
      const res = await executeInventoryExcelImport(file, {
        organizationId,
        businessUnitId: businessUnitId || undefined,
        duplicateMode,
        importInventory
      });
      setPreview(res.data.preview as PreviewData);
      setResult(res.data.result);
      toast.success(
        `Imported · created ${res.data.result.productsCreated}, updated ${res.data.result.productsUpdated}`
      );
    } catch (e: any) {
      toast.error(friendlyImportError(e, 'Import failed. Fix the highlighted issues and try again.'));
    } finally {
      setImporting(false);
    }
  }

  if (!hydrated || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 lg:ml-[280px] p-8">
          <p className="text-muted-foreground">You do not have permission to import inventory.</p>
        </main>
      </div>
    );
  }

  const isCatalogVariant = preview?.mode === 'catalog_variant';
  // Prefer dedicated samples; fall back so stale APIs that only send `sample` still render rows.
  const catalogRows = preview?.catalogSample?.length
    ? preview.catalogSample
    : preview?.sample?.length
      ? isCatalogVariant
        ? preview.sample.filter((r) => r.productOnly === true || r.sheetName === 'Catalog')
        : preview.sample
      : [];
  const variantRows = preview?.variantSample?.length
    ? preview.variantSample
    : preview?.sample?.length
      ? isCatalogVariant
        ? preview.sample.filter((r) => r.productOnly !== true && r.sheetName !== 'Catalog')
        : preview.sample
      : [];

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 lg:ml-[280px]">
        <Header title="Catalog · Inventory Import" />
        <div className="p-6 space-y-6 max-w-6xl">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">Import Inventory Excel</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Prefer the two-sheet <strong>Catalog</strong> + <strong>Variant</strong> workbook. Legacy single-sheet files still work.
              </p>
            </div>
            <a
              href={TEMPLATE_URL}
              download
              className="btn btn-outline inline-flex items-center gap-2 text-sm"
            >
              <Download size={16} />
              Download sample Excel
            </a>
          </div>

          <div className="rounded-xl border bg-card p-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm">
                Organization *
                {session?.user?.roles?.includes('SUPER_ADMIN') ? (
                  <div className="mt-1">
                    <SearchableSelect
                      value={organizationId}
                      onChange={setOrganizationId}
                      options={orgOptions}
                      placeholder="Search organisation…"
                      emptyLabel="Select organisation…"
                      required
                    />
                  </div>
                ) : (
                  <input
                    className="mt-1 input w-full"
                    readOnly
                    value={organizations.find((o) => String(o.id) === String(organizationId))?.name || 'Your organisation'}
                  />
                )}
              </label>
              <label className="text-sm">
                Business Unit
                <div className="mt-1">
                  <SearchableSelect
                    value={businessUnitId}
                    onChange={setBusinessUnitId}
                    options={buOptions}
                    placeholder="Search business unit…"
                    emptyLabel="None"
                  />
                </div>
              </label>
              <label className="text-sm">
                Duplicate SKUs
                <select
                  className="mt-1 select w-full"
                  value={duplicateMode}
                  onChange={(e) => setDuplicateMode(e.target.value as 'skip' | 'update')}
                >
                  <option value="skip">Skip existing</option>
                  <option value="update">Update existing</option>
                </select>
              </label>
              <label className="text-sm flex items-end gap-2 pb-2">
                <input
                  type="checkbox"
                  checked={importInventory}
                  onChange={(e) => setImportInventory(e.target.checked)}
                />
                Also import warehouse / stock (qty, reorder, bin, lot, expiry)
              </label>
            </div>

            <div
              className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                file ? 'border-primary/50 bg-primary/5' : 'border-muted-foreground/25'
              }`}
            >
              <FileSpreadsheet className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm font-medium mb-1">
                {file ? file.name : 'Drop inventory Excel here or choose a file'}
              </p>
              <p className="text-xs text-muted-foreground mb-1">
                Two-sheet format: <strong>Catalog</strong> (SKU, Product Name, Category, Brand…) then <strong>Variant</strong> (Catalog SKU, Variant SKU, Options, Warehouse, Qty, Bin, Rack…).
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                Not sure of the format?{' '}
                <a href={TEMPLATE_URL} download className="underline text-primary">
                  Download the sample Excel
                </a>{' '}
                (Catalog + Variant sheets + Instructions). Dates are UK day/month: dd/mm/yyyy.
              </p>
              <input
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="mx-auto block text-sm"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setPreview(null);
                  setResult(null);
                }}
              />
              {file && (
                <button
                  type="button"
                  className="mt-3 text-xs text-muted-foreground underline inline-flex items-center gap-1"
                  onClick={() => {
                    setFile(null);
                    setPreview(null);
                    setResult(null);
                  }}
                >
                  <X size={12} /> Clear file
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!file || previewing}
                onClick={onPreview}
                className="btn btn-outline inline-flex items-center gap-2"
              >
                {previewing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                Preview
              </button>
              <button
                type="button"
                disabled={!file || !organizationId || importing}
                onClick={onImport}
                className="btn btn-primary inline-flex items-center gap-2"
              >
                {importing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                Import into system
              </button>
            </div>
          </div>

          {preview && (
            <div className="rounded-xl border bg-card p-5 space-y-5">
              <h2 className="font-semibold">Preview</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border p-3 flex items-center gap-3">
                  <Package2 className="text-primary" size={20} />
                  <div>
                    <div className="text-lg font-semibold">{preview.catalogCount ?? preview.rowCount}</div>
                    <div className="text-xs text-muted-foreground">
                      {isCatalogVariant ? 'Catalog products' : 'Product rows'}
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border p-3 flex items-center gap-3">
                  <Layers className="text-primary" size={20} />
                  <div>
                    <div className="text-lg font-semibold">
                      {isCatalogVariant ? (preview.variantCount ?? 0) : (preview.variantCount ?? preview.rowCount)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {isCatalogVariant ? 'Variants' : 'Variant / stock rows'}
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border p-3 flex items-center gap-3">
                  <Warehouse className="text-primary" size={20} />
                  <div>
                    <div className="text-lg font-semibold">{preview.warehouses.length}</div>
                    <div className="text-xs text-muted-foreground">Warehouses</div>
                  </div>
                </div>
                <div className="rounded-lg border p-3 flex items-center gap-3">
                  <Users className="text-primary" size={20} />
                  <div>
                    <div className="text-lg font-semibold">{preview.suppliers.length}</div>
                    <div className="text-xs text-muted-foreground">Suppliers</div>
                  </div>
                </div>
              </div>

              {preview.warnings?.length > 0 && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <div className="font-medium flex items-center gap-1 mb-1">
                    <AlertTriangle size={14} /> Warnings
                    {(preview.warningCount ?? preview.warnings.length) > 10 &&
                      ` (showing 10 of ${preview.warningCount ?? preview.warnings.length})`}
                  </div>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {preview.warnings.slice(0, 10).map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Catalog table first */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">
                  Catalog
                  <span className="ml-2 font-normal text-muted-foreground">
                    {preview.catalogCount ?? catalogRows.length} row(s)
                    {catalogRows.length < (preview.catalogCount ?? 0) ? ` · showing ${catalogRows.length}` : ''}
                  </span>
                </h3>
                <div className="overflow-auto rounded-lg border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-3 py-2 text-left">SKU</th>
                        <th className="px-3 py-2 text-left">Product Name</th>
                        <th className="px-3 py-2 text-left">Category</th>
                        <th className="px-3 py-2 text-left">Brand</th>
                        <th className="px-3 py-2 text-left">UOM</th>
                        <th className="px-3 py-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {catalogRows.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-3 py-4 text-center text-muted-foreground">
                            No catalog rows
                          </td>
                        </tr>
                      ) : (
                        catalogRows.map((row, i) => (
                          <tr key={i} className="border-t">
                            <td className="px-3 py-2 font-mono">{cell(row, 'sku')}</td>
                            <td className="px-3 py-2 max-w-[220px] truncate">{cell(row, 'name')}</td>
                            <td className="px-3 py-2">{cell(row, 'category')}</td>
                            <td className="px-3 py-2">{cell(row, 'brand')}</td>
                            <td className="px-3 py-2">{cell(row, 'uom')}</td>
                            <td className="px-3 py-2 capitalize">{cell(row, 'status')}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Variants table below */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">
                  Variants
                  <span className="ml-2 font-normal text-muted-foreground">
                    {isCatalogVariant ? (preview.variantCount ?? variantRows.length) : (preview.variantCount ?? catalogRows.length)} row(s)
                    {isCatalogVariant && variantRows.length < (preview.variantCount ?? 0)
                      ? ` · showing ${variantRows.length}`
                      : ''}
                  </span>
                </h3>
                <div className="overflow-auto rounded-lg border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-3 py-2 text-left">Catalog SKU</th>
                        <th className="px-3 py-2 text-left">Variant SKU</th>
                        <th className="px-3 py-2 text-left">Variant Name</th>
                        <th className="px-3 py-2 text-left">Options</th>
                        <th className="px-3 py-2 text-left">Barcode</th>
                        <th className="px-3 py-2 text-left">Warehouse</th>
                        <th className="px-3 py-2 text-left">Bin</th>
                        <th className="px-3 py-2 text-left">Rack</th>
                        <th className="px-3 py-2 text-right">Qty</th>
                        <th className="px-3 py-2 text-right">Cost</th>
                        <th className="px-3 py-2 text-right">Selling</th>
                        <th className="px-3 py-2 text-right">Reorder</th>
                      </tr>
                    </thead>
                    <tbody>
                      {variantRows.length === 0 ? (
                        <tr>
                          <td colSpan={12} className="px-3 py-4 text-center text-muted-foreground">
                            No variant rows
                          </td>
                        </tr>
                      ) : (
                        variantRows.map((row, i) => (
                          <tr key={i} className="border-t">
                            <td className="px-3 py-2 font-mono">
                              {cell(row, 'catalogSku', cell(row, 'sku'))}
                            </td>
                            <td className="px-3 py-2 font-mono">
                              {cell(row, 'variantSku', cell(row, 'sku'))}
                            </td>
                            <td className="px-3 py-2 max-w-[180px] truncate">{cell(row, 'name')}</td>
                            <td className="px-3 py-2 max-w-[140px] truncate">{formatOptions(row)}</td>
                            <td className="px-3 py-2 font-mono">{cell(row, 'barcode')}</td>
                            <td className="px-3 py-2 max-w-[140px] truncate">{cell(row, 'warehouseName')}</td>
                            <td className="px-3 py-2 font-mono">{cell(row, 'binCode')}</td>
                            <td className="px-3 py-2 font-mono">{cell(row, 'rackCode')}</td>
                            <td className="px-3 py-2 text-right">{cell(row, 'openingQuantity')}</td>
                            <td className="px-3 py-2 text-right">{cell(row, 'costPrice')}</td>
                            <td className="px-3 py-2 text-right">{cell(row, 'sellingPrice')}</td>
                            <td className="px-3 py-2 text-right">{cell(row, 'reorderLevel')}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {result && (
            <div className="rounded-xl border bg-card p-5 space-y-3">
              <h2 className="font-semibold flex items-center gap-2">
                <CheckCircle2 className="text-green-600" size={18} /> Import result
              </h2>
              <div className="grid gap-2 sm:grid-cols-3 text-sm">
                <div>Products created: <strong>{result.productsCreated}</strong></div>
                <div>Products updated: <strong>{result.productsUpdated}</strong></div>
                <div>Products skipped: <strong>{result.productsSkipped}</strong></div>
                <div>Variants created: <strong>{result.variantsCreated}</strong></div>
                <div>Barcodes created: <strong>{result.barcodesCreated}</strong></div>
                <div>Stock created: <strong>{result.stockItemsCreated}</strong></div>
                <div>Stock updated: <strong>{result.stockItemsUpdated}</strong></div>
                <div>Warehouses created: <strong>{result.warehousesCreated}</strong></div>
                <div>Suppliers created: <strong>{result.suppliersCreated}</strong></div>
                <div>Bins created: <strong>{result.binsCreated}</strong></div>
                {result.racksCreated != null && (
                  <div>Racks created: <strong>{result.racksCreated}</strong></div>
                )}
                <div>Tax codes created: <strong>{result.taxCodesCreated}</strong></div>
                <div>Errors: <strong>{result.errors.length}</strong></div>
              </div>
              {result.errors.length > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 max-h-40 overflow-auto">
                  {result.errors.slice(0, 30).map((e, i) => (
                    <div key={i}>Row {e.rowNumber} · {e.sku}: {e.message}</div>
                  ))}
                </div>
              )}
              <button
                type="button"
                className="btn btn-outline text-sm"
                onClick={() => router.push('/catalog/items')}
              >
                Open Catalog Items
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
