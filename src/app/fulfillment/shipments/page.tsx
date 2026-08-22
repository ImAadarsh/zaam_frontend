'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { RichDataTable } from '@/components/rich-data-table';
import { useSession } from '@/hooks/use-session';
import { useRoleCheck } from '@/hooks/use-role-check';
import {
  cancelDhlShipment,
  getDhlShipmentLabel,
  getDhlStatus,
  listDhlShipments,
  trackDhlShipment
} from '@/lib/api';
import { toast } from 'sonner';
import { ExternalLink, FileText, MapPin, RefreshCw, Truck, XCircle } from 'lucide-react';
import Link from 'next/link';

export default function FulfillmentShipmentsPage() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const { hasAccess } = useRoleCheck(['ADMIN', 'SUPER_ADMIN', 'SALES_REP', 'CUSTOMER_SERVICE', 'WAREHOUSE_MANAGER']);
  const [items, setItems] = useState<any[]>([]);
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const orgId = session?.user?.organizationId;

  const load = async () => {
    if (!orgId) return;
    try {
      setLoading(true);
      const [shipRes, st] = await Promise.all([
        listDhlShipments({ organizationId: orgId }),
        getDhlStatus().catch(() => ({ data: null }))
      ]);
      setItems(shipRes.data || []);
      setStatus(st.data);
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Failed to load DHL shipments');
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

  const columns = [
    {
      accessorFn: (r: any) => r.orderId,
      header: 'Order',
      cell: ({ row }: any) =>
        row.original.orderId ? (
          <Link className="text-sm underline" href={`/orders/orders/${row.original.orderId}`}>
            #{row.original.orderId}
          </Link>
        ) : (
          '—'
        )
    },
    { accessorKey: 'carrier', header: 'Carrier' },
    { accessorKey: 'trackingNumber', header: 'Tracking' },
    { accessorKey: 'status', header: 'Status' },
    { accessorKey: 'carrierStatus', header: 'Carrier status' },
    {
      header: 'Actions',
      cell: ({ row }: any) => {
        const s = row.original;
        return (
          <div className="flex flex-wrap gap-1">
            <button
              className="text-xs px-2 py-1 border rounded inline-flex items-center gap-1"
              onClick={async () => {
                try {
                  const res = await getDhlShipmentLabel(s.id);
                  if (res.data?.labelUrl) window.open(res.data.labelUrl, '_blank');
                  else toast.error('No label URL returned');
                  load();
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
                  if (res.data?.trackingUrl) window.open(res.data.trackingUrl, '_blank');
                  load();
                } catch (e: any) {
                  toast.error(e?.response?.data?.error?.message || 'Track failed');
                }
              }}
            >
              <MapPin className="h-3 w-3" /> Track
            </button>
            {s.status !== 'cancelled' && (
              <button
                className="text-xs px-2 py-1 border rounded inline-flex items-center gap-1 text-red-700"
                onClick={async () => {
                  if (!confirm('Cancel/void this DHL shipment? Only works before pickup.')) return;
                  try {
                    await cancelDhlShipment(s.id);
                    toast.success('Cancel requested');
                    load();
                  } catch (e: any) {
                    toast.error(e?.response?.data?.error?.message || 'Cancel failed');
                  }
                }}
              >
                <XCircle className="h-3 w-3" /> Cancel
              </button>
            )}
            {s.trackingUrl && (
              <a
                href={s.trackingUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs px-2 py-1 border rounded inline-flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" /> DHL
              </a>
            )}
          </div>
        );
      }
    }
  ];

  return (
    <div className="min-h-screen app-surface">
      <Sidebar />
      <div className="flex flex-col overflow-hidden lg:ml-[280px]">
        <Header title="Fulfillment · Shipments" />
        <main className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <Truck />
              <div>
                <h1 className="text-xl font-bold">DHL shipments</h1>
                <p className="text-sm text-muted-foreground">
                  Labels, tracking, and cancel for orders shipped via MyDHL API.
                </p>
              </div>
            </div>
            <button
              onClick={() => load()}
              className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          </div>

          {status && (
            <div
              className={`rounded-lg border p-3 text-sm ${
                status.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-950'
              }`}
            >
              <strong>DHL {status.mode}:</strong> {status.message}
              {!status.configured && (
                <span className="block mt-1">
                  Add <code>DHL_API_KEY</code> / <code>DHL_API_SECRET</code> / <code>DHL_ACCOUNT_NUMBER</code> to
                  zaam-api/.env (from developer.dhl.com → Apps → zaam_erp).
                </span>
              )}
            </div>
          )}

          {loading ? (
            <div className="text-muted-foreground">Loading...</div>
          ) : (
            <RichDataTable data={items} columns={columns as any} searchPlaceholder="Search shipments..." />
          )}
        </main>
      </div>
    </div>
  );
}
