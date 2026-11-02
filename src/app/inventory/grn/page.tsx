'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { listGRN, createGRN, updateGRN, getGRN, listWarehouses, listASN, getASN, listVariants } from '@/lib/api';
import { toast } from 'sonner';
import { RichDataTable } from '@/components/rich-data-table';
import { useSession } from '@/hooks/use-session';
import { useRoleCheck } from '@/hooks/use-role-check';
import { useApiAccess } from '@/hooks/use-api-access';
import { ColumnDef } from '@tanstack/react-table';
import { FloatingDropdown } from '@/components/inventory/floating-dropdown';
import { Eye, CheckCircle2, Plus, X, Receipt, Search } from 'lucide-react';
import { activeWarehouses } from '@/components/inventory/location-status-badge';

type GRN = {
  id: string;
  grnNumber: string;
  receivedDate: string;
  status: string;
  warehouse?: { id: string; name: string };
  asn?: { id: string; asnNumber: string } | null;
  receivedBy?: { id: string; name: string };
  notes?: string;
  createdAt?: string;
  lines?: Array<{
    id: string;
    variant?: { id: string; variantSku?: string; catalogItem?: { name?: string }; name?: string };
    quantityExpected: number;
    quantityReceived: number;
    quantityRejected: number;
    qaStatus: string;
    lotNumber?: string;
    expiryDate?: string;
  }>;
  [key: string]: any;
};

export default function GRNPage() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const { hasAccess } = useRoleCheck(['ADMIN', 'SUPER_ADMIN', 'WAREHOUSE_MANAGER']);
  const { can } = useApiAccess();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<GRN[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [asns, setAsns] = useState<any[]>([]);
  const [variants, setVariants] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<GRN | null>(null);
  const [viewingGrn, setViewingGrn] = useState<GRN | null>(null);
  const [loadingViewGrn, setLoadingViewGrn] = useState(false);
  
  const [form, setForm] = useState({
    asnId: '',
    warehouseId: '',
    grnNumber: '',
    receivedDate: new Date().toISOString().split('T')[0],
    status: 'approved' as 'draft' | 'qa_pending' | 'approved' | 'rejected' | 'put_away',
    notes: '',
    lines: [] as Array<{
      purchaseOrderLineId?: string;
      variantId: string;
      variantLabel?: string;
      quantityExpected: number;
      quantityReceived: number;
      quantityRejected?: number;
      lotNumber?: string;
      expiryDate?: string;
      qaStatus?: 'pending' | 'passed' | 'failed' | 'quarantine';
    }>
  });

  const [variantSearch, setVariantSearch] = useState('');
  const [showVariantDropdown, setShowVariantDropdown] = useState(false);
  const [currentLineIndex, setCurrentLineIndex] = useState<number | null>(null);
  const [variantAnchor, setVariantAnchor] = useState<HTMLElement | null>(null);
  const [asnLinesLoading, setAsnLinesLoading] = useState(false);
  /** Tracks which ASN the current lines were loaded from (so a change reloads). */
  const [linesSourceAsnId, setLinesSourceAsnId] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated || !hasAccess) return;
    if (!session?.accessToken) {
      router.replace('/login');
      return;
    }
    loadData();
  }, [hydrated, hasAccess, router, session?.accessToken]);

  async function loadData() {
    try {
      setLoading(true);
      // Receivable into GRN: shipment open or mid-receive. Includes `completed` so a
      // finished ASN can still be linked when no GRN was booked yet (common mis-label of "done").
      // Excludes pending (not shipped) and cancelled. API accepts comma-separated statuses.
      const receivableAsnStatuses = 'in_transit,arrived,receiving,completed';
      const [grnRes, warehousesRes, asnsRes, variantsRes] = await Promise.all([
        listGRN({ organizationId: session?.user?.organizationId }),
        listWarehouses(),
        listASN({ organizationId: session?.user?.organizationId, status: receivableAsnStatuses }),
        listVariants({ status: 'active' })
      ]);
      setItems(grnRes.data || []);
      setWarehouses(warehousesRes.data || []);
      setAsns(asnsRes.data || []);
      setVariants(variantsRes.data || []);
    } catch (e: any) {
      toast.error('Failed to load GRN');
    } finally {
      setLoading(false);
    }
  }

  function addLine() {
    setForm(prev => ({
      ...prev,
      lines: [...prev.lines, { variantId: '', quantityExpected: 0, quantityReceived: 0, quantityRejected: 0, qaStatus: 'pending' }]
    }));
  }

  function removeLine(index: number) {
    setForm(prev => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== index)
    }));
  }

  function updateLine(index: number, field: string, value: any) {
    setForm(prev => ({
      ...prev,
      lines: prev.lines.map((line, i) => i === index ? { ...line, [field]: value } : line)
    }));
  }

  function lineVariantLabel(line: { variantId: string; variantLabel?: string }) {
    if (line.variantLabel) return line.variantLabel;
    const v = variants.find(x => String(x.id) === String(line.variantId));
    if (!v) return line.variantId ? `Variant #${line.variantId}` : '';
    return v.variantSku || v.catalogItem?.name || '';
  }

  /** Pull ASN (PO) lines into the GRN form. Changing ASN reloads; clearing leaves manual mode. */
  async function loadLinesFromAsn(asnId: string) {
    if (!asnId) {
      setLinesSourceAsnId(null);
      setForm(prev => ({ ...prev, asnId: '', lines: [] }));
      return;
    }
    try {
      setAsnLinesLoading(true);
      const res = await getASN(asnId);
      const asn = res.data;
      const asnWh = asn?.warehouse?.id || asn?.warehouseId;
      const rawLines: any[] = Array.isArray(asn?.lines) ? asn.lines : [];
      const mapped = rawLines
        .filter((l: any) => l?.variantId || l?.variant?.id)
        .map((l: any) => {
          const variantId = String(l.variantId || l.variant?.id);
          const expected = Number(l.quantityExpected ?? l.quantityRemaining ?? l.quantityOrdered ?? 0) || 0;
          const sku = l.variant?.variantSku || '';
          const name = l.variant?.catalogItem?.name || l.variant?.name || '';
          return {
            purchaseOrderLineId: l.purchaseOrderLineId ? String(l.purchaseOrderLineId) : undefined,
            variantId,
            variantLabel: [sku, name].filter(Boolean).join(' — ') || undefined,
            quantityExpected: expected,
            quantityReceived: expected,
            quantityRejected: 0,
            qaStatus: 'pending' as const
          };
        });

      setForm(prev => ({
        ...prev,
        asnId: String(asnId),
        warehouseId: asnWh ? String(asnWh) : prev.warehouseId,
        lines: mapped
      }));
      setLinesSourceAsnId(String(asnId));

      if (mapped.length === 0) {
        toast.message('ASN has no linked PO lines — add GRN lines manually');
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Failed to load ASN lines');
      setForm(prev => ({ ...prev, asnId: String(asnId) }));
      setLinesSourceAsnId(null);
    } finally {
      setAsnLinesLoading(false);
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.warehouseId || !form.grnNumber || !form.receivedDate || form.lines.length === 0) {
      toast.error('Please fill in required fields and add at least one line item');
      return;
    }
    if (form.lines.some(l => !l.variantId)) {
      toast.error('Every line needs a variant');
      return;
    }
    try {
      const payload: any = {
        organizationId: session?.user?.organizationId,
        warehouseId: form.warehouseId,
        grnNumber: form.grnNumber,
        receivedDate: form.receivedDate,
        receivedById: session?.user?.id,
        status: form.status,
        lines: form.lines.map(line => {
          const row: any = {
            variantId: line.variantId,
            quantityExpected: line.quantityExpected,
            quantityReceived: line.quantityReceived,
            quantityRejected: line.quantityRejected || 0,
            lotNumber: line.lotNumber || '',
            expiryDate: line.expiryDate || '',
            qaStatus: line.qaStatus || 'pending'
          };
          if (line.purchaseOrderLineId) row.purchaseOrderLineId = line.purchaseOrderLineId;
          return row;
        })
      };
      if (form.asnId) payload.asnId = form.asnId;
      if (form.notes) payload.notes = form.notes;

      const res = await createGRN(payload);
      setItems(prev => [res.data, ...prev]);
      setShowCreate(false);
      resetForm();
      toast.success(
        form.status === 'approved' || form.status === 'put_away'
          ? 'GRN created — stock updated for received quantities'
          : 'GRN created'
      );
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Failed to create GRN');
    }
  }

  async function handleOpenGrn(grn: GRN) {
    setViewingGrn(grn);
    try {
      setLoadingViewGrn(true);
      const res = await getGRN(grn.id);
      if (res?.data) {
        setViewingGrn(res.data);
      }
    } catch (e: any) {
      // keep existing grn data if getGRN fails
    } finally {
      setLoadingViewGrn(false);
    }
  }

  function resetForm() {
    setForm({
      asnId: '',
      warehouseId: '',
      grnNumber: '',
      receivedDate: new Date().toISOString().split('T')[0],
      status: 'approved',
      notes: '',
      lines: []
    });
    setLinesSourceAsnId(null);
    setAsnLinesLoading(false);
  }

  const variantQuery = variantSearch.trim().toLowerCase();
  const filteredVariants = variants.filter(v =>
    !variantQuery ||
    v.variantSku?.toLowerCase().includes(variantQuery) ||
    v.name?.toLowerCase().includes(variantQuery) ||
    v.catalogItem?.name?.toLowerCase().includes(variantQuery)
  );

  function selectVariantForLine(variant: any, lineIndex: number) {
    setForm(prev => ({
      ...prev,
      lines: prev.lines.map((line, i) =>
        i === lineIndex
          ? {
              ...line,
              variantId: String(variant.id),
              variantLabel: [variant.variantSku, variant.catalogItem?.name || variant.name].filter(Boolean).join(' — ') || undefined,
              purchaseOrderLineId: undefined
            }
          : line
      )
    }));
    setVariantSearch('');
    setShowVariantDropdown(false);
    setCurrentLineIndex(null);
  }

  const columns = useMemo<ColumnDef<GRN>[]>(() => [
    {
      accessorKey: 'grnNumber',
      header: 'GRN Number',
      cell: ({ row }) => (
        <button
          onClick={() => handleOpenGrn(row.original)}
          className="flex items-center gap-2 font-medium text-foreground hover:text-primary transition-colors group text-left"
          title="Click to view GRN details"
        >
          <Receipt size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
          <span className="font-semibold underline-offset-2 group-hover:underline">{row.original.grnNumber}</span>
        </button>
      )
    },
    {
      accessorKey: 'warehouse.name',
      header: 'Warehouse',
      cell: ({ row }) => <span className="text-sm">{row.original.warehouse?.name || 'N/A'}</span>
    },
    {
      accessorKey: 'asn.asnNumber',
      header: 'ASN',
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.asn?.asnNumber || '—'}</span>
    },
    {
      accessorKey: 'receivedDate',
      header: 'Received Date',
      cell: ({ row }) => <span className="text-sm">{new Date(row.original.receivedDate).toLocaleDateString()}</span>
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.original.status || 'approved';
        const colors: Record<string, string> = {
          draft: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
          qa_pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300',
          approved: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
          rejected: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
          put_away: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
        };
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || colors.approved}`}>
            {status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </span>
        );
      }
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <button 
            onClick={() => handleOpenGrn(row.original)} 
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-muted hover:bg-muted/80 rounded border border-border text-foreground transition-colors"
            title="Open GRN Details"
          >
            <Eye className="h-3.5 w-3.5 text-[#D4A017]" />
            <span>Open</span>
          </button>
        </div>
      )
    }
  ], []);

  if (!hydrated || loading) {
    return (
      <div className="min-h-screen app-surface">
        <Sidebar />
        <div className="flex flex-col overflow-hidden lg:ml-[280px]">
          <Header title="Inventory · GRN" />
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
          <Header title="Inventory · GRN" />
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
        <Header title="Inventory · GRN" />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold">Goods Receipt Notes</h1>
                <p className="text-muted-foreground mt-1">Record received goods and create stock items</p>
              </div>
              <button
                onClick={() => {
                  setShowCreate(true);
                  resetForm();
                }}
                className="flex items-center gap-2 px-4 py-2 bg-[#D4A017] text-white rounded hover:bg-[#B89015] transition-colors"
              >
                <Plus className="h-4 w-4" />
                Create GRN
              </button>
            </div>

            <div className="rounded-2xl border border-border bg-card">
              <RichDataTable
                columns={columns}
                data={items}
                searchPlaceholder="Search GRN..."
                emptyMessage="No goods receipts yet. Receive against an ASN to book stock into a warehouse."
              />
            </div>

            {/* Create Modal */}
            {showCreate && (
              <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="w-full max-w-4xl rounded-2xl bg-card shadow-2xl border border-border p-6 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Create GRN</h3>
                    <button onClick={() => { setShowCreate(false); resetForm(); }} className="p-1 hover:bg-muted rounded-lg">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <form onSubmit={onCreate} className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">GRN Number <span className="text-destructive">*</span></label>
                        <input
                          type="text"
                          value={form.grnNumber}
                          onChange={e => setForm(prev => ({ ...prev, grnNumber: e.target.value }))}
                          className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Warehouse <span className="text-destructive">*</span></label>
                        <select
                          value={form.warehouseId}
                          onChange={e => {
                            const warehouseId = e.target.value;
                            const selectedAsn = asns.find(a => String(a.id) === String(form.asnId));
                            const asnMatchesWh = selectedAsn && String(selectedAsn.warehouse?.id || selectedAsn.warehouseId) === warehouseId;
                            if (!asnMatchesWh && form.asnId) {
                              setLinesSourceAsnId(null);
                              setForm(prev => ({ ...prev, warehouseId, asnId: '', lines: [] }));
                            } else {
                              setForm(prev => ({ ...prev, warehouseId }));
                            }
                          }}
                          className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                          required
                        >
                          <option value="">Select warehouse...</option>
                          {activeWarehouses(warehouses).map(w => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">ASN</label>
                        <select
                          value={form.asnId}
                          onChange={e => {
                            const asnId = e.target.value;
                            if (!asnId) {
                              void loadLinesFromAsn('');
                              return;
                            }
                            if (asnId !== linesSourceAsnId) {
                              void loadLinesFromAsn(asnId);
                            }
                          }}
                          disabled={asnLinesLoading}
                          className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <option value="">None (manual lines)</option>
                          {asns
                            .filter(asn => !form.warehouseId || String(asn.warehouse?.id || asn.warehouseId) === String(form.warehouseId))
                            .map(asn => (
                              <option key={asn.id} value={asn.id}>
                                {asn.asnNumber}{asn.status ? ` (${asn.status.replace(/_/g, ' ')})` : ''}
                              </option>
                            ))}
                        </select>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Selecting an ASN loads its PO lines into Line Items (expected = remaining, received = expected, rejected = 0). Changing ASN reloads lines.
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Received Date <span className="text-destructive">*</span></label>
                        <input
                          type="date"
                          value={form.receivedDate}
                          onChange={e => setForm(prev => ({ ...prev, receivedDate: e.target.value }))}
                          className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Status</label>
                        <div className="flex items-center gap-2 px-3 py-2 border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/40 rounded-lg text-green-700 dark:text-green-300 font-medium text-sm">
                          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                          <span>Approved (Auto-updates stock)</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Notes</label>
                      <textarea
                        value={form.notes}
                        onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                        className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        rows={2}
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium">Line Items <span className="text-destructive">*</span></label>
                        <button type="button" onClick={addLine} className="text-sm text-primary hover:underline" disabled={asnLinesLoading}>
                          + Add Line
                        </button>
                      </div>
                      {asnLinesLoading && (
                        <p className="text-sm text-muted-foreground mb-2">Loading ASN lines…</p>
                      )}
                      {!asnLinesLoading && form.lines.length === 0 && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {form.asnId
                            ? 'No lines on this ASN — use + Add Line for a manual receipt.'
                            : 'Select an ASN to auto-fill, or + Add Line for a manual receipt.'}
                        </p>
                      )}
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {form.lines.map((line, index) => (
                          <div key={index} className="p-3 border border-border rounded-lg bg-muted/50">
                            <div className="flex items-start justify-between mb-2">
                              <span className="text-sm font-medium">Line {index + 1}</span>
                              <button type="button" onClick={() => removeLine(index)} className="text-red-500 hover:text-red-700">
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                            <div className="grid grid-cols-5 gap-2">
                              <div className="relative col-span-2">
                                <div className="flex items-center gap-2">
                                  <Search className="absolute left-2 h-4 w-4 text-muted-foreground" />
                                  <input
                                    type="text"
                                    placeholder="Search variant..."
                                    value={line.variantId ? lineVariantLabel(line) : (currentLineIndex === index ? variantSearch : '')}
                                    onChange={e => {
                                      if (line.variantId) {
                                        updateLine(index, 'variantId', '');
                                        updateLine(index, 'variantLabel', '');
                                        updateLine(index, 'purchaseOrderLineId', undefined);
                                      }
                                      setVariantSearch(e.target.value);
                                      setShowVariantDropdown(true);
                                      setCurrentLineIndex(index);
                                      setVariantAnchor(e.currentTarget);
                                    }}
                                    onFocus={e => {
                                      if (currentLineIndex !== index) setVariantSearch('');
                                      setShowVariantDropdown(true);
                                      setCurrentLineIndex(index);
                                      setVariantAnchor(e.currentTarget);
                                    }}
                                    className="w-full pl-8 pr-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                                  />
                                </div>
                                <FloatingDropdown
                                  anchor={variantAnchor}
                                  open={showVariantDropdown && currentLineIndex === index}
                                  onClose={() => { setShowVariantDropdown(false); setCurrentLineIndex(null); }}
                                >
                                  {filteredVariants.length === 0 ? (
                                    <div className="px-3 py-2 text-sm text-muted-foreground">No matching variants</div>
                                  ) : (
                                    filteredVariants.slice(0, 200).map(variant => (
                                      <button
                                        key={variant.id}
                                        type="button"
                                        onClick={() => selectVariantForLine(variant, index)}
                                        className="w-full text-left px-3 py-2 hover:bg-muted transition-colors border-b border-border last:border-0 text-sm"
                                      >
                                        <div className="font-medium">{variant.variantSku}</div>
                                        <div className="text-xs text-muted-foreground">{variant.catalogItem?.name || variant.name || ''}</div>
                                      </button>
                                    ))
                                  )}
                                </FloatingDropdown>
                              </div>
                              <input
                                type="number"
                                placeholder="Expected"
                                value={line.quantityExpected || ''}
                                onChange={e => updateLine(index, 'quantityExpected', parseInt(e.target.value) || 0)}
                                className="px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                                min="0"
                              />
                              <input
                                type="number"
                                placeholder="Received"
                                value={line.quantityReceived || ''}
                                onChange={e => updateLine(index, 'quantityReceived', parseInt(e.target.value) || 0)}
                                className="px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                                min="0"
                              />
                              <input
                                type="number"
                                placeholder="Rejected"
                                value={line.quantityRejected || ''}
                                onChange={e => updateLine(index, 'quantityRejected', parseInt(e.target.value) || 0)}
                                className="px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                                min="0"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-4">
                      <button type="submit" className="px-4 py-2 bg-[#D4A017] text-white rounded hover:bg-[#B89015] transition-colors">
                        Create
                      </button>
                      <button 
                        type="button" 
                        onClick={() => { setShowCreate(false); resetForm(); }} 
                        className="px-4 py-2 bg-muted rounded hover:bg-muted/80 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* View / Open GRN Modal */}
            {viewingGrn && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="w-full max-w-4xl rounded-2xl bg-card shadow-2xl border border-border p-6 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
                  {/* Header */}
                  <div className="flex items-center justify-between pb-4 border-b border-border">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                        <Receipt className="h-6 w-6 text-[#D4A017]" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xl font-bold">{viewingGrn.grnNumber}</h3>
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300 border border-green-200 dark:border-green-800">
                            {viewingGrn.status ? viewingGrn.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Approved'}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Goods Receipt Note Details
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setViewingGrn(null)}
                      className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Body */}
                  <div className="flex-1 overflow-y-auto py-4 space-y-5">
                    {/* Key Info Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="p-3 rounded-lg border border-border bg-muted/40">
                        <div className="text-xs font-medium text-muted-foreground uppercase">Warehouse</div>
                        <div className="text-sm font-semibold mt-1">{viewingGrn.warehouse?.name || 'N/A'}</div>
                      </div>
                      <div className="p-3 rounded-lg border border-border bg-muted/40">
                        <div className="text-xs font-medium text-muted-foreground uppercase">ASN Reference</div>
                        <div className="text-sm font-semibold mt-1">{viewingGrn.asn?.asnNumber || '— (Manual)'}</div>
                      </div>
                      <div className="p-3 rounded-lg border border-border bg-muted/40">
                        <div className="text-xs font-medium text-muted-foreground uppercase">Received Date</div>
                        <div className="text-sm font-semibold mt-1">
                          {viewingGrn.receivedDate ? new Date(viewingGrn.receivedDate).toLocaleDateString() : '—'}
                        </div>
                      </div>
                      <div className="p-3 rounded-lg border border-border bg-muted/40">
                        <div className="text-xs font-medium text-muted-foreground uppercase">Received By</div>
                        <div className="text-sm font-semibold mt-1">{viewingGrn.receivedBy?.name || '—'}</div>
                      </div>
                    </div>

                    {viewingGrn.notes && (
                      <div className="p-3 rounded-lg border border-border bg-muted/30 text-sm">
                        <span className="font-medium text-muted-foreground">Notes: </span>
                        <span className="text-foreground">{viewingGrn.notes}</span>
                      </div>
                    )}

                    {/* Lines Table */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold">
                          Received Line Items ({viewingGrn.lines?.length || 0})
                        </h4>
                        {loadingViewGrn && <span className="text-xs text-muted-foreground animate-pulse">Loading lines…</span>}
                      </div>

                      <div className="border border-border rounded-lg overflow-hidden">
                        <table className="w-full text-sm text-left">
                          <thead className="bg-muted/70 text-xs font-semibold text-muted-foreground uppercase border-b border-border">
                            <tr>
                              <th className="px-4 py-2.5">#</th>
                              <th className="px-4 py-2.5">Item / Variant</th>
                              <th className="px-4 py-2.5 text-right">Expected</th>
                              <th className="px-4 py-2.5 text-right">Received</th>
                              <th className="px-4 py-2.5 text-right">Rejected</th>
                              <th className="px-4 py-2.5 text-center">QA Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {(!viewingGrn.lines || viewingGrn.lines.length === 0) ? (
                              <tr>
                                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                                  {loadingViewGrn ? 'Loading line items...' : 'No line items recorded for this GRN.'}
                                </td>
                              </tr>
                            ) : (
                              viewingGrn.lines.map((line, idx) => {
                                const sku = line.variant?.variantSku || '—';
                                const name = line.variant?.catalogItem?.name || line.variant?.name || '';
                                return (
                                  <tr key={line.id || idx} className="hover:bg-muted/30">
                                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{idx + 1}</td>
                                    <td className="px-4 py-2.5">
                                      <div className="font-medium text-foreground">{sku}</div>
                                      {name && <div className="text-xs text-muted-foreground">{name}</div>}
                                      {(line.lotNumber || line.expiryDate) && (
                                        <div className="text-[11px] text-muted-foreground mt-0.5">
                                          {line.lotNumber && <span className="mr-2">Lot: {line.lotNumber}</span>}
                                          {line.expiryDate && <span>Exp: {new Date(line.expiryDate).toLocaleDateString()}</span>}
                                        </div>
                                      )}
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-mono">{line.quantityExpected ?? '—'}</td>
                                    <td className="px-4 py-2.5 text-right font-mono font-semibold text-green-600 dark:text-green-400">
                                      {line.quantityReceived ?? 0}
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-mono text-red-500">
                                      {line.quantityRejected ?? 0}
                                    </td>
                                    <td className="px-4 py-2.5 text-center">
                                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                                        line.qaStatus === 'passed' ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300' :
                                        line.qaStatus === 'failed' ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' :
                                        'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300'
                                      }`}>
                                        {line.qaStatus ? line.qaStatus.charAt(0).toUpperCase() + line.qaStatus.slice(1) : 'Pending'}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="pt-4 border-t border-border flex justify-end">
                    <button
                      onClick={() => setViewingGrn(null)}
                      className="px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg text-sm font-medium transition-colors"
                    >
                      Close
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

