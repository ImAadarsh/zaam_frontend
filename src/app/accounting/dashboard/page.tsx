/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { StatCard } from '@/components/stat-card';
import { Bookmark, FileCheck, Landmark, Receipt, Plus, ArrowRight } from 'lucide-react';
import { listBankAccounts, listJournalEntries, listChartOfAccounts } from '@/lib/api';

export default function AccountingDashboard() {
    const router = useRouter();
    const [bankAccounts, setBankAccounts] = useState<any[]>([]);
    const [journals, setJournals] = useState<any[]>([]);
    const [coas, setCoas] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const s = getSession();
        if (!s?.accessToken) {
            router.replace('/login');
            return;
        }

        async function loadData() {
            try {
                // Get organization ID from session or use a default if not found
                // For this demo context, we can just omit or pass empty string to get all accessible records
                const [accountsRes, journalsRes, coasRes] = await Promise.all([
                    listBankAccounts({}),
                    listJournalEntries({}),
                    listChartOfAccounts({})
                ]);

                // Assuming data is inside the 'data' property
                setBankAccounts(accountsRes.data || []);
                setJournals(journalsRes.data || []);
                setCoas(coasRes.data || []);
            } catch (err) {
                console.error('Failed to load accounting data', err);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [router]);

    const activeBankAccounts = bankAccounts.filter(a => a.status === 'active').length;
    const postedJournals = journals.filter(j => j.status === 'posted').length;

    return (
        <div className="min-h-screen app-surface">
            <Sidebar />
            <div className="flex flex-col min-w-0 lg:ml-[280px]">
                <Header title="Finance & Accounting Dashboard" />

                <main className="p-6 md:p-8 space-y-8">
                    {/* Stats Grid */}
                    <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
                        <StatCard
                            title="Active Bank Accounts"
                            value={activeBankAccounts.toString()}
                            hint={`out of ${bankAccounts.length} total`}
                            icon={<Landmark size={20} />}
                        />
                        <StatCard
                            title="Chart of Accounts"
                            value={coas.length.toString()}
                            hint="Configured records"
                            icon={<Bookmark size={20} />}
                        />
                        <StatCard
                            title="Journal Entries"
                            value={journals.length.toString()}
                            hint="Total entries"
                            icon={<FileCheck size={20} />}
                        />
                        <StatCard
                            title="Posted Journals"
                            value={postedJournals.toString()}
                            hint="Finalized entries"
                            icon={<Receipt size={20} />}
                        />
                    </div>

                    <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
                        {/* Recent Journal Entries Table */}
                        <div className="lg:col-span-2 space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-semibold tracking-tight">Recent Journal Entries</h2>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => router.push('/accounting/journal-entries')}
                                        className="text-sm text-primary hover:underline"
                                    >
                                        View All
                                    </button>
                                    <button
                                        onClick={() => router.push('/accounting/journal-entries?new=true')}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                                    >
                                        <Plus size={16} />
                                        <span>New Entry</span>
                                    </button>
                                </div>
                            </div>

                            <div className="glass-panel rounded-2xl border border-border/50 overflow-hidden">
                                <table className="w-full text-left text-sm">
                                    <thead>
                                        <tr className="bg-muted/50 text-muted-foreground">
                                            <th className="px-4 py-3 font-medium">Journal #</th>
                                            <th className="px-4 py-3 font-medium">Date</th>
                                            <th className="px-4 py-3 font-medium">Type</th>
                                            <th className="px-4 py-3 font-medium">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/50">
                                        {loading ? (
                                            <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground italic">Loading journals...</td></tr>
                                        ) : journals.length === 0 ? (
                                            <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground italic">No journal entries found.</td></tr>
                                        ) : (
                                            journals.slice(0, 5).map((journal) => (
                                                <tr key={journal.id} className="hover:bg-muted/30 transition-colors">
                                                    <td className="px-4 py-3 font-mono text-xs">{journal.journalNumber}</td>
                                                    <td className="px-4 py-3">
                                                        {new Date(journal.entryDate).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className="capitalize">{journal.entryType || 'Standard'}</span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${journal.status === 'posted' ? 'bg-emerald-500/10 text-emerald-600' :
                                                            journal.status === 'voided' ? 'bg-rose-500/10 text-rose-600' :
                                                                'bg-amber-500/10 text-amber-600'
                                                            }`}>
                                                            {journal.status || 'Draft'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Sidebar content - Quick Actions */}
                        <div className="space-y-6">
                            <div className="glass-panel p-6 rounded-2xl border border-border/50 space-y-4">
                                <h3 className="font-semibold px-1">Quick Links</h3>
                                <div className="grid grid-cols-1 gap-2">
                                    <button className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-muted transition-colors text-left" onClick={() => router.push('/accounting/chart-of-accounts')}>
                                        <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
                                            <Bookmark size={18} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm font-medium">Chart of Accounts</div>
                                            <div className="text-xs text-muted-foreground">Manage accounts</div>
                                        </div>
                                        <ArrowRight size={14} className="text-muted-foreground" />
                                    </button>

                                    <button className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-muted transition-colors text-left" onClick={() => router.push('/accounting/bank-accounts')}>
                                        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600">
                                            <Landmark size={18} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm font-medium">Bank Accounts</div>
                                            <div className="text-xs text-muted-foreground">View balances</div>
                                        </div>
                                        <ArrowRight size={14} className="text-muted-foreground" />
                                    </button>

                                    <button className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-muted transition-colors text-left" onClick={() => router.push('/accounting/vat-returns')}>
                                        <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600">
                                            <Receipt size={18} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm font-medium">VAT Returns</div>
                                            <div className="text-xs text-muted-foreground">Tax reporting</div>
                                        </div>
                                        <ArrowRight size={14} className="text-muted-foreground" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
