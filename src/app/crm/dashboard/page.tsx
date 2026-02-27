'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { StatCard } from '@/components/stat-card';
import { MessageSquare, Clock, CheckCircle, Star, Filter, Plus } from 'lucide-react';
import { listTickets } from '@/lib/api';

export default function CRMDashboard() {
    const router = useRouter();
    const [tickets, setTickets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const s = getSession();
        if (!s?.accessToken) {
            router.replace('/login');
            return;
        }

        async function loadData() {
            try {
                const { data } = await listTickets();
                setTickets(data);
            } catch (err) {
                console.error('Failed to load tickets', err);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [router]);

    const openTickets = tickets.filter(t => ['new', 'open'].includes(t.status)).length;
    const resolvedTickets = tickets.filter(t => t.status === 'resolved').length;
    const highPriority = tickets.filter(t => ['high', 'urgent'].includes(t.priority)).length;

    return (
        <div className="min-h-screen app-surface">
            <Sidebar />
            <div className="flex flex-col min-w-0 lg:ml-[280px]">
                <Header title="CRM Services Dashboard" />

                <main className="p-6 md:p-8 space-y-8">
                    {/* Stats Grid */}
                    <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
                        <StatCard
                            title="Total Tickets"
                            value={tickets.length.toString()}
                            hint="All time"
                            icon={<MessageSquare size={20} />}
                        />
                        <StatCard
                            title="Open Tickets"
                            value={openTickets.toString()}
                            hint="Needs attention"
                            icon={<Clock size={20} />}
                        />
                        <StatCard
                            title="Resolved"
                            value={resolvedTickets.toString()}
                            hint="Completed items"
                            icon={<CheckCircle size={20} />}
                        />
                        <StatCard
                            title="CSAT Score"
                            value="4.8"
                            hint="Average rating"
                            icon={<Star size={20} />}
                        />
                    </div>

                    <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
                        {/* Recent Tickets Table Placeholder */}
                        <div className="lg:col-span-2 space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-semibold tracking-tight">Recent Tickets</h2>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => router.push('/crm/tickets')}
                                        className="text-sm text-primary hover:underline"
                                    >
                                        View All
                                    </button>
                                    <button
                                        onClick={() => router.push('/crm/tickets?new=true')}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                                    >
                                        <Plus size={16} />
                                        <span>New Ticket</span>
                                    </button>
                                </div>
                            </div>

                            <div className="glass-panel rounded-2xl border border-border/50 overflow-hidden">
                                <table className="w-full text-left text-sm">
                                    <thead>
                                        <tr className="bg-muted/50 text-muted-foreground">
                                            <th className="px-4 py-3 font-medium">Ticket #</th>
                                            <th className="px-4 py-3 font-medium">Subject</th>
                                            <th className="px-4 py-3 font-medium">Priority</th>
                                            <th className="px-4 py-3 font-medium">Status</th>
                                            <th className="px-4 py-3 font-medium text-right">Created</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/50">
                                        {loading ? (
                                            <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground italic">Loading tickets...</td></tr>
                                        ) : tickets.length === 0 ? (
                                            <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground italic">No tickets found.</td></tr>
                                        ) : (
                                            tickets.slice(0, 5).map((ticket) => (
                                                <tr key={ticket.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => router.push(`/crm/tickets/${ticket.id}`)}>
                                                    <td className="px-4 py-3 font-mono text-xs">{ticket.ticketNumber}</td>
                                                    <td className="px-4 py-3">{ticket.subject}</td>
                                                    <td className="px-4 py-3">
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${ticket.priority === 'urgent' ? 'bg-rose-500/10 text-rose-600' :
                                                            ticket.priority === 'high' ? 'bg-orange-500/10 text-orange-600' :
                                                                'bg-blue-500/10 text-blue-600'
                                                            }`}>
                                                            {ticket.priority}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${ticket.status === 'open' ? 'bg-emerald-500/10 text-emerald-600' :
                                                            ticket.status === 'new' ? 'bg-blue-500/10 text-blue-600' :
                                                                'bg-muted text-muted-foreground'
                                                            }`}>
                                                            {ticket.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-muted-foreground">
                                                        {new Date(ticket.createdAt).toLocaleDateString()}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Sidebar content - Quick Actions / Stats */}
                        <div className="space-y-6">
                            <div className="glass-panel p-6 rounded-2xl border border-border/50 space-y-4">
                                <h3 className="font-semibold px-1">Quick Actions</h3>
                                <div className="grid grid-cols-1 gap-2">
                                    <button className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-muted transition-colors text-left" onClick={() => router.push('/crm/canned-responses')}>
                                        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600">
                                            <MessageSquare size={18} />
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium">Canned Responses</div>
                                            <div className="text-xs text-muted-foreground">Manage templates</div>
                                        </div>
                                    </button>
                                    <button className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-muted transition-colors text-left" onClick={() => router.push('/crm/customer-tiers')}>
                                        <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600">
                                            <Star size={18} />
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium">Customer Tiers</div>
                                            <div className="text-xs text-muted-foreground">Loyalty levels</div>
                                        </div>
                                    </button>
                                </div>
                            </div>

                            <div className="glass-panel p-6 rounded-2xl border border-border/50 space-y-4">
                                <h3 className="font-semibold px-1">Priority Alert</h3>
                                {highPriority > 0 ? (
                                    <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20 text-rose-600">
                                        <div className="text-sm font-bold flex items-center gap-2">
                                            <Filter size={14} />
                                            {highPriority} Urgent Tickets
                                        </div>
                                        <div className="text-xs mt-1">
                                            High priority tickets require immediate attention.
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-emerald-600">
                                        <div className="text-sm font-bold flex items-center gap-2">
                                            <CheckCircle size={14} />
                                            All caught up!
                                        </div>
                                        <div className="text-xs mt-1">
                                            No urgent tickets pending.
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
