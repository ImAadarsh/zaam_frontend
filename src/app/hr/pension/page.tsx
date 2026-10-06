'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ColumnDef } from '@tanstack/react-table';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { RichDataTable } from '@/components/rich-data-table';
import { useSession } from '@/hooks/use-session';
import { useRoleCheck } from '@/hooks/use-role-check';
import { listPensions, upsertPension, listEmployees } from '@/lib/api';
import { employeeName, formatDate, hrApiError, isApiMissing, statusBadgeClass } from '@/lib/hr-utils';
import { HrModal, HrField, HrModalActions, hrInputClass } from '@/components/hr/hr-modal';
import { toast } from 'sonner';
import { AlertTriangle, PiggyBank, Plus } from 'lucide-react';

export default function PensionPage() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const { hasAccess } = useRoleCheck(['ADMIN', 'SUPER_ADMIN', 'HR_MANAGER', 'HR_ADMIN', 'FINANCE']);
  const [loading, setLoading] = useState(true);
  const [apiMissing, setApiMissing] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    employeeId: '',
    eligible: true,
    enrolled: false,
    schemeName: 'NEST',
    contributionPct: '5',
    employerContributionPct: '3',
    deferralDate: '',
  });

  const orgId = session?.user?.organizationId;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const emp = await listEmployees({ organizationId: orgId });
      setEmployees(emp.data || []);
      try {
        const res = await listPensions({ organizationId: orgId });
        setItems(res.data || []);
        setApiMissing(false);
      } catch (err) {
        if (isApiMissing(err)) {
          setApiMissing(true);
          setItems([]);
        } else {
          toast.error(hrApiError(err, 'Failed to load pensions'));
        }
      }
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (!hydrated || !hasAccess) return;
    if (!session?.accessToken) {
      router.replace('/login');
      return;
    }
    void load();
  }, [hydrated, hasAccess, session?.accessToken, router, load]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await upsertPension({
        organizationId: orgId,
        employeeId: form.employeeId,
        eligible: form.eligible,
        enrolled: form.enrolled,
        schemeName: form.schemeName,
        contributionPct: Number(form.contributionPct),
        employerContributionPct: Number(form.employerContributionPct),
        deferralDate: form.deferralDate || undefined,
      });
      toast.success('Pension status saved');
      setOpen(false);
      void load();
    } catch (err) {
      toast.error(isApiMissing(err) ? 'Pension API not live yet' : hrApiError(err, 'Save failed'));
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnrol(row: any) {
    const wasEnrolled = Boolean(Number(row.enrolled));
    try {
      await upsertPension({
        employeeId: String(row.employeeId || row.employee?.id),
        enrolled: !wasEnrolled,
        eligible: Boolean(Number(row.eligible)),
      });
      toast.success(wasEnrolled ? 'Marked not enrolled' : 'Marked enrolled');
      void load();
    } catch (err) {
      toast.error(hrApiError(err, 'Update failed'));
    }
  }

  function openCreate() {
    setForm({
      employeeId: '',
      eligible: true,
      enrolled: false,
      schemeName: 'NEST',
      contributionPct: '5',
      employerContributionPct: '3',
      deferralDate: '',
    });
    setOpen(true);
  }

  const enrolled = items.filter((i) => Number(i.enrolled)).length;
  const eligible = items.filter((i) => Number(i.eligible) && !Number(i.enrolled)).length;

  const columns = useMemo<ColumnDef<any>[]>(() => [
    {
      id: 'employee',
      accessorFn: (r) => employeeName(r.employee),
      header: 'Employee',
      cell: ({ row }) => {
        const eid = row.original.employeeId || row.original.employee?.id;
        return eid ? (
          <Link href={`/hr/employees/${eid}`} className="text-[#D4A017] hover:underline font-medium">{employeeName(row.original.employee)}</Link>
        ) : employeeName(row.original.employee);
      },
    },
    { id: 'schemeName', accessorFn: (r) => r.schemeName || '', header: 'Scheme', cell: ({ getValue }) => String(getValue() || '—') },
    {
      id: 'contributionPct',
      accessorFn: (r) => (r.contributionPct == null ? null : Number(r.contributionPct)),
      header: 'Employee %',
      cell: ({ getValue }) => (getValue() == null ? '—' : `${getValue()}%`),
    },
    {
      id: 'employerContributionPct',
      accessorFn: (r) => (r.employerContributionPct == null ? null : Number(r.employerContributionPct)),
      header: 'Employer %',
      cell: ({ getValue }) => (getValue() == null ? '—' : `${getValue()}%`),
    },
    {
      id: 'dates',
      accessorFn: (r) => r.enrolmentDate || r.deferralDate || '',
      header: 'Enrolment / deferral',
      cell: ({ row }) => row.original.enrolmentDate
        ? `Enrolled ${formatDate(row.original.enrolmentDate)}`
        : row.original.deferralDate ? `Deferred to ${formatDate(row.original.deferralDate)}` : '—',
    },
    {
      id: 'status',
      accessorFn: (r) => (Number(r.enrolled) ? 'Enrolled' : Number(r.eligible) ? 'Eligible' : 'Not eligible'),
      header: 'Status',
      cell: ({ row, getValue }) => (
        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${statusBadgeClass(Number(row.original.enrolled) ? 'enrolled' : Number(row.original.eligible) ? 'eligible' : 'pending')}`}>
          {String(getValue())}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <button type="button" onClick={() => toggleEnrol(row.original)} className="text-xs text-[#D4A017] hover:underline whitespace-nowrap">
          {Number(row.original.enrolled) ? 'Mark not enrolled' : 'Mark enrolled'}
        </button>
      ),
    },
  ], [load]);

  return (
    <div className="min-h-screen app-surface">
      <Sidebar />
      <div className="flex flex-col min-w-0 lg:ml-[280px]">
        <Header title="HR · Pension" />
        <main className="p-6 md:p-8 space-y-6">
          {apiMissing && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-amber-700">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <div className="text-sm">
                <div className="font-semibold">Pension API not deployed yet</div>
                <div className="text-xs mt-0.5 opacity-80">Waiting on <code className="font-mono">/api/hr/pensions</code>. Forms are ready.</div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-3 text-sm">
              <div className="glass-panel rounded-xl border border-border/40 px-4 py-2">
                Enrolled <span className="font-bold text-emerald-600 ml-1">{enrolled}</span>
              </div>
              <div className="glass-panel rounded-xl border border-border/40 px-4 py-2">
                Eligible not enrolled <span className="font-bold text-amber-600 ml-1">{eligible}</span>
              </div>
            </div>
            <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-[#D4A017] hover:bg-[#c49415] text-white text-sm font-medium shadow-lg shadow-[#D4A017]/20">
              <Plus size={14} /> Enrol / set pension
            </button>
          </div>

          {loading && <div className="text-muted-foreground text-sm">Loading…</div>}
          {!loading && items.length === 0 ? (
            <div className="glass-panel rounded-2xl border border-border/50 p-8 text-center">
              <p className="text-sm text-muted-foreground mb-3">No pension records yet.</p>
              <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-[#D4A017] text-white text-sm font-medium">
                <Plus size={14} /> Set enrolment
              </button>
            </div>
          ) : (
            !loading && <RichDataTable columns={columns} data={items} searchPlaceholder="Search pensions…" />
          )}
        </main>
      </div>

      <HrModal open={open} onClose={() => setOpen(false)} title="Pension enrolment" icon={PiggyBank}>
        <form onSubmit={onSave} className="space-y-4">
          <HrField label="Employee">
            <select className={hrInputClass} required value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
              <option value="">Select…</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{employeeName(e)}</option>)}
            </select>
          </HrField>
          <HrField label="Scheme"><input className={hrInputClass} value={form.schemeName} onChange={(e) => setForm({ ...form, schemeName: e.target.value })} /></HrField>
          <div className="grid grid-cols-2 gap-3">
            <HrField label="Employee %"><input type="number" step="0.1" className={hrInputClass} value={form.contributionPct} onChange={(e) => setForm({ ...form, contributionPct: e.target.value })} /></HrField>
            <HrField label="Employer %"><input type="number" step="0.1" className={hrInputClass} value={form.employerContributionPct} onChange={(e) => setForm({ ...form, employerContributionPct: e.target.value })} /></HrField>
          </div>
          <HrField label="Deferral date"><input type="date" className={hrInputClass} value={form.deferralDate} onChange={(e) => setForm({ ...form, deferralDate: e.target.value })} /></HrField>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.eligible} onChange={(e) => setForm({ ...form, eligible: e.target.checked })} /> Eligible for auto-enrolment</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.enrolled} onChange={(e) => setForm({ ...form, enrolled: e.target.checked })} /> Currently enrolled</label>
          <HrModalActions onCancel={() => setOpen(false)} submitLabel="Save" submitting={saving} />
        </form>
      </HrModal>
    </div>
  );
}
