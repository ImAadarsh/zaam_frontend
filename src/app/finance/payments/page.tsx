'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/hooks/use-session';
import { useRoleCheck } from '@/hooks/use-role-check';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { RichDataTable } from '@/components/rich-data-table';
import { listPayments } from '@/lib/api';
import { CreditCard, Eye, ArrowDownToLine } from 'lucide-react';
import { toast } from 'sonner';

const getBadgeClasses = (variant: string) => {
    const base = "px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap border ";
    if (variant === 'success') return base + "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
    if (variant === 'destructive') return base + "bg-red-500/10 text-red-600 border-red-500/20";
    if (variant === 'default') return base + "bg-primary text-primary-foreground border-primary";
    if (variant === 'warning') return base + "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
    if (variant === 'secondary') return base + "bg-muted text-muted-foreground border-border";
    return base + "bg-muted text-foreground border-border";
};

export default function PaymentsPage() {
    const router = useRouter();
    const { session, hydrated } = useSession();
    const { hasAccess } = useRoleCheck(['ADMIN', 'SUPER_ADMIN', 'FINANCE']);
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        if (!session?.user?.organizationId) return;
        try {
            setLoading(true);
            const res = await listPayments(session.user.organizationId);
            setData(res.data || []);
        } catch (error) {
            toast.error('Failed to load payments');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (hydrated && hasAccess && session?.user?.organizationId) {
            loadData();
        }
    }, [hydrated, hasAccess, session]);

    if (!hydrated || !hasAccess) return null;

    const columns = [
        {
            header: 'Txn ID',
            accessorKey: 'transactionId',
            cell: (row: any) => (
                <div className="font-mono text-xs text-muted-foreground">{row.transactionId || row.id}</div>
            )
        },
        {
            header: 'Date',
            accessorKey: 'paymentDate',
            cell: (row: any) => (
                <span className="text-foreground whitespace-nowrap">
                    {new Date(row.paymentDate).toLocaleString()}
                </span>
            )
        },
        {
            header: 'Amount',
            accessorKey: 'amount',
            cell: (row: any) => (
                <div className="font-semibold text-foreground">
                    {new Intl.NumberFormat('en-GB', { style: 'currency', currency: row.currency || 'GBP' }).format(row.amount)}
                </div>
            )
        },
        {
            header: 'Method',
            accessorKey: 'paymentMethod',
            cell: (row: any) => (
                <span className={getBadgeClasses('outline') + " capitalize select-none"}>
                    {row.paymentMethod?.replace('_', ' ')}
                </span>
            )
        },
        {
            header: 'Status',
            accessorKey: 'status',
            cell: (row: any) => {
                const s = row.status || 'pending';
                let v: any = 'default';
                if (s === 'completed') v = 'success';
                if (s === 'failed' || s === 'cancelled') v = 'destructive';
                if (s === 'pending') v = 'secondary';
                if (s === 'refunded') v = 'warning';
                return <span className={getBadgeClasses(v) + " capitalize"}>{s}</span>;
            }
        },
        {
            header: 'Payer',
            accessorKey: 'payerName',
            cell: (row: any) => (
                <div className="text-sm">
                    <div className="font-medium text-foreground">{row.payerName || 'Unknown'}</div>
                    {row.payerEmail && <div className="text-xs text-muted-foreground">{row.payerEmail}</div>}
                </div>
            )
        },
        {
            header: '',
            accessorKey: 'actions',
            cell: (row: any) => (
                <div className="flex justify-end gap-2 pr-4">
                    <button
                        className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                        title="View Details"
                    >
                        <Eye size={16} />
                    </button>
                </div>
            )
        }
    ];

    return (
        <div className="min-h-screen app-surface">
            <Sidebar />
            <div className="flex flex-col overflow-hidden lg:ml-[280px]">
                <Header title="Finance · Payments" />
                <main className="flex-1 overflow-auto p-4 md:p-6">
                    <div className="flex flex-col gap-6 max-w-[1600px] mx-auto">
                        {/* Page Header */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-6 rounded-2xl border border-border shadow-sm">
                            <div>
                                <h1 className="text-2xl font-bold flex items-center gap-3">
                                    <div className="p-2 bg-primary/10 rounded-xl text-primary">
                                        <CreditCard size={24} />
                                    </div>
                                    Payments History
                                </h1>
                                <p className="text-muted-foreground mt-2 text-sm max-w-xl">
                                    View and manage all incoming payments, refunds, and transaction statuses across all active gateways.
                                </p>
                            </div>
                            <button className="flex items-center gap-2 px-4 py-2 bg-muted text-foreground font-medium rounded-xl hover:bg-muted/80 transition-colors shadow-sm self-start md:self-auto border border-border">
                                <ArrowDownToLine size={18} />
                                Export CSV
                            </button>
                        </div>

                        {/* Data Table */}
                        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                            <RichDataTable
                                columns={columns}
                                data={data}
                                searchPlaceholder="Search by transaction ID or payer name..."
                            />
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
