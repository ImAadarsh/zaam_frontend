'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { listCustomers, createCustomer, updateCustomer, deleteCustomer } from '@/lib/api';
import { toast } from 'sonner';
import { RichDataTable } from '@/components/rich-data-table';
import { useSession } from '@/hooks/use-session';
import { useRoleCheck } from '@/hooks/use-role-check';
import { ColumnDef } from '@tanstack/react-table';
import { Pencil, Trash2, Plus, X, User } from 'lucide-react';

type Customer = {
  id: string;
  customerNumber?: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  customerType?: string;
  tier?: string;
  status?: string;
  [key: string]: any;
};

export default function CustomersPage() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const { hasAccess } = useRoleCheck(['ADMIN', 'SUPER_ADMIN', 'SALES_REP', 'CUSTOMER_SERVICE']);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Customer[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    email: '',
    phone: '',
    firstName: '',
    lastName: '',
    companyName: '',
    customerType: 'individual' as 'individual' | 'business' | 'wholesale' | 'vip',
    tier: 'standard' as 'standard' | 'silver' | 'gold' | 'platinum',
    status: 'active' as 'active' | 'inactive' | 'blocked'
  });
  const [editing, setEditing] = useState<Customer | null>(null);
  const [confirmDel, setConfirmDel] = useState<Customer | null>(null);

  useEffect(() => {
    if (!hydrated || !hasAccess) return;
    if (!session?.accessToken) {
      router.replace('/login');
      return;
    }
    loadData();
  }, [hydrated, hasAccess, router, session?.accessToken, session?.user?.organizationId]);

  async function loadData() {
    try {
      setLoading(true);
      const res = await listCustomers({ organizationId: session?.user?.organizationId });
      setItems(res.data || []);
    } catch (e: any) {
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.user?.organizationId) {
      toast.error('Organization ID required');
      return;
    }
    try {
      const res = await createCustomer({
        organizationId: session.user.organizationId,
        ...form
      });
      setItems(prev => [res.data, ...prev]);
      setShowCreate(false);
      setForm({ email: '', phone: '', firstName: '', lastName: '', companyName: '', customerType: 'individual', tier: 'standard', status: 'active' });
      toast.success('Customer created');
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Failed to create customer');
    }
  }

  async function onUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    try {
      const res = await updateCustomer(editing.id, form);
      setItems(prev => prev.map(item => item.id === editing.id ? res.data : item));
      setEditing(null);
      toast.success('Customer updated');
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Failed to update customer');
    }
  }

  async function onDelete() {
    if (!confirmDel) return;
    try {
      await deleteCustomer(confirmDel.id);
      setItems(prev => prev.filter(item => item.id !== confirmDel.id));
      setConfirmDel(null);
      toast.success('Customer deleted');
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Failed to delete customer');
    }
  }

  const columns = useMemo<ColumnDef<Customer>[]>(() => [
    {
      accessorKey: 'customerNumber',
      header: 'Customer #',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <User size={16} className="text-muted-foreground" />
          <span className="font-medium">{row.original.customerNumber || '-'}</span>
        </div>
      )
    },
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => {
        const c = row.original;
        return c.companyName || `${c.firstName || ''} ${c.lastName || ''}`.trim() || '-';
      }
    },
    { accessorKey: 'email', header: 'Email' },
    { accessorKey: 'phone', header: 'Phone' },
    { accessorKey: 'customerType', header: 'Type' },
    { accessorKey: 'tier', header: 'Tier' },
    { accessorKey: 'status', header: 'Status' },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-2">
          <button
            onClick={() => {
              setEditing(row.original);
              setForm({
                email: row.original.email || '',
                phone: row.original.phone || '',
                firstName: row.original.firstName || '',
                lastName: row.original.lastName || '',
                companyName: row.original.companyName || '',
                customerType: (row.original.customerType || 'individual') as any,
                tier: (row.original.tier || 'standard') as any,
                status: (row.original.status || 'active') as any
              });
            }}
            className="p-1 hover:bg-muted rounded"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={() => setConfirmDel(row.original)} className="p-1 hover:bg-muted rounded text-red-500">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )
    }
  ], []);

  if (!hydrated || loading) {
    return (
      <div className="min-h-screen app-surface">
        <Sidebar />
        <div className="flex flex-col overflow-hidden lg:ml-[280px]">
          <Header title="Orders · Customers" />
          <main className="flex-1 overflow-auto p-4 md:p-6">
            <div className="flex items-center justify-center h-full">
              <div className="text-muted-foreground">Loading...</div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen app-surface">
        <Sidebar />
        <div className="flex flex-col overflow-hidden lg:ml-[280px]">
          <Header title="Orders · Customers" />
          <main className="flex-1 overflow-auto p-4 md:p-6">
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
                <p className="text-muted-foreground">You do not have permission to view this page.</p>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen app-surface">
      <Sidebar />
      <div className="flex flex-col overflow-hidden lg:ml-[280px]">
        <Header title="Orders · Customers" />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold">Customers</h1>
                <p className="text-muted-foreground mt-1">Manage customer information</p>
              </div>
              {hasAccess && (
                <button
                  onClick={() => setShowCreate(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-[#D4A017] text-white rounded hover:bg-[#B89015]"
                >
                  <Plus className="h-4 w-4" />
                  Add Customer
                </button>
              )}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-sm text-muted-foreground">Loading customers...</div>
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-card">
                <RichDataTable columns={columns} data={items} searchPlaceholder="Search customers..." />
              </div>
            )}

            {/* Create Modal */}
            {showCreate && (
              <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="w-full max-w-2xl rounded-2xl bg-card shadow-2xl border border-border p-6 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Create Customer</h3>
                    <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-muted rounded-lg">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <form onSubmit={onCreate} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1.5">First Name</label>
                        <input
                          type="text"
                          value={form.firstName}
                          onChange={e => setForm(prev => ({ ...prev, firstName: e.target.value }))}
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Last Name</label>
                        <input
                          type="text"
                          value={form.lastName}
                          onChange={e => setForm(prev => ({ ...prev, lastName: e.target.value }))}
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Company Name</label>
                        <input
                          type="text"
                          value={form.companyName}
                          onChange={e => setForm(prev => ({ ...prev, companyName: e.target.value }))}
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Email</label>
                        <input
                          type="email"
                          value={form.email}
                          onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Phone</label>
                        <input
                          type="text"
                          value={form.phone}
                          onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))}
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Customer Type</label>
                        <select
                          value={form.customerType}
                          onChange={e => setForm(prev => ({ ...prev, customerType: e.target.value as any }))}
                          className="select"
                        >
                          <option value="individual">Individual</option>
                          <option value="business">Business</option>
                          <option value="wholesale">Wholesale</option>
                          <option value="vip">VIP</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Tier</label>
                        <select
                          value={form.tier}
                          onChange={e => setForm(prev => ({ ...prev, tier: e.target.value as any }))}
                          className="select"
                        >
                          <option value="standard">Standard</option>
                          <option value="silver">Silver</option>
                          <option value="gold">Gold</option>
                          <option value="platinum">Platinum</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Status</label>
                        <select
                          value={form.status}
                          onChange={e => setForm(prev => ({ ...prev, status: e.target.value as any }))}
                          className="select"
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                          <option value="blocked">Blocked</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-4">
                      <button type="submit" className="px-4 py-2 bg-[#D4A017] text-white rounded hover:bg-[#B89015]">
                        Create
                      </button>
                      <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 bg-muted rounded hover:bg-muted/80">
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Edit Modal */}
            {editing && (
              <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="w-full max-w-2xl rounded-2xl bg-card shadow-2xl border border-border p-6 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Edit Customer</h3>
                    <button onClick={() => setEditing(null)} className="p-1 hover:bg-muted rounded-lg">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <form onSubmit={onUpdate} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1.5">First Name</label>
                        <input
                          type="text"
                          value={form.firstName}
                          onChange={e => setForm(prev => ({ ...prev, firstName: e.target.value }))}
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Last Name</label>
                        <input
                          type="text"
                          value={form.lastName}
                          onChange={e => setForm(prev => ({ ...prev, lastName: e.target.value }))}
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Company Name</label>
                        <input
                          type="text"
                          value={form.companyName}
                          onChange={e => setForm(prev => ({ ...prev, companyName: e.target.value }))}
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Email</label>
                        <input
                          type="email"
                          value={form.email}
                          onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Phone</label>
                        <input
                          type="text"
                          value={form.phone}
                          onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))}
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Customer Type</label>
                        <select
                          value={form.customerType}
                          onChange={e => setForm(prev => ({ ...prev, customerType: e.target.value as any }))}
                          className="select"
                        >
                          <option value="individual">Individual</option>
                          <option value="business">Business</option>
                          <option value="wholesale">Wholesale</option>
                          <option value="vip">VIP</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Tier</label>
                        <select
                          value={form.tier}
                          onChange={e => setForm(prev => ({ ...prev, tier: e.target.value as any }))}
                          className="select"
                        >
                          <option value="standard">Standard</option>
                          <option value="silver">Silver</option>
                          <option value="gold">Gold</option>
                          <option value="platinum">Platinum</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Status</label>
                        <select
                          value={form.status}
                          onChange={e => setForm(prev => ({ ...prev, status: e.target.value as any }))}
                          className="select"
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                          <option value="blocked">Blocked</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-4">
                      <button type="submit" className="px-4 py-2 bg-[#D4A017] text-white rounded hover:bg-[#B89015]">
                        Update
                      </button>
                      <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 bg-muted rounded hover:bg-muted/80">
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Delete Confirmation */}
            {confirmDel && (
              <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="w-full max-w-md rounded-2xl bg-card shadow-2xl border border-border p-6">
                  <h3 className="text-lg font-semibold mb-2">Delete Customer</h3>
                  <p className="text-muted-foreground mb-4">Are you sure you want to delete this customer? This action cannot be undone.</p>
                  <div className="flex gap-2">
                    <button onClick={onDelete} className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">
                      Delete
                    </button>
                    <button onClick={() => setConfirmDel(null)} className="px-4 py-2 bg-muted rounded hover:bg-muted/80">
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

