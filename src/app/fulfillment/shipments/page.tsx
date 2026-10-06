'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { RichDataTable } from '@/components/rich-data-table';
import { useSession } from '@/hooks/use-session';
import { useRoleCheck } from '@/hooks/use-role-check';
import {
  cancelDhlShipment,
  createDhlShipment,
  createManualShipment,
  getDhlShipmentLabel,
  getDhlStatus,
  listFulfillmentCarriers,
  listFulfillmentShipments,
  listOrders,
  listPickPackQueue,
  trackDhlShipment,
  updateFulfillmentShipmentStatus,
} from '@/lib/api';
import { toast } from 'sonner';
import { CheckCircle2, ExternalLink, FileText, MapPin, Plus, RefreshCw, Truck, XCircle } from 'lucide-react';
import Link from 'next/link';
import { CrmModal, CrmField, CrmModalActions, crmInputClass } from '@/components/crm/crm-modal';

const DEFAULT_CARRIERS = [
  { code: 'DHL', name: 'DHL Express', api: true },
  { code: 'Royal Mail', name: 'Royal Mail', api: false },
  { code: 'DPD', name: 'DPD UK', api: false },
  { code: 'Evri', name: 'Evri', api: false },
  { code: 'UPS', name: 'UPS', api: false },
  { code: 'FedEx', name: 'FedEx', api: false },
  { code: 'Other', name: 'Other / own courier', api: false },
];

const emptyShipForm = {
  orderId: '',
  carrier: 'Royal Mail',
  otherCarrier: '',
  useDhlApi: false,
  trackingNumber: '',
  serviceCode: '',
  weightKg: '1',
  pieces: '1',
  lengthCm: '',
  widthCm: '',
  heightCm: '',
  productCode: 'N',
  description: '',
  notes: '',
};

export default function FulfillmentShipmentsPage() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const { hasAccess } = useRoleCheck(['ADMIN', 'SUPER_ADMIN', 'SALES_REP', 'CUSTOMER_SERVICE', 'WAREHOUSE_MANAGER']);
  const [items, setItems] = useState<any[]>([]);
  const [status, setStatus] = useState<any>(null);
  const [carriers, setCarriers] = useState(DEFAULT_CARRIERS);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [form, setForm] = useState(emptyShipForm);
  const [saving, setSaving] = useState(false);
  const orgId = session?.user?.organizationId;
  const dhlReady = Boolean(status?.configured && status?.hasAccountNumber);

  const load = useCallback(async () => {
    if (!orgId) return;
    try {
      setLoading(true);
      const [shipRes, st, car] = await Promise.all([
        listFulfillmentShipments({ organizationId: orgId }),
        getDhlStatus().catch(() => ({ data: null })),
        listFulfillmentCarriers().catch(() => ({ data: DEFAULT_CARRIERS })),
      ]);
      setItems(shipRes.data || []);
      setStatus(st.data);
      if (car.data?.length) setCarriers(car.data as any);
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Failed to load shipments');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (!hydrated || !hasAccess) return;
    if (!session?.accessToken) {
      router.replace('/login');
      return;
    }
    void load();
    const preselect = new URLSearchParams(window.location.search).get('orderId');
    if (preselect && orgId) void openCreate(preselect);
  }, [hydrated, hasAccess, session?.accessToken, router, load]);

  async function openCreate(preselectOrderId?: string) {
    setForm({ ...emptyShipForm, orderId: preselectOrderId || '' });
    setShowCreate(true);
    try {
      const [queue, recent] = await Promise.all([
        listPickPackQueue(orgId).catch(() => ({ data: [] as any[] })),
        listOrders({ organizationId: orgId, limit: 50, sortBy: 'orderDate', sortDir: 'desc' }),
      ]);
      const packed = (queue.data || []).filter((o: any) => o.stage === 'packed').map((o: any) => ({ ...o, packed: true }));
      const packedIds = new Set(packed.map((o: any) => String(o.id)));
      const others = (recent.data || []).filter(
        (o: any) => !packedIds.has(String(o.id)) && !['cancelled', 'refunded'].includes(o.status) && o.fulfillmentStatus !== 'fulfilled'
      );
      setOrders([...packed, ...others]);
    } catch {
      setOrders([]);
      toast.error('Could not load orders — paste an order id instead');
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.orderId.trim()) {
      toast.error('Select or enter an order');
      return;
    }
    const carrier = (form.carrier === 'Other' ? form.otherCarrier : form.carrier).trim();
    const viaDhlApi = form.carrier === 'DHL' && form.useDhlApi;
    if (!carrier) {
      toast.error('Choose a carrier');
      return;
    }
    if (!viaDhlApi && !form.trackingNumber.trim()) {
      toast.error('Tracking number is required');
      return;
    }
    setSaving(true);
    try {
      const res = viaDhlApi
        ? await createDhlShipment({
            orderId: form.orderId.trim(),
            organizationId: orgId,
            weightKg: Number(form.weightKg) || 1,
            pieces: Number(form.pieces) || 1,
            lengthCm: form.lengthCm ? Number(form.lengthCm) : undefined,
            widthCm: form.widthCm ? Number(form.widthCm) : undefined,
            heightCm: form.heightCm ? Number(form.heightCm) : undefined,
            productCode: form.productCode || 'N',
            description: form.description || undefined,
          })
        : await createManualShipment({
            orderId: form.orderId.trim(),
            organizationId: orgId,
            carrier,
            trackingNumber: form.trackingNumber.trim(),
            serviceCode: form.serviceCode.trim() || null,
            weightKg: Number(form.weightKg) > 0 ? Number(form.weightKg) : null,
            pieces: Number(form.pieces) > 0 ? Math.floor(Number(form.pieces)) : null,
            notes: form.notes.trim() || null,
          });
      toast.success(`Dispatched with ${carrier}${res.data?.trackingNumber ? ` · ${res.data.trackingNumber}` : ''}`);
      setShowCreate(false);
      setForm(emptyShipForm);
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to create shipment');
    } finally {
      setSaving(false);
    }
  }

  async function setManualStatus(s: any, next: 'delivered' | 'cancelled') {
    if (next === 'cancelled' && !confirm('Cancel this shipment? The order goes back to "packed" so it can be re-shipped.')) return;
    try {
      await updateFulfillmentShipmentStatus(s.id, next, orgId);
      toast.success(next === 'delivered' ? 'Marked delivered' : 'Shipment cancelled');
      void load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Update failed');
    }
  }

  const columns = [
    {
      accessorFn: (r: any) => r.orderNumber || r.orderId,
      header: 'Order',
      cell: ({ row }: any) =>
        row.original.orderId ? (
          <Link className="text-sm underline" href={`/orders/orders/${row.original.orderId}`}>
            {row.original.orderNumber || `#${row.original.orderId}`}
          </Link>
        ) : (
          '—'
        ),
    },
    { accessorKey: 'carrier', header: 'Carrier' },
    { accessorKey: 'trackingNumber', header: 'Tracking' },
    { accessorKey: 'status', header: 'Status' },
    { accessorKey: 'carrierStatus', header: 'Carrier status' },
    {
      accessorFn: (r: any) => r.dispatchedAt || r.createdAt,
      header: 'Dispatched',
      cell: ({ row }: any) => {
        const v = row.original.dispatchedAt || row.original.createdAt;
        return v ? new Date(v).toLocaleString('en-GB') : '—';
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }: any) => {
        const s = row.original;
        const isDhlApi = Boolean(s.viaApi);
        const open = !['cancelled', 'delivered', 'failed'].includes(s.status);
        return (
          <div className="flex flex-wrap gap-1">
            {s.trackingUrl && (
              <a href={s.trackingUrl} target="_blank" rel="noreferrer" className="text-xs px-2 py-1 border rounded inline-flex items-center gap-1">
                <ExternalLink className="h-3 w-3" /> Track on {s.carrier}
              </a>
            )}
            {isDhlApi ? (
              <>
                <button
                  className="text-xs px-2 py-1 border rounded inline-flex items-center gap-1"
                  onClick={async () => {
                    try {
                      const res = await getDhlShipmentLabel(s.id);
                      if (res.data?.labelUrl) window.open(res.data.labelUrl, '_blank');
                      else toast.error('No label URL returned');
                      void load();
                    } catch (e: any) {
                      toast.error(e?.response?.data?.error?.message || 'Label failed');
                    }
                  }}
                >
                  <FileText className="h-3 w-3" /> Label
                </button>
                <button
                  className="text-xs px-2 py-1 border rounded inline-flex items-center gap-1"
                  onClick={async () => {
                    try {
                      const res = await trackDhlShipment({ shipmentId: s.id });
                      toast.success(res.data?.carrierStatus || 'Tracking refreshed');
                      void load();
                    } catch (e: any) {
                      toast.error(e?.response?.data?.error?.message || 'Track failed');
                    }
                  }}
                >
                  <MapPin className="h-3 w-3" /> Refresh tracking
                </button>
                {s.status !== 'cancelled' && (
                  <button
                    className="text-xs px-2 py-1 border rounded inline-flex items-center gap-1 text-red-700"
                    onClick={async () => {
                      if (!confirm('Cancel/void this DHL shipment? Only works before pickup.')) return;
                      try {
                        await cancelDhlShipment(s.id);
                        toast.success('Cancel requested');
                        void load();
                      } catch (e: any) {
                        toast.error(e?.response?.data?.error?.message || 'Cancel failed');
                      }
                    }}
                  >
                    <XCircle className="h-3 w-3" /> Cancel
                  </button>
                )}
              </>
            ) : open ? (
              <>
                <button className="text-xs px-2 py-1 border rounded inline-flex items-center gap-1" onClick={() => setManualStatus(s, 'delivered')}>
                  <CheckCircle2 className="h-3 w-3" /> Delivered
                </button>
                <button className="text-xs px-2 py-1 border rounded inline-flex items-center gap-1 text-red-700" onClick={() => setManualStatus(s, 'cancelled')}>
                  <XCircle className="h-3 w-3" /> Cancel
                </button>
              </>
            ) : null}
          </div>
        );
      },
    },
  ];

  if (!hydrated || !hasAccess || !session?.accessToken) return null;

  return (
    <div className="min-h-screen app-surface">
      <Sidebar />
      <div className="flex flex-col overflow-hidden lg:ml-[280px]">
        <Header
          title="Fulfillment · Shipments"
          actions={[
            {
              label: 'Pick & pack',
              onClick: () => router.push('/fulfillment/pick-pack'),
              variant: 'secondary',
            },
            {
              label: 'Create shipment',
              onClick: () => void openCreate(),
              icon: <Plus size={18} />,
            },
          ]}
        />
        <main className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <Truck />
              <div>
                <h1 className="text-xl font-bold">Shipments</h1>
                <p className="text-sm text-muted-foreground">
                  Dispatch packed orders with DHL, Royal Mail, DPD, Evri, UPS, FedEx or your own courier, and track them.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          </div>

          {status && !dhlReady && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-950 p-3 text-sm">
              <strong>DHL API not connected.</strong> Shipping still works — choose a manual carrier (or DHL with a tracking
              number booked on the DHL website). Automatic DHL label booking needs DHL_API_KEY, DHL_API_SECRET and
              DHL_ACCOUNT_NUMBER on the server.
            </div>
          )}

          {loading && items.length === 0 ? (
            <div className="text-muted-foreground">Loading...</div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-border/60 bg-card p-12 text-center space-y-4">
              <Truck className="mx-auto opacity-40" size={32} />
              <div>
                <p className="font-medium text-foreground">No shipments yet</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                  Pick and pack an order, then create a shipment with the carrier and tracking number.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => void openCreate()}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#D4A017] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#B89015]"
                >
                  <Plus className="h-4 w-4" />
                  Create shipment
                </button>
                <Link
                  href="/fulfillment/pick-pack"
                  className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium hover:bg-muted"
                >
                  Go to pick & pack
                </Link>
              </div>
            </div>
          ) : (
            <RichDataTable data={items} columns={columns as any} searchPlaceholder="Search order, carrier, tracking..." />
          )}
        </main>
      </div>

      <CrmModal open={showCreate} onClose={() => setShowCreate(false)} title="Create shipment" icon={Truck} wide>
        <form onSubmit={onCreate} className="space-y-4">
          <CrmField label="Order">
            <select
              value={form.orderId}
              onChange={(e) => setForm({ ...form, orderId: e.target.value })}
              className={crmInputClass}
            >
              <option value="">Select order…</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.packed ? 'Packed · ' : ''}
                  {o.orderNumber || o.id}
                  {o.customerName || o.customerEmail ? ` · ${o.customerName || o.customerEmail}` : ''}
                  {o.status ? ` · ${o.status}` : ''}
                </option>
              ))}
            </select>
          </CrmField>
          <CrmField label="Or paste order ID">
            <input
              value={form.orderId}
              onChange={(e) => setForm({ ...form, orderId: e.target.value })}
              className={crmInputClass}
              placeholder="Order ID"
            />
          </CrmField>
          <div className="grid grid-cols-2 gap-4">
            <CrmField label="Carrier">
              <select
                value={form.carrier}
                onChange={(e) => setForm({ ...form, carrier: e.target.value, useDhlApi: e.target.value === 'DHL' && dhlReady })}
                className={crmInputClass}
              >
                {carriers.map((c) => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
            </CrmField>
            {form.carrier === 'Other' ? (
              <CrmField label="Carrier name">
                <input
                  required
                  value={form.otherCarrier}
                  onChange={(e) => setForm({ ...form, otherCarrier: e.target.value })}
                  className={crmInputClass}
                  placeholder="e.g. APC, local courier"
                />
              </CrmField>
            ) : (
              <CrmField label="Service (optional)">
                <input
                  value={form.serviceCode}
                  onChange={(e) => setForm({ ...form, serviceCode: e.target.value })}
                  className={crmInputClass}
                  placeholder="e.g. Tracked 24"
                  disabled={form.carrier === 'DHL' && form.useDhlApi}
                />
              </CrmField>
            )}
          </div>

          {form.carrier === 'DHL' && (
            <label className={`flex items-center gap-2 text-sm ${dhlReady ? '' : 'opacity-60'}`}>
              <input
                type="checkbox"
                disabled={!dhlReady}
                checked={form.useDhlApi}
                onChange={(e) => setForm({ ...form, useDhlApi: e.target.checked })}
              />
              Book with the DHL API and generate a label
              {!dhlReady && <span className="text-xs text-muted-foreground">(DHL API not configured — enter a tracking number instead)</span>}
            </label>
          )}

          {!(form.carrier === 'DHL' && form.useDhlApi) && (
            <CrmField label="Tracking number">
              <input
                required
                value={form.trackingNumber}
                onChange={(e) => setForm({ ...form, trackingNumber: e.target.value })}
                className={crmInputClass}
                placeholder="Tracking number from the carrier"
              />
            </CrmField>
          )}

          <div className="grid grid-cols-2 gap-4">
            <CrmField label="Weight (kg)">
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={form.weightKg}
                onChange={(e) => setForm({ ...form, weightKg: e.target.value })}
                className={crmInputClass}
              />
            </CrmField>
            <CrmField label="Parcels">
              <input
                type="number"
                min="1"
                value={form.pieces}
                onChange={(e) => setForm({ ...form, pieces: e.target.value })}
                className={crmInputClass}
              />
            </CrmField>
            {form.carrier === 'DHL' && form.useDhlApi && (
              <>
                <CrmField label="Length (cm)">
                  <input type="number" min="0" value={form.lengthCm} onChange={(e) => setForm({ ...form, lengthCm: e.target.value })} className={crmInputClass} />
                </CrmField>
                <CrmField label="Width (cm)">
                  <input type="number" min="0" value={form.widthCm} onChange={(e) => setForm({ ...form, widthCm: e.target.value })} className={crmInputClass} />
                </CrmField>
                <CrmField label="Height (cm)">
                  <input type="number" min="0" value={form.heightCm} onChange={(e) => setForm({ ...form, heightCm: e.target.value })} className={crmInputClass} />
                </CrmField>
                <CrmField label="DHL product">
                  <select value={form.productCode} onChange={(e) => setForm({ ...form, productCode: e.target.value })} className={crmInputClass}>
                    <option value="N">N · Domestic Express</option>
                    <option value="P">P · Worldwide Express</option>
                    <option value="U">U · Express Worldwide</option>
                  </select>
                </CrmField>
              </>
            )}
          </div>
          <CrmField label={form.carrier === 'DHL' && form.useDhlApi ? 'Package description' : 'Notes'}>
            <input
              value={form.carrier === 'DHL' && form.useDhlApi ? form.description : form.notes}
              onChange={(e) =>
                setForm(form.carrier === 'DHL' && form.useDhlApi ? { ...form, description: e.target.value } : { ...form, notes: e.target.value })
              }
              className={crmInputClass}
              placeholder="Optional"
            />
          </CrmField>
          <CrmModalActions
            onCancel={() => setShowCreate(false)}
            submitLabel="Create & dispatch"
            submitting={saving}
            submitIcon={<Truck size={16} />}
          />
        </form>
      </CrmModal>
    </div>
  );
}
