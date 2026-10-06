'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { StatCard } from '@/components/stat-card';
import { GatewayManager } from '@/components/finance/gateway-manager';
import { PaymentDetailModal } from '@/components/finance/payment-detail-modal';
import { useSession } from '@/hooks/use-session';
import { useRoleCheck } from '@/hooks/use-role-check';
import { getPaymentDashboard, getPayment } from '@/lib/api';
import { listAccLedgerAccounts, getTrialBalance } from '@/lib/accounting-api';
import { toast } from 'sonner';
import {
  CreditCard,
  Wallet,
  Activity,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Eye,
  Landmark,
  Banknote,
  Receipt
} from 'lucide-react';

type CoaBalance = {
  id: string;
  accountCode: string;
  accountName: string;
  group: 'bank' | 'cash' | 'receivable';
  debit: number;
  credit: number;
  balance: number;
};

const COA_GROUP_LABEL: Record<CoaBalance['group'], string> = {
  bank: 'Bank',
  cash: 'Cash',
  receivable: 'Receivable'
};

function gbp(n: number) {
  return `£${Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function coaGroup(a: { accountType?: string; accountSubtype?: string | null; accountName?: string }): CoaBalance['group'] | null {
  if (a.accountType !== 'asset') return null;
  const sub = String(a.accountSubtype || '').toLowerCase();
  const name = String(a.accountName || '').toLowerCase();
  if (sub === 'bank' || (!sub && name.includes('bank'))) return 'bank';
  if (sub === 'cash' || (!sub && name.includes('cash'))) return 'cash';
  if (sub === 'receivable' || name.includes('receivable') || name.includes('debtor')) return 'receivable';
  return null;
}

export default function PaymentDashboardPage() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const { hasAccess } = useRoleCheck(['ADMIN', 'SUPER_ADMIN', 'FINANCE']);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<any>({});
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [coa, setCoa] = useState<CoaBalance[]>([]);
  const [coaError, setCoaError] = useState<string | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const orgId = session?.user?.organizationId;

  const loadCoa = async (organizationId: string) => {
    try {
      const [ledger, tb] = await Promise.all([
        listAccLedgerAccounts(organizationId, { limit: 500 }),
        getTrialBalance(organizationId, { from: '2000-01-01', to: new Date().toISOString().slice(0, 10) })
      ]);
      const movements = new Map<string, { debit: number; credit: number }>();
      for (const r of (tb?.data?.accounts || []) as any[]) {
        movements.set(String(r.ledgerAccountId), { debit: Number(r.debit || 0), credit: Number(r.credit || 0) });
      }
      const rows: CoaBalance[] = [];
      for (const a of (ledger?.data || []) as any[]) {
        const group = coaGroup(a);
        if (!group || a.isActive === false) continue;
        const m = movements.get(String(a.id)) || { debit: 0, credit: 0 };
        rows.push({
          id: String(a.id),
          accountCode: a.accountCode,
          accountName: a.accountName,
          group,
          debit: m.debit,
          credit: m.credit,
          balance: m.debit - m.credit
        });
      }
      rows.sort((x, y) => String(x.accountCode).localeCompare(String(y.accountCode)));
      setCoa(rows);
      setCoaError(null);
    } catch (e: any) {
      setCoa([]);
      setCoaError(e?.response?.data?.error?.message || 'Chart of accounts balances unavailable');
    }
  };

  const load = async () => {
    if (!orgId) return;
    try {
      setLoading(true);
      const [res] = await Promise.all([getPaymentDashboard(orgId), loadCoa(orgId)]);
      setMetrics(res.data?.metrics || {});
      setRecentPayments(res.data?.recentPayments || []);
    } catch {
      toast.error('Failed to load payment dashboard');
    } finally {
      setLoading(false);
    }
  };

  const openPayment = async (p: any) => {
    setOpeningId(String(p.id));
    try {
      const res = await getPayment(String(p.id));
      setDetail(res.data || p);
    } catch {
      setDetail(p);
    } finally {
      setOpeningId(null);
    }
  };

  useEffect(() => {
    if (!hydrated || !hasAccess) return;
    if (!session?.accessToken) {
      router.replace('/login');
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, hasAccess, session?.accessToken, orgId]);

  if (!hydrated) return null;

  const total = (g: CoaBalance['group']) => coa.filter((r) => r.group === g).reduce((s, r) => s + r.balance, 0);

  return (
    <div className="min-h-screen app-surface">
      <Sidebar />
      <div className="flex flex-col overflow-hidden lg:ml-[280px]">
        <Header title="Finance · Payment Dashboard" />
        <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">Payment Dashboard</h1>
              <p className="text-sm text-muted-foreground">
                Cash, bank and receivable balances from the chart of accounts, alongside gateway payment activity.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={load}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-sm hover:bg-muted"
              >
                <RefreshCw size={16} /> Refresh
              </button>
              <Link
                href="/finance/gateways"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
              >
                Manage gateways
              </Link>
            </div>
          </div>

          {loading ? (
            <div className="text-muted-foreground">Loading...</div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard
                  title="Bank (ledger)"
                  value={gbp(total('bank'))}
                  hint={`${coa.filter((r) => r.group === 'bank').length} bank account(s) in COA`}
                  icon={<Landmark size={18} />}
                />
                <StatCard
                  title="Cash (ledger)"
                  value={gbp(total('cash'))}
                  hint={`${coa.filter((r) => r.group === 'cash').length} cash account(s) in COA`}
                  icon={<Banknote size={18} />}
                />
                <StatCard
                  title="Receivables (ledger)"
                  value={gbp(total('receivable'))}
                  hint="Owed by customers per posted journals"
                  icon={<Receipt size={18} />}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard
                  title="Active gateways"
                  value={String(metrics.gatewaysActive ?? 0)}
                  hint={`${metrics.gatewaysTotal ?? 0} total`}
                  icon={<Wallet size={18} />}
                />
                <StatCard
                  title="Completed volume"
                  value={gbp(Number(metrics.completedVolume || 0))}
                  hint={`${metrics.completedCount ?? 0} settled`}
                  icon={<CheckCircle2 size={18} />}
                />
                <StatCard
                  title="Pending"
                  value={String(metrics.pendingCount ?? 0)}
                  hint="Awaiting confirmation"
                  icon={<Activity size={18} />}
                />
                <StatCard
                  title="Failed"
                  value={String(metrics.failedCount ?? 0)}
                  hint="Provider / validation errors"
                  icon={<AlertTriangle size={18} />}
                />
              </div>

              <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-semibold flex items-center gap-2">
                    <Landmark size={18} /> Chart of accounts balances
                  </h2>
                  <Link href="/accounting/ledger?tab=tb" className="text-xs px-2 py-1 rounded-lg border hover:bg-muted">
                    Trial balance
                  </Link>
                </div>
                {coaError ? (
                  <p className="text-sm text-muted-foreground">{coaError}</p>
                ) : coa.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No cash, bank or receivable accounts found in the chart of accounts.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                          <th className="py-2 pr-3">Code</th>
                          <th className="py-2 pr-3">Account</th>
                          <th className="py-2 pr-3">Group</th>
                          <th className="py-2 pr-3 text-right">Debits</th>
                          <th className="py-2 pr-3 text-right">Credits</th>
                          <th className="py-2 text-right">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {coa.map((r) => (
                          <tr key={r.id} className="border-b border-border/50 last:border-0">
                            <td className="py-2 pr-3 font-mono text-xs">{r.accountCode}</td>
                            <td className="py-2 pr-3">{r.accountName}</td>
                            <td className="py-2 pr-3 text-muted-foreground">{COA_GROUP_LABEL[r.group]}</td>
                            <td className="py-2 pr-3 text-right tabular-nums">{gbp(r.debit)}</td>
                            <td className="py-2 pr-3 text-right tabular-nums">{gbp(r.credit)}</td>
                            <td className={`py-2 text-right font-semibold tabular-nums ${r.balance < 0 ? 'text-red-600' : ''}`}>
                              {gbp(r.balance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Balances are cumulative from posted journal entries (debits − credits).
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {orgId ? <GatewayManager organizationId={orgId} variant="summary" /> : null}

                <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-semibold flex items-center gap-2">
                      <CreditCard size={18} /> Recent payments
                    </h2>
                    <Link href="/finance/payments" className="text-xs px-2 py-1 rounded-lg border hover:bg-muted">
                      All payments
                    </Link>
                  </div>
                  <div className="space-y-2 max-h-[420px] overflow-auto">
                    {recentPayments.length === 0 && (
                      <p className="text-sm text-muted-foreground">No payments yet.</p>
                    )}
                    {recentPayments.map((p) => (
                      <div
                        key={p.id}
                        className="p-3 rounded-xl border border-border text-sm flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="font-medium truncate">{p.reference || p.transactionId || p.id}</div>
                          <div className="text-xs text-muted-foreground">
                            {p.paymentMethod} · {p.status}
                            {p.paymentDate ? ` · ${new Date(p.paymentDate).toLocaleDateString('en-GB')}` : ''}
                            {p.failureMessage ? ` · ${p.failureMessage}` : ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="font-semibold whitespace-nowrap">{gbp(Number(p.amount || 0))}</div>
                          <button
                            type="button"
                            onClick={() => openPayment(p)}
                            disabled={openingId === String(p.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-60"
                            title="View payment details"
                          >
                            <Eye size={14} /> View
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
      <PaymentDetailModal payment={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
