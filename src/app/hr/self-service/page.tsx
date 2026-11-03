'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { useSession } from '@/hooks/use-session';
import {
  getHrMe,
  updateHrMe,
  listHrMeLeaveRequests,
  createHrMeLeaveRequest,
  listHrMePayslips,
  listHrMeDocuments,
  getHrMeImmigration,
  getHrMeOnboarding,
  updateHrMeOnboarding,
  getHrMeAttendance,
  clockHrMeAttendance,
} from '@/lib/api';
import { employeeName, formatDate, formatMoney, hrApiError, isApiMissing, LEAVE_TYPES, statusBadgeClass } from '@/lib/hr-utils';
import { HrModal, HrField, HrModalActions, hrInputClass, hrTextareaClass } from '@/components/hr/hr-modal';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Calendar,
  FileText,
  User,
  Wallet,
  Clock,
  CheckSquare,
  ShieldCheck,
  CheckCircle2,
  Circle,
  ExternalLink,
  Briefcase,
  Hash,
  MapPin,
  Phone,
  Mail,
  ShieldAlert,
} from 'lucide-react';

export default function SelfServicePage() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const [loading, setLoading] = useState(true);
  const [apiMissing, setApiMissing] = useState(false);
  const [me, setMe] = useState<any>(null);
  const [leave, setLeave] = useState<any[]>([]);
  const [payslips, setPayslips] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [immigration, setImmigration] = useState<any>(null);
  const [onboarding, setOnboarding] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [attSettings, setAttSettings] = useState<{
    autoClockOutHours: number;
    standardShiftHours: number;
    autoClockOutEnabled: boolean;
    gracePeriodMinutes: number;
  }>({
    autoClockOutHours: 8,
    standardShiftHours: 8,
    autoClockOutEnabled: true,
    gracePeriodMinutes: 15,
  });
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isAutoClockingOut, setIsAutoClockingOut] = useState<boolean>(false);
  const [clocking, setClocking] = useState(false);
  const [tab, setTab] = useState<'profile' | 'immigration' | 'onboarding' | 'attendance' | 'leave' | 'payslips' | 'documents'>('profile');
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingTaskId, setTogglingTaskId] = useState<string | null>(null);

  const [leaveForm, setLeaveForm] = useState({
    leaveType: 'vacation',
    startDate: '',
    endDate: '',
    totalDays: 1,
    reason: '',
  });

  const [profileForm, setProfileForm] = useState({
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    postalCode: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelationship: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      try {
        const res = await getHrMe();
        setMe(res.data);
        setApiMissing(false);

        const [l, p, d, imm, onb, att] = await Promise.all([
          listHrMeLeaveRequests().catch(() => ({ data: [] })),
          listHrMePayslips().catch(() => ({ data: [] })),
          listHrMeDocuments().catch(() => ({ data: [] })),
          getHrMeImmigration().catch(() => ({ data: null })),
          getHrMeOnboarding().catch(() => ({ data: [] })),
          getHrMeAttendance().catch(() => ({ data: [], settings: undefined })),
        ]);

        setLeave(l.data || []);
        setPayslips(p.data || []);
        setDocs(d.data || []);
        setImmigration(imm.data || null);
        setOnboarding(onb.data || []);
        setAttendance(att.data || []);
        if (att.settings) {
          setAttSettings(att.settings);
        }
      } catch (err) {
        if (!isApiMissing(err)) throw err;
        setMe(null);
        setLeave([]);
        setPayslips([]);
        setDocs([]);
        setImmigration(null);
        setOnboarding([]);
        setAttendance([]);
      }
    } catch (err) {
      toast.error(hrApiError(err, 'Failed to load self-service'));
    } finally {
      setLoading(false);
    }
  }, [session?.user?.organizationId, session?.user?.id, session?.user?.email]);

  useEffect(() => {
    if (!hydrated) return;
    if (!session?.accessToken) {
      router.replace('/login');
      return;
    }
    void load();
  }, [hydrated, session?.accessToken, router, load]);

  useEffect(() => {
    if (leaveForm.startDate && leaveForm.endDate) {
      const start = new Date(leaveForm.startDate);
      const end = new Date(leaveForm.endDate);
      const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
      setLeaveForm((f) => ({ ...f, totalDays: days }));
    }
  }, [leaveForm.startDate, leaveForm.endDate]);

  async function saveLeave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createHrMeLeaveRequest(leaveForm);
      toast.success('Leave request submitted');
      setLeaveOpen(false);
      void load();
    } catch (err) {
      toast.error(hrApiError(err, 'Request failed'));
    } finally {
      setSaving(false);
    }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateHrMe(profileForm);
      toast.success('Profile details updated');
      setEditOpen(false);
      void load();
    } catch (err) {
      toast.error(isApiMissing(err) ? 'Self-service update API not live yet' : hrApiError(err, 'Update failed'));
    } finally {
      setSaving(false);
    }
  }

  function openEdit() {
    setProfileForm({
      phone: me?.phone || '',
      addressLine1: me?.addressLine1 || '',
      addressLine2: me?.addressLine2 || '',
      city: me?.city || '',
      postalCode: me?.postalCode || '',
      emergencyContactName: me?.emergencyContactName || '',
      emergencyContactPhone: me?.emergencyContactPhone || '',
      emergencyContactRelationship: me?.emergencyContactRelationship || '',
    });
    setEditOpen(true);
  }

  async function handleClock() {
    setClocking(true);
    try {
      const res = await clockHrMeAttendance();
      const item = res.data;
      if (item.clockOut) {
        toast.success(`Clocked out at ${item.clockOut.slice(0, 5)} (Total: ${item.hoursWorked ?? 0} hrs)`);
      } else {
        toast.success(`Clocked in at ${item.clockIn.slice(0, 5)}`);
      }
      void load();
    } catch (err) {
      toast.error(hrApiError(err, 'Clock in/out failed'));
    } finally {
      setClocking(false);
    }
  }

  async function handleToggleOnboard(task: any) {
    setTogglingTaskId(task.id);
    try {
      await updateHrMeOnboarding(task.id, { isDone: !task.isDone });
      setOnboarding((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? { ...t, isDone: !task.isDone, completedAt: !task.isDone ? new Date().toISOString() : null }
            : t
        )
      );
      toast.success(!task.isDone ? `Marked "${task.itemLabel}" complete` : `Reopened "${task.itemLabel}"`);
    } catch (err) {
      toast.error(hrApiError(err, 'Could not update task'));
    } finally {
      setTogglingTaskId(null);
    }
  }

  // Calculate today's attendance state
  const todayDateStr = new Date().toISOString().slice(0, 10);
  const todayAttendance = attendance.find((a) => {
    const d = typeof a.workDate === 'string' ? a.workDate.slice(0, 10) : '';
    return d === todayDateStr;
  });
  const isClockedInToday = Boolean(todayAttendance?.clockIn && !todayAttendance?.clockOut);
  const hasClockedOutToday = Boolean(todayAttendance?.clockIn && todayAttendance?.clockOut);

  // Live ticking timer for clock-in shift & auto clock-out check
  useEffect(() => {
    if (!isClockedInToday || !todayAttendance?.clockIn) {
      setElapsedSeconds(0);
      return;
    }

    const calculateElapsed = () => {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      const [h, m, s = 0] = String(todayAttendance.clockIn).split(':').map(Number);
      const inDate = new Date(`${todayStr}T${pad(h)}:${pad(m)}:${pad(s)}`);
      const diffMs = Math.max(0, now.getTime() - inDate.getTime());
      return Math.floor(diffMs / 1000);
    };

    setElapsedSeconds(calculateElapsed());

    const interval = setInterval(() => {
      const secs = calculateElapsed();
      setElapsedSeconds(secs);

      // Check auto clock-out threshold
      const limitSecs = (attSettings?.autoClockOutHours || 8) * 3600;
      if (attSettings?.autoClockOutEnabled && secs >= limitSecs && !isAutoClockingOut) {
        setIsAutoClockingOut(true);
        clockHrMeAttendance({ action: 'clock_out', autoClockOut: true })
          .then(() => {
            toast.info(`Auto clock-out: ${attSettings.autoClockOutHours} hour shift limit reached`);
            void load();
          })
          .catch((err) => {
            console.error('Auto clock-out error:', err);
          })
          .finally(() => {
            setIsAutoClockingOut(false);
          });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isClockedInToday, todayAttendance?.clockIn, attSettings?.autoClockOutHours, attSettings?.autoClockOutEnabled, isAutoClockingOut, load]);

  const autoClockOutLimitHours = attSettings?.autoClockOutHours || 8;
  const autoClockOutLimitSeconds = autoClockOutLimitHours * 3600;
  const remainingSeconds = Math.max(0, autoClockOutLimitSeconds - elapsedSeconds);
  const shiftProgressPct = Math.min(100, Math.round((elapsedSeconds / autoClockOutLimitSeconds) * 100));

  let scheduledClockOutTime = '—';
  if (todayAttendance?.clockIn) {
    const [inH, inM] = String(todayAttendance.clockIn).split(':').map(Number);
    const endTotalMinutes = inH * 60 + inM + Math.round(autoClockOutLimitHours * 60);
    const endH = Math.floor((endTotalMinutes / 60) % 24);
    const endM = Math.floor(endTotalMinutes % 60);
    const pad = (n: number) => String(n).padStart(2, '0');
    scheduledClockOutTime = `${pad(endH)}:${pad(endM)}`;
  }

  function formatElapsedTime(totalSeconds: number) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  // Onboarding stats
  const completedTasks = onboarding.filter((t) => t.isDone).length;
  const totalTasks = onboarding.length;
  const onboardingPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="min-h-screen app-surface">
      <Sidebar />
      <div className="flex flex-col min-w-0 lg:ml-[280px]">
        <Header title="HR · Self-service" />
        <main className="p-6 md:p-8 space-y-6">
          {apiMissing && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-amber-700">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <div className="text-sm">
                <div className="font-semibold">Using linked-employee fallback</div>
                <div className="text-xs mt-0.5 opacity-80">
                  <code className="font-mono">/api/hr/me</code> not live — showing data for the employee linked to your user account when found.
                </div>
              </div>
            </div>
          )}

          {loading && <div className="text-muted-foreground">Loading employee portal…</div>}

          {!loading && !me && (
            <div className="glass-panel rounded-2xl border border-border/50 p-10 text-center">
              <User className="mx-auto text-[#D4A017] mb-3" size={28} />
              <h2 className="font-semibold text-lg">No employee profile linked</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                Ask your HR administrator to link your user account ({session?.user?.email}) to an employee record to access self-service features.
              </p>
            </div>
          )}

          {me && (
            <>
              {/* Profile banner & Quick actions */}
              <div className="glass-panel rounded-2xl border border-border/50 p-5 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#D4A017] to-amber-400 text-white flex items-center justify-center font-bold text-xl shadow-md shadow-[#D4A017]/20">
                    {(me.firstName?.[0] || 'E') + (me.lastName?.[0] || '')}
                  </div>
                  <div>
                    <h1 className="text-xl font-bold flex items-center gap-2">
                      {employeeName(me)}
                      <span className={`text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full ${statusBadgeClass(me.employmentStatus || 'active')}`}>
                        {me.employmentStatus || 'Active'}
                      </span>
                    </h1>
                    <div className="text-sm text-muted-foreground mt-0.5 flex flex-wrap items-center gap-2">
                      <span>#{me.employeeNumber}</span>
                      <span>•</span>
                      <span>{me.jobTitle || 'Team Member'}</span>
                      {me.department && (
                        <>
                          <span>•</span>
                          <span>{me.department}</span>
                        </>
                      )}
                      <span>•</span>
                      <span>{me.email || session?.user?.email}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Clock in / Clock out button */}
                  <button
                    type="button"
                    onClick={handleClock}
                    disabled={clocking}
                    className={`inline-flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold transition-all ${
                      isClockedInToday
                        ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/25 ring-2 ring-rose-500/20'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20'
                    }`}
                  >
                    {isClockedInToday ? (
                      <>
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                        </span>
                        <Clock size={15} />
                        <span>{clocking ? 'Clocking out…' : `Clock Out (${formatElapsedTime(elapsedSeconds)})`}</span>
                      </>
                    ) : (
                      <>
                        <Clock size={15} />
                        <span>{clocking ? 'Clocking…' : hasClockedOutToday ? 'Clock In Again' : 'Clock In'}</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setLeaveOpen(true)}
                    className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-[#D4A017] hover:bg-[#c49415] text-white text-sm font-medium shadow-lg shadow-[#D4A017]/20"
                  >
                    <Calendar size={14} /> Request leave
                  </button>

                  <button
                    type="button"
                    onClick={openEdit}
                    className="h-10 px-4 rounded-xl border border-border bg-card hover:bg-muted text-sm font-medium transition-colors"
                  >
                    Update details
                  </button>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex flex-wrap gap-2 border-b border-border/40 pb-3">
                {([
                  ['profile', 'My Profile', User],
                  ['immigration', 'Visa & Right to Work', ShieldCheck],
                  ['onboarding', `Onboarding (${completedTasks}/${totalTasks})`, CheckSquare],
                  ['attendance', 'Attendance & Clocking', Clock],
                  ['leave', `Leave (${leave.length})`, Calendar],
                  ['payslips', `Payslips (${payslips.length})`, Wallet],
                  ['documents', `Documents (${docs.length})`, FileText],
                ] as const).map(([id, label, Icon]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTab(id)}
                    className={`inline-flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-medium transition-colors ${
                      tab === id
                        ? 'bg-[#D4A017] text-white shadow-md shadow-[#D4A017]/20'
                        : 'bg-muted/70 hover:bg-muted text-foreground'
                    }`}
                  >
                    <Icon size={15} /> {label}
                  </button>
                ))}
              </div>

              {/* TAB 1: Profile */}
              {tab === 'profile' && (
                <div className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="glass-panel rounded-2xl border border-border/50 p-5 space-y-3">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        <Briefcase size={14} className="text-[#D4A017]" /> Employment Details
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Job Title</span>
                          <span className="font-medium">{me.jobTitle || '—'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Department</span>
                          <span className="font-medium">{me.department || '—'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Type</span>
                          <span className="font-medium capitalize">{(me.employmentType || 'full_time').replace(/_/g, ' ')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Hire Date</span>
                          <span className="font-medium">{formatDate(me.hireDate)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="glass-panel rounded-2xl border border-border/50 p-5 space-y-3">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        <Hash size={14} className="text-[#D4A017]" /> Tax & Payroll Identifiers
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Employee No.</span>
                          <span className="font-mono font-medium">{me.employeeNumber || '—'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">National Insurance</span>
                          <span className="font-mono font-medium">{me.niNumber || '—'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Tax Code</span>
                          <span className="font-mono font-medium">{me.taxCode || '1257L'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="glass-panel rounded-2xl border border-border/50 p-5 space-y-3">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        <MapPin size={14} className="text-[#D4A017]" /> Contact & Emergency
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Phone</span>
                          <span className="font-medium">{me.phone || '—'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Address</span>
                          <span className="font-medium text-right max-w-[200px] truncate">
                            {[me.addressLine1, me.city, me.postalCode].filter(Boolean).join(', ') || '—'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Emergency</span>
                          <span className="font-medium">
                            {[me.emergencyContactName, me.emergencyContactPhone].filter(Boolean).join(' · ') || '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button type="button" onClick={openEdit} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-border bg-card hover:bg-muted text-sm font-medium">
                      Edit Contact & Address
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: Visa & Right to Work */}
              {tab === 'immigration' && (
                <div className="space-y-6">
                  {immigration ? (
                    <div className="glass-panel rounded-2xl border border-border/50 p-6 space-y-6">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-semibold">
                            <ShieldCheck size={22} />
                          </div>
                          <div>
                            <h2 className="text-lg font-semibold flex items-center gap-2">
                              {immigration.visaType ? immigration.visaType.replace(/_/g, ' ').toUpperCase() : 'Visa Record'}
                              <span className={`text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full ${statusBadgeClass(immigration.status || 'valid')}`}>
                                {immigration.status || 'Valid'}
                              </span>
                            </h2>
                            <p className="text-xs text-muted-foreground">Verified by HR Compliance</p>
                          </div>
                        </div>

                        {immigration.visaExpiry && (
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground">Expiry Date</div>
                            <div className="text-sm font-bold text-foreground">{formatDate(immigration.visaExpiry)}</div>
                          </div>
                        )}
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="glass-panel rounded-xl border border-border/40 p-4">
                          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Share Code</div>
                          <div className="mt-1 font-mono text-sm font-bold text-[#D4A017]">{immigration.shareCode || '—'}</div>
                        </div>
                        <div className="glass-panel rounded-xl border border-border/40 p-4">
                          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Visa Type / Category</div>
                          <div className="mt-1 text-sm font-medium capitalize">
                            {(immigration.visaType || '—').replace(/_/g, ' ')}
                            {immigration.category && ` (${immigration.category})`}
                          </div>
                        </div>
                        <div className="glass-panel rounded-xl border border-border/40 p-4">
                          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">BRP / Reference No.</div>
                          <div className="mt-1 font-mono text-sm font-medium">{immigration.brpNumber || '—'}</div>
                        </div>
                        <div className="glass-panel rounded-xl border border-border/40 p-4">
                          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">RTW Check Verified</div>
                          <div className="mt-1 text-sm font-medium">
                            {immigration.rtwCheckedAt ? formatDate(immigration.rtwCheckedAt) : 'Pending Verification'}
                          </div>
                        </div>
                      </div>

                      {immigration.notes && (
                        <div className="p-4 rounded-xl bg-muted/40 border border-border/30 text-sm">
                          <span className="font-semibold text-xs uppercase tracking-wider text-muted-foreground block mb-1">HR Compliance Notes</span>
                          {immigration.notes}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="glass-panel rounded-2xl border border-border/50 p-8 text-center">
                      <ShieldCheck className="mx-auto text-muted-foreground mb-3" size={32} />
                      <h3 className="font-semibold text-base">No Right to Work / Visa Record on File</h3>
                      <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                        Your employer has not recorded any UK visa or immigration sponsorship details yet. If you are on a sponsored visa, please contact HR.
                      </p>
                    </div>
                  )}

                  {/* RTW Documents Section */}
                  <div className="glass-panel rounded-2xl border border-border/50 p-6 space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <FileText size={15} /> Right to Work & Identity Verification Documents
                    </h3>
                    {docs.filter((d) => d.isRtw).length === 0 ? (
                      <p className="text-sm text-muted-foreground">No RTW identity documents uploaded yet.</p>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {docs
                          .filter((d) => d.isRtw)
                          .map((d: any) => (
                            <div key={d.id} className="p-4 rounded-xl border border-border/40 bg-card/50 flex items-center justify-between">
                              <div>
                                <div className="font-medium text-sm">{d.documentName}</div>
                                <div className="text-xs text-muted-foreground capitalize">
                                  {d.documentType} {d.expiresAt ? `· Expiry: ${formatDate(d.expiresAt)}` : ''}
                                </div>
                              </div>
                              {d.documentUrl && (
                                <a
                                  href={d.documentUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-[#D4A017] font-semibold hover:underline"
                                >
                                  View <ExternalLink size={12} />
                                </a>
                              )}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: Onboarding Process */}
              {tab === 'onboarding' && (
                <div className="space-y-6">
                  {/* Progress summary card */}
                  <div className="glass-panel rounded-2xl border border-border/50 p-6 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-bold">New Starter Onboarding Checklist</h2>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          Follow the steps below to complete your onboarding process.
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-black text-[#D4A017]">{onboardingPct}%</div>
                        <div className="text-xs text-muted-foreground">{completedTasks} of {totalTasks} tasks completed</div>
                      </div>
                    </div>

                    <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-[#D4A017] to-amber-500 h-3 rounded-full transition-all duration-500"
                        style={{ width: `${onboardingPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Checklist items */}
                  <div className="glass-panel rounded-2xl border border-border/50 overflow-hidden divide-y divide-border/30">
                    {onboarding.length === 0 ? (
                      <div className="p-8 text-center text-sm text-muted-foreground">
                        No onboarding tasks assigned yet. Your HR administrator will assign your checklist shortly.
                      </div>
                    ) : (
                      onboarding.map((task: any) => {
                        const isDone = Boolean(task.isDone);
                        return (
                          <div
                            key={task.id}
                            className={`p-4 md:p-5 flex items-center justify-between gap-4 transition-colors ${
                              isDone ? 'bg-muted/10' : 'bg-card/30'
                            }`}
                          >
                            <div className="flex items-start gap-3.5">
                              <button
                                type="button"
                                onClick={() => handleToggleOnboard(task)}
                                disabled={togglingTaskId === task.id}
                                className={`mt-0.5 rounded-lg p-1 transition-colors ${
                                  isDone
                                    ? 'text-emerald-500 hover:text-emerald-600'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                {isDone ? <CheckCircle2 size={22} className="fill-emerald-500/20" /> : <Circle size={22} />}
                              </button>
                              <div>
                                <div className={`text-sm font-semibold ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                  {task.itemLabel}
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-2">
                                  {task.dueDate && <span>Due: {formatDate(task.dueDate)}</span>}
                                  {isDone && task.completedAt && (
                                    <>
                                      <span>•</span>
                                      <span className="text-emerald-600 font-medium">Completed on {formatDate(task.completedAt)}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <span
                              className={`text-[11px] font-bold uppercase px-2.5 py-1 rounded-full shrink-0 ${
                                isDone ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
                              }`}
                            >
                              {isDone ? 'Completed' : 'Pending'}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: Attendance & Clocking */}
              {tab === 'attendance' && (
                <div className="space-y-6">
                  {/* Today's Clock Status Banner */}
                  <div className="glass-panel rounded-2xl border border-border/50 p-6 space-y-6">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                          <Clock size={13} className="text-[#D4A017]" />
                          Today · {formatDate(todayDateStr)}
                        </div>

                        {isClockedInToday ? (
                          <div className="mt-2 space-y-1">
                            <div className="flex items-baseline gap-3 flex-wrap">
                              <span className="font-mono text-4xl sm:text-5xl font-black tracking-tight text-emerald-500 tabular-nums drop-shadow-sm">
                                {formatElapsedTime(elapsedSeconds)}
                              </span>
                              <span className="text-xs uppercase font-bold text-emerald-600 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                                Shift in progress
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2 pt-1">
                              <span>Clocked in at <strong className="text-foreground font-mono">{todayAttendance?.clockIn?.slice(0, 5)}</strong></span>
                              <span>•</span>
                              <span>Auto clock-out at <strong className="text-foreground font-mono">{scheduledClockOutTime}</strong></span>
                              <span>•</span>
                              <span>Max limit: <strong className="text-foreground">{autoClockOutLimitHours} hrs</strong></span>
                            </div>
                          </div>
                        ) : hasClockedOutToday ? (
                          <div className="mt-2 space-y-1">
                            <div className="text-2xl sm:text-3xl font-bold text-foreground">
                              Shift Completed ({todayAttendance?.hoursWorked ?? 0} hrs logged)
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-2">
                              <span>In: <strong className="text-foreground font-mono">{todayAttendance?.clockIn?.slice(0, 5)}</strong></span>
                              <span>•</span>
                              <span>Out: <strong className="text-foreground font-mono">{todayAttendance?.clockOut?.slice(0, 5)}</strong></span>
                              {todayAttendance?.notes?.includes('Auto clocked-out') && (
                                <span className="text-[10px] bg-amber-500/10 text-amber-600 border border-amber-500/20 px-1.5 py-0.5 rounded font-medium">
                                  Auto Clocked-Out
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2 space-y-1">
                            <div className="text-2xl font-bold text-muted-foreground">
                              Not clocked in yet today
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Standard shift: {attSettings.standardShiftHours}h · Auto clock-out configured at {autoClockOutLimitHours}h
                            </div>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={handleClock}
                        disabled={clocking}
                        className={`h-12 px-7 rounded-xl font-bold text-sm shadow-lg transition-all flex items-center gap-2.5 ${
                          isClockedInToday
                            ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/25 ring-2 ring-rose-500/20'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                        }`}
                      >
                        {isClockedInToday ? (
                          <>
                            <span className="relative flex h-2.5 w-2.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
                            </span>
                            <Clock size={16} />
                            <span>{clocking ? 'Clocking out…' : `Clock Out (${formatElapsedTime(elapsedSeconds)})`}</span>
                          </>
                        ) : (
                          <>
                            <Clock size={16} />
                            <span>{clocking ? 'Processing…' : hasClockedOutToday ? 'Clock In Again' : 'Clock In Now'}</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Progress Bar & Countdown when Clocked In */}
                    {isClockedInToday && (
                      <div className="p-4 rounded-xl bg-card border border-border/40 space-y-2.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-semibold text-foreground flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#D4A017]" />
                            Shift progress toward {autoClockOutLimitHours}h limit:
                          </span>
                          <span className="font-mono text-muted-foreground">
                            <strong className="text-foreground">{shiftProgressPct}%</strong> · <span className="text-[#D4A017] font-semibold">{formatElapsedTime(remainingSeconds)}</span> until auto clock-out
                          </span>
                        </div>

                        <div className="w-full bg-muted h-3 rounded-full overflow-hidden p-0.5">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              shiftProgressPct >= 95
                                ? 'bg-rose-500'
                                : shiftProgressPct >= 80
                                ? 'bg-amber-500'
                                : 'bg-gradient-to-r from-emerald-500 via-[#D4A017] to-amber-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(3, shiftProgressPct))}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>Clocked in: {todayAttendance?.clockIn?.slice(0, 5)}</span>
                          <span className="text-amber-600 font-medium">Auto-closing at {scheduledClockOutTime}</span>
                        </div>
                      </div>
                    )}

                    {/* Auto Clock-out Settings notice */}
                    <div className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-muted/40 border border-border/30 text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span>Auto clock-out rule: <strong>{attSettings.autoClockOutEnabled ? `Enabled (${autoClockOutLimitHours} hrs max)` : 'Disabled'}</strong></span>
                      </div>
                      <span className="text-[11px] opacity-80">Configured in HR Settings</span>
                    </div>
                  </div>

                  {/* Attendance Log Table */}
                  <div className="glass-panel rounded-2xl border border-border/50 overflow-hidden">
                    <div className="px-5 py-4 border-b border-border/40 font-semibold text-sm flex items-center justify-between">
                      <span>Recent Attendance Logs</span>
                      <span className="text-xs text-muted-foreground font-normal">{attendance.length} record(s)</span>
                    </div>
                    {attendance.length === 0 ? (
                      <div className="p-8 text-center text-sm text-muted-foreground">No attendance records found yet.</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-muted/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                            <tr>
                              <th className="px-5 py-3">Date</th>
                              <th className="px-5 py-3">Clock In</th>
                              <th className="px-5 py-3">Clock Out</th>
                              <th className="px-5 py-3">Hours</th>
                              <th className="px-5 py-3">Status</th>
                              <th className="px-5 py-3">Notes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/20">
                            {attendance.map((a: any) => (
                              <tr key={a.id} className="hover:bg-muted/20">
                                <td className="px-5 py-3.5 font-medium">{formatDate(a.workDate)}</td>
                                <td className="px-5 py-3.5 font-mono">{a.clockIn?.slice(0, 5) || '—'}</td>
                                <td className="px-5 py-3.5 font-mono">
                                  {a.clockOut?.slice(0, 5) || (a.clockIn ? (
                                    <span className="inline-flex items-center gap-1.5 text-emerald-600 font-semibold text-xs">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                      Active
                                    </span>
                                  ) : '—')}
                                </td>
                                <td className="px-5 py-3.5 font-semibold text-foreground">
                                  {a.hoursWorked != null ? `${a.hoursWorked} hrs` : (a.clockIn && !a.clockOut ? `${(elapsedSeconds / 3600).toFixed(2)} hrs` : '—')}
                                </td>
                                <td className="px-5 py-3.5">
                                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${statusBadgeClass(a.status || 'present')}`}>
                                    {a.status || 'present'}
                                  </span>
                                </td>
                                <td className="px-5 py-3.5 text-xs text-muted-foreground max-w-xs truncate">
                                  {a.notes ? (
                                    <span title={a.notes} className={a.notes.includes('Auto clocked-out') ? 'text-amber-600 font-medium' : ''}>
                                      {a.notes}
                                    </span>
                                  ) : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 5: Leave */}
              {tab === 'leave' && (
                <div className="space-y-4">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setLeaveOpen(true)}
                      className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-[#D4A017] hover:bg-[#c49415] text-white text-sm font-medium shadow-md shadow-[#D4A017]/20"
                    >
                      <Calendar size={14} /> Request leave
                    </button>
                  </div>
                  <div className="glass-panel rounded-2xl border border-border/50 overflow-hidden">
                    {leave.length === 0 && (
                      <div className="p-8 text-center">
                        <p className="text-sm text-muted-foreground mb-3">No leave requests recorded yet.</p>
                        <button
                          type="button"
                          onClick={() => setLeaveOpen(true)}
                          className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-[#D4A017] text-white text-sm font-medium"
                        >
                          Request leave
                        </button>
                      </div>
                    )}
                    {leave.map((r: any) => (
                      <div key={r.id} className="px-5 py-3.5 border-b border-border/30 last:border-0 flex justify-between items-center text-sm">
                        <div>
                          <div className="font-medium capitalize">{(r.leaveType || '').replace(/_/g, ' ')} ({r.totalDays} day{r.totalDays > 1 ? 's' : ''})</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {formatDate(r.startDate)} → {formatDate(r.endDate)} {r.reason && `· "${r.reason}"`}
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${statusBadgeClass(r.status)}`}>
                          {r.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 6: Payslips */}
              {tab === 'payslips' && (
                <div className="glass-panel rounded-2xl border border-border/50 overflow-hidden">
                  {payslips.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No payslips available yet.</div>}
                  {payslips.map((p: any) => (
                    <div key={p.id} className="px-5 py-3.5 border-b border-border/30 last:border-0 flex justify-between items-center text-sm">
                      <div>
                        <div className="font-medium">{p.periodLabel || formatDate(p.paymentDate) || 'Payslip'}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">Gross Pay: {formatMoney(p.grossPay)}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-[#D4A017]">{formatMoney(p.netPay)}</div>
                        {p.payslipUrl && (
                          <a href={p.payslipUrl} className="text-xs text-[#D4A017] hover:underline inline-flex items-center gap-1 mt-0.5" target="_blank" rel="noreferrer">
                            View Payslip <ExternalLink size={11} />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 7: Documents */}
              {tab === 'documents' && (
                <div className="glass-panel rounded-2xl border border-border/50 overflow-hidden">
                  {docs.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No documents uploaded yet.</div>}
                  {docs.map((d: any) => (
                    <div key={d.id} className="px-5 py-3.5 border-b border-border/30 last:border-0 flex justify-between items-center text-sm">
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {d.documentName}
                          {d.isRtw && (
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">
                              RTW Verified
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground capitalize mt-0.5">
                          {d.documentType} {d.expiresAt ? `· Expiry: ${formatDate(d.expiresAt)}` : ''}
                        </div>
                      </div>
                      {d.documentUrl && (
                        <a href={d.documentUrl} className="inline-flex items-center gap-1 text-xs text-[#D4A017] font-semibold hover:underline" target="_blank" rel="noreferrer">
                          Open <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Leave Request Modal */}
      <HrModal open={leaveOpen} onClose={() => setLeaveOpen(false)} title="Request leave" icon={Calendar}>
        <form onSubmit={saveLeave} className="space-y-4">
          <HrField label="Type">
            <select className={hrInputClass} value={leaveForm.leaveType} onChange={(e) => setLeaveForm({ ...leaveForm, leaveType: e.target.value })}>
              {LEAVE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </HrField>
          <div className="grid grid-cols-2 gap-3">
            <HrField label="Start"><input type="date" className={hrInputClass} required value={leaveForm.startDate} onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })} /></HrField>
            <HrField label="End"><input type="date" className={hrInputClass} required value={leaveForm.endDate} onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })} /></HrField>
          </div>
          <HrField label="Days"><input type="number" step="0.5" className={hrInputClass} value={leaveForm.totalDays} onChange={(e) => setLeaveForm({ ...leaveForm, totalDays: Number(e.target.value) })} /></HrField>
          <HrField label="Reason"><textarea className={hrTextareaClass} value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} /></HrField>
          <HrModalActions onCancel={() => setLeaveOpen(false)} submitLabel="Submit Request" submitting={saving} />
        </form>
      </HrModal>

      {/* Profile Edit Modal */}
      <HrModal open={editOpen} onClose={() => setEditOpen(false)} title="Update contact & address details" icon={User}>
        <form onSubmit={saveProfile} className="space-y-4">
          <HrField label="Phone number"><input className={hrInputClass} value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} /></HrField>
          <HrField label="Address Line 1"><input className={hrInputClass} value={profileForm.addressLine1} onChange={(e) => setProfileForm({ ...profileForm, addressLine1: e.target.value })} /></HrField>
          <HrField label="Address Line 2"><input className={hrInputClass} value={profileForm.addressLine2} onChange={(e) => setProfileForm({ ...profileForm, addressLine2: e.target.value })} /></HrField>
          <div className="grid grid-cols-2 gap-3">
            <HrField label="City"><input className={hrInputClass} value={profileForm.city} onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })} /></HrField>
            <HrField label="Postcode"><input className={hrInputClass} value={profileForm.postalCode} onChange={(e) => setProfileForm({ ...profileForm, postalCode: e.target.value })} /></HrField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <HrField label="Emergency contact name"><input className={hrInputClass} value={profileForm.emergencyContactName} onChange={(e) => setProfileForm({ ...profileForm, emergencyContactName: e.target.value })} /></HrField>
            <HrField label="Emergency phone"><input className={hrInputClass} value={profileForm.emergencyContactPhone} onChange={(e) => setProfileForm({ ...profileForm, emergencyContactPhone: e.target.value })} /></HrField>
          </div>
          <HrField label="Relationship"><input className={hrInputClass} placeholder="e.g. Spouse, Parent, Sibling" value={profileForm.emergencyContactRelationship} onChange={(e) => setProfileForm({ ...profileForm, emergencyContactRelationship: e.target.value })} /></HrField>
          <HrModalActions onCancel={() => setEditOpen(false)} submitLabel="Save Details" submitting={saving} />
        </form>
      </HrModal>
    </div>
  );
}
