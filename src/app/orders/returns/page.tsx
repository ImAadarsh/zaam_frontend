'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { listReturns, createReturn, updateReturn, deleteReturn, listOrders, listCustomers } from '@/lib/api';
import { toast } from 'sonner';
import { RichDataTable } from '@/components/rich-data-table';
import { useSession } from '@/hooks/use-session';
import { useRoleCheck } from '@/hooks/use-role-check';
import { ColumnDef } from '@tanstack/react-table';
import { Pencil, Trash2, Plus, X, RotateCcw } from 'lucide-react';

type Return = {
  id: string;
  returnNumber: string;
  order?: any;
  customer?: any;
  returnDate?: string;
  reasonCode?: string;
  refundAmount?: number;
  status?: string;
  [key: string]: any;
};

export default function ReturnsPage() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const { hasAccess } = useRoleCheck(['ADMIN', 'SUPER_ADMIN', 'SALES_REP', 'CUSTOMER_SERVICE']);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Return[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    returnNumber: '',
    orderId: '',
    customerId: '',
    returnDate: new Date().toISOString().split('T')[0],
    reasonCode: 'changed_mind' as 'defective' | 'wrong_item' | 'not_as_described' | 'size_issue' | 'changed_mind' | 'damaged_in_transit' | 'other',
    reasonNotes: '',
    refundMethod: 'original_payment' as 'original_payment' | 'store_credit' | 'exchange' | 'no_refund',
    refundAmount: 0,
    restockingFee: 0,
    returnShippingPaidBy: 'customer' as 'customer' | 'merchant',
    status: 'requested' as 'requested' | 'approved' | 'rejected' | 'received' | 'refunded' | 'completed' | 'cancelled',
    notes: ''
  });
  const [editing, setEditing] = useState<Return | null>(null);
  const [confirmDel, setConfirmDel] = useState<Return | null>(null);

  useEffect(() => {
    if (!hydrated || !hasAccess) return;
    if (!session?.accessToken) {
      router.replace('/login');
      return;
    }
    loadData();
    loadOrders();
    loadCustomers();
  }, [hydrated, hasAccess, router, session?.accessToken, session?.user?.organizationId]);

  async function loadData() {
    try {
      setLoading(true);
      const res = await listReturns({ organizationId: session?.user?.organizationId });
      setItems(res.data || []);
    } catch (e: any) {
      toast.error('Failed to load returns');
    } finally {
      setLoading(false);
    }
  }

  async function loadOrders() {
    try {
      const res = await listOrders({ organizationId: session?.user?.organizationId });
      setOrders(res.data || []);
    } catch (e: any) {
      // Silently fail
    }
  }

  async function loadCustomers() {
    try {
      const res = await listCustomers({ organizationId: session?.user?.organizationId });
      setCustomers(res.data || []);
    } catch (e: any) {
      // Silently fail
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.user?.organizationId || !form.returnNumber || !form.orderId || !form.customerId) {
      toast.error('Please fill in required fields');
      return;
    }
    try {
      const res = await createReturn({
        organizationId: session.user.organizationId,
        ...form,
        returnDate: new Date(form.returnDate).toISOString().split('T')[0]
      });
      setItems(prev => [res.data, ...prev]);
      setShowCreate(false);
      setForm({
        returnNumber: '',
        orderId: '',
        customerId: '',
        returnDate: new Date().toISOString().split('T')[0],
        reasonCode: 'changed_mind',
        reasonNotes: '',
        refundMethod: 'original_payment',
        refundAmount: 0,
        restockingFee: 0,
        returnShippingPaidBy: 'customer',
        status: 'requested',
        notes: ''
      });
      toast.success('Return created');
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Failed to create return');
    }
  }

  async function onUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    try {
      const res = await updateReturn(editing.id, {
        ...form,
        returnDate: form.returnDate ? new Date(form.returnDate).toISOString().split('T')[0] : undefined
      });
      setItems(prev => prev.map(item => item.id === editing.id ? res.data : item));
      setEditing(null);
      toast.success('Return updated');
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Failed to update return');
    }
  }

  async function onDelete() {
    if (!confirmDel) return;
    try {
      await deleteReturn(confirmDel.id);
      setItems(prev => prev.filter(item => item.id !== confirmDel.id));
      setConfirmDel(null);
      toast.success('Return deleted');
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Failed to delete return');
    }
  }

  const columns = useMemo<ColumnDef<Return>[]>(() => [
    {
      accessorKey: 'returnNumber',
      header: 'Return #',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <RotateCcw size={16} className="text-muted-foreground" />
          <span className="font-medium">{row.original.returnNumber}</span>
        </div>
      )
    },
    {
      accessorKey: 'order',
      header: 'Order',
      cell: ({ row }) => row.original.order?.orderNumber || '-'
    },
    {
      accessorKey: 'customer',
      header: 'Customer',
      cell: ({ row }) => {
        const c = row.original.customer;
        return c?.companyName || `${c?.firstName || ''} ${c?.lastName || ''}`.trim() || c?.email || '-';
      }
    },
    { accessorKey: 'reasonCode', header: 'Reason' },
    {
      accessorKey: 'refundAmount',
      header: 'Refund Amount',
      cell: ({ row }) => {
        const amount = parseFloat(String(row.original.refundAmount || '0'));
        return `£${amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
    },
    { accessorKey: 'status', header: 'Status' },
    {
      accessorKey: 'returnDate',
      header: 'Date',
      cell: ({ row }) => {
        const date = row.original.returnDate;
        return date ? new Date(date).toLocaleDateString() : '-';
      }
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-2">
          <button
            onClick={() => {
              setEditing(row.original);
              const ret = row.original;
              setForm({
                returnNumber: ret.returnNumber || '',
                orderId: ret.order?.id || '',
                customerId: ret.customer?.id || '',
                returnDate: ret.returnDate ? new Date(ret.returnDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                reasonCode: (ret.reasonCode || 'changed_mind') as any,
                reasonNotes: ret.reasonNotes || '',
                refundMethod: (ret.refundMethod || 'original_payment') as any,
                refundAmount: parseFloat(String(ret.refundAmount || '0')),
                restockingFee: parseFloat(String(ret.restockingFee || '0')),
                returnShippingPaidBy: (ret.returnShippingPaidBy || 'customer') as any,
                status: (ret.status || 'requested') as any,
                notes: ret.notes || ''
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
          <Header title="Orders · Returns" />
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
          <Header title="Orders · Returns" />
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
        <Header title="Orders · Returns" />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold">Returns</h1>
                <p className="text-muted-foreground mt-1">Manage returns and RMA requests</p>
              </div>
              {hasAccess && (
                <button
                  onClick={() => setShowCreate(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-[#D4A017] text-white rounded hover:bg-[#B89015]"
                >
                  <Plus className="h-4 w-4" />
                  Add Return
                </button>
              )}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-sm text-muted-foreground">Loading returns...</div>
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-card">
                <RichDataTable columns={columns} data={items} searchPlaceholder="Search returns..." />
              </div>
            )}

            {/* Create Modal */}
            {showCreate && (
              <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="w-full max-w-3xl rounded-2xl bg-card shadow-2xl border border-border p-6 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Create Return</h3>
                    <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-muted rounded-lg">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <form onSubmit={onCreate} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Return Number *</label>
                        <input
                          type="text"
                          value={form.returnNumber}
                          onChange={e => setForm(prev => ({ ...prev, returnNumber: e.target.value }))}
                          className="input"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Order *</label>
                        <select
                          value={form.orderId}
                          onChange={e => setForm(prev => ({ ...prev, orderId: e.target.value }))}
                          className="select"
                          required
                        >
                          <option value="">Select order...</option>
                          {orders.map(o => (
                            <option key={o.id} value={o.id}>
                              {o.orderNumber} - {o.customerEmail || 'No email'}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Customer *</label>
                        <select
                          value={form.customerId}
                          onChange={e => setForm(prev => ({ ...prev, customerId: e.target.value }))}
                          className="select"
                          required
                        >
                          <option value="">Select customer...</option>
                          {customers.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.companyName || `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email || c.id}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Return Date *</label>
                        <input
                          type="date"
                          value={form.returnDate}
                          onChange={e => setForm(prev => ({ ...prev, returnDate: e.target.value }))}
                          className="input"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Reason Code *</label>
                        <select
                          value={form.reasonCode}
                          onChange={e => setForm(prev => ({ ...prev, reasonCode: e.target.value as any }))}
                          className="select"
                          required
                        >
                          <option value="defective">Defective</option>
                          <option value="wrong_item">Wrong Item</option>
                          <option value="not_as_described">Not As Described</option>
                          <option value="size_issue">Size Issue</option>
                          <option value="changed_mind">Changed Mind</option>
                          <option value="damaged_in_transit">Damaged in Transit</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Refund Method</label>
                        <select
                          value={form.refundMethod}
                          onChange={e => setForm(prev => ({ ...prev, refundMethod: e.target.value as any }))}
                          className="select"
                        >
                          <option value="original_payment">Original Payment</option>
                          <option value="store_credit">Store Credit</option>
                          <option value="exchange">Exchange</option>
                          <option value="no_refund">No Refund</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Refund Amount</label>
                        <input
                          type="number"
                          step="0.01"
                          value={form.refundAmount}
                          onChange={e => setForm(prev => ({ ...prev, refundAmount: parseFloat(e.target.value) || 0 }))}
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Status</label>
                        <select
                          value={form.status}
                          onChange={e => setForm(prev => ({ ...prev, status: e.target.value as any }))}
                          className="select"
                        >
                          <option value="requested">Requested</option>
                          <option value="approved">Approved</option>
                          <option value="rejected">Rejected</option>
                          <option value="received">Received</option>
                          <option value="refunded">Refunded</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="block text-sm font-medium mb-1.5">Reason Notes</label>
                        <textarea
                          value={form.reasonNotes}
                          onChange={e => setForm(prev => ({ ...prev, reasonNotes: e.target.value }))}
                          className="input"
                          rows={3}
                        />
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
                <div className="w-full max-w-3xl rounded-2xl bg-card shadow-2xl border border-border p-6 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Edit Return</h3>
                    <button onClick={() => setEditing(null)} className="p-1 hover:bg-muted rounded-lg">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <form onSubmit={onUpdate} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Return Number</label>
                        <input
                          type="text"
                          value={form.returnNumber}
                          onChange={e => setForm(prev => ({ ...prev, returnNumber: e.target.value }))}
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Return Date</label>
                        <input
                          type="date"
                          value={form.returnDate}
                          onChange={e => setForm(prev => ({ ...prev, returnDate: e.target.value }))}
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Reason Code</label>
                        <select
                          value={form.reasonCode}
                          onChange={e => setForm(prev => ({ ...prev, reasonCode: e.target.value as any }))}
                          className="select"
                        >
                          <option value="defective">Defective</option>
                          <option value="wrong_item">Wrong Item</option>
                          <option value="not_as_described">Not As Described</option>
                          <option value="size_issue">Size Issue</option>
                          <option value="changed_mind">Changed Mind</option>
                          <option value="damaged_in_transit">Damaged in Transit</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Refund Method</label>
                        <select
                          value={form.refundMethod}
                          onChange={e => setForm(prev => ({ ...prev, refundMethod: e.target.value as any }))}
                          className="select"
                        >
                          <option value="original_payment">Original Payment</option>
                          <option value="store_credit">Store Credit</option>
                          <option value="exchange">Exchange</option>
                          <option value="no_refund">No Refund</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Refund Amount</label>
                        <input
                          type="number"
                          step="0.01"
                          value={form.refundAmount}
                          onChange={e => setForm(prev => ({ ...prev, refundAmount: parseFloat(e.target.value) || 0 }))}
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Status</label>
                        <select
                          value={form.status}
                          onChange={e => setForm(prev => ({ ...prev, status: e.target.value as any }))}
                          className="select"
                        >
                          <option value="requested">Requested</option>
                          <option value="approved">Approved</option>
                          <option value="rejected">Rejected</option>
                          <option value="received">Received</option>
                          <option value="refunded">Refunded</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="block text-sm font-medium mb-1.5">Notes</label>
                        <textarea
                          value={form.notes}
                          onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                          className="input"
                          rows={3}
                        />
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
                  <h3 className="text-lg font-semibold mb-2">Delete Return</h3>
                  <p className="text-muted-foreground mb-4">Are you sure you want to delete return {confirmDel.returnNumber}? This action cannot be undone.</p>
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

