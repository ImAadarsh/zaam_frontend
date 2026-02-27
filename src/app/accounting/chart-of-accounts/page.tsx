/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { RichDataTable } from '@/components/rich-data-table';
import { listLedgerAccounts, listChartOfAccounts, createLedgerAccount } from '@/lib/api';
import { Plus, X } from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';

export default function ChartOfAccountsPage() {
    const router = useRouter();
    const [accounts, setAccounts] = useState<any[]>([]);
    const [showCreate, setShowCreate] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState({
        chartOfAccountsId: '',
        accountCode: '',
        accountName: '',
        accountType: 'asset',
        normalBalance: 'debit',
        description: ''
    });

    useEffect(() => {
        const s = getSession();
        if (!s?.accessToken) {
            router.replace('/login');
            return;
        }

        async function loadData() {
            try {
                // Fetch ledger accounts for the org
                const [accountsRes, coasRes] = await Promise.all([
                    listLedgerAccounts({}),
                    listChartOfAccounts({})
                ]);
                setAccounts(accountsRes.data || []);
                if (coasRes.data && coasRes.data.length > 0) {
                    setForm(prev => ({ ...prev, chartOfAccountsId: coasRes.data[0].id }));
                }
            } catch (err) {
                console.error('Failed to load ledger accounts', err);
            }
        }
        loadData();
    }, [router]);

    const columns: ColumnDef<any>[] = [
        {
            accessorKey: 'accountCode',
            header: 'Code',
            cell: ({ row }) => <span className="font-mono text-xs">{row.original.accountCode}</span>,
        },
        {
            accessorKey: 'accountName',
            header: 'Account Name',
            cell: ({ row }) => <span className="font-medium">{row.original.accountName}</span>,
        },
        {
            accessorKey: 'accountType',
            header: 'Type',
            cell: ({ row }) => (
                <span className="capitalize text-muted-foreground">
                    {row.original.accountType?.replace(/_/g, ' ')}
                </span>
            ),
        },
        {
            accessorKey: 'normalBalance',
            header: 'Balance Type',
            cell: ({ row }) => (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${row.original.normalBalance === 'debit' ? 'bg-blue-500/10 text-blue-600' : 'bg-purple-500/10 text-purple-600'
                    }`}>
                    {row.original.normalBalance}
                </span>
            ),
        },
        {
            accessorKey: 'isActive',
            header: 'Status',
            cell: ({ row }) => (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${row.original.isActive ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'
                    }`}>
                    {row.original.isActive ? 'Active' : 'Inactive'}
                </span>
            ),
        }
    ];

    async function onCreate(e: React.FormEvent) {
        e.preventDefault();
        if (!form.chartOfAccountsId) {
            toast.error('No Chart of Accounts found for this organization. Please create one first.');
            return;
        }

        setSubmitting(true);
        try {
            const res = await createLedgerAccount({
                ...form,
                accountType: form.accountType as any,
                normalBalance: form.normalBalance as any
            });
            toast.success('Account created successfully');
            setShowCreate(false);
            setForm({ ...form, accountCode: '', accountName: '', description: '' });

            // Reload accounts
            const { data } = await listLedgerAccounts({});
            setAccounts(data || []);
        } catch (e: any) {
            toast.error(e?.response?.data?.error?.message || 'Failed to create account');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="min-h-screen app-surface">
            <Sidebar />
            <div className="flex flex-col min-w-0 lg:ml-[280px]">
                <Header title="Chart of Accounts" />

                <main className="p-6 md:p-8 space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">Ledger Accounts</h1>
                            <p className="text-muted-foreground text-sm mt-1">Manage the core organizational financial accounts.</p>
                        </div>
                        <button
                            onClick={() => setShowCreate(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
                        >
                            <Plus size={16} />
                            <span>New Account</span>
                        </button>
                    </div>

                    <div className="glass-panel rounded-2xl border border-border/50 overflow-hidden bg-background/50">
                        <RichDataTable
                            data={accounts}
                            columns={columns}
                            searchPlaceholder="Search accounts by name or code..."
                        />
                    </div>
                </main>
            </div>

            {/* Create Modal */}
            {showCreate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-card rounded-2xl shadow-2xl border border-border overflow-hidden">
                        <div className="flex items-center justify-between p-6 border-b border-border/50">
                            <h2 className="text-lg font-semibold">New Ledger Account</h2>
                            <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={onCreate} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1.5">Account Code</label>
                                    <input
                                        required
                                        type="text"
                                        className="w-full px-3 py-2 bg-background border border-border/50 rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                        value={form.accountCode}
                                        onChange={e => setForm({ ...form, accountCode: e.target.value })}
                                        placeholder="e.g. 1000"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1.5">Account Name</label>
                                    <input
                                        required
                                        type="text"
                                        className="w-full px-3 py-2 bg-background border border-border/50 rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                        value={form.accountName}
                                        onChange={e => setForm({ ...form, accountName: e.target.value })}
                                        placeholder="e.g. Cash"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1.5">Type</label>
                                    <select
                                        className="w-full px-3 py-2 bg-background border border-border/50 rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                        value={form.accountType}
                                        onChange={e => setForm({ ...form, accountType: e.target.value })}
                                    >
                                        <option value="asset">Asset</option>
                                        <option value="liability">Liability</option>
                                        <option value="equity">Equity</option>
                                        <option value="revenue">Revenue</option>
                                        <option value="expense">Expense</option>
                                        <option value="cost_of_goods_sold">Cost of Goods Sold</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1.5">Normal Balance</label>
                                    <select
                                        className="w-full px-3 py-2 bg-background border border-border/50 rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                        value={form.normalBalance}
                                        onChange={e => setForm({ ...form, normalBalance: e.target.value })}
                                    >
                                        <option value="debit">Debit</option>
                                        <option value="credit">Credit</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1.5">Description (Optional)</label>
                                <textarea
                                    rows={3}
                                    className="w-full px-3 py-2 bg-background border border-border/50 rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none"
                                    value={form.description}
                                    onChange={e => setForm({ ...form, description: e.target.value })}
                                    placeholder="Account description..."
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowCreate(false)}
                                    className="px-4 py-2 hover:bg-muted text-muted-foreground rounded-xl transition-colors font-medium text-sm"
                                    disabled={submitting}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors font-medium text-sm disabled:opacity-50"
                                    disabled={submitting}
                                >
                                    {submitting ? 'Creating...' : 'Create Account'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
