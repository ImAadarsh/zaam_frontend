'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/hooks/use-session';
import { useRoleCheck } from '@/hooks/use-role-check';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { RichDataTable } from '@/components/rich-data-table';
import { listGateways, deleteGateway } from '@/lib/api';
import { Plus, Wallet, Trash2, Edit2 } from 'lucide-react';
import { toast } from 'sonner';

const getBadgeClasses = (variant: string) => {
    const base = "px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap border ";
    if (variant === 'success') return base + "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
    if (variant === 'destructive') return base + "bg-red-500/10 text-red-600 border-red-500/20";
    if (variant === 'default') return base + "bg-primary text-primary-foreground border-primary";
    if (variant === 'secondary') return base + "bg-muted text-muted-foreground border-border";
    return base + "bg-muted text-foreground border-border";
};

export default function GatewaysPage() {
    const router = useRouter();
    const { session, hydrated } = useSession();
    const { hasAccess } = useRoleCheck(['ADMIN', 'SUPER_ADMIN', 'FINANCE']);
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        if (!session?.user?.organizationId) return;
        try {
            setLoading(true);
            const res = await listGateways(session.user.organizationId);
            setData(res.data || []);
        } catch (error) {
            toast.error('Failed to load gateways');
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
            header: 'Name',
            accessorKey: 'name',
            cell: (row: any) => (
                <div className="font-medium text-foreground">{row.name}</div>
            )
        },
        {
            header: 'Provider',
            accessorKey: 'provider',
            cell: (row: any) => (
                <span className={getBadgeClasses('secondary') + " capitalize"}>
                    {row.provider?.replace('_', ' ')}
                </span>
            )
        },
        {
            header: 'Mode',
            accessorKey: 'mode',
            cell: (row: any) => (
                <span className={getBadgeClasses(row.mode === 'live' ? 'default' : 'secondary') + " capitalize"}>
                    {row.mode}
                </span>
            )
        },
        {
            header: 'Status',
            accessorKey: 'isActive',
            cell: (row: any) => (
                <span className={getBadgeClasses(row.isActive ? 'success' : 'destructive')}>
                    {row.isActive ? 'Active' : 'Inactive'}
                </span>
            )
        },
        {
            header: 'Default',
            accessorKey: 'isDefault',
            cell: (row: any) => (
                row.isDefault ? <span className={getBadgeClasses('default')}>Default</span> : null
            )
        },
        {
            header: 'Created',
            accessorKey: 'createdAt',
            cell: (row: any) => (
                <span className="text-muted-foreground whitespace-nowrap">
                    {new Date(row.createdAt).toLocaleDateString()}
                </span>
            )
        },
        {
            header: '',
            accessorKey: 'actions',
            cell: (row: any) => (
                <div className="flex justify-end gap-2 pr-4">
                    <button
                        className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                        title="Edit Gateway"
                    >
                        <Edit2 size={16} />
                    </button>
                    <button
                        className="p-2 hover:bg-red-500/10 rounded-lg transition-colors text-muted-foreground hover:text-red-500"
                        title="Delete Gateway"
                        onClick={async () => {
                            if (confirm('Are you sure you want to delete this gateway?')) {
                                try {
                                    await deleteGateway(row.id);
                                    toast.success('Gateway deleted');
                                    loadData();
                                } catch {
                                    toast.error('Failed to delete gateway');
                                }
                            }
                        }}
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            )
        }
    ];

    return (
        <div className="min-h-screen app-surface">
            <Sidebar />
            <div className="flex flex-col overflow-hidden lg:ml-[280px]">
                <Header title="Finance · Payment Gateways" />
                <main className="flex-1 overflow-auto p-4 md:p-6">
                    <div className="flex flex-col gap-6 max-w-7xl mx-auto">
                        {/* Page Header */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h1 className="text-2xl font-bold flex items-center gap-2">
                                    <Wallet className="text-primary" size={24} />
                                    Payment Gateways
                                </h1>
                                <p className="text-muted-foreground mt-1 text-sm">
                                    Configure payment processors like Stripe, PayPal, and others for your organization.
                                </p>
                            </div>
                            <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-medium rounded-xl hover:bg-primary/90 transition-colors shadow-sm self-start md:self-auto">
                                <Plus size={18} />
                                Add Gateway
                            </button>
                        </div>

                        {/* Data Table */}
                        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                            <RichDataTable
                                columns={columns}
                                data={data}
                                searchPlaceholder="Search gateways by name or provider..."
                            />
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
