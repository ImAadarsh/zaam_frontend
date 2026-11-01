'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import {
  DollarSign, ShoppingBag, Warehouse, Store, Landmark, MessageSquare,
  Truck, Megaphone, Users, Share2, MonitorSmartphone, Plug, AlertCircle, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { useSession } from '@/hooks/use-session';
import { DateRangeFilter, rangeForPreset, type DateRange } from '@/components/date-range-filter';
import { getGlobalDashboard, type GlobalDashboardPayload } from '@/lib/api';
import { allowedPagesFromSession, canAccessPath } from '@/lib/page-access';

const GOLD = '#D4A017';
const GOLD_SOFT = '#E5B84A';
const tooltipStyle = { backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' };
const gbp = (n: number | null | undefined) =>
  n == null ? '—' : `£${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const qty = (n: number | null | undefined) =>
  n == null ? '—' : Number(n).toLocaleString('en-GB');

function Delta({ pct }: { pct: number | null | undefined }) {
  if (pct == null) return <span className="text-xs text-muted-foreground">vs prior</span>;
  const up = pct >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${up ? 'text-emerald-600' : 'text-red-600'}`}>
      <Icon size={14} />
      {Math.abs(pct).toFixed(1)}% vs prior
    </span>
  );
}

function SectionShell({
  title, href, icon, children, empty, error, loading
}: {
  title: string;
  href?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  empty?: boolean;
  error?: string;
  loading?: boolean;
}) {
  return (
    <section className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-xl overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border/40">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-lg bg-muted text-primary">{icon}</div>
          <h2 className="text-sm font-semibold uppercase tracking-wider truncate">{title}</h2>
        </div>
        {href && (
          <Link href={href} className="text-xs text-primary hover:underline shrink-0">
            Open module →
          </Link>
        )}
      </div>
      <div className="p-5">
        {loading && <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>}
        {!loading && error && (
          <div className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {!loading && !error && empty && (
          <div className="text-sm text-muted-foreground py-6 text-center">No data for this period yet.</div>
        )}
        {!loading && !error && !empty && children}
      </div>
    </section>
  );
}

function Metric({ label, value, hint, href }: { label: string; value: string; hint?: React.ReactNode; href?: string }) {
  const inner = (
    <div className="space-y-1">
      <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-bold tracking-tight text-foreground">{value}</div>
      {hint && <div>{hint}</div>}
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="block rounded-xl border border-border/60 bg-background/40 p-4 hover:border-primary/40 transition-colors">
        {inner}
      </Link>
    );
  }
  return <div className="rounded-xl border border-border/60 bg-background/40 p-4">{inner}</div>;
}

export default function DashboardPage() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const [range, setRange] = useState<DateRange>(() => rangeForPreset('30d'));
  const [payload, setPayload] = useState<GlobalDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const allowedPages = useMemo(() => allowedPagesFromSession(session), [session]);
  const linkIf = useCallback(
    (href: string) => (canAccessPath(href, allowedPages) ? href : undefined),
    [allowedPages]
  );

  useEffect(() => {
    if (hydrated && !session?.accessToken) router.replace('/login');
  }, [hydrated, session?.accessToken, router]);

  useEffect(() => {
    if (!hydrated || !session?.accessToken) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const apiRange =
      range.preset === 'today' || range.preset === '7d' || range.preset === '30d' || range.preset === 'mtd'
        ? range.preset
        : 'custom';
    getGlobalDashboard({
      organizationId: session.user.organizationId,
      range: apiRange,
      from: range.from,
      to: range.to
    })
      .then((res) => {
        if (!cancelled) setPayload(res.data);
      })
      .catch((e: any) => {
        if (!cancelled) {
          setPayload(null);
          setError(e?.response?.data?.error?.message || e?.message || 'Failed to load dashboard');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hydrated, session?.accessToken, session?.user?.organizationId, range.from, range.to, range.preset]);

  const s = payload?.sections || {};
  const h = payload?.headline;
  const sales = s.sales?.available ? s.sales.data : null;
  const inventory = s.inventory?.available ? s.inventory.data : null;
  const b2b = s.b2b?.available ? s.b2b.data : null;
  const finance = s.finance?.available ? s.finance.data : null;
  const crm = s.crm?.available ? s.crm.data : null;
  const fulfillment = s.fulfillment?.available ? s.fulfillment.data : null;
  const marketing = s.marketing?.available ? s.marketing.data : null;
  const hr = s.hr?.available ? s.hr.data : null;
  const social = s.social?.available ? s.social.data : null;
  const pos = s.pos?.available ? s.pos.data : null;
  const channels = s.channels?.available ? s.channels.data : null;

  const anySection = Object.values(s).some((x) => x?.available);

  return (
    <div className="min-h-screen app-surface">
      <Sidebar />
      <div className="flex flex-col min-w-0 lg:ml-[280px]">
        <Header title="Global Dashboard" />
        <main className="p-6 md:p-8 space-y-6 flex-1 overflow-auto">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Business pulse</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Live KPIs across modules you can access
                {payload?.asOf ? ` · updated ${new Date(payload.asOf).toLocaleTimeString('en-GB')}` : ''}
              </p>
            </div>
            <DateRangeFilter
              value={range}
              onChange={setRange}
              presets={['today', '7d', '30d', 'mtd']}
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Headline balance strip */}
          <motion.div
            className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-6"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Metric
              label="Revenue"
              value={loading ? '…' : gbp(h?.revenue)}
              hint={<Delta pct={h?.revenueChangePct} />}
              href={linkIf('/orders/dashboard')}
            />
            <Metric label="Orders" value={loading ? '…' : qty(h?.orders)} href={linkIf('/orders/orders')} />
            <Metric label="Cash" value={loading ? '…' : gbp(h?.cash)} href={linkIf('/finance/dashboard')} />
            <Metric label="Outstanding AR" value={loading ? '…' : gbp(h?.outstandingAr)} href={linkIf('/finance/invoices')} />
            <Metric label="Stock value" value={loading ? '…' : gbp(h?.stockValue)} href={linkIf('/inventory/dashboard')} />
            <Metric
              label="Net position"
              value={loading ? '…' : gbp(h?.netPosition)}
              hint={<span className="text-xs text-muted-foreground">Cash + AR − AP</span>}
              href={linkIf('/finance/dashboard')}
            />
          </motion.div>

          {!loading && !error && !anySection && (
            <div className="p-6 rounded-2xl border border-border/50 bg-card/50 text-sm text-muted-foreground">
              Open a module from <Link href="/modules" className="underline">Modules</Link> to see figures for your role.
            </div>
          )}

          <div className="grid gap-6 grid-cols-1 xl:grid-cols-2">
            {s.sales?.available && (
              <SectionShell
                title="Sales & orders"
                href={linkIf('/orders/dashboard')}
                icon={<ShoppingBag size={18} />}
                loading={loading}
                error={s.sales.error}
                empty={sales?.empty}
              >
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                  <Metric label="Revenue" value={gbp(sales?.revenue)} hint={<Delta pct={sales?.revenueChangePct} />} />
                  <Metric label="Orders" value={qty(sales?.orders)} />
                  <Metric label="Open pipeline" value={qty(sales?.openPipeline)} />
                  <Metric label="AOV" value={gbp(sales?.aov)} />
                </div>
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={sales?.timeline || []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={GOLD} stopOpacity={0.35} />
                          <stop offset="95%" stopColor={GOLD} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `£${v}`} width={48} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => gbp(Number(v))} />
                      <Area type="monotone" dataKey="revenue" stroke={GOLD} strokeWidth={2.5} fill="url(#gRev)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                {(sales?.byChannel?.length ?? 0) > 0 && (
                  <div className="mt-5 h-[180px]">
                    <div className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Revenue by channel</div>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={sales.byChannel.slice(0, 8)} layout="vertical" margin={{ left: 8, right: 16 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                        <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `£${v}`} />
                        <YAxis type="category" dataKey="channel" width={90} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                        <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => gbp(Number(v))} />
                        <Bar dataKey="revenue" radius={[0, 6, 6, 0]}>
                          {sales.byChannel.slice(0, 8).map((_: unknown, i: number) => (
                            <Cell key={i} fill={i % 2 ? GOLD_SOFT : GOLD} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </SectionShell>
            )}

            {s.finance?.available && (
              <SectionShell
                title="Finance · global balance"
                href={linkIf('/finance/dashboard')}
                icon={<Landmark size={18} />}
                loading={loading}
                error={s.finance.error}
                empty={finance?.empty}
              >
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Metric label="Cash" value={gbp(finance?.cash)} />
                  <Metric label="Money in" value={gbp(finance?.moneyIn)} hint={<span className="text-xs text-muted-foreground">{qty(finance?.paymentsCount)} payments</span>} />
                  <Metric label="Invoices issued" value={gbp(finance?.invoicesIssuedTotal)} hint={<span className="text-xs text-muted-foreground">{qty(finance?.invoicesIssued)} docs</span>} />
                  <Metric label="AR outstanding" value={gbp(finance?.openInvoices?.balance)} hint={<span className="text-xs text-muted-foreground">{qty(finance?.openInvoices?.count)} open</span>} href={linkIf('/finance/invoices')} />
                  <Metric label="AP outstanding" value={gbp(finance?.openBills?.balance)} hint={<span className="text-xs text-muted-foreground">{qty(finance?.openBills?.count)} bills</span>} />
                  <Metric label="Net position" value={gbp(finance?.netPosition)} />
                </div>
              </SectionShell>
            )}

            {s.inventory?.available && (
              <SectionShell
                title="Inventory health"
                href={linkIf('/inventory/dashboard')}
                icon={<Warehouse size={18} />}
                loading={loading}
                error={s.inventory.error}
                empty={inventory?.empty}
              >
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Metric label="Stock value" value={gbp(inventory?.stockValue)} />
                  <Metric label="On hand" value={qty(inventory?.onHand)} />
                  <Metric label="Available" value={qty(inventory?.available)} />
                  <Metric label="Reserved" value={qty(inventory?.reserved)} />
                  <Metric label="Low stock SKUs" value={qty(inventory?.lowStock)} href={linkIf('/inventory/stock')} />
                  <Metric label="Active products" value={qty(inventory?.activeProducts)} href={linkIf('/catalog/items')} />
                </div>
              </SectionShell>
            )}

            {s.b2b?.available && (
              <SectionShell
                title="B2B portal"
                href={linkIf('/b2b/dashboard')}
                icon={<Store size={18} />}
                loading={loading}
                error={s.b2b.error}
                empty={b2b?.empty}
              >
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Metric label="Retailers" value={qty(b2b?.retailers)} hint={<span className="text-xs text-muted-foreground">{qty(b2b?.activeRetailers)} active</span>} href={linkIf('/b2b/retailers')} />
                  <Metric label="GMV (range)" value={gbp(b2b?.gmv)} />
                  <Metric label="Orders" value={qty(b2b?.ordersInRange)} hint={<span className="text-xs text-muted-foreground">{qty(b2b?.openOrders)} open</span>} href={linkIf('/b2b/orders')} />
                  <Metric label="Credit limit" value={gbp(b2b?.creditLimit)} />
                  <Metric label="Credit used" value={gbp(b2b?.creditUsed)} />
                  <Metric label="Credit requests" value={qty(b2b?.pendingCreditRequests)} />
                </div>
              </SectionShell>
            )}

            {s.crm?.available && (
              <SectionShell
                title="CRM"
                href={linkIf('/crm/dashboard')}
                icon={<MessageSquare size={18} />}
                loading={loading}
                error={s.crm.error}
                empty={crm?.empty}
              >
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Metric label="Open tickets" value={qty(crm?.openTickets)} href={linkIf('/crm/tickets')} />
                  <Metric label="Open deals" value={qty(crm?.openDeals)} href={linkIf('/crm/pipeline')} />
                  <Metric label="Pipeline value" value={gbp(crm?.pipelineValue)} />
                  <Metric label="Leads" value={qty(crm?.leadsTotal)} href={linkIf('/crm/leads')} />
                  <Metric label="Overdue activities" value={qty(crm?.overdueActivities)} />
                </div>
                {crm?.leadsByStatus && Object.keys(crm.leadsByStatus).length > 0 && (
                  <div className="mt-4 space-y-2">
                    {Object.entries(crm.leadsByStatus as Record<string, number>).map(([status, count]) => (
                      <div key={status} className="flex items-center gap-3 text-xs">
                        <span className="w-24 capitalize text-muted-foreground">{status}</span>
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-primary/80 rounded-full"
                            style={{
                              width: `${Math.max(4, (Number(count) / Math.max(1, crm.leadsTotal || 1)) * 100)}%`
                            }}
                          />
                        </div>
                        <span className="w-8 text-right font-medium">{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </SectionShell>
            )}

            {s.fulfillment?.available && (
              <SectionShell
                title="Fulfillment"
                href={linkIf('/fulfillment/dashboard')}
                icon={<Truck size={18} />}
                loading={loading}
                error={s.fulfillment.error}
                empty={fulfillment?.empty}
              >
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Metric label="Active shipments" value={qty(fulfillment?.activeShipments)} href={linkIf('/fulfillment/shipments')} />
                  <Metric label="Created (range)" value={qty(fulfillment?.createdInRange)} />
                  <Metric label="Delivered (range)" value={qty(fulfillment?.deliveredInRange)} />
                </div>
              </SectionShell>
            )}

            {s.pos?.available && (
              <SectionShell
                title="POS / EPOS"
                href={linkIf('/orders/dashboard')}
                icon={<MonitorSmartphone size={18} />}
                loading={loading}
                error={s.pos.error}
                empty={pos?.empty}
              >
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Metric label="Till revenue" value={gbp(pos?.revenue)} />
                  <Metric label="Sales" value={qty(pos?.salesCount)} />
                  <Metric label="Registers" value={qty(pos?.registers)} />
                  <Metric label="Open shifts" value={qty(pos?.openShifts)} />
                </div>
              </SectionShell>
            )}

            {s.marketing?.available && (
              <SectionShell
                title="Marketing"
                href={linkIf('/marketing/dashboard')}
                icon={<Megaphone size={18} />}
                loading={loading}
                error={s.marketing.error}
                empty={marketing?.empty}
              >
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Metric label="Campaigns" value={qty(marketing?.campaigns)} hint={<span className="text-xs text-muted-foreground">{qty(marketing?.activeCampaigns)} active</span>} />
                  <Metric label="Coupons" value={qty(marketing?.coupons)} hint={<span className="text-xs text-muted-foreground">{qty(marketing?.activeCoupons)} active</span>} />
                  <Metric label="Affiliates" value={qty(marketing?.activeAffiliates)} href={linkIf('/marketing/affiliates')} />
                </div>
              </SectionShell>
            )}

            {s.hr?.available && (
              <SectionShell
                title="HR"
                href={linkIf('/hr/dashboard')}
                icon={<Users size={18} />}
                loading={loading}
                error={s.hr.error}
                empty={hr?.empty}
              >
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Metric label="Headcount" value={qty(hr?.headcount?.total)} />
                  <Metric label="Active" value={qty(hr?.headcount?.active)} />
                  <Metric label="Pending leave" value={qty(hr?.pendingLeaveRequests)} />
                  <Metric label="Open payroll" value={qty(hr?.openPayrollRuns)} />
                </div>
              </SectionShell>
            )}

            {s.social?.available && (
              <SectionShell
                title="Social"
                href={linkIf('/social/dashboard')}
                icon={<Share2 size={18} />}
                loading={loading}
                error={s.social.error}
                empty={social?.empty}
              >
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Metric label="Accounts" value={qty(social?.accounts)} />
                  <Metric label="Connected" value={qty(social?.connected)} />
                  <Metric label="Scheduled posts" value={qty(social?.scheduledPosts)} />
                </div>
              </SectionShell>
            )}

            {s.channels?.available && (
              <SectionShell
                title="Connected systems"
                href={linkIf('/catalog/channels')}
                icon={<Plug size={18} />}
                loading={loading}
                error={s.channels.error}
                empty={channels?.empty}
              >
                <div className="mb-3 text-sm text-muted-foreground">
                  {qty(channels?.active)} active of {qty(channels?.connections?.length)} connections
                </div>
                <ul className="divide-y divide-border/50">
                  {(channels?.connections || []).slice(0, 8).map((c: any) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{c.name}</div>
                        <div className="text-xs text-muted-foreground capitalize">{c.channel}</div>
                      </div>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          c.status === 'active' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {c.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </SectionShell>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
            <DollarSign size={12} className="text-primary" />
            Figures use live API data only — empty modules show empty states, not placeholders.
          </div>
        </main>
      </div>
    </div>
  );
}
