'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/hooks/use-session';
import { useRoleCheck } from '@/hooks/use-role-check';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { RichDataTable } from '@/components/rich-data-table';
import { listInvoices } from '@/lib/api';
import { Receipt, Plus, Eye, MoreHorizontal } from 'lucide-react';
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

export default function InvoicesPage() {
    const router = useRouter();
    const { session, hydrated } = useSession();
    const { hasAccess } = useRoleCheck(['ADMIN', 'SUPER_ADMIN', 'FINANCE']);
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        if (!session?.user?.organizationId) return;
        try {
            setLoading(true);
            const res = await listInvoices(session.user.organizationId);
            setData(res.data || []);
        } catch (error) {
            toast.error('Failed to load invoices');
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
            header: 'Invoice No',
            accessorKey: 'invoiceNumber',
            cell: (row: any) => (
                <div className="font-semibold text-foreground">{row.invoiceNumber}</div>
            )
        },
        {
            header: 'Customer',
            accessorKey: 'customer',
            cell: (row: any) => (
                <div className="font-medium text-foreground">{row.customer?.name || 'Unknown User'}</div>
            )
        },
        {
            header: 'Date',
            accessorKey: 'invoiceDate',
            cell: (row: any) => (
                <span className="text-muted-foreground whitespace-nowrap">
                    {new Date(row.invoiceDate).toLocaleDateString()}
                </span>
            )
        },
        {
            header: 'Due',
            accessorKey: 'dueDate',
            cell: (row: any) => (
                row.dueDate ? (
                    <span className="text-muted-foreground whitespace-nowrap">
                        {new Date(row.dueDate).toLocaleDateString()}
                    </span>
                ) : <span className="text-muted-foreground opacity-50">On Receipt</span>
            )
        },
        {
            header: 'Total',
            accessorKey: 'total',
            cell: (row: any) => (
                <div className="font-semibold text-foreground">
                    {new Intl.NumberFormat('en-GB', { style: 'currency', currency: row.currency || 'GBP' }).format(row.total)}
                </div>
            )
        },
        {
            header: 'Status',
            accessorKey: 'status',
            cell: (row: any) => {
                const s = row.status || 'draft';
                let v: any = 'secondary';
                if (s === 'paid') v = 'success';
                if (s === 'overdue' || s === 'cancelled') v = 'destructive';
                if (s === 'sent' || s === 'viewed') v = 'default';
                if (s === 'partially_paid') v = 'warning';
                return <span className={getBadgeClasses(v) + " capitalize select-none"}>{s.replace('_', ' ')}</span>;
            }
        },
        {
            header: '',
            accessorKey: 'actions',
            cell: (row: any) => (
                <div className="flex justify-end pr-4">
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
                <Header title="Finance · Invoices" />
                <main className="flex-1 overflow-auto p-4 md:p-6">
                    <div className="flex flex-col gap-6 max-w-[1600px] mx-auto">
                        {/* Page Header */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-6 rounded-2xl border border-border shadow-sm">
                            <div>
                                <h1 className="text-2xl font-bold flex items-center gap-3">
                                    <div className="p-2 bg-primary/10 rounded-xl text-primary">
                                        <Receipt size={24} />
                                    </div>
                                    Invoices
                                </h1>
                                <p className="text-muted-foreground mt-2 text-sm max-w-xl">
                                    Manage all customer billing, view invoice statuses, and track pending or overdue payments.
                                </p>
                            </div>
                            <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-medium rounded-xl hover:bg-primary/90 transition-colors shadow-sm self-start md:self-auto">
                                <Plus size={18} />
                                Create Invoice
                            </button>
                        </div>

                        {/* Data Table */}
                        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                            <RichDataTable
                                columns={columns}
                                data={data}
                                searchPlaceholder="Search by invoice number or customer name..."
                            />
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
