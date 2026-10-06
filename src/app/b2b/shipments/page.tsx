'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { RichDataTable } from '@/components/rich-data-table';
import { useSession } from '@/hooks/use-session';
import { useRoleCheck } from '@/hooks/use-role-check';
import { listB2bShipments, updateB2bShipment } from '@/lib/api';
import { toast } from 'sonner';
import { Truck, X } from 'lucide-react';

const CARRIERS = ['DHL', 'Royal Mail', 'Parcelforce', 'DPD', 'Evri', 'Yodel', 'UPS', 'FedEx', 'Zaam Freight', 'Other'];

type DispatchForm = { row: any; status: 'dispatched' | 'delivered'; carrier: string; otherCarrier: string; trackingNumber: string };

export default function B2bShipmentsPage() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const { hasAccess } = useRoleCheck(['ADMIN', 'SUPER_ADMIN', 'SALES_REP']);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dispatch, setDispatch] = useState<DispatchForm | null>(null);
  const [saving, setSaving] = useState(false);
  const orgId = session?.user?.organizationId;

  const load = async () => {
    if (!orgId) return;
    try {
      const res = await listB2bShipments({ organizationId: orgId });
      setItems(res.data || []);
    } catch {
      toast.error('Failed to load shipments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!hydrated || !hasAccess) return;
    if (!session?.accessToken) {
      router.replace('/login');
      return;
    }
    load();
  }, [hydrated, hasAccess, session?.accessToken, orgId]);

  const openDispatch = (row: any, status: 'dispatched' | 'delivered') => {
    const known = row.carrier && CARRIERS.includes(row.carrier);
    setDispatch({
      row,
      status,
      carrier: row.carrier ? (known ? row.carrier : 'Other') : '',
      otherCarrier: row.carrier && !known ? row.carrier : '',
      trackingNumber: row.trackingNumber || ''
    });
  };

  const markDelivered = async (row: any) => {
    if (!row.carrier || !row.trackingNumber) {
      openDispatch(row, 'delivered');
      return;
    }
    try {
      await updateB2bShipment(row.id, { organizationId: orgId, status: 'delivered' });
      toast.success('Marked delivered');
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Update failed');
    }
  };

  const submitDispatch = async () => {
    if (!dispatch) return;
    const carrier = (dispatch.carrier === 'Other' ? dispatch.otherCarrier : dispatch.carrier).trim();
    const trackingNumber = dispatch.trackingNumber.trim();
    if (!carrier || !trackingNumber) {
      toast.error('Carrier and tracking number are required');
      return;
    }
    setSaving(true);
    try {
      await updateB2bShipment(dispatch.row.id, { organizationId: orgId, status: dispatch.status, carrier, trackingNumber });
      toast.success(dispatch.status === 'delivered' ? 'Marked delivered' : 'Marked dispatched');
      setDispatch(null);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo(() => [
    { accessorFn: (r: any) => r.order?.orderNumber || r.orderId, header: 'Order' },
    { accessorFn: (r: any) => r.customer?.companyName || r.customer?.email, header: 'Retailer' },
    { accessorKey: 'status', header: 'Status' },
    { accessorKey: 'carrier', header: 'Carrier' },
    { accessorKey: 'trackingNumber', header: 'Tracking' },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }: any) => {
        const s = row.original.status;
        const done = s === 'delivered' || s === 'cancelled';
        return (
          <div className="flex gap-2">
            <button
              disabled={done}
              className="text-xs px-2 py-1 border rounded disabled:opacity-40"
              onClick={() => openDispatch(row.original, 'dispatched')}
            >
              {s === 'dispatched' || s === 'in_transit' ? 'Edit tracking' : 'Dispatch'}
            </button>
            <button
              disabled={done}
              className="text-xs px-2 py-1 border rounded disabled:opacity-40"
              onClick={() => markDelivered(row.original)}
            >
              Delivered
            </button>
          </div>
        );
      }
    }
  ], [orgId]);

  return (
    <div className="min-h-screen app-surface">
      <Sidebar />
      <div className="flex flex-col overflow-hidden lg:ml-[280px]">
        <Header title="B2B · Shipments" />
        <main className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Truck />
            <div>
              <h1 className="text-xl font-bold">Fulfilment & tracking</h1>
              <p className="text-sm text-muted-foreground">Update B2B shipment status. A carrier and tracking number are required to dispatch.</p>
            </div>
          </div>
          {loading ? <div className="text-muted-foreground">Loading...</div> : (
            <RichDataTable data={items} columns={columns as any} searchPlaceholder="Search shipments..." />
          )}
        </main>
      </div>

      {dispatch && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={(e) => { e.preventDefault(); submitDispatch(); }}
            className="bg-card border border-border rounded-2xl w-full max-w-md p-6 space-y-3"
          >
            <div className="flex justify-between items-center">
              <h2 className="font-bold">
                {dispatch.status === 'delivered' ? 'Mark delivered' : 'Dispatch'} · {dispatch.row.order?.orderNumber}
              </h2>
              <button type="button" onClick={() => setDispatch(null)}><X size={18} /></button>
            </div>
            <label className="block text-xs font-medium text-muted-foreground">
              Carrier *
              <select
                required
                className="mt-1 w-full border border-border rounded-lg px-3 py-2 bg-background text-sm text-foreground"
                value={dispatch.carrier}
                onChange={(e) => setDispatch({ ...dispatch, carrier: e.target.value })}
              >
                <option value="">Select carrier…</option>
                {CARRIERS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            {dispatch.carrier === 'Other' && (
              <label className="block text-xs font-medium text-muted-foreground">
                Carrier name *
                <input
                  required
                  className="mt-1 w-full border border-border rounded-lg px-3 py-2 bg-background text-sm text-foreground"
                  value={dispatch.otherCarrier}
                  onChange={(e) => setDispatch({ ...dispatch, otherCarrier: e.target.value })}
                />
              </label>
            )}
            <label className="block text-xs font-medium text-muted-foreground">
              Tracking number *
              <input
                required
                className="mt-1 w-full border border-border rounded-lg px-3 py-2 bg-background text-sm text-foreground"
                placeholder="e.g. JD014600006281234567"
                value={dispatch.trackingNumber}
                onChange={(e) => setDispatch({ ...dispatch, trackingNumber: e.target.value })}
              />
            </label>
            <button type="submit" disabled={saving} className="w-full bg-primary text-primary-foreground py-2 rounded-xl font-semibold disabled:opacity-50">
              {saving ? 'Saving…' : dispatch.status === 'delivered' ? 'Save & mark delivered' : 'Save & dispatch'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
