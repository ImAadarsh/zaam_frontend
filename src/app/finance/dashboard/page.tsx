'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { StatCard } from '@/components/stat-card';
import { useSession } from '@/hooks/use-session';
import { useRoleCheck } from '@/hooks/use-role-check';
import { 
  listChartOfAccounts, listLedgerAccounts, listJournalEntries, 
  listBankAccounts, listVatReturns, listBudgetLines,
  listFiscalPeriods
} from '@/lib/api';
import { BookOpen, FileText, FileCheck, Wallet, Receipt, BarChart, Calendar, TrendingUp } from 'lucide-react';
import Link from 'next/link';

export default function FinanceDashboard() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const { hasAccess } = useRoleCheck(['ADMIN', 'SUPER_ADMIN', 'FINANCE']);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalChartOfAccounts: 0,
    totalLedgerAccounts: 0,
    totalJournalEntries: 0,
    totalBankAccounts: 0,
    totalVatReturns: 0,
    totalBudgetLines: 0,
    activeFiscalPeriods: 0,
    draftJournalEntries: 0
  });

  useEffect(() => {
    if (!hydrated || !hasAccess) return;
    if (!session?.accessToken) {
      router.replace('/login');
      return;
    }
    (async () => {
      try {
        const [coaRes, laRes, jeRes, baRes, vatRes, budgetRes, fpRes] = await Promise.all([
          listChartOfAccounts({ organizationId: session?.user?.organizationId }),
          listLedgerAccounts({}),
          listJournalEntries({ organizationId: session?.user?.organizationId }),
          listBankAccounts({ organizationId: session?.user?.organizationId }),
          listVatReturns({ organizationId: session?.user?.organizationId }),
          listBudgetLines({ organizationId: session?.user?.organizationId }),
          listFiscalPeriods({ organizationId: session?.user?.organizationId, isClosed: false })
        ]);

        const journalEntries = jeRes.data || [];
        const draftEntries = journalEntries.filter((entry: any) => entry.status === 'draft').length;

        setStats({
          totalChartOfAccounts: coaRes.data?.length || 0,
          totalLedgerAccounts: laRes.data?.length || 0,
          totalJournalEntries: journalEntries.length,
          totalBankAccounts: baRes.data?.length || 0,
          totalVatReturns: vatRes.data?.length || 0,
          totalBudgetLines: budgetRes.data?.length || 0,
          activeFiscalPeriods: fpRes.data?.length || 0,
          draftJournalEntries: draftEntries
        });
      } catch (e: any) {
        console.error('Failed to load finance stats:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [hydrated, hasAccess, router, session?.accessToken, session?.user?.organizationId]);

  if (!hydrated || loading) {
    return (
      <div className="min-h-screen app-surface">
        <Sidebar />
        <div className="flex flex-col overflow-hidden lg:ml-[280px]">
          <Header title="Finance · Dashboard" />
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
          <Header title="Finance · Dashboard" />
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
        <Header title="Finance · Dashboard" />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">Finance & Accounting Overview</h1>
              <p className="text-muted-foreground">Manage chart of accounts, journal entries, bank accounts, and financial reporting</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link href="/finance/chart-of-accounts">
                <StatCard
                  title="Chart of Accounts"
                  value={stats.totalChartOfAccounts.toString()}
                  icon={<BookOpen className="h-5 w-5" />}
                  hint="Total chart of accounts"
                />
              </Link>
              <Link href="/finance/ledger-accounts">
                <StatCard
                  title="Ledger Accounts"
                  value={stats.totalLedgerAccounts.toString()}
                  icon={<FileText className="h-5 w-5" />}
                  hint="Total ledger accounts"
                />
              </Link>
              <Link href="/finance/journal-entries">
                <StatCard
                  title="Journal Entries"
                  value={stats.totalJournalEntries.toString()}
                  icon={<FileCheck className="h-5 w-5" />}
                  hint="Total journal entries"
                />
              </Link>
              <Link href="/finance/bank-accounts">
                <StatCard
                  title="Bank Accounts"
                  value={stats.totalBankAccounts.toString()}
                  icon={<Wallet className="h-5 w-5" />}
                  hint="Total bank accounts"
                />
              </Link>
              <Link href="/finance/vat-returns">
                <StatCard
                  title="VAT Returns"
                  value={stats.totalVatReturns.toString()}
                  icon={<Receipt className="h-5 w-5" />}
                  hint="Total VAT returns"
                />
              </Link>
              <Link href="/finance/budget-lines">
                <StatCard
                  title="Budget Lines"
                  value={stats.totalBudgetLines.toString()}
                  icon={<BarChart className="h-5 w-5" />}
                  hint="Total budget lines"
                />
              </Link>
              <Link href="/finance/fiscal-periods">
                <StatCard
                  title="Active Periods"
                  value={stats.activeFiscalPeriods.toString()}
                  icon={<Calendar className="h-5 w-5" />}
                  hint="Open fiscal periods"
                />
              </Link>
              <Link href="/finance/journal-entries?status=draft">
                <StatCard
                  title="Draft Entries"
                  value={stats.draftJournalEntries.toString()}
                  icon={<TrendingUp className="h-5 w-5" />}
                  hint="Pending journal entries"
                />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
              <Link
                href="/finance/chart-of-accounts"
                className="p-6 bg-card rounded-lg border border-border hover:border-primary/50 transition-colors"
              >
                <h3 className="font-semibold mb-2">Chart of Accounts</h3>
                <p className="text-sm text-muted-foreground">Manage account structure and organization</p>
              </Link>
              <Link
                href="/finance/ledger-accounts"
                className="p-6 bg-card rounded-lg border border-border hover:border-primary/50 transition-colors"
              >
                <h3 className="font-semibold mb-2">Ledger Accounts</h3>
                <p className="text-sm text-muted-foreground">Manage individual GL accounts</p>
              </Link>
              <Link
                href="/finance/journal-entries"
                className="p-6 bg-card rounded-lg border border-border hover:border-primary/50 transition-colors"
              >
                <h3 className="font-semibold mb-2">Journal Entries</h3>
                <p className="text-sm text-muted-foreground">Create and manage journal entries</p>
              </Link>
              <Link
                href="/finance/bank-accounts"
                className="p-6 bg-card rounded-lg border border-border hover:border-primary/50 transition-colors"
              >
                <h3 className="font-semibold mb-2">Bank Accounts</h3>
                <p className="text-sm text-muted-foreground">Manage bank account information</p>
              </Link>
              <Link
                href="/finance/fiscal-periods"
                className="p-6 bg-card rounded-lg border border-border hover:border-primary/50 transition-colors"
              >
                <h3 className="font-semibold mb-2">Fiscal Periods</h3>
                <p className="text-sm text-muted-foreground">Manage accounting periods</p>
              </Link>
              <Link
                href="/finance/vat-returns"
                className="p-6 bg-card rounded-lg border border-border hover:border-primary/50 transition-colors"
              >
                <h3 className="font-semibold mb-2">VAT Returns</h3>
                <p className="text-sm text-muted-foreground">Manage VAT return filings</p>
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

