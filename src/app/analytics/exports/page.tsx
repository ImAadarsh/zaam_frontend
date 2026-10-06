'use client';
import { useEffect, useState, useMemo } from 'react';
import { rangeForPreset } from '@/components/date-range-filter';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { listDataExports, createDataExport, deleteDataExport, downloadDataExport } from '@/lib/api';
import { toast } from 'sonner';
import { RichDataTable } from '@/components/rich-data-table';
import { useSession } from '@/hooks/use-session';
import { useRoleCheck } from '@/hooks/use-role-check';
import { ColumnDef } from '@tanstack/react-table';
import { Trash2, Plus, X, Download } from 'lucide-react';

export default function ExportsPage() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const { hasAccess } = useRoleCheck(['ADMIN', 'SUPER_ADMIN', 'FINANCE']);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const emptyForm = { exportName: '', entityType: 'orders', exportFormat: 'csv', from: '', to: '' };
  const [form, setForm] = useState(emptyForm);
  const [confirmDel, setConfirmDel] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      const { data } = await listDataExports();
      setItems(data || []);
    } catch (e: any) {
      toast.error('Failed to load exports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!hydrated || !hasAccess) return;
    if (!session?.accessToken) {
      router.replace('/login');
      return;
    }
    loadData();
  }, [hydrated, hasAccess, router, session?.accessToken]);

  const pending = items.some((i) => i.status === 'queued' || i.status === 'processing');
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => { void loadData(); }, 3000);
    return () => clearInterval(t);
  }, [pending]);

  const handleDownload = async (row: any) => {
    const ext = row.exportFormat === 'json' ? 'json' : row.exportFormat === 'xml' ? 'xml' : 'csv';
    try {
      await downloadDataExport(row.id, `${String(row.exportName || 'export').replace(/[^A-Za-z0-9._-]+/g, '_')}.${ext}`);
    } catch (error: any) {
      let msg = 'Download failed';
      const blob = error?.response?.data;
      if (blob instanceof Blob) {
        try { msg = JSON.parse(await blob.text())?.error?.message || msg; } catch { /* keep default */ }
      }
      toast.error(msg);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { from, to, ...rest } = form;
      await createDataExport({
        ...rest,
        exportName: rest.exportName.trim(),
        organizationId: session?.user?.organizationId,
        ...(from || to ? { filters: { from: from || undefined, to: to || undefined } } : {}),
      });
      toast.success('Export started — it will be ready to download in a moment');
      setShowCreate(false);
      setForm(emptyForm);
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Error generating export');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setSubmitting(true);
    try {
      await deleteDataExport(confirmDel.id);
      toast.success('Export history removed');
      setConfirmDel(null);
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Error deleting export log');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = useMemo<ColumnDef<any>[]>(() => [
    { accessorKey: 'exportName', header: 'Task Name' },
    { accessorKey: 'entityType', header: 'Entity', cell: ({ row }) => <span className="capitalize">{row.original.entityType.replace('_', ' ')}</span> },
    { accessorKey: 'exportFormat', header: 'Format', cell: ({ row }) => <span className="uppercase font-bold text-xs">{row.original.exportFormat}</span> },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => {
      const st = row.original.status;
      const cls = st === 'completed'
        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300'
        : st === 'failed'
          ? 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-300'
          : 'bg-secondary text-muted-foreground';
      return (
        <div className="space-y-1">
          <span className={`px-2 py-1 rounded text-xs font-medium ${cls}`}>{String(st).toUpperCase()}</span>
          {st === 'failed' && row.original.errorMessage && (
            <p className="text-[11px] text-rose-600 max-w-xs">{row.original.errorMessage}</p>
          )}
        </div>
      );
    } },
    { accessorKey: 'rowCount', header: 'Rows', cell: ({ row }) => row.original.rowCount ?? '—' },
    { accessorKey: 'createdAt', header: 'Requested', cell: ({ row }) => new Date(row.original.createdAt).toLocaleString() },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-2">
          {row.original.status === 'completed' && (
            <button
              onClick={() => void handleDownload(row.original)}
              className="p-1 hover:bg-secondary rounded text-primary transition-colors"
              title="Download File"
            >
              <Download className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => setConfirmDel(row.original)}
            className="p-1 hover:bg-destructive/10 rounded text-destructive transition-colors"
            title="Delete Log"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )
    }
  ], [items]);

  if (!hydrated || loading) {
    return (
      <div className="min-h-screen app-surface">
        <Sidebar />
        <div className="flex flex-col overflow-hidden lg:ml-[280px]">
          <Header title="Analytics · Data Exports" />
          <main className="flex-1 p-6 flex justify-center items-center">
            <div className="text-muted-foreground animate-pulse">Loading...</div>
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
          <Header title="Analytics · Data Exports" />
          <main className="flex-1 p-6 flex justify-center items-center">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2 text-destructive">Access Denied</h2>
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
        <Header title="Analytics · Data Exports" />
        <main className="flex-1 overflow-auto p-4 md:p-6 pb-24">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold">Data Exports Queue</h1>
              <p className="text-muted-foreground text-sm">Initiate and download bulk raw data extractions</p>
            </div>
            <button
              onClick={() => {
                setForm(emptyForm);
                setShowCreate(true);
              }}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
            >
              <Plus className="h-4 w-4" /> Start Export Task
            </button>
          </div>

          <div className="bg-card rounded-lg border shadow-sm">
            <RichDataTable columns={columns} data={items} />
          </div>

          {showCreate && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-card w-full max-w-sm rounded-lg shadow-lg border border-border flex flex-col">
                <div className="p-4 border-b border-border flex justify-between items-center bg-muted/50 rounded-t-lg">
                  <h3 className="font-semibold">New Data Export</h3>
                  <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Task / File Name <span className="text-destructive">*</span></label>
                    <input
                      type="text"
                      required
                      value={form.exportName}
                      onChange={e => setForm({ ...form, exportName: e.target.value })}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background/50 focus:ring-1 focus:ring-primary outline-none"
                      placeholder="e.g. Q4 Order Dump"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Entity Source</label>
                    <select
                      value={form.entityType}
                      onChange={e => setForm({ ...form, entityType: e.target.value })}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background/50 focus:ring-1 focus:ring-primary outline-none"
                    >
                      <option value="orders">Orders & Lines</option>
                      <option value="customers">Customers</option>
                      <option value="stock_movements">Stock Movements</option>
                      <option value="invoices">Invoices / Finance</option>
                      <option value="campaigns">Marketing Campaigns</option>
                      <option value="products">Products</option>
                      <option value="inventory">Stock Levels</option>
                      <option value="employees">Employees</option>
                      <option value="leads">CRM Leads</option>
                      <option value="deals">CRM Deals</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Date range (optional)</label>
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={() => {
                          const r = rangeForPreset('30d');
                          setForm({ ...form, from: r.from ? String(r.from).slice(0, 10) : '', to: r.to ? String(r.to).slice(0, 10) : '' });
                        }}
                      >
                        Last 30 days
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="date" value={form.from} onChange={e => setForm({ ...form, from: e.target.value })} className="w-full h-10 px-3 rounded-md border border-input bg-background/50 outline-none" />
                      <input type="date" value={form.to} onChange={e => setForm({ ...form, to: e.target.value })} className="w-full h-10 px-3 rounded-md border border-input bg-background/50 outline-none" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Format</label>
                    <select
                      value={form.exportFormat}
                      onChange={e => setForm({ ...form, exportFormat: e.target.value })}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background/50 focus:ring-1 focus:ring-primary outline-none"
                    >
                      <option value="csv">CSV (Comma Separated)</option>
                      <option value="excel">Excel (CSV, opens in Excel)</option>
                      <option value="json">JSON Array</option>
                      <option value="xml">XML Document</option>
                    </select>
                  </div>
                  
                  <div className="pt-4 flex justify-end gap-2 border-t border-border">
                    <button
                      type="button"
                      onClick={() => setShowCreate(false)}
                      className="px-4 py-2 rounded-md hover:bg-secondary/80 text-sm font-medium transition-colors"
                      disabled={submitting}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
                    >
                      {submitting ? 'Queuing...' : 'Generate Export'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {confirmDel && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-card w-full max-w-sm rounded-lg shadow-lg border border-border flex flex-col p-6 text-center">
                <h3 className="text-lg font-bold mb-2">Confirm Delete</h3>
                <p className="text-muted-foreground text-sm mb-6">
                  Delete this export log? The associated file will no longer be downloadable.
                </p>
                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => setConfirmDel(null)}
                    className="px-4 py-2 rounded-md border border-input hover:bg-secondary/50 text-sm font-medium transition-colors"
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={submitting}
                    className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md text-sm font-medium hover:bg-destructive/90 transition-colors"
                  >
                    {submitting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
