'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { RichDataTable } from '@/components/rich-data-table';
import type { ColumnDef } from '@tanstack/react-table';
import {
  getOrderSyncStatus,
  listOrderSyncConnections,
  previewOrderSync,
  runOrderSync,
  listOrganizations,
  type OrderSyncConnection,
  type OrderSyncPreview,
  type OrderSyncResult
} from '@/lib/api';
import { toast } from 'sonner';
import { useRoleCheck } from '@/hooks/use-role-check';
import {
  RefreshCw,
  Loader2,
  Search,
  ArrowDownToLine,
  Store,
  Monitor,
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  ShoppingCart
} from 'lucide-react';

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function money(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

const STAT_LABELS: Record<string, string> = {
  ordersCreated: 'Orders created',
  ordersUpdated: 'Orders updated',
  ordersSkipped: 'Orders skipped',
  linesCreated: 'Line items created',
  paymentsCreated: 'Payments created',
  paymentsSkipped: 'Payments already present',
  customersCreated: 'Customers created',
  customersLinked: 'Customers linked',
  addressesCreated: 'Addresses created'
};

export default function ChannelOrderSyncPage() {
  const { hasAccess, hydrated } = useRoleCheck(['ADMIN', 'SUPER_ADMIN']);

  const [organizations, setOrganizations] = useState<Array<{ id: string; name: string }>>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [connections, setConnections] = useState<OrderSyncConnection[]>([]);
  const [connectionId, setConnectionId] = useState('');

  const [from, setFrom] = useState(() => isoDate(new Date(Date.now() - 90 * 864e5)));
  const [to, setTo] = useState(() => isoDate(new Date()));
  const [includeVoided, setIncludeVoided] = useState(false);
  const [createCustomers, setCreateCustomers] = useState(true);
  const [importPayments, setImportPayments] = useState(true);
  const [updateExisting, setUpdateExisting] = useState(true);

  const [loadingConns, setLoadingConns] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<OrderSyncPreview | null>(null);
  const [result, setResult] = useState<OrderSyncResult | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<Awaited<ReturnType<typeof getOrderSyncStatus>>['data'] | null>(null);

  const selectedConn = useMemo(
    () => connections.find((c) => c.id === connectionId) ?? null,
    [connections, connectionId]
  );

  useEffect(() => {
    listOrganizations()
      .then((res) => {
        const orgs = (res.data ?? []).map((o: any) => ({ id: String(o.id), name: o.name }));
        setOrganizations(orgs);
        setOrganizationId((prev) => prev || (orgs[0]?.id ?? ''));
      })
      .catch(() => toast.error('Failed to load organizations'));
  }, []);

  const loadConnections = useCallback(async () => {
    if (!organizationId) return;
    setLoadingConns(true);
    try {
      const res = await listOrderSyncConnections({ organizationId });
      setConnections(res.data ?? []);
      setConnectionId((prev) =>
        prev && res.data.some((c) => c.id === prev) ? prev : (res.data[0]?.id ?? '')
      );
    } catch {
      toast.error('Failed to load channel connections');
    } finally {
      setLoadingConns(false);
    }
  }, [organizationId]);

  const loadSyncStatus = useCallback(async () => {
    if (!organizationId) return;
    try {
      const res = await getOrderSyncStatus({ organizationId });
      setSyncStatus(res.data);
    } catch {
      setSyncStatus(null);
    }
  }, [organizationId]);

  useEffect(() => {
    void loadConnections();
    void loadSyncStatus();
  }, [loadConnections, loadSyncStatus]);

  const connState = connectionId ? syncStatus?.connections?.[connectionId] : undefined;

  const previewColumns = useMemo<ColumnDef<OrderSyncPreview['orders'][number]>[]>(() => [
    {
      id: 'ref',
      header: 'Channel ref',
      accessorFn: (o) => `${o.externalNumber ?? o.externalId} ${o.orderNumber}`,
      cell: ({ row }) => (
        <div>
          <span className="font-medium">{row.original.externalNumber ?? row.original.externalId}</span>
          <span className="block text-xs text-muted-foreground">{row.original.orderNumber}</span>
        </div>
      )
    },
    {
      id: 'date',
      header: 'Date',
      accessorFn: (o) => o.orderDate,
      cell: ({ row }) => new Date(row.original.orderDate).toLocaleDateString('en-GB')
    },
    { id: 'customer', header: 'Customer', accessorFn: (o) => o.customerEmail ?? '—' },
    {
      id: 'total',
      header: 'Total',
      accessorFn: (o) => o.total,
      cell: ({ row }) => money(row.original.total, row.original.currency)
    },
    { id: 'status', header: 'Status', accessorFn: (o) => o.status.replace(/_/g, ' ') },
    { id: 'payment', header: 'Payment', accessorFn: (o) => o.paymentStatus.replace(/_/g, ' ') },
    { id: 'lines', header: 'Lines', accessorFn: (o) => o.lineCount }
  ], []);

  const buildPayload = () => ({
    organizationId,
    connectionId,
    from: new Date(`${from}T00:00:00`).toISOString(),
    to: new Date(`${to}T23:59:59`).toISOString(),
    includeVoided,
    createCustomers,
    importPayments,
    updateExisting
  });

  const handlePreview = async () => {
    if (!connectionId) return toast.error('Select a channel first');
    setPreviewing(true);
    setResult(null);
    setSyncError(null);
    try {
      const res = await previewOrderSync(buildPayload());
      setPreview(res.data);
      toast.success(`Found ${res.data.totalOrders} orders`);
    } catch (err: any) {
      const message = err?.response?.data?.error?.message ?? 'Preview failed';
      setPreview(null);
      setSyncError(message);
      toast.error(message);
    } finally {
      setPreviewing(false);
    }
  };

  const handleImport = async () => {
    if (!connectionId) return toast.error('Select a channel first');
    setImporting(true);
    setSyncError(null);
    try {
      const res = await runOrderSync(buildPayload());
      setResult(res.data);
      void loadSyncStatus();
      const r = res.data;
      toast.success(
        `Sync complete: ${r.ordersCreated} new, ${r.ordersUpdated} updated, ${r.paymentsCreated} payments`
      );
    } catch (err: any) {
      const message = err?.response?.data?.error?.message ?? 'Import failed';
      setSyncError(message);
      toast.error(message);
    } finally {
      setImporting(false);
    }
  };

  if (!hydrated) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 lg:ml-[280px] p-8">
          <Loader2 className="animate-spin text-muted-foreground" />
        </main>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 lg:ml-[280px] p-8">
          <p className="text-muted-foreground">You do not have permission to sync channel orders.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 lg:ml-[280px]">
        <Header title="Orders · Channel Sync" />
        <div className="p-6 space-y-6 max-w-7xl">
          <div className="rounded-xl border bg-card p-5">
            <h2 className="text-lg font-semibold">Pull orders &amp; payments from your sales channels</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Imports completed till sales from your Good Till EPOS and web orders from your linked
              WooCommerce/WordPress stores into the Orders section, together with the payments taken
              against them. Re-running is safe — existing orders are matched on their channel
              reference and updated rather than duplicated.
            </p>
          </div>

          {/* Source selection */}
          <div className="grid gap-4 sm:grid-cols-2 max-w-3xl">
            <label className="block text-sm font-medium">
              Organization
              <select
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={organizationId}
                onChange={(e) => setOrganizationId(e.target.value)}
              >
                {organizations.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium">
              Channel
              <div className="mt-1 flex gap-2">
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={connectionId}
                  onChange={(e) => { setConnectionId(e.target.value); setPreview(null); setResult(null); }}
                >
                  <option value="">Select channel…</option>
                  {connections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.kind === 'pos' ? 'POS' : 'Web'} · {c.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void loadConnections()}
                  disabled={loadingConns}
                  className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm"
                  title="Reload channels"
                >
                  {loadingConns ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                </button>
              </div>
            </label>
          </div>

          {selectedConn && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {selectedConn.kind === 'pos' ? <Store size={16} /> : <Monitor size={16} />}
              <span>
                {selectedConn.kind === 'pos' ? 'Good Till EPOS' : 'WooCommerce store'}
                {selectedConn.storeUrl ? ` · ${selectedConn.storeUrl}` : ''}
              </span>
              <span>
                · Last synced{' '}
                {connState?.lastSyncedAt
                  ? `${new Date(connState.lastSyncedAt).toLocaleString('en-GB')} (${connState.lastTrigger === 'cron' ? 'automatic' : 'manual'})`
                  : 'never recorded'}
              </span>
            </div>
          )}

          {syncStatus && (
            <div className={`rounded-lg border p-3 text-sm max-w-3xl ${syncStatus.cronEnabled ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30' : 'bg-muted/40'}`}>
              {syncStatus.cronEnabled
                ? `Automatic incremental sync is ON — every ${syncStatus.intervalMinutes} minutes, new and changed orders since the last run are pulled from all active channels.`
                : 'Automatic incremental sync is OFF. Set CHANNEL_SYNC_CRON=on on the API server to pull new orders every 15 minutes; manual sync below always works.'}
              {connState?.lastCronError && (
                <p className="mt-1 text-red-700 dark:text-red-300">Last automatic run for this channel failed: {connState.lastCronError}</p>
              )}
            </div>
          )}

          {syncError && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300 max-w-4xl">
              <p className="inline-flex items-center gap-2 font-medium"><AlertTriangle size={16} /> Sync failed</p>
              <p className="mt-1 break-words">{syncError}</p>
            </div>
          )}

          {/* Options */}
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block text-sm font-medium">
                From
                <input
                  type="date"
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </label>
              <label className="block text-sm font-medium">
                To
                <input
                  type="date"
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={importPayments} onChange={(e) => setImportPayments(e.target.checked)} />
                Import payments
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={createCustomers} onChange={(e) => setCreateCustomers(e.target.checked)} />
                Create/link customers
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={updateExisting} onChange={(e) => setUpdateExisting(e.target.checked)} />
                Update existing orders
              </label>
              {selectedConn?.kind === 'pos' && (
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={includeVoided} onChange={(e) => setIncludeVoided(e.target.checked)} />
                  Include voided sales
                </label>
              )}
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={handlePreview}
                disabled={previewing || importing || !connectionId}
                className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm disabled:opacity-50"
              >
                {previewing ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                Preview
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={importing || previewing || !connectionId}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
              >
                {importing ? <Loader2 size={16} className="animate-spin" /> : <ArrowDownToLine size={16} />}
                {importing ? 'Importing…' : 'Import orders & payments'}
              </button>
            </div>
          </div>

          {/* Preview */}
          {preview && (
            <div className="rounded-xl border bg-card">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b p-5 text-sm">
                <span className="inline-flex items-center gap-2 font-medium">
                  <ShoppingCart size={16} /> {preview.totalOrders} orders
                </span>
                <span className="text-muted-foreground">{preview.totalLines} line items</span>
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <CreditCard size={14} /> {preview.totalPayments} payments
                </span>
                <span className="text-muted-foreground">
                  Order value {money(preview.totalValue, preview.currency)}
                </span>
                <span className="text-muted-foreground">
                  Payments {money(preview.paymentsTotal, preview.currency)}
                </span>
              </div>

              {Object.keys(preview.byStatus).length > 0 && (
                <div className="flex flex-wrap gap-2 border-b p-5">
                  {Object.entries(preview.byStatus).map(([status, count]) => (
                    <span key={status} className="rounded-full bg-muted px-3 py-1 text-xs">
                      {status.replace(/_/g, ' ')}: <strong>{count}</strong>
                    </span>
                  ))}
                </div>
              )}

              <div className="p-2">
                <RichDataTable columns={previewColumns} data={preview.orders} searchPlaceholder="Search ref, customer, status…" />
              </div>
              {preview.totalOrders > preview.orders.length && (
                <p className="border-t p-4 text-xs text-muted-foreground">
                  Showing the first {preview.orders.length} of {preview.totalOrders} orders. All of
                  them will be imported.
                </p>
              )}
            </div>
          )}

          {/* Import result */}
          {result && (
            <div className="rounded-xl border bg-card p-5 space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-600" />
                <h3 className="font-semibold">
                  Imported from {result.connection.name} · {result.fetched} orders fetched
                </h3>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {Object.entries(STAT_LABELS).map(([key, label]) => {
                  const value = (result as unknown as Record<string, number>)[key] ?? 0;
                  return (
                    <div key={key} className="rounded-lg border p-3">
                      <p className="text-2xl font-semibold">{value}</p>
                      <p className="text-xs text-muted-foreground">{label}</p>
                    </div>
                  );
                })}
              </div>

              {result.linesUnmatched > 0 && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:bg-amber-950/30">
                  <p className="inline-flex items-center gap-2 font-medium text-amber-800 dark:text-amber-200">
                    <AlertTriangle size={16} />
                    {result.linesUnmatched} line item(s) skipped — no catalog product matched the SKU
                  </p>
                  <p className="mt-1 text-amber-800/80 dark:text-amber-200/80">
                    The orders and payments were still imported; only the item breakdown is missing.
                    Import these products into the catalog, then re-run the sync to backfill the lines.
                  </p>
                  {result.unmatchedSkus.length > 0 && (
                    <p className="mt-2 break-all font-mono text-xs text-amber-900/80 dark:text-amber-200/70">
                      {result.unmatchedSkus.join(', ')}
                    </p>
                  )}
                </div>
              )}

              {result.errors.length > 0 && (
                <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm dark:bg-red-950/30">
                  <p className="font-medium text-red-700 dark:text-red-300">
                    {result.errors.length} order(s) failed
                  </p>
                  <ul className="mt-2 space-y-1 text-red-700/90 dark:text-red-300/80">
                    {result.errors.slice(0, 10).map((e, i) => (
                      <li key={i}>· {e.order}: {e.message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
