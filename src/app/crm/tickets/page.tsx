'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { listTickets } from '@/lib/api';
import { RichDataTable } from '@/components/rich-data-table';
import { MessageSquare, Plus, Filter, Eye, X, Send } from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import { useMemo } from 'react';
import { listCustomers, createTicket } from '@/lib/api';
import { toast } from 'sonner';
import Link from 'next/link';

export default function TicketsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [tickets, setTickets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(searchParams.get('new') === 'true');
    const [customers, setCustomers] = useState<any[]>([]);
    const [form, setForm] = useState({
        customerId: '',
        subject: '',
        description: '',
        priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
        category: 'general' as any,
        channel: 'web_form' as any
    });

    useEffect(() => {
        const s = getSession();
        if (!s?.accessToken) {
            router.replace('/login');
            return;
        }

        async function loadData() {
            try {
                const [ticketsRes, customersRes] = await Promise.all([
                    listTickets(),
                    listCustomers()
                ]);
                setTickets(ticketsRes.data);
                setCustomers(customersRes.data);
            } catch (err) {
                console.error('Failed to load tickets', err);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [router]);

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        const s = getSession();
        if (!s?.user?.organizationId) return;

        try {
            const res = await createTicket({
                ...form,
                organizationId: s.user.organizationId
            });
            setTickets([res.data, ...tickets]);
            setShowCreate(false);
            setForm({
                customerId: '',
                subject: '',
                description: '',
                priority: 'medium',
                category: 'general',
                channel: 'web_form'
            });
            toast.success('Ticket created successfully');
            router.push(`/crm/tickets/${res.data.id}`);
        } catch (err) {
            toast.error('Failed to create ticket');
        }
    }

    const columns = useMemo<ColumnDef<any>[]>(() => [
        {
            accessorKey: 'ticketNumber',
            header: 'Ticket #',
            cell: (info) => (
                <Link href={`/crm/tickets/${info.row.original.id}`} className="font-bold text-zaam-400 hover:text-zaam-300 transition">
                    {info.getValue() as string}
                </Link>
            )
        },
        { accessorKey: 'subject', header: 'Subject' },
        {
            id: 'customer',
            header: 'Customer',
            accessorFn: (row) => row.customer ? `${row.customer.firstName} ${row.customer.lastName}` : 'Guest'
        },
        {
            accessorKey: 'priority',
            header: 'Priority',
            cell: (info) => {
                const val = info.getValue() as string;
                return (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${val === 'urgent' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-500 border-rose-500/20' :
                        val === 'high' ? 'bg-orange-500/10 text-orange-600 dark:text-orange-500 border-orange-500/20' :
                            'bg-blue-500/10 text-blue-600 dark:text-blue-500 border-blue-500/20'
                        }`}>
                        {val}
                    </span>
                );
            }
        },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: (info) => {
                const val = info.getValue() as string;
                return (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${val === 'open' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 border-emerald-500/20' :
                        val === 'new' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-500 border-blue-500/20' :
                            'bg-muted text-muted-foreground border-border'
                        }`}>
                        {val}
                    </span>
                );
            }
        },
        {
            accessorKey: 'createdAt',
            header: 'Created',
            cell: (info) => new Date(info.getValue() as string).toLocaleDateString()
        },
        {
            id: 'actions',
            header: '',
            cell: (info) => (
                <Link
                    href={`/crm/tickets/${info.row.original.id}`}
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition group"
                >
                    <Eye size={16} className="group-hover:scale-110 transition-transform" />
                </Link>
            )
        }
    ], []);

    return (
        <div className="min-h-screen app-surface">
            <Sidebar />
            <div className="flex flex-col min-w-0 lg:ml-[280px]">
                <Header
                    title="Support Tickets"
                    actions={[
                        { label: 'New Ticket', onClick: () => setShowCreate(true), icon: <Plus size={18} /> }
                    ]}
                />

                <main className="p-6 md:p-8">
                    <RichDataTable
                        data={tickets}
                        columns={columns}
                        searchPlaceholder="Search tickets..."
                    />
                </main>
            </div>

            {/* Create Modal */}
            {showCreate && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="glass-card w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-6 border-b border-border flex items-center justify-between bg-muted/30">
                            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                                <Plus className="text-primary" /> Create New Ticket
                            </h2>
                            <button onClick={() => setShowCreate(false)} className="p-2 hover:bg-muted rounded-full transition text-muted-foreground hover:text-foreground">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleCreate} className="p-6 space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Customer</label>
                                <select
                                    required
                                    value={form.customerId}
                                    onChange={e => setForm({ ...form, customerId: e.target.value })}
                                    className="input bg-background border-border text-foreground"
                                >
                                    <option value="">Select Customer</option>
                                    {customers.map(c => (
                                        <option key={c.id} value={c.id}>{c.firstName} {c.lastName} ({c.email})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Subject</label>
                                <input
                                    required
                                    value={form.subject}
                                    onChange={e => setForm({ ...form, subject: e.target.value })}
                                    className="input bg-background border-border text-foreground placeholder:text-muted-foreground"
                                    placeholder="e.g., Order #1234 delayed"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Priority</label>
                                    <select
                                        value={form.priority}
                                        onChange={e => setForm({ ...form, priority: e.target.value as any })}
                                        className="input bg-background border-border text-foreground"
                                    >
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                        <option value="urgent">Urgent</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Category</label>
                                    <select
                                        value={form.category}
                                        onChange={e => setForm({ ...form, category: e.target.value as any })}
                                        className="input bg-background border-border text-foreground"
                                    >
                                        <option value="general">General</option>
                                        <option value="order_inquiry">Order Inquiry</option>
                                        <option value="return">Return</option>
                                        <option value="technical">Technical</option>
                                        <option value="billing">Billing</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Description</label>
                                <textarea
                                    required
                                    value={form.description}
                                    onChange={e => setForm({ ...form, description: e.target.value })}
                                    className="input bg-background border-border min-h-[100px] resize-none text-foreground placeholder:text-muted-foreground"
                                    placeholder="Provide detailed information..."
                                />
                            </div>

                            <div className="pt-4 flex items-center gap-3">
                                <button type="button" onClick={() => setShowCreate(false)} className="btn flex-1 bg-muted hover:bg-muted/80 text-foreground border-none transition">Cancel</button>
                                <button type="submit" className="btn btn-primary flex-1 gap-2">
                                    <span>Create Ticket</span>
                                    <Send size={18} />
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
