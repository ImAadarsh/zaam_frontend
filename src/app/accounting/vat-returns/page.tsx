/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { RichDataTable } from '@/components/rich-data-table';
import { listVatReturns, createVatReturn } from '@/lib/api';
import { useSession } from '@/hooks/use-session';
import { Plus, X } from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';

export default function VatReturnsPage() {
    const router = useRouter();
    const { session } = useSession();
    const [returns, setReturns] = useState<any[]>([]);
    const [showCreate, setShowCreate] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState({
        returnNumber: `VAT-${Math.floor(Math.random() * 10000)}`,
        periodStart: '',
        periodEnd: '',
        vatDueSales: 0,
        vatReclaimed: 0
    });

    useEffect(() => {
        const s = getSession();
        if (!s?.accessToken) {
            router.replace('/login');
            return;
        }

        async function loadData() {
            try {
                // Fetch VAT returns for the org
                const { data } = await listVatReturns({});
                setReturns(data || []);
            } catch (err) {
                console.error('Failed to load VAT returns', err);
            }
        }
        loadData();
    }, [router]);

    const columns: ColumnDef<any>[] = [
        {
            accessorKey: 'returnNumber',
            header: 'Return #',
            cell: ({ row }) => <span className="font-mono text-xs">{row.original.returnNumber}</span>,
        },
        {
            accessorKey: 'period',
            header: 'Period',
            cell: ({ row }) => (
                <span className="text-muted-foreground whitespace-nowrap">
                    {new Date(row.original.periodStart).toLocaleDateString()} - {new Date(row.original.periodEnd).toLocaleDateString()}
                </span>
            ),
        },
        {
            accessorKey: 'vatDueSales',
            header: 'VAT Due (Sales)',
            cell: ({ row }) => {
                const formatter = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
                return <span className="font-medium">{formatter.format(row.original.vatDueSales || 0)}</span>;
            },
        },
        {
            accessorKey: 'vatReclaimed',
            header: 'VAT Reclaimed',
            cell: ({ row }) => {
                const formatter = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
                return <span className="font-medium text-emerald-600">{formatter.format(row.original.vatReclaimed || 0)}</span>;
            },
        },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${row.original.status === 'accepted' ? 'bg-emerald-500/10 text-emerald-600' :
                    row.original.status === 'rejected' ? 'bg-rose-500/10 text-rose-600' :
                        row.original.status === 'submitted' ? 'bg-blue-500/10 text-blue-600' :
                            'bg-amber-500/10 text-amber-600'
                    }`}>
                    {row.original.status || 'Draft'}
                </span>
            ),
        }
    ];

    async function onCreate(e: React.FormEvent) {
        e.preventDefault();
        if (!session?.user?.organizationId) return;

        setSubmitting(true);
        try {
            await createVatReturn({
                organizationId: session.user.organizationId,
                returnNumber: form.returnNumber,
                periodStart: new Date(form.periodStart).toISOString(),
                periodEnd: new Date(form.periodEnd).toISOString(),
                vatDueSales: Number(form.vatDueSales),
                vatReclaimed: Number(form.vatReclaimed),
                status: 'draft'
            });
            toast.success('VAT Return created successfully');
            setShowCreate(false);
            setForm({ returnNumber: `VAT-${Math.floor(Math.random() * 10000)}`, periodStart: '', periodEnd: '', vatDueSales: 0, vatReclaimed: 0 });

            const { data } = await listVatReturns({});
            setReturns(data || []);
        } catch (e: any) {
            toast.error(e?.response?.data?.error?.message || 'Failed to create VAT return');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="min-h-screen app-surface">
            <Sidebar />
            <div className="flex flex-col min-w-0 lg:ml-[280px]">
                <Header title="VAT Returns" />

                <main className="p-6 md:p-8 space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">VAT Returns</h1>
                            <p className="text-muted-foreground text-sm mt-1">Manage and submit tax reporting documents.</p>
                        </div>
                        <button
                            onClick={() => setShowCreate(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
                        >
                            <Plus size={16} />
                            <span>New Return</span>
                        </button>
                    </div>

                    <div className="glass-panel rounded-2xl border border-border/50 overflow-hidden bg-background/50">
                        <RichDataTable
                            data={returns}
                            columns={columns}
                            searchPlaceholder="Search VAT returns by number..."
                        />
                    </div>
                </main>
            </div>

            {/* Create Modal */}
            {showCreate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-card rounded-2xl shadow-2xl border border-border overflow-hidden">
                        <div className="flex items-center justify-between p-6 border-b border-border/50">
                            <h2 className="text-lg font-semibold">New VAT Return</h2>
                            <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={onCreate} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1.5">Return Number</label>
                                <input
                                    required
                                    type="text"
                                    className="w-full px-3 py-2 bg-background border border-border/50 rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-mono"
                                    value={form.returnNumber}
                                    onChange={e => setForm({ ...form, returnNumber: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1.5">Period Start</label>
                                    <input
                                        required
                                        type="date"
                                        className="w-full px-3 py-2 bg-background border border-border/50 rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                        value={form.periodStart}
                                        onChange={e => setForm({ ...form, periodStart: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1.5">Period End</label>
                                    <input
                                        required
                                        type="date"
                                        className="w-full px-3 py-2 bg-background border border-border/50 rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                        value={form.periodEnd}
                                        onChange={e => setForm({ ...form, periodEnd: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1.5">VAT Due (Sales)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className="w-full px-3 py-2 bg-background border border-border/50 rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-mono"
                                        value={form.vatDueSales === 0 ? '' : form.vatDueSales}
                                        onChange={e => setForm({ ...form, vatDueSales: Number(e.target.value) })}
                                        placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1.5">VAT Reclaimed</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className="w-full px-3 py-2 bg-background border border-border/50 rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-mono"
                                        value={form.vatReclaimed === 0 ? '' : form.vatReclaimed}
                                        onChange={e => setForm({ ...form, vatReclaimed: Number(e.target.value) })}
                                        placeholder="0.00"
                                    />
                                </div>
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
                                    disabled={submitting || !form.periodStart || !form.periodEnd}
                                >
                                    {submitting ? 'Creating...' : 'Create Draft'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
