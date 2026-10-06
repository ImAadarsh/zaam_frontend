'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { StatCard } from '@/components/stat-card';
import { useSession } from '@/hooks/use-session';
import { useRoleCheck } from '@/hooks/use-role-check';
import { listWarehouses, listStockItems, listSuppliers, listPurchaseOrders, listGRN, listStockAdjustments, listStockTransfers } from '@/lib/api';
import { Warehouse, Package, ShoppingCart, TrendingUp, AlertTriangle, Boxes, PackageCheck, ArrowRightLeft } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DateRangeFilter, rangeForPreset, inRange, bucketsForRange, bucketKey, type DateRange } from '@/components/date-range-filter';

const OUTBOUND_ADJUSTMENTS = new Set(['decrease', 'write_off', 'damaged']);

export default function InventoryDashboard() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const { hasAccess } = useRoleCheck(['ADMIN', 'SUPER_ADMIN', 'WAREHOUSE_MANAGER']);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<DateRange>(() => rangeForPreset('30d'));
  const [raw, setRaw] = useState<{
    warehouses: any[];
    stockItems: any[];
    suppliers: any[];
    purchaseOrders: any[];
    grns: any[];
    adjustments: any[];
    transfers: any[];
  }>({ warehouses: [], stockItems: [], suppliers: [], purchaseOrders: [], grns: [], adjustments: [], transfers: [] });

  useEffect(() => {
    if (!hydrated || !hasAccess) return;
    if (!session?.accessToken) {
      router.replace('/login');
      return;
    }
    (async () => {
      try {
        const settle = <T,>(p: Promise<{ data: T[] }>) => p.then((r) => r.data || []).catch(() => [] as T[]);
        const [warehouses, stockItems, suppliers, purchaseOrders, grns, adjustments, transfers] = await Promise.all([
          settle(listWarehouses()),
          settle(listStockItems()),
          settle(listSuppliers()),
          settle(listPurchaseOrders()),
          settle(listGRN()),
          settle(listStockAdjustments()),
          settle(listStockTransfers())
        ]);
        setRaw({ warehouses, stockItems, suppliers, purchaseOrders, grns, adjustments, transfers });
      } catch (e: any) {
        console.error('Failed to load inventory stats:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [hydrated, hasAccess, router, session?.accessToken, session?.user?.organizationId]);

  const stats = useMemo(() => {
    const { warehouses, stockItems, suppliers, purchaseOrders, grns, adjustments, transfers } = raw;
    const posInRange = purchaseOrders.filter((po: any) => inRange(po.orderDate || po.createdAt, range));
    const grnsInRange = grns.filter((g: any) => inRange(g.receivedDate || g.createdAt, range));
    return {
      totalWarehouses: warehouses.length,
      totalStockItems: stockItems.length,
      totalSuppliers: suppliers.length,
      purchaseOrdersInRange: posInRange.length,
      draftPurchaseOrders: posInRange.filter((po: any) => po.status === 'draft').length,
      lowStockItems: stockItems.filter(
        (item: any) => item.quantityAvailable <= item.reorderPoint && item.quantityAvailable > 0
      ).length,
      totalValue: stockItems.reduce(
        (sum: number, item: any) => sum + Number(item.quantityOnHand || 0) * Number(item.costPrice || 0),
        0
      ),
      grnsInRange: grnsInRange.length,
      unitsReceived: grnsInRange.reduce(
        (sum: number, g: any) => sum + (g.lines || []).reduce((s: number, l: any) => s + Number(l.quantityReceived || 0), 0),
        0
      ),
      transfersInRange: transfers.filter((t: any) => inRange(t.transferDate || t.createdAt, range)).length,
      adjustmentsInRange: adjustments.filter((a: any) => inRange(a.adjustmentDate || a.createdAt, range)).length
    };
  }, [raw, range]);

  const chartData = useMemo(() => {
    const buckets = bucketsForRange(range).map((b) => ({ key: b.key, name: b.label, inbound: 0, outbound: 0, transfers: 0 }));
    const byKey = new Map(buckets.map((b) => [b.key, b]));
    const add = (date: string | null | undefined, field: 'inbound' | 'outbound' | 'transfers', qty: number) => {
      if (!date || !inRange(date, range) || !qty) return;
      const b = byKey.get(bucketKey(date, range));
      if (b) b[field] += qty;
    };
    raw.grns.forEach((g: any) =>
      add(g.receivedDate || g.createdAt, 'inbound', (g.lines || []).reduce((s: number, l: any) => s + Number(l.quantityReceived || 0), 0))
    );
    raw.adjustments.forEach((a: any) => {
      const qty = Number(a.quantityChange || 0);
      const outbound = OUTBOUND_ADJUSTMENTS.has(a.adjustmentType) || qty < 0;
      add(a.adjustmentDate || a.createdAt, outbound ? 'outbound' : 'inbound', Math.abs(qty));
    });
    raw.transfers.forEach((t: any) =>
      add(t.transferDate || t.createdAt, 'transfers', (t.lines || []).reduce((s: number, l: any) => s + Number(l.quantitySent || 0), 0))
    );
    return buckets;
  }, [raw, range]);

  if (!hydrated || loading) {
    return (
      <div className="min-h-screen app-surface">
        <Sidebar />
        <div className="flex flex-col overflow-hidden lg:ml-[280px]">
          <Header title="Inventory · Dashboard" />
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
          <Header title="Inventory · Dashboard" />
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
        <Header title="Inventory · Dashboard" />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold mb-2">Inventory Overview</h1>
                <p className="text-muted-foreground">Manage warehouses, stock, suppliers, and purchase orders</p>
              </div>
              <DateRangeFilter value={range} onChange={setRange} />
            </div>

            <motion.div 
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              initial="hidden"
              animate="show"
              variants={{
                hidden: { opacity: 0 },
                show: { opacity: 1, transition: { staggerChildren: 0.1 } }
              }}
            >
              <Link href="/inventory/warehouses">
                <StatCard
                  title="Warehouses"
                  value={stats.totalWarehouses.toString()}
                  icon={<Warehouse className="h-5 w-5" />}
                  hint="Total warehouses"
                />
              </Link>
              <Link href="/inventory/stock-items">
                <StatCard
                  title="Stock Items"
                  value={stats.totalStockItems.toString()}
                  icon={<Package className="h-5 w-5" />}
                  hint="Total stock items"
                />
              </Link>
              <Link href="/inventory/suppliers">
                <StatCard
                  title="Suppliers"
                  value={stats.totalSuppliers.toString()}
                  icon={<ShoppingCart className="h-5 w-5" />}
                  hint="Active suppliers"
                />
              </Link>
              <Link href="/inventory/purchase-orders">
                <StatCard
                  title="Purchase Orders"
                  value={stats.purchaseOrdersInRange.toString()}
                  icon={<TrendingUp className="h-5 w-5" />}
                  hint={`${stats.draftPurchaseOrders} draft · in selected period`}
                />
              </Link>
              <StatCard
                title="Low Stock"
                value={stats.lowStockItems.toString()}
                icon={<AlertTriangle className="h-5 w-5" />}
                hint="Items below reorder point"
              />
              <StatCard
                title="Total Value"
                value={`£${stats.totalValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                icon={<Boxes className="h-5 w-5" />}
                hint="Inventory value at cost"
              />
              <Link href="/inventory/grn">
                <StatCard
                  title="Goods Received"
                  value={stats.unitsReceived.toLocaleString('en-GB')}
                  icon={<PackageCheck className="h-5 w-5" />}
                  hint={`${stats.grnsInRange} GRN(s) in selected period`}
                />
              </Link>
              <Link href="/inventory/stock-transfers">
                <StatCard
                  title="Stock Transfers"
                  value={stats.transfersInRange.toString()}
                  icon={<ArrowRightLeft className="h-5 w-5" />}
                  hint="Transfers in selected period"
                />
              </Link>
              <Link href="/inventory/stock-adjustments">
                <StatCard
                  title="Stock Adjustments"
                  value={stats.adjustmentsInRange.toString()}
                  icon={<Boxes className="h-5 w-5" />}
                  hint="Adjustments in selected period"
                />
              </Link>
            </motion.div>

            {/* Recharts Area */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mt-8 p-6 rounded-2xl border border-border/50 bg-card/50 backdrop-blur-xl"
            >
              <div className="mb-6">
                <h2 className="text-lg font-semibold tracking-tight">Stock Movements</h2>
                <p className="text-sm text-muted-foreground">
                  Units in (GRN receipts, positive adjustments) vs out (write-offs, damage, decreases) and transferred, {range.from} to {range.to}
                </p>
              </div>
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorInbound" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorOutbound" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="inbound" name="Inbound" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorInbound)" />
                    <Area type="monotone" dataKey="outbound" name="Outbound" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorOutbound)" />
                    <Area type="monotone" dataKey="transfers" name="Transfers" stroke="#10b981" strokeWidth={2} fillOpacity={0} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
              <Link
                href="/inventory/warehouses"
                className="group relative p-6 bg-card rounded-2xl border border-border/50 hover:border-primary/50 transition-all duration-300 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <h3 className="font-semibold mb-2 relative">Warehouses</h3>
                <p className="text-sm text-muted-foreground relative">Manage warehouse locations and settings</p>
              </Link>
              <Link
                href="/inventory/stock-items"
                className="group relative p-6 bg-card rounded-2xl border border-border/50 hover:border-primary/50 transition-all duration-300 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <h3 className="font-semibold mb-2 relative">Stock Items</h3>
                <p className="text-sm text-muted-foreground relative">View and manage inventory levels</p>
              </Link>
              <Link
                href="/inventory/suppliers"
                className="group relative p-6 bg-card rounded-2xl border border-border/50 hover:border-primary/50 transition-all duration-300 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <h3 className="font-semibold mb-2 relative">Suppliers</h3>
                <p className="text-sm text-muted-foreground relative">Manage supplier information</p>
              </Link>
              <Link
                href="/inventory/purchase-orders"
                className="group relative p-6 bg-card rounded-2xl border border-border/50 hover:border-primary/50 transition-all duration-300 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <h3 className="font-semibold mb-2 relative">Purchase Orders</h3>
                <p className="text-sm text-muted-foreground relative">Create and track purchase orders</p>
              </Link>
              <Link
                href="/inventory/bins"
                className="group relative p-6 bg-card rounded-2xl border border-border/50 hover:border-primary/50 transition-all duration-300 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <h3 className="font-semibold mb-2 relative">Bins</h3>
                <p className="text-sm text-muted-foreground relative">Manage storage bins and locations</p>
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

