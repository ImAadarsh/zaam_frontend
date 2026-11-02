'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { RichDataTable } from '@/components/rich-data-table';
import { useSession } from '@/hooks/use-session';
import { useRoleCheck } from '@/hooks/use-role-check';
import { listB2bShipments, updateB2bShipment } from '@/lib/api';
import { toast } from 'sonner';
import { Truck, X } from 'lucide-react';

const CARRIERS = ['DHL', 'Royal Mail', 'Parcelforce', 'DPD', 'Evri', 'Yodel', 'UPS', 'FedEx', 'Zaam Freight', 'Other'];

const SHIPPABLE_ORDER = ['confirmed', 'processing'] as const;
const BLOCKED_ORDER = ['cancelled', 'refunded'] as const;

type DispatchForm = {
  row: any;
  status: 'dispatched' | 'delivered';
  carrier: string;
  otherCarrier: string;
  trackingNumber: string;
};

type CancelForm = { row: any; reason: string };

function orderStatusOf(row: any): string {
  return String(row?.order?.status || '—');
}

function canDispatch(row: any): { ok: boolean; reason: string } {
  const ship = row.status;
  const order = orderStatusOf(row);
  if (ship === 'delivered' || ship === 'cancelled') {
    return { ok: false, reason: `Shipment is ${ship}` };
  }
  if ((BLOCKED_ORDER as readonly string[]).includes(order)) {
    return { ok: false, reason: `Order is ${order}; cannot dispatch` };
  }
  if (!(SHIPPABLE_ORDER as readonly string[]).includes(order) && order !== 'completed') {
    return { ok: false, reason: `Order is ${order}; dispatch only when confirmed or processing` };
  }
  return { ok: true, reason: '' };
}

function canDeliver(row: any): { ok: boolean; reason: string } {
  const ship = row.status;
  const order = orderStatusOf(row);
  if (ship === 'delivered' || ship === 'cancelled') {
    return { ok: false, reason: `Shipment is ${ship}` };
  }
  if ((BLOCKED_ORDER as readonly string[]).includes(order)) {
    return { ok: false, reason: `Order is ${order}; cannot mark delivered` };
  }
  if (!(SHIPPABLE_ORDER as readonly string[]).includes(order) && order !== 'completed') {
    return { ok: false, reason: `Order is ${order}; deliver only when confirmed or processing` };
  }
  return { ok: true, reason: '' };
}

function canCancel(row: any): { ok: boolean; reason: string } {
  const ship = row.status;
  const order = orderStatusOf(row);
  if (ship === 'delivered' || ship === 'cancelled') {
    return { ok: false, reason: `Shipment is ${ship}` };
  }
  if ((BLOCKED_ORDER as readonly string[]).includes(order)) {
    return { ok: false, reason: `Order is already ${order}` };
  }
  return { ok: true, reason: '' };
}

export default function B2bShipmentsPage() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const { hasAccess } = useRoleCheck(['ADMIN', 'SUPER_ADMIN', 'SALES_REP', 'B2B_M']);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dispatch, setDispatch] = useState<DispatchForm | null>(null);
  const [cancelForm, setCancelForm] = useState<CancelForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
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
    const gate = status === 'delivered' ? canDeliver(row) : canDispatch(row);
    if (!gate.ok) {
      toast.error(gate.reason);
      return;
    }
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
    const gate = canDeliver(row);
    if (!gate.ok) {
      toast.error(gate.reason);
      return;
    }
    if (!row.carrier || !row.trackingNumber) {
      openDispatch(row, 'delivered');
      return;
    }
    setBusyId(row.id);
    try {
      const res = await updateB2bShipment(row.id, { organizationId: orgId, status: 'delivered' });
      toast.success('Marked delivered');
      setItems((prev) => prev.map((s) => (s.id === row.id ? res.data : s)));
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Update failed');
    } finally {
      setBusyId(null);
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
      const res = await updateB2bShipment(dispatch.row.id, {
        organizationId: orgId,
        status: dispatch.status,
        carrier,
        trackingNumber
      });
      toast.success(dispatch.status === 'delivered' ? 'Marked delivered' : 'Marked dispatched');
      setItems((prev) => prev.map((s) => (s.id === dispatch.row.id ? res.data : s)));
      setDispatch(null);
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const submitCancel = async () => {
    if (!cancelForm) return;
    const reason = cancelForm.reason.trim();
    if (!reason) {
      toast.error('A reason is required to cancel a shipment');
      return;
    }
    setSaving(true);
    try {
      const res = await updateB2bShipment(cancelForm.row.id, {
        organizationId: orgId,
        status: 'cancelled',
        reason
      });
      toast.success('Shipment cancelled — order rolled back to processing where applicable');
      setItems((prev) => prev.map((s) => (s.id === cancelForm.row.id ? res.data : s)));
      setCancelForm(null);
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Cancel failed');
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo(() => [
    {
      accessorFn: (r: any) => r.order?.orderNumber || r.orderId,
      header: 'Order',
      cell: ({ row }: any) => {
        const id = row.original.order?.id;
        const num = row.original.order?.orderNumber || row.original.orderId;
        return id ? (
          <Link href={`/b2b/orders/${id}`} className="text-xs font-semibold underline-offset-2 hover:underline">
            {num}
          </Link>
        ) : (
          <span>{num || '—'}</span>
        );
      }
    },
    {
      id: 'orderStatus',
      header: 'Order status',
      cell: ({ row }: any) => (
        <span className="text-xs font-medium capitalize px-2 py-1 rounded-md bg-muted">
          {orderStatusOf(row.original)}
        </span>
      )
    },
    { accessorFn: (r: any) => r.customer?.companyName || r.customer?.email, header: 'Retailer' },
    { accessorKey: 'status', header: 'Shipment' },
    { accessorKey: 'carrier', header: 'Carrier' },
    { accessorKey: 'trackingNumber', header: 'Tracking' },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }: any) => {
        const r = row.original;
        const dispatchGate = canDispatch(r);
        const deliverGate = canDeliver(r);
        const cancelGate = canCancel(r);
        const busy = busyId === r.id;
        const dispatchLabel = r.status === 'dispatched' || r.status === 'in_transit' ? 'Edit tracking' : 'Dispatch';
        return (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!dispatchGate.ok || busy}
              title={dispatchGate.ok ? dispatchLabel : dispatchGate.reason}
              className="text-xs px-2 py-1 border rounded disabled:opacity-40"
              onClick={() => openDispatch(r, 'dispatched')}
            >
              {dispatchLabel}
            </button>
            <button
              type="button"
              disabled={!deliverGate.ok || busy}
              title={deliverGate.ok ? 'Mark delivered' : deliverGate.reason}
              className="text-xs px-2 py-1 border rounded disabled:opacity-40"
              onClick={() => markDelivered(r)}
            >
              {busy ? '…' : 'Delivered'}
            </button>
            <button
              type="button"
              disabled={!cancelGate.ok || busy}
              title={cancelGate.ok ? 'Cancel shipment (reason required)' : cancelGate.reason}
              className="text-xs px-2 py-1 border border-destructive/40 text-destructive rounded disabled:opacity-40"
              onClick={() => setCancelForm({ row: r, reason: '' })}
            >
              Cancel
            </button>
          </div>
        );
      }
    }
  ], [orgId, busyId]);

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
              <p className="text-sm text-muted-foreground">
                Actions depend on the linked order status. Cancel requires a reason and rolls the order back to processing when it is still open.
              </p>
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
            <p className="text-xs text-muted-foreground">
              Order status: <span className="font-semibold capitalize">{orderStatusOf(dispatch.row)}</span>
            </p>
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

      {cancelForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={(e) => { e.preventDefault(); submitCancel(); }}
            className="bg-card border border-border rounded-2xl w-full max-w-md p-6 space-y-3"
          >
            <div className="flex justify-between items-center">
              <h2 className="font-bold">Cancel shipment · {cancelForm.row.order?.orderNumber}</h2>
              <button type="button" onClick={() => setCancelForm(null)}><X size={18} /></button>
            </div>
            <p className="text-xs text-muted-foreground">
              Order is <span className="font-semibold capitalize">{orderStatusOf(cancelForm.row)}</span>. Cancelling updates the order fulfilment back toward processing (order stays open unless already completed).
            </p>
            <label className="block text-xs font-medium text-muted-foreground">
              Reason *
              <textarea
                required
                rows={3}
                className="mt-1 w-full border border-border rounded-lg px-3 py-2 bg-background text-sm text-foreground"
                placeholder="e.g. Carrier lost parcel / customer requested hold / address issue"
                value={cancelForm.reason}
                onChange={(e) => setCancelForm({ ...cancelForm, reason: e.target.value })}
              />
            </label>
            <button type="submit" disabled={saving || !cancelForm.reason.trim()} className="w-full bg-destructive text-destructive-foreground py-2 rounded-xl font-semibold disabled:opacity-50">
              {saving ? 'Cancelling…' : 'Confirm cancel'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
