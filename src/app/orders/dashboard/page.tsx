'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { StatCard } from '@/components/stat-card';
import { DateRangeFilter, rangeForPreset, inRange, bucketsForRange, bucketKey, type DateRange } from '@/components/date-range-filter';
import { useSession } from '@/hooks/use-session';
import { useRoleCheck } from '@/hooks/use-role-check';
import { listCustomers, listOrders, listReturns } from '@/lib/api';
import { Users, ShoppingCart, RotateCcw, DollarSign, AlertCircle, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const COLORS = ['#D4A017', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#E5B84A', '#64748b', '#f97316'];
const tooltipStyle = { backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' };
const gbp = (n: number) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const isRevenue = (o: any) => !['cancelled', 'refunded'].includes(o.status);

export default function OrdersDashboard() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const { hasAccess } = useRoleCheck(['ADMIN', 'SUPER_ADMIN', 'SALES_REP', 'CUSTOMER_SERVICE']);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [returns, setReturns] = useState<any[]>([]);
  const [customerCount, setCustomerCount] = useState(0);
  const [range, setRange] = useState<DateRange>(() => rangeForPreset('30d'));
  const [channel, setChannel] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!hydrated || !hasAccess) return;
    if (!session?.accessToken) {
      router.replace('/login');
      return;
    }
    (async () => {
      try {
        const organizationId = session?.user?.organizationId;
        const [customersRes, ordersRes, returnsRes] = await Promise.all([
          listCustomers({ organizationId, limit: 1 }),
          listOrders({ organizationId }),
          listReturns({ organizationId })
        ]);
        setCustomerCount(customersRes.pagination?.total ?? customersRes.data?.length ?? 0);
        setOrders(ordersRes.data || []);
        setReturns(returnsRes.data || []);
      } catch (e: any) {
        console.error('Failed to load orders stats:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [hydrated, hasAccess, router, session?.accessToken, session?.user?.organizationId]);

  const channels = useMemo(() => Array.from(new Set(orders.map((o) => o.channel).filter(Boolean))).sort(), [orders]);
  const statuses = useMemo(() => Array.from(new Set(orders.map((o) => o.status).filter(Boolean))).sort(), [orders]);

  const view = useMemo(() => {
    const filtered = orders.filter((o) =>
      inRange(o.orderDate || o.createdAt, range) && (!channel || o.channel === channel) && (!status || o.status === status)
    );
    const rets = returns.filter((r) => inRange(r.returnDate || r.createdAt, range));
    const buckets = bucketsForRange(range).map((b) => ({ ...b, orders: 0, revenue: 0, returns: 0 }));
    const byKey = new Map(buckets.map((b) => [b.key, b]));
    const byChannel = new Map<string, { name: string; orders: number; revenue: number }>();
    const byStatus = new Map<string, number>();
    let revenue = 0;
    for (const o of filtered) {
      const total = Number(o.total || 0);
      const b = byKey.get(bucketKey(o.orderDate || o.createdAt, range));
      if (b) {
        b.orders += 1;
        if (isRevenue(o)) b.revenue += total;
      }
      byStatus.set(o.status, (byStatus.get(o.status) || 0) + 1);
      const ch = byChannel.get(o.channel) || { name: o.channel, orders: 0, revenue: 0 };
      ch.orders += 1;
      if (isRevenue(o)) {
        ch.revenue += total;
        revenue += total;
      }
      byChannel.set(o.channel, ch);
    }
    for (const r of rets) {
      const b = byKey.get(bucketKey(r.returnDate || r.createdAt, range));
      if (b) b.returns += 1;
    }
    const revenueOrders = filtered.filter(isRevenue).length;
    return {
      count: filtered.length,
      pending: filtered.filter((o) => ['pending', 'confirmed', 'processing', 'on_hold'].includes(o.status)).length,
      revenue,
      aov: revenueOrders ? revenue / revenueOrders : 0,
      returns: rets.length,
      pendingReturns: rets.filter((r) => r.status === 'requested' || r.status === 'approved').length,
      timeline: buckets.map((b) => ({ label: b.label, orders: b.orders, revenue: Number(b.revenue.toFixed(2)), returns: b.returns })),
      channels: Array.from(byChannel.values()).sort((a, b) => b.revenue - a.revenue).map((c) => ({ ...c, revenue: Number(c.revenue.toFixed(2)) })),
      statuses: Array.from(byStatus.entries()).map(([name, value]) => ({ name, value }))
    };
  }, [orders, returns, range, channel, status]);

  if (!hydrated || loading) {
    return (
      <div className="min-h-screen app-surface">
        <Sidebar />
        <div className="flex flex-col overflow-hidden lg:ml-[280px]">
          <Header title="Orders · Dashboard" />
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
          <Header title="Orders · Dashboard" />
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
        <Header title="Orders · Dashboard" />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold mb-2">Orders Overview</h1>
                <p className="text-muted-foreground">Sales, channels and returns for the selected period</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select className="input !h-9 !w-auto text-xs" value={channel} onChange={(e) => setChannel(e.target.value)}>
                  <option value="">All channels</option>
                  {channels.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select className="input !h-9 !w-auto text-xs" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="">All statuses</option>
                  {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <DateRangeFilter value={range} onChange={setRange} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Link href="/orders/customers">
                <StatCard title="Customers" value={customerCount.toString()} icon={<Users className="h-5 w-5" />} hint="Total customers" />
              </Link>
              <Link href="/orders/orders">
                <StatCard title="Orders" value={view.count.toString()} icon={<ShoppingCart className="h-5 w-5" />} hint="In selected period" />
              </Link>
              <Link href="/orders/orders?status=pending">
                <StatCard title="Open Orders" value={view.pending.toString()} icon={<AlertCircle className="h-5 w-5" />} hint="Pending, confirmed, processing or on hold" />
              </Link>
              <StatCard title="Revenue" value={gbp(view.revenue)} icon={<DollarSign className="h-5 w-5" />} hint="Excludes cancelled and refunded orders" />
              <StatCard title="Average Order" value={gbp(view.aov)} icon={<TrendingUp className="h-5 w-5" />} hint="Revenue ÷ revenue-bearing orders" />
              <Link href="/orders/returns">
                <StatCard title="Returns" value={view.returns.toString()} icon={<RotateCcw className="h-5 w-5" />} hint={`${view.pendingReturns} awaiting action`} />
              </Link>
            </div>

            <div className="p-6 rounded-2xl border border-border/50 bg-card/50">
              <div className="mb-4">
                <h2 className="text-lg font-semibold tracking-tight">Revenue over time</h2>
                <p className="text-sm text-muted-foreground">{range.from} to {range.to}</p>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={view.timeline} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#D4A017" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#D4A017" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => gbp(Number(v))} />
                    <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#D4A017" strokeWidth={2} fill="url(#colorRevenue)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="p-6 rounded-2xl border border-border/50 bg-card/50">
                <h2 className="text-lg font-semibold tracking-tight mb-4">Orders & returns per {view.timeline[0]?.label.length === 5 ? 'day' : 'month'}</h2>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={view.timeline}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend />
                      <Bar dataKey="orders" name="Orders" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="returns" name="Returns" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="p-6 rounded-2xl border border-border/50 bg-card/50">
                <h2 className="text-lg font-semibold tracking-tight mb-4">Revenue by channel</h2>
                <div className="h-[280px]">
                  {view.channels.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No orders in this period</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={view.channels} layout="vertical" margin={{ left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                        <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                        <YAxis type="category" dataKey="name" width={100} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                        <Tooltip contentStyle={tooltipStyle} formatter={(v: any, n: any) => (n === 'Revenue' ? gbp(Number(v)) : v)} />
                        <Bar dataKey="revenue" name="Revenue" fill="#D4A017" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
              <div className="p-6 rounded-2xl border border-border/50 bg-card/50 xl:col-span-2">
                <h2 className="text-lg font-semibold tracking-tight mb-4">Order status</h2>
                <div className="h-[280px]">
                  {view.statuses.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No orders in this period</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={view.statuses} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={2}>
                          {view.statuses.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Link href="/orders/customers" className="group relative p-6 bg-card rounded-2xl border border-border/50 hover:border-primary/50 transition-all duration-300 overflow-hidden">
                <h3 className="font-semibold mb-2 relative">Customers</h3>
                <p className="text-sm text-muted-foreground relative">Manage customer information and addresses</p>
              </Link>
              <Link href="/orders/orders" className="group relative p-6 bg-card rounded-2xl border border-border/50 hover:border-primary/50 transition-all duration-300 overflow-hidden">
                <h3 className="font-semibold mb-2 relative">Orders</h3>
                <p className="text-sm text-muted-foreground relative">View and manage sales orders from all channels</p>
              </Link>
              <Link href="/orders/returns" className="group relative p-6 bg-card rounded-2xl border border-border/50 hover:border-primary/50 transition-all duration-300 overflow-hidden">
                <h3 className="font-semibold mb-2 relative">Returns</h3>
                <p className="text-sm text-muted-foreground relative">Process returns and refunds</p>
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
