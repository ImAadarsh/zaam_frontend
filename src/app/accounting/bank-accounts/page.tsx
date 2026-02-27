/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { RichDataTable } from '@/components/rich-data-table';
import { listBankAccounts, createBankAccount, listLedgerAccounts } from '@/lib/api';
import { useSession } from '@/hooks/use-session';
import { Plus, X } from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';

export default function BankAccountsPage() {
    const router = useRouter();
    const { session } = useSession();
    const [accounts, setAccounts] = useState<any[]>([]);
    const [ledgerAccounts, setLedgerAccounts] = useState<any[]>([]);
    const [showCreate, setShowCreate] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState({
        bankName: '',
        accountName: '',
        accountNumber: '',
        currency: 'USD',
        ledgerAccountId: ''
    });

    useEffect(() => {
        const s = getSession();
        if (!s?.accessToken) {
            router.replace('/login');
            return;
        }

        async function loadData() {
            try {
                // Fetch basic data for the org
                const [banksRes, ledgersRes] = await Promise.all([
                    listBankAccounts({}),
                    listLedgerAccounts({})
                ]);
                setAccounts(banksRes.data || []);
                setLedgerAccounts(ledgersRes.data || []);
            } catch (err) {
                console.error('Failed to load bank accounts', err);
            }
        }
        loadData();
    }, [router]);

    const columns: ColumnDef<any>[] = [
        {
            accessorKey: 'bankName',
            header: 'Bank Name',
            cell: ({ row }) => <span className="font-semibold">{row.original.bankName}</span>,
        },
        {
            accessorKey: 'accountName',
            header: 'Account Name',
        },
        {
            accessorKey: 'accountNumber',
            header: 'Account Number',
            cell: ({ row }) => (
                <span className="font-mono text-muted-foreground">
                    {row.original.accountNumber
                        ? `••••${row.original.accountNumber.slice(-4)}`
                        : '-'
                    }
                </span>
            ),
        },
        {
            accessorKey: 'currency',
            header: 'Currency',
            cell: ({ row }) => <span className="uppercase text-xs font-bold">{row.original.currency}</span>,
        },
        {
            accessorKey: 'currentBalance',
            header: 'Balance',
            cell: ({ row }) => {
                const formatter = new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: row.original.currency || 'USD'
                });
                return <span className="font-medium text-primary">{formatter.format(row.original.currentBalance || 0)}</span>;
            },
        },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${row.original.status === 'active' ? 'bg-emerald-500/10 text-emerald-600' :
                        row.original.status === 'closed' ? 'bg-rose-500/10 text-rose-600' :
                            'bg-amber-500/10 text-amber-600'
                        }`}>
                        {row.original.status || 'Active'}
                    </span>
                    {row.original.isDefault && (
                        <span className="bg-primary/20 text-primary px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">
                            Default
                        </span>
                    )}
                </div>
            ),
        }
    ];

    async function onCreate(e: React.FormEvent) {
        e.preventDefault();
        if (!session?.user?.organizationId) return;

        setSubmitting(true);
        try {
            await createBankAccount({
                organizationId: session.user.organizationId,
                bankName: form.bankName,
                accountName: form.accountName,
                accountNumber: form.accountNumber || undefined,
                currency: form.currency,
                ledgerAccountId: form.ledgerAccountId || undefined,
                status: 'active'
            });
            toast.success('Bank account created successfully');
            setShowCreate(false);
            setForm({ bankName: '', accountName: '', accountNumber: '', currency: 'USD', ledgerAccountId: '' });

            const { data } = await listBankAccounts({});
            setAccounts(data || []);
        } catch (e: any) {
            toast.error(e?.response?.data?.error?.message || 'Failed to create bank account');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="min-h-screen app-surface">
            <Sidebar />
            <div className="flex flex-col min-w-0 lg:ml-[280px]">
                <Header title="Bank Accounts" />

                <main className="p-6 md:p-8 space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">Bank Accounts</h1>
                            <p className="text-muted-foreground text-sm mt-1">Manage organizational bank accounts securely.</p>
                        </div>
                        <button
                            onClick={() => setShowCreate(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
                        >
                            <Plus size={16} />
                            <span>Add Account</span>
                        </button>
                    </div>

                    <div className="glass-panel rounded-2xl border border-border/50 overflow-hidden bg-background/50">
                        <RichDataTable
                            data={accounts}
                            columns={columns}
                            searchPlaceholder="Search bank accounts..."
                        />
                    </div>
                </main>
            </div>

            {/* Create Modal */}
            {showCreate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-card rounded-2xl shadow-2xl border border-border overflow-hidden">
                        <div className="flex items-center justify-between p-6 border-b border-border/50">
                            <h2 className="text-lg font-semibold">Add Bank Account</h2>
                            <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={onCreate} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1.5">Bank Name</label>
                                <input
                                    required
                                    type="text"
                                    className="w-full px-3 py-2 bg-background border border-border/50 rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                    value={form.bankName}
                                    onChange={e => setForm({ ...form, bankName: e.target.value })}
                                    placeholder="e.g. Chase Bank, HSBC"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1.5">Account Name</label>
                                    <input
                                        required
                                        type="text"
                                        className="w-full px-3 py-2 bg-background border border-border/50 rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                        value={form.accountName}
                                        onChange={e => setForm({ ...form, accountName: e.target.value })}
                                        placeholder="e.g. Operating Checking"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1.5">Currency</label>
                                    <select
                                        required
                                        className="w-full px-3 py-2 bg-background border border-border/50 rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all uppercase"
                                        value={form.currency}
                                        onChange={e => setForm({ ...form, currency: e.target.value })}
                                    >
                                        <option value="USD">USD</option>
                                        <option value="EUR">EUR</option>
                                        <option value="GBP">GBP</option>
                                        <option value="INR">INR</option>
                                        <option value="AUD">AUD</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1.5">Account Number</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 bg-background border border-border/50 rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-mono"
                                    value={form.accountNumber}
                                    onChange={e => setForm({ ...form, accountNumber: e.target.value })}
                                    placeholder="Enter full account number"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1.5">Linked Ledger Account (Optional)</label>
                                <select
                                    className="w-full px-3 py-2 bg-background border border-border/50 rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                    value={form.ledgerAccountId}
                                    onChange={e => setForm({ ...form, ledgerAccountId: e.target.value })}
                                >
                                    <option value="">Select a ledger account...</option>
                                    {ledgerAccounts.map(a => (
                                        <option key={a.id} value={a.id}>{a.accountCode} - {a.accountName}</option>
                                    ))}
                                </select>
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
                                    {submitting ? 'Creating...' : 'Add Account'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
