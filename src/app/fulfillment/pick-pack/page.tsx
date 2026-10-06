'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { RichDataTable } from '@/components/rich-data-table';
import { useSession } from '@/hooks/use-session';
import { useRoleCheck } from '@/hooks/use-role-check';
import { listPickPackQueue, markPickPackStage } from '@/lib/api';
import { toast } from 'sonner';
import { ColumnDef } from '@tanstack/react-table';
import { Box, ClipboardCheck, Package, RefreshCw, Truck, X } from 'lucide-react';

type Stage = 'to_pick' | 'picked' | 'packed';

const STAGE_LABEL: Record<Stage, string> = { to_pick: 'To pick', picked: 'Picked', packed: 'Packed' };
const STAGE_STYLE: Record<Stage, string> = {
  to_pick: 'bg-amber-500/10 text-amber-700',
  picked: 'bg-blue-500/10 text-blue-700',
  packed: 'bg-emerald-500/10 text-emerald-700'
};

export default function PickPackPage() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const { hasAccess } = useRoleCheck(['ADMIN', 'SUPER_ADMIN', 'SALES_REP', 'CUSTOMER_SERVICE', 'WAREHOUSE_MANAGER']);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState<Stage | ''>('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pickList, setPickList] = useState<any | null>(null);
  const orgId = session?.user?.organizationId;

  const load = useCallback(async () => {
    if (!orgId) return;
    try {
      setLoading(true);
      const res = await listPickPackQueue(orgId);
      setItems(res.data || []);
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Failed to load pick/pack queue');
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
  }, [hydrated, hasAccess, session?.accessToken, router, load]);

  const advance = async (row: any, stage: 'picked' | 'packed') => {
    setBusyId(row.id);
    try {
      await markPickPackStage(row.id, stage, orgId);
      setItems((prev) => prev.map((o) => (o.id === row.id
        ? { ...o, stage, status: 'processing', fulfillmentStatus: 'processing', lines: o.lines.map((l: any) => ({ ...l, fulfillmentStatus: stage })) }
        : o)));
      setPickList((p: any) => (p?.id === row.id ? null : p));
      toast.success(`${row.orderNumber} marked ${stage}`);
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Update failed');
    } finally {
      setBusyId(null);
    }
  };

  const counts = useMemo(() => ({
    to_pick: items.filter((o) => o.stage === 'to_pick').length,
    picked: items.filter((o) => o.stage === 'picked').length,
    packed: items.filter((o) => o.stage === 'packed').length
  }), [items]);

  const rows = useMemo(() => (stageFilter ? items.filter((o) => o.stage === stageFilter) : items), [items, stageFilter]);

  const columns = useMemo<ColumnDef<any>[]>(() => [
    {
      accessorKey: 'orderNumber',
      header: 'Order',
      cell: ({ row }) => (
        <Link href={`/orders/orders/${row.original.id}`} className="underline font-medium">{row.original.orderNumber}</Link>
      )
    },
    { accessorKey: 'channel', header: 'Channel' },
    { accessorKey: 'customerName', header: 'Customer' },
    {
      accessorKey: 'orderDate',
      header: 'Ordered',
      cell: ({ row }) => (row.original.orderDate ? new Date(row.original.orderDate).toLocaleDateString('en-GB') : '—')
    },
    { accessorKey: 'itemCount', header: 'Items' },
    { accessorKey: 'shippingMethod', header: 'Shipping', cell: ({ row }) => row.original.shippingMethod || '—' },
    {
      accessorKey: 'stage',
      header: 'Stage',
      cell: ({ row }) => (
        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STAGE_STYLE[row.original.stage as Stage]}`}>
          {STAGE_LABEL[row.original.stage as Stage]}
        </span>
      )
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const o = row.original;
        const busy = busyId === o.id;
        return (
          <div className="flex flex-wrap gap-1">
            <button className="text-xs px-2 py-1 border rounded inline-flex items-center gap-1" onClick={() => setPickList(o)}>
              <ClipboardCheck className="h-3 w-3" /> Pick list
            </button>
            {o.stage === 'to_pick' && (
              <button disabled={busy} className="text-xs px-2 py-1 border rounded inline-flex items-center gap-1 disabled:opacity-50" onClick={() => advance(o, 'picked')}>
                <Package className="h-3 w-3" /> Mark picked
              </button>
            )}
            {o.stage === 'picked' && (
              <button disabled={busy} className="text-xs px-2 py-1 border rounded inline-flex items-center gap-1 disabled:opacity-50" onClick={() => advance(o, 'packed')}>
                <Box className="h-3 w-3" /> Mark packed
              </button>
            )}
            {o.stage === 'packed' && (
              <Link href={`/fulfillment/shipments?orderId=${o.id}`} className="text-xs px-2 py-1 border rounded inline-flex items-center gap-1 bg-primary text-primary-foreground">
                <Truck className="h-3 w-3" /> Ship
              </Link>
            )}
          </div>
        );
      }
    }
  ], [busyId, orgId]);

  return (
    <div className="min-h-screen app-surface">
      <Sidebar />
      <div className="flex flex-col overflow-hidden lg:ml-[280px]">
        <Header title="Fulfillment · Pick & Pack" />
        <main className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <Package />
              <div>
                <h1 className="text-xl font-bold">Pick & pack</h1>
                <p className="text-sm text-muted-foreground">
                  Confirmed and processing orders waiting to be fulfilled. Pick the items, pack them, then create a shipment.
                </p>
              </div>
            </div>
            <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {([['', 'All open', items.length], ['to_pick', 'To pick', counts.to_pick], ['picked', 'Picked', counts.picked], ['packed', 'Packed – ready to ship', counts.packed]] as const).map(([key, label, n]) => (
              <button
                key={label}
                onClick={() => setStageFilter(key as Stage | '')}
                className={`text-left p-4 rounded-2xl border bg-card transition-colors ${stageFilter === key ? 'border-primary' : 'border-border hover:border-primary/40'}`}
              >
                <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
                <div className="text-2xl font-bold">{n}</div>
              </button>
            ))}
          </div>

          {loading && items.length === 0 ? (
            <div className="text-muted-foreground">Loading...</div>
          ) : (
            <RichDataTable data={rows} columns={columns} searchPlaceholder="Search order, customer, channel..." />
          )}
        </main>
      </div>

      {pickList && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl p-6 space-y-4 max-h-[85vh] overflow-auto">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="font-bold">Pick list · {pickList.orderNumber}</h2>
                <p className="text-sm text-muted-foreground">{pickList.customerName}{pickList.shipTo ? ` · ${pickList.shipTo}` : ''}</p>
              </div>
              <button onClick={() => setPickList(null)}><X size={18} /></button>
            </div>
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground bg-muted/40">
                <tr>
                  <th className="text-left px-3 py-2">SKU</th>
                  <th className="text-left px-3 py-2">Item</th>
                  <th className="text-right px-3 py-2">Qty</th>
                  <th className="text-left px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {pickList.lines.map((l: any) => (
                  <tr key={l.id} className="border-t border-border">
                    <td className="px-3 py-2 font-mono text-xs">{l.sku}</td>
                    <td className="px-3 py-2">{l.name}</td>
                    <td className="px-3 py-2 text-right font-semibold">{l.quantity}</td>
                    <td className="px-3 py-2">{l.fulfillmentStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end gap-2">
              <button className="px-4 py-2 rounded-xl border border-border text-sm" onClick={() => window.print()}>Print</button>
              {pickList.stage === 'to_pick' && (
                <button className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold" onClick={() => advance(pickList, 'picked')}>
                  Mark all picked
                </button>
              )}
              {pickList.stage === 'picked' && (
                <button className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold" onClick={() => advance(pickList, 'packed')}>
                  Mark packed
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
