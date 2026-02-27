/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { RichDataTable } from '@/components/rich-data-table';
import { listJournalEntries, listLedgerAccounts, listFiscalPeriods, createJournalEntry } from '@/lib/api';
import { Plus, X, Trash2 } from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { useSession } from '@/hooks/use-session';

export default function JournalEntriesPage() {
    const router = useRouter();
    const { session } = useSession();
    const [journals, setJournals] = useState<any[]>([]);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [fiscalPeriods, setFiscalPeriods] = useState<any[]>([]);
    const [showCreate, setShowCreate] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState({
        journalNumber: `JE-${Math.floor(Math.random() * 100000)}`,
        entryDate: new Date().toISOString().split('T')[0],
        entryType: 'standard',
        description: '',
        fiscalPeriodId: '',
        lines: [
            { id: 1, ledgerAccountId: '', debitAmount: 0, creditAmount: 0, description: '' },
            { id: 2, ledgerAccountId: '', debitAmount: 0, creditAmount: 0, description: '' }
        ]
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
                const [journalsRes, accountsRes, periodsRes] = await Promise.all([
                    listJournalEntries({}),
                    listLedgerAccounts({}),
                    listFiscalPeriods({})
                ]);
                setJournals(journalsRes.data || []);
                setAccounts(accountsRes.data || []);
                setFiscalPeriods(periodsRes.data || []);

                if (periodsRes.data && periodsRes.data.length > 0) {
                    setForm(prev => ({ ...prev, fiscalPeriodId: periodsRes.data[0].id }));
                }
            } catch (err) {
                console.error('Failed to load data', err);
            }
        }
        loadData();
    }, [router]);

    const columns: ColumnDef<any>[] = [
        {
            accessorKey: 'journalNumber',
            header: 'Journal #',
            cell: ({ row }) => <span className="font-mono text-xs text-primary">{row.original.journalNumber}</span>,
        },
        {
            accessorKey: 'entryDate',
            header: 'Date',
            cell: ({ row }) => (
                <span className="text-muted-foreground">
                    {new Date(row.original.entryDate).toLocaleDateString()}
                </span>
            ),
        },
        {
            accessorKey: 'entryType',
            header: 'Type',
            cell: ({ row }) => (
                <span className="capitalize">{row.original.entryType || 'Standard'}</span>
            ),
        },
        {
            accessorKey: 'description',
            header: 'Description',
            cell: ({ row }) => (
                <span className="truncate max-w-xs block">{row.original.description || '-'}</span>
            ),
        },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${row.original.status === 'posted' ? 'bg-emerald-500/10 text-emerald-600' :
                    row.original.status === 'voided' ? 'bg-rose-500/10 text-rose-600' :
                        'bg-amber-500/10 text-amber-600'
                    }`}>
                    {row.original.status || 'Draft'}
                </span>
            ),
        }
    ];

    const totalDebit = form.lines.reduce((acc, line) => acc + (Number(line.debitAmount) || 0), 0);
    const totalCredit = form.lines.reduce((acc, line) => acc + (Number(line.creditAmount) || 0), 0);
    const isBalanced = totalDebit === totalCredit && totalDebit > 0;

    async function onCreate(e: React.FormEvent) {
        e.preventDefault();
        if (!session?.user?.organizationId) return;
        if (!isBalanced) {
            toast.error('Journal entry must be balanced (Total Debits = Total Credits).');
            return;
        }
        if (!form.fiscalPeriodId) {
            toast.error('Please select a fiscal period.');
            return;
        }

        // Validate lines
        const validLines = form.lines.filter(l => l.ledgerAccountId && (l.debitAmount > 0 || l.creditAmount > 0));
        if (validLines.length < 2) {
            toast.error('At least two valid line items are required.');
            return;
        }

        setSubmitting(true);
        try {
            await createJournalEntry({
                organizationId: session.user.organizationId,
                fiscalPeriodId: form.fiscalPeriodId,
                journalNumber: form.journalNumber,
                entryDate: new Date(form.entryDate).toISOString(),
                entryType: form.entryType as any,
                description: form.description,
                status: 'posted',
                journalLines: validLines.map((l, i) => ({
                    lineNumber: i + 1,
                    ledgerAccountId: l.ledgerAccountId,
                    debitAmount: Number(l.debitAmount),
                    creditAmount: Number(l.creditAmount),
                    description: l.description || form.description
                }))
            });

            toast.success('Journal entry posted successfully!');
            setShowCreate(false);
            setForm({
                journalNumber: `JE-${Math.floor(Math.random() * 100000)}`,
                entryDate: new Date().toISOString().split('T')[0],
                entryType: 'standard',
                description: '',
                fiscalPeriodId: form.fiscalPeriodId,
                lines: [
                    { id: Date.now(), ledgerAccountId: '', debitAmount: 0, creditAmount: 0, description: '' },
                    { id: Date.now() + 1, ledgerAccountId: '', debitAmount: 0, creditAmount: 0, description: '' }
                ]
            });
            const { data } = await listJournalEntries({});
            setJournals(data || []);
        } catch (e: any) {
            toast.error(e?.response?.data?.error?.message || 'Failed to post entry');
        } finally {
            setSubmitting(false);
        }
    }

    const updateLine = (id: number, field: string, value: any) => {
        setForm(prev => ({
            ...prev,
            lines: prev.lines.map(l => l.id === id ? {
                ...l,
                [field]: value,
                // Zero out the opposite amount if one is edited
                ...(field === 'debitAmount' && Number(value) > 0 ? { creditAmount: 0 } : {}),
                ...(field === 'creditAmount' && Number(value) > 0 ? { debitAmount: 0 } : {})
            } : l)
        }));
    };

    const addLine = () => {
        setForm(prev => ({
            ...prev,
            lines: [...prev.lines, { id: Date.now(), ledgerAccountId: '', debitAmount: 0, creditAmount: 0, description: '' }]
        }));
    };

    const removeLine = (id: number) => {
        setForm(prev => ({
            ...prev,
            lines: prev.lines.filter(l => l.id !== id)
        }));
    };

    return (
        <div className="min-h-screen app-surface">
            <Sidebar />
            <div className="flex flex-col min-w-0 lg:ml-[280px]">
                <Header title="Journal Entries" />

                <main className="p-6 md:p-8 space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">Journal Entries</h1>
                            <p className="text-muted-foreground text-sm mt-1">Record and review financial transactions.</p>
                        </div>
                        <button
                            onClick={() => setShowCreate(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
                        >
                            <Plus size={16} />
                            <span>New Entry</span>
                        </button>
                    </div>

                    <div className="glass-panel rounded-2xl border border-border/50 overflow-hidden bg-background/50">
                        <RichDataTable
                            data={journals}
                            columns={columns}
                            searchPlaceholder="Search journals by number or description..."
                        />
                    </div>
                </main>
            </div>

            {/* Create Modal */}
            {showCreate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm overflow-y-auto">
                    <div className="w-full max-w-4xl bg-card rounded-2xl shadow-2xl border border-border overflow-hidden my-auto">
                        <div className="flex items-center justify-between p-6 border-b border-border/50">
                            <div>
                                <h2 className="text-xl font-semibold">New Journal Entry</h2>
                                <p className="text-sm text-muted-foreground mt-1">Record a new manual transaction</p>
                            </div>
                            <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={onCreate} className="p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1.5">Journal Number</label>
                                    <input
                                        required
                                        type="text"
                                        className="w-full px-3 py-2 bg-background border border-border/50 rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-mono"
                                        value={form.journalNumber}
                                        onChange={e => setForm({ ...form, journalNumber: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1.5">Entry Date</label>
                                    <input
                                        required
                                        type="date"
                                        className="w-full px-3 py-2 bg-background border border-border/50 rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                        value={form.entryDate}
                                        onChange={e => setForm({ ...form, entryDate: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1.5">Fiscal Period</label>
                                    <select
                                        required
                                        className="w-full px-3 py-2 bg-background border border-border/50 rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                        value={form.fiscalPeriodId}
                                        onChange={e => setForm({ ...form, fiscalPeriodId: e.target.value })}
                                    >
                                        <option value="">Select Period...</option>
                                        {fiscalPeriods.map(p => (
                                            <option key={p.id} value={p.id}>{p.periodName} ({new Date(p.startDate).toLocaleDateString()})</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1.5">Type</label>
                                    <select
                                        className="w-full px-3 py-2 bg-background border border-border/50 rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                        value={form.entryType}
                                        onChange={e => setForm({ ...form, entryType: e.target.value })}
                                    >
                                        <option value="standard">Standard</option>
                                        <option value="adjusting">Adjusting</option>
                                        <option value="reversing">Reversing</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1.5">Reference / Description</label>
                                <input
                                    required
                                    type="text"
                                    className="w-full px-3 py-2 bg-background border border-border/50 rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                    value={form.description}
                                    onChange={e => setForm({ ...form, description: e.target.value })}
                                    placeholder="Explanation of the transaction..."
                                />
                            </div>

                            <div className="border border-border/50 rounded-xl overflow-hidden bg-background">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-muted/50 border-b border-border/50">
                                        <tr>
                                            <th className="px-4 py-3 font-medium">Account</th>
                                            <th className="px-4 py-3 font-medium">Description</th>
                                            <th className="px-4 py-3 font-medium text-right w-32">Debit</th>
                                            <th className="px-4 py-3 font-medium text-right w-32">Credit</th>
                                            <th className="px-4 py-3 font-medium text-center w-16"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/50">
                                        {form.lines.map((line) => (
                                            <tr key={line.id} className="hover:bg-muted/30">
                                                <td className="p-2">
                                                    <select
                                                        required
                                                        className="w-full px-2 py-1.5 bg-transparent border border-border/50 rounded focus:border-primary outline-none"
                                                        value={line.ledgerAccountId}
                                                        onChange={e => updateLine(line.id, 'ledgerAccountId', e.target.value)}
                                                    >
                                                        <option value="">Select Account...</option>
                                                        {accounts.map(a => (
                                                            <option key={a.id} value={a.id}>
                                                                {a.accountCode} - {a.accountName}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="p-2">
                                                    <input
                                                        type="text"
                                                        placeholder="Line notes..."
                                                        className="w-full px-2 py-1.5 bg-transparent border border-border/50 rounded focus:border-primary outline-none"
                                                        value={line.description}
                                                        onChange={e => updateLine(line.id, 'description', e.target.value)}
                                                    />
                                                </td>
                                                <td className="p-2 text-right">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        className="w-full px-2 py-1.5 bg-transparent border border-border/50 rounded focus:border-primary outline-none text-right font-mono text-blue-600"
                                                        value={line.debitAmount === 0 ? '' : line.debitAmount}
                                                        onChange={e => updateLine(line.id, 'debitAmount', e.target.value)}
                                                    />
                                                </td>
                                                <td className="p-2 text-right">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        className="w-full px-2 py-1.5 bg-transparent border border-border/50 rounded focus:border-primary outline-none text-right font-mono text-purple-600"
                                                        value={line.creditAmount === 0 ? '' : line.creditAmount}
                                                        onChange={e => updateLine(line.id, 'creditAmount', e.target.value)}
                                                    />
                                                </td>
                                                <td className="p-2 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => removeLine(line.id)}
                                                        disabled={form.lines.length <= 2}
                                                        className="p-1.5 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-md transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-muted/30 font-medium">
                                        <tr>
                                            <td colSpan={2} className="px-4 py-3">
                                                <button
                                                    type="button"
                                                    onClick={addLine}
                                                    className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
                                                >
                                                    <Plus size={16} /> Add Line Item
                                                </button>
                                            </td>
                                            <td className={`px-4 py-3 text-right font-mono ${totalDebit !== totalCredit ? 'text-rose-500' : 'text-blue-600'}`}>
                                                {totalDebit.toFixed(2)}
                                            </td>
                                            <td className={`px-4 py-3 text-right font-mono ${totalDebit !== totalCredit ? 'text-rose-500' : 'text-purple-600'}`}>
                                                {totalCredit.toFixed(2)}
                                            </td>
                                            <td></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            {!isBalanced && (totalDebit > 0 || totalCredit > 0) && (
                                <div className="text-sm text-rose-500 bg-rose-500/10 p-3 rounded-lg border border-rose-500/20">
                                    Total Debits ({totalDebit.toFixed(2)}) must equal Total Credits ({totalCredit.toFixed(2)}).
                                    Difference: {Math.abs(totalDebit - totalCredit).toFixed(2)}
                                </div>
                            )}

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
                                    disabled={submitting || !isBalanced}
                                >
                                    {submitting ? 'Posting Header...' : 'Post Journal'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
