'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { RichDataTable } from '@/components/rich-data-table';
import { useSession } from '@/hooks/use-session';
import { useRoleCheck } from '@/hooks/use-role-check';
import {
  listHrAttendance, upsertHrAttendance, listHrOvertime, createHrOvertime, updateHrOvertime,
  listEmployees, getHrAttendanceSettings, updateHrAttendanceSettings,
} from '@/lib/api';
import { employeeName, formatDate, hrApiError, statusBadgeClass } from '@/lib/hr-utils';
import { HrModal, HrField, HrModalActions, hrInputClass, hrTextareaClass } from '@/components/hr/hr-modal';
import { toast } from 'sonner';
import { ColumnDef } from '@tanstack/react-table';
import { Check, Clock, Plus, Sliders } from 'lucide-react';

type AttendanceRow = {
  id: string;
  kind: 'attendance' | 'overtime';
  employee?: any;
  workDate?: string;
  clockIn?: string | null;
  clockOut?: string | null;
  hoursWorked?: number | null;
  overtimeHours?: number;
  status?: string;
  notes?: string | null;
  rateMultiplier?: number;
};

export default function AttendancePage() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const { hasAccess } = useRoleCheck(['ADMIN', 'SUPER_ADMIN', 'HR_MANAGER', 'HR_ADMIN']);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AttendanceRow[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    autoClockOutHours: 8,
    standardShiftHours: 8,
    autoClockOutEnabled: true,
    gracePeriodMinutes: 15,
  });
  const [form, setForm] = useState({
    employeeId: '',
    workDate: '',
    clockIn: '',
    clockOut: '',
    hoursWorked: '',
    overtimeHours: '',
    status: 'present',
    notes: '',
  });

  const orgId = session?.user?.organizationId;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [att, ot, e, sett] = await Promise.all([
        listHrAttendance({ limit: 200 }),
        listHrOvertime({ limit: 200 }),
        listEmployees({ organizationId: orgId }),
        getHrAttendanceSettings().catch(() => ({ data: { autoClockOutHours: 8, standardShiftHours: 8, autoClockOutEnabled: true, gracePeriodMinutes: 15 } })),
      ]);
      const attendanceRows: AttendanceRow[] = (att.data || []).map((r: any) => ({
        id: `a-${r.id}`,
        kind: 'attendance' as const,
        employee: r.employee,
        workDate: r.workDate,
        clockIn: r.clockIn,
        clockOut: r.clockOut,
        hoursWorked: r.hoursWorked,
        overtimeHours: 0,
        status: r.status,
        notes: r.notes,
      }));
      const overtimeRows: AttendanceRow[] = (ot.data || []).map((r: any) => ({
        id: `o-${r.id}`,
        kind: 'overtime' as const,
        employee: r.employee,
        workDate: r.workDate,
        clockIn: null,
        clockOut: null,
        hoursWorked: null,
        overtimeHours: Number(r.hours) || 0,
        status: r.status,
        notes: r.reason,
        rateMultiplier: r.rateMultiplier,
      }));
      setItems([...attendanceRows, ...overtimeRows].sort((a, b) =>
        String(b.workDate || '').localeCompare(String(a.workDate || ''))
      ));
      setEmployees(e.data || []);
      if (sett?.data) {
        setSettingsForm({
          autoClockOutHours: Number(sett.data.autoClockOutHours) || 8,
          standardShiftHours: Number(sett.data.standardShiftHours) || 8,
          autoClockOutEnabled: Boolean(sett.data.autoClockOutEnabled),
          gracePeriodMinutes: Number(sett.data.gracePeriodMinutes) || 15,
        });
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
      await upsertHrAttendance({
        employeeId: form.employeeId,
        workDate: form.workDate,
        status: form.status,
        clockIn: form.clockIn || null,
        clockOut: form.clockOut || null,
        hoursWorked: form.hoursWorked ? Number(form.hoursWorked) : null,
        notes: form.notes || null,
      });
      if (form.overtimeHours && Number(form.overtimeHours) > 0) {
        await createHrOvertime({
          employeeId: form.employeeId,
          workDate: form.workDate,
          hours: Number(form.overtimeHours),
          reason: form.notes || null,
          status: 'pending',
        });
      }
      toast.success('Attendance entry saved');
      setOpen(false);
      void load();
    } catch (err) {
      toast.error(hrApiError(err, 'Failed to save entry'));
    } finally {
      setSaving(false);
    }
  }

  async function onSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await updateHrAttendanceSettings(settingsForm);
      toast.success('Shift & auto clock-out settings updated');
      setSettingsOpen(false);
      void load();
    } catch (err) {
      toast.error(hrApiError(err, 'Failed to save settings'));
    } finally {
      setSavingSettings(false);
    }
  }

  async function approve(row: AttendanceRow) {
    try {
      if (row.kind !== 'overtime') {
        toast.message('Attendance statuses are recorded as present/absent — no approve step');
        return;
      }
      const rawId = row.id.replace(/^o-/, '');
      await updateHrOvertime(rawId, { status: 'approved' });
      toast.success('Overtime approved');
      void load();
    } catch (err) {
      toast.error(hrApiError(err, 'Approve failed'));
    }
  }

  const overtimeTotal = items.reduce((s, r) => s + (Number(r.overtimeHours) || 0), 0);

  const columns = useMemo<ColumnDef<AttendanceRow>[]>(() => [
    { header: 'Employee', cell: ({ row }) => employeeName(row.original.employee) },
    { header: 'Date', cell: ({ row }) => formatDate(row.original.workDate) },
    {
      header: 'Clock',
      cell: ({ row }) => (
        <span className="text-xs">
          {row.original.kind === 'overtime'
            ? 'Overtime'
            : [row.original.clockIn, row.original.clockOut].filter(Boolean).join(' → ') || '—'}
        </span>
      ),
    },
    {
      header: 'Hours',
      cell: ({ row }) => row.original.hoursWorked ?? (row.original.kind === 'overtime' ? row.original.overtimeHours : '—'),
    },
    {
      header: 'OT',
      cell: ({ row }) => (
        <span className="font-medium text-[#D4A017]">
          {row.original.kind === 'overtime' ? row.original.overtimeHours || 0 : 0}
        </span>
      ),
    },
    {
      header: 'Type',
      cell: ({ row }) => (
        <span className="capitalize">
          {row.original.kind === 'overtime' ? 'overtime' : (row.original.status || '').replace(/_/g, ' ')}
        </span>
      ),
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
      cell: ({ row }) => row.original.kind === 'overtime' && row.original.status === 'pending' ? (
        <button type="button" onClick={() => approve(row.original)} className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-500/10" title="Approve">
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
              {loading && <span className="ml-2 text-muted-foreground text-xs">Loading…</span>}
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-border bg-card hover:bg-muted text-sm font-medium transition-colors"
              >
                <Sliders size={14} className="text-[#D4A017]" />
                Shift & Auto Clock-Out ({settingsForm.autoClockOutHours}h)
              </button>
              <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-[#D4A017] hover:bg-[#c49415] text-white text-sm font-medium shadow-lg shadow-[#D4A017]/20">
                <Plus size={14} /> Add attendance / overtime
              </button>
            </div>
          </div>
          {!loading && items.length === 0 ? (
            <div className="glass-panel rounded-2xl border border-border/50 p-10 text-center">
              <p className="text-sm text-muted-foreground mb-3">No attendance entries yet.</p>
              <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-[#D4A017] text-white text-sm font-medium">
                <Plus size={14} /> Add attendance
              </button>
            </div>
          ) : (
            <RichDataTable columns={columns} data={items} searchPlaceholder="Search attendance…" />
          )}
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
          <HrField label="Date"><input type="date" className={hrInputClass} required value={form.workDate} onChange={(e) => setForm({ ...form, workDate: e.target.value })} /></HrField>
          <div className="grid grid-cols-2 gap-3">
            <HrField label="Clock in (HH:MM)"><input className={hrInputClass} placeholder="09:00" value={form.clockIn} onChange={(e) => setForm({ ...form, clockIn: e.target.value })} /></HrField>
            <HrField label="Clock out (HH:MM)"><input className={hrInputClass} placeholder="17:30" value={form.clockOut} onChange={(e) => setForm({ ...form, clockOut: e.target.value })} /></HrField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <HrField label="Hours worked"><input type="number" step="0.25" className={hrInputClass} value={form.hoursWorked} onChange={(e) => setForm({ ...form, hoursWorked: e.target.value })} /></HrField>
            <HrField label="Overtime hours"><input type="number" step="0.25" className={hrInputClass} value={form.overtimeHours} onChange={(e) => setForm({ ...form, overtimeHours: e.target.value })} /></HrField>
          </div>
          <HrField label="Status">
            <select className={hrInputClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="late">Late</option>
              <option value="half_day">Half day</option>
              <option value="holiday">Holiday</option>
              <option value="sick">Sick</option>
              <option value="remote">Remote</option>
            </select>
          </HrField>
          <HrField label="Notes"><textarea className={hrTextareaClass} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></HrField>
          <HrModalActions onCancel={() => setOpen(false)} submitLabel="Save" submitting={saving} />
        </form>
      </HrModal>

      <HrModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Shift & Auto Clock-Out Settings"
        icon={Sliders}
      >
        <form onSubmit={onSaveSettings} className="space-y-4">
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800">
            <strong>Auto Clock-Out Rule:</strong> Automatically clocks out open shifts after the configured duration. This prevents unclosed shifts overnight and ensures compliance with UK Working Time Regulations.
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/40 border border-border/40">
            <div>
              <div className="text-sm font-semibold">Enable Auto Clock-Out</div>
              <div className="text-xs text-muted-foreground">Auto clock-out employees when maximum shift duration is reached</div>
            </div>
            <input
              type="checkbox"
              className="w-5 h-5 rounded accent-[#D4A017] cursor-pointer"
              checked={settingsForm.autoClockOutEnabled}
              onChange={(e) => setSettingsForm({ ...settingsForm, autoClockOutEnabled: e.target.checked })}
            />
          </div>

          <HrField label="Auto Clock-Out Duration (hours)" hint="Default 8.0 hours. Open shifts will auto-close after this limit.">
            <div className="space-y-2">
              <input
                type="number"
                step="0.5"
                min="1"
                max="24"
                className={hrInputClass}
                required
                value={settingsForm.autoClockOutHours}
                onChange={(e) => setSettingsForm({ ...settingsForm, autoClockOutHours: Number(e.target.value) })}
              />
              <div className="flex flex-wrap gap-2">
                {[7.5, 8.0, 9.0, 10.0, 12.0].map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setSettingsForm({ ...settingsForm, autoClockOutHours: h })}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                      settingsForm.autoClockOutHours === h
                        ? 'bg-[#D4A017] text-white border-[#D4A017]'
                        : 'border-border/60 bg-card hover:bg-muted text-muted-foreground'
                    }`}
                  >
                    {h} hrs
                  </button>
                ))}
              </div>
            </div>
          </HrField>

          <HrField label="Standard Shift Duration (hours)" hint="Used as standard full-time shift baseline for reports.">
            <input
              type="number"
              step="0.5"
              min="1"
              max="24"
              className={hrInputClass}
              required
              value={settingsForm.standardShiftHours}
              onChange={(e) => setSettingsForm({ ...settingsForm, standardShiftHours: Number(e.target.value) })}
            />
          </HrField>

          <HrField label="Grace Period (minutes)" hint="Allowable leeway before marking tardy.">
            <input
              type="number"
              step="5"
              min="0"
              max="120"
              className={hrInputClass}
              value={settingsForm.gracePeriodMinutes}
              onChange={(e) => setSettingsForm({ ...settingsForm, gracePeriodMinutes: Number(e.target.value) })}
            />
          </HrField>

          <HrModalActions onCancel={() => setSettingsOpen(false)} submitLabel="Save settings" submitting={savingSettings} />
        </form>
      </HrModal>
    </div>
  );
}
