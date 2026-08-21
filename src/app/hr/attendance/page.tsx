'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { RichDataTable } from '@/components/rich-data-table';
import { useSession } from '@/hooks/use-session';
import { useRoleCheck } from '@/hooks/use-role-check';
import {
  listTimeEntries, createTimeEntry, updateTimeEntry, listEmployees, listBusinessUnits,
} from '@/lib/api';
import { employeeName, formatDate, formatDateTime, hrApiError, statusBadgeClass } from '@/lib/hr-utils';
import { HrModal, HrField, HrModalActions, hrInputClass, hrTextareaClass } from '@/components/hr/hr-modal';
import { toast } from 'sonner';
import { ColumnDef } from '@tanstack/react-table';
import { Check, Clock, Plus } from 'lucide-react';

export default function AttendancePage() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const { hasAccess } = useRoleCheck(['ADMIN', 'SUPER_ADMIN', 'HR_MANAGER', 'HR_ADMIN']);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [bus, setBus] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    employeeId: '',
    businessUnitId: '',
    entryDate: '',
    clockInTime: '',
    clockOutTime: '',
    totalHours: '',
    overtimeHours: '0',
    breakMinutes: '0',
    entryType: 'regular',
    notes: '',
  });

  const orgId = session?.user?.organizationId;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, e] = await Promise.all([
        listTimeEntries({ limit: 200 }),
        listEmployees({ organizationId: orgId }),
      ]);
      setItems(t.data || []);
      setEmployees(e.data || []);
      if (orgId) {
        try {
          const bu = await listBusinessUnits(orgId);
          setBus(bu.data || []);
        } catch { setBus([]); }
      }
    } catch (err) {
      toast.error(hrApiError(err, 'Failed to load attendance'));
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

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const clockIn = form.clockInTime.includes('T')
        ? form.clockInTime
        : `${form.entryDate}T${form.clockInTime}:00`;
      const clockOut = form.clockOutTime
        ? (form.clockOutTime.includes('T') ? form.clockOutTime : `${form.entryDate}T${form.clockOutTime}:00`)
        : undefined;
      await createTimeEntry({
        employeeId: form.employeeId,
        businessUnitId: form.businessUnitId,
        entryDate: form.entryDate,
        clockInTime: clockIn,
        clockOutTime: clockOut,
        totalHours: form.totalHours ? Number(form.totalHours) : undefined,
        overtimeHours: Number(form.overtimeHours) || 0,
        breakMinutes: Number(form.breakMinutes) || 0,
        entryType: form.entryType as any,
        notes: form.notes || undefined,
      });
      toast.success('Attendance entry saved');
      setOpen(false);
      void load();
    } catch (err) {
      toast.error(hrApiError(err, 'Failed to save entry'));
    } finally {
      setSaving(false);
    }
  }

  async function approve(id: string) {
    try {
      await updateTimeEntry(id, { status: 'approved' });
      toast.success('Approved');
      void load();
    } catch (err) {
      toast.error(hrApiError(err, 'Approve failed'));
    }
  }

  const overtimeTotal = items.reduce((s, r) => s + (Number(r.overtimeHours) || 0), 0);

  const columns = useMemo<ColumnDef<any>[]>(() => [
    { header: 'Employee', cell: ({ row }) => employeeName(row.original.employee) },
    { header: 'Date', cell: ({ row }) => formatDate(row.original.entryDate) },
    {
      header: 'Clock',
      cell: ({ row }) => (
        <span className="text-xs">
          {formatDateTime(row.original.clockInTime)}
          {row.original.clockOutTime ? ` → ${formatDateTime(row.original.clockOutTime)}` : ''}
        </span>
      ),
    },
    { accessorKey: 'totalHours', header: 'Hours' },
    {
      accessorKey: 'overtimeHours',
      header: 'OT',
      cell: ({ row }) => <span className="font-medium text-[#D4A017]">{row.original.overtimeHours || 0}</span>,
    },
    {
      accessorKey: 'entryType',
      header: 'Type',
      cell: ({ row }) => <span className="capitalize">{(row.original.entryType || '').replace(/_/g, ' ')}</span>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${statusBadgeClass(row.original.status)}`}>
          {row.original.status}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => row.original.status === 'pending' ? (
        <button type="button" onClick={() => approve(row.original.id)} className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-500/10" title="Approve">
          <Check size={16} />
        </button>
      ) : null,
    },
  ], []);

  return (
    <div className="min-h-screen app-surface">
      <Sidebar />
      <div className="flex flex-col min-w-0 lg:ml-[280px]">
        <Header title="HR · Attendance & Overtime" />
        <main className="p-6 md:p-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="glass-panel rounded-xl border border-border/40 px-4 py-3 text-sm">
              <span className="text-muted-foreground">Overtime (loaded rows): </span>
              <span className="font-bold text-[#D4A017]">{overtimeTotal.toFixed(1)}h</span>
            </div>
            <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-[#D4A017] text-white text-sm font-medium">
              <Plus size={14} /> Add attendance
            </button>
          </div>
          <RichDataTable columns={columns} data={items} searchPlaceholder="Search attendance…" />
        </main>
      </div>

      <HrModal open={open} onClose={() => setOpen(false)} title="Attendance / overtime entry" icon={Clock} wide>
        <form onSubmit={onCreate} className="space-y-4">
          <HrField label="Employee">
            <select className={hrInputClass} required value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
              <option value="">Select…</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{employeeName(e)}</option>)}
            </select>
          </HrField>
          <HrField label="Business unit">
            <select className={hrInputClass} required value={form.businessUnitId} onChange={(e) => setForm({ ...form, businessUnitId: e.target.value })}>
              <option value="">Select…</option>
              {bus.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </HrField>
          <HrField label="Date"><input type="date" className={hrInputClass} required value={form.entryDate} onChange={(e) => setForm({ ...form, entryDate: e.target.value })} /></HrField>
          <div className="grid grid-cols-2 gap-3">
            <HrField label="Clock in (HH:MM)"><input className={hrInputClass} required placeholder="09:00" value={form.clockInTime} onChange={(e) => setForm({ ...form, clockInTime: e.target.value })} /></HrField>
            <HrField label="Clock out (HH:MM)"><input className={hrInputClass} placeholder="17:30" value={form.clockOutTime} onChange={(e) => setForm({ ...form, clockOutTime: e.target.value })} /></HrField>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <HrField label="Total hours"><input type="number" step="0.25" className={hrInputClass} value={form.totalHours} onChange={(e) => setForm({ ...form, totalHours: e.target.value })} /></HrField>
            <HrField label="Overtime"><input type="number" step="0.25" className={hrInputClass} value={form.overtimeHours} onChange={(e) => setForm({ ...form, overtimeHours: e.target.value })} /></HrField>
            <HrField label="Break (min)"><input type="number" className={hrInputClass} value={form.breakMinutes} onChange={(e) => setForm({ ...form, breakMinutes: e.target.value })} /></HrField>
          </div>
          <HrField label="Entry type">
            <select className={hrInputClass} value={form.entryType} onChange={(e) => setForm({ ...form, entryType: e.target.value })}>
              <option value="regular">Regular</option>
              <option value="overtime">Overtime</option>
              <option value="holiday">Holiday</option>
              <option value="sick">Sick</option>
              <option value="unpaid">Unpaid</option>
            </select>
          </HrField>
          <HrField label="Notes"><textarea className={hrTextareaClass} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></HrField>
          <HrModalActions onCancel={() => setOpen(false)} submitLabel="Save" submitting={saving} />
        </form>
      </HrModal>
    </div>
  );
}
