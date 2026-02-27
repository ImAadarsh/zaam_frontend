'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { listCustomerTiers } from '@/lib/api';
import { RichDataTable } from '@/components/rich-data-table';
import { Star, Plus, Pencil, Trash2, X, Save, Send } from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import { useMemo } from 'react';
import { createCustomerTier, updateCustomerTier, deleteCustomerTier } from '@/lib/api';
import { toast } from 'sonner';

export default function CustomerTiersPage() {
    const router = useRouter();
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [editing, setEditing] = useState<any>(null);
    const [form, setForm] = useState({
        tierName: '',
        tierCode: '',
        discountPercent: 0,
        prioritySupport: false,
        isActive: true,
        position: 0
    });

    useEffect(() => {
        const s = getSession();
        if (!s?.accessToken) {
            router.replace('/login');
            return;
        }

        async function loadData() {
            try {
                const { data } = await listCustomerTiers();
                setItems(data);
            } catch (err) {
                console.error('Failed to load tiers', err);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [router]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const s = getSession();
        if (!s?.user?.organizationId) return;

        try {
            if (editing) {
                const res = await updateCustomerTier(editing.id, form);
                setItems(items.map(i => i.id === editing.id ? res.data : i));
                toast.success('Tier updated');
            } else {
                const res = await createCustomerTier({
                    ...form,
                    organizationId: s.user.organizationId
                });
                setItems([...items, res.data]);
                toast.success('Tier created');
            }
            setShowCreate(false);
            setEditing(null);
            setForm({ tierName: '', tierCode: '', discountPercent: 0, prioritySupport: false, isActive: true, position: 0 });
        } catch (err) {
            toast.error('Failed to save tier');
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Are you sure you want to delete this tier?')) return;
        try {
            await deleteCustomerTier(id);
            setItems(items.filter(i => i.id !== id));
            toast.success('Tier deleted');
        } catch (err) {
            toast.error('Failed to delete tier');
        }
    }

    const columns = useMemo<ColumnDef<any>[]>(() => [
        { accessorKey: 'tierName', header: 'Tier Name' },
        { accessorKey: 'tierCode', header: 'Code' },
        {
            accessorKey: 'discountPercent',
            header: 'Discount',
            cell: (info) => info.getValue() ? `${info.getValue()}%` : '-'
        },
        {
            accessorKey: 'prioritySupport',
            header: 'Priority Support',
            cell: (info) => info.getValue() ? (
                <span className="flex items-center gap-1 text-amber-500 font-bold text-[10px] uppercase">
                    <Star size={10} fill="currentColor" /> Priority
                </span>
            ) : <span className="text-white/20">-</span>
        },
        {
            accessorKey: 'isActive',
            header: 'Status',
            cell: (info) => (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${info.getValue() ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                    }`}>
                    {info.getValue() ? 'Active' : 'Inactive'}
                </span>
            )
        },
        {
            id: 'actions',
            header: '',
            cell: (info) => (
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => {
                            setEditing(info.row.original);
                            setForm({
                                tierName: info.row.original.tierName,
                                tierCode: info.row.original.tierCode,
                                discountPercent: info.row.original.discountPercent || 0,
                                prioritySupport: info.row.original.prioritySupport || false,
                                isActive: info.row.original.isActive,
                                position: info.row.original.position || 0
                            });
                            setShowCreate(true);
                        }}
                        className="p-2 rounded-lg hover:bg-white/5 text-white/20 hover:text-white transition"
                    >
                        <Pencil size={16} />
                    </button>
                    <button
                        onClick={() => handleDelete(info.row.original.id)}
                        className="p-2 rounded-lg hover:bg-rose-500/10 text-white/20 hover:text-rose-500 transition"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            )
        }
    ], [items]);

    return (
        <div className="min-h-screen app-surface">
            <Sidebar />
            <div className="flex flex-col min-w-0 lg:ml-[280px]">
                <Header
                    title="Customer Tiers"
                    actions={[
                        {
                            label: 'New Tier', onClick: () => {
                                setEditing(null);
                                setForm({ tierName: '', tierCode: '', discountPercent: 0, prioritySupport: false, isActive: true, position: 0 });
                                setShowCreate(true);
                            }, icon: <Plus size={18} />
                        }
                    ]}
                />

                <main className="p-6 md:p-8">
                    <RichDataTable
                        data={items}
                        columns={columns}
                        searchPlaceholder="Search tiers..."
                    />
                </main>
            </div>

            {/* Create/Edit Modal */}
            {showCreate && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="glass-card w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                {editing ? <Pencil className="text-zaam-400" /> : <Plus className="text-zaam-400" />}
                                {editing ? 'Edit Tier' : 'Create Tier'}
                            </h2>
                            <button onClick={() => setShowCreate(false)} className="p-2 hover:bg-white/5 rounded-full transition text-white/40 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-white/40 uppercase tracking-widest">Tier Name</label>
                                    <input
                                        required
                                        value={form.tierName}
                                        onChange={e => setForm({ ...form, tierName: e.target.value })}
                                        className="input bg-black/40 border-white/10"
                                        placeholder="e.g., Gold"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-white/40 uppercase tracking-widest">Code</label>
                                    <input
                                        required
                                        value={form.tierCode}
                                        onChange={e => setForm({ ...form, tierCode: e.target.value })}
                                        className="input bg-black/40 border-white/10"
                                        placeholder="e.g., GOLD_TIER"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-white/40 uppercase tracking-widest">Discount (%)</label>
                                    <input
                                        type="number"
                                        required
                                        value={form.discountPercent}
                                        onChange={e => setForm({ ...form, discountPercent: Number(e.target.value) })}
                                        className="input bg-black/40 border-white/10"
                                        placeholder="0"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-white/40 uppercase tracking-widest">Position</label>
                                    <input
                                        type="number"
                                        required
                                        value={form.position}
                                        onChange={e => setForm({ ...form, position: Number(e.target.value) })}
                                        className="input bg-black/40 border-white/10"
                                        placeholder="0"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-3 pt-2">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="prioritySupport"
                                        checked={form.prioritySupport}
                                        onChange={e => setForm({ ...form, prioritySupport: e.target.checked })}
                                        className="w-4 h-4 rounded border-white/10 bg-black/40 text-zaam-500 focus:ring-zaam-500/20"
                                    />
                                    <label htmlFor="prioritySupport" className="text-sm text-white/60 select-none">Priority Support</label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="isActive"
                                        checked={form.isActive}
                                        onChange={e => setForm({ ...form, isActive: e.target.checked })}
                                        className="w-4 h-4 rounded border-white/10 bg-black/40 text-zaam-500 focus:ring-zaam-500/20"
                                    />
                                    <label htmlFor="isActive" className="text-sm text-white/60 select-none">Mark as active</label>
                                </div>
                            </div>

                            <div className="pt-4 flex items-center gap-3">
                                <button type="button" onClick={() => setShowCreate(false)} className="btn flex-1 bg-white/5 hover:bg-white/10 border-none transition">Cancel</button>
                                <button type="submit" className="btn btn-primary flex-1 gap-2">
                                    {editing ? <Save size={18} /> : <Send size={18} />}
                                    <span>{editing ? 'Update Tier' : 'Save Tier'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
