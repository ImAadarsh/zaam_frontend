'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { listOrders, createOrder, updateOrder, deleteOrder, listCustomers } from '@/lib/api';
import { toast } from 'sonner';
import { RichDataTable } from '@/components/rich-data-table';
import { useSession } from '@/hooks/use-session';
import { useRoleCheck } from '@/hooks/use-role-check';
import { ColumnDef } from '@tanstack/react-table';
import { Pencil, Trash2, Plus, X, ShoppingCart, Eye } from 'lucide-react';
import Link from 'next/link';

type Order = {
  id: string;
  orderNumber: string;
  channel?: string;
  customerEmail?: string;
  total?: number;
  currency?: string;
  status?: string;
  paymentStatus?: string;
  fulfillmentStatus?: string;
  orderDate?: string;
  [key: string]: any;
};

export default function OrdersPage() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const { hasAccess } = useRoleCheck(['ADMIN', 'SUPER_ADMIN', 'SALES_REP', 'CUSTOMER_SERVICE', 'WAREHOUSE_MANAGER']);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    orderNumber: '',
    channel: 'shopify' as 'amazon' | 'ebay' | 'tiktok' | 'etsy' | 'shopify' | 'woocommerce' | 'wix' | 'b2b_portal' | 'pos' | 'phone' | 'email' | 'other',
    customerId: '',
    customerEmail: '',
    customerPhone: '',
    orderDate: new Date().toISOString().split('T')[0],
    currency: 'GBP',
    subtotal: 0,
    discountAmount: 0,
    shippingAmount: 0,
    taxAmount: 0,
    total: 0,
    paymentStatus: 'pending' as 'pending' | 'authorized' | 'partially_paid' | 'paid' | 'refunded' | 'failed',
    fulfillmentStatus: 'pending' as 'pending' | 'processing' | 'partially_fulfilled' | 'fulfilled' | 'cancelled',
    status: 'pending' as 'pending' | 'confirmed' | 'processing' | 'completed' | 'cancelled' | 'refunded' | 'on_hold'
  });
  const [editing, setEditing] = useState<Order | null>(null);
  const [confirmDel, setConfirmDel] = useState<Order | null>(null);

  useEffect(() => {
    if (!hydrated || !hasAccess) return;
    if (!session?.accessToken) {
      router.replace('/login');
      return;
    }
    loadData();
    loadCustomers();
  }, [hydrated, hasAccess, router, session?.accessToken, session?.user?.organizationId]);

  async function loadData() {
    try {
      setLoading(true);
      const res = await listOrders({ organizationId: session?.user?.organizationId });
      setItems(res.data || []);
    } catch (e: any) {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  }

  async function loadCustomers() {
    try {
      const res = await listCustomers({ organizationId: session?.user?.organizationId });
      setCustomers(res.data || []);
    } catch (e: any) {
      // Silently fail - customers are optional
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.user?.organizationId || !form.orderNumber || !form.total) {
      toast.error('Please fill in required fields');
      return;
    }
    try {
      const res = await createOrder({
        organizationId: session.user.organizationId,
        ...form,
        orderDate: new Date(form.orderDate).toISOString()
      });
      setItems(prev => [res.data, ...prev]);
      setShowCreate(false);
      setForm({
        orderNumber: '',
        channel: 'shopify',
        customerId: '',
        customerEmail: '',
        customerPhone: '',
        orderDate: new Date().toISOString().split('T')[0],
        currency: 'GBP',
        subtotal: 0,
        discountAmount: 0,
        shippingAmount: 0,
        taxAmount: 0,
        total: 0,
        paymentStatus: 'pending',
        fulfillmentStatus: 'pending',
        status: 'pending'
      });
      toast.success('Order created');
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Failed to create order');
    }
  }

  async function onUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    try {
      const res = await updateOrder(editing.id, {
        ...form,
        orderDate: form.orderDate ? new Date(form.orderDate).toISOString() : undefined
      });
      setItems(prev => prev.map(item => item.id === editing.id ? res.data : item));
      setEditing(null);
      toast.success('Order updated');
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Failed to update order');
    }
  }

  async function onDelete() {
    if (!confirmDel) return;
    try {
      await deleteOrder(confirmDel.id);
      setItems(prev => prev.filter(item => item.id !== confirmDel.id));
      setConfirmDel(null);
      toast.success('Order deleted');
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Failed to delete order');
    }
  }

  const columns = useMemo<ColumnDef<Order>[]>(() => [
    {
      accessorKey: 'orderNumber',
      header: 'Order #',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <ShoppingCart size={16} className="text-muted-foreground" />
          <span className="font-medium">{row.original.orderNumber}</span>
        </div>
      )
    },
    { accessorKey: 'channel', header: 'Channel' },
    { accessorKey: 'customerEmail', header: 'Customer Email' },
    {
      accessorKey: 'total',
      header: 'Total',
      cell: ({ row }) => {
        const total = parseFloat(String(row.original.total || '0'));
        const currency = row.original.currency || 'GBP';
        return `${currency} ${total.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
    },
    { accessorKey: 'status', header: 'Status' },
    { accessorKey: 'paymentStatus', header: 'Payment' },
    { accessorKey: 'fulfillmentStatus', header: 'Fulfillment' },
    {
      accessorKey: 'orderDate',
      header: 'Date',
      cell: ({ row }) => {
        const date = row.original.orderDate;
        return date ? new Date(date).toLocaleDateString() : '-';
      }
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Link
            href={`/orders/orders/${row.original.id}`}
            className="p-1 hover:bg-muted rounded"
            title="View Details"
          >
            <Eye className="h-4 w-4" />
          </Link>
          <button
            onClick={() => {
              setEditing(row.original);
              const order = row.original;
              setForm({
                orderNumber: order.orderNumber || '',
                channel: (order.channel || 'shopify') as any,
                customerId: order.customer?.id || '',
                customerEmail: order.customerEmail || '',
                customerPhone: order.customerPhone || '',
                orderDate: order.orderDate ? new Date(order.orderDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                currency: order.currency || 'GBP',
                subtotal: parseFloat(String(order.subtotal || '0')),
                discountAmount: parseFloat(String(order.discountAmount || '0')),
                shippingAmount: parseFloat(String(order.shippingAmount || '0')),
                taxAmount: parseFloat(String(order.taxAmount || '0')),
                total: parseFloat(String(order.total || '0')),
                paymentStatus: (order.paymentStatus || 'pending') as any,
                fulfillmentStatus: (order.fulfillmentStatus || 'pending') as any,
                status: (order.status || 'pending') as any
              });
            }}
            className="p-1 hover:bg-muted rounded"
            title="Edit"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={() => setConfirmDel(row.original)} className="p-1 hover:bg-muted rounded text-red-500" title="Delete">
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
          <Header title="Orders · Orders" />
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
          <Header title="Orders · Orders" />
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
        <Header title="Orders · Orders" />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold">Orders</h1>
                <p className="text-muted-foreground mt-1">Manage sales orders from all channels</p>
              </div>
              {hasAccess && (
                <button
                  onClick={() => setShowCreate(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-[#D4A017] text-white rounded hover:bg-[#B89015]"
                >
                  <Plus className="h-4 w-4" />
                  Add Order
                </button>
              )}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-sm text-muted-foreground">Loading orders...</div>
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-card">
                <RichDataTable columns={columns} data={items} searchPlaceholder="Search orders..." />
              </div>
            )}

            {/* Create Modal */}
            {showCreate && (
              <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="w-full max-w-3xl rounded-2xl bg-card shadow-2xl border border-border p-6 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Create Order</h3>
                    <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-muted rounded-lg">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <form onSubmit={onCreate} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Order Number *</label>
                        <input
                          type="text"
                          value={form.orderNumber}
                          onChange={e => setForm(prev => ({ ...prev, orderNumber: e.target.value }))}
                          className="input"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Channel *</label>
                        <select
                          value={form.channel}
                          onChange={e => setForm(prev => ({ ...prev, channel: e.target.value as any }))}
                          className="select"
                          required
                        >
                          <option value="amazon">Amazon</option>
                          <option value="ebay">eBay</option>
                          <option value="tiktok">TikTok</option>
                          <option value="etsy">Etsy</option>
                          <option value="shopify">Shopify</option>
                          <option value="woocommerce">WooCommerce</option>
                          <option value="wix">Wix</option>
                          <option value="b2b_portal">B2B Portal</option>
                          <option value="pos">POS</option>
                          <option value="phone">Phone</option>
                          <option value="email">Email</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Customer</label>
                        <select
                          value={form.customerId}
                          onChange={e => setForm(prev => ({ ...prev, customerId: e.target.value }))}
                          className="select"
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
                        <label className="block text-sm font-medium mb-1.5">Customer Email</label>
                        <input
                          type="email"
                          value={form.customerEmail}
                          onChange={e => setForm(prev => ({ ...prev, customerEmail: e.target.value }))}
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Order Date *</label>
                        <input
                          type="date"
                          value={form.orderDate}
                          onChange={e => setForm(prev => ({ ...prev, orderDate: e.target.value }))}
                          className="input"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Currency</label>
                        <input
                          type="text"
                          value={form.currency}
                          onChange={e => setForm(prev => ({ ...prev, currency: e.target.value }))}
                          className="input"
                          maxLength={3}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Subtotal</label>
                        <input
                          type="number"
                          step="0.01"
                          value={form.subtotal}
                          onChange={e => setForm(prev => ({ ...prev, subtotal: parseFloat(e.target.value) || 0 }))}
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Total *</label>
                        <input
                          type="number"
                          step="0.01"
                          value={form.total}
                          onChange={e => setForm(prev => ({ ...prev, total: parseFloat(e.target.value) || 0 }))}
                          className="input"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Payment Status</label>
                        <select
                          value={form.paymentStatus}
                          onChange={e => setForm(prev => ({ ...prev, paymentStatus: e.target.value as any }))}
                          className="select"
                        >
                          <option value="pending">Pending</option>
                          <option value="authorized">Authorized</option>
                          <option value="partially_paid">Partially Paid</option>
                          <option value="paid">Paid</option>
                          <option value="refunded">Refunded</option>
                          <option value="failed">Failed</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Fulfillment Status</label>
                        <select
                          value={form.fulfillmentStatus}
                          onChange={e => setForm(prev => ({ ...prev, fulfillmentStatus: e.target.value as any }))}
                          className="select"
                        >
                          <option value="pending">Pending</option>
                          <option value="processing">Processing</option>
                          <option value="partially_fulfilled">Partially Fulfilled</option>
                          <option value="fulfilled">Fulfilled</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Status</label>
                        <select
                          value={form.status}
                          onChange={e => setForm(prev => ({ ...prev, status: e.target.value as any }))}
                          className="select"
                        >
                          <option value="pending">Pending</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="processing">Processing</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                          <option value="refunded">Refunded</option>
                          <option value="on_hold">On Hold</option>
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
                <div className="w-full max-w-3xl rounded-2xl bg-card shadow-2xl border border-border p-6 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Edit Order</h3>
                    <button onClick={() => setEditing(null)} className="p-1 hover:bg-muted rounded-lg">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <form onSubmit={onUpdate} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Order Number *</label>
                        <input
                          type="text"
                          value={form.orderNumber}
                          onChange={e => setForm(prev => ({ ...prev, orderNumber: e.target.value }))}
                          className="input"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Channel</label>
                        <select
                          value={form.channel}
                          onChange={e => setForm(prev => ({ ...prev, channel: e.target.value as any }))}
                          className="select"
                        >
                          <option value="amazon">Amazon</option>
                          <option value="ebay">eBay</option>
                          <option value="tiktok">TikTok</option>
                          <option value="etsy">Etsy</option>
                          <option value="shopify">Shopify</option>
                          <option value="woocommerce">WooCommerce</option>
                          <option value="wix">Wix</option>
                          <option value="b2b_portal">B2B Portal</option>
                          <option value="pos">POS</option>
                          <option value="phone">Phone</option>
                          <option value="email">Email</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Customer Email</label>
                        <input
                          type="email"
                          value={form.customerEmail}
                          onChange={e => setForm(prev => ({ ...prev, customerEmail: e.target.value }))}
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Order Date</label>
                        <input
                          type="date"
                          value={form.orderDate}
                          onChange={e => setForm(prev => ({ ...prev, orderDate: e.target.value }))}
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Total</label>
                        <input
                          type="number"
                          step="0.01"
                          value={form.total}
                          onChange={e => setForm(prev => ({ ...prev, total: parseFloat(e.target.value) || 0 }))}
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Payment Status</label>
                        <select
                          value={form.paymentStatus}
                          onChange={e => setForm(prev => ({ ...prev, paymentStatus: e.target.value as any }))}
                          className="select"
                        >
                          <option value="pending">Pending</option>
                          <option value="authorized">Authorized</option>
                          <option value="partially_paid">Partially Paid</option>
                          <option value="paid">Paid</option>
                          <option value="refunded">Refunded</option>
                          <option value="failed">Failed</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Fulfillment Status</label>
                        <select
                          value={form.fulfillmentStatus}
                          onChange={e => setForm(prev => ({ ...prev, fulfillmentStatus: e.target.value as any }))}
                          className="select"
                        >
                          <option value="pending">Pending</option>
                          <option value="processing">Processing</option>
                          <option value="partially_fulfilled">Partially Fulfilled</option>
                          <option value="fulfilled">Fulfilled</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Status</label>
                        <select
                          value={form.status}
                          onChange={e => setForm(prev => ({ ...prev, status: e.target.value as any }))}
                          className="select"
                        >
                          <option value="pending">Pending</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="processing">Processing</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                          <option value="refunded">Refunded</option>
                          <option value="on_hold">On Hold</option>
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
                  <h3 className="text-lg font-semibold mb-2">Delete Order</h3>
                  <p className="text-muted-foreground mb-4">Are you sure you want to delete order {confirmDel.orderNumber}? This action cannot be undone.</p>
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

