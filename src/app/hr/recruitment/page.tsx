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
import {
  listJobPostings,
  createJobPosting,
  updateJobPosting,
  listApplicants,
  createApplicant,
  updateApplicant,
  convertApplicantToEmployee,
  listRoles,
} from '@/lib/api';
import { APPLICANT_STAGES, formatDate, hrApiError, isApiMissing, statusBadgeClass } from '@/lib/hr-utils';
import { HrModal, HrField, HrModalActions, hrInputClass, hrTextareaClass } from '@/components/hr/hr-modal';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Briefcase,
  Eye,
  Globe,
  Plus,
  Users,
  X,
  UserPlus,
  UserCheck,
  FileText,
  ExternalLink,
  Lock,
  Key,
  ShieldCheck,
  Building2,
  Mail,
  Phone,
  Calendar,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';

const EMPTY_JOB = {
  title: '',
  department: '',
  location: 'UK',
  employmentType: 'full_time',
  status: 'open',
  description: '',
};

const EMPTY_APPLICANT = {
  jobPostingId: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  stage: 'applied',
  notes: '',
};

export default function RecruitmentPage() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const { hasAccess } = useRoleCheck(['ADMIN', 'SUPER_ADMIN', 'HR_MANAGER', 'HR_ADMIN']);
  const [loading, setLoading] = useState(true);
  const [apiMissing, setApiMissing] = useState(false);
  const [jobs, setJobs] = useState<any[]>([]);
  const [applicants, setApplicants] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);

  // Modals state
  const [jobOpen, setJobOpen] = useState(false);
  const [appOpen, setAppOpen] = useState(false);
  const [viewApplicant, setViewApplicant] = useState<any | null>(null);
  const [hireApplicant, setHireApplicant] = useState<any | null>(null);

  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [jobForm, setJobForm] = useState(EMPTY_JOB);
  const [appForm, setAppForm] = useState(EMPTY_APPLICANT);

  // Hire & Convert form
  const [hireForm, setHireForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    jobTitle: '',
    department: '',
    employmentType: 'full_time',
    hireDate: new Date().toISOString().slice(0, 10),
    employeeNumber: '',
    annualSalary: '',
    createUserAccount: true,
    password: 'ChangeMe!2026',
    roleCode: 'B2B_M',
  });

  const orgId = session?.user?.organizationId;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [j, a, r] = await Promise.all([
        listJobPostings({ organizationId: orgId, limit: 200 }),
        listApplicants({ organizationId: orgId, limit: 200 }),
        listRoles().catch(() => ({ data: [] })),
      ]);
      setJobs(j.data || []);
      setApplicants(a.data || []);
      setRoles(r.data || []);
      setApiMissing(false);
    } catch (err) {
      if (isApiMissing(err)) {
        setApiMissing(true);
        setJobs([]);
        setApplicants([]);
      } else {
        toast.error(hrApiError(err, 'Failed to load recruitment'));
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

  function openApplicant(jobPostingId?: string | null) {
    setAppForm({ ...EMPTY_APPLICANT, jobPostingId: jobPostingId || '' });
    setAppOpen(true);
  }

  function openJob() {
    setJobForm(EMPTY_JOB);
    setJobOpen(true);
  }

  function openHireModal(applicant: any) {
    const job = applicant.jobPosting || jobs.find((j) => String(j.id) === String(applicant.jobPostingId));
    setHireApplicant(applicant);
    setHireForm({
      firstName: applicant.firstName || '',
      lastName: applicant.lastName || '',
      email: applicant.email || '',
      phone: applicant.phone || '',
      jobTitle: job?.title || 'Team Member',
      department: job?.department || '',
      employmentType: job?.employmentType || 'full_time',
      hireDate: new Date().toISOString().slice(0, 10),
      employeeNumber: `EMP${Math.floor(10000 + Math.random() * 90000)}`,
      annualSalary: '',
      createUserAccount: true,
      password: 'ChangeMe!2026',
      roleCode: roles.some((r) => r.code === 'B2B_M') ? 'B2B_M' : roles[0]?.code || 'STAFF',
    });
  }

  async function saveJob(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createJobPosting({
        ...jobForm,
        department: jobForm.department || null,
        location: jobForm.location || null,
        description: jobForm.description || null,
        organizationId: orgId,
      });
      toast.success('Job posting created');
      setJobOpen(false);
      void load();
    } catch (err) {
      toast.error(isApiMissing(err) ? 'Recruitment API not live yet' : hrApiError(err, 'Save failed'));
    } finally {
      setSaving(false);
    }
  }

  async function saveApplicant(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createApplicant({
        ...appForm,
        email: appForm.email || null,
        phone: appForm.phone || null,
        notes: appForm.notes || null,
      });
      toast.success('Applicant added');
      setAppOpen(false);
      void load();
    } catch (err) {
      toast.error(isApiMissing(err) ? 'Applicants API not live yet' : hrApiError(err, 'Save failed'));
    } finally {
      setSaving(false);
    }
  }

  const moveStage = useCallback(async (id: string, stage: string) => {
    try {
      await updateApplicant(id, { stage });
      toast.success('Stage updated');
      setApplicants((list) => list.map((a) => (a.id === id ? { ...a, stage } : a)));
    } catch (err) {
      toast.error(hrApiError(err, 'Update failed'));
    }
  }, []);

  const closeJob = useCallback(async (id: string) => {
    try {
      await updateJobPosting(id, { status: 'closed' });
      toast.success('Job closed');
      setJobs((list) => list.map((j) => (j.id === id ? { ...j, status: 'closed' } : j)));
    } catch (err) {
      toast.error(hrApiError(err, 'Update failed'));
    }
  }, []);

  async function handleConvertToEmployee(e: React.FormEvent) {
    e.preventDefault();
    if (!hireApplicant?.id) return;
    setConverting(true);
    try {
      const res = await convertApplicantToEmployee(hireApplicant.id, {
        ...hireForm,
        organizationId: orgId,
      });
      const createdEmp = res.data?.employee;
      toast.success(`Hired! Created Employee #${createdEmp?.employeeNumber || ''} with login credentials.`);
      setHireApplicant(null);
      setViewApplicant(null);
      void load();
      if (createdEmp?.id) {
        router.push(`/hr/employees/${createdEmp.id}`);
      }
    } catch (err) {
      toast.error(hrApiError(err, 'Failed to convert applicant to employee'));
    } finally {
      setConverting(false);
    }
  }

  const applicantCount = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of applicants) {
      const k = String(a.jobPostingId || a.jobPosting?.id || '');
      m[k] = (m[k] || 0) + 1;
    }
    return m;
  }, [applicants]);

  const visibleApplicants = useMemo(
    () => (selectedJob ? applicants.filter((a) => String(a.jobPostingId || a.jobPosting?.id) === selectedJob) : applicants),
    [applicants, selectedJob],
  );

  const jobColumns = useMemo<ColumnDef<any>[]>(() => [
    {
      id: 'title',
      accessorFn: (j) => j.title || '',
      header: 'Title',
      cell: ({ row }) => (
        <Link href={`/hr/recruitment/jobs/${row.original.id}`} className="text-[#D4A017] hover:underline font-semibold">
          {row.original.title}
        </Link>
      ),
    },
    { id: 'department', accessorFn: (j) => j.department || '', header: 'Department', cell: ({ getValue }) => String(getValue() || '—') },
    { id: 'location', accessorFn: (j) => j.location || '', header: 'Location', cell: ({ getValue }) => String(getValue() || '—') },
    {
      id: 'employmentType',
      accessorFn: (j) => (j.employmentType || '').replace(/_/g, ' '),
      header: 'Type',
      cell: ({ getValue }) => <span className="capitalize">{String(getValue() || '—')}</span>,
    },
    {
      id: 'applicants',
      accessorFn: (j) => applicantCount[String(j.id)] || 0,
      header: 'Applicants',
      cell: ({ getValue }) => <span className="font-bold text-[#D4A017]">{String(getValue())}</span>,
    },
    {
      id: 'status',
      accessorFn: (j) => j.status || '',
      header: 'Status',
      cell: ({ row }) => (
        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${statusBadgeClass(row.original.status)}`}>
          {row.original.status}
        </span>
      ),
    },
    { id: 'createdAt', accessorFn: (j) => j.postedAt || j.createdAt || '', header: 'Posted', cell: ({ row }) => formatDate(row.original.postedAt || row.original.createdAt) },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-2 whitespace-nowrap">
          <Link href={`/hr/recruitment/jobs/${row.original.id}`} className="p-1.5 rounded-lg text-muted-foreground hover:text-[#D4A017] hover:bg-muted" title="Open job">
            <Eye size={16} />
          </Link>
          <button
            type="button"
            onClick={() => setSelectedJob(String(row.original.id) === selectedJob ? null : String(row.original.id))}
            className="text-xs text-muted-foreground hover:text-[#D4A017]"
          >
            {String(row.original.id) === selectedJob ? 'Show all applicants' : 'Filter applicants'}
          </button>
          {row.original.status === 'open' && (
            <button type="button" className="text-xs text-muted-foreground hover:text-red-600" onClick={() => void closeJob(row.original.id)}>
              Close
            </button>
          )}
        </div>
      ),
    },
  ], [applicantCount, selectedJob, closeJob]);

  const applicantColumns = useMemo<ColumnDef<any>[]>(() => [
    {
      id: 'name',
      accessorFn: (a) => [a.firstName, a.lastName].filter(Boolean).join(' ') || a.name || '',
      header: 'Applicant Name',
      cell: ({ row, getValue }) => (
        <div>
          <button
            type="button"
            onClick={() => setViewApplicant(row.original)}
            className="font-semibold text-foreground hover:text-[#D4A017] hover:underline text-left block"
          >
            {String(getValue() || '—')}
          </button>
          {row.original.employeeId && (
            <span className="text-[10px] font-bold uppercase text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded">
              Employee #{row.original.employeeId}
            </span>
          )}
        </div>
      ),
    },
    { id: 'email', accessorFn: (a) => a.email || '', header: 'Email', cell: ({ getValue }) => String(getValue() || '—') },
    { id: 'phone', accessorFn: (a) => a.phone || '', header: 'Phone', cell: ({ getValue }) => String(getValue() || '—') },
    {
      id: 'job',
      accessorFn: (a) => a.jobPosting?.title || '',
      header: 'Applied Role',
      cell: ({ row }) => {
        const jid = row.original.jobPostingId || row.original.jobPosting?.id;
        return jid ? (
          <Link href={`/hr/recruitment/jobs/${jid}`} className="text-[#D4A017] hover:underline font-medium">
            {row.original.jobPosting?.title || `Job #${jid}`}
          </Link>
        ) : '—';
      },
    },
    {
      id: 'cv',
      header: 'Resume / CV',
      cell: ({ row }) => {
        const cv = row.original.cvUrl;
        return cv ? (
          <a
            href={cv}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-[#D4A017] font-semibold hover:underline bg-[#D4A017]/10 hover:bg-[#D4A017]/20 px-2.5 py-1 rounded-lg transition-colors"
          >
            <FileText size={13} /> View CV <ExternalLink size={10} />
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        );
      },
    },
    {
      id: 'stage',
      accessorFn: (a) => a.stage || '',
      header: 'Stage',
      cell: ({ row }) => (
        <select
          className="h-8 rounded-lg border border-border/80 bg-background px-2 text-xs font-medium"
          value={row.original.stage || 'applied'}
          onChange={(e) => void moveStage(row.original.id, e.target.value)}
        >
          {APPLICANT_STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          {row.original.stage === 'withdrawn' && <option value="withdrawn">Withdrawn</option>}
        </select>
      ),
    },
    { id: 'createdAt', accessorFn: (a) => a.createdAt || '', header: 'Applied Date', cell: ({ row }) => formatDate(row.original.createdAt) },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => {
        const a = row.original;
        const isHired = a.stage === 'hired' || Boolean(a.employeeId);
        return (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewApplicant(a)}
              className="p-1.5 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground"
              title="View full details & documents"
            >
              <Eye size={15} />
            </button>

            {isHired ? (
              <Link
                href={`/hr/employees/${a.employeeId}`}
                className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors"
              >
                <UserCheck size={13} /> View Employee
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => openHireModal(a)}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold bg-[#D4A017] hover:bg-[#c49415] text-white shadow-sm transition-all"
              >
                <UserPlus size={13} /> Hire as Employee
              </button>
            )}
          </div>
        );
      },
    },
  ], [moveStage]);

  const selectedJobTitle = selectedJob ? jobs.find((j) => String(j.id) === selectedJob)?.title : null;

  return (
    <div className="min-h-screen app-surface">
      <Sidebar />
      <div className="flex flex-col min-w-0 lg:ml-[280px]">
        <Header title="HR · Recruitment & Hiring" />
        <main className="p-6 md:p-8 space-y-6">
          {apiMissing && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-amber-700">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <div className="text-sm">
                <div className="font-semibold">Recruitment API not deployed yet</div>
                <div className="text-xs mt-0.5 opacity-80">Waiting on <code className="font-mono">/api/hr/job-postings</code> and applicants.</div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 justify-end">
            <a
              href="/careers"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-[#D4A017]/40 bg-[#D4A017]/10 hover:bg-[#D4A017]/20 text-[#D4A017] text-sm font-semibold transition-colors"
            >
              <Globe size={15} /> Public Careers Page
            </a>
            <button type="button" onClick={() => openApplicant(selectedJob)} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-border bg-card hover:bg-muted text-sm font-medium">
              <Users size={14} /> Add applicant
            </button>
            <button type="button" onClick={openJob} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-[#D4A017] hover:bg-[#c49415] text-white text-sm font-medium shadow-lg shadow-[#D4A017]/20">
              <Plus size={14} /> Create job
            </button>
          </div>

          {/* Job Postings Section */}
          <section className="glass-panel rounded-2xl border border-border/50 overflow-hidden">
            <div className="px-5 py-4 border-b border-border/50 font-semibold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Briefcase size={16} className="text-[#D4A017]" /> Active Job Postings ({jobs.length})
              </div>
              <div className="text-xs text-muted-foreground">Click a job to filter applicants below</div>
            </div>
            <div className="p-4">
              {loading ? (
                <div className="text-sm text-muted-foreground">Loading job postings…</div>
              ) : (
                <RichDataTable columns={jobColumns} data={jobs} searchPlaceholder="Search jobs…" />
              )}
            </div>
          </section>

          {/* Applicants Section */}
          <section className="glass-panel rounded-2xl border border-border/50 overflow-hidden">
            <div className="px-5 py-4 border-b border-border/50 font-semibold flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-[#D4A017]" /> Job Applicants ({visibleApplicants.length})
                {selectedJobTitle && (
                  <button type="button" onClick={() => setSelectedJob(null)} className="ml-2 inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-[#D4A017]/15 text-[#D4A017]">
                    Filtered by: {selectedJobTitle} <X size={12} />
                  </button>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                Click applicant name to view full profile & submitted documents
              </div>
            </div>
            <div className="p-4">
              {loading ? (
                <div className="text-sm text-muted-foreground">Loading applicants…</div>
              ) : (
                <RichDataTable columns={applicantColumns} data={visibleApplicants} searchPlaceholder="Search applicants by name, email, role…" />
              )}
            </div>
          </section>
        </main>
      </div>

      {/* MODAL 1: Create Job */}
      <HrModal open={jobOpen} onClose={() => setJobOpen(false)} title="Post a new job" icon={Briefcase}>
        <form onSubmit={saveJob} className="space-y-4">
          <HrField label="Job Title *"><input className={hrInputClass} required value={jobForm.title} onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })} placeholder="e.g. Senior Backend Engineer" /></HrField>
          <div className="grid grid-cols-2 gap-3">
            <HrField label="Department"><input className={hrInputClass} value={jobForm.department} onChange={(e) => setJobForm({ ...jobForm, department: e.target.value })} placeholder="e.g. Engineering" /></HrField>
            <HrField label="Location"><input className={hrInputClass} value={jobForm.location} onChange={(e) => setJobForm({ ...jobForm, location: e.target.value })} placeholder="e.g. London, UK / Hybrid" /></HrField>
          </div>
          <HrField label="Employment type">
            <select className={hrInputClass} value={jobForm.employmentType} onChange={(e) => setJobForm({ ...jobForm, employmentType: e.target.value })}>
              <option value="full_time">Full time</option>
              <option value="part_time">Part time</option>
              <option value="contract">Contract</option>
              <option value="temporary">Temporary</option>
            </select>
          </HrField>
          <HrField label="Job Description & Requirements"><textarea rows={4} className={hrTextareaClass} value={jobForm.description} onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })} placeholder="Describe role responsibilities, tech stack, and benefits…" /></HrField>
          <HrModalActions onCancel={() => setJobOpen(false)} submitLabel="Publish Job" submitting={saving} />
        </form>
      </HrModal>

      {/* MODAL 2: Add Applicant */}
      <HrModal open={appOpen} onClose={() => setAppOpen(false)} title="Add candidate" icon={Users}>
        <form onSubmit={saveApplicant} className="space-y-4">
          <HrField label="Select Job Posting *">
            <select className={hrInputClass} required value={appForm.jobPostingId} onChange={(e) => setAppForm({ ...appForm, jobPostingId: e.target.value })}>
              <option value="">Select a job…</option>
              {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
            </select>
          </HrField>
          <div className="grid grid-cols-2 gap-3">
            <HrField label="First name *"><input className={hrInputClass} required value={appForm.firstName} onChange={(e) => setAppForm({ ...appForm, firstName: e.target.value })} /></HrField>
            <HrField label="Last name *"><input className={hrInputClass} required value={appForm.lastName} onChange={(e) => setAppForm({ ...appForm, lastName: e.target.value })} /></HrField>
          </div>
          <HrField label="Email address *"><input type="email" autoComplete="off" className={hrInputClass} required value={appForm.email} onChange={(e) => setAppForm({ ...appForm, email: e.target.value })} /></HrField>
          <HrField label="Phone number"><input className={hrInputClass} value={appForm.phone} onChange={(e) => setAppForm({ ...appForm, phone: e.target.value })} /></HrField>
          <HrField label="Stage">
            <select className={hrInputClass} value={appForm.stage} onChange={(e) => setAppForm({ ...appForm, stage: e.target.value })}>
              {APPLICANT_STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </HrField>
          <HrField label="Notes"><textarea className={hrTextareaClass} value={appForm.notes} onChange={(e) => setAppForm({ ...appForm, notes: e.target.value })} /></HrField>
          <HrModalActions onCancel={() => setAppOpen(false)} submitLabel="Add Candidate" submitting={saving} />
        </form>
      </HrModal>

      {/* MODAL 3: View Applicant Details & Submitted Documents */}
      {viewApplicant && (
        <HrModal
          open={Boolean(viewApplicant)}
          onClose={() => setViewApplicant(null)}
          title="Candidate Profile & Documents"
          icon={Users}
        >
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-border/40">
              <div>
                <h3 className="text-xl font-bold">
                  {[viewApplicant.firstName, viewApplicant.lastName].filter(Boolean).join(' ') || 'Applicant'}
                </h3>
                <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-2">
                  <span>Applied for: <strong>{viewApplicant.jobPosting?.title || 'Open Position'}</strong></span>
                  <span>•</span>
                  <span>{formatDate(viewApplicant.createdAt)}</span>
                </div>
              </div>
              <span className={`text-xs font-bold uppercase px-3 py-1 rounded-full ${statusBadgeClass(viewApplicant.stage || 'applied')}`}>
                {viewApplicant.stage || 'applied'}
              </span>
            </div>

            {/* Contact Details */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3.5 rounded-xl border border-border/40 bg-card/50">
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Mail size={13} className="text-[#D4A017]" /> Email
                </div>
                <div className="mt-1 font-medium">{viewApplicant.email || '—'}</div>
              </div>
              <div className="p-3.5 rounded-xl border border-border/40 bg-card/50">
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Phone size={13} className="text-[#D4A017]" /> Phone
                </div>
                <div className="mt-1 font-medium">{viewApplicant.phone || '—'}</div>
              </div>
            </div>

            {/* CV & Documents Section */}
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <FileText size={14} className="text-[#D4A017]" /> Submitted Documents & Resume
              </div>
              {viewApplicant.cvUrl ? (
                <div className="p-4 rounded-xl border border-[#D4A017]/30 bg-[#D4A017]/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#D4A017]/15 text-[#D4A017] flex items-center justify-center font-bold">
                      <FileText size={20} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">Candidate Resume / CV</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[260px]">
                        {viewApplicant.cvUrl.split('/').pop() || 'Resume Document'}
                      </div>
                    </div>
                  </div>
                  <a
                    href={viewApplicant.cvUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#D4A017] hover:bg-[#c49415] text-white text-xs font-bold shadow-sm transition-all"
                  >
                    View / Download <ExternalLink size={12} />
                  </a>
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-border/40 text-xs text-muted-foreground text-center">
                  No resume document URL attached to this application.
                </div>
              )}
            </div>

            {/* Notes / Right to work notes */}
            {viewApplicant.notes && (
              <div className="space-y-1.5">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Applicant Notes & Details
                </div>
                <div className="p-3.5 rounded-xl bg-muted/40 border border-border/30 text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                  {viewApplicant.notes}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="pt-4 border-t border-border/40 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setViewApplicant(null)}
                className="h-10 px-4 rounded-xl border border-border bg-card text-xs font-medium"
              >
                Close
              </button>

              {viewApplicant.employeeId ? (
                <Link
                  href={`/hr/employees/${viewApplicant.employeeId}`}
                  className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20"
                >
                  <UserCheck size={14} /> View Employee #{viewApplicant.employeeId} Profile →
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => openHireModal(viewApplicant)}
                  className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-[#D4A017] hover:bg-[#c49415] text-white text-xs font-bold shadow-md shadow-[#D4A017]/25"
                >
                  <UserPlus size={14} /> Hire & Convert to Employee →
                </button>
              )}
            </div>
          </div>
        </HrModal>
      )}

      {/* MODAL 4: Convert Applicant to Employee & Provision User Account */}
      {hireApplicant && (
        <HrModal
          open={Boolean(hireApplicant)}
          onClose={() => setHireApplicant(null)}
          title="Hire & Convert Applicant to Employee"
          icon={UserPlus}
        >
          <form onSubmit={handleConvertToEmployee} className="space-y-5">
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 flex items-start gap-2.5">
              <CheckCircle2 size={16} className="text-[#D4A017] shrink-0 mt-0.5" />
              <div>
                Hiring <strong>{[hireApplicant.firstName, hireApplicant.lastName].filter(Boolean).join(' ')}</strong> will:
                <ul className="list-disc list-inside mt-1 space-y-0.5 opacity-90">
                  <li>Create an official <strong>Employee Profile</strong> with a unique employee number.</li>
                  <li>Provision an <strong>IAM User Account</strong> and portal login credentials.</li>
                  <li>Attach the applicant&apos;s CV directly to their <strong>Employee Documents</strong> file.</li>
                  <li>Initialize their <strong>Onboarding Checklist</strong> for RTW checks and starter forms.</li>
                </ul>
              </div>
            </div>

            {/* Employee Record Section */}
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Users size={14} className="text-[#D4A017]" /> 1. Employee Record Details
              </div>

              <div className="grid grid-cols-2 gap-3">
                <HrField label="Employee Number *">
                  <input
                    className={hrInputClass}
                    required
                    value={hireForm.employeeNumber}
                    onChange={(e) => setHireForm({ ...hireForm, employeeNumber: e.target.value })}
                  />
                </HrField>
                <HrField label="Hire / Start Date *">
                  <input
                    type="date"
                    className={hrInputClass}
                    required
                    value={hireForm.hireDate}
                    onChange={(e) => setHireForm({ ...hireForm, hireDate: e.target.value })}
                  />
                </HrField>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <HrField label="First Name *">
                  <input
                    className={hrInputClass}
                    required
                    value={hireForm.firstName}
                    onChange={(e) => setHireForm({ ...hireForm, firstName: e.target.value })}
                  />
                </HrField>
                <HrField label="Last Name *">
                  <input
                    className={hrInputClass}
                    required
                    value={hireForm.lastName}
                    onChange={(e) => setHireForm({ ...hireForm, lastName: e.target.value })}
                  />
                </HrField>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <HrField label="Job Title *">
                  <input
                    className={hrInputClass}
                    required
                    value={hireForm.jobTitle}
                    onChange={(e) => setHireForm({ ...hireForm, jobTitle: e.target.value })}
                  />
                </HrField>
                <HrField label="Department">
                  <input
                    className={hrInputClass}
                    value={hireForm.department}
                    onChange={(e) => setHireForm({ ...hireForm, department: e.target.value })}
                  />
                </HrField>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <HrField label="Employment Type">
                  <select
                    className={hrInputClass}
                    value={hireForm.employmentType}
                    onChange={(e) => setHireForm({ ...hireForm, employmentType: e.target.value })}
                  >
                    <option value="full_time">Full Time</option>
                    <option value="part_time">Part Time</option>
                    <option value="contract">Contract</option>
                    <option value="temporary">Temporary</option>
                    <option value="intern">Intern</option>
                  </select>
                </HrField>
                <HrField label="Annual Salary (GBP)">
                  <input
                    type="number"
                    step="500"
                    placeholder="e.g. 45000"
                    className={hrInputClass}
                    value={hireForm.annualSalary}
                    onChange={(e) => setHireForm({ ...hireForm, annualSalary: e.target.value })}
                  />
                </HrField>
              </div>
            </div>

            {/* IAM User Account & Login Credentials Section */}
            <div className="space-y-3 pt-3 border-t border-border/40">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Key size={14} className="text-[#D4A017]" /> 2. User Account & Login Credentials
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold">
                  <input
                    type="checkbox"
                    checked={hireForm.createUserAccount}
                    onChange={(e) => setHireForm({ ...hireForm, createUserAccount: e.target.checked })}
                    className="rounded border-border text-[#D4A017] focus:ring-[#D4A017]"
                  />
                  <span>Provision Login</span>
                </label>
              </div>

              {hireForm.createUserAccount && (
                <div className="p-4 rounded-xl border border-border/50 bg-card/50 space-y-3">
                  <HrField label="Login Email Address *">
                    <input
                      type="email"
                      required
                      className={hrInputClass}
                      value={hireForm.email}
                      onChange={(e) => setHireForm({ ...hireForm, email: e.target.value })}
                    />
                  </HrField>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <HrField label="Initial Password *">
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          className={`${hrInputClass} pr-10`}
                          value={hireForm.password}
                          onChange={(e) => setHireForm({ ...hireForm, password: e.target.value })}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground p-1"
                        >
                          {showPassword ? 'Hide' : 'Show'}
                        </button>
                      </div>
                    </HrField>

                    <HrField label="Portal Role Assignment">
                      <select
                        className={hrInputClass}
                        value={hireForm.roleCode}
                        onChange={(e) => setHireForm({ ...hireForm, roleCode: e.target.value })}
                      >
                        {roles.map((r) => (
                          <option key={r.id} value={r.code}>
                            {r.name} ({r.code})
                          </option>
                        ))}
                      </select>
                    </HrField>
                  </div>
                </div>
              )}
            </div>

            <HrModalActions
              onCancel={() => setHireApplicant(null)}
              submitLabel={converting ? 'Hiring…' : 'Confirm Hire & Create Account'}
              submitting={converting}
            />
          </form>
        </HrModal>
      )}
    </div>
  );
}
