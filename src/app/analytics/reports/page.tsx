'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { listReportDefinitions, createReportDefinition, updateReportDefinition, deleteReportDefinition, listReportDatasets, runReportDefinition } from '@/lib/api';
import { DateRangeFilter, rangeForPreset, type DateRange } from '@/components/date-range-filter';
import { toast } from 'sonner';
import { RichDataTable } from '@/components/rich-data-table';
import { useSession } from '@/hooks/use-session';
import { useRoleCheck } from '@/hooks/use-role-check';
import { ColumnDef } from '@tanstack/react-table';
import { Pencil, Trash2, Plus, X, Play, Download, Loader2 } from 'lucide-react';

export default function ReportsPage() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const { hasAccess } = useRoleCheck(['ADMIN', 'SUPER_ADMIN', 'FINANCE']);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const emptyForm = { reportName: '', reportCode: '', reportCategory: 'executive', outputFormat: 'pdf', isPublic: false, description: '', dataset: '' };
  const [form, setForm] = useState(emptyForm);
  const [datasets, setDatasets] = useState<Array<{ key: string; label: string; category: string; supportsDateRange: boolean }>>([]);
  const [runTarget, setRunTarget] = useState<any>(null);
  const [runRange, setRunRange] = useState<DateRange>(() => rangeForPreset('30d'));
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ label: string; columns: string[]; rows: Record<string, unknown>[]; ranAt: string } | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [confirmDel, setConfirmDel] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      const { data } = await listReportDefinitions();
      setItems(data || []);
    } catch (e: any) {
      toast.error('Failed to load reports');
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
    listReportDatasets().then((r) => setDatasets(r.data || [])).catch(() => setDatasets([]));
  }, [hydrated, hasAccess, router, session?.accessToken]);

  const runReport = async (report: any, range: DateRange) => {
    setRunning(true);
    try {
      const res = await runReportDefinition(report.id, { from: range.from, to: range.to });
      setResult(res.data);
    } catch (error: any) {
      setResult(null);
      toast.error(error.response?.data?.error?.message || 'Report execution failed');
    } finally {
      setRunning(false);
    }
  };

  const openRun = (report: any) => {
    const r = rangeForPreset('30d');
    setRunTarget(report);
    setRunRange(r);
    setResult(null);
    void runReport(report, r);
  };

  const downloadCsv = () => {
    if (!result || !runTarget) return;
    const cell = (v: unknown) => {
      const t = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
      return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    };
    const csv = [result.columns.map(cell).join(','), ...result.rows.map((r) => result.columns.map((c) => cell(r[c])).join(','))].join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${String(runTarget.reportCode || 'report').replace(/[^A-Za-z0-9._-]+/g, '_')}-${runRange.from}_${runRange.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resultColumns = useMemo<ColumnDef<any>[]>(
    () => (result?.columns || []).map((c) => ({
      accessorKey: c,
      header: c.replace(/_/g, ' '),
      cell: (info: any) => {
        const v = info.getValue();
        if (v == null || v === '') return '—';
        if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return new Date(v).toLocaleDateString();
        return String(v);
      },
    })),
    [result]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { dataset, ...rest } = form;
      const payload: any = {
        ...rest,
        description: rest.description || undefined,
        parameters: { ...(editing?.parameters || {}), dataset: dataset || undefined },
      };
      if (editing) {
        await updateReportDefinition(editing.id, payload);
        toast.success('Report updated');
      } else {
        await createReportDefinition({ ...payload, organizationId: session?.user?.organizationId });
        toast.success('Report created');
      }
      setShowCreate(false);
      setEditing(null);
      setForm(emptyForm);
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Error saving report');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setSubmitting(true);
    try {
      await deleteReportDefinition(confirmDel.id);
      toast.success('Report deleted');
      setConfirmDel(null);
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Error deleting report');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = useMemo<ColumnDef<any>[]>(() => [
    { accessorKey: 'reportName', header: 'Report Name' },
    { accessorKey: 'reportCode', header: 'Code' },
    { accessorKey: 'reportCategory', header: 'Category', cell: ({ row }) => <span className="capitalize">{row.original.reportCategory}</span> },
    { accessorKey: 'outputFormat', header: 'Format', cell: ({ row }) => <span className="uppercase text-xs font-bold">{row.original.outputFormat}</span> },
    { accessorKey: 'isPublic', header: 'Visibility', cell: ({ row }) => row.original.isPublic ? 'Public' : 'Private' },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-2">
          <button
            onClick={() => openRun(row.original)}
            className="p-1 hover:bg-emerald-500/10 rounded text-emerald-500 transition-colors"
            title="Execute Now"
          >
            <Play className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              setEditing(row.original);
              setForm({
                reportName: row.original.reportName,
                reportCode: row.original.reportCode,
                reportCategory: row.original.reportCategory,
                outputFormat: row.original.outputFormat,
                isPublic: row.original.isPublic,
                description: row.original.description || '',
                dataset: row.original.parameters?.dataset || ''
              });
              setShowCreate(true);
            }}
            className="p-1 hover:bg-secondary rounded text-primary transition-colors"
            title="Edit"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => setConfirmDel(row.original)}
            className="p-1 hover:bg-destructive/10 rounded text-destructive transition-colors"
            title="Delete"
          >
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
          <Header title="Analytics · Reports" />
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
          <Header title="Analytics · Reports" />
          <main className="flex-1 p-6 flex justify-center items-center">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2 text-destructive">Access Denied</h2>
              <p className="text-muted-foreground">You do not have permission to view reports.</p>
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
        <Header title="Analytics · Reports" />
        <main className="flex-1 overflow-auto p-4 md:p-6 pb-24">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold">Report Definitions</h1>
              <p className="text-muted-foreground text-sm">Manage system-wide report templates</p>
            </div>
            <button
              onClick={() => {
                setEditing(null);
                setForm(emptyForm);
                setShowCreate(true);
              }}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
            >
              <Plus className="h-4 w-4" /> New Report
            </button>
          </div>

          <div className="bg-card rounded-lg border shadow-sm">
            <RichDataTable columns={columns} data={items} />
          </div>

          {showCreate && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-card w-full max-w-lg rounded-lg shadow-lg border border-border flex flex-col">
                <div className="p-4 border-b border-border flex justify-between items-center bg-muted/50 rounded-t-lg">
                  <h3 className="font-semibold">{editing ? 'Edit Report Definition' : 'New Report Definition'}</h3>
                  <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Report Name <span className="text-destructive">*</span></label>
                      <input
                        type="text"
                        required
                        value={form.reportName}
                        onChange={e => setForm({ ...form, reportName: e.target.value })}
                        className="w-full h-10 px-3 rounded-md border border-input bg-background/50 focus:ring-1 focus:ring-primary outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Identifier Code <span className="text-destructive">*</span></label>
                      <input
                        type="text"
                        required
                        disabled={!!editing}
                        value={form.reportCode}
                        onChange={e => setForm({ ...form, reportCode: e.target.value.toUpperCase() })}
                        className="w-full h-10 px-3 rounded-md border border-input bg-background/50 focus:ring-1 focus:ring-primary outline-none disabled:opacity-50"
                        placeholder="e.g. FIN-001"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Category</label>
                      <select
                        value={form.reportCategory}
                        onChange={e => setForm({ ...form, reportCategory: e.target.value })}
                        className="w-full h-10 px-3 rounded-md border border-input bg-background/50 focus:ring-1 focus:ring-primary outline-none"
                      >
                        <option value="executive">Executive</option>
                        <option value="sales">Sales</option>
                        <option value="inventory">Inventory</option>
                        <option value="finance">Finance</option>
                        <option value="operations">Operations</option>
                        <option value="hr">HR</option>
                        <option value="marketing">Marketing</option>
                        <option value="customer">Customer</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Default Format</label>
                      <select
                        value={form.outputFormat}
                        onChange={e => setForm({ ...form, outputFormat: e.target.value })}
                        className="w-full h-10 px-3 rounded-md border border-input bg-background/50 focus:ring-1 focus:ring-primary outline-none"
                      >
                        <option value="pdf">PDF</option>
                        <option value="excel">Excel</option>
                        <option value="csv">CSV</option>
                        <option value="html">HTML</option>
                        <option value="json">JSON</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Data source</label>
                    <select
                      value={form.dataset}
                      onChange={e => setForm({ ...form, dataset: e.target.value })}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background/50 focus:ring-1 focus:ring-primary outline-none"
                    >
                      <option value="">Category default</option>
                      {datasets.map((d) => (
                        <option key={d.key} value={d.key}>{d.label} ({d.category})</option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">Runs against live data for your organization.</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Description</label>
                    <textarea
                      value={form.description}
                      onChange={e => setForm({ ...form, description: e.target.value })}
                      className="w-full min-h-20 p-3 rounded-md border border-input bg-background/50 focus:ring-1 focus:ring-primary outline-none resize-y"
                    />
                  </div>

                  <label className="flex items-center gap-2 text-sm mt-2">
                    <input
                      type="checkbox"
                      checked={form.isPublic}
                      onChange={e => setForm({ ...form, isPublic: e.target.checked })}
                      className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                    />
                    Make this report public to all users
                  </label>
                  
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
                      {submitting ? 'Saving...' : 'Save Report'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {runTarget && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-card w-full max-w-5xl max-h-[90vh] rounded-lg shadow-lg border border-border flex flex-col">
                <div className="p-4 border-b border-border flex justify-between items-center bg-muted/50 rounded-t-lg gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate">{runTarget.reportName}</h3>
                    <p className="text-xs text-muted-foreground">
                      {result ? `${result.label} · ${result.rows.length} row(s) · run ${new Date(result.ranAt).toLocaleString()}` : running ? 'Running…' : ''}
                    </p>
                  </div>
                  <button onClick={() => { setRunTarget(null); setResult(null); }} className="text-muted-foreground hover:text-foreground">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="p-4 flex flex-wrap items-center gap-3 border-b border-border">
                  <DateRangeFilter value={runRange} onChange={(r) => { setRunRange(r); void runReport(runTarget, r); }} />
                  <div className="ml-auto flex gap-2">
                    <button
                      type="button"
                      disabled={running}
                      onClick={() => void runReport(runTarget, runRange)}
                      className="px-3 py-2 rounded-md border border-input text-sm font-medium hover:bg-secondary/50 flex items-center gap-2 disabled:opacity-50"
                    >
                      {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Re-run
                    </button>
                    <button
                      type="button"
                      disabled={!result?.rows.length}
                      onClick={downloadCsv}
                      className="px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 flex items-center gap-2 disabled:opacity-50"
                    >
                      <Download className="h-4 w-4" /> CSV
                    </button>
                  </div>
                </div>
                <div className="p-4 overflow-auto">
                  {running && !result ? (
                    <div className="py-12 text-center text-sm text-muted-foreground">Running report…</div>
                  ) : result && result.rows.length === 0 ? (
                    <div className="py-12 text-center text-sm text-muted-foreground">No data for this period.</div>
                  ) : result ? (
                    <RichDataTable columns={resultColumns} data={result.rows} />
                  ) : (
                    <div className="py-12 text-center text-sm text-muted-foreground">Report did not return data.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {confirmDel && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-card w-full max-w-sm rounded-lg shadow-lg border border-border flex flex-col p-6 text-center">
                <h3 className="text-lg font-bold mb-2">Confirm Delete</h3>
                <p className="text-muted-foreground text-sm mb-6">
                  Are you sure you want to delete this report template? This will break scheduled automations.
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
