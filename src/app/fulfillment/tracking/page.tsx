'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { RichDataTable } from '@/components/rich-data-table';
import { useSession } from '@/hooks/use-session';
import { useRoleCheck } from '@/hooks/use-role-check';
import { getDhlStatus, listFulfillmentShipments, trackDhlShipment } from '@/lib/api';
import { toast } from 'sonner';
import { ExternalLink, MapPin, Search } from 'lucide-react';

const TRACKING_URLS: Record<string, (t: string) => string> = {
  DHL: (t) => `https://www.dhl.com/gb-en/home/tracking.html?tracking-id=${t}`,
  'Royal Mail': (t) => `https://www.royalmail.com/track-your-item#/tracking-results/${t}`,
  Parcelforce: (t) => `https://www.parcelforce.com/track-trace?trackNumber=${t}`,
  DPD: (t) => `https://track.dpd.co.uk/parcels/${t}`,
  Evri: (t) => `https://www.evri.com/track/parcel/${t}`,
  Yodel: (t) => `https://www.yodel.co.uk/tracking/${t}`,
  UPS: (t) => `https://www.ups.com/track?tracknum=${t}`,
  FedEx: (t) => `https://www.fedex.com/fedextrack/?trknbr=${t}`
};

export default function FulfillmentTrackingPage() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const { hasAccess } = useRoleCheck(['ADMIN', 'SUPER_ADMIN', 'SALES_REP', 'CUSTOMER_SERVICE', 'WAREHOUSE_MANAGER']);
  const [carrier, setCarrier] = useState('Royal Mail');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [shipments, setShipments] = useState<any[]>([]);
  const [dhlReady, setDhlReady] = useState(false);
  const orgId = session?.user?.organizationId;

  useEffect(() => {
    if (!hydrated || !hasAccess) return;
    if (!session?.accessToken) {
      router.replace('/login');
      return;
    }
    if (!orgId) return;
    listFulfillmentShipments({ organizationId: orgId })
      .then((res) => setShipments(res.data || []))
      .catch(() => toast.error('Failed to load shipments'));
    getDhlStatus()
      .then((res) => setDhlReady(Boolean(res.data?.configured)))
      .catch(() => setDhlReady(false));
  }, [hydrated, hasAccess, session?.accessToken, router, orgId]);

  async function onTrack(e: React.FormEvent) {
    e.preventDefault();
    const t = trackingNumber.trim();
    if (!t) {
      toast.error('Enter a tracking number');
      return;
    }
    const local = shipments.find((s) => String(s.trackingNumber || '').toLowerCase() === t.toLowerCase());
    const effectiveCarrier = local?.carrier || carrier;
    const url = local?.trackingUrl || TRACKING_URLS[effectiveCarrier]?.(encodeURIComponent(t)) || null;

    if (effectiveCarrier === 'DHL' && dhlReady) {
      setBusy(true);
      try {
        const res = await trackDhlShipment(local?.viaApi ? { shipmentId: local.id } : { trackingNumber: t });
        setResult({ ...res.data, local });
        toast.success(res.data?.carrierStatus || 'Tracking loaded');
      } catch (err: any) {
        setResult({ trackingNumber: t, carrier: effectiveCarrier, trackingUrl: url, local, error: err?.response?.data?.error?.message || 'DHL tracking failed' });
      } finally {
        setBusy(false);
      }
      return;
    }
    setResult({ trackingNumber: t, carrier: effectiveCarrier, trackingUrl: url, local, carrierStatus: local?.carrierStatus || null });
  }

  const columns = useMemo(() => [
    {
      accessorFn: (r: any) => r.orderNumber || r.orderId,
      header: 'Order',
      cell: ({ row }: any) => (row.original.orderId
        ? <Link className="underline" href={`/orders/orders/${row.original.orderId}`}>{row.original.orderNumber || `#${row.original.orderId}`}</Link>
        : '—')
    },
    { accessorKey: 'carrier', header: 'Carrier' },
    { accessorKey: 'trackingNumber', header: 'Tracking' },
    { accessorKey: 'status', header: 'Status' },
    {
      accessorFn: (r: any) => r.dispatchedAt,
      header: 'Dispatched',
      cell: ({ row }: any) => (row.original.dispatchedAt ? new Date(row.original.dispatchedAt).toLocaleString('en-GB') : '—')
    },
    {
      id: 'track',
      header: '',
      cell: ({ row }: any) => (row.original.trackingUrl ? (
        <a href={row.original.trackingUrl} target="_blank" rel="noreferrer" className="text-xs px-2 py-1 border rounded inline-flex items-center gap-1">
          <ExternalLink className="h-3 w-3" /> Track on {row.original.carrier}
        </a>
      ) : null)
    }
  ], []);

  return (
    <div className="min-h-screen app-surface">
      <Sidebar />
      <div className="flex flex-col overflow-hidden lg:ml-[280px]">
        <Header title="Fulfillment · Tracking" />
        <main className="flex-1 overflow-auto p-4 md:p-6 space-y-5">
          <div className="flex items-center gap-3">
            <MapPin />
            <div>
              <h1 className="text-xl font-bold">Track a shipment</h1>
              <p className="text-sm text-muted-foreground">
                Look up any tracking number. DHL is tracked live via the DHL API when configured; other carriers open on the carrier&apos;s tracking page.
              </p>
            </div>
          </div>

          <form onSubmit={onTrack} className="flex flex-wrap gap-2 max-w-3xl">
            <select className="rounded-lg border px-3 py-2 text-sm bg-background" value={carrier} onChange={(e) => setCarrier(e.target.value)}>
              {Object.keys(TRACKING_URLS).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input
              className="flex-1 min-w-[220px] rounded-lg border px-3 py-2 text-sm bg-background"
              placeholder="Tracking number"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
            />
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm disabled:opacity-50"
            >
              <Search className="h-4 w-4" />
              {busy ? 'Tracking…' : 'Track'}
            </button>
          </form>

          {result && (
            <div className="rounded-lg border bg-card p-4 space-y-3 text-sm max-w-3xl">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div><div className="text-muted-foreground">Carrier</div><div className="font-semibold">{result.carrier || carrier}</div></div>
                <div><div className="text-muted-foreground">Tracking</div><div className="font-semibold break-all">{result.trackingNumber}</div></div>
                <div><div className="text-muted-foreground">Status</div><div className="font-semibold">{result.carrierStatus || result.local?.status || '—'}</div></div>
                <div>
                  <div className="text-muted-foreground">Order</div>
                  {result.local?.orderId
                    ? <Link className="underline" href={`/orders/orders/${result.local.orderId}`}>{result.local.orderNumber || `#${result.local.orderId}`}</Link>
                    : <div className="text-muted-foreground">Not found in ERP</div>}
                </div>
              </div>
              {result.error && <p className="text-red-600">{result.error}</p>}
              {result.trackingUrl && (
                <a className="inline-flex items-center gap-1 underline" href={result.trackingUrl} target="_blank" rel="noreferrer">
                  Open on {result.carrier || carrier} <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {Array.isArray(result.events) && result.events.length > 0 && (
                <ul className="space-y-2 border-t pt-3">
                  {result.events.slice(0, 20).map((ev: any, i: number) => (
                    <li key={i} className="text-sm">
                      <span className="font-medium">{ev.description || ev.status || ev.typeCode || 'Event'}</span>
                      {(ev.date || ev.timestamp) && <span className="text-muted-foreground"> · {ev.date || ev.timestamp}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="space-y-2">
            <h2 className="font-semibold">Recent shipments</h2>
            <RichDataTable data={shipments} columns={columns as any} searchPlaceholder="Search tracking number, order, carrier..." />
          </div>
        </main>
      </div>
    </div>
  );
}
