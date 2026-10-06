'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { RichDataTable } from '@/components/rich-data-table';
import { useSession } from '@/hooks/use-session';
import { useRoleCheck } from '@/hooks/use-role-check';
import {
  listVisaExpiring, listComplianceAlerts, listImmigration, createImmigration,
  listEmployees, listRtwDocuments, createRtwDocument, createHrDocument,
  listEmployeeDocuments,
} from '@/lib/api';
import {
  daysUntil, employeeName, formatDate, hrApiError, isApiMissing,
  resolveDocUrl, RTW_DOC_TYPES, statusBadgeClass, visaRiskClass, VISA_TYPES,
} from '@/lib/hr-utils';
import { HrModal, HrField, HrModalActions, hrInputClass, hrTextareaClass } from '@/components/hr/hr-modal';
import { FileUploadField } from '@/components/file-upload-field';
import { toast } from 'sonner';
import { ColumnDef } from '@tanstack/react-table';
import { AlertTriangle, Eye, Plus, ShieldCheck, Upload } from 'lucide-react';

export default function ImmigrationRtwPage() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const { hasAccess } = useRoleCheck(['ADMIN', 'SUPER_ADMIN', 'HR_MANAGER', 'HR_ADMIN']);
  const [loading, setLoading] = useState(true);
  const [apiMissing, setApiMissing] = useState(false);
  const [board, setBoard] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [rtw, setRtw] = useState<any[]>([]);
  const [withinDays, setWithinDays] = useState(90);
  const [immOpen, setImmOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [immForm, setImmForm] = useState({
    employeeId: '',
    status: 'skilled_worker',
    visaType: '',
    visaExpiry: '',
    shareCode: '',
    notes: '',
  });
  const emptyUploadForm = { employeeId: '', docType: 'passport', documentName: '', expiresAt: '', documentUrl: '' };
  const [uploadForm, setUploadForm] = useState(emptyUploadForm);

  const orgId = session?.user?.organizationId;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const empRes = await listEmployees({ organizationId: orgId });
      setEmployees(empRes.data || []);

      try {
        const [v, a, r] = await Promise.all([
          listVisaExpiring({ organizationId: orgId, withinDays, limit: 100 }),
          listComplianceAlerts({ organizationId: orgId, limit: 200 }),
          listRtwDocuments({ limit: 200 }),
        ]);
        setBoard(Array.isArray(v.data) ? v.data : []);
        setAlerts(a.data || []);
        setRtw(r.data || []);
        setApiMissing(false);
      } catch (err) {
        if (isApiMissing(err)) {
          setApiMissing(true);
          // Fallback: derive from employee passport + documents with expiry
          try {
            const docs = await listEmployeeDocuments({ limit: 100 });
            const withExpiry = (docs.data || [])
              .filter((d: any) => d.expiryDate)
              .map((d: any) => ({
                id: d.id,
                employee: d.employee,
                employeeId: d.employee?.id,
                visaType: d.documentType,
                visaExpiry: d.expiryDate,
                status: 'from_document',
              }));
            setBoard(withExpiry);
            setRtw(docs.data || []);
          } catch {
            setBoard([]);
            setRtw([]);
          }
          setAlerts([]);
        } else {
          toast.error(hrApiError(err, 'Failed to load immigration'));
        }
      }
    } catch (err) {
      toast.error(hrApiError(err, 'Failed to load'));
    } finally {
      setLoading(false);
    }
  }, [orgId, withinDays]);

  useEffect(() => {
    if (!hydrated || !hasAccess) return;
    if (!session?.accessToken) {
      router.replace('/login');
      return;
    }
    void load();
  }, [hydrated, hasAccess, session?.accessToken, router, load]);

  async function saveImmigration(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createImmigration({ ...immForm, organizationId: orgId });
      toast.success('Immigration record created');
      setImmOpen(false);
      void load();
    } catch (err) {
      toast.error(isApiMissing(err) ? 'Immigration API not live yet' : hrApiError(err, 'Save failed'));
    } finally {
      setSaving(false);
    }
  }

  async function saveUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadForm.employeeId) {
      toast.error('Select an employee');
      return;
    }
    if (!uploadForm.documentUrl) {
      toast.error('File: please upload the document first');
      return;
    }
    setSaving(true);
    try {
      const documentName = uploadForm.documentName.trim()
        || decodeURIComponent(uploadForm.documentUrl.split('/').pop() || '')
        || 'RTW document';
      if (uploadForm.docType === 'contract') {
        await createHrDocument({
          employeeId: uploadForm.employeeId,
          docCategory: 'contract',
          documentName,
          documentUrl: uploadForm.documentUrl,
          expiryDate: uploadForm.expiresAt || null,
        });
      } else {
        await createRtwDocument({
          employeeId: uploadForm.employeeId,
          docType: uploadForm.docType,
          documentName,
          documentUrl: uploadForm.documentUrl,
          expiresAt: uploadForm.expiresAt || null,
        });
      }
      toast.success(uploadForm.docType === 'contract' ? 'Contract saved to Documents' : 'RTW document saved');
      setUploadOpen(false);
      void load();
    } catch (err) {
      toast.error(hrApiError(err, 'Upload failed'));
    } finally {
      setSaving(false);
    }
  }

  const columns = useMemo<ColumnDef<any>[]>(() => [
    {
      accessorKey: 'employee',
      header: 'Employee',
      cell: ({ row }) => (
        <Link href={`/hr/employees/${row.original.employeeId || row.original.employee?.id}`} className="text-[#D4A017] hover:underline font-medium">
          {row.original.employeeName || employeeName(row.original.employee || row.original)}
        </Link>
      ),
    },
    {
      accessorKey: 'visaType',
      header: 'Visa / status',
      cell: ({ row }) => <span className="capitalize">{(row.original.visaType || row.original.status || '—').replace(/_/g, ' ')}</span>,
    },
    {
      accessorKey: 'visaExpiry',
      header: 'Expiry',
      cell: ({ row }) => formatDate(row.original.visaExpiry || row.original.expiryDate),
    },
    {
      id: 'risk',
      header: 'Risk',
      cell: ({ row }) => {
        const days = daysUntil(row.original.visaExpiry || row.original.expiryDate);
        return (
          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${visaRiskClass(days)}`}>
            {days == null ? '—' : days < 0 ? `${Math.abs(days)}d overdue` : `${days}d`}
          </span>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const eid = row.original.employeeId || row.original.employee?.id;
        if (!eid) return null;
        return (
          <Link href={`/hr/employees/${eid}`} className="text-muted-foreground hover:text-[#D4A017]">
            <Eye size={16} />
          </Link>
        );
      },
    },
  ], []);

  const alertColumns = useMemo<ColumnDef<any>[]>(() => [
    {
      id: 'title',
      accessorFn: (a) => a.title || a.message || a.alertType || '',
      header: 'Reminder',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.title || row.original.alertType}</div>
          {row.original.message && <div className="text-xs text-muted-foreground mt-0.5">{row.original.message}</div>}
        </div>
      ),
    },
    {
      id: 'dueDate',
      accessorFn: (a) => a.dueDate || a.createdAt || '',
      header: 'Due',
      cell: ({ row }) => formatDate(row.original.dueDate || row.original.createdAt),
    },
    {
      id: 'severity',
      accessorFn: (a) => a.severity || '',
      header: 'Severity',
      cell: ({ row }) => (
        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${row.original.severity === 'critical' ? 'bg-red-500/10 text-red-600' : 'bg-amber-500/10 text-amber-700'}`}>
          {row.original.severity || '—'}
        </span>
      ),
    },
    {
      id: 'status',
      accessorFn: (a) => a.status || 'open',
      header: 'Status',
      cell: ({ row }) => (
        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${statusBadgeClass(row.original.status)}`}>
          {row.original.status || 'open'}
        </span>
      ),
    },
  ], []);

  const rtwColumns = useMemo<ColumnDef<any>[]>(() => [
    {
      id: 'employee',
      accessorFn: (d) => employeeName(d.employee),
      header: 'Employee',
      cell: ({ row }) => {
        const eid = row.original.employeeId || row.original.employee?.id;
        return eid ? (
          <Link href={`/hr/employees/${eid}`} className="text-[#D4A017] hover:underline">{employeeName(row.original.employee)}</Link>
        ) : employeeName(row.original.employee);
      },
    },
    {
      id: 'documentName',
      accessorFn: (d) => d.documentName || '',
      header: 'Document',
    },
    {
      id: 'docType',
      accessorFn: (d) => (d.docType || d.documentType || '').replace(/_/g, ' '),
      header: 'Type',
      cell: ({ getValue }) => <span className="capitalize">{String(getValue() || '—')}</span>,
    },
    {
      id: 'expiresAt',
      accessorFn: (d) => d.expiresAt || d.expiryDate || '',
      header: 'Expiry',
      cell: ({ row }) => formatDate(row.original.expiresAt || row.original.expiryDate),
    },
    {
      id: 'link',
      header: '',
      enableSorting: false,
      cell: ({ row }) => {
        const href = resolveDocUrl(row.original.documentUrl);
        return href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-xs text-[#D4A017] hover:underline">Open</a>
        ) : null;
      },
    },
  ], []);

  if (!hydrated || !hasAccess) {
    return (
      <div className="min-h-screen app-surface">
        <Sidebar />
        <div className="lg:ml-[280px]"><Header title="HR · Immigration & RTW" /><main className="p-6 text-muted-foreground">{!hasAccess && hydrated ? 'Access denied' : 'Loading…'}</main></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen app-surface">
      <Sidebar />
      <div className="flex flex-col min-w-0 lg:ml-[280px]">
        <Header title="HR · Immigration & RTW" />
        <main className="p-6 md:p-8 space-y-6">
          {apiMissing && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-amber-700">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <div className="text-sm">
                <div className="font-semibold">UK immigration endpoints not live yet</div>
                <div className="text-xs mt-0.5 opacity-80">Forms will post to <code className="font-mono">/api/hr/immigration</code> and RTW upload when deployed. Showing document expiry fallback where possible.</div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Within</label>
              <select
                className="h-10 rounded-xl border border-border/80 bg-background px-3 text-sm"
                value={withinDays}
                onChange={(e) => setWithinDays(Number(e.target.value))}
              >
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
                <option value={90}>90 days</option>
                <option value={180}>180 days</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => { setUploadForm(emptyUploadForm); setUploadOpen(true); }} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-border bg-card text-sm font-medium hover:border-[#D4A017]/40">
                <Upload size={14} /> Upload RTW
              </button>
              <button type="button" onClick={() => setImmOpen(true)} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-[#D4A017] hover:bg-[#c49415] text-white text-sm font-medium shadow-lg shadow-[#D4A017]/20">
                <Plus size={14} /> Add visa / RTW record
              </button>
            </div>
          </div>

          <section className="glass-panel rounded-2xl border border-border/50 overflow-hidden">
            <div className="px-5 py-4 border-b border-border/50 flex items-center gap-2 font-semibold">
              <ShieldCheck size={16} className="text-[#D4A017]" /> Visa expiry compliance board
            </div>
            <div className="p-4">
              <RichDataTable columns={columns} data={board} searchPlaceholder="Search visa board…" />
            </div>
          </section>

          <section className="glass-panel rounded-2xl border border-border/50 overflow-hidden">
            <div className="px-5 py-4 border-b border-border/50 font-semibold text-sm">Renewal reminders</div>
            <div className="p-4">
              <RichDataTable columns={alertColumns} data={alerts} searchPlaceholder="Search reminders…" />
            </div>
          </section>
          <section className="glass-panel rounded-2xl border border-border/50 overflow-hidden">
            <div className="px-5 py-4 border-b border-border/50 font-semibold text-sm">Recent RTW / ID documents</div>
            <div className="p-4">
              <RichDataTable columns={rtwColumns} data={rtw} searchPlaceholder="Search RTW documents…" />
            </div>
          </section>
        </main>
      </div>

      <HrModal open={immOpen} onClose={() => setImmOpen(false)} title="Add immigration record" icon={ShieldCheck}>
        <form onSubmit={saveImmigration} className="space-y-4">
          <HrField label="Employee">
            <select className={hrInputClass} required value={immForm.employeeId} onChange={(e) => setImmForm({ ...immForm, employeeId: e.target.value })}>
              <option value="">Select…</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{employeeName(e)}</option>)}
            </select>
          </HrField>
          <HrField label="Immigration status">
            <select className={hrInputClass} value={immForm.status} onChange={(e) => setImmForm({ ...immForm, status: e.target.value })}>
              {VISA_TYPES.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
            </select>
          </HrField>
          <HrField label="Visa type"><input className={hrInputClass} value={immForm.visaType} onChange={(e) => setImmForm({ ...immForm, visaType: e.target.value })} /></HrField>
          <HrField label="Visa expiry"><input type="date" className={hrInputClass} value={immForm.visaExpiry} onChange={(e) => setImmForm({ ...immForm, visaExpiry: e.target.value })} /></HrField>
          <HrField label="Share code"><input className={hrInputClass} value={immForm.shareCode} onChange={(e) => setImmForm({ ...immForm, shareCode: e.target.value })} /></HrField>
          <HrField label="Notes"><textarea className={hrTextareaClass} value={immForm.notes} onChange={(e) => setImmForm({ ...immForm, notes: e.target.value })} /></HrField>
          <HrModalActions onCancel={() => setImmOpen(false)} submitLabel="Save" submitting={saving} />
        </form>
      </HrModal>

      <HrModal open={uploadOpen} onClose={() => setUploadOpen(false)} title="Upload RTW / contract doc" icon={Upload}>
        <form onSubmit={saveUpload} className="space-y-4">
          <HrField label="Employee">
            <select className={hrInputClass} required value={uploadForm.employeeId} onChange={(e) => setUploadForm({ ...uploadForm, employeeId: e.target.value })}>
              <option value="">Select…</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{employeeName(e)}</option>)}
            </select>
          </HrField>
          <HrField label="Document type">
            <select className={hrInputClass} value={uploadForm.docType} onChange={(e) => setUploadForm({ ...uploadForm, docType: e.target.value })}>
              {RTW_DOC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              <option value="contract">Contract (saved to Documents)</option>
            </select>
          </HrField>
          <HrField label="Name"><input className={hrInputClass} value={uploadForm.documentName} onChange={(e) => setUploadForm({ ...uploadForm, documentName: e.target.value })} /></HrField>
          <HrField label="Expiry"><input type="date" className={hrInputClass} value={uploadForm.expiresAt} onChange={(e) => setUploadForm({ ...uploadForm, expiresAt: e.target.value })} /></HrField>
          <HrField label="File">
            <FileUploadField
              value={uploadForm.documentUrl ? [uploadForm.documentUrl] : []}
              onChange={(urls) => setUploadForm((f) => ({ ...f, documentUrl: urls[0] || '' }))}
              folder="hr/rtw"
              accept="image/*,.pdf"
              label="Upload document"
            />
          </HrField>
          <HrModalActions onCancel={() => setUploadOpen(false)} submitLabel="Upload" submitting={saving} />
        </form>
      </HrModal>
    </div>
  );
}
